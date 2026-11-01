// set_up uses fp as scratch and, missing its ret, falls through into finish,
// which saves and restores fp, so finish's ret hands back the fp set_up left.
// main never reads fp again; it prints 7 and exits 0.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "%ld\n"

.text

// set_up(x0 = n) keeps n in fp (bug: fp is not scratch, and set_up has no ret)
        .balign 4
        .global set_up
set_up:
        mov     fp, x0

// finish() saves and restores fp and lr
        .balign 4
        .global finish
finish:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 8
        bl      set_up

        ldr     x0, =fmt_out
        mov     x1, 7
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
