// The multi-file line map: combined-string lines resolve to the owning
// file and back, boundary comments attribute forward, and the main buffer
// stays line-for-line identical to the combined head.

import { describe, expect, it } from "vitest";
import {
  MAIN_FILE,
  combineSources,
  combinedLineFor,
  countLines,
  fileNameShapeError,
  resolveLine,
  validateFileName,
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

describe("countLines", () => {
  it("counts an empty buffer as one line and a trailing newline as two", () => {
    expect(countLines("")).toBe(1);
    expect(countLines("a")).toBe(1);
    expect(countLines("a\n")).toBe(2);
    expect(countLines("a\nb\nc")).toBe(3);
  });
});

describe("validateFileName", () => {
  const files = [
    { name: "util.s", body: "" },
    { name: "sort.s", body: "" },
  ];

  it("accepts a fresh name", () => {
    expect(validateFileName("queue.s", files)).toBeNull();
  });

  it("refuses an empty name", () => {
    expect(validateFileName("   ", files)).toBe("file name cannot be empty");
  });

  it("refuses a tab that impersonates the editor's own buffer", () => {
    // The decoy still concatenates, and resolveLine labels everything inside
    // it main.asm, so its errors point the student at the wrong buffer.
    expect(validateFileName("main.asm", files)).toBe(
      "main.asm is the editor's own buffer; pick another name",
    );
    expect(validateFileName("MAIN.S", files)).toBe(
      "main.asm is the editor's own buffer; pick another name",
    );
  });

  it("refuses a duplicate, but lets a file keep its own name on rename", () => {
    expect(validateFileName("sort.s", files)).toBe("a file named sort.s is already open");
    expect(validateFileName("sort.s", files, 1)).toBeNull();
    expect(validateFileName("util.s", files, 1)).toBe("a file named util.s is already open");
  });

  it("compares names exactly, since the course servers are case-sensitive", () => {
    expect(validateFileName("Sort.s", files)).toBeNull();
  });

  it("refuses a name that would write its own line into the combined source", () => {
    // combineSources puts the name inside a `// ---- name ----` marker, so
    // everything after a newline in it is assembled as program text.
    expect(validateFileName("helpers.s\n.global main\nmain:", files)).toBe(
      "file names may use letters, digits, dot, dash, and underscore only",
    );
    expect(validateFileName("helpers.s\r\n ret", files)).not.toBeNull();
  });

  it("refuses path separators, traversal, and anything not a plain name", () => {
    const hostile = [
      "sub/dir.s",
      "sub\\dir.s",
      "../secrets.s",
      "..",
      ".hidden.s",
      "-dash-first.s",
      "two words.s",
      "bell\u0007.s",
      "résumé.s",
      "<script>.s",
    ];
    for (const name of hostile) {
      expect(validateFileName(name, files)).toBe(
        "file names may use letters, digits, dot, dash, and underscore only",
      );
    }
  });

  it("bounds the length at 64 characters", () => {
    expect(validateFileName(`${"a".repeat(62)}.s`, files)).toBeNull();
    expect(validateFileName("a".repeat(65), files)).toBe(
      "file name is too long (max 64 characters)",
    );
  });
});

describe("fileNameShapeError", () => {
  it("applies the shape rule without the main.asm rule", () => {
    // The `.json` workspace bundle carries the whole strip, main.asm first,
    // so the boundary that reads one needs the shape rule on its own.
    expect(fileNameShapeError("main.asm")).toBeNull();
    expect(fileNameShapeError("main.asm\nret")).not.toBeNull();
    expect(fileNameShapeError("  ")).toBe("file name cannot be empty");
  });
});
