// decode the low five bits of a number into a secret handshake
define(fp, x29)
define(lr, x30)

define(code_r, w19)
define(mask_r, w20)
define(count_r, w21)

.data
fmt_code:   .string "%d"
act_wave:   .string "wave\n"
act_nod:    .string "nod\n"
act_wink:   .string "wink\n"
act_clap:   .string "clap\n"
msg_none:   .string "no handshake\n"

.bss
.balign 4
code_m:     .skip 4

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_code               // read the code into code_m
        ldr     x1, =code_m
        bl      scanf
        ldr     x9, =code_m
        ldr     code_r, [x9]

        mov     count_r, 0                  // actions printed so far
        mov     mask_r, 1                   // forward order starts at wave
        tst     code_r, 16
        b.eq    hs_test
        mov     mask_r, 8                   // reversed order starts at clap
        b       hs_test
hs_loop:
        tst     code_r, mask_r              // is this action's bit set?
        b.eq    hs_next
        ldr     x0, =act_wave               // pick the string for this mask
        cmp     mask_r, 1
        b.eq    hs_print
        ldr     x0, =act_nod
        cmp     mask_r, 2
        b.eq    hs_print
        ldr     x0, =act_wink
        cmp     mask_r, 4
        b.eq    hs_print
        ldr     x0, =act_clap
hs_print:
        bl      printf
        add     count_r, count_r, 1
hs_next:
        tst     code_r, 16                  // walk up or down the bits
        b.ne    hs_down
        lsl     mask_r, mask_r, 1
        b       hs_test
hs_down:
        lsr     mask_r, mask_r, 1
hs_test:
        cmp     mask_r, 0                   // walked off the bottom
        b.eq    hs_end
        cmp     mask_r, 8                   // walked off the top
        b.le    hs_loop
hs_end:
        cmp     count_r, 0
        b.ne    hs_done
        ldr     x0, =msg_none
        bl      printf
hs_done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
