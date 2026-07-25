// heap_viz.asm - binary min-heap, drawn as a tree and as the array it
// really is
//
// The tree on the top half and the strip on the bottom half are painted
// from the same fifteen words. A sift moves a value in both at once,
// which is the whole point: the picture a student draws on paper and the
// memory the machine keeps are one object addressed two ways.
//
// heap_sort_array is the silent twin of all this - the same sift, no
// screen, so the sorting module can borrow it.

define(fp, x29)
define(lr, x30)

    .data
    .balign 8

    heap_capacity = 15

// Role numbers mirror ui.asm's UI_ROLE_* set. They are repeated here so
// this file also assembles on its own, the way the web build feeds it.
    HEAP_ROLE_TEXT  = 0
    HEAP_ROLE_DIM   = 1
    HEAP_ROLE_FAINT = 2
    HEAP_ROLE_KEY   = 4
    HEAP_ROLE_OK    = 5
    HEAP_ROLE_WARN  = 6
    HEAP_ROLE_HOT   = 7
    HEAP_ROLE_NODE  = 9

heap_data:          .skip heap_capacity * 4
    .balign 4
heap_count:         .word 0

// Where each node's four-column cell starts. Slot 0 sits at the middle
// of the panel and every level below splits the space evenly, so a
// parent's elbow lands between its two children instead of near one.
heap_col_tab:       .word 38
                    .word 20, 56
                    .word 11, 29, 47, 65
                    .word 6, 15, 24, 33, 42, 51, 60, 69

heap_row_tab:       .word 5
                    .word 7, 7
                    .word 9, 9, 9, 9
                    .word 11, 11, 11, 11, 11, 11, 11, 11

// The row each parent's elbow is drawn on.
heap_link_row:      .word 6, 8, 8, 10, 10, 10, 10

// The slots painted in something other than their resting colour this
// frame. heap_render fills these in; heap_role_of reads them back, so a
// cell's colour is data rather than a branch at every draw site.
heap_hl_slot:       .word -1, -1, -1
heap_hl_role:       .word 0, 0, 0

heap_sp:            .string " "
heap_dash:          .string "\xe2\x94\x80"   // horizontal rule
heap_tee:           .string "\xe2\x94\xb4"   // parent with two children
heap_elbow_l:       .string "\xe2\x95\xad"   // down to the left child
heap_elbow_r:       .string "\xe2\x95\xae"   // down to the right child
heap_elbow_only:    .string "\xe2\x95\xaf"   // parent with a left child only

heap_fmt_cell:      .string "%4d"
heap_cell_free:     .string "   \xc2\xb7"

heap_scr_menu:      .string "min-heap  \xc2\xb7  priority queue"
heap_scr_insert:    .string "min-heap  \xc2\xb7  insert"
heap_scr_extract:   .string "min-heap  \xc2\xb7  extract the minimum"
heap_scr_peek:      .string "min-heap  \xc2\xb7  peek"
heap_scr_build:     .string "min-heap  \xc2\xb7  build-heap"
heap_scr_show:      .string "min-heap  \xc2\xb7  the heap right now"
heap_scr_clear:     .string "min-heap  \xc2\xb7  clear"

heap_pan_ops:       .string "operations"
heap_pan_tree:      .string "tree view"
heap_pan_array:     .string "array view"

heap_hint_menu:     .string "pick an operation  \xc2\xb7  0 goes back to the main menu"
heap_hint_run:      .string "enter returns to the heap menu  \xc2\xb7  the array below is the tree above"

heap_lbl_root:      .string "root"
heap_lbl_holds:     .string "holds"
heap_lbl_sifting:   .string "sifting"
heap_lbl_property:  .string "heap property: no parent is larger than either of its children"
heap_lbl_formula:   .string "slot i  \xc2\xb7  parent (i-1)/2  \xc2\xb7  children 2i+1 and 2i+2"

heap_opt_1:         .string "insert a value and watch it climb"
heap_opt_2:         .string "remove the minimum and watch the heap sink"
heap_opt_3:         .string "peek at the minimum"
heap_opt_4:         .string "build a heap from random values"
heap_opt_5:         .string "show the heap as it stands"
heap_opt_6:         .string "clear the heap"
heap_opt_0:         .string "back to the main menu"

heap_key_1:         .string "1"
heap_key_2:         .string "2"
heap_key_3:         .string "3"
heap_key_4:         .string "4"
heap_key_5:         .string "5"
heap_key_6:         .string "6"
heap_key_0:         .string "0"

