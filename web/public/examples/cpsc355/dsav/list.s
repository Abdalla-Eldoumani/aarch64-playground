// linkedlist_viz.asm - a singly linked list, drawn as the chain of
// pointers it really is
//
// Almost every operation here is the same walk: start at head, follow
// next, stop when the pointer runs out. Insert at the front is the one
// that never walks, and showing both in the same picture is the reason
// this module earns a screen: the shape is identical, the cost is not.

define(fp, x29)
define(lr, x30)

// node layout: the value, then the address of the next node
    LIST_NODE_DATA = 0
    LIST_NODE_NEXT = 8
    LIST_NODE_SIZE = 16

// Role numbers mirror the UI_ROLE_* set in ui.asm. They are repeated here
// so this file also assembles on its own, the way the web build feeds it.
    LIST_ROLE_TEXT  = 0
    LIST_ROLE_DIM   = 1
    LIST_ROLE_FAINT = 2
    LIST_ROLE_KEY   = 4
    LIST_ROLE_OK    = 5
    LIST_ROLE_WARN  = 6
    LIST_ROLE_HOT   = 7
    LIST_ROLE_BAD   = 8
    LIST_ROLE_NODE  = 9

    LIST_PER_ROW    = 7                     // cells that fit across
    LIST_SHOWN      = 28                    // four lines of them

    .data
    .balign 8

list_head:          .dword 0                // first node, 0 when empty
list_hl_node:       .dword 0, 0             // nodes wearing a state colour

    .balign 4
list_count:         .word 0
list_hl_role:       .word 0, 0

// Cell columns. A cell is five wide and the arrow after it takes three,
// which leaves two columns of air between neighbours.
list_col_tab:       .word 4, 14, 24, 34, 44, 54, 64
list_row_tab:       .word 7, 9, 11, 13

list_cell:          .skip 8                 // one value, formatted

list_sp:            .string " "
list_arrow:         .string "\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x96\xb8"
list_down:          .string "\xe2\x96\xbe"
list_fmt_cell:      .string "%3d"
list_fmt_count:     .string "%d nodes"
list_null:          .string "null"
list_lbl_head:      .string "head"

list_scr_menu:      .string "linked list  \xc2\xb7  nodes joined by pointers"
list_scr_front:     .string "linked list  \xc2\xb7  insert at the front"
list_scr_back:      .string "linked list  \xc2\xb7  insert at the back"
list_scr_delete:    .string "linked list  \xc2\xb7  delete by value"
list_scr_search:    .string "linked list  \xc2\xb7  search"
list_scr_show:      .string "linked list  \xc2\xb7  the chain right now"
list_scr_clear:     .string "linked list  \xc2\xb7  clear"

list_pan_ops:       .string "operations"
list_pan_chain:     .string "the chain"

list_hint_menu:     .string "pick an operation  \xc2\xb7  0 goes back to the main menu"
list_hint_run:      .string "enter returns to the list menu  \xc2\xb7  every walk starts at head"

list_opt_1:         .string "insert at the front, where nothing has to move"
list_opt_2:         .string "insert at the back, and watch the walk it costs"
list_opt_3:         .string "delete the first node holding a value"
list_opt_4:         .string "search for a value, one node at a time"
list_opt_5:         .string "show the chain as it stands"
list_opt_6:         .string "clear the list and hand the memory back"
list_opt_0:         .string "back to the main menu"

list_key_1:         .string "1"
list_key_2:         .string "2"
list_key_3:         .string "3"
list_key_4:         .string "4"
list_key_5:         .string "5"
list_key_6:         .string "6"
list_key_0:         .string "0"

list_lg_hand:       .string "in hand"
list_lg_cmp:        .string "comparing"
list_lg_set:        .string "settled"
list_lg_gone:       .string "leaving"
list_lg_rest:       .string "at rest"

list_lbl_pointer:   .string "a node holds a value and the address of the next one"
list_lbl_more:      .string "the first %d nodes are drawn; %d more follow off the picture"

list_ask_choice:    .string "choice "
list_ask_value:     .string "value to insert (-99 to 999)  "
list_ask_delete:    .string "value to delete  "
list_ask_search:    .string "value to look for  "

list_o1:            .string "O(1)"
list_on:            .string "O(n)"

