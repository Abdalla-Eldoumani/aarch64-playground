// Pins the IEEE-754 reading of 32- and 64-bit patterns: the fields, the
// class, the shortest and exact decimals, and exact decimal-to-bits rounding.
// Every expected pattern and decimal below was worked out independently
// (by hand and with Python's struct and decimal modules), never through the
// module under test.
import { describe, expect, test } from "vitest";
import {
  type FloatClass,
  type FloatField,
  type FloatWidth,
  classify,
  exactValue,
  fieldBinary,
  floatValue,
  formatFloatField,
  formatFloatValue,
  isFloatWidth,
  parseFloatField,
  powerOfTwoForm,
} from "@/lib/asm/ieee754";

interface Row {
  name: string;
  width: FloatWidth;
  bits: bigint;
  kind: FloatClass;
  value: string;
  exact?: string;
  sign: string;
  exponent: string;
  unbiased: string;
  fraction: string;
}

const TABLE: Row[] = [
  // 32-bit single
  { name: "zero", width: 32, bits: 0x00000000n, kind: "zero", value: "0", exact: "0", sign: "0", exponent: "0", unbiased: "-127", fraction: "000000" },
  { name: "negative zero", width: 32, bits: 0x80000000n, kind: "zero", value: "-0", exact: "-0", sign: "1", exponent: "0", unbiased: "-127", fraction: "000000" },
  {
    name: "smallest subnormal", width: 32, bits: 0x00000001n, kind: "subnormal", value: "1e-45",
    exact: "0.00000000000000000000000000000000000000000000140129846432481707092372958328991613128026194187651577175706828388979108268586060148663818836212158203125",
    sign: "0", exponent: "0", unbiased: "-127", fraction: "000001",
  },
  {
    name: "largest subnormal", width: 32, bits: 0x007fffffn, kind: "subnormal", value: "1.1754942e-38",
    exact: "0.00000000000000000000000000000000000001175494210692441075487029444849287348827052428745893333857174530571588870475618904265502351336181163787841796875",
    sign: "0", exponent: "0", unbiased: "-127", fraction: "7fffff",
  },
  {
    name: "smallest normal", width: 32, bits: 0x00800000n, kind: "normal", value: "1.1754944e-38",
    exact: "0.000000000000000000000000000000000000011754943508222875079687365372222456778186655567720875215087517062784172594547271728515625",
    sign: "0", exponent: "1", unbiased: "-126", fraction: "000000",
  },
  { name: "largest normal", width: 32, bits: 0x7f7fffffn, kind: "normal", value: "3.4028235e+38", exact: "340282346638528859811704183484516925440", sign: "0", exponent: "254", unbiased: "127", fraction: "7fffff" },
  { name: "one", width: 32, bits: 0x3f800000n, kind: "normal", value: "1", exact: "1", sign: "0", exponent: "127", unbiased: "0", fraction: "000000" },
  { name: "minus two and a half", width: 32, bits: 0xc0200000n, kind: "normal", value: "-2.5", exact: "-2.5", sign: "1", exponent: "128", unbiased: "1", fraction: "200000" },
  { name: "0.1", width: 32, bits: 0x3dcccccdn, kind: "normal", value: "0.1", exact: "0.100000001490116119384765625", sign: "0", exponent: "123", unbiased: "-4", fraction: "4ccccd" },
  { name: "infinity", width: 32, bits: 0x7f800000n, kind: "infinity", value: "inf", exact: "inf", sign: "0", exponent: "255", unbiased: "128", fraction: "000000" },
  { name: "negative infinity", width: 32, bits: 0xff800000n, kind: "infinity", value: "-inf", exact: "-inf", sign: "1", exponent: "255", unbiased: "128", fraction: "000000" },
  { name: "quiet NaN", width: 32, bits: 0x7fc00000n, kind: "quiet NaN", value: "nan", exact: "nan", sign: "0", exponent: "255", unbiased: "128", fraction: "400000" },
  { name: "signalling NaN", width: 32, bits: 0x7f800001n, kind: "signalling NaN", value: "nan", exact: "nan", sign: "0", exponent: "255", unbiased: "128", fraction: "000001" },
  { name: "negative quiet NaN", width: 32, bits: 0xffc00000n, kind: "quiet NaN", value: "-nan", exact: "-nan", sign: "1", exponent: "255", unbiased: "128", fraction: "400000" },
  // 64-bit double
  { name: "zero", width: 64, bits: 0x0000000000000000n, kind: "zero", value: "0", exact: "0", sign: "0", exponent: "0", unbiased: "-1023", fraction: "0000000000000" },
  { name: "negative zero", width: 64, bits: 0x8000000000000000n, kind: "zero", value: "-0", exact: "-0", sign: "1", exponent: "0", unbiased: "-1023", fraction: "0000000000000" },
  // Its exact decimal runs to 1076 characters; pinned by its ends below.
  { name: "smallest subnormal", width: 64, bits: 0x0000000000000001n, kind: "subnormal", value: "5e-324", sign: "0", exponent: "0", unbiased: "-1023", fraction: "0000000000001" },
  { name: "smallest normal", width: 64, bits: 0x0010000000000000n, kind: "normal", value: "2.2250738585072014e-308", sign: "0", exponent: "1", unbiased: "-1022", fraction: "0000000000000" },
  {
    name: "largest normal", width: 64, bits: 0x7fefffffffffffffn, kind: "normal", value: "1.7976931348623157e+308",
    exact: "179769313486231570814527423731704356798070567525844996598917476803157260780028538760589558632766878171540458953514382464234321326889464182768467546703537516986049910576551282076245490090389328944075868508455133942304583236903222948165808559332123348274797826204144723168738177180919299881250404026184124858368",
    sign: "0", exponent: "2046", unbiased: "1023", fraction: "fffffffffffff",
  },
  { name: "one", width: 64, bits: 0x3ff0000000000000n, kind: "normal", value: "1", exact: "1", sign: "0", exponent: "1023", unbiased: "0", fraction: "0000000000000" },
  { name: "0.1", width: 64, bits: 0x3fb999999999999an, kind: "normal", value: "0.1", exact: "0.1000000000000000055511151231257827021181583404541015625", sign: "0", exponent: "1019", unbiased: "-4", fraction: "999999999999a" },
  { name: "infinity", width: 64, bits: 0x7ff0000000000000n, kind: "infinity", value: "inf", exact: "inf", sign: "0", exponent: "2047", unbiased: "1024", fraction: "0000000000000" },
  { name: "negative infinity", width: 64, bits: 0xfff0000000000000n, kind: "infinity", value: "-inf", exact: "-inf", sign: "1", exponent: "2047", unbiased: "1024", fraction: "0000000000000" },
  { name: "quiet NaN", width: 64, bits: 0x7ff8000000000000n, kind: "quiet NaN", value: "nan", exact: "nan", sign: "0", exponent: "2047", unbiased: "1024", fraction: "8000000000000" },
  { name: "signalling NaN", width: 64, bits: 0x7ff0000000000001n, kind: "signalling NaN", value: "nan", exact: "nan", sign: "0", exponent: "2047", unbiased: "1024", fraction: "0000000000001" },
];