heap_ask_choice:    .string "choice "
heap_ask_value:     .string "value to insert (-99 to 999)  "
heap_fmt_used:      .string "%d of %d slots used"

heap_o1:            .string "O(1)"
heap_on:            .string "O(n)"
heap_ologn:         .string "O(log n)"

heap_msg_full:      .string "the heap is full: fifteen values fill the whole array"
heap_msg_empty:     .string "the heap is empty. insert a value, or build one from random numbers"
heap_msg_range:     .string "values run from -99 to 999, so every cell stays four columns wide"
heap_msg_cleared:   .string "cleared. every slot is free again"
heap_msg_built:     .string "n/2 sift-downs, not n inserts: build-heap costs O(n), not O(n log n)"

heap_fmt_placed:    .string "%d joins the array at slot %d, under everything already placed"
heap_fmt_cmp_up:    .string "compare %d with its parent %d: a child may not be smaller"
heap_fmt_swap_up:   .string "%d is smaller than %d, so they swap and it climbs one level"
heap_fmt_hold_up:   .string "%d is not smaller than %d, so it stops: the property already holds"
heap_fmt_root:      .string "%d reached the root, which makes it the smallest value in the heap"
heap_fmt_settled:   .string "inserted %d at slot %d  \xc2\xb7  comparisons %d"

heap_fmt_min:       .string "the minimum %d always sits at slot 0, the root of the tree"
heap_fmt_moved:     .string "the last value %d takes the root, then sinks to where it belongs"
heap_fmt_cmp_down:  .string "slot %d holds %d and its smaller child holds %d"
heap_fmt_swap_down: .string "%d sinks past %d, so the smaller child becomes the parent"
heap_fmt_hold_down: .string "%d is no larger than either child, so the property is restored"
heap_fmt_leaf:      .string "slot %d is a leaf: there is nothing below it left to compare"
heap_fmt_removed:   .string "removed %d, and the new minimum is %d"
heap_fmt_last:      .string "removed %d, which was the last value: the heap is empty now"
heap_fmt_peek:      .string "peek reads slot 0 and moves nothing, so the minimum is %d"
heap_fmt_scatter:   .string "%d random values in no order at all: this is not a heap yet"
heap_fmt_sink_from: .string "sink slot %d, the last parent that can still break the rule"
heap_fmt_state:     .string "%d values. the tree and the strip below are the same words of memory"

    .text
    .balign 4

// heap_menu() - operations menu; choice 0 hands control back to main
    .global heap_menu
heap_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

heap_menu_loop:
    bl      heap_menu_draw

    mov     w0, 0
    mov     w1, 6
    bl      read_int_range

    cmp     w0, 0
    b.eq    heap_menu_exit
    cmp     w0, 1
    b.eq    heap_menu_insert
    cmp     w0, 2
    b.eq    heap_menu_extract
    cmp     w0, 3
    b.eq    heap_menu_peek
    cmp     w0, 4
    b.eq    heap_menu_build
    cmp     w0, 5
    b.eq    heap_menu_show
    cmp     w0, 6
    b.eq    heap_menu_clear
    b       heap_menu_loop

heap_menu_insert:
    bl      heap_insert_interactive
    bl      wait_for_enter
    b       heap_menu_loop

heap_menu_extract:
    bl      heap_extract_interactive
    bl      wait_for_enter
    b       heap_menu_loop

heap_menu_peek:
    bl      heap_peek_interactive
    bl      wait_for_enter
    b       heap_menu_loop

heap_menu_build:
    bl      heap_build_interactive
    bl      wait_for_enter
    b       heap_menu_loop

heap_menu_show:
    bl      heap_show
    bl      wait_for_enter
    b       heap_menu_loop

heap_menu_clear:
    bl      heap_clear_interactive
    bl      wait_for_enter
    b       heap_menu_loop

heap_menu_exit:
    ldp     fp, lr, [sp], 16
    ret

