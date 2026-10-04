// take a single-precision float apart into its sign, exponent and fraction
define(fp, x29)
define(lr, x30)

define(bits_r, w19)
define(sign_r, w20)
define(exp_r, w21)
define(frac_r, w22)

.data
fmt_float:  .string "%f"
fmt_parts:  .string "sign=%d exponent=%d fraction=0x%06x\n"
fmt_normal: .string "normal, 2^%d\n"
fmt_zero:   .string "zero\n"
fmt_sub:    .string "subnormal\n"
fmt_inf:    .string "infinity\n"
fmt_nan:    .string "not a number\n"

.bss
.align 2
value:      .skip 4                         // one float

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_float
        ldr     x1, =value
        bl      scanf

        ldr     x9, =value
        ldr     s0, [x9]
        fmov    bits_r, s0                  // same 32 bits, now in a w register

        ubfx    sign_r, bits_r, 31, 1
        ubfx    exp_r, bits_r, 23, 8        // biased exponent
        ubfx    frac_r, bits_r, 0, 23

        ldr     x0, =fmt_parts
        mov     w1, sign_r
        mov     w2, exp_r
        mov     w3, frac_r
        bl      printf

        cmp     exp_r, 255                  // all ones: infinity or NaN
        b.eq    special
        cmp     exp_r, 0                    // all zeros: zero or subnormal
        b.eq    tiny

        ldr     x0, =fmt_normal
        sub     w1, exp_r, 127              // remove the bias
        b       print

special:
        ldr     x0, =fmt_inf
        cmp     frac_r, 0
        b.eq    print
        ldr     x0, =fmt_nan
        b       print

tiny:
        ldr     x0, =fmt_zero
        cmp     frac_r, 0
        b.eq    print
        ldr     x0, =fmt_sub

print:
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
