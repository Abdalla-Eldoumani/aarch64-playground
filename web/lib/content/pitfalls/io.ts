import type { Pitfall } from "@/lib/content/pitfall-data";

/** Input and output: what printf reads from which register. */
export const IO_PITFALLS: Pitfall[] = [
  {
    slug: "printf-reads-doubles-from-d",
    title: "printf reads a double from d0, never from x1",
    group: "io",
    mistake:
      "printf's arguments go in two separate sets of registers. Integers and pointers fill x1, x2, and so on; doubles fill d0, d1, and so on, counted separately. A `%f` reads the next d register, whatever is in x1.",
    server: "prints `average = 10.000000`: printf read d0, which still held the total.",
    playground: "prints the same line.",
    fix: "Put the double in d0: `fmov d0, d2`. The fixed program prints `average = 2.500000`.",
    wrong: `        fmov    x1, d2
        bl      printf`,
    right: `        fmov    d0, d2
        bl      printf`,
    broken: {
      source: `// Prints the average of a total of 10.0 over 4 items.
// The double goes in x1, but printf reads %f from d0.

define(fp, x29)
define(lr, x30)

.data
fmt_avg:    .string "average = %f\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        fmov    d0, 10.0                    // total
        fmov    d1, 4.0                     // items
        fdiv    d2, d0, d1                  // 2.5

        ldr     x0, =fmt_avg
        fmov    x1, d2                      // the mistake: doubles do not go in x registers
        bl      printf                      // %f reads d0: the total

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "average = 10.000000\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Prints the average of a total of 10.0 over 4 items.
// The double goes in d0, where printf reads %f.

define(fp, x29)
define(lr, x30)

.data
fmt_avg:    .string "average = %f\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        fmov    d0, 10.0                    // total
        fmov    d1, 4.0                     // items
        fdiv    d2, d0, d1                  // 2.5

        ldr     x0, =fmt_avg
        fmov    d0, d2                      // the first double argument
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "average = 2.500000\n",
      ends: { exit: 0 },
    },
    source: {
      title: "AAPCS64: Parameter passing rules",
      href: "https://github.com/ARM-software/abi-aa/blob/2025Q4/aapcs64/aapcs64.rst#parameter-passing-rules",
    },
    lesson: "floating-point",
    reference: "fmov",
  },
  {
    slug: "widen-a-float-for-printf",
    title: "Widen a float to a double before printf",
    group: "io",
    mistake:
      "printf has no way to print a 32-bit float: C passes every float to printf as a double. A float loaded into s0 leaves the top half of d0 zero, and `%f` reads all 64 bits as a double, a number too small to show.",
    server: "prints `ratio = 0.000000`.",
    playground: "prints the same line.",
    fix: "Convert first: `fcvt d0, s0`. The fixed program prints `ratio = 2.500000`.",
    wrong: `        ldr     s0, [x9]
        bl      printf`,
    right: `        ldr     s0, [x9]
        fcvt    d0, s0
        bl      printf`,
    broken: {
      source: `// Prints a 32-bit float, 2.5, with %f.
// printf reads a 64-bit double, and the float was never widened.

define(fp, x29)
define(lr, x30)

.data
ratio:      .single 2.5
fmt_ratio:  .string "ratio = %f\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =ratio
        ldr     s0, [x9]                    // a float: 32 bits; the top of d0 is 0
        ldr     x0, =fmt_ratio
        bl      printf                      // the mistake: d0 read as a double

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "ratio = 0.000000\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Prints a 32-bit float, 2.5, with %f.
// fcvt widens it to the double printf reads.

define(fp, x29)
define(lr, x30)

.data
ratio:      .single 2.5
fmt_ratio:  .string "ratio = %f\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =ratio
        ldr     s0, [x9]
        fcvt    d0, s0                      // float to double
        ldr     x0, =fmt_ratio
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "ratio = 2.500000\n",
      ends: { exit: 0 },
    },
    source: {
      title: "AAPCS64: Parameter passing rules (C widens a float to a double for a variadic call)",
      href: "https://github.com/ARM-software/abi-aa/blob/2025Q4/aapcs64/aapcs64.rst#parameter-passing-rules",
    },
    lesson: "floating-point",
    reference: "fcvt",
  },
  {
    slug: "format-width-matches-register",
    title: "%d prints w1; %ld prints x1",
    group: "io",
    mistake:
      "The format conversion says how many bits printf reads: `%d` reads the 32-bit w register, `%ld` the 64-bit x register. A 64-bit value printed with `%d` shows only its low 32 bits, read as signed.",
    server: "prints `bytes = -2036334592` for 6,553,600,000.",
    playground: "prints the same line.",
    fix: "Match the conversion to the register: `%ld` for x1. The fixed program prints `bytes = 6553600000`.",
    wrong: `fmt_bytes:  .string "bytes = %d\\n"`,
    right: `fmt_bytes:  .string "bytes = %ld\\n"`,
    broken: {
      source: `// Prints a 64-bit byte count: 50,000 blocks of 131,072 bytes.
// %d reads only the low 32 bits.

define(fp, x29)
define(lr, x30)

.data
fmt_bytes:  .string "bytes = %d\\n"        // the mistake: %d for a 64-bit value

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x19, 50000                  // blocks
        mov     x20, 131072                 // bytes in each block
        mul     x19, x19, x20               // 6,553,600,000

        ldr     x0, =fmt_bytes
        mov     x1, x19
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "bytes = -2036334592\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Prints a 64-bit byte count: 50,000 blocks of 131,072 bytes.
// %ld reads all 64 bits of x1.

define(fp, x29)
define(lr, x30)

.data
fmt_bytes:  .string "bytes = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x19, 50000                  // blocks
        mov     x20, 131072                 // bytes in each block
        mul     x19, x19, x20               // 6,553,600,000

        ldr     x0, =fmt_bytes
        mov     x1, x19
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "bytes = 6553600000\n",
      ends: { exit: 0 },
    },
    source: {
      title: "AAPCS64: Parameter passing rules",
      href: "https://github.com/ARM-software/abi-aa/blob/2025Q4/aapcs64/aapcs64.rst#parameter-passing-rules",
    },
    lesson: "printing-other-data-types",
    reference: "mov",
  },
];
