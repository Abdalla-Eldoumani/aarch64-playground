// queue_viz.asm - eight slots in a ring, walked by two indices
//
// The strip is the buffer as it really sits in memory, slot 0 through
// slot 7, and front and rear are drawn as what they are: two numbers
// pointing into it. That is the only way the wrap shows. A queue drawn
// front-first always looks like a list, and the moment the rear passes
// slot 7 and lands back on slot 0 the picture stops being true.
//
// queue_get_data / queue_get_front / queue_get_rear / queue_get_count
// read the state out for the c++ build.

define(fp, x29)
define(lr, x30)

    queue_max_size = 8

// Role numbers mirror the UI_ROLE_* set in ui.asm. They are repeated so
// this file also assembles on its own, the way the web build feeds it.
    QUEUE_ROLE_TEXT  = 0
    QUEUE_ROLE_DIM   = 1
    QUEUE_ROLE_FAINT = 2
    QUEUE_ROLE_KEY   = 4
    QUEUE_ROLE_OK    = 5
    QUEUE_ROLE_WARN  = 6
    QUEUE_ROLE_HOT   = 7
    QUEUE_ROLE_BAD   = 8
    QUEUE_ROLE_NODE  = 9

// Slot 0 starts here and each slot after it is one step further right,
// so the strip is laid out the way the memory is, not the way the queue
// reads.
    QUEUE_CELL_COL   = 6
    QUEUE_CELL_STEP  = 9

    QUEUE_ROW_INDEX  = 6
    QUEUE_ROW_VALUE  = 8
    QUEUE_ROW_FRONT  = 10
    QUEUE_ROW_REAR   = 11
    QUEUE_ROW_STATE  = 12
    QUEUE_ROW_LEGEND = 13
    QUEUE_ROW_NOTE   = 18
    QUEUE_ROW_SAY    = 19

    .data
    .balign 8

queue_data:         .skip queue_max_size * 4
    .balign 4
queue_front:        .word 0                 // slot the next dequeue reads
queue_rear:         .word -1                // slot the last enqueue wrote
queue_count:        .word 0

// The slots wearing something other than their resting colour this
// frame, filled in by queue_render and read back by queue_role_of.
queue_hl_slot:      .word -1, -1
queue_hl_role:      .word 0, 0

queue_sp:           .string " "
queue_fmt_cell:     .string "%6d"
queue_cell_empty:   .string "     \xc2\xb7"

queue_scr_menu:     .string "queue  \xc2\xb7  first in, first out"
queue_scr_enq:      .string "queue  \xc2\xb7  enqueue"
queue_scr_deq:      .string "queue  \xc2\xb7  dequeue"
queue_scr_peek:     .string "queue  \xc2\xb7  peek"
queue_scr_show:     .string "queue  \xc2\xb7  the queue right now"
queue_scr_clear:    .string "queue  \xc2\xb7  clear"

queue_pan_ops:      .string "operations"
queue_pan_ring:     .string "the buffer"

queue_hint_menu:    .string "pick an operation  \xc2\xb7  0 goes back to the main menu"
queue_hint_run:     .string "enter returns to the queue menu  \xc2\xb7  the strip is the buffer, in slot order"

queue_opt_1:        .string "enqueue a value at the rear"
queue_opt_2:        .string "dequeue the value at the front"
queue_opt_3:        .string "peek at the front without removing it"
queue_opt_4:        .string "show the queue as it stands"
queue_opt_5:        .string "clear the queue"
queue_opt_0:        .string "back to the main menu"

queue_key_1:        .string "1"
queue_key_2:        .string "2"
queue_key_3:        .string "3"
queue_key_4:        .string "4"
queue_key_5:        .string "5"
queue_key_0:        .string "0"

queue_ask_choice:   .string "choice "
queue_ask_value:    .string "value to enqueue, -99 to 999  "
queue_note_value:   .string "values run from -99 to 999, so every slot stays the same width"

