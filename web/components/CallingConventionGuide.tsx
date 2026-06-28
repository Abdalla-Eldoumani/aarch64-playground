import type { JSX } from "react";
import { LessonMarkdown } from "./LessonMarkdown";
import { CodeBlock } from "./CodeBlock";
import { RegisterFileDiagram } from "./RegisterFileDiagram";
import { StackFrameDiagram } from "./StackFrameDiagram";

/**
 * The calling-convention quick guide: a reading-measure article covering the
 * aapcs64 register roles, 16-byte stack alignment, and the frame-pointer
 * prologue/epilogue. All prose flows through the single sanitizing
 * LessonMarkdown (no second renderer, no raw-HTML injection path); the
 * prologue/epilogue renders through the read-only CodeBlock; and the
 * RegisterFileDiagram and StackFrameDiagram are the existing teaching diagrams,
 * not re-implementations. Register tokens are written as inline code so
 * LessonMarkdown attaches the same role summaries that power the hover-define,
 * keeping the guide, the hover cards, and the diagram on one story. The prose is
 * original, summarized from the course style guide in plain words. Token-only
 * and reduced-motion safe (no motion at all).
 */

// Original prose, authored from the course style guide. Each block is built as
// newline-joined lines so register/instruction tokens can stay inline code
// (back-ticked) for the hover-define without colliding with a template literal.
const registersMarkdown = [
  "The procedure call standard for aarch64 (aapcs64) is the contract between a routine and the routines it calls: which registers carry arguments, which survive a call, and how the stack is kept. Following it is what lets your code call a routine like `printf` and return cleanly.",
  "",
  "## Registers by role",
  "",
  "The first eight arguments and the return value travel in `x0` through `x7`. A routine you call may use them freely, so treat anything in `x0`-`x7` as gone once the call returns. `x8` carries an indirect result address, and it also holds the syscall number for an `svc`.",
  "",
  "`x9` through `x15` are caller-saved temporaries: a routine you call may overwrite any of them, so stash a value you still need before the call. `x16` and `x17` are the intra-procedure-call scratch registers (ip0 and ip1), and `x18` is reserved by the platform, so do not use it.",
  "",
  "`x19` through `x28` are callee-saved: a routine that writes one must restore it before returning, which makes them the place to keep a value alive across a call. `x29` is the frame pointer (`fp`) and `x30` is the link register (`lr`), both covered below. `sp` is the stack pointer; `xzr` (or `wzr` in its 32-bit view) reads as zero and discards writes.",
].join("\n");

const stackMarkdown = [
  "## Stack alignment and the frame pointer",
  "",
  "`sp` must stay 16-byte aligned at every point where the function calls another routine. When a function needs local space, round the frame up to a multiple of 16 so that boundary holds.",
  "",
  "The frame pointer anchors the current frame. `fp` (that is `x29`) points at the saved `fp`/`lr` pair at the base of the frame, and locals sit just below it at fixed offsets such as `[fp, -16]`. A function that calls anything saves the pair on entry and restores it on exit:",
].join("\n");

const allocMarkdown = [
  "The `alloc = -(16 + locals) & -16` form sizes the frame: the `& -16` masks the low bits so the allocation is a 16-byte multiple, with `locals` the byte count of local space, so `sp` stays aligned through every call. A leaf routine that calls nothing and needs no locals can skip the save and `ret` directly.",
].join("\n");

// Authentic lowercase prologue/epilogue per the course style: pre-indexed save
// that opens the frame, frame-pointer anchor, post-indexed restore that closes
// it. fp/lr are the standard x29/x30 aliases.
const prologueEpilogue = `alloc = -(16 + locals) & -16
dealloc = -alloc

func:
        stp     fp, lr, [sp, alloc]!     // save fp and lr, open the frame
        mov     fp, sp                   // anchor the frame pointer

        // body keeps cross-call values in x19-x28

        ldp     fp, lr, [sp], dealloc    // restore the pair, close the frame
        ret`;

export function CallingConventionGuide({
  className = "",
}: {
  className?: string;
}): JSX.Element {
  return (
    <section
      aria-label="aapcs64 calling convention"
      className={`mx-auto flex w-full max-w-2xl flex-col gap-6 ${className}`}
    >
      <div className="[&_p:first-of-type]:[font:var(--type-lead)]">
        <LessonMarkdown markdown={registersMarkdown} />
      </div>
      <RegisterFileDiagram />
      <LessonMarkdown markdown={stackMarkdown} />
      <CodeBlock code={prologueEpilogue} />
      <LessonMarkdown markdown={allocMarkdown} />
      <StackFrameDiagram />
    </section>
  );
}
