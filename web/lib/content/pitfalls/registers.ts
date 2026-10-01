import type { Pitfall } from "@/lib/content/pitfall-data";

/** Registers and values: what a register can hold and how it gets there. */
export const REGISTER_PITFALLS: Pitfall[] = [
  {
    slug: "w-write-clears-top-half",
    title: "A w write clears the top half of the x register",
    group: "registers",
    mistake:
      "w19 is the low 32 bits of x19. Any instruction that writes w19 also sets bits 63 to 32 of x19 to zero, so a 64-bit value updated through its w name loses its top half.",
    server:
      "prints `bytes = 947912705`: 5,242,880,000 lost its top 32 bits when `add w19, w19, 1` wrote the register.",
    playground: "prints the same line, and the registers panel shows x19 drop to a 32-bit value at the add.",
    fix: "Update a 64-bit value through its x name: `add x19, x19, 1`. The fixed program prints `bytes = 5242880001`.",
    wrong: `        add     w19, w19, 1`,
    right: `        add     x19, x19, 1`,
    broken: {
      source: `// Counts the bytes in 40,000 records of 131,072 bytes, then adds one more.
// The add writes w19, which clears the top half of x19.

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

        mov     x19, 40000                  // records
        mov     x20, 131072                 // bytes in each record
        mul     x19, x19, x20               // 5,242,880,000: needs more than 32 bits
        add     w19, w19, 1                 // the mistake: a w write zeroes bits 63 to 32

        ldr     x0, =fmt_bytes
        mov     x1, x19
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "bytes = 947912705\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Counts the bytes in 40,000 records of 131,072 bytes, then adds one more.
// The add uses x19, so all 64 bits take part.

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

        mov     x19, 40000                  // records
        mov     x20, 131072                 // bytes in each record
        mul     x19, x19, x20               // 5,242,880,000
        add     x19, x19, 1                 // 64-bit add: the top half stays

        ldr     x0, =fmt_bytes
        mov     x1, x19
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "bytes = 5242880001\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm Architecture Reference Manual, C1.2.6 Register names",
      href: "https://developer.arm.com/documentation/ddi0487/mc/-Part-C-The-AArch64-Instruction-Set/-Chapter-C1-The-A64-Instruction-Set/-C1-2-Structure-of-the-A64-assembler-language/-C1-2-6-Register-names",
    },
    lesson: "registers-and-immediates",
    reference: "add",
  },
  {
    slug: "there-is-no-x31",
    title: "There is no x31",
    group: "registers",
    mistake:
      "The general-purpose registers are x0 to x30. Register number 31 in an instruction means sp in some instructions and xzr, the zero register, in others, so the assembler makes you write which one you mean.",
    server: "does not build: as reports `expected a register or register list at operand 1` for `mov x31,7`.",
    playground: "does not build either; the error says x31 is not a register and lists the ones that are.",
    fix: "Pick a free register from x9 to x15 for scratch work. The fixed program uses x11 and prints `product = 42`.",
    wrong: `        mov     x31, 7`,
    right: `        mov     x11, 7`,
    broken: {
      source: `// Multiplies 6 by 7, using x31 as one more scratch register.
// Register number 31 is sp or xzr, never a general-purpose register.

define(fp, x29)
define(lr, x30)

.data
fmt_product:    .string "product = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x10, 6
        mov     x31, 7                      // the mistake: x31 does not exist
        mul     x12, x10, x31

        ldr     x0, =fmt_product
        mov     x1, x12
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "",
      ends: { buildError: "expected a register or register list at operand 1 -- `mov x31,7'" },
    },
    fixed: {
      source: `// Multiplies 6 by 7 with two scratch registers from x9 to x15.

define(fp, x29)
define(lr, x30)

.data
fmt_product:    .string "product = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x10, 6
        mov     x11, 7                      // a real scratch register
        mul     x12, x10, x11

        ldr     x0, =fmt_product
        mov     x1, x12
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "product = 42\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm Architecture Reference Manual, C1.2.6 Register names",
      href: "https://developer.arm.com/documentation/ddi0487/mc/-Part-C-The-AArch64-Instruction-Set/-Chapter-C1-The-A64-Instruction-Set/-C1-2-Structure-of-the-A64-assembler-language/-C1-2-6-Register-names",
    },
    lesson: "registers-and-immediates",
    reference: "mov",
  },
  {
    slug: "mov-takes-one-16-bit-chunk",
    title: "mov loads one 16-bit chunk, not any number",
    group: "registers",
    mistake:
      "An instruction is 32 bits, so `mov` has room for one 16-bit chunk (placed at bit 0, 16, 32, or 48) or a repeating bit pattern. 100000 is 0x186a0, which spans two chunks, so no single `mov` can load it.",
    server: "does not build: as reports `immediate cannot be moved by a single instruction`.",
    playground: "does not build either, and the error says the value needs movz and movk.",
    fix: "Load the low chunk with `movz`, then add each higher chunk with `movk`, which keeps the bits it does not write. `ldr x19, =100000` also works: it reads the value from the literal pool. The fixed program prints `seats = 100000`.",
    wrong: `        mov     x19, 100000`,
    right: `        movz    x19, 0x86a0
        movk    x19, 0x1, lsl 16`,
    broken: {
      source: `// Prints the number of seats in a stadium: 100000.
// mov can place one 16-bit chunk, and 100000 needs two.

define(fp, x29)
define(lr, x30)

.data
fmt_seats:  .string "seats = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x19, 100000                 // the mistake: 0x186a0 spans two chunks

        ldr     x0, =fmt_seats
        mov     x1, x19
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "",
      ends: { buildError: "immediate cannot be moved by a single instruction" },
    },
    fixed: {
      source: `// Prints the number of seats in a stadium: 100000.
// movz sets the low chunk, movk adds the next one.

define(fp, x29)
define(lr, x30)

.data
fmt_seats:  .string "seats = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        movz    x19, 0x86a0                 // bits 15 to 0 of 0x186a0
        movk    x19, 0x1, lsl 16            // bits 31 to 16; the low chunk stays

        ldr     x0, =fmt_seats
        mov     x1, x19
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "seats = 100000\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: MOV (wide immediate)",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/Base-Instructions/MOV--wide-immediate---Move-wide-immediate-value--an-alias-of-MOVZ-",
    },
    lesson: "registers-and-immediates",
    reference: "movk",
  },
  {
    slug: "add-immediate-range",
    title: "add and sub take an immediate from 0 to 4095",
    group: "registers",
    mistake:
      "`add` and `sub` have 12 bits for an immediate: 0 to 4095, or that value shifted left by 12 (a multiple of 4096). 5000 is neither.",
    server: "does not build: as reports `immediate out of range`.",
    playground: "does not build either, and the error gives the range: 0 to 4095, or a multiple of 4096.",
    fix: "Put a larger number in a register first, then add the register. The fixed program prints `balance = 17000`.",
    wrong: `        add     x19, x19, 5000`,
    right: `        mov     x9, 5000
        add     x19, x19, x9`,
    broken: {
      source: `// Adds a deposit of 5000 to a balance of 12000.
// add has 12 bits for its immediate, and 5000 does not fit.

define(fp, x29)
define(lr, x30)

.data
fmt_balance:    .string "balance = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x19, 12000                  // the balance
        add     x19, x19, 5000              // the mistake: 5000 is past 4095

        ldr     x0, =fmt_balance
        mov     x1, x19
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "",
      ends: { buildError: "immediate out of range" },
    },
    fixed: {
      source: `// Adds a deposit of 5000 to a balance of 12000.
// The deposit goes in a register first, since add's immediate stops at 4095.

define(fp, x29)
define(lr, x30)

.data
fmt_balance:    .string "balance = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x19, 12000                  // the balance
        mov     x9, 5000                    // mov takes any 16-bit value
        add     x19, x19, x9

        ldr     x0, =fmt_balance
        mov     x1, x19
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "balance = 17000\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: ADD (immediate)",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/Base-Instructions/ADD--immediate---Add-immediate-value-",
    },
    lesson: "registers-and-immediates",
    reference: "add",
  },
  {
    slug: "ldr-without-equals",
    title: "ldr x0, fmt loads the text, ldr x0, =fmt loads its address",
    group: "registers",
    mistake:
      "`ldr x0, =fmt` is a pseudo-instruction: the assembler stores fmt's address in a literal pool, a table of constants after the code, and loads it from there. Without the `=`, `ldr x0, fmt` loads the 8 bytes stored at fmt, the first characters of the string. A literal load like that also reaches only 1 MB from the instruction.",
    server: "prints nothing and stops with `Segmentation fault`: printf treats 8 bytes of text as an address.",
    playground: "stops at the `bl printf` with a segmentation fault and shows the text bytes x0 holds where an address should be.",
    fix: "Write the `=` so x0 gets the address: `ldr x0, =fmt_total`. The fixed program prints `total = 42`.",
    wrong: `        ldr     x0, fmt_total`,
    right: `        ldr     x0, =fmt_total`,
    broken: {
      source: `// Prints a total. The format string's address should go in x0,
// but this ldr loads the string's first 8 bytes instead.

define(fp, x29)
define(lr, x30)

.data
fmt_total:  .string "total = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, fmt_total               // the mistake: no =, so x0 holds text
        mov     x1, 42
        bl      printf                      // printf follows x0 as a pointer

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "",
      ends: { signal: "SIGSEGV" },
    },
    fixed: {
      source: `// Prints a total. ldr with = puts the format string's address in x0.

define(fp, x29)
define(lr, x30)

.data
fmt_total:  .string "total = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_total              // the address, from the literal pool
        mov     x1, 42
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "total = 42\n",
      ends: { exit: 0 },
    },
    source: {
      title: "GNU as manual: AArch64 opcodes (the LDR = pseudo-instruction)",
      href: "https://sourceware.org/binutils/docs/as/AArch64-Opcodes.html",
    },
    lesson: "printing-defined-variables",
    reference: "ldr",
  },
  {
    slug: "adrp-needs-lo12",
    title: "adrp gives the page, not the address",
    group: "registers",
    mistake:
      "`adrp x0, fmt_total` puts the address of the 4 KB page that holds fmt_total in x0, with the low 12 bits cleared. The label's place inside the page has to be added after it with `add x0, x0, :lo12:fmt_total`.",
    server: "prints `the page starts here`: x0 points at the start of the page, where another string sits.",
    playground: "prints the same line, and x0 in the registers panel ends in 000.",
    fix: "Follow every `adrp` with the `add` of the label's low 12 bits. The fixed program prints `total = 42`.",
    wrong: `        adrp    x0, fmt_total
        bl      printf`,
    right: `        adrp    x0, fmt_total
        add     x0, x0, :lo12:fmt_total
        bl      printf`,
    broken: {
      source: `// Prints a total with an adrp-loaded format string.
// adrp alone gives the start of the page, where a different string sits.

define(fp, x29)
define(lr, x30)

.data
        .balign 4096                        // put the first string at a page start
fmt_page:   .string "the page starts here\\n"
fmt_total:  .string "total = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        adrp    x0, fmt_total               // the mistake: the page, low 12 bits zero
        mov     x1, 42
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "the page starts here\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Prints a total with an adrp-loaded format string.
// The add puts the label's offset inside the page back.

define(fp, x29)
define(lr, x30)

.data
        .balign 4096                        // put the first string at a page start
fmt_page:   .string "the page starts here\\n"
fmt_total:  .string "total = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        adrp    x0, fmt_total               // the page
        add     x0, x0, :lo12:fmt_total     // plus the place inside it
        mov     x1, 42
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "total = 42\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: ADRP",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/Base-Instructions/ADRP--Form-PC-relative-address-to-4KB-page-",
    },
    lesson: "external-data",
    reference: "adrp",
  },
  {
    slug: "sign-extend-a-negative-index",
    title: "Sign-extend a negative int before using it as an address",
    group: "registers",
    mistake:
      "An int index lives in a w register. Read through its x name, -1 becomes 4294967295, because the top 32 bits are zero rather than copies of the sign bit.",
    server: "prints nothing and stops with `Segmentation fault`: the index points about 32 GB past the array.",
    playground: "stops at the load with a memory fault at that wild address.",
    fix: "Sign-extend while you scale: `ldr x1, [x12, w11, SXTW 3]`, or `sxtw x11, w11` first. The fixed program prints `neighbor = 200`.",
    wrong: `        sub     w11, w9, w10
        lsl     x11, x11, 3
        add     x13, x12, x11
        ldr     x1, [x13]`,
    right: `        sub     w11, w9, w10
        ldr     x1, [x12, w11, SXTW 3]`,
    broken: {
      source: `// Reads the neighbor before the middle of an array: index 1 - 2 = -1.
// The int index is used through its x name without sign extension.

define(fp, x29)
define(lr, x30)

.data
vals:       .dword 100, 200, 300, 400, 500
fmt_near:   .string "neighbor = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x12, =vals
        add     x12, x12, 16                // x12 -> vals[2], the middle
        mov     w9, 1
        mov     w10, 2
        sub     w11, w9, w10                // index = -1, an int in w11
        lsl     x11, x11, 3                 // the mistake: x11 is 4294967295, not -1
        add     x13, x12, x11
        ldr     x1, [x13]                   // a wild address
        ldr     x0, =fmt_near
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "",
      ends: { signal: "SIGSEGV" },
    },
    fixed: {
      source: `// Reads the neighbor before the middle of an array: index 1 - 2 = -1.
// SXTW sign-extends the int index as the load scales it.

define(fp, x29)
define(lr, x30)

.data
vals:       .dword 100, 200, 300, 400, 500
fmt_near:   .string "neighbor = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x12, =vals
        add     x12, x12, 16                // x12 -> vals[2], the middle
        mov     w9, 1
        mov     w10, 2
        sub     w11, w9, w10                // index = -1
        ldr     x1, [x12, w11, SXTW 3]      // sign-extend, scale by 8: vals[1]
        ldr     x0, =fmt_near
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "neighbor = 200\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm Architecture Reference Manual, C1.2.6 Register names",
      href: "https://developer.arm.com/documentation/ddi0487/mc/-Part-C-The-AArch64-Instruction-Set/-Chapter-C1-The-A64-Instruction-Set/-C1-2-Structure-of-the-A64-assembler-language/-C1-2-6-Register-names",
    },
    lesson: "shifts-and-bitfields",
    reference: "sxtw",
  },
];
