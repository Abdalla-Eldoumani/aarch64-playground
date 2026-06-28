// locals.s - read two integers into stack locals, print their sum and product
// Allocates two local ints in the frame, reads both with one scanf, loads
// them back by offset from the frame pointer, and prints the sum and the
// product. Frame allocation and access to locals by offset, no globals.

define(fp, x29)
define(lr, x30)
define(a_r, w19)
define(b_r, w20)
define(sum_r, w21)
define(prod_r, w22)

a_s = 16
b_s = 20
alloc = -(16 + 16) & -16
dealloc = -alloc

.data
prompt:     .string "Enter two integers: "
fmt_in:     .string "%d %d"
fmt_out:    .string "Sum = %d, Product = %d\n"

.text
.balign 4
.global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x0, =prompt
        bl      printf

        ldr     x0, =fmt_in
        add     x1, fp, a_s             // &a in the frame
        add     x2, fp, b_s             // &b in the frame
        bl      scanf

        ldr     a_r, [fp, a_s]
        ldr     b_r, [fp, b_s]

        add     sum_r, a_r, b_r
        mul     prod_r, a_r, b_r

        ldr     x0, =fmt_out
        mov     w1, sum_r
        mov     w2, prod_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
