"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useZoom } from "@/lib/hooks/use-zoom";
import { formatWord64 } from "@/lib/emulator/format-hex";
import { isCallLeftover } from "@/lib/emulator/clobber-note";
import {
  compactHex,
  fpRegisterText,
  integerReading,
  laneText,
  parseBits,
  type LaneArrangement,
} from "@/lib/emulator/register-format";
import { sliceLanes, upperHalfMoved } from "@/lib/emulator/vector-lanes";
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
  /** A run is streaming snapshots. The list holds still and says nothing
   *  until it stops, then follows what the snapshot it stopped on wrote. */
  running?: boolean;
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
const FOLLOW_KEY = "aarch64-playground:regfile-follow";

/** How long a scroll by the student holds the list still. */
const USER_SCROLL_HOLD_MS = 5000;

const VIEW_LABELS: Record<RegView, string> = {
  x: "x0–x30",
  d: "d0–d31",
  v: "v0–v31",
};

/** One line of orientation per view: which registers these are, and how the
 *  three files overlap. The control points at it with aria-describedby, and
 *  each cell shows it on hover. */
const VIEW_HELP: Record<RegView, string> = {
  x: "x0–x30 are the integer registers.",
  d: "d0–d31 are the low 64 bits of the floating-point registers, with s the low 32.",
  v: "v0–v31 are the full 128-bit vector registers, and q0–q31 is the same 128 bits named as a scalar.",
};

/** The lane arrangements the v view reads a register in: the four integer
 *  widths by their ISA letter, then the two float ones by their C names. The
 *  ids are what storage holds, so a width stored before the float ones
 *  existed still parses. Cells, not a popover: a listbox opened in the short
 *  register pane was clipped by it. */
const ARRANGEMENTS = {
  b: { width: "b", float: false, label: "b", help: "8-bit lanes" },
  h: { width: "h", float: false, label: "h", help: "16-bit lanes" },
  s: { width: "s", float: false, label: "s", help: "32-bit lanes" },
  d: { width: "d", float: false, label: "d", help: "64-bit lanes" },
  sf: { width: "s", float: true, label: "float", help: "32-bit float lanes" },
  df: { width: "d", float: true, label: "double", help: "64-bit float lanes" },
} as const satisfies Record<string, LaneArrangement & { label: string; help: string }>;

type ArrangementId = keyof typeof ARRANGEMENTS;

const ARRANGEMENT_IDS = Object.keys(ARRANGEMENTS) as ArrangementId[];

function isArrangementId(raw: string | null): raw is ArrangementId {
  return raw != null && Object.hasOwn(ARRANGEMENTS, raw);
}

/**
 * The letter a destination register was spelled with: optional label,
 * mnemonic, then a first operand naming a v, q, or d register (`ldr q0, [x0]`,
 * `mov v0.16b, v1.16b`, `fmov d0, x1`). It is what a bit comparison cannot
 * see. `ins v0.d[0], x1` moves nothing above bit 63, but the student named the
 * vector register and should be shown it. And `fmov d0, x1` with a small x1
 * leaves only low bits set, which would otherwise read as an s write's float.
 */
const SPELLED_DEST = /^\s*(?:[A-Za-z_.$][\w.$]*\s*:\s*)?[a-zA-Z][\w.]*\s+([vqd])\d{1,2}\b/;

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

const ZERO_VECTOR = /^0x0+$/;

/** Persisted boolean flag, SSR-safe (reads localStorage after mount). A
 *  reducer, like the lane arrangement below, so the stored value can arrive
 *  from an effect. */
