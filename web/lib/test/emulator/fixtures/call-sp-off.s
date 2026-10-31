// main moves sp down 8 bytes before calling twice, so sp is off a multiple
// of 16 at the call. twice touches no stack, so nothing faults and 42 prints.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "%ld\n"

.text

// twice(x0 = n) -> x0 = 2 * n, a leaf that never touches the stack
        .balign 4
        .global twice
twice:
        add     x0, x0, x0
        ret

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
