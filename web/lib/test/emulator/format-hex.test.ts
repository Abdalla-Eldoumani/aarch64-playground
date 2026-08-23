// pins the shared hex formatters: the 64-bit and 32-bit widths every
// readout renders at, the unsigned reading of a negative, and the fact
// that a value too wide for 32 bits keeps its digits instead of being
// truncated to a wrong address.
import { describe, expect, it } from "vitest";
import { formatByte, formatWord32, formatWord64 } from "@/lib/emulator/format-hex";

describe("formatWord64", () => {
  it("renders zero as 0x plus 16 nibbles", () => {
    expect(formatWord64(0)).toBe("0x0000000000000000");
  });

  it("pads a small value to the full width", () => {
    expect(formatWord64(0x400008)).toBe("0x0000000000400008");
  });

  it("takes a bigint as well as a number", () => {
    expect(formatWord64(0x7ffffff0n)).toBe("0x000000007ffffff0");
  });

  it("renders the maximum 64-bit value", () => {
    expect(formatWord64(0xffffffffffffffffn)).toBe("0xffffffffffffffff");
  });

  it("reads a negative bigint as its unsigned 64-bit pattern", () => {
    expect(formatWord64(-1n)).toBe("0xffffffffffffffff");
    expect(formatWord64(-2n)).toBe("0xfffffffffffffffe");
  });
});

describe("formatWord32", () => {
  it("renders zero as 0x plus 8 nibbles", () => {
    expect(formatWord32(0)).toBe("0x00000000");
  });

  it("pads a small address to the full width", () => {
    expect(formatWord32(0x400000)).toBe("0x00400000");
  });

  it("renders the maximum 32-bit value", () => {
    expect(formatWord32(0xffffffff)).toBe("0xffffffff");
  });

  it("reads a negative as its unsigned 32-bit pattern", () => {
    // A word assembled with `|` from four bytes is a signed int32:
    // `ret` is 0xd65f03c0 = 3596551104, which arrives as 3596551104 -
    // 2^32 = -698416192.
    expect(formatWord32(-1)).toBe("0xffffffff");
    expect(formatWord32(-698416192)).toBe("0xd65f03c0");
  });

  it("keeps the digits of a value too wide for 32 bits", () => {
    // The memory panel's address box is unbounded; truncating a typed
    // 0x100000000 to 0x00000000 would point the reader elsewhere.
    expect(formatWord32(0x100000000)).toBe("0x100000000");
  });
});

describe("formatByte", () => {
  it("renders two nibbles with no prefix", () => {
    expect(formatByte(0)).toBe("00");
    expect(formatByte(0xf)).toBe("0f");
    expect(formatByte(0xff)).toBe("ff");
  });

  it("keeps only the low eight bits", () => {
    expect(formatByte(0x1ff)).toBe("ff");
  });
});
