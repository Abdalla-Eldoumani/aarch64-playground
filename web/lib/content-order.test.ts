import { describe, expect, it } from "vitest";
import { compareByOrder } from "./content-order";

describe("compareByOrder", () => {
  it("orders two numeric orders numerically (not lexically)", () => {
    expect(compareByOrder({ order: 1 }, { order: 2 })).toBeLessThan(0);
    expect(compareByOrder({ order: 10 }, { order: 2 })).toBeGreaterThan(0);
    expect(compareByOrder({ order: 3 }, { order: 3 })).toBe(0);
  });

  it("orders two string orders via localeCompare", () => {
    expect(compareByOrder({ order: "a" }, { order: "b" })).toBeLessThan(0);
    expect(compareByOrder({ order: "b" }, { order: "a" })).toBeGreaterThan(0);
  });

  it("falls back to a string comparison for a mixed number/string pair", () => {
    expect(compareByOrder({ order: 2 }, { order: "a" })).toBe("2".localeCompare("a"));
    expect(compareByOrder({ order: "a" }, { order: 2 })).toBe("a".localeCompare("2"));
  });

  it("sorts a list of items by their order field", () => {
    const items = [{ order: 3 }, { order: 1 }, { order: 2 }];
    expect([...items].sort(compareByOrder)).toEqual([
      { order: 1 },
      { order: 2 },
      { order: 3 },
    ]);
  });
});
