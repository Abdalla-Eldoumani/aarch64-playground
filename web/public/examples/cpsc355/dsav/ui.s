// ui.asm - the screen kernel every module draws through
//
// One frame, one title bar, one footer, one way to draw a panel. A
// module says what it wants ("a panel called Heap here", "this run is
// O(n log n)") and never positions a border itself, so the whole program
// changes shape from this file alone.
//
// The canvas is a fixed 80x24: the frame is rows 1 and 24, the title bar
// row 2, rules on rows 3 and 21, the footer row 22, and the message row
// 23 that utils.asm writes input complaints into. Modules own rows 4-20.

define(fp, x29)
define(lr, x30)

    UI_ROLE_TEXT   = 0
    UI_ROLE_DIM    = 1
    UI_ROLE_FAINT  = 2
    UI_ROLE_ACCENT = 3
    UI_ROLE_KEY    = 4
    UI_ROLE_OK     = 5
    UI_ROLE_WARN   = 6
    UI_ROLE_HOT    = 7
    UI_ROLE_BAD    = 8
    UI_ROLE_NODE   = 9

    UI_WIDTH       = 80
    UI_BODY_TOP    = 4
    UI_BODY_BOTTOM = 20

    .data
    .balign 8

// Rounded corners read softer than the square set the first version
// used, and the light weight keeps the data the loudest thing on screen.
ui_tl:              .string "\xe2\x95\xad"   // rounded top-left
ui_tr:              .string "\xe2\x95\xae"   // rounded top-right
ui_bl:              .string "\xe2\x95\xb0"   // rounded bottom-left
ui_br:              .string "\xe2\x95\xaf"   // rounded bottom-right
ui_h:               .string "\xe2\x94\x80"   // horizontal
ui_v:               .string "\xe2\x94\x82"   // vertical
ui_t_right:         .string "\xe2\x94\x9c"   // left tee
ui_t_left:          .string "\xe2\x94\xa4"   // right tee
ui_dot:             .string "\xc2\xb7"       // separator dot

ui_app_mark:        .string "DSAV"
ui_app_sub:         .string "data structures & algorithms in ARMv8 assembly"
ui_space:           .string " "
ui_nl:              .string "\n"

ui_fmt_at:          .string "\x1b[%d;%dH"
ui_fmt_str:         .string "%s"

// Complexity card labels: the reason a reader trusts what they just
// watched. Every algorithm screen carries one.
ui_lbl_best:        .string "best"
ui_lbl_avg:         .string "avg"
ui_lbl_worst:       .string "worst"
ui_lbl_space:       .string "space"
ui_lbl_complexity:  .string "complexity"

    .text
    .balign 4

// ui_at(w0 = row, w1 = col) - park the cursor
    .global ui_at
ui_at:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp

    mov     w2, w1
    mov     w1, w0
    ldr     x0, =ui_fmt_at
    bl      printf

    ldp     fp, lr, [sp], 32
    ret

// ui_repeat(x0 = glyph, w1 = count) - draw one glyph n times
    .global ui_repeat
ui_repeat:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0
    mov     w20, w1

ui_repeat_loop:
    cmp     w20, 0
    b.le    ui_repeat_done
    mov     x0, x19
    bl      printf
    sub     w20, w20, 1
    b       ui_repeat_loop

ui_repeat_done:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// ui_cols(x0 = string) -> w0 = how many columns the string occupies
// strlen counts bytes, and every box glyph in this file is three of them.
// Borders are drawn in columns, so anything measured against a border has
// to be counted the same way: one column per byte that is not a UTF-8
// continuation byte.
    .global ui_cols
ui_cols:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     x1, x0
    mov     w0, 0

ui_cols_loop:
    ldrb    w2, [x1], 1
    cbz     w2, ui_cols_done
    and     w3, w2, 0xC0
    cmp     w3, 0x80
    b.eq    ui_cols_loop                    // trailing byte of the same glyph
    add     w0, w0, 1
    b       ui_cols_loop

ui_cols_done:
    ldp     fp, lr, [sp], 16
    ret

