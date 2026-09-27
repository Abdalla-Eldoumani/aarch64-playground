import { describe, expect, it } from "vitest";
import { clobberNoteTexts, isCallLeftover } from "@/lib/emulator/clobber-note";
import { combineSources } from "@/lib/playground/file-map";

// Line numbers below are 1-based editor lines of this source.
const MAIN = [
  "        .text", // 1
  "        .global main", // 2
  "main:", // 3
  "        stp     x29, x30, [sp, -16]!", // 4
  "        bl      printf", // 5
  "        mov     x1, x9", // 6
  "        BL      puts", // 7
  "        blr     x16", // 8
  "again:  b.eq    again", // 9
].join("\r\n");
const ONE_FILE = { main: MAIN, extras: [] };

describe("clobberNoteTexts", () => {
  it("names the reading line, the call from its bl, and the fix for an x register", () => {
    // [register x9, read by an instruction, call line 5, read line 6]
    expect(clobberNoteTexts([9, 0, 5, 6], ONE_FILE)).toEqual([
      "Line 6 reads x9, but the printf call on line 5 overwrote it. x9 is caller-saved: " +
        "a library function may change x0 to x18 without putting them back, so the caller " +
        "has to keep anything it still needs. Keep a value that must survive a call in " +
        "x19 to x28, or save it on the stack.",
    ]);
  });

  it("words a d register with the floating-point ranges", () => {
    // d3 is 32 + 3.
    const [note] = clobberNoteTexts([35, 0, 5, 6], ONE_FILE);
    expect(note).toContain("Line 6 reads d3");
    expect(note).toContain("d0 to d7 and d16 to d31");
    expect(note).toContain("in d8 to d15");
  });

  it("names the instruction that reads the flags and asks for a fresh compare", () => {
    // The flags are 31, read by the b.eq behind the label on line 9.
    expect(clobberNoteTexts([31, 0, 7, 9], ONE_FILE)).toEqual([
      "b.eq on line 9 reads the flags, but the puts call on line 7 overwrote them. " +
        "A library call may change the condition flags (NZCV), so compare again after the call.",
    ]);
  });

  it("names a library call that reads a stale argument and asks for it to be set again", () => {
    const [note] = clobberNoteTexts([1, 1, 5, 7], ONE_FILE);
    expect(note).toMatch(/^The puts call on line 7 reads x1 as an argument, but the printf call on line 5/);
    expect(note).toContain("Set x1 again right before that call");
  });

  it("points main's garbage exit status at w0", () => {
    expect(clobberNoteTexts([0, 2, 5, 0], ONE_FILE)).toEqual([
      "main returns x0 as its exit status, but the printf call on line 5 overwrote it. " +
        "Set w0 after the last call, for example with mov w0, 0.",
    ]);
  });

  it("falls back to plain words where no bl or no line names the call", () => {
    const [unnamed, unmapped] = clobberNoteTexts([9, 0, 8, 6, 9, 0, 0, 0], ONE_FILE);
    expect(unnamed).toMatch(/^Line 6 reads x9, but the library call on line 8 overwrote it\./);
    expect(unmapped).toMatch(/^The program reads x9, but a library call overwrote it\./);
  });

  it("names the file and its own line when a line is in a helper file", () => {
    // The machine numbers the joined string: main's 9 lines, then one
    // boundary comment per helper ahead of its body.
    const theme = { name: "theme.s", body: ["th_off:", "        bl      printf"].join("\n") };
    const ui = { name: "ui.s", body: ["ui_row:", "        mov     x2, 2", "        add     x2, x3, 1"].join("\n") };
    const ws = { main: MAIN, extras: [theme, ui] };
    const joined = combineSources(ws.main, ws.extras).split("\n");
    const callLine = joined.indexOf("        bl      printf", 9) + 1;
    const readLine = joined.indexOf("        add     x2, x3, 1") + 1;
    expect([callLine, readLine]).toEqual([12, 16]);

    const [inHelpers, inMain] = clobberNoteTexts([3, 0, callLine, readLine, 9, 0, 5, 6], ws);
    expect(inHelpers).toMatch(/^ui\.s line 3 reads x3, but the printf call on theme\.s line 2 overwrote it\./);
    expect(inMain).toMatch(/^Line 6 reads x9, but the printf call on line 5 overwrote it\./);
  });

  it("tells a call's leftovers in a vector register from a program's write", () => {
    const P = "deadbeefdeadbeef";
    const Z = "0000000000000000";
    const LOW = "1234567812345678";
    // v3 is caller-saved whole: the pattern in both halves is the call's.
    expect(isCallLeftover(3, `0x${Z}${Z}`, `0x${P}${P}`)).toBe(true);
    expect(isCallLeftover(3, `0x${Z}${Z}`, `0x${P}${Z}`)).toBe(false);
    // v9 keeps its low half across a call: only the top may have moved.
    expect(isCallLeftover(9, `0x${Z}${LOW}`, `0x${P}${LOW}`)).toBe(true);
    expect(isCallLeftover(9, `0x${Z}${Z}`, `0x${P}${LOW}`)).toBe(false);
    // No vector file (an older wasm build): never a leftover.
    expect(isCallLeftover(0, undefined, undefined)).toBe(false);
  });

  it("reads four numbers per note and ignores a ragged tail", () => {
    expect(clobberNoteTexts([], ONE_FILE)).toEqual([]);
    expect(clobberNoteTexts([9, 0, 5], ONE_FILE)).toEqual([]);
    expect(clobberNoteTexts([9, 0, 5, 6, 10, 0, 7, 0], ONE_FILE)).toHaveLength(2);
  });
});
