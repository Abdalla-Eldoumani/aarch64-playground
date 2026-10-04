// make change for a twenty in quarters, dimes, nickels and pennies
define(fp, x29)
define(lr, x30)

define(price_r, w19)
define(change_r, w20)
define(quarters_r, w21)
define(dimes_r, w22)
define(nickels_r, w23)
define(pennies_r, w24)

define(BILL, 2000)

.data
fmt_in:     .string "%d"
fmt_out:    .string "change in cents: %d\n25c x %d\n10c x %d\n5c x %d\n1c x %d\n"

.bss
        .balign 4
price_in:   .skip 4                         // scanf stores the price here

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read the price in cents, 0 to 2000
        ldr     x1, =price_in
        bl      scanf
        ldr     x9, =price_in
        ldr     price_r, [x9]

        mov     w9, BILL
        sub     change_r, w9, price_r       // cents owed back

        mov     w10, 25
        sdiv    quarters_r, change_r, w10   // how many quarters fit
        msub    w11, quarters_r, w10, change_r  // w11 = cents still owed

        mov     w10, 10
        sdiv    dimes_r, w11, w10
        msub    w11, dimes_r, w10, w11

        mov     w10, 5
        sdiv    nickels_r, w11, w10
        msub    pennies_r, nickels_r, w10, w11  // under 5 cents left: pennies

        ldr     x0, =fmt_out
        mov     w1, change_r
        mov     w2, quarters_r
        mov     w3, dimes_r
        mov     w4, nickels_r
        mov     w5, pennies_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
