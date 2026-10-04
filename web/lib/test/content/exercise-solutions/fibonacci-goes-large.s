// fibonacci numbers grow past 32 bits fast
define(fp, x29)
define(lr, x30)

define(a_r, x19)
define(b_r, x20)
define(next_r, x21)
define(i_r, x22)
define(n_r, x23)

        .data
fmt_in:     .string "%lld"
fmt_out:    .string "fib(%lld) = %lld\n"

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
        ldr     n_r, [x9]

        mov     a_r, 0                      // fib(0)
        mov     b_r, 1                      // fib(1)
        mov     i_r, 0

        b       fib_test
fib_loop:
        add     next_r, a_r, b_r
        mov     a_r, b_r
        mov     b_r, next_r
        add     i_r, i_r, 1
fib_test:
        cmp     i_r, n_r
        b.lt    fib_loop

        ldr     x0, =fmt_out
        mov     x1, n_r
        mov     x2, a_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
