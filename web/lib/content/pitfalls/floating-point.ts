import type { Pitfall } from "@/lib/content/pitfall-data";

/** Floating point: converting between doubles and integers. */
export const FLOATING_POINT_PITFALLS: Pitfall[] = [
  {
    slug: "fcvtzs-rounds-toward-zero",
    title: "fcvtzs drops the fraction; it does not round",
    group: "floating-point",
    mistake:
      "`fcvtzs` converts a double to an integer by rounding toward zero: 2.99 becomes 2 and -2.99 becomes -2. The z in the name stands for that zero. `fcvtas` rounds to the nearest integer, with halves going away from zero.",
    server: "prints `rounded = 2`.",
    playground: "prints the same line.",
    fix: "Round to nearest with `fcvtas x1, d0`. The fixed program prints `rounded = 3`.",
    wrong: `fcvtzs  x1, d0`,
    right: `fcvtas  x1, d0`,
    broken: {
      source: `// Rounds a price of 2.99 to the nearest whole number.
// fcvtzs drops the fraction instead of rounding.

define(fp, x29)
define(lr, x30)

.data
price:      .double 2.99
fmt_round:  .string "rounded = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =price
        ldr     d0, [x9]
        fcvtzs  x1, d0                      // the mistake: rounds toward zero, 2.99 -> 2

        ldr     x0, =fmt_round
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "rounded = 2\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Rounds a price of 2.99 to the nearest whole number.
// fcvtas rounds to nearest, halves away from zero.

define(fp, x29)
define(lr, x30)

.data
price:      .double 2.99
fmt_round:  .string "rounded = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =price
        ldr     d0, [x9]
        fcvtas  x1, d0                      // nearest: 2.99 -> 3

        ldr     x0, =fmt_round
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "rounded = 3\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: FCVTZS (scalar, integer)",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/SIMD-FP-Instructions/FCVTZS--scalar--integer---Floating-point-convert-to-signed-integer--rounding-toward-zero--scalar--",
    },
    lesson: "floating-point",
    reference: "fcvtzs",
  },
];
