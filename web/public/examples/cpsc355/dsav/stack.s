// stack_viz.asm - eight slots, and only the top one is ever in play
//
// The tower is drawn from the bottom up because that is the order the
// slots fill: slot 0 first, the top pointer climbing one slot per push.
// Everything a stack refuses to let you do is visible here - the values
// under the top are on screen the whole time and stay untouched.
//
// stack_get_data / stack_get_top / stack_get_capacity read the state out
// for the c++ build, which draws the same eight words its own way.

define(fp, x29)
define(lr, x30)

    stack_max_size = 8

// Role numbers mirror the UI_ROLE_* set in ui.asm. They are repeated so
// this file also assembles on its own, the way the web build feeds it.
    STACK_ROLE_TEXT  = 0
    STACK_ROLE_DIM   = 1
    STACK_ROLE_FAINT = 2
    STACK_ROLE_KEY   = 4
    STACK_ROLE_OK    = 5
    STACK_ROLE_WARN  = 6
    STACK_ROLE_HOT   = 7
    STACK_ROLE_BAD   = 8
    STACK_ROLE_NODE  = 9

// Slot 0 sits on the floor of the tower and each slot above it is one
// row higher, so a row is the base row less the slot number.
    STACK_ROW_BASE   = 14
    STACK_COL_SLOT   = 10
    STACK_COL_CELL   = 15
    STACK_COL_MARK   = 24
    STACK_COL_FLOOR  = 31

    STACK_ROW_TOP    = 13                   // the top readout, right panel
    STACK_ROW_USED   = 15
    STACK_ROW_NOTE   = 18
    STACK_ROW_SAY    = 19
    STACK_COL_RIGHT  = 44

    .data
    .balign 8

stack_data:         .skip stack_max_size * 4
    .balign 4
stack_top:          .word -1                // top slot, -1 while empty

// The slots wearing something other than their resting colour this
// frame, filled in by stack_render and read back by stack_role_of.
stack_hl_slot:      .word -1, -1
stack_hl_role:      .word 0, 0

stack_sp:           .string " "
stack_fmt_cell:     .string "%7d"
stack_fmt_slot:     .string "%2d"
stack_cell_empty:   .string "      \xc2\xb7"

stack_scr_menu:     .string "stack  \xc2\xb7  last in, first out"
stack_scr_push:     .string "stack  \xc2\xb7  push"
stack_scr_pop:      .string "stack  \xc2\xb7  pop"
stack_scr_peek:     .string "stack  \xc2\xb7  peek"
stack_scr_show:     .string "stack  \xc2\xb7  the stack right now"
stack_scr_clear:    .string "stack  \xc2\xb7  clear"

stack_pan_ops:      .string "operations"
stack_pan_tower:    .string "the stack"
stack_pan_rules:    .string "last in, first out"

stack_hint_menu:    .string "pick an operation  \xc2\xb7  0 goes back to the main menu"
stack_hint_run:     .string "enter returns to the stack menu  \xc2\xb7  only the top slot is in play"

stack_opt_1:        .string "push a value onto the top"
stack_opt_2:        .string "pop the top value off"
stack_opt_3:        .string "peek at the top without moving it"
stack_opt_4:        .string "show the stack as it stands"
stack_opt_5:        .string "clear the stack"
stack_opt_0:        .string "back to the main menu"

stack_key_1:        .string "1"
stack_key_2:        .string "2"
stack_key_3:        .string "3"
stack_key_4:        .string "4"
stack_key_5:        .string "5"
stack_key_0:        .string "0"

stack_ask_choice:   .string "choice "
stack_ask_value:    .string "value to push, -99 to 999  "
stack_note_value:   .string "values run from -99 to 999, so every slot stays the same width"

stack_lbl_slot:     .string "slot"
stack_lbl_value:    .string "value"
stack_lbl_top:      .string "top"
stack_lbl_floor:    .string "bottom"

stack_lbl_rule1:    .string "push writes the slot above the top"
stack_lbl_rule2:    .string "pop reads that slot and steps back"
stack_lbl_rule3:    .string "nothing under the top ever moves"

stack_lbl_atrest:   .string "at rest"
stack_lbl_hand:     .string "in hand"
stack_lbl_pushed:   .string "pushed"
stack_lbl_peeked:   .string "peeked"
stack_lbl_popped:   .string "popped"
stack_lbl_free:     .string "\xc2\xb7 free"

