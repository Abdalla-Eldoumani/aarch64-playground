// combine three values into one result and print it
define(fp, x29)
define(lr, x30)

define(result_r, x19)
define(a_r, x20)
define(b_r, x21)
define(c_r, x22)

        .data
fmt_in:     .string "%lld %lld %lld"
fmt_out:    .string "result = %lld\n"

        .bss
        .balign 8
a_m:        .skip 8
b_m:        .skip 8
c_m:        .skip 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read a, b, and c
        ldr     x1, =a_m
        ldr     x2, =b_m
        ldr     x3, =c_m
        bl      scanf
        ldr     x9, =a_m
        ldr     a_r, [x9]
        ldr     x9, =b_m
        ldr     b_r, [x9]
        ldr     x9, =c_m
        ldr     c_r, [x9]                   // the deduction

        add     result_r, a_r, b_r
        sub     result_r, result_r, c_r

        ldr     x0, =fmt_out
        mov     x1, result_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
