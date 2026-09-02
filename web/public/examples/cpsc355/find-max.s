// Example: find_max Function
// find_max(int *arr, int n) returns the largest value.
// Main fills an array, calls find_max, prints result.

define(fp, x29)
define(lr, x30)
// w22, not w19: main keeps the array base in x19, and a W-form write
// zero-extends over the whole X register.
define(i_r, w22)

.data
fmt_out:    .string "Max value: %d\n"
fmt_el:     .string "a[%d] = %d\n"

.bss
.align 4
arr:    .skip 40                        // 10 ints

.text

// find_max(x0 = arr base, w1 = n) -> w0 = max value
// Uses only scratch registers, so no callee-saved register needs spilling
        .balign 4
        .global find_max
find_max:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // Copy args into scratch regs (need x0 free for return)
        mov     x12, x0                // x12 = array base
        mov     w13, w1                 // w13 = n

        // Initialize max = arr[0]
        ldr     w10, [x12]              // w10 = max = arr[0]

        mov     w9, 1                   // i = 1
        b       fm_test

fm_loop:
        ldr     w11, [x12, w9, SXTW 2] // w11 = arr[i]
        cmp     w11, w10
        b.le    fm_skip
        mov     w10, w11                // new max
fm_skip:
        add     w9, w9, 1
fm_test:
        cmp     w9, w13
        b.lt    fm_loop

        mov     w0, w10                 // return max
        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x19, =arr              // x19 = array base

        // Fill array: a[i] = (i+1) * 7 (so values are 7, 14, 21, ..., 70)
        mov     i_r, 0
fill:
        add     w9, i_r, 1
        mov     w10, 7
        mul     w9, w9, w10             // value = (i+1) * 7
        str     w9, [x19, i_r, SXTW 2]

        add     i_r, i_r, 1
        cmp     i_r, 10
        b.lt    fill

        // Print the array
        mov     i_r, 0
print_loop:
        ldr     w20, [x19, i_r, SXTW 2]
        ldr     x0, =fmt_el
        mov     w1, i_r
        mov     w2, w20
        bl      printf
        add     i_r, i_r, 1
        cmp     i_r, 10
        b.lt    print_loop

        // Call find_max
        ldr     x0, =arr               // pass array base
        mov     w1, 10                  // pass size
        bl      find_max
        mov     w20, w0                 // save return value

        // Print max
        ldr     x0, =fmt_out
        mov     w1, w20
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
