// Reads an int with scanf but hands it the int's value instead of its
// address: x1 holds what a_s holds (0), so scanf stores at address 0.

define(fp, x29)
define(lr, x30)

a_s = 16
alloc = -(16 + 16) & -16
dealloc = -alloc

.data
fmt_in:     .string "%d"
fmt_out:    .string "a = %d\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x0, =fmt_in
        ldr     w1, [fp, a_s]               // the value of a, where &a belongs
        bl      scanf

        ldr     x0, =fmt_out
        ldr     w1, [fp, a_s]
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
