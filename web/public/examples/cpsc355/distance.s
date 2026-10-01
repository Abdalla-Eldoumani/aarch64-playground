// distance.s - how far each number in an array is from zero, and the total

define(fp, x29)
define(lr, x30)
define(base_r, x19)
define(i_r, w20)
define(num_r, w21)
define(total_r, w22)

define(COUNT, 6)

.data
nums:       .word   3, -8, 5, -2, 7, -1
fmt_dist:   .string "%2d is %d from zero\n"
fmt_total:  .string "total distance: %d\n"

.text

// abs_val(w0 = n) -> w0 = how far n is from zero
        .balign 4
        .global abs_val
abs_val:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        cmp     w0, 0
        b.ge    abs_done                    // already a distance
        neg     w0, w0                      // drop the minus sign
abs_done:
        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     base_r, =nums
        mov     total_r, 0
        mov     i_r, 0
        b       dist_test
dist_loop:
        ldr     num_r, [base_r, i_r, SXTW 2]    // num_r = nums[i]
        mov     w0, num_r
        bl      abs_val
        add     total_r, total_r, w0

        mov     w2, w0                      // copy before x0 gets the format
        mov     w1, num_r
        ldr     x0, =fmt_dist
        bl      printf

        add     i_r, i_r, 1
dist_test:
        cmp     i_r, COUNT
        b.lt    dist_loop

        ldr     x0, =fmt_total
        mov     w1, total_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
