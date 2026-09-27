// swap two registers, then print them in their new order
define(fp, x29)
define(lr, x30)

define(a_r, x19)
define(b_r, x20)
define(tmp_r, x21)

        .data
fmt_in:     .string "%lld %lld"
fmt_out:    .string "a = %lld, b = %lld\n"

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

        ldr     x0, =fmt_in                 // read a and b
        ldr     x1, =a_m
        ldr     x2, =b_m
        bl      scanf
        ldr     x9, =a_m
        ldr     a_r, [x9]
        ldr     x9, =b_m
        ldr     b_r, [x9]

        // the swap
        mov     tmp_r, a_r                  // keep a before it is overwritten
        mov     a_r, b_r
        mov     b_r, tmp_r

        ldr     x0, =fmt_out
        mov     x1, a_r
        mov     x2, b_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
