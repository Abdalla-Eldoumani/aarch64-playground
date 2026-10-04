// movi takes an 8-bit immediate, and -129 is one past its lower end.

        .text
        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        movi    v0.8b, -129
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
