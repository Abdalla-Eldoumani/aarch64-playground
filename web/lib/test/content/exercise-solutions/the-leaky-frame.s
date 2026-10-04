// stash a lucky number in the frame and print it back
define(fp, x29)
define(lr, x30)

define(lucky_r, x19)

lucky_s = 16                                // the local's frame offset

        .data
fmt_in:     .string "%lld"
fmt_out:    .string "lucky = %lld\n"

        .bss
        .balign 8
lucky_m:    .skip 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read the lucky number
        ldr     x1, =lucky_m
        bl      scanf
        ldr     x9, =lucky_m
        ldr     lucky_r, [x9]
        str     lucky_r, [fp, lucky_s]      // stash it in the frame

        ldr     x1, [fp, lucky_s]
        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 32
        ret
