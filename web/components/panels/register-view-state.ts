import type { RegView } from "@/lib/emulator/emulator-state";

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
 * rule inside an effect moves state here (RegisterPanel's pulse ids do the same).
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
export const INITIAL_VIEW: ViewState = {
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

export function reduceView(state: ViewState, action: ViewAction): ViewState {
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
