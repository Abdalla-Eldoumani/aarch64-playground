import type { Pitfall } from "@/lib/content/pitfall-data";

/** Memory and addressing: what a load reads and which forms move the base. */
export const MEMORY_PITFALLS: Pitfall[] = [
  {
    slug: "offset-does-not-write-back",
    title: "[x19, 8] reads at x19 + 8 and leaves x19 alone",
    group: "memory",
    mistake:
      "Three forms look alike. `[x19, 8]` (offset) reads at x19 + 8 and leaves x19 unchanged. `[x19, 8]!` (pre-index) adds 8 to x19, then reads there. `[x19], 8` (post-index) reads at x19, then adds 8. Only the last two write the new address back.",
    server: "prints `sum = 20`: every pass read the second element, 5, because x19 never moved.",
    playground: "prints the same line; step through and x19 stays put in the registers panel.",
    fix: "Walk the array with post-index: `ldr x9, [ptr_r], 8`. The fixed program prints `sum = 24`.",
    wrong: `        ldr     x9, [ptr_r, 8]`,
    right: `        ldr     x9, [ptr_r], 8`,
    broken: {
      source: `// Sums four longs by walking a pointer along the array.
// The offset form reads ptr + 8 but never moves the pointer.

define(fp, x29)
define(lr, x30)
define(ptr_r, x19)
define(left_r, x20)
define(sum_r, x21)

.data
amounts:    .dword 3, 5, 7, 9
fmt_sum:    .string "sum = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     ptr_r, =amounts
        mov     left_r, 4
        mov     sum_r, 0
walk:
        ldr     x9, [ptr_r, 8]              // the mistake: reads ptr + 8, ptr stays put
        add     sum_r, sum_r, x9
        subs    left_r, left_r, 1
        b.ne    walk

        ldr     x0, =fmt_sum
        mov     x1, sum_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "sum = 20\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Sums four longs by walking a pointer along the array.
// Post-index reads at ptr, then moves ptr on by 8.

define(fp, x29)
define(lr, x30)
define(ptr_r, x19)
define(left_r, x20)
define(sum_r, x21)

.data
amounts:    .dword 3, 5, 7, 9
fmt_sum:    .string "sum = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     ptr_r, =amounts
        mov     left_r, 4
        mov     sum_r, 0
walk:
        ldr     x9, [ptr_r], 8              // read, then ptr = ptr + 8
        add     sum_r, sum_r, x9
        subs    left_r, left_r, 1
        b.ne    walk

        ldr     x0, =fmt_sum
        mov     x1, sum_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "sum = 24\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: LDR (immediate)",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/Base-Instructions/LDR--immediate---Load-register--immediate--",
    },
    lesson: "memory-and-addressing-modes",
    reference: "ldr",
  },
  {
    slug: "ldrb-zero-extends",
    title: "ldrb and ldrh fill with zeros; ldrsb, ldrsh, and ldrsw copy the sign",
    group: "memory",
    mistake:
      "A byte load has to fill the other bits of the register. `ldrb` and `ldrh` fill them with zeros, so the byte -5 (0xfb) arrives as 251. `ldrsb`, `ldrsh`, and `ldrsw` copy the sign bit up instead.",
    server: "prints `temp = 251`.",
    playground: "prints the same line, and x1 in the registers panel holds 0xfb with zeros above it.",
    fix: "Load signed data with the signed form: `ldrsb w1, [x19, 1]`. The fixed program prints `temp = -5`.",
    wrong: `        ldrb    w1, [x19, 1]`,
    right: `        ldrsb   w1, [x19, 1]`,
    broken: {
      source: `// Prints the second reading in a table of byte-sized temperatures.
// ldrb fills the upper bits with zeros, so -5 arrives as 251.

define(fp, x29)
define(lr, x30)

.data
temps:      .byte 12, -5, 3
fmt_temp:   .string "temp = %d\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x19, =temps
        ldrb    w1, [x19, 1]                // the mistake: bits 31 to 8 become zero
        ldr     x0, =fmt_temp
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "temp = 251\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Prints the second reading in a table of byte-sized temperatures.
// ldrsb copies the byte's sign bit into the upper bits.

define(fp, x29)
define(lr, x30)

.data
temps:      .byte 12, -5, 3
fmt_temp:   .string "temp = %d\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x19, =temps
        ldrsb   w1, [x19, 1]                // sign-extended: -5 stays -5
        ldr     x0, =fmt_temp
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "temp = -5\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: LDRB (immediate)",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/Base-Instructions/LDRB--immediate---Load-register-byte--immediate--",
    },
    lesson: "memory-and-addressing-modes",
    reference: "ldrsb",
  },
  {
    slug: "x-load-reads-two-ints",
    title: "An x load from an int array reads two ints",
    group: "memory",
    mistake:
      "The width of the register sets how many bytes a load reads: `ldr x1` reads 8, `ldr w1` reads 4. Pointed at an array of `.word` ints, an x load picks up an element and the one after it.",
    server: "prints `first score = 38654705671`: that is 9 * 2^32 + 7, the second score sitting in the top half.",
    playground: "prints the same line.",
    fix: "Load an int into a w register, or sign-extend it into an x register with `ldrsw x1, [x19]`. The fixed program prints `first score = 7`.",
    wrong: `        ldr     x1, [x19]`,
    right: `        ldrsw   x1, [x19]`,
    broken: {
      source: `// Prints the first score in an array of ints.
// An x load reads 8 bytes: the first int and the second together.

define(fp, x29)
define(lr, x30)

.data
scores:     .word 7, 9, 4
fmt_first:  .string "first score = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x19, =scores
        ldr     x1, [x19]                   // the mistake: 8 bytes, two ints
        ldr     x0, =fmt_first
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "first score = 38654705671\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Prints the first score in an array of ints.
// ldrsw reads 4 bytes and sign-extends them to 64 bits.

define(fp, x29)
define(lr, x30)

.data
scores:     .word 7, 9, 4
fmt_first:  .string "first score = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x19, =scores
        ldrsw   x1, [x19]                   // one int, widened to 64 bits
        ldr     x0, =fmt_first
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "first score = 7\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: LDRSW (immediate)",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/Base-Instructions/LDRSW--immediate---Load-register-signed-word--immediate--",
    },
    lesson: "arrays-in-memory",
    reference: "ldrsw",
  },
  {
    slug: "little-endian-byte-order",
    title: "The lowest address holds the lowest byte",
    group: "memory",
    mistake:
      "AArch64 Linux is little-endian: `.word 0x12345678` is stored as the bytes 78 56 34 12, lowest byte first. A memory dump lists them in that order, and `ldrb` at the word's address reads 0x78.",
    server: "prints `top byte = 0x78`.",
    playground: "prints the same line; the memory view shows 78 56 34 12 at the label.",
    fix: "The most significant byte of a word is at offset 3: `ldrb w1, [x19, 3]`. The fixed program prints `top byte = 0x12`.",
    wrong: `        ldrb    w1, [x19]`,
    right: `        ldrb    w1, [x19, 3]`,
    broken: {
      source: `// Prints the most significant byte of 0x12345678.
// Little-endian memory puts the least significant byte first.

define(fp, x29)
define(lr, x30)

.data
code_word:  .word 0x12345678
fmt_top:    .string "top byte = 0x%x\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x19, =code_word
        ldrb    w1, [x19]                   // the mistake: offset 0 is the low byte, 0x78
        ldr     x0, =fmt_top
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "top byte = 0x78\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Prints the most significant byte of 0x12345678.
// In little-endian memory it sits at offset 3.

define(fp, x29)
define(lr, x30)

.data
code_word:  .word 0x12345678
fmt_top:    .string "top byte = 0x%x\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x19, =code_word
        ldrb    w1, [x19, 3]                // bytes 78 56 34 12: the 12 is last
        ldr     x0, =fmt_top
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "top byte = 0x12\n",
      ends: { exit: 0 },
    },
    source: {
      title: "AAPCS64: Byte order (Endianness)",
      href: "https://github.com/ARM-software/abi-aa/blob/2025Q4/aapcs64/aapcs64.rst#byte-order-endianness",
    },
    lesson: "memory-and-addressing-modes",
    reference: "ldrb",
  },
];
