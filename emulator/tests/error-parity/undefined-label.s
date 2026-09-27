// Counts to three, but the loop's branch names a label that does not
// exist: the target is spelled lopo instead of loop.

        .text
fmt:    .string "count = %d\n"

        .balign 4
        .global main
main:   stp     x29, x30, [sp, -32]!
        mov     x29, sp
        str     x19, [x29, 16]

        mov     w19, 0
loop:   ldr     x0, =fmt
        mov     w1, w19
        bl      printf
        add     w19, w19, 1
        cmp     w19, 3
        b.lt    lopo

        mov     w0, 0
        ldr     x19, [x29, 16]
        ldp     x29, x30, [sp], 32
        ret
