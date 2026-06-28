import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { REFERENCE_INSTRUCTIONS, type ReferenceCategory } from "./reference-data";
import { lookupDoc } from "./instruction-docs";

// The web half of the drift guard. The Rust side
// (emulator/tests/reference_consistency.rs) pins the documented set to the
// assembler; this pins the same documented set to the reference UI data and to
// the hover cards, so the doc, the emulator, the reference, and the hover cards
// stay one consistent set. The parse below mirrors the Rust guard and is
// self-contained (no import from the Rust side). The one intentional
// difference: the reference models the conditional-branch family as a single UI
// entry, so this canon folds that family to one `B.COND` rather than the two
// placeholders the Rust guard keeps.

// The 4-bit AArch64 condition codes the reference documents for the
// conditional-branch family.
const CONDITIONS = new Set([
  "EQ", "NE", "HS", "CS", "LO", "CC", "MI", "PL",
  "VS", "VC", "HI", "LS", "GE", "LT", "GT", "LE", "AL",
]);

// The eight category sections of the reference, in doc order.
const CATEGORIES: ReadonlySet<ReferenceCategory> = new Set([
  "Data processing",
  "Compare and test",
  "Conditional select",
  "Memory",
  "PC-relative addressing",
  "Branches",
  "System",
  "Floating point",
]);

// Canonicalize a mnemonic: upper-case, and fold every conditional-branch
// spelling (`B.cond`, `Bcond`, a concrete `B.EQ` / `BEQ`) onto a single
// `B.COND`. The unconditional branches (`B`, `BL`, `BR`, `BLR`) are left alone.
function canon(mnemonic: string): string {
  const u = mnemonic.toUpperCase();
  if (u === "B.COND" || u === "BCOND") return "B.COND";
  if (u.startsWith("B.") && CONDITIONS.has(u.slice(2))) return "B.COND";
  if (u.startsWith("B") && u.length > 1 && CONDITIONS.has(u.slice(1))) {
    return "B.COND";
  }
  return u;
}

// Pull the first back-ticked token out of a table cell: "`LDR`" -> "LDR".
function firstBacktickToken(cell: string): string | undefined {
  const start = cell.indexOf("`");
  if (start === -1) return undefined;
  const end = cell.indexOf("`", start + 1);
  if (end === -1) return undefined;
  return cell.slice(start + 1, end).trim();
}

// Parse the documented mnemonic set from the reference's instruction tables.
// An "instruction table" is any Markdown table whose first header cell is
// exactly `Mnemonic`; that selects the eight instruction tables and skips the
// directive / pseudo / m4 / host-stub / syscall tables and all prose. Only the
// first column of each body row is read, so back-ticked aliases in the
// Form/Notes columns never leak in.
function documentedMnemonics(markdown: string): Set<string> {
  const set = new Set<string>();
  let inInstructionTable = false;
  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      inInstructionTable = false; // any non-table line ends the table
      continue;
    }
    const firstCell = trimmed.replace(/^\|/, "").split("|")[0]?.trim() ?? "";
    if (firstCell === "Mnemonic") {
      inInstructionTable = true;
      continue;
    }
    if (firstCell.startsWith("--")) continue; // header/body separator row
    if (inInstructionTable) {
      const tok = firstBacktickToken(firstCell);
      if (tok) set.add(canon(tok));
    }
  }
  return set;
}

describe("reference-data matches the documented instruction set", () => {
  // The test runs with cwd = web/, so the canonical reference is one level up.
  const referencePath = path.join(
    process.cwd(),
    "..",
    "docs",
    "instruction-reference.md",
  );
  const documented = documentedMnemonics(
    fs.readFileSync(referencePath, "utf8"),
  );

  it("parses a non-empty documented mnemonic set from the reference", () => {
    expect(documented.size).toBeGreaterThan(0);
  });

  it("covers exactly the documented set, with no drift", () => {
    const reference = new Set(
      REFERENCE_INSTRUCTIONS.map((insn) => canon(insn.mnemonic)),
    );
    const documentedOnly = [...documented]
      .filter((m) => !reference.has(m))
      .sort();
    const referenceOnly = [...reference]
      .filter((m) => !documented.has(m))
      .sort();
    // Surface the symmetric difference in the message so a drift is obvious,
    // mirroring the Rust guard's report of both directions.
    expect(
      { documentedOnly, referenceOnly },
      "instruction reference and reference-data drifted",
    ).toEqual({ documentedOnly: [], referenceOnly: [] });
  });

  it("resolves every documented mnemonic through lookupDoc", () => {
    const missing = [...documented].filter((m) => lookupDoc(m) === undefined);
    expect(missing).toEqual([]);
  });

  it("authors every encoding as exactly 32 bits", () => {
    for (const insn of REFERENCE_INSTRUCTIONS) {
      if (!insn.encoding) continue;
      const width = insn.encoding.reduce((sum, field) => sum + field.bits, 0);
      expect(width, `${insn.mnemonic} encoding width`).toBe(32);
    }
  });

  it("has no duplicate mnemonics", () => {
    const canonical = REFERENCE_INSTRUCTIONS.map((insn) => canon(insn.mnemonic));
    expect(canonical.length).toBe(new Set(canonical).size);
  });

  it("assigns every instruction one of the eight categories", () => {
    const invalid = REFERENCE_INSTRUCTIONS.filter(
      (insn) => !CATEGORIES.has(insn.category),
    ).map((insn) => insn.mnemonic);
    expect(invalid).toEqual([]);
  });
});
