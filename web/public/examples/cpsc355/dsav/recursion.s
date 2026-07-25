// recursion_viz.asm - towers of hanoi, with the call stack drawn beside it
//
// The solver is genuinely recursive: rec_hanoi calls itself, and the frame
// the assembler pushes for that call is the frame the side panel draws. So
// the panel is not an illustration of recursion, it is a readout of the
// processor stack itself, growing as the calls go down and unwinding as
// they return. Watching the move counter arrive at 2^n - 1 is the other
// half of the lesson.

define(fp, x29)
define(lr, x30)

    rec_pegs = 3
    rec_max = 6                             // discs, capped by the peg height
    rec_lane = 5                            // the row a disc travels along
    rec_top_slot = 7                        // topmost disc row
    rec_base_slot = 12                      // bottom disc row
    rec_base_row = 13
    rec_label_row = 14

    // role numbers understood by th_fg, th_bg, ui_text and ui_badge
    rec_role_text = 0
    rec_role_dim = 1
    rec_role_faint = 2
    rec_role_accent = 3
    rec_role_key = 4
    rec_role_ok = 5
    rec_role_warn = 6
    rec_role_hot = 7
    rec_role_bad = 8
    rec_role_node = 9

    .data
    .balign 8

// ---------------------------------------------------------------- state

rec_peg:            .skip 24                // peg[p*8 + level], 0 = empty
rec_frame_n:        .skip 8                 // one call frame per depth
rec_frame_s:        .skip 8
rec_frame_d:        .skip 8
rec_frame_x:        .skip 8

    .balign 4
rec_high:           .word 0, 0, 0           // discs standing on each peg
rec_discs:          .word 3
rec_speed:          .word 220               // ms a step holds
rec_step:           .word 0                 // 1 = one move per enter
rec_moves:          .word 0
rec_depth:          .word 0
rec_air:            .word 0                 // disc in flight, 0 = none
rec_air_col:        .word 0
rec_air_row:        .word rec_lane
rec_ready:          .word 0                 // pegs built yet?
rec_msg_a:          .word 0
rec_msg_b:          .word 0

    .balign 8
rec_msg:            .dword 0                // caption text, 0 = no caption

// --------------------------------------------------------------- layout
//
// Three poles standing in one panel. A disc of size k is 2k+1 cells wide,
// so the widest is thirteen and the columns below leave four clear cells
// between neighbouring towers.

    .balign 4
rec_peg_col:        .byte 11, 28, 45

// One-character labels, two bytes apart, so label i starts at
// rec_peg_lbl + 2*i and the bare letter is the byte there.
rec_peg_lbl:
    .string "A"
    .string "B"
    .string "C"

rec_digits:
    .string "1"
    .string "2"
    .string "3"
    .string "4"
    .string "5"
    .string "0"

// --------------------------------------------------------------- glyphs

rec_sp:             .string " "
rec_pole:           .string "\xe2\x94\x82"
rec_base:           .string "\xe2\x94\x80"

// -------------------------------------------------------------- strings

rec_title:          .string "towers of hanoi"
rec_foot_menu:      .string "every move is one line of a function that calls itself twice"
rec_foot_run:       .string "the panel on the right is the processor stack itself, frame by frame"
rec_foot_pick:      .string "the value is clamped to the range shown"

rec_panel_pegs:     .string "pegs"
rec_panel_stack:    .string "call stack"
rec_panel_menu:     .string "operations"
rec_panel_set:      .string "setting"

rec_mi1:            .string "solve the towers"
rec_mi2:            .string "number of discs"
rec_mi3:            .string "animation speed"
rec_mi4:            .string "step mode, one move per enter"
rec_mi5:            .string "reset the pegs"
rec_mi0:            .string "back to the main menu"

rec_lbl_choice:     .string "choice "
rec_lbl_value:      .string "value "
rec_lbl_on:         .string "one move per enter"
rec_lbl_off:        .string "runs straight through"

