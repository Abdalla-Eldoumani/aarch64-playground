// The format string is labelled fmt, but the load names fmtt.

        .text
fmt:    .string "hello\n"

        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp

        ldr     x0, =fmtt
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