stack_fmt_topslot:  .string "top  \xc2\xb7  slot %d"
stack_lbl_notop:    .string "top  \xc2\xb7  nothing yet"
stack_fmt_used:     .string "%d of %d slots used"

stack_o1:           .string "O(1)"
stack_on:           .string "O(n)"

stack_msg_empty:    .string "the stack is empty. push a value to put something on top"
stack_msg_full:     .string "the stack is full: eight slots, and push has nowhere to write"
stack_msg_cleared:  .string "cleared. the top pointer sits below slot 0 again"
stack_msg_stopped:  .string "input ended, so the stack was left exactly as it was"

stack_fmt_arrive:   .string "%d goes into slot %d, the first free slot above the top"
stack_fmt_pushed:   .string "pushed %d  \xc2\xb7  the top moved from slot %d to slot %d"
stack_fmt_first:    .string "pushed %d into slot 0, the floor of the tower"
stack_fmt_lift:     .string "the top slot holds %d, and pop can read no other slot"
stack_fmt_leaves:   .string "%d leaves, and the top steps down to slot %d"
stack_fmt_popped:   .string "popped %d  \xc2\xb7  slot %d is the top now"
stack_fmt_last:     .string "popped %d, the last one: the stack is empty again"
stack_fmt_peek:     .string "peek reads slot %d and moves nothing, so the top is %d"
stack_fmt_state:    .string "%d in the tower, and only the one on top can be reached"

    .text
    .balign 4

// stack_menu() - operations menu; choice 0 hands control back to main
    .global stack_menu
stack_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

stack_menu_loop:
    bl      display_stack_menu

    mov     w0, 0
    mov     w1, 5
    bl      read_int_range

    cmp     w0, 0
    b.eq    stack_menu_exit
    cmp     w0, 1
    b.eq    stack_menu_push
    cmp     w0, 2
    b.eq    stack_menu_pop
    cmp     w0, 3
    b.eq    stack_menu_peek
    cmp     w0, 4
    b.eq    stack_menu_show
    cmp     w0, 5
    b.eq    stack_menu_clear
    b       stack_menu_loop

stack_menu_push:
    bl      stack_push_interactive
    bl      wait_for_enter
    b       stack_menu_loop

stack_menu_pop:
    bl      stack_pop_interactive
    bl      wait_for_enter
    b       stack_menu_loop

stack_menu_peek:
    bl      stack_peek_interactive
    bl      wait_for_enter
    b       stack_menu_loop

stack_menu_show:
    bl      stack_display
    bl      wait_for_enter
    b       stack_menu_loop

stack_menu_clear:
    bl      stack_clear_interactive
    bl      wait_for_enter
    b       stack_menu_loop

stack_menu_exit:
    ldp     fp, lr, [sp], 16
    ret

// display_stack_menu() - the operations screen
    .global display_stack_menu
