import type { Pitfall } from "@/lib/content/pitfall-data";

/** Integer arithmetic: what divide, multiply, and shift do at the edges. */
export const ARITHMETIC_PITFALLS: Pitfall[] = [
  {
    slug: "divide-by-zero-gives-zero",
    title: "Dividing by zero gives 0, with no error",
    group: "arithmetic",
    mistake:
      "`sdiv` and `udiv` by zero write 0 to the destination and carry on. Nothing traps and nothing is printed, so a missing check turns into a quiet wrong answer.",
    server: "prints `average = 0` and exits normally.",
    playground: "prints the same line.",
    fix: "Test the divisor before dividing: `cbz count_r, no_marks`. The fixed program prints `no marks to average`.",
    wrong: `        sdiv    x1, total_r, count_r`,
    right: `        cbz     count_r, no_marks
        sdiv    x1, total_r, count_r`,
    broken: {
      source: `// Averages a list of marks; this time the list is empty.
// sdiv by zero gives 0 without any error.

define(fp, x29)
define(lr, x30)
define(total_r, x19)
define(count_r, x20)

.data
fmt_avg:    .string "average = %ld\\n"
fmt_none:   .string "no marks to average\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     total_r, 0
        mov     count_r, 0                  // no marks were entered
        sdiv    x1, total_r, count_r        // the mistake: 0 / 0 quietly gives 0
        ldr     x0, =fmt_avg
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "average = 0\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Averages a list of marks; this time the list is empty.
// cbz catches the zero count before the divide.

define(fp, x29)
define(lr, x30)
define(total_r, x19)
define(count_r, x20)

.data
fmt_avg:    .string "average = %ld\\n"
fmt_none:   .string "no marks to average\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     total_r, 0
        mov     count_r, 0                  // no marks were entered
        cbz     count_r, no_marks           // nothing to divide by
        sdiv    x1, total_r, count_r
        ldr     x0, =fmt_avg
        bl      printf
        b       done
no_marks:
        ldr     x0, =fmt_none
        bl      printf
done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "no marks to average\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: SDIV",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/Base-Instructions/SDIV--quotient---Signed-divide-",
    },
    lesson: "arithmetic-instructions",
    reference: "sdiv",
  },
  {
    slug: "int-min-divided-by-minus-one",
    title: "The most negative int divided by -1 stays negative",
    group: "arithmetic",
    mistake:
      "A 32-bit int runs from -2147483648 to 2147483647. -2147483648 / -1 is 2147483648, which does not fit, so `sdiv` on w registers gives back -2147483648. There is no overflow trap and no flag.",
    server: "prints `-2147483648 / -1 = -2147483648`.",
    playground: "prints the same line.",
    fix: "Divide in 64 bits when the quotient may not fit: sign-extend with `sxtw` and use x registers. The fixed program prints `-2147483648 / -1 = 2147483648`.",
    wrong: `        sdiv    quot_r, top_r, bottom_r`,
    right: `        sxtw    x9, top_r
        sxtw    x10, bottom_r
        sdiv    quot_r, x9, x10`,
    broken: {
      source: `// Divides the most negative int by -1.
// The true answer, 2147483648, does not fit in 32 bits.

define(fp, x29)
define(lr, x30)
define(top_r, w19)
define(bottom_r, w20)
define(quot_r, w21)

.data
fmt_div:    .string "%d / %d = %d\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     top_r, 0x80000000           // -2147483648, the smallest int
        mov     bottom_r, -1
        sdiv    quot_r, top_r, bottom_r     // the mistake: the quotient wraps back

        ldr     x0, =fmt_div
        mov     w1, top_r
        mov     w2, bottom_r
        mov     w3, quot_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "-2147483648 / -1 = -2147483648\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Divides the most negative int by -1.
// Widened to 64 bits first, the quotient fits.

define(fp, x29)
define(lr, x30)
define(top_r, w19)
define(bottom_r, w20)
define(quot_r, x21)

.data
fmt_div:    .string "%d / %d = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     top_r, 0x80000000           // -2147483648, the smallest int
        mov     bottom_r, -1
        sxtw    x9, top_r                   // widen both ints, keeping their signs
        sxtw    x10, bottom_r
        sdiv    quot_r, x9, x10             // 2147483648 fits in 64 bits

        ldr     x0, =fmt_div
        mov     w1, top_r
        mov     w2, bottom_r
        mov     x3, quot_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "-2147483648 / -1 = 2147483648\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: SDIV",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/Base-Instructions/SDIV--quotient---Signed-divide-",
    },
    lesson: "arithmetic-instructions",
    reference: "sdiv",
  },
  {
    slug: "no-remainder-instruction",
    title: "There is no remainder instruction",
    group: "arithmetic",
    mistake:
      "A64 has divide instructions but no remainder instruction. The remainder of a / b is a - (a / b) * b, which takes an `sdiv` followed by an `msub`.",
    server: "does not build: as reports an unknown mnemonic, `mod`.",
    playground: "does not build either, with the same unknown mnemonic error.",
    fix: "Divide, then multiply back and subtract in one step: `sdiv x9, a_r, b_r` and `msub x21, x9, b_r, a_r`. The fixed program prints `47 mod 5 = 2`.",
    wrong: `        mod     x21, a_r, b_r`,
    right: `        sdiv    x9, a_r, b_r
        msub    x21, x9, b_r, a_r`,
    broken: {
      source: `// Prints 47 mod 5.
// There is no mod instruction in A64.

define(fp, x29)
define(lr, x30)
define(a_r, x19)
define(b_r, x20)

.data
fmt_mod:    .string "%ld mod %ld = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     a_r, 47
        mov     b_r, 5
        mod     x21, a_r, b_r               // the mistake: no such instruction

        ldr     x0, =fmt_mod
        mov     x1, a_r
        mov     x2, b_r
        mov     x3, x21
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "",
      ends: { buildError: "unknown mnemonic `mod' -- `mod x21,x19,x20'" },
    },
    fixed: {
      source: `// Prints 47 mod 5.
// The remainder is a - (a / b) * b: sdiv, then msub.

define(fp, x29)
define(lr, x30)
define(a_r, x19)
define(b_r, x20)

.data
fmt_mod:    .string "%ld mod %ld = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     a_r, 47
        mov     b_r, 5
        sdiv    x9, a_r, b_r                // quotient: 9
        msub    x21, x9, b_r, a_r           // 47 - 9 * 5 = 2

        ldr     x0, =fmt_mod
        mov     x1, a_r
        mov     x2, b_r
        mov     x3, x21
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "47 mod 5 = 2\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: MSUB",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/Base-Instructions/MSUB--Multiply-subtract-",
    },
    lesson: "arithmetic-instructions",
    reference: "msub",
  },
  {
    slug: "shift-amount-wraps",
    title: "A shift by a register amount wraps at the register width",
    group: "arithmetic",
    mistake:
      "`lsl x9, x9, x20` shifts by x20 modulo 64 (modulo 32 for w registers). A shift by 64 is a shift by 0, not a shift that clears every bit.",
    server: "prints `mask = 0x0`: 1 << 64 came out as 1 << 0, and 1 - 1 is 0.",
    playground: "prints the same line.",
    fix: "Handle the full width on its own, since no shift gives it: all 64 bits set is `mov x1, -1`. The fixed program prints `mask = 0xffffffffffffffff`.",
    wrong: `        lsl     x9, x9, n_r
        sub     x1, x9, 1`,
    right: `        cmp     n_r, 64
        b.lo    shift_mask
        mov     x1, -1`,
    broken: {
      source: `// Builds a mask of the low n bits as (1 << n) - 1, for n = 64.
// The shift amount is taken modulo 64, so 64 shifts by 0.

define(fp, x29)
define(lr, x30)
define(n_r, x20)

.data
fmt_mask:   .string "mask = 0x%lx\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     n_r, 64                     // all 64 bits
        mov     x9, 1
        lsl     x9, x9, n_r                 // the mistake: 64 mod 64 = 0, so x9 stays 1
        sub     x1, x9, 1

        ldr     x0, =fmt_mask
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "mask = 0x0\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Builds a mask of the low n bits as (1 << n) - 1, for n = 64.
// A full-width mask is handled on its own, since no shift reaches it.

define(fp, x29)
define(lr, x30)
define(n_r, x20)

.data
fmt_mask:   .string "mask = 0x%lx\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     n_r, 64                     // all 64 bits
        cmp     n_r, 64
        b.lo    shift_mask
        mov     x1, -1                      // every bit set
        b       print_mask
shift_mask:
        mov     x9, 1
        lsl     x9, x9, n_r                 // safe: n is below 64 here
        sub     x1, x9, 1
print_mask:
        ldr     x0, =fmt_mask
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "mask = 0xffffffffffffffff\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: LSLV",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/Base-Instructions/LSLV--Logical-shift-left-variable-",
    },
    lesson: "shifts-and-bitfields",
    reference: "lsl",
  },
  {
    slug: "mul-takes-registers-only",
    title: "mul takes registers only and sets no flags",
    group: "arithmetic",
    mistake:
      "`mul` has no immediate form: both operands must be registers. It also never writes the flags, and there is no `muls`, so test a product with a separate `cmp`.",
    server: "does not build: as reports that operand 3, the 12, must be a register.",
    playground: "does not build either; the error asks for a register where the 12 is.",
    fix: "Load the constant into a register, then multiply. The fixed program prints `7 * 12 = 84`.",
    wrong: `        mul     x20, x19, 12`,
    right: `        mov     x9, 12
        mul     x20, x19, x9`,
    broken: {
      source: `// Multiplies 7 by 12.
// mul has no immediate form.

define(fp, x29)
define(lr, x30)

.data
fmt_mul:    .string "7 * 12 = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x19, 7
        mul     x20, x19, 12                // the mistake: 12 must be in a register

        ldr     x0, =fmt_mul
        mov     x1, x20
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "",
      ends: { buildError: "expected an integer or zero register at operand 3 -- `mul x20,x19,12'" },
    },
    fixed: {
      source: `// Multiplies 7 by 12.
// The constant goes in a register first.

define(fp, x29)
define(lr, x30)

.data
fmt_mul:    .string "7 * 12 = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x19, 7
        mov     x9, 12
        mul     x20, x19, x9

        ldr     x0, =fmt_mul
        mov     x1, x20
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "7 * 12 = 84\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: MUL",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/Base-Instructions/MUL--Multiply--an-alias-of-MADD-",
    },
    lesson: "arithmetic-instructions",
    reference: "mul",
  },
];
