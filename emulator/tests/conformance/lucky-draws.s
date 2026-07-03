// lucky-draws.s - seeded pseudo-random draws
// seeds the c generator with time(0), then prints three draws bounded
// into 1..49 with the divide-multiply-subtract remainder idiom. the
// emulator's time() is a fixed stamp, so the sequence is identical on
// every run and the expected output can be asserted exactly.

define(fp, x29)
define(lr, x30)
define(count_r, w19)
define(draw_r, w20)

        .data
fmt_draw:   .string "pick %d: %d\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 0                   // time(0)
        bl      time
        bl      srand                   // seed carries straight from w0

        mov     count_r, 1
draw_loop:
        cmp     count_r, 3
        b.gt    draw_done
        bl      rand
        mov     w9, 49
        udiv    w10, w0, w9
        msub    draw_r, w10, w9, w0     // rand() % 49
        add     draw_r, draw_r, 1       // shift into 1..49
        ldr     x0, =fmt_draw
        mov     w1, count_r
        mov     w2, draw_r
        bl      printf
        add     count_r, count_r, 1
        b       draw_loop

draw_done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