queue_lbl_front:    .string "front"
queue_lbl_rear:     .string "rear"
queue_lbl_rest:     .string "cells:"
queue_lbl_atrest:   .string "at rest"
queue_lbl_hand:     .string "in hand"
queue_lbl_joined:   .string "joined"
queue_lbl_peeked:   .string "peeked"
queue_lbl_left:     .string "left"
queue_lbl_free:     .string "\xc2\xb7 free"

queue_lbl_rule1:    .string "enqueue writes at the rear and dequeue reads at the front"
queue_lbl_rule2:    .string "both indices wrap past slot 7 back to slot 0, so nothing shifts"

queue_fmt_used:     .string "%d of %d slots used"
queue_fmt_state:    .string "%d of %d slots used  \xc2\xb7  front at slot %d, rear at slot %d"
queue_lbl_nostate:  .string "the buffer is empty, so front and rear point at nothing yet"

queue_o1:           .string "O(1)"
queue_on:           .string "O(n)"

queue_msg_empty:    .string "the queue is empty. enqueue a value to give the front something"
queue_msg_full:     .string "the queue is full: eight slots, and the rear has nowhere to go"
queue_msg_cleared:  .string "cleared. front is back at slot 0 and the count is zero"
queue_msg_stopped:  .string "input ended, so the queue was left exactly as it was"

queue_fmt_arrive:   .string "the rear steps to slot %d, and %d is written there"
queue_fmt_wrapped:  .string "the rear ran past slot 7, so it wrapped round to slot %d"
queue_fmt_joined:   .string "%d joined at the back  \xc2\xb7  %d now waiting"
queue_fmt_head:     .string "slot %d is the front, so %d is the value that has waited longest"
queue_fmt_leaves:   .string "%d leaves, and the front steps on to slot %d"
queue_fmt_dequeued: .string "dequeued %d  \xc2\xb7  %d still waiting"
queue_fmt_drained:  .string "dequeued %d, the last one waiting: the queue is empty again"
queue_fmt_peek:     .string "peek reads slot %d and removes nothing, so the front is %d"
queue_fmt_line:     .string "%d waiting, and only the one at the front can leave"

    .text
    .balign 4

// queue_menu() - operations menu; choice 0 hands control back to main
    .global queue_menu
queue_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

queue_menu_loop:
    bl      display_queue_menu

    mov     w0, 0
    mov     w1, 5
    bl      read_int_range

    cmp     w0, 0
    b.eq    queue_menu_exit
    cmp     w0, 1
    b.eq    queue_menu_enqueue
    cmp     w0, 2
    b.eq    queue_menu_dequeue
    cmp     w0, 3
    b.eq    queue_menu_peek
    cmp     w0, 4
    b.eq    queue_menu_show
    cmp     w0, 5
    b.eq    queue_menu_clear
    b       queue_menu_loop

queue_menu_enqueue:
    bl      queue_enqueue_interactive
    bl      wait_for_enter
    b       queue_menu_loop

queue_menu_dequeue:
    bl      queue_dequeue_interactive
    bl      wait_for_enter
    b       queue_menu_loop

queue_menu_peek:
    bl      queue_peek_interactive
    bl      wait_for_enter
    b       queue_menu_loop

queue_menu_show:
    bl      queue_display
    bl      wait_for_enter
    b       queue_menu_loop

queue_menu_clear:
    bl      queue_clear_interactive
    bl      wait_for_enter
    b       queue_menu_loop

queue_menu_exit:
    ldp     fp, lr, [sp], 16
    ret

// display_queue_menu() - the operations screen
    .global display_queue_menu
