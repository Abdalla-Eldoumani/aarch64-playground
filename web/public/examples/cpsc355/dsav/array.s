// array_viz.asm - ten cells in a row, and what an index actually costs
//
// The strip is the whole structure: ten words of memory, repainted from
// those same ten words every frame. Nothing links and nothing shifts,
// which is the lesson - reaching cell i is one multiply and one load
// whether i is 0 or 9, and writing a cell leaves its neighbours alone.

define(fp, x29)
define(lr, x30)

    array_capacity = 10

// Role numbers mirror the UI_ROLE_* set in ui.asm. They are repeated so
// this file also assembles on its own, the way the web build feeds it.
    ARRAY_ROLE_TEXT  = 0
    ARRAY_ROLE_DIM   = 1
    ARRAY_ROLE_FAINT = 2
    ARRAY_ROLE_KEY   = 4
    ARRAY_ROLE_OK    = 5
    ARRAY_ROLE_WARN  = 6
    ARRAY_ROLE_HOT   = 7
    ARRAY_ROLE_NODE  = 9

// Cell 0 starts here and every cell after it is one step further right,
// so a column is one multiply from an index: the same arithmetic the
// machine does to reach the value.
    ARRAY_CELL_COL   = 10
    ARRAY_CELL_STEP  = 7

    ARRAY_ROW_INDEX  = 6
    ARRAY_ROW_VALUE  = 8
    ARRAY_ROW_LEGEND = 10
    ARRAY_ROW_COUNT  = 11
    ARRAY_ROW_NOTE   = 18
    ARRAY_ROW_SAY    = 19

    .data
    .balign 8

array_data:         .skip array_capacity * 4
    .balign 4
array_count:        .word 0

// The cells wearing something other than their resting colour this
// frame. array_render fills these in and array_role_of reads them back,
// so a cell colour is data rather than a branch at every draw site.
array_hl_slot:      .word -1, -1
array_hl_role:      .word 0, 0

array_sp:           .string " "
array_fmt_cell:     .string "%5d"
array_cell_empty:   .string "    \xc2\xb7"

array_scr_menu:     .string "array  \xc2\xb7  ten indexed cells"
array_scr_fill:     .string "array  \xc2\xb7  fill with random values"
array_scr_type:     .string "array  \xc2\xb7  type the values in"
array_scr_show:     .string "array  \xc2\xb7  the array right now"
array_scr_set:      .string "array  \xc2\xb7  write one cell"
array_scr_get:      .string "array  \xc2\xb7  read one cell"
array_scr_swap:     .string "array  \xc2\xb7  swap two cells"
array_scr_clear:    .string "array  \xc2\xb7  clear"

array_pan_ops:      .string "operations"
array_pan_cells:    .string "cells"
array_pan_cost:     .string "why an index is cheap"

array_hint_menu:    .string "pick an operation  \xc2\xb7  0 goes back to the main menu"
array_hint_run:     .string "enter returns to the array menu  \xc2\xb7  the number above a cell is its index"

array_opt_1:        .string "fill the array with random values"
array_opt_2:        .string "type the values in yourself"
array_opt_3:        .string "show the array as it stands"
array_opt_4:        .string "write a value into one cell"
array_opt_5:        .string "read the value in one cell"
array_opt_6:        .string "swap two cells"
array_opt_7:        .string "clear the array"
array_opt_0:        .string "back to the main menu"

array_key_1:        .string "1"
array_key_2:        .string "2"
array_key_3:        .string "3"
array_key_4:        .string "4"
array_key_5:        .string "5"
array_key_6:        .string "6"
array_key_7:        .string "7"
array_key_0:        .string "0"

array_ask_choice:   .string "choice "
array_ask_count:    .string "how many cells, 1 to %d  "
array_ask_value:    .string "value for cell %d  "
array_ask_new:      .string "new value for cell %d  "
array_ask_index:    .string "which cell, 0 to %d  "
array_ask_first:    .string "first cell, 0 to %d  "
array_ask_second:   .string "second cell, 0 to %d  "

