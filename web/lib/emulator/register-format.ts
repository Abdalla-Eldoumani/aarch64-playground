/**
 * The text a register view prints for a register's bits, in one place so the
 * x, d, and v views follow the same rules:
 *
 * - hex mode prints hex and nothing else;
 * - an integer in decimal prints its signed value, plus the unsigned value
 *   only when the two differ (a negative), so most rows stay one line;
 * - a float prints the shortest decimal that reads back to the same bits.
 *
 * Every reader takes the panel's `0x...` text and degrades to zero on junk
 * rather than throwing inside a render.
 */

import { formatSigned, truncate, type Width } from "@/lib/asm/base-convert";
import { formatFloatValue, type FloatWidth } from "@/lib/asm/ieee754";
import { LANE_BYTES, type LaneWidth } from "@/lib/emulator/vector-lanes";

/** The bits behind `0x...` text, cut to `width`; zero when unreadable. */
export function parseBits(hex: string, width: Width): bigint {
  const digits = hex.trim().replace(/^0[xX]/, "");
  if (!/^[0-9a-fA-F]{1,32}$/.test(digits)) return 0n;
  return truncate(BigInt(`0x${digits}`), width);
}

export interface IntegerReading {
  signed: string;
  /** Null when it would repeat the signed value. */
  unsigned: string | null;
}

/** A register or lane read as a two's-complement integer of `width` bits. */
export function integerReading(bits: bigint, width: Width): IntegerReading {
  const pattern = truncate(bits, width);
  const signed = formatSigned(pattern, width);
  const unsigned = pattern.toString(10);
  return { signed, unsigned: signed === unsigned ? null : unsigned };
}

/**
 * A float's decimal. A whole number keeps a `.0` so it still reads as a
 * float, the way the course's printf output does; `-0.0` keeps its sign.
 * Past 15 digits a whole number switches to exponent form: its trailing
 * zeros are rounding, not data, and twenty of them do not fit a lane.
 */
export function floatText(bits: bigint, width: FloatWidth): string {
  const text = formatFloatValue(bits, width);
  if (!/^-?\d+$/.test(text)) return text;
  return text.replace("-", "").length > 15 ? Number(text).toExponential() : `${text}.0`;
}

/**
 * The d view's decimal. An `s` write zeroes bits 63:32, so a pattern that
 * lives only in the low 32 bits is read as the single-precision float the
 * program put there, a finite one suffixed `f` the way C writes it; read as
 * a double, those bits would be a meaningless subnormal near 1e-314. When
 * the caller knows the register was written as a d, `asDouble` keeps the
 * double reading, subnormal or not.
 */
export function fpRegisterText(hex: string, asDouble = false): string {
  const bits = parseBits(hex, 64);
  if (asDouble || bits === 0n || bits > 0xffff_ffffn) return floatText(bits, 64);
  const single = floatText(bits, 32);
  return /\d$/.test(single) ? `${single}f` : single;
}

/** The ways the v view reads a lane in decimal. Floats come in 32 and 64 bits
 *  only: half precision is an extension the emulator does not implement. */
export interface LaneArrangement {
  width: LaneWidth;
  float: boolean;
}

export interface LaneText {
  primary: string;
  /** The unsigned value under a negative integer lane; null otherwise. */
  secondary: string | null;
}

/** One lane, from its unprefixed hex digits (as sliceLanes cuts them). */
export function laneText(
  laneHex: string,
  arrangement: LaneArrangement,
  decimal: boolean,
): LaneText {
  if (!decimal) return { primary: laneHex, secondary: null };
  const width = (LANE_BYTES[arrangement.width] * 8) as Width;
  const bits = parseBits(laneHex, width);
  if (arrangement.float && (width === 32 || width === 64)) {
    return { primary: floatText(bits, width), secondary: null };
  }
  const { signed, unsigned } = integerReading(bits, width);
  return { primary: signed, secondary: unsigned };
}

/** Hex with the leading zeros dropped, for speech: "0x2f", not sixteen
 *  zeros read aloud one at a time. */
export function compactHex(hex: string): string {
  return `0x${parseBits(hex, 64).toString(16)}`;
}