// ui_num(x0 = dest, w1 = value, w2 = minimum width) -> w0 = characters
// written, not counting the terminator.
// The hosted runtime gives us printf but no sprintf, so a value that has to
// end up in a buffer rather than on the screen -- a badge label, a growing
// order strip -- is converted here. Right-aligned, padded with spaces to
// the width, and always terminated.
    .global ui_num
ui_num:
    stp     fp, lr, [sp, -96]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    str     x25, [sp, 80]

    mov     x19, x0                         // where the text goes
    mov     w20, w1                         // the value
    mov     w21, w2                         // minimum width

    mov     w24, 0                          // sign, 1 when negative
    cmp     w20, 0
    b.ge    ui_num_digits
    mov     w24, 1
    neg     w20, w20

ui_num_digits:
    add     x23, sp, 64                     // scratch, least significant first
    mov     w22, 0
    mov     w2, 10

ui_num_split:
    udiv    w3, w20, w2
    msub    w4, w3, w2, w20                 // value % 10
    add     w4, w4, '0'
    strb    w4, [x23, w22, sxtw]
    add     w22, w22, 1
    mov     w20, w3
    cbnz    w20, ui_num_split

    add     w25, w22, w24                   // what the number itself needs
    cmp     w25, w21
    csel    w25, w25, w21, gt               // the wider of number and width

    sub     w1, w21, w22
    sub     w1, w1, w24                     // spaces to lay down first
    cmp     w1, 0
    b.le    ui_num_sign

ui_num_pad:
    mov     w2, ' '
    strb    w2, [x19], 1
    subs    w1, w1, 1
    b.gt    ui_num_pad

ui_num_sign:
    cbz     w24, ui_num_emit
    mov     w2, '-'
    strb    w2, [x19], 1

ui_num_emit:
    sub     w22, w22, 1
    ldrb    w2, [x23, w22, sxtw]
    strb    w2, [x19], 1
    cbnz    w22, ui_num_emit

    strb    wzr, [x19]
    mov     w0, w25

    ldr     x25, [sp, 80]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96
    ret

// ui_rule(w0 = row) - a full-width rule joined into the frame
    .global ui_rule
ui_rule:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w1, 1
    bl      ui_at
    mov     w0, UI_ROLE_FAINT
    bl      th_fg
    ldr     x0, =ui_t_right
    bl      printf
    ldr     x0, =ui_h
    mov     w1, UI_WIDTH - 2
    bl      ui_repeat
    ldr     x0, =ui_t_left
    bl      printf
    bl      th_off

    ldp     fp, lr, [sp], 16
    ret

// ui_screen(x0 = screen title) - clear, draw the frame, and set the
// title bar. Every screen starts here.
    .global ui_screen
ui_screen:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0

    bl      ansi_clear_screen
    bl      ansi_hide_cursor

    // top and bottom of the frame
    mov     w0, 1
    mov     w1, 1
    bl      ui_at
    mov     w0, UI_ROLE_FAINT
    bl      th_fg
    ldr     x0, =ui_tl
    bl      printf
    ldr     x0, =ui_h
    mov     w1, UI_WIDTH - 2
    bl      ui_repeat
    ldr     x0, =ui_tr
    bl      printf

    mov     w0, 24
    mov     w1, 1
    bl      ui_at
    ldr     x0, =ui_bl
    bl      printf
    ldr     x0, =ui_h
    mov     w1, UI_WIDTH - 2
    bl      ui_repeat
    ldr     x0, =ui_br
    bl      printf
    bl      th_off

    // the sides, row by row
    mov     w2, 2
ui_screen_sides:
    cmp     w2, 24
    b.ge    ui_screen_bars
    mov     w0, w2
    mov     w1, 1
    stp     x2, x3, [sp, -16]!
    bl      ui_at
    mov     w0, UI_ROLE_FAINT
    bl      th_fg
    ldr     x0, =ui_v
    bl      printf
    ldp     x2, x3, [sp], 16
    mov     w0, w2
    mov     w1, UI_WIDTH
    stp     x2, x3, [sp, -16]!
    bl      ui_at
    ldr     x0, =ui_v
    bl      printf
    bl      th_off
    ldp     x2, x3, [sp], 16
    add     w2, w2, 1
    b       ui_screen_sides

