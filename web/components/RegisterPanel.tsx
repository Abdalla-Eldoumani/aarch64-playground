"use client";

import { useEffect, useReducer } from "react";
import { useZoom } from "@/lib/use-zoom";
import { ZoomControl } from "@/components/ZoomControl";
import { RegisterRow } from "@/components/RegisterRow";

interface RegisterPanelProps {
  registers: string[];
  changedRegs: Set<number>;
  sp: string;
  pc: number;
  nzcv: number;
}

const FLAG_NAMES = ["V", "C", "Z", "N"];

/**
 * ARM calling-convention aliases for X0..X30. Shown beside the register name
 * (AA-legible via the base RegisterRow, not a faded micro-label) so students
 * can cross-reference what the course docs call each register.
 */
const ABI_ALIAS: Record<number, string> = {
  0: "arg0",
  1: "arg1",
  2: "arg2",
  3: "arg3",
  4: "arg4",
  5: "arg5",
  6: "arg6",
  7: "arg7",
  8: "ind",
  16: "ip0",
  17: "ip1",
  18: "pr",
  29: "fp",
  30: "lr",
};

export function RegisterPanel({
  registers,
  changedRegs,
  sp,
  pc,
  nzcv,
}: RegisterPanelProps) {
  const pcHex = "0x" + pc.toString(16).padStart(8, "0");

  // Monotonic pulse id per register; used as the React key so the CSS
  // flash restarts each time the register actually changes.
  // `useReducer` lets us bump ids inside an effect without tripping
  // React 19's set-state-in-effect check.
  const [pulses, bumpPulses] = useReducer(
    (prev: Map<number, number>, changed: Set<number>) => {
      if (changed.size === 0) return prev;
      const next = new Map(prev);
      for (const idx of changed) next.set(idx, (next.get(idx) ?? 0) + 1);
      return next;
    },
    null,
    () => new Map<number, number>(),
  );
  useEffect(() => {
    bumpPulses(changedRegs);
  }, [changedRegs]);

  const zoom = useZoom("registers");

  return (
    <div
      className="p-3"
      style={{ ...zoom.style, fontSize: `calc(0.75rem * var(--font-scale, 1))` }}
      onWheel={(e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        if (e.deltaY < 0) zoom.zoomIn();
        else zoom.zoomOut();
      }}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <h2 className="text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">
          registers
        </h2>
        <ZoomControl
          scale={zoom.scale}
          onZoomIn={zoom.zoomIn}
          onZoomOut={zoom.zoomOut}
          onReset={zoom.reset}
        />
        <div className="flex gap-2 ml-auto">
          {FLAG_NAMES.map((name, i) => {
            const bitPos = 3 - i;
            const set = (nzcv >> bitPos) & 1;
            return (
              <span
                key={name}
                // A set flag is machine state, so it reads in execution amber;
                // an unset flag recedes to the tertiary text token.
                className={`px-1 ${
                  set
                    ? "text-[var(--amber)] font-bold"
                    : "text-[var(--text-tertiary)]"
                }`}
              >
                {name}
              </span>
            );
          })}
        </div>
      </div>

      {/* Columns are intrinsic to the panel's own width, not the viewport:
          a second column appears only when two full rows actually fit, so a
          narrow host (an embed rail, a dragged-thin panel) can never squeeze
          a value into the neighboring column. 16.5rem covers one full row:
          name, alias, an 18-character hex value, gaps, and padding. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(16.5rem,100%),1fr))] gap-x-4 gap-y-0.5">
        {registers.map((val, i) => (
          // Keying on the pulse id remounts the row each time the register
          // actually changes, so the reduced-motion-safe --changed flash in the
          // shared RegisterRow replays even on consecutive writes.
          <RegisterRow
            key={`x${i}-${pulses.get(i) ?? 0}`}
            name={`X${i}`}
            value={val}
            alias={ABI_ALIAS[i]}
            changed={changedRegs.has(i)}
          />
        ))}
        <RegisterRow
          key={`sp-${pulses.get(31) ?? 0}`}
          name="SP"
          value={sp}
          changed={changedRegs.has(31)}
        />
        <RegisterRow name="PC" value={pcHex} changed={false} />
      </div>
    </div>
  );
}
