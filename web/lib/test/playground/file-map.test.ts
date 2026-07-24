// The multi-file line map: combined-string lines resolve to the owning
// file and back, boundary comments attribute forward, and the main buffer
// stays line-for-line identical to the combined head.

import { describe, expect, it } from "vitest";
import {
  MAIN_FILE,
  combineSources,
  combinedLineFor,
  resolveLine,
} from "@/lib/playground/file-map";

const MAIN = "line a\nline b\nline c";
const EXTRAS = [
  { name: "helpers.asm", body: "h1\nh2" },
  { name: "data.asm", body: "d1\nd2\nd3" },
];

describe("combineSources", () => {
  it("returns main untouched with no extras", () => {
    expect(combineSources(MAIN, [])).toBe(MAIN);
  });

  it("joins extras behind boundary comments, main first and unshifted", () => {
    const combined = combineSources(MAIN, EXTRAS);
    expect(combined.split("\n")).toEqual([
      "line a",
      "line b",
      "line c",
      "// ---- helpers.asm ----",
      "h1",
      "h2",
      "// ---- data.asm ----",
      "d1",
      "d2",
      "d3",
    ]);
  });
});

describe("resolveLine", () => {
  it("maps main lines to main unchanged", () => {
    expect(resolveLine(2, MAIN, EXTRAS)).toEqual({
      file: MAIN_FILE,
      name: "main.asm",
      line: 2,
    });
  });

  it("maps extra-file lines to their local numbering", () => {
    // combined line 5 = h1 (helpers line 1), 9 = d2 (data line 2)
    expect(resolveLine(5, MAIN, EXTRAS)).toEqual({
      file: 0,
      name: "helpers.asm",
      line: 1,
    });
    expect(resolveLine(9, MAIN, EXTRAS)).toEqual({
      file: 1,
      name: "data.asm",
      line: 2,
    });
  });

  it("attributes a boundary-comment line to the file it introduces", () => {
    expect(resolveLine(4, MAIN, EXTRAS)).toEqual({
      file: 0,
      name: "helpers.asm",
      line: 1,
    });
  });

  it("clamps past-the-end lines into the last file", () => {
    expect(resolveLine(99, MAIN, EXTRAS)).toEqual({
      file: 1,
      name: "data.asm",
      line: 3,
    });
    expect(resolveLine(99, MAIN, [])).toEqual({
      file: MAIN_FILE,
      name: "main.asm",
      line: 3,
    });
  });
});

describe("combinedLineFor", () => {
  it("is the inverse of resolveLine for every real line", () => {
    const combined = combineSources(MAIN, EXTRAS);
    const total = combined.split("\n").length;
    for (let line = 1; line <= total; line++) {
      const loc = resolveLine(line, MAIN, EXTRAS);
      const back = combinedLineFor(loc.file, loc.line, MAIN, EXTRAS);
      // Boundary-comment lines resolve forward to the file's line 1, so
      // their round-trip lands on the file's first body line instead.
      const expected = [4, 7].includes(line) ? line + 1 : line;
      expect(back).toBe(expected);
    }
  });

  it("maps main lines to themselves", () => {
    expect(combinedLineFor(MAIN_FILE, 3, MAIN, EXTRAS)).toBe(3);
  });
});
