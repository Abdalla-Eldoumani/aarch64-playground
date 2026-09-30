// fcmp compares against a register or against zero, never another
// constant.

        .text
        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        fmov    d0, 1.0
        fcmp    d0, #1.0
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
