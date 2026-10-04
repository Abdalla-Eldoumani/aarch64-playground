// One hex format per kind of value, so no field prints padded in one panel
// and bare in another; parse-address.ts reads these back.

const MASK_64 = 0xffff_ffff_ffff_ffffn;

/** `0x` and 16 digits; a negative shows its unsigned 64-bit pattern. */
export function formatWord64(value: number | bigint): string {
  return "0x" + (BigInt(value) & MASK_64).toString(16).padStart(16, "0");
}

/**
 * `0x` and at least 8 digits. A negative (`|` makes a signed word) shows its
 * unsigned pattern, and a wider value keeps its extra digits.
 */
export function formatWord32(value: number): string {
  const bits = value < 0 ? value >>> 0 : value;
  return "0x" + bits.toString(16).padStart(8, "0");
}

/** Two digits, no prefix: hex dumps print bytes in runs. */
export function formatByte(value: number): string {
  return (value & 0xff).toString(16).padStart(2, "0");
}
