import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { INSTRUCTION_DOCS, lookupDoc } from "@/lib/asm/instruction-docs";

describe("instruction-docs cExample", () => {
  it("LDR carries a C-equivalent for its load form", () => {
    expect(INSTRUCTION_DOCS.LDR.cExample).toBeDefined();
    expect(INSTRUCTION_DOCS.LDR.cExample).toMatch(/Rd =.*\(int\*\)/);
  });

  it("MOV carries a C assignment", () => {
    expect(INSTRUCTION_DOCS.MOV.cExample).toMatch(/Rd =/);
  });

  it("CSEL carries the ternary form", () => {
    expect(INSTRUCTION_DOCS.CSEL.cExample).toMatch(/cond \? Rn : Rm/);
  });

  it("entries without a c equivalent simply omit the field", () => {
    expect(INSTRUCTION_DOCS.NOP.cExample).toBeUndefined();
  });
});

describe("lookupDoc", () => {
  it("collapses B.cond variants onto the B.COND entry", () => {
    expect(lookupDoc("B.EQ")).toBe(INSTRUCTION_DOCS["B.COND"]);
  });

  it("returns undefined for unknown mnemonics", () => {
    expect(lookupDoc("FROBNICATE")).toBeUndefined();
  });
});

// The hover-card list must cover every mnemonic the canonical reference
// documents. This mirrors the Rust drift guard (emulator/tests/
// reference_consistency.rs) on the web side: it parses the same instruction
// tables out of docs/instruction-reference.md and asserts lookupDoc resolves
// each, so the doc and the Monaco hover cards never drift apart. Parsing is
// self-contained here (no import from the Rust side).

// The 4-bit AArch64 condition codes the reference documents for the
// conditional-branch family.
const CONDITIONS = new Set([
  "EQ", "NE", "HS", "CS", "LO", "CC", "MI", "PL",
  "VS", "VC", "HI", "LS", "GE", "LT", "GT", "LE", "AL",
]);

// Canonicalize a documented mnemonic: upper-case, and fold every
// conditional-branch spelling (`B.cond`, `Bcond`, a concrete `B.EQ` / `BEQ`)
// onto the single `B.COND` entry lookupDoc resolves. The unconditional
// branches (`B`, `BL`, `BR`, `BLR`) are left untouched.
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
// exactly `Mnemonic`; that selects the instruction tables and skips the
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

describe("instruction-docs covers the documented set", () => {
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

  it("resolves every documented mnemonic through lookupDoc", () => {
    const missing = [...documented].filter((m) => lookupDoc(m) === undefined);
    expect(missing).toEqual([]);
  });

  it("covers the seven sign/zero-extend and pc-relative mnemonics", () => {
    for (const m of ["sxtb", "sxth", "sxtw", "uxtb", "uxth", "adr", "adrp"]) {
      expect(lookupDoc(m)).toBeDefined();
    }
  });
});
