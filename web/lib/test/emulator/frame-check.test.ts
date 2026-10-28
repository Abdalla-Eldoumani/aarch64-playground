// @vitest-environment node
import { describe, expect, it } from "vitest";
import { wordLint } from "@/lib/emulator/frame-check";

// Rows as the crate hands them over: check = [rule, frame bytes, offset,
// width, offset, width], names = [function, slot, slot]. Every message below
// is written out by hand from those numbers.
const TAIL = " (The playground checks this; gcc on the server does not.)";

describe("wordLint", () => {
  it("names both slots and their bytes when two overlap", () => {
    const rows = [{ line: 18, check: [0, 32, 16, 4, 18, 8], names: ["main", "a_s", "b_s"] }];
    expect(wordLint(rows)).toEqual([
      {
        line: 18,
        message:
          "frame check: a_s (4 bytes at 16 to 19) and b_s (8 bytes at 18 to 25) overlap in main's frame, so storing one changes the other. Give each its own bytes." +
          TAIL,
      },
    ]);
  });

  it("says which end of the frame a slot falls off", () => {
    const past = { line: 20, check: [1, 32, 32, 8, 0, 0], names: ["main", "high_s", ""] };
    const below = { line: 21, check: [1, 32, -8, 8, 0, 0], names: ["main", "low_s", ""] };
    expect(wordLint([past, below]).map((w) => w.message)).toEqual([
      "frame check: high_s (8 bytes at 32 to 39) runs past the end of main's 32-byte frame (bytes 0 to 31). Make alloc cover it, or move it down." +
        TAIL,
      "frame check: low_s (8 bytes at -8 to -1) starts below fp, outside main's 32-byte frame (bytes 0 to 31). Locals go at 16 or above." +
        TAIL,
    ]);
  });

  it("says whether a slot sits on the saved fp, the saved lr, or both", () => {
    const on = (offset: number, width: number) => ({ line: 9, check: [2, 32, offset, width, 0, 0], names: ["sum", "x_s", ""] });
    expect(wordLint([on(0, 8), on(8, 4), on(4, 8)]).map((w) => w.message)).toEqual([
      "frame check: x_s (8 bytes at 0 to 7) sits on the saved fp (bytes 0 to 7), which the caller gets back when sum returns. Locals start at 16, above the saved fp and lr." +
        TAIL,
      "frame check: x_s (4 bytes at 8 to 11) sits on the saved lr (bytes 8 to 15), which sum needs to return. Locals start at 16, above the saved fp and lr." +
        TAIL,
      "frame check: x_s (8 bytes at 4 to 11) sits on the saved fp and lr (bytes 0 to 15): sum needs lr to return, and the caller gets fp back when sum returns. Locals start at 16, above the saved fp and lr." +
        TAIL,
    ]);
  });

  it("points an 8-byte slot at the next multiple of 8", () => {
    const rows = [{ line: 22, check: [3, 32, 20, 8, 0, 0], names: ["main", "total_s", ""] }];
    expect(wordLint(rows)[0].message).toBe(
      "frame check: total_s holds 8 bytes at 20, which is not a multiple of 8. Move it to a multiple of 8, such as 24." + TAIL,
    );
  });

  it("rounds a frame size up to the next multiple of 16", () => {
    const rows = [{ line: 15, check: [4, 24, 0, 0, 0, 0], names: ["main", "", ""] }];
    expect(wordLint(rows)[0].message).toBe(
      "frame check: main's frame is 24 bytes, which leaves sp off a multiple of 16. Round it up to 32, as alloc = -(16 + locals) & -16 does." +
        TAIL,
    );
  });

  it("keeps the lint's own warnings and leaves a frame size the lint already flags to it", () => {
    const lint = { line: 15, message: "this pushes 24 bytes, which is not a multiple of 16." };
    const sameLine = { line: 15, check: [4, 24, 0, 0, 0, 0], names: ["main", "", ""] };
    const otherLine = { line: 40, check: [4, 40, 0, 0, 0, 0], names: ["helper", "", ""] };
    const worded = wordLint([lint, sameLine, otherLine]);
    expect(worded.map((w) => w.line)).toEqual([15, 40]);
    expect(worded[0]).toBe(lint);
    expect(worded[1].message).toContain("helper's frame is 40 bytes");
  });
});
