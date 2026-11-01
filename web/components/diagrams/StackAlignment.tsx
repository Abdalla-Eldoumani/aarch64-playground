"use client";

/**
 * Hands-on 16-byte alignment check for the calling-convention guide. The
 * presets are authored data and the arithmetic is plain client code, so no
 * emulator or worker runs. Every state is discrete, so there is no motion to
 * reduce.
 */

import { useState, type JSX } from "react";
import { FrameRow } from "@/components/panels/FrameRow";
import { KIND_STYLE, WHOLE_FRAME } from "@/components/panels/frame-styles";
import { Button } from "@/components/ui/Button";

// The 16-byte-aligned row the emulator's stack band starts a frame on.
const START_SP = 0x7fffff00;
/** 8-byte cells rendered below the caller's edge; 96 bytes of headroom. */
const CELL_COUNT = 12;
const LOWEST_BASE = START_SP - CELL_COUNT * 8;

interface Preset {
  /** The instruction the button replays. */
  spell: string;
  /** How many bytes the instruction moves sp down. */
  drop: number;
}

const PRESETS: Preset[] = [
  { spell: "stp x29, x30, [sp, -16]!", drop: 16 },
  { spell: "sub sp, sp, 24", drop: 24 },
  { spell: "sub sp, sp, 32", drop: 32 },
];

const hex = (value: number): string => `0x${value.toString(16)}`;

const ALIGNED_STYLE = {
  borderColor: "var(--success)",
  color: "var(--success)",
  backgroundColor: "color-mix(in srgb, var(--success) 12%, transparent)",
} as const;

const MISALIGNED_STYLE = {
  borderColor: "var(--danger)",
  color: "var(--danger)",
  backgroundColor: "color-mix(in srgb, var(--danger) 12%, transparent)",
} as const;

export function StackAlignment({
  className = "",
}: {
  className?: string;
}): JSX.Element {
  const [sp, setSp] = useState(START_SP);
  const aligned = sp % 16 === 0;

  // Cell base addresses, high to low, each covering [base, base + 8).
  const bases: number[] = [];
  for (let base = START_SP - 8; base >= LOWEST_BASE; base -= 8) bases.push(base);

  return (
    <section
      aria-label="stack alignment"
      className={`flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] p-4 ${className}`}
    >
      <header className="flex flex-col gap-1">
        <p className="[font:var(--type-label)] uppercase tracking-wide text-[var(--text-tertiary)]">
          move sp yourself
        </p>
        <p className="text-[12px] text-[var(--text-secondary)]">
          every cell is 8 bytes; sp starts at {hex(START_SP)}, a multiple of 16.
        </p>
      </header>

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="stack pointer presets"
      >
        {PRESETS.map((preset) => (
          <Button
            key={preset.spell}
            variant="secondary"
            className="font-mono text-[13px]"
            disabled={sp - preset.drop < LOWEST_BASE}
            onClick={() => setSp((current) => current - preset.drop)}
          >
            {preset.spell}
          </Button>
        ))}
        <Button
          variant="ghost"
          disabled={sp === START_SP}
          onClick={() => setSp(START_SP)}
        >
          reset
        </Button>
      </div>

      <p aria-live="polite" className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[14px] text-[var(--text-primary)]">
          {`sp = ${hex(sp)}`}
        </span>
        <span className="font-mono text-[12px] text-[var(--text-secondary)]">
          {`sp % 16 = ${sp % 16}`}
        </span>
        <span
          className="rounded-[var(--radius-control)] border px-2 py-0.5 [font:var(--type-small)]"
          style={aligned ? ALIGNED_STYLE : MISALIGNED_STYLE}
        >
          {aligned
            ? "aligned"
            : "misaligned: a bl from here faults on real hardware"}
        </span>
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[12px] text-[var(--text-secondary)]">
          <span>high addresses</span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true">{"↓"}</span>
            the stack grows downward
          </span>
        </div>
        {/* The frames view's rows, with no offset column: a cell's address
            is all it holds, so it is the box's title. */}
        <ul aria-label="stack cells, 8 bytes each">
          <FrameRow
            aria-label={`caller's frame${sp === START_SP ? ", sp rests at its bottom edge" : ""}`}
            box={WHOLE_FRAME}
            title="caller's frame"
            marker={sp === START_SP ? "sp" : ""}
          />
          {bases.map((base) => {
            const taken = base >= sp;
            return (
              <FrameRow
                key={base}
                aria-label={`${hex(base)}, ${taken ? "inside the new frame" : "free"}`}
                box={taken ? WHOLE_FRAME : KIND_STYLE.padding}
                title={hex(base)}
                marker={base === sp ? "sp" : ""}
              />
            );
          })}
        </ul>
        <span className="text-[12px] text-[var(--text-secondary)]">
          low addresses
        </span>
      </div>
    </section>
  );
}
