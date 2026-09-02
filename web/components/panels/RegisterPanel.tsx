"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { useZoom } from "@/lib/hooks/use-zoom";
import { formatWord64 } from "@/lib/emulator/format-hex";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";
import { ZoomControl } from "@/components/ui/ZoomControl";
import { RegisterRow } from "@/components/panels/RegisterRow";
import { DRegisterRow } from "@/components/panels/DRegisterRow";

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

// nzcv packs N at bit 3, Z at bit 2, C at bit 1, V at bit 0 (see the
// emulator's NzcvFlags::pack). Rendered left-to-right against `bitPos = 3 - i`
// so each label reads its own bit, in the conventional ARM N Z C V order --
// the prior ["V","C","Z","N"] paired every label with the wrong bit.
const FLAG_NAMES = ["N", "Z", "C", "V"];

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
    // Storage unavailable reads as null, which is the same false the state
    // already holds: session-only state, no separate branch needed.
    setValue(safeGetItem(key) === "1");
  }, [key]);
  const set = useCallback((next: boolean) => {
    setValue(next);
    safeSetItem(key, next ? "1" : "0");
  }, [key]);
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
  // 16 nibbles like every other row: PC renders through the same RegisterRow
  // as x0-x30 and SP, whose values are already 64-bit wide, so the column is
  // sized for it and the short form only made one row disagree.
  const pcHex = formatWord64(pc);

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

  // Auto-follow the executing instruction's register class: a step that
  // writes a d-register flips to the fp file, an integer-only write flips
  // back, so a mixed program narrates itself without manual switching. The
  // toggle still works between steps (a click just sets the view the next
  // write may move again); a step that writes both files, or none, leaves
  // the student's choice alone.
  useEffect(() => {
    if (!hasFp) return;
    if (changedFpRegs.size > 0 && changedRegs.size === 0) setDView(true);
    else if (changedRegs.size > 0 && changedFpRegs.size === 0) setDView(false);
  }, [changedFpRegs, changedRegs, hasFp, setDView]);

  const zoom = useZoom("registers");

  // shrink-0 + whitespace-nowrap: under flex pressure the cells collapsed far
  // enough to wrap "x0–x30" onto two lines and push the second cell out of
  // the group's overflow-hidden box.
  const segmentCell =
    "shrink-0 whitespace-nowrap px-2 py-0.5 font-mono text-[10px] transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] focus-visible:z-10";

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
      <div className="flex flex-wrap items-center justify-between mb-2 gap-x-2 gap-y-1">
        <h2 className="font-mono font-medium uppercase tracking-[0.14em] text-[10px] text-[var(--text-secondary)]">
          regfile
        </h2>
        {hasFp ? (
          <div
            role="group"
            aria-label="register view"
            className="inline-flex shrink-0 items-stretch overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)]"
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
            className="inline-flex shrink-0 items-stretch overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)]"
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
            // A set flag is machine state, so it reads in execution amber;
            // an unset flag recedes to the tertiary text token.
            const tone = set
              ? "text-[var(--amber)] font-bold"
              : "text-[var(--text-tertiary)]";
            return (
              <span key={name} className="px-1 whitespace-nowrap">
                <span className={tone}>{name}</span>
                {/* Colour alone cannot carry set/clear: the bit value rides
                    beside the letter for anyone who cannot see the amber,
                    and the state reaches a screen reader as words. */}
                <span aria-hidden="true" className={tone}>
                  {set ? "=1" : "=0"}
                </span>
                <span className="sr-only">{set ? " set" : " clear"}</span>
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