// heap_menu_draw() - the operations screen
heap_menu_draw:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =heap_scr_menu
    bl      ui_screen

    ldr     x0, =heap_hint_menu
    bl      ui_footer

    mov     w0, 4
    mov     w1, 12
    mov     w2, 56
    mov     w3, 13
    ldr     x4, =heap_pan_ops
    bl      ui_panel

    mov     w0, 6
    ldr     x1, =heap_key_1
    ldr     x2, =heap_opt_1
    bl      heap_menu_line

    mov     w0, 7
    ldr     x1, =heap_key_2
    ldr     x2, =heap_opt_2
    bl      heap_menu_line

    mov     w0, 8
    ldr     x1, =heap_key_3
    ldr     x2, =heap_opt_3
    bl      heap_menu_line

    mov     w0, 9
    ldr     x1, =heap_key_4
    ldr     x2, =heap_opt_4
    bl      heap_menu_line

    mov     w0, 10
    ldr     x1, =heap_key_5
    ldr     x2, =heap_opt_5
    bl      heap_menu_line

    mov     w0, 11
    ldr     x1, =heap_key_6
    ldr     x2, =heap_opt_6
    bl      heap_menu_line

    mov     w0, 12
    ldr     x1, =heap_key_0
    ldr     x2, =heap_opt_0
    bl      heap_menu_line

    // how much of the array is in use, so the menu is never a dead end
    mov     w0, 14
    mov     w1, 15
    bl      ui_at
    mov     w0, HEAP_ROLE_DIM
    bl      th_fg
    ldr     x19, =heap_count
    ldr     w1, [x19]
    mov     w2, heap_capacity
    ldr     x0, =heap_fmt_used
    bl      printf
    bl      th_off

    mov     w0, 18
    mov     w1, 15
    ldr     x2, =heap_ask_choice
    bl      ui_prompt
    bl      heap_flush

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// heap_menu_line(w0 = row, x1 = key text, x2 = option text)
heap_menu_line:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    mov     x21, x1
    mov     x20, x2

    mov     w0, w19
    mov     w1, 15
    mov     w2, HEAP_ROLE_KEY
    mov     x3, x21
    bl      ui_badge

    mov     w0, w19
    mov     w1, 19
    mov     w2, HEAP_ROLE_TEXT
    mov     x3, x20
    bl      ui_text

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// heap_frame(x0 = screen title, x1 = footer hint, x2 = best, x3 = avg,
//            x4 = worst, x5 = space)
// Everything on an operation screen that does not move while it runs.
heap_frame:
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
    mov     w3, 10
    ldr     x4, =heap_pan_tree
    bl      ui_panel

    mov     w0, 14
    mov     w1, 2
    mov     w2, 78
    mov     w3, 4
    ldr     x4, =heap_pan_array
    bl      ui_panel

    mov     w0, 18
    mov     w1, 4
    mov     w2, HEAP_ROLE_DIM
    ldr     x3, =heap_lbl_formula
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

// heap_blank(w0 = row, w1 = column, w2 = run length) - wipe a run of
// cells without disturbing the borders on either side
heap_blank:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w2
    bl      ui_at
    ldr     x0, =heap_sp
    mov     w1, w19
    bl      ui_repeat

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// heap_flush() - push the drawing out before a delay, or the whole
// animation arrives at once
heap_flush:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     x0, 0
    bl      fflush

    ldp     fp, lr, [sp], 16
    ret

// heap_pause(w0 = milliseconds)
heap_pause:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0
    bl      heap_flush
    mov     w0, w19
    bl      delay_ms

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// heap_say(x0 = format, w1 = first value, w2 = second, w3 = third)
// The one line that narrates what just happened. It wipes the row first,
// so a prompt or an older caption never shows through.
heap_say:
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
    bl      heap_blank

    mov     w0, 19
    mov     w1, 4
    bl      ui_at
    mov     w0, HEAP_ROLE_TEXT
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

// heap_role_of(w0 = slot) -> w0 = the colour role this slot wears now
heap_role_of:
    ldr     x1, =heap_hl_slot
    ldr     x2, =heap_hl_role
    mov     w3, 0

heap_role_scan:
    cmp     w3, 3
    b.ge    heap_role_rest
    ldr     w4, [x1, w3, sxtw 2]
    cmp     w4, w0
    b.eq    heap_role_hit
    add     w3, w3, 1
    b       heap_role_scan

heap_role_hit:
    ldr     w0, [x2, w3, sxtw 2]
    ret

heap_role_rest:
    mov     w0, HEAP_ROLE_NODE
    ret

// heap_property_holds() -> w0 = 1 when no child is smaller than its
// parent. Checked live every frame, so the caption cannot lie.
heap_property_holds:
    ldr     x1, =heap_count
    ldr     w2, [x1]
    ldr     x1, =heap_data
    mov     w3, 1

heap_property_scan:
    cmp     w3, w2
    b.ge    heap_property_yes
    sub     w4, w3, 1
    lsr     w4, w4, 1
    ldr     w5, [x1, w3, sxtw 2]
    ldr     w6, [x1, w4, sxtw 2]
    cmp     w5, w6
    b.lt    heap_property_no
    add     w3, w3, 1
    b       heap_property_scan

heap_property_no:
    mov     w0, 0
    ret

heap_property_yes:
    mov     w0, 1
    ret