ui_screen_bars:
    // title bar: the app mark, then this screen's name
    mov     w0, 2
    mov     w1, 4
    bl      ui_at
    mov     w0, UI_ROLE_ACCENT
    bl      th_fg
    bl      th_bold_on
    ldr     x0, =ui_app_mark
    bl      printf
    bl      th_off

    mov     w0, UI_ROLE_FAINT
    bl      th_fg
    ldr     x0, =ui_space
    bl      printf
    ldr     x0, =ui_dot
    bl      printf
    ldr     x0, =ui_space
    bl      printf
    bl      th_off

    mov     w0, UI_ROLE_TEXT
    bl      th_fg
    mov     x0, x19
    bl      printf
    bl      th_off

    mov     w0, 3
    bl      ui_rule

    mov     w0, 21
    bl      ui_rule

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// ui_tagline() - what the program is, set right on the title bar. Only
// the home screen wears it; every other screen keeps the bar for its own
// name.
    .global ui_tagline
ui_tagline:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =ui_app_sub
    bl      ui_cols
    mov     w19, UI_WIDTH - 3
    sub     w19, w19, w0                    // right edge, inside the frame

    mov     w0, 2
    mov     w1, w19
    mov     w2, UI_ROLE_FAINT
    ldr     x3, =ui_app_sub
    bl      ui_text

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// ui_footer(x0 = hint text) - the standing hint on row 22
    .global ui_footer
ui_footer:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0

    mov     w0, 22
    mov     w1, 2
    bl      ui_at
    ldr     x0, =ui_space
    mov     w1, UI_WIDTH - 2
    bl      ui_repeat

    mov     w0, 22
    mov     w1, 4
    bl      ui_at
    mov     w0, UI_ROLE_FAINT
    bl      th_fg
    mov     x0, x19
    bl      printf
    bl      th_off

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// ui_panel(w0 = row, w1 = col, w2 = width, w3 = height, x4 = title)
// A titled sub-box. The title sits in the top border, so a panel costs
// no extra row.
    .global ui_panel
ui_panel:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    mov     w19, w0                         // row
    mov     w20, w1                         // col
    mov     w21, w2                         // width
    mov     w22, w3                         // height
    mov     x23, x4                         // title

    mov     w0, w19
    mov     w1, w20
    bl      ui_at
    mov     w0, UI_ROLE_FAINT
    bl      th_fg
    ldr     x0, =ui_tl
    bl      printf
    ldr     x0, =ui_h
    mov     w1, 2
    bl      ui_repeat

    // the title rides in the border, spaced off the corner
    cbz     x23, ui_panel_plain_top
    ldr     x0, =ui_space
    bl      printf
    bl      th_off
    mov     w0, UI_ROLE_DIM
    bl      th_fg
    mov     x0, x23
    bl      printf
    bl      th_off
    mov     w0, UI_ROLE_FAINT
    bl      th_fg
    ldr     x0, =ui_space
    bl      printf

    // fill what the title left
    mov     x0, x23
    bl      ui_cols
    add     w24, w0, 5                      // corner + 2 rule + 2 spaces
    sub     w24, w21, w24
    sub     w24, w24, 1
    ldr     x0, =ui_h
    mov     w1, w24
    bl      ui_repeat
    b       ui_panel_close_top

ui_panel_plain_top:
    sub     w24, w21, 4
    ldr     x0, =ui_h
    mov     w1, w24
    bl      ui_repeat

ui_panel_close_top:
    ldr     x0, =ui_tr
    bl      printf
    bl      th_off

    // sides
    mov     w24, 1
ui_panel_sides:
    sub     w0, w22, 1
    cmp     w24, w0
    b.ge    ui_panel_bottom
    add     w0, w19, w24
    mov     w1, w20
    bl      ui_at
    mov     w0, UI_ROLE_FAINT
    bl      th_fg
    ldr     x0, =ui_v
    bl      printf
    bl      th_off
    add     w0, w19, w24
    add     w1, w20, w21
    sub     w1, w1, 1
    bl      ui_at
    mov     w0, UI_ROLE_FAINT
    bl      th_fg
    ldr     x0, =ui_v
    bl      printf
    bl      th_off
    add     w24, w24, 1
    b       ui_panel_sides

