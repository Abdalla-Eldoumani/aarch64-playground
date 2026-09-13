// Dot product of two arrays of eight ints, four lanes at a time.
// mla multiplies four pairs and adds the four products onto four running
// totals in one instruction, so the loop runs twice instead of eight times.

define(fp, x29)
define(lr, x30)
define(a_r, x19)
define(b_r, x20)
define(i_r, w21)
define(dot_r, w22)

define(COUNT, 8)

        .data
        .align 4
a:          .word 1, 2, 3, 4, 5, 6, 7, 8
b:          .word 8, 7, 6, 5, 4, 3, 2, 1
fmt_out:    .string "dot product = %d\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        movi    v2.4s, 0                // four running totals, all zero
        ldr     a_r, =a
        ldr     b_r, =b
        mov     i_r, 0
        b       dp_test
dp_loop:
        ldr     q0, [a_r]               // a[i] .. a[i+3]
        ldr     q1, [b_r]               // b[i] .. b[i+3]
        mla     v2.4s, v0.4s, v1.4s     // total[k] += a[i+k] * b[i+k]
        add     a_r, a_r, 16
        add     b_r, b_r, 16
        add     i_r, i_r, 4
dp_test:
        cmp     i_r, COUNT
        b.lt    dp_loop

        addv    s2, v2.4s               // fold the four totals into one
        fmov    dot_r, s2

        ldr     x0, =fmt_out
        mov     w1, dot_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
