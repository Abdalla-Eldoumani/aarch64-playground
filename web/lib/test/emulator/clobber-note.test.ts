import { describe, expect, it } from "vitest";
import { clobberNoteTexts } from "@/lib/emulator/clobber-note";

// Line numbers below are 1-based editor lines of this source.
const SOURCE = [
  "        .text", // 1
  "        .global main", // 2
  "main:", // 3
  "        stp     x29, x30, [sp, -16]!", // 4
  "        bl      printf", // 5
  "        mov     x1, x9", // 6
  "        BL      puts", // 7
  "        blr     x16", // 8
].join("\r\n");

describe("clobberNoteTexts", () => {
  it("names the reading line, the call from its bl, and the fix for an x register", () => {
    // [register x9, read by an instruction, call line 5, read line 6]
    expect(clobberNoteTexts([9, 0, 5, 6], SOURCE)).toEqual([
      "Line 6 reads x9, but the printf call on line 5 overwrote it. x9 is caller-saved: " +
        "a library function may change x0 to x18 without putting them back, so the caller " +
        "has to keep anything it still needs. Keep a value that must survive a call in " +
        "x19 to x28, or save it on the stack.",
    ]);
  });

  it("words a d register with the floating-point ranges", () => {
    // d3 is 32 + 3.
    const [note] = clobberNoteTexts([35, 0, 5, 6], SOURCE);
    expect(note).toContain("Line 6 reads d3");
    expect(note).toContain("d0 to d7 and d16 to d31");
    expect(note).toContain("in d8 to d15");
  });

  it("names a library call that reads a stale argument and asks for it to be set again", () => {
    const [note] = clobberNoteTexts([1, 1, 5, 7], SOURCE);
    expect(note).toMatch(/^The puts call on line 7 reads x1 as an argument, but the printf call on line 5/);
    expect(note).toContain("Set x1 again right before that call");
  });

  it("points main's garbage exit status at w0", () => {
    expect(clobberNoteTexts([0, 2, 5, 0], SOURCE)).toEqual([
      "main returns x0 as its exit status, but the printf call on line 5 overwrote it. " +
        "Set w0 after the last call, for example with mov w0, 0.",
    ]);
  });

  it("falls back to plain words where no bl or no line names the call", () => {
    const [unnamed, unmapped] = clobberNoteTexts([9, 0, 8, 6, 9, 0, 0, 0], SOURCE);
    expect(unnamed).toMatch(/^Line 6 reads x9, but the library call on line 8 overwrote it\./);
    expect(unmapped).toMatch(/^The program reads x9, but a library call overwrote it\./);
  });

  it("reads four numbers per note and ignores a ragged tail", () => {
    expect(clobberNoteTexts([], SOURCE)).toEqual([]);
    expect(clobberNoteTexts([9, 0, 5], SOURCE)).toEqual([]);
    expect(clobberNoteTexts([9, 0, 5, 6, 10, 0, 7, 0], SOURCE)).toHaveLength(2);
  });
});
