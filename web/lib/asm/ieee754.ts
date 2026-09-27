/**
 * The IEEE-754 reading of a 32-bit (single) or 64-bit (double) bit pattern:
 * its sign, exponent, and fraction fields, its class, and its value. The
 * pattern stays the one source of truth, the same unsigned BigInt that
 * base-convert holds. DataView turns it into a JS number only for display,
 * and every decimal-to-bits step rounds with exact BigInt fractions: going
 * through a JS double first rounds twice and can land one bit off at 32 bits.
 */

import type { ParseOutcome, Width } from "@/lib/asm/base-convert";

export type FloatWidth = 32 | 64;

export function isFloatWidth(width: Width): width is FloatWidth {
  return width === 32 || width === 64;
}

interface FloatLayout {
  exponentBits: number;
  fractionBits: number;
  bias: number;
}

export const FLOAT_LAYOUT: Record<FloatWidth, FloatLayout> = {
  32: { exponentBits: 8, fractionBits: 23, bias: 127 },
  64: { exponentBits: 11, fractionBits: 52, bias: 1023 },
};

export type FloatClass =
  | "zero"
  | "subnormal"
  | "normal"
  | "infinity"
  | "quiet NaN"
  | "signalling NaN";

export interface FloatFields {
  sign: 0 | 1;
  /** The stored (biased) exponent. */
  exponent: number;
  fraction: bigint;
}

/** The all-ones exponent that marks infinity and NaN. */
function topExponent(width: FloatWidth): number {
  return (1 << FLOAT_LAYOUT[width].exponentBits) - 1;
}

export function splitFloat(bits: bigint, width: FloatWidth): FloatFields {
  const { exponentBits, fractionBits } = FLOAT_LAYOUT[width];
  return {
    sign: (bits >> BigInt(width - 1)) & 1n ? 1 : 0,
    exponent: Number((bits >> BigInt(fractionBits)) & BigInt((1 << exponentBits) - 1)),
    fraction: bits & ((1n << BigInt(fractionBits)) - 1n),
  };
}

export function joinFloat(fields: FloatFields, width: FloatWidth): bigint {
  const { fractionBits } = FLOAT_LAYOUT[width];
  return (
    (BigInt(fields.sign) << BigInt(width - 1)) |
    (BigInt(fields.exponent) << BigInt(fractionBits)) |
    fields.fraction
  );
}

export function classify(bits: bigint, width: FloatWidth): FloatClass {
  const { exponent, fraction } = splitFloat(bits, width);
  if (exponent === 0) return fraction === 0n ? "zero" : "subnormal";
  if (exponent < topExponent(width)) return "normal";
  if (fraction === 0n) return "infinity";
  const quietBit = 1n << BigInt(FLOAT_LAYOUT[width].fractionBits - 1);
  return fraction & quietBit ? "quiet NaN" : "signalling NaN";
}

function isNaNClass(kind: FloatClass): boolean {
  return kind === "quiet NaN" || kind === "signalling NaN";
}

/** The pattern read as a JS number: the hardware decodes it, nothing is computed. */
export function floatValue(bits: bigint, width: FloatWidth): number {
  const view = new DataView(new ArrayBuffer(8));
  if (width === 32) {
    view.setUint32(0, Number(bits));
    return view.getFloat32(0);
  }
  view.setBigUint64(0, bits);
  return view.getFloat64(0);
}