list_msg_empty:     .string "the list is empty. insert a value at either end to start a chain"
list_msg_range:     .string "values run from -99 to 999, so every cell stays the same width"
list_msg_cleared:   .string "cleared. every node went back to the allocator"
list_msg_alloc:     .string "the allocator refused a node, so nothing was inserted"
list_msg_start:     .string "the walk starts at head, the only address the program keeps"
list_msg_ready:     .string "press enter, and the walk sets off from head one node at a time"

list_fmt_new_head:  .string "%d becomes the new head, and the old head becomes its next"
list_fmt_front_ok:  .string "inserted %d at the front: one store, and the cost never grows"
list_fmt_first:     .string "the chain was empty, so %d is the head and the tail at once"
list_fmt_walk:      .string "node %d is not the last one, so follow its next pointer"
list_fmt_tail:      .string "node %d is the tail: its next is null, which is where %d goes"
list_fmt_back_ok:   .string "inserted %d at the back after stepping past %d nodes to reach it"
list_fmt_check:     .string "checking node %d at index %d"
list_fmt_found:     .string "found %d at index %d after %d comparisons"
list_fmt_missing:   .string "walked the whole chain and %d never turned up"
list_fmt_unlink:    .string "found %d, and the node before it now points straight past"
list_fmt_head_gone: .string "%d is the head, so head moves on and this node is handed back"
list_fmt_deleted:   .string "deleted %d, and the chain is one node shorter"
list_fmt_state:     .string "%d nodes, and head is the only one reachable without a walk"

    .text
    .balign 4

// linkedlist_menu() - operations menu; choice 0 frees the list and hands
// control back to main
    .global linkedlist_menu
linkedlist_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

list_menu_loop:
    bl      list_menu_draw

    mov     w0, 0
    mov     w1, 6
    bl      read_int_range

    cmp     w0, 0
    b.eq    list_menu_exit
    cmp     w0, 1
    b.eq    list_menu_front
    cmp     w0, 2
    b.eq    list_menu_back
    cmp     w0, 3
    b.eq    list_menu_delete
    cmp     w0, 4
    b.eq    list_menu_search
    cmp     w0, 5
    b.eq    list_menu_show
    cmp     w0, 6
    b.eq    list_menu_clear
    b       list_menu_loop

list_menu_front:
    bl      list_insert_front_interactive
    bl      wait_for_enter
    b       list_menu_loop

list_menu_back:
    bl      list_insert_back_interactive
    bl      wait_for_enter
    b       list_menu_loop

list_menu_delete:
    bl      list_delete_interactive
    bl      wait_for_enter
    b       list_menu_loop

list_menu_search:
    bl      list_search_interactive
    bl      wait_for_enter
    b       list_menu_loop

list_menu_show:
    bl      list_show
    bl      wait_for_enter
    b       list_menu_loop

list_menu_clear:
    bl      list_clear_interactive
    bl      wait_for_enter
    b       list_menu_loop

list_menu_exit:
    bl      list_free_all                   // nothing outlives the module
    ldp     fp, lr, [sp], 16
    ret