rec_ask_discs:      .string "how many discs should the tower carry?"
rec_hint_discs:     .string "1 to 6 - six discs is sixty-three moves"
rec_ask_speed:      .string "how long should one step hold, in milliseconds?"
rec_hint_speed:     .string "60 is brisk, 1000 is a crawl"

rec_press:          .string "enter advances one move"
rec_cap_idle:       .string "the pegs are at rest"
rec_cap_call:       .string "move %d discs from %c to %c using %c"
rec_cap_stat:       .string "discs %d      minimum %d moves      depth %d"

rec_fmt_num:        .string "%d"
rec_fmt_depth:      .string "depth %d"
rec_fmt_frame:      .string "h(%d,%c,%c,%c)"
rec_fmt_moves:      .string "moves %d of %d"
rec_fmt_stat:       .string "discs %d      speed %d ms      %s"

rec_msg_ready:      .string "%d discs on peg A, and only one may move at a time"
rec_msg_lift:       .string "lift disc %d off peg %c"
rec_msg_drop:       .string "drop disc %d on peg %c"
rec_msg_done:       .string "solved in %d moves, which is exactly the minimum"
rec_msg_reset:      .string "%d discs restacked on peg A, largest at the bottom"

rec_cx_best:        .string "O(2^n)"
rec_cx_avg:         .string "O(2^n)"
rec_cx_worst:       .string "O(2^n)"
rec_cx_space:       .string "O(n)"

    .text
    .balign 4

// ----------------------------------------------------------- small parts

// rec_min_moves(w0 = discs) -> w0 = 2^n - 1
rec_min_moves:
    mov     w1, 1
    lsl     w1, w1, w0
    sub     w0, w1, 1
    ret

// rec_note(x0 = caption, w1 = first value, w2 = second) - what the caption
// row says until something else happens
rec_note:
    ldr     x3, =rec_msg
    str     x0, [x3]
    ldr     x3, =rec_msg_a
    str     w1, [x3]
    ldr     x3, =rec_msg_b
    str     w2, [x3]
    ret

// rec_frame_push(w0 = n, w1 = src, w2 = dst, w3 = aux) - mirror the call
// the processor just made
rec_frame_push:
    ldr     x4, =rec_depth
    ldr     w5, [x4]
    cmp     w5, 8                           // the panel only holds so many
    b.ge    rec_frame_bump
    ldr     x6, =rec_frame_n
    strb    w0, [x6, w5, sxtw]
    ldr     x6, =rec_frame_s
    strb    w1, [x6, w5, sxtw]
    ldr     x6, =rec_frame_d
    strb    w2, [x6, w5, sxtw]
    ldr     x6, =rec_frame_x
    strb    w3, [x6, w5, sxtw]
rec_frame_bump:
    add     w5, w5, 1
    str     w5, [x4]
    ret

// rec_frame_pop() - mirror the return
rec_frame_pop:
    ldr     x0, =rec_depth
    ldr     w1, [x0]
    cmp     w1, 0
    b.le    rec_frame_pop_out
    sub     w1, w1, 1
    str     w1, [x0]
rec_frame_pop_out:
    ret

// rec_blank(w0 = row, w1 = col, w2 = cells) - wipe a run in place
rec_blank:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w2
    bl      ui_at
    ldr     x0, =rec_sp
    mov     w1, w19
    bl      ui_repeat

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rec_hold(w0 = how many halvings of the step delay) - flush, then wait
rec_hold:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0
    mov     x0, 0                           // fflush(0) drains every stream
    bl      fflush

    ldr     x0, =rec_speed
    ldr     w0, [x0]
    lsr     w0, w0, w19
    cmp     w0, 15                          // below this nothing reads
    b.ge    rec_hold_wait
    mov     w0, 15
