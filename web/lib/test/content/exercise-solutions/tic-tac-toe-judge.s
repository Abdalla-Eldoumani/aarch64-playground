// read a tic-tac-toe board and say who won
define(fp, x29)
define(lr, x30)

define(board_r, x19)
define(k_r, x20)

.data
fmt_in:     .string "%9s"
fmt_win:    .string "%c wins\n"
msg_draw:   .string "draw\n"
msg_open:   .string "keep playing\n"

.bss
.align 4
board:      .skip 16                        // 9 cells row by row, then the zero byte

.text

// line_mark(x0 = first cell, x1 = step to the next cell) -> w0 = 'X' or 'O', or 0
// Leaf function: uses only scratch registers
        .balign 4
        .global line_mark
line_mark:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldrb    w9, [x0]                    // first cell
        ldrb    w10, [x0, x1]               // second cell
        add     x11, x0, x1, lsl 1
        ldrb    w11, [x11]                  // third cell
        mov     w0, 0                       // no winner unless all three match
        cmp     w9, '.'
        b.eq    lm_done                     // three empty cells are not a win
        cmp     w9, w10
        b.ne    lm_done
        cmp     w9, w11
        b.ne    lm_done
        mov     w0, w9
lm_done:
        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read the nine cells as one word
        ldr     x1, =board
        bl      scanf
        ldr     board_r, =board

        mov     k_r, 0                      // row k starts at cell k * 3, step 1
        b       row_test
row_loop:
        add     x0, k_r, k_r, lsl 1
        add     x0, board_r, x0
        mov     x1, 1
        bl      line_mark
        cmp     w0, 0
        b.ne    winner
        add     k_r, k_r, 1
row_test:
        cmp     k_r, 3
        b.lt    row_loop

        mov     k_r, 0                      // column k starts at cell k, step 3
        b       col_test
col_loop:
        add     x0, board_r, k_r
        mov     x1, 3
        bl      line_mark
        cmp     w0, 0
        b.ne    winner
        add     k_r, k_r, 1
col_test:
        cmp     k_r, 3
        b.lt    col_loop

        mov     x0, board_r                 // top left to bottom right, step 4
        mov     x1, 4
        bl      line_mark
        cmp     w0, 0
        b.ne    winner
        add     x0, board_r, 2              // top right to bottom left, step 2
        mov     x1, 2
        bl      line_mark
        cmp     w0, 0
        b.ne    winner

        mov     k_r, 0                      // no line: look for an empty cell
        b       open_test
open_loop:
        ldrb    w9, [board_r, k_r]
        cmp     w9, '.'
        b.eq    still_open
        add     k_r, k_r, 1
open_test:
        cmp     k_r, 9
        b.lt    open_loop
        ldr     x0, =msg_draw
        b       report
still_open:
        ldr     x0, =msg_open
report:
        bl      printf
        b       done

winner:
        mov     w1, w0                      // the winning mark
        ldr     x0, =fmt_win
        bl      printf
done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
