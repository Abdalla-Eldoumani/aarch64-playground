// alt-series.s - alternating harmonic sum with a sign flip each pass
// fmov immediates seed the first term and the running sign, fneg flips
// the sign each iteration, and fabs sizes the last term added so the
// error line reports a magnitude instead of a direction.

define(fp, x29)
define(lr, x30)
define(sum_r, d8)
define(sign_r, d9)
define(term_r, d10)
define(k_r, d11)
define(k_int, w19)
define(n_int, w20)

.data
fmt_sum:        .string "sum = %.4f\n"
fmt_last:       .string "last term size = %.4f\n"

.text
.balign 4
.global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        fmov    sum_r, 1.0              // first term of the series
        fmov    sign_r, -1.0            // second term is negative
        mov     k_int, 2                // next denominator
        mov     n_int, 4                // stop after 1 - 1/2 + 1/3 - 1/4

series_loop:
        cmp     k_int, n_int
        b.gt    series_done
        scvtf   k_r, k_int              // k as a double for the divide
        fdiv    term_r, sign_r, k_r     // term = sign / k
        fadd    sum_r, sum_r, term_r    // sum += term
        fneg    sign_r, sign_r          // alternate the sign
        add     k_int, k_int, 1
        b       series_loop

series_done:
        ldr     x0, =fmt_sum
        fmov    d0, sum_r
        bl      printf

        fabs    term_r, term_r          // size of the last term added
        ldr     x0, =fmt_last
        fmov    d0, term_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