rec_hold_wait:
    bl      delay_ms

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rec_gate() - the pause between moves: a delay, or a keypress in step
// mode. A closed stdin turns stepping off rather than spinning on a prompt
// nobody can answer.
rec_gate:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =rec_step
    ldr     w0, [x0]
    cbz     w0, rec_gate_timed

    // the message row, on the same terms as wait_for_enter: inside the
    // frame, so the prompt never eats the left wall
    mov     w0, 23
    mov     w1, 2
    mov     w2, 78
    bl      rec_blank
    mov     w0, 23
    mov     w1, 4
    mov     w2, rec_role_faint
    ldr     x3, =rec_press
    bl      ui_text
    mov     x0, 0
    bl      fflush

    bl      getchar
    cmp     w0, -1
    b.ne    rec_gate_typed
    ldr     x0, =rec_step
    str     wzr, [x0]
    b       rec_gate_clear

rec_gate_typed:
    cmp     w0, '\n'
    b.eq    rec_gate_clear
    bl      clear_input_buffer              // they typed more than a return

rec_gate_clear:
    mov     w0, 23
    mov     w1, 2
    mov     w2, 78
    bl      rec_blank
    mov     x0, 0
    bl      fflush
    b       rec_gate_out

rec_gate_timed:
    mov     w0, 0
    bl      rec_hold

rec_gate_out:
    ldp     fp, lr, [sp], 16
    ret

// -------------------------------------------------------------- drawing

// rec_draw_disc(w0 = row, w1 = centre col, w2 = size, w3 = role)
// A disc of size k fills 2k+1 cells and carries its own number, so the
// ordering stays readable even where two sizes sit close together.
rec_draw_disc:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     w19, w0
    mov     w20, w1
    mov     w21, w2
    mov     w22, w3

    mov     w0, w19
    sub     w1, w20, w21
    bl      ui_at
    mov     w0, w22
    bl      th_bg
    ldr     x0, =rec_sp
    mov     w1, w21
    bl      ui_repeat
    ldr     x0, =rec_fmt_num
    mov     w1, w21
    bl      printf
    ldr     x0, =rec_sp
    mov     w1, w21
    bl      ui_repeat
    bl      th_off

    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// rec_draw_pegs() - the three poles, what is standing on them, and the one
// disc in the air
rec_draw_pegs:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    mov     w19, rec_lane
rec_pegs_wipe:
    cmp     w19, rec_base_slot
    b.gt    rec_pegs_wiped
    mov     w0, w19
    mov     w1, 3
    mov     w2, 52
    bl      rec_blank
    add     w19, w19, 1
    b       rec_pegs_wipe

rec_pegs_wiped:
    mov     w19, 0
rec_pegs_peg:
    cmp     w19, rec_pegs
    b.ge    rec_pegs_air

    ldr     x0, =rec_peg_col
    ldrb    w20, [x0, w19, sxtw]            // centre column
    ldr     x0, =rec_high
    ldr     w21, [x0, w19, sxtw 2]          // discs standing on it

    // the pole shows through wherever no disc sits
    mov     w22, rec_top_slot
rec_pegs_pole:
    cmp     w22, rec_base_slot
    b.gt    rec_pegs_discs
    mov     w23, rec_base_slot
    sub     w23, w23, w22                   // the level this row is
    cmp     w23, w21
    b.lt    rec_pegs_pole_step
    mov     w0, w22
    mov     w1, w20
    bl      ui_at
    mov     w0, rec_role_faint
    bl      th_fg
    ldr     x0, =rec_pole
    bl      printf
    bl      th_off
rec_pegs_pole_step:
    add     w22, w22, 1
    b       rec_pegs_pole

rec_pegs_discs:
    mov     w22, 0
rec_pegs_disc:
    cmp     w22, w21
    b.ge    rec_pegs_step
    ldr     x0, =rec_peg
    lsl     w1, w19, 3
    add     w1, w1, w22
    ldrb    w23, [x0, w1, sxtw]
    cbz     w23, rec_pegs_disc_step
    mov     w0, rec_base_slot
    sub     w0, w0, w22
    mov     w1, w20
    mov     w2, w23
    mov     w3, rec_role_key
    bl      rec_draw_disc
rec_pegs_disc_step:
    add     w22, w22, 1
    b       rec_pegs_disc

