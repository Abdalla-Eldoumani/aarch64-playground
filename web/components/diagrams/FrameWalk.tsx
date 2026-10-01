"use client";

/**
 * A stepper over a short program: each step highlights a line, says what it
 * did, and shows the registers and stack bands after it. With no steps given
 * it walks the course prologue and epilogue in seven steps. Each state is
 * written by hand to match the emulator; dashed bands hold the layout before
 * a frame opens, so nothing shifts.
 */

import { useState, type JSX, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";

// The walked program. alloc = -(16 + 16) & -16 = -32: 16 for the pair,
// 16 for locals, already a 16-byte multiple.
const WALK_PROGRAM = `alloc = -(16 + 16) & -16
dealloc = -alloc

func:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        str     w9, [fp, 16]
        bl      helper
        ldp     fp, lr, [sp], dealloc
        ret`;

type Changed = "sp" | "fp" | "lr" | "pair" | "local";

/** One step of any walk: the state after the highlighted line ran. */
export interface WalkStep {
  /** The instruction this step just executed, shown in the header. */
  spell: string;
  /** Course-voice caption: what moved and why it matters. */
  effect: string;
  /** Zero-based line of the walked program to highlight. */
  codeLine: number;
  registers: { name: string; value: string; changed: boolean }[];
  /** The stack, high addresses first. */
  bands: BandProps[];
}

/** The prologue walk's own record, from which its bands are drawn. */
interface PrologueState {
  spell: string;
  effect: string;
  codeLine: number;
  sp: string;
  fp: string;
  lr: string;
  changed: Changed[];
  frameOpen: boolean;
  fpAnchored: boolean;
  /** Contents of the [fp, 16] local slot once written. */
  localValue?: string;
}

const STEPS: PrologueState[] = [
  {
    spell: "func: (entry)",
    effect:
      "at entry nothing is saved: fp still names the caller's frame and lr still holds the address func must eventually return to.",
    codeLine: 3,
    sp: "0xffd0",
    fp: "caller's",
    lr: "caller's",
    changed: [],
    frameOpen: false,
    fpAnchored: false,
  },
  {
    spell: "stp fp, lr, [sp, alloc]!",
    effect:
      "pre-index: sp drops by 32 first, then the caller's fp and lr are stored at the new sp. one instruction opens the frame and saves the pair.",
    codeLine: 4,
    sp: "0xffb0",
    fp: "caller's",
    lr: "caller's",
    changed: ["sp", "pair"],
    frameOpen: true,
    fpAnchored: false,
  },
  {
    spell: "mov fp, sp",
    effect:
      "fp now names this frame's base, the saved-pair slot. sp may move later; fp will not, and that is what makes [fp, 16] a stable address.",
    codeLine: 5,
    sp: "0xffb0",
    fp: "0xffb0",
    lr: "caller's",
    changed: ["fp"],
    frameOpen: true,
    fpAnchored: true,
  },
  {
    spell: "str w9, [fp, 16]",
    effect:
      "a local lands at [fp, 16]: above the saved pair, below the caller's frame. the course addresses locals at positive offsets off fp.",
    codeLine: 6,
    sp: "0xffb0",
    fp: "0xffb0",
    lr: "caller's",
    changed: ["local"],
    frameOpen: true,
    fpAnchored: true,
    localValue: "w9 -> 7 at [fp, 16]",
  },
  {
    spell: "bl helper",
    effect:
      "bl overwrote lr with its own return address, which is exactly why the prologue saved the caller's copy. helper returns here, and func can still get home.",
    codeLine: 7,
    sp: "0xffb0",
    fp: "0xffb0",
    lr: "after the bl",
    changed: ["lr"],
    frameOpen: true,
    fpAnchored: true,
    localValue: "w9 -> 7 at [fp, 16]",
  },
  {
    spell: "ldp fp, lr, [sp], dealloc",
    effect:
      "post-index: the pair is read back first, then sp rises by 32. fp and lr hold the caller's values again and the frame is gone.",
    codeLine: 8,
    sp: "0xffd0",
    fp: "caller's",
    lr: "caller's",
    changed: ["sp", "fp", "lr"],
    frameOpen: false,
    fpAnchored: false,
  },
  {
    spell: "ret",
    effect:
      "pc = lr: execution is back in the caller with sp, fp, and lr exactly as it left them. that round trip is the calling convention.",
    codeLine: 9,
    sp: "0xffd0",
    fp: "caller's",
    lr: "caller's",
    changed: [],
    frameOpen: false,
    fpAnchored: false,
  },
];

/** Amber tint: the machine changed this on the current step. */
const CHANGED_STYLE = {
  borderColor: "var(--amber)",
  backgroundColor: "color-mix(in srgb, var(--amber) 12%, transparent)",
} as const;

/** Cyan pointer chips, matching the diagrams' pointer treatment. */
const POINTER_STYLE = {
  borderColor: "var(--cyan)",
  backgroundColor: "color-mix(in srgb, var(--cyan) 12%, transparent)",
} as const;

const BAND_BASE =
  "flex min-h-[44px] items-center justify-between gap-3 rounded-[var(--radius-control)] border px-3 py-2";

/** Static role tints for diagrams that never step: cyan for a passed value,
 *  amber for a saved one, the AapcsRail's colours. */
const TINT_STYLE = {
  cyan: POINTER_STYLE,
  amber: CHANGED_STYLE,
} as const;

/** One stack band. Unique by label within a stack. */
export interface BandProps {
  label: string;
  detail: string;
  /** A slot that holds nothing yet (or nothing any more): dashed, quiet. */
  ghost?: boolean;
  changed?: boolean;
  tint?: keyof typeof TINT_STYLE;
  markers?: string[];
}

export function Band({
  label,
  detail,
  ghost = false,
  changed = false,
  tint,
  markers = [],
}: BandProps): JSX.Element {
  return (
    <li
      className={`${BAND_BASE} ${
        ghost
          ? "border-dashed border-[var(--border)]"
          : "border-[var(--border)] bg-[var(--bg-raised)]"
      }`}
      style={changed ? CHANGED_STYLE : tint ? TINT_STYLE[tint] : undefined}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className={`font-mono text-[13px] ${
            ghost ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"
          }`}
        >
          {label}
        </span>
        <span
          className={`font-mono text-[12px] ${
            ghost ? "text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]"
          }`}
        >
          {detail}
        </span>
      </span>
      {markers.length > 0 && (
        <span className="flex shrink-0 flex-col items-end gap-1">
          {markers.map((marker) => (
            <span
              key={marker}
              className="rounded-[var(--radius-control)] border px-2 py-0.5 font-mono text-[12px] text-[var(--text-primary)]"
              style={POINTER_STYLE}
            >
              {marker}
            </span>
          ))}
        </span>
      )}
    </li>
  );
}

/** The prologue walk's four bands for one state: dashed until the frame opens. */
function prologueBands(state: PrologueState): BandProps[] {
  return [
    {
      label: "caller's frame",
      detail: state.frameOpen
        ? "unchanged above the new frame"
        : "sp rests at its bottom edge, 0xffd0",
      markers: [
        ...(state.frameOpen ? [] : ["<- sp"]),
        ...(state.fpAnchored ? [] : ["fp points here"]),
      ],
    },
    {
      label: "locals",
      detail: !state.frameOpen
        ? "will hold the locals, [fp, 16] up to [fp, 31]"
        : (state.localValue ?? "16 bytes, nothing written yet"),
      ghost: !state.frameOpen,
      changed: state.changed.includes("local"),
    },
    {
      label: "saved lr",
      detail: state.frameOpen ? "caller's lr, at [fp, 8]" : "will hold the caller's lr",
      ghost: !state.frameOpen,
      changed: state.changed.includes("pair"),
    },
    {
      label: "saved fp",
      detail: state.frameOpen ? "caller's fp, at [fp, 0]" : "will hold the caller's fp",
      ghost: !state.frameOpen,
      changed: state.changed.includes("pair"),
      markers: [
        ...(state.frameOpen ? ["<- sp"] : []),
        ...(state.fpAnchored ? ["<- fp"] : []),
      ],
    },
  ];
}

const PROLOGUE_STEPS: WalkStep[] = STEPS.map((state) => ({
  spell: state.spell,
  effect: state.effect,
  codeLine: state.codeLine,
  registers: (["sp", "fp", "lr"] as const).map((name) => ({
    name,
    value: state[name],
    changed: state.changed.includes(name),
  })),
  bands: prologueBands(state),
}));

export function FrameWalk({
  className = "",
  label = "frame walk",
  heading = "walk the frame",
  program = WALK_PROGRAM,
  steps = PROLOGUE_STEPS,
}: {
  className?: string;
  /** The walk's accessible name; its step controls are "<label> steps". */
  label?: string;
  /** The small label over the current instruction. */
  heading?: string;
  program?: string;
  steps?: WalkStep[];
}): JSX.Element {
  const [index, setIndex] = useState(0);
  const step = steps[index];

  function move(delta: 1 | -1) {
    setIndex((current) =>
      Math.min(Math.max(current + delta, 0), steps.length - 1),
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    }
  }

  return (
    <section
      aria-label={label}
      className={`flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] p-4 ${className}`}
    >
      <header className="flex flex-col gap-1">
        <p className="[font:var(--type-label)] uppercase tracking-wide text-[var(--text-tertiary)]">
          {heading}
        </p>
        <p className="font-mono text-[15px] text-[var(--text-primary)]">
          {step.spell}
        </p>
      </header>

      <div
        className="flex flex-wrap items-center gap-3"
        onKeyDown={onKeyDown}
        role="group"
        aria-label={`${label} steps`}
      >
        <Button
          variant="secondary"
          onClick={() => move(-1)}
          disabled={index === 0}
        >
          back
        </Button>
        <Button onClick={() => move(1)} disabled={index === steps.length - 1}>
          next
        </Button>
        <span className="font-mono text-[13px] text-[var(--text-secondary)]">
          step {index + 1} of {steps.length}
        </span>
      </div>

      <CodeBlock code={program} highlightLine={step.codeLine} />

      <p
        aria-live="polite"
        className="min-h-[3em] border-l-2 border-[var(--amber)] pl-3 [font:var(--type-small)] text-[var(--text-secondary)]"
      >
        {step.effect}
      </p>

      <ul aria-label="registers" className="flex flex-wrap gap-2">
        {step.registers.map((register) => (
          <li
            key={register.name}
            aria-label={`${register.name}: ${register.value}${register.changed ? ", changed this step" : ""}`}
            className="flex min-w-[6rem] flex-col items-center gap-0.5 rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2"
            style={register.changed ? CHANGED_STYLE : undefined}
          >
            <span className="font-mono text-[13px] font-semibold text-[var(--text-primary)]">
              {register.name}
            </span>
            <span className="font-mono text-[12px] text-[var(--text-secondary)]">
              {register.value}
            </span>
          </li>
        ))}
      </ul>

      <StackColumn>
        <ul aria-label="stack bands" className="flex flex-col gap-2">
          {step.bands.map((band) => (
            <Band key={band.label} {...band} />
          ))}
        </ul>
      </StackColumn>
    </section>
  );
}

/** A stack drawn top to bottom between its high- and low-address edges. */
export function StackColumn({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[12px] text-[var(--text-secondary)]">
        <span>high addresses</span>
        <span className="flex items-center gap-1">
          <span aria-hidden="true">{"↓"}</span>
          the stack grows downward
        </span>
      </div>
      {children}
      <span className="text-[12px] text-[var(--text-secondary)]">
        low addresses
      </span>
    </div>
  );
}
