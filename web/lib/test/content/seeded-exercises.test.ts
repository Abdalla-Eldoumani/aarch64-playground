// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { validateExercise } from "@/lib/content/exercise-schema";
import { loadExercise } from "@/lib/content/exercises";
import { checkExercise, type CheckerSnapshot } from "@/lib/content/exercise-checker";
import { parseArgs } from "@/lib/playground/args";

// Vitest runs with cwd = web/, so the real content directory is cwd-relative.
// Part A proves the shipped seed validates headlessly and carries no week
// labels, PII, or reference solution; Part B drives the real node-target
// emulator to prove the checker passes a correct program and fails an
// incorrect one without ever comparing against a stored answer. Part C repeats
// that proof for every remaining emulator-graded exercise from one table.
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
      const { exercise } = result;
      if (exercise.variant === "write") writes += 1;
      if (exercise.variant === "identify-bug") bugs += 1;
      if (exercise.variant === "write" || exercise.variant === "identify-bug") {
        structural += exercise.acceptance.structural?.length ?? 0;
      }
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

  // The no-answer-key rule holds for the emulator-backed variants: a coding
  // exercise is graded by running the student's program, never by comparing
  // against a stored solution, so its JSON must not carry one. The interactive
  // variants (quiz, prediction, blanks) are the deliberate exception: they
  // grade entirely client-side against author-declared answers the schema
  // validates, so their files carry those answers by design.
  it("coding exercises carry no reference-solution or answer key", () => {
    const solutionKey = /"solution"|"answer"/i;
    for (const file of files) {
      const parsed: unknown = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
      const result = validateExercise(parsed);
      if (!result.ok) throw new Error(`${file} failed validation: ${result.error}`);
      const { variant } = result.exercise;
      if (variant !== "write" && variant !== "identify-bug") continue;
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
    if (exercise.variant !== "write") throw new Error("expected the write variant");

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
    if (exercise.variant !== "identify-bug") throw new Error("expected the identify-bug variant");

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

// One verified reference solution per emulator-graded exercise beyond the two
// pairs above. They live ONLY here, for the same reason those do: the shipped
// JSON carries no answer key and the checker grades by running the student's
// program. Each is authored in the course style, and each settles two questions
// at once: the declared acceptance is reachable by a real program, and the
// shipped starter does not already reach it.
const REFERENCE_SOLUTIONS: Record<string, string> = {
  "warm-up-the-registers": `// combine three values into one result and print it
define(fp, x29)
define(lr, x30)

define(a_r, x19)
define(b_r, x20)
define(c_r, x21)
define(result_r, x22)

        .data
fmt:    .string "result = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     a_r, 15
        mov     b_r, 27
        mov     c_r, 9

        add     result_r, a_r, b_r
        sub     result_r, result_r, c_r

        ldr     x0, =fmt
        mov     x1, result_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "double-trouble": `// scale a sum by eight using shifts alone
define(fp, x29)
define(lr, x30)

define(a_r, x19)
define(b_r, x20)
define(total_r, x21)

        .data
fmt:    .string "8 * (a + b) = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     a_r, 5
        mov     b_r, 7
        add     total_r, a_r, b_r
        lsl     total_r, total_r, 3         // times eight is three shifts left

        ldr     x0, =fmt
        mov     x1, total_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "the-absolute-truth": `// print the absolute value of a signed register
define(fp, x29)
define(lr, x30)

define(value_r, x19)

        .data
fmt:    .string "magnitude = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     value_r, -42

        cmp     value_r, 0
        b.ge    keep
        neg     value_r, value_r
keep:

        ldr     x0, =fmt
        mov     x1, value_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "count-by-sevens": `// print every multiple of seven from 7 up to 70
define(fp, x29)
define(lr, x30)

define(i_r, x19)
define(limit_r, x20)

        .data
fmt:    .string "%lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     i_r, 7                      // first multiple
        mov     limit_r, 70                 // last multiple to print

loop:
        cmp     i_r, limit_r
        b.gt    done
        ldr     x0, =fmt
        mov     x1, i_r
        bl      printf
        add     i_r, i_r, 7
        b       loop
done:

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "pick-the-bigger-one": `// compare two values and print the larger one
define(fp, x29)
define(lr, x30)

define(a_r, x19)
define(b_r, x20)
define(winner_r, x21)

        .data
fmt:    .string "bigger = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     a_r, 123
        mov     b_r, 87
        mov     winner_r, a_r
        cmp     b_r, winner_r
        b.le    settled
        mov     winner_r, b_r
settled:

        ldr     x0, =fmt
        mov     x1, winner_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "the-overeager-counter": `// count down from five to one, one number per line
define(fp, x29)
define(lr, x30)

define(i_r, x19)

        .data
fmt:    .string "%lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     i_r, 5                      // start of the countdown
loop:
        cmp     i_r, 0
        b.le    done                        // stop once i_r runs out
        ldr     x0, =fmt
        mov     x1, i_r
        bl      printf
        sub     i_r, i_r, 1
        b       loop
done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "fizzbuzz-by-hand": `// fizzbuzz: multiples of 3 say fizz, of 5 say buzz, of both say fizzbuzz
define(fp, x29)
define(lr, x30)

define(i_r, x19)
define(limit_r, x20)
define(q_r, x21)
define(rem3_r, x22)
define(rem5_r, x23)

        .data
fmt_num:    .string "%lld\\n"
fmt_fizz:   .string "fizz\\n"
fmt_buzz:   .string "buzz\\n"
fmt_both:   .string "fizzbuzz\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     i_r, 1                      // count 1 through limit
        mov     limit_r, 15

loop:
        cmp     i_r, limit_r
        b.gt    done

        mov     x9, 3
        udiv    q_r, i_r, x9
        msub    rem3_r, q_r, x9, i_r        // i - (i / 3) * 3
        mov     x9, 5
        udiv    q_r, i_r, x9
        msub    rem5_r, q_r, x9, i_r        // i - (i / 5) * 5

        cbnz    rem3_r, not_both
        cbnz    rem5_r, fizz_only
        ldr     x0, =fmt_both
        bl      printf
        b       next
not_both:
        cbnz    rem5_r, plain
        ldr     x0, =fmt_buzz
        bl      printf
        b       next
fizz_only:
        ldr     x0, =fmt_fizz
        bl      printf
        b       next
plain:
        ldr     x0, =fmt_num
        mov     x1, i_r
        bl      printf
next:
        add     i_r, i_r, 1
        b       loop
done:

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "echo-the-sum": `// read two integers from input and print their sum
define(fp, x29)
define(lr, x30)

define(a_r, x19)
define(b_r, x20)

a_s = 16                                    // first local's frame offset
b_s = 24                                    // second local's frame offset
alloc = -(16 + 16) & -16
dealloc = -alloc

        .data
fmt_in:     .string "%lld %lld"
fmt_out:    .string "sum = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x0, =fmt_in
        add     x1, fp, a_s                 // &a in the frame
        add     x2, fp, b_s                 // &b in the frame
        bl      scanf

        ldr     a_r, [fp, a_s]
        ldr     b_r, [fp, b_s]
        add     a_r, a_r, b_r

        ldr     x0, =fmt_out
        mov     x1, a_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
`,
  "gcd-the-euclid-way": `// find the greatest common divisor of two values
define(fp, x29)
define(lr, x30)

define(a_r, x19)
define(b_r, x20)
define(q_r, x21)
define(rem_r, x22)

        .data
fmt:    .string "gcd = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     a_r, 1071                   // euclid's own example
        mov     b_r, 462

loop:
        cbz     b_r, done
        udiv    q_r, a_r, b_r
        msub    rem_r, q_r, b_r, a_r        // a mod b
        mov     a_r, b_r
        mov     b_r, rem_r
        b       loop
done:
        ldr     x0, =fmt
        mov     x1, a_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "reverse-the-digits": `// reverse the decimal digits of a number
define(fp, x29)
define(lr, x30)

define(n_r, x19)
define(rev_r, x20)
define(q_r, x21)
define(digit_r, x22)
define(ten_r, x23)

        .data
fmt:    .string "reversed = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     n_r, 9317
        mov     rev_r, 0
        mov     ten_r, 10

loop:
        cbz     n_r, done
        udiv    q_r, n_r, ten_r
        msub    digit_r, q_r, ten_r, n_r    // last decimal digit
        madd    rev_r, rev_r, ten_r, digit_r
        mov     n_r, q_r
        b       loop
done:

        ldr     x0, =fmt
        mov     x1, rev_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "bit-population-census": `// count how many bits of a value are set
define(fp, x29)
define(lr, x30)

define(value_r, x19)
define(count_r, x20)
define(bit_r, x21)

        .data
fmt:    .string "bits set = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     value_r, =0xb7a5
        mov     count_r, 0

loop:
        cbz     value_r, done
        and     bit_r, value_r, 1
        add     count_r, count_r, bit_r
        lsr     value_r, value_r, 1
        b       loop
done:

        ldr     x0, =fmt
        mov     x1, count_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "the-vanishing-value": `// swap two registers, then print them in their new order
define(fp, x29)
define(lr, x30)

define(a_r, x19)
define(b_r, x20)
define(tmp_r, x21)

        .data
fmt:    .string "a = %lld, b = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     a_r, 123
        mov     b_r, 87

        // the swap
        mov     tmp_r, a_r
        mov     a_r, b_r
        mov     b_r, tmp_r

        ldr     x0, =fmt
        mov     x1, a_r
        mov     x2, b_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "sum-a-global-array": `// sum every element of a global word array
define(fp, x29)
define(lr, x30)

define(base_r, x22)
define(i_r, w19)
define(n_r, w20)
define(sum_r, w21)
define(elem_r, w23)

        .data
scores:     .word 12, 9, 41, 7, 30, 5, 22, 18
n_scores:   .word 8

fmt:    .string "sum = %d\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     base_r, =scores
        ldr     x9, =n_scores
        ldr     n_r, [x9]                   // element count
        mov     sum_r, 0
        mov     i_r, 0

loop:
        cmp     i_r, n_r
        b.ge    done
        ldr     elem_r, [base_r, i_r, sxtw 2]
        add     sum_r, sum_r, elem_r
        add     i_r, i_r, 1
        b       loop
done:

        ldr     x0, =fmt
        mov     w1, sum_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "min-max-tournament": `// find both the smallest and the largest element in one pass
define(fp, x29)
define(lr, x30)

define(base_r, x22)
define(i_r, w19)
define(n_r, w20)
define(min_r, w21)
define(max_r, w24)
define(elem_r, w23)

        .data
entries:    .word 58, 3, 77, 12, 41, 90, 6, 25
n_entries:  .word 8

fmt_min:    .string "min = %d\\n"
fmt_max:    .string "max = %d\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     base_r, =entries
        ldr     x9, =n_entries
        ldr     n_r, [x9]
        ldr     min_r, [base_r]             // both start at element zero
        ldr     max_r, [base_r]
        mov     i_r, 1

loop:
        cmp     i_r, n_r
        b.ge    done
        ldr     elem_r, [base_r, i_r, sxtw 2]
        cmp     elem_r, min_r
        b.ge    check_max
        mov     min_r, elem_r
check_max:
        cmp     elem_r, max_r
        b.le    next
        mov     max_r, elem_r
next:
        add     i_r, i_r, 1
        b       loop
done:

        ldr     x0, =fmt_min
        mov     w1, min_r
        bl      printf
        ldr     x0, =fmt_max
        mov     w1, max_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "stack-of-plates": `// store four plates in the frame, then take them back top-first
define(fp, x29)
define(lr, x30)

define(plate_r, x19)

p1_s = 16                                   // bottom plate's offset
p2_s = 24
p3_s = 32
p4_s = 40                                   // top plate's offset
alloc = -(16 + 32) & -16
dealloc = -alloc

        .data
fmt:    .string "%lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        mov     plate_r, 21
        str     plate_r, [fp, p1_s]
        mov     plate_r, 34
        str     plate_r, [fp, p2_s]
        mov     plate_r, 55
        str     plate_r, [fp, p3_s]
        mov     plate_r, 89
        str     plate_r, [fp, p4_s]

        ldr     plate_r, [fp, p4_s]
        ldr     x0, =fmt
        mov     x1, plate_r
        bl      printf
        ldr     plate_r, [fp, p3_s]
        ldr     x0, =fmt
        mov     x1, plate_r
        bl      printf
        ldr     plate_r, [fp, p2_s]
        ldr     x0, =fmt
        mov     x1, plate_r
        bl      printf
        ldr     plate_r, [fp, p1_s]
        ldr     x0, =fmt
        mov     x1, plate_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
`,
  "count-the-vowels": `// count the vowels in a sentence
define(fp, x29)
define(lr, x30)

define(ptr_r, x19)
define(count_r, x20)
define(ch_r, w21)

        .data
sentence:   .string "the quick brown fox jumps over the lazy dog"
fmt:        .string "vowels = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     ptr_r, =sentence            // walk this byte by byte
        mov     count_r, 0

loop:
        ldrb    ch_r, [ptr_r], 1            // post-index: load, then advance
        cbz     ch_r, done
        cmp     ch_r, 'a'
        b.eq    vowel
        cmp     ch_r, 'e'
        b.eq    vowel
        cmp     ch_r, 'i'
        b.eq    vowel
        cmp     ch_r, 'o'
        b.eq    vowel
        cmp     ch_r, 'u'
        b.ne    loop
vowel:
        add     count_r, count_r, 1
        b       loop
done:

        ldr     x0, =fmt
        mov     x1, count_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "the-multiplication-table": `// print a four-by-four multiplication table
define(fp, x29)
define(lr, x30)

define(row_r, x19)
define(col_r, x20)
define(cell_r, x21)

        .data
fmt_cell:   .string "%4lld"
fmt_nl:     .string "\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     row_r, 1
row_loop:
        cmp     row_r, 4
        b.gt    done
        mov     col_r, 1
col_loop:
        cmp     col_r, 4
        b.gt    row_done
        mul     cell_r, row_r, col_r
        ldr     x0, =fmt_cell
        mov     x1, cell_r
        bl      printf
        add     col_r, col_r, 1
        b       col_loop
row_done:
        ldr     x0, =fmt_nl
        bl      printf
        add     row_r, row_r, 1
        b       row_loop
done:

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "caesars-little-secret": `// decode a message caesar-shifted three letters forward
define(fp, x29)
define(lr, x30)

define(ptr_r, x19)
define(ch_r, w20)

        .data
secret:     .string "dvvhpeob lv ixq"
fmt:        .string "%s\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     ptr_r, =secret

loop:
        ldrb    ch_r, [ptr_r]
        cbz     ch_r, done
        cmp     ch_r, 'a'
        b.lt    next                        // not a lowercase letter
        cmp     ch_r, 'z'
        b.gt    next
        sub     ch_r, ch_r, 3
        cmp     ch_r, 'a'
        b.ge    store
        add     ch_r, ch_r, 26              // wrap around past 'a'
store:
        strb    ch_r, [ptr_r]
next:
        add     ptr_r, ptr_r, 1
        b       loop
done:

        ldr     x0, =fmt
        ldr     x1, =secret                 // now decoded in place
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "call-yourself": `// compute a factorial with a recursive subroutine
define(fp, x29)
define(lr, x30)

define(n_r, x19)

        .data
fmt:    .string "10! = %lld\\n"

        .text

// fact(x0 = n) -> x0 = n!
        .balign 4
        .global fact
fact:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     n_r, [fp, 16]               // preserve the caller's x19

        mov     n_r, x0
        cmp     n_r, 1
        b.le    base
        sub     x0, n_r, 1
        bl      fact
        mul     x0, x0, n_r
        b       out
base:
        mov     x0, 1
out:
        ldr     n_r, [fp, 16]
        ldp     fp, lr, [sp], 32
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 10
        bl      fact

        mov     x1, x0
        ldr     x0, =fmt
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "the-forgetful-helper": `// add a doubled bonus to the running total
define(fp, x29)
define(lr, x30)

define(total_r, x19)

        .data
fmt:    .string "total = %lld\\n"

        .text

// double_it(x0 = n) -> x0 = 2 * n
        .balign 4
        .global double_it
double_it:
        mov     x9, x0                      // scratch belongs in x9-x15
        add     x9, x9, x9
        mov     x0, x9
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     total_r, 100

        mov     x0, 20
        bl      double_it                   // bonus = 40
        add     total_r, total_r, x0

        ldr     x0, =fmt
        mov     x1, total_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "argv-arithmetic": `// add up every number handed to the program on its command line
define(fp, x29)
define(lr, x30)

define(argc_r, x19)
define(argv_r, x20)
define(i_r, x21)
define(total_r, x22)

        .data
fmt:    .string "total = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     argc_r, x0                  // argument count
        mov     argv_r, x1                  // pointer array
        mov     total_r, 0
        mov     i_r, 1                      // argv[0] is the program name

loop:
        cmp     i_r, argc_r
        b.ge    done
        ldr     x0, [argv_r, i_r, lsl 3]    // argv[i], a char pointer
        bl      atoi
        add     total_r, total_r, x0
        add     i_r, i_r, 1
        b       loop
done:

        ldr     x0, =fmt
        mov     x1, total_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "bubble-up-the-order": `// sort an array in place, then print it smallest first
define(fp, x29)
define(lr, x30)

define(base_r, x22)
define(i_r, w19)
define(j_r, w20)
define(n_r, w21)
define(a_r, w23)
define(b_r, w24)

        .data
tangle:     .word 9, 2, 7, 1, 8, 4
n_tangle:   .word 6

fmt:    .string "%d\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     base_r, =tangle
        ldr     x9, =n_tangle
        ldr     n_r, [x9]

        mov     i_r, 0
pass_loop:
        add     w9, i_r, 1
        cmp     w9, n_r
        b.ge    sorted
        mov     j_r, 0
pair_loop:
        sub     w9, n_r, i_r
        sub     w9, w9, 1
        cmp     j_r, w9
        b.ge    pass_done
        ldr     a_r, [base_r, j_r, sxtw 2]
        add     w9, j_r, 1
        ldr     b_r, [base_r, w9, sxtw 2]
        cmp     a_r, b_r
        b.le    no_swap
        str     b_r, [base_r, j_r, sxtw 2]
        str     a_r, [base_r, w9, sxtw 2]
no_swap:
        add     j_r, j_r, 1
        b       pair_loop
pass_done:
        add     i_r, i_r, 1
        b       pass_loop
sorted:

        mov     i_r, 0
print_loop:
        cmp     i_r, n_r
        b.ge    finished
        ldr     a_r, [base_r, i_r, sxtw 2]
        ldr     x0, =fmt
        mov     w1, a_r
        bl      printf
        add     i_r, i_r, 1
        b       print_loop
finished:

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "binary-broadcast": `// print the eight-bit binary form of a value
define(fp, x29)
define(lr, x30)

define(value_r, x19)
define(bit_r, x20)
define(digit_r, x21)

        .data
fmt_bit:    .string "%lld"
fmt_nl:     .string "\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     value_r, 99
        mov     bit_r, 7                    // start from the top bit

loop:
        cmp     bit_r, 0
        b.lt    done
        lsr     digit_r, value_r, bit_r
        and     digit_r, digit_r, 1
        ldr     x0, =fmt_bit
        mov     x1, digit_r
        bl      printf
        sub     bit_r, bit_r, 1
        b       loop
done:
        ldr     x0, =fmt_nl
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "fibonacci-goes-large": `// the fiftieth fibonacci number will not fit in 32 bits
define(fp, x29)
define(lr, x30)

define(a_r, x19)
define(b_r, x20)
define(next_r, x21)
define(i_r, x22)

        .data
fmt:    .string "fib(50) = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     a_r, 0                      // fib(0)
        mov     b_r, 1                      // fib(1)
        mov     i_r, 0

loop:
        cmp     i_r, 50
        b.ge    done
        add     next_r, a_r, b_r
        mov     a_r, b_r
        mov     b_r, next_r
        add     i_r, i_r, 1
        b       loop
done:

        ldr     x0, =fmt
        mov     x1, a_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  "the-leaky-frame": `// stash a lucky number in the frame and print it back
define(fp, x29)
define(lr, x30)

define(lucky_r, x19)

lucky_s = 16                                // the local's frame offset

        .data
fmt:    .string "lucky = %lld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp

        mov     lucky_r, 7
        str     lucky_r, [fp, lucky_s]

        ldr     x1, [fp, lucky_s]
        ldr     x0, =fmt
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 32
        ret
`,
};

// sum-to-n and fix-the-loop-bound are covered above with purpose-built wrong
// programs, so the table deliberately leaves them out.
const HAND_CHECKED_SLUGS = ["sum-to-n", "fix-the-loop-bound"];

describe("every emulator-graded exercise is solvable and does not ship already solved", () => {
  // Without this, a new graded exercise could land with no pass/fail pair and
  // nothing would notice.
  it("pairs a solution with every graded exercise the hand-written cases skip", () => {
    const graded: string[] = [];
    for (const file of files) {
      const parsed: unknown = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
      const result = validateExercise(parsed);
      if (!result.ok) throw new Error(`${file} failed validation: ${result.error}`);
      const { slug, variant } = result.exercise;
      if (variant !== "write" && variant !== "identify-bug") continue;
      if (HAND_CHECKED_SLUGS.includes(slug)) continue;
      graded.push(slug);
    }
    expect(
      Object.keys(REFERENCE_SOLUTIONS).sort(),
      "every emulator-graded exercise needs a REFERENCE_SOLUTIONS entry in this file (or a HAND_CHECKED_SLUGS entry beside its own pair); the diff names the slug",
    ).toEqual(graded.sort());
  });

  it.each(Object.entries(REFERENCE_SOLUTIONS))(
    "%s: the reference solution passes and the shipped starter fails",
    (slug, solution) => {
      const exercise = loadExercise(slug);
      expect(exercise, `${slug} is not in the shipped content`).toBeDefined();
      if (!exercise) return;
      if (exercise.variant !== "write" && exercise.variant !== "identify-bug") {
        throw new Error(`${slug} is not an emulator-graded variant`);
      }

      // Both runs take the exercise's own inputs, tokenized by the same parser
      // the embed feeds the machine, so this grades what a student's run grades.
      const args = parseArgs(exercise.args ?? "");

      const solved = checkExercise(
        exercise.acceptance,
        runToSnapshot(solution, args, exercise.stdin),
        solution,
      );
      expect(solved.pass, `${slug} solution: ${solved.summary}`).toBe(true);

      // The starter must fail on the program the student first sees. A starter
      // that faults counts as a failure: the-leaky-frame's under-sized frame
      // leaves sp misaligned, so its bl takes the bus error and the run halts
      // with no exit code and no output. The checker reads that as a plain
      // miss, not an exception.
      const starter = checkExercise(
        exercise.acceptance,
        runToSnapshot(exercise.starter, args, exercise.stdin),
        exercise.starter,
      );
      expect(starter.pass, `${slug} starter: it already satisfies the acceptance`).toBe(false);
    },
  );
});
