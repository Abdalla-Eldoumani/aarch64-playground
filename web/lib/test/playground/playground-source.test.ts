import { describe, expect, it } from "vitest";
import { playgroundSource, wrapInMain } from "@/lib/playground/playground-source";
import type { ReferenceInstruction } from "@/lib/content/reference-data";

// The try-in-playground deep link carries playgroundSource(inst). The
// reference-data playground test proves every real payload assembles; this
// suite pins the text normalization itself: the exact wrapper program, the
// eight-space body indent, and runnable taking precedence over the example.

const WRAPPED_ADD = `        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        add x0, x0, 1
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
`;

function inst(over: Partial<ReferenceInstruction>): ReferenceInstruction {
  return {
    mnemonic: "add",
    category: "Data processing",
    syntax: "add xd, xn, op2",
    summary: "add",
    example: "add x0, x0, 1",
    ...over,
  };
}

describe("wrapInMain", () => {
  it("wraps a one-line example in the exact aapcs64 main scaffold", () => {
    expect(wrapInMain("add x0, x0, 1")).toBe(WRAPPED_ADD);
  });

  it("indents every line of a multi-line example by eight spaces", () => {
    const wrapped = wrapInMain("mov x1, 3\nadd x0, x0, x1");
    expect(wrapped).toContain("        mov x1, 3\n        add x0, x0, x1\n");
  });

  it("keeps the prologue before and the epilogue after the body", () => {
    const wrapped = wrapInMain("nop");
    const prologue = wrapped.indexOf("stp     x29, x30, [sp, -16]!");
    const body = wrapped.indexOf("        nop");
    const epilogue = wrapped.indexOf("ldp     x29, x30, [sp], 16");
    expect(prologue).toBeGreaterThan(-1);
    expect(body).toBeGreaterThan(prologue);
    expect(epilogue).toBeGreaterThan(body);
    // The wrapper returns 0 from main so a wrapped snippet exits clean.
    expect(wrapped).toContain("mov     w0, 0");
    expect(wrapped.trimEnd().endsWith("ret")).toBe(true);
  });
});

describe("playgroundSource", () => {
  it("returns the authored runnable verbatim when one exists", () => {
    const runnable = "        .global main\nmain:\n        mov w0, 0\n        ret\n";
    expect(playgroundSource(inst({ runnable }))).toBe(runnable);
  });

  it("wraps the bare example when no runnable is authored", () => {
    expect(playgroundSource(inst({}))).toBe(WRAPPED_ADD);
  });
});