rec_pegs_step:
    add     w19, w19, 1
    b       rec_pegs_peg

rec_pegs_air:
    ldr     x0, =rec_air
    ldr     w19, [x0]
    cbz     w19, rec_pegs_out
    ldr     x0, =rec_air_row
    ldr     w0, [x0]
    ldr     x1, =rec_air_col
    ldr     w1, [x1]
    mov     w2, w19
    mov     w3, rec_role_hot
    bl      rec_draw_disc

rec_pegs_out:
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// rec_draw_stack() - the frames the processor is actually holding, the
// deepest one first because that is the call currently running
rec_draw_stack:
    stp     fp, lr, [sp, -96]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]

    mov     w19, 5
rec_stack_wipe:
    cmp     w19, 15
    b.gt    rec_stack_wiped
    mov     w0, w19
    mov     w1, 58
    mov     w2, 21
    bl      rec_blank
    add     w19, w19, 1
    b       rec_stack_wipe

rec_stack_wiped:
    ldr     x0, =rec_depth
    ldr     w19, [x0]

    mov     w0, 5
    mov     w1, 59
    bl      ui_at
    mov     w0, rec_role_dim
    bl      th_fg
    ldr     x0, =rec_fmt_depth
    mov     w1, w19
    bl      printf
    bl      th_off

    mov     w20, 0
rec_stack_frame:
    cmp     w20, 7                          // seven rows is all the panel has
    b.ge    rec_stack_moves
    cmp     w20, w19
    b.ge    rec_stack_moves

    ldr     x0, =rec_frame_n
    ldrb    w21, [x0, w20, sxtw]
    ldr     x0, =rec_frame_s
    ldrb    w22, [x0, w20, sxtw]
    ldr     x0, =rec_frame_d
    ldrb    w23, [x0, w20, sxtw]
    ldr     x0, =rec_frame_x
    ldrb    w24, [x0, w20, sxtw]

    sub     w0, w19, 1
    cmp     w20, w0
    b.eq    rec_stack_running
    mov     w25, rec_role_dim
    b       rec_stack_place
rec_stack_running:
    mov     w25, rec_role_hot               // the call the processor is in

rec_stack_place:
    add     w0, w20, 6
    add     w1, w20, 59                     // one column of indent per level
    bl      ui_at
    mov     w0, w25
    bl      th_fg
    ldr     x0, =rec_fmt_frame
    mov     w1, w21
    add     w2, w22, 'A'
    add     w3, w23, 'A'
    add     w4, w24, 'A'
    bl      printf
    bl      th_off

    add     w20, w20, 1
    b       rec_stack_frame

rec_stack_moves:
    ldr     x0, =rec_discs
    ldr     w0, [x0]
    bl      rec_min_moves
    mov     w19, w0

    mov     w0, 14
    mov     w1, 59
    bl      ui_at
    mov     w0, rec_role_dim
    bl      th_fg
    ldr     x0, =rec_fmt_moves
    ldr     x1, =rec_moves
    ldr     w1, [x1]
    mov     w2, w19
    bl      printf
    bl      th_off

    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96
    ret

// rec_draw_captions() - the call in plain words, the arithmetic, and what
// the animation is doing right now
rec_draw_captions:
    stp     fp, lr, [sp, -96]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    mov     w0, 17
    mov     w1, 2
    mov     w2, 78
    bl      rec_blank
    mov     w0, 18
    mov     w1, 2
    mov     w2, 78
    bl      rec_blank
    mov     w0, 19
    mov     w1, 2
    mov     w2, 78
    bl      rec_blank

    ldr     x0, =rec_depth
    ldr     w19, [x0]
    cbz     w19, rec_caps_idle

    sub     w20, w19, 1
    cmp     w20, 7
    b.lt    rec_caps_load
    mov     w20, 7
