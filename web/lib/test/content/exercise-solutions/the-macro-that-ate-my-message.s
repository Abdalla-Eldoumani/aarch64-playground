// read a ticket count and a price in cents, then print the bill
// on one line

define(fp, x29)
define(lr, x30)

define(count_r, x19)
define(price_r, x20)
define(total_r, x21)

.data
fmt_in:     .string "%ld %ld"
fmt_out:    .string "count = %ld, price = %ld, total = %ld\n"

.bss
.balign 8
count_m:    .skip 8
price_m:    .skip 8

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // scanf fills both slots
        ldr     x1, =count_m
        ldr     x2, =price_m
        bl      scanf

        ldr     x9, =count_m
        ldr     count_r, [x9]
        ldr     x9, =price_m
        ldr     price_r, [x9]
        mul     total_r, count_r, price_r   // the bill, in cents

        ldr     x0, =fmt_out
        mov     x1, count_r
        mov     x2, price_r
        mov     x3, total_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
