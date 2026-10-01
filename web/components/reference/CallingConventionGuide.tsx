"use client";

import { useCallback, useEffect, useState, type JSX, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Kicker } from "@/components/ui/Kicker";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { OnThisPage } from "@/components/ui/OnThisPage";
import { OpenInPlayground } from "@/components/ui/OpenInPlayground";
import { LessonMarkdown } from "@/components/learn/LessonMarkdown";
import { RegisterFileDiagram } from "@/components/diagrams/RegisterFileDiagram";
import { VectorRegisterViews } from "@/components/diagrams/VectorRegisterViews";
import { FpRegisterFileDiagram } from "@/components/diagrams/FpRegisterFileDiagram";
import { StackDiagram, type StackFrame } from "@/components/diagrams/StackDiagram";
import { FrameWalk } from "@/components/diagrams/FrameWalk";
import { FactorialWalk } from "@/components/diagrams/FactorialWalk";
import { StackAlignment } from "@/components/diagrams/StackAlignment";
import { GUIDE_EXAMPLES, type GuideExampleId } from "@/lib/content/calling-convention-examples";
import { callingConventionFragment } from "@/lib/content/site";
import { buildShareHash } from "@/lib/playground/share";
import { useHashFragment } from "@/lib/hooks/use-hash-fragment";

/**
 * The calling-convention guide: one scroll from the registers to the whole
 * contract, one idea per section. All prose goes through LessonMarkdown, the
 * one sanitizing renderer, and register names are written as inline code so
 * they get the same role summaries as the hover cards and the diagrams. Every
 * worked example is a whole program that ran on the course server.
 */

// The emulator loads only when an example is opened.
const EmbeddablePlayground = dynamic(
  () =>
    import("@/components/playground/EmbeddablePlayground").then(
      (m) => m.EmbeddablePlayground,
    ),
  { ssr: false, loading: () => null },
);