rec_caps_load:
    ldr     x0, =rec_frame_n
    ldrb    w21, [x0, w20, sxtw]
    ldr     x0, =rec_frame_s
    ldrb    w22, [x0, w20, sxtw]
    ldr     x0, =rec_frame_d
    ldrb    w23, [x0, w20, sxtw]
    ldr     x0, =rec_frame_x
    ldrb    w24, [x0, w20, sxtw]

    mov     w0, 17
    mov     w1, 3
    bl      ui_at
    mov     w0, rec_role_accent
    bl      th_fg
    ldr     x0, =rec_cap_call
    mov     w1, w21
    add     w2, w22, 'A'
    add     w3, w23, 'A'
    add     w4, w24, 'A'
    bl      printf
    bl      th_off
    b       rec_caps_stat

rec_caps_idle:
    mov     w0, 17
    mov     w1, 3
    mov     w2, rec_role_dim
    ldr     x3, =rec_cap_idle
    bl      ui_text

rec_caps_stat:
    ldr     x0, =rec_discs
    ldr     w20, [x0]
    mov     w0, w20
    bl      rec_min_moves
    mov     w21, w0

    mov     w0, 18
    mov     w1, 3
    bl      ui_at
    mov     w0, rec_role_dim
    bl      th_fg
    ldr     x0, =rec_cap_stat
    mov     w1, w20
    mov     w2, w21
    mov     w3, w19
    bl      printf
    bl      th_off

    ldr     x19, =rec_msg
    ldr     x19, [x19]
    cbz     x19, rec_caps_out

    mov     w0, 19
    mov     w1, 3
    bl      ui_at
    mov     w0, rec_role_text
    bl      th_fg
    mov     x0, x19
    ldr     x1, =rec_msg_a
    ldr     w1, [x1]
    ldr     x2, =rec_msg_b
    ldr     w2, [x2]
    bl      printf
    bl      th_off

rec_caps_out:
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96
    ret

// rec_paint() - one animation frame
rec_paint:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      rec_draw_pegs
    bl      rec_draw_stack
    bl      rec_draw_captions
    mov     x0, 0
    bl      fflush

    ldp     fp, lr, [sp], 16
    ret

// rec_shell() - the parts that never move, drawn once so an animation step
// only has to repaint what changed
rec_shell:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x0, =rec_title
    bl      ui_screen
    ldr     x0, =rec_foot_run
    bl      ui_footer

    mov     w0, 4
    mov     w1, 2
    mov     w2, 54
    mov     w3, 13
    ldr     x4, =rec_panel_pegs
    bl      ui_panel

    mov     w0, 4
    mov     w1, 57
    mov     w2, 23
    mov     w3, 13
    ldr     x4, =rec_panel_stack
    bl      ui_panel

    mov     w19, 0
rec_shell_peg:
    cmp     w19, rec_pegs
    b.ge    rec_shell_card

    ldr     x0, =rec_peg_col
    ldrb    w20, [x0, w19, sxtw]

    mov     w0, rec_base_row
    sub     w1, w20, 7
    bl      ui_at
    mov     w0, rec_role_faint
    bl      th_fg
    ldr     x0, =rec_base
    mov     w1, 15
    bl      ui_repeat
    bl      th_off

    mov     w0, rec_label_row
    mov     w1, w20
    mov     w2, rec_role_dim
    ldr     x3, =rec_peg_lbl
    sxtw    x19, w19
    add     x3, x3, x19, lsl 1
    bl      ui_text

    add     w19, w19, 1
    b       rec_shell_peg

rec_shell_card:
    mov     w0, 20
    mov     w1, 3
    ldr     x2, =rec_cx_best
    ldr     x3, =rec_cx_avg
    ldr     x4, =rec_cx_worst
    ldr     x5, =rec_cx_space
    bl      ui_complexity

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// ---------------------------------------------------------------- pegs

// rec_reset_pegs() - rebuild the tower on peg A, widest disc at the bottom
rec_reset_pegs:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x19, =rec_peg
    mov     w20, 0
rec_reset_wipe:
    cmp     w20, 24
    b.ge    rec_reset_heights
    strb    wzr, [x19, w20, sxtw]
    add     w20, w20, 1
    b       rec_reset_wipe