// list_menu_draw() - the operations screen
list_menu_draw:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =list_scr_menu
    bl      ui_screen

    ldr     x0, =list_hint_menu
    bl      ui_footer

    mov     w0, 4
    mov     w1, 11
    mov     w2, 58
    mov     w3, 13
    ldr     x4, =list_pan_ops
    bl      ui_panel

    mov     w0, 6
    ldr     x1, =list_key_1
    ldr     x2, =list_opt_1
    bl      list_menu_line

    mov     w0, 7
    ldr     x1, =list_key_2
    ldr     x2, =list_opt_2
    bl      list_menu_line

    mov     w0, 8
    ldr     x1, =list_key_3
    ldr     x2, =list_opt_3
    bl      list_menu_line

    mov     w0, 9
    ldr     x1, =list_key_4
    ldr     x2, =list_opt_4
    bl      list_menu_line

    mov     w0, 10
    ldr     x1, =list_key_5
    ldr     x2, =list_opt_5
    bl      list_menu_line

    mov     w0, 11
    ldr     x1, =list_key_6
    ldr     x2, =list_opt_6
    bl      list_menu_line

    mov     w0, 12
    ldr     x1, =list_key_0
    ldr     x2, =list_opt_0
    bl      list_menu_line

    // how long the chain is, so the menu is never a dead end
    mov     w0, 14
    mov     w1, 14
    bl      ui_at
    mov     w0, LIST_ROLE_DIM
    bl      th_fg
    ldr     x19, =list_count
    ldr     w1, [x19]
    ldr     x0, =list_fmt_count
    bl      printf
    bl      th_off

    mov     w0, 18
    mov     w1, 14
    ldr     x2, =list_ask_choice
    bl      ui_prompt
    bl      list_flush

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// list_menu_line(w0 = row, x1 = key text, x2 = option text)
list_menu_line:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    mov     x21, x1
    mov     x20, x2

    mov     w0, w19
    mov     w1, 14
    mov     w2, LIST_ROLE_KEY
    mov     x3, x21
    bl      ui_badge

    mov     w0, w19
    mov     w1, 18
    mov     w2, LIST_ROLE_TEXT
    mov     x3, x20
    bl      ui_text

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// list_frame(x0 = screen title, x1 = footer hint, x2 = best, x3 = avg,
//            x4 = worst, x5 = space, w6 = 1 to carry the legend)
// Everything on an operation screen that does not move while it runs.
list_frame:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    str     x25, [sp, 64]

    mov     x19, x0
    mov     x20, x1
    mov     x21, x2
    mov     x22, x3
    mov     x23, x4
    mov     x24, x5
    mov     w25, w6

    mov     x0, x19
    bl      ui_screen

    mov     x0, x20
    bl      ui_footer

    mov     w0, 4
    mov     w1, 2
    mov     w2, 78
    mov     w3, 12
    ldr     x4, =list_pan_chain
    bl      ui_panel

    cbz     w25, list_frame_teach
    bl      list_legend

list_frame_teach:
    mov     w0, 17
    mov     w1, 4
    mov     w2, LIST_ROLE_DIM
    ldr     x3, =list_lbl_pointer
    bl      ui_text

    mov     w0, 20
    mov     w1, 4
    mov     x2, x21
    mov     x3, x22
    mov     x4, x23
    mov     x5, x24
    bl      ui_complexity

    ldr     x25, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// list_legend() - the five states a cell can wear while an operation runs
list_legend:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, 16
    mov     w1, 4
    mov     w2, LIST_ROLE_HOT
    ldr     x3, =list_lg_hand
    bl      ui_badge

    mov     w0, 16
    mov     w1, 15
    mov     w2, LIST_ROLE_WARN
    ldr     x3, =list_lg_cmp
    bl      ui_badge

    mov     w0, 16
    mov     w1, 28
    mov     w2, LIST_ROLE_OK
    ldr     x3, =list_lg_set
    bl      ui_badge

    mov     w0, 16
    mov     w1, 39
    mov     w2, LIST_ROLE_BAD
    ldr     x3, =list_lg_gone
    bl      ui_badge

    mov     w0, 16
    mov     w1, 50
    mov     w2, LIST_ROLE_NODE
    ldr     x3, =list_lg_rest
    bl      ui_badge

    ldp     fp, lr, [sp], 16
    ret

// list_blank(w0 = row, w1 = column, w2 = run length) - wipe a run of
// cells without disturbing the borders on either side
list_blank:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w2
    bl      ui_at
    ldr     x0, =list_sp
    mov     w1, w19
    bl      ui_repeat

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// list_flush() - push the drawing out before a delay, or the whole
// animation arrives at once
list_flush:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     x0, 0
    bl      fflush

    ldp     fp, lr, [sp], 16
    ret

// list_pause(w0 = milliseconds)
list_pause:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0
    bl      list_flush
    mov     w0, w19
    bl      delay_ms

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// list_say(x0 = format, w1 = first value, w2 = second, w3 = third)
// The one line that narrates what just happened. It wipes the row first,
// so a prompt or an older caption never shows through.
list_say:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     x19, x0
    mov     w20, w1
    mov     w21, w2
    mov     w22, w3

    mov     w0, 19
    mov     w1, 2
    mov     w2, 78
    bl      list_blank

    mov     w0, 19
    mov     w1, 4
    bl      ui_at
    mov     w0, LIST_ROLE_TEXT
    bl      th_fg
    mov     x0, x19
    mov     w1, w20
    mov     w2, w21
    mov     w3, w22
    bl      printf
    bl      th_off

    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// list_role_of(x0 = node) -> w0 = the colour role this node wears now
list_role_of:
    ldr     x1, =list_hl_node
    ldr     x2, =list_hl_role
    mov     w3, 0

