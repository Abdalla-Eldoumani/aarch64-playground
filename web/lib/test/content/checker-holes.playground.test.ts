// @vitest-environment node
import { describe, expect, it } from "vitest";
import { checkExercise } from "@/lib/content/exercise-checker";
import { parseArgs } from "@/lib/playground/args";
import {
  codingExercise,
  grade,
  runToSnapshot,
  solutionFor,
} from "@/lib/test/content/helpers/grade-exercise";

// Wrong programs that used to pass a coding exercise's checks. Each is the
// reference solution (or the starter) with one realistic mistake made in it,
// and each must now fail. A hole reopening shows up here by name.

/** `text` with `from` replaced once; throws when `from` is missing, so an edit to the source cannot turn a test into a no-op. */
function edit(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`edit target not found: ${JSON.stringify(from)}`);
  return text.replace(from, to);
}

describe("the leaky frame", () => {
  const exercise = codingExercise("the-leaky-frame");
  const fixed = solutionFor("the-leaky-frame");

  it("rejects a frame that takes 32 bytes and gives back 24", async () => {
    const unbalanced = edit(fixed, "ldp     fp, lr, [sp], 32", "ldp     fp, lr, [sp], 24");
    const result = await grade(exercise, unbalanced);
    expect(result.pass).toBe(false);
    expect(result.hiddenMiss).toBe("stack");
  });

  it("rejects a 16-byte frame that stores its local above itself", async () => {
    const tooSmall = edit(
      edit(fixed, "stp     fp, lr, [sp, -32]!", "stp     fp, lr, [sp, -16]!"),
      "ldp     fp, lr, [sp], 32",
      "ldp     fp, lr, [sp], 16",
    );
    const result = await grade(exercise, tooSmall);
    expect(result.pass).toBe(false);
    expect(result.hiddenMiss).toBe("frame");
  });
});

describe("required instructions are checked where they belong", () => {
  it("call-yourself rejects a loop in fact, even with a frame and a bl in main", async () => {
    const exercise = codingExercise("call-yourself");
    const start = solutionFor("call-yourself");
    const body = start.slice(start.indexOf("fact:\n"), start.indexOf("        .balign 4\n        .global main"));
    const iterative = edit(
      start,
      body,
      [
        "fact:",
        "        stp     fp, lr, [sp, -16]!",
        "        mov     fp, sp",
        "        mov     x9, x0",
        "        mov     x0, 1",
        "fact_loop:",
        "        cmp     x9, 1",
        "        b.le    fact_out",
        "        mul     x0, x0, x9",
        "        sub     x9, x9, 1",
        "        b       fact_loop",
        "fact_out:",
        "        ldp     fp, lr, [sp], 16",
        "        ret",
        "",
        "",
      ].join("\n"),
    );
    const result = await grade(exercise, iterative);
    expect(result.pass).toBe(false);
    expect(result.why).toMatch(/visible run/);
  });

  it("stack-of-plates rejects keeping the plates in registers instead of the frame", async () => {
    const exercise = codingExercise("stack-of-plates");
    let inRegisters = exercise.starter;
    inRegisters = edit(inRegisters, "        // TODO: store plate_r in its slot, [fp, p1_s]\n", "        mov     x20, plate_r\n");
    inRegisters = edit(inRegisters, "        // TODO: store plate_r in [fp, p2_s]\n", "        mov     x21, plate_r\n");
    inRegisters = edit(inRegisters, "        // TODO: store plate_r in [fp, p3_s]\n", "        mov     x22, plate_r\n");
    inRegisters = edit(
      inRegisters,
      "        // TODO: store plate_r in [fp, p4_s]\n",
      "        mov     x23, plate_r\n",
    );
    inRegisters = edit(
      inRegisters,
      "        // TODO: load the plates back top-first, from [fp, p4_s] down to\n        // [fp, p1_s], and print each one with fmt_out.\n",
      ["x23", "x22", "x21", "x20"]
        .map((reg) => `        ldr     x0, =fmt_out\n        mov     x1, ${reg}\n        bl      printf\n`)
        .join(""),
    );
    const result = await grade(exercise, inRegisters);
    expect(result.pass).toBe(false);
  });

  it("stack-of-plates rejects printing the sample plates with one dummy store", async () => {
    const exercise = codingExercise("stack-of-plates");
    const printed = edit(
      exercise.starter,
      "        // TODO: load the plates back top-first, from [fp, p4_s] down to\n        // [fp, p1_s], and print each one with fmt_out.\n",
      "        str     plate_r, [fp, p1_s]\n" +
        [89, 55, 34, 21]
          .map((n) => `        ldr     x0, =fmt_out\n        mov     x1, ${n}\n        bl      printf\n`)
          .join(""),
    );
    const result = await grade(exercise, printed);
    expect(result.pass).toBe(false);
    expect(result.hiddenMiss).toBe("stdout");
  });

  it("the-forgetful-helper rejects protecting x19 in main while the helper still tramples it", async () => {
    const exercise = codingExercise("the-forgetful-helper");
    const fixedMain = edit(
      exercise.starter,
      "        bl      double_it                   // x0 = the doubled bonus\n        add     total_r, total_r, x0\n",
      "        mov     x20, total_r\n        bl      double_it\n        mov     total_r, x20\n        add     total_r, total_r, x0\n",
    );
    const snapshot = runToSnapshot(fixedMain, [], exercise.stdin);
    const result = checkExercise(exercise.acceptance, snapshot, fixedMain);
    expect(result.results.every((check) => check.pass)).toBe(true);
    expect(result.pass).toBe(false);
  });
});

