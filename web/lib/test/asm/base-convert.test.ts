import { describe, expect, test } from "vitest";
import {
  WIDTHS,
  type Rep,
  type Width,
  bitAt,
  fitsUnsigned,
  flipBit,
  formatBinary,
  formatHex,
  formatRep,
  formatSigned,
  formatUnsigned,
  fromSigned,
  maxSigned,
  maxUnsigned,
  minSigned,
  parseRep,
  signBit,
  toSigned,
  truncate,
} from "@/lib/asm/base-convert";

const REPS: readonly Rep[] = ["hex", "binary", "unsigned", "signed"];

interface Row {
  name: string;
  width: Width;
  bits: bigint;
  hex: string;
  binary: string;
  unsigned: string;
  signed: string;
  sign: 0 | 1;
}

// Every boundary at every width: zero, one, minus one (= max unsigned; the
// same pattern reads both ways), min signed, max signed, plus a mid value.
// The 64-bit rows sit far beyond Number's safe range on purpose.
const TABLE: Row[] = [
  // 8-bit
  { name: "zero", width: 8, bits: 0n, hex: "00", binary: "0000 0000", unsigned: "0", signed: "0", sign: 0 },
  { name: "one", width: 8, bits: 1n, hex: "01", binary: "0000 0001", unsigned: "1", signed: "1", sign: 0 },
  { name: "minus one / max unsigned", width: 8, bits: 255n, hex: "ff", binary: "1111 1111", unsigned: "255", signed: "-1", sign: 1 },
  { name: "min signed", width: 8, bits: 128n, hex: "80", binary: "1000 0000", unsigned: "128", signed: "-128", sign: 1 },
  { name: "max signed", width: 8, bits: 127n, hex: "7f", binary: "0111 1111", unsigned: "127", signed: "127", sign: 0 },
  { name: "mid", width: 8, bits: 42n, hex: "2a", binary: "0010 1010", unsigned: "42", signed: "42", sign: 0 },
  // 16-bit
  { name: "zero", width: 16, bits: 0n, hex: "0000", binary: "0000 0000 0000 0000", unsigned: "0", signed: "0", sign: 0 },
  { name: "one", width: 16, bits: 1n, hex: "0001", binary: "0000 0000 0000 0001", unsigned: "1", signed: "1", sign: 0 },
  { name: "minus one / max unsigned", width: 16, bits: 65535n, hex: "ffff", binary: "1111 1111 1111 1111", unsigned: "65535", signed: "-1", sign: 1 },
  { name: "min signed", width: 16, bits: 32768n, hex: "8000", binary: "1000 0000 0000 0000", unsigned: "32768", signed: "-32768", sign: 1 },
  { name: "max signed", width: 16, bits: 32767n, hex: "7fff", binary: "0111 1111 1111 1111", unsigned: "32767", signed: "32767", sign: 0 },
  { name: "mid", width: 16, bits: 4660n, hex: "1234", binary: "0001 0010 0011 0100", unsigned: "4660", signed: "4660", sign: 0 },
  // 32-bit
  { name: "zero", width: 32, bits: 0n, hex: "00000000", binary: "0000 0000 0000 0000 0000 0000 0000 0000", unsigned: "0", signed: "0", sign: 0 },
  { name: "one", width: 32, bits: 1n, hex: "00000001", binary: "0000 0000 0000 0000 0000 0000 0000 0001", unsigned: "1", signed: "1", sign: 0 },
  { name: "minus one / max unsigned", width: 32, bits: 4294967295n, hex: "ffffffff", binary: "1111 1111 1111 1111 1111 1111 1111 1111", unsigned: "4294967295", signed: "-1", sign: 1 },
  { name: "min signed", width: 32, bits: 2147483648n, hex: "80000000", binary: "1000 0000 0000 0000 0000 0000 0000 0000", unsigned: "2147483648", signed: "-2147483648", sign: 1 },
  { name: "max signed", width: 32, bits: 2147483647n, hex: "7fffffff", binary: "0111 1111 1111 1111 1111 1111 1111 1111", unsigned: "2147483647", signed: "2147483647", sign: 0 },
  { name: "mid", width: 32, bits: 3735928559n, hex: "deadbeef", binary: "1101 1110 1010 1101 1011 1110 1110 1111", unsigned: "3735928559", signed: "-559038737", sign: 1 },
  // 64-bit
  { name: "zero", width: 64, bits: 0n, hex: "0000000000000000", binary: "0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000", unsigned: "0", signed: "0", sign: 0 },
  { name: "one", width: 64, bits: 1n, hex: "0000000000000001", binary: "0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0001", unsigned: "1", signed: "1", sign: 0 },
  { name: "minus one / max unsigned", width: 64, bits: 18446744073709551615n, hex: "ffffffffffffffff", binary: "1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111", unsigned: "18446744073709551615", signed: "-1", sign: 1 },
  { name: "min signed", width: 64, bits: 9223372036854775808n, hex: "8000000000000000", binary: "1000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000", unsigned: "9223372036854775808", signed: "-9223372036854775808", sign: 1 },
  { name: "max signed", width: 64, bits: 9223372036854775807n, hex: "7fffffffffffffff", binary: "0111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111 1111", unsigned: "9223372036854775807", signed: "9223372036854775807", sign: 0 },
  { name: "mid", width: 64, bits: 81985529216486895n, hex: "0123456789abcdef", binary: "0000 0001 0010 0011 0100 0101 0110 0111 1000 1001 1010 1011 1100 1101 1110 1111", unsigned: "81985529216486895", signed: "81985529216486895", sign: 0 },
];

