import { describe, expect, it } from "vitest";
import { lintSource } from "./cpsc355-lint";

describe("cpsc355-lint alias-suffix", () => {
  it("flags a register alias whose name lacks _r/_s/_m", () => {
    const src = `define(score, w19)\n`;
    const markers = lintSource(src);
    expect(markers.length).toBe(1);
    expect(markers[0].ruleId).toBe("alias-suffix");
    expect(markers[0].line).toBe(1);
    expect(markers[0].severity).toBe("warning");
  });

  it("accepts a register alias ending in _r", () => {
    const src = `define(score_r, w19)\n`;
    expect(lintSource(src).filter((m) => m.ruleId === "alias-suffix")).toEqual([]);
  });

  it("excepts fp and lr aliases", () => {
    const src = `define(fp, x29)\ndefine(lr, x30)\n`;
    expect(lintSource(src).filter((m) => m.ruleId === "alias-suffix")).toEqual([]);
  });

  it("excepts integer literal bodies", () => {
    const src = `define(MAX, 42)\n`;
    expect(lintSource(src).filter((m) => m.ruleId === "alias-suffix")).toEqual([]);
  });
});

describe("cpsc355-lint missing-global-main", () => {
  it("flags a main: label without .global main", () => {
    const src = `.text\nmain:\n  ret\n`;
    const markers = lintSource(src);
    expect(markers.some((m) => m.ruleId === "missing-global-main")).toBe(true);
  });

  it("accepts main: when .global main is present", () => {
    const src = `.global main\nmain:\n  ret\n`;
    expect(lintSource(src).filter((m) => m.ruleId === "missing-global-main")).toEqual([]);
  });

  it("accepts .globl main as the directive too", () => {
    const src = `.globl main\nmain:\n  ret\n`;
    expect(lintSource(src).filter((m) => m.ruleId === "missing-global-main")).toEqual([]);
  });

  it("does not flag bare-metal source with no main: label", () => {
    const src = `start:\n  mov x0, 0\n  ret\n`;
    expect(lintSource(src).filter((m) => m.ruleId === "missing-global-main")).toEqual([]);
  });
});

describe("cpsc355-lint non-canonical-prologue", () => {
  it("flags a function whose first instruction is not stp fp, lr, [sp, ...]", () => {
    const src = `.global main\nmain:\n  mov x0, 0\n  ret\n`;
    const markers = lintSource(src);
    expect(markers.some((m) => m.ruleId === "non-canonical-prologue")).toBe(true);
  });

  it("accepts the canonical stp/mov fp pair", () => {
    const src = `.global main\nmain:\n  stp fp, lr, [sp, -16]!\n  mov fp, sp\n  ret\n`;
    expect(lintSource(src).filter((m) => m.ruleId === "non-canonical-prologue")).toEqual([]);
  });

  it("ignores comment lines between the label and the first instruction", () => {
    const src = `.global main\nmain:\n  // entry\n  stp fp, lr, [sp, alloc]!\n  mov fp, sp\n  ret\n`;
    expect(lintSource(src).filter((m) => m.ruleId === "non-canonical-prologue")).toEqual([]);
  });
});

describe("cpsc355-lint non-16-byte-alloc", () => {
  it("flags an alloc symbol that resolves to a non-16-multiple", () => {
    const src = `alloc = -8\n`;
    const markers = lintSource(src);
    expect(markers.some((m) => m.ruleId === "non-16-byte-alloc")).toBe(true);
  });

  it("accepts a -(16+16) & -16 expression", () => {
    const src = `alloc = -(16 + 16) & -16\n`;
    expect(lintSource(src).filter((m) => m.ruleId === "non-16-byte-alloc")).toEqual([]);
  });

  it("flags a [sp, K]! literal that is not a multiple of 16", () => {
    const src = `  stp fp, lr, [sp, -8]!\n`;
    expect(lintSource(src).some((m) => m.ruleId === "non-16-byte-alloc")).toBe(true);
  });

  it("accepts [sp, -16]!", () => {
    const src = `  stp fp, lr, [sp, -16]!\n`;
    expect(lintSource(src).filter((m) => m.ruleId === "non-16-byte-alloc")).toEqual([]);
  });
});
