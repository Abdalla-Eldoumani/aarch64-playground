//! Keeps `docs/instruction-reference.md`, the public list of what the
//! playground assembles and the source of the `/reference` pages, in step
//! with the assembler's `SUPPORTED_MNEMONICS`, and prints what each side
//! lacks when they differ. An assembler unit test checks that every name on
//! that list really assembles; a mnemonic the assembler takes but leaves
//! off that list is not caught here. The editor's hover cards
//! (`web/lib/asm/instruction-docs.ts`) are a separate list, not checked here.

use std::collections::BTreeSet;
use std::path::PathBuf;

use aarch64_emulator::assembler::SUPPORTED_MNEMONICS;

/// Resolve `docs/instruction-reference.md` relative to the crate. Mirrors the
/// `CARGO_MANIFEST_DIR` + `..` pattern the corpus test uses, but the
/// reference is a tracked file so it is always present (no skip-on-missing).
fn reference_path() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.pop(); // emulator/ -> repo root
    p.push("docs/instruction-reference.md");
    p
}

/// The 4-bit AArch64 condition codes the reference and the assembler share.
fn is_condition(s: &str) -> bool {
    matches!(
        s,
        "EQ" | "NE" | "HS" | "CS" | "LO" | "CC" | "MI" | "PL"
            | "VS" | "VC" | "HI" | "LS" | "GE" | "LT" | "GT" | "LE" | "AL" | "NV"
    )
}

/// Upper-case a mnemonic and fold every conditional branch to one of two
/// placeholders, so `B.EQ` on the assembler's list matches the reference's
/// single `B.cond` row. `B`, `BL`, `BR` and `BLR` stay as they are.
fn canon(mnemonic: &str) -> String {
    let u = mnemonic.to_ascii_uppercase();
    if u == "B.COND" {
        return "B.<CC>".to_string();
    }
    if u == "BCOND" {
        return "B<CC>".to_string();
    }
    if let Some(cc) = u.strip_prefix("B.") {
        if is_condition(cc) {
            return "B.<CC>".to_string();
        }
    } else if let Some(cc) = u.strip_prefix('B') {
        if is_condition(cc) {
            return "B<CC>".to_string();
        }
    }
    u
}

/// Pull the first back-ticked token out of a table cell: "`LDR`" -> "LDR".
/// Returns None when the cell carries no back-ticked token (separator rows,
/// blank cells).
fn first_backtick_token(cell: &str) -> Option<String> {
    let start = cell.find('`')? + 1;
    let rest = &cell[start..];
    let end = rest.find('`')?;
    Some(rest[..end].trim().to_string())
}

/// The mnemonics in the reference's instruction tables, the ones whose
/// first header cell is `Mnemonic`; the directive, pseudo-instruction, m4,
/// libc and syscall tables use other headers. Only the first column is
/// read, so aliases named in the `Notes`/`Form` columns (`SBFM`, `ADD`)
/// stay out.
fn documented_mnemonics(markdown: &str) -> BTreeSet<String> {
    let mut set = BTreeSet::new();
    let mut in_instruction_table = false;
    for line in markdown.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with('|') {
            // Any non-table line (blank, heading, prose) ends the table.
            in_instruction_table = false;
            continue;
        }
        let first_cell = trimmed
            .trim_matches('|')
            .split('|')
            .next()
            .unwrap_or("")
            .trim();
        if first_cell == "Mnemonic" {
            in_instruction_table = true;
            continue;
        }
        if first_cell.starts_with("--") {
            continue; // header/body separator row
        }
        if in_instruction_table {
            if let Some(tok) = first_backtick_token(first_cell) {
                set.insert(canon(&tok));
            }
        }
    }
    set
}

#[test]
fn documented_set_matches_supported_set() {
    let path = reference_path();
    let markdown = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("cannot read {}: {e}", path.display()));

    let documented = documented_mnemonics(&markdown);
    assert!(
        !documented.is_empty(),
        "parsed no mnemonics from {}; has the instruction-table format changed?",
        path.display()
    );

    let supported: BTreeSet<String> = SUPPORTED_MNEMONICS.iter().map(|m| canon(m)).collect();

    let documented_only: Vec<&String> = documented.difference(&supported).collect();
    let supported_only: Vec<&String> = supported.difference(&documented).collect();

    if !documented_only.is_empty() || !supported_only.is_empty() {
        eprintln!("instruction reference and emulator drifted:");
        if !documented_only.is_empty() {
            eprintln!("  documented but NOT supported (fix the reference, or add support):");
            for m in &documented_only {
                eprintln!("    {m}");
            }
        }
        if !supported_only.is_empty() {
            eprintln!("  supported but NOT documented (add a table row to the reference):");
            for m in &supported_only {
                eprintln!("    {m}");
            }
        }
        panic!(
            "instruction-reference.md drift: {} documented-only, {} supported-only",
            documented_only.len(),
            supported_only.len()
        );
    }
}
