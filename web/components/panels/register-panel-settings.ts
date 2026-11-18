"use client";

import type { RegView } from "@/lib/emulator/emulator-state";
import type { LaneArrangement } from "@/lib/emulator/register-format";
import { useStoredSetting } from "@/lib/hooks/use-stored-setting";

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

/** "1" / "0" are the two-view flag this control replaced: a returning student
 *  who left the panel on the d-file lands back on it. */
export function parseView(raw: string | null): RegView | null {
  const stored = raw === "1" ? "d" : raw === "0" ? "x" : raw;
  return stored === "x" || stored === "d" || stored === "v" ? stored : null;
}

/** The lane arrangement, read from storage on mount; a pick moves this panel
 *  alone. 64-bit integer lanes by default: two halves is the reading closest
 *  to the d-view the student came from. */
export function usePersistedArrangement(): [ArrangementId, (next: ArrangementId) => void] {
  return useStoredSetting(LANE_KEY, (raw) => (isArrangementId(raw) ? raw : "d"), false);
}
