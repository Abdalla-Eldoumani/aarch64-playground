// hand_on reaches set_fp with b, and set_fp uses fp as scratch, so main's
// call to hand_on comes back with fp changed. main never reads fp again; it
// prints 7 and exits 0.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "%ld\n"

.text

// set_fp(x0 = n) keeps n in fp (bug: fp is not a scratch register)
        .balign 4
        .global set_fp
set_fp:
        mov     fp, x0
        ret

// hand_on(x0 = n) finishes in set_fp
        .balign 4
        .global hand_on
hand_on:
        b       set_fp                      // tail call: set_fp returns to main

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 8
        bl      hand_on

        ldr     x0, =fmt_out
        mov     x1, 7
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
