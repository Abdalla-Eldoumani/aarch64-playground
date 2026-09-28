//! The LDR/STR addressing-mode parser, held to GNU as.
//!
//! A wrong parse in `parse_addressing_mode` is a wrong ENCODING, not an
//! error: the discriminator that tells `[x0, x1]` from `[x0, #8]` hands
//! whatever it rejects to `parse_immediate`, so a mis-ordered check turns
//! a register-offset load into an immediate-offset load that assembles
//! and runs and reads the wrong address. Nothing downstream complains.
//! So the guard is a spelling corpus whose every outcome is checked
//! against what GNU as does with the same line.
//!
//! tests/addressing-freeze.txt is that answer: every spelling below,
//! assembled by GNU as on csarm, with the word as encoded or the error it
//! refused the line with. A spelling as encodes must encode to the same
//! word here, and a spelling as refuses must be refused here. The error
//! text is not compared: the playground words its refusals for students.
//!
//! The rows where the encoder is known to part from as are listed in
//! `KNOWN_GAPS` with what the encoder does instead. A listed row that
//! changes fails too, so a fixed gap has to leave the list.
//!
//! `ADDRESSING_FREEZE_SPELLINGS=<file>` writes the corpus there, one
//! spelling per line, for a new capture; the test fails while the fixture
//! and the corpus list different spellings.

use std::collections::{BTreeSet, HashMap};

use aarch64_emulator::assembler::encode_line_absolute;
use aarch64_emulator::errors::EmuError;

const FIXTURE: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/addressing-freeze.txt");

/// Rows where the encoder and GNU as disagree today, with the encoder's
/// outcome (`0xWORD`, or `ERR` for a refusal).
const KNOWN_GAPS: &[(&str, &str)] = &[
    // A label operand: as encodes one LDR (literal) and leaves the address
    // to the linker. The hosted pipeline lowers `ldr reg, label` to two
    // words before the encoder sees it (tests/server_parity.rs), so the
    // one-line encoder never takes a label here.
    ("ldr x1, msg", "ERR"),
    ("ldr d1, msg", "ERR"),
    // as sets the S bit when a byte access spells out its `lsl #0`; the
    // encoder leaves it clear. Both load the byte at x0 + x2.
    ("ldrb w1, [x0, x2, lsl #0]", "0x38626801"),
    ("strb w1, [x0, x2, lsl #0]", "0x38226801"),
    ("ldrsb w1, [x0, x2, lsl #0]", "0x38e26801"),
    ("ldrsb x1, [x0, x2, lsl #0]", "0x38a26801"),
    ("LDRB W1, [X0, X2, LSL #0]", "0x38626801"),
    // as refuses UXTX on a register offset; the encoder reads it as LSL.
    ("ldr w1, [x0, x2, uxtx #2]", "0xb8627801"),
    ("str w1, [x0, x2, uxtx #2]", "0xb8227801"),
    ("ldrsw x1, [x0, x2, uxtx #2]", "0xb8a27801"),
    ("ldr s1, [x0, x2, uxtx #2]", "0xbc627801"),
    ("str s1, [x0, x2, uxtx #2]", "0xbc227801"),
    ("LDR S1, [X0, X2, UXTX #2]", "0xbc627801"),
    // as refuses a shift with no amount; the encoder reads a bare `lsl`
    // as no shift at all.
    ("ldr x1, [x0, x1, lsl]", "0xf8616801"),
    ("ldr d1, [x0, x1, lsl]", "0xfc616801"),
];

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
    ("ldr h1, ", 2, false),
    ("str h1, ", 2, false),
    ("ldr b1, ", 1, false),
    ("str b1, ", 1, false),
    ("ldr q1, ", 16, false),
    ("str q1, ", 16, false),
    ("ldp x1, x2, ", 8, true),
    ("stp x1, x2, ", 8, true),
    ("ldp w1, w2, ", 4, true),
    ("stp w1, w2, ", 4, true),
    ("ldp d1, d2, ", 8, true),
    ("stp d1, d2, ", 8, true),
    ("ldp s1, s2, ", 4, true),
    ("stp s1, s2, ", 4, true),
    ("ldp q1, q2, ", 16, true),
    ("stp q1, q2, ", 16, true),
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

/// Indices into `FORMS`: one spelling per branch the parser can take.
/// The base register plays no part in choosing the branch, so the
/// non-x0 bases ride this subset instead of the full cross.
const FORM_SPREAD: &[usize] = &[0, 1, 3, 5, 6, 8, 11, 13];

/// Malformed spellings. as refuses all but `msg` (a label, which it
/// leaves to the linker), and the parser has to refuse them too:
/// `[sp, w1]` once picked up an implicit UXTW and `[x0, #8, #9]` once
/// dropped its third operand without a word.
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
/// these on purpose; they are here because the order that resolves
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
/// same build produces the same rows in the same sequence, so a new
/// capture diffs against the old one row for row, never as a shuffle.
fn corpus() -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut seen: BTreeSet<String> = BTreeSet::new();

    // 1. every mnemonic/target width against every form, over the x0 base.
    for (prefix, _, _) in INSTS {
        for form in FORMS {
            push(&mut out, &mut seen, format!("{prefix}{}", render(form, "x0")));
        }
    }

    // 2. the other three bases: x15 (a high numbered base), sp and fp
    // (the alias spellings the discriminator has to read as registers),
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
    // code paths, and the misaligned/negative ones silently fall
    // through to the unscaled LDUR/STUR encoding, the silent case this
    // file was written for.
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
// comparing
// ---------------------------------------------------------------------------