array_note_count:   .string "the array has %d cells, so a count runs from 1 to %d"
array_note_index:   .string "only cells 0 to %d hold anything right now"
array_note_value:   .string "values run from -99 to 999, so every cell stays five columns wide"

array_lbl_index:    .string "index"
array_lbl_value:    .string "value"
array_lbl_rest:     .string "cells:"
array_lbl_atrest:   .string "at rest"
array_lbl_hand:     .string "in hand"
array_lbl_read:     .string "reading"
array_lbl_written:  .string "written"
array_lbl_unused:   .string "\xc2\xb7 unused"
array_fmt_used:     .string "%d of %d cells in use"

array_lbl_cost1:    .string "cell i sits at base + i * 4, so one multiply reaches any of the ten"
array_lbl_cost2:    .string "writing one cell leaves the others alone: nothing shifts or is copied"

array_o1:           .string "O(1)"
array_on:           .string "O(n)"

array_msg_empty:    .string "the array is empty. fill it with random values, or type your own in"
array_msg_small:    .string "a swap needs two cells, and there are fewer than two here"
array_msg_cleared:  .string "cleared. the count is zero, so nothing below it is drawn"
array_msg_stopped:  .string "input ended, so the array was left exactly as it was"

array_fmt_place:    .string "cell %d takes %d"
array_fmt_filled:   .string "%d filled  \xc2\xb7  each one landed in the same constant time"
array_fmt_typed:    .string "%d typed in  \xc2\xb7  the count stops where the typing stopped"
array_fmt_state:    .string "%d in use  \xc2\xb7  the other slots are there, just not counted"
array_fmt_read:     .string "cell %d holds %d, reached with one multiply and one load"
array_fmt_aim:      .string "cell %d is the target: the write reaches that slot and no other"
array_fmt_wrote:    .string "cell %d now holds %d  \xc2\xb7  no other cell was touched"
array_fmt_pick1:    .string "cell %d holds %d, which a register keeps while the swap runs"
array_fmt_pick2:    .string "cell %d holds %d, and the two are about to trade places"
array_fmt_swapped:  .string "cells %d and %d traded values: two loads and two stores"

    .text
    .balign 4

// array_menu() - operations menu; choice 0 hands control back to main
    .global array_menu
array_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

array_menu_loop:
    bl      display_array_menu

    mov     w0, 0
    mov     w1, 7
    bl      read_int_range

    cmp     w0, 0
    b.eq    array_menu_exit
    cmp     w0, 1
    b.eq    array_menu_fill
    cmp     w0, 2
    b.eq    array_menu_type
    cmp     w0, 3
    b.eq    array_menu_show
    cmp     w0, 4
    b.eq    array_menu_set
    cmp     w0, 5
    b.eq    array_menu_get
    cmp     w0, 6
    b.eq    array_menu_swap
    cmp     w0, 7
    b.eq    array_menu_clear
    b       array_menu_loop

array_menu_fill:
    bl      array_init_random
    bl      wait_for_enter
    b       array_menu_loop

array_menu_type:
    bl      array_init_user
    bl      wait_for_enter
    b       array_menu_loop

array_menu_show:
    bl      array_display
    bl      wait_for_enter
    b       array_menu_loop

array_menu_set:
    bl      array_set_interactive
    bl      wait_for_enter
    b       array_menu_loop

array_menu_get:
    bl      array_get_interactive
    bl      wait_for_enter
    b       array_menu_loop

array_menu_swap:
    bl      array_swap_interactive
    bl      wait_for_enter
    b       array_menu_loop

array_menu_clear:
    bl      array_clear_interactive
    bl      wait_for_enter
    b       array_menu_loop

array_menu_exit:
    ldp     fp, lr, [sp], 16
    ret

// display_array_menu() - the operations screen
    .global display_array_menu