display_stack_menu:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =stack_scr_menu
    bl      ui_screen

    ldr     x0, =stack_hint_menu
    bl      ui_footer

    mov     w0, 4
    mov     w1, 12
    mov     w2, 56
    mov     w3, 12
    ldr     x4, =stack_pan_ops
    bl      ui_panel

    mov     w0, 6
    ldr     x1, =stack_key_1
    ldr     x2, =stack_opt_1
    bl      stack_menu_line

    mov     w0, 7
    ldr     x1, =stack_key_2
    ldr     x2, =stack_opt_2
    bl      stack_menu_line

    mov     w0, 8
    ldr     x1, =stack_key_3
    ldr     x2, =stack_opt_3
    bl      stack_menu_line

    mov     w0, 9
    ldr     x1, =stack_key_4
    ldr     x2, =stack_opt_4
    bl      stack_menu_line

    mov     w0, 10
    ldr     x1, =stack_key_5
    ldr     x2, =stack_opt_5
    bl      stack_menu_line

    mov     w0, 11
    ldr     x1, =stack_key_0
    ldr     x2, =stack_opt_0
    bl      stack_menu_line

    // how much of the tower is standing, so the menu is never a dead end
    mov     w0, 13
    mov     w1, 15
    bl      ui_at
    mov     w0, STACK_ROLE_DIM
    bl      th_fg
    ldr     x19, =stack_top
    ldr     w1, [x19]
    add     w1, w1, 1                       // slots used = top + 1
    mov     w2, stack_max_size
    ldr     x0, =stack_fmt_used
    bl      printf
    bl      th_off

    mov     w0, 18
    mov     w1, 15
    ldr     x2, =stack_ask_choice
    bl      ui_prompt
    bl      stack_flush

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// stack_menu_line(w0 = row, x1 = key text, x2 = option text)
stack_menu_line:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    mov     x21, x1
    mov     x20, x2

    mov     w0, w19
    mov     w1, 15
    mov     w2, STACK_ROLE_KEY
    mov     x3, x21
    bl      ui_badge

    mov     w0, w19
    mov     w1, 19
    mov     w2, STACK_ROLE_TEXT
    mov     x3, x20
    bl      ui_text

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// stack_frame(x0 = screen title, x1 = footer hint, x2 = best, x3 = avg,
//             x4 = worst, x5 = space)
// Everything on an operation screen that does not move while it runs:
// the tower on the left, the rule it obeys on the right.
stack_frame:
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
    mov     w2, 38
    mov     w3, 13
    ldr     x4, =stack_pan_tower
    bl      ui_panel

    mov     w0, 4
    mov     w1, 42
    mov     w2, 38
    mov     w3, 13
    ldr     x4, =stack_pan_rules
    bl      ui_panel

    mov     w0, 5
    mov     w1, 9
    mov     w2, STACK_ROLE_DIM
    ldr     x3, =stack_lbl_slot
    bl      ui_text

    mov     w0, 5
    mov     w1, 17
    mov     w2, STACK_ROLE_DIM
    ldr     x3, =stack_lbl_value
    bl      ui_text

    mov     w0, 6
    mov     w1, STACK_COL_RIGHT
    mov     w2, STACK_ROLE_DIM
    ldr     x3, =stack_lbl_rule1
    bl      ui_text

    mov     w0, 7
    mov     w1, STACK_COL_RIGHT
    mov     w2, STACK_ROLE_DIM
    ldr     x3, =stack_lbl_rule2
    bl      ui_text

    mov     w0, 8
    mov     w1, STACK_COL_RIGHT
    mov     w2, STACK_ROLE_DIM
    ldr     x3, =stack_lbl_rule3
    bl      ui_text

    bl      stack_legend

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

// stack_legend() - what the colours mean, under the rule they serve
stack_legend:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, 10
    mov     w1, STACK_COL_RIGHT
    mov     w2, STACK_ROLE_NODE
    ldr     x3, =stack_lbl_atrest
    bl      ui_text

    mov     w0, 10
    mov     w1, STACK_COL_RIGHT + 9
    mov     w2, STACK_ROLE_HOT
    ldr     x3, =stack_lbl_hand
    bl      ui_text

    mov     w0, 10
    mov     w1, STACK_COL_RIGHT + 18
    mov     w2, STACK_ROLE_OK
    ldr     x3, =stack_lbl_pushed
    bl      ui_text

    mov     w0, 11
    mov     w1, STACK_COL_RIGHT
    mov     w2, STACK_ROLE_WARN
    ldr     x3, =stack_lbl_peeked
    bl      ui_text

    mov     w0, 11
    mov     w1, STACK_COL_RIGHT + 9
    mov     w2, STACK_ROLE_BAD
    ldr     x3, =stack_lbl_popped
    bl      ui_text

    mov     w0, 11
    mov     w1, STACK_COL_RIGHT + 18
    mov     w2, STACK_ROLE_FAINT
    ldr     x3, =stack_lbl_free
    bl      ui_text

    ldp     fp, lr, [sp], 16
    ret

// stack_blank(w0 = row, w1 = column, w2 = run length) - wipe a run of
// cells without disturbing the borders on either side
stack_blank:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w2
    bl      ui_at
    ldr     x0, =stack_sp
    mov     w1, w19
    bl      ui_repeat

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// stack_flush() - push the drawing out before a delay, or the whole
// animation arrives at once
stack_flush:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     x0, 0
    bl      fflush

    ldp     fp, lr, [sp], 16
    ret

