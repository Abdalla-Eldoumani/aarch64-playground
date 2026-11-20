// main calls a numeric local label with sp moved down 8 bytes. The code at
// 1: doubles x0 and returns without touching the stack: 42 prints.

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
        bl      1f
        add     sp, sp, 8

        mov     x1, x0
        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

1:      add     x0, x0, x0
        ret
