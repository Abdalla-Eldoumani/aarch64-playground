import type { Pitfall } from "@/lib/content/pitfall-data";

/** Flags and branches: which instructions set the flags and how b.cond reads them. */
export const FLAG_PITFALLS: Pitfall[] = [
  {
    slug: "add-sets-no-flags",
    title: "add and sub set no flags; adds and subs do",
    group: "flags",
    mistake:
      "Only the forms ending in s (`adds`, `subs`, `ands`) and the compares (`cmp`, `cmn`, `tst`) write the condition flags. A `b.ne` after a plain `sub` tests whatever the last flag-setting instruction left.",
    server: "prints `sum = 5`: the loop runs once, because `b.ne` still reads the guard's `cmp`, which found the count equal to 5.",
    playground: "prints the same line; step through and the Z flag stays set across the `sub`.",
    fix: "Use `subs` when a branch tests the result. The fixed program prints `sum = 15`.",
    wrong: `        sub     count_r, count_r, 1
        b.ne    sum_loop`,
    right: `        subs    count_r, count_r, 1
        b.ne    sum_loop`,
    broken: {
      source: `// Sums 5 + 4 + 3 + 2 + 1 with a loop that counts down to zero.
// sub does not set the flags, so b.ne reads the guard's older compare.

define(fp, x29)
define(lr, x30)
define(count_r, x19)
define(sum_r, x20)

.data
fmt_sum:    .string "sum = %ld\\n"
fmt_many:   .string "more than five terms\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     count_r, 5
        cmp     count_r, 5                  // guard: at most five terms
        b.gt    too_many

        mov     sum_r, 0
sum_loop:
        add     sum_r, sum_r, count_r
        sub     count_r, count_r, 1         // the mistake: sub leaves the flags alone
        b.ne    sum_loop                    // still the guard's result: equal

        ldr     x0, =fmt_sum
        mov     x1, sum_r
        bl      printf
        b       done

too_many:
        ldr     x0, =fmt_many
        bl      printf

done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "sum = 5\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Sums 5 + 4 + 3 + 2 + 1 with a loop that counts down to zero.
// subs sets the flags, so b.ne tests the new count.

define(fp, x29)
define(lr, x30)
define(count_r, x19)
define(sum_r, x20)

.data
fmt_sum:    .string "sum = %ld\\n"
fmt_many:   .string "more than five terms\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     count_r, 5
        cmp     count_r, 5                  // guard: at most five terms
        b.gt    too_many

        mov     sum_r, 0
sum_loop:
        add     sum_r, sum_r, count_r
        subs    count_r, count_r, 1         // Z is set when the count reaches 0
        b.ne    sum_loop

        ldr     x0, =fmt_sum
        mov     x1, sum_r
        bl      printf
        b       done

too_many:
        ldr     x0, =fmt_many
        bl      printf

done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "sum = 15\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: SUBS (immediate)",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/Base-Instructions/SUBS--immediate---Subtract-immediate-value--setting-flags-",
    },
    lesson: "binary-arithmetic-and-flags",
    reference: "adds",
  },
  {
    slug: "cmp-operand-order",
    title: "cmp a, b tests a against b, not b against a",
    group: "flags",
    mistake:
      "`cmp a, b` sets the flags from a - b, so the `b.gt` after it means a > b. Swap the operands and every condition after it asks the opposite question.",
    server: "prints `larger = 12`: `cmp b_r, a_r` asked whether b is greater, and kept a when it was.",
    playground: "prints the same line.",
    fix: "Put the value the condition talks about first: `cmp a_r, b_r` before `b.gt`. The fixed program prints `larger = 30`.",
    wrong: `        cmp     b_r, a_r
        b.gt    keep_a`,
    right: `        cmp     a_r, b_r
        b.gt    keep_a`,
    broken: {
      source: `// Prints the larger of two numbers.
// The compare has its operands swapped, so b.gt asks the wrong question.

define(fp, x29)
define(lr, x30)
define(a_r, x19)
define(b_r, x20)
define(big_r, x21)

.data
fmt_big:    .string "larger = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     a_r, 12
        mov     b_r, 30
        mov     big_r, a_r                  // assume a is the larger
        cmp     b_r, a_r                    // the mistake: this sets the flags from b - a
        b.gt    keep_a                      // taken when b > a
        mov     big_r, b_r
keep_a:
        ldr     x0, =fmt_big
        mov     x1, big_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "larger = 12\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Prints the larger of two numbers.
// cmp a, b sets the flags from a - b, so b.gt means a > b.

define(fp, x29)
define(lr, x30)
define(a_r, x19)
define(b_r, x20)
define(big_r, x21)

.data
fmt_big:    .string "larger = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     a_r, 12
        mov     b_r, 30
        mov     big_r, a_r                  // assume a is the larger
        cmp     a_r, b_r                    // flags from a - b
        b.gt    keep_a                      // taken when a > b
        mov     big_r, b_r
keep_a:
        ldr     x0, =fmt_big
        mov     x1, big_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "larger = 30\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: CMP (shifted register)",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/Base-Instructions/CMP--shifted-register---Compare--shifted-register---an-alias-of-SUBS--shifted-register--",
    },
    lesson: "assembly-conditionals-basics",
    reference: "cmp",
  },
  {
    slug: "signed-and-unsigned-conditions",
    title: "lt, le, gt, ge are signed; lo, ls, hi, hs are unsigned",
    group: "flags",
    mistake:
      "The same `cmp` serves both kinds of number. `lt`, `le`, `gt`, and `ge` read the flags as signed; `lo`, `ls`, `hi`, and `hs` read them as unsigned, where -1 is the largest 64-bit value. `cc` and `cs` are other names for `lo` and `hs`.",
    server: "prints `warmer = -1`: `b.ls` compared the temperatures as unsigned numbers, and -1 came out on top.",
    playground: "prints the same line.",
    fix: "Use the signed conditions for values that can be negative: `b.le`. The fixed program prints `warmer = 1`.",
    wrong: `        cmp     t1_r, t2_r
        b.ls    report`,
    right: `        cmp     t1_r, t2_r
        b.le    report`,
    broken: {
      source: `// Prints the warmer of two temperatures, -1 and 1.
// b.ls compares as unsigned, where -1 is the largest value there is.

define(fp, x29)
define(lr, x30)
define(t1_r, x19)
define(t2_r, x20)
define(warm_r, x21)

.data
fmt_warm:   .string "warmer = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     t1_r, -1
        mov     t2_r, 1
        mov     warm_r, t2_r                // assume the second is warmer
        cmp     t1_r, t2_r
        b.ls    report                      // the mistake: ls is unsigned lower or same
        mov     warm_r, t1_r
report:
        ldr     x0, =fmt_warm
        mov     x1, warm_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "warmer = -1\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Prints the warmer of two temperatures, -1 and 1.
// b.le compares as signed, so -1 is below 1.

define(fp, x29)
define(lr, x30)
define(t1_r, x19)
define(t2_r, x20)
define(warm_r, x21)

.data
fmt_warm:   .string "warmer = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     t1_r, -1
        mov     t2_r, 1
        mov     warm_r, t2_r                // assume the second is warmer
        cmp     t1_r, t2_r
        b.le    report                      // signed less than or equal
        mov     warm_r, t1_r
report:
        ldr     x0, =fmt_warm
        mov     x1, warm_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "warmer = 1\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm Architecture Reference Manual, C1.2.4 Condition code",
      href: "https://developer.arm.com/documentation/ddi0487/mc/-Part-C-The-AArch64-Instruction-Set/-Chapter-C1-The-A64-Instruction-Set/-C1-2-Structure-of-the-A64-assembler-language/-C1-2-4-Condition-code",
    },
    lesson: "assembly-conditionals-basics",
    reference: "b.cond",
  },
  {
    slug: "cbz-sets-no-flags",
    title: "cbz and cbnz test a register without setting the flags",
    group: "flags",
    mistake:
      "`cbz x20, label` branches when x20 is zero and writes no flags. A `b.lt` after it does not ask whether x20 is negative; it reads the last compare, which here was the loop's `cmp`. Like `b.cond`, `cbz` reaches labels up to 1 MB away; `b` and `bl` reach 128 MB.",
    server: "prints `7 is negative` on its last line: `b.lt` read the loop compare `i < 3`, which was true.",
    playground: "prints the same three lines.",
    fix: "Compare the value itself before testing its sign: `cmp val_r, 0`, then `b.lt`. The fixed program prints `7 is positive`.",
    wrong: `        cbz     val_r, class_print
        b.lt    class_print`,
    right: `        cbz     val_r, class_print
        cmp     val_r, 0
        b.lt    class_print`,
    broken: {
      source: `// Says whether each value is negative, zero, or positive.
// cbz tests for zero but sets no flags, so b.lt reads the loop's compare.

define(fp, x29)
define(lr, x30)
define(i_r, x19)
define(val_r, x20)
define(base_r, x21)

.data
values:     .dword -4, 0, 7
fmt_neg:    .string "%ld is negative\\n"
fmt_zero:   .string "%ld is zero\\n"
fmt_pos:    .string "%ld is positive\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     base_r, =values
        mov     i_r, 0
        b       class_test
class_loop:
        ldr     val_r, [base_r, i_r, lsl 3]
        ldr     x0, =fmt_zero
        cbz     val_r, class_print          // zero: no flags change here
        ldr     x0, =fmt_neg
        b.lt    class_print                 // the mistake: these flags came from cmp i_r, 3
        ldr     x0, =fmt_pos
class_print:
        mov     x1, val_r
        bl      printf
        add     i_r, i_r, 1
class_test:
        cmp     i_r, 3
        b.lt    class_loop

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "-4 is negative\n0 is zero\n7 is negative\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Says whether each value is negative, zero, or positive.
// A cmp against 0 sets the flags the sign test reads.

define(fp, x29)
define(lr, x30)
define(i_r, x19)
define(val_r, x20)
define(base_r, x21)

.data
values:     .dword -4, 0, 7
fmt_neg:    .string "%ld is negative\\n"
fmt_zero:   .string "%ld is zero\\n"
fmt_pos:    .string "%ld is positive\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     base_r, =values
        mov     i_r, 0
        b       class_test
class_loop:
        ldr     val_r, [base_r, i_r, lsl 3]
        ldr     x0, =fmt_zero
        cbz     val_r, class_print
        ldr     x0, =fmt_neg
        cmp     val_r, 0                    // flags from the value itself
        b.lt    class_print
        ldr     x0, =fmt_pos
class_print:
        mov     x1, val_r
        bl      printf
        add     i_r, i_r, 1
class_test:
        cmp     i_r, 3
        b.lt    class_loop

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "-4 is negative\n0 is zero\n7 is positive\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: CBZ",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/Base-Instructions/CBZ--Compare-and-branch-on-zero-",
    },
    lesson: "assembly-conditionals-basics",
    reference: "cbz",
  },
  {
    slug: "csinc-adds-one-when-false",
    title: "csinc adds one when the condition is false; cinc when it is true",
    group: "flags",
    mistake:
      "`csinc d, n, m, cond` gives n when cond holds and m + 1 when it does not, so the increment happens on the false side. `cinc d, n, cond` adds on the true side: n + 1 when cond holds. The assembler turns `cinc` into `csinc` with the condition flipped, which is why the disassembly shows the opposite condition.",
    server: "prints `passed: 2`: `csinc` counted the two marks under 50.",
    playground: "prints the same line.",
    fix: "Count with `cinc pass_r, pass_r, ge`. The fixed program prints `passed: 3`.",
    wrong: `        cmp     w9, 50
        csinc   pass_r, pass_r, pass_r, ge`,
    right: `        cmp     w9, 50
        cinc    pass_r, pass_r, ge`,
    broken: {
      source: `// Counts the passing marks, 50 or more, in a list of five.
// csinc adds one when its condition is false, so it counts the fails.

define(fp, x29)
define(lr, x30)
define(i_r, w19)
define(pass_r, w20)
define(base_r, x21)

.data
marks:      .word 72, 45, 90, 38, 66
fmt_pass:   .string "passed: %d\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     base_r, =marks
        mov     i_r, 0
        mov     pass_r, 0
        b       mark_test
mark_loop:
        ldr     w9, [base_r, i_r, SXTW 2]
        cmp     w9, 50
        csinc   pass_r, pass_r, pass_r, ge  // the mistake: adds one when the mark is under 50
        add     i_r, i_r, 1
mark_test:
        cmp     i_r, 5
        b.lt    mark_loop

        ldr     x0, =fmt_pass
        mov     w1, pass_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "passed: 2\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Counts the passing marks, 50 or more, in a list of five.
// cinc adds one when its condition holds.

define(fp, x29)
define(lr, x30)
define(i_r, w19)
define(pass_r, w20)
define(base_r, x21)

.data
marks:      .word 72, 45, 90, 38, 66
fmt_pass:   .string "passed: %d\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     base_r, =marks
        mov     i_r, 0
        mov     pass_r, 0
        b       mark_test
mark_loop:
        ldr     w9, [base_r, i_r, SXTW 2]
        cmp     w9, 50
        cinc    pass_r, pass_r, ge          // adds one when the mark is 50 or more
        add     i_r, i_r, 1
mark_test:
        cmp     i_r, 5
        b.lt    mark_loop

        ldr     x0, =fmt_pass
        mov     w1, pass_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "passed: 3\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: CSINC",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/Base-Instructions/CSINC--Conditional-select-increment-",
    },
    lesson: "assembly-conditionals-basics",
    reference: "csinc",
  },
  {
    slug: "off-by-one-loop-bound",
    title: "The branch condition decides whether the last index runs",
    group: "flags",
    mistake:
      "A loop over n elements runs indexes 0 to n - 1. Exit when `i >= n` (`b.ge`); `b.gt` lets i = n through, one element past the end.",
    server: "prints `sum = 10014`: i = 5 still ran and added the 9999 stored after the array.",
    playground: "prints the same line.",
    fix: "Leave the loop with `b.ge`. The fixed program prints `sum = 15`.",
    wrong: `        cmp     i_r, 5
        b.gt    done`,
    right: `        cmp     i_r, 5
        b.ge    done`,
    broken: {
      source: `// Sums a five-element array.
// b.gt lets index 5 through, one past the end.

define(fp, x29)
define(lr, x30)
define(i_r, w19)
define(total_r, w20)

.data
vals:       .word 1, 2, 3, 4, 5
            .word 9999                      // whatever happens to come next
fmt_total:    .string "sum = %d\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     i_r, 0
        mov     total_r, 0
        ldr     x21, =vals
loop:
        cmp     i_r, 5                      // five elements: indexes 0 to 4
        b.gt    done                        // the mistake: i = 5 still runs
        ldr     w22, [x21, i_r, SXTW 2]
        add     total_r, total_r, w22
        add     i_r, i_r, 1
        b       loop
done:
        ldr     x0, =fmt_total
        mov     w1, total_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "sum = 10014\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Sums a five-element array.
// b.ge stops the loop after the last valid index.

define(fp, x29)
define(lr, x30)
define(i_r, w19)
define(total_r, w20)

.data
vals:       .word 1, 2, 3, 4, 5
            .word 9999                      // never read once the bound is right
fmt_total:    .string "sum = %d\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     i_r, 0
        mov     total_r, 0
        ldr     x21, =vals
loop:
        cmp     i_r, 5
        b.ge    done                        // i stops after 4
        ldr     w22, [x21, i_r, SXTW 2]
        add     total_r, total_r, w22
        add     i_r, i_r, 1
        b       loop
done:
        ldr     x0, =fmt_total
        mov     w1, total_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "sum = 15\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm Architecture Reference Manual, C1.2.4 Condition code",
      href: "https://developer.arm.com/documentation/ddi0487/mc/-Part-C-The-AArch64-Instruction-Set/-Chapter-C1-The-A64-Instruction-Set/-C1-2-Structure-of-the-A64-assembler-language/-C1-2-4-Condition-code",
    },
    lesson: "pretest-loop",
    reference: "b.cond",
  },
];