display_array_menu:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =array_scr_menu
    bl      ui_screen

    ldr     x0, =array_hint_menu
    bl      ui_footer

    mov     w0, 4
    mov     w1, 12
    mov     w2, 56
    mov     w3, 14
    ldr     x4, =array_pan_ops
    bl      ui_panel

    mov     w0, 6
    ldr     x1, =array_key_1
    ldr     x2, =array_opt_1
    bl      array_menu_line

    mov     w0, 7
    ldr     x1, =array_key_2
    ldr     x2, =array_opt_2
    bl      array_menu_line

    mov     w0, 8
    ldr     x1, =array_key_3
    ldr     x2, =array_opt_3
    bl      array_menu_line

    mov     w0, 9
    ldr     x1, =array_key_4
    ldr     x2, =array_opt_4
    bl      array_menu_line

    mov     w0, 10
    ldr     x1, =array_key_5
    ldr     x2, =array_opt_5
    bl      array_menu_line

    mov     w0, 11
    ldr     x1, =array_key_6
    ldr     x2, =array_opt_6
    bl      array_menu_line

    mov     w0, 12
    ldr     x1, =array_key_7
    ldr     x2, =array_opt_7
    bl      array_menu_line

    mov     w0, 13
    ldr     x1, =array_key_0
    ldr     x2, =array_opt_0
    bl      array_menu_line

    // how much of the strip is in use, so the menu is never a dead end
    mov     w0, 15
    mov     w1, 15
    bl      ui_at
    mov     w0, ARRAY_ROLE_DIM
    bl      th_fg
    ldr     x19, =array_count
    ldr     w1, [x19]
    mov     w2, array_capacity
    ldr     x0, =array_fmt_used
    bl      printf
    bl      th_off

    mov     w0, 18
    mov     w1, 15
    ldr     x2, =array_ask_choice
    bl      ui_prompt
    bl      array_flush

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// array_menu_line(w0 = row, x1 = key text, x2 = option text)
array_menu_line:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    mov     x21, x1
    mov     x20, x2

    mov     w0, w19
    mov     w1, 15
    mov     w2, ARRAY_ROLE_KEY
    mov     x3, x21
    bl      ui_badge

    mov     w0, w19
    mov     w1, 19
    mov     w2, ARRAY_ROLE_TEXT
    mov     x3, x20
    bl      ui_text

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// array_frame(x0 = screen title, x1 = footer hint, x2 = best, x3 = avg,
//             x4 = worst, x5 = space)
// Everything on an operation screen that does not move while it runs.
array_frame:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    mov     x19, x0
    mov     x20, x1
    mov     x21, x2
    mov     x22, x3
    mov     x23, x4
    mov     x24, x5

    mov     x0, x19
    bl      ui_screen

    mov     x0, x20
    bl      ui_footer

    mov     w0, 4
    mov     w1, 2
    mov     w2, 78
    mov     w3, 9
    ldr     x4, =array_pan_cells
    bl      ui_panel

    mov     w0, 14
    mov     w1, 2
    mov     w2, 78
    mov     w3, 4
    ldr     x4, =array_pan_cost
    bl      ui_panel

    mov     w0, 15
    mov     w1, 4
    mov     w2, ARRAY_ROLE_DIM
    ldr     x3, =array_lbl_cost1
    bl      ui_text

    mov     w0, 16
    mov     w1, 4
    mov     w2, ARRAY_ROLE_DIM
    ldr     x3, =array_lbl_cost2
    bl      ui_text

    mov     w0, 20
    mov     w1, 4
    mov     x2, x21
    mov     x3, x22
    mov     x4, x23
    mov     x5, x24
    bl      ui_complexity

    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// array_blank(w0 = row, w1 = column, w2 = run length) - wipe a run of
// cells without disturbing the borders on either side
array_blank:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w2
    bl      ui_at
    ldr     x0, =array_sp
    mov     w1, w19
    bl      ui_repeat

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// array_flush() - push the drawing out before a delay, or the whole
// animation arrives at once
array_flush:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     x0, 0
    bl      fflush

    ldp     fp, lr, [sp], 16
    ret

