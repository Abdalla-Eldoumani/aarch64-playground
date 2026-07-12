"use client";

/**
 * Step-through frame walk for the calling-convention guide: the course
 * prologue/epilogue as a seven-beat story. Each step highlights the line that
 * just executed (the debugger's amber current-line treatment via CodeBlock's
 * highlightLine), updates an sp/fp/lr strip, and redraws the frame bands the
 * way the course lays them out -- the saved fp/lr pair at the lowest address
 * where fp points, locals above it at positive offsets like [fp, 16], the
 * caller's frame above that (verified against the Week 8 examples and the
 * assignment files, which address locals as [fp, 16] / [fp, 20]).
 *
 * Every state is authored data, not a simulation; the values match what the
 * emulator would do but the point is the shape of the story. Amber marks what
 * the machine changed on this step; the step buttons are the user acting
 * (cyan). Bands render as dashed placeholders before the frame opens so the
 * layout never shifts. No animation anywhere, so reduced motion holds by
 * construction; the changed tint is a discrete state, not a flash.
 */

import { useState, type JSX, type KeyboardEvent } from "react";
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

interface WalkStep {
  /** The instruction this step just executed, shown in the header. */
  spell: string;
  /** Course-voice caption: what moved and why it matters. */
  effect: string;
  /** Zero-based line of WALK_PROGRAM to highlight. */
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

const STEPS: WalkStep[] = [
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

interface BandProps {
  label: string;
  detail: string;
  ghost: boolean;
  changed: boolean;
  markers: string[];
}

function Band({ label, detail, ghost, changed, markers }: BandProps): JSX.Element {
  return (
    <li
      className={`${BAND_BASE} ${
        ghost
          ? "border-dashed border-[var(--border)]"
          : "border-[var(--border)] bg-[var(--bg-raised)]"
      }`}
      style={changed ? CHANGED_STYLE : undefined}
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
          className={`font-mono text-[11px] ${
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
              className="rounded-[var(--radius-control)] border px-2 py-0.5 font-mono text-[11px] text-[var(--text-primary)]"
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

export function FrameWalk({
  className = "",
}: {
  className?: string;
}): JSX.Element {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];

  function move(delta: 1 | -1) {
    setIndex((current) =>
      Math.min(Math.max(current + delta, 0), STEPS.length - 1),
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

  const registers: Array<{ name: "sp" | "fp" | "lr"; value: string }> = [
    { name: "sp", value: step.sp },
    { name: "fp", value: step.fp },
    { name: "lr", value: step.lr },
  ];

  return (
    <section
      aria-label="frame walk"
      className={`flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] p-4 ${className}`}
    >
      <header className="flex flex-col gap-1">
        <p className="[font:var(--type-label)] uppercase tracking-wide text-[var(--text-tertiary)]">
          walk the frame
        </p>
        <p className="font-mono text-[15px] text-[var(--text-primary)]">
          {step.spell}
        </p>
      </header>

      <div
        className="flex flex-wrap items-center gap-3"
        onKeyDown={onKeyDown}
        role="group"
        aria-label="frame walk steps"
      >
        <Button
          variant="secondary"
          onClick={() => move(-1)}
          disabled={index === 0}
        >
          back
        </Button>
        <Button onClick={() => move(1)} disabled={index === STEPS.length - 1}>
          next
        </Button>
        <span className="font-mono text-[13px] text-[var(--text-secondary)]">
          step {index + 1} of {STEPS.length}
        </span>
      </div>

      <CodeBlock code={WALK_PROGRAM} highlightLine={step.codeLine} />

      <p
        aria-live="polite"
        className="min-h-[3em] border-l-2 border-[var(--amber)] pl-3 [font:var(--type-small)] text-[var(--text-secondary)]"
      >
        {step.effect}
      </p>

      <ul aria-label="registers" className="flex flex-wrap gap-2">
        {registers.map((register) => {
          const changed = step.changed.includes(register.name);
          return (
            <li
              key={register.name}
              aria-label={`${register.name}: ${register.value}${changed ? ", changed this step" : ""}`}
              className="flex min-w-[6rem] flex-col items-center gap-0.5 rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2"
              style={changed ? CHANGED_STYLE : undefined}
            >
              <span className="font-mono text-[13px] font-semibold text-[var(--text-primary)]">
                {register.name}
              </span>
              <span className="font-mono text-[12px] text-[var(--text-secondary)]">
                {register.value}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[12px] text-[var(--text-secondary)]">
          <span>high addresses</span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true">{"↓"}</span>
            the stack grows downward
          </span>
        </div>
        <ul aria-label="stack bands" className="flex flex-col gap-2">
          <Band
            label="caller's frame"
            detail={
              step.frameOpen
                ? "unchanged above the new frame"
                : "sp rests at its bottom edge, 0xffd0"
            }
            ghost={false}
            changed={false}
            markers={[
              ...(step.frameOpen ? [] : ["<- sp"]),
              ...(step.fpAnchored ? [] : ["fp points here"]),
            ]}
          />
          <Band
            label="locals"
            detail={
              !step.frameOpen
                ? "will hold the locals, [fp, 16] up to [fp, 31]"
                : (step.localValue ?? "16 bytes, nothing written yet")
            }
            ghost={!step.frameOpen}
            changed={step.changed.includes("local")}
            markers={[]}
          />
          <Band
            label="saved lr"
            detail={
              step.frameOpen ? "caller's lr, at [fp, 8]" : "will hold the caller's lr"
            }
            ghost={!step.frameOpen}
            changed={step.changed.includes("pair")}
            markers={[]}
          />
          <Band
            label="saved fp"
            detail={
              step.frameOpen ? "caller's fp, at [fp, 0]" : "will hold the caller's fp"
            }
            ghost={!step.frameOpen}
            changed={step.changed.includes("pair")}
            markers={[
              ...(step.frameOpen ? ["<- sp"] : []),
              ...(step.fpAnchored ? ["<- fp"] : []),
            ]}
          />
        </ul>
        <span className="text-[12px] text-[var(--text-secondary)]">
          low addresses
        </span>
      </div>
    </section>
  );
}
