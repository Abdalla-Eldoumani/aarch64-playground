/**
 * Hex text for machine values, kept in one place so a field never prints
 * padded in one panel and bare in another; parse-address.ts reads it back.
 */

const MASK_64 = 0xffff_ffff_ffff_ffffn;

/**
 * `0x` + 16 nibbles. A negative value reads as its unsigned 64-bit pattern,
 * the way the machine holds it.
 */
export function formatWord64(value: number | bigint): string {
  return "0x" + (BigInt(value) & MASK_64).toString(16).padStart(16, "0");
}

/**
 * `0x` + at least 8 nibbles. A negative (a word built with `|` from four
 * bytes) reads as its unsigned pattern; a wider value keeps its extra digits,
 * since showing a typed 0x100000000 as 0x00000000 points at the wrong place.
 */
export function formatWord32(value: number): string {
  const bits = value < 0 ? value >>> 0 : value;
  return "0x" + bits.toString(16).padStart(8, "0");
}

/** Two nibbles, no prefix: hex dumps print bytes in runs, not one by one. */
export function formatByte(value: number): string {
  return (value & 0xff).toString(16).padStart(2, "0");
}