// heap_draw_node(w0 = slot) - one filled cell in the tree view
heap_draw_node:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    bl      heap_role_of
    mov     w20, w0

    ldr     x0, =heap_row_tab
    ldr     w21, [x0, w19, sxtw 2]
    ldr     x0, =heap_col_tab
    ldr     w1, [x0, w19, sxtw 2]
    mov     w0, w21
    bl      ui_at

    mov     w0, w20
    bl      th_bg
    ldr     x0, =heap_data
    ldr     w1, [x0, w19, sxtw 2]
    ldr     x0, =heap_fmt_cell
    bl      printf
    bl      th_off

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// heap_draw_link(w0 = parent slot) - the elbow joining a parent to the
// children it has. A parent with only a left child gets a corner rather
// than a tee, so no line ever points at empty space.
heap_draw_link:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    mov     w19, w0
    ldr     x0, =heap_count
    ldr     w20, [x0]

    add     w21, w19, w19
    add     w21, w21, 1                     // left child
    cmp     w21, w20
    b.ge    heap_link_done
    add     w22, w21, 1                     // right child

    ldr     x0, =heap_col_tab
    ldr     w23, [x0, w19, sxtw 2]
    add     w23, w23, 2                     // parent centre column
    ldr     w24, [x0, w21, sxtw 2]
    add     w24, w24, 2                     // left child centre column

    ldr     x0, =heap_link_row
    ldr     w0, [x0, w19, sxtw 2]
    mov     w1, w24
    bl      ui_at

    mov     w0, HEAP_ROLE_FAINT
    bl      th_fg
    ldr     x0, =heap_elbow_l
    bl      printf
    ldr     x0, =heap_dash
    sub     w1, w23, w24
    sub     w1, w1, 1
    bl      ui_repeat

    cmp     w22, w20
    b.lt    heap_link_both

    ldr     x0, =heap_elbow_only
    bl      printf
    b       heap_link_close

heap_link_both:
    ldr     x0, =heap_tee
    bl      printf
    ldr     x0, =heap_col_tab
    ldr     w24, [x0, w22, sxtw 2]
    add     w24, w24, 2                     // right child centre column
    ldr     x0, =heap_dash
    sub     w1, w24, w23
    sub     w1, w1, 1
    bl      ui_repeat
    ldr     x0, =heap_elbow_r
    bl      printf

heap_link_close:
    bl      th_off

heap_link_done:
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// heap_draw_slot(w0 = slot) - one cell of the array strip and the slot
// number above it
heap_draw_slot:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    mov     w0, 5
    mul     w20, w19, w0
    add     w20, w20, 4                     // column of this cell

    mov     w0, 15
    mov     w1, w20
    bl      ui_at
    mov     w0, HEAP_ROLE_FAINT
    bl      th_fg
    ldr     x0, =heap_fmt_cell
    mov     w1, w19
    bl      printf
    bl      th_off

    mov     w0, 16
    mov     w1, w20
    bl      ui_at

    ldr     x0, =heap_count
    ldr     w21, [x0]
    cmp     w19, w21
    b.ge    heap_slot_free

    mov     w0, w19
    bl      heap_role_of
    bl      th_bg
    ldr     x0, =heap_data
    ldr     w1, [x0, w19, sxtw 2]
    ldr     x0, =heap_fmt_cell
    bl      printf
    b       heap_slot_close

heap_slot_free:
    mov     w0, HEAP_ROLE_FAINT
    bl      th_fg
    ldr     x0, =heap_cell_free
    bl      printf

heap_slot_close:
    bl      th_off

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// heap_render(w0 = slot A, w1 = role A, w2 = slot B, w3 = role B,
//             w4 = slot C, w5 = role C)
// Repaints both views from the same words. A slot of -1 means "nothing
// highlighted here". The caption row is left alone: heap_say owns it.
heap_render:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x6, =heap_hl_slot
    str     w0, [x6]
    str     w2, [x6, 4]
    str     w4, [x6, 8]
    ldr     x6, =heap_hl_role
    str     w1, [x6]
    str     w3, [x6, 4]
    str     w5, [x6, 8]

    mov     w19, 5
heap_render_wipe:
    cmp     w19, 12
    b.gt    heap_render_strip
    mov     w0, w19
    mov     w1, 3
    mov     w2, 76
    bl      heap_blank
    add     w19, w19, 1
    b       heap_render_wipe

heap_render_strip:
    mov     w0, 16
    mov     w1, 3
    mov     w2, 76
    bl      heap_blank

    ldr     x0, =heap_count
    ldr     w20, [x0]

    mov     w19, 0
