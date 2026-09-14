/**
 * Maps assembler / runtime error messages from the Rust side onto
 * teaching blocks ({what, why, fix, styleSection}). Used by the editor's
 * error marker to surface context the student can act on, plus a link to
 * the relevant section of `docs/cpsc355-style-guide.md`.
 *
 * The Rust side sends flat strings via wasm-bindgen. Assemble-stage
 * errors arrive as the BARE inner message (the wasm boundary strips the
 * "X error at line N:" Display prefix and ships the line separately), so
 * every predicate here matches on substrings of the inner text; the
 * prefix regex below only serves strings that arrive Display-formatted
 * (runtime aborts pass through Display unchanged).
 */
export type StyleSection =
  | "m4 preprocessing"
  | "section directives"
  | "addressing modes"
  | "literal pool"
  | "hosted runtime"
  | "virtual filesystem"
  | "naming conventions"
  | "general";

export interface ErrorExplanation {
  /** What the emulator saw, in two short sentences max. */
  what: string;
  /** Why it failed: the underlying cause in plain language. */
  why: string;
  /** A specific, actionable fix the student can apply right now. */
  fix: string;
  /** Section header in docs/cpsc355-style-guide.md to consult. */
  styleSection: StyleSection;
}

/**
 * Returns null if the message doesn't match a known variant; the caller
 * falls back to rendering the raw error text. We pattern-match on the
 * inner detail (after the "X error at line N:" prefix) when available so
 * the same teaching block fires whether the error came from
 * assembler/parser/lexer/linker or m4.
 */
