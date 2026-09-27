// Pins the register readings at their edges: hex alone in hex mode, signed
// over unsigned only when they differ, floats as the shortest decimal that
// reads back to the same bits, and junk read as zero. Every expected value is
// written out by hand (or from Python's struct module), never produced by the
// module under test.
import { describe, expect, it } from "vitest";
import {
  compactHex,
  floatText,
  fpRegisterText,
  integerReading,
  laneText,
  parseBits,
} from "@/lib/emulator/register-format";
import { sliceLanes } from "@/lib/emulator/vector-lanes";

const INT_B = { width: "b", float: false } as const;
const INT_H = { width: "h", float: false } as const;
const INT_S = { width: "s", float: false } as const;
const INT_D = { width: "d", float: false } as const;
const FLOAT_S = { width: "s", float: true } as const;
const FLOAT_D = { width: "d", float: true } as const;

describe("parseBits", () => {
  it("reads the panel's hex text", () => {
    expect(parseBits("0x2a", 64)).toBe(42n);
    expect(parseBits("0X2A", 64)).toBe(42n);
    expect(parseBits("  0x10 ", 64)).toBe(16n);
    expect(parseBits("ff", 8)).toBe(255n);
  });

  it("keeps only the width asked for", () => {
    expect(parseBits("0x1ff", 8)).toBe(255n);
    expect(parseBits("0x0123456789abcdeffedcba9876543210", 64)).toBe(
      0xfedcba9876543210n,
    );
  });

  it("reads junk as zero instead of throwing", () => {
    expect(parseBits("", 64)).toBe(0n);
    expect(parseBits("0x", 64)).toBe(0n);
    expect(parseBits("not hex", 64)).toBe(0n);
    expect(parseBits("-0x1", 64)).toBe(0n);
  });
});

describe("integerReading", () => {
  it("gives one reading when signed and unsigned agree", () => {
    expect(integerReading(0n, 64)).toEqual({ signed: "0", unsigned: null });
    expect(integerReading(47n, 64)).toEqual({ signed: "47", unsigned: null });
    expect(integerReading(0x7fffffffffffffffn, 64)).toEqual({
      signed: "9223372036854775807",
      unsigned: null,
    });
  });

  it("adds the unsigned reading under a negative", () => {
    expect(integerReading(0xffffffffffffffffn, 64)).toEqual({
      signed: "-1",
      unsigned: "18446744073709551615",
    });
    // INT64_MIN: the one value whose negation does not fit.
    expect(integerReading(0x8000000000000000n, 64)).toEqual({
      signed: "-9223372036854775808",
      unsigned: "9223372036854775808",
    });
    // The pattern a library call leaves in a caller-saved register.
    expect(integerReading(0xdeadbeefdeadbeefn, 64)).toEqual({
      signed: "-2401053088876216593",
      unsigned: "16045690984833335023",
    });
  });

  it("reads at the lane's own width", () => {
    expect(integerReading(0xffn, 8)).toEqual({ signed: "-1", unsigned: "255" });
    expect(integerReading(0x80n, 8)).toEqual({ signed: "-128", unsigned: "128" });
    expect(integerReading(0x7fn, 8)).toEqual({ signed: "127", unsigned: null });
    expect(integerReading(0x8000n, 16)).toEqual({ signed: "-32768", unsigned: "32768" });
    expect(integerReading(0xdeadbeefn, 32)).toEqual({
      signed: "-559038737",
      unsigned: "3735928559",
    });
    // Bits above the width are not part of the lane.
    expect(integerReading(0x1ffn, 8)).toEqual({ signed: "-1", unsigned: "255" });
  });
});

describe("floatText", () => {
  it("prints doubles as the shortest decimal that reads back", () => {
    expect(floatText(0x400c000000000000n, 64)).toBe("3.5");
    expect(floatText(0x3fb999999999999an, 64)).toBe("0.1");
    expect(floatText(0x7fefffffffffffffn, 64)).toBe("1.7976931348623157e+308");
    // The smallest subnormal.
    expect(floatText(0x1n, 64)).toBe("5e-324");
  });

  it("keeps a .0 on whole numbers and the sign on zero", () => {
    expect(floatText(0x4045000000000000n, 64)).toBe("42.0");
    // 123456789012345 is the widest whole number still written out.
    expect(floatText(0x42dc12218377de40n, 64)).toBe("123456789012345.0");
    expect(floatText(0n, 64)).toBe("0.0");
    expect(floatText(0x8000000000000000n, 64)).toBe("-0.0");
    expect(floatText(0x80000000n, 32)).toBe("-0.0");
  });

  it("writes a whole number past 15 digits in exponent form", () => {
    expect(floatText(0x430c6bf526340000n, 64)).toBe("1e+15");
    expect(floatText(0x4415af1d78b58c40n, 64)).toBe("1e+20");
    expect(floatText(0xc341c37937e08000n, 64)).toBe("-1e+16");
    // The pattern a library call leaves, read as a single.
    expect(floatText(0xdeadbeefn, 32)).toBe("-6.2598534e+18");
  });

  it("names infinities and NaNs, sign included, whatever the payload", () => {
    expect(floatText(0x7ff0000000000000n, 64)).toBe("inf");
    expect(floatText(0xfff0000000000000n, 64)).toBe("-inf");
    expect(floatText(0x7ff8000000000000n, 64)).toBe("nan");
    // A signalling NaN and a negative NaN with a payload.
    expect(floatText(0x7ff0000000000001n, 64)).toBe("nan");
    expect(floatText(0xfff8000000000001n, 64)).toBe("-nan");
    expect(floatText(0x7fc00000n, 32)).toBe("nan");
    expect(floatText(0xffc00001n, 32)).toBe("-nan");
    expect(floatText(0x7f800000n, 32)).toBe("inf");
  });

  it("prints singles by their own precision, not a double's", () => {
    // 0x3dcccccd is 0.100000001490116... as a double.
    expect(floatText(0x3dcccccdn, 32)).toBe("0.1");
    expect(floatText(0x7f7fffffn, 32)).toBe("3.4028235e+38");
    expect(floatText(0x1n, 32)).toBe("1e-45");
    expect(floatText(0x4b800001n, 32)).toBe("16777218.0");
  });
});

