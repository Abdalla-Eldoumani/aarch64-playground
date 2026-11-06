// Prints eight numbers with one printf but loads only seven registers:
// x1 to x7 are used up, so the eighth %d is read from the stack.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "%d %d %d %d %d %d %d %d\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_out
        mov     w1, 1
        mov     w2, 2
        mov     w3, 3
        mov     w4, 4
        mov     w5, 5
        mov     w6, 6
        mov     w7, 7
        bl      printf                      // the eighth value comes from [sp]

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
