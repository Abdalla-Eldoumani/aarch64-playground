import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  FlagEffect,
  FLAG_SETTERS,
  computeFcmpFlags,
  computeIntFlags,
  parseFloatOperand,
  parseIntOperand,
} from "@/components/diagrams/FlagEffect";

afterEach(cleanup);

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
    // cmp -1, 1: signed below, unsigned above -- the b.lt vs b.lo split.
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

describe("FlagEffect", () => {
  it("exports the panel for exactly the flag-setting entries", () => {
    expect([...FLAG_SETTERS].sort()).toEqual(
      ["adds", "ands", "cmn", "cmp", "fcmp", "subs", "tst"].sort(),
    );
  });

  it("defaults cmp to the signed vs unsigned split", () => {
    render(<FlagEffect mnemonic="cmp" />);
    expect(screen.getByLabelText("b.lt: taken")).toBeTruthy();
    expect(screen.getByLabelText("b.lo: not taken")).toBeTruthy();
    expect(screen.getByLabelText("N negative: 1")).toBeTruthy();
    expect(screen.getByLabelText("C carry: 1")).toBeTruthy();
  });

  it("recomputes the verdicts when an operand changes", () => {
    render(<FlagEffect mnemonic="cmp" />);
    fireEvent.change(screen.getByLabelText("w9"), { target: { value: "5" } });
    // 5 vs 1: greater both ways.
    expect(screen.getByLabelText("b.gt: taken")).toBeTruthy();
    expect(screen.getByLabelText("b.hi: taken")).toBeTruthy();
    expect(screen.getByLabelText("b.lt: not taken")).toBeTruthy();
  });

  it("width toggle changes the sign reading of the same bits", () => {
    render(<FlagEffect mnemonic="cmp" />);
    fireEvent.change(screen.getByLabelText("w9"), {
      target: { value: "0x80000000" },
    });
    fireEvent.change(screen.getByLabelText("w10"), { target: { value: "0" } });
    // As a w value the sign bit is set: 0x80000000 - 0 is negative.
    expect(screen.getByLabelText("N negative: 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "x 64-bit" }));
    // As an x value the same bits are a small positive number.
    expect(screen.getByLabelText("N negative: 0")).toBeTruthy();
    expect(screen.getByLabelText("x9")).toBeTruthy();
  });

  it("shows a calm hint instead of verdicts on a non-number", () => {
    render(<FlagEffect mnemonic="cmp" />);
    fireEvent.change(screen.getByLabelText("w9"), {
      target: { value: "ten" },
    });
    expect(screen.queryByLabelText("flags")).toBeNull();
    expect(screen.getByText(/decimal or 0x hex/)).toBeTruthy();
  });

  it("fcmp mode has no width toggle and explains the unordered case", () => {
    render(<FlagEffect mnemonic="fcmp" />);
    expect(screen.queryByRole("group", { name: "operand width" })).toBeNull();
    // Default 0.3 vs 0.5: below.
    expect(screen.getByLabelText("b.lt: taken")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("d16"), {
      target: { value: "nan" },
    });
    expect(screen.getByLabelText("C carry: 1")).toBeTruthy();
    expect(screen.getByLabelText("V overflow: 1")).toBeTruthy();
    expect(screen.getByText(/unordered/)).toBeTruthy();
  });

  it("discard note appears for the compare aliases and not for subs", () => {
    render(<FlagEffect mnemonic="cmp" />);
    expect(screen.getByText(/result is discarded/)).toBeTruthy();
    cleanup();
    render(<FlagEffect mnemonic="subs" />);
    expect(screen.getByText(/result is written/)).toBeTruthy();
  });

  it("renders the b.cond jump link only when the mount passes an anchor", () => {
    render(<FlagEffect mnemonic="cmp" />);
    expect(screen.queryByRole("link")).toBeNull();
    cleanup();
    render(<FlagEffect mnemonic="cmp" condHref="#b-cond" />);
    const link = screen.getByRole("link", { name: /see b\.cond/ });
    expect(link.getAttribute("href")).toBe("#b-cond");
  });
});
