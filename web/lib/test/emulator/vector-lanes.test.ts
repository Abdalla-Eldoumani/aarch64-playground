// Pins the vector lane slicer: lane 0 is the LEAST significant end, the hex
// is unsigned, and the decimal is two's complement at the lane's own width.
// Every expected value below is written out by hand from the one pattern,
// never produced by sliceLanes itself.
import { describe, expect, it } from "vitest";
import {
  LANE_BYTES,
  laneCount,
  sliceLanes,
  upperHalfMoved,
} from "@/lib/emulator/vector-lanes";

// 0x0123456789abcdef in the high 64 bits, 0xfedcba9876543210 in the low.
const PATTERN = "0x0123456789abcdeffedcba9876543210";

describe("sliceLanes", () => {
  it("counts lanes by width", () => {
    expect(laneCount("b")).toBe(16);
    expect(laneCount("h")).toBe(8);
    expect(laneCount("s")).toBe(4);
    expect(laneCount("d")).toBe(2);
    expect(LANE_BYTES).toEqual({ b: 1, h: 2, s: 4, d: 8 });
  });

  it("slices d lanes with lane 0 at the low end", () => {
    const lanes = sliceLanes(PATTERN, "d");
    expect(lanes.map((l) => l.hex)).toEqual([
      "fedcba9876543210",
      "0123456789abcdef",
    ]);
    // 0xfedcba9876543210 is 2^64 - 81985529216486896.
    expect(lanes.map((l) => l.signed)).toEqual([
      "-81985529216486896",
      "81985529216486895",
    ]);
    expect(lanes.map((l) => l.index)).toEqual([0, 1]);
  });

  it("slices s lanes", () => {
    const lanes = sliceLanes(PATTERN, "s");
    expect(lanes.map((l) => l.hex)).toEqual([
      "76543210",
      "fedcba98",
      "89abcdef",
      "01234567",
    ]);
    expect(lanes.map((l) => l.signed)).toEqual([
      "1985229328",
      "-19088744",
      "-1985229329",
      "19088743",
    ]);
  });

  it("slices h lanes", () => {
    const lanes = sliceLanes(PATTERN, "h");
    expect(lanes.map((l) => l.hex)).toEqual([
      "3210",
      "7654",
      "ba98",
      "fedc",
      "cdef",
      "89ab",
      "4567",
      "0123",
    ]);
    expect(lanes.map((l) => l.signed)).toEqual([
      "12816",
      "30292",
      "-17768",
      "-292",
      "-12817",
      "-30293",
      "17767",
      "291",
    ]);
  });

  it("slices b lanes", () => {
    const lanes = sliceLanes(PATTERN, "b");
    expect(lanes.map((l) => l.hex)).toEqual([
      "10", "32", "54", "76", "98", "ba", "dc", "fe",
      "ef", "cd", "ab", "89", "67", "45", "23", "01",
    ]);
    expect(lanes.map((l) => l.signed)).toEqual([
      "16", "50", "84", "118", "-104", "-70", "-36", "-2",
      "-17", "-51", "-85", "-119", "103", "69", "35", "1",
    ]);
  });

  it("re-slicing never changes the bits", () => {
    // The lanes, read most significant first, are the register's own digits.
    for (const width of ["b", "h", "s", "d"] as const) {
      const joined = sliceLanes(PATTERN, width)
        .map((l) => l.hex)
        .reverse()
        .join("");
      expect(joined).toBe("0123456789abcdeffedcba9876543210");
    }
  });

  it("pads a short value and reads junk as zero rather than throwing", () => {
    expect(sliceLanes("0x2a", "d").map((l) => l.hex)).toEqual([
      "000000000000002a",
      "0000000000000000",
    ]);
    expect(sliceLanes("", "d").map((l) => l.signed)).toEqual(["0", "0"]);
    expect(sliceLanes("not hex", "s").map((l) => l.hex)).toEqual([
      "00000000",
      "00000000",
      "00000000",
      "00000000",
    ]);
  });
});

describe("upperHalfMoved", () => {
  it("sees a change above bit 63 and ignores one below it", () => {
    const zero = "0x00000000000000000000000000000000";
    const low = "0x0000000000000000ffffffffffffffff";
    const high = "0x00000000000000010000000000000000";
    expect(upperHalfMoved(zero, low)).toBe(false);
    expect(upperHalfMoved(zero, high)).toBe(true);
    expect(upperHalfMoved(low, high)).toBe(true);
    expect(upperHalfMoved(PATTERN, PATTERN)).toBe(false);
  });
});