// array_pause(w0 = milliseconds)
array_pause:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0
    bl      array_flush
    mov     w0, w19
    bl      delay_ms

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// array_say(x0 = format, w1 = first value, w2 = second)
// The one line that narrates what just happened. It wipes the row first,
// so a prompt or an older caption never shows through.
array_say:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     x19, x0
    mov     w20, w1
    mov     w21, w2

    mov     w0, ARRAY_ROW_SAY
    mov     w1, 2
    mov     w2, 78
    bl      array_blank

    mov     w0, ARRAY_ROW_SAY
    mov     w1, 4
    bl      ui_at
    mov     w0, ARRAY_ROLE_TEXT
    bl      th_fg
    mov     x0, x19
    mov     w1, w20
    mov     w2, w21
    bl      printf
    bl      th_off

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// array_note(x0 = format, w1 = first value, w2 = second)
// A rejected entry is answered above the prompt rather than on it, so
// the complaint survives the retry that repaints the prompt row.
array_note:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     x19, x0
    mov     w20, w1
    mov     w21, w2

    mov     w0, ARRAY_ROW_NOTE
    mov     w1, 2
    mov     w2, 78
    bl      array_blank

    mov     w0, ARRAY_ROW_NOTE
    mov     w1, 4
    bl      ui_at
    mov     w0, ARRAY_ROLE_WARN
    bl      th_fg
    mov     x0, x19
    mov     w1, w20
    mov     w2, w21
    bl      printf
    bl      th_off

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// array_col(w0 = cell) -> w0 = the column that cell starts at
array_col:
    mov     w1, ARRAY_CELL_STEP
    mul     w0, w0, w1
    add     w0, w0, ARRAY_CELL_COL
    ret

// array_role_of(w0 = cell) -> w0 = the colour role this cell wears now
array_role_of:
    ldr     x1, =array_hl_slot
    ldr     x2, =array_hl_role
    mov     w3, 0

array_role_scan:
    cmp     w3, 2
    b.ge    array_role_rest
    ldr     w4, [x1, w3, sxtw 2]
    cmp     w4, w0
    b.eq    array_role_hit
    add     w3, w3, 1
    b       array_role_scan

array_role_hit:
    ldr     w0, [x2, w3, sxtw 2]
    ret

array_role_rest:
    mov     w0, ARRAY_ROLE_NODE
    ret

// array_draw_cell(w0 = cell) - the index above and the value below, or
// the marker that says this slot sits past the count
array_draw_cell:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    bl      array_col
    mov     w20, w0

    mov     w0, ARRAY_ROW_INDEX
    mov     w1, w20
    bl      ui_at
    mov     w0, ARRAY_ROLE_FAINT
    bl      th_fg
    ldr     x0, =array_fmt_cell
    mov     w1, w19
    bl      printf
    bl      th_off

    mov     w0, ARRAY_ROW_VALUE
    mov     w1, w20
    bl      ui_at

    ldr     x0, =array_count
    ldr     w21, [x0]
    cmp     w19, w21
    b.ge    array_cell_unused

    mov     w0, w19
    bl      array_role_of
    bl      th_bg
    ldr     x0, =array_data
    ldr     w1, [x0, w19, sxtw 2]
    ldr     x0, =array_fmt_cell
    bl      printf
    b       array_cell_close

array_cell_unused:
    mov     w0, ARRAY_ROLE_FAINT
    bl      th_fg
    ldr     x0, =array_cell_empty
    bl      printf

array_cell_close:
    bl      th_off

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// array_render(w0 = cell A, w1 = role A, w2 = cell B, w3 = role B)
// Repaints the strip from the ten words. A cell of -1 means nothing is
// highlighted there. The caption row is left alone: array_say owns it.
array_render:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x6, =array_hl_slot
    str     w0, [x6]
    str     w2, [x6, 4]
    ldr     x6, =array_hl_role
    str     w1, [x6]
    str     w3, [x6, 4]

    mov     w0, ARRAY_ROW_INDEX
    mov     w1, 3
    mov     w2, 76
    bl      array_blank
    mov     w0, ARRAY_ROW_VALUE
    mov     w1, 3
    mov     w2, 76
    bl      array_blank

    mov     w0, ARRAY_ROW_INDEX
    mov     w1, 4
    mov     w2, ARRAY_ROLE_DIM
    ldr     x3, =array_lbl_index
    bl      ui_text

    mov     w0, ARRAY_ROW_VALUE
    mov     w1, 4
    mov     w2, ARRAY_ROLE_DIM
    ldr     x3, =array_lbl_value
    bl      ui_text

    ldr     x0, =array_count
    ldr     w20, [x0]

    mov     w19, 0