display_queue_menu:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =queue_scr_menu
    bl      ui_screen

    ldr     x0, =queue_hint_menu
    bl      ui_footer

    mov     w0, 4
    mov     w1, 12
    mov     w2, 56
    mov     w3, 12
    ldr     x4, =queue_pan_ops
    bl      ui_panel

    mov     w0, 6
    ldr     x1, =queue_key_1
    ldr     x2, =queue_opt_1
    bl      queue_menu_line

    mov     w0, 7
    ldr     x1, =queue_key_2
    ldr     x2, =queue_opt_2
    bl      queue_menu_line

    mov     w0, 8
    ldr     x1, =queue_key_3
    ldr     x2, =queue_opt_3
    bl      queue_menu_line

    mov     w0, 9
    ldr     x1, =queue_key_4
    ldr     x2, =queue_opt_4
    bl      queue_menu_line

    mov     w0, 10
    ldr     x1, =queue_key_5
    ldr     x2, =queue_opt_5
    bl      queue_menu_line

    mov     w0, 11
    ldr     x1, =queue_key_0
    ldr     x2, =queue_opt_0
    bl      queue_menu_line

    // how much of the buffer is spoken for, so the menu is never a dead
    // end
    mov     w0, 13
    mov     w1, 15
    bl      ui_at
    mov     w0, QUEUE_ROLE_DIM
    bl      th_fg
    ldr     x19, =queue_count
    ldr     w1, [x19]
    mov     w2, queue_max_size
    ldr     x0, =queue_fmt_used
    bl      printf
    bl      th_off

    mov     w0, 18
    mov     w1, 15
    ldr     x2, =queue_ask_choice
    bl      ui_prompt
    bl      queue_flush

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// queue_menu_line(w0 = row, x1 = key text, x2 = option text)
queue_menu_line:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    mov     x21, x1
    mov     x20, x2

    mov     w0, w19
    mov     w1, 15
    mov     w2, QUEUE_ROLE_KEY
    mov     x3, x21
    bl      ui_badge

    mov     w0, w19
    mov     w1, 19
    mov     w2, QUEUE_ROLE_TEXT
    mov     x3, x20
    bl      ui_text

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// queue_frame(x0 = screen title, x1 = footer hint, x2 = best, x3 = avg,
//             x4 = worst, x5 = space)
// Everything on an operation screen that does not move while it runs.
queue_frame:
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
    mov     w3, 11
    ldr     x4, =queue_pan_ring
    bl      ui_panel

    mov     w0, 16
    mov     w1, 4
    mov     w2, QUEUE_ROLE_DIM
    ldr     x3, =queue_lbl_rule1
    bl      ui_text

    mov     w0, 17
    mov     w1, 4
    mov     w2, QUEUE_ROLE_DIM
    ldr     x3, =queue_lbl_rule2
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

// queue_blank(w0 = row, w1 = column, w2 = run length) - wipe a run of
// cells without disturbing the borders on either side
queue_blank:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w2
    bl      ui_at
    ldr     x0, =queue_sp
    mov     w1, w19
    bl      ui_repeat

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// queue_flush() - push the drawing out before a delay, or the whole
// animation arrives at once
queue_flush:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     x0, 0
    bl      fflush

    ldp     fp, lr, [sp], 16
    ret

// queue_pause(w0 = milliseconds)
queue_pause:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0
    bl      queue_flush
    mov     w0, w19
    bl      delay_ms

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// queue_say(x0 = format, w1 = first value, w2 = second)
// The one line that narrates what just happened. It wipes the row first,
// so a prompt or an older caption never shows through.
queue_say:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     x19, x0
    mov     w20, w1
    mov     w21, w2

    mov     w0, QUEUE_ROW_SAY
    mov     w1, 2
    mov     w2, 78
    bl      queue_blank

    mov     w0, QUEUE_ROW_SAY
    mov     w1, 4
    bl      ui_at
    mov     w0, QUEUE_ROLE_TEXT
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

// queue_note(x0 = text) - a rejected entry is answered above the prompt
// rather than on it, so the complaint survives the retry that repaints
// the prompt row
queue_note:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0

    mov     w0, QUEUE_ROW_NOTE
    mov     w1, 2
    mov     w2, 78
    bl      queue_blank

    mov     w0, QUEUE_ROW_NOTE
    mov     w1, 4
    mov     w2, QUEUE_ROLE_WARN
    mov     x3, x19
    bl      ui_text

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// queue_col(w0 = slot) -> w0 = the column that slot starts at
queue_col:
    mov     w1, QUEUE_CELL_STEP
    mul     w0, w0, w1
    add     w0, w0, QUEUE_CELL_COL
    ret

