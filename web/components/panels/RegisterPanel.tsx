"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useZoom } from "@/lib/hooks/use-zoom";
import { formatWord64 } from "@/lib/emulator/format-hex";
import { LANE_WIDTHS, upperHalfMoved, type LaneWidth } from "@/lib/emulator/vector-lanes";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";
import { ZoomControl } from "@/components/ui/ZoomControl";
import { RegisterRow } from "@/components/panels/RegisterRow";
import { DRegisterRow } from "@/components/panels/DRegisterRow";
import { VRegisterRow } from "@/components/panels/VRegisterRow";

interface RegisterPanelProps {
  registers: string[];
  changedRegs: Set<number>;
  /** d0-d31 raw bit patterns; [] hides the d-view (older WASM). */
  fpRegisters?: string[];
  changedFpRegs?: ReadonlySet<number>;
  /** v0-v31 as "0x" + 32 hex digits; [] hides the v-view (older WASM). */
  vectorRegisters?: string[];
  sp: string;
  pc: number;
  nzcv: number;
  /** Full source text and the line the CPU is on, read only to tell a write
   *  through a v/q spelling from one through a d/s spelling: the register file
   *  is the same, the reading the student asked for is not. `currentLine` is
   *  the NEXT instruction, so the panel keeps the previous snapshot's line to
   *  read the one that actually executed. */
  source?: string;
  currentLine?: number | null;
}

// nzcv packs N at bit 3, Z at bit 2, C at bit 1, V at bit 0 (see the
// emulator's NzcvFlags::pack). Rendered left-to-right against `bitPos = 3 - i`
// so each label reads its own bit, in the conventional ARM N Z C V order.
const FLAG_NAMES = ["N", "Z", "C", "V"];

type RegView = "x" | "d" | "v";

const VIEW_KEY = "aarch64-playground:regfile-view";
/** The d-view's format flag keeps the key it shipped with, so a returning
 *  student's choice survives the split into one flag per view. */
const HEX_KEY = "aarch64-playground:regfile-fp-hex";
const X_DEC_KEY = "aarch64-playground:regfile-x-dec";
const V_DEC_KEY = "aarch64-playground:regfile-v-dec";
const LANE_KEY = "aarch64-playground:regfile-lane-width";

const VIEW_LABELS: Record<RegView, string> = {
  x: "x0–x30",
  d: "d0–d31",
  v: "v0–v31",
};

/** One line of orientation per view: which registers these are, and how the
 *  three files overlap. The control points at it with aria-describedby. */
const VIEW_HELP: Record<RegView, string> = {
  x: "x0–x30 are the integer registers.",
  d: "d0–d31 are the low 64 bits of the floating-point registers, with s the low 32.",
  v: "v0–v31 are the full 128-bit vector registers, and q0–q31 is the same 128 bits named as a scalar.",
};

const LANE_HELP: Record<LaneWidth, string> = {
  b: "8-bit lanes",
  h: "16-bit lanes",
  s: "32-bit lanes",
  d: "64-bit lanes",
};

/**
 * A destination written through a v or q spelling: optional label, mnemonic,
 * then a first operand naming the whole register (`ldr q0, [x0]`,
 * `mov v0.16b, v1.16b`). This is the half of the v-view rule a bit comparison
 * cannot see: `ins v0.d[0], x1` moves nothing above bit 63, but the student
 * named the vector register and should be shown it.
 */
const V_SPELLED_DEST = /^\s*(?:[A-Za-z_.$][\w.$]*\s*:\s*)?[a-zA-Z][\w.]*\s+[vq]\d{1,2}\b/;

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

/** Stable empty defaults. A fresh `[]` per render would make the previous
 *  vector snapshot differ from the current one on every render, and the panel
 *  would derive its way into a render loop. */
const NO_REGISTERS: string[] = [];
const NO_CHANGES: ReadonlySet<number> = new Set<number>();

const TWO_64 = 1n << 64n;
const SIGN_64 = 1n << 63n;

/** The signed 64-bit reading of a register, with the unsigned one beside it:
 *  the same pair the memory panel offers on a word. */
function readDecimal(hex: string): { signed: string; unsigned: string } {
  try {
    const bits = BigInt(hex) & (TWO_64 - 1n);
    return {
      signed: String(bits >= SIGN_64 ? bits - TWO_64 : bits),
      unsigned: String(bits),
    };
  } catch {
    return { signed: "0", unsigned: "0" };
  }
}

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

/** "1" / "0" are the two-view flag this control replaced: a returning student
 *  who left the panel on the d-file lands back on it. */
function parseView(raw: string | null): RegView | null {
  const stored = raw === "1" ? "d" : raw === "0" ? "x" : raw;
  return stored === "x" || stored === "d" || stored === "v" ? stored : null;
}

