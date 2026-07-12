import { describe, expect, it } from "vitest";
import { labelForOffset, parseFrameSlots } from "@/lib/emulator/frame-labels";

describe("frame labels", () => {
  it("captures plain decimal assignments", () => {
    const slots = parseFrameSlots(`score1_s = 16
score2_s = 20
score3_s = 24
`);
    expect(slots).toEqual([
      { offset: 16, name: "score1_s" },
      { offset: 20, name: "score2_s" },
      { offset: 24, name: "score3_s" },
    ]);
  });

  it("captures hex assignments", () => {
    const slots = parseFrameSlots("addr_s = 0x40\n");
    expect(slots).toEqual([{ offset: 64, name: "addr_s" }]);
  });

  it("ignores negative values (those are alloc totals)", () => {
    const slots = parseFrameSlots("alloc = -32\nsomething_s = 16\n");
    expect(slots.map((s) => s.name)).toEqual(["something_s"]);
  });

  it("ignores assignments with expression bodies", () => {
    // `alloc = -(16 + 16) & -16` isn't a plain integer; the client-side
    // parser skips it (the linker resolves it properly at assemble time).
    const slots = parseFrameSlots("alloc = -(16 + 16) & -16\nx_s = 8\n");
    expect(slots).toEqual([{ offset: 8, name: "x_s" }]);
  });

  it("sorts results by ascending offset", () => {
    const slots = parseFrameSlots("b_s = 40\na_s = 8\nc_s = 24\n");
    expect(slots.map((s) => s.offset)).toEqual([8, 24, 40]);
  });

  it("tolerates trailing comments and whitespace", () => {
    const slots = parseFrameSlots(`x_s = 16   // first local
y_s = 20 ; another local
`);
    expect(slots).toEqual([
      { offset: 16, name: "x_s" },
      { offset: 20, name: "y_s" },
    ]);
  });

  it("labelForOffset finds matching slot or returns null", () => {
    const slots = [
      { offset: 16, name: "x_s" },
      { offset: 24, name: "y_s" },
    ];
    expect(labelForOffset(slots, 16)).toBe("x_s");
    expect(labelForOffset(slots, 24)).toBe("y_s");
    expect(labelForOffset(slots, 32)).toBeNull();
  });
});

// Parse edge cases: the offset window (0, 512], spacing and hex variants,
// duplicate offsets, and bodies that are not plain integer literals.

describe("frame label parse edge cases", () => {
  it("keeps 512 (the cap) and drops 513 and 0", () => {
    const slots = parseFrameSlots("edge_s = 512\nover_s = 513\nzero_s = 0\n");
    expect(slots).toEqual([{ offset: 512, name: "edge_s" }]);
  });

  it("keeps offset 1, the smallest valid slot", () => {
    expect(parseFrameSlots("one_s = 1\n")).toEqual([{ offset: 1, name: "one_s" }]);
  });

  it("only the lowercase 0x hex prefix matches; 0X is skipped", () => {
    // The assignment regex admits only `0x`; an uppercase prefix fails the
    // line match before the value is ever parsed.
    expect(parseFrameSlots("addr_s = 0X20\n")).toEqual([]);
  });

  it("accepts assignments without spaces and with leading indentation", () => {
    const slots = parseFrameSlots("a_s=8\n    b_s = 16\n");
    expect(slots).toEqual([
      { offset: 8, name: "a_s" },
      { offset: 16, name: "b_s" },
    ]);
  });

  it("accepts a leading-underscore name", () => {
    expect(parseFrameSlots("_tmp_s = 8\n")).toEqual([{ offset: 8, name: "_tmp_s" }]);
  });

  it("keeps duplicate offsets in source order, and labelForOffset returns the first", () => {
    const slots = parseFrameSlots("first_s = 16\nsecond_s = 16\n");
    expect(slots).toEqual([
      { offset: 16, name: "first_s" },
      { offset: 16, name: "second_s" },
    ]);
    expect(labelForOffset(slots, 16)).toBe("first_s");
  });

  it("skips a line with trailing garbage after the value", () => {
    expect(parseFrameSlots("x_s = 16 extra\n")).toEqual([]);
  });

  it("skips fractional and negative-hex bodies", () => {
    expect(parseFrameSlots("x_s = 16.5\n")).toEqual([]);
    expect(parseFrameSlots("x_s = -0x20\ny_s = 8\n")).toEqual([{ offset: 8, name: "y_s" }]);
  });

  it("returns an empty list for empty source", () => {
    expect(parseFrameSlots("")).toEqual([]);
  });

  it("does not treat define(name, value) aliases as slots", () => {
    // Register aliases use the m4 define() form; only `name = <integer>`
    // assignments describe frame offsets.
    expect(parseFrameSlots("define(x_r, w19)\ndefine(size_s, 16)\n")).toEqual([]);
  });
});