// stack_pause(w0 = milliseconds)
stack_pause:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0
    bl      stack_flush
    mov     w0, w19
    bl      delay_ms

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// stack_say(x0 = format, w1 = first value, w2 = second, w3 = third)
// The one line that narrates what just happened. It wipes the row first,
// so a prompt or an older caption never shows through.
stack_say:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     x19, x0
    mov     w20, w1
    mov     w21, w2
    mov     w22, w3

    mov     w0, STACK_ROW_SAY
    mov     w1, 2
    mov     w2, 78
    bl      stack_blank

    mov     w0, STACK_ROW_SAY
    mov     w1, 4
    bl      ui_at
    mov     w0, STACK_ROLE_TEXT
    bl      th_fg
    mov     x0, x19
    mov     w1, w20
    mov     w2, w21
    mov     w3, w22
    bl      printf
    bl      th_off

    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// stack_note(x0 = text) - a rejected entry is answered above the prompt
// rather than on it, so the complaint survives the retry that repaints
// the prompt row
stack_note:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0

    mov     w0, STACK_ROW_NOTE
    mov     w1, 2
    mov     w2, 78
    bl      stack_blank

    mov     w0, STACK_ROW_NOTE
    mov     w1, 4
    mov     w2, STACK_ROLE_WARN
    mov     x3, x19
    bl      ui_text

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// stack_role_of(w0 = slot) -> w0 = the colour role this slot wears now
stack_role_of:
    ldr     x1, =stack_hl_slot
    ldr     x2, =stack_hl_role
    mov     w3, 0

stack_role_scan:
    cmp     w3, 2
    b.ge    stack_role_rest
    ldr     w4, [x1, w3, sxtw 2]
    cmp     w4, w0
    b.eq    stack_role_hit
    add     w3, w3, 1
    b       stack_role_scan

stack_role_hit:
    ldr     w0, [x2, w3, sxtw 2]
    ret

stack_role_rest:
    mov     w0, STACK_ROLE_NODE
    ret

// stack_draw_slot(w0 = slot) - the slot number and the cell beside it,
// or the marker that says this slot is above the top
stack_draw_slot:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    mov     w20, STACK_ROW_BASE
    sub     w20, w20, w19                   // slot 0 stands on the floor

    mov     w0, w20
    mov     w1, STACK_COL_SLOT
    bl      ui_at
    mov     w0, STACK_ROLE_FAINT
    bl      th_fg
    ldr     x0, =stack_fmt_slot
    mov     w1, w19
    bl      printf
    bl      th_off

    mov     w0, w20
    mov     w1, STACK_COL_CELL
    bl      ui_at

    ldr     x0, =stack_top
    ldr     w21, [x0]
    cmp     w19, w21
    b.gt    stack_slot_free

    mov     w0, w19
    bl      stack_role_of
    bl      th_bg
    ldr     x0, =stack_data
    ldr     w1, [x0, w19, sxtw 2]
    ldr     x0, =stack_fmt_cell
    bl      printf
    b       stack_slot_close

stack_slot_free:
    mov     w0, STACK_ROLE_FAINT
    bl      th_fg
    ldr     x0, =stack_cell_empty
    bl      printf

stack_slot_close:
    bl      th_off

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// stack_render(w0 = slot A, w1 = role A, w2 = slot B, w3 = role B)
// Repaints the tower and the two readouts beside it. A slot of -1 means
// nothing is highlighted there. The caption row is left alone: stack_say
// owns it.
stack_render:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x6, =stack_hl_slot
    str     w0, [x6]
    str     w2, [x6, 4]
    ldr     x6, =stack_hl_role
    str     w1, [x6]
    str     w3, [x6, 4]

    mov     w19, 6
stack_render_wipe:
    cmp     w19, STACK_ROW_BASE
    b.gt    stack_render_slots
    mov     w0, w19
    mov     w1, 3
    mov     w2, 36
    bl      stack_blank
    add     w19, w19, 1
    b       stack_render_wipe

stack_render_slots:
    mov     w19, 0
stack_render_loop:
    cmp     w19, stack_max_size
    b.ge    stack_render_marks
    mov     w0, w19
    bl      stack_draw_slot
    add     w19, w19, 1
    b       stack_render_loop

