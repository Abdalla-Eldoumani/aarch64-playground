//! Behaviour freeze for the LDR/STR addressing-mode parser.
//!
//! A wrong parse in `parse_addressing_mode` is a wrong ENCODING, not an
//! error: the discriminator that tells `[x0, x1]` from `[x0, #8]` hands
//! whatever it rejects to `parse_immediate`, so a mis-ordered check turns
//! a register-offset load into an immediate-offset load that assembles
//! and runs and reads the wrong address. Nothing downstream complains.
//! So the guard cannot be a handful of asserts: it has to be a spelling
//! corpus whose every outcome is pinned byte-for-byte.
//!
//! Every row's expected outcome comes from RUNNING the encoder, never
//! from a judgment about what the encoding ought to be. The fixture is a
//! record of what the assembler does today; a refactor that changes any
//! row has changed behaviour, whether or not the change looks like an
//! improvement.
//!
//! Mode A (default): compare the generated corpus against
//! tests/addressing-freeze.txt and fail listing every divergence.
//! Mode B (`ADDRESSING_FREEZE_REWRITE=1`): rewrite the fixture from
//! current behaviour. Regenerating is a deliberate act -- never a way to
//! make a failing mode A run pass.

use std::collections::{BTreeMap, BTreeSet};
use std::collections::HashMap;

use aarch64_emulator::assembler::encode_line_absolute;
use aarch64_emulator::errors::EmuError;

const FIXTURE: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/addressing-freeze.txt");

/// How much of a rejection message the fixture keeps. Long enough to name
/// the complaint, short enough that a reworded tail does not churn the
/// whole file.
const MESSAGE_CHARS: usize = 60;

// ---------------------------------------------------------------------------
// the corpus
// ---------------------------------------------------------------------------

/// (everything the spelling carries before the address, access scale in
/// bytes, whether this is a pair form). The scale drives the per-width
/// immediate edges below.
const INSTS: &[(&str, i64, bool)] = &[
    ("ldr x1, ", 8, false),
    ("str x1, ", 8, false),
    ("ldr w1, ", 4, false),
    ("str w1, ", 4, false),
    ("ldrb w1, ", 1, false),
    ("strb w1, ", 1, false),
    ("ldrh w1, ", 2, false),
    ("strh w1, ", 2, false),
    ("ldrsb w1, ", 1, false),
    ("ldrsb x1, ", 1, false),
    ("ldrsh w1, ", 2, false),
    ("ldrsh x1, ", 2, false),
    ("ldrsw x1, ", 4, false),
    ("ldr d1, ", 8, false),
    ("str d1, ", 8, false),
    ("ldr s1, ", 4, false),
    ("str s1, ", 4, false),
    ("ldp x1, x2, ", 8, true),
    ("stp x1, x2, ", 8, true),
    ("ldp w1, w2, ", 4, true),
    ("stp w1, w2, ", 4, true),
    ("ldp d1, d2, ", 8, true),
    ("stp d1, d2, ", 8, true),
    ("ldp s1, s2, ", 4, true),
    ("stp s1, s2, ", 4, true),
];

/// Every addressing form the parser discriminates between, `{b}` standing
/// in for the base register. The order matters only in that it fixes the
/// fixture's row order.
const FORMS: &[&str] = &[
    "[{b}]",
    "[{b}, #8]",
    "[{b}, 8]",
    "[{b}, #-8]",
    "[{b}, 0x10]",
    "[{b}, #8]!",
    "[{b}], #8",
    "[{b}], 8",
    "[{b}, x2]",
    "[{b}, w2, uxtw]",
    "[{b}, w2, sxtw]",
    "[{b}, w2, sxtw #2]",
    "[{b}, x2, lsl #0]",
    "[{b}, x2, lsl #3]",
    "[{b}, x2, sxtx]",
    "[{b}, x2, uxtx #2]",
];

const BASES: &[&str] = &["x0", "x15", "sp", "fp"];

