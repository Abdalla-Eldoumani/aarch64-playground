// print the eight-bit binary form of a value
define(fp, x29)
define(lr, x30)

define(value_r, x19)
define(bit_r, x20)
define(digit_r, x21)

        .data
fmt_in:     .string "%lld"
fmt_bit:    .string "%lld"
fmt_nl:     .string "\n"

        .bss
        .balign 8
value_m:    .skip 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read the value to print in binary
        ldr     x1, =value_m
        bl      scanf
        ldr     x9, =value_m
        ldr     value_r, [x9]
        mov     bit_r, 7                    // start from the top bit

bit_loop:
        cmp     bit_r, 0
        b.lt    bits_done
        lsr     digit_r, value_r, bit_r
        and     digit_r, digit_r, 1
        ldr     x0, =fmt_bit
        mov     x1, digit_r
        bl      printf
        sub     bit_r, bit_r, 1
        b       bit_loop
bits_done:
        ldr     x0, =fmt_nl
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