const FIELDS: readonly FloatField[] = ["sign", "exponent", "unbiased", "fraction"];

describe("edge patterns at both widths", () => {
  for (const row of TABLE) {
    test(`${row.width}-bit ${row.name}`, () => {
      expect(classify(row.bits, row.width)).toBe(row.kind);
      expect(formatFloatValue(row.bits, row.width)).toBe(row.value);
      if (row.exact !== undefined) expect(exactValue(row.bits, row.width)).toBe(row.exact);
      expect(formatFloatField("sign", row.bits, row.width)).toBe(row.sign);
      expect(formatFloatField("exponent", row.bits, row.width)).toBe(row.exponent);
      expect(formatFloatField("unbiased", row.bits, row.width)).toBe(row.unbiased);
      expect(formatFloatField("fraction", row.bits, row.width)).toBe(row.fraction);
      expect(formatFloatField("value", row.bits, row.width)).toBe(row.value);
    });
  }

  test("64-bit smallest subnormal: every one of its 1076 characters", () => {
    const exact = exactValue(1n, 64);
    expect(exact.length).toBe(1076);
    expect(exact.startsWith(`0.${"0".repeat(323)}4940656458412465441765687928682213723650598026`)).toBe(true);
    expect(exact.endsWith("506419718265533447265625")).toBe(true);
  });

  test("the value reads through DataView, NaN included", () => {
    expect(floatValue(0x3dcccccdn, 32)).toBe(0.10000000149011612);
    expect(floatValue(0x3fb999999999999an, 64)).toBe(0.1);
    expect(Object.is(floatValue(0x80000000n, 32), -0)).toBe(true);
    expect(floatValue(0x7f800001n, 32)).toBeNaN();
    expect(floatValue(0xfff0000000000000n, 64)).toBe(-Infinity);
  });
});