list_role_scan:
    cmp     w3, 2
    b.ge    list_role_rest
    ldr     x4, [x1, w3, sxtw 3]
    cmp     x4, x0
    b.eq    list_role_hit
    add     w3, w3, 1
    b       list_role_scan

list_role_hit:
    ldr     w0, [x2, w3, sxtw 2]
    ret

list_role_rest:
    mov     w0, LIST_ROLE_NODE
    ret

// list_chip(w0 = row, w1 = col, w2 = role, w3 = value) - one filled cell
list_chip:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    mov     w20, w1
    mov     w21, w2

    ldr     x0, =list_cell
    mov     w1, w3
    mov     w2, 2                           // the cell is two columns wide
    bl      ui_num

    mov     w0, w19
    mov     w1, w20
    mov     w2, w21
    ldr     x3, =list_cell
    bl      ui_badge

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// list_slot_at(w0 = index) -> w0 = row, w1 = column
// Seven cells to a line, four lines, and past that the picture says so
// rather than running off the frame.
list_slot_at:
    mov     w1, LIST_PER_ROW
    udiv    w2, w0, w1
    msub    w3, w2, w1, w0                  // which cell along the line
    ldr     x4, =list_row_tab
    ldr     w5, [x4, w2, sxtw 2]
    ldr     x4, =list_col_tab
    ldr     w1, [x4, w3, sxtw 2]
    mov     w0, w5
    ret

// list_render(x0 = node A, w1 = role A, x2 = node B, w3 = role B)
// Repaints the chain. A node of 0 means nothing is highlighted there.
// The caption row is left alone: list_say owns it.
list_render:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    str     x25, [sp, 64]

    ldr     x6, =list_hl_node
    str     x0, [x6]
    str     x2, [x6, 8]
    ldr     x6, =list_hl_role
    str     w1, [x6]
    str     w3, [x6, 4]

    mov     w19, 5
list_render_wipe:
    cmp     w19, 14
    b.gt    list_render_head
    mov     w0, w19
    mov     w1, 3
    mov     w2, 76
    bl      list_blank
    add     w19, w19, 1
    b       list_render_wipe

list_render_head:
    mov     w0, 5
    mov     w1, 4
    mov     w2, LIST_ROLE_KEY
    ldr     x3, =list_lbl_head
    bl      ui_text

    mov     w0, 6
    mov     w1, 6
    mov     w2, LIST_ROLE_FAINT
    ldr     x3, =list_down
    bl      ui_text

    ldr     x0, =list_head
    ldr     x19, [x0]                       // the node being drawn
    cbz     x19, list_render_empty

    mov     w20, 0                          // how far along the chain it is

list_render_loop:
    cbz     x19, list_render_done
    cmp     w20, LIST_SHOWN
    b.ge    list_render_more

    mov     w0, w20
    bl      list_slot_at
    mov     w21, w0                         // row
    mov     w22, w1                         // column

    mov     x0, x19
    bl      list_role_of
    mov     w23, w0

    ldr     w3, [x19, LIST_NODE_DATA]
    mov     w0, w21
    mov     w1, w22
    mov     w2, w23
    bl      list_chip

    // the arrow out of this node, and whatever it lands on
    ldr     x24, [x19, LIST_NODE_NEXT]
    mov     w0, w21
    add     w1, w22, 5
    mov     w2, LIST_ROLE_FAINT
    ldr     x3, =list_arrow
    bl      ui_text

    cbnz    x24, list_render_step

    mov     w0, w21
    add     w1, w22, 10
    mov     w2, LIST_ROLE_FAINT
    ldr     x3, =list_null
    bl      ui_text

list_render_step:
    mov     x19, x24
    add     w20, w20, 1
    b       list_render_loop

list_render_more:
    ldr     x0, =list_count
    ldr     w25, [x0]
    sub     w25, w25, LIST_SHOWN
    mov     w0, 14
    mov     w1, 4
    bl      ui_at
    mov     w0, LIST_ROLE_FAINT
    bl      th_fg
    ldr     x0, =list_lbl_more
    mov     w1, LIST_SHOWN
    mov     w2, w25
    bl      printf
    bl      th_off
    b       list_render_done

list_render_empty:
    mov     w0, 7
    mov     w1, 5
    mov     w2, LIST_ROLE_FAINT
    ldr     x3, =list_null
    bl      ui_text

