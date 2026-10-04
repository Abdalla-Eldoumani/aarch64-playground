// A forward reference to a numeric local label that is never defined
// below it.

        .text
        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x0, 3
1:      subs    x0, x0, 1
        b.ne    1b
        cbz     x0, 1f                  // no 1: follows
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