array_render_cells:
    cmp     w19, array_capacity
    b.ge    array_render_legend
    mov     w0, w19
    bl      array_draw_cell
    add     w19, w19, 1
    b       array_render_cells

array_render_legend:
    mov     w0, ARRAY_ROW_LEGEND
    mov     w1, 4
    mov     w2, ARRAY_ROLE_DIM
    ldr     x3, =array_lbl_rest
    bl      ui_text

    mov     w0, ARRAY_ROW_LEGEND
    mov     w1, 12
    mov     w2, ARRAY_ROLE_NODE
    ldr     x3, =array_lbl_atrest
    bl      ui_text

    mov     w0, ARRAY_ROW_LEGEND
    mov     w1, 21
    mov     w2, ARRAY_ROLE_HOT
    ldr     x3, =array_lbl_hand
    bl      ui_text

    mov     w0, ARRAY_ROW_LEGEND
    mov     w1, 30
    mov     w2, ARRAY_ROLE_WARN
    ldr     x3, =array_lbl_read
    bl      ui_text

    mov     w0, ARRAY_ROW_LEGEND
    mov     w1, 39
    mov     w2, ARRAY_ROLE_OK
    ldr     x3, =array_lbl_written
    bl      ui_text

    mov     w0, ARRAY_ROW_LEGEND
    mov     w1, 48
    mov     w2, ARRAY_ROLE_FAINT
    ldr     x3, =array_lbl_unused
    bl      ui_text

    mov     w0, ARRAY_ROW_COUNT
    mov     w1, 4
    bl      ui_at
    mov     w0, ARRAY_ROLE_DIM
    bl      th_fg
    ldr     x0, =array_fmt_used
    mov     w1, w20
    mov     w2, array_capacity
    bl      printf
    bl      th_off

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// array_rest() - repaint with nothing highlighted
array_rest:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, -1
    mov     w1, 0
    mov     w2, -1
    mov     w3, 0
    bl      array_render

    ldp     fp, lr, [sp], 16
    ret

// array_ask(x0 = prompt format, w1 = the number the prompt names,
//           w2 = low bound, w3 = high bound, x4 = what to say when the
//           answer falls outside)
//        -> w0 = value, w1 = 1 when the value is usable
// One reader for every prompt in the module: it reprompts in place on an
// out-of-range answer and refuses a closed stdin, so a finished script
// walks back out of the menu instead of feeding the array zeros.
array_ask:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    str     x25, [sp, 64]

    mov     x19, x0
    mov     w20, w1
    mov     w21, w2
    mov     w22, w3
    mov     x23, x4

array_ask_loop:
    mov     w0, ARRAY_ROW_SAY
    mov     w1, 2
    mov     w2, 78
    bl      array_blank

    mov     w0, ARRAY_ROW_SAY
    mov     w1, 4
    bl      ui_at
    mov     w0, ARRAY_ROLE_TEXT
    bl      th_fg
    mov     x0, x19
    mov     w1, w20
    bl      printf
    bl      th_off
    mov     w0, ARRAY_ROLE_KEY
    bl      th_fg
    bl      ansi_show_cursor
    bl      array_flush

    bl      read_int
    mov     w24, w0                         // the value, held across calls
    mov     w25, w1                         // 0 means stdin ended

    cmp     w25, 0
    b.eq    array_ask_stop

    cmp     w24, w21
    b.lt    array_ask_range
    cmp     w24, w22
    b.gt    array_ask_range

    mov     w0, ARRAY_ROW_NOTE
    mov     w1, 2
    mov     w2, 78
    bl      array_blank                     // no complaint outlives the fix
    mov     w0, w24
    mov     w1, 1
    b       array_ask_done

