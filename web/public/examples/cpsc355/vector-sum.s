// Add up sixteen numbers four at a time.
// Each add works on four lanes of a v register at once, so the loop runs
// four times instead of sixteen; one last instruction folds the four
// running totals into a single sum.

define(fp, x29)
define(lr, x30)
define(arr_r, x19)
define(i_r, w20)
define(sum_r, w21)

define(COUNT, 16)

        .data
        .align 4
nums:       .word 3, 1, 4, 1, 5, 9, 2, 6    // COUNT ints
            .word 5, 3, 5, 8, 9, 7, 9, 3
fmt_out:    .string "sum = %d\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        movi    v0.4s, 0                // four running totals, all zero
        ldr     arr_r, =nums
        mov     i_r, 0
        b       vs_test
vs_loop:
        ldr     q1, [arr_r]             // nums[i] .. nums[i+3] in one load
        add     v0.4s, v0.4s, v1.4s     // lane by lane: total[k] += nums[i+k]
        add     arr_r, arr_r, 16
        add     i_r, i_r, 4
vs_test:
        cmp     i_r, COUNT
        b.lt    vs_loop

        addv    s0, v0.4s               // s0 = total[0] + total[1] + total[2] + total[3]
        fmov    sum_r, s0               // the bits, unchanged, into an integer register

        ldr     x0, =fmt_out
        mov     w1, sum_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