heap_render_nodes:
    cmp     w19, w20
    b.ge    heap_render_links
    mov     w0, w19
    bl      heap_draw_node
    add     w19, w19, 1
    b       heap_render_nodes

heap_render_links:
    mov     w19, 0
heap_render_link_loop:
    cmp     w19, 7
    b.ge    heap_render_root
    mov     w0, w19
    bl      heap_draw_link
    add     w19, w19, 1
    b       heap_render_link_loop

heap_render_root:
    cmp     w20, 0
    b.le    heap_render_array
    mov     w0, 5
    mov     w1, 44
    mov     w2, HEAP_ROLE_KEY
    ldr     x3, =heap_lbl_root
    bl      ui_badge

heap_render_array:
    mov     w19, 0
heap_render_slots:
    cmp     w19, heap_capacity
    b.ge    heap_render_property
    mov     w0, w19
    bl      heap_draw_slot
    add     w19, w19, 1
    b       heap_render_slots

heap_render_property:
    mov     w0, 12
    mov     w1, 4
    mov     w2, HEAP_ROLE_DIM
    ldr     x3, =heap_lbl_property
    bl      ui_text

    bl      heap_property_holds
    cmp     w0, 0
    b.eq    heap_render_broken

    mov     w0, 12
    mov     w1, 67
    mov     w2, HEAP_ROLE_OK
    ldr     x3, =heap_lbl_holds
    bl      ui_badge
    b       heap_render_done

heap_render_broken:
    mov     w0, 12
    mov     w1, 67
    mov     w2, HEAP_ROLE_WARN
    ldr     x3, =heap_lbl_sifting
    bl      ui_badge

heap_render_done:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// heap_rest() - repaint with nothing highlighted
heap_rest:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, -1
    mov     w1, 0
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      heap_render

    ldp     fp, lr, [sp], 16
    ret

// heap_insert_interactive() - read a value, place it at the end, and
// climb it to its place one comparison at a time
heap_insert_interactive:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    ldr     x0, =heap_scr_insert
    ldr     x1, =heap_hint_run
    ldr     x2, =heap_o1
    ldr     x3, =heap_ologn
    ldr     x4, =heap_ologn
    ldr     x5, =heap_o1
    bl      heap_frame
    bl      heap_rest

    ldr     x0, =heap_count
    ldr     w20, [x0]
    cmp     w20, heap_capacity
    b.ge    heap_insert_full

    mov     w0, 19
    mov     w1, 2
    mov     w2, 78
    bl      heap_blank
    mov     w0, 19
    mov     w1, 4
    ldr     x2, =heap_ask_value
    bl      ui_prompt
    bl      heap_flush

    bl      read_int
    mov     w19, w0
    mov     w23, w1
    cmp     w23, 0
    b.eq    heap_insert_done                // stdin closed: walk out quietly

    cmp     w19, -99
    b.lt    heap_insert_range
    cmp     w19, 999
    b.gt    heap_insert_range

    // the new value goes to the first free slot, which is the end
    ldr     x23, =heap_count
    ldr     w20, [x23]
    add     w0, w20, 1
    str     w0, [x23]
    ldr     x23, =heap_data
    str     w19, [x23, w20, sxtw 2]
    mov     w22, 0                          // comparisons so far

    mov     w0, w20
    mov     w1, HEAP_ROLE_HOT
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      heap_render
    ldr     x0, =heap_fmt_placed
    mov     w1, w19
    mov     w2, w20
    mov     w3, 0
    bl      heap_say
    mov     w0, 750
    bl      heap_pause

heap_insert_up:
    cmp     w20, 0
    b.eq    heap_insert_at_root

    sub     w21, w20, 1
    lsr     w21, w21, 1                     // parent = (i - 1) / 2

    mov     w0, w20
    mov     w1, HEAP_ROLE_HOT
    mov     w2, w21
    mov     w3, HEAP_ROLE_WARN
    mov     w4, -1
    mov     w5, 0
    bl      heap_render

    add     w22, w22, 1
    ldr     x23, =heap_data
    ldr     w1, [x23, w20, sxtw 2]
    ldr     w2, [x23, w21, sxtw 2]
    ldr     x0, =heap_fmt_cmp_up
    mov     w3, 0
    bl      heap_say
    mov     w0, 750
    bl      heap_pause

    ldr     x23, =heap_data
    ldr     w0, [x23, w20, sxtw 2]
    ldr     w1, [x23, w21, sxtw 2]
    cmp     w0, w1
    b.ge    heap_insert_settled

    str     w1, [x23, w20, sxtw 2]
    str     w0, [x23, w21, sxtw 2]

    mov     w0, w21
    mov     w1, HEAP_ROLE_HOT
    mov     w2, w20
    mov     w3, HEAP_ROLE_OK
    mov     w4, -1
    mov     w5, 0
    bl      heap_render

    ldr     x23, =heap_data
    ldr     w1, [x23, w21, sxtw 2]
    ldr     w2, [x23, w20, sxtw 2]
    ldr     x0, =heap_fmt_swap_up
    mov     w3, 0
    bl      heap_say
    mov     w0, 750
    bl      heap_pause

    mov     w20, w21
    b       heap_insert_up