array_ask_range:
    mov     x0, x23
    mov     w1, w22
    mov     w2, w22
    bl      array_note
    b       array_ask_loop

array_ask_stop:
    mov     w0, 0
    mov     w1, 0

array_ask_done:
    ldr     x25, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// array_init_random() - fill the strip with random values, one cell at a
// time, so the count grows in front of the reader
    .global array_init_random
array_init_random:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    ldr     x0, =array_scr_fill
    ldr     x1, =array_hint_run
    ldr     x2, =array_on
    ldr     x3, =array_on
    ldr     x4, =array_on
    ldr     x5, =array_o1
    bl      array_frame
    bl      array_rest

    ldr     x0, =array_ask_count
    mov     w1, array_capacity
    mov     w2, 1
    mov     w3, array_capacity
    ldr     x4, =array_note_count
    bl      array_ask
    mov     w19, w0                         // how many cells to fill
    mov     w20, w1
    cmp     w20, 0
    b.eq    array_fill_stop

    // the count grows with the fill, so a cell is only drawn once it
    // holds something
    ldr     x23, =array_count
    str     wzr, [x23]

    mov     w21, 0
array_fill_loop:
    cmp     w21, w19
    b.ge    array_fill_done

    mov     w0, 100                         // values in [0, 100)
    bl      get_random
    mov     w22, w0
    ldr     x23, =array_data
    str     w22, [x23, w21, sxtw 2]
    add     w0, w21, 1
    ldr     x23, =array_count
    str     w0, [x23]

    mov     w0, w21
    mov     w1, ARRAY_ROLE_HOT
    mov     w2, -1
    mov     w3, 0
    bl      array_render
    ldr     x0, =array_fmt_place
    mov     w1, w21
    mov     w2, w22
    bl      array_say
    mov     w0, 110
    bl      array_pause

    add     w21, w21, 1
    b       array_fill_loop

array_fill_done:
    bl      array_rest
    ldr     x0, =array_fmt_filled
    mov     w1, w19
    mov     w2, 0
    bl      array_say
    b       array_fill_out

array_fill_stop:
    bl      array_rest
    ldr     x0, =array_msg_stopped
    mov     w1, 0
    mov     w2, 0
    bl      array_say

array_fill_out:
    bl      array_flush
    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// array_init_user() - the same strip, filled with typed values. Input
// that ends early keeps the cells already typed instead of padding the
// rest with zeros.
    .global array_init_user
array_init_user:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    ldr     x0, =array_scr_type
    ldr     x1, =array_hint_run
    ldr     x2, =array_on
    ldr     x3, =array_on
    ldr     x4, =array_on
    ldr     x5, =array_o1
    bl      array_frame
    bl      array_rest

    ldr     x0, =array_ask_count
    mov     w1, array_capacity
    mov     w2, 1
    mov     w3, array_capacity
    ldr     x4, =array_note_count
    bl      array_ask
    mov     w19, w0
    mov     w20, w1
    cmp     w20, 0
    b.eq    array_type_stop

    ldr     x23, =array_count
    str     wzr, [x23]

    mov     w21, 0
array_type_loop:
    cmp     w21, w19
    b.ge    array_type_done

    ldr     x0, =array_ask_value
    mov     w1, w21
    mov     w2, -99
    mov     w3, 999
    ldr     x4, =array_note_value
    bl      array_ask
    mov     w22, w0
    mov     w20, w1
    cmp     w20, 0
    b.eq    array_type_short

    ldr     x23, =array_data
    str     w22, [x23, w21, sxtw 2]
    add     w0, w21, 1
    ldr     x23, =array_count
    str     w0, [x23]

    mov     w0, w21
    mov     w1, ARRAY_ROLE_OK
    mov     w2, -1
    mov     w3, 0
    bl      array_render
    ldr     x0, =array_fmt_wrote
    mov     w1, w21
    mov     w2, w22
    bl      array_say

    add     w21, w21, 1
    b       array_type_loop

array_type_done:
    bl      array_rest
    ldr     x0, =array_fmt_typed
    mov     w1, w19
    mov     w2, 0
    bl      array_say
    b       array_type_out

