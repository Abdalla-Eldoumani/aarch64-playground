// print a number in octal, one digit at a time, without %o

define(fp, x29)
define(lr, x30)

define(n_r, x19)
define(power_r, x20)
define(digit_r, x21)
define(eight_r, x22)
define(top_r, x23)
define(room_r, x24)

.data
fmt_in:     .string "%ld"
fmt_head:   .string "%ld in octal is "
fmt_digit:  .string "%ld"
fmt_end:    .string "\n"

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

        ldr     x0, =fmt_head
        mov     x1, n_r
        bl      printf

        mov     eight_r, 8
        mov     power_r, 1

        // the power may grow while power * 8 still fits under n;
        // dividing n / 8 by the power asks that without overflowing
        udiv    top_r, n_r, eight_r         // udiv: n's bits read unsigned
grow_test:
        udiv    room_r, top_r, power_r
        cmp     room_r, 0
        b.eq    digit_test
        mul     power_r, power_r, eight_r
        b       grow_test

digit_loop:
        udiv    digit_r, n_r, power_r
        msub    n_r, digit_r, power_r, n_r  // keep what is left below this power
        ldr     x0, =fmt_digit
        mov     x1, digit_r
        bl      printf
        udiv    power_r, power_r, eight_r   // next power down; 1 / 8 = 0 ends it
digit_test:
        cmp     power_r, 0
        b.ne    digit_loop

        ldr     x0, =fmt_end
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