rec_reset_heights:
    ldr     x0, =rec_high
    str     wzr, [x0]
    str     wzr, [x0, 4]
    str     wzr, [x0, 8]

    ldr     x0, =rec_discs
    ldr     w19, [x0]
    cmp     w19, rec_max
    b.le    rec_reset_stack
    mov     w19, rec_max                    // never taller than the panel

rec_reset_stack:
    mov     w20, 0
rec_reset_disc:
    cmp     w20, w19
    b.ge    rec_reset_done
    ldr     x0, =rec_peg
    sub     w1, w19, w20                    // n at the bottom, 1 at the top
    strb    w1, [x0, w20, sxtw]
    add     w20, w20, 1
    b       rec_reset_disc

rec_reset_done:
    ldr     x0, =rec_high
    str     w19, [x0]
    ldr     x0, =rec_air
    str     wzr, [x0]
    ldr     x0, =rec_moves
    str     wzr, [x0]
    ldr     x0, =rec_depth
    str     wzr, [x0]
    ldr     x0, =rec_msg
    str     xzr, [x0]
    ldr     x0, =rec_ready
    mov     w1, 1
    str     w1, [x0]

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rec_move(w0 = src peg, w1 = dst peg) - lift, slide, drop, and count
rec_move:
    stp     fp, lr, [sp, -96]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]

    mov     w19, w0
    mov     w20, w1

    ldr     x0, =rec_high
    ldr     w21, [x0, w19, sxtw 2]
    cbz     w21, rec_move_out               // an empty peg has nothing to give
    sub     w21, w21, 1
    str     w21, [x0, w19, sxtw 2]

    ldr     x0, =rec_peg
    lsl     w1, w19, 3
    add     w1, w1, w21
    ldrb    w22, [x0, w1, sxtw]             // the disc now in hand
    strb    wzr, [x0, w1, sxtw]
    cbz     w22, rec_move_out

    ldr     x0, =rec_peg_col
    ldrb    w23, [x0, w19, sxtw]            // column it leaves from
    ldrb    w24, [x0, w20, sxtw]            // column it lands on

    ldr     x0, =rec_air
    str     w22, [x0]
    ldr     x0, =rec_air_col
    str     w23, [x0]
    ldr     x0, =rec_air_row
    mov     w1, rec_lane
    str     w1, [x0]

    ldr     x0, =rec_msg_lift
    mov     w1, w22
    add     w2, w19, 'A'
    bl      rec_note
    bl      rec_paint
    mov     w0, 1
    bl      rec_hold

    // four even steps across, so the last one lands square on the peg
    mov     w25, 1
rec_move_slide:
    cmp     w25, 4
    b.gt    rec_move_land
    sub     w0, w24, w23
    mul     w0, w0, w25
    mov     w1, 4
    sdiv    w0, w0, w1
    add     w0, w23, w0
    ldr     x1, =rec_air_col
    str     w0, [x1]
    bl      rec_paint
    mov     w0, 2
    bl      rec_hold
    add     w25, w25, 1
    b       rec_move_slide

rec_move_land:
    ldr     x0, =rec_high
    ldr     w21, [x0, w20, sxtw 2]
    cmp     w21, 8                          // a peg column holds eight slots
    b.ge    rec_move_counted
    ldr     x1, =rec_peg
    lsl     w2, w20, 3
    add     w2, w2, w21
    strb    w22, [x1, w2, sxtw]
    add     w21, w21, 1
    str     w21, [x0, w20, sxtw 2]

rec_move_counted:
    ldr     x0, =rec_air
    str     wzr, [x0]

    ldr     x0, =rec_moves
    ldr     w1, [x0]
    add     w1, w1, 1
    str     w1, [x0]

    ldr     x0, =rec_msg_drop
    mov     w1, w22
    add     w2, w20, 'A'
    bl      rec_note
    bl      rec_paint
    bl      rec_gate

rec_move_out:
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96
    ret

