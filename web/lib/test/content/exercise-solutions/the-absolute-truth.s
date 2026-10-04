// print the absolute value of a signed number
define(fp, x29)
define(lr, x30)

define(value_r, x19)

        .data
fmt_in:     .string "%lld"
fmt_out:    .string "magnitude = %lld\n"

        .bss
        .balign 8
value_m:    .skip 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read the value
        ldr     x1, =value_m
        bl      scanf
        ldr     x9, =value_m
        ldr     value_r, [x9]

        cmp     value_r, 0
        b.ge    positive                    // already non-negative
        neg     value_r, value_r
positive:

        ldr     x0, =fmt_out
        mov     x1, value_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
