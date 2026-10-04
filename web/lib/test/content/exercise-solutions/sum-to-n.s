// sum every integer from 1 to n, then print the total
define(fp, x29)
define(lr, x30)

define(sum_r, x19)
define(i_r, x20)
define(n_r, x21)

        .data
fmt_in:     .string "%lld"
fmt_out:    .string "sum = %lld\n"

        .bss
        .balign 8
n_m:        .skip 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read n
        ldr     x1, =n_m
        bl      scanf
        ldr     x9, =n_m
        ldr     n_r, [x9]                   // add up 1 through n
        mov     sum_r, 0
        mov     i_r, 1

        b       sum_test
sum_loop:
        add     sum_r, sum_r, i_r
        add     i_r, i_r, 1
sum_test:
        cmp     i_r, n_r
        b.le    sum_loop

        ldr     x0, =fmt_out
        mov     x1, sum_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