function parseLaneWidth(raw: string | null): LaneWidth | null {
  return raw === "b" || raw === "h" || raw === "s" || raw === "d" ? raw : null;
}

/** The lane width, persisted like the format flags. 64-bit lanes by default:
 *  two halves is the reading closest to the d-view the student came from. The
 *  state is a reducer so the stored value can arrive from an effect, the same
 *  reason the pulse ids below are one. */
function usePersistedLaneWidth(): [LaneWidth, (next: LaneWidth) => void] {
  const [value, apply] = useReducer((_prev: LaneWidth, next: LaneWidth) => next, "d");
  useEffect(() => {
    const stored = parseLaneWidth(safeGetItem(LANE_KEY));
    if (stored != null) apply(stored);
  }, []);
  const set = useCallback((next: LaneWidth) => {
    apply(next);
    safeSetItem(LANE_KEY, next);
  }, []);
  return [value, set];
}

/**
 * Which file is shown, and which of the other cells wrote while the student
 * was reading this one. The two are one state because the switch rule decides
 * both at once, and a reducer is how a rule inside an effect moves state here
 * (the pulse ids below do the same).
 */
interface ViewState {
  view: RegView;
  flagged: ReadonlySet<RegView>;
}

type ViewAction =
  /** The student picked a cell, or the stored choice arrived after mount. */
  | { kind: "show"; view: RegView }
  /** The classes this step wrote, already filtered to the ones that exist. */
  | { kind: "follow"; touched: readonly RegView[] };

const NO_FLAGS: ReadonlySet<RegView> = new Set<RegView>();
const INITIAL_VIEW: ViewState = { view: "x", flagged: NO_FLAGS };

function reduceView(state: ViewState, action: ViewAction): ViewState {
  if (action.kind === "show") {
    if (state.view === action.view && !state.flagged.has(action.view)) return state;
    const flagged = new Set(state.flagged);
    flagged.delete(action.view);
    return { view: action.view, flagged };
  }
  const { touched } = action;
  // Exactly one class wrote: show it, so a mixed program needs no manual
  // switching. Several at once: the student's view stays put and the other
  // cells carry a change dot, because guessing which write they meant to
  // watch is worse than saying both moved. A click between steps still wins;
  // the next single-class write may move it again.
  if (touched.length === 1) {
    if (state.view === touched[0] && state.flagged.size === 0) return state;
    return { view: touched[0], flagged: NO_FLAGS };
  }
  if (touched.length > 1) {
    const others = touched.filter((t) => t !== state.view);
    if (
      others.length === state.flagged.size &&
      others.every((t) => state.flagged.has(t))
    ) {
      return state;
    }
    return { view: state.view, flagged: new Set(others) };
  }
  return state;
}

/** Monotonic pulse id per register, used as the React key so the CSS flash
 *  restarts each time the register actually changes. `useReducer` lets the id
 *  bump inside an effect without tripping React 19's set-state-in-effect
 *  check. */
function bumpIds(
  prev: Map<number, number>,
  changed: ReadonlySet<number>,
): Map<number, number> {
  if (changed.size === 0) return prev;
  const next = new Map(prev);
  for (const idx of changed) next.set(idx, (next.get(idx) ?? 0) + 1);
  return next;
}

function usePulseIds(changed: ReadonlySet<number>): Map<number, number> {
  const [pulses, bump] = useReducer(bumpIds, null, () => new Map<number, number>());
  useEffect(() => {
    bump(changed);
  }, [changed]);
  return pulses;
}

