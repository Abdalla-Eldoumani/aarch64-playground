"use client";

import { laneText, type LaneArrangement } from "@/lib/emulator/register-format";
import { LANE_BYTES, sliceLanes } from "@/lib/emulator/vector-lanes";

/**
 * One 128-bit vector register row: the label, then the same bits re-sliced
 * into lanes of the chosen arrangement. Lanes render most significant first,
 * so the hex cells read left to right exactly as the register's own hex
 * string does.
 *
 * The label is `v0 (q0)` because the two names are one register: a student who
 * typed `ldr q0` has to find it here. Hex mode shows each lane's hex alone;
 * decimal shows a signed integer (with the unsigned value beneath a negative
 * one) or, in a float arrangement, the float. The row states which in its
 * accessible text, since 0xff and -1 are the same byte.
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
  arrangement: LaneArrangement;
  /** Show each lane's decimal reading instead of its hex. */
  decMode?: boolean;
  changed?: boolean;
}

function readingNote(count: number, bits: number, float: boolean, decMode: boolean): string {
  if (!decMode) return `${count} lanes of ${bits} bits, in hex`;
  if (float) return `${count} lanes of ${bits}-bit floats`;
  return `${count} lanes of ${bits} bits, signed, with the unsigned value under a negative lane`;
}

export function VRegisterRow({
  index,
  bitsHex,
  prevBitsHex,
  arrangement,
  decMode = false,
  changed = false,
}: VRegisterRowProps) {
  const lanes = sliceLanes(bitsHex, arrangement.width);
  const previous =
    prevBitsHex != null && prevBitsHex !== bitsHex
      ? sliceLanes(prevBitsHex, arrangement.width)
      : null;
  const laneBits = LANE_BYTES[arrangement.width] * 8;

  // `relative` holds the screen-reader-only span below inside this row.
  // That span is absolutely positioned, and without a positioned ancestor
  // it escapes the panel's scroll box and lands on the document: thirty-two
  // rows of them put a page scrollbar under the v-view that scrolled onto
  // nothing.
  return (
    <div
      className={`relative flex flex-wrap items-center gap-x-[0.5ch] rounded-[var(--radius-control)] px-1.5 py-0.5 font-mono leading-[1.25] ${
        changed ? "anim-reg-flash [box-shadow:inset_2px_0_0_0_var(--amber)]" : ""
      }`}
    >
      {/* nowrap: "v10 (q10)" is exactly 9ch, and Chromium broke it at the
          space, doubling the height of 22 rows. */}
      <span className="w-[9ch] shrink-0 whitespace-nowrap text-[var(--text-secondary)]">
        v{index} (q{index})
      </span>
      <span className="sr-only">
        {readingNote(lanes.length, laneBits, arrangement.float, decMode)}
      </span>
      {/* The lane strip scrolls inside the row: 16 byte lanes are wider than a
          375px document, and nothing in the panel may widen the page. */}
      <div className="ml-auto flex min-w-0 gap-x-[1ch] overflow-x-auto">
        {[...lanes].reverse().map((lane) => {
          const laneChanged =
            previous != null && previous[lane.index].hex !== lane.hex;
          const text = laneText(lane.hex, arrangement, decMode);
          return (
            <span
              key={lane.index}
              title={`lane ${lane.index}`}
              className={`flex shrink-0 flex-col items-end px-[0.5ch] ${
                laneChanged ? "[box-shadow:inset_2px_0_0_0_var(--amber)]" : ""
              }`}
            >
              <span
                className={`tabular-nums ${
                  laneChanged ? "text-[var(--changed)]" : "text-[var(--text-primary)]"
                }`}
              >
                {text.primary}
              </span>
              {text.secondary ? (
                <span className="text-[0.8334em] tabular-nums text-[var(--text-tertiary)]">
                  {text.secondary}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