// rec_hanoi(w0 = n, w1 = src, w2 = dst, w3 = aux)
// The whole solver. Shift the n-1 discs above the biggest one out of the
// way, move the biggest, then bring the pile back on top of it. The frame
// the panel draws is pushed and popped in step with this one.
rec_hanoi:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     w19, w0
    mov     w20, w1
    mov     w21, w2
    mov     w22, w3

    cmp     w19, 0
    b.le    rec_hanoi_out                   // no discs, nothing to do

    mov     w0, w19
    mov     w1, w20
    mov     w2, w21
    mov     w3, w22
    bl      rec_frame_push
    bl      rec_paint
    mov     w0, 1
    bl      rec_hold

    sub     w0, w19, 1
    mov     w1, w20
    mov     w2, w22
    mov     w3, w21
    bl      rec_hanoi

    mov     w0, w20
    mov     w1, w21
    bl      rec_move

    sub     w0, w19, 1
    mov     w1, w22
    mov     w2, w21
    mov     w3, w20
    bl      rec_hanoi

    bl      rec_frame_pop
    bl      rec_paint
    mov     w0, 1
    bl      rec_hold

rec_hanoi_out:
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// rec_solve() - one full run, from a clean tower to the finished count
rec_solve:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      rec_reset_pegs
    bl      rec_shell

    // the menu read left a newline behind; take it now so step mode does
    // not spend the first keypress on it
    bl      clear_input_buffer

    ldr     x0, =rec_msg_ready
    ldr     x1, =rec_discs
    ldr     w1, [x1]
    mov     w2, 0
    bl      rec_note
    bl      rec_paint
    mov     w0, 0
    bl      rec_hold

    ldr     x0, =rec_discs
    ldr     w19, [x0]
    mov     w0, w19
    mov     w1, 0                           // from peg A
    mov     w2, 2                           // to peg C
    mov     w3, 1                           // using peg B
    bl      rec_hanoi

    ldr     x0, =rec_msg_done
    ldr     x1, =rec_moves
    ldr     w1, [x1]
    mov     w2, 0
    bl      rec_note
    bl      rec_paint
    bl      wait_for_enter

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// --------------------------------------------------------------- prompts

// rec_prompt(x0 = question, x1 = hint, w2 = min, w3 = max) -> w0 = value
rec_prompt:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     x19, x0
    mov     x20, x1
    mov     w21, w2
    mov     w22, w3

    ldr     x0, =rec_title
    bl      ui_screen
    ldr     x0, =rec_foot_pick
    bl      ui_footer

    mov     w0, 7
    mov     w1, 14
    mov     w2, 52
    mov     w3, 9
    ldr     x4, =rec_panel_set
    bl      ui_panel

    mov     w0, 9
    mov     w1, 17
    mov     w2, rec_role_text
    mov     x3, x19
    bl      ui_text

    mov     w0, 11
    mov     w1, 17
    mov     w2, rec_role_dim
    mov     x3, x20
    bl      ui_text

    bl      ansi_show_cursor
    mov     w0, 13
    mov     w1, 17
    mov     w2, rec_role_text
    ldr     x3, =rec_lbl_value
    bl      ui_text
    mov     w0, 13
    mov     w1, 23
    bl      ui_at

    mov     w0, w21
    mov     w1, w22
    bl      read_int_range
    mov     w19, w0
    bl      ansi_hide_cursor

    mov     w0, w19
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// ----------------------------------------------------------------- menu

// rec_menu_draw() - the operations screen, with the current settings under it
rec_menu_draw:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    ldr     x0, =rec_title
    bl      ui_screen
    ldr     x0, =rec_foot_menu
    bl      ui_footer

    mov     w0, 6
    mov     w1, 16
    mov     w2, 48
    mov     w3, 12
    ldr     x4, =rec_panel_menu
    bl      ui_panel

    ldr     x21, =rec_menu_items
    mov     w19, 0
