// sum every element of a global word array
define(fp, x29)
define(lr, x30)

define(base_r, x22)
define(i_r, w19)
define(n_r, w20)
define(total_r, w21)
define(elem_r, w23)

        .data
fmt_in:     .string "%d"
fmt_out:    .string "sum = %d\n"

        .bss
        .balign 4
n_m:        .skip 4
scores:     .skip 128                       // room for 32 words

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
        ldr     base_r, =scores
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

        mov     total_r, 0
        mov     i_r, 0

        b       total_test
total_loop:
        ldr     elem_r, [base_r, i_r, sxtw 2]
        add     total_r, total_r, elem_r
        add     i_r, i_r, 1
total_test:
        cmp     i_r, n_r
        b.lt    total_loop

        ldr     x0, =fmt_out
        mov     w1, total_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
