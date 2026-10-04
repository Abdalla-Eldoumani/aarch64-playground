// turn an age in years into minutes with a 64-bit multiply
define(fp, x29)
define(lr, x30)

define(years_r, w19)
define(years64_r, x20)
define(minutes_r, x21)

.data
fmt_in:     .string "%d"
fmt_out:    .string "%d years is %ld minutes\n"

.bss
        .balign 4
years_in:   .skip 4                         // room for one 32-bit int

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // %d fills 4 bytes
        ldr     x1, =years_in               // scanf needs the address
        bl      scanf

        ldr     x9, =years_in
        ldr     years_r, [x9]
        sxtw    years64_r, years_r          // same value, 64 bits wide, sign kept

        mov     x10, 1440                   // minutes in a day
        mov     x11, 365
        mul     x10, x10, x11               // 525600 does not fit in one mov
        mul     minutes_r, years64_r, x10   // a 64-bit product cannot overflow here

        ldr     x0, =fmt_out
        mov     w1, years_r                 // %d takes a w register
        mov     x2, minutes_r               // %ld takes an x register
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
