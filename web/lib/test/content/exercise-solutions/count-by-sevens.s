// print every multiple of seven from 7 up to a limit
define(fp, x29)
define(lr, x30)

define(i_r, x19)
define(limit_r, x20)

        .data
fmt_in:     .string "%lld"
fmt_out:    .string "%lld\n"

        .bss
        .balign 8
limit_m:    .skip 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read the limit
        ldr     x1, =limit_m
        bl      scanf
        ldr     x9, =limit_m
        ldr     limit_r, [x9]               // last value that may print
        mov     i_r, 7                      // first multiple

        b       sevens_test
sevens_loop:
        ldr     x0, =fmt_out
        mov     x1, i_r
        bl      printf
        add     i_r, i_r, 7
sevens_test:
        cmp     i_r, limit_r
        b.le    sevens_loop

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
