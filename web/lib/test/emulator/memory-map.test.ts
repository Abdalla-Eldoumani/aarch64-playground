// pins the address-band lookup the memory panel labels from: half-open
// [start, end) bands, the gaps between them, the stub range at the top of the
// space, and the empty table an older wasm build reports.
import { describe, expect, it } from "vitest";
import {
  normalizeMemoryMap,
  regionFor,
  type MemoryRegion,
} from "@/lib/emulator/memory-map";

// The emulator's eight bands, transcribed by hand from the loader constants
// (CODE_BASE 0x00400000 with a 1 MiB SECTION_WINDOW spacing the four
// sections, ARGV_BASE + one page, HEAP_BASE + 16 MiB, the 8 MiB stack band
// below STACK_BASE, and 256 16-byte stub slots at 0xFFFF0000). Literals, not
// a re-derivation: the wasm-contract suite is what pins them to the crate.
const REGIONS: MemoryRegion[] = [
  { name: ".text", start: 0x00400000, end: 0x00500000 },
  { name: ".rodata", start: 0x00500000, end: 0x00600000 },
  { name: ".data", start: 0x00600000, end: 0x00700000 },
  { name: ".bss", start: 0x00700000, end: 0x00800000 },
  { name: "argv", start: 0x00800000, end: 0x00801000 },
  { name: "heap", start: 0x00900000, end: 0x01900000 },
  { name: "stack", start: 0x7f800000, end: 0x80000000 },
  { name: "host stubs", start: 0xffff0000, end: 0xffff1000 },
];

describe("regionFor", () => {
  it("names the band holding the first byte", () => {
    expect(regionFor(0x00600000, REGIONS)?.name).toBe(".data");
    expect(regionFor(0x7f800000, REGIONS)?.name).toBe("stack");
  });

  it("names the band holding the last byte and excludes the end address", () => {
    // Bands are half-open: 0x006fffff is still .data, 0x00700000 is .bss.
    expect(regionFor(0x006fffff, REGIONS)?.name).toBe(".data");
    expect(regionFor(0x00700000, REGIONS)?.name).toBe(".bss");
    // The stack's end is the stack base itself, which is not mapped stack.
    expect(regionFor(0x7fffffff, REGIONS)?.name).toBe("stack");
    expect(regionFor(0x80000000, REGIONS)).toBeNull();
  });

  it("reports the gaps between bands as unmapped", () => {
    // argv is one page, so the rest of its megabyte is a gap...
    expect(regionFor(0x00801000, REGIONS)).toBeNull();
    // ...and so is everything between the heap's end and the stack floor.
    expect(regionFor(0x01900000, REGIONS)).toBeNull();
    expect(regionFor(0x40000000, REGIONS)).toBeNull();
  });

  it("names the host-stub range at the top of the space", () => {
    expect(regionFor(0xffff0000, REGIONS)?.name).toBe("host stubs");
    expect(regionFor(0xffff0ff0, REGIONS)?.name).toBe("host stubs");
    expect(regionFor(0xffff1000, REGIONS)).toBeNull();
  });

  it("reports the null page and anything past the last band as unmapped", () => {
    expect(regionFor(0, REGIONS)).toBeNull();
    expect(regionFor(0xffffffff, REGIONS)).toBeNull();
  });

  it("finds nothing in an empty table (the pre-export wasm build)", () => {
    expect(regionFor(0x00600000, [])).toBeNull();
  });
});

describe("normalizeMemoryMap", () => {
  it("keeps well-formed rows and coerces the numbers", () => {
    expect(normalizeMemoryMap([{ name: ".data", start: 0x00600000, end: 0x00700000 }])).toEqual([
      { name: ".data", start: 0x00600000, end: 0x00700000 },
    ]);
  });

  it("drops rows the panel could not label and non-arrays", () => {
    const rows = [
      { name: ".text", start: 0x00400000, end: 0x00500000 },
      { start: 1, end: 2 },
      { name: "broken", start: Number.NaN, end: 4 },
      { name: "missing end", start: 5 },
    ];
    expect(normalizeMemoryMap(rows)).toEqual([
      { name: ".text", start: 0x00400000, end: 0x00500000 },
    ]);
    expect(normalizeMemoryMap(null)).toEqual([]);
    expect(normalizeMemoryMap(undefined)).toEqual([]);
  });
});
