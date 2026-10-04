// build a single-precision float from a sign, an exponent and a fraction
define(fp, x29)
define(lr, x30)

define(sign_r, w19)
define(exp_r, w20)
define(frac_r, w21)
define(bits_r, w22)

.data
fmt_parts:  .string "%d %d %x"
fmt_out:    .string "0x%08x = %f\n"
fmt_range:  .string "cannot build that\n"

.bss
.align 2
sign_in:    .skip 4
exp_in:     .skip 4
frac_in:    .skip 4

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_parts
        ldr     x1, =sign_in
        ldr     x2, =exp_in
        ldr     x3, =frac_in
        bl      scanf
        ldr     x9, =sign_in
        ldr     sign_r, [x9]
        ldr     x9, =exp_in
        ldr     exp_r, [x9]
        ldr     x9, =frac_in
        ldr     frac_r, [x9]

        cmp     sign_r, 1                   // unsigned: anything but 0 or 1 is out
        b.hi    out_of_range
        cmp     exp_r, -126                 // normal exponents run -126 to 127
        b.lt    out_of_range
        cmp     exp_r, 127
        b.gt    out_of_range
        movz    w9, 0x7f, lsl 16
        movk    w9, 0xffff                  // w9 = 0x7fffff, the largest fraction
        cmp     frac_r, w9
        b.hi    out_of_range

        mov     bits_r, frac_r              // fraction in bits 22 to 0
        add     w9, exp_r, 127              // add the bias
        bfi     bits_r, w9, 23, 8           // exponent in bits 30 to 23
        bfi     bits_r, sign_r, 31, 1       // sign in bit 31

        fmov    s0, bits_r                  // same bits, now a float
        fcvt    d0, s0                      // printf takes a double
        ldr     x0, =fmt_out
        mov     w1, bits_r
        bl      printf
        mov     w0, 0
        b       done

out_of_range:
        ldr     x0, =fmt_range
        bl      printf
        mov     w0, 1

done:
        ldp     fp, lr, [sp], 16
        ret
