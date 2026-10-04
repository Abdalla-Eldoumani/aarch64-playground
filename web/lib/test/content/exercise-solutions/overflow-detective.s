// add two 32-bit integers and report signed overflow and unsigned carry
define(fp, x29)
define(lr, x30)

define(left_r, w19)
define(right_r, w20)
define(sum_r, w21)
define(ovf_r, x22)
define(carry_r, x23)

.data
fmt_pair:   .string "%d %d"
fmt_out:    .string "%d + %d = %d (overflow: %s, carry: %s)\n"
str_yes:    .string "yes"
str_no:     .string "no"

.bss
.balign 4
left_m:     .skip 4
right_m:    .skip 4

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_pair               // read the two numbers
        ldr     x1, =left_m
        ldr     x2, =right_m
        bl      scanf
        ldr     x9, =left_m
        ldr     left_r, [x9]
        ldr     x9, =right_m
        ldr     right_r, [x9]

        adds    sum_r, left_r, right_r      // 32-bit add, sets N Z C V
        ldr     ovf_r, =str_no              // ldr leaves the flags alone
        ldr     carry_r, =str_no
        b.vc    od_carry                    // V clear: the signed sum fit
        ldr     ovf_r, =str_yes
od_carry:
        b.cc    od_print                    // C clear: no carry out of bit 31
        ldr     carry_r, =str_yes
od_print:
        ldr     x0, =fmt_out
        mov     w1, left_r
        mov     w2, right_r
        mov     w3, sum_r
        mov     x4, ovf_r
        mov     x5, carry_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
