import type { Pitfall } from "@/lib/content/pitfall-data";

/** Data and directives: what the assembler lays down in .data. */
export const DATA_PITFALLS: Pitfall[] = [
  {
    slug: "ascii-has-no-terminator",
    title: ".ascii adds no zero byte; .string does",
    group: "data",
    mistake:
      "printf reads a string byte by byte until it meets a zero byte. `.string` (and `.asciz`) put that zero after the text; `.ascii` does not, so printf keeps going into whatever the assembler placed next.",
    server: "prints `second line` twice: the first printf ran off the end of the first string into the second.",
    playground: "prints the same three lines.",
    fix: "Declare text that printf reads with `.string`. The fixed program prints each line once.",
    wrong: `fmt_first:  .ascii  "first line\\n"`,
    right: `fmt_first:  .string "first line\\n"`,
    broken: {
      source: `// Prints two lines with two printf calls.
// .ascii leaves the first string without its zero byte.

define(fp, x29)
define(lr, x30)

.data
fmt_first:  .ascii  "first line\\n"        // the mistake: no zero byte at the end
fmt_second: .string "second line\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_first
        bl      printf                      // reads on into fmt_second
        ldr     x0, =fmt_second
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "first line\nsecond line\nsecond line\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Prints two lines with two printf calls.
// .string ends each string with a zero byte.

define(fp, x29)
define(lr, x30)

.data
fmt_first:  .string "first line\\n"
fmt_second: .string "second line\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_first
        bl      printf                      // stops at the zero byte
        ldr     x0, =fmt_second
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "first line\nsecond line\n",
      ends: { exit: 0 },
    },
    source: {
      title: "GNU as manual: .ascii",
      href: "https://sourceware.org/binutils/docs/as/Ascii.html",
    },
    lesson: "strings-and-command-line-arguments",
    reference: "ldrb",
  },
  {
    slug: "align-counts-powers-of-two",
    title: ".align 3 means 8 bytes; .balign 8 means 8 bytes",
    group: "data",
    mistake:
      "On AArch64, `.align n` pads to a multiple of 2^n bytes, so `.align 8` pads to 256, not 8. `.balign` takes the byte count itself. Code that reaches a field by a fixed offset then reads padding.",
    server: "prints `total = 0`: offset 8 landed in the padding, and the total sits 256 bytes in.",
    playground: "prints the same line; the memory view shows the zeros after the count.",
    fix: "Say the byte count with `.balign 8` (or write `.align 3`). The fixed program prints `total = 1024`.",
    wrong: `record:     .word 3
        .align  8
            .dword 1024`,
    right: `record:     .word 3
        .balign 8
            .dword 1024`,
    broken: {
      source: `// Reads the total from a record: a 4-byte count, padding to 8, an 8-byte total.
// .align 8 pads to 2^8 = 256 bytes, so the total is not at offset 8.

define(fp, x29)
define(lr, x30)
define(TOTAL_OFFSET, 8)

.data
record:     .word 3                         // count
        .align  8                           // the mistake: 256 bytes, not 8
            .dword 1024                     // total
fmt_total:  .string "total = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x19, =record
        ldr     x1, [x19, TOTAL_OFFSET]     // reads padding
        ldr     x0, =fmt_total
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "total = 0\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Reads the total from a record: a 4-byte count, padding to 8, an 8-byte total.
// .balign 8 pads to the next multiple of 8 bytes.

define(fp, x29)
define(lr, x30)
define(TOTAL_OFFSET, 8)

.data
record:     .word 3                         // count
        .balign 8                           // 4 bytes of padding
            .dword 1024                     // total
fmt_total:  .string "total = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x19, =record
        ldr     x1, [x19, TOTAL_OFFSET]
        ldr     x0, =fmt_total
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "total = 1024\n",
      ends: { exit: 0 },
    },
    source: {
      title: "GNU as manual: .align",
      href: "https://sourceware.org/binutils/docs/as/Align.html",
    },
    lesson: "arrays-in-memory",
    reference: "ldr",
  },
];