// queue_in_use(w0 = slot) -> w0 = 1 when the slot holds a waiting value
// A slot belongs to the queue when it is fewer than count steps ahead of
// front, counted the way the indices move: forward, wrapping at the end.
queue_in_use:
    ldr     x1, =queue_front
    ldr     w1, [x1]
    ldr     x2, =queue_count
    ldr     w2, [x2]

    sub     w3, w0, w1
    cmp     w3, 0
    b.ge    queue_in_use_test
    add     w3, w3, queue_max_size

queue_in_use_test:
    cmp     w3, w2
    b.lt    queue_in_use_yes
    mov     w0, 0
    ret

queue_in_use_yes:
    mov     w0, 1
    ret

// queue_role_of(w0 = slot) -> w0 = the colour role this slot wears now
queue_role_of:
    ldr     x1, =queue_hl_slot
    ldr     x2, =queue_hl_role
    mov     w3, 0

queue_role_scan:
    cmp     w3, 2
    b.ge    queue_role_rest
    ldr     w4, [x1, w3, sxtw 2]
    cmp     w4, w0
    b.eq    queue_role_hit
    add     w3, w3, 1
    b       queue_role_scan

queue_role_hit:
    ldr     w0, [x2, w3, sxtw 2]
    ret

queue_role_rest:
    mov     w0, QUEUE_ROLE_NODE
    ret

// queue_draw_slot(w0 = slot) - the slot number and the cell under it, or
// the marker that says this slot is not part of the queue right now
queue_draw_slot:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    bl      queue_col
    mov     w20, w0

    mov     w0, QUEUE_ROW_INDEX
    mov     w1, w20
    bl      ui_at
    mov     w0, QUEUE_ROLE_FAINT
    bl      th_fg
    ldr     x0, =queue_fmt_cell
    mov     w1, w19
    bl      printf
    bl      th_off

    mov     w0, QUEUE_ROW_VALUE
    mov     w1, w20
    bl      ui_at

    mov     w0, w19
    bl      queue_in_use
    cmp     w0, 0
    b.eq    queue_slot_free

    mov     w0, w19
    bl      queue_role_of
    bl      th_bg
    ldr     x0, =queue_data
    ldr     w1, [x0, w19, sxtw 2]
    ldr     x0, =queue_fmt_cell
    bl      printf
    b       queue_slot_close

queue_slot_free:
    mov     w0, QUEUE_ROLE_FAINT
    bl      th_fg
    ldr     x0, =queue_cell_empty
    bl      printf

queue_slot_close:
    bl      th_off

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// queue_render(w0 = slot A, w1 = role A, w2 = slot B, w3 = role B)
// Repaints the buffer, the two markers under it, and the readout. A slot
// of -1 means nothing is highlighted there. The caption row is left
// alone: queue_say owns it.
queue_render:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    ldr     x6, =queue_hl_slot
    str     w0, [x6]
    str     w2, [x6, 4]
    ldr     x6, =queue_hl_role
    str     w1, [x6]
    str     w3, [x6, 4]

    mov     w19, QUEUE_ROW_INDEX
queue_render_wipe:
    cmp     w19, QUEUE_ROW_STATE
    b.gt    queue_render_slots
    mov     w0, w19
    mov     w1, 3
    mov     w2, 76
    bl      queue_blank
    add     w19, w19, 1
    b       queue_render_wipe

queue_render_slots:
    mov     w19, 0
queue_render_loop:
    cmp     w19, queue_max_size
    b.ge    queue_render_marks
    mov     w0, w19
    bl      queue_draw_slot
    add     w19, w19, 1
    b       queue_render_loop

