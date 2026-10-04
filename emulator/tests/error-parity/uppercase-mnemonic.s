        .text
        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        MVO     x0, [sp, 16]
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