describe("round trip: parsing a field's own text gives the pattern back", () => {
  for (const row of TABLE) {
    for (const field of FIELDS) {
      test(`${row.width}-bit ${row.name} via ${field}`, () => {
        const text = formatFloatField(field, row.bits, row.width);
        expect(parseFloatField(field, text, row.bits, row.width)).toEqual({ kind: "ok", bits: row.bits });
      });
    }
    if (!row.kind.includes("NaN")) {
      test(`${row.width}-bit ${row.name} via value`, () => {
        const outcome = parseFloatField("value", row.value, 0n, row.width);
        expect(outcome.kind === "ok" || outcome.kind === "rounded").toBe(true);
        expect("bits" in outcome && outcome.bits).toBe(row.bits);
      });
    }
  }
});

describe("typing a value rounds exactly, ties to even", () => {
  const CASES: Array<{ text: string; width: FloatWidth; bits: bigint; exact: boolean }> = [
    { text: "0.1", width: 32, bits: 0x3dcccccdn, exact: false },
    { text: "0.1", width: 64, bits: 0x3fb999999999999an, exact: false },
    { text: "0.5", width: 32, bits: 0x3f000000n, exact: true },
    { text: "-2.5", width: 64, bits: 0xc004000000000000n, exact: true },
    { text: "0", width: 32, bits: 0x00000000n, exact: true },
    { text: "-0", width: 32, bits: 0x80000000n, exact: true },
    { text: "-0.000e7", width: 64, bits: 0x8000000000000000n, exact: true },
    { text: "1e-45", width: 32, bits: 0x00000001n, exact: false },
    { text: "7.1e-46", width: 32, bits: 0x00000001n, exact: false },
    { text: "5e-324", width: 64, bits: 0x0000000000000001n, exact: false },
    { text: "3.4028235e38", width: 32, bits: 0x7f7fffffn, exact: false },
    { text: "1.7976931348623157e308", width: 64, bits: 0x7fefffffffffffffn, exact: false },
    { text: "16777216", width: 32, bits: 0x4b800000n, exact: true },
    // 2^24 + 1 sits halfway between two floats; the even one wins.
    { text: "16777217", width: 32, bits: 0x4b800000n, exact: false },
    { text: "16777219", width: 32, bits: 0x4b800002n, exact: false },
    // Just above halfway between 1 and the next float. Reading it as a
    // double first rounds it onto the halfway point, then to even (0x3f800000):
    // the double-rounding bug exact BigInt rounding exists to avoid.
    { text: "1.00000005960464477550", width: 32, bits: 0x3f800001n, exact: false },
    { text: ".5e1", width: 32, bits: 0x40a00000n, exact: true },
    { text: "+6.02e23", width: 64, bits: 0x44dfde9f10a8d361n, exact: false },
    { text: "inf", width: 32, bits: 0x7f800000n, exact: true },
    { text: "-Infinity", width: 64, bits: 0xfff0000000000000n, exact: true },
    { text: "nan", width: 32, bits: 0x7fc00000n, exact: true },
    { text: "-NaN", width: 64, bits: 0xfff8000000000000n, exact: true },
  ];
  for (const c of CASES) {
    test(`${JSON.stringify(c.text)} at ${c.width} bits`, () => {
      const outcome = parseFloatField("value", c.text, 0n, c.width);
      if (c.exact) {
        expect(outcome).toEqual({ kind: "ok", bits: c.bits });
      } else {
        expect(outcome.kind).toBe("rounded");
        if (outcome.kind === "rounded") {
          expect(outcome.bits).toBe(c.bits);
          expect(outcome.message).toContain(`not exact in ${c.width} bits`);
        }
      }
    });
  }
});

