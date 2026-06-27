// stack-average.s - read five numbers into a stack array, print sum + average
// Allocates a local array in the frame, fills it from scanf in one loop,
// then walks it again with scaled indexing to total and average the values.

define(fp, x29)
define(lr, x30)
define(base_r, x19)
define(i_r, w20)
define(sum_r, w21)
define(avg_r, w22)
define(ptr_r, x23)

count = 5
arr_s = 16
alloc = -(16 + 32) & -16
dealloc = -alloc

.data
prompt:     .string "Enter 5 numbers: "
fmt_in:     .string "%d"
fmt_out:    .string "Sum = %d, Average = %d\n"

.text
.balign 4
.global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x0, =prompt
        bl      printf

        add     base_r, fp, arr_s       // base of the local array
        mov     ptr_r, base_r           // walking write pointer
        mov     i_r, 0
read_loop:
        cmp     i_r, count
        b.ge    sum_setup
        ldr     x0, =fmt_in
        mov     x1, ptr_r               // &arr[i]
        bl      scanf
        add     ptr_r, ptr_r, 4
        add     i_r, i_r, 1
        b       read_loop

sum_setup:
        mov     sum_r, 0
        mov     i_r, 0
sum_loop:
        cmp     i_r, count
        b.ge    finish
        ldr     w9, [base_r, i_r, sxtw 2]
        add     sum_r, sum_r, w9
        add     i_r, i_r, 1
        b       sum_loop

finish:
        mov     w9, count
        sdiv    avg_r, sum_r, w9        // integer average

        ldr     x0, =fmt_out
        mov     w1, sum_r
        mov     w2, avg_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