heap_insert_settled:
    mov     w0, w20
    mov     w1, HEAP_ROLE_OK
    mov     w2, w21
    mov     w3, HEAP_ROLE_NODE
    mov     w4, -1
    mov     w5, 0
    bl      heap_render

    ldr     x23, =heap_data
    ldr     w1, [x23, w20, sxtw 2]
    ldr     w2, [x23, w21, sxtw 2]
    ldr     x0, =heap_fmt_hold_up
    mov     w3, 0
    bl      heap_say
    b       heap_insert_finish

heap_insert_at_root:
    mov     w0, 0
    mov     w1, HEAP_ROLE_OK
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      heap_render
    ldr     x0, =heap_fmt_root
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      heap_say

heap_insert_finish:
    mov     w0, 900
    bl      heap_pause

    mov     w0, w20
    mov     w1, HEAP_ROLE_OK
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      heap_render
    ldr     x0, =heap_fmt_settled
    mov     w1, w19
    mov     w2, w20
    mov     w3, w22
    bl      heap_say
    b       heap_insert_done

heap_insert_full:
    ldr     x0, =heap_msg_full
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      heap_say
    b       heap_insert_done

heap_insert_range:
    ldr     x0, =heap_msg_range
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      heap_say

heap_insert_done:
    bl      heap_flush
    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// heap_sink_anim(w0 = starting slot, w1 = delay in milliseconds)
// The animated sift-down shared by extract-min and build-heap.
heap_sink_anim:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]

    mov     w19, w0                         // the slot being sunk
    mov     w20, w1                         // delay

heap_sink_loop:
    ldr     x0, =heap_count
    ldr     w24, [x0]

    add     w21, w19, w19
    add     w21, w21, 1                     // left child
    cmp     w21, w24
    b.ge    heap_sink_leaf
    add     w22, w21, 1                     // right child

    mov     w23, w21                        // the smaller child so far
    mov     w25, -1                         // right child, when it exists
    cmp     w22, w24
    b.ge    heap_sink_have_child
    mov     w25, w22
    ldr     x26, =heap_data
    ldr     w0, [x26, w22, sxtw 2]
    ldr     w1, [x26, w21, sxtw 2]
    cmp     w0, w1
    b.ge    heap_sink_have_child
    mov     w23, w22

heap_sink_have_child:
    mov     w0, w19
    mov     w1, HEAP_ROLE_HOT
    mov     w2, w21
    mov     w3, HEAP_ROLE_WARN
    mov     w4, w25
    mov     w5, HEAP_ROLE_WARN
    bl      heap_render

    ldr     x26, =heap_data
    mov     w1, w19
    ldr     w2, [x26, w19, sxtw 2]
    ldr     w3, [x26, w23, sxtw 2]
    ldr     x0, =heap_fmt_cmp_down
    bl      heap_say
    mov     w0, w20
    bl      heap_pause

    ldr     x26, =heap_data
    ldr     w0, [x26, w19, sxtw 2]
    ldr     w1, [x26, w23, sxtw 2]
    cmp     w0, w1
    b.le    heap_sink_settled

    str     w1, [x26, w19, sxtw 2]
    str     w0, [x26, w23, sxtw 2]

    mov     w0, w23
    mov     w1, HEAP_ROLE_HOT
    mov     w2, w19
    mov     w3, HEAP_ROLE_OK
    mov     w4, -1
    mov     w5, 0
    bl      heap_render

    ldr     x26, =heap_data
    ldr     w1, [x26, w23, sxtw 2]
    ldr     w2, [x26, w19, sxtw 2]
    ldr     x0, =heap_fmt_swap_down
    mov     w3, 0
    bl      heap_say
    mov     w0, w20
    bl      heap_pause

    mov     w19, w23
    b       heap_sink_loop