stack_render_marks:
    ldr     x0, =stack_top
    ldr     w20, [x0]

    mov     w0, STACK_ROW_TOP
    mov     w1, 43
    mov     w2, 36
    bl      stack_blank

    cmp     w20, 0
    b.lt    stack_render_no_top

    mov     w0, STACK_ROW_BASE
    sub     w0, w0, w20
    mov     w1, STACK_COL_MARK
    mov     w2, STACK_ROLE_KEY
    ldr     x3, =stack_lbl_top
    bl      ui_badge

    mov     w0, STACK_ROW_BASE
    mov     w1, STACK_COL_FLOOR
    mov     w2, STACK_ROLE_FAINT
    ldr     x3, =stack_lbl_floor
    bl      ui_text

    mov     w0, STACK_ROW_TOP
    mov     w1, STACK_COL_RIGHT
    bl      ui_at
    mov     w0, STACK_ROLE_KEY
    bl      th_fg
    ldr     x0, =stack_fmt_topslot
    mov     w1, w20
    bl      printf
    bl      th_off
    b       stack_render_used

stack_render_no_top:
    mov     w0, STACK_ROW_TOP
    mov     w1, STACK_COL_RIGHT
    mov     w2, STACK_ROLE_FAINT
    ldr     x3, =stack_lbl_notop
    bl      ui_text

stack_render_used:
    mov     w0, STACK_ROW_USED
    mov     w1, 43
    mov     w2, 36
    bl      stack_blank

    mov     w0, STACK_ROW_USED
    mov     w1, STACK_COL_RIGHT
    bl      ui_at
    mov     w0, STACK_ROLE_DIM
    bl      th_fg
    ldr     x0, =stack_fmt_used
    add     w1, w20, 1
    mov     w2, stack_max_size
    bl      printf
    bl      th_off

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// stack_rest() - repaint with nothing highlighted
stack_rest:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, -1
    mov     w1, 0
    mov     w2, -1
    mov     w3, 0
    bl      stack_render

    ldp     fp, lr, [sp], 16
    ret

// stack_ask(x0 = prompt, w1 = low bound, w2 = high bound, x3 = what to
//           say when the answer falls outside)
//        -> w0 = value, w1 = 1 when the value is usable
// The one reader the module prompts with: it reprompts in place on an
// out-of-range answer and refuses a closed stdin, so a finished script
// walks back out of the menu instead of pushing zeros.
stack_ask:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    mov     x19, x0
    mov     w20, w1
    mov     w21, w2
    mov     x22, x3

stack_ask_loop:
    mov     w0, STACK_ROW_SAY
    mov     w1, 2
    mov     w2, 78
    bl      stack_blank

    mov     w0, STACK_ROW_SAY
    mov     w1, 4
    mov     x2, x19
    bl      ui_prompt
    bl      stack_flush

    bl      read_int
    mov     w23, w0                         // the value, held across calls
    mov     w24, w1                         // 0 means stdin ended

    cmp     w24, 0
    b.eq    stack_ask_stop

    cmp     w23, w20
    b.lt    stack_ask_range
    cmp     w23, w21
    b.gt    stack_ask_range

    mov     w0, STACK_ROW_NOTE
    mov     w1, 2
    mov     w2, 78
    bl      stack_blank                     // no complaint outlives the fix
    mov     w0, w23
    mov     w1, 1
    b       stack_ask_done

stack_ask_range:
    mov     x0, x22
    bl      stack_note
    b       stack_ask_loop

stack_ask_stop:
    mov     w0, 0
    mov     w1, 0

stack_ask_done:
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// stack_push_interactive() - read a value and watch it land on the first
// free slot above the top
    .global stack_push_interactive
stack_push_interactive:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    ldr     x0, =stack_scr_push
    ldr     x1, =stack_hint_run
    ldr     x2, =stack_o1
    ldr     x3, =stack_o1
    ldr     x4, =stack_o1
    ldr     x5, =stack_o1
    bl      stack_frame
    bl      stack_rest

    bl      stack_is_full
    cmp     w0, 1
    b.eq    stack_push_overflow

    ldr     x0, =stack_ask_value
    mov     w1, -99
    mov     w2, 999
    ldr     x3, =stack_note_value
    bl      stack_ask
    mov     w19, w0                         // the value being pushed
    mov     w20, w1
    cmp     w20, 0
    b.eq    stack_push_stopped

    ldr     x0, =stack_top
    ldr     w21, [x0]                       // the top as it was
    add     w22, w21, 1                     // the slot about to be written

    mov     w0, w19
    bl      stack_push

    mov     w0, w22
    mov     w1, STACK_ROLE_HOT
    mov     w2, -1
    mov     w3, 0
    bl      stack_render
    ldr     x0, =stack_fmt_arrive
    mov     w1, w19
    mov     w2, w22
    mov     w3, 0
    bl      stack_say
    mov     w0, 750
    bl      stack_pause

    mov     w0, w22
    mov     w1, STACK_ROLE_OK
    mov     w2, -1
    mov     w3, 0
    bl      stack_render

    cmp     w21, 0
    b.lt    stack_push_first

    ldr     x0, =stack_fmt_pushed
    mov     w1, w19
    mov     w2, w21
    mov     w3, w22
    bl      stack_say
    b       stack_push_done

