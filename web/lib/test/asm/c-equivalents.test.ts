import { describe, expect, it } from "vitest";
import { C_EQUIVALENTS, hoverCLine } from "@/lib/asm/c-equivalents";
import { INSTRUCTION_DOCS } from "@/lib/asm/instruction-docs";

describe("C_EQUIVALENTS", () => {
  it("has an entry for every hover card, and no others", () => {
    const docs = Object.keys(INSTRUCTION_DOCS).sort();
    const c = Object.keys(C_EQUIVALENTS).sort();
    expect(c).toEqual(docs);
  });

  it("opens every declaration comment with a type the reader knows", () => {
    // A block's first comment declares its operands: `// .8b: int8_t Vd[8]`.
    const types =
      /^\/\/ (?:[^:]+: )?(?:u?int(?:8|16|32|64)_t|int|double|float|_Float16|char|void)\b/;
    const odd: string[] = [];
    for (const [key, entry] of Object.entries(C_EQUIVALENTS)) {
      for (const block of entry.c.split("\n\n")) {
        const first = block.split("\n")[0];
        if (first.startsWith("//") && !types.test(first)) odd.push(`${key}: ${first}`);
      }
    }
    expect(odd).toEqual([]);
  });

  it("names intrinsics as plain C identifiers", () => {
    const bad = Object.entries(C_EQUIVALENTS)
      .filter(([, e]) => e.intrinsic !== undefined && !/^[a-z_][a-z0-9_]*$/.test(e.intrinsic))
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });

  // The hover card's line (components/playground/Editor.tsx adds it as is).
  describe("hoverCLine", () => {
    const origin = "https://example.test";

    it("shows C that fits on one short line in place", () => {
      expect(C_EQUIVALENTS.B.c).toBe("goto label;");
      expect(hoverCLine("B", origin)).toBe("**c equivalent:** `goto label;`");
    });

    it("links anything longer to its reference entry instead of showing it", () => {
      expect(C_EQUIVALENTS.MADD.c).toContain("\n");
      expect(hoverCLine("MADD", origin)).toBe(
        "**c equivalent:** see [madd in the reference](https://example.test/reference#madd)",
      );
      // One line, but past the limit: a link too, and b.cond takes the page's #b-cond.
      expect(hoverCLine("BL", origin)).toContain("(https://example.test/reference#bl)");
      expect(hoverCLine("B.COND", origin)).toContain("(https://example.test/reference#b-cond)");
    });

    it("keeps every card to one c line and never shows the intrinsic", () => {
      for (const [key, entry] of Object.entries(C_EQUIVALENTS)) {
        const line = hoverCLine(key, origin);
        expect(line).not.toContain("\n");
        if (entry.intrinsic) expect(line).not.toContain(entry.intrinsic);
      }
      expect(hoverCLine("constructor", origin)).toBeUndefined();
    });
  });

  it("keeps tabs and trailing spaces out of the text a reader copies", () => {
    const bad = Object.entries(C_EQUIVALENTS)
      .filter(([, e]) => /\t| +$/m.test(e.c))
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });
});
