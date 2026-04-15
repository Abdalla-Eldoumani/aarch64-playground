import { describe, expect, it } from "vitest";
import { labelForOffset, parseFrameSlots } from "./frame-labels";

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