array_type_short:
    bl      array_rest
    ldr     x0, =array_fmt_typed
    mov     w1, w21
    mov     w2, 0
    bl      array_say
    b       array_type_out

array_type_stop:
    bl      array_rest
    ldr     x0, =array_msg_stopped
    mov     w1, 0
    mov     w2, 0
    bl      array_say

array_type_out:
    bl      array_flush
    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// array_display() - the strip as it stands, nothing moving
    .global array_display
array_display:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =array_scr_show
    ldr     x1, =array_hint_run
    ldr     x2, =array_o1
    ldr     x3, =array_o1
    ldr     x4, =array_o1
    ldr     x5, =array_on
    bl      array_frame
    bl      array_rest

    ldr     x0, =array_count
    ldr     w19, [x0]
    cmp     w19, 0
    b.le    array_display_empty

    ldr     x0, =array_fmt_state
    mov     w1, w19
    mov     w2, 0
    bl      array_say
    b       array_display_done

array_display_empty:
    ldr     x0, =array_msg_empty
    mov     w1, 0
    mov     w2, 0
    bl      array_say

array_display_done:
    bl      array_flush
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// array_get_interactive() - read one cell, and say what reaching it cost
    .global array_get_interactive
array_get_interactive:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    ldr     x0, =array_scr_get
    ldr     x1, =array_hint_run
    ldr     x2, =array_o1
    ldr     x3, =array_o1
    ldr     x4, =array_o1
    ldr     x5, =array_o1
    bl      array_frame
    bl      array_rest

    ldr     x0, =array_count
    ldr     w19, [x0]
    cmp     w19, 0
    b.le    array_get_empty

    ldr     x0, =array_ask_index
    sub     w1, w19, 1
    mov     w2, 0
    sub     w3, w19, 1
    ldr     x4, =array_note_index
    bl      array_ask
    mov     w20, w0                         // the cell to read
    mov     w21, w1
    cmp     w21, 0
    b.eq    array_get_done

    mov     w0, w20
    mov     w1, ARRAY_ROLE_WARN
    mov     w2, -1
    mov     w3, 0
    bl      array_render

    ldr     x0, =array_data
    ldr     w2, [x0, w20, sxtw 2]
    ldr     x0, =array_fmt_read
    mov     w1, w20
    bl      array_say
    b       array_get_done

array_get_empty:
    ldr     x0, =array_msg_empty
    mov     w1, 0
    mov     w2, 0
    bl      array_say

array_get_done:
    bl      array_flush
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// array_set_interactive() - write one cell, and show that the write
// reaches nothing else
    .global array_set_interactive
array_set_interactive:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    ldr     x0, =array_scr_set
    ldr     x1, =array_hint_run
    ldr     x2, =array_o1
    ldr     x3, =array_o1
    ldr     x4, =array_o1
    ldr     x5, =array_o1
    bl      array_frame
    bl      array_rest

    ldr     x0, =array_count
    ldr     w19, [x0]
    cmp     w19, 0
    b.le    array_set_empty

    ldr     x0, =array_ask_index
    sub     w1, w19, 1
    mov     w2, 0
    sub     w3, w19, 1
    ldr     x4, =array_note_index
    bl      array_ask
    mov     w20, w0                         // the cell being written
    mov     w22, w1
    cmp     w22, 0
    b.eq    array_set_done

    mov     w0, w20
    mov     w1, ARRAY_ROLE_HOT
    mov     w2, -1
    mov     w3, 0
    bl      array_render
    ldr     x0, =array_fmt_aim
    mov     w1, w20
    mov     w2, 0
    bl      array_say

    ldr     x0, =array_ask_new
    mov     w1, w20
    mov     w2, -99
    mov     w3, 999
    ldr     x4, =array_note_value
    bl      array_ask
    mov     w21, w0                         // the new value
    mov     w22, w1
    cmp     w22, 0
    b.eq    array_set_done

    ldr     x23, =array_data
    str     w21, [x23, w20, sxtw 2]

    mov     w0, w20
    mov     w1, ARRAY_ROLE_OK
    mov     w2, -1
    mov     w3, 0
    bl      array_render
    ldr     x0, =array_fmt_wrote
    mov     w1, w20
    mov     w2, w21
    bl      array_say
    b       array_set_done