list_render_done:
    ldr     x25, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// list_rest() - repaint with nothing highlighted
list_rest:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     x0, 0
    mov     w1, 0
    mov     x2, 0
    mov     w3, 0
    bl      list_render

    ldp     fp, lr, [sp], 16
    ret

// list_ask(x0 = prompt) -> w0 = value, w1 = 1 when the value is usable
// One reader for all three prompts. It refuses a closed stdin and a value
// too wide for a cell, so the drawing can never be pushed out of shape.
list_ask:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0

    mov     w0, 18
    mov     w1, 2
    mov     w2, 78
    bl      list_blank
    mov     w0, 18
    mov     w1, 4
    mov     x2, x19
    bl      ui_prompt
    bl      list_flush

    bl      read_int
    mov     w19, w0
    mov     w20, w1

    cbz     w20, list_ask_stop              // stdin closed: walk out quietly

    cmp     w19, -99
    b.lt    list_ask_range
    cmp     w19, 999
    b.gt    list_ask_range

    mov     w0, w19
    mov     w1, 1
    b       list_ask_done

list_ask_range:
    ldr     x0, =list_msg_range
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      list_say
    mov     w0, 0
    mov     w1, 0
    b       list_ask_done

list_ask_stop:
    mov     w0, 0
    mov     w1, 0

list_ask_done:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// list_create_node(w0 = value) -> x0 = new node, 0 when malloc refused
    .global list_create_node
list_create_node:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0                         // the value has to survive malloc

    mov     x0, LIST_NODE_SIZE
    bl      malloc
    cbz     x0, list_create_done

    str     w19, [x0, LIST_NODE_DATA]
    str     xzr, [x0, LIST_NODE_NEXT]

list_create_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// list_free_all() - free every node and reset head and count
    .global list_free_all
list_free_all:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x0, =list_head
    ldr     x19, [x0]

list_free_loop:
    cbz     x19, list_free_done
    ldr     x20, [x19, LIST_NODE_NEXT]      // grab next before the node goes
    mov     x0, x19
    bl      free
    mov     x19, x20
    b       list_free_loop

list_free_done:
    ldr     x0, =list_head
    str     xzr, [x0]
    ldr     x0, =list_count
    str     wzr, [x0]

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// list_insert_front_interactive() - the cheap end: one store and done
list_insert_front_interactive:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    ldr     x0, =list_scr_front
    ldr     x1, =list_hint_run
    ldr     x2, =list_o1
    ldr     x3, =list_o1
    ldr     x4, =list_o1
    ldr     x5, =list_o1
    mov     w6, 1
    bl      list_frame
    bl      list_rest

    ldr     x0, =list_ask_value
    bl      list_ask
    mov     w19, w0
    mov     w20, w1
    cbz     w20, list_front_done

    mov     w0, w19
    bl      list_create_node
    mov     x21, x0
    cbz     x21, list_front_alloc

    ldr     x22, =list_head
    ldr     x0, [x22]
    str     x0, [x21, LIST_NODE_NEXT]       // the old head becomes second
    str     x21, [x22]

    ldr     x22, =list_count
    ldr     w0, [x22]
    add     w0, w0, 1
    str     w0, [x22]
    mov     w22, w0                         // the new length, for the caption

    mov     x0, x21
    mov     w1, LIST_ROLE_HOT
    mov     x2, 0
    mov     w3, 0
    bl      list_render

    cmp     w22, 1
    b.eq    list_front_first

    ldr     x0, =list_fmt_new_head
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      list_say
    b       list_front_settle

list_front_first:
    ldr     x0, =list_fmt_first
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      list_say

list_front_settle:
    mov     w0, 850
    bl      list_pause

    mov     x0, x21
    mov     w1, LIST_ROLE_OK
    mov     x2, 0
    mov     w3, 0
    bl      list_render
    ldr     x0, =list_fmt_front_ok
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      list_say
    b       list_front_done

list_front_alloc:
    ldr     x0, =list_msg_alloc
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      list_say

