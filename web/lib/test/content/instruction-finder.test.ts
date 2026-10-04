import { describe, expect, it } from "vitest";
import { REFERENCE_INSTRUCTIONS } from "@/lib/content/reference-data";
import { courseMnemonics } from "@/lib/content/course-instructions";
import {
  FINDER_GROUPS,
  closestInstructions,
  editDistance,
  finderEntries,
  finderSearch,
  findInstructions,
  groupOf,
  readFinderState,
} from "@/lib/content/instruction-finder";

const ENTRIES = finderEntries(REFERENCE_INSTRUCTIONS);
const COURSE = new Set(courseMnemonics(REFERENCE_INSTRUCTIONS.map((i) => i.mnemonic)));

function top(query: string, count = 3): string[] {
  return findInstructions(ENTRIES, query, COURSE)
    .slice(0, count)
    .map((entry) => entry.instruction.mnemonic);
}

describe("the instruction finder's search", () => {
  // The searches a student who does not know a mnemonic yet would type.
  it.each([
    ["multiply", ["mul"]],
    ["shift left", ["lsl"]],
    ["load a byte", ["ldrb", "ldrsb"]],
    ["compare", ["cmp"]],
    ["x * y", ["mul"]],
  ])("finds the right instructions near the top for %j", (query, expected) => {
    const found = top(query);
    for (const mnemonic of expected) expect(found).toContain(mnemonic);
  });

  it("puts the plain instruction first for each example search", () => {
    expect(top("multiply", 1)).toEqual(["mul"]);
    expect(top("shift left", 1)).toEqual(["lsl"]);
    expect(top("load a byte", 1)).toEqual(["ldrb"]);
    expect(top("compare", 1)).toEqual(["cmp"]);
    expect(top("x * y", 1)).toEqual(["mul"]);
  });

  it("still finds an instruction through a small typo", () => {
    expect(top("mvo", 1)).toEqual(["mov"]);
    expect(top("sbu", 1)).toEqual(["sub"]);
  });

  it("does not offer typos when a mnemonic holds what was typed", () => {
    const found = findInstructions(ENTRIES, "add", COURSE).map((e) => e.instruction.mnemonic);
    expect(found).not.toContain("adc");
    expect(found).not.toContain("and");
  });

  it("ranks the exact mnemonic, then names that start with it, then descriptions", () => {
    const found = findInstructions(ENTRIES, "add", COURSE).map((e) => e.instruction.mnemonic);
    expect(found[0]).toBe("add");
    expect(found.indexOf("adds")).toBeLessThan(found.indexOf("madd"));
    // cmn's summary says it compares by adding; no mnemonic of its holds "add".
    expect(found).toContain("cmn");
    expect(found.indexOf("madd")).toBeLessThan(found.indexOf("cmn"));
  });

  it("reads a condition form as b.cond", () => {
    expect(top("b.eq", 1)).toEqual(["b.cond"]);
  });

  it("takes words in any order", () => {
    expect(top("byte load", 1)).toEqual(["ldrb"]);
  });

  it("does not read a pointer cast or a goto as a multiply", () => {
    const found = findInstructions(ENTRIES, "x * y", COURSE).map((e) => e.instruction.mnemonic);
    expect(found).not.toContain("ldr");
    expect(found).not.toContain("br");
  });

  it("lists every row in the reference's order for a blank search", () => {
    expect(findInstructions(ENTRIES, "  ", COURSE).map((e) => e.instruction)).toEqual(
      REFERENCE_INSTRUCTIONS,
    );
  });
});

describe("the closest rows when nothing matches", () => {
  it("is never empty", () => {
    expect(findInstructions(ENTRIES, "xyzzy", COURSE)).toHaveLength(0);
    expect(closestInstructions(ENTRIES, "xyzzy", COURSE)).toHaveLength(5);
  });

  it("prefers rows that share a word of the search", () => {
    const closest = closestInstructions(ENTRIES, "load pineapple", COURSE).map(
      (e) => e.instruction.mnemonic,
    );
    expect(closest).toContain("ldr");
  });
});

describe("editDistance", () => {
  it("counts a swap of neighbours as one edit", () => {
    expect(editDistance("mvo", "mov")).toBe(1);
    expect(editDistance("ldr", "ldr")).toBe(0);
    expect(editDistance("lsl", "lsr")).toBe(1);
  });

  it("gives up past its limit", () => {
    expect(editDistance("a", "sqrdmulh", 2)).toBe(3);
  });
});

describe("the finder's groups", () => {
  it("puts every row in one of the groups", () => {
    const ids = new Set(FINDER_GROUPS.map((group) => group.id));
    for (const instruction of REFERENCE_INSTRUCTIONS) {
      expect(ids.has(groupOf(instruction))).toBe(true);
    }
  });

  it("splits data processing into arithmetic and logic and shifts", () => {
    const byMnemonic = new Map(REFERENCE_INSTRUCTIONS.map((i) => [i.mnemonic, i]));
    expect(groupOf(byMnemonic.get("add")!)).toBe("arithmetic");
    expect(groupOf(byMnemonic.get("lsl")!)).toBe("logic");
    expect(groupOf(byMnemonic.get("cbz")!)).toBe("compare");
    expect(groupOf(byMnemonic.get("adrp")!)).toBe("memory");
  });
});

describe("the finder's state in the URL", () => {
  it("round-trips a search, a group and the all choice", () => {
    const state = { query: "shift left", group: "logic" as const, all: true };
    const search = finderSearch(state);
    expect(search).toBe("?q=shift+left&group=logic&show=all");
    expect(readFinderState(search)).toEqual(state);
  });

  it("writes nothing for the default view and keeps other parameters", () => {
    expect(finderSearch({ query: "", group: null, all: false })).toBe("");
    expect(finderSearch({ query: "x * y", group: null, all: false }, "?ref=ta")).toBe(
      "?ref=ta&q=x+*+y",
    );
  });

  it("ignores a group it does not know", () => {
    expect(readFinderState("?group=nonsense").group).toBeNull();
  });
});
