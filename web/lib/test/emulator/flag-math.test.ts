// Pins the NZCV rules and operand parsers behind the reference's flag panels.
import { describe, expect, it } from "vitest";
import {
  computeFcmpFlags,
  computeIntFlags,
  parseFloatOperand,
  parseIntOperand,
} from "@/lib/emulator/flag-math";

describe("computeIntFlags", () => {
  // Table-driven against the architectural NZCV rules; each row is a case the
  // course cares about (signed/unsigned split, sentinel test, overflow tip).
  const cases: Array<{
    name: string;
    op: "sub" | "add" | "and";
    a: bigint;
    b: bigint;
    bits: 32 | 64;
    flags: { n: boolean; z: boolean; c: boolean; v: boolean };
  }> = [
    // cmp -1, 1: signed below, unsigned above, the b.lt vs b.lo split.
    { name: "cmp -1 vs 1", op: "sub", a: -1n, b: 1n, bits: 32, flags: { n: true, z: false, c: true, v: false } },
    // cmp 3, 5: borrow happens, so C clears and both lt and lo would fire.
    { name: "cmp 3 vs 5", op: "sub", a: 3n, b: 5n, bits: 32, flags: { n: true, z: false, c: false, v: false } },
    { name: "cmp equal", op: "sub", a: 5n, b: 5n, bits: 32, flags: { n: false, z: true, c: true, v: false } },
    // subtraction overflow: INT_MIN - 1 flips sign the wrong way.
    { name: "sub overflow", op: "sub", a: 0x80000000n, b: 1n, bits: 32, flags: { n: false, z: false, c: true, v: true } },
    // adds at the signed ceiling: two positives make a negative, V set.
    { name: "adds overflow", op: "add", a: 0x7fffffffn, b: 1n, bits: 32, flags: { n: true, z: false, c: false, v: true } },
    // same operands at 64 bits: no overflow, width changes the story.
    { name: "adds wide", op: "add", a: 0x7fffffffn, b: 1n, bits: 64, flags: { n: false, z: false, c: false, v: false } },
    // unsigned wrap to zero: carry out and Z together.
    { name: "adds wraps", op: "add", a: 0xffffffffn, b: 1n, bits: 32, flags: { n: false, z: true, c: true, v: false } },
    // cmn -1, 1 is the course sentinel test: -1 + 1 == 0.
    { name: "cmn sentinel", op: "add", a: -1n, b: 1n, bits: 32, flags: { n: false, z: true, c: true, v: false } },
    // tst 6, 1: bit 0 clear, so the and is zero. C and V never set by logic ops.
    { name: "tst even", op: "and", a: 6n, b: 1n, bits: 32, flags: { n: false, z: true, c: false, v: false } },
    { name: "ands sign bit", op: "and", a: 0x80000000n, b: 0x80000000n, bits: 32, flags: { n: true, z: false, c: false, v: false } },
  ];

  for (const row of cases) {
    it(row.name, () => {
      const { flags } = computeIntFlags(row.op, row.a, row.b, row.bits);
      expect(flags).toEqual(row.flags);
    });
  }

  it("masks the result to the register width", () => {
    const { result } = computeIntFlags("add", 0xffffffffn, 1n, 32);
    expect(result).toBe(0n);
  });
});

describe("computeFcmpFlags", () => {
  it("less-than sets N only", () => {
    expect(computeFcmpFlags(0.3, 0.5)).toEqual({ n: true, z: false, c: false, v: false });
  });
  it("equal sets Z and C", () => {
    expect(computeFcmpFlags(1.5, 1.5)).toEqual({ n: false, z: true, c: true, v: false });
  });
  it("greater-than sets C only", () => {
    expect(computeFcmpFlags(2, 1)).toEqual({ n: false, z: false, c: true, v: false });
  });
  it("nan on either side is unordered: C and V", () => {
    expect(computeFcmpFlags(Number.NaN, 1)).toEqual({ n: false, z: false, c: true, v: true });
    expect(computeFcmpFlags(1, Number.NaN)).toEqual({ n: false, z: false, c: true, v: true });
  });
});

describe("operand parsing", () => {
  it("accepts decimal, negative, and 0x hex integers", () => {
    expect(parseIntOperand("42")).toBe(42n);
    expect(parseIntOperand("-1")).toBe(-1n);
    expect(parseIntOperand("0x7fffffff")).toBe(0x7fffffffn);
    expect(parseIntOperand("-0x10")).toBe(-16n);
  });
  it("rejects anything else without throwing", () => {
    expect(parseIntOperand("ten")).toBeNull();
    expect(parseIntOperand("1.5")).toBeNull();
    expect(parseIntOperand("")).toBeNull();
  });
  it("accepts floats and the nan spelling", () => {
    expect(parseFloatOperand("0.5")).toBe(0.5);
    expect(parseFloatOperand("-2")).toBe(-2);
    expect(parseFloatOperand("1e3")).toBe(1000);
    expect(parseFloatOperand("nan")).toBeNaN();
    expect(parseFloatOperand("half")).toBeNull();
  });
});