const SECTIONS = [
  { id: "integer", title: "Integer registers" },
  { id: "vector-names", title: "One vector register, many names" },
  { id: "vector-roles", title: "What a call keeps of the vector registers" },
  { id: "stack-arguments", title: "Arguments past the eighth" },
  { id: "structs", title: "Structs as arguments" },
  { id: "large-results", title: "Results larger than 16 bytes" },
  { id: "variadic", title: "Variadic calls such as printf" },
  { id: "callee-saved", title: "Saving callee-saved registers" },
  { id: "frame-record", title: "The frame record" },
  { id: "frame-chain", title: "The frame chain" },
  { id: "recursion", title: "Recursion, one frame per call" },
  { id: "alignment", title: "16-byte stack alignment" },
  { id: "rules", title: "Rules that are easy to break" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const sectionNumber = (index: number) => String(index + 1).padStart(2, "0");

const CONTENTS = SECTIONS.map((section, index) => ({
  id: callingConventionFragment(section.id),
  label: section.title,
  number: sectionNumber(index),
}));

const pitfall = (slug: string) => `/reference#pitfall-${slug}`;

// Each block is newline-joined so back-ticked tokens keep the hover-define
// without colliding with a template literal.
const leadMarkdown = [
  "The procedure call standard for AArch64 (AAPCS64) is the contract between a routine and the routines it calls: which registers carry arguments, which survive a call, and how the stack is kept. Following it is what lets your code call a routine like `printf` and return cleanly. The sections below go from the registers to the whole contract, and every worked example ran on the course servers with the output shown.",
].join("\n");

const integerMarkdown = [
  "Every general-purpose register has two names for one storage location: `x19` is all 64 bits and `w19` is its low 32 bits, the view for an int or anything narrower. Writing the `w` form zeroes the top half. A role belongs to the register, so `w19` keeps its value across a call exactly as `x19` does.",
  "",
  "The first eight arguments and the result travel in `x0` to `x7`. An int argument arrives in `w0` with the top half of `x0` undefined, so sign-extend it with `sxtw` before you use it as a 64-bit value. A routine you call may use `x0`-`x7` freely, so treat anything in them as gone once the call returns. `x8` holds the address for a result too big for registers, covered below, and the system call number for an `svc`.",
  "",
  "`x9` to `x15` are caller-saved temporaries: a routine you call may overwrite any of them. `x16` and `x17` can change on the way into a call, and `x18` is best left alone; the rules at the end of the page say why. `x19` to `x28` are callee-saved: a routine that writes one must restore it before returning, which makes them the place to keep a value alive across a call.",
  "",
  "`x29` is the frame pointer, `fp`, and `x30` the link register, `lr`. `sp` is the stack pointer, and `xzr` reads as zero and discards writes. There is no register named `pc` that an instruction can read or write: only branches change it, and `bl` also copies the address of the next instruction into `lr`, which is how the routine it calls knows where to return.",
].join("\n");

const vectorNamesMarkdown = [
  "Floating-point and vector values live in a second file of 32 registers, `v0` to `v31`, each 128 bits wide. Each register has five scalar names, and every one reads the low end of the same bits: `q0` is all 128 bits, `d0` the low 64 (a C `double`), `s0` the low 32 (a `float`), `h0` the low 16 and `b0` the low 8. So `s0`, `d0`, `q0` and `v0` are one register, not four.",
  "",
  "Written as `v0` with an arrangement, the same 128 bits become lanes: `v0.2d` is two 64-bit lanes, `v0.4s` four 32-bit lanes, `v0.8h` eight 16-bit lanes and `v0.16b` sixteen bytes, with lane 0 at the low end. `v0.2s`, `v0.4h` and `v0.8b` split only the low 64 bits. The course keeps to `s` and `d`; the playground runs the vector forms too, and the Instructions tab documents them.",
].join("\n");

const vectorRolesMarkdown = [
  "The calling convention splits this file the way it splits the integer one. `v0` to `v7` carry the first eight floating-point and vector arguments and return the result: `d0`-`d7` for doubles, `s0`-`s7` for floats. `v8` to `v15` are callee-saved, but only their low 64 bits: a routine that writes `d8`-`d15` must restore them, and it owes nothing for bits 127:64, so a caller that needs a whole `q` value kept across a call saves it itself. `v0`-`v7` and `v16`-`v31` are caller-saved: treat them as gone once a call returns.",
  "",
  `[A call keeps d8 to d15, not the rest of v8 to v15](${pitfall("only-d8-survives-a-call")}) runs a program that trips on the difference.`,
].join("\n");

const stackArgumentsMarkdown = [
  "Only eight integer arguments fit in `x0`-`x7`. The ninth and later go on the stack. The caller lowers `sp` to open an outgoing area, stores each extra argument in its own 8-byte slot (an int takes a whole slot too), and calls with `sp` pointing at the ninth. The callee finds them just above its own frame: after the course prologue `stp fp, lr, [sp, alloc]!` and `mov fp, sp`, the ninth argument is at `[fp, dealloc]`, one frame size above `fp`, and each later one 8 bytes higher. For the 16-byte frame below, that is `[fp, 16]` and `[fp, 24]`.",
  "",
  "The integer and floating-point registers count separately: a call with nine longs and three doubles puts the doubles in `d0`-`d2` and only the ninth long on the stack. And once an argument goes to the stack because it no longer fits, the registers left over stay empty. A 16-byte struct that comes up when only `x7` is free goes on the stack whole, and every integer argument after it goes there too, never into `x7`.",
].join("\n");

const structsMarkdown = [
  "A struct of up to 16 bytes travels by value, its bytes loaded into the next `x` registers as if with `ldr`: a struct of two longs arrives in `x0` and `x1`. A larger struct travels by reference. The caller copies it into its own frame and passes the copy's address, so the callee can change the copy without touching the original.",
  "",
  "One kind of struct goes to the vector registers instead. When every member has the same floating-point type and there are at most four of them, a homogeneous floating-point aggregate (HFA), each member travels in its own register, in consecutive `v` registers: a struct of three doubles arrives in `d0`, `d1` and `d2`. If too few of `v0`-`v7` are left, the whole struct goes on the stack, never split and never into `x` registers. The same holds for up to four short vectors of one type, 8 or 16 bytes each.",
].join("\n");

const largeResultsMarkdown = [
  "A result comes back where the same value would arrive as the first argument: an int or pointer in `x0`, a 16-byte struct in `x0` and `x1`, a double in `d0`, an HFA from `d0` up. A larger result, such as a struct of three longs, comes back through memory the caller provides. The caller reserves the space, usually in its own frame, and puts its address in `x8` before the `bl`. The callee writes each field through `x8` and need not keep `x8` intact, so the caller reads the result back through its own frame.",
].join("\n");

const variadicMarkdown = [
  "`printf` takes a variable number of arguments, which makes it variadic. On Linux those arguments travel just like ordinary ones: the format string in `x0`, then each int or pointer in the next free register from `x1` up and each double in the next from `d0` up, the two kinds counted separately. So `printf(\"%d %f\", n, x)` takes `n` in `w1` and `x` in `d0`.",
  "",
  "C passes a `float` to a variadic routine as a `double`, so widen a float first: `fcvt d1, s1` converts it exactly. A `char` or `short` becomes an int the same way. If you try this on a Mac, Apple's arm64 passes every variadic argument in 8-byte stack slots instead, so `printf` there reads its values from the stack, not from `w1` and `d0`.",
  "",
  `Three slips have runnable pages of their own: [printf reads a double from d0, never from x1](${pitfall("printf-reads-doubles-from-d")}), [widen a float to a double before printf](${pitfall("widen-a-float-for-printf")}), and [%d prints w1; %ld prints x1](${pitfall("format-width-matches-register")}).`,
].join("\n");

const calleeSavedMarkdown = [
  "A value that must outlive a call belongs in a callee-saved register: `x19`-`x28`, or `d8`-`d15` for a double. Your routine is a callee too, so before it writes one it saves the caller's value in its own frame, and it restores that value before `ret`. The saved registers sit above the frame record at fixed offsets from `fp`, and the frame rounds up to a multiple of 16: the record plus three 8-byte saves is 40 bytes, so the frame is 48.",
  "",
  `Keeping the value in \`x9\`-\`x15\` instead fails quietly, the first time the routine you call happens to use that register: [x9 to x15 do not survive a call](${pitfall("caller-saved-registers")}).`,
].join("\n");

const frameMarkdown = [
  "The frame pointer anchors the current frame. The prologue's `stp` saves the caller's `fp` and `lr` at the lowest address of the new frame, and `mov fp, sp` points `fp` at that pair, the frame record. Locals sit just above it at fixed positive offsets such as `[fp, 16]` and `[fp, 20]`, between the frame record and the caller's frame. Step the prologue and epilogue to watch the frame open and close:",
].join("\n");

const allocMarkdown = [
  "The `alloc = -(16 + locals) & -16` form sizes the frame: the `& -16` masks the low bits so the allocation is a 16-byte multiple, with `locals` the byte count of local space, so `sp` stays aligned through every call. A leaf routine that calls nothing and needs no locals can skip the save and `ret` directly.",
  "",
  `A routine that calls another cannot skip it, because \`bl\` overwrites \`lr\`: [a function that calls another must save lr first](${pitfall("save-lr-before-bl")}).`,
].join("\n");

const frameChainMarkdown = [
  "Each frame record holds the caller's `fp`, and the caller's `fp` points at the caller's own frame record. So the records form a chain from the routine running now back through every routine waiting on it, and loading `[fp]` steps one frame up. A debugger walks this chain to print a backtrace; the standard marks its end with a saved `fp` of zero.",
  "",
  "Below, `main` calls `outer` and `outer` calls `inner`. Each stores the address of its own name in its frame, and `inner` follows the chain to read all three.",
].join("\n");

const recursionMarkdown = [
  "A recursive routine needs no new rule. Each call opens its own frame, so each call has its own saved `lr`, its own saved `x19`, and its own `n`. Step through `fact(4)`: frames open as the calls go down, then close in reverse order as each multiplication finishes.",
].join("\n");

const alignmentMarkdown = [
  "AAPCS64 requires `sp` to sit on a 16-byte boundary at every `bl`: the routine you call is entitled to assume it, and on Linux the first stack access through a misaligned `sp` (usually deep inside `printf`) faults the program. `sub sp, sp, 24` is the classic bug: it reserves room for three 8-byte locals but leaves `sp` on an odd multiple of 8, so the crash surfaces at the next call, far from the line that caused it. The fix is to round every local allocation up to a multiple of 16, the way the `alloc = -(16 + locals) & -16` form does. Move `sp` yourself and watch the boundary:",
].join("\n");

const rulesMarkdown = [
  "Four rules catch most programs that work until they call something. Each link opens a broken program and its fix, both runnable.",
  "",
  `- The flags do not survive a call. NZCV is undefined when a routine returns, so compare again after the \`bl\`: [the flags do not survive a call](${pitfall("flags-do-not-survive-a-call")}).`,
  `- \`x16\` and \`x17\` can change on the way into any \`bl\`, because the linker may put a short stub that uses them between the call and its target: [x16 and x17 can change on the way into a call](${pitfall("x16-x17-change-across-bl")}).`,
  "- Avoid `x18`. The standard lets a platform reserve it, and Apple and Windows do; on Linux it is a temporary that any call may change.",
  `- Keep \`sp\` a multiple of 16 wherever memory is reached through it, not only at a call: [the frame record takes 16 bytes, not 8](${pitfall("frame-record-takes-16-bytes")}) and [round every local allocation up to a multiple of 16](${pitfall("locals-round-up-to-16")}).`,
].join("\n");

// The stack at three moments, high addresses first.
const OUTGOING_AREA: StackFrame[] = [
  {
    title: "main's frame",
    bands: [{ label: "main's frame record", detail: "saved fp and lr" }],
  },
  {
    title: "main's outgoing area",
    bands: [
      { label: "digit 10 = 0", detail: "[sp, 8] in main, [fp, 24] in join_digits", tint: "cyan" },
      {
        label: "digit 9 = 9",
        detail: "[sp] in main, [fp, 16] in join_digits",
        tint: "cyan",
        markers: ["<- sp at the bl"],
      },
    ],
  },
  {
    title: "join_digits' frame",
    bands: [
      { label: "saved lr", detail: "[fp, 8]" },
      { label: "saved fp", detail: "[fp, 0]", markers: ["<- sp", "<- fp"] },
    ],
  },
];

const SAVED_REGISTERS: StackFrame[] = [
  {
    title: "main's frame",
    bands: [{ label: "main's frame record", detail: "saved fp and lr" }],
  },
  {
    title: "print_multiples' frame, 48 bytes",
    bands: [
      { label: "padding", detail: "[fp, 40]: rounds 40 bytes up to 48", ghost: true },
      { label: "saved d8", detail: "[fp, 32], d8_s", tint: "amber" },
      { label: "saved x20", detail: "[fp, 24], x20_s", tint: "amber" },
      { label: "saved x19", detail: "[fp, 16], x19_s", tint: "amber" },
      { label: "saved lr", detail: "[fp, 8]" },
      { label: "saved fp", detail: "[fp, 0]", markers: ["<- sp", "<- fp"] },
    ],
  },
];

const FRAME_CHAIN: StackFrame[] = [
  {
    title: "main's frame",
    bands: [
      { label: "name", detail: "[fp, 16]: the address of \"main\"" },
      { label: "main's frame record", detail: "saved fp: points at its caller's record" },
    ],
  },
  {
    title: "outer's frame",
    bands: [
      { label: "name", detail: "[fp, 16]: the address of \"outer\"" },
      { label: "outer's frame record", detail: "saved fp: points at main's record" },
    ],
  },
  {
    title: "inner's frame",
    bands: [
      { label: "saved x19 and x20", detail: "[fp, 24] and [fp, 32]", tint: "amber" },
      { label: "name", detail: "[fp, 16]: the address of \"inner\"" },
      {
        label: "inner's frame record",
        detail: "saved fp: points at outer's record",
        markers: ["<- sp", "<- fp"],
      },
    ],
  },
];

const OUTPUT_CLASS =
  "overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-3 font-mono text-[13px] leading-relaxed text-[var(--text-primary)]";

/** A worked example: the lines that matter, a run in place, and the output. */
function WorkedExample({
  id,
  open,
  onToggle,
}: {
  id: GuideExampleId;
  open: boolean;
  onToggle: (id: GuideExampleId) => void;
}): JSX.Element {
  const example = GUIDE_EXAMPLES[id];
  return (
    <div className="flex flex-col gap-3">
      {example.excerpt !== "" && <CodeBlock code={example.excerpt} />}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          aria-pressed={open}
          aria-label={open ? `close the program: ${example.name}` : `run the whole program: ${example.name}`}
          onClick={() => onToggle(id)}
          className="touch-target"
        >
          {open ? "close" : "run the whole program"}
        </Button>
        <OpenInPlayground href={`/playground${buildShareHash({ source: example.source })}`} />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-[var(--text-secondary)] [font:var(--type-small)]">On the server it prints:</p>
        <pre className={OUTPUT_CLASS}>{example.stdout}</pre>
      </div>
      {open && (
        // Fixed frame so the editor loading never shifts the page.
        <div className="embed-frame flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] sm:h-[560px]">
          <EmbeddablePlayground
            key={id}
            chrome="embed"
            startSource={example.source}
            readOnly={false}
            registerHeadingLevel={3}
          />
        </div>
      )}
    </div>
  );
}

/** One numbered section: a hidden heading for assistive tech, the kicker for the eye. */
function Section({ id, children }: { id: SectionId; children: ReactNode }): JSX.Element {
  const index = SECTIONS.findIndex((section) => section.id === id);
  const { title } = SECTIONS[index];
  const anchor = callingConventionFragment(id);
  return (
    <section id={anchor} aria-labelledby={`${anchor}-title`} className="mt-4 flex scroll-mt-24 flex-col gap-6">
      <h2 id={`${anchor}-title`} className="sr-only">
        {title}
      </h2>
      <div aria-hidden="true">
        <Kicker number={sectionNumber(index)} title={title} />
      </div>
      {children}
    </section>
  );
}

export function CallingConventionGuide({
  className = "",
}: {
  className?: string;
}): JSX.Element {
  // One program runs at a time; opening another closes the first.
  const [open, setOpen] = useState<GuideExampleId | null>(null);
  const toggle = useCallback((id: GuideExampleId) => {
    setOpen((current) => (current === id ? null : id));
  }, []);
  const example = (id: GuideExampleId) => (
    <WorkedExample id={id} open={open === id} onToggle={toggle} />
  );

  // A link to one section opens this tab before the section exists, so the
  // browser's own jump never happens: bring it into view once rendered.
  const fragment = useHashFragment();
  useEffect(() => {
    if (!fragment.startsWith(callingConventionFragment(""))) return;
    document.getElementById(fragment)?.scrollIntoView({ block: "start" });
  }, [fragment]);

  return (
    <div
      className={`mx-auto flex w-full max-w-5xl flex-col gap-8 lg:flex-row-reverse lg:items-start lg:gap-12 ${className}`}
    >
      <OnThisPage sections={CONTENTS} className="lg:w-56 lg:shrink-0" />

      <section aria-label="aapcs64 calling convention" className="flex w-full min-w-0 max-w-2xl flex-col gap-6">
        <div className="[&_p:first-of-type]:[font:var(--type-lead)]">
          <LessonMarkdown markdown={leadMarkdown} />
        </div>

        <Section id="integer">
          <LessonMarkdown markdown={integerMarkdown} />
          <RegisterFileDiagram />
        </Section>

        <Section id="vector-names">
          <LessonMarkdown markdown={vectorNamesMarkdown} />
          <VectorRegisterViews />
        </Section>

        <Section id="vector-roles">
          <LessonMarkdown markdown={vectorRolesMarkdown} />
          <FpRegisterFileDiagram />
        </Section>

        <Section id="stack-arguments">
          <LessonMarkdown markdown={stackArgumentsMarkdown} />
          <StackDiagram label="the outgoing area at the bl" frames={OUTGOING_AREA} />
          {example("ten-arguments")}
        </Section>

        <Section id="structs">
          <LessonMarkdown markdown={structsMarkdown} />
          {example("struct-arguments")}
        </Section>

        <Section id="large-results">
          <LessonMarkdown markdown={largeResultsMarkdown} />
          {example("large-result")}
        </Section>

        <Section id="variadic">
          <LessonMarkdown markdown={variadicMarkdown} />
          {example("variadic-printf")}
        </Section>

        <Section id="callee-saved">
          <LessonMarkdown markdown={calleeSavedMarkdown} />
          <StackDiagram label="print_multiples' frame" frames={SAVED_REGISTERS} />
          {example("callee-saved")}
        </Section>

        <Section id="frame-record">
          <LessonMarkdown markdown={frameMarkdown} />
          <FrameWalk />
          <LessonMarkdown markdown={allocMarkdown} />
        </Section>

        <Section id="frame-chain">
          <LessonMarkdown markdown={frameChainMarkdown} />
          <StackDiagram label="three frame records, chained" frames={FRAME_CHAIN} />
          {example("frame-chain")}
        </Section>

        <Section id="recursion">
          <LessonMarkdown markdown={recursionMarkdown} />
          <FactorialWalk />
          {example("factorial")}
        </Section>

        <Section id="alignment">
          <LessonMarkdown markdown={alignmentMarkdown} />
          <StackAlignment />
        </Section>

        <Section id="rules">
          <LessonMarkdown markdown={rulesMarkdown} />
        </Section>
      </section>
    </div>
  );
}