list_front_done:
    bl      list_flush
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// list_insert_back_interactive() - the same insert, one walk more
// expensive, and the walk is the whole point
list_insert_back_interactive:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x0, =list_scr_back
    ldr     x1, =list_hint_run
    ldr     x2, =list_on
    ldr     x3, =list_on
    ldr     x4, =list_on
    ldr     x5, =list_o1
    mov     w6, 1
    bl      list_frame
    bl      list_rest

    ldr     x0, =list_ask_value
    bl      list_ask
    mov     w19, w0
    mov     w20, w1
    cbz     w20, list_back_done

    mov     w0, w19
    bl      list_create_node
    mov     x21, x0
    cbz     x21, list_back_alloc

    ldr     x24, =list_head
    ldr     x22, [x24]                      // the node the walk stands on
    cbz     x22, list_back_empty

    mov     w23, 0                          // nodes stepped past

    ldr     x0, =list_msg_start
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      list_say
    mov     w0, 500
    bl      list_pause

list_back_walk:
    mov     x0, x22
    mov     w1, LIST_ROLE_WARN
    mov     x2, 0
    mov     w3, 0
    bl      list_render

    ldr     x0, [x22, LIST_NODE_NEXT]
    cbz     x0, list_back_at_tail

    ldr     w1, [x22, LIST_NODE_DATA]
    ldr     x0, =list_fmt_walk
    mov     w2, 0
    mov     w3, 0
    bl      list_say
    mov     w0, 550
    bl      list_pause

    ldr     x22, [x22, LIST_NODE_NEXT]
    add     w23, w23, 1
    b       list_back_walk

list_back_at_tail:
    ldr     w1, [x22, LIST_NODE_DATA]
    ldr     x0, =list_fmt_tail
    mov     w2, w19
    mov     w3, 0
    bl      list_say
    mov     w0, 750
    bl      list_pause

    str     x21, [x22, LIST_NODE_NEXT]
    add     w23, w23, 1
    b       list_back_link

list_back_empty:
    str     x21, [x24]
    mov     w23, 0

list_back_link:
    ldr     x24, =list_count
    ldr     w0, [x24]
    add     w0, w0, 1
    str     w0, [x24]

    mov     x0, x21
    mov     w1, LIST_ROLE_HOT
    mov     x2, 0
    mov     w3, 0
    bl      list_render

    cbnz    w23, list_back_report

    ldr     x0, =list_fmt_first
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      list_say
    b       list_back_settle

list_back_report:
    ldr     x0, =list_fmt_back_ok
    mov     w1, w19
    mov     w2, w23
    mov     w3, 0
    bl      list_say

list_back_settle:
    mov     w0, 850
    bl      list_pause

    mov     x0, x21
    mov     w1, LIST_ROLE_OK
    mov     x2, 0
    mov     w3, 0
    bl      list_render
    b       list_back_done

list_back_alloc:
    ldr     x0, =list_msg_alloc
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      list_say

list_back_done:
    bl      list_flush
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// list_delete_interactive() - walk to the first node holding the value,
// point whatever came before it straight past, and hand the node back
list_delete_interactive:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x0, =list_scr_delete
    ldr     x1, =list_hint_run
    ldr     x2, =list_o1
    ldr     x3, =list_on
    ldr     x4, =list_on
    ldr     x5, =list_o1
    mov     w6, 1
    bl      list_frame
    bl      list_rest

    ldr     x0, =list_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    list_delete_empty

    ldr     x0, =list_ask_delete
    bl      list_ask
    mov     w19, w0
    mov     w20, w1
    cbz     w20, list_delete_done

    ldr     x0, =list_head
    ldr     x21, [x0]                       // the node under inspection
    mov     x22, 0                          // the one before it

list_delete_walk:
    cbz     x21, list_delete_missing

    mov     x0, x21
    mov     w1, LIST_ROLE_WARN
    mov     x2, x22
    mov     w3, LIST_ROLE_NODE
    bl      list_render

    ldr     w1, [x21, LIST_NODE_DATA]
    ldr     x0, =list_fmt_check
    mov     w2, 0
    mov     w3, 0
    bl      list_say
    mov     w0, 500
    bl      list_pause

    ldr     w0, [x21, LIST_NODE_DATA]
    cmp     w0, w19
    b.eq    list_delete_hit

    mov     x22, x21
    ldr     x21, [x21, LIST_NODE_NEXT]
    b       list_delete_walk

list_delete_hit:
    mov     x0, x21
    mov     w1, LIST_ROLE_BAD
    mov     x2, x22
    mov     w3, LIST_ROLE_WARN
    bl      list_render

    cbnz    x22, list_delete_middle

    ldr     x0, =list_fmt_head_gone
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      list_say
    mov     w0, 850
    bl      list_pause

    ldr     x23, [x21, LIST_NODE_NEXT]
    ldr     x24, =list_head
    str     x23, [x24]
    b       list_delete_release

