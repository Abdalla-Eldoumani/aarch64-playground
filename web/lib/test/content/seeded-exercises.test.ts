// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { validateExercise, type Exercise, type WriteExercise } from "@/lib/content/exercise-schema";
import { checkExercise } from "@/lib/content/exercise-checker";
import { practiceSide } from "@/lib/content/practice-topics";
import {
  SOLUTIONS_DIR,
  codingExercise,
  grade,
  runToSnapshot,
  solutionFor,
} from "@/lib/test/content/helpers/grade-exercise";

// Vitest runs with cwd = web/, so the real content directory is cwd-relative.
// Part A proves the shipped set validates headlessly and carries no week
// labels, PII, or reference solution; Part B drives the real node-target
// emulator to prove the checker passes a correct program and fails an
// incorrect one without ever comparing against a stored answer. Part C repeats
// that proof for every emulator-graded exercise, hidden inputs included, from
// the reference solutions in exercise-solutions/.
const DIR = path.join(process.cwd(), "content/exercises");
const files = fs.readdirSync(DIR).filter((name) => name.endsWith(".json"));

function readExercise(file: string): Exercise {
  const parsed: unknown = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
  const result = validateExercise(parsed);
  if (!result.ok) throw new Error(`${file} failed validation: ${result.error}`);
  return result.exercise;
}

const exercises = files.map(readExercise);
const coding = exercises.filter(
  (exercise): exercise is WriteExercise =>
    exercise.variant === "write" || exercise.variant === "identify-bug",
);

describe("seeded exercises validate", () => {
  it("validate, with a unique slug equal to the filename stem", () => {
    const slugs = new Set<string>();
    files.forEach((file, index) => {
      const { slug } = exercises[index];
      expect(slug).toBe(file.replace(/\.json$/, ""));
      expect(slugs.has(slug)).toBe(false);
      slugs.add(slug);
    });
  });

  it("carry the date their content last changed, which the sitemap prints", () => {
    files.forEach((file, index) => {
      expect(exercises[index].lastUpdated, `${file} has no lastUpdated`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it("offer at least as many coding exercises as theory sets", () => {
    const theory = exercises.filter((exercise) => practiceSide(exercise) === "theory");
    expect(coding.length).toBeGreaterThanOrEqual(theory.length);
  });

  it("ship write and identify-bug exercises, with structural checks among them", () => {
    expect(coding.some((exercise) => exercise.variant === "write")).toBe(true);
    expect(coding.some((exercise) => exercise.variant === "identify-bug")).toBe(true);
    expect(coding.some((exercise) => (exercise.acceptance.structural?.length ?? 0) > 0)).toBe(true);
  });

  it("carry no week labels, archive numbers, or personal data", () => {
    const banned = /week\s*\d|tutorial\s*\d|assignment\s*\d|@[a-z0-9.-]+\.[a-z]{2,}/i;
    for (const file of files) {
      const raw = fs.readFileSync(path.join(DIR, file), "utf8");
      expect(banned.test(raw), `${file} matched a banned pattern`).toBe(false);
    }
  });

  // The no-answer-key rule holds for the emulator-backed variants: a coding
  // exercise is graded by running the student's program, never by comparing
  // against a stored solution, so its JSON must not carry one. The interactive
  // variants (quiz, prediction, blanks) are the deliberate exception: they
  // grade entirely client-side against author-declared answers the schema
  // validates, so their files carry those answers by design.
  it("coding exercises carry no reference-solution or answer key", () => {
    const solutionKey = /"solution"|"answer"|"reference/i;
    for (const exercise of coding) {
      const raw = fs.readFileSync(path.join(DIR, `${exercise.slug}.json`), "utf8");
      expect(solutionKey.test(raw), `${exercise.slug} carries a solution/answer key`).toBe(false);
    }
  });

  it("give every coding exercise three or more hidden inputs, at least one of them an edge", () => {
    for (const exercise of coding) {
      const cases = exercise.hiddenCases ?? [];
      expect(cases.length, `${exercise.slug} hidden inputs`).toBeGreaterThanOrEqual(3);
      expect(cases.some((testCase) => testCase.edge), `${exercise.slug} marks no edge input`).toBe(true);
    }
  });
});

// Wrong programs used only to drive the checker. Each was authored per the
// course style (lowercase mnemonics, m4 register aliases, an aapcs64 frame).

// An off-by-one bound that ignores its input: stops while i < 10, so it sums
// 1..9 = 45 and the result assertion fails.
const sumWrong = `// off by one: this stops one value early
define(fp, x29)
define(lr, x30)

define(sum_r, x19)
define(i_r, x20)
define(n_r, x21)

        .data
fmt:    .string "sum = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     n_r, 10
        mov     sum_r, 0
        mov     i_r, 1
loop:
        cmp     i_r, n_r
        b.ge    done
        add     sum_r, sum_r, i_r
        add     i_r, i_r, 1
        b       loop
done:
        ldr     x0, =fmt
        mov     x1, sum_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

// Prints the right number for the visible input without computing it: the
// result assertions pass but the forbids-literal structural check catches the
// hardcoded constant.
const sumHardcoded = `// a shortcut that hardcodes the total instead of computing it
define(fp, x29)
define(lr, x30)

        .data
fmt:    .string "sum = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt
        mov     x1, 55
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

describe("the checker passes a correct solution and fails an incorrect one end to end", () => {
  it("write exercise: a correct loop passes, a wrong total fails, a hardcoded total fails", async () => {
    const exercise = codingExercise("sum-to-n");
    expect((await grade(exercise, solutionFor("sum-to-n"))).pass).toBe(true);
    expect((await grade(exercise, sumWrong)).pass).toBe(false);
    const hardcoded = checkExercise(exercise.acceptance, runToSnapshot(sumHardcoded, [], exercise.stdin), sumHardcoded);
    expect(hardcoded.results.every((check) => check.pass)).toBe(true);
    expect(hardcoded.pass).toBe(false);
  });

  it("identify-bug exercise: the corrected program passes and the shipped broken starter fails as-is", async () => {
    const exercise = codingExercise("fix-the-loop-bound");
    expect((await grade(exercise, solutionFor("fix-the-loop-bound"))).pass).toBe(true);
    // The shipped starter, run unchanged, must fail: the bug is real and the
    // checker catches it on the program the student first sees.
    expect((await grade(exercise, exercise.starter)).pass).toBe(false);
  });
});

describe("every emulator-graded exercise is solvable and does not ship already solved", () => {
  // Without this, a new graded exercise could land with no reference program
  // and nothing would notice; a stale solution file would linger the same way.
  it("pairs exactly one reference solution with every coding exercise", () => {
    const solutions = fs
      .readdirSync(SOLUTIONS_DIR)
      .filter((name) => name.endsWith(".s"))
      .map((name) => name.replace(/\.s$/, ""))
      .sort();
    expect(solutions).toEqual(coding.map((exercise) => exercise.slug).sort());
  });

  it.each(coding.map((exercise) => [exercise.slug, exercise] as const))(
    "%s: the reference passes every visible and hidden check, and the starter does not",
    async (slug, exercise) => {
      const solved = await grade(exercise, solutionFor(slug));
      expect(solved.pass, `${slug} solution: ${solved.why}`).toBe(true);
      // A starter that faults counts as a failure: the-leaky-frame's
      // under-sized frame leaves sp misaligned, so its first bl takes the bus
      // error and the run halts with no exit code and no output. The checker
      // reads that as a plain miss, not an exception.
      const starter = await grade(exercise, exercise.starter);
      expect(starter.pass, `${slug} starter: it already passes`).toBe(false);
    },
  );
});
