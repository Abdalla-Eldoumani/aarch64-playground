// trade the two nibbles (4-bit halves) of a byte
define(fp, x29)
define(lr, x30)

define(value_r, w19)
define(byte_r, w20)
define(swap_r, w21)

.data
fmt_hex:    .string "%x"
fmt_out:    .string "0x%02x -> 0x%02x\n"

.bss
.balign 4
value_m:    .skip 4

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_hex                // read a value typed in hex
        ldr     x1, =value_m
        bl      scanf
        ldr     x9, =value_m
        ldr     value_r, [x9]

        and     byte_r, value_r, 0xff       // everything above bit 7 goes
        lsr     w9, byte_r, 4               // high nibble drops to the bottom
        lsl     w10, byte_r, 4              // low nibble climbs to the top
        and     w10, w10, 0xf0              // but must stay inside the byte
        orr     swap_r, w9, w10

        ldr     x0, =fmt_out
        mov     w1, byte_r
        mov     w2, swap_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
