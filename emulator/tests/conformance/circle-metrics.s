// circle-metrics.s - circle area and circumference from a radius
// Reads an integer radius, converts it to double with scvtf, and uses pi
// and 2.0 from .data to compute area = pi*r*r and circumference = 2*pi*r,
// printing both with %.2f.

define(fp, x29)
define(lr, x30)
define(radius_r, w19)

r_s = 16
alloc = -(16 + 16) & -16
dealloc = -alloc

.data
.balign 8
pi_m:       .double 0r3.141592653589793
two_m:      .double 0r2.0
prompt:     .string "Enter radius: "
fmt_in:     .string "%d"
fmt_out:    .string "Area = %.2f, Circumference = %.2f\n"

.text
.balign 4
.global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x0, =prompt
        bl      printf

        ldr     x0, =fmt_in
        add     x1, fp, r_s
        bl      scanf
        ldr     radius_r, [fp, r_s]

        scvtf   d2, radius_r            // d2 = (double) radius
        ldr     x9, =pi_m
        ldr     d0, [x9]                // d0 = pi
        ldr     x9, =two_m
        ldr     d1, [x9]                // d1 = 2.0

        fmul    d3, d2, d2              // r * r
        fmul    d3, d0, d3              // area = pi * r^2

        fmul    d4, d0, d1              // 2 * pi
        fmul    d4, d4, d2              // circumference = 2 * pi * r

        ldr     x0, =fmt_out
        fmov    d0, d3                  // area in d0
        fmov    d1, d4                  // circumference in d1
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