describe("shortcuts around the point of an exercise", () => {
  it("double-trouble rejects madd standing in for mul", () => {
    const exercise = codingExercise("double-trouble");
    const withMadd = edit(
      solutionFor("double-trouble"),
      "        lsl     total_r, total_r, 3         // times eight is three shifts left\n",
      "        mov     x9, 8\n        madd    total_r, total_r, x9, xzr\n        lsl     x10, x10, 0\n",
    );
    const snapshot = runToSnapshot(withMadd, [], exercise.stdin);
    const result = checkExercise(exercise.acceptance, snapshot, withMadd);
    expect(result.results.every((check) => check.pass)).toBe(true);
    const forbid = result.structural.find((check) => check.assertion.kind === "forbids-instruction");
    expect(forbid?.pass).toBe(false);
    expect(forbid?.found).toBe("madd");
  });

  it("argv-arithmetic rejects a loop that starts at the program's own name", () => {
    const exercise = codingExercise("argv-arithmetic");
    const fromZero = edit(solutionFor("argv-arithmetic"), "mov     i_r, 1", "mov     i_r, 0");
    const snapshot = runToSnapshot(fromZero, parseArgs(exercise.args ?? ""));
    expect(checkExercise(exercise.acceptance, snapshot, fromZero).pass).toBe(false);
  });

  it("the-absolute-truth rejects flipping every sign", async () => {
    const alwaysNeg = edit(
      solutionFor("the-absolute-truth"),
      "        b.ge    positive                    // already non-negative\n",
      "",
    );
    const result = await grade(codingExercise("the-absolute-truth"), alwaysNeg);
    expect(result.pass).toBe(false);
    expect(result.hiddenMiss).toBe("stdout");
  });

  it("pick-the-bigger-one rejects always picking the first", async () => {
    const first = edit(
      solutionFor("pick-the-bigger-one"),
      "        mov     winner_r, b_r               // b is bigger after all\n",
      "",
    );
    const result = await grade(codingExercise("pick-the-bigger-one"), first);
    expect(result.pass).toBe(false);
    expect(result.hiddenMiss).toBe("stdout");
  });

  it("the-vanishing-value rejects swapping the printf arguments instead of the registers", () => {
    const exercise = codingExercise("the-vanishing-value");
    const reordered = edit(
      edit(exercise.starter, "        // the swap\n        mov     a_r, b_r\n        mov     b_r, a_r\n", ""),
      "        mov     x1, a_r\n        mov     x2, b_r\n",
      "        mov     x1, b_r\n        mov     x2, a_r\n",
    );
    const snapshot = runToSnapshot(reordered, [], exercise.stdin);
    const result = checkExercise(exercise.acceptance, snapshot, reordered);
    expect(result.results.find((check) => check.assertion.kind === "stdout")?.pass).toBe(true);
    expect(result.pass).toBe(false);
  });

  it("count-by-sevens rejects a counter in x9, which printf may overwrite", async () => {
    const inScratch = edit(solutionFor("count-by-sevens"), "define(i_r, x19)", "define(i_r, x9)");
    expect((await grade(codingExercise("count-by-sevens"), inScratch)).pass).toBe(false);
  });
});
