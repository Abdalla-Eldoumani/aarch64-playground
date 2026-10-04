// Room for one local is made with sub sp, sp, 8, which leaves sp off
// the 16-byte boundary; the store through sp is the first access.

        .text
        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp

        sub     sp, sp, 8
        mov     x9, 7
        str     x9, [sp]
        add     sp, sp, 8

        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
