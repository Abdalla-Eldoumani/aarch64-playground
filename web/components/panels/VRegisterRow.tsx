"use client";

import { LANE_BYTES, sliceLanes, type LaneWidth } from "@/lib/emulator/vector-lanes";

/**
 * One 128-bit vector register row: the label, then the same bits re-sliced
 * into lanes of the chosen width. Lanes render most significant first, so the
 * hex cells read left to right exactly as the register's own hex string does.
 *
 * The label is `v0 (q0)` because the two names are one register: a student who
 * typed `ldr q0` has to find it here. Lane hex is unsigned and the decimal
 * beneath it is signed at the lane's own width; the row states that pairing in
 * its accessible text, since 0xff and -1 are the same byte.
 *
 * A lane whose bits moved since the previous snapshot carries the amber write
 * bar and the `--changed` ink. The motion stays at the row level (one
 * `anim-reg-flash` layer per row, as everywhere else in the panel): a strike
 * per lane would put 32 rows x up to 16 layers on the compositor every step.
 */
export interface VRegisterRowProps {
  /** Register index 0-31 (v0-v31, the same bits as q0-q31). */
  index: number;
  /** The register's 128 bits as "0x" + 32 hex digits. */
  bitsHex: string;
  /** The same register one snapshot ago; lanes that differ are marked. */
  prevBitsHex?: string;
  width: LaneWidth;
  /** Show each lane's signed decimal as the primary reading instead of hex. */
  decMode?: boolean;
  changed?: boolean;
}

export function VRegisterRow({
  index,
  bitsHex,
  prevBitsHex,
  width,
  decMode = false,
  changed = false,
}: VRegisterRowProps) {
  const lanes = sliceLanes(bitsHex, width);
  const previous =
    prevBitsHex != null && prevBitsHex !== bitsHex
      ? sliceLanes(prevBitsHex, width)
      : null;
  const laneBits = LANE_BYTES[width] * 8;

  // `relative` holds the screen-reader-only span below inside this row.
  // That span is absolutely positioned, and without a positioned ancestor
  // it escapes the panel's scroll box and lands on the document: thirty-two
  // rows of them put a page scrollbar under the v-view that scrolled onto
  // nothing.
  return (
    <div
      className={`relative flex flex-wrap items-center gap-x-2 rounded-[var(--radius-control)] px-2 py-1 ${
        changed ? "anim-reg-flash [box-shadow:inset_2px_0_0_0_var(--amber)]" : ""
      }`}
    >
      <span className="w-[4.75rem] shrink-0 font-mono text-[13px] text-[var(--text-secondary)]">
        v{index} (q{index})
      </span>
      <span className="sr-only">
        {lanes.length} lanes of {laneBits} bits; hex is unsigned, decimal is signed
      </span>
      {/* The lane strip scrolls inside the row: 16 byte lanes are wider than a
          375px document, and nothing in the panel may widen the page. */}
      <div className="ml-auto flex min-w-0 gap-x-1 overflow-x-auto">
        {[...lanes].reverse().map((lane) => {
          const laneChanged =
            previous != null && previous[lane.index].hex !== lane.hex;
          return (
            <span
              key={lane.index}
              title={`lane ${lane.index}`}
              className={`flex shrink-0 flex-col items-end px-1 ${
                laneChanged ? "[box-shadow:inset_2px_0_0_0_var(--amber)]" : ""
              }`}
            >
              <span
                className={`font-mono text-[13px] tabular-nums ${
                  laneChanged ? "text-[var(--changed)]" : "text-[var(--text-primary)]"
                }`}
              >
                {decMode ? lane.signed : lane.hex}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                {decMode ? lane.hex : lane.signed}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