describe("bad text is refused with a message, never a wrong value", () => {
  const CASES: Array<{ field: FloatField; text: string; width: FloatWidth; kind: "invalid" | "range"; expectIn: string }> = [
    { field: "value", text: "abc", width: 32, kind: "invalid", expectIn: "decimal" },
    { field: "value", text: "1.2.3", width: 32, kind: "invalid", expectIn: "decimal" },
    { field: "value", text: "--1", width: 32, kind: "invalid", expectIn: "decimal" },
    { field: "value", text: "0x10", width: 32, kind: "invalid", expectIn: "decimal" },
    { field: "value", text: ".", width: 64, kind: "invalid", expectIn: "decimal" },
    { field: "value", text: "1e", width: 64, kind: "invalid", expectIn: "decimal" },
    { field: "value", text: "1".repeat(2001), width: 64, kind: "invalid", expectIn: "decimal" },
    { field: "value", text: "3.5e38", width: 32, kind: "range", expectIn: "3.4028235e+38" },
    { field: "value", text: "-1e39", width: 32, kind: "range", expectIn: "type inf" },
    { field: "value", text: "1.8e308", width: 64, kind: "range", expectIn: "1.7976931348623157e+308" },
    { field: "value", text: "1e999999999", width: 64, kind: "range", expectIn: "largest" },
    // Below half the smallest subnormal, and exactly half (2^-150), both round to 0.
    { field: "value", text: "7e-46", width: 32, kind: "range", expectIn: "round to 0" },
    {
      field: "value",
      text: "7.00649232162408535461864791644958065640130970938257885878534141944895541342930300743319094181060791015625e-46",
      width: 32, kind: "range", expectIn: "1e-45",
    },
    { field: "value", text: "2e-324", width: 64, kind: "range", expectIn: "5e-324" },
    { field: "value", text: "1e-999999999", width: 64, kind: "range", expectIn: "round to 0" },
    { field: "sign", text: "2", width: 32, kind: "invalid", expectIn: "0 (positive) or 1 (negative)" },
    { field: "sign", text: "-", width: 32, kind: "invalid", expectIn: "0 (positive) or 1 (negative)" },
    { field: "exponent", text: "256", width: 32, kind: "range", expectIn: "0 to 255" },
    { field: "exponent", text: "2048", width: 64, kind: "range", expectIn: "0 to 2047" },
    { field: "exponent", text: "-1", width: 32, kind: "invalid", expectIn: "whole number" },
    { field: "exponent", text: "12a", width: 32, kind: "invalid", expectIn: "whole number" },
    { field: "unbiased", text: "129", width: 32, kind: "range", expectIn: "-127 to 128" },
    { field: "unbiased", text: "-128", width: 32, kind: "range", expectIn: "bias 127" },
    { field: "unbiased", text: "1025", width: 64, kind: "range", expectIn: "-1023 to 1024" },
    { field: "unbiased", text: "1.5", width: 64, kind: "invalid", expectIn: "whole number" },
    { field: "fraction", text: "800000", width: 32, kind: "range", expectIn: "0x7fffff" },
    { field: "fraction", text: "10000000000000", width: 64, kind: "range", expectIn: "0xfffffffffffff" },
    { field: "fraction", text: "0xg", width: 32, kind: "invalid", expectIn: "0-9 and a-f" },
  ];
  for (const c of CASES) {
    test(`${c.field} ${JSON.stringify(c.text.slice(0, 24))} at ${c.width} bits`, () => {
      const outcome = parseFloatField(c.field, c.text, 0x3f800000n, c.width);
      expect(outcome.kind).toBe(c.kind);
      if (outcome.kind === "invalid" || outcome.kind === "range") {
        expect(outcome.message).toContain(c.expectIn);
      }
    });
  }

  test("an empty field, or a bare 0x fraction, is empty in every field", () => {
    for (const field of [...FIELDS, "value"] as const) {
      expect(parseFloatField(field, "", 0n, 32)).toEqual({ kind: "empty" });
      expect(parseFloatField(field, "   ", 0n, 64)).toEqual({ kind: "empty" });
    }
    expect(parseFloatField("fraction", "0x", 0n, 32)).toEqual({ kind: "empty" });
  });
});

