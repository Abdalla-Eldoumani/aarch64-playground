import { describe, expect, it } from "vitest";
import { describeLine, extractAliases, resolveAliases } from "@/lib/asm/explain-line";

describe("describeLine", () => {
  it("resolves a known mnemonic to its course-voice summary", () => {
    const out = describeLine("    mov x0, 1");
    expect(out).not.toBeNull();
    expect(out!.toLowerCase()).toContain("mov");
    expect(out!.toLowerCase()).toContain("copy register");
  });

  it("surfaces m4 alias resolution in the operand list", () => {
    const aliases = extractAliases("define(score1_r, w19)\n");
    const out = describeLine("    mov score1_r, 5", aliases);
    expect(out).toContain("score1_r=w19");
  });

  it("returns null for blank, comment-only, and label-only lines", () => {
    expect(describeLine("")).toBeNull();
    expect(describeLine("   ")).toBeNull();
    expect(describeLine("main:")).toBeNull();
    expect(describeLine("// just a comment")).toBeNull();
  });

  it("describes directives even though they have no instruction doc", () => {
    const out = describeLine("    .word 42");
    expect(out).not.toBeNull();
    expect(out).toContain(".word");
    expect(out!.toLowerCase()).toContain("emits data");
  });
});

describe("extractAliases", () => {
  it("captures define(name, value) pairs", () => {
    const aliases = extractAliases("define(fp, x29)\ndefine(score1_r, w19)\n");
    expect(aliases.fp).toBe("x29");
    expect(aliases.score1_r).toBe("w19");
  });
});

describe("resolveAliases", () => {
  it("annotates operands with their alias targets", () => {
    expect(resolveAliases("score1_r, 5", { score1_r: "w19" })).toBe("score1_r=w19, 5");
  });

  it("leaves operands without a matching alias untouched", () => {
    expect(resolveAliases("x0, 5", { score1_r: "w19" })).toBe("x0, 5");
  });
});
