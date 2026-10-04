// find the greatest common divisor of two values
define(fp, x29)
define(lr, x30)

define(a_r, x19)
define(b_r, x20)
define(q_r, x21)
define(rem_r, x22)

        .data
fmt_in:     .string "%lld %lld"
fmt_out:    .string "gcd = %lld\n"

        .bss
        .balign 8
a_m:        .skip 8
b_m:        .skip 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read the pair
        ldr     x1, =a_m
        ldr     x2, =b_m
        bl      scanf
        ldr     x9, =a_m
        ldr     a_r, [x9]
        ldr     x9, =b_m
        ldr     b_r, [x9]

gcd_loop:
        cbz     b_r, gcd_done
        udiv    q_r, a_r, b_r
        msub    rem_r, q_r, b_r, a_r        // a mod b
        mov     a_r, b_r
        mov     b_r, rem_r
        b       gcd_loop
gcd_done:

        ldr     x0, =fmt_out
        mov     x1, a_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