/// Indices into `FORMS` -- one spelling per branch the parser can take.
/// The base register plays no part in choosing the branch, so the
/// non-x0 bases ride this subset instead of the full cross.
const FORM_SPREAD: &[usize] = &[0, 1, 3, 5, 6, 8, 11, 13];

/// Spellings the parser is expected to turn away -- plus a few it does
/// NOT turn away today (`[sp, w1]` picks up an implicit UXTW, and
/// `[x0, #8, #9]` silently drops the third operand). Whichever way each
/// one goes, the fixture pins it: a rewrite that "fixes" one of these
/// quirks is still a behaviour change and has to be argued for, not
/// slipped in.
const REJECTS: &[&str] = &[
    "[x0, #8",
    "[x0,,x1]",
    "[x0 x1]",
    "msg",
    "[x0, d1]",
    "[sp, w1]",
    "[x0, x1, ror #1]",
    "[x0], x1",
    "[x0, x1]!",
    "[]",
    "[x0, #8, #9]",
    "[x0, x1, lsl]",
    "[x0, w1, lsl #2]",
    "[x0, x1, uxtw]",
    "[x99, #8]",
    "[x0, x99]",
    "[x0]!extra",
];

/// Spellings that only exist to pin the ORDER the forms are checked in.
/// Each one is ambiguous under some other order: `[x0]!!` is a writeback
/// or a malformed tail depending on whether the `!` is looked at first,
/// `[x0] #8` is a post-index only because a non-empty tail is enough,
/// `[[x0]]` hinges on the first `]` winning over the last. Nobody writes
/// these on purpose -- they are here because the order that resolves
/// them was undocumented, and a rewrite that reorders the checks changes
/// what they encode to without changing anything that looks wrong.
const ORDER_QUIRKS: &[&str] = &[
    "[x0, x1, lsl, #3]",
    "[x0, x1, lsl #3, junk]",
    "[x0]!!",
    "[[x0]]",
    "[x0]]!",
    "[x0!]",
    "[x0] #8",
    "[x0, [x1]",
    "!",
    "[!",
    "]!",
    "[x0, x1!]",
    "[x0, #8], #4",
    "[x0, #8]!extra",
    "[ x0 ] , #8",
    "[x0 , x1 , lsl #3]",
];

fn render(template: &str, base: &str) -> String {
    template.replace("{b}", base)
}

/// `[x0, #8]` -> `[x0,#8]`. Commas lose their trailing space; the space
/// inside `sxtw #2` is not one of them.
fn tight(address: &str) -> String {
    address.replace(", ", ",").replace("[ ", "[")
}

/// `[x0, #8]` -> `[ x0 , #8 ]`.
fn padded(address: &str) -> String {
    address
        .replace(", ", " , ")
        .replace('[', "[ ")
        .replace(']', " ]")
}

fn push(out: &mut Vec<String>, seen: &mut BTreeSet<String>, spelling: String) {
    if seen.insert(spelling.clone()) {
        out.push(spelling);
    }
}