queue_render_marks:
    ldr     x0, =queue_count
    ldr     w20, [x0]
    cmp     w20, 0
    b.le    queue_render_idle

    ldr     x0, =queue_front
    ldr     w19, [x0]
    mov     w0, w19
    bl      queue_col
    mov     w1, w0
    mov     w0, QUEUE_ROW_FRONT
    mov     w2, QUEUE_ROLE_KEY
    ldr     x3, =queue_lbl_front
    bl      ui_badge

    ldr     x0, =queue_rear
    ldr     w21, [x0]
    mov     w0, w21
    bl      queue_col
    mov     w1, w0
    mov     w0, QUEUE_ROW_REAR
    mov     w2, QUEUE_ROLE_KEY
    ldr     x3, =queue_lbl_rear
    bl      ui_badge

    mov     w0, QUEUE_ROW_STATE
    mov     w1, 4
    bl      ui_at
    mov     w0, QUEUE_ROLE_DIM
    bl      th_fg
    ldr     x0, =queue_fmt_state
    mov     w1, w20
    mov     w2, queue_max_size
    mov     w3, w19
    mov     w4, w21
    bl      printf
    bl      th_off
    b       queue_render_legend

queue_render_idle:
    mov     w0, QUEUE_ROW_STATE
    mov     w1, 4
    mov     w2, QUEUE_ROLE_DIM
    ldr     x3, =queue_lbl_nostate
    bl      ui_text

queue_render_legend:
    mov     w0, QUEUE_ROW_LEGEND
    mov     w1, 4
    mov     w2, QUEUE_ROLE_DIM
    ldr     x3, =queue_lbl_rest
    bl      ui_text

    mov     w0, QUEUE_ROW_LEGEND
    mov     w1, 12
    mov     w2, QUEUE_ROLE_NODE
    ldr     x3, =queue_lbl_atrest
    bl      ui_text

    mov     w0, QUEUE_ROW_LEGEND
    mov     w1, 21
    mov     w2, QUEUE_ROLE_HOT
    ldr     x3, =queue_lbl_hand
    bl      ui_text

    mov     w0, QUEUE_ROW_LEGEND
    mov     w1, 30
    mov     w2, QUEUE_ROLE_OK
    ldr     x3, =queue_lbl_joined
    bl      ui_text

    mov     w0, QUEUE_ROW_LEGEND
    mov     w1, 38
    mov     w2, QUEUE_ROLE_WARN
    ldr     x3, =queue_lbl_peeked
    bl      ui_text

    mov     w0, QUEUE_ROW_LEGEND
    mov     w1, 46
    mov     w2, QUEUE_ROLE_BAD
    ldr     x3, =queue_lbl_left
    bl      ui_text

    mov     w0, QUEUE_ROW_LEGEND
    mov     w1, 52
    mov     w2, QUEUE_ROLE_FAINT
    ldr     x3, =queue_lbl_free
    bl      ui_text

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// queue_rest() - repaint with nothing highlighted
queue_rest:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, -1
    mov     w1, 0
    mov     w2, -1
    mov     w3, 0
    bl      queue_render

    ldp     fp, lr, [sp], 16
    ret

// queue_ask(x0 = prompt, w1 = low bound, w2 = high bound, x3 = what to
//           say when the answer falls outside)
//        -> w0 = value, w1 = 1 when the value is usable
// The one reader the module prompts with: it reprompts in place on an
// out-of-range answer and refuses a closed stdin, so a finished script
// walks back out of the menu instead of queueing zeros.
queue_ask:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    mov     x19, x0
    mov     w20, w1
    mov     w21, w2
    mov     x22, x3

queue_ask_loop:
    mov     w0, QUEUE_ROW_SAY
    mov     w1, 2
    mov     w2, 78
    bl      queue_blank

    mov     w0, QUEUE_ROW_SAY
    mov     w1, 4
    mov     x2, x19
    bl      ui_prompt
    bl      queue_flush

    bl      read_int
    mov     w23, w0                         // the value, held across calls
    mov     w24, w1                         // 0 means stdin ended

    cmp     w24, 0
    b.eq    queue_ask_stop

    cmp     w23, w20
    b.lt    queue_ask_range
    cmp     w23, w21
    b.gt    queue_ask_range

    mov     w0, QUEUE_ROW_NOTE
    mov     w1, 2
    mov     w2, 78
    bl      queue_blank                     // no complaint outlives the fix
    mov     w0, w23
    mov     w1, 1
    b       queue_ask_done

