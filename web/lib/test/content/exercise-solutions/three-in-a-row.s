// read three numbers into the frame and print them smallest first
define(fp, x29)
define(lr, x30)

define(a_r, w19)
define(b_r, w20)
define(c_r, w21)

a_s = 16                                    // frame offsets of the three locals
b_s = 20
c_s = 24
alloc = -(16 + 12) & -16
dealloc = -alloc

.data
fmt_in:     .string "%d"
fmt_out:    .string "%d %d %d\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // scanf("%d", &a)
        add     x1, fp, a_s
        bl      scanf
        ldr     x0, =fmt_in                 // scanf("%d", &b)
        add     x1, fp, b_s
        bl      scanf
        ldr     x0, =fmt_in                 // scanf("%d", &c)
        add     x1, fp, c_s
        bl      scanf

        ldr     b_r, [fp, b_s]
        ldr     a_r, [fp, a_s]
        ldr     c_r, [fp, c_s]

        cmp     a_r, b_r                    // the smaller of a and b goes first
        b.le    ab_ordered
        mov     w9, a_r
        mov     a_r, b_r
        mov     b_r, w9
ab_ordered:
        cmp     b_r, c_r                    // now the largest of all three is in c
        b.le    bc_ordered
        mov     w9, b_r
        mov     b_r, c_r
        mov     c_r, w9
bc_ordered:
        cmp     a_r, b_r                    // c may have been the smallest, so check a and b again
        b.le    all_ordered
        mov     w9, a_r
        mov     a_r, b_r
        mov     b_r, w9
all_ordered:

        ldr     x0, =fmt_out
        mov     w1, a_r
        mov     w2, b_r
        mov     w3, c_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
