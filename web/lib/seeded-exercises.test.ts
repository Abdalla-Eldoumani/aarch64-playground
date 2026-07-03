// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { validateExercise } from "@/lib/exercise-schema";
import { loadExercise } from "@/lib/exercises";
import { checkExercise, type CheckerSnapshot } from "@/lib/exercise-checker";

// Vitest runs with cwd = web/, so the real content directory is cwd-relative.
// Part A proves the shipped seed validates headlessly and carries no week
// labels, PII, or reference solution; Part B drives the real node-target
// emulator to prove the checker passes a correct program and fails an
// incorrect one without ever comparing against a stored answer.
const DIR = path.join(process.cwd(), "content/exercises");
const files = fs.readdirSync(DIR).filter((name) => name.endsWith(".json"));

describe("seeded exercises validate", () => {
  it("ships at least the two seed exercises", () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it("validate, with a unique slug equal to the filename stem", () => {
    const slugs = new Set<string>();
    for (const file of files) {
      const parsed: unknown = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
      const result = validateExercise(parsed);
      if (!result.ok) {
        throw new Error(`${file} failed validation: ${result.error}`);
      }
      const stem = file.replace(/\.json$/, "");
      expect(result.exercise.slug).toBe(stem);
      expect(slugs.has(result.exercise.slug)).toBe(false);
      slugs.add(result.exercise.slug);
    }
  });

  it("ship one write and one identify-bug, with at least one structural assertion across the seed", () => {
    let writes = 0;
    let bugs = 0;
    let structural = 0;
    for (const file of files) {
      const parsed: unknown = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
      const result = validateExercise(parsed);
      if (!result.ok) throw new Error(`${file} failed validation: ${result.error}`);
      if (result.exercise.variant === "write") writes += 1;
      if (result.exercise.variant === "identify-bug") bugs += 1;
      structural += result.exercise.acceptance.structural?.length ?? 0;
    }
    expect(writes).toBeGreaterThanOrEqual(1);
    expect(bugs).toBeGreaterThanOrEqual(1);
    expect(structural).toBeGreaterThanOrEqual(1);
  });

  it("carry no week labels, archive numbers, or personal data", () => {
    const banned = /week\s*\d|tutorial\s*\d|assignment\s*\d|@[a-z0-9.-]+\.[a-z]{2,}/i;
    for (const file of files) {
      const raw = fs.readFileSync(path.join(DIR, file), "utf8");
      expect(banned.test(raw), `${file} matched a banned pattern`).toBe(false);
    }
  });

  it("carry no reference-solution or answer key", () => {
    const solutionKey = /"solution"|"answer"/i;
    for (const file of files) {
      const raw = fs.readFileSync(path.join(DIR, file), "utf8");
      expect(solutionKey.test(raw), `${file} carries a solution/answer key`).toBe(false);
    }
  });
});

// The node-target build loads synchronously via require (it reads its .wasm
// from __dirname). createRequire cannot resolve the Vite `@/` alias, so require
// a node-resolvable absolute path under cwd (web/).
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

/** Run a program to completion and snapshot it in the checker's hex format. */
function runToSnapshot(source: string, args: string[] = [], stdin?: string): CheckerSnapshot {
  const emu = new Emulator();
  emu.assemble_and_load_with_args(source, args);
  if (stdin) emu.push_stdin(stdin);
  // Drive to completion with a bounded loop; run_until_break returns control on
  // halt/break/error/cap, so this can never spin forever.
  for (let i = 0; i < 50 && !emu.is_halted(); i++) emu.run_until_break(100000);
  const hex = (v: bigint): string => "0x" + BigInt(v).toString(16).padStart(16, "0");
  const registers = Array.from({ length: 31 }, (_, i) => hex(emu.get_register(i)));
  const sp = hex(emu.get_sp());
  const ec = emu.get_exit_code();
  return { registers, sp, exitCode: ec == null ? null : Number(ec), stdout: emu.take_stdout() };
}

// Original programs used only to drive the checker. They live ONLY here: the
// shipped JSON carries no reference solution, and the checker never compares
// against one. Each was authored per the course style (lowercase mnemonics, m4
// register aliases, an aapcs64 prologue/epilogue).

// A correct loop summing 1..10 = 55.
const sumCorrect = `// sum every integer from 1 to n, then print the total
define(sum_r, x19)
define(i_r, x20)
define(n_r, x21)

        .data
fmt:    .string "sum = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp

        mov     n_r, 10
        mov     sum_r, 0
        mov     i_r, 1
loop:
        cmp     i_r, n_r
        b.gt    done
        add     sum_r, sum_r, i_r
        add     i_r, i_r, 1
        b       loop
done:
        ldr     x0, =fmt
        mov     x1, sum_r
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
`;

// An off-by-one bound: stops while i < n, so it sums 1..9 = 45 and the result
// assertion fails.
const sumWrong = `// off by one: this stops one value early
define(sum_r, x19)
define(i_r, x20)
define(n_r, x21)

        .data
fmt:    .string "sum = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp

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
        ldp     x29, x30, [sp], 16
        ret
`;

// Prints the right number without computing it: the result assertions pass but
// the forbids-literal structural check catches the hardcoded constant.
const sumHardcoded = `// a shortcut that hardcodes the total instead of computing it
        .data
fmt:    .string "sum = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp

        ldr     x0, =fmt
        mov     x1, 55
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
`;

// The corrected factorial: includes n in the product, so 5! = 120.
const factFixed = `// compute n factorial and print the result
define(acc_r, x19)
define(i_r, x20)
define(n_r, x21)

        .data
fmt:    .string "result = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp

        mov     n_r, 5
        mov     acc_r, 1
        mov     i_r, 1
loop:
        cmp     i_r, n_r
        b.gt    done
        mul     acc_r, acc_r, i_r
        add     i_r, i_r, 1
        b       loop
done:
        ldr     x0, =fmt
        mov     x1, acc_r
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
`;

describe("the checker passes a correct solution and fails an incorrect one end to end", () => {
  it("write exercise: a correct loop passes, a wrong total fails, a hardcoded total fails", () => {
    const exercise = loadExercise("sum-to-n");
    expect(exercise).toBeDefined();
    if (!exercise) return;

    const correct = checkExercise(exercise.acceptance, runToSnapshot(sumCorrect), sumCorrect);
    expect(correct.pass).toBe(true);

    const wrong = checkExercise(exercise.acceptance, runToSnapshot(sumWrong), sumWrong);
    expect(wrong.pass).toBe(false);

    const hardcoded = checkExercise(
      exercise.acceptance,
      runToSnapshot(sumHardcoded),
      sumHardcoded,
    );
    expect(hardcoded.pass).toBe(false);
  });

  it("identify-bug exercise: the corrected program passes and the shipped broken starter fails as-is", () => {
    const exercise = loadExercise("fix-the-loop-bound");
    expect(exercise).toBeDefined();
    if (!exercise) return;

    const fixed = checkExercise(exercise.acceptance, runToSnapshot(factFixed), factFixed);
    expect(fixed.pass).toBe(true);

    // The shipped starter, run unchanged, must fail: the bug is real and the
    // checker catches it on the program the student first sees.
    const broken = checkExercise(
      exercise.acceptance,
      runToSnapshot(exercise.starter),
      exercise.starter,
    );
    expect(broken.pass).toBe(false);
  });
});
