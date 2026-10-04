// unpack the four 8-bit channels of a 32-bit colour, then swap red and blue
define(fp, x29)
define(lr, x30)

define(pixel_r, w19)
define(alpha_r, w20)
define(red_r, w21)
define(green_r, w22)
define(blue_r, w23)
define(swapped_r, w24)

.data
fmt_colour: .string "%x"
fmt_ch:     .string "alpha %d, red %d, green %d, blue %d\n"
fmt_sw:     .string "swapped 0x%08x\n"

.bss
.balign 4
pixel_m:    .skip 4

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_colour             // read a colour typed in hex
        ldr     x1, =pixel_m
        bl      scanf
        ldr     x9, =pixel_m
        ldr     pixel_r, [x9]

        ubfx    alpha_r, pixel_r, 24, 8     // bits 31 to 24
        ubfx    red_r, pixel_r, 16, 8       // bits 23 to 16
        ubfx    green_r, pixel_r, 8, 8      // bits 15 to 8
        ubfx    blue_r, pixel_r, 0, 8       // bits 7 to 0

        mov     swapped_r, pixel_r          // alpha and green stay put
        bfi     swapped_r, blue_r, 16, 8    // blue moves into red's byte
        bfi     swapped_r, red_r, 0, 8      // red moves into blue's byte

        ldr     x0, =fmt_ch
        mov     w1, alpha_r
        mov     w2, red_r
        mov     w3, green_r
        mov     w4, blue_r
        bl      printf

        ldr     x0, =fmt_sw
        mov     w1, swapped_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
