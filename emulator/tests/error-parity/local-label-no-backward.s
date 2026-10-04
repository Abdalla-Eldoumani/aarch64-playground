// A backward reference to a numeric local label with no definition above
// it.

        .text
        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x0, 3
        subs    x0, x0, 1
        b.ne    2b                      // no 2: above
2:      mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