queue_ask_range:
    mov     x0, x22
    bl      queue_note
    b       queue_ask_loop

queue_ask_stop:
    mov     w0, 0
    mov     w1, 0

queue_ask_done:
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// queue_enqueue_interactive() - read a value and watch the rear step on
// to the slot that takes it
    .global queue_enqueue_interactive
queue_enqueue_interactive:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    ldr     x0, =queue_scr_enq
    ldr     x1, =queue_hint_run
    ldr     x2, =queue_o1
    ldr     x3, =queue_o1
    ldr     x4, =queue_o1
    ldr     x5, =queue_o1
    bl      queue_frame
    bl      queue_rest

    bl      queue_is_full
    cmp     w0, 1
    b.eq    queue_enq_overflow

    ldr     x0, =queue_ask_value
    mov     w1, -99
    mov     w2, 999
    ldr     x3, =queue_note_value
    bl      queue_ask
    mov     w19, w0                         // the value joining
    mov     w20, w1
    cmp     w20, 0
    b.eq    queue_enq_stopped

    ldr     x0, =queue_rear
    ldr     w21, [x0]                       // the rear as it was

    mov     w0, w19
    bl      queue_enqueue

    ldr     x0, =queue_rear
    ldr     w22, [x0]                       // where the rear landed

    mov     w0, w22
    mov     w1, QUEUE_ROLE_HOT
    mov     w2, -1
    mov     w3, 0
    bl      queue_render
    ldr     x0, =queue_fmt_arrive
    mov     w1, w22
    mov     w2, w19
    bl      queue_say
    mov     w0, 750
    bl      queue_pause

    // the wrap is the whole point of a circular buffer, so it gets said
    cmp     w22, w21
    b.gt    queue_enq_settle

    ldr     x0, =queue_fmt_wrapped
    mov     w1, w22
    mov     w2, 0
    bl      queue_say
    mov     w0, 900
    bl      queue_pause

queue_enq_settle:
    mov     w0, w22
    mov     w1, QUEUE_ROLE_OK
    mov     w2, -1
    mov     w3, 0
    bl      queue_render
    ldr     x0, =queue_count
    ldr     w2, [x0]
    ldr     x0, =queue_fmt_joined
    mov     w1, w19
    bl      queue_say
    b       queue_enq_done

queue_enq_overflow:
    ldr     x0, =queue_msg_full
    mov     w1, 0
    mov     w2, 0
    bl      queue_say
    b       queue_enq_done

queue_enq_stopped:
    ldr     x0, =queue_msg_stopped
    mov     w1, 0
    mov     w2, 0
    bl      queue_say

queue_enq_done:
    bl      queue_flush
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// queue_dequeue_interactive() - let the value that waited longest leave
    .global queue_dequeue_interactive
queue_dequeue_interactive:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    ldr     x0, =queue_scr_deq
    ldr     x1, =queue_hint_run
    ldr     x2, =queue_o1
    ldr     x3, =queue_o1
    ldr     x4, =queue_o1
    ldr     x5, =queue_o1
    bl      queue_frame
    bl      queue_rest

    bl      queue_is_empty
    cmp     w0, 1
    b.eq    queue_deq_underflow

    ldr     x0, =queue_front
    ldr     w20, [x0]                       // the slot being emptied
    bl      queue_peek
    mov     w19, w0                         // the value leaving

    mov     w0, w20
    mov     w1, QUEUE_ROLE_HOT
    mov     w2, -1
    mov     w3, 0
    bl      queue_render
    ldr     x0, =queue_fmt_head
    mov     w1, w20
    mov     w2, w19
    bl      queue_say
    mov     w0, 750
    bl      queue_pause

    mov     w0, w20
    mov     w1, QUEUE_ROLE_BAD
    mov     w2, -1
    mov     w3, 0
    bl      queue_render

    bl      queue_dequeue
    ldr     x0, =queue_front
    ldr     w21, [x0]                       // where the front stepped to

    ldr     x0, =queue_fmt_leaves
    mov     w1, w19
    mov     w2, w21
    bl      queue_say
    mov     w0, 750
    bl      queue_pause

    bl      queue_rest

    ldr     x0, =queue_count
    ldr     w21, [x0]
    cmp     w21, 0
    b.le    queue_deq_drained

    ldr     x0, =queue_fmt_dequeued
    mov     w1, w19
    mov     w2, w21
    bl      queue_say
    b       queue_deq_done

