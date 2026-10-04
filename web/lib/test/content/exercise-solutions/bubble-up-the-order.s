// sort an array in place, then print it smallest first
define(fp, x29)
define(lr, x30)

define(base_r, x22)
define(i_r, w19)
define(j_r, w20)
define(n_r, w21)
define(a_r, w23)
define(b_r, w24)

        .data
fmt_in:     .string "%d"
fmt_out:    .string "%d\n"

        .bss
        .balign 4
n_m:        .skip 4
tangle:     .skip 128                       // room for 32 words

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // how many values follow
        ldr     x1, =n_m
        bl      scanf
        ldr     x9, =n_m
        ldr     n_r, [x9]
        ldr     base_r, =tangle
        mov     i_r, 0
        b       fill_test
fill_loop:
        ldr     x0, =fmt_in                 // read the next value into its slot
        add     x1, base_r, i_r, sxtw 2
        bl      scanf
        add     i_r, i_r, 1
fill_test:
        cmp     i_r, n_r
        b.lt    fill_loop

        mov     i_r, 0
pass_loop:
        add     w9, i_r, 1
        cmp     w9, n_r
        b.ge    sorted
        mov     j_r, 0
pair_loop:
        sub     w9, n_r, i_r
        sub     w9, w9, 1
        cmp     j_r, w9
        b.ge    pass_done
        ldr     a_r, [base_r, j_r, sxtw 2]
        add     w9, j_r, 1
        ldr     b_r, [base_r, w9, sxtw 2]
        cmp     a_r, b_r
        b.le    no_swap
        str     b_r, [base_r, j_r, sxtw 2]
        str     a_r, [base_r, w9, sxtw 2]
no_swap:
        add     j_r, j_r, 1
        b       pair_loop
pass_done:
        add     i_r, i_r, 1
        b       pass_loop
sorted:

        mov     i_r, 0
show_loop:
        cmp     i_r, n_r
        b.ge    finished
        ldr     a_r, [base_r, i_r, sxtw 2]
        ldr     x0, =fmt_out
        mov     w1, a_r
        bl      printf
        add     i_r, i_r, 1
        b       show_loop
finished:

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
