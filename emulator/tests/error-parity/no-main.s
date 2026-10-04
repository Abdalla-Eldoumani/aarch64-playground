// A greeting routine and nothing else: no line defines main, so the
// startup code has nothing to call.

        .text
fmt:    .string "hello from greet\n"

        .balign 4
        .global greet
greet:  stp     x29, x30, [sp, -16]!
        mov     x29, sp

        ldr     x0, =fmt
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
