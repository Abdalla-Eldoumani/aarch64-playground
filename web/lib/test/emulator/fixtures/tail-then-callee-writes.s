// tidy pops its own frame and reaches outer with b. outer calls clear, which
// stores zero over outer's saved fp, so outer returns to main with fp zero.
// main never reads fp again; it prints 7 and exits 0.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "%ld\n"

.text

// clear() zeroes the word above its own frame record (bug: outer's saved fp)
        .balign 4
        .global clear
clear:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        str     xzr, [sp, 16]

        ldp     fp, lr, [sp], 16
        ret

// outer() calls clear
        .balign 4
        .global outer
outer:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      clear

        ldp     fp, lr, [sp], 16
        ret

// tidy() pops its own frame, then finishes in outer
        .balign 4
        .global tidy
tidy:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldp     fp, lr, [sp], 16
        b       outer                       // tail call: outer returns to main

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      tidy

        ldr     x0, =fmt_out
        mov     x1, 7
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
