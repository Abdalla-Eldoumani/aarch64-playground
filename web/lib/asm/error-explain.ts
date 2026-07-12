/**
 * Maps assembler / runtime error messages from the Rust side onto
 * teaching blocks ({what, why, fix, styleSection}). Used by the editor's
 * error marker to surface context the student can act on, plus a link to
 * the relevant section of `docs/cpsc355-style-guide.md`.
 *
 * The Rust side sends flat strings via wasm-bindgen, so we recover the
 * variant by matching on the canonical prefix produced by `EmuError`'s
 * Display impl.
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
  /** Why it failed -- the underlying cause in plain language. */
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
  if (lower.startsWith("unknown instruction")) {
    return {
      what: "The emulator's decoder did not recognize this 32-bit word as any AArch64 instruction it implements.",
      why: "Either the encoding is for an extension the playground does not support, or earlier code wrote junk over the .text section so the next fetch saw garbage.",
      fix: "If you wrote the instruction by hand, check the mnemonic and operand widths against the instruction reference. If the program ran for a while before this, look for an off-by-one stack write that overwrote your own code.",
      styleSection: "general",
    };
  }
  if (lower.startsWith("memory fault")) {
    const isWrite = lower.includes("write");
    return {
      what: `The CPU tried to ${isWrite ? "write to" : "read from"} an address that is not mapped (no .text/.data/.rodata/.bss/.stack page covers it).`,
      why: "Most often a base register holds an offset rather than an address, or `ldr xN, =label` was forgotten so the register stays at 0.",
      fix: "Watch the base register in the watch panel. If it's a small number (0..255), you wrote `mov` where you meant `ldr =`; if it's near 0xFFFF_0000, you tried to call a host stub directly without the BL trampoline (the linker handles that automatically for `bl printf` and friends).",
      styleSection: "addressing modes",
    };
  }
  if (lower.startsWith("invalid register index")) {
    return {
      what: "An instruction referenced a register index outside 0..30.",
      why: "Almost always a typo (W32 instead of W3, X31 instead of XZR or SP) or a stale operand left over from refactoring.",
      fix: "Re-read the operand and verify the register class -- general-purpose registers are X0-X30 plus XZR/SP; the FPU set is D0-D31 / S0-S31. The assembler accepts both upper and lower case.",
      styleSection: "naming conventions",
    };
  }
  if (lower.startsWith("unaligned access")) {
    const m = message.match(/(\d+)-byte alignment/i);
    const need = m ? m[1] : "the natural";
    return {
      what: `An ldr/str variant required ${need}-byte alignment but the address was not a multiple of that width.`,
      why: "AArch64 word loads need 4-byte alignment, doubleword 8-byte. Stack frames keep sp at a 16-byte boundary; a manual `sub sp, sp, 4` for a single int breaks that contract.",
      fix: "Align stack adjustments with the `alloc = -(16 + N) & -16` idiom from the course. For unaligned data in .data, use the byte-size load (LDRB / LDRH / LDR Wn) that matches the slot width.",
      styleSection: "addressing modes",
    };
  }
  if (lower.startsWith("stack overflow")) {
    return {
      what: "SP moved below the bottom of the stack page (the stack base is 0x80000000; it grows down).",
      why: "Usually a missing `ldp fp, lr, [sp], dealloc` in the epilogue, or recursion deep enough that the per-call frame chain ate the page.",
      fix: "Check that every prologue has a matching epilogue with the same dealloc. For deep recursion, increase the stack page size or convert to iteration.",
      styleSection: "general",
    };
  }
  if (lower.startsWith("argv layout")) {
    return {
      what: "The argv pointer table plus the string pool would exceed the single 4 KiB page reserved at 0x00800000.",
      why: "Either too many args (each one needs an 8-byte pointer slot plus the string body and a NUL), or one very large arg.",
      fix: "Trim the args field above the editor. The cap is per-page and the playground's argv area is intentionally small to keep the emulator footprint predictable.",
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
      fix: "Manually expand the ifdef/ifelse/forloop into plain code, or move the conditional into the m4 source you control. The playground does not pre-process backtick quoting either.",
      styleSection: "m4 preprocessing",
    };
  }
  if (detail.includes("unknown symbol") || detail.includes("undefined symbol")) {
    return {
      what: "A label or alias used in this expression is not defined anywhere in the source.",
      why: "Either a typo (the alias was defined as `score1_r` but used as `score_1_r`) or a section ordering issue where a forward reference points at code never reached by the assembler.",
      fix: "Search the source for the exact identifier; m4 substitution is whole-token and case-sensitive. For numeric constants, prefer `name = expr` over `define()` so the linker can fold the value.",
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
  if (detail.includes("section") && detail.includes("directive")) {
    return {
      what: "A section directive was used in a position the parser doesn't accept.",
      why: "The playground recognizes only the section directives the course uses (.text, .data, .rodata, .bss, .section). Other forms surface as unknown directives.",
      fix: "If you see a `.section .data.rel.ro,...` or similar, replace it with the plain `.data` (or `.rodata`) variant from the style guide.",
      styleSection: "section directives",
    };
  }
  if (detail.includes("invalid utf-8") || detail.includes("invalid escape")) {
    return {
      what: "A `.string`, `.asciz`, or `.ascii` directive contains characters the lexer cannot decode.",
      why: "Only the standard escapes `\\n \\t \\r \\\\ \\' \\\" \\0 \\xNN` are recognized. A bare backslash followed by something else fails.",
      fix: "Replace stray backslashes with `\\\\`, or rewrite the literal as raw bytes with `.byte 0xAB, 0xCD, ...`.",
      styleSection: "naming conventions",
    };
  }

  // Fallback for any other wrapped error: still useful to point at the
  // relevant section even when we don't have a tailored block.
  if (inner) {
    return {
      what: message.replace(/\s+/g, " ").trim(),
      why: "The frontend pipeline could not finish this stage on the source as written.",
      fix: "Check the line shown in the editor margin, then re-read the relevant section of the style guide to confirm the directive or instruction shape.",
      styleSection: "general",
    };
  }

  return null;
}
