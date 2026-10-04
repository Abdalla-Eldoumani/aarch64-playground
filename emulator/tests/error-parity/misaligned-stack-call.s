// The frame is 24 bytes, not a multiple of 16, so sp is off the
// 16-byte boundary when printf is called.

        .text
fmt:    .string "frame of 24 bytes\n"

        .balign 4
        .global main
main:   stp     x29, x30, [sp, -24]!
        mov     x29, sp

        ldr     x0, =fmt
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 24
        ret
