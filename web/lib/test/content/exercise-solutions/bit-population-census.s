// count how many bits of a value are set
define(fp, x29)
define(lr, x30)

define(value_r, x19)
define(count_r, x20)
define(bit_r, x21)

        .data
fmt_in:     .string "%llx"
fmt_out:    .string "bits set = %lld\n"

        .bss
        .balign 8
value_m:    .skip 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read the value, typed in hex
        ldr     x1, =value_m
        bl      scanf
        ldr     x9, =value_m
        ldr     value_r, [x9]
        mov     count_r, 0

count_loop:
        cbz     value_r, count_done
        and     bit_r, value_r, 1
        add     count_r, count_r, bit_r
        lsr     value_r, value_r, 1         // logical: zeros come in at the top
        b       count_loop
count_done:

        ldr     x0, =fmt_out
        mov     x1, count_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
