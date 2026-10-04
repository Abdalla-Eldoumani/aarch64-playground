// The return value is set with mvo, a typo for mov.

        .text
fmt:    .string "done\n"

        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp

        ldr     x0, =fmt
        bl      printf

        mvo     w0, 0
        ldp     x29, x30, [sp], 16
        ret