stack_push_first:
    ldr     x0, =stack_fmt_first
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      stack_say
    b       stack_push_done

stack_push_overflow:
    ldr     x0, =stack_msg_full
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      stack_say
    b       stack_push_done

stack_push_stopped:
    ldr     x0, =stack_msg_stopped
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      stack_say

stack_push_done:
    bl      stack_flush
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// stack_pop_interactive() - take the top value off, one step at a time
    .global stack_pop_interactive
stack_pop_interactive:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    ldr     x0, =stack_scr_pop
    ldr     x1, =stack_hint_run
    ldr     x2, =stack_o1
    ldr     x3, =stack_o1
    ldr     x4, =stack_o1
    ldr     x5, =stack_o1
    bl      stack_frame
    bl      stack_rest

    bl      stack_is_empty
    cmp     w0, 1
    b.eq    stack_pop_underflow

    ldr     x0, =stack_top
    ldr     w20, [x0]                       // the slot being emptied
    bl      stack_peek
    mov     w19, w0                         // the value leaving

    mov     w0, w20
    mov     w1, STACK_ROLE_HOT
    mov     w2, -1
    mov     w3, 0
    bl      stack_render
    ldr     x0, =stack_fmt_lift
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      stack_say
    mov     w0, 750
    bl      stack_pause

    sub     w21, w20, 1                     // where the top lands
    mov     w0, w20
    mov     w1, STACK_ROLE_BAD
    mov     w2, -1
    mov     w3, 0
    bl      stack_render
    ldr     x0, =stack_fmt_leaves
    mov     w1, w19
    mov     w2, w21
    mov     w3, 0
    bl      stack_say
    mov     w0, 750
    bl      stack_pause

    bl      stack_pop
    bl      stack_rest

    cmp     w21, 0
    b.lt    stack_pop_emptied

    ldr     x0, =stack_fmt_popped
    mov     w1, w19
    mov     w2, w21
    mov     w3, 0
    bl      stack_say
    b       stack_pop_done

stack_pop_emptied:
    ldr     x0, =stack_fmt_last
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      stack_say
    b       stack_pop_done

stack_pop_underflow:
    ldr     x0, =stack_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      stack_say

stack_pop_done:
    bl      stack_flush
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// stack_peek_interactive() - read the top slot without moving anything
    .global stack_peek_interactive
stack_peek_interactive:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x0, =stack_scr_peek
    ldr     x1, =stack_hint_run
    ldr     x2, =stack_o1
    ldr     x3, =stack_o1
    ldr     x4, =stack_o1
    ldr     x5, =stack_o1
    bl      stack_frame
    bl      stack_rest

    bl      stack_is_empty
    cmp     w0, 1
    b.eq    stack_peek_empty

    ldr     x0, =stack_top
    ldr     w20, [x0]
    bl      stack_peek
    mov     w19, w0

    mov     w0, w20
    mov     w1, STACK_ROLE_WARN
    mov     w2, -1
    mov     w3, 0
    bl      stack_render
    ldr     x0, =stack_fmt_peek
    mov     w1, w20
    mov     w2, w19
    mov     w3, 0
    bl      stack_say
    b       stack_peek_done

stack_peek_empty:
    ldr     x0, =stack_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      stack_say

stack_peek_done:
    bl      stack_flush
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// stack_display() - the tower as it stands, nothing moving
    .global stack_display
stack_display:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =stack_scr_show
    ldr     x1, =stack_hint_run
    ldr     x2, =stack_o1
    ldr     x3, =stack_o1
    ldr     x4, =stack_o1
    ldr     x5, =stack_on
    bl      stack_frame
    bl      stack_rest

    ldr     x0, =stack_top
    ldr     w19, [x0]
    cmp     w19, 0
    b.lt    stack_display_empty

    add     w19, w19, 1
    ldr     x0, =stack_fmt_state
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      stack_say
    b       stack_display_done