describe("fpRegisterText", () => {
  it("reads a d register as a double", () => {
    expect(fpRegisterText("0x400c000000000000")).toBe("3.5");
    expect(fpRegisterText("0x0000000000000000")).toBe("0.0");
    expect(fpRegisterText("0x8000000000000000")).toBe("-0.0");
    expect(fpRegisterText("0xfff8000000000000")).toBe("-nan");
  });

  it("reads what an s write leaves as the float, suffixed f", () => {
    // An s write zeroes bits 63:32: 4.5f is 0x40900000.
    expect(fpRegisterText("0x0000000040900000")).toBe("4.5f");
    expect(fpRegisterText("0x0000000080000000")).toBe("-0.0f");
    // Only a finite value takes the suffix: "nanf" reads as a typo.
    expect(fpRegisterText("0x000000007fc00000")).toBe("nan");
    expect(fpRegisterText("0x00000000ff800000")).toBe("-inf");
  });

  it("keeps the double reading for a register written as a d", () => {
    // fmov d0, x1 with x1 = 1: the smallest double subnormal, not 1e-45f.
    expect(fpRegisterText("0x0000000000000001", true)).toBe("5e-324");
    // 4.5f's bits read as a double (Python's struct gives the same).
    expect(fpRegisterText("0x0000000040900000", true)).toBe("5.35161536e-315");
  });

  it("reads junk as zero", () => {
    expect(fpRegisterText("")).toBe("0.0");
    expect(fpRegisterText("0xzz")).toBe("0.0");
  });
});

describe("laneText", () => {
  it("shows hex alone in hex mode, for integer and float lanes", () => {
    expect(laneText("ff", INT_B, false)).toEqual({ primary: "ff", secondary: null });
    expect(laneText("3f800000", FLOAT_S, false)).toEqual({
      primary: "3f800000",
      secondary: null,
    });
  });

  it("puts the unsigned value under a negative integer lane only", () => {
    expect(laneText("ff", INT_B, true)).toEqual({ primary: "-1", secondary: "255" });
    expect(laneText("7f", INT_B, true)).toEqual({ primary: "127", secondary: null });
    expect(laneText("8000000000000000", INT_D, true)).toEqual({
      primary: "-9223372036854775808",
      secondary: "9223372036854775808",
    });
  });

  it("reads float arrangements as floats", () => {
    expect(laneText("3f800000", FLOAT_S, true)).toEqual({ primary: "1.0", secondary: null });
    expect(laneText("bf800000", FLOAT_S, true)).toEqual({ primary: "-1.0", secondary: null });
    expect(laneText("400c000000000000", FLOAT_D, true)).toEqual({
      primary: "3.5",
      secondary: null,
    });
    expect(laneText("7fc00000", FLOAT_S, true).primary).toBe("nan");
  });

  // 0x0123456789abcdef in the high 64 bits, 0xfedcba9876543210 in the low.
  const PATTERN = "0x0123456789abcdeffedcba9876543210";
  const decimal = (arrangement: typeof INT_D | typeof INT_S | typeof INT_H | typeof INT_B) =>
    sliceLanes(PATTERN, arrangement.width).map((lane) => laneText(lane.hex, arrangement, true));

  it("reads each lane of one register at its own width", () => {
    expect(decimal(INT_D)).toEqual([
      { primary: "-81985529216486896", secondary: "18364758544493064720" },
      { primary: "81985529216486895", secondary: null },
    ]);
    expect(decimal(INT_S).map((t) => t.primary)).toEqual([
      "1985229328",
      "-19088744",
      "-1985229329",
      "19088743",
    ]);
    expect(decimal(INT_S).map((t) => t.secondary)).toEqual([
      null,
      "4275878552",
      "2309737967",
      null,
    ]);
    expect(decimal(INT_H).map((t) => t.primary)).toEqual([
      "12816", "30292", "-17768", "-292", "-12817", "-30293", "17767", "291",
    ]);
    expect(decimal(INT_B).map((t) => t.primary)).toEqual([
      "16", "50", "84", "118", "-104", "-70", "-36", "-2",
      "-17", "-51", "-85", "-119", "103", "69", "35", "1",
    ]);
    expect(decimal(INT_B).map((t) => t.secondary)).toEqual([
      null, null, null, null, "152", "186", "220", "254",
      "239", "205", "171", "137", null, null, null, null,
    ]);
  });
});

describe("compactHex", () => {
  it("drops the leading zeros a listener would otherwise hear", () => {
    expect(compactHex("0x000000000000002f")).toBe("0x2f");
    expect(compactHex("0x0000000000000000")).toBe("0x0");
    expect(compactHex("0xffffffffffffffff")).toBe("0xffffffffffffffff");
  });
});