queue_deq_drained:
    ldr     x0, =queue_fmt_drained
    mov     w1, w19
    mov     w2, 0
    bl      queue_say
    b       queue_deq_done

queue_deq_underflow:
    ldr     x0, =queue_msg_empty
    mov     w1, 0
    mov     w2, 0
    bl      queue_say

queue_deq_done:
    bl      queue_flush
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// queue_peek_interactive() - read the front without letting it leave
    .global queue_peek_interactive
queue_peek_interactive:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x0, =queue_scr_peek
    ldr     x1, =queue_hint_run
    ldr     x2, =queue_o1
    ldr     x3, =queue_o1
    ldr     x4, =queue_o1
    ldr     x5, =queue_o1
    bl      queue_frame
    bl      queue_rest

    bl      queue_is_empty
    cmp     w0, 1
    b.eq    queue_peek_none

    ldr     x0, =queue_front
    ldr     w20, [x0]
    bl      queue_peek
    mov     w19, w0

    mov     w0, w20
    mov     w1, QUEUE_ROLE_WARN
    mov     w2, -1
    mov     w3, 0
    bl      queue_render
    ldr     x0, =queue_fmt_peek
    mov     w1, w20
    mov     w2, w19
    bl      queue_say
    b       queue_peek_out

queue_peek_none:
    ldr     x0, =queue_msg_empty
    mov     w1, 0
    mov     w2, 0
    bl      queue_say

queue_peek_out:
    bl      queue_flush
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// queue_display() - the buffer as it stands, nothing moving
    .global queue_display
queue_display:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =queue_scr_show
    ldr     x1, =queue_hint_run
    ldr     x2, =queue_o1
    ldr     x3, =queue_o1
    ldr     x4, =queue_o1
    ldr     x5, =queue_on
    bl      queue_frame
    bl      queue_rest

    ldr     x0, =queue_count
    ldr     w19, [x0]
    cmp     w19, 0
    b.le    queue_display_empty

    ldr     x0, =queue_fmt_line
    mov     w1, w19
    mov     w2, 0
    bl      queue_say
    b       queue_display_done

queue_display_empty:
    ldr     x0, =queue_msg_empty
    mov     w1, 0
    mov     w2, 0
    bl      queue_say

queue_display_done:
    bl      queue_flush
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// queue_clear_interactive() - front, rear, and count back to the start
queue_clear_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =queue_scr_clear
    ldr     x1, =queue_hint_run
    ldr     x2, =queue_o1
    ldr     x3, =queue_o1
    ldr     x4, =queue_o1
    ldr     x5, =queue_o1
    bl      queue_frame

    bl      queue_clear

    bl      queue_rest
    ldr     x0, =queue_msg_cleared
    mov     w1, 0
    mov     w2, 0
    bl      queue_say
    bl      queue_flush

    ldp     fp, lr, [sp], 16
    ret

// queue_enqueue(w0 = value) -> w0 = 1 on success, 0 when the buffer is
// full. No calls, so scratch registers are all it needs and no caller
// state is at risk.
    .global queue_enqueue
queue_enqueue:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x1, =queue_count
    ldr     w2, [x1]

    cmp     w2, queue_max_size
    b.ge    queue_enqueue_fail

    ldr     x3, =queue_rear
    ldr     w4, [x3]

    add     w4, w4, 1                       // rear = (rear + 1) mod size
    mov     w5, queue_max_size
    udiv    w6, w4, w5
    msub    w4, w6, w5, w4

    ldr     x6, =queue_data
    str     w0, [x6, w4, sxtw 2]
    str     w4, [x3]

    add     w2, w2, 1
    str     w2, [x1]

    mov     w0, 1
    b       queue_enqueue_ret

