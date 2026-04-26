import { describe, expect, it } from "vitest";
import { INSTRUCTION_DOCS, lookupDoc } from "./instruction-docs";

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
