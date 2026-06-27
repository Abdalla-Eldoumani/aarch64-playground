// sum-to-n.s - add the integers from 1 to n
// Reads a fixed n from .data, accumulates 1 + 2 + ... + n in a register
// loop, and prints the total. The simplest counted-loop shape.

define(fp, x29)
define(lr, x30)
define(sum_r, w19)
define(i_r, w20)
define(n_r, w21)

.data
n_m:        .word 10
fmt_sum:    .string "Sum = %d\n"

.text
.balign 4
.global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =n_m
        ldr     n_r, [x0]               // n = 10
        mov     sum_r, 0                // running total
        mov     i_r, 1                  // loop counter
sum_loop:
        cmp     i_r, n_r
        b.gt    sum_done                // stop once i passes n
        add     sum_r, sum_r, i_r       // total += i
        add     i_r, i_r, 1
        b       sum_loop
sum_done:
        ldr     x0, =fmt_sum
        mov     w1, sum_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
