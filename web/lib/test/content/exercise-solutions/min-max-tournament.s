// find both the smallest and the largest element in one pass
define(fp, x29)
define(lr, x30)

define(base_r, x22)
define(i_r, w19)
define(n_r, w20)
define(min_r, w21)
define(max_r, w24)
define(elem_r, w23)

        .data
fmt_in:     .string "%d"
fmt_low:    .string "min = %d\n"
fmt_high:    .string "max = %d\n"

        .bss
        .balign 4
n_m:        .skip 4
entries:    .skip 128                       // room for 32 words

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
        ldr     base_r, =entries
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

        ldr     min_r, [base_r]             // both start at element zero
        ldr     max_r, [base_r]
        mov     i_r, 1

        b       walk_test
walk_loop:
        ldr     elem_r, [base_r, i_r, sxtw 2]
        cmp     elem_r, min_r
        b.ge    check_max
        mov     min_r, elem_r
check_max:
        cmp     elem_r, max_r
        b.le    next
        mov     max_r, elem_r
next:
        add     i_r, i_r, 1
walk_test:
        cmp     i_r, n_r
        b.lt    walk_loop

        ldr     x0, =fmt_low
        mov     w1, min_r
        bl      printf
        ldr     x0, =fmt_high
        mov     w1, max_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
