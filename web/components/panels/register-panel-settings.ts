"use client";

import { useCallback, useEffect, useReducer } from "react";
import type { RegView } from "@/lib/emulator/emulator-state";
import type { LaneArrangement } from "@/lib/emulator/register-format";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

export const VIEW_KEY = "aarch64-playground:regfile-view";
/** The d-view's format flag keeps the key it shipped with, so a returning
 *  student's choice survives the split into one flag per view. */
export const HEX_KEY = "aarch64-playground:regfile-fp-hex";
export const X_DEC_KEY = "aarch64-playground:regfile-x-dec";
export const V_DEC_KEY = "aarch64-playground:regfile-v-dec";
const LANE_KEY = "aarch64-playground:regfile-lane-width";
export const FOLLOW_KEY = "aarch64-playground:regfile-follow";

/** The lane arrangements the v view reads a register in: the four integer
 *  widths by their ISA letter, then the two float ones by their C names. The
 *  ids are what storage holds, so a width stored before the float ones
 *  existed still parses. Cells, not a popover: a listbox opened in the short
 *  register pane was clipped by it. */
export const ARRANGEMENTS = {
  b: { width: "b", float: false, label: "b", help: "8-bit lanes" },
  h: { width: "h", float: false, label: "h", help: "16-bit lanes" },
  s: { width: "s", float: false, label: "s", help: "32-bit lanes" },
  d: { width: "d", float: false, label: "d", help: "64-bit lanes" },
  sf: { width: "s", float: true, label: "float", help: "32-bit float lanes" },
  df: { width: "d", float: true, label: "double", help: "64-bit float lanes" },
} as const satisfies Record<string, LaneArrangement & { label: string; help: string }>;

type ArrangementId = keyof typeof ARRANGEMENTS;

export const ARRANGEMENT_IDS = Object.keys(ARRANGEMENTS) as ArrangementId[];

function isArrangementId(raw: string | null): raw is ArrangementId {
  return raw != null && Object.hasOwn(ARRANGEMENTS, raw);
}

/** Persisted boolean flag, SSR-safe (reads localStorage after mount). A
 *  reducer, like the lane arrangement below, so the stored value can arrive
 *  from an effect. */
export function usePersistedFlag(
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
export function parseView(raw: string | null): RegView | null {
  const stored = raw === "1" ? "d" : raw === "0" ? "x" : raw;
  return stored === "x" || stored === "d" || stored === "v" ? stored : null;
}

/** The lane arrangement, persisted like the format flags. 64-bit integer
 *  lanes by default: two halves is the reading closest to the d-view the
 *  student came from. The state is a reducer so the stored value can arrive
 *  from an effect, the same reason RegisterPanel's pulse ids are one. */
export function usePersistedArrangement(): [ArrangementId, (next: ArrangementId) => void] {
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