stack_display_empty:
    ldr     x0, =stack_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      stack_say

stack_display_done:
    bl      stack_flush
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// stack_clear_interactive() - the top pointer back below slot 0
stack_clear_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =stack_scr_clear
    ldr     x1, =stack_hint_run
    ldr     x2, =stack_o1
    ldr     x3, =stack_o1
    ldr     x4, =stack_o1
    ldr     x5, =stack_o1
    bl      stack_frame

    bl      stack_clear

    bl      stack_rest
    ldr     x0, =stack_msg_cleared
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      stack_say
    bl      stack_flush

    ldp     fp, lr, [sp], 16
    ret

// stack_push(w0 = value) -> w0 = 1 on success, 0 on overflow
// No calls, so scratch registers are all it needs and no caller state is
// at risk.
    .global stack_push
stack_push:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x1, =stack_top
    ldr     w2, [x1]

    cmp     w2, stack_max_size - 1
    b.ge    stack_push_fail

    add     w2, w2, 1
    str     w2, [x1]

    ldr     x3, =stack_data
    str     w0, [x3, w2, sxtw 2]

    mov     w0, 1
    b       stack_push_ret

stack_push_fail:
    mov     w0, 0

stack_push_ret:
    ldp     fp, lr, [sp], 16
    ret

// stack_pop() -> w0 = the value that was on top, 0 if empty
    .global stack_pop
stack_pop:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x1, =stack_top
    ldr     w2, [x1]

    cmp     w2, 0
    b.lt    stack_pop_fail

    ldr     x3, =stack_data
    ldr     w0, [x3, w2, sxtw 2]

    sub     w2, w2, 1
    str     w2, [x1]                        // the value stays in memory,
    b       stack_pop_ret                   // out of reach above the top

stack_pop_fail:
    mov     w0, 0

stack_pop_ret:
    ldp     fp, lr, [sp], 16
    ret

// stack_peek() -> w0 = the top value, 0 if empty, nothing moved
    .global stack_peek
stack_peek:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x1, =stack_top
    ldr     w2, [x1]

    cmp     w2, 0
    b.lt    stack_peek_fail

    ldr     x3, =stack_data
    ldr     w0, [x3, w2, sxtw 2]
    b       stack_peek_ret

stack_peek_fail:
    mov     w0, 0

stack_peek_ret:
    ldp     fp, lr, [sp], 16
    ret

// stack_is_empty() -> w0 = 1 if empty, 0 otherwise
    .global stack_is_empty
stack_is_empty:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =stack_top
    ldr     w0, [x0]

    cmp     w0, 0
    b.lt    stack_empty_yes
    mov     w0, 0
    b       stack_empty_ret

stack_empty_yes:
    mov     w0, 1

stack_empty_ret:
    ldp     fp, lr, [sp], 16
    ret

// stack_is_full() -> w0 = 1 if full, 0 otherwise
    .global stack_is_full
stack_is_full:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =stack_top
    ldr     w0, [x0]

    cmp     w0, stack_max_size - 1
    b.ge    stack_full_yes
    mov     w0, 0
    b       stack_full_ret

stack_full_yes:
    mov     w0, 1

stack_full_ret:
    ldp     fp, lr, [sp], 16
    ret

// stack_clear() - back to empty, without drawing
    .global stack_clear
stack_clear:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =stack_top
    mov     w1, -1
    str     w1, [x0]

    ldr     x0, =stack_hl_slot
    str     w1, [x0]
    str     w1, [x0, 4]

    ldp     fp, lr, [sp], 16
    ret

// accessors for the c++ build: read the state without touching it

// stack_get_data() -> x0 = address of the slots
    .global stack_get_data
stack_get_data:
    ldr     x0, =stack_data
    ret

// stack_get_top() -> w0 = top slot, -1 if empty
    .global stack_get_top
stack_get_top:
    ldr     x0, =stack_top
    ldr     w0, [x0]
    ret

// stack_get_capacity() -> w0 = how many slots there are
    .global stack_get_capacity
stack_get_capacity:
    mov     w0, stack_max_size
    ret
