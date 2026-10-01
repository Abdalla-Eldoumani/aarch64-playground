import type { Pitfall } from "@/lib/content/pitfall-data";

/** The stack and calls: the frame, the 16-byte rule, and what a call may change. */
export const STACK_PITFALLS: Pitfall[] = [
  {
    slug: "frame-record-takes-16-bytes",
    title: "The frame record takes 16 bytes, not 8",
    group: "stack",
    mistake:
      "sp must be a multiple of 16 whenever it is used to reach memory or a call is made. `stp fp, lr, [sp, -8]!` stores 16 bytes but moves sp by only 8, so sp is off the boundary from then on.",
    server: "prints nothing and stops with `Bus error`: printf's own `stp` through the misaligned sp faults.",
    playground: "stops at the `bl printf` with a bus error and says sp is not a multiple of 16 there.",
    fix: "Push and pop the pair with 16: `stp fp, lr, [sp, -16]!` and `ldp fp, lr, [sp], 16`. The fixed program prints `sp & 15 = 0`.",
    wrong: `        stp     fp, lr, [sp, -8]!
        ...
        ldp     fp, lr, [sp], 8`,
    right: `        stp     fp, lr, [sp, -16]!
        ...
        ldp     fp, lr, [sp], 16`,
    broken: {
      source: `// Prints the low four bits of sp, which should be 0.
// The frame push moves sp by 8, leaving it off the 16-byte boundary.

define(fp, x29)
define(lr, x30)

.data
fmt_sp:     .string "sp & 15 = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -8]!           // the mistake: 8 is not a legal frame size
        mov     fp, sp
        mov     x9, sp
        and     x9, x9, 15                  // the bits sp must keep clear
        ldr     x0, =fmt_sp
        mov     x1, x9
        bl      printf                      // sp is 8 off the boundary at this call

        mov     w0, 0
        ldp     fp, lr, [sp], 8
        ret
`,
      stdout: "",
      ends: { signal: "SIGBUS" },
    },
    fixed: {
      source: `// Prints the low four bits of sp, which should be 0.
// The pair takes a full 16 bytes, so the boundary holds.

define(fp, x29)
define(lr, x30)

.data
fmt_sp:     .string "sp & 15 = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x9, sp
        and     x9, x9, 15
        ldr     x0, =fmt_sp
        mov     x1, x9
        bl      printf                      // sp is a multiple of 16 here

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "sp & 15 = 0\n",
      ends: { exit: 0 },
    },
    source: {
      title: "AAPCS64: Universal stack constraints",
      href: "https://github.com/ARM-software/abi-aa/blob/2025Q4/aapcs64/aapcs64.rst#universal-stack-constraints",
    },
    lesson: "stack-and-frame-pointer",
    reference: "stp",
  },
  {
    slug: "locals-round-up-to-16",
    title: "Round every local allocation up to a multiple of 16",
    group: "stack",
    mistake:
      "One 8-byte local still has to cost 16 bytes of stack, because sp must stay a multiple of 16. `sub sp, sp, 24` leaves sp 8 off, and the next load or store through sp faults.",
    server: "prints nothing and stops with `Bus error` at the first store through sp.",
    playground: "stops at that store with a bus error and says sp must be a multiple of 16.",
    fix: "Size the frame with the alignment formula, `alloc = -(16 + 24) & -16`, which rounds 40 up to 48. The fixed program prints `sp & 15 = 0`.",
    wrong: `        sub     sp, sp, 24
        str     x9, [sp, 8]`,
    right: `alloc = -(16 + 24) & -16
        stp     fp, lr, [sp, alloc]!`,
    broken: {
      source: `// Keeps one local on the stack, then prints the low four bits of sp.
// 24 bytes of locals leave sp off the 16-byte boundary.

define(fp, x29)
define(lr, x30)

.data
fmt_sp:     .string "sp & 15 = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        sub     sp, sp, 24                  // the mistake: 24 is not a multiple of 16
        mov     x9, 7
        str     x9, [sp, 8]                 // a store through the misaligned sp
        mov     x10, sp
        and     x10, x10, 15
        ldr     x0, =fmt_sp
        mov     x1, x10
        bl      printf
        add     sp, sp, 24

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "",
      ends: { signal: "SIGBUS" },
    },
    fixed: {
      source: `// Keeps one local on the stack, then prints the low four bits of sp.
// The alignment formula rounds the frame up to a multiple of 16.

define(fp, x29)
define(lr, x30)

alloc = -(16 + 24) & -16                    // the pair plus 24 bytes, rounded: 48
dealloc = -alloc

.data
fmt_sp:     .string "sp & 15 = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        mov     x9, 7
        str     x9, [fp, 16]                // locals sit above the pair
        mov     x10, sp
        and     x10, x10, 15
        ldr     x0, =fmt_sp
        mov     x1, x10
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
`,
      stdout: "sp & 15 = 0\n",
      ends: { exit: 0 },
    },
    source: {
      title: "AAPCS64: Universal stack constraints",
      href: "https://github.com/ARM-software/abi-aa/blob/2025Q4/aapcs64/aapcs64.rst#universal-stack-constraints",
    },
    lesson: "stack-and-frame-pointer",
    reference: "sub",
  },
  {
    slug: "save-lr-before-bl",
    title: "A function that calls another must save lr first",
    group: "stack",
    mistake:
      "`bl` writes its return address into lr (x30), overwriting the one there. A function that makes a call and has not saved lr loses its own way back: its `ret` jumps to the instruction after its last `bl`.",
    server: "prints nothing and never ends: each `ret` lands on the `add` above it again, until Ctrl-C stops the program.",
    playground: "never finishes either: Run stops after 10 million steps, the playground's limit. Step through and each `ret` lands on the `add` again.",
    fix: "Give the function the usual frame: `stp fp, lr, [sp, -16]!` on entry and `ldp fp, lr, [sp], 16` before `ret`. The fixed program prints `price = 110`.",
    wrong: `add_tax:
        bl      round_up
        add     x0, x0, 10
        ret`,
    right: `add_tax:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      round_up
        add     x0, x0, 10
        ldp     fp, lr, [sp], 16
        ret`,
    broken: {
      source: `// Rounds a price up to a multiple of 10, then adds a 10 fee.
// add_tax calls round_up without saving lr, so its ret returns to itself.

define(fp, x29)
define(lr, x30)

.data
fmt_price:  .string "price = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 99
        bl      add_tax
        mov     x1, x0
        ldr     x0, =fmt_price
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

// add_tax(x0 = price) -> x0 = price rounded up, plus 10
add_tax:                                    // the mistake: no frame, lr is not saved
        bl      round_up                    // lr now points at the add below
        add     x0, x0, 10
        ret                                 // back to the add, again and again

// round_up(x0 = n) -> x0 = n rounded up to a multiple of 10
round_up:
        add     x0, x0, 9
        mov     x9, 10
        udiv    x0, x0, x9
        mul     x0, x0, x9
        ret
`,
      stdout: "",
      ends: { timeout: true },
    },
    fixed: {
      source: `// Rounds a price up to a multiple of 10, then adds a 10 fee.
// add_tax saves fp and lr before it calls round_up.

define(fp, x29)
define(lr, x30)

.data
fmt_price:  .string "price = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 99
        bl      add_tax
        mov     x1, x0
        ldr     x0, =fmt_price
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

// add_tax(x0 = price) -> x0 = price rounded up, plus 10
add_tax:
        stp     fp, lr, [sp, -16]!          // bl below will overwrite lr
        mov     fp, sp
        bl      round_up
        add     x0, x0, 10
        ldp     fp, lr, [sp], 16            // main's return address is back
        ret

// round_up(x0 = n) -> x0 = n rounded up to a multiple of 10
round_up:
        add     x0, x0, 9
        mov     x9, 10
        udiv    x0, x0, x9
        mul     x0, x0, x9
        ret
`,
      stdout: "price = 110\n",
      ends: { exit: 0 },
    },
    source: {
      title: "Arm A64 instruction set: BL",
      href: "https://developer.arm.com/documentation/ddi0602/2026-09/Base-Instructions/BL--Branch-with-link-",
    },
    lesson: "subroutines",
    reference: "bl",
  },
  {
    slug: "ldp-order-matches-stp",
    title: "ldp restores the pair in the order stp saved it",
    group: "stack",
    mistake:
      "`stp fp, lr, [sp, -16]!` puts fp at the lower address and lr 8 bytes above. `ldp` must name them in the same order, `ldp fp, lr, [sp], 16`. Swapped, lr gets the caller's frame pointer, a stack address, and `ret` jumps there.",
    server: "prints nothing and stops with `Segmentation fault`: `ret` jumped into the stack, which holds no code.",
    playground: "stops right after the `ret`: the next instruction would come from the stack, and the error says execution branched into data rather than code.",
    fix: "Mirror the `stp`: `ldp fp, lr, [sp], 16`. The fixed program prints `average = 6`.",
    wrong: `        stp     fp, lr, [sp, -16]!
        ...
        ldp     lr, fp, [sp], 16`,
    right: `        stp     fp, lr, [sp, -16]!
        ...
        ldp     fp, lr, [sp], 16`,
    broken: {
      source: `// Averages two numbers in a function with the usual frame.
// The epilogue restores fp and lr swapped, so ret jumps into the stack.

define(fp, x29)
define(lr, x30)

.data
fmt_avg:    .string "average = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 8
        mov     x1, 4
        bl      average
        mov     x1, x0
        ldr     x0, =fmt_avg
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

// average(x0 = a, x1 = b) -> x0 = (a + b) / 2
average:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        add     x0, x0, x1
        asr     x0, x0, 1
        ldp     lr, fp, [sp], 16            // the mistake: lr gets main's fp
        ret                                 // jumps to a stack address
`,
      stdout: "",
      ends: { signal: "SIGSEGV" },
    },
    fixed: {
      source: `// Averages two numbers in a function with the usual frame.
// ldp names the pair in the order stp saved it.

define(fp, x29)
define(lr, x30)

.data
fmt_avg:    .string "average = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 8
        mov     x1, 4
        bl      average
        mov     x1, x0
        ldr     x0, =fmt_avg
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

// average(x0 = a, x1 = b) -> x0 = (a + b) / 2
average:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        add     x0, x0, x1
        asr     x0, x0, 1
        ldp     fp, lr, [sp], 16            // same order as the stp
        ret
`,
      stdout: "average = 6\n",
      ends: { exit: 0 },
    },
    source: {
      title: "AAPCS64: The Frame Pointer",
      href: "https://github.com/ARM-software/abi-aa/blob/2025Q4/aapcs64/aapcs64.rst#the-frame-pointer",
    },
    lesson: "subroutines",
    reference: "ldp",
  },
  {
    slug: "caller-saved-registers",
    title: "x9 to x15 do not survive a call",
    group: "stack",
    mistake:
      "A function you call may change x0 to x18 without putting them back; only x19 to x28 (and fp and sp) are callee-saved, which means the callee must restore them before it returns. A value that has to live across a `bl` belongs in x19 to x28.",
    server: "prints `sum = 25, cube = 125`: cube used x9 for its own work, as it is allowed to.",
    playground: "prints the same line. After a library call such as printf the playground also fills x0 to x18 with 0xdeadbeefdeadbeef and notes the first use of a clobbered register.",
    fix: "Keep the sum in x19, and save x19 in main's frame because main is a callee too. The fixed program prints `sum = 42, cube = 125`.",
    wrong: `        mov     x9, 42
        bl      cube
        mov     x1, x9`,
    right: `        str     x19, [fp, x19_save]
        mov     x19, 42
        bl      cube
        mov     x1, x19`,
    broken: {
      source: `// Keeps a sum in x9 across a call to cube, which uses x9 itself.
// x9 is caller-saved: a callee may change it and leave it changed.

define(fp, x29)
define(lr, x30)

.data
fmt_sum:    .string "sum = %ld, cube = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x9, 40
        add     x9, x9, 2                   // sum = 42, parked in a scratch register
        mov     x0, 5
        bl      cube                        // cube may change x9, and does
        mov     x2, x0
        ldr     x0, =fmt_sum
        mov     x1, x9                      // the mistake: x9 holds cube's leftover
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

// cube(x0 = n) -> x0 = n * n * n, with x9 as its scratch register
cube:
        mul     x9, x0, x0
        mul     x0, x9, x0
        ret
`,
      stdout: "sum = 25, cube = 125\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Keeps a sum in x19 across a call to cube, which uses x9 itself.
// x19 is callee-saved, so main saves the caller's x19 before using it.

define(fp, x29)
define(lr, x30)

alloc = -(16 + 8) & -16                     // the pair plus the x19 slot: 32
dealloc = -alloc
x19_save = 16

.data
fmt_sum:    .string "sum = %ld, cube = %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        str     x19, [fp, x19_save]         // main's caller expects its x19 back

        mov     x19, 40
        add     x19, x19, 2                 // sum = 42, safe across any call
        mov     x0, 5
        bl      cube
        mov     x2, x0
        ldr     x0, =fmt_sum
        mov     x1, x19                     // still 42
        bl      printf

        mov     w0, 0
        ldr     x19, [fp, x19_save]
        ldp     fp, lr, [sp], dealloc
        ret

// cube(x0 = n) -> x0 = n * n * n, with x9 as its scratch register
cube:
        mul     x9, x0, x0
        mul     x0, x9, x0
        ret
`,
      stdout: "sum = 42, cube = 125\n",
      ends: { exit: 0 },
    },
    source: {
      title: "AAPCS64: General-purpose Registers",
      href: "https://github.com/ARM-software/abi-aa/blob/2025Q4/aapcs64/aapcs64.rst#general-purpose-registers",
    },
    lesson: "calling-conventions",
    reference: "calling convention",
  },
  {
    slug: "only-d8-survives-a-call",
    title: "A call keeps d8 to d15, not the rest of v8 to v15",
    group: "stack",
    mistake:
      "For v8 to v15 a callee has to keep only the low 64 bits, d8 to d15. Two doubles packed into q8 lose the upper one across a call, even when the callee follows every rule.",
    server: "prints `low = 1.5, high = 0.0, half = 2.5`: half saved and restored d8, and loading d8 cleared the upper 64 bits of v8.",
    playground: "prints the same line.",
    fix: "Give each double that must survive its own d register from d8 to d15, and save those in the frame. The fixed program prints `low = 1.5, high = 2.5, half = 2.5`.",
    wrong: `        ldr     q8, [x9]
        bl      half
        mov     d1, v8.d[1]`,
    right: `        ldp     d8, d9, [x9]
        bl      half
        fmov    d1, d9`,
    broken: {
      source: `// Keeps two doubles in the two halves of q8 across a call to half.
// A callee keeps only d8, the low 64 bits of v8.

define(fp, x29)
define(lr, x30)

alloc = -(16 + 8) & -16                     // the pair plus a d8 slot: 32
dealloc = -alloc
d8_save = 16

.data
pair:       .double 1.5, 2.5
fmt_three:  .string "low = %.1f, high = %.1f, half = %.1f\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        str     d8, [fp, d8_save]           // main keeps its caller's d8

        ldr     x9, =pair
        ldr     q8, [x9]                    // the mistake: both doubles in one register
        fmov    d0, 5.0
        bl      half                        // half restores d8 and nothing above it
        fmov    d2, d0
        fmov    d0, d8                      // low lane
        mov     d1, v8.d[1]                 // high lane: now 0.0
        ldr     x0, =fmt_three
        bl      printf

        mov     w0, 0
        ldr     d8, [fp, d8_save]
        ldp     fp, lr, [sp], dealloc
        ret

// half(d0 = x) -> d0 = x / 2, with d8 as a saved working register
half:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     d8, [fp, 16]                // a callee must keep d8 only
        fmov    d8, 2.0
        fdiv    d0, d0, d8
        ldr     d8, [fp, 16]                // d8 is back; bits 127 to 64 are now 0
        ldp     fp, lr, [sp], 32
        ret
`,
      stdout: "low = 1.5, high = 0.0, half = 2.5\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Keeps two doubles in d8 and d9 across a call to half.
// Each one has a callee-saved register of its own.

define(fp, x29)
define(lr, x30)

alloc = -(16 + 16) & -16                    // the pair plus d8 and d9 slots: 32
dealloc = -alloc
d8_save = 16

.data
pair:       .double 1.5, 2.5
fmt_three:  .string "low = %.1f, high = %.1f, half = %.1f\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        stp     d8, d9, [fp, d8_save]       // main keeps its caller's d8 and d9

        ldr     x9, =pair
        ldp     d8, d9, [x9]                // one double in each register
        fmov    d0, 5.0
        bl      half
        fmov    d2, d0
        fmov    d0, d8
        fmov    d1, d9
        ldr     x0, =fmt_three
        bl      printf

        mov     w0, 0
        ldp     d8, d9, [fp, d8_save]
        ldp     fp, lr, [sp], dealloc
        ret

// half(d0 = x) -> d0 = x / 2, with d8 as a saved working register
half:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     d8, [fp, 16]
        fmov    d8, 2.0
        fdiv    d0, d0, d8
        ldr     d8, [fp, 16]
        ldp     fp, lr, [sp], 32
        ret
`,
      stdout: "low = 1.5, high = 2.5, half = 2.5\n",
      ends: { exit: 0 },
    },
    source: {
      title: "AAPCS64: SIMD and Floating-Point registers",
      href: "https://github.com/ARM-software/abi-aa/blob/2025Q4/aapcs64/aapcs64.rst#simd-and-floating-point-registers",
    },
    lesson: "calling-conventions",
    reference: "calling convention",
  },
  {
    slug: "flags-do-not-survive-a-call",
    title: "The flags do not survive a call",
    group: "stack",
    mistake:
      "The condition flags are not saved across a call: any function may run its own compare. A `b.lt` placed after a `bl` tests whatever the callee left.",
    server: "prints `3 is not less than 8`: `b.lt` read limit's `cmp x0, 10`, where 25 was greater.",
    playground: "prints the same line. After a library call the playground also sets the flags to a pattern no compare leaves and notes the first branch that reads them.",
    fix: "Compare after the call, or keep the answer in a callee-saved register with `cset` before it. The fixed program prints `3 is less than 8`.",
    wrong: `        cmp     a_r, b_r
        bl      limit
        b.lt    report`,
    right: `        bl      limit
        cmp     a_r, b_r
        b.lt    report`,
    broken: {
      source: `// Compares two numbers, calls limit, then branches on the compare.
// limit runs its own cmp, so the branch reads limit's flags.

define(fp, x29)
define(lr, x30)
define(a_r, x19)
define(b_r, x20)
define(cap_r, x21)

.data
fmt_less:   .string "%ld is less than %ld (limit gave %ld)\\n"
fmt_more:   .string "%ld is not less than %ld (limit gave %ld)\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     a_r, 3
        mov     b_r, 8
        cmp     a_r, b_r                    // 3 < 8
        mov     x0, 25
        bl      limit                       // limit compares too
        mov     cap_r, x0
        ldr     x0, =fmt_less
        b.lt    report                      // the mistake: the flags are limit's now
        ldr     x0, =fmt_more
report:
        mov     x1, a_r
        mov     x2, b_r
        mov     x3, cap_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

// limit(x0 = n) -> x0 = n, but no more than 10
limit:
        cmp     x0, 10
        b.le    limit_done
        mov     x0, 10
limit_done:
        ret
`,
      stdout: "3 is not less than 8 (limit gave 10)\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Compares two numbers after calling limit, then branches on the compare.
// The cmp sits right before the branch that reads it.

define(fp, x29)
define(lr, x30)
define(a_r, x19)
define(b_r, x20)
define(cap_r, x21)

.data
fmt_less:   .string "%ld is less than %ld (limit gave %ld)\\n"
fmt_more:   .string "%ld is not less than %ld (limit gave %ld)\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     a_r, 3
        mov     b_r, 8
        mov     x0, 25
        bl      limit
        mov     cap_r, x0
        ldr     x0, =fmt_less
        cmp     a_r, b_r                    // after the call: these flags are ours
        b.lt    report
        ldr     x0, =fmt_more
report:
        mov     x1, a_r
        mov     x2, b_r
        mov     x3, cap_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

// limit(x0 = n) -> x0 = n, but no more than 10
limit:
        cmp     x0, 10
        b.le    limit_done
        mov     x0, 10
limit_done:
        ret
`,
      stdout: "3 is less than 8 (limit gave 10)\n",
      ends: { exit: 0 },
    },
    source: {
      title: "AAPCS64: General-purpose Registers (the NZCV flags)",
      href: "https://github.com/ARM-software/abi-aa/blob/2025Q4/aapcs64/aapcs64.rst#general-purpose-registers",
    },
    lesson: "calling-conventions",
    reference: "calling convention",
  },
  {
    slug: "x16-x17-change-across-bl",
    title: "x16 and x17 can change on the way into a call",
    group: "stack",
    mistake:
      "x16 and x17 (IP0 and IP1) are scratch registers for the linker. A `bl printf` reaches printf through a small stub, the PLT (procedure linkage table), that uses x16 and x17 to find printf before printf even starts.",
    server: "prints only `line 1`: after the first call x16 held an address, far above 3.",
    playground: "prints the same line. Here a library call fills x0 to x18 with 0xdeadbeefdeadbeef, and a console note names the call that changed x16.",
    fix: "Keep a counter that lives across calls in x19 to x28. The fixed program prints lines 1 to 3.",
    wrong: `        mov     x16, 1
line_loop:
        mov     x1, x16
        bl      printf`,
    right: `        mov     x19, 1
line_loop:
        mov     x1, x19
        bl      printf`,
    broken: {
      source: `// Prints three numbered lines, keeping the line number in x16.
// The call to printf passes through a stub that writes x16.

define(fp, x29)
define(lr, x30)

.data
fmt_line:   .string "line %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x16, 1                      // the mistake: x16 belongs to the linker
line_loop:
        ldr     x0, =fmt_line
        mov     x1, x16
        bl      printf                      // the stub on the way in writes x16
        add     x16, x16, 1
        cmp     x16, 3
        b.ls    line_loop                   // unsigned: lines 1 to 3

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
      stdout: "line 1\n",
      ends: { exit: 0 },
    },
    fixed: {
      source: `// Prints three numbered lines, keeping the line number in x19.
// x19 is callee-saved, so main saves the caller's x19 first.

define(fp, x29)
define(lr, x30)

alloc = -(16 + 8) & -16                     // the pair plus the x19 slot: 32
dealloc = -alloc
x19_save = 16

.data
fmt_line:   .string "line %ld\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        str     x19, [fp, x19_save]

        mov     x19, 1
line_loop:
        ldr     x0, =fmt_line
        mov     x1, x19
        bl      printf                      // x19 comes back unchanged
        add     x19, x19, 1
        cmp     x19, 3
        b.ls    line_loop                   // unsigned: lines 1 to 3

        mov     w0, 0
        ldr     x19, [fp, x19_save]
        ldp     fp, lr, [sp], dealloc
        ret
`,
      stdout: "line 1\nline 2\nline 3\n",
      ends: { exit: 0 },
    },
    source: {
      title: "AAPCS64: Use of IP0 and IP1 by the linker",
      href: "https://github.com/ARM-software/abi-aa/blob/2025Q4/aapcs64/aapcs64.rst#use-of-ip0-and-ip1-by-the-linker",
    },
    lesson: "calling-conventions",
    reference: "calling convention",
  },
];
