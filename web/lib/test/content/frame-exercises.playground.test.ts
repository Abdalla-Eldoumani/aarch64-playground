// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import type { FrameExercise } from "@/lib/content/exercise-schema";
import { loadAllExercises } from "@/lib/content/exercises";
import {
  expectedFrame,
  gradeFrame,
  typedBytes,
  type ExpectedFrame,
  type FrameAnswers,
} from "@/lib/content/frame-checker";
import { EmulatorInstance } from "@/lib/emulator/emulator";
import { runHeadless, runToPause } from "@/lib/emulator/headless-run";

// The draw-the-frame exercises, run on the node build to their pauses. The
// frames below are worked by hand from each program's equates: the record
// at fp + 0 (saved fp) and fp + 8 (saved lr), then the locals the equates
// place, and the frame rounded up to a multiple of 16 by alloc.

const nodeRequire = createRequire(import.meta.url);
const { Emulator } = nodeRequire(path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js")) as typeof import("@/lib/wasm-node/aarch64_emulator");

const emu = new Emulator();
const machine = new EmulatorInstance(emu);
afterAll(() => emu.free());

const frames = loadAllExercises().filter((exercise): exercise is FrameExercise => exercise.variant === "frame");

/** By slug: the frame at the pause, and what the whole program prints. */
const BY_HAND: Record<string, { frame: ExpectedFrame; stdout: string }> = {
  // count_s = 16; sum_s = (16 + 4 + 7) & -8 = 24; last_s = 24 + 8 = 32;
  // alloc = -(32 + 4) & -16 = -48. The odd values are 7, 5 and 19.
  "draw-frame-locals": {
    frame: { size: 48, slots: [16, 24, 32], savedFp: 0, savedLr: 8 },
    stdout: "3 odd values, sum 31, last 19\n",
  },
  // scale_s = 16; rect_s = (16 + 4 + 7) & -8 = 24, so width 24, height 28,
  // area 32; alloc = -(24 + 16) & -16 = -48. 3 * 5 by 4 * 5 is 15 by 20.
  "draw-frame-struct": {
    frame: { size: 48, slots: [16, 24, 28, 32], savedFp: 0, savedLr: 8 },
    stdout: "15 by 20, area 300\n",
  },
  // n_s = 16; part_s = (16 + 4 + 7) & -8 = 24; alloc = -(24 + 8) & -16 = -32.
  // 4 + 3 + 2 + 1 = 10.
  "draw-frame-recursion": {
    frame: { size: 32, slots: [16, 24], savedFp: 0, savedLr: 8 },
    stdout: "sum to 4 = 10\n",
  },
};

/** The hand-worked frame as the student would type it. */
function typed(frame: ExpectedFrame): FrameAnswers {
  return {
    size: String(frame.size),
    slots: frame.slots.map(String),
    savedFp: String(frame.savedFp),
    savedLr: String(frame.savedLr),
  };
}

describe("the draw-the-frame exercises", () => {
  it("ship the three worked here, no more and no fewer", () => {
    expect(frames.map((exercise) => exercise.slug).sort()).toEqual(Object.keys(BY_HAND).sort());
  });

  it.each(frames.map((exercise) => [exercise.slug, exercise] as const))(
    "%s: the emulator draws the frame worked by hand at the pause",
    async (slug, exercise) => {
      const paused = await runToPause(machine, exercise.program, exercise.pause);
      expect(paused, `${slug} never reaches its pause`).not.toBeNull();
      expect(expectedFrame(exercise, paused!)).toEqual(BY_HAND[slug].frame);
    },
  );

  it.each(frames.map((exercise) => [exercise.slug, exercise] as const))(
    "%s: the whole program runs clean, keeps every stack rule, and prints what was worked out",
    async (slug, exercise) => {
      const outcome = await runHeadless(machine, exercise.program, [], undefined);
      expect(outcome).toMatchObject({
        error: null,
        finished: true,
        exitCode: 0,
        stdout: BY_HAND[slug].stdout,
        stackBalanced: true,
        frameIntact: true,
      });
    },
  );

  it.each(frames.map((exercise) => [exercise.slug, exercise] as const))(
    "%s: a right answer is marked right in every field",
    async (slug, exercise) => {
      const paused = await runToPause(machine, exercise.program, exercise.pause);
      const expected = expectedFrame(exercise, paused!)!;
      const marks = gradeFrame(expected, typed(BY_HAND[slug].frame));
      expect(marks).toEqual({ size: "right", slots: exercise.slots.map(() => "right"), savedFp: "right", savedLr: "right" });
    },
  );

  // A wrong field shows its hint, so a hint holding the number would hand
  // the answer over.
  it.each(frames.map((exercise) => [exercise.slug, exercise] as const))(
    "%s: no hint names the number its own field wants",
    (slug, exercise) => {
      const { frame } = BY_HAND[slug];
      const names = (text: string, n: number | null) => new RegExp(`(?<![\\w.])${n}(?![\\w.])`).test(text);
      expect(names(exercise.hints.size, frame.size), "size").toBe(false);
      exercise.slots.forEach((slot, i) => expect(names(slot.hint, frame.slots[i]), slot.name).toBe(false));
      expect(names(exercise.hints.savedFp, frame.savedFp), "saved fp").toBe(false);
      expect(names(exercise.hints.savedLr, frame.savedLr), "saved lr").toBe(false);
    },
  );

  it("marks each kind of field wrong on its own: the size, a slot, the saved fp, the saved lr", () => {
    const frame = BY_HAND["draw-frame-struct"].frame;
    const right = typed(frame);
    const allRight = { size: "right", slots: ["right", "right", "right", "right"], savedFp: "right", savedLr: "right" };
    expect(gradeFrame(frame, { ...right, size: "40" })).toEqual({ ...allRight, size: "wrong" });
    expect(gradeFrame(frame, { ...right, slots: ["16", "24", "32", "28"] })).toEqual({
      ...allRight,
      slots: ["right", "right", "wrong", "wrong"],
    });
    expect(gradeFrame(frame, { ...right, savedFp: "8" })).toEqual({ ...allRight, savedFp: "wrong" });
    expect(gradeFrame(frame, { ...right, savedLr: "0" })).toEqual({ ...allRight, savedLr: "wrong" });
  });

  it("returns marks only, so no answer leaves the checker", () => {
    const frame = BY_HAND["draw-frame-locals"].frame;
    const marks = gradeFrame(frame, { size: "", slots: ["1", "x", ""], savedFp: "999999", savedLr: "7" });
    expect(JSON.stringify(marks)).not.toMatch(/\d/);
  });
});

describe("a typed field", () => {
  it("reads digits as a number of bytes, with spaces around them allowed", () => {
    expect(typedBytes("16")).toBe(16);
    expect(typedBytes("  24 ")).toBe(24);
    expect(typedBytes("0")).toBe(0);
    expect(typedBytes("000032")).toBe(32);
  });

  it("is empty when nothing but space was typed", () => {
    expect(typedBytes("")).toBe("empty");
    expect(typedBytes(" \t\n")).toBe("empty");
  });

  it("refuses anything that is not a short run of digits, whatever its size", () => {
    for (const hostile of [
      "-16",
      "+16",
      "16.0",
      "1e3",
      "0x10",
      "fp + 16",
      "16 bytes",
      "NaN",
      "Infinity",
      "__proto__",
      "١٦",
      "１６",
      "1234567",
      "9".repeat(1_000_000),
      "1".repeat(100) + "x",
    ]) {
      expect(typedBytes(hostile), JSON.stringify(hostile.slice(0, 20))).toBe("invalid");
    }
  });

  it("marks a hostile value invalid instead of right or wrong", () => {
    const frame = BY_HAND["draw-frame-recursion"].frame;
    const hostile = "9".repeat(1_000_000);
    expect(gradeFrame(frame, { size: hostile, slots: ["-16", "0x18"], savedFp: "", savedLr: "8" })).toEqual({
      size: "invalid",
      slots: ["invalid", "invalid"],
      savedFp: "empty",
      savedLr: "right",
    });
  });
});
