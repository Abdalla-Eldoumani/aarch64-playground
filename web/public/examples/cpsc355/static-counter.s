// Example 2: Static Local Counter
// A function with a static variable that persists across calls.
// C equivalent:
//   int increment() { static int count = 0; count++; return count; }
//   main: calls increment 3 times, prints each result

define(fp, x29)
define(lr, x30)
define(i_r, w19)

        .data
count_m:.word   0                       // static local: lives in .data

        .text
fmt:    .string "Call %d: count = %d\n"

// increment() -> w0
        .balign 4
        .global increment
increment:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =count_m
        ldr     w10, [x9]
        add     w10, w10, 1
        str     w10, [x9]
        mov     w0, w10

        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:   stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     i_r, 1
        b       test

loop:
        bl      increment
        mov     w20, w0

        ldr     x0, =fmt
        mov     w1, i_r
        mov     w2, w20
        bl      printf

        add     i_r, i_r, 1
test:   cmp     i_r, 3
        b.le    loop

        // main returns printf's byte count, not 0: the exit status is not
        // part of what this example demonstrates.
        ldp     fp, lr, [sp], 16
        ret
