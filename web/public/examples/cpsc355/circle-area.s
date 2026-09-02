// FP Example 2: Circle Area Calculator
// Read an integer radius, compute area = pi * r * r, print it.

define(fp, x29)
define(lr, x30)
define(radius_r, w19)

r_s = 16
alloc = -(16 + 16) & -16
dealloc = -alloc

        .data
pi_m:   .double 0r3.14159265358979      // 0r prefix: GAS syntax for a real literal

        .text
fmt_scan:   .string "%d"
prompt:     .string "Enter radius: "
fmt_out:    .string "Area = %.4f\n"

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        // Prompt and read radius
        ldr     x0, =prompt
        bl      printf

        ldr     x0, =fmt_scan
        add     x1, fp, r_s
        bl      scanf
        ldr     radius_r, [fp, r_s]     // w19 = radius (int)

        // Convert radius to double
        scvtf   d1, radius_r

        ldr     x9, =pi_m
        ldr     d0, [x9]               // d0 = pi

        // Compute area = pi * r * r
        fmul    d2, d1, d1
        fmul    d0, d0, d2

        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
