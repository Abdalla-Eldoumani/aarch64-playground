// main keeps 5 in x19 across a call and prints 5 + 4 * 4, but square uses
// x19 as scratch and does not put it back, so it prints 20, not 21.

define(fp, x29)
define(lr, x30)

define(base_r, x19)

.data
fmt_out:    .string "%ld\n"

.text

// square(x0 = n) -> x0 = n * n (bug: x19 is callee-saved)
        .balign 4
        .global square
square:
        mov     x19, x0                     // scratch copy of n
        mul     x0, x19, x19
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     base_r, 5
        mov     x0, 4
        bl      square                      // x0 = 16
        add     x1, x0, base_r              // 16 + 5
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
