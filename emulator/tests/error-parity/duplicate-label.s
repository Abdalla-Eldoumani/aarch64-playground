// Two loops, both labelled loop: labels are file-wide, so the second
// definition collides with the first.

        .text
fmt:    .string "%d\n"

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
        cmp     w19, 2
        b.lt    loop

        mov     w19, 10
loop:   ldr     x0, =fmt
        mov     w1, w19
        bl      printf
        sub     w19, w19, 1
        cmp     w19, 8
        b.gt    loop

        mov     w0, 0
        ldr     x19, [x29, 16]
        ldp     x29, x30, [sp], 32
        ret
