// compare two values and print the larger one
define(fp, x29)
define(lr, x30)

define(a_r, x19)
define(b_r, x20)
define(winner_r, x21)

        .data
fmt_in:     .string "%lld %lld"
fmt_out:    .string "bigger = %lld\n"

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

        ldr     x0, =fmt_in                 // read the two contenders
        ldr     x1, =a_m
        ldr     x2, =b_m
        bl      scanf
        ldr     x9, =a_m
        ldr     a_r, [x9]
        ldr     x9, =b_m
        ldr     b_r, [x9]

        mov     winner_r, a_r               // assume a wins
        cmp     b_r, a_r
        b.le    decided
        mov     winner_r, b_r               // b is bigger after all
decided:

        ldr     x0, =fmt_out
        mov     x1, winner_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
