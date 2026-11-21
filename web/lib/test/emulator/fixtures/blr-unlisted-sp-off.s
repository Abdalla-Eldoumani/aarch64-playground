// main reaches twice through blr, with sp moved down 8 bytes. twice is not
// .global and no bl names it, so no function starts at its label, and the
// call is named by its address. twice touches no stack: 42 prints.

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

        adr     x9, twice
        sub     sp, sp, 8                   // bug: 8 bytes leaves sp misaligned
        mov     x0, 21
        blr     x9
        add     sp, sp, 8

        mov     x1, x0
        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

// twice(x0 = n) -> x0 = 2 * n, a leaf that never touches the stack
        .balign 4
twice:
        add     x0, x0, x0
        ret