describe("editing one field keeps the others", () => {
  test("sign 1 turns 1.0 into -1.0", () => {
    expect(parseFloatField("sign", "1", 0x3f800000n, 32)).toEqual({ kind: "ok", bits: 0xbf800000n });
  });
  test("raw exponent 128 turns 1.0 into 2.0", () => {
    expect(parseFloatField("exponent", "128", 0x3f800000n, 32)).toEqual({ kind: "ok", bits: 0x40000000n });
  });
  test("unbiased exponent: 1 doubles, -127 lands on zero, 128 on infinity", () => {
    expect(parseFloatField("unbiased", "1", 0x3f800000n, 32)).toEqual({ kind: "ok", bits: 0x40000000n });
    expect(parseFloatField("unbiased", "-127", 0x3f800000n, 32)).toEqual({ kind: "ok", bits: 0x00000000n });
    expect(parseFloatField("unbiased", "128", 0x3f800000n, 32)).toEqual({ kind: "ok", bits: 0x7f800000n });
    expect(parseFloatField("unbiased", "+1024", 0x3ff0000000000000n, 64)).toEqual({ kind: "ok", bits: 0x7ff0000000000000n });
  });
  test("the fraction under an all-ones exponent picks quiet or signalling NaN", () => {
    expect(parseFloatField("fraction", "400000", 0x7f800000n, 32)).toEqual({ kind: "ok", bits: 0x7fc00000n });
    expect(parseFloatField("fraction", "0x1", 0x7f800000n, 32)).toEqual({ kind: "ok", bits: 0x7f800001n });
    expect(classify(0x7f800001n, 32)).toBe("signalling NaN");
  });
});

describe("the power-of-two form and the field bits", () => {
  test("0.1 single is +1.60000002384185791015625 x 2^-4", () => {
    expect(powerOfTwoForm(0x3dcccccdn, 32)).toEqual({ significand: "+1.60000002384185791015625", power: -4 });
  });
  test("a subnormal has no hidden 1 and sits at the lowest power", () => {
    expect(powerOfTwoForm(0x007fffffn, 32)).toEqual({ significand: "+0.99999988079071044921875", power: -126 });
    expect(powerOfTwoForm(0x0000000000000001n, 64)?.power).toBe(-1022);
  });
  test("negative values carry the sign", () => {
    expect(powerOfTwoForm(0xc0200000n, 32)).toEqual({ significand: "-1.25", power: 1 });
  });
  test("zero, infinity, and NaN have no such form", () => {
    expect(powerOfTwoForm(0x80000000n, 32)).toBeNull();
    expect(powerOfTwoForm(0x7ff0000000000000n, 64)).toBeNull();
    expect(powerOfTwoForm(0x7fc00000n, 32)).toBeNull();
  });
  test("field bits group in fours from the right", () => {
    expect(fieldBinary(0x3dcccccdn, 32)).toEqual({
      sign: "0",
      exponent: "0111 1011",
      fraction: "100 1100 1100 1100 1100 1101",
    });
    expect(fieldBinary(0xbff0000000000000n, 64)).toEqual({
      sign: "1",
      exponent: "011 1111 1111",
      fraction: Array(13).fill("0000").join(" "),
    });
  });
});