ui_panel_bottom:
    add     w0, w19, w22
    sub     w0, w0, 1
    mov     w1, w20
    bl      ui_at
    mov     w0, UI_ROLE_FAINT
    bl      th_fg
    ldr     x0, =ui_bl
    bl      printf
    ldr     x0, =ui_h
    sub     w1, w21, 2
    bl      ui_repeat
    ldr     x0, =ui_br
    bl      printf
    bl      th_off

    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// ui_badge(w0 = row, w1 = col, w2 = role, x3 = text)
// A filled chip. Menu numbers and state markers use these.
    .global ui_badge
ui_badge:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     w19, w2
    mov     x20, x3

    bl      ui_at
    mov     w0, w19
    bl      th_bg
    ldr     x0, =ui_space
    bl      printf
    mov     x0, x20
    bl      printf
    ldr     x0, =ui_space
    bl      printf
    bl      th_off

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// ui_text(w0 = row, w1 = col, w2 = role, x3 = text)
    .global ui_text
ui_text:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     w19, w2
    mov     x20, x3

    bl      ui_at
    mov     w0, w19
    bl      th_fg
    mov     x0, x20
    bl      printf
    bl      th_off

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// ui_complexity(w0 = row, w1 = col, x2 = best, x3 = avg, x4 = worst,
//               x5 = space)
// The card that turns a pretty animation into a lesson: what the run
// the student just watched costs, in the three cases and in memory.
    .global ui_complexity
ui_complexity:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    str     x25, [sp, 64]

    mov     w19, w0                         // row
    mov     w20, w1                         // col
    mov     x21, x2
    mov     x22, x3
    mov     x23, x4
    mov     x24, x5

    // one line, four labelled slots
    mov     w0, w19
    mov     w1, w20
    mov     w2, UI_ROLE_DIM
    ldr     x3, =ui_lbl_best
    bl      ui_text
    add     w1, w20, 6
    mov     w0, w19
    mov     w2, UI_ROLE_OK
    mov     x3, x21
    bl      ui_text

    add     w25, w20, 20
    mov     w0, w19
    mov     w1, w25
    mov     w2, UI_ROLE_DIM
    ldr     x3, =ui_lbl_avg
    bl      ui_text
    add     w1, w25, 5
    mov     w0, w19
    mov     w2, UI_ROLE_WARN
    mov     x3, x22
    bl      ui_text

    add     w25, w20, 38
    mov     w0, w19
    mov     w1, w25
    mov     w2, UI_ROLE_DIM
    ldr     x3, =ui_lbl_worst
    bl      ui_text
    add     w1, w25, 7
    mov     w0, w19
    mov     w2, UI_ROLE_BAD
    mov     x3, x23
    bl      ui_text

    add     w25, w20, 58
    mov     w0, w19
    mov     w1, w25
    mov     w2, UI_ROLE_DIM
    ldr     x3, =ui_lbl_space
    bl      ui_text
    add     w1, w25, 7
    mov     w0, w19
    mov     w2, UI_ROLE_KEY
    mov     x3, x24
    bl      ui_text

    ldr     x25, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// ui_clear_body() - blank rows 4..20 without touching the frame
    .global ui_clear_body
ui_clear_body:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, UI_BODY_TOP
ui_clear_body_loop:
    cmp     w19, UI_BODY_BOTTOM
    b.gt    ui_clear_body_done
    mov     w0, w19
    mov     w1, 2
    bl      ui_at
    ldr     x0, =ui_space
    mov     w1, UI_WIDTH - 2
    bl      ui_repeat
    add     w19, w19, 1
    b       ui_clear_body_loop

ui_clear_body_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// ui_prompt(w0 = row, w1 = col, x2 = label) - a label plus the input
// caret, positioned so utils.asm's reader picks up from here. The cursor
// comes back for this one moment: every other screen hides it, and a
// student typing wants to see where the characters land.
    .global ui_prompt
ui_prompt:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x2

    bl      ui_at
    mov     w0, UI_ROLE_TEXT
    bl      th_fg
    mov     x0, x19
    bl      printf
    bl      th_off
    mov     w0, UI_ROLE_KEY
    bl      th_fg
    bl      ansi_show_cursor

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret
