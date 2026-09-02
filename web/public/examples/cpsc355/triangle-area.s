// FP Example: Triangle Area in single precision
// Read base and height as ints, compute area = 0.5 * b * h in floats.
//
// Compile: m4 triangle-area.s > triangle-area.gen.s && gcc triangle-area.gen.s -o triangle-area
// The s registers are the float view of the FP file: s0 and d0 overlap.

define(fp, x29)
define(lr, x30)
define(base_r, w19)
define(height_r, w20)

alloc = -(16 + 16) & -16
dealloc = -alloc
tmp_s = 16

        .data
prompt_b:   .string "Enter base: "
prompt_h:   .string "Enter height: "
fmt_in:     .string "%d"
fmt_out:    .string "Area = %.2f\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        // Prompt and read the base
        ldr     x0, =prompt_b
        bl      printf
        ldr     x0, =fmt_in
        add     x1, fp, tmp_s
        bl      scanf
        ldr     base_r, [fp, tmp_s]

        // Prompt and read the height
        ldr     x0, =prompt_h
        bl      printf
        ldr     x0, =fmt_in
        add     x1, fp, tmp_s
        bl      scanf
        ldr     height_r, [fp, tmp_s]

        // area = 0.5 * base * height, computed in single precision
        scvtf   s0, base_r
        scvtf   s1, height_r
        fmul    s2, s0, s1
        fmov    s3, 0.5
        fmul    s4, s2, s3

        // printf takes a double, never a float: widen with fcvt first
        fcvt    d0, s4
        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