export function explainError(message: string): ErrorExplanation | null {
  const lower = message.toLowerCase();

  // The five top-level prefix-matched variants come first; assembler /
  // parser / preprocess / link errors then dispatch on the inner detail.
  if (lower.includes("ran past the last instruction")) {
    return {
      what: "Execution walked off the end of the program: the last instruction ran and nothing said stop.",
      why: "main has no `ret` on its final path (with the matching epilogue if it pushed a frame), and no exit call, so the CPU kept fetching past your code.",
      fix: "End main with the epilogue + `ret` pair (`ldp x29, x30, [sp], 16` then `ret`), or call exit. If main branches, make sure every path reaches the ret.",
      styleSection: "general",
    };
  }
  if (lower.startsWith("unknown instruction")) {
    return {
      what: "The emulator's decoder did not recognize this 32-bit word as any AArch64 instruction it implements.",
      why: "Execution usually got here by branching somewhere that holds data, not code: a branch to a data label, a wrong jump-table entry, or a return address that was overwritten on the stack. (An instruction from an extension the playground does not implement reports this too.)",
      fix: "Check where the shown address falls: if it is in .data/.rodata, find the branch that took you there; if it is in .text, compare the mnemonic against the instruction reference.",
      styleSection: "general",
    };
  }
  if (lower.startsWith("memory fault")) {
    const isWrite = lower.includes("write");
    return {
      what: `The CPU tried to ${isWrite ? "write to" : "read from"} an address that is not mapped (no .text/.data/.rodata/.bss/.stack page covers it).`,
      why: "Most often a base register holds an offset rather than an address, or `ldr xN, =label` was forgotten so the register stays at 0.",
      fix: "Watch the base register in the watch panel. If it is a small number (0..255), you wrote `mov` where you meant `ldr =`; if it is near 0xFFFF_0000, you tried to call a host stub directly without the BL trampoline (the linker handles that automatically for `bl printf` and friends).",
      styleSection: "addressing modes",
    };
  }
  if (
    lower.includes("is not a register") ||
    lower.includes("is not a floating-point register")
  ) {
    return {
      what: "An instruction referenced a register index outside 0..30.",
      why: "Almost always a typo (W32 instead of W3, X31 instead of XZR or SP) or a stale operand left over from refactoring.",
      fix: "Re-read the operand and check the register class: general-purpose registers are x0-x30 plus xzr and sp; the FPU set is d0-d31 and s0-s31. The assembler accepts both upper and lower case.",
      styleSection: "naming conventions",
    };
  }
  if (lower.includes("not a multiple of 16")) {
    return {
      what: "A load or store used sp as its base (or a libc call ran) while sp was off the 16-byte boundary.",
      why: "Linux turns on the AArch64 stack-alignment check (SA0): every sp-based access faults with a bus error when sp is not a multiple of 16, and AAPCS64 requires the boundary at every bl. The playground stops exactly where the course servers do.",
      fix: "Round the frame to a 16 multiple: `sub sp, sp, 32` instead of `sub sp, sp, 24`, or the course idiom `alloc = -(16 + locals) & -16`. The line that broke the boundary is the sp adjustment above the fault.",
      styleSection: "general",
    };
  }
  if (lower.includes("not part of any program section")) {
    return {
      what: "A load or store landed in the first page of the address space, which no program owns.",
      why: "The base register held a small number instead of an address. The course servers kill this with a segmentation fault. A `mov` where `ldr xN, =label` was meant, or an m4 register alias that reuses a register a pointer already lives in, are the usual causes.",
      fix: "Check how the base register was loaded: addresses come from `ldr xN, =label`. If an m4 define names the same register a pointer occupies (`define(i_r, w19)` after `ldr x19, =arr`), rename the alias to a free register.",
      styleSection: "addressing modes",
    };
  }
  if (lower.includes("no entry point")) {
    return {
      what: "Nothing in the source is labelled `main:` or `_start:`, so there is no instruction to begin at.",
      why: "The linker starts a program at one of those two names. A file of helper functions is meant to be assembled beside the file that has main, and `ld` on the course servers refuses the same file with `undefined reference to 'main'`.",
      fix: "Name the entry `main:` and declare it `.global main`. Keep it called main even if you have seen `_start` elsewhere: gcc supplies `_start` from its own startup file, so a source that defines its own links here but fails on the servers with `multiple definition of '_start'`.",
      styleSection: "general",
    };
  }
  if (lower.includes("the playground's ceiling")) {
    return {
      what: "The run was stopped at the playground's ten-million-instruction ceiling; the program had not finished.",
      why: "Either a loop whose exit condition never becomes true, or a routine that called something without saving x30 first, so its `ret` jumps back into the middle of itself and never leaves.",
      fix: "Step the loop and watch the counter register: check that it actually changes, that the branch is the one you meant (b.le against b.lt), and that every routine which calls another saves x29/x30 in its prologue. The course servers have no such ceiling, so the same program hangs there until ctrl+c.",
      styleSection: "general",
    };
  }
  if (lower.startsWith("stack overflow")) {
    return {
      what: "sp moved more than 8 MiB below the stack base (0x80000000, growing down), far past any legitimate frame chain.",
      why: "Recursion with no reachable base case is the usual cause; a prologue that repeats without its epilogue, or sp loaded from a register that was never set up, gets here too.",
      fix: "Check the recursion's stopping condition first (does the base case compare the right register?). Then check that every prologue has a matching epilogue with the same dealloc.",
      styleSection: "general",
    };
  }
  if (lower.includes("no terminating zero byte")) {
    return {
      what: "A string operation scanned 64 KiB from the shown address without finding the closing zero byte.",
      why: "C strings end at a NUL. `.ascii` emits the characters WITHOUT one; `.asciz`/`.string` add it. A store past the end of a buffer can also overwrite the terminator.",
      fix: "Declare the string with .asciz or .string, and check any loop that writes into the buffer stops before its last byte.",
      styleSection: "naming conventions",
    };
  }
  if (lower.includes("the playground reserves for argv")) {
    return {
      what: "The argv pointer table plus the string pool would exceed the single 4 KiB page reserved at 0x00800000.",
      why: "Either too many args (each one needs an 8-byte pointer slot plus the string body and a NUL), or one very large arg.",
      fix: "Trim the args field above the editor, or pass fewer arguments.",
      styleSection: "hosted runtime",
    };
  }

  // Wrapped variants: pull out the inner reason.
  const inner = message.match(/^(?:assembly|preprocess|parse|link) error at line \d+: (.*)$/i);
  const detail = inner ? inner[1].toLowerCase() : lower;

  if (detail.includes("unsupported m4 construct")) {
    return {
      what: "m4 saw a construct outside the playground's narrow subset (define + name=expr only).",
      why: "Course-shipped m4 files sometimes include ifdef/ifelse/forloop. Those expand at the macro level; the playground refuses them so error messages stay aligned with the original lines.",
      fix: "Manually expand the ifdef/ifelse/forloop into plain code, or move the conditional into the m4 source you control. A backtick is the one to take seriously: GNU m4 on the course servers reads a backtick ANYWHERE in the file, inside a `//` comment included, as an opening quote and then swallows the rest of the source (`ERROR: end of file in string`). Use plain quotes in comments.",
      styleSection: "m4 preprocessing",
    };
  }
  if (detail.includes("m4 recursion exceeded")) {
    return {
      what: "m4 kept rewriting the same text round after round, so a macro expands into something that expands back into it.",
      why: "Two defines that name each other (`define(a_r, b_r)` with `define(b_r, a_r)`) never reach a fixed point. The same shape appears by accident when one file is pasted after another and repeats a define: GNU m4 expands a define's FIRST argument too, so a second `define(fp, x29)` becomes `define(x29, x29)` and m4 on the course servers never terminates at all.",
      fix: "Give each alias one definition, in one place: keep the `define(fp, x29)` / `define(lr, x30)` block at the top of the combined program and delete the repeats the other files brought with them.",
      styleSection: "m4 preprocessing",
    };
  }
  if (
    detail.includes("is not defined anywhere in this program") ||
    detail.includes("unknown symbol") ||
    detail.includes("undefined symbol")
  ) {
    return {
      what: "A label or alias used in this expression is not defined anywhere in the source.",
      why: "Either a typo (the alias was defined as `score1_r` but used as `score_1_r`) or a section ordering issue where a forward reference points at code never reached by the assembler.",
      fix: "Search the source for the exact identifier; m4 substitution is whole-token and case-sensitive. For numeric constants, prefer `name = expr` over `define()` so the linker can fold the value. The libc math names go the other way: `pow`, `sqrt`, `sin`, `cos`, `tan`, `log` and `exp` resolve here, but on the course servers `gcc` only links them with `-lm` on the command line.",
      styleSection: "naming conventions",
    };
  }
  if (detail.includes("immediate") && detail.includes("range")) {
    return {
      what: "An immediate value did not fit in the bit field of the instruction encoding.",
      why: "AArch64 movz/movk encode 16 bits at a time; mov-wide-immediate paths split the constant across hw shifts. Branch immediates are also bounded (BL is 26 bits, B.cond is 19, CBZ is 19).",
      fix: "Use `ldr xN, =value` for any immediate that doesn't fit, or split into a movz + movk pair. The linker's literal pool keeps the value in .text right after the program.",
      styleSection: "literal pool",
    };
  }
  if (detail.includes("unbalanced") && detail.includes("bracket")) {
    return {
      what: "An addressing-mode bracket `[...]` did not close.",
      why: "The lexer counts `[` and `]` to find the inner operand list. A missing `]` or an extra `[` inside an expression both throw off the count.",
      fix: "Count brackets across the offending line; pre-indexed forms end with `]!`, post-indexed forms close `]` then comma-separate the immediate.",
      styleSection: "addressing modes",
    };
  }
  if (detail.includes("expected") && (detail.includes("register") || detail.includes("operand"))) {
    return {
      what: "The assembler reached an operand slot expecting a register or constant and saw something else (often a directive name or a stray character).",
      why: "The parser is line-oriented; if the previous line forgot a separator the next ident gets eaten as the operand.",
      fix: "Re-check the line above the reported one for a missing comma, label colon, or directive opener like `.word`.",
      styleSection: "general",
    };
  }
  // The unknown-directive message names the whole set the parser accepts,
  // so there is nothing to add; it is caught here only because that list
  // contains `.section` and would otherwise fall into the block below.
  if (detail.includes("unknown directive")) {
    return null;
  }
  if (detail.includes("unsupported section")) {
    return {
      what: "A .section directive names a section the playground does not lay out (only .text/.data/.rodata/.bss have addresses here).",
      why: "gcc -S output carries linker-metadata sections like `.note.GNU-stack` or `.init_array` that only matter to a real ELF linker; the dot-separated name means the message may show just the first word of it.",
      fix: "If the line is compiler metadata (`.note.GNU-stack`, `.init_array`, `.comment`), delete it: nothing references it. If you meant program data, use the plain `.data` or `.rodata` directive.",
      styleSection: "section directives",
    };
  }
  if (detail.includes("section") && detail.includes("directive")) {
    return {
      what: "A section directive was used in a position the assembler does not accept.",
      why: "The playground recognizes only the section directives the course uses (.text, .data, .rodata, .bss, .section). Other forms surface as unknown directives.",
      fix: "If you see a `.section .data.rel.ro,...` or similar, replace it with the plain `.data` (or `.rodata`) variant from the style guide.",
      styleSection: "section directives",
    };
  }
  if (detail.includes("unterminated string literal")) {
    return {
      what: "A string literal opened on this line but never closed: no ending double-quote before the line ended.",
      why: "Strings cannot span lines, exactly like the real assembler. A newline you meant to PRINT must be written as the two characters \\n inside the quotes, not typed as a real line break.",
      fix: 'Close the string on the same line it opens, and write escapes for control characters: `.string "Hello\\n"`. If the string looks closed, check for a stray unescaped `"` earlier in the line.',
      styleSection: "naming conventions",
    };
  }
  if (detail.includes("all s or all d")) {
    return {
      what: "One floating-point instruction mixed an S register with a D register.",
      why: "The register width picks the instruction's precision, so every operand must agree: fadd s0, s1, s2 is single, fadd d0, d1, d2 is double, and a mix has no encoding.",
      fix: "Make all the operands the same width, or convert first: `fcvt d0, s0` widens a float to a double, `fcvt s0, d0` narrows.",
      styleSection: "general",
    };
  }
  if (detail.includes("converts between widths")) {
    return {
      what: "fcvt was given two registers of the same width; it only encodes a change of width.",
      why: "fcvt is the S<->D precision converter: one operand names the source width, the other the destination. Same-width fcvt has no encoding.",
      fix: "For a same-width copy use `fmov d0, d1` (or `fmov s0, s1`). To change precision, pair one S with one D: `fcvt d0, s1` widens, `fcvt s0, d1` narrows.",
      styleSection: "general",
    };
  }
  if (detail.includes("fmov") && detail.includes("8-bit float immediate")) {
    return {
      what: "The float constant does not fit FMOV's tiny 8-bit immediate encoding.",
      why: "FMOV can only encode a power-of-two multiple of 1.0 through 1.9375 (values like 0.5, 1.0, 2.0, 5.0, 9.0). Most decimals, 0.0 included, have no 8-bit form.",
      fix: "Put the constant in the data section (`pi: .double 3.14159` or `half: .float 0.5`) and load it: `ldr x9, =pi` then `ldr d0, [x9]`.",
      styleSection: "literal pool",
    };
  }
  if (
    detail.includes("unknown escape") ||
    detail.includes("dangling backslash") ||
    (detail.includes("escape") && (detail.includes("invalid") || detail.includes("incomplete")))
  ) {
    return {
      what: "A string or character literal contains a backslash sequence the lexer does not recognize.",
      why: "Only the standard escapes `\\n \\t \\r \\\\ \\' \\\" \\0 \\xNN` exist. A Windows path like \"C:\\dir\" reads `\\d` as an escape.",
      fix: "Double every literal backslash (`C:\\\\dir`), or rewrite the data as raw bytes with `.byte 0xAB, 0xCD, ...`.",
      styleSection: "naming conventions",
    };
  }

  return null;
}
