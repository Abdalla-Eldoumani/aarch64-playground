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
    // labels are always suggested in a bl context, so `main` survives the
    // `pr` prefix
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

  it("reads an alias body padded with whitespace", () => {
    const got = buildSuggestions(ctx("define( score_r ,   w19   )\n", "  mov ", 6));
    const alias = got.find((s) => s.label === "score_r");
    expect(alias?.detail).toBe("alias for w19");
  });

  it("scans a long whitespace run after `define(` in linear time", () => {
    // An unclosed `define(` followed by a contiguous whitespace run used
    // to backtrack quadratically: 16k spaces cost 196ms and 64k cost
    // 3.5s, on the main thread, once per keystroke.
    const timeFor = (spaces: number) => {
      const source = `define(A,${" ".repeat(spaces)}`;
      const started = performance.now();
      buildSuggestions({ source, line: "  mov ", position: 6 });
      return performance.now() - started;
    };
    timeFor(1_000); // warm up so the first sample is not the slowest
    const small = timeFor(16_000);
    const large = timeFor(64_000);
    // Four times the input must not cost four times the work. The slack
    // absorbs a loaded machine; the quadratic version cleared it by an
    // order of magnitude.
    expect(large).toBeLessThan(small * 4 + 50);
    expect(large).toBeLessThan(200);
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
