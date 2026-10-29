// Prints a name with %s, but x1 holds the number 7 instead of the address
// of a string, so printf has no string to read.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "name: %s\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_out
        mov     x1, 7                       // a number where an address belongs
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