heap_sink_settled:
    mov     w0, w19
    mov     w1, HEAP_ROLE_OK
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      heap_render
    ldr     x26, =heap_data
    ldr     w1, [x26, w19, sxtw 2]
    ldr     x0, =heap_fmt_hold_down
    mov     w2, 0
    mov     w3, 0
    bl      heap_say
    mov     w0, w20
    bl      heap_pause
    b       heap_sink_done

heap_sink_leaf:
    mov     w0, w19
    mov     w1, HEAP_ROLE_OK
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      heap_render
    ldr     x0, =heap_fmt_leaf
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      heap_say
    mov     w0, w20
    bl      heap_pause

heap_sink_done:
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// heap_extract_interactive() - take the root, move the last value into
// the hole it leaves, and sink that value back to its place
heap_extract_interactive:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    ldr     x0, =heap_scr_extract
    ldr     x1, =heap_hint_run
    ldr     x2, =heap_ologn
    ldr     x3, =heap_ologn
    ldr     x4, =heap_ologn
    ldr     x5, =heap_o1
    bl      heap_frame
    bl      heap_rest

    ldr     x0, =heap_count
    ldr     w20, [x0]
    cmp     w20, 0
    b.le    heap_extract_empty

    ldr     x21, =heap_data
    ldr     w19, [x21]                      // the minimum, about to leave

    mov     w0, 0
    mov     w1, HEAP_ROLE_HOT
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      heap_render
    ldr     x0, =heap_fmt_min
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      heap_say
    mov     w0, 900
    bl      heap_pause

    // the last value fills the hole, and the heap gets one shorter
    ldr     x21, =heap_data
    sub     w20, w20, 1
    ldr     w0, [x21, w20, sxtw 2]
    str     w0, [x21]
    ldr     x1, =heap_count
    str     w20, [x1]

    cmp     w20, 0
    b.le    heap_extract_last

    mov     w0, 0
    mov     w1, HEAP_ROLE_HOT
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      heap_render
    ldr     x21, =heap_data
    ldr     w1, [x21]
    ldr     x0, =heap_fmt_moved
    mov     w2, 0
    mov     w3, 0
    bl      heap_say
    mov     w0, 900
    bl      heap_pause

    mov     w0, 0
    mov     w1, 700
    bl      heap_sink_anim

    bl      heap_rest
    ldr     x21, =heap_data
    ldr     w2, [x21]
    ldr     x0, =heap_fmt_removed
    mov     w1, w19
    mov     w3, 0
    bl      heap_say
    b       heap_extract_done

heap_extract_last:
    bl      heap_rest
    ldr     x0, =heap_fmt_last
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      heap_say
    b       heap_extract_done

heap_extract_empty:
    ldr     x0, =heap_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      heap_say

heap_extract_done:
    bl      heap_flush
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// heap_peek_interactive() - read the root without moving anything
heap_peek_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =heap_scr_peek
    ldr     x1, =heap_hint_run
    ldr     x2, =heap_o1
    ldr     x3, =heap_o1
    ldr     x4, =heap_o1
    ldr     x5, =heap_o1
    bl      heap_frame

    ldr     x0, =heap_count
    ldr     w19, [x0]
    cmp     w19, 0
    b.le    heap_peek_empty

    mov     w0, 0
    mov     w1, HEAP_ROLE_OK
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      heap_render
    ldr     x0, =heap_data
    ldr     w1, [x0]
    ldr     x0, =heap_fmt_peek
    mov     w2, 0
    mov     w3, 0
    bl      heap_say
    b       heap_peek_done

heap_peek_empty:
    bl      heap_rest
    ldr     x0, =heap_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      heap_say

heap_peek_done:
    bl      heap_flush
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// heap_build_interactive() - scatter random values, then sink every
// parent from the bottom up. The point is the cost: n/2 sinks, O(n).
heap_build_interactive:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    ldr     x0, =heap_scr_build
    ldr     x1, =heap_hint_run
    ldr     x2, =heap_on
    ldr     x3, =heap_on
    ldr     x4, =heap_on
    ldr     x5, =heap_o1
    bl      heap_frame

    mov     w20, 12                         // a full four levels, minus a few
    ldr     x0, =heap_count
    str     w20, [x0]

    mov     w19, 0
heap_build_fill:
    cmp     w19, w20
    b.ge    heap_build_show
    mov     w0, 90
    bl      get_random
    add     w0, w0, 10                      // two digits read better in a cell
    ldr     x21, =heap_data
    str     w0, [x21, w19, sxtw 2]
    add     w19, w19, 1
    b       heap_build_fill

