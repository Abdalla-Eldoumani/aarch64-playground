// pack-color.s - pack, read back, and clear rgb channels in one word
// bfi builds the packed value channel by channel, ubfx pulls the green
// channel back out of the middle, and bic clears the blue mask without
// touching the bits around it.

define(fp, x29)
define(lr, x30)

.data
fmt_packed:     .string "color = 0x%x\n"
fmt_green:      .string "green = %d\n"
fmt_noblue:     .string "no blue = 0x%x\n"

.text
.balign 4
.global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w19, 0                  // packed color starts empty
        mov     w9, 0x11
        bfi     w19, w9, 16, 8          // red lands at bits 23:16
        mov     w9, 0x22
        bfi     w19, w9, 8, 8           // green lands at bits 15:8
        mov     w9, 0x33
        bfi     w19, w9, 0, 8           // blue lands at bits 7:0

        ldr     x0, =fmt_packed
        mov     w1, w19
        bl      printf

        ubfx    w20, w19, 8, 8          // green back out of the middle
        ldr     x0, =fmt_green
        mov     w1, w20
        bl      printf

        mov     w9, 0xFF                // blue channel mask
        bic     w21, w19, w9            // clear it, keep red and green
        ldr     x0, =fmt_noblue
        mov     w1, w21
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
