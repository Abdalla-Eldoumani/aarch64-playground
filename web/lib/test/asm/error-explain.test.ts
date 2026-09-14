import { describe, expect, it } from "vitest";
import { explainError } from "@/lib/asm/error-explain";

// Every string below is the shape production actually delivers: assemble
// errors arrive as the BARE inner message (the wasm boundary strips the
// "X error at line N:" prefix and ships the line separately); runtime
// aborts pass through Display unchanged. Testing prefixed strings gave the
// old generic fallback false confidence: it could never fire in production.
describe("explainError", () => {
  it("explains falling off the end as a missing ret", () => {
    const e = explainError(
      "execution ran past the last instruction of the program. main needs a `ret` (with an epilogue if it pushed one) or an exit call as its final step",
    );
    expect(e).not.toBeNull();
    expect(e!.fix).toContain("ret");
    expect(e!.fix.toLowerCase()).toContain("epilogue");
  });

  it("explains unknown instructions without inventing causes", () => {
    const e = explainError(
      "unknown instruction 0x00600000: execution probably branched into data rather than code. Check the branch that got here, and the return address if this followed a ret",
    );
    expect(e).not.toBeNull();
    expect(e!.what.toLowerCase()).toContain("decoder");
    // The common triggers never overwrite the program's own code, so the why
    // must not claim it.
    expect(e!.why.toLowerCase()).not.toContain("junk over");
    expect(e!.why.toLowerCase()).toContain("data");
  });

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

  it("recognizes the assembler's register-file message for both files", () => {
    const e = explainError(
      "`X32` is not a register: the general-purpose registers are x0 through x30 (or w0 through w30), plus xzr/wzr and sp",
    );
    expect(e).not.toBeNull();
    expect(e!.styleSection).toBe("naming conventions");
    const fp = explainError(
      "`d99` is not a floating-point register: the fp registers are d0 through d31 and s0 through s31",
    );
    expect(fp).not.toBeNull();
    expect(fp!.styleSection).toBe("naming conventions");
  });

  it("explains the sp-alignment fault via the frame rounding idiom", () => {
    const e = explainError(
      "stopped: sp is 0x7ffffff8, which is not a multiple of 16. On Linux every load or store through sp faults when sp is off the 16-byte boundary (a bus error on the servers); the line that broke it is above this one. Round the frame up: `sub sp, sp, 32` instead of `sub sp, sp, 24`, or the course idiom `alloc = -(16 + locals) & -16`",
    );
    expect(e).not.toBeNull();
    expect(e!.fix).toContain("alloc = -(16 + locals) & -16");
  });

  it("explains a null-page access via the base register", () => {
    const e = explainError(
      "stopped: tried to write to address 0x0, which is not part of any program section (the servers kill this with a segmentation fault). A base register is holding a small number instead of an address: check for a `mov` where you meant `ldr xN, =label`, or an m4 alias that reuses a register a pointer is already living in (`define(i_r, w19)` after `ldr x19, =arr` overwrites the pointer)",
    );
    expect(e).not.toBeNull();
    expect(e!.fix).toContain("ldr xN, =label");
  });

  it("explains a stack overflow via the recursion base case first", () => {
    const e = explainError(
      "stack overflow: sp has moved more than 8 MiB below the stack base. Check the recursion's base case first, then check that every prologue has a matching epilogue with the same size, and that sp was never loaded from a register that had not been set up",
    );
    expect(e).not.toBeNull();
    expect(e!.fix.toLowerCase()).toContain("base case");
  });

  it("explains an unterminated C string via .asciz", () => {
    const e = explainError(
      "strlen: the string at 0x600000 has no terminating zero byte within 64 KiB. Declare strings with .asciz or .string (not .ascii), and check nothing wrote over the terminator",
    );
    expect(e).not.toBeNull();
    expect(e!.fix).toContain(".asciz");
  });

  it("recognizes argv overflow", () => {
    const e = explainError(
      "the arguments need 5000 bytes, more than the 4 KiB the playground reserves for argv. Shorten the args box above the editor, or pass fewer arguments",
    );
    expect(e).not.toBeNull();
    expect(e!.styleSection).toBe("hosted runtime");
  });

  it("matches bare inner messages, the shape production sends", () => {
    const e = explainError("unsupported m4 construct: ifelse");
    expect(e).not.toBeNull();
    expect(e!.styleSection).toBe("m4 preprocessing");
  });

  it("recognizes an undefined symbol in bare and prefixed shapes", () => {
    const bare = explainError(
      "`score_1_r` is not defined anywhere in this program: check the spelling against the label or the `name = value` line that defines it. m4 substitution is whole-token and case-sensitive",
    );
    const prefixed = explainError(
      "link error at line 30: `score_1_r` is not defined anywhere in this program: check the spelling against the label or the `name = value` line that defines it. m4 substitution is whole-token and case-sensitive",
    );
    expect(bare!.styleSection).toBe("naming conventions");
    expect(prefixed!.styleSection).toBe("naming conventions");
    // The watch-expression evaluator still words it "unknown symbol".
    expect(explainError("unknown symbol score_1_r")!.styleSection).toBe(
      "naming conventions",
    );
  });

  it("recognizes immediate-out-of-range encodings", () => {
    const e = explainError("immediate out of range for movz");
    expect(e!.styleSection).toBe("literal pool");
  });

  it("recognizes unbalanced bracket diagnostics", () => {
    const e = explainError(
      "unbalanced bracket in the address: count the `[` and `]` on this line. Pre-indexed forms end `]!`, and post-indexed forms close the `]` before the comma, as in `[x20], 8`",
    );
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

  // The five blocks below came out of the server-parity sweep
  // (scripts/parity-sweep.js): every string is the one the emulator
  // actually produced for a program the site ships, and each block also
  // carries what the same program does on the course servers, because the
  // sweep found the two sides disagreeing there.

  it("explains a missing entry point and keeps the student on main", () => {
    // web/public/examples/cpsc355/is-prime.s, a leaf function with no
    // caller. csarm refuses the same file: `undefined reference to 'main'`.
    const e = explainError(
      "no entry point. Define `main:` (declared `.global main`) or `_start:`. A file holding only helper functions runs as part of a program whose other file has `main`",
    );
    expect(e).not.toBeNull();
    expect(e!.fix).toContain(".global main");
    // snake.s defines its own `_start` and links here but not on the
    // servers, where crt1.o already has one.
    expect(e!.fix).toContain("multiple definition of '_start'");
  });

  it("explains the step ceiling as a runaway loop or an unsaved lr", () => {
    // The second pitfall's fault half: greet calls printf without saving
    // lr, so it returns into itself. On csarm the same program never stops.
    const e = explainError(
      "stopped after 10 million steps, which is the playground's ceiling. The usual cause is a loop whose exit condition never becomes true: check that the counter is actually changing, and that the branch condition is the one you meant (b.le against b.lt, b.ne against b.eq)",
    );
    expect(e).not.toBeNull();
    expect(e!.why).toContain("x30");
    expect(e!.fix.toLowerCase()).toContain("ctrl+c");
  });

  it("explains m4 recursion and names the repeated-define trap", () => {
    // Produced by `define(one_r, two_r)` above `define(two_r, one_r)`. The
    // sweep hit the server half of the same trap: dsav's files each repeat
    // `define(fp, x29)`, and pasted into one buffer GNU m4 rewrites the
    // second one to `define(x29, x29)` and never terminates.
    const e = explainError("m4 recursion exceeded 32 rounds");
    expect(e).not.toBeNull();
    expect(e!.styleSection).toBe("m4 preprocessing");
    expect(e!.why).toContain("define(x29, x29)");
  });

  it("warns that a backtick is fatal to m4 on the servers, comment or not", () => {
    // The playground strips `//` comments before m4 sees them, so a
    // backtick in a comment assembles here and dies on csarm with
    // `ERROR: end of file in string`. One shipped lesson starter did.
    const e = explainError("unsupported m4 construct: backtick-quoted string");
    expect(e).not.toBeNull();
    expect(e!.fix).toContain("end of file in string");
  });

  it("says the math names need -lm on the servers", () => {
    // calc.s calls pow/sqrt/sin/cos/tan/log/exp. The playground hosts them;
    // `gcc calc.s -o calc` on csarm fails to link without -lm.
    const e = explainError(
      "`score_1_r` is not defined anywhere in this program: check the spelling against the label or the `name = value` line that defines it. m4 substitution is whole-token and case-sensitive",
    );
    expect(e!.fix).toContain("-lm");
  });

  it("returns null when no tailored block exists, so the raw message renders", () => {
    // // The emulator's own wording carries the remedy in these cases, so
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