/// The generated spelling corpus, in fixture order. Deterministic: the
/// same build produces the same rows in the same sequence, so a fixture
/// diff is a behaviour diff and never a shuffle.
fn corpus() -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut seen: BTreeSet<String> = BTreeSet::new();

    // 1. every mnemonic/target width against every form, over the x0 base.
    for (prefix, _, _) in INSTS {
        for form in FORMS {
            push(&mut out, &mut seen, format!("{prefix}{}", render(form, "x0")));
        }
    }

    // 2. the other three bases -- x15 (a high numbered base), sp and fp
    // (the alias spellings the discriminator has to read as registers) --
    // over a spread of widths rather than the full cross.
    for (prefix, _, _) in INSTS
        .iter()
        .filter(|(p, _, _)| matches!(*p, "ldr x1, " | "strb w1, " | "ldrsw x1, " | "str s1, " | "ldp x1, x2, "))
    {
        for base in &BASES[1..] {
            for i in FORM_SPREAD {
                push(&mut out, &mut seen, format!("{prefix}{}", render(FORMS[*i], base)));
            }
        }
    }

    // 3. spacing. Only over a representative subset: the whitespace
    // handling is shared by every mnemonic, so crossing it with all of
    // them would pad the fixture without pinning anything new.
    for (prefix, _, _) in INSTS
        .iter()
        .filter(|(p, _, _)| matches!(*p, "ldr x1, " | "ldp d1, d2, "))
    {
        for form in FORMS {
            let address = render(form, "x0");
            push(&mut out, &mut seen, format!("{prefix}{}", tight(&address)));
            push(&mut out, &mut seen, format!("{prefix}{}", padded(&address)));
        }
    }

    // 4. case. The whole spelling goes uppercase, mnemonic included.
    for (prefix, _, _) in INSTS
        .iter()
        .filter(|(p, _, _)| matches!(*p, "ldr x1, " | "ldrb w1, " | "ldr s1, " | "stp w1, w2, "))
    {
        for form in FORMS {
            let spelling = format!("{prefix}{}", render(form, "x0"));
            push(&mut out, &mut seen, spelling.to_uppercase());
        }
    }

    // 5. per-width scale edges. The unsigned-offset form scales the
    // immediate by the access width, so the last in-range value, the
    // first out-of-range one, and a misaligned one are three different
    // code paths -- and the misaligned/negative ones silently fall
    // through to the unscaled LDUR/STUR encoding, which is the whole
    // reason this file exists.
    for (prefix, scale, pair) in INSTS {
        let offsets: Vec<i64> = if *pair {
            vec![63 * scale, 64 * scale, -64 * scale, -65 * scale, scale + 1]
        } else {
            vec![4095 * scale, 4096 * scale, scale + 1, -1, -256, -257]
        };
        for off in offsets {
            push(&mut out, &mut seen, format!("{prefix}[x0, #{off}]"));
        }
    }

    // 6. the writeback forms carry their own imm9 range, unscaled and
    // signed, so the edges land at different numbers than the scaled
    // form's.
    for (prefix, _, _) in INSTS
        .iter()
        .filter(|(p, _, _)| {
            matches!(*p, "ldr x1, " | "str w1, " | "ldrb w1, " | "ldr d1, " | "stp x1, x2, " | "ldp s1, s2, ")
        })
    {
        for off in [255i64, 256, -256, -257] {
            push(&mut out, &mut seen, format!("{prefix}[x0, #{off}]!"));
            push(&mut out, &mut seen, format!("{prefix}[x0], #{off}"));
        }
    }

    // 7. malformed and ambiguous spellings.
    for (prefix, _, _) in INSTS
        .iter()
        .filter(|(p, _, _)| matches!(*p, "ldr x1, " | "ldp x1, x2, " | "ldr d1, "))
    {
        for reject in REJECTS {
            push(&mut out, &mut seen, format!("{prefix}{reject}"));
        }
    }

    // 8. the order-of-checks quirks, over one integer and one pair
    // spelling. The parser's discrimination is shared, so two carriers
    // are enough to pin it.
    for (prefix, _, _) in INSTS
        .iter()
        .filter(|(p, _, _)| matches!(*p, "ldr x1, " | "stp x1, x2, "))
    {
        for quirk in ORDER_QUIRKS {
            push(&mut out, &mut seen, format!("{prefix}{quirk}"));
        }
    }

    out
}

// ---------------------------------------------------------------------------
// recording
// ---------------------------------------------------------------------------

/// Run one spelling through the real encoder and render the outcome.
/// `encode_line_absolute` is the same entry the hosted linker walks
/// `.text` through, so this is the production path, not a test-only
/// shortcut.
fn outcome(spelling: &str) -> String {
    let labels: HashMap<String, u64> = HashMap::new();
    match encode_line_absolute(spelling, 0, &labels, 1) {
        Ok(word) => format!("OK 0x{word:08X}"),
        Err(err) => {
            let message = match &err {
                EmuError::AssemblyError { message, .. } => message.clone(),
                other => other.to_string(),
            };
            let short: String = message
                .chars()
                .take(MESSAGE_CHARS)
                .map(|c| if c.is_control() { ' ' } else { c })
                .collect();
            format!("ERR {short}")
        }
    }
}