export function RegisterPanel({
  registers,
  changedRegs,
  fpRegisters = NO_REGISTERS,
  changedFpRegs = NO_CHANGES,
  vectorRegisters = NO_REGISTERS,
  sp,
  pc,
  nzcv,
  source,
  currentLine = null,
}: RegisterPanelProps) {
  // 16 nibbles like every other row: PC renders through the same RegisterRow
  // as x0-x30 and SP, whose values are already 64-bit wide, so PC uses the
  // same width as the rest of the column.
  const pcHex = formatWord64(pc);

  // Each view exists only when the loaded WASM exposes its register file.
  const hasFp = fpRegisters.length === 32;
  const hasVec = vectorRegisters.length === 32;

  const [viewState, dispatchView] = useReducer(reduceView, INITIAL_VIEW);
  useEffect(() => {
    const stored = parseView(safeGetItem(VIEW_KEY));
    if (stored != null) dispatchView({ kind: "show", view: stored });
  }, []);
  const { flagged } = viewState;
  const view: RegView =
    (viewState.view === "d" && !hasFp) || (viewState.view === "v" && !hasVec)
      ? "x"
      : viewState.view;

  const [xDec, setXDec] = usePersistedFlag(X_DEC_KEY);
  const [hexMode, setHexMode] = usePersistedFlag(HEX_KEY);
  const [vDec, setVDec] = usePersistedFlag(V_DEC_KEY);

  const [laneWidth, setLaneWidth] = usePersistedLaneWidth();

  // The previous snapshot, kept by adjusting state during render (React's
  // derive-from-props pattern). Two things live here. The vector file, because
  // nothing in the wasm reports which LANES a write touched, and the diff
  // against the previous file answers both that and "did anything above bit 63
  // move". And the line that was current before it: `currentLine` is where the
  // pc points AFTER the step, so the instruction that produced this snapshot is
  // the one the PREVIOUS snapshot was sitting on. Over a run that is where the
  // run started rather than the last instruction of it, which costs nothing:
  // the spelling is only consulted when an fp or vector register changed, and
  // a run that touched bits 127:64 is already a v write by upperMoved.
  const [snapPair, setSnapPair] = useState({
    cur: vectorRegisters,
    prev: vectorRegisters,
    line: currentLine,
    prevLine: currentLine,
  });
  if (snapPair.cur !== vectorRegisters) {
    setSnapPair({
      cur: vectorRegisters,
      prev: snapPair.cur,
      line: currentLine,
      prevLine: snapPair.line,
    });
  }
  const fresh = snapPair.cur === vectorRegisters;
  const prevVectors = fresh ? snapPair.prev : snapPair.cur;
  const executedLine = fresh ? snapPair.prevLine : snapPair.line;

  const changedVecRegs = useMemo(() => {
    const out = new Set<number>();
    if (prevVectors.length !== vectorRegisters.length) return out;
    vectorRegisters.forEach((bits, i) => {
      if (bits !== prevVectors[i]) out.add(i);
    });
    return out;
  }, [vectorRegisters, prevVectors]);

  const upperMoved = useMemo(() => {
    for (const i of changedVecRegs) {
      if (upperHalfMoved(prevVectors[i], vectorRegisters[i])) return true;
    }
    return false;
  }, [changedVecRegs, prevVectors, vectorRegisters]);

  const vSpelledDest = useMemo(() => {
    if (executedLine == null || !source) return false;
    return V_SPELLED_DEST.test(source.split("\n")[executedLine - 1] ?? "");
  }, [source, executedLine]);

  // A v-view row flashes on either signal: the bits moved, or the machine
  // reported the write and it happened to land on the same value.
  const changedVecRows = useMemo(() => {
    const out = new Set(changedVecRegs);
    for (const i of changedFpRegs) out.add(i);
    return out;
  }, [changedVecRegs, changedFpRegs]);

  const pulses = usePulseIds(changedRegs);
  const fpPulses = usePulseIds(changedFpRegs);
  const vecPulses = usePulseIds(changedVecRows);

  // Auto-switching follows the write: which classes moved is read here, what
  // to do about it lives in reduceView. The current view is deliberately not a
  // dependency: it reaches the rule through the reducer's own state, so a
  // click survives until the next write instead of being snapped back.
  useEffect(() => {
    const touched: RegView[] = [];
    if (changedRegs.size > 0) touched.push("x");
    if (changedFpRegs.size > 0 || changedVecRegs.size > 0) {
      // A d write reaches bits 63:0 and no further; anything above that, or a
      // destination the student spelled v or q, is a vector write.
      touched.push(hasVec && (upperMoved || vSpelledDest) ? "v" : "d");
    }
    const usable = touched.filter(
      (t) => t === "x" || (t === "d" && hasFp) || (t === "v" && hasVec),
    );
    if (usable.length === 1) safeSetItem(VIEW_KEY, usable[0]);
    dispatchView({ kind: "follow", touched: usable });
  }, [
    changedRegs,
    changedFpRegs,
    changedVecRegs,
    upperMoved,
    vSpelledDest,
    hasFp,
    hasVec,
  ]);

  const pickView = useCallback((next: RegView) => {
    dispatchView({ kind: "show", view: next });
    safeSetItem(VIEW_KEY, next);
  }, []);

  const zoom = useZoom("registers");

  // shrink-0 + whitespace-nowrap: under flex pressure the cells collapsed far
  // enough to wrap "x0–x30" onto two lines and push the second cell out of
  // the group's overflow-hidden box.
  const segmentCell =
    "shrink-0 whitespace-nowrap px-2 py-0.5 font-mono text-[10px] transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] focus-visible:z-10";
  const groupShell =
    "inline-flex shrink-0 items-stretch overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)]";
  const selectedCell = "bg-[var(--cyan)] text-[var(--on-cyan)]";
  const restCell = "text-[var(--text-secondary)] hover:text-[var(--text-primary)]";
  const toggleOn = "bg-[var(--bg-elevated)] text-[var(--text-primary)]";

  const availableViews = (["x", "d", "v"] as RegView[]).filter(
    (id) => id === "x" || (id === "d" && hasFp) || (id === "v" && hasVec),
  );

  const formatToggle = (
    label: string,
    decPressed: boolean,
    onPick: (dec: boolean) => void,
  ) => (
    <div role="group" aria-label={label} className={groupShell}>
      <button
        type="button"
        aria-pressed={decPressed}
        onClick={() => onPick(true)}
        className={`${segmentCell} ${decPressed ? toggleOn : restCell}`}
      >
        dec
      </button>
      <button
        type="button"
        aria-pressed={!decPressed}
        onClick={() => onPick(false)}
        className={`${segmentCell} border-l border-[var(--border)] ${
          !decPressed ? toggleOn : restCell
        }`}
      >
        hex
      </button>
    </div>
  );

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
            aria-describedby="regfile-view-help"
            className={groupShell}
          >
            {availableViews.map((id, i) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                // The dot is ink; the word is the same fact for a reader who
                // never sees it. It contains the visible label, so the cell
                // is still addressable by the name on it.
                aria-label={flagged.has(id) ? `${VIEW_LABELS[id]} changed` : undefined}
                onClick={() => pickView(id)}
                className={`${segmentCell} min-h-[44px] ${
                  i > 0 ? "border-l border-[var(--border)]" : ""
                } ${view === id ? selectedCell : restCell}`}
              >
                {VIEW_LABELS[id]}
                {/* Another class wrote while the student was reading this
                    one: a dot in --changed ink, with the word carried by the
                    cell's own label above. */}
                {flagged.has(id) ? (
                  <span
                    aria-hidden="true"
                    className="ml-1 inline-block h-1 w-1 align-middle bg-[var(--changed)]"
                  />
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
        {view === "x"
          ? formatToggle("integer value format", xDec, setXDec)
          : view === "d"
            ? formatToggle("fp value format", !hexMode, (dec) => setHexMode(!dec))
            : formatToggle("vector value format", vDec, setVDec)}
        {view === "v" ? (
          <div role="group" aria-label="lane width" className={groupShell}>
            {LANE_WIDTHS.map((w, i) => (
              <button
                key={w}
                type="button"
                aria-pressed={laneWidth === w}
                onClick={() => setLaneWidth(w)}
                className={`${segmentCell} ${
                  i > 0 ? "border-l border-[var(--border)]" : ""
                } ${laneWidth === w ? toggleOn : restCell}`}
              >
                <span aria-hidden="true">{w}</span>
                <span className="sr-only">
                  {w}, {LANE_HELP[w]}
                </span>
              </button>
            ))}
          </div>
        ) : null}
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

      <p
        id="regfile-view-help"
        className="mb-2 font-mono text-[10px] leading-snug text-[var(--text-tertiary)]"
      >
        {VIEW_HELP[view]}
      </p>

      {/* Columns are intrinsic to the panel's own width, not the viewport:
          a second column appears only when two full rows actually fit, so a
          narrow host (an embed rail, a dragged-thin panel) can never squeeze
          a value into the neighboring column. 16.5rem covers one full row:
          name, alias, an 18-character hex value, gaps, and padding. The
          v-view takes the full width instead: a lane strip is wider than any
          column, and it scrolls inside its own row. */}
      <div
        className={
          view === "v"
            ? "grid grid-cols-1 gap-y-0.5"
            : "grid grid-cols-[repeat(auto-fill,minmax(min(16.5rem,100%),1fr))] gap-x-4 gap-y-0.5"
        }
      >
        {view === "v" ? (
          vectorRegisters.map((bits, i) => (
            <VRegisterRow
              key={`v${i}-${vecPulses.get(i) ?? 0}`}
              index={i}
              bitsHex={bits}
              prevBitsHex={prevVectors[i]}
              width={laneWidth}
              decMode={vDec}
              changed={changedVecRows.has(i)}
            />
          ))
        ) : view === "d" ? (
          fpRegisters.map((bits, i) => (
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
        ) : (
          <>
            {registers.map((val, i) => {
              const dec = xDec ? readDecimal(val) : null;
              return (
                <RegisterRow
                  key={`x${i}-${pulses.get(i) ?? 0}`}
                  name={`X${i}`}
                  value={dec ? dec.signed : val}
                  secondary={dec ? `${dec.unsigned} u` : undefined}
                  alias={ABI_ALIAS[i]}
                  changed={changedRegs.has(i)}
                />
              );
            })}
            {/* SP and PC stay hex under either format: they are addresses, and
                every other address in the debugger reads in hex. */}
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
