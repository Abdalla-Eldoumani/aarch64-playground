/**
 * Pure number-base conversions for the base converter widget. The canonical
 * value is always the raw bit pattern, held as an unsigned BigInt in
 * [0, 2^width): two's complement is a reading of that pattern, not a second
 * value, and it only means anything at a declared width, which is why every
 * function here takes one. BigInt throughout because 64-bit patterns exceed
 * Number's safe range.
 */

export type Width = 8 | 16 | 32 | 64;

export const WIDTHS: readonly Width[] = [8, 16, 32, 64];

/** The four representations the widget keeps in sync. */
export type Rep = "hex" | "binary" | "unsigned" | "signed";

export function maxUnsigned(width: Width): bigint {
  return (1n << BigInt(width)) - 1n;
}

export function minSigned(width: Width): bigint {
  return -(1n << BigInt(width - 1));
}

export function maxSigned(width: Width): bigint {
  return (1n << BigInt(width - 1)) - 1n;
}

/** The signed (two's complement) reading of a bit pattern. */
export function toSigned(bits: bigint, width: Width): bigint {
  return bits >= 1n << BigInt(width - 1) ? bits - (1n << BigInt(width)) : bits;
}

/** The bit pattern of an in-range signed value. */
export function fromSigned(value: bigint, width: Width): bigint {
  return value < 0n ? value + (1n << BigInt(width)) : value;
}

export function signBit(bits: bigint, width: Width): 0 | 1 {
  return bits >= 1n << BigInt(width - 1) ? 1 : 0;
}

/** Flip one bit; index 0 is the least significant. */
export function flipBit(bits: bigint, index: number, width: Width): bigint {
  if (index < 0 || index >= width) return bits;
  return bits ^ (1n << BigInt(index));
}

/** Read one bit; index 0 is the least significant. */
export function bitAt(bits: bigint, index: number): 0 | 1 {
  return (bits >> BigInt(index)) & 1n ? 1 : 0;
}

export function fitsUnsigned(bits: bigint, width: Width): boolean {
  return bits >= 0n && bits <= maxUnsigned(width);
}

/** Keep the low `width` bits, the same thing a narrower store does. */
export function truncate(bits: bigint, width: Width): bigint {
  return bits & maxUnsigned(width);
}

export function formatHex(bits: bigint, width: Width): string {
  return bits.toString(16).padStart(width / 4, "0");
}

/** Zero-padded to the width and grouped in nibbles, matching the bit grid. */
export function formatBinary(bits: bigint, width: Width): string {
  const digits = bits.toString(2).padStart(width, "0");
  const groups: string[] = [];
  for (let i = 0; i < width; i += 4) groups.push(digits.slice(i, i + 4));
  return groups.join(" ");
}

export function formatUnsigned(bits: bigint): string {
  return bits.toString(10);
}

export function formatSigned(bits: bigint, width: Width): string {
  return toSigned(bits, width).toString(10);
}

export type ParseOutcome =
  | { kind: "ok"; bits: bigint }
  | { kind: "empty" }
  | { kind: "invalid"; message: string }
  | { kind: "range"; message: string };

function bitsNeeded(value: bigint): number {
  return value === 0n ? 1 : value.toString(2).length;
}

/**
 * Parse user text in one representation into the canonical bit pattern.
 * Never throws: bad input comes back as a message the widget shows inline.
 * Re-parsing any format* output round-trips exactly.
 */
export function parseRep(rep: Rep, text: string, width: Width): ParseOutcome {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { kind: "empty" };

  switch (rep) {
    case "hex": {
      const digits = trimmed.replace(/^0[xX]/, "");
      if (digits.length === 0) return { kind: "empty" };
      if (!/^[0-9a-fA-F]+$/.test(digits)) {
        return { kind: "invalid", message: "hex digits are 0-9 and a-f" };
      }
      const bits = BigInt("0x" + digits);
      if (!fitsUnsigned(bits, width)) {
        return {
          kind: "range",
          message: `0x${bits.toString(16)} needs ${bitsNeeded(bits)} bits; ${width}-bit hex maxes at 0x${"f".repeat(width / 4)}`,
        };
      }
      return { kind: "ok", bits };
    }
    case "binary": {
      // Spaces are how formatBinary groups nibbles, so typing them back is fine.
      const digits = trimmed.replace(/^0[bB]/, "").replace(/ /g, "");
      if (digits.length === 0) return { kind: "empty" };
      if (!/^[01]+$/.test(digits)) {
        return { kind: "invalid", message: "binary digits are 0 and 1" };
      }
      const bits = BigInt("0b" + digits);
      if (!fitsUnsigned(bits, width)) {
        return {
          kind: "range",
          message: `that needs ${bitsNeeded(bits)} bits; width is ${width}`,
        };
      }
      return { kind: "ok", bits };
    }
    case "unsigned": {
      if (trimmed.startsWith("-")) {
        return { kind: "invalid", message: "negative belongs in the signed reading" };
      }
      if (!/^[0-9]+$/.test(trimmed)) {
        return { kind: "invalid", message: "decimal digits only" };
      }
      const bits = BigInt(trimmed);
      if (!fitsUnsigned(bits, width)) {
        return {
          kind: "range",
          message: `unsigned ${width}-bit maxes at ${maxUnsigned(width)}`,
        };
      }
      return { kind: "ok", bits };
    }
    case "signed": {
      if (!/^-?[0-9]+$/.test(trimmed)) {
        return {
          kind: "invalid",
          message: "decimal digits only, with an optional leading -",
        };
      }
      const value = BigInt(trimmed);
      if (value < minSigned(width) || value > maxSigned(width)) {
        return {
          kind: "range",
          message: `signed ${width}-bit runs ${minSigned(width)} to ${maxSigned(width)}`,
        };
      }
      return { kind: "ok", bits: fromSigned(value, width) };
    }
  }
}

/** Format the canonical pattern in one representation (widget field text). */
export function formatRep(rep: Rep, bits: bigint, width: Width): string {
  switch (rep) {
    case "hex":
      return formatHex(bits, width);
    case "binary":
      return formatBinary(bits, width);
    case "unsigned":
      return formatUnsigned(bits);
    case "signed":
      return formatSigned(bits, width);
  }
}
