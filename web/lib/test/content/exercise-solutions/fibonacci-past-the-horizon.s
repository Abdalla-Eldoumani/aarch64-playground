// fib(n) for n up to 186, carried in a pair of 64-bit registers
define(fp, x29)
define(lr, x30)

define(nth_r, w19)
define(step_r, w20)
define(a_lo_r, x21)
define(a_hi_r, x22)
define(b_lo_r, x23)
define(b_hi_r, x24)

.data
fmt_steps:  .string "%d"
fmt_out:    .string "fib(%d) = 0x%016lx%016lx\n"

.bss
.balign 4
n_m:        .skip 4

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_steps              // read n into n_m
        ldr     x1, =n_m
        bl      scanf
        ldr     x9, =n_m
        ldr     nth_r, [x9]

        mov     a_lo_r, 0                   // a = fib(0)
        mov     a_hi_r, 0
        mov     b_lo_r, 1                   // b = fib(1)
        mov     b_hi_r, 0
        mov     step_r, 0
        b       fib_test                    // test first, for n = 0
fib_loop:
        adds    x9, a_lo_r, b_lo_r          // low halves, carry out into C
        adc     x10, a_hi_r, b_hi_r         // high halves plus that carry
        mov     a_lo_r, b_lo_r              // slide the pair forward
        mov     a_hi_r, b_hi_r
        mov     b_lo_r, x9
        mov     b_hi_r, x10
        add     step_r, step_r, 1
fib_test:
        cmp     step_r, nth_r
        b.lt    fib_loop

        ldr     x0, =fmt_out
        mov     w1, nth_r
        mov     x2, a_hi_r                  // the high half prints first
        mov     x3, a_lo_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
