// twice sits after a `.section .text` line, which hides it as a function
// start, and main calls it with sp moved down 8 bytes. twice touches no
// stack: 42 prints.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "%ld\n"

.text

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        sub     sp, sp, 8                   // bug: 8 bytes leaves sp misaligned
        mov     x0, 21
        bl      twice
        add     sp, sp, 8

        mov     x1, x0
        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

        .section .text
// twice(x0 = n) -> x0 = 2 * n, a leaf that never touches the stack
        .balign 4
twice:
        add     x0, x0, x0
        ret
