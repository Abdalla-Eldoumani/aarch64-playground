// referee one round of rock, paper, scissors
// moves: 0 = rock, 1 = paper, 2 = scissors

define(fp, x29)
define(lr, x30)

define(p1_r, x19)
define(p2_r, x20)
define(gap_r, x21)

.data
fmt_in:     .string "%ld %ld"
msg_p1:     .string "player 1 wins\n"
msg_p2:     .string "player 2 wins\n"
msg_draw:   .string "draw\n"
msg_bad:    .string "invalid move\n"

.bss
.balign 8
p1_m:       .skip 8
p2_m:       .skip 8

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read both moves
        ldr     x1, =p1_m
        ldr     x2, =p2_m
        bl      scanf

        ldr     x9, =p1_m
        ldr     p1_r, [x9]
        ldr     x9, =p2_m
        ldr     p2_r, [x9]

        cmp     p1_r, 0                     // each move must be 0, 1 or 2
        b.lt    bad_move
        cmp     p1_r, 2
        b.gt    bad_move
        cmp     p2_r, 0
        b.lt    bad_move
        cmp     p2_r, 2
        b.gt    bad_move

        // each move beats the one just below it, and rock (0) wraps
        // around to beat scissors (2), so the gap alone names the winner
        sub     gap_r, p1_r, p2_r
        ldr     x0, =msg_draw
        cmp     gap_r, 0
        b.eq    announce
        ldr     x0, =msg_p1
        cmp     gap_r, 1
        b.eq    announce
        cmp     gap_r, -2
        b.eq    announce
        ldr     x0, =msg_p2
announce:
        bl      printf
        mov     w0, 0
        b       done

bad_move:
        ldr     x0, =msg_bad
        bl      printf
        mov     w0, 1                       // a nonzero status reports the error

done:
        ldp     fp, lr, [sp], 16
        ret
