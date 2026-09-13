/**
 * Slicing a 128-bit vector register into lanes, the pure half of the v-view.
 *
 * A v register arrives from the wasm as `0x` + 32 hex digits, most significant
 * digit first. AArch64 numbers lanes from the LEAST significant end, so lane 0
 * is the low bytes, the tail of the string, and the lane count follows the
 * width: 16 b, 8 h, 4 s, 2 d. Re-slicing never changes the bits, only how many
 * groups they are read in.
 *
 * Each lane reports its bits as UNSIGNED hex and its value as a SIGNED decimal
 * (two's complement at the lane's own width): the row states that pairing in
 * its accessible text, because "0xff" and "-1" are the same byte.
 */

export type LaneWidth = "b" | "h" | "s" | "d";

export const LANE_WIDTHS: readonly LaneWidth[] = ["b", "h", "s", "d"];

/** Bytes per lane, which is also what the width letter means in the ISA. */
export const LANE_BYTES: Record<LaneWidth, number> = { b: 1, h: 2, s: 4, d: 8 };

export interface VectorLane {
  /** Lane number, 0 at the least significant end. */
  index: number;
  /** The lane's bits, unsigned, unprefixed, zero-padded to the lane width. */
  hex: string;
  /** The same bits read as a two's-complement signed integer. */
  signed: string;
}

/** Bytes in a v register; a q register is the same 128 bits under another name. */
const VECTOR_BYTES = 16;
const VECTOR_DIGITS = VECTOR_BYTES * 2;

/**
 * The register's 32 hex digits, whatever shape the value arrived in: the `0x`
 * comes off, a short value is left-padded, and anything unreadable (an older
 * wasm answering with junk rather than nothing) reads as zero rather than
 * throwing inside a render.
 */
function digitsOf(bitsHex: string): string {
  const raw = bitsHex.trim().replace(/^0[xX]/, "");
  if (!/^[0-9a-fA-F]{1,32}$/.test(raw)) return "0".repeat(VECTOR_DIGITS);
  return raw.toLowerCase().padStart(VECTOR_DIGITS, "0");
}

export function laneCount(width: LaneWidth): number {
  return VECTOR_BYTES / LANE_BYTES[width];
}

/** The lanes of one register, lane 0 first (least significant). */
export function sliceLanes(bitsHex: string, width: LaneWidth): VectorLane[] {
  const digits = digitsOf(bitsHex);
  const per = LANE_BYTES[width] * 2;
  const bits = BigInt(LANE_BYTES[width] * 8);
  const span = 1n << bits;
  const half = 1n << (bits - 1n);
  const lanes: VectorLane[] = [];
  for (let index = 0; index < laneCount(width); index++) {
    const end = VECTOR_DIGITS - index * per;
    const hex = digits.slice(end - per, end);
    const unsigned = BigInt(`0x${hex}`);
    lanes.push({
      index,
      hex,
      signed: String(unsigned >= half ? unsigned - span : unsigned),
    });
  }
  return lanes;
}

/** True when the upper 64 bits differ, which is what makes a write a v write
 *  rather than a d write: d only ever reaches bits 63:0. */
export function upperHalfMoved(prevHex: string, nextHex: string): boolean {
  return digitsOf(prevHex).slice(0, 16) !== digitsOf(nextHex).slice(0, 16);
}
