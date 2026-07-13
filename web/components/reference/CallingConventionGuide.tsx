import type { JSX } from "react";
import { Kicker } from "@/components/ui/Kicker";
import { LessonMarkdown } from "@/components/learn/LessonMarkdown";
import { RegisterFileDiagram } from "@/components/diagrams/RegisterFileDiagram";
import { FpRegisterFileDiagram } from "@/components/diagrams/FpRegisterFileDiagram";
import { FrameWalk } from "@/components/diagrams/FrameWalk";
import { StackAlignment } from "@/components/diagrams/StackAlignment";

/**
 * The calling-convention quick guide: a reading-measure article in four
 * numbered-kicker sections, the same section grammar as the landing and
 * lesson surfaces. 01 covers the integer register roles over the existing
 * RegisterFileDiagram; 02 covers the floating-point file (d0-d7 arguments,
 * d8-d15 callee-saved low halves, d16-d31 temporaries) over its sibling
 * FpRegisterFileDiagram; 03 is the frame record, stepped live by FrameWalk
 * -- code, registers, and frame bands per step -- teaching the course frame
 * shape: the saved fp/lr pair at the frame base where fp points, locals
 * above it at positive offsets like [fp, 16]; 04 is 16-byte alignment, with
 * the hands-on StackAlignment probe. All prose flows through the single
 * sanitizing LessonMarkdown (no second renderer, no raw-HTML injection
 * path), and register tokens are written as inline code so LessonMarkdown
 * attaches the same role summaries that power the hover-define, keeping the
 * guide, the hover cards, and the diagrams on one story. The prose is
 * original, summarized from the course style guide in plain words.
 * Token-only and reduced-motion safe.
 */

// Original prose, authored from the course style guide. Each block is built as
// newline-joined lines so register/instruction tokens can stay inline code
// (back-ticked) for the hover-define without colliding with a template literal.
const leadMarkdown = [
  "The procedure call standard for aarch64 (aapcs64) is the contract between a routine and the routines it calls: which registers carry arguments, which survive a call, and how the stack is kept. Following it is what lets your code call a routine like `printf` and return cleanly.",
].join("\n");

const integerMarkdown = [
  "Every general-purpose register has two names for one storage location: `x19` is all 64 bits and `w19` is the same register's low 32 bits, the view you use when the value is an int or narrower. Writing the `w` form zeroes the top half. Everything below applies to both views at once: a role belongs to the register, so `w19` is exactly as callee-saved as `x19`, and `scanf`'s `%d` result read back into `w19` enjoys the same protection.",
  "",
  "The first eight arguments and the return value travel in `x0` through `x7` (or `w0`-`w7` for int-sized values). A routine you call may use them freely, so treat anything in `x0`-`x7` as gone once the call returns. `x8` carries an indirect result address, and it also holds the syscall number for an `svc`.",
  "",
  "`x9` through `x15` are caller-saved temporaries: a routine you call may overwrite any of them, so stash a value you still need before the call. `x16` and `x17` are the intra-procedure-call scratch registers (ip0 and ip1), and `x18` is reserved by the platform, so do not use it.",
  "",
  "`x19` through `x28` are callee-saved: a routine that writes one must restore it before returning, which makes them the place to keep a value alive across a call. `x29` is the frame pointer (`fp`) and `x30` is the link register (`lr`), both covered below. `sp` is the stack pointer; `xzr` (or `wzr` in its 32-bit view) reads as zero and discards writes.",
].join("\n");

const fpMarkdown = [
  "Floating-point values ride their own register file of 32 registers, and like the integer file each register has two views the course uses: `s0` is the low 32 bits (a C `float`) and `d0` is the low 64 bits (a C `double`) of the same register — `s0` and `d0` overlap. The registers are wider still underneath, but the extra width belongs to SIMD, which this course never touches; think in `s` and `d` only. `fcvt d0, s0` widens a float to a double exactly, and `fcvt s0, d0` narrows with rounding — the step a program takes before handing a float to `printf`, which always receives doubles.",
  "",
  "The calling convention mirrors the integer split. `d0` through `d7` (or `s0`-`s7` for floats) carry the first eight floating-point arguments and return the result, a separate bank from `x0`-`x7`, so `printf(\"%d %f\", ...)` puts the int in `w1` and the double in `d0` without collision. `d8` through `d15` are callee-saved — a routine that writes one must restore it, which is why the course parks long-lived floats there. `d16` through `d31` are caller-saved temporaries, so treat them as gone once a call returns. There is no floating-point frame pointer: `x29` and `x30` still hold the frame record, whatever type the function computes with.",
].join("\n");

const frameMarkdown = [
  "The frame pointer anchors the current frame. The prologue's `stp` saves the caller's `fp`/`lr` pair at the lowest address of the new frame, and `mov fp, sp` points `fp` at that pair. Locals sit just above it at fixed positive offsets such as `[fp, 16]` and `[fp, 20]`, between the saved pair and the caller's frame. Step the prologue and epilogue to watch the frame open and close:",
].join("\n");

const allocMarkdown = [
  "The `alloc = -(16 + locals) & -16` form sizes the frame: the `& -16` masks the low bits so the allocation is a 16-byte multiple, with `locals` the byte count of local space, so `sp` stays aligned through every call. A leaf routine that calls nothing and needs no locals can skip the save and `ret` directly.",
].join("\n");

const alignmentMarkdown = [
  "aapcs64 requires `sp` to sit on a 16-byte boundary at every `bl`: the routine you call is entitled to assume it, and on linux the first stack access through a misaligned `sp` (usually deep inside `printf`) faults the program. `sub sp, sp, 24` is the classic bug: it reserves room for three 8-byte locals but leaves `sp` on an odd multiple of 8, so the crash surfaces at the next call, far from the line that caused it. The fix is to round every local allocation up to a multiple of 16, the way the `alloc = -(16 + locals) & -16` form does. Move `sp` yourself and watch the boundary:",
].join("\n");

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
        <LessonMarkdown markdown={leadMarkdown} />
      </div>

      <Kicker number="01" title="registers by role — integer" className="mt-4" />
      <LessonMarkdown markdown={integerMarkdown} />
      <RegisterFileDiagram />

      <Kicker
        number="02"
        title="registers by role — floating point"
        className="mt-4"
      />
      <LessonMarkdown markdown={fpMarkdown} />
      <FpRegisterFileDiagram />

      <Kicker number="03" title="the frame record" className="mt-4" />
      <LessonMarkdown markdown={frameMarkdown} />
      <FrameWalk />
      <LessonMarkdown markdown={allocMarkdown} />

      <Kicker number="04" title="16-byte stack alignment" className="mt-4" />
      <LessonMarkdown markdown={alignmentMarkdown} />
      <StackAlignment />
    </section>
  );
}
