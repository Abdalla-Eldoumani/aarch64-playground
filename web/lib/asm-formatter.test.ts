import { describe, expect, it } from "vitest";
import { formatAsm } from "./asm-formatter";

describe("formatAsm", () => {
  it("indents instructions and aligns operands", () => {
    const input = `main:\n  mov w0, 0\n  ret\n`;
    const expected = `main:\n        mov     w0, 0\n        ret\n`;
    expect(formatAsm(input)).toBe(expected);
  });

  it("lowercases mnemonics", () => {
    const input = `main:\n  MOV W0, #42\n  RET\n`;
    const got = formatAsm(input);
    expect(got).toContain("mov     w0, #42");
    expect(got).toContain("ret");
    expect(got).not.toContain("MOV");
  });

  it("preserves trailing comments after the code", () => {
    const input = `main:\n  mov w0, 0  // return value\n  ret\n`;
    const got = formatAsm(input);
    expect(got).toContain("// return value");
    // The comment should appear after the operands.
    const line = got.split("\n").find((l) => l.includes("mov"))!;
    expect(line.indexOf("//")).toBeGreaterThan(line.indexOf("mov"));
  });

  it("preserves blank lines", () => {
    const input = `main:\n  mov w0, 0\n\n  ret\n`;
    const got = formatAsm(input);
    const lines = got.split("\n");
    expect(lines).toContain("");
  });

  it("keeps labels and section directives at column 0", () => {
    const input = `.text\n.global main\nmain:\n  ret\n`;
    const got = formatAsm(input);
    const lines = got.split("\n");
    expect(lines[0]).toBe(".text");
    expect(lines[1]).toBe(".global main");
    expect(lines[2]).toBe("main:");
  });

  it("keeps m4 define and symbol assignments at column 0", () => {
    const input = `define(fp, x29)\nalloc = -16\nmain:\n  ret\n`;
    const got = formatAsm(input);
    expect(got.split("\n")[0]).toBe("define(fp, x29)");
    expect(got.split("\n")[1]).toBe("alloc = -16");
  });

  it("is idempotent under repeated runs", () => {
    const input = `define(fp, x29)\n\n.text\n.global main\nmain:\n  STP fp, lr, [sp, -16]!\n  mov fp, sp  // entry\n  mov w0, 0\n  ldp fp, lr, [sp], 16\n  ret\n`;
    const once = formatAsm(input);
    const twice = formatAsm(once);
    expect(twice).toBe(once);
  });

  it("preserves data directives following labels", () => {
    const input = `fmt:    .string "hello %d\\n"\n`;
    const got = formatAsm(input);
    expect(got).toContain("fmt:");
    expect(got).toContain(".string");
  });

  it("handles instructions whose mnemonic is longer than the column", () => {
    // ldrsb is 5 chars; the column width is 8, so still fits with at
    // least one trailing space.
    const input = `main:\n  ldrsb w0, [x1]\n`;
    const got = formatAsm(input);
    expect(got).toContain("        ldrsb   w0, [x1]");
  });

  it("does not touch lines that are pure comments", () => {
    const input = `// just a comment\n;; another\n`;
    const got = formatAsm(input);
    expect(got).toBe(`// just a comment\n;; another\n`);
  });
});
