import { describe, expect, it } from "vitest";
import { errorHoverMarkdown, explainError } from "@/lib/asm/error-explain";

// The messages a broken program really produces are fed to the explainer
// from the node emulator in error-explain.playground.test.ts. What stays
// here are the inputs no quick program reaches (a store fault, a 1 MiB
// string, the 10-million-step ceiling), the watch evaluator's wording, the
// suggestion rules, and the cases that must fall through to the raw text.
describe("explainError", () => {
  it("recognizes memory faults and distinguishes read from write", () => {
    const r = explainError(
      "memory fault: the program tried to read 0x0000000000000010, which no section covers. The base register is holding a value that is not an address, usually because a `mov` was written where `ldr xN, =label` was meant",
    );
    const w = explainError(
      "memory fault: the program tried to write 0x00000000ffff0000, which no section covers. The base register is holding a value that is not an address, usually because a `mov` was written where `ldr xN, =label` was meant",
    );
    expect(r).not.toBeNull();
    expect(w).not.toBeNull();
    expect(r!.what.toLowerCase()).toContain("read");
    expect(w!.what.toLowerCase()).toContain("write");
    expect(r!.styleSection).toBe("addressing modes");
  });

  it("offers every supported mnemonic one edit away, whatever the case", () => {
    expect(explainError("unknown mnemonic `LDRR' -- `LDRR x0,[x1]'")!.fix).toBe(
      "did you mean `ldr`, `ldrb` or `ldrh`?",
    );
    expect(explainError("unknown mnemonic `ldrsww' -- `ldrsww x0,[x1]'")!.fix).toBe("did you mean `ldrsw`?");
  });

  it("leaves a mnemonic nothing resembles to the message's own hint", () => {
    expect(explainError("unknown mnemonic `frobnicate' -- `frobnicate x0'")).toBeNull();
  });

  it("explains an unterminated C string via .asciz", () => {
    const e = explainError(
      "strlen: the string at 0x600000 has no terminating zero byte within 1 MiB. Declare strings with .asciz or .string (not .ascii), and check nothing wrote over the terminator",
    );
    expect(e).not.toBeNull();
    expect(e!.fix).toContain(".asciz");
  });

  it("recognizes an undefined symbol with its line prefix and in the watch evaluator's words", () => {
    const prefixed = explainError(
      "link error at line 30: `score_1_r` is not defined anywhere in this program: check the spelling against the label or the `name = value` line that defines it. m4 substitution is whole-token and case-sensitive",
    );
    expect(prefixed!.styleSection).toBe("naming conventions");
    expect(explainError("unknown symbol score_1_r")!.styleSection).toBe(
      "naming conventions",
    );
  });

  it("recognizes a \\x escape with no hex digits", () => {
    expect(explainError("incomplete \\xNN escape")).not.toBeNull();
  });

  it("explains the step ceiling as a runaway loop or an unsaved lr", () => {
    // The unsaved-lr case: greet calls printf without saving lr, so it
    // returns into itself. On csarm the same program never stops.
    const e = explainError(
      "stopped after 10 million steps, which is the playground's ceiling. The usual cause is a loop whose exit condition never becomes true: check that the counter is actually changing, and that the branch condition is the one you meant (b.le against b.lt, b.ne against b.eq)",
    );
    expect(e).not.toBeNull();
    expect(e!.why).toContain("x30");
    expect(e!.fix.toLowerCase()).toContain("ctrl+c");
  });

  it("returns null when no tailored block exists, so the raw message renders", () => {
    // The emulator's own wording carries the remedy in these cases, so
    // there is no generic fallback.
    expect(explainError("nope, just nope")).toBeNull();
    expect(explainError("empty value in this list: remove the extra comma")).toBeNull();
    // The directive list names `.section`, which the section-directive block
    // would otherwise claim.
    expect(
      explainError(
        "unknown directive `.wrod`: the directives the playground recognizes are .text, .data, .bss, .rodata, .section, .global, .globl, .type, .size, .balign, .align, .skip, .zero, .space, .string, .asciz, .ascii, .byte, .hword, .short, .word, .quad, .dword, .double, .float, .equ, and .set",
      ),
    ).toBeNull();
  });
});

describe("errorHoverMarkdown", () => {
  // Reads a markdown line back the way the renderer does: an escaped mark or
  // an escaped line break stands for itself.
  const unescape = (md: string) => md.replace(/\\(\n|[!-/:-@[-`{-~])/g, "$1");
  const unescapedBacktick = /(^|[^\\])`/;

  it("escapes the backticks of GAS's quoting so no code span swallows the message", () => {
    const message =
      "unknown mnemonic `mvo' -- `mvo w0,0'\ncheck the spelling, or look it up in the instruction reference to see whether the playground implements it";
    const md = errorHoverMarkdown(message);
    const [bold, ...rest] = md.split("\n\n");
    expect(bold).toContain(
      "**unknown mnemonic \\`mvo\\' \\-\\- \\`mvo w0\\,0\\'\\\ncheck the spelling\\,",
    );
    expect(bold).not.toMatch(unescapedBacktick);
    expect(unescape(bold.slice(2, -2))).toBe(message);
    // The teaching block after it keeps its own code spans.
    expect(rest).toContain("*fix:* did you mean `mov` or `mvn`?");
  });

  it("escapes GAS's quoting when the explainer has nothing to add", () => {
    const message = "unknown mnemonic `frobnicate' -- `frobnicate x0'";
    const md = errorHoverMarkdown(message);
    expect(md).not.toMatch(unescapedBacktick);
    expect(unescape(md)).toBe(message);
  });
});
