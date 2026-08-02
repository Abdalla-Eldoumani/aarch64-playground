import { describe, expect, it } from "vitest";
import { explainError } from "@/lib/asm/error-explain";

// Every string below is the shape production actually delivers: assemble
// errors arrive as the BARE inner message (the wasm boundary strips the
// "X error at line N:" prefix and ships the line separately); runtime
// aborts pass through Display unchanged. Testing prefixed strings gave the
// old generic fallback false confidence -- it could never fire in
// production.
describe("explainError", () => {
  it("explains falling off the end as a missing ret", () => {
    const e = explainError(
      "execution ran past the last instruction of the program -- main needs a `ret` (with an epilogue if it pushed one) or an exit call as its final step",
    );
    expect(e).not.toBeNull();
    expect(e!.fix).toContain("ret");
    expect(e!.fix.toLowerCase()).toContain("epilogue");
  });

  it("explains unknown instructions without inventing causes", () => {
    const e = explainError("unknown instruction: 0x00600000");
    expect(e).not.toBeNull();
    expect(e!.what.toLowerCase()).toContain("decoder");
    // The old block asserted an off-by-one stack write "overwrote your
    // own code" -- a cause the common triggers never had.
    expect(e!.why.toLowerCase()).not.toContain("junk over");
    expect(e!.why.toLowerCase()).toContain("data");
  });

  it("recognizes memory faults and distinguishes read from write", () => {
    const r = explainError("memory fault: read at 0x0000000000000010");
    const w = explainError("memory fault: write at 0x00000000ffff0000");
    expect(r).not.toBeNull();
    expect(w).not.toBeNull();
    expect(r!.what.toLowerCase()).toContain("read");
    expect(w!.what.toLowerCase()).toContain("write");
    expect(r!.styleSection).toBe("addressing modes");
  });

  it("recognizes the assembler's out-of-range register message", () => {
    const e = explainError("register index out of range: X32");
    expect(e).not.toBeNull();
    expect(e!.styleSection).toBe("naming conventions");
  });

  it("explains the sp-alignment fault via the frame rounding idiom", () => {
    const e = explainError(
      "stopped -- sp is 0x7ffffff8, which is not a multiple of 16. On Linux every load or store through sp faults when sp is off the 16-byte boundary (a bus error on the servers); the line that broke it is above this one. Round the frame up: `sub sp, sp, 32` instead of `sub sp, sp, 24`, or the course idiom `alloc = -(16 + locals) & -16`",
    );
    expect(e).not.toBeNull();
    expect(e!.fix).toContain("alloc = -(16 + locals) & -16");
  });

  it("explains a null-page access via the base register", () => {
    const e = explainError(
      "stopped -- tried to write to address 0x0, which is not part of any program section (the servers kill this with a segmentation fault). A base register is holding a small number instead of an address: check for a `mov` where you meant `ldr xN, =label`, or an m4 alias that reuses a register a pointer is already living in (`define(i_r, w19)` after `ldr x19, =arr` overwrites the pointer)",
    );
    expect(e).not.toBeNull();
    expect(e!.fix).toContain("ldr xN, =label");
  });

  it("explains a stack overflow via the recursion base case first", () => {
    const e = explainError(
      "stack overflow: sp has moved more than 1 MiB below the stack base -- usually recursion with no base case, a prologue that repeats without its epilogue, or sp loaded from a register that was never set up",
    );
    expect(e).not.toBeNull();
    expect(e!.fix.toLowerCase()).toContain("base case");
  });

  it("explains an unterminated C string via .asciz", () => {
    const e = explainError(
      "strlen: the string at 0x600000 has no terminating zero byte within 64 KiB -- declare strings with .asciz or .string (not .ascii), and check nothing wrote over the terminator",
    );
    expect(e).not.toBeNull();
    expect(e!.fix).toContain(".asciz");
  });

  it("recognizes argv overflow", () => {
    const e = explainError("argv layout would need 5000 bytes, exceeds the 4096-byte argv page");
    expect(e).not.toBeNull();
    expect(e!.styleSection).toBe("hosted runtime");
  });

  it("matches bare inner messages, the shape production sends", () => {
    const e = explainError("unsupported m4 construct: ifelse");
    expect(e).not.toBeNull();
    expect(e!.styleSection).toBe("m4 preprocessing");
  });

  it("recognizes unknown symbol in bare and prefixed shapes", () => {
    const bare = explainError("unknown symbol `score_1_r`");
    const prefixed = explainError("link error at line 30: unknown symbol `score_1_r`");
    expect(bare!.styleSection).toBe("naming conventions");
    expect(prefixed!.styleSection).toBe("naming conventions");
  });

  it("recognizes immediate-out-of-range encodings", () => {
    const e = explainError("immediate out of range for movz");
    expect(e!.styleSection).toBe("literal pool");
  });

  it("recognizes unbalanced bracket diagnostics", () => {
    const e = explainError("unbalanced addressing bracket");
    expect(e!.styleSection).toBe("addressing modes");
  });

  it("explains an unterminated string with the same-line rule and the escape fix", () => {
    const e = explainError(
      'unterminated string literal: no closing " before the end of the line (write \\n for a newline)',
    );
    expect(e!.what).toContain("never closed");
    expect(e!.why).toContain("cannot span lines");
    expect(e!.fix).toContain("\\n");
  });

  it("explains mixed S/D operands and points at fcvt", () => {
    const e = explainError(
      "fadd needs all S or all D registers (use fcvt to convert between widths)",
    );
    expect(e!.why).toContain("precision");
    expect(e!.fix).toContain("fcvt");
  });

  it("explains a same-width fcvt and points at fmov", () => {
    const e = explainError(
      "fcvt converts between widths: one operand must be an S register and the other a D register (use fmov to copy at the same width)",
    );
    expect(e!.fix).toContain("fmov");
  });

  it("explains an unencodable fmov immediate with the data-section fallback", () => {
    const e = explainError(
      "0.1 does not fit the FMOV 8-bit float immediate; load it from a .double instead",
    );
    expect(e!.styleSection).toBe("literal pool");
    expect(e!.fix).toContain(".float");
  });

  it("tells an unsupported metadata section to be deleted", () => {
    // gcc -S emits `.section .note.GNU-stack,...`; the parser names the
    // first dotted word.
    const e = explainError("unsupported section `note`");
    expect(e).not.toBeNull();
    expect(e!.fix.toLowerCase()).toContain("delete");
    expect(e!.styleSection).toBe("section directives");
  });

  it("matches the escape messages the lexer really emits", () => {
    // A Windows path in a .string is the routine trigger.
    const unknown = explainError("unknown escape \\d");
    expect(unknown).not.toBeNull();
    expect(unknown!.fix.toLowerCase()).toContain("backslash");
    expect(explainError("dangling backslash in literal")).not.toBeNull();
    expect(explainError("incomplete \\xNN escape")).not.toBeNull();
  });

  it("returns null when no tailored block exists, so the raw message renders", () => {
    // The old generic fallback was unreachable in production and its
    // advice was content-free; deleted, not repaired. The emulator's own
    // wording carries the remedy in these cases.
    expect(explainError("nope, just nope")).toBeNull();
    expect(explainError("empty value in this list -- remove the extra comma")).toBeNull();
  });
});
