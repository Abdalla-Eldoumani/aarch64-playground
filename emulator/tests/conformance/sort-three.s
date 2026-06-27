// sort-three.s - read three integers and print them in ascending order
// Orders the values with three cmp / conditional-branch passes, swapping
// through a scratch register. Exercises the NZCV flags and b.le branches.

define(fp, x29)
define(lr, x30)
define(a_r, w19)
define(b_r, w20)
define(c_r, w21)

a_s = 16
b_s = 20
c_s = 24
alloc = -(16 + 16) & -16
dealloc = -alloc

.data
prompt:     .string "Enter three integers: "
fmt_in:     .string "%d %d %d"
fmt_out:    .string "Sorted: %d %d %d\n"

.text
.balign 4
.global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x0, =prompt
        bl      printf

        ldr     x0, =fmt_in
        add     x1, fp, a_s
        add     x2, fp, b_s
        add     x3, fp, c_s
        bl      scanf

        ldr     a_r, [fp, a_s]
        ldr     b_r, [fp, b_s]
        ldr     c_r, [fp, c_s]

        // pass 1: settle the smaller of a, b into a
        cmp     a_r, b_r
        b.le    order_bc
        mov     w9, a_r
        mov     a_r, b_r
        mov     b_r, w9
order_bc:
        // pass 2: settle the largest into c
        cmp     b_r, c_r
        b.le    order_ab
        mov     w9, b_r
        mov     b_r, c_r
        mov     c_r, w9
order_ab:
        // pass 3: re-check a, b now that c is largest
        cmp     a_r, b_r
        b.le    emit
        mov     w9, a_r
        mov     a_r, b_r
        mov     b_r, w9
emit:
        ldr     x0, =fmt_out
        mov     w1, a_r
        mov     w2, b_r
        mov     w3, c_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