describe("canonical table: every representation at every width", () => {
  for (const row of TABLE) {
    test(`${row.width}-bit ${row.name}`, () => {
      expect(formatHex(row.bits, row.width)).toBe(row.hex);
      expect(formatBinary(row.bits, row.width)).toBe(row.binary);
      expect(formatUnsigned(row.bits)).toBe(row.unsigned);
      expect(formatSigned(row.bits, row.width)).toBe(row.signed);
      expect(signBit(row.bits, row.width)).toBe(row.sign);
    });
  }

  test("formatRep dispatches to the same four formats", () => {
    const row = TABLE[2]; // 8-bit minus one
    expect(formatRep("hex", row.bits, row.width)).toBe(row.hex);
    expect(formatRep("binary", row.bits, row.width)).toBe(row.binary);
    expect(formatRep("unsigned", row.bits, row.width)).toBe(row.unsigned);
    expect(formatRep("signed", row.bits, row.width)).toBe(row.signed);
  });
});

describe("round trip: parseRep(formatRep(bits)) recovers bits for every row and rep", () => {
  for (const row of TABLE) {
    for (const rep of REPS) {
      test(`${row.width}-bit ${row.name} via ${rep}`, () => {
        const outcome = parseRep(rep, formatRep(rep, row.bits, row.width), row.width);
        expect(outcome).toEqual({ kind: "ok", bits: row.bits });
      });
    }
  }
});

describe("parseRep accepts common spellings", () => {
  const CASES: Array<{ rep: Rep; text: string; width: Width; bits: bigint }> = [
    { rep: "hex", text: "0xFF", width: 8, bits: 255n },
    { rep: "hex", text: "0XFF", width: 8, bits: 255n },
    { rep: "hex", text: "FF", width: 8, bits: 255n },
    { rep: "hex", text: "  ff  ", width: 8, bits: 255n },
    { rep: "hex", text: "00000001", width: 8, bits: 1n }, // leading zeros are value-neutral
    { rep: "binary", text: "0b1010", width: 8, bits: 10n },
    { rep: "binary", text: "1010", width: 8, bits: 10n },
    { rep: "binary", text: "0000 1010", width: 8, bits: 10n },
    { rep: "binary", text: "000000001111", width: 8, bits: 15n }, // extra leading zeros still fit
    { rep: "unsigned", text: " 42 ", width: 8, bits: 42n },
    { rep: "unsigned", text: "007", width: 8, bits: 7n },
    { rep: "signed", text: "-0", width: 8, bits: 0n },
    { rep: "signed", text: " -128 ", width: 8, bits: 128n },
    { rep: "signed", text: "127", width: 8, bits: 127n },
  ];
  for (const c of CASES) {
    test(`${c.rep} ${JSON.stringify(c.text)} at ${c.width}-bit`, () => {
      expect(parseRep(c.rep, c.text, c.width)).toEqual({ kind: "ok", bits: c.bits });
    });
  }
});

