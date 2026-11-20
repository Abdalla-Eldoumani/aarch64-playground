import { afterAll, describe, expect, it } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import { checkHiddenCase, FRAME_NOTES_COUNT, type HiddenRunOutcome } from "@/lib/content/exercise-checker";
import type { HiddenCase, WriteExercise } from "@/lib/content/exercise-schema";
import { loadAllExercises } from "@/lib/content/exercises";
import { EmulatorInstance } from "@/lib/emulator/emulator";
import { runHeadless } from "@/lib/emulator/headless-run";
import { parseArgs } from "@/lib/playground/args";
import { codingExercise, solutionFor } from "@/lib/test/content/helpers/grade-exercise";

// The frame notes on the shipped exercises, read as the checker will read
// them once FRAME_NOTES_COUNT is turned on, and as it reads them now.

const nodeRequire = createRequire(import.meta.url);
const { Emulator } = nodeRequire(path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js")) as typeof import("@/lib/wasm-node/aarch64_emulator");

const emu = new Emulator();
const machine = new EmulatorInstance(emu);
afterAll(() => emu.free());

const coding = loadAllExercises().filter(
  (exercise): exercise is WriteExercise => exercise.variant === "write" || exercise.variant === "identify-bug",
);

/** The exercise's own input first (graded on screen, not here), then its hidden cases. */
const runsOf = (exercise: WriteExercise): HiddenCase[] => [
  { args: exercise.args, stdin: exercise.stdin, stdout: "", exitCode: 0 },
  ...(exercise.hiddenCases ?? []),
];

const run = (source: string, testCase: HiddenCase, notes?: boolean): Promise<HiddenRunOutcome> =>
  runHeadless(machine, source, parseArgs(testCase.args ?? ""), testCase.stdin, {}, notes);

// The starter with x20 in place of x19 as the helper's scratch register: a
// fix the visible checks and every hidden case pass today.
function forgetfulWithX20(): string {
  const fixed = codingExercise("the-forgetful-helper")
    .starter.replace("mov     x19, x0", "mov     x20, x0")
    .replace("add     x19, x19, x19", "add     x20, x20, x20")
    .replace("mov     x0, x19", "mov     x0, x20");
  expect(fixed).toContain("add     x20, x20, x20");
  return fixed;
}

describe("the frame notes on the shipped exercises", () => {
  it("stay switched off this term", () => {
    expect(FRAME_NOTES_COUNT).toBe(false);
  });

  it("note nothing on any reference solution, on its own input or any hidden case", { timeout: 120_000 }, async () => {
    const noted: string[] = [];
    let runs = 0;
    for (const exercise of coding) {
      for (const testCase of runsOf(exercise)) {
        const outcome = await run(solutionFor(exercise.slug), testCase, true);
        runs += 1;
        if (outcome.frameNotes.length > 0) noted.push(`${exercise.slug}: ${JSON.stringify(outcome.frameNotes)}`);
      }
    }
    expect(noted).toEqual([]);
    expect(runs).toBe(407);
  });

  it("change no outcome and no grade while the switch is off, solutions and starters alike", { timeout: 240_000 }, async () => {
    const changed: string[] = [];
    for (const exercise of coding) {
      for (const [who, source] of [["solution", solutionFor(exercise.slug)], ["starter", exercise.starter]]) {
        for (const testCase of exercise.hiddenCases ?? []) {
          const off = await run(source, testCase);
          const noted = await run(source, testCase, true);
          if (
            JSON.stringify({ ...noted, frameNotes: [] }) !== JSON.stringify(off) ||
            JSON.stringify(checkHiddenCase(testCase, noted)) !== JSON.stringify(checkHiddenCase(testCase, off))
          ) {
            changed.push(`${exercise.slug} ${who}`);
          }
        }
      }
    }
    expect(changed).toEqual([]);
  });

  it("fail the forgetful helper fixed with x20 as scratch on 3 of its 4 hidden cases once switched on", async () => {
    const exercise = codingExercise("the-forgetful-helper");
    const source = forgetfulWithX20();
    const note = { kind: "callee", fn: "double_it", line: 42, register: 20 };
    // Its own input is noted too: 4 of the 5 runs. "0 0" leaves x20 as it was.
    expect((await run(source, runsOf(exercise)[0], true)).frameNotes).toEqual([note]);
    const checks = [];
    for (const testCase of exercise.hiddenCases ?? []) {
      const outcome = await run(source, testCase, true);
      expect(checkHiddenCase(testCase, outcome).pass).toBe(true);
      checks.push(checkHiddenCase(testCase, outcome, true));
    }
    expect(checks.map((check) => check.miss)).toEqual([null, "calls", "calls", "calls"]);
    expect(checks[1].detail).toBe("the call to double_it on line 42 returns with x20 changed");
  });

  // Each starter fails today on an earlier cause, which the switch leaves
  // first, case by case. The leaky frame's call with sp off is to scanf, a
  // library call, which stops the run with a bus error, so nothing is noted.
  it.each([
    ["the-forgetful-helper", { kind: "callee", fn: "double_it", line: 42, register: 19 }, 4, [null, "stdout", "stdout", "stdout"]],
    ["the-leaky-frame", null, 0, ["fault", "fault", "fault", "fault"]],
  ] as const)("note %s's starter and grade it as today", async (slug, note, noted, misses) => {
    const exercise = codingExercise(slug);
    let count = 0;
    for (const testCase of runsOf(exercise)) {
      const { frameNotes } = await run(exercise.starter, testCase, true);
      if (frameNotes.length === 0) continue;
      expect(frameNotes).toEqual([note]);
      count += 1;
    }
    expect(count).toBe(noted);
    const on = [];
    for (const testCase of exercise.hiddenCases ?? []) {
      const outcome = await run(exercise.starter, testCase, true);
      expect(checkHiddenCase(testCase, outcome).miss).toBe(checkHiddenCase(testCase, outcome, true).miss);
      on.push(checkHiddenCase(testCase, outcome, true).miss);
    }
    expect(on).toEqual(misses);
  });
});
