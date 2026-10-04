// rotate an array left by k places, in place
define(fp, x29)
define(lr, x30)

define(base_r, x19)
define(n_r, w20)
define(k_r, w21)
define(i_r, w22)
define(first_r, w23)

.data
ring:       .word 10, 20, 30, 40, 50, 60, 70, 80
n_ring:     .word 8

fmt_in:     .string "%d"
fmt_head:   .string "rotated:"
fmt_el:     .string " %d"
fmt_end:    .string "\n"
msg_bad:    .string "k must be 0 or more\n"

.bss
.align 4
k_m:        .skip 4

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read k
        ldr     x1, =k_m
        bl      scanf
        ldr     x9, =k_m
        ldr     k_r, [x9]
        ldr     base_r, =ring
        ldr     x9, =n_ring
        ldr     n_r, [x9]

        cmp     k_r, 0
        b.ge    k_ok
        ldr     x0, =msg_bad
        bl      printf
        mov     w0, 1                       // exit status 1 reports the bad input
        b       finish
k_ok:
        udiv    w9, k_r, n_r                // k = k % n: n turns bring every element home
        msub    k_r, w9, n_r, k_r
        b       turn_test
turn_loop:
        ldr     first_r, [base_r]           // one turn: the first element steps out,
        mov     i_r, 1
        b       shift_test
shift_loop:
        ldr     w10, [base_r, i_r, sxtw 2]  // every other element moves one place left,
        sub     w11, i_r, 1
        str     w10, [base_r, w11, sxtw 2]
        add     i_r, i_r, 1
shift_test:
        cmp     i_r, n_r
        b.lt    shift_loop
        sub     w11, n_r, 1
        str     first_r, [base_r, w11, sxtw 2] // and the first one re-enters at the end
        sub     k_r, k_r, 1
turn_test:
        cmp     k_r, 0
        b.gt    turn_loop

        ldr     x0, =fmt_head               // print ring as it now sits in memory
        bl      printf
        mov     i_r, 0
        b       show_test
show_loop:
        ldr     x0, =fmt_el
        ldr     w1, [base_r, i_r, sxtw 2]
        bl      printf
        add     i_r, i_r, 1
show_test:
        cmp     i_r, n_r
        b.lt    show_loop
        ldr     x0, =fmt_end
        bl      printf

        mov     w0, 0
finish:
        ldp     fp, lr, [sp], 16
        ret