heap_build_show:
    bl      heap_rest
    ldr     x0, =heap_fmt_scatter
    mov     w1, w20
    mov     w2, 0
    mov     w3, 0
    bl      heap_say
    mov     w0, 1200
    bl      heap_pause

    // the leaves are already heaps of one, so start at the last parent
    lsr     w19, w20, 1
    sub     w19, w19, 1

heap_build_sink:
    cmp     w19, 0
    b.lt    heap_build_done_loop

    mov     w0, w19
    mov     w1, HEAP_ROLE_HOT
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      heap_render
    ldr     x0, =heap_fmt_sink_from
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      heap_say
    mov     w0, 550
    bl      heap_pause

    mov     w0, w19
    mov     w1, 450
    bl      heap_sink_anim

    sub     w19, w19, 1
    b       heap_build_sink

heap_build_done_loop:
    bl      heap_rest
    ldr     x0, =heap_msg_built
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      heap_say

    bl      heap_flush
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// heap_show() - both views, nothing moving
heap_show:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =heap_scr_show
    ldr     x1, =heap_hint_run
    ldr     x2, =heap_o1
    ldr     x3, =heap_ologn
    ldr     x4, =heap_ologn
    ldr     x5, =heap_on
    bl      heap_frame
    bl      heap_rest

    ldr     x0, =heap_count
    ldr     w19, [x0]
    cmp     w19, 0
    b.le    heap_show_empty

    ldr     x0, =heap_fmt_state
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      heap_say
    b       heap_show_done

heap_show_empty:
    ldr     x0, =heap_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      heap_say

heap_show_done:
    bl      heap_flush
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// heap_clear_interactive() - back to an empty array
heap_clear_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =heap_scr_clear
    ldr     x1, =heap_hint_run
    ldr     x2, =heap_o1
    ldr     x3, =heap_o1
    ldr     x4, =heap_o1
    ldr     x5, =heap_o1
    bl      heap_frame

    ldr     x0, =heap_count
    str     wzr, [x0]

    bl      heap_rest
    ldr     x0, =heap_msg_cleared
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      heap_say
    bl      heap_flush

    ldp     fp, lr, [sp], 16
    ret

// heap_sort_array(x0 = base of an int array, w1 = element count)
// Heapsort in place, with nothing drawn: the sorting module borrows it.
// This side builds a max-heap, because swapping the largest value to the
// end and shrinking the heap leaves the array in ascending order.
    .global heap_sort_array
heap_sort_array:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     x19, x0
    mov     w20, w1

    cmp     w20, 2
    b.lt    heap_sort_done                  // 0 or 1 elements are sorted

    lsr     w21, w20, 1
    sub     w21, w21, 1                     // the last parent

heap_sort_build:
    cmp     w21, 0
    b.lt    heap_sort_drain
    mov     x0, x19
    mov     w1, w20
    mov     w2, w21
    bl      heap_sink_max
    sub     w21, w21, 1
    b       heap_sort_build

heap_sort_drain:
    sub     w21, w20, 1

heap_sort_drain_loop:
    cmp     w21, 1
    b.lt    heap_sort_done

    // the largest value belongs at the end of what is left
    ldr     w0, [x19]
    ldr     w1, [x19, w21, sxtw 2]
    str     w1, [x19]
    str     w0, [x19, w21, sxtw 2]

    mov     x0, x19
    mov     w1, w21
    mov     w2, 0
    bl      heap_sink_max

    sub     w21, w21, 1
    b       heap_sort_drain_loop

heap_sort_done:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// heap_sink_max(x0 = base, w1 = heap size, w2 = slot to sink)
// The silent sift-down: no calls, so caller-saved temporaries are all it
// needs.
heap_sink_max:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

heap_sink_max_loop:
    add     w3, w2, w2
    add     w3, w3, 1                       // left child
    cmp     w3, w1
    b.ge    heap_sink_max_done

    mov     w5, w3                          // the larger child so far
    add     w4, w3, 1                       // right child
    cmp     w4, w1
    b.ge    heap_sink_max_pick
    ldr     w6, [x0, w4, sxtw 2]
    ldr     w7, [x0, w3, sxtw 2]
    cmp     w6, w7
    b.le    heap_sink_max_pick
    mov     w5, w4

heap_sink_max_pick:
    ldr     w6, [x0, w2, sxtw 2]
    ldr     w7, [x0, w5, sxtw 2]
    cmp     w6, w7
    b.ge    heap_sink_max_done

    str     w7, [x0, w2, sxtw 2]
    str     w6, [x0, w5, sxtw 2]
    mov     w2, w5
    b       heap_sink_max_loop

heap_sink_max_done:
    ldp     fp, lr, [sp], 16
    ret
