/**
 * The five recurring CPSC 355 traps: the catalog's card content plus a
 * runnable fault/fix program pair per trap. Everything here is authored
 * payload, kept in one data module so the course-style guard
 * (course-style.test.ts) can raw-scan it and the behavioral test
 * (pitfall-data.playground.test.ts) can assemble and run every program on the
 * real emulator -- each fault misbehaves observably (a printed misalignment,
 * a run that never comes home, a wild-address fault, a wrong sum) and each
 * fix demonstrably lands. The wrong/right snippets are the compact card
 * illustrations; fault/fix are complete course-style programs for the
 * run-it-live embed.
 */

export interface Pitfall {
  title: string;
  /** One-line cause rendered under the card through LessonMarkdown. */
  cause: string;
  /** Compact wrong-side illustration for the card. */
  wrong: string;
  /** Compact right-side illustration for the card. */
  right: string;
  /** What to watch for when running the fault and the fix. */
  watch: string;
  /** Complete program that misbehaves observably in the playground. */
  fault: string;
  /** The same program with the fix applied; runs clean. */
  fix: string;
}

export const PITFALLS: Pitfall[] = [
  {
    title: "16-byte stack alignment",
    cause: "sp must stay 16-byte aligned at every call boundary.",
    wrong: `main:
        stp     fp, lr, [sp, -8]!
        mov     fp, sp
        bl      work
        ldp     fp, lr, [sp], 8
        ret`,
    right: `main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      work
        ldp     fp, lr, [sp], 16
        ret`,
    watch:
      "the fault prints sp & 15 = 8: every call from there runs on a broken boundary. the emulator forgives it; gas and linux fault inside printf. the fix prints 0.",
    fault: `// the fault: an 8-byte push leaves sp off the 16-byte boundary
define(fp, x29)
define(lr, x30)

        .data
fmt:    .string "sp & 15 = %ld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -8]!       // 8 bytes is not a legal frame
        mov     fp, sp
        mov     x9, sp
        and     x9, x9, 15              // the low bits sp must keep clear
        ldr     x0, =fmt
        mov     x1, x9
        bl      printf                  // real hardware faults on a call like this
        ldp     fp, lr, [sp], 8
        mov     w0, 0
        ret
`,
    fix: `// the fix: the pair takes a full 16 bytes, so the boundary holds
define(fp, x29)
define(lr, x30)

        .data
fmt:    .string "sp & 15 = %ld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x9, sp
        and     x9, x9, 15
        ldr     x0, =fmt
        mov     x1, x9
        bl      printf                  // prints 0: aligned at the call
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  },
  {
    title: "saving and restoring fp and lr",
    cause: "bl overwrites lr, so a function that calls must save and restore fp and lr.",
    wrong: `greet:
        bl      puts
        ret`,
    right: `greet:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      puts
        ldp     fp, lr, [sp], 16
        ret`,
    watch:
      "the fault prints once, then ret chases its own tail: the run gives up mid-loop and no exit code ever arrives. the fix comes home with exit 0.",
    fault: `// the fault: greet never saves lr, then calls printf
define(fp, x29)
define(lr, x30)

        .data
msg:    .string "greet ran\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      greet
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

greet:                                  // no prologue: lr is unprotected
        ldr     x0, =msg
        bl      printf                  // lr now points at the ret below
        ret                             // jumps to itself, forever
`,
    fix: `// the fix: greet saves the pair before calling anything
define(fp, x29)
define(lr, x30)

        .data
msg:    .string "greet ran\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      greet
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

greet:
        stp     fp, lr, [sp, -16]!      // bl below will rewrite lr
        mov     fp, sp
        ldr     x0, =msg
        bl      printf
        ldp     fp, lr, [sp], 16        // the caller's lr is back
        ret
`,
  },
  {
    title: "sign extension",
    cause: "a narrow signed value needs sign extension before it is used as a 64-bit value.",
    wrong: `        sub     w0, w1, w2
        ldr     x3, [x4, x0, lsl #3]`,
    right: `        sub     w0, w1, w2
        sxtw    x0, w0
        ldr     x3, [x4, x0, lsl #3]`,
    watch:
      "the fault treats -1 as 4294967295, walks off to a wild address, and the load faults. the fix sign-extends the index and reads the real neighbor: 200.",
    fault: `// the fault: an int index that went negative is used unextended
define(fp, x29)
define(lr, x30)

        .data
vals:   .dword 100, 200, 300, 400, 500
fmt:    .string "neighbor = %ld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x12, =vals
        add     x12, x12, 16            // x12 -> vals[2], the middle
        mov     w9, 1
        mov     w10, 2
        sub     w11, w9, w10            // index = 1 - 2 = -1, an int in w11
        lsl     x11, x11, 3             // fault: the x view is 4294967295, not -1
        add     x13, x12, x11
        ldr     x1, [x13]               // wild address: the load faults here
        ldr     x0, =fmt
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
    fix: `// the fix: sign-extend the int index as the addressing mode scales it
define(fp, x29)
define(lr, x30)

        .data
vals:   .dword 100, 200, 300, 400, 500
fmt:    .string "neighbor = %ld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x12, =vals
        add     x12, x12, 16            // x12 -> vals[2], the middle
        mov     w9, 1
        mov     w10, 2
        sub     w11, w9, w10            // index = -1
        ldr     x1, [x12, w11, SXTW 3]  // sign-extend, scale by 8: vals[1]
        ldr     x0, =fmt
        bl      printf                  // prints 200

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  },
  {
    title: "off-by-one loop bounds",
    cause: "the branch condition decides whether the final index is included.",
    wrong: `        mov     x19, 0
        mov     x0, 0
sum:
        cmp     x19, x20
        b.gt    done
        ldr     x1, [x21, x19, lsl #3]
        add     x0, x0, x1
        add     x19, x19, 1
        b       sum
done:`,
    right: `        mov     x19, 0
        mov     x0, 0
sum:
        cmp     x19, x20
        b.ge    done
        ldr     x1, [x21, x19, lsl #3]
        add     x0, x0, x1
        add     x19, x19, 1
        b       sum
done:`,
    watch:
      "the fault sums 10014 because i = 5 sneaks in and drags whatever lives past the array with it. the fix stops at index 4 and prints 15.",
    fault: `// the fault: b.gt keeps i = 5 in a five-element loop
define(fp, x29)
define(lr, x30)
define(i_r, w19)
define(sum_r, w20)

        .data
vals:   .word 1, 2, 3, 4, 5
        .word 9999                      // whatever happens to live next
fmt:    .string "sum = %d\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     i_r, 0
        mov     sum_r, 0
        ldr     x21, =vals
loop:
        cmp     i_r, 5                  // five elements: indexes 0 to 4
        b.gt    done                    // the fault: i = 5 still runs
        ldr     w22, [x21, i_r, SXTW 2]
        add     sum_r, sum_r, w22
        add     i_r, i_r, 1
        b       loop
done:
        ldr     x0, =fmt
        mov     w1, sum_r
        bl      printf                  // prints 10014, not 15

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
    fix: `// the fix: b.ge stops the loop at the last valid index
define(fp, x29)
define(lr, x30)
define(i_r, w19)
define(sum_r, w20)

        .data
vals:   .word 1, 2, 3, 4, 5
        .word 9999                      // never read once the bound is right
fmt:    .string "sum = %d\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     i_r, 0
        mov     sum_r, 0
        ldr     x21, =vals
loop:
        cmp     i_r, 5
        b.ge    done                    // i stops after 4
        ldr     w22, [x21, i_r, SXTW 2]
        add     sum_r, sum_r, w22
        add     i_r, i_r, 1
        b       loop
done:
        ldr     x0, =fmt
        mov     w1, sum_r
        bl      printf                  // prints 15

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
  },
  {
    title: "non-16-byte local allocation",
    cause: "local frames must be rounded up to a 16-byte multiple.",
    wrong: `        sub     sp, sp, 24
        str     x0, [sp, 8]
        bl      printf
        add     sp, sp, 24`,
    right: `        sub     sp, sp, 32
        str     x0, [sp, 8]
        bl      printf
        add     sp, sp, 32`,
    watch:
      "the fault takes 24 bytes and prints sp & 15 = 8 at the call. the fix sizes the frame with the alloc formula and prints 0.",
    fault: `// the fault: 24 bytes of locals taken without rounding to 16
define(fp, x29)
define(lr, x30)

        .data
fmt:    .string "sp & 15 = %ld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        sub     sp, sp, 24              // the fault: 24 is not a 16 multiple
        mov     x9, 7
        str     x9, [sp, 8]
        mov     x10, sp
        and     x10, x10, 15
        ldr     x0, =fmt
        mov     x1, x10
        bl      printf                  // sp & 15 = 8 at this call
        add     sp, sp, 24
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
    fix: `// the fix: the alloc formula rounds the frame to a 16 multiple
define(fp, x29)
define(lr, x30)

alloc = -(16 + 24) & -16                // pair + 24 bytes, rounded: 48
dealloc = -alloc

        .data
fmt:    .string "sp & 15 = %ld\\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        mov     x9, 7
        str     x9, [fp, 16]            // locals live above the pair
        mov     x10, sp
        and     x10, x10, 15
        ldr     x0, =fmt
        mov     x1, x10
        bl      printf                  // sp & 15 = 0
        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
`,
  },
];