function usePersistedFlag(
  key: string,
  fallback = false,
): [boolean, (next: boolean) => void] {
  const [value, apply] = useReducer((_prev: boolean, next: boolean) => next, fallback);
  useEffect(() => {
    // Storage unavailable reads as null, which keeps the fallback: session-only
    // state, no separate branch needed.
    const stored = safeGetItem(key);
    if (stored != null) apply(stored === "1");
  }, [key]);
  const set = useCallback((next: boolean) => {
    apply(next);
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

/** The lane arrangement, persisted like the format flags. 64-bit integer
 *  lanes by default: two halves is the reading closest to the d-view the
 *  student came from. The state is a reducer so the stored value can arrive
 *  from an effect, the same reason the pulse ids below are one. */
function usePersistedArrangement(): [ArrangementId, (next: ArrangementId) => void] {
  const [value, apply] = useReducer((_prev: ArrangementId, next: ArrangementId) => next, "d");
  useEffect(() => {
    const stored = safeGetItem(LANE_KEY);
    if (isArrangementId(stored)) apply(stored);
  }, []);
  const set = useCallback((next: ArrangementId) => {
    apply(next);
    safeSetItem(LANE_KEY, next);
  }, []);
  return [value, set];
}

/** A step's write, waiting for the list to bring its rows into view and for
 *  the live region to say it. `id` tells a new write from a re-render. */
interface PendingFollow {
  id: number;
  view: RegView;
  /** Row positions in that view's grid (register index; SP is 31). */
  rows: readonly number[];
  speech: string;
}

/**
 * Which file is shown, which of the other cells wrote while the student was
 * reading this one, and the write waiting to be followed. They are one state
 * because the switch rule decides all three at once, and a reducer is how a
 * rule inside an effect moves state here (the pulse ids below do the same).
 */
interface ViewState {
  view: RegView;
  flagged: ReadonlySet<RegView>;
  pending: PendingFollow | null;
  /** fp registers whose last write was spelled `dN`: always read as doubles. */
  doubles: ReadonlySet<number>;
}

type ViewAction =
  /** The student picked a cell, or the stored choice arrived after mount. */
  | { kind: "show"; view: RegView }
  /** A run is streaming: the write from before it is no longer the news. */
  | { kind: "run" }
  /** The classes this step wrote, already filtered to the ones that exist. */
  | {
      kind: "follow";
      touched: readonly RegView[];
      /** "follow changes" is on: a single-class write may switch the view. */
      move: boolean;
      rows: Record<RegView, readonly number[]>;
      speech: string;
      /** The fp registers the machine reports written, and whether the
       *  executed line spelled its destination `dN`. */
      fpWritten: readonly number[];
      dSpelled: boolean;
    };

const NO_FLAGS: ReadonlySet<RegView> = new Set<RegView>();
const INITIAL_VIEW: ViewState = {
  view: "x",
  flagged: NO_FLAGS,
  pending: null,
  doubles: new Set<number>(),
};

function sameViews(a: readonly RegView[], b: ReadonlySet<RegView>): boolean {
  return a.length === b.size && a.every((t) => b.has(t));
}

/** The last write with nothing left to show or say. Its id stays, so the
 *  next write's id is still new to the scroll effect. */
function spent(pending: PendingFollow | null): PendingFollow | null {
  return pending && (pending.rows.length > 0 || pending.speech)
    ? { ...pending, rows: [], speech: "" }
    : pending;
}

function reduceView(state: ViewState, action: ViewAction): ViewState {
  if (action.kind === "show") {
    if (state.view === action.view && !state.flagged.has(action.view)) return state;
    const flagged = new Set(state.flagged);
    flagged.delete(action.view);
    return { ...state, view: action.view, flagged };
  }
  if (action.kind === "run") {
    const pending = spent(state.pending);
    return pending === state.pending ? state : { ...state, pending };
  }
  const { touched, move } = action;
  let { view, flagged } = state;
  // Exactly one class wrote: show it, so a mixed program needs no manual
  // switching. Several at once, or following switched off: the student's
  // view stays put and the other cells carry a change dot, because guessing
  // which write they meant to watch is worse than saying both moved. A click
  // between steps still wins; the next single-class write may move it again.
  if (move && touched.length === 1) {
    view = touched[0];
    if (flagged.size > 0) flagged = NO_FLAGS;
  } else if (touched.length > 0) {
    const others = touched.filter((t) => t !== view);
    if (!sameViews(others, flagged)) flagged = new Set(others);
  }
  // A snapshot that wrote nothing drops the last write too: kept, its words
  // would come back after a run as if the run had just written them.
  const rows = action.rows[view];
  const pending =
    rows.length > 0 || action.speech
      ? { id: (state.pending?.id ?? 0) + 1, view, rows, speech: action.speech }
      : spent(state.pending);
  let { doubles } = state;
  if (action.fpWritten.some((i) => doubles.has(i) !== action.dSpelled)) {
    const next = new Set(doubles);
    for (const i of action.fpWritten) {
      if (action.dSpelled) next.add(i);
      else next.delete(i);
    }
    doubles = next;
  }
  if (
    view === state.view &&
    flagged === state.flagged &&
    pending === state.pending &&
    doubles === state.doubles
  ) {
    return state;
  }
  return { view, flagged, pending, doubles };
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

/** The host's pane: the nearest ancestor that can scroll, short of the page,
 *  which is never ours to move. */
function hostPane(from: HTMLElement): HTMLElement | null {
  const page = document.scrollingElement;
  for (let el = from.parentElement; el; el = el.parentElement) {
    if (el === page || el === document.body) return null;
    const { overflowY } = getComputedStyle(el);
    if (overflowY === "auto" || overflowY === "scroll") return el;
  }
  return null;
}

/**
 * Scroll just far enough to show all of `rows`, or the first of them when
 * they cannot all fit: inside the list's own box, then inside the host's
 * pane when that pane is too short to show the list whole (a lesson frame on
 * a phone). Nothing moves when they are already in view. `scrollIntoView`
 * would also scroll the page.
 */
function revealRows(body: HTMLElement, rows: readonly Element[], smooth: boolean): void {
  if (rows.length === 0) return;
  const rects = rows.map((row) => row.getBoundingClientRect());
  let first = Math.min(...rects.map((r) => r.top));
  let last = Math.max(...rects.map((r) => r.bottom));
  for (const box of [body, hostPane(body)]) {
    if (!box || box.scrollHeight <= box.clientHeight) continue;
    const top = box.getBoundingClientRect().top + box.clientTop;
    const bottom = top + box.clientHeight;
    // A pixel of slack: fractional layout can leave a fully shown row a
    // hair outside the box.
    if (first >= top - 1 && last <= bottom + 1) continue;
    const delta = first < top || last - first > bottom - top ? first - top : last - bottom;
    const from = box.scrollTop;
    const target = Math.min(Math.max(from + delta, 0), box.scrollHeight - box.clientHeight);
    box.scrollTo({ top: target, behavior: smooth ? "smooth" : "auto" });
    // A smooth scroll has not moved the rows yet, so the pane works from
    // where they will land.
    first -= target - from;
    last -= target - from;
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** At most this many writes are named; the rest are counted. */
const SPOKEN_WRITES = 3;

function joinSpeech(parts: string[]): string {
  if (parts.length <= SPOKEN_WRITES) return parts.join(", ");
  const more = parts.length - SPOKEN_WRITES;
  return `${parts.slice(0, SPOKEN_WRITES).join(", ")}, and ${more} more`;
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
  running = false,
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
  const { flagged, pending, doubles } = viewState;
  const view: RegView =
    (viewState.view === "d" && !hasFp) || (viewState.view === "v" && !hasVec)
      ? "x"
      : viewState.view;

  const [xDec, setXDec] = usePersistedFlag(X_DEC_KEY);
  const [hexMode, setHexMode] = usePersistedFlag(HEX_KEY);
  const [vDec, setVDec] = usePersistedFlag(V_DEC_KEY);
  const [follow, setFollow] = usePersistedFlag(FOLLOW_KEY, true);

  const [arrangementId, setArrangementId] = usePersistedArrangement();
  const arrangement = ARRANGEMENTS[arrangementId];

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
    // Every load and reset starts the machine with a zeroed vector file and
    // no write reported. That is a new program, not an instruction, so the
    // diff starts over from it: otherwise clearing a library call's
    // leftovers reads as 32 vector writes.
    const newMachine =
      changedRegs.size === 0 &&
      changedFpRegs.size === 0 &&
      vectorRegisters.every((bits) => ZERO_VECTOR.test(bits));
    setSnapPair({
      cur: vectorRegisters,
      prev: newMachine ? vectorRegisters : snapPair.cur,
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

  // A library call leaves its pattern in every caller-saved vector register:
  // the call's doing, not a write for the view to follow.
  const followedVecRegs = useMemo(() => {
    const out = new Set<number>();
    for (const i of new Set([...changedVecRegs, ...changedFpRegs])) {
      if (!isCallLeftover(i, prevVectors[i], vectorRegisters[i])) out.add(i);
    }
    return out;
  }, [changedVecRegs, changedFpRegs, prevVectors, vectorRegisters]);

  const upperMoved = useMemo(() => {
    for (const i of changedVecRegs) {
      if (followedVecRegs.has(i) && upperHalfMoved(prevVectors[i], vectorRegisters[i])) return true;
    }
    return false;
  }, [changedVecRegs, followedVecRegs, prevVectors, vectorRegisters]);

  const spelledDest = useMemo(() => {
    if (executedLine == null || !source) return null;
    return SPELLED_DEST.exec(source.split("\n")[executedLine - 1] ?? "")?.[1] ?? null;
  }, [source, executedLine]);
  const vSpelledDest = spelledDest === "v" || spelledDest === "q";

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

  // Auto-switching follows the write: which classes moved, and the rows and
  // words that describe it, are read here; what to do about it lives in
  // reduceView. Only a new write runs it: the change sets are fresh objects
  // per snapshot, and everything else (the format flags, the follow switch,
  // the current view, which reaches the rule through the reducer's own
  // state) is read as it stands then. A click therefore survives until the
  // next write, and a format click neither re-speaks nor re-scrolls.
  const followWrite = useEffectEvent(
    (xChanged: ReadonlySet<number>, vecChanged: ReadonlySet<number>) => {
      // A d write reaches bits 63:0 and no further; anything above that, or a
      // destination the student spelled v or q, is a vector write.
      const vecClass: RegView = hasVec && (upperMoved || vSpelledDest) ? "v" : "d";
      const touched: RegView[] = [];
      if (xChanged.size > 0) touched.push("x");
      if (vecChanged.size > 0) touched.push(vecClass);
      const usable = touched.filter(
        (t) => t === "x" || (t === "d" && hasFp) || (t === "v" && hasVec),
      );
      if (follow && usable.length === 1) safeSetItem(VIEW_KEY, usable[0]);

      const xRows = [...xChanged].sort((a, b) => a - b);
      const vecRows = [...vecChanged].sort((a, b) => a - b);
      const speech: string[] = [];
      for (const i of xRows) {
        const hex = i === 31 ? sp : registers[i];
        if (hex == null) continue;
        const value =
          xDec && i !== 31 ? integerReading(parseBits(hex, 64), 64).signed : compactHex(hex);
        speech.push(`${i === 31 ? "sp" : `x${i}`} = ${value}`);
      }
      for (const i of vecRows) {
        if (vecClass === "v" && vectorRegisters[i] != null) {
          const lanes = sliceLanes(vectorRegisters[i], arrangement.width).map(
            (lane) => laneText(lane.hex, arrangement, vDec).primary,
          );
          const said = lanes.every((lane) => lane === lanes[0])
            ? `${lanes.length} lanes of ${lanes[0]}`
            : `lanes from 0: ${lanes.join(", ")}`;
          speech.push(`v${i} = ${said}`);
        } else if (fpRegisters[i] != null) {
          const bits = fpRegisters[i];
          // This write's own spelling decides; an unreported change keeps
          // the reading the register last had.
          const asDouble = changedFpRegs.has(i) ? spelledDest === "d" : doubles.has(i);
          speech.push(
            `d${i} = ${hexMode ? compactHex(bits) : fpRegisterText(bits, asDouble)}`,
          );
        }
      }

      dispatchView({
        kind: "follow",
        touched: usable,
        move: follow,
        rows: { x: xRows, d: vecRows, v: vecRows },
        speech: joinSpeech(speech),
        fpWritten: [...changedFpRegs],
        dSpelled: spelledDest === "d",
      });
    },
  );
  // A run is followed once, from the snapshot it stops on: what it streamed
  // on the way is stale by then. A stop that brought no snapshot of its own
  // finds the one from before the run already followed, and repeats nothing.
  const followedSnap = useRef<readonly [ReadonlySet<number>, ReadonlySet<number>] | null>(null);
  useEffect(() => {
    if (running) {
      dispatchView({ kind: "run" });
      return;
    }
    const last = followedSnap.current;
    if (last?.[0] === changedRegs && last[1] === followedVecRegs) return;
    followedSnap.current = [changedRegs, followedVecRegs];
    followWrite(changedRegs, followedVecRegs);
  }, [changedRegs, followedVecRegs, running]);

  const pickView = useCallback((next: RegView) => {
    dispatchView({ kind: "show", view: next });
    safeSetItem(VIEW_KEY, next);
  }, []);

  const bodyRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const userScrolledAt = useRef(-Infinity);
  const followedId = useRef(0);

  // The student's own scroll, told apart from the list's by intent (a wheel,
  // a drag, a scroll key, a press on the scrollbar) rather than by scroll
  // events: a view switch that shortens the list moves scrollTop too.
  const markUserScroll = useCallback(() => {
    userScrolledAt.current = Date.now();
  }, []);

  // Bring the write into view once the view it belongs to is on screen. A
  // run holds it until the run stops, so the list does not chase 20 writes a
  // second; the last one is followed then.
  useEffect(() => {
    if (!pending || pending.id === followedId.current || running) return;
    if (pending.view !== view) return;
    followedId.current = pending.id;
    const body = bodyRef.current;
    const grid = gridRef.current;
    if (!follow || !body || !grid) return;
    if (Date.now() - userScrolledAt.current < USER_SCROLL_HOLD_MS) return;
    // The grid's children are the rows in register order, SP at 31.
    const rows = pending.rows.map((i) => grid.children[i]).filter((row) => row != null);
    revealRows(body, rows, !prefersReducedMotion());
  }, [pending, view, running, follow]);

  // Said once per write, and not at all mid-run. A second, identical write
  // would leave the text unchanged and unspoken, so each new write flips a
  // trailing no-break space.
  const speech =
    running || !pending?.speech ? "" : `${pending.speech}${pending.id % 2 ? "\u00a0" : ""}`;

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
  // A short cell under a mouse keeps the header to two lines; a finger gets
  // the full 44px.
  const touchTall = "min-h-[22px] [@media(pointer:coarse)]:min-h-[44px]";

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
        className={`${segmentCell} ${touchTall} ${decPressed ? toggleOn : restCell}`}
      >
        dec
      </button>
      <button
        type="button"
        aria-pressed={!decPressed}
        onClick={() => onPick(false)}
        className={`${segmentCell} ${touchTall} border-l border-[var(--border)] ${
          !decPressed ? toggleOn : restCell
        }`}
      >
        hex
      </button>
    </div>
  );

  // A column appears only when a whole row fits it, measured in the row's own
  // characters so zoom widens it too: 28ch holds a name, an alias, and an
  // 18-character hex value; 30ch holds a 20-digit signed decimal.
  const gridColumns =
    view === "x" && xDec
      ? "grid-cols-[repeat(auto-fill,minmax(min(30ch,100%),1fr))]"
      : "grid-cols-[repeat(auto-fill,minmax(min(28ch,100%),1fr))]";

  return (
    <div
      // `relative` keeps the sr-only text below inside the panel's box.
      className="relative flex h-full min-h-0 flex-col"
      style={{ ...zoom.style, fontSize: `calc(0.75rem * var(--font-scale, 1))` }}
      onWheel={(e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        if (e.deltaY < 0) zoom.zoomIn();
        else zoom.zoomOut();
      }}
      // A finger anywhere on the panel may be dragging the host's pane.
      onTouchMove={markUserScroll}
    >
      {/* A container, so the first row can measure itself. Under 500px the
          kicker goes to screen readers only: beside it the lane cells wrapped
          to a third row, and at a tablet's 44px cells that left the list no
          room. The view cells name the panel anyway. */}
      <div className="shrink-0 px-2 pt-1 [container-type:inline-size]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="font-mono font-medium uppercase tracking-[0.14em] text-[10px] text-[var(--text-secondary)] [@container(max-width:500px)]:sr-only">
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
                  title={VIEW_HELP[id]}
                  onClick={() => pickView(id)}
                  className={`${segmentCell} ${touchTall} ${
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
            <div role="group" aria-label="lane arrangement" className={groupShell}>
              {ARRANGEMENT_IDS.map((id, i) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={arrangementId === id}
                  onClick={() => setArrangementId(id)}
                  className={`${segmentCell} ${touchTall} ${
                    i > 0 ? "border-l border-[var(--border)]" : ""
                  } ${arrangementId === id ? toggleOn : restCell}`}
                >
                  <span aria-hidden="true">{ARRANGEMENTS[id].label}</span>
                  <span className="sr-only">
                    {ARRANGEMENTS[id].label}, {ARRANGEMENTS[id].help}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex gap-2">
            {FLAG_NAMES.map((name, i) => {
              const bitPos = 3 - i;
              const set = (nzcv >> bitPos) & 1;
              // A set flag is machine state, so it reads in execution amber;
              // an unset flag recedes to the tertiary text token.
              const tone = set
                ? "text-[var(--amber)] font-bold"
                : "text-[var(--text-tertiary)]";
              return (
                <span key={name} className="px-1 whitespace-nowrap font-mono">
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
          <div className="ml-auto flex items-center gap-2">
            <label
              className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap font-mono text-[10px] text-[var(--text-secondary)] ${touchTall}`}
            >
              <input
                type="checkbox"
                checked={follow}
                onChange={(e) => setFollow(e.target.checked)}
                className="h-3 w-3 accent-[var(--cyan)] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
              />
              follow changes
            </label>
            <ZoomControl
              scale={zoom.scale}
              onZoomIn={zoom.zoomIn}
              onZoomOut={zoom.zoomOut}
              onReset={zoom.reset}
            />
          </div>
        </div>
      </div>

      <p id="regfile-view-help" className="sr-only">
        {VIEW_HELP[view]}
      </p>
      <p role="status" className="sr-only">
        {speech}
      </p>

      {/* The panel's own scroll box: the header above stays put, and following
          a write scrolls this first. It takes focus so the rows can be
          scrolled from the keyboard. It never shrinks under three rows (19px
          each at 12px, plus its bottom padding): a lesson frame on a phone
          gives the whole panel less height than the header, and the list
          shrank to nothing; the frame's own pane scrolls instead. */}
      <div
        ref={bodyRef}
        role="region"
        aria-label="register values"
        tabIndex={0}
        className="min-h-[calc(4.75em+0.5rem)] flex-1 overflow-y-auto overscroll-contain px-2 pb-2 [scrollbar-gutter:stable] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
        onWheel={(e) => {
          if (!e.ctrlKey) markUserScroll();
        }}
        onPointerDown={(e) => {
          // A press on the box itself is its scrollbar; a middle press
          // anywhere starts autoscroll.
          if (e.target === e.currentTarget || e.button === 1) markUserScroll();
        }}
        onKeyDown={(e) => {
          if (
            e.target === e.currentTarget &&
            ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)
          ) {
            markUserScroll();
          }
        }}
      >
        <div
          ref={gridRef}
          className={
            view === "v"
              ? "grid grid-cols-1 font-mono"
              : `grid ${gridColumns} gap-x-3 font-mono`
          }
        >
          {view === "v" ? (
            vectorRegisters.map((bits, i) => (
              <VRegisterRow
                key={`v${i}-${vecPulses.get(i) ?? 0}`}
                index={i}
                bitsHex={bits}
                prevBitsHex={prevVectors[i]}
                arrangement={arrangement}
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
                asDouble={doubles.has(i)}
                changed={changedFpRegs.has(i)}
              />
            ))
          ) : (
            <>
              {registers.map((val, i) => {
                const dec = xDec ? integerReading(parseBits(val, 64), 64) : null;
                return (
                  <RegisterRow
                    key={`x${i}-${pulses.get(i) ?? 0}`}
                    name={`X${i}`}
                    value={dec ? dec.signed : val}
                    secondary={dec?.unsigned ? `${dec.unsigned}u` : undefined}
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
    </div>
  );
}
