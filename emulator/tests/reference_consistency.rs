//! Drift guard: the public instruction reference and the emulator's
//! supported set must stay in sync.
//!
//! `docs/instruction-reference.md` is the canonical public list of every
//! mnemonic the playground assembles. This test parses that document's
//! instruction tables and compares the documented mnemonics against
//! `assembler::SUPPORTED_MNEMONICS`. If the two diverge -- a
//! decoder/assembler change adds or drops a mnemonic without a matching doc
//! edit, or the reference lists something the assembler rejects -- the test
//! fails and prints the symmetric difference so the reconciliation is
//! obvious.
//!
//! The supported list is no longer transcribed here. It is the assembler's
//! own const, declared directly above the `encode_line` dispatch it
//! describes, and an assembler unit test probes every entry through that
//! dispatch. So the document and the dispatch cannot drift silently: a new
//! arm that never reaches the const fails nothing here, but a const entry
//! with no arm fails in `assembler.rs` and a const entry with no table row
//! fails here.
//!
//! Scope: this guards the canonical reference (`docs/instruction-reference.md`,
//! which feeds the `/reference` pages). The Monaco hover-card list
//! (`web/lib/asm/instruction-docs.ts`) is a separate surface and is not parsed
//! here.

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
            | "VS" | "VC" | "HI" | "LS" | "GE" | "LT" | "GT" | "LE" | "AL"
    )
}

/// Canonicalize a mnemonic for comparison: upper-case, and fold the
/// conditional-branch family down to two placeholders so the concrete `B.EQ`
/// arm and the documented generic `B.cond` row compare equal. Leaves the
/// unconditional branches (`B`, `BL`, `BR`, `BLR`) untouched.
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

/// Parse the documented mnemonic set from the reference's instruction tables.
/// An "instruction table" is any Markdown table whose first header cell is
/// exactly `Mnemonic`; that selects the eight instruction tables and skips the
/// directive, pseudo-instruction, m4, host-stub, and syscall tables (which use
/// different first headers) plus all prose. Only the first column of each row
/// is read, so back-ticked mnemonics in the `Notes`/`Form` columns (aliases
/// like `SBFM`, `ADD`) never leak into the set.
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
        "parsed no mnemonics from {} -- has the instruction-table format changed?",
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