/** The exact decimal of m * 2^q: 2^-k is 5^k / 10^k, so nothing rounds. */
function exactDecimal(m: bigint, q: number): string {
  if (q >= 0) return (m << BigInt(q)).toString();
  const places = -q;
  const digits = (m * 5n ** BigInt(places)).toString().padStart(places + 1, "0");
  const whole = digits.slice(0, -places);
  const fraction = digits.slice(-places).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

/**
 * A finite value as significand x 2^power, both exact: 1.fraction for a
 * normal, 0.fraction at the lowest power for a subnormal. Null for zero,
 * infinity, and NaN, which have no such form worth showing.
 */
export function powerOfTwoForm(
  bits: bigint,
  width: FloatWidth,
): { significand: string; power: number } | null {
  const kind = classify(bits, width);
  if (kind !== "normal" && kind !== "subnormal") return null;
  const { fractionBits, bias } = FLOAT_LAYOUT[width];
  const { sign, exponent, fraction } = splitFloat(bits, width);
  const normal = kind === "normal";
  const m = normal ? fraction | (1n << BigInt(fractionBits)) : fraction;
  return {
    significand: (sign ? "-" : "+") + exactDecimal(m, -fractionBits),
    power: normal ? exponent - bias : 1 - bias,
  };
}

/** Every digit of the stored value, however many that takes. */
export function exactValue(bits: bigint, width: FloatWidth): string {
  const kind = classify(bits, width);
  if (kind === "infinity" || isNaNClass(kind)) return formatFloatValue(bits, width);
  const { fractionBits, bias } = FLOAT_LAYOUT[width];
  const { sign, exponent, fraction } = splitFloat(bits, width);
  const m = exponent === 0 ? fraction : fraction | (1n << BigInt(fractionBits));
  const q = Math.max(exponent, 1) - bias - fractionBits;
  return (sign ? "-" : "") + exactDecimal(m, q);
}

/**
 * The shortest decimal that reads back to exactly these bits, the way JS,
 * Python, and Java print floats. A 64-bit pattern is a JS number, so its
 * own toString is already shortest; a 32-bit one tries 1 to 9 significant
 * digits and keeps the first that parses back to the same pattern.
 */
export function formatFloatValue(bits: bigint, width: FloatWidth): string {
  const kind = classify(bits, width);
  const minus = splitFloat(bits, width).sign ? "-" : "";
  if (kind === "infinity") return `${minus}inf`;
  if (isNaNClass(kind)) return `${minus}nan`;
  if (kind === "zero") return `${minus}0`;
  const x = floatValue(bits, width);
  if (width === 64) return String(x);
  for (let digits = 1; digits < 9; digits++) {
    const text = String(Number(x.toPrecision(digits)));
    const back = decimalToFloat(text, 32);
    if (typeof back === "object" && back?.bits === bits) return text;
  }
  return String(Number(x.toPrecision(9)));
}

/** The fields of the pattern in binary, grouped in fours from the right so
 *  each group lines up with one hex digit of the fraction field. */
export function fieldBinary(
  bits: bigint,
  width: FloatWidth,
): Record<"sign" | "exponent" | "fraction", string> {
  const { exponentBits, fractionBits } = FLOAT_LAYOUT[width];
  const { sign, exponent, fraction } = splitFloat(bits, width);
  const grouped = (value: bigint, length: number) =>
    value
      .toString(2)
      .padStart(length, "0")
      .replace(/\B(?=(?:[01]{4})+$)/g, " ");
  return {
    sign: String(sign),
    exponent: grouped(BigInt(exponent), exponentBits),
    fraction: grouped(fraction, fractionBits),
  };
}

export type FloatField = "sign" | "exponent" | "unbiased" | "fraction" | "value";

/** A parse can also succeed with a note: the decimal typed was rounded. */
export type FloatParseOutcome =
  | ParseOutcome
  | { kind: "rounded"; bits: bigint; message: string };

export function formatFloatField(field: FloatField, bits: bigint, width: FloatWidth): string {
  const { fractionBits, bias } = FLOAT_LAYOUT[width];
  const { sign, exponent, fraction } = splitFloat(bits, width);
  switch (field) {
    case "sign":
      return String(sign);
    case "exponent":
      return String(exponent);
    case "unbiased":
      return String(exponent - bias);
    case "fraction":
      return fraction.toString(16).padStart(Math.ceil(fractionBits / 4), "0");
    case "value":
      return formatFloatValue(bits, width);
  }
}

/**
 * Parse one field's text into a whole new pattern. Sign, exponent, and
 * fraction replace their own field of `bits` and keep the rest; the value
 * replaces everything. Never throws: bad text comes back as a message.
 */
export function parseFloatField(
  field: FloatField,
  text: string,
  bits: bigint,
  width: FloatWidth,
): FloatParseOutcome {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { kind: "empty" };
  const { exponentBits, fractionBits, bias } = FLOAT_LAYOUT[width];
  const top = topExponent(width);
  const fields = splitFloat(bits, width);
  switch (field) {
    case "sign": {
      if (trimmed !== "0" && trimmed !== "1") {
        return { kind: "invalid", message: "the sign is 0 (positive) or 1 (negative)" };
      }
      return { kind: "ok", bits: joinFloat({ ...fields, sign: trimmed === "1" ? 1 : 0 }, width) };
    }
    case "exponent": {
      if (!/^[0-9]+$/.test(trimmed)) {
        return { kind: "invalid", message: `the raw exponent is a whole number, 0 to ${top}` };
      }
      const exponent = Number(trimmed);
      if (exponent > top) {
        return {
          kind: "range",
          message: `the raw exponent is ${exponentBits} bits, so it runs 0 to ${top}`,
        };
      }
      return { kind: "ok", bits: joinFloat({ ...fields, exponent }, width) };
    }
    case "unbiased": {
      if (!/^[+-]?[0-9]+$/.test(trimmed)) {
        return {
          kind: "invalid",
          message: `the unbiased exponent is a whole number, ${-bias} to ${top - bias}`,
        };
      }
      const unbiased = Number(trimmed);
      if (unbiased < -bias || unbiased > top - bias) {
        return {
          kind: "range",
          message: `the unbiased exponent runs ${-bias} to ${top - bias}: raw 0 to ${top}, minus the bias ${bias}`,
        };
      }
      return { kind: "ok", bits: joinFloat({ ...fields, exponent: unbiased + bias }, width) };
    }
    case "fraction": {
      const digits = trimmed.replace(/^0[xX]/, "");
      if (digits.length === 0) return { kind: "empty" };
      if (!/^[0-9a-fA-F]+$/.test(digits)) {
        return { kind: "invalid", message: "the fraction is in hex: digits 0-9 and a-f" };
      }
      const fraction = BigInt("0x" + digits);
      const max = (1n << BigInt(fractionBits)) - 1n;
      if (fraction > max) {
        return {
          kind: "range",
          message: `the fraction is ${fractionBits} bits, so it maxes at 0x${max.toString(16)}`,
        };
      }
      return { kind: "ok", bits: joinFloat({ ...fields, fraction }, width) };
    }
    case "value":
      return parseFloatValue(trimmed, width);
  }
}

const SPECIAL = /^([+-]?)(inf|infinity|nan)$/i;
const DECIMAL = /^([+-]?)([0-9]*)(?:\.([0-9]*))?(?:e([+-]?[0-9]+))?$/i;
// The exact value of the smallest double subnormal is about 1,100
// characters; anything much longer is a paste gone wrong.
const MAX_VALUE_TEXT = 2000;

/**
 * Round the exact fraction num / den (both positive) to the nearest float,
 * ties to even, the IEEE default. Returns the stored fields, or which way
 * the value fell off the format.
 */
function roundToFloat(
  num: bigint,
  den: bigint,
  width: FloatWidth,
): { exponent: number; fraction: bigint; exact: boolean } | "overflow" | "underflow" {
  const { fractionBits, bias } = FLOAT_LAYOUT[width];
  // e = floor(log2(num / den)), from the bit lengths and one correction.
  let e = num.toString(2).length - den.toString(2).length;
  if (e >= 0 ? num < (den << BigInt(e)) : (num << BigInt(-e)) < den) e -= 1;
  // q is the weight of the last fraction bit; below the normal range it
  // stops falling, which is what makes a value subnormal.
  const q = Math.max(e, 1 - bias) - fractionBits;
  const n = q < 0 ? num << BigInt(-q) : num;
  const d = q > 0 ? den << BigInt(q) : den;
  let m = n / d;
  const r = n % d;
  if (2n * r > d || (2n * r === d && (m & 1n) === 1n)) m += 1n;
  if (m === 0n) return "underflow";
  const hidden = 1n << BigInt(fractionBits);
  if (m < hidden) return { exponent: 0, fraction: m, exact: r === 0n };
  let exponent = q + fractionBits + bias;
  if (m === hidden << 1n) {
    // Rounding carried into a new power of two: 1.111...1 became 10.0.
    m >>= 1n;
    exponent += 1;
  }
  if (exponent >= topExponent(width)) return "overflow";
  return { exponent, fraction: m - hidden, exact: r === 0n };
}

/**
 * Decimal (or inf / nan) text to the nearest pattern, with no messages, so
 * formatFloatValue can use it without looping back through them. Null when
 * the text is not a number at all.
 */
function decimalToFloat(
  text: string,
  width: FloatWidth,
): { bits: bigint; exact: boolean } | "overflow" | "underflow" | null {
  const { fractionBits } = FLOAT_LAYOUT[width];
  const special = SPECIAL.exec(text);
  if (special) {
    const sign = special[1] === "-" ? 1 : 0;
    // A typed nan is the default quiet NaN: only the top fraction bit set.
    const fraction = special[2].toLowerCase() === "nan" ? 1n << BigInt(fractionBits - 1) : 0n;
    return { bits: joinFloat({ sign, exponent: topExponent(width), fraction }, width), exact: true };
  }
  const match = text.length <= MAX_VALUE_TEXT ? DECIMAL.exec(text) : null;
  const whole = match?.[2] ?? "";
  const after = match?.[3] ?? "";
  if (!match || whole.length + after.length === 0) return null;
  const sign = match[1] === "-" ? 1 : 0;
  const digits = (whole + after).replace(/^0+/, "");
  if (digits.length === 0) {
    return { bits: joinFloat({ sign, exponent: 0, fraction: 0n }, width), exact: true };
  }
  const exp10 = Number(match[4] ?? "0") - after.length;
  // The value sits in [10^(magnitude-1), 10^magnitude). Far outside every
  // format the answer is already known, and skipping the BigInt power keeps
  // a typed 1e999999999 from hanging the tab.
  const magnitude = digits.length + exp10;
  if (magnitude > 400) return "overflow";
  if (magnitude < -400) return "underflow";
  const num = BigInt(digits) * 10n ** BigInt(Math.max(exp10, 0));
  const rounded = roundToFloat(num, 10n ** BigInt(Math.max(-exp10, 0)), width);
  if (typeof rounded === "string") return rounded;
  const { exponent, fraction, exact } = rounded;
  return { bits: joinFloat({ sign, exponent, fraction }, width), exact };
}

function parseFloatValue(text: string, width: FloatWidth): FloatParseOutcome {
  const result = decimalToFloat(text, width);
  if (result === null) {
    return {
      kind: "invalid",
      message: "type a decimal such as 0.1, -2.5, or 6.02e23, or inf or nan",
    };
  }
  if (result === "overflow") {
    const { fractionBits } = FLOAT_LAYOUT[width];
    const fraction = (1n << BigInt(fractionBits)) - 1n;
    const largest = joinFloat({ sign: 0, exponent: topExponent(width) - 1, fraction }, width);
    return {
      kind: "range",
      message: `past the largest ${width}-bit float, ${formatFloatValue(largest, width)}; type inf for infinity`,
    };
  }
  if (result === "underflow") {
    return {
      kind: "range",
      message: `closer to 0 than the smallest ${width}-bit float, ${formatFloatValue(1n, width)}, so it would round to 0; type 0 for zero`,
    };
  }
  if (result.exact) return { kind: "ok", bits: result.bits };
  return {
    kind: "rounded",
    bits: result.bits,
    message: `not exact in ${width} bits; stored the nearest float, shown in full under exact value`,
  };
}