describe("parseRep empty", () => {
  for (const rep of REPS) {
    test(`${rep}: blank and whitespace are empty, not errors`, () => {
      expect(parseRep(rep, "", 32)).toEqual({ kind: "empty" });
      expect(parseRep(rep, "   ", 32)).toEqual({ kind: "empty" });
    });
  }
  test("a bare prefix is empty, not invalid", () => {
    expect(parseRep("hex", "0x", 32)).toEqual({ kind: "empty" });
    expect(parseRep("binary", "0b", 32)).toEqual({ kind: "empty" });
  });
});

describe("parseRep invalid input gets a specific message", () => {
  const CASES: Array<{ rep: Rep; text: string; expectIn: string }> = [
    { rep: "hex", text: "xyz", expectIn: "0-9 and a-f" },
    { rep: "hex", text: "0xg1", expectIn: "0-9 and a-f" },
    { rep: "binary", text: "102", expectIn: "0 and 1" },
    { rep: "binary", text: "0b12", expectIn: "0 and 1" },
    { rep: "unsigned", text: "12a", expectIn: "decimal digits" },
    { rep: "unsigned", text: "-5", expectIn: "signed" },
    { rep: "signed", text: "1-2", expectIn: "decimal digits" },
    { rep: "signed", text: "--4", expectIn: "decimal digits" },
    { rep: "signed", text: "1.5", expectIn: "decimal digits" },
  ];
  for (const c of CASES) {
    test(`${c.rep} ${JSON.stringify(c.text)}`, () => {
      const outcome = parseRep(c.rep, c.text, 32);
      expect(outcome.kind).toBe("invalid");
      if (outcome.kind === "invalid") {
        expect(outcome.message).toContain(c.expectIn);
      }
    });
  }
});

describe("parseRep range: one past the boundary at every width", () => {
  for (const width of WIDTHS) {
    test(`hex just past ${width}-bit max`, () => {
      const past = maxUnsigned(width) + 1n;
      const outcome = parseRep("hex", past.toString(16), width);
      expect(outcome.kind).toBe("range");
      if (outcome.kind === "range") {
        expect(outcome.message).toContain(`${width + 1} bits`);
        expect(outcome.message).toContain(`${width}-bit`);
      }
    });
    test(`binary one digit past ${width} bits`, () => {
      const outcome = parseRep("binary", "1" + "0".repeat(width), width);
      expect(outcome.kind).toBe("range");
      if (outcome.kind === "range") {
        expect(outcome.message).toContain(`${width + 1} bits`);
      }
    });
    test(`unsigned max + 1 at ${width}-bit`, () => {
      const outcome = parseRep("unsigned", (maxUnsigned(width) + 1n).toString(), width);
      expect(outcome.kind).toBe("range");
      if (outcome.kind === "range") {
        expect(outcome.message).toContain(maxUnsigned(width).toString());
      }
    });
    test(`signed max + 1 at ${width}-bit`, () => {
      const outcome = parseRep("signed", (maxSigned(width) + 1n).toString(), width);
      expect(outcome.kind).toBe("range");
      if (outcome.kind === "range") {
        expect(outcome.message).toContain(minSigned(width).toString());
        expect(outcome.message).toContain(maxSigned(width).toString());
      }
    });
    test(`signed min - 1 at ${width}-bit`, () => {
      const outcome = parseRep("signed", (minSigned(width) - 1n).toString(), width);
      expect(outcome.kind).toBe("range");
    });
    test(`boundary values themselves parse at ${width}-bit`, () => {
      expect(parseRep("unsigned", maxUnsigned(width).toString(), width)).toEqual({
        kind: "ok",
        bits: maxUnsigned(width),
      });
      expect(parseRep("signed", minSigned(width).toString(), width)).toEqual({
        kind: "ok",
        bits: 1n << BigInt(width - 1),
      });
      expect(parseRep("signed", maxSigned(width).toString(), width)).toEqual({
        kind: "ok",
        bits: maxSigned(width),
      });
      expect(parseRep("signed", "-1", width)).toEqual({
        kind: "ok",
        bits: maxUnsigned(width),
      });
    });
  }
});

