// Mean of eight floats, four lanes at a time.
// fadd sums four pairs at once; faddp adds neighbouring lanes, so two of
// them fold four partial sums into one. The result is widened to a
// double because printf takes doubles.

define(fp, x29)
define(lr, x30)
define(arr_r, x19)
define(i_r, w20)

define(COUNT, 8)

        .data
        .align 4
values:     .float 0r1.5, 0r2.5, 0r3.0, 0r4.0
            .float 0r5.5, 0r6.5, 0r7.0, 0r8.0
fmt_out:    .string "mean = %.2f\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        movi    v0.4s, 0                // four running sums, all zero
        ldr     arr_r, =values
        mov     i_r, 0
        b       vm_test
vm_loop:
        ldr     q1, [arr_r]             // values[i] .. values[i+3]
        fadd    v0.4s, v0.4s, v1.4s     // sum[k] += values[i+k]
        add     arr_r, arr_r, 16
        add     i_r, i_r, 4
vm_test:
        cmp     i_r, COUNT
        b.lt    vm_loop

        faddp   v0.4s, v0.4s, v0.4s     // lanes 0+1 and 2+3
        faddp   v0.4s, v0.4s, v0.4s     // and those two together: s0 = total
        mov     w9, COUNT
        scvtf   s1, w9                  // s1 = 8.0
        fdiv    s0, s0, s1              // s0 = total / 8
        fcvt    d0, s0                  // printf wants a double

        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
