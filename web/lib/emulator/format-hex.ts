/**
 * Machine values as the hex text the panels and the terminal print --
 * parse-address.ts read backwards.
 *
 * Three shapes cover every readout: a 64-bit word (registers, sp/fp, a
 * stack slot, the pc in a diagnostic), a 32-bit word (an address column,
 * an instruction encoding), and a single byte (hex dumps). Restating the
 * `toString(16).padStart(...)` pair per call site is how the same field
 * ended up padded in one panel and bare in another.
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
 * `0x` + at least 8 nibbles. A negative reads as its unsigned 32-bit pattern
 * (a word assembled with `|` from four bytes is a signed int32). A value too
 * wide for 32 bits keeps its extra digits instead of truncating: the memory
 * panel's address box is unbounded, and showing a typed 0x100000000 as
 * 0x00000000 would point the reader at the wrong place.
 */
export function formatWord32(value: number): string {
  const bits = value < 0 ? value >>> 0 : value;
  return "0x" + bits.toString(16).padStart(8, "0");
}

/** Two nibbles, no prefix -- hex dumps print bytes in runs, not one by one. */
export function formatByte(value: number): string {
  return (value & 0xff).toString(16).padStart(2, "0");
}
