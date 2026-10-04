// main is defined, but the .global line that exports it is missing.

        .text
fmt:    .string "hello from main\n"

        .balign 4
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp

        ldr     x0, =fmt
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