describe("signed reading helpers", () => {
  for (const width of WIDTHS) {
    test(`toSigned / fromSigned round the boundaries at ${width}-bit`, () => {
      for (const value of [0n, 1n, -1n, minSigned(width), maxSigned(width)]) {
        expect(toSigned(fromSigned(value, width), width)).toBe(value);
      }
      expect(toSigned(maxUnsigned(width), width)).toBe(-1n);
      expect(toSigned(1n << BigInt(width - 1), width)).toBe(minSigned(width));
    });
  }
});

describe("flipBit", () => {
  test("flipping bit 0 of zero yields one", () => {
    expect(flipBit(0n, 0, 8)).toBe(1n);
  });
  for (const width of WIDTHS) {
    test(`flipping the sign bit of zero yields min signed at ${width}-bit`, () => {
      const flipped = flipBit(0n, width - 1, width);
      expect(toSigned(flipped, width)).toBe(minSigned(width));
      expect(signBit(flipped, width)).toBe(1);
    });
    test(`double flip is identity at ${width}-bit`, () => {
      const start = maxUnsigned(width) >> 1n; // 0111...1
      expect(flipBit(flipBit(start, width - 1, width), width - 1, width)).toBe(start);
    });
  }
  test("an out-of-range index leaves the pattern alone", () => {
    expect(flipBit(5n, 8, 8)).toBe(5n);
    expect(flipBit(5n, -1, 8)).toBe(5n);
    expect(flipBit(5n, 64, 64)).toBe(5n);
  });
});

describe("bitAt", () => {
  test("reads each position of 0b1010", () => {
    expect(bitAt(10n, 0)).toBe(0);
    expect(bitAt(10n, 1)).toBe(1);
    expect(bitAt(10n, 2)).toBe(0);
    expect(bitAt(10n, 3)).toBe(1);
  });
  test("reads the top bit of a 64-bit pattern", () => {
    expect(bitAt(1n << 63n, 63)).toBe(1);
    expect(bitAt(maxSigned(64), 63)).toBe(0);
  });
});

describe("width changes", () => {
  test("fitsUnsigned holds at max and breaks one past it", () => {
    for (const width of WIDTHS) {
      expect(fitsUnsigned(maxUnsigned(width), width)).toBe(true);
      expect(fitsUnsigned(maxUnsigned(width) + 1n, width)).toBe(false);
    }
  });
  test("truncate keeps the low bits, like a narrower store", () => {
    expect(truncate(0x1ffn, 8)).toBe(0xffn);
    expect(truncate(300n, 8)).toBe(44n);
    expect(truncate(0x12345678n, 16)).toBe(0x5678n);
    expect(truncate(maxUnsigned(64), 32)).toBe(maxUnsigned(32));
  });
  test("truncate leaves an in-range value alone", () => {
    for (const width of WIDTHS) {
      expect(truncate(maxUnsigned(width), width)).toBe(maxUnsigned(width));
      expect(truncate(0n, width)).toBe(0n);
    }
  });
});
