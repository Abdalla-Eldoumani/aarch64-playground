import { describe, expect, it } from "vitest";
import {
  buildSuggestions,
  type CompletionContext,
} from "@/lib/asm/asm-completion";

function ctx(source: string, line: string, position: number): CompletionContext {
  return { source, line, position };
}

describe("buildSuggestions", () => {
  it("suggests directives when the line starts with `.`", () => {
    const got = buildSuggestions(ctx("", ".s", 2));
    const labels = got.map((s) => s.label);
    expect(labels).toContain(".string");
    expect(labels).toContain(".skip");
    expect(labels).toContain(".section");
  });

  it("suggests libc + labels in a `bl` context", () => {
    const got = buildSuggestions(
      ctx(".text\nmain:\n  ret\n", "  bl pr", 7),
    );
    const labels = got.map((s) => s.label);
    expect(labels).toContain("printf");
    // Filter prefix `pr` should also include other matches; main is a
    // valid label but should appear in the candidate set since labels
    // are always suggested in bl contexts.
    expect(labels).toContain("main");
  });

  it("suggests registers and m4 aliases inside an operand", () => {
    const source = "define(score_r, w19)\ndefine(fp, x29)\nmain:\n  mov ";
    const got = buildSuggestions(ctx(source, "  mov ", 6));
    const labels = got.map((s) => s.label);
    expect(labels).toContain("x0");
    expect(labels).toContain("w0");
    expect(labels).toContain("sp");
    expect(labels).toContain("score_r");
    expect(labels).toContain("fp");
  });

  it("suggests mnemonics at the start of an instruction line", () => {
    const got = buildSuggestions(ctx(".text\nmain:\n", "  m", 3));
    const labels = got.map((s) => s.label);
    expect(labels.some((l) => l.toLowerCase() === "mov")).toBe(true);
    expect(labels.some((l) => l.toLowerCase() === "mul")).toBe(true);
  });

  it("returns labels parsed from the source for branch targets", () => {
    const source = "fm_loop:\n  ret\nfm_test:\n  ret\nmain:\n  b fm";
    const got = buildSuggestions(ctx(source, "  b fm", 6));
    const labels = got.map((s) => s.label);
    expect(labels).toContain("fm_loop");
    expect(labels).toContain("fm_test");
  });

  it("attaches kind metadata so the editor can pick an icon", () => {
    const got = buildSuggestions(ctx("", "  m", 3));
    const movEntry = got.find((s) => s.label.toLowerCase() === "mov");
    expect(movEntry?.kind).toBe("instruction");
    const directives = buildSuggestions(ctx("", ".s", 2));
    const stringEntry = directives.find((s) => s.label === ".string");
    expect(stringEntry?.kind).toBe("directive");
  });
});
