/**
 * The NZCV arithmetic behind the reference's flag panels: the flags each
 * integer flag-setter and `fcmp` leave, plus the operand parsers those panels
 * read their inputs with. The rules are the ones the emulator's executor
 * applies, restated here by hand so a teaching panel can show a compare's
 * effect without a round trip through the machine.
 */

export interface Flags {
  n: boolean;
  z: boolean;
  c: boolean;
  v: boolean;
}

/** The integer operation under a flag-setter: subs/cmp, adds/cmn, ands/tst. */
export type IntOp = "sub" | "add" | "and";

/**
 * NZCV for the integer flag-setters at a register width, the same rules the
 * executor applies: N = sign bit of the result, Z = zero, C = no-borrow for
 * subtraction / carry-out for addition / cleared by the logical ops, V =
 * signed overflow (operand signs agree for add, differ for sub, and the
 * result sign disagrees with the first operand).
 */
export function computeIntFlags(
  op: IntOp,
  aIn: bigint,
  bIn: bigint,
  bits: 32 | 64,
): { result: bigint; flags: Flags } {
  const width = BigInt(bits);
  const mask = (1n << width) - 1n;
  const signBit = 1n << (width - 1n);
  const a = aIn & mask;
  const b = bIn & mask;
  let result: bigint;
  let c = false;
  let v = false;
  const signOf = (value: bigint) => (value & signBit) !== 0n;
  if (op === "sub") {
    result = (a - b) & mask;
    c = a >= b;
    v = signOf(a) !== signOf(b) && signOf(result) !== signOf(a);
  } else if (op === "add") {
    const wide = a + b;
    result = wide & mask;
    c = wide > mask;
    v = signOf(a) === signOf(b) && signOf(result) !== signOf(a);
  } else {
    result = a & b;
  }
  return {
    result,
    flags: { n: signOf(result), z: result === 0n, c, v },
  };
}

/**
 * NZCV for `fcmp`: less-than sets N, equal sets Z and C, greater-than sets C,
 * and an unordered compare (either side NaN) sets C and V.
 */
export function computeFcmpFlags(a: number, b: number): Flags {
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return { n: false, z: false, c: true, v: true };
  }
  if (a < b) return { n: true, z: false, c: false, v: false };
  if (a === b) return { n: false, z: true, c: true, v: false };
  return { n: false, z: false, c: true, v: false };
}

/** Decimal or 0x hex, optionally negative; null when it is neither. */
export function parseIntOperand(text: string): bigint | null {
  const t = text.trim().toLowerCase();
  if (!/^-?(0x[0-9a-f]+|\d+)$/.test(t)) return null;
  // BigInt() rejects a signed hex literal ("-0x10"), so peel the sign first.
  const negative = t.startsWith("-");
  const magnitude = BigInt(negative ? t.slice(1) : t);
  return negative ? -magnitude : magnitude;
}

/** A plain float, or `nan` to see the unordered compare; null otherwise. */
export function parseFloatOperand(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (t === "nan") return Number.NaN;
  if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/.test(t)) return null;
  return Number(t);
}