/// Run one spelling through the real encoder. `encode_line_absolute` is
/// the same entry the hosted linker walks `.text` through, so this is the
/// production path, not a test-only shortcut.
fn encode(spelling: &str) -> Result<u32, String> {
    let labels: HashMap<String, u64> = HashMap::new();
    encode_line_absolute(spelling, 0, &labels, 1).map_err(|err| match err {
        EmuError::AssemblyError { message, .. } => message,
        other => other.to_string(),
    })
}

/// A word as `0xWORD`, a refusal (`None`) as `ERR`: the form the fixture
/// and `KNOWN_GAPS` write outcomes in.
fn short(word: Option<u32>) -> String {
    word.map_or_else(|| "ERR".to_string(), |w| format!("0x{w:08x}"))
}

/// Read the capture: `spelling => 0xWORD`, optionally followed by
/// ` => reloc ...`, or `spelling => ERR <message>` (read as `None`). `#`
/// lines are the header. `\r` is stripped because the repository is
/// checked out with autocrlf on Windows and the fixture is a plain .txt.
fn parse_fixture(text: &str) -> Vec<(String, Option<u32>)> {
    text.lines()
        .map(|line| line.trim_end_matches('\r'))
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .map(|line| {
            let (spelling, result) = line
                .split_once(" => ")
                .unwrap_or_else(|| panic!("fixture row has no ` => ` separator: {line}"));
            if result.starts_with("ERR") {
                return (spelling.to_string(), None);
            }
            let word = result
                .split(' ')
                .next()
                .and_then(|w| w.strip_prefix("0x"))
                .and_then(|hex| u32::from_str_radix(hex, 16).ok())
                .unwrap_or_else(|| panic!("fixture row has no word: {line}"));
            (spelling.to_string(), Some(word))
        })
        .collect()
}

#[test]
fn addressing_mode_spellings_encode_as_gnu_as_does() {
    let spellings = corpus();

    if let Ok(path) = std::env::var("ADDRESSING_FREEZE_SPELLINGS") {
        std::fs::write(&path, format!("{}\n", spellings.join("\n")))
            .unwrap_or_else(|e| panic!("could not write {path}: {e}"));
        eprintln!("wrote {} spellings to {path}", spellings.len());
        return;
    }

    let path = std::path::Path::new(FIXTURE);
    let text = std::fs::read_to_string(path)
        .unwrap_or_else(|e| panic!("could not read {}: {e}", path.display()));
    let fixture = parse_fixture(&text);

    // The capture has to answer for exactly this corpus, in this order.
    let listed: Vec<&str> = fixture.iter().map(|(s, _)| s.as_str()).collect();
    let generated: Vec<&str> = spellings.iter().map(String::as_str).collect();
    if listed != generated {
        let missing: Vec<&&str> = generated.iter().filter(|s| !listed.contains(s)).take(10).collect();
        let extra: Vec<&&str> = listed.iter().filter(|s| !generated.contains(s)).take(10).collect();
        panic!(
            "the fixture and the corpus list different spellings or orders \
             (not captured: {missing:?}; captured but not generated: {extra:?}); \
             capture the corpus again"
        );
    }

    let known: HashMap<&str, &str> = KNOWN_GAPS.iter().copied().collect();
    for spelling in known.keys() {
        assert!(
            generated.contains(spelling),
            "KNOWN_GAPS lists `{spelling}`, which the corpus does not generate"
        );
    }

    let mut divergences: Vec<String> = Vec::new();
    for (spelling, gas) in &fixture {
        let outcome = encode(spelling);
        let (expected, note) = match known.get(spelling.as_str()) {
            Some(pinned) => {
                assert_ne!(
                    *pinned,
                    short(*gas),
                    "KNOWN_GAPS lists `{spelling}` with the outcome as gives it, so it is no gap"
                );
                (pinned.to_string(), " (a known gap)")
            }
            None => (short(*gas), ""),
        };
        if short(outcome.as_ref().ok().copied()) != expected {
            let now = outcome.map_or_else(|m| format!("ERR {m}"), |w| short(Some(w)));
            divergences.push(format!(
                "  {spelling}\n      as:       {}\n      expected: {expected}{note}\n      now:      {now}",
                short(*gas)
            ));
        }
    }

    if !divergences.is_empty() {
        let shown = divergences.len().min(40);
        panic!(
            "{} of {} addressing-mode spellings differ from GNU as:\n{}\n{}",
            divergences.len(),
            fixture.len(),
            divergences[..shown].join("\n"),
            if divergences.len() > shown {
                format!("  ... and {} more", divergences.len() - shown)
            } else {
                String::new()
            }
        );
    }
}