array_set_empty:
    ldr     x0, =array_msg_empty
    mov     w1, 0
    mov     w2, 0
    bl      array_say

array_set_done:
    bl      array_flush
    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// array_swap_interactive() - two loads and two stores, with both cells
// held in view while they trade
    .global array_swap_interactive
array_swap_interactive:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    str     x25, [sp, 64]

    ldr     x0, =array_scr_swap
    ldr     x1, =array_hint_run
    ldr     x2, =array_o1
    ldr     x3, =array_o1
    ldr     x4, =array_o1
    ldr     x5, =array_o1
    bl      array_frame
    bl      array_rest

    ldr     x0, =array_count
    ldr     w19, [x0]
    cmp     w19, 2
    b.lt    array_swap_too_few

    ldr     x0, =array_ask_first
    sub     w1, w19, 1
    mov     w2, 0
    sub     w3, w19, 1
    ldr     x4, =array_note_index
    bl      array_ask
    mov     w20, w0                         // first cell
    mov     w22, w1
    cmp     w22, 0
    b.eq    array_swap_done

    mov     w0, w20
    mov     w1, ARRAY_ROLE_HOT
    mov     w2, -1
    mov     w3, 0
    bl      array_render
    ldr     x23, =array_data
    ldr     w2, [x23, w20, sxtw 2]
    ldr     x0, =array_fmt_pick1
    mov     w1, w20
    bl      array_say

    ldr     x0, =array_ask_second
    sub     w1, w19, 1
    mov     w2, 0
    sub     w3, w19, 1
    ldr     x4, =array_note_index
    bl      array_ask
    mov     w21, w0                         // second cell
    mov     w22, w1
    cmp     w22, 0
    b.eq    array_swap_done

    mov     w0, w20
    mov     w1, ARRAY_ROLE_HOT
    mov     w2, w21
    mov     w3, ARRAY_ROLE_HOT
    bl      array_render
    ldr     x23, =array_data
    ldr     w2, [x23, w21, sxtw 2]
    ldr     x0, =array_fmt_pick2
    mov     w1, w21
    bl      array_say
    mov     w0, 700
    bl      array_pause

    ldr     x23, =array_data
    ldr     w24, [x23, w20, sxtw 2]
    ldr     w25, [x23, w21, sxtw 2]
    str     w25, [x23, w20, sxtw 2]
    str     w24, [x23, w21, sxtw 2]

    mov     w0, w20
    mov     w1, ARRAY_ROLE_OK
    mov     w2, w21
    mov     w3, ARRAY_ROLE_OK
    bl      array_render
    ldr     x0, =array_fmt_swapped
    mov     w1, w20
    mov     w2, w21
    bl      array_say
    b       array_swap_done

array_swap_too_few:
    ldr     x0, =array_msg_small
    mov     w1, 0
    mov     w2, 0
    bl      array_say

array_swap_done:
    bl      array_flush
    ldr     x25, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// array_clear_interactive() - back to a count of zero
array_clear_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =array_scr_clear
    ldr     x1, =array_hint_run
    ldr     x2, =array_o1
    ldr     x3, =array_o1
    ldr     x4, =array_o1
    ldr     x5, =array_o1
    bl      array_frame

    bl      array_clear

    bl      array_rest
    ldr     x0, =array_msg_cleared
    mov     w1, 0
    mov     w2, 0
    bl      array_say
    bl      array_flush

    ldp     fp, lr, [sp], 16
    ret

// array_clear() - drop every element and any highlight, without drawing
    .global array_clear
array_clear:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =array_count
    str     wzr, [x0]

    ldr     x0, =array_hl_slot
    mov     w1, -1
    str     w1, [x0]
    str     w1, [x0, 4]

    ldp     fp, lr, [sp], 16
    ret
