// printf is called with its value in w1, but x0 was never pointed at
// the format string: x0 still holds argc from the start of main.

        .text
fmt:    .string "the answer is %d\n"

        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp

        mov     w1, 42
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
