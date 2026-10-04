// read two integers from input and print their sum
define(fp, x29)
define(lr, x30)

define(a_r, x19)
define(b_r, x20)

a_s = 16                                    // first local's frame offset
b_s = 24                                    // second local's frame offset
alloc = -(16 + 16) & -16
dealloc = -alloc

        .data
fmt_in:     .string "%lld %lld"
fmt_out:    .string "sum = %lld\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x0, =fmt_in
        add     x1, fp, a_s                 // &a in the frame
        add     x2, fp, b_s                 // &b in the frame
        bl      scanf

        ldr     b_r, [fp, b_s]
        ldr     a_r, [fp, a_s]
        add     a_r, a_r, b_r

        ldr     x0, =fmt_out
        mov     x1, a_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