rec_menu_item:
    cmp     w19, 6
    b.ge    rec_menu_stat

    add     w20, w19, 8                     // options begin on row 8
    mov     w0, w20
    mov     w1, 19
    mov     w2, rec_role_key
    ldr     x3, =rec_digits
    sxtw    x19, w19
    add     x3, x3, x19, lsl 1
    bl      ui_badge

    mov     w0, w20
    mov     w1, 23
    mov     w2, rec_role_text
    ldr     x3, [x21, w19, sxtw 3]
    bl      ui_text

    add     w19, w19, 1
    b       rec_menu_item

rec_menu_stat:
    ldr     x0, =rec_step
    ldr     w0, [x0]
    cbz     w0, rec_menu_stat_off
    ldr     x22, =rec_lbl_on
    b       rec_menu_stat_row
rec_menu_stat_off:
    ldr     x22, =rec_lbl_off

rec_menu_stat_row:
    mov     w0, 19
    mov     w1, 14
    bl      ui_at
    mov     w0, rec_role_dim
    bl      th_fg
    ldr     x0, =rec_fmt_stat
    ldr     x1, =rec_discs
    ldr     w1, [x1]
    ldr     x2, =rec_speed
    ldr     w2, [x2]
    mov     x3, x22
    bl      printf
    bl      th_off

    bl      ansi_show_cursor
    mov     w0, 15
    mov     w1, 19
    mov     w2, rec_role_text
    ldr     x3, =rec_lbl_choice
    bl      ui_text
    mov     w0, 15
    mov     w1, 26
    bl      ui_at

    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// rec_menu() - the module loop; choice 0 hands control back to main
    .global rec_menu
rec_menu:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    // the first visit builds the tower the drawing expects
    ldr     x0, =rec_ready
    ldr     w0, [x0]
    cbnz    w0, rec_menu_loop
    bl      rec_reset_pegs

rec_menu_loop:
    bl      rec_menu_draw

    mov     w0, 0
    mov     w1, 5
    bl      read_int_range
    mov     w19, w0                         // printf hands back a count, so
    bl      ansi_hide_cursor                // the choice has to be parked here

    cmp     w19, 0
    b.eq    rec_menu_exit
    cmp     w19, 1
    b.eq    rec_menu_solve
    cmp     w19, 2
    b.eq    rec_menu_discs
    cmp     w19, 3
    b.eq    rec_menu_speed
    cmp     w19, 4
    b.eq    rec_menu_toggle
    cmp     w19, 5
    b.eq    rec_menu_reset
    b       rec_menu_loop

rec_menu_solve:
    bl      rec_solve
    b       rec_menu_loop

rec_menu_discs:
    ldr     x0, =rec_ask_discs
    ldr     x1, =rec_hint_discs
    mov     w2, 1
    mov     w3, rec_max
    bl      rec_prompt
    ldr     x1, =rec_discs
    str     w0, [x1]
    bl      rec_reset_pegs
    b       rec_menu_show

rec_menu_speed:
    ldr     x0, =rec_ask_speed
    ldr     x1, =rec_hint_speed
    mov     w2, 60
    mov     w3, 1000
    bl      rec_prompt
    ldr     x1, =rec_speed
    str     w0, [x1]
    b       rec_menu_loop

rec_menu_toggle:
    ldr     x0, =rec_step
    ldr     w1, [x0]
    eor     w1, w1, 1
    str     w1, [x0]
    b       rec_menu_loop

rec_menu_reset:
    bl      rec_reset_pegs

rec_menu_show:
    bl      rec_shell
    ldr     x0, =rec_msg_reset
    ldr     x1, =rec_discs
    ldr     w1, [x1]
    mov     w2, 0
    bl      rec_note
    bl      rec_paint
    bl      wait_for_enter
    b       rec_menu_loop

rec_menu_exit:
    bl      ansi_hide_cursor
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

    .data
    .balign 8
rec_menu_items:
    .dword rec_mi1, rec_mi2, rec_mi3
    .dword rec_mi4, rec_mi5, rec_mi0

    .text
