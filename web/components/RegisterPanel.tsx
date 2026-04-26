"use client";

import { motion } from "motion/react";
import { useEffect, useReducer } from "react";
import { useZoom } from "@/lib/use-zoom";
import { ZoomControl } from "@/components/ZoomControl";

interface RegisterPanelProps {
  registers: string[];
  changedRegs: Set<number>;
  sp: string;
  pc: number;
  nzcv: number;
}

const FLAG_NAMES = ["V", "C", "Z", "N"];

/**
 * ARM calling-convention aliases for X0..X30. Shown faded next to the
 * register name so students can cross-reference what the course docs
 * call each register.
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

  // Monotonic pulse id per register; framer uses this as the animation
  // key so the fade restarts each time the register actually changes.
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
                className={`px-1 rounded ${
                  set
                    ? "bg-[var(--accent)] text-black font-bold"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                {name}
              </span>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
        {registers.map((val, i) => (
          <RegisterRow
            key={i}
            name={`X${i}`}
            value={val}
            alias={ABI_ALIAS[i]}
            changed={changedRegs.has(i)}
            pulseId={pulses.get(i) ?? 0}
          />
        ))}
        <RegisterRow
          name="SP"
          value={sp}
          changed={changedRegs.has(31)}
          pulseId={pulses.get(31) ?? 0}
        />
        <RegisterRow name="PC" value={pcHex} changed={false} pulseId={0} />
      </div>
    </div>
  );
}

function RegisterRow({
  name,
  value,
  alias,
  changed,
  pulseId,
}: {
  name: string;
  value: string;
  alias?: string;
  changed: boolean;
  pulseId: number;
}) {
  return (
    <motion.div
      key={pulseId}
      initial={changed ? { backgroundColor: "rgba(250, 204, 21, 0.35)" } : false}
      animate={{ backgroundColor: "rgba(250, 204, 21, 0)" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`flex items-center justify-between py-0.5 px-1 rounded ${
        changed ? "text-[var(--changed)]" : ""
      }`}
    >
      <span className="text-[var(--text-secondary)] w-8 flex-shrink-0">
        {name}
      </span>
      {alias && (
        <span className="text-[9px] text-[var(--text-secondary)] opacity-60 flex-shrink-0 w-8 text-left">
          {alias}
        </span>
      )}
      <span className="font-mono flex-1 text-right">{value}</span>
    </motion.div>
  );
}