queue_enqueue_fail:
    mov     w0, 0

queue_enqueue_ret:
    ldp     fp, lr, [sp], 16
    ret

// queue_dequeue() -> w0 = the value that was at the front, 0 if empty
    .global queue_dequeue
queue_dequeue:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x1, =queue_count
    ldr     w2, [x1]

    cmp     w2, 0
    b.le    queue_dequeue_fail

    ldr     x3, =queue_front
    ldr     w4, [x3]

    ldr     x5, =queue_data
    ldr     w0, [x5, w4, sxtw 2]

    add     w4, w4, 1                       // front = (front + 1) mod size
    mov     w5, queue_max_size
    udiv    w6, w4, w5
    msub    w4, w6, w5, w4
    str     w4, [x3]

    sub     w2, w2, 1
    str     w2, [x1]
    b       queue_dequeue_ret

queue_dequeue_fail:
    mov     w0, 0

queue_dequeue_ret:
    ldp     fp, lr, [sp], 16
    ret

// queue_peek() -> w0 = the front value, 0 if empty, nothing moved
    .global queue_peek
queue_peek:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x1, =queue_count
    ldr     w2, [x1]

    cmp     w2, 0
    b.le    queue_peek_fail

    ldr     x3, =queue_front
    ldr     w4, [x3]
    ldr     x5, =queue_data
    ldr     w0, [x5, w4, sxtw 2]
    b       queue_peek_ret

queue_peek_fail:
    mov     w0, 0

queue_peek_ret:
    ldp     fp, lr, [sp], 16
    ret

// queue_is_empty() -> w0 = 1 if empty, 0 otherwise
    .global queue_is_empty
queue_is_empty:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =queue_count
    ldr     w0, [x0]

    cmp     w0, 0
    b.le    queue_empty_yes
    mov     w0, 0
    b       queue_empty_ret

queue_empty_yes:
    mov     w0, 1

queue_empty_ret:
    ldp     fp, lr, [sp], 16
    ret

// queue_is_full() -> w0 = 1 if full, 0 otherwise
    .global queue_is_full
queue_is_full:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =queue_count
    ldr     w0, [x0]

    cmp     w0, queue_max_size
    b.ge    queue_full_yes
    mov     w0, 0
    b       queue_full_ret

queue_full_yes:
    mov     w0, 1

queue_full_ret:
    ldp     fp, lr, [sp], 16
    ret

// queue_clear() - front, rear, and count back to the empty state
    .global queue_clear
queue_clear:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =queue_front
    str     wzr, [x0]

    ldr     x0, =queue_rear
    mov     w1, -1                          // -1 marks a rear with no slot
    str     w1, [x0]

    ldr     x0, =queue_count
    str     wzr, [x0]

    ldr     x0, =queue_hl_slot
    str     w1, [x0]
    str     w1, [x0, 4]

    ldp     fp, lr, [sp], 16
    ret

// accessors for the c++ build: read the state without touching it

// queue_get_data() -> x0 = address of the buffer
    .global queue_get_data
queue_get_data:
    ldr     x0, =queue_data
    ret

// queue_get_front() -> w0 = the slot the next dequeue reads
    .global queue_get_front
queue_get_front:
    ldr     x0, =queue_front
    ldr     w0, [x0]
    ret

// queue_get_rear() -> w0 = the slot the last enqueue wrote, -1 if none
    .global queue_get_rear
queue_get_rear:
    ldr     x0, =queue_rear
    ldr     w0, [x0]
    ret

// queue_get_count() -> w0 = how many values are waiting
    .global queue_get_count
queue_get_count:
    ldr     x0, =queue_count
    ldr     w0, [x0]
    ret

// queue_get_capacity() -> w0 = how many slots there are
    .global queue_get_capacity
queue_get_capacity:
    mov     w0, queue_max_size
    ret
