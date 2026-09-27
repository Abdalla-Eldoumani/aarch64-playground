// reverse the decimal digits of a number
define(fp, x29)
define(lr, x30)

define(n_r, x19)
define(rev_r, x20)
define(q_r, x21)
define(digit_r, x22)
define(ten_r, x23)

        .data
fmt_in:     .string "%lld"
fmt_out:    .string "reversed = %lld\n"

        .bss
        .balign 8
n_m:        .skip 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read the number to reverse
        ldr     x1, =n_m
        bl      scanf
        ldr     x9, =n_m
        ldr     n_r, [x9]
        mov     rev_r, 0
        mov     ten_r, 10

digit_loop:
        cbz     n_r, digits_done
        udiv    q_r, n_r, ten_r
        msub    digit_r, q_r, ten_r, n_r    // last decimal digit
        madd    rev_r, rev_r, ten_r, digit_r
        mov     n_r, q_r
        b       digit_loop
digits_done:

        ldr     x0, =fmt_out
        mov     x1, rev_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