fn generate() -> Vec<(String, String)> {
    corpus()
        .into_iter()
        .map(|spelling| {
            let result = outcome(&spelling);
            (spelling, result)
        })
        .collect()
}

fn render_fixture(rows: &[(String, String)]) -> String {
    let mut text = String::new();
    for (spelling, result) in rows {
        text.push_str(spelling);
        text.push_str(" => ");
        text.push_str(result);
        text.push('\n');
    }
    text
}

/// Parse the fixture back. `\r` is stripped because the repository is
/// checked out with autocrlf on Windows and the fixture is a plain .txt.
fn parse_fixture(text: &str) -> Vec<(String, String)> {
    text.lines()
        .map(|line| line.trim_end_matches('\r'))
        .filter(|line| !line.is_empty())
        .map(|line| {
            let (spelling, result) = line
                .split_once(" => ")
                .unwrap_or_else(|| panic!("fixture row has no ` => ` separator: {line}"));
            (spelling.to_string(), result.to_string())
        })
        .collect()
}

#[test]
fn addressing_mode_spellings_are_frozen() {
    let rows = generate();
    let path = std::path::Path::new(FIXTURE);

    if std::env::var("ADDRESSING_FREEZE_REWRITE").as_deref() == Ok("1") {
        std::fs::write(path, render_fixture(&rows).as_bytes())
            .unwrap_or_else(|e| panic!("could not write {}: {e}", path.display()));
        eprintln!("rewrote {} with {} rows", path.display(), rows.len());
        return;
    }

    let text = std::fs::read_to_string(path).unwrap_or_else(|e| {
        panic!(
            "could not read {}: {e} -- generate it with \
             ADDRESSING_FREEZE_REWRITE=1 cargo test --test addressing_freeze",
            path.display()
        )
    });
    let fixture = parse_fixture(&text);

    let recorded: BTreeMap<&str, &str> = fixture
        .iter()
        .map(|(s, r)| (s.as_str(), r.as_str()))
        .collect();
    let current: BTreeMap<&str, &str> = rows.iter().map(|(s, r)| (s.as_str(), r.as_str())).collect();

    let mut divergences: Vec<String> = Vec::new();
    for (spelling, was) in &recorded {
        match current.get(spelling) {
            Some(now) if now == was => {}
            Some(now) => divergences.push(format!("  {spelling}\n      was: {was}\n      now: {now}")),
            None => divergences.push(format!("  {spelling}\n      was: {was}\n      now: <not generated>")),
        }
    }
    for spelling in current.keys() {
        if !recorded.contains_key(spelling) {
            divergences.push(format!(
                "  {spelling}\n      was: <not in fixture>\n      now: {}",
                current[spelling]
            ));
        }
    }

    if !divergences.is_empty() {
        let shown = divergences.len().min(40);
        panic!(
            "{} of {} frozen addressing-mode spellings changed:\n{}\n{}",
            divergences.len(),
            recorded.len(),
            divergences[..shown].join("\n"),
            if divergences.len() > shown {
                format!("  ... and {} more", divergences.len() - shown)
            } else {
                String::new()
            }
        );
    }

    // Row order is part of the fixture: a reordered corpus produces a
    // diff nobody can read, so catch the shuffle here rather than in
    // review.
    let recorded_order: Vec<&str> = fixture.iter().map(|(s, _)| s.as_str()).collect();
    let current_order: Vec<&str> = rows.iter().map(|(s, _)| s.as_str()).collect();
    assert_eq!(
        recorded_order, current_order,
        "the corpus order drifted from the fixture"
    );
}
