import { describe, expect, it } from "vitest";
import {
  emptyLineMap,
  isEmptyLineMap,
  lineToAddrFromMap,
  parseLineMap,
  pcToSourceLineFromMap,
} from "./line-map";

const CODE_BASE = 0x400000;

// A synthetic map mirroring the complex program's shape: three .text
// instructions whose editor lines (14, 15, 34) skip the intervening
// data/define/label lines. No wasm involved.
const COMPLEX_FLAT = [
  CODE_BASE, 14,
  CODE_BASE + 4, 15,
  CODE_BASE + 0x40, 34,
];

describe("parseLineMap", () => {
  it("parses a well-formed flat array into both directions", () => {
    const map = parseLineMap(COMPLEX_FLAT);
    expect(isEmptyLineMap(map)).toBe(false);
    expect(map.addrToLine.get(CODE_BASE)).toBe(14);
    expect(map.addrToLine.get(CODE_BASE + 0x40)).toBe(34);
    expect(map.lineToAddr.get(34)).toBe(CODE_BASE + 0x40);
  });

  it("treats an empty array as an empty map (fall back to legacy)", () => {
    const map = parseLineMap([]);
    expect(isEmptyLineMap(map)).toBe(true);
  });

  it("treats null/undefined as an empty map", () => {
    expect(isEmptyLineMap(parseLineMap(null))).toBe(true);
    expect(isEmptyLineMap(parseLineMap(undefined))).toBe(true);
  });

  it("rejects an odd-length array defensively", () => {
    const map = parseLineMap([CODE_BASE, 14, CODE_BASE + 4]);
    expect(isEmptyLineMap(map)).toBe(true);
  });

  it("rejects non-finite values defensively", () => {
    expect(isEmptyLineMap(parseLineMap([CODE_BASE, Number.NaN]))).toBe(true);
    expect(isEmptyLineMap(parseLineMap([Number.POSITIVE_INFINITY, 14]))).toBe(true);
  });

  it("keeps the first address seen for a repeated editor line", () => {
    const map = parseLineMap([CODE_BASE, 14, CODE_BASE + 4, 14]);
    expect(map.lineToAddr.get(14)).toBe(CODE_BASE);
  });
});

describe("pcToSourceLineFromMap", () => {
  it("returns the editor line for a mapped pc", () => {
    const map = parseLineMap(COMPLEX_FLAT);
    expect(pcToSourceLineFromMap(CODE_BASE, map)).toBe(14);
    // A high editor line resolves correctly with the data/define lines
    // skipped -- the exact drift the fix targets.
    expect(pcToSourceLineFromMap(CODE_BASE + 0x40, map)).toBe(34);
  });

  it("returns null for an unmapped pc", () => {
    const map = parseLineMap(COMPLEX_FLAT);
    expect(pcToSourceLineFromMap(CODE_BASE + 8, map)).toBeNull();
  });

  it("returns null for an empty map (signals fall back)", () => {
    expect(pcToSourceLineFromMap(CODE_BASE, emptyLineMap())).toBeNull();
  });
});

describe("lineToAddrFromMap", () => {
  it("returns the instruction address at an exact editor line", () => {
    const map = parseLineMap(COMPLEX_FLAT);
    expect(lineToAddrFromMap(15, map)).toBe(CODE_BASE + 4);
  });

  it("returns the next instruction at/after a line with no instruction", () => {
    const map = parseLineMap(COMPLEX_FLAT);
    // Line 20 (e.g. a `loop:` label) has no instruction; a breakpoint
    // there resolves to the next real instruction, line 34's address.
    expect(lineToAddrFromMap(20, map)).toBe(CODE_BASE + 0x40);
  });

  it("returns null when no instruction is at or after the line", () => {
    const map = parseLineMap(COMPLEX_FLAT);
    expect(lineToAddrFromMap(99, map)).toBeNull();
  });

  it("returns null for an empty map (signals fall back)", () => {
    expect(lineToAddrFromMap(14, emptyLineMap())).toBeNull();
  });
});
