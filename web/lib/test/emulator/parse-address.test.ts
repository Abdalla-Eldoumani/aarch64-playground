// pins the strict address parse the memory panels share: 0x-hex in either
// case or a bare decimal, surrounding whitespace tolerated, and null for
// everything else. The reason it is strict is parseInt's prefix parsing --
// "0x0060O000" (a capital O for the second zero) used to come back as 0x60
// and relocate the memory window to an address full of zeros.
import { describe, expect, it } from "vitest";
import { parseAddress } from "@/lib/emulator/parse-address";

describe("parseAddress", () => {
  it("reads 0x hex, whatever case the prefix and digits are in", () => {
    expect(parseAddress("0x400000")).toBe(4194304);
    expect(parseAddress("0X400000")).toBe(4194304);
    expect(parseAddress("0xdeadbeef")).toBe(3735928559);
    expect(parseAddress("0xDEADBEEF")).toBe(3735928559);
    expect(parseAddress("0xAbCdEf")).toBe(11259375);
  });

  it("reads a bare decimal", () => {
    expect(parseAddress("4194304")).toBe(4194304);
    expect(parseAddress("1024")).toBe(1024);
  });

  it("tolerates whitespace around the value", () => {
    expect(parseAddress("  0x400000  ")).toBe(4194304);
    expect(parseAddress("\t1024\n")).toBe(1024);
  });

  it("rejects a hex address with a letter that is not a hex digit", () => {
    // Capital O for the second zero: the slip the strictness exists for.
    expect(parseAddress("0x0060O000")).toBeNull();
    expect(parseAddress("0x00600z0")).toBeNull();
    expect(parseAddress("0xg")).toBeNull();
  });

  it("rejects an empty or whitespace-only entry", () => {
    expect(parseAddress("")).toBeNull();
    expect(parseAddress("   ")).toBeNull();
    expect(parseAddress("\n\t")).toBeNull();
  });

  it("rejects a prefix with no digits behind it", () => {
    expect(parseAddress("0x")).toBeNull();
    expect(parseAddress("0X")).toBeNull();
  });

  it("rejects negatives, signs, floats, and digit separators", () => {
    expect(parseAddress("-4")).toBeNull();
    expect(parseAddress("-0x40")).toBeNull();
    expect(parseAddress("+1024")).toBeNull();
    expect(parseAddress("1.5")).toBeNull();
    expect(parseAddress("0x1.8")).toBeNull();
    expect(parseAddress("1_000")).toBeNull();
    expect(parseAddress("0x40_00")).toBeNull();
    expect(parseAddress("1e3")).toBeNull();
  });

  it("rejects other radix spellings and trailing junk", () => {
    expect(parseAddress("0b1010")).toBeNull();
    expect(parseAddress("0o17")).toBeNull();
    expect(parseAddress("40h")).toBeNull();
    expect(parseAddress("0x40 00")).toBeNull();
    expect(parseAddress("0x40,0")).toBeNull();
    expect(parseAddress("Infinity")).toBeNull();
    expect(parseAddress("NaN")).toBeNull();
  });

  it("parses the boundaries: zero in both spellings, and a 48-bit address", () => {
    // Zero is a real address (a null-pointer read the emulator faults on),
    // so it must come back as 0 and not as "no address".
    expect(parseAddress("0")).toBe(0);
    expect(parseAddress("0x0")).toBe(0);
    expect(parseAddress("0x0000000000000000")).toBe(0);
    // The top of the emulator's 48-bit address space, and the largest value
    // a JS number holds exactly (2^53 - 1).
    expect(parseAddress("0xffffffffffff")).toBe(281474976710655);
    expect(parseAddress("0x1fffffffffffff")).toBe(9007199254740991);
  });
});
