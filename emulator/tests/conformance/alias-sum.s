// alias-sum.s - .req register aliases across a summing loop
// Later assignments name registers with .req instead of m4 defines,
// for integer and fp registers alike. the definitions carry trailing
// comments, fp and lr are re-aliased over their own names, and the
// alias word total inside the format string has to reach stdout
// untouched.

fp      .req x29                // frame pointer
lr      .req x30                // link register
idx     .req w19                // loop index
limit   .req w20                // loop bound
total   .req d8                 // running sum
step    .req d9                 // amount added each pass

.data
fmt_total:      .string "total = %.1f\n"

.text
.balign 4
.global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     idx, 0
        mov     limit, 4
        fmov    total, 0.5              // start half a step in
        fmov    step, 2.0

sum_loop:
        cmp     idx, limit
        b.ge    sum_done
        fadd    total, total, step      // total += step
        add     idx, idx, 1
        b       sum_loop

sum_done:
        ldr     x0, =fmt_total
        fmov    d0, total
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