list_delete_middle:
    ldr     x0, =list_fmt_unlink
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      list_say
    mov     w0, 850
    bl      list_pause

    ldr     x23, [x21, LIST_NODE_NEXT]
    str     x23, [x22, LIST_NODE_NEXT]

list_delete_release:
    mov     x0, x21
    bl      free

    ldr     x24, =list_count
    ldr     w0, [x24]
    sub     w0, w0, 1
    str     w0, [x24]

    bl      list_rest
    ldr     x0, =list_fmt_deleted
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      list_say
    b       list_delete_done

list_delete_missing:
    bl      list_rest
    ldr     x0, =list_fmt_missing
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      list_say
    b       list_delete_done

list_delete_empty:
    ldr     x0, =list_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      list_say

list_delete_done:
    bl      list_flush
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// list_search_interactive() - the walk with nothing hidden: one node a
// beat, and a count of how many had to be read
list_search_interactive:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x0, =list_scr_search
    ldr     x1, =list_hint_run
    ldr     x2, =list_o1
    ldr     x3, =list_on
    ldr     x4, =list_on
    ldr     x5, =list_o1
    mov     w6, 1
    bl      list_frame
    bl      list_rest

    ldr     x0, =list_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    list_search_empty

    ldr     x0, =list_ask_search
    bl      list_ask
    mov     w19, w0
    mov     w20, w1
    cbz     w20, list_search_done

    ldr     x0, =list_msg_ready
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      list_say
    bl      list_flush
    bl      wait_for_enter                  // the walk sets off on a keypress

    ldr     x0, =list_head
    ldr     x21, [x0]                       // the node under inspection
    mov     w22, 0                          // how far along it sits
    mov     w23, 0                          // comparisons made

list_search_walk:
    cbz     x21, list_search_missing

    mov     x0, x21
    mov     w1, LIST_ROLE_WARN
    mov     x2, 0
    mov     w3, 0
    bl      list_render

    add     w23, w23, 1
    ldr     w1, [x21, LIST_NODE_DATA]
    mov     w2, w22
    ldr     x0, =list_fmt_check
    mov     w3, 0
    bl      list_say
    mov     w0, 500
    bl      list_pause

    ldr     w0, [x21, LIST_NODE_DATA]
    cmp     w0, w19
    b.eq    list_search_hit

    ldr     x21, [x21, LIST_NODE_NEXT]
    add     w22, w22, 1
    b       list_search_walk

list_search_hit:
    mov     x0, x21
    mov     w1, LIST_ROLE_OK
    mov     x2, 0
    mov     w3, 0
    bl      list_render
    ldr     x0, =list_fmt_found
    mov     w1, w19
    mov     w2, w22
    mov     w3, w23
    bl      list_say
    b       list_search_done

list_search_missing:
    bl      list_rest
    ldr     x0, =list_fmt_missing
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      list_say
    b       list_search_done

list_search_empty:
    ldr     x0, =list_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      list_say

list_search_done:
    bl      list_flush
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// list_show() - the chain, nothing moving
list_show:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =list_scr_show
    ldr     x1, =list_hint_run
    ldr     x2, =list_o1
    ldr     x3, =list_on
    ldr     x4, =list_on
    ldr     x5, =list_o1
    mov     w6, 0
    bl      list_frame
    bl      list_rest

    ldr     x0, =list_count
    ldr     w19, [x0]
    cmp     w19, 0
    b.le    list_show_empty

    ldr     x0, =list_fmt_state
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      list_say
    b       list_show_done

list_show_empty:
    ldr     x0, =list_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      list_say

list_show_done:
    bl      list_flush
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// list_clear_interactive() - every node back to the allocator
list_clear_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =list_scr_clear
    ldr     x1, =list_hint_run
    ldr     x2, =list_on
    ldr     x3, =list_on
    ldr     x4, =list_on
    ldr     x5, =list_o1
    mov     w6, 0
    bl      list_frame

    bl      list_free_all

    bl      list_rest
    ldr     x0, =list_msg_cleared
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      list_say
    bl      list_flush

    ldp     fp, lr, [sp], 16
    ret
