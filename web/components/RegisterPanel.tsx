"use client";

import { useEffect, useReducer, useState } from "react";
import { useZoom } from "@/lib/use-zoom";
import { ZoomControl } from "@/components/ZoomControl";
import { RegisterRow } from "@/components/RegisterRow";
import { DRegisterRow } from "@/components/DRegisterRow";

interface RegisterPanelProps {
  registers: string[];
  changedRegs: Set<number>;
  /** d0-d31 raw bit patterns; [] hides the d-view (older WASM). */
  fpRegisters?: string[];
  changedFpRegs?: Set<number>;
  sp: string;
  pc: number;
  nzcv: number;
}

const FLAG_NAMES = ["V", "C", "Z", "N"];

const VIEW_KEY = "aarch64-playground:regfile-view";
const HEX_KEY = "aarch64-playground:regfile-fp-hex";

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

/** Persisted boolean flag, SSR-safe (reads localStorage after mount). */
function usePersistedFlag(key: string): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(false);
  useEffect(() => {
    try {
      setValue(window.localStorage.getItem(key) === "1");
    } catch {
      /* storage unavailable: session-only state */
    }
  }, [key]);
  const set = (next: boolean) => {
    setValue(next);
    try {
      window.localStorage.setItem(key, next ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  };
  return [value, set];
}

export function RegisterPanel({
  registers,
  changedRegs,
  fpRegisters = [],
  changedFpRegs = new Set(),
  sp,
  pc,
  nzcv,
}: RegisterPanelProps) {
  const pcHex = "0x" + pc.toString(16).padStart(8, "0");

  // The d-view exists only when the loaded WASM exposes FP registers.
  const hasFp = fpRegisters.length === 32;
  const [dView, setDView] = usePersistedFlag(VIEW_KEY);
  const [hexMode, setHexMode] = usePersistedFlag(HEX_KEY);
  const showD = hasFp && dView;

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

  const [fpPulses, bumpFpPulses] = useReducer(
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
    bumpFpPulses(changedFpRegs);
  }, [changedFpRegs]);

  const zoom = useZoom("registers");

  const segmentCell =
    "px-2 py-0.5 font-mono text-[10px] transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] focus-visible:z-10";

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
        <h2 className="font-mono font-medium uppercase tracking-[0.14em] text-[10px] text-[var(--text-secondary)]">
          regfile
        </h2>
        {hasFp ? (
          <div
            role="group"
            aria-label="register view"
            className="inline-flex items-stretch overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)]"
          >
            <button
              type="button"
              aria-pressed={!dView}
              onClick={() => setDView(false)}
              className={`${segmentCell} ${
                !dView
                  ? "bg-[var(--cyan)] text-[var(--on-cyan)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              x0–x30
            </button>
            <button
              type="button"
              aria-pressed={dView}
              onClick={() => setDView(true)}
              className={`${segmentCell} border-l border-[var(--border)] ${
                dView
                  ? "bg-[var(--cyan)] text-[var(--on-cyan)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              d0–d31
            </button>
          </div>
        ) : null}
        {showD ? (
          <div
            role="group"
            aria-label="fp value format"
            className="inline-flex items-stretch overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)]"
          >
            <button
              type="button"
              aria-pressed={!hexMode}
              onClick={() => setHexMode(false)}
              className={`${segmentCell} ${
                !hexMode
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              dec
            </button>
            <button
              type="button"
              aria-pressed={hexMode}
              onClick={() => setHexMode(true)}
              className={`${segmentCell} border-l border-[var(--border)] ${
                hexMode
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              hex
            </button>
          </div>
        ) : (
          <ZoomControl
            scale={zoom.scale}
            onZoomIn={zoom.zoomIn}
            onZoomOut={zoom.zoomOut}
            onReset={zoom.reset}
          />
        )}
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
        {showD
          ? fpRegisters.map((bits, i) => (
              // Keying on the pulse id remounts the row each time the register
              // actually changes, so the reduced-motion-safe --changed flash
              // replays even on consecutive writes.
              <DRegisterRow
                key={`d${i}-${fpPulses.get(i) ?? 0}`}
                index={i}
                bitsHex={bits}
                hexMode={hexMode}
                changed={changedFpRegs.has(i)}
              />
            ))
          : (
            <>
              {registers.map((val, i) => (
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
            </>
          )}
      </div>
    </div>
  );
}
