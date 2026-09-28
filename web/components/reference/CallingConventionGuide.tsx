import type { JSX } from "react";
import { Kicker } from "@/components/ui/Kicker";
import { LessonMarkdown } from "@/components/learn/LessonMarkdown";
import { RegisterFileDiagram } from "@/components/diagrams/RegisterFileDiagram";
import { FpRegisterFileDiagram } from "@/components/diagrams/FpRegisterFileDiagram";
import { FrameWalk } from "@/components/diagrams/FrameWalk";
import { StackAlignment } from "@/components/diagrams/StackAlignment";

/**
 * The calling-convention guide. All prose goes through LessonMarkdown, the one
 * sanitizing renderer, and register names are written as inline code so they
 * get the same role summaries as the hover cards and the diagrams.
 */

// Each block is newline-joined so back-ticked tokens keep the hover-define
// without colliding with a template literal.
const leadMarkdown = [
  "The procedure call standard for AArch64 (AAPCS64) is the contract between a routine and the routines it calls: which registers carry arguments, which survive a call, and how the stack is kept. Following it is what lets your code call a routine like `printf` and return cleanly.",
].join("\n");

const integerMarkdown = [
  "Every general-purpose register has two names for one storage location: `x19` is all 64 bits and `w19` is the same register's low 32 bits, the view you use when the value is an int or narrower. Writing the `w` form zeroes the top half. Everything below applies to both views at once: a role belongs to the register, so `w19` keeps its value across a call exactly as `x19` does (both are callee-saved, covered below), and `scanf`'s `%d` result read back into `w19` enjoys the same protection.",
  "",
  "The first eight arguments and the return value travel in `x0` through `x7` (or `w0`-`w7` for int-sized values). A routine you call may use them freely, so treat anything in `x0`-`x7` as gone once the call returns. When a routine returns a result too big for `x0` and `x1`, such as a large struct, the caller passes in `x8` the address to write it to; `x8` also holds the syscall number for an `svc`.",
  "",
  "`x9` through `x15` are caller-saved temporaries: a routine you call may overwrite any of them, so stash a value you still need before the call. `x16` and `x17` (also named ip0 and ip1) can be overwritten by code the linker adds on the way into a call, so never expect a value in them to survive a `bl`. `x18` is set aside for the operating system on some systems, so do not use it.",
  "",
  "`x19` through `x28` are callee-saved: a routine that writes one must restore it before returning, which makes them the place to keep a value alive across a call. `x29` is the frame pointer (`fp`) and `x30` is the link register (`lr`), both covered below. `sp` is the stack pointer; `xzr` (or `wzr` in its 32-bit view) reads as zero and discards writes.",
].join("\n");

const fpMarkdown = [
  "Floating-point and vector values ride their own file of 32 registers, `v0` to `v31`, each 128 bits wide. Like the integer file, every register has narrower names for the same storage: `s0` is the low 32 bits (a C `float`), `d0` is the low 64 bits (a C `double`), and `q0` is all 128 bits read as one value. Written `v0` with an arrangement such as `v0.4s`, the same 128 bits are lanes: four 32-bit values side by side. So `s0`, `d0`, `q0` and `v0` are one register, not four. The course keeps to `s` and `d`; the playground assembles the vector forms too, and the reference's Vector section documents them.",
  "",
  "`fcvt d0, s0` widens a float to a double exactly, and `fcvt s0, d0` narrows a double to a float, rounding to the nearest float. `printf` takes a variable number of arguments, and C turns a `float` passed that way into a `double`, so a float reaches `printf` as a double in `d0`: widen it with `fcvt d0, s0` before the call.",
  "",
  "The calling convention mirrors the integer split. `v0` through `v7` carry the first eight floating-point and vector arguments and return the result (as `d0`-`d7` for doubles, `s0`-`s7` for floats), a separate bank from `x0`-`x7`, so `printf(\"%d %f\", ...)` puts the int in `w1` and the double in `d0` without collision. `v8` through `v15` are callee-saved, but only their low 64 bits: a routine that writes `d8`-`d15` must restore them, which is why the course parks long-lived doubles there, and it owes nothing for the upper 64 bits, so a caller that needs a whole `q` value kept across a call saves it itself. `v0`-`v7` and `v16`-`v31` are caller-saved: treat them as gone once a call returns. There is no floating-point frame pointer: `x29` and `x30` still hold the frame record, whatever type the function computes with.",
  "",
  "Vectors travel the same way. A short vector, 8 or 16 bytes such as eight bytes in `v0.8b` or four floats in `v0.4s`, is passed in one `v` register, just like a double. A struct whose members are all the same floating-point type, or all the same short-vector type, with at most four of them (the standard calls it a homogeneous aggregate), travels in consecutive `v` registers, one member each: a struct of two doubles arrives in `d0` and `d1`. When too few of `v0`-`v7` are left for the whole struct, it goes on the stack instead, never split between the two.",
].join("\n");

const frameMarkdown = [
  "The frame pointer anchors the current frame. The prologue's `stp` saves the caller's `fp`/`lr` pair at the lowest address of the new frame, and `mov fp, sp` points `fp` at that pair. Locals sit just above it at fixed positive offsets such as `[fp, 16]` and `[fp, 20]`, between the saved pair and the caller's frame. Step the prologue and epilogue to watch the frame open and close:",
].join("\n");

const allocMarkdown = [
  "The `alloc = -(16 + locals) & -16` form sizes the frame: the `& -16` masks the low bits so the allocation is a 16-byte multiple, with `locals` the byte count of local space, so `sp` stays aligned through every call. A leaf routine that calls nothing and needs no locals can skip the save and `ret` directly.",
].join("\n");

const alignmentMarkdown = [
  "AAPCS64 requires `sp` to sit on a 16-byte boundary at every `bl`: the routine you call is entitled to assume it, and on Linux the first stack access through a misaligned `sp` (usually deep inside `printf`) faults the program. `sub sp, sp, 24` is the classic bug: it reserves room for three 8-byte locals but leaves `sp` on an odd multiple of 8, so the crash surfaces at the next call, far from the line that caused it. The fix is to round every local allocation up to a multiple of 16, the way the `alloc = -(16 + locals) & -16` form does. Move `sp` yourself and watch the boundary:",
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

      <Kicker number="01" title="registers by role: integer" className="mt-4" />
      <LessonMarkdown markdown={integerMarkdown} />
      <RegisterFileDiagram />

      <Kicker
        number="02"
        title="registers by role: floating point and vector"
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