describe("agreement with the platform's own correctly rounded conversions", () => {
  // A fixed-seed generator, so a failure names the same pattern every run.
  function* patterns(width: FloatWidth, count: number): Generator<bigint> {
    let state = 0x2545f4914f6cdd1dn;
    const mask = (1n << BigInt(width)) - 1n;
    for (let i = 0; i < count; i++) {
      state = (state * 6364136223846793005n + 1442695040888963407n) & 0xffffffffffffffffn;
      yield (state ^ (state >> 29n)) & mask;
    }
  }

  test("64-bit: JS's shortest text parses back to the same bits, and so does the exact value", () => {
    for (const bits of patterns(64, 400)) {
      if (classify(bits, 64).includes("NaN")) continue;
      const x = floatValue(bits, 64);
      const outcome = parseFloatField("value", String(x), 0n, 64);
      expect("bits" in outcome && outcome.bits).toBe(bits);
      if (Number.isFinite(x)) expect(Number(exactValue(bits, 64))).toBe(x);
    }
  });

  // The fewest significant digits that read back as this single, by brute
  // force over the platform's conversions: at each length, the nearest
  // decimal and one step either side, plus the all-nines one a place lower
  // for when the nearest rounded up to 1.000...
  function fewestDigits(x: number): number {
    const target = Math.abs(x);
    for (let length = 1; length < 9; length++) {
      const [mantissa, exponent] = target.toExponential(length - 1).split("e");
      const n = Number(mantissa.replace(".", ""));
      const scale = Number(exponent) - (length - 1);
      const tries = [n - 1, n, n + 1].map((m) => `${m}e${scale}`);
      if (n === 10 ** (length - 1)) tries.push(`${10 ** length - 1}e${scale - 1}`);
      if (tries.some((t) => Math.fround(Number(t)) === target)) return length;
    }
    return 9;
  }

  const significantDigits = (text: string) =>
    text.replace(/^-/, "").split("e")[0].replace(".", "").replace(/^0+/, "").replace(/0+$/, "").length;

  test("32-bit: the text is as short as any that reads back as the same single", () => {
    // Every normal power of two, where the gap below is half the gap above.
    const powersOfTwo = Array.from({ length: 254 }, (_, i) => BigInt(i + 1) << 23n);
    for (const bits of [...patterns(32, 400), ...powersOfTwo]) {
      const kind = classify(bits, 32);
      if (kind.includes("NaN")) continue;
      const text = formatFloatValue(bits, 32);
      const outcome = parseFloatField("value", text, 0n, 32);
      expect("bits" in outcome && outcome.bits).toBe(bits);
      if (kind === "normal" || kind === "subnormal") {
        const x = floatValue(bits, 32);
        expect(Math.fround(Number(text))).toBe(x);
        expect({ text, digits: significantDigits(text) }).toEqual({ text, digits: fewestDigits(x) });
      }
    }
  });
});

describe("the shortest 32-bit text picks the right decimal", () => {
  // Worked out with numpy's shortest float32 repr. At a power of two the
  // nearest 8-digit decimal falls outside the single's rounding range while
  // the one just above it reads back.
  const CASES: Array<{ bits: bigint; text: string }> = [
    { bits: 0x6b000000n, text: "1.5474251e+26" },
    { bits: 0x0f800000n, text: "1.2621775e-29" },
    { bits: 0x6c800000n, text: "1.2379401e+27" },
    { bits: 0xeb000000n, text: "-1.5474251e+26" },
    { bits: 0x8f800000n, text: "-1.2621775e-29" },
    { bits: 0xec800000n, text: "-1.2379401e+27" },
    // Exactly halfway between two 8-digit decimals that both read back:
    // 2^-12 is 0.000244140625 and 0x48c31d44 is 399594.125. The even one wins.
    { bits: 0x39800000n, text: "0.00024414062" },
    { bits: 0x48c31d44n, text: "399594.12" },
  ];
  for (const c of CASES) {
    test(`0x${c.bits.toString(16).padStart(8, "0")} prints ${c.text}`, () => {
      expect(formatFloatValue(c.bits, 32)).toBe(c.text);
    });
  }
});

test("only 32 and 64 have an IEEE-754 reading here", () => {
  expect(isFloatWidth(32)).toBe(true);
  expect(isFloatWidth(64)).toBe(true);
  expect(isFloatWidth(16)).toBe(false);
  expect(isFloatWidth(8)).toBe(false);
});
