// scale a sum by eight using shifts alone
define(fp, x29)
define(lr, x30)

define(a_r, x19)
define(b_r, x20)
define(total_r, x21)

        .data
fmt_in:     .string "%lld %lld"
fmt_out:    .string "8 * (a + b) = %lld\n"

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

        ldr     x0, =fmt_in                 // read the two addends
        ldr     x1, =a_m
        ldr     x2, =b_m
        bl      scanf
        ldr     x9, =a_m
        ldr     a_r, [x9]
        ldr     x9, =b_m
        ldr     b_r, [x9]

        add     total_r, a_r, b_r
        lsl     total_r, total_r, 3         // times eight is three shifts left

        ldr     x0, =fmt_out
        mov     x1, total_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
