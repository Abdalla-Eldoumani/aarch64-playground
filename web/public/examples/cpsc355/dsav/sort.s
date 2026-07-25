// sort_viz.asm - eight sorting algorithms, one state change per frame
//
// The chrome is drawn once when a run starts. After that a frame repaints
// only the bars, the values, the slot ruler, the marks under the cells and
// the counters, so nothing blinks and nothing is redrawn that did not
// move. Every state change - a comparison, a move, a cell settling - gets
// exactly one frame and one delay, and no change is ever left for the
// following frame to reveal.
//
// A cell's colour is data rather than a branch: sort_role_of reads the
// marker words and answers with a role from theme.asm, so all eight
// algorithms paint through one set of rules. sort_src says where a cell's
// value comes from, which is what lets the merge show its scratch copy
// instead of the half-overwritten memory underneath it - the picture never
// shows a value the array does not hold.

define(fp, x29)
define(lr, x30)

    .data
    .balign 8

    SORT_CAP        = 10                    // the widest array that fits
    SORT_KEYS       = 100                   // counting sort's key space

// Role numbers mirror ui.asm's UI_ROLE_* set. They are repeated here so
// this file also assembles on its own, the way the web build feeds it.
    SORT_TEXT       = 0
    SORT_DIM        = 1
    SORT_FAINT      = 2
    SORT_ACCENT     = 3
    SORT_KEY        = 4
    SORT_OK         = 5
    SORT_WARN       = 6
    SORT_HOT        = 7
    SORT_BAD        = 8
    SORT_NODE       = 9

// Where a cell takes its value from this frame.
    SORT_FROM_ARRAY = 0
    SORT_FROM_AUX   = 1
    SORT_FROM_NONE  = 2

sort_array:         .skip SORT_CAP * 4      // the array every algorithm sorts
sort_aux:           .skip SORT_CAP * 4      // merge sort's scratch copy
sort_out:           .skip SORT_CAP * 4      // counting sort's output
sort_out_fill:      .skip SORT_CAP * 4      // which output slots are written
sort_locked:        .skip SORT_CAP * 4      // cells that have settled
sort_src:           .skip SORT_CAP * 4      // array, scratch, or nothing
sort_bucket:        .skip SORT_KEYS * 4     // counting sort's one bucket per key

    .balign 4
sort_size:          .word 0                 // how many values are in play
sort_delay:         .word 400               // a comparison frame, in ms
sort_view:          .word 0                 // 0 the bar strip, 1 the buckets

// The markers a frame paints with. -1 means "nothing here".
sort_cmp_a:         .word -1                // the pair being compared
sort_cmp_b:         .word -1
sort_hand:          .word -1                // the value in hand: key, min, pivot
sort_dst_a:         .word -1                // where something just moved
sort_dst_b:         .word -1
sort_put_lo:        .word -1                // output a merge has placed so far
sort_put_hi:        .word -1
sort_hole:          .word -1                // the slot a lifted key left open
sort_lo:            .word -1                // the range being worked inside
sort_hi:            .word -1
sort_split:         .word -1                // gap where two runs meet
sort_bound:         .word -1                // gap at a partition boundary
sort_out_at:        .word -1                // output slot just written
sort_bucket_at:     .word -1                // bucket being touched

sort_cmp_count:     .word 0
sort_move_count:    .word 0

// Which rows this screen writes its caption, counters and legend on. The
// two layouts differ, and every helper reads the row rather than assuming.
sort_say_row:       .word 17
sort_stat_row:      .word 18
sort_leg_row:       .word 19

sort_scr_menu:      .string "sorting  \xc2\xb7  eight ways to order the same ten values"
sort_scr_new:       .string "sorting  \xc2\xb7  a new random array"
sort_scr_bubble:    .string "sorting  \xc2\xb7  bubble sort"
sort_scr_select:    .string "sorting  \xc2\xb7  selection sort"
sort_scr_insert:    .string "sorting  \xc2\xb7  insertion sort"
sort_scr_merge:     .string "sorting  \xc2\xb7  merge sort, bottom up"
sort_scr_quick:     .string "sorting  \xc2\xb7  quick sort"
sort_scr_heap:      .string "sorting  \xc2\xb7  heap sort"
sort_scr_shell:     .string "sorting  \xc2\xb7  shell sort"
sort_scr_count:     .string "sorting  \xc2\xb7  counting sort"

sort_pan_array:     .string "the array"
sort_pan_input:     .string "the array, read left to right"
sort_pan_output:    .string "the output"
// Panel titles stay plain ascii: ui_panel measures them in bytes to work
// out how much border is left, and a multi-byte glyph would shorten the
// top edge by a column.
sort_pan_bucket:    .string "one bucket per key, top row 0-49 and bottom row 50-99"
sort_pan_menu:      .string "algorithms"

sort_hint_menu:     .string "pick an algorithm  \xc2\xb7  0 goes back to the main menu"
sort_hint_start:    .string "press enter to start"
sort_hint_run:      .string "one frame per state change  \xc2\xb7  green cells have settled"
sort_hint_done:     .string "enter returns to the sorting menu"
sort_hint_new:      .string "a size between 3 and 10  \xc2\xb7  values run from 0 to 99"

sort_opt_1:         .string "bubble sort"
sort_opt_2:         .string "selection sort"
sort_opt_3:         .string "insertion sort"
sort_opt_4:         .string "merge sort"
sort_opt_5:         .string "quick sort"
sort_opt_6:         .string "heap sort"
sort_opt_7:         .string "shell sort"
sort_opt_8:         .string "counting sort"
sort_opt_9:         .string "a new random array"
sort_opt_0:         .string "back to the main menu"

sort_key_1:         .string "1"
sort_key_2:         .string "2"
sort_key_3:         .string "3"
sort_key_4:         .string "4"
sort_key_5:         .string "5"
sort_key_6:         .string "6"
sort_key_7:         .string "7"
sort_key_8:         .string "8"
sort_key_9:         .string "9"
sort_key_0:         .string "0"

sort_ask_choice:    .string "choice "
sort_ask_ms:        .string "frame time in ms (100-2500)  "
sort_ask_size:      .string "how many values (3-10)  "

sort_lbl_cmp:       .string "compare"
sort_lbl_hand:      .string "in hand"
sort_lbl_moved:     .string "moved"
sort_lbl_placed:    .string "placed"
sort_lbl_settled:   .string "settled"
sort_lbl_range:     .string "range"
sort_lbl_hole:      .string "hole"
sort_lbl_read:      .string "reading"
sort_lbl_bucket:    .string "bucket"
sort_lbl_empty:     .string "empty"

sort_o1:            .string "O(1)"
sort_on:            .string "O(n)"
sort_ologn:         .string "O(log n)"
sort_onlogn:        .string "O(n log n)"
sort_on2:           .string "O(n^2)"
sort_on13:          .string "O(n^1.3)"
sort_onk:           .string "O(n + k)"

sort_fmt_cell:      .string "%4d"
sort_fmt_counts:    .string "comparisons %-3d  moves %-3d"
sort_space:         .string " "
sort_block:         .string "\xe2\x96\x88\xe2\x96\x88\xe2\x96\x88\xe2\x96\x88"
sort_cell_gone:     .string "   \xc2\xb7"
sort_rule_h:        .string "\xe2\x94\x80"
sort_tee_up:        .string "\xe2\x94\xb4"
sort_pointer:       .string "\xe2\x96\xb2"
sort_corner_bl:     .string "\xe2\x95\xb0"
sort_corner_br:     .string "\xe2\x95\xaf"
sort_chip_pad:      .string "  "
sort_dot_free:      .string "\xc2\xb7"
sort_digit:         .string "%d"
sort_many:          .string "+"

sort_msg_none:      .string "there is no array yet. choose 9 on the sorting menu to make one"
sort_fmt_have:      .string "the array holds %d values"
sort_msg_have_not:  .string "no array yet: 9 makes one"
sort_fmt_fresh:     .string "%d random values, not one of them in order yet"
sort_fmt_ready:     .string "%d values, before a single comparison"
sort_fmt_done:      .string "sorted: %d comparisons and %d moves"

sort_fmt_pass:      .string "pass %d of %d"
sort_fmt_run:       .string "run width %d"
sort_fmt_key:       .string "key %d"
sort_fmt_gaponly:   .string "gap %d"
sort_fmt_gap:       .string "gap %d  \xc2\xb7  key %d"
sort_fmt_span:      .string "slots %d to %d"
sort_fmt_heapn:     .string "heap holds %d"
sort_fmt_kbuckets:  .string "k = %d buckets"

sort_fmt_bcmp:      .string "compare %d with %d: the larger of the two has to move right"
sort_fmt_bswap:     .string "%d is larger than %d, so the pair trades places"
sort_fmt_bsettle:   .string "the largest value of the pass settles into slot %d"
sort_fmt_bearly:    .string "a whole pass moved nothing, so what is left was already in order"

sort_fmt_starget:   .string "slot %d is the target: find the smallest value still loose"
sort_fmt_scmp:      .string "compare %d with the smallest found so far, %d"
sort_fmt_snew:      .string "%d is smaller, so slot %d holds the new minimum"
sort_fmt_sswap:     .string "%d moves into slot %d and %d takes the slot it left"
sort_fmt_sstay:     .string "the smallest value was already in slot %d, so nothing moves"
sort_fmt_slock:     .string "slot %d has its final value"

sort_fmt_ilift:     .string "lift %d out of slot %d and leave the slot open"
sort_fmt_icmp:      .string "compare %d with the key %d"
sort_fmt_ishift:    .string "%d is larger than the key, so it slides one slot right"
sort_fmt_iland:     .string "the key %d lands in slot %d"

sort_fmt_mpass:     .string "pass %d: runs of %d merge into runs of up to %d"
sort_fmt_mstart:    .string "merge slots %d to %d with slots %d to %d"
sort_fmt_mcopy:     .string "both runs go to scratch first, so the merge can write over them"
sort_fmt_mcmp:      .string "compare %d from the left run with %d from the right"
sort_fmt_mtake:     .string "%d is not larger, so it takes slot %d"
sort_fmt_mdrain:    .string "one run is empty, so %d drops straight into slot %d"
sort_fmt_mjoin:     .string "slots %d to %d are one sorted run now"
sort_fmt_mlone:     .string "the run at slot %d has no partner this pass, so it waits"

sort_fmt_qpivot:    .string "the pivot is %d, the last value of slots %d to %d"
sort_fmt_qcmp:      .string "compare %d with the pivot %d"
sort_fmt_qswap:     .string "%d is not larger than the pivot, so it swaps into slot %d"
sort_fmt_qstay:     .string "%d is already on the small side, so only the boundary moves"
sort_fmt_qhome:     .string "the pivot %d takes slot %d: everything left of it is smaller"
sort_fmt_qback:     .string "back to slots %d to %d, with the right side still to sort"
sort_fmt_qdone:     .string "slots %d to %d are in order"
sort_fmt_qone:      .string "slot %d is a run of one, which is sorted already"

sort_fmt_hbuild:    .string "build a heap first: no parent may be smaller than a child"
sort_fmt_hsink:     .string "sink slot %d, the last parent that can still break the rule"
sort_fmt_hcmp:      .string "compare the parent %d with its child %d"
sort_fmt_hswap:     .string "%d sinks past %d and the larger value becomes the parent"
sort_fmt_hhold:     .string "%d is not smaller than either child, so it stops here"
sort_fmt_hpull:     .string "the largest value %d leaves the heap and takes slot %d"

sort_fmt_egap:      .string "gap %d: every comparison now jumps %d slots at a time"
sort_fmt_ecmp:      .string "compare %d, %d slots to the left, with the key %d"
sort_fmt_eshift:    .string "%d is larger than the key, so it hops %d slots right"
sort_fmt_eland:     .string "the key %d settles in slot %d"
sort_fmt_elast:     .string "gap 1 is plain insertion sort on an almost ordered array"

sort_fmt_czero:     .string "one bucket for every key from 0 to 99, all of them empty"
sort_fmt_ccount:    .string "slot %d holds %d, so bucket %d counts one more"
sort_fmt_csums:     .string "now add each bucket to the one before it"
sort_fmt_csum:      .string "bucket %d reads %d: that many keys are no larger than %d"
sort_fmt_cplace:    .string "%d belongs at output slot %d, and its bucket steps back"
sort_fmt_cback:     .string "output slot %d goes home to the array"
sort_fmt_cnone:     .string "not one value was compared with another: the buckets did it all"

sort_lbl_keys_lo:   .string "keys  0-49"
sort_lbl_keys_hi:   .string "keys 50-99"

    .text
    .balign 4

// sort_menu() - the sorting menu; 0 hands control back to main
    .global sort_menu
sort_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

sort_menu_loop:
    bl      sort_menu_draw

    mov     w0, 0
    mov     w1, 9
    bl      read_int_range

    cmp     w0, 0
    b.eq    sort_menu_exit
    cmp     w0, 1
    b.eq    sort_menu_bubble
    cmp     w0, 2
    b.eq    sort_menu_select
    cmp     w0, 3
    b.eq    sort_menu_insert
    cmp     w0, 4
    b.eq    sort_menu_merge
    cmp     w0, 5
    b.eq    sort_menu_quick
    cmp     w0, 6
    b.eq    sort_menu_heap
    cmp     w0, 7
    b.eq    sort_menu_shell
    cmp     w0, 8
    b.eq    sort_menu_count
    cmp     w0, 9
    b.eq    sort_menu_new
    b       sort_menu_loop

sort_menu_bubble:
    bl      sort_bubble_interactive
    bl      wait_for_enter
    b       sort_menu_loop

sort_menu_select:
    bl      sort_select_interactive
    bl      wait_for_enter
    b       sort_menu_loop

sort_menu_insert:
    bl      sort_insert_interactive
    bl      wait_for_enter
    b       sort_menu_loop

sort_menu_merge:
    bl      sort_merge_interactive
    bl      wait_for_enter
    b       sort_menu_loop

sort_menu_quick:
    bl      sort_quick_interactive
    bl      wait_for_enter
    b       sort_menu_loop

sort_menu_heap:
    bl      sort_heap_interactive
    bl      wait_for_enter
    b       sort_menu_loop

sort_menu_shell:
    bl      sort_shell_interactive
    bl      wait_for_enter
    b       sort_menu_loop

sort_menu_count:
    bl      sort_count_interactive
    bl      wait_for_enter
    b       sort_menu_loop

sort_menu_new:
    bl      sort_new_array
    bl      wait_for_enter
    b       sort_menu_loop

sort_menu_exit:
    ldp     fp, lr, [sp], 16
    ret

// sort_menu_draw() - the menu screen, redrawn each time round the loop
sort_menu_draw:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =sort_scr_menu
    bl      ui_screen

    ldr     x0, =sort_hint_menu
    bl      ui_footer

    mov     w0, 4
    mov     w1, 10
    mov     w2, 60
    mov     w3, 14
    ldr     x4, =sort_pan_menu
    bl      ui_panel

    mov     w0, 6
    ldr     x1, =sort_key_1
    ldr     x2, =sort_opt_1
    bl      sort_menu_line

    mov     w0, 7
    ldr     x1, =sort_key_2
    ldr     x2, =sort_opt_2
    bl      sort_menu_line

    mov     w0, 8
    ldr     x1, =sort_key_3
    ldr     x2, =sort_opt_3
    bl      sort_menu_line

    mov     w0, 9
    ldr     x1, =sort_key_4
    ldr     x2, =sort_opt_4
    bl      sort_menu_line

    mov     w0, 10
    ldr     x1, =sort_key_5
    ldr     x2, =sort_opt_5
    bl      sort_menu_line

    mov     w0, 11
    ldr     x1, =sort_key_6
    ldr     x2, =sort_opt_6
    bl      sort_menu_line

    mov     w0, 12
    ldr     x1, =sort_key_7
    ldr     x2, =sort_opt_7
    bl      sort_menu_line

    mov     w0, 13
    ldr     x1, =sort_key_8
    ldr     x2, =sort_opt_8
    bl      sort_menu_line

    mov     w0, 14
    ldr     x1, =sort_key_9
    ldr     x2, =sort_opt_9
    bl      sort_menu_line

    mov     w0, 15
    ldr     x1, =sort_key_0
    ldr     x2, =sort_opt_0
    bl      sort_menu_line

    // what is loaded, so the menu is never a dead end
    ldr     x19, =sort_size
    ldr     w19, [x19]
    cmp     w19, 0
    b.le    sort_menu_draw_none

    mov     w0, 16
    mov     w1, 17
    bl      ui_at
    mov     w0, SORT_DIM
    bl      th_fg
    ldr     x0, =sort_fmt_have
    mov     w1, w19
    bl      printf
    bl      th_off
    b       sort_menu_draw_ask

sort_menu_draw_none:
    mov     w0, 16
    mov     w1, 17
    mov     w2, SORT_DIM
    ldr     x3, =sort_msg_have_not
    bl      ui_text

sort_menu_draw_ask:
    mov     w0, 19
    mov     w1, 13
    ldr     x2, =sort_ask_choice
    bl      ui_prompt
    bl      sort_flush

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// sort_menu_line(w0 = row, x1 = key text, x2 = option text)
sort_menu_line:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    mov     x21, x1
    mov     x20, x2

    mov     w0, w19
    mov     w1, 13
    mov     w2, SORT_KEY
    mov     x3, x21
    bl      ui_badge

    mov     w0, w19
    mov     w1, 17
    mov     w2, SORT_TEXT
    mov     x3, x20
    bl      ui_text

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// sort_new_array() - read a size and fill the array with random values
sort_new_array:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    ldr     x0, =sort_view
    str     wzr, [x0]

    ldr     x0, =sort_scr_new
    ldr     x1, =sort_hint_new
    bl      sort_chrome

    ldr     x0, =sort_say_row
    ldr     w19, [x0]
    mov     w0, w19
    mov     w1, 4
    ldr     x2, =sort_ask_size
    bl      ui_prompt
    bl      sort_flush

    mov     w0, 3
    mov     w1, SORT_CAP
    bl      read_int_range
    mov     w19, w0
    mov     w21, w1                         // 0 means end of input; the fill
                                            // counter reuses w21 below
    bl      th_off
    bl      sort_bottom

    // End of input is not a size. Taking the minimum here rebuilt the
    // array as three values and reported it as though it were typed.
    cbz     w21, sort_new_out

    ldr     x20, =sort_size
    str     w19, [x20]

    ldr     x20, =sort_array
    mov     w21, 0

sort_new_fill:
    cmp     w21, w19
    b.ge    sort_new_shown

    mov     w0, SORT_KEYS
    bl      get_random
    str     w0, [x20, w21, sxtw 2]

    add     w21, w21, 1
    b       sort_new_fill

sort_new_shown:
    // a fresh array is not sorted, so nothing may still be wearing green
    bl      sort_reset_all
    bl      sort_render

    ldr     x0, =sort_fmt_fresh
    mov     w1, w19
    bl      sort_say
    bl      sort_flush

sort_new_out:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// sort_chrome(x0 = screen title, x1 = footer hint) - everything on a
// screen that does not move while it runs. sort_view picks the layout.
sort_chrome:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0
    mov     x20, x1

    mov     x0, x19
    bl      ui_screen
    mov     x0, x20
    bl      ui_footer

    ldr     x0, =sort_view
    ldr     w0, [x0]
    cbnz    w0, sort_chrome_buckets

    mov     w0, 4
    mov     w1, 2
    mov     w2, 78
    mov     w3, 13
    ldr     x4, =sort_pan_array
    bl      ui_panel

    mov     w0, 17
    ldr     x1, =sort_say_row
    str     w0, [x1]
    mov     w0, 18
    ldr     x1, =sort_stat_row
    str     w0, [x1]
    mov     w0, 19
    ldr     x1, =sort_leg_row
    str     w0, [x1]

    bl      sort_legend
    b       sort_chrome_done

sort_chrome_buckets:
    mov     w0, 4
    mov     w1, 2
    mov     w2, 78
    mov     w3, 4
    ldr     x4, =sort_pan_input
    bl      ui_panel

    mov     w0, 8
    mov     w1, 2
    mov     w2, 78
    mov     w3, 3
    ldr     x4, =sort_pan_output
    bl      ui_panel

    mov     w0, 11
    mov     w1, 2
    mov     w2, 78
    mov     w3, 5
    ldr     x4, =sort_pan_bucket
    bl      ui_panel

    mov     w0, 16
    ldr     x1, =sort_say_row
    str     w0, [x1]
    mov     w0, 17
    ldr     x1, =sort_stat_row
    str     w0, [x1]
    mov     w0, 18
    ldr     x1, =sort_leg_row
    str     w0, [x1]

    mov     w0, 13
    mov     w1, 3
    mov     w2, SORT_FAINT
    ldr     x3, =sort_lbl_keys_lo
    bl      ui_text
    mov     w0, 14
    mov     w1, 3
    mov     w2, SORT_FAINT
    ldr     x3, =sort_lbl_keys_hi
    bl      ui_text

    bl      sort_bucket_ruler
    bl      sort_legend_count

sort_chrome_done:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// sort_begin(x0 = title, x1 = hint, x2 = best, x3 = avg, x4 = worst,
//            x5 = space) - draw the screen, ask for a speed, show the
// array once, and hold until the student is looking
sort_begin:
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

    mov     x0, x19
    mov     x1, x20
    bl      sort_chrome

    mov     w0, 20
    mov     w1, 4
    mov     x2, x21
    mov     x3, x22
    mov     x4, x23
    mov     x5, x24
    bl      ui_complexity

    bl      sort_reset_all
    bl      sort_ask_speed

    ldr     x0, =sort_stat_row
    ldr     w0, [x0]
    mov     w1, 3
    mov     w2, 76
    bl      sort_blank

    bl      sort_render
    ldr     x0, =sort_size
    ldr     w25, [x0]
    ldr     x0, =sort_fmt_ready
    mov     w1, w25
    bl      sort_say

    ldr     x0, =sort_hint_start
    bl      ui_footer
    bl      sort_flush
    bl      wait_for_enter

    ldr     x0, =sort_hint_run
    bl      ui_footer
    bl      sort_bottom

    ldr     x25, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// sort_finish() - the last frame: every marker gone, every cell settled
sort_finish:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    bl      sort_clear_marks
    bl      sort_close_hole
    bl      sort_clear_band
    bl      sort_src_clear
    bl      sort_lock_all
    bl      sort_render

    ldr     x0, =sort_cmp_count
    ldr     w19, [x0]
    ldr     x0, =sort_move_count
    ldr     w20, [x0]
    ldr     x0, =sort_fmt_done
    mov     w1, w19
    mov     w2, w20
    bl      sort_say

    ldr     x0, =sort_hint_done
    bl      ui_footer
    bl      sort_flush

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// sort_ask_speed() - read the frame time into sort_delay
sort_ask_speed:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =sort_say_row
    ldr     w19, [x0]

    mov     w0, w19
    mov     w1, 3
    mov     w2, 76
    bl      sort_blank

    mov     w0, w19
    mov     w1, 4
    ldr     x2, =sort_ask_ms
    bl      ui_prompt
    bl      sort_flush

    mov     w0, 100
    mov     w1, 2500
    bl      read_int_range
    cbz     w1, sort_ask_speed_keep         // end of input is not an answer:
    ldr     x1, =sort_delay                 // keep the frame time we had
    str     w0, [x1]
sort_ask_speed_keep:
    bl      th_off
    bl      sort_bottom

    mov     w0, w19
    mov     w1, 3
    mov     w2, 76
    bl      sort_blank

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// sort_no_array() - the screen a run shows when there is nothing to sort
sort_no_array:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =sort_scr_menu
    bl      ui_screen
    ldr     x0, =sort_hint_menu
    bl      ui_footer

    mov     w0, 10
    mov     w1, 9
    mov     w2, SORT_WARN
    ldr     x3, =sort_msg_none
    bl      ui_text
    bl      sort_flush

    ldp     fp, lr, [sp], 16
    ret

// sort_blank(w0 = row, w1 = column, w2 = run length) - wipe a run of
// cells without disturbing the borders on either side
sort_blank:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w2
    bl      ui_at
    ldr     x0, =sort_space
    mov     w1, w19
    bl      ui_repeat

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// sort_bottom() - put the frame's bottom edge back. The shared input
// reader clears row 24 to make room for its complaint, which takes the
// border with it.
sort_bottom:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, 24
    mov     w1, 1
    bl      ui_at
    mov     w0, SORT_FAINT
    bl      th_fg
    ldr     x0, =sort_corner_bl
    bl      printf
    ldr     x0, =sort_rule_h
    mov     w1, 78
    bl      ui_repeat
    ldr     x0, =sort_corner_br
    bl      printf
    bl      th_off

    ldp     fp, lr, [sp], 16
    ret

// sort_say(x0 = format, w1, w2, w3, w4) - the one line that narrates the
// frame the student is looking at. It wipes the row first, so an older
// caption never shows through a shorter one.
sort_say:
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
    mov     w23, w4

    ldr     x0, =sort_say_row
    ldr     w24, [x0]

    mov     w0, w24
    mov     w1, 3
    mov     w2, 76
    bl      sort_blank

    mov     w0, w24
    mov     w1, 4
    bl      ui_at
    mov     w0, SORT_TEXT
    bl      th_fg
    mov     x0, x19
    mov     w1, w20
    mov     w2, w21
    mov     w3, w22
    mov     w4, w23
    bl      printf
    bl      th_off

    ldr     x25, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// sort_note(x0 = format, w1, w2) - the algorithm's own readout, to the
// right of the counters
sort_note:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     x19, x0
    mov     w20, w1
    mov     w21, w2

    ldr     x0, =sort_stat_row
    ldr     w22, [x0]

    mov     w0, w22
    mov     w1, 42
    mov     w2, 36
    bl      sort_blank

    mov     w0, w22
    mov     w1, 42
    bl      ui_at
    mov     w0, SORT_DIM
    bl      th_fg
    mov     x0, x19
    mov     w1, w20
    mov     w2, w21
    bl      printf
    bl      th_off

    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// sort_counters() - how much work the run has cost so far
sort_counters:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    ldr     x0, =sort_stat_row
    ldr     w19, [x0]
    ldr     x0, =sort_cmp_count
    ldr     w20, [x0]
    ldr     x0, =sort_move_count
    ldr     w21, [x0]

    mov     w0, w19
    mov     w1, 4
    mov     w2, 36
    bl      sort_blank

    mov     w0, w19
    mov     w1, 4
    bl      ui_at
    mov     w0, SORT_DIM
    bl      th_fg
    ldr     x0, =sort_fmt_counts
    mov     w1, w20
    mov     w2, w21
    bl      printf
    bl      th_off

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// sort_chip(w0 = column, w1 = role, x2 = label) -> w0 = the next column
// One entry in the legend: a filled swatch and what that colour means.
sort_chip:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    mov     w19, w0
    mov     w20, w1
    mov     x21, x2

    ldr     x0, =sort_leg_row
    ldr     w22, [x0]

    mov     w0, w22
    mov     w1, w19
    bl      ui_at
    mov     w0, w20
    bl      th_bg
    ldr     x0, =sort_chip_pad
    bl      printf
    bl      th_off

    add     w1, w19, 3
    mov     w0, w22
    mov     w2, SORT_DIM
    mov     x3, x21
    bl      ui_text

    mov     x0, x21
    bl      strlen
    add     w23, w19, w0
    add     w0, w23, 5

    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// sort_legend() - what the colours mean on the bar screen
sort_legend:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =sort_leg_row
    ldr     w0, [x0]
    mov     w1, 3
    mov     w2, 76
    bl      sort_blank

    mov     w19, 3

    mov     w0, w19
    mov     w1, SORT_WARN
    ldr     x2, =sort_lbl_cmp
    bl      sort_chip
    mov     w19, w0

    mov     w0, w19
    mov     w1, SORT_HOT
    ldr     x2, =sort_lbl_hand
    bl      sort_chip
    mov     w19, w0

    mov     w0, w19
    mov     w1, SORT_ACCENT
    ldr     x2, =sort_lbl_moved
    bl      sort_chip
    mov     w19, w0

    mov     w0, w19
    mov     w1, SORT_KEY
    ldr     x2, =sort_lbl_placed
    bl      sort_chip
    mov     w19, w0

    mov     w0, w19
    mov     w1, SORT_OK
    ldr     x2, =sort_lbl_settled
    bl      sort_chip
    mov     w19, w0

    mov     w0, w19
    mov     w1, SORT_FAINT
    ldr     x2, =sort_lbl_range
    bl      sort_chip
    mov     w19, w0

    mov     w0, w19
    mov     w1, SORT_BAD
    ldr     x2, =sort_lbl_hole
    bl      sort_chip

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// sort_legend_count() - the counting sort screen paints different things
sort_legend_count:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =sort_leg_row
    ldr     w0, [x0]
    mov     w1, 3
    mov     w2, 76
    bl      sort_blank

    mov     w19, 3

    mov     w0, w19
    mov     w1, SORT_HOT
    ldr     x2, =sort_lbl_read
    bl      sort_chip
    mov     w19, w0

    mov     w0, w19
    mov     w1, SORT_ACCENT
    ldr     x2, =sort_lbl_bucket
    bl      sort_chip
    mov     w19, w0

    mov     w0, w19
    mov     w1, SORT_KEY
    ldr     x2, =sort_lbl_placed
    bl      sort_chip
    mov     w19, w0

    mov     w0, w19
    mov     w1, SORT_OK
    ldr     x2, =sort_lbl_settled
    bl      sort_chip
    mov     w19, w0

    mov     w0, w19
    mov     w1, SORT_FAINT
    ldr     x2, =sort_lbl_empty
    bl      sort_chip

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// sort_col_of(w0 = slot) -> w0 = the column that cell starts at. The
// strip is centred, so a short array does not hug the left edge.
sort_col_of:
    mov     w1, 6
    mul     w1, w0, w1
    ldr     x2, =sort_size
    ldr     w2, [x2]
    add     w3, w2, w2
    add     w3, w3, w2                      // three columns per value
    mov     w2, 41
    sub     w2, w2, w3
    add     w0, w2, w1
    ret

// sort_role_of(w0 = slot) -> w0 = the colour role that cell wears now.
// The order is the order a reader cares about: what just happened first,
// what has settled last.
sort_role_of:
    mov     w1, w0

    ldr     x2, =sort_hole
    ldr     w3, [x2]
    cmp     w1, w3
    b.eq    sort_role_open

    ldr     x2, =sort_dst_a
    ldr     w3, [x2]
    cmp     w1, w3
    b.eq    sort_role_moved
    ldr     x2, =sort_dst_b
    ldr     w3, [x2]
    cmp     w1, w3
    b.eq    sort_role_moved

    ldr     x2, =sort_hand
    ldr     w3, [x2]
    cmp     w1, w3
    b.eq    sort_role_hand

    ldr     x2, =sort_cmp_a
    ldr     w3, [x2]
    cmp     w1, w3
    b.eq    sort_role_pair
    ldr     x2, =sort_cmp_b
    ldr     w3, [x2]
    cmp     w1, w3
    b.eq    sort_role_pair

    ldr     x2, =sort_put_lo
    ldr     w3, [x2]
    cmp     w3, 0
    b.lt    sort_role_settled
    cmp     w1, w3
    b.lt    sort_role_settled
    ldr     x2, =sort_put_hi
    ldr     w4, [x2]
    cmp     w1, w4
    b.le    sort_role_placed

sort_role_settled:
    // the green run stops at an open hole: the cells past it are still
    // shifting, whatever the sorted prefix claims
    ldr     x2, =sort_hole
    ldr     w3, [x2]
    cmp     w3, 0
    b.lt    sort_role_locked
    cmp     w1, w3
    b.ge    sort_role_band

sort_role_locked:
    ldr     x2, =sort_locked
    ldr     w3, [x2, w1, sxtw 2]
    cbnz    w3, sort_role_green

sort_role_band:
    ldr     x2, =sort_lo
    ldr     w3, [x2]
    cmp     w3, 0
    b.lt    sort_role_rest
    cmp     w1, w3
    b.lt    sort_role_rest
    ldr     x2, =sort_hi
    ldr     w4, [x2]
    cmp     w1, w4
    b.le    sort_role_range

sort_role_rest:
    mov     w0, SORT_NODE
    ret

sort_role_open:
    mov     w0, SORT_BAD
    ret

sort_role_moved:
    mov     w0, SORT_ACCENT
    ret

sort_role_hand:
    mov     w0, SORT_HOT
    ret

sort_role_pair:
    mov     w0, SORT_WARN
    ret

sort_role_placed:
    mov     w0, SORT_KEY
    ret

sort_role_green:
    mov     w0, SORT_OK
    ret

sort_role_range:
    mov     w0, SORT_FAINT
    ret

// sort_cell(w0 = slot) -> w0 = 1 when the cell holds a value, w1 = value
sort_cell:
    ldr     x2, =sort_src
    ldr     w3, [x2, w0, sxtw 2]
    cmp     w3, SORT_FROM_NONE
    b.eq    sort_cell_empty
    cmp     w3, SORT_FROM_AUX
    b.eq    sort_cell_scratch

    ldr     x2, =sort_array
    ldr     w1, [x2, w0, sxtw 2]
    mov     w0, 1
    ret

sort_cell_scratch:
    ldr     x2, =sort_aux
    ldr     w1, [x2, w0, sxtw 2]
    mov     w0, 1
    ret

sort_cell_empty:
    mov     w0, 0
    mov     w1, 0
    ret

// sort_bar_of(w0 = slot) -> w0 = how many rows tall that cell's bar is,
// zero when the cell holds nothing
sort_bar_of:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      sort_cell
    cbz     w0, sort_bar_none

    mov     w2, 13
    udiv    w0, w1, w2
    add     w0, w0, 1
    b       sort_bar_done

sort_bar_none:
    mov     w0, 0

sort_bar_done:
    ldp     fp, lr, [sp], 16
    ret

// sort_render() - repaint everything that moves and nothing that does not
sort_render:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =sort_view
    ldr     w0, [x0]
    cbnz    w0, sort_render_count

    bl      sort_render_strip
    b       sort_render_end

sort_render_count:
    bl      sort_render_buckets

sort_render_end:
    bl      sort_counters

    ldp     fp, lr, [sp], 16
    ret

// sort_render_strip() - the bars, the values, the slot ruler and the
// marks underneath them
sort_render_strip:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x0, =sort_size
    ldr     w19, [x0]

    mov     w20, 5                          // the top bar row
sort_strip_row:
    cmp     w20, 12
    b.gt    sort_strip_values

    mov     w0, w20
    mov     w1, 3
    mov     w2, 76
    bl      sort_blank

    mov     w21, 0
sort_strip_bar:
    cmp     w21, w19
    b.ge    sort_strip_row_end

    mov     w0, w21
    bl      sort_bar_of
    mov     w22, w0
    cbz     w22, sort_strip_bar_next

    mov     w0, 13
    sub     w0, w0, w22                     // the highest row this bar reaches
    cmp     w20, w0
    b.lt    sort_strip_bar_next

    mov     w0, w21
    bl      sort_role_of
    mov     w23, w0
    mov     w0, w21
    bl      sort_col_of
    mov     w1, w0
    mov     w0, w20
    bl      ui_at
    mov     w0, w23
    bl      th_fg
    ldr     x0, =sort_block
    bl      printf
    bl      th_off

sort_strip_bar_next:
    add     w21, w21, 1
    b       sort_strip_bar

sort_strip_row_end:
    add     w20, w20, 1
    b       sort_strip_row

sort_strip_values:
    mov     w0, 13
    mov     w1, 3
    mov     w2, 76
    bl      sort_blank
    mov     w0, 14
    mov     w1, 3
    mov     w2, 76
    bl      sort_blank

    mov     w21, 0
sort_strip_cell:
    cmp     w21, w19
    b.ge    sort_strip_marks

    mov     w0, w21
    bl      sort_col_of
    mov     w24, w0

    mov     w0, 13
    mov     w1, w24
    bl      ui_at
    mov     w0, w21
    bl      sort_role_of
    bl      th_bg
    mov     w0, w21
    bl      sort_cell
    cbz     w0, sort_strip_hole
    ldr     x0, =sort_fmt_cell
    bl      printf
    b       sort_strip_cell_end

sort_strip_hole:
    ldr     x0, =sort_cell_gone
    bl      printf

sort_strip_cell_end:
    bl      th_off

    mov     w0, 14
    mov     w1, w24
    bl      ui_at
    mov     w0, SORT_FAINT
    bl      th_fg
    ldr     x0, =sort_fmt_cell
    mov     w1, w21
    bl      printf
    bl      th_off

    add     w21, w21, 1
    b       sort_strip_cell

sort_strip_marks:
    bl      sort_marks

    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// sort_marks() - the row under the cells: the band an algorithm is
// working inside, the seam between two runs, a partition boundary, the
// value in hand and the slot it left open. sort_split and sort_bound
// count gaps, not cells: g means the gap in front of cell g.
sort_marks:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     w0, 15
    mov     w1, 3
    mov     w2, 76
    bl      sort_blank

    ldr     x0, =sort_lo
    ldr     w19, [x0]
    cmp     w19, 0
    b.lt    sort_marks_seam
    ldr     x0, =sort_hi
    ldr     w20, [x0]

    mov     w0, w19
    bl      sort_col_of
    mov     w21, w0
    mov     w0, w20
    bl      sort_col_of
    add     w22, w0, 3

    mov     w0, 15
    mov     w1, w21
    bl      ui_at
    mov     w0, SORT_FAINT
    bl      th_fg
    ldr     x0, =sort_rule_h
    sub     w1, w22, w21
    add     w1, w1, 1
    bl      ui_repeat
    bl      th_off

sort_marks_seam:
    ldr     x0, =sort_split
    ldr     w19, [x0]
    cmp     w19, 0
    b.lt    sort_marks_bound

    mov     w0, w19
    bl      sort_col_of
    sub     w1, w0, 2
    mov     w0, 15
    bl      ui_at
    mov     w0, SORT_KEY
    bl      th_fg
    ldr     x0, =sort_tee_up
    bl      printf
    bl      th_off

sort_marks_bound:
    ldr     x0, =sort_bound
    ldr     w19, [x0]
    cmp     w19, 0
    b.lt    sort_marks_hand

    mov     w0, w19
    bl      sort_col_of
    sub     w1, w0, 2
    mov     w0, 15
    bl      ui_at
    mov     w0, SORT_ACCENT
    bl      th_fg
    ldr     x0, =sort_tee_up
    bl      printf
    bl      th_off

sort_marks_hand:
    ldr     x0, =sort_hand
    ldr     w19, [x0]
    cmp     w19, 0
    b.lt    sort_marks_hole

    mov     w0, w19
    bl      sort_col_of
    add     w1, w0, 1
    mov     w0, 15
    bl      ui_at
    mov     w0, SORT_HOT
    bl      th_fg
    ldr     x0, =sort_pointer
    bl      printf
    bl      th_off

sort_marks_hole:
    ldr     x0, =sort_hole
    ldr     w19, [x0]
    cmp     w19, 0
    b.lt    sort_marks_done

    mov     w0, w19
    bl      sort_col_of
    add     w1, w0, 1
    mov     w0, 15
    bl      ui_at
    mov     w0, SORT_BAD
    bl      th_fg
    ldr     x0, =sort_pointer
    bl      printf
    bl      th_off

sort_marks_done:
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// sort_bucket_ruler() - the decade ticks over the bucket grid, drawn once
sort_bucket_ruler:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     w19, 0
sort_ruler_tick:
    cmp     w19, 5
    b.ge    sort_ruler_done

    mov     w20, 10
    mul     w20, w19, w20

    mov     w0, 12
    add     w1, w20, 14
    bl      ui_at
    mov     w0, SORT_FAINT
    bl      th_fg
    ldr     x0, =sort_digit
    mov     w1, w20
    bl      printf
    bl      th_off

    add     w19, w19, 1
    b       sort_ruler_tick

sort_ruler_done:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// sort_render_buckets() - counting sort's screen: the array being read,
// the output filling up, and the hundred buckets that do all the work
sort_render_buckets:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    str     x25, [sp, 64]

    ldr     x0, =sort_size
    ldr     w19, [x0]

    mov     w0, 5
    mov     w1, 3
    mov     w2, 76
    bl      sort_blank
    mov     w0, 6
    mov     w1, 3
    mov     w2, 76
    bl      sort_blank
    mov     w0, 9
    mov     w1, 3
    mov     w2, 76
    bl      sort_blank

    mov     w20, 0
sort_bucket_cellrow:
    cmp     w20, w19
    b.ge    sort_bucket_out

    mov     w0, w20
    bl      sort_col_of
    mov     w21, w0

    mov     w0, 5
    mov     w1, w21
    bl      ui_at
    mov     w0, w20
    bl      sort_role_of
    bl      th_bg
    mov     w0, w20
    bl      sort_cell
    cbz     w0, sort_bucket_cell_gone
    ldr     x0, =sort_fmt_cell
    bl      printf
    b       sort_bucket_cell_drawn

sort_bucket_cell_gone:
    // the value has already moved to the output, so the slot shows empty
    ldr     x0, =sort_cell_gone
    bl      printf

sort_bucket_cell_drawn:
    bl      th_off

    mov     w0, 6
    mov     w1, w21
    bl      ui_at
    mov     w0, SORT_FAINT
    bl      th_fg
    ldr     x0, =sort_fmt_cell
    mov     w1, w20
    bl      printf
    bl      th_off

    add     w20, w20, 1
    b       sort_bucket_cellrow

sort_bucket_out:
    ldr     x0, =sort_out_at
    ldr     w22, [x0]

    mov     w20, 0
sort_bucket_outrow:
    cmp     w20, w19
    b.ge    sort_bucket_grid

    mov     w0, w20
    bl      sort_col_of
    mov     w21, w0

    mov     w0, 9
    mov     w1, w21
    bl      ui_at

    ldr     x0, =sort_out_fill
    ldr     w0, [x0, w20, sxtw 2]
    cbz     w0, sort_bucket_out_free

    cmp     w20, w22
    b.eq    sort_bucket_out_new
    mov     w0, SORT_KEY
    b       sort_bucket_out_paint

sort_bucket_out_new:
    mov     w0, SORT_ACCENT

sort_bucket_out_paint:
    bl      th_bg
    ldr     x0, =sort_out
    ldr     w1, [x0, w20, sxtw 2]
    ldr     x0, =sort_fmt_cell
    bl      printf
    bl      th_off
    b       sort_bucket_out_next

sort_bucket_out_free:
    mov     w0, SORT_FAINT
    bl      th_fg
    ldr     x0, =sort_cell_gone
    bl      printf
    bl      th_off

sort_bucket_out_next:
    add     w20, w20, 1
    b       sort_bucket_outrow

sort_bucket_grid:
    ldr     x0, =sort_bucket_at
    ldr     w23, [x0]
    ldr     x24, =sort_bucket

    mov     w20, 0
sort_bucket_key:
    cmp     w20, SORT_KEYS
    b.ge    sort_bucket_done

    // fifty keys to a row, so the whole key space fits on the screen
    mov     w0, 50
    udiv    w21, w20, w0
    msub    w22, w21, w0, w20
    add     w21, w21, 13                    // row 13 or row 14
    add     w22, w22, 14                    // column

    mov     w0, w21
    mov     w1, w22
    bl      ui_at

    cmp     w20, w23
    b.eq    sort_bucket_key_live
    ldr     w0, [x24, w20, sxtw 2]
    cbz     w0, sort_bucket_key_free
    mov     w0, SORT_KEY
    bl      th_fg
    b       sort_bucket_key_glyph

sort_bucket_key_live:
    mov     w0, SORT_ACCENT
    bl      th_bg
    b       sort_bucket_key_glyph

sort_bucket_key_free:
    mov     w0, SORT_FAINT
    bl      th_fg

sort_bucket_key_glyph:
    ldr     w25, [x24, w20, sxtw 2]
    cbz     w25, sort_bucket_key_dot
    cmp     w25, 9
    b.gt    sort_bucket_key_many
    ldr     x0, =sort_digit
    mov     w1, w25
    bl      printf
    b       sort_bucket_key_end

sort_bucket_key_many:
    ldr     x0, =sort_many
    bl      printf
    b       sort_bucket_key_end

sort_bucket_key_dot:
    ldr     x0, =sort_dot_free
    bl      printf

sort_bucket_key_end:
    bl      th_off
    add     w20, w20, 1
    b       sort_bucket_key

sort_bucket_done:
    ldr     x25, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// sort_clear_marks() - drop the transient markers only. The band, the
// hole, the placed run and the settled cells survive, which is what lets
// a merge keep its green instead of starting over every inner step.
sort_clear_marks:
    mov     w0, -1
    ldr     x1, =sort_cmp_a
    str     w0, [x1]
    ldr     x1, =sort_cmp_b
    str     w0, [x1]
    ldr     x1, =sort_hand
    str     w0, [x1]
    ldr     x1, =sort_dst_a
    str     w0, [x1]
    ldr     x1, =sort_dst_b
    str     w0, [x1]
    ldr     x1, =sort_bound
    str     w0, [x1]
    ret

// sort_clear_band() - forget the range an algorithm was working inside
sort_clear_band:
    mov     w0, -1
    ldr     x1, =sort_lo
    str     w0, [x1]
    ldr     x1, =sort_hi
    str     w0, [x1]
    ldr     x1, =sort_split
    str     w0, [x1]
    ldr     x1, =sort_put_lo
    str     w0, [x1]
    ldr     x1, =sort_put_hi
    str     w0, [x1]
    ret

// sort_band(w0 = low, w1 = high) - the range in play this moment
sort_band:
    ldr     x2, =sort_lo
    str     w0, [x2]
    ldr     x2, =sort_hi
    str     w1, [x2]
    ret

// sort_open_hole(w0 = slot) - a key was lifted out; the slot underneath
// still holds a stale copy, so the cell draws as an empty one
sort_open_hole:
    ldr     x1, =sort_hole
    ldr     w2, [x1]
    ldr     x3, =sort_src
    cmp     w2, 0
    b.lt    sort_hole_set
    mov     w4, SORT_FROM_ARRAY
    str     w4, [x3, w2, sxtw 2]

sort_hole_set:
    str     w0, [x1]
    mov     w4, SORT_FROM_NONE
    str     w4, [x3, w0, sxtw 2]
    ret

// sort_close_hole() - the key landed, so the slot means something again
sort_close_hole:
    ldr     x1, =sort_hole
    ldr     w2, [x1]
    cmp     w2, 0
    b.lt    sort_hole_shut
    ldr     x3, =sort_src
    mov     w4, SORT_FROM_ARRAY
    str     w4, [x3, w2, sxtw 2]
    mov     w4, -1
    str     w4, [x1]

sort_hole_shut:
    ret

// sort_lock(w0 = slot) - that cell holds its final value
sort_lock:
    ldr     x1, =sort_locked
    mov     w2, 1
    str     w2, [x1, w0, sxtw 2]
    ret

// sort_lock_range(w0 = low, w1 = high)
sort_lock_range:
    ldr     x2, =sort_locked
    mov     w3, 1
sort_lock_walk:
    cmp     w0, w1
    b.gt    sort_lock_walked
    str     w3, [x2, w0, sxtw 2]
    add     w0, w0, 1
    b       sort_lock_walk

sort_lock_walked:
    ret

// sort_lock_all() / sort_unlock_all()
sort_lock_all:
    ldr     x0, =sort_size
    ldr     w1, [x0]
    sub     w1, w1, 1
    mov     w0, 0
    b       sort_lock_range

sort_unlock_all:
    ldr     x1, =sort_locked
    mov     w0, 0
sort_unlock_walk:
    cmp     w0, SORT_CAP
    b.ge    sort_unlock_walked
    str     wzr, [x1, w0, sxtw 2]
    add     w0, w0, 1
    b       sort_unlock_walk

sort_unlock_walked:
    ret

// sort_src_set(w0 = slot, w1 = where that cell takes its value from)
sort_src_set:
    ldr     x2, =sort_src
    str     w1, [x2, w0, sxtw 2]
    ret

// sort_src_clear() - every cell reads from the array again
sort_src_clear:
    ldr     x1, =sort_src
    mov     w0, 0
sort_src_walk:
    cmp     w0, SORT_CAP
    b.ge    sort_src_walked
    str     wzr, [x1, w0, sxtw 2]
    add     w0, w0, 1
    b       sort_src_walk

sort_src_walked:
    ret

// sort_reset_all() - back to an array with no story attached to it
sort_reset_all:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      sort_clear_marks
    bl      sort_clear_band
    bl      sort_src_clear
    bl      sort_unlock_all

    mov     w0, -1
    ldr     x1, =sort_hole
    str     w0, [x1]
    ldr     x1, =sort_out_at
    str     w0, [x1]
    ldr     x1, =sort_bucket_at
    str     w0, [x1]

    ldr     x1, =sort_cmp_count
    str     wzr, [x1]
    ldr     x1, =sort_move_count
    str     wzr, [x1]

    mov     w0, 0
    ldr     x1, =sort_out_fill
sort_reset_out:
    cmp     w0, SORT_CAP
    b.ge    sort_reset_keys
    str     wzr, [x1, w0, sxtw 2]
    add     w0, w0, 1
    b       sort_reset_out

sort_reset_keys:
    // a run must never open on the buckets the run before it left behind
    mov     w0, 0
    ldr     x1, =sort_bucket
sort_reset_bucket:
    cmp     w0, SORT_KEYS
    b.ge    sort_reset_done
    str     wzr, [x1, w0, sxtw 2]
    add     w0, w0, 1
    b       sort_reset_bucket

sort_reset_done:
    ldp     fp, lr, [sp], 16
    ret

// sort_tally_cmp() / sort_tally_move() - the two numbers on the status row
sort_tally_cmp:
    ldr     x0, =sort_cmp_count
    ldr     w1, [x0]
    add     w1, w1, 1
    str     w1, [x0]
    ret

sort_tally_move:
    ldr     x0, =sort_move_count
    ldr     w1, [x0]
    add     w1, w1, 1
    str     w1, [x0]
    ret

// sort_flush() - push the drawing out before a delay, or the whole
// animation arrives at once
sort_flush:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     x0, 0
    bl      fflush

    ldp     fp, lr, [sp], 16
    ret

// sort_pause(w0 = milliseconds)
sort_pause:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0
    bl      sort_flush
    mov     w0, w19
    bl      delay_ms

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// sort_wait_cmp() - a comparison gets the whole frame time
sort_wait_cmp:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =sort_delay
    ldr     w0, [x0]
    bl      sort_pause

    ldp     fp, lr, [sp], 16
    ret

// sort_wait_move() - a frame where data moved gets half of it
sort_wait_move:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =sort_delay
    ldr     w0, [x0]
    lsr     w0, w0, 1
    bl      sort_pause

    ldp     fp, lr, [sp], 16
    ret

// sort_ready() -> w0 = 1 when there is an array to sort
sort_ready:
    ldr     x0, =sort_size
    ldr     w0, [x0]
    cmp     w0, 0
    cset    w0, gt
    ret

// ---------------------------------------------------------------- bubble

// sort_bubble_interactive() - speed, then the animated run
sort_bubble_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      sort_ready
    cbz     w0, sort_bubble_no_array

    ldr     x0, =sort_view
    str     wzr, [x0]

    ldr     x0, =sort_scr_bubble
    ldr     x1, =sort_hint_run
    ldr     x2, =sort_on
    ldr     x3, =sort_on2
    ldr     x4, =sort_on2
    ldr     x5, =sort_o1
    bl      sort_begin

    bl      sort_bubble_run
    bl      sort_finish
    b       sort_bubble_left

sort_bubble_no_array:
    bl      sort_no_array

sort_bubble_left:
    ldp     fp, lr, [sp], 16
    ret

// sort_bubble_run() - neighbours trade until a whole pass moves nothing
sort_bubble_run:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]

    ldr     x0, =sort_size
    ldr     w19, [x0]
    ldr     x20, =sort_array

    mov     w21, 0                          // pass number, counting from zero

sort_bubble_pass:
    sub     w0, w19, 1
    cmp     w21, w0
    b.ge    sort_bubble_end

    mov     w25, 0                          // did anything move this pass
    mov     w22, 0                          // the left half of the pair

    ldr     x0, =sort_fmt_pass
    add     w1, w21, 1
    sub     w2, w19, 1
    bl      sort_note

sort_bubble_step:
    sub     w0, w19, w21
    sub     w0, w0, 2
    cmp     w22, w0
    b.gt    sort_bubble_settle

    add     w23, w22, 1

    bl      sort_clear_marks
    ldr     x0, =sort_cmp_a
    str     w22, [x0]
    ldr     x0, =sort_cmp_b
    str     w23, [x0]
    bl      sort_tally_cmp

    ldr     w24, [x20, w22, sxtw 2]
    ldr     w26, [x20, w23, sxtw 2]

    bl      sort_render
    ldr     x0, =sort_fmt_bcmp
    mov     w1, w24
    mov     w2, w26
    bl      sort_say
    bl      sort_wait_cmp

    cmp     w24, w26
    b.le    sort_bubble_next

    str     w26, [x20, w22, sxtw 2]
    str     w24, [x20, w23, sxtw 2]
    bl      sort_tally_move
    mov     w25, 1

    bl      sort_clear_marks
    ldr     x0, =sort_dst_a
    str     w22, [x0]
    ldr     x0, =sort_dst_b
    str     w23, [x0]

    bl      sort_render
    ldr     x0, =sort_fmt_bswap
    mov     w1, w24
    mov     w2, w26
    bl      sort_say
    bl      sort_wait_move

sort_bubble_next:
    add     w22, w22, 1
    b       sort_bubble_step

sort_bubble_settle:
    // the largest value of the pass is now the last loose slot
    sub     w23, w19, w21
    sub     w23, w23, 1

    bl      sort_clear_marks
    mov     w0, w23
    bl      sort_lock

    bl      sort_render
    ldr     x0, =sort_fmt_bsettle
    mov     w1, w23
    bl      sort_say
    bl      sort_wait_move

    cbz     w25, sort_bubble_early

    add     w21, w21, 1
    b       sort_bubble_pass

sort_bubble_early:
    bl      sort_clear_marks
    mov     w0, 0
    sub     w1, w19, 1
    bl      sort_lock_range

    bl      sort_render
    ldr     x0, =sort_fmt_bearly
    bl      sort_say
    bl      sort_wait_move

sort_bubble_end:
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// ------------------------------------------------------------- selection

// sort_select_interactive() - speed, then the animated run
sort_select_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      sort_ready
    cbz     w0, sort_select_no_array

    ldr     x0, =sort_view
    str     wzr, [x0]

    ldr     x0, =sort_scr_select
    ldr     x1, =sort_hint_run
    ldr     x2, =sort_on2
    ldr     x3, =sort_on2
    ldr     x4, =sort_on2
    ldr     x5, =sort_o1
    bl      sort_begin

    bl      sort_select_run
    bl      sort_finish
    b       sort_select_left

sort_select_no_array:
    bl      sort_no_array

sort_select_left:
    ldp     fp, lr, [sp], 16
    ret

// sort_select_run() - find the smallest value left, then put it in place
sort_select_run:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]

    ldr     x0, =sort_size
    ldr     w19, [x0]
    ldr     x20, =sort_array

    mov     w21, 0                          // the slot being filled

sort_select_pass:
    sub     w0, w19, 1
    cmp     w21, w0
    b.ge    sort_select_end

    mov     w22, w21                        // the smallest found so far

    ldr     x0, =sort_fmt_pass
    add     w1, w21, 1
    sub     w2, w19, 1
    bl      sort_note

    bl      sort_clear_marks
    ldr     x0, =sort_dst_a
    str     w21, [x0]
    ldr     x0, =sort_hand
    str     w22, [x0]

    bl      sort_render
    ldr     x0, =sort_fmt_starget
    mov     w1, w21
    bl      sort_say
    bl      sort_wait_move

    add     w23, w21, 1                     // the slot being looked at

sort_select_scan:
    cmp     w23, w19
    b.ge    sort_select_swap

    bl      sort_clear_marks
    ldr     x0, =sort_dst_a
    str     w21, [x0]
    ldr     x0, =sort_hand
    str     w22, [x0]
    ldr     x0, =sort_cmp_b
    str     w23, [x0]
    bl      sort_tally_cmp

    ldr     w24, [x20, w23, sxtw 2]
    ldr     w25, [x20, w22, sxtw 2]

    bl      sort_render
    ldr     x0, =sort_fmt_scmp
    mov     w1, w24
    mov     w2, w25
    bl      sort_say
    bl      sort_wait_cmp

    cmp     w24, w25
    b.ge    sort_select_scan_next

    mov     w22, w23

    bl      sort_clear_marks
    ldr     x0, =sort_dst_a
    str     w21, [x0]
    ldr     x0, =sort_hand
    str     w22, [x0]

    bl      sort_render
    ldr     x0, =sort_fmt_snew
    mov     w1, w24
    mov     w2, w22
    bl      sort_say
    bl      sort_wait_move

sort_select_scan_next:
    add     w23, w23, 1
    b       sort_select_scan

sort_select_swap:
    cmp     w21, w22
    b.eq    sort_select_stay

    ldr     w24, [x20, w21, sxtw 2]
    ldr     w25, [x20, w22, sxtw 2]
    str     w25, [x20, w21, sxtw 2]
    str     w24, [x20, w22, sxtw 2]
    bl      sort_tally_move

    bl      sort_clear_marks
    ldr     x0, =sort_dst_a
    str     w21, [x0]
    ldr     x0, =sort_dst_b
    str     w22, [x0]

    bl      sort_render
    ldr     x0, =sort_fmt_sswap
    mov     w1, w25
    mov     w2, w21
    mov     w3, w24
    bl      sort_say
    bl      sort_wait_move
    b       sort_select_lock

sort_select_stay:
    bl      sort_clear_marks
    ldr     x0, =sort_dst_a
    str     w21, [x0]

    bl      sort_render
    ldr     x0, =sort_fmt_sstay
    mov     w1, w21
    bl      sort_say
    bl      sort_wait_move

sort_select_lock:
    bl      sort_clear_marks
    mov     w0, w21
    bl      sort_lock

    bl      sort_render
    ldr     x0, =sort_fmt_slock
    mov     w1, w21
    bl      sort_say
    bl      sort_wait_move

    add     w21, w21, 1
    b       sort_select_pass

sort_select_end:
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// ------------------------------------------------------------- insertion

// sort_insert_interactive() - speed, then the animated run
sort_insert_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      sort_ready
    cbz     w0, sort_insert_no_array

    ldr     x0, =sort_view
    str     wzr, [x0]

    ldr     x0, =sort_scr_insert
    ldr     x1, =sort_hint_run
    ldr     x2, =sort_on
    ldr     x3, =sort_on2
    ldr     x4, =sort_on2
    ldr     x5, =sort_o1
    bl      sort_begin

    bl      sort_insert_run
    bl      sort_finish
    b       sort_insert_left

sort_insert_no_array:
    bl      sort_no_array

sort_insert_left:
    ldp     fp, lr, [sp], 16
    ret

// sort_insert_run() - lift a key out, slide the larger values right, and
// drop the key into the gap that opens
sort_insert_run:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]

    ldr     x0, =sort_size
    ldr     w19, [x0]
    ldr     x20, =sort_array

    mov     w0, 0
    bl      sort_lock                       // one value is a sorted run

    mov     w21, 1

sort_insert_pass:
    cmp     w21, w19
    b.ge    sort_insert_end

    ldr     w22, [x20, w21, sxtw 2]         // the key in hand

    ldr     x0, =sort_fmt_key
    mov     w1, w22
    bl      sort_note

    bl      sort_clear_marks
    mov     w0, w21
    bl      sort_open_hole

    bl      sort_render
    ldr     x0, =sort_fmt_ilift
    mov     w1, w22
    mov     w2, w21
    bl      sort_say
    bl      sort_wait_move

    sub     w23, w21, 1

sort_insert_walk:
    cmp     w23, 0
    b.lt    sort_insert_land

    bl      sort_clear_marks
    ldr     x0, =sort_cmp_a
    str     w23, [x0]
    bl      sort_tally_cmp

    ldr     w24, [x20, w23, sxtw 2]

    bl      sort_render
    ldr     x0, =sort_fmt_icmp
    mov     w1, w24
    mov     w2, w22
    bl      sort_say
    bl      sort_wait_cmp

    cmp     w24, w22
    b.le    sort_insert_land

    add     w25, w23, 1
    str     w24, [x20, w25, sxtw 2]
    bl      sort_tally_move

    bl      sort_clear_marks
    mov     w0, w23
    bl      sort_open_hole
    ldr     x0, =sort_dst_a
    str     w25, [x0]

    bl      sort_render
    ldr     x0, =sort_fmt_ishift
    mov     w1, w24
    bl      sort_say
    bl      sort_wait_move

    sub     w23, w23, 1
    b       sort_insert_walk

sort_insert_land:
    add     w25, w23, 1
    str     w22, [x20, w25, sxtw 2]
    bl      sort_tally_move

    bl      sort_clear_marks
    bl      sort_close_hole
    ldr     x0, =sort_dst_a
    str     w25, [x0]
    mov     w0, 0
    mov     w1, w21
    bl      sort_lock_range

    bl      sort_render
    ldr     x0, =sort_fmt_iland
    mov     w1, w22
    mov     w2, w25
    bl      sort_say
    bl      sort_wait_move

    add     w21, w21, 1
    b       sort_insert_pass

sort_insert_end:
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// ----------------------------------------------------------------- merge

// sort_merge_interactive() - speed, then the animated run
sort_merge_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      sort_ready
    cbz     w0, sort_merge_no_array

    ldr     x0, =sort_view
    str     wzr, [x0]

    ldr     x0, =sort_scr_merge
    ldr     x1, =sort_hint_run
    ldr     x2, =sort_onlogn
    ldr     x3, =sort_onlogn
    ldr     x4, =sort_onlogn
    ldr     x5, =sort_on
    bl      sort_begin

    bl      sort_merge_run
    bl      sort_finish
    b       sort_merge_left

sort_merge_no_array:
    bl      sort_no_array

sort_merge_left:
    ldp     fp, lr, [sp], 16
    ret

// sort_merge_run() - bottom up: runs of one become runs of two, and so on
sort_merge_run:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]

    ldr     x0, =sort_size
    ldr     w19, [x0]

    mov     w20, 1                          // run width
    mov     w25, 1                          // pass number

sort_merge_pass:
    cmp     w20, w19
    b.ge    sort_merge_end

    // each pass starts from runs the pass before it made
    bl      sort_unlock_all
    bl      sort_clear_marks
    bl      sort_clear_band

    ldr     x0, =sort_fmt_run
    mov     w1, w20
    bl      sort_note

    bl      sort_render
    ldr     x0, =sort_fmt_mpass
    mov     w1, w25
    mov     w2, w20
    add     w3, w20, w20
    bl      sort_say
    bl      sort_wait_move

    mov     w21, 0                          // the left run's first slot

sort_merge_step:
    cmp     w21, w19
    b.ge    sort_merge_grow

    add     w22, w21, w20
    sub     w22, w22, 1                     // last slot of the left run

    add     w23, w20, w20
    add     w23, w21, w23
    sub     w23, w23, 1
    sub     w0, w19, 1
    cmp     w23, w0
    csel    w23, w23, w0, lt                // last slot of the right run

    cmp     w22, w23
    b.lt    sort_merge_pair

    // a tail with no partner keeps the order it already has
    mov     w0, w21
    mov     w1, w23
    bl      sort_lock_range
    bl      sort_clear_marks

    bl      sort_render
    ldr     x0, =sort_fmt_mlone
    mov     w1, w21
    bl      sort_say
    bl      sort_wait_move
    b       sort_merge_next

sort_merge_pair:
    mov     w0, w21
    mov     w1, w23
    bl      sort_band
    add     w0, w22, 1
    ldr     x1, =sort_split
    str     w0, [x1]
    bl      sort_clear_marks

    bl      sort_render
    ldr     x0, =sort_fmt_mstart
    mov     w1, w21
    mov     w2, w22
    add     w3, w22, 1
    mov     w4, w23
    bl      sort_say
    bl      sort_wait_move

    mov     w0, w21
    mov     w1, w22
    mov     w2, w23
    bl      sort_merge_two

    bl      sort_clear_marks
    bl      sort_clear_band
    bl      sort_src_clear
    mov     w0, w21
    mov     w1, w23
    bl      sort_lock_range

    bl      sort_render
    ldr     x0, =sort_fmt_mjoin
    mov     w1, w21
    mov     w2, w23
    bl      sort_say
    bl      sort_wait_move

sort_merge_next:
    add     w0, w20, w20
    add     w21, w21, w0
    b       sort_merge_step

sort_merge_grow:
    add     w20, w20, w20
    add     w25, w25, 1
    b       sort_merge_pass

sort_merge_end:
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// sort_merge_view(w0 = low, w1 = high, w2 = left front, w3 = left end,
//                 w4 = right front, w5 = write slot)
// Where every cell in the merged range takes its value from: the array
// for what has been written, the scratch copy for what is still waiting,
// and nothing at all for the slots whose value has already been consumed.
// This is what keeps a duplicate off the screen.
sort_merge_view:
    ldr     x6, =sort_put_lo
    str     w0, [x6]
    sub     w6, w5, 1
    ldr     x7, =sort_put_hi
    str     w6, [x7]

    ldr     x6, =sort_src
    mov     w7, w0

sort_view_walk:
    cmp     w7, w1
    b.gt    sort_view_walked

    cmp     w7, w5
    b.lt    sort_view_array

    cmp     w7, w2
    b.lt    sort_view_right
    cmp     w7, w3
    b.le    sort_view_scratch

sort_view_right:
    cmp     w7, w4
    b.lt    sort_view_gone
    cmp     w7, w1
    b.le    sort_view_scratch

sort_view_gone:
    mov     w8, SORT_FROM_NONE
    b       sort_view_store

sort_view_scratch:
    mov     w8, SORT_FROM_AUX
    b       sort_view_store

sort_view_array:
    mov     w8, SORT_FROM_ARRAY

sort_view_store:
    str     w8, [x6, w7, sxtw 2]
    add     w7, w7, 1
    b       sort_view_walk

sort_view_walked:
    ret

// sort_merge_two(w0 = low, w1 = mid, w2 = high) - merge two sorted runs
// through the scratch copy
sort_merge_two:
    stp     fp, lr, [sp, -96]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]
    stp     x27, x28, [sp, 80]

    mov     w19, w0                         // low
    mov     w20, w1                         // mid
    mov     w21, w2                         // high

    ldr     x25, =sort_array
    ldr     x26, =sort_aux

    mov     w22, w19
sort_merge_copy:
    cmp     w22, w21
    b.gt    sort_merge_copied
    ldr     w0, [x25, w22, sxtw 2]
    str     w0, [x26, w22, sxtw 2]
    add     w22, w22, 1
    b       sort_merge_copy

sort_merge_copied:
    mov     w22, w19                        // front of the left run
    add     w23, w20, 1                     // front of the right run
    mov     w24, w19                        // slot being written

    bl      sort_clear_marks
    mov     w0, w19
    mov     w1, w21
    mov     w2, w22
    mov     w3, w20
    mov     w4, w23
    mov     w5, w24
    bl      sort_merge_view

    bl      sort_render
    ldr     x0, =sort_fmt_mcopy
    bl      sort_say
    bl      sort_wait_move

sort_merge_take:
    cmp     w22, w20
    b.gt    sort_merge_drain_right
    cmp     w23, w21
    b.gt    sort_merge_drain_left

    bl      sort_clear_marks
    ldr     x0, =sort_cmp_a
    str     w22, [x0]
    ldr     x0, =sort_cmp_b
    str     w23, [x0]
    ldr     x0, =sort_dst_a
    str     w24, [x0]
    bl      sort_tally_cmp

    mov     w0, w19
    mov     w1, w21
    mov     w2, w22
    mov     w3, w20
    mov     w4, w23
    mov     w5, w24
    bl      sort_merge_view

    ldr     w27, [x26, w22, sxtw 2]         // front of the left run
    ldr     w28, [x26, w23, sxtw 2]         // front of the right run

    bl      sort_render
    ldr     x0, =sort_fmt_mcmp
    mov     w1, w27
    mov     w2, w28
    bl      sort_say
    bl      sort_wait_cmp

    cmp     w27, w28
    b.gt    sort_merge_take_right

    str     w27, [x25, w24, sxtw 2]
    add     w22, w22, 1
    b       sort_merge_placed

sort_merge_take_right:
    str     w28, [x25, w24, sxtw 2]
    add     w23, w23, 1
    mov     w27, w28

sort_merge_placed:
    bl      sort_tally_move
    add     w24, w24, 1

    bl      sort_clear_marks
    sub     w0, w24, 1
    ldr     x1, =sort_dst_a
    str     w0, [x1]

    mov     w0, w19
    mov     w1, w21
    mov     w2, w22
    mov     w3, w20
    mov     w4, w23
    mov     w5, w24
    bl      sort_merge_view

    bl      sort_render
    ldr     x0, =sort_fmt_mtake
    mov     w1, w27
    sub     w2, w24, 1
    bl      sort_say
    bl      sort_wait_move
    b       sort_merge_take

sort_merge_drain_left:
    cmp     w22, w20
    b.gt    sort_merge_two_done

    ldr     w27, [x26, w22, sxtw 2]
    str     w27, [x25, w24, sxtw 2]
    add     w22, w22, 1
    add     w24, w24, 1
    bl      sort_tally_move

    bl      sort_clear_marks
    sub     w0, w24, 1
    ldr     x1, =sort_dst_a
    str     w0, [x1]

    mov     w0, w19
    mov     w1, w21
    mov     w2, w22
    mov     w3, w20
    mov     w4, w23
    mov     w5, w24
    bl      sort_merge_view

    bl      sort_render
    ldr     x0, =sort_fmt_mdrain
    mov     w1, w27
    sub     w2, w24, 1
    bl      sort_say
    bl      sort_wait_move
    b       sort_merge_drain_left

sort_merge_drain_right:
    cmp     w23, w21
    b.gt    sort_merge_two_done

    ldr     w27, [x26, w23, sxtw 2]
    str     w27, [x25, w24, sxtw 2]
    add     w23, w23, 1
    add     w24, w24, 1
    bl      sort_tally_move

    bl      sort_clear_marks
    sub     w0, w24, 1
    ldr     x1, =sort_dst_a
    str     w0, [x1]

    mov     w0, w19
    mov     w1, w21
    mov     w2, w22
    mov     w3, w20
    mov     w4, w23
    mov     w5, w24
    bl      sort_merge_view

    bl      sort_render
    ldr     x0, =sort_fmt_mdrain
    mov     w1, w27
    sub     w2, w24, 1
    bl      sort_say
    bl      sort_wait_move
    b       sort_merge_drain_right

sort_merge_two_done:
    ldp     x27, x28, [sp, 80]
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96
    ret

// ----------------------------------------------------------------- quick

// sort_quick_interactive() - speed, then the animated run
sort_quick_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      sort_ready
    cbz     w0, sort_quick_no_array

    ldr     x0, =sort_view
    str     wzr, [x0]

    ldr     x0, =sort_scr_quick
    ldr     x1, =sort_hint_run
    ldr     x2, =sort_onlogn
    ldr     x3, =sort_onlogn
    ldr     x4, =sort_on2
    ldr     x5, =sort_ologn
    bl      sort_begin

    ldr     x0, =sort_size
    ldr     w1, [x0]
    sub     w1, w1, 1
    mov     w0, 0
    bl      sort_quick_part_sort

    bl      sort_finish
    b       sort_quick_left

sort_quick_no_array:
    bl      sort_no_array

sort_quick_left:
    ldp     fp, lr, [sp], 16
    ret

// sort_quick_part_sort(w0 = low, w1 = high) - partition, then sort both
// sides. The band belongs to this call, so it is put back after each
// child returns instead of being left wherever the recursion ended.
sort_quick_part_sort:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    mov     w20, w1

    cmp     w19, w20
    b.lt    sort_quick_split
    b.gt    sort_quick_part_done

    // a single slot is a sorted run all by itself
    bl      sort_clear_marks
    mov     w0, w19
    bl      sort_lock
    mov     w0, w19
    mov     w1, w19
    bl      sort_band

    bl      sort_render
    ldr     x0, =sort_fmt_qone
    mov     w1, w19
    bl      sort_say
    bl      sort_wait_move
    b       sort_quick_part_done

sort_quick_split:
    mov     w0, w19
    mov     w1, w20
    bl      sort_quick_partition
    mov     w21, w0

    sub     w1, w21, 1
    mov     w0, w19
    bl      sort_quick_part_sort

    mov     w0, w19
    mov     w1, w20
    bl      sort_band
    bl      sort_clear_marks

    add     w0, w21, 1
    cmp     w0, w20
    b.gt    sort_quick_right_done

    bl      sort_render
    ldr     x0, =sort_fmt_qback
    mov     w1, w19
    mov     w2, w20
    bl      sort_say
    bl      sort_wait_move

    add     w0, w21, 1
    mov     w1, w20
    bl      sort_quick_part_sort

sort_quick_right_done:
    mov     w0, w19
    mov     w1, w20
    bl      sort_band
    bl      sort_clear_marks
    mov     w0, w19
    mov     w1, w20
    bl      sort_lock_range

    bl      sort_render
    ldr     x0, =sort_fmt_qdone
    mov     w1, w19
    mov     w2, w20
    bl      sort_say
    bl      sort_wait_move

sort_quick_part_done:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// sort_quick_partition(w0 = low, w1 = high) -> w0 = where the pivot lives
// The last value of the range is the pivot; the boundary marker under the
// cells is the line everything smaller has already crossed.
sort_quick_partition:
    stp     fp, lr, [sp, -96]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]

    mov     w19, w0
    mov     w20, w1
    ldr     x24, =sort_array

    mov     w0, w19
    mov     w1, w20
    bl      sort_band

    ldr     w21, [x24, w20, sxtw 2]         // the pivot value

    ldr     x0, =sort_fmt_span
    mov     w1, w19
    mov     w2, w20
    bl      sort_note

    bl      sort_clear_marks
    ldr     x0, =sort_hand
    str     w20, [x0]
    ldr     x1, =sort_bound
    str     w19, [x1]                       // nothing has crossed the line yet

    bl      sort_render
    ldr     x0, =sort_fmt_qpivot
    mov     w1, w21
    mov     w2, w19
    mov     w3, w20
    bl      sort_say
    bl      sort_wait_cmp

    sub     w22, w19, 1                     // last slot on the small side
    mov     w23, w19                        // the slot being looked at

sort_quick_walk:
    cmp     w23, w20
    b.ge    sort_quick_home

    bl      sort_clear_marks
    ldr     x0, =sort_hand
    str     w20, [x0]
    ldr     x0, =sort_cmp_b
    str     w23, [x0]
    add     w0, w22, 1
    ldr     x1, =sort_bound
    str     w0, [x1]
    bl      sort_tally_cmp

    ldr     w25, [x24, w23, sxtw 2]

    bl      sort_render
    ldr     x0, =sort_fmt_qcmp
    mov     w1, w25
    mov     w2, w21
    bl      sort_say
    bl      sort_wait_cmp

    cmp     w25, w21
    b.gt    sort_quick_walk_next

    add     w22, w22, 1

    cmp     w22, w23
    b.eq    sort_quick_already

    ldr     w26, [x24, w22, sxtw 2]
    str     w25, [x24, w22, sxtw 2]
    str     w26, [x24, w23, sxtw 2]
    bl      sort_tally_move

    bl      sort_clear_marks
    ldr     x0, =sort_hand
    str     w20, [x0]
    ldr     x0, =sort_dst_a
    str     w22, [x0]
    ldr     x0, =sort_dst_b
    str     w23, [x0]
    add     w0, w22, 1
    ldr     x1, =sort_bound
    str     w0, [x1]

    bl      sort_render
    ldr     x0, =sort_fmt_qswap
    mov     w1, w25
    mov     w2, w22
    bl      sort_say
    bl      sort_wait_move
    b       sort_quick_walk_next

sort_quick_already:
    // nothing moved, so only the boundary is redrawn: a swap with itself
    // never gets a frame of its own
    bl      sort_clear_marks
    ldr     x0, =sort_hand
    str     w20, [x0]
    ldr     x0, =sort_dst_a
    str     w22, [x0]
    add     w0, w22, 1
    ldr     x1, =sort_bound
    str     w0, [x1]

    bl      sort_render
    ldr     x0, =sort_fmt_qstay
    mov     w1, w25
    bl      sort_say
    bl      sort_wait_move

sort_quick_walk_next:
    add     w23, w23, 1
    b       sort_quick_walk

sort_quick_home:
    add     w22, w22, 1

    cmp     w22, w20
    b.eq    sort_quick_seated

    ldr     w25, [x24, w22, sxtw 2]
    ldr     w26, [x24, w20, sxtw 2]
    str     w26, [x24, w22, sxtw 2]
    str     w25, [x24, w20, sxtw 2]
    bl      sort_tally_move

sort_quick_seated:
    bl      sort_clear_marks
    ldr     x0, =sort_dst_a
    str     w22, [x0]
    mov     w0, w22
    bl      sort_lock

    bl      sort_render
    ldr     x0, =sort_fmt_qhome
    mov     w1, w21
    mov     w2, w22
    bl      sort_say
    bl      sort_wait_move

    mov     w0, w22

    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96
    ret

// ------------------------------------------------------------------ heap

// sort_heap_interactive() - speed, then the animated run
sort_heap_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      sort_ready
    cbz     w0, sort_heap_no_array

    ldr     x0, =sort_view
    str     wzr, [x0]

    ldr     x0, =sort_scr_heap
    ldr     x1, =sort_hint_run
    ldr     x2, =sort_onlogn
    ldr     x3, =sort_onlogn
    ldr     x4, =sort_onlogn
    ldr     x5, =sort_o1
    bl      sort_begin

    bl      sort_heap_run
    bl      sort_finish
    b       sort_heap_left

sort_heap_no_array:
    bl      sort_no_array

sort_heap_left:
    ldp     fp, lr, [sp], 16
    ret

// sort_heap_run() - build a max-heap in the array itself, then pull the
// largest value off the top n times. The band is the part of the array
// that is still a heap; everything to its right has settled.
sort_heap_run:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x0, =sort_size
    ldr     w19, [x0]
    ldr     x20, =sort_array

    mov     w0, 0
    sub     w1, w19, 1
    bl      sort_band

    ldr     x0, =sort_fmt_heapn
    mov     w1, w19
    bl      sort_note

    bl      sort_clear_marks
    bl      sort_render
    ldr     x0, =sort_fmt_hbuild
    bl      sort_say
    bl      sort_wait_move

    lsr     w21, w19, 1
    sub     w21, w21, 1                     // the last slot with a child

sort_heap_build:
    cmp     w21, 0
    b.lt    sort_heap_pull

    bl      sort_clear_marks
    ldr     x0, =sort_hand
    str     w21, [x0]

    bl      sort_render
    ldr     x0, =sort_fmt_hsink
    mov     w1, w21
    bl      sort_say
    bl      sort_wait_move

    mov     w0, w21
    mov     w1, w19
    bl      sort_heap_sink

    sub     w21, w21, 1
    b       sort_heap_build

sort_heap_pull:
    sub     w21, w19, 1                     // the last slot of the heap

sort_heap_take:
    cmp     w21, 0
    b.le    sort_heap_end

    ldr     w22, [x20]
    ldr     w23, [x20, w21, sxtw 2]
    str     w23, [x20]
    str     w22, [x20, w21, sxtw 2]
    bl      sort_tally_move

    mov     w0, w21
    bl      sort_lock
    sub     w0, w21, 1
    ldr     x1, =sort_hi
    str     w0, [x1]

    ldr     x0, =sort_fmt_heapn
    mov     w1, w21
    bl      sort_note

    bl      sort_clear_marks
    ldr     x0, =sort_dst_a
    str     wzr, [x0]
    ldr     x0, =sort_dst_b
    str     w21, [x0]

    bl      sort_render
    ldr     x0, =sort_fmt_hpull
    mov     w1, w22
    mov     w2, w21
    bl      sort_say
    bl      sort_wait_move

    mov     w0, 0
    mov     w1, w21
    bl      sort_heap_sink

    sub     w21, w21, 1
    b       sort_heap_take

sort_heap_end:
    mov     w0, 0
    bl      sort_lock

    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// sort_heap_sink(w0 = slot, w1 = how much of the array is still a heap)
// The value at that slot drops past any child larger than it is.
sort_heap_sink:
    stp     fp, lr, [sp, -96]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]

    mov     w19, w0                         // the parent
    mov     w20, w1                         // how many slots are still a heap
    ldr     x24, =sort_array

sort_heap_step:
    add     w21, w19, w19
    add     w21, w21, 1                     // the left child
    add     w22, w21, 1                     // the right child
    mov     w23, w19                        // the largest of the three

    cmp     w21, w20
    b.ge    sort_heap_settled

    bl      sort_clear_marks
    ldr     x0, =sort_hand
    str     w19, [x0]
    ldr     x0, =sort_cmp_b
    str     w21, [x0]
    bl      sort_tally_cmp

    ldr     w25, [x24, w23, sxtw 2]
    ldr     w26, [x24, w21, sxtw 2]

    bl      sort_render
    ldr     x0, =sort_fmt_hcmp
    mov     w1, w25
    mov     w2, w26
    bl      sort_say
    bl      sort_wait_cmp

    cmp     w26, w25
    b.le    sort_heap_right
    mov     w23, w21

sort_heap_right:
    cmp     w22, w20
    b.ge    sort_heap_verdict

    bl      sort_clear_marks
    ldr     x0, =sort_hand
    str     w19, [x0]
    ldr     x0, =sort_cmp_b
    str     w22, [x0]
    bl      sort_tally_cmp

    ldr     w25, [x24, w23, sxtw 2]
    ldr     w26, [x24, w22, sxtw 2]

    bl      sort_render
    ldr     x0, =sort_fmt_hcmp
    mov     w1, w25
    mov     w2, w26
    bl      sort_say
    bl      sort_wait_cmp

    cmp     w26, w25
    b.le    sort_heap_verdict
    mov     w23, w22

sort_heap_verdict:
    cmp     w23, w19
    b.eq    sort_heap_settled

    ldr     w25, [x24, w19, sxtw 2]
    ldr     w26, [x24, w23, sxtw 2]
    str     w26, [x24, w19, sxtw 2]
    str     w25, [x24, w23, sxtw 2]
    bl      sort_tally_move

    bl      sort_clear_marks
    ldr     x0, =sort_dst_a
    str     w19, [x0]
    ldr     x0, =sort_dst_b
    str     w23, [x0]

    bl      sort_render
    ldr     x0, =sort_fmt_hswap
    mov     w1, w25
    mov     w2, w26
    bl      sort_say
    bl      sort_wait_move

    mov     w19, w23
    b       sort_heap_step

sort_heap_settled:
    bl      sort_clear_marks
    ldr     x0, =sort_hand
    str     w19, [x0]

    ldr     w25, [x24, w19, sxtw 2]

    bl      sort_render
    ldr     x0, =sort_fmt_hhold
    mov     w1, w25
    bl      sort_say
    bl      sort_wait_move

    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96
    ret

// ----------------------------------------------------------------- shell

// sort_shell_interactive() - speed, then the animated run
sort_shell_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      sort_ready
    cbz     w0, sort_shell_no_array

    ldr     x0, =sort_view
    str     wzr, [x0]

    ldr     x0, =sort_scr_shell
    ldr     x1, =sort_hint_run
    ldr     x2, =sort_onlogn
    ldr     x3, =sort_on13
    ldr     x4, =sort_on2
    ldr     x5, =sort_o1
    bl      sort_begin

    bl      sort_shell_run
    bl      sort_finish
    b       sort_shell_left

sort_shell_no_array:
    bl      sort_no_array

sort_shell_left:
    ldp     fp, lr, [sp], 16
    ret

// sort_shell_run() - insertion sort over a gap that halves each pass, so
// a value far from home travels in a few long hops instead of many short
// ones. Nothing settles until the last pass, where the gap is one.
sort_shell_run:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]

    ldr     x0, =sort_size
    ldr     w19, [x0]
    ldr     x20, =sort_array

    lsr     w21, w19, 1                     // the gap

sort_shell_pass:
    cmp     w21, 0
    b.le    sort_shell_end

    ldr     x0, =sort_fmt_gaponly
    mov     w1, w21
    bl      sort_note

    bl      sort_clear_marks
    bl      sort_render
    cmp     w21, 1
    b.eq    sort_shell_say_last

    ldr     x0, =sort_fmt_egap
    mov     w1, w21
    mov     w2, w21
    bl      sort_say
    b       sort_shell_pass_wait

sort_shell_say_last:
    ldr     x0, =sort_fmt_elast
    bl      sort_say

sort_shell_pass_wait:
    bl      sort_wait_move

    mov     w22, w21                        // the slot whose value is lifted

sort_shell_lift:
    cmp     w22, w19
    b.ge    sort_shell_shrink

    ldr     w24, [x20, w22, sxtw 2]         // the key

    ldr     x0, =sort_fmt_gap
    mov     w1, w21
    mov     w2, w24
    bl      sort_note

    bl      sort_clear_marks
    mov     w0, w22
    bl      sort_open_hole

    bl      sort_render
    ldr     x0, =sort_fmt_ilift
    mov     w1, w24
    mov     w2, w22
    bl      sort_say
    bl      sort_wait_move

    mov     w23, w22                        // where the gap sits now

sort_shell_walk:
    cmp     w23, w21
    b.lt    sort_shell_land

    sub     w25, w23, w21

    bl      sort_clear_marks
    ldr     x0, =sort_cmp_a
    str     w25, [x0]
    bl      sort_tally_cmp

    ldr     w26, [x20, w25, sxtw 2]

    bl      sort_render
    ldr     x0, =sort_fmt_ecmp
    mov     w1, w26
    mov     w2, w21
    mov     w3, w24
    bl      sort_say
    bl      sort_wait_cmp

    cmp     w26, w24
    b.le    sort_shell_land

    str     w26, [x20, w23, sxtw 2]
    bl      sort_tally_move

    bl      sort_clear_marks
    mov     w0, w25
    bl      sort_open_hole
    ldr     x0, =sort_dst_a
    str     w23, [x0]

    bl      sort_render
    ldr     x0, =sort_fmt_eshift
    mov     w1, w26
    mov     w2, w21
    bl      sort_say
    bl      sort_wait_move

    mov     w23, w25
    b       sort_shell_walk

sort_shell_land:
    str     w24, [x20, w23, sxtw 2]
    bl      sort_tally_move

    bl      sort_clear_marks
    bl      sort_close_hole
    ldr     x0, =sort_dst_a
    str     w23, [x0]

    bl      sort_render
    ldr     x0, =sort_fmt_eland
    mov     w1, w24
    mov     w2, w23
    bl      sort_say
    bl      sort_wait_move

    add     w22, w22, 1
    b       sort_shell_lift

sort_shell_shrink:
    lsr     w21, w21, 1
    b       sort_shell_pass

sort_shell_end:
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// -------------------------------------------------------------- counting

// sort_count_interactive() - speed, then the animated run
sort_count_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      sort_ready
    cbz     w0, sort_count_no_array

    mov     w0, 1
    ldr     x1, =sort_view
    str     w0, [x1]

    ldr     x0, =sort_scr_count
    ldr     x1, =sort_hint_run
    ldr     x2, =sort_onk
    ldr     x3, =sort_onk
    ldr     x4, =sort_onk
    ldr     x5, =sort_onk
    bl      sort_begin

    bl      sort_count_run
    bl      sort_finish

    ldr     x0, =sort_view
    str     wzr, [x0]
    b       sort_count_left

sort_count_no_array:
    bl      sort_no_array

sort_count_left:
    ldp     fp, lr, [sp], 16
    ret

// sort_count_run() - no value is ever compared with another. Count how
// often each key appears, turn the counts into end positions, then read
// the array from the right so equal keys keep the order they came in.
sort_count_run:
    stp     fp, lr, [sp, -96]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]
    str     x27, [sp, 80]

    ldr     x0, =sort_size
    ldr     w19, [x0]
    ldr     x20, =sort_array
    ldr     x24, =sort_bucket
    ldr     x25, =sort_out

    ldr     x0, =sort_fmt_kbuckets
    mov     w1, SORT_KEYS
    bl      sort_note

    mov     w21, 0
sort_count_zero:
    cmp     w21, SORT_KEYS
    b.ge    sort_count_zeroed
    str     wzr, [x24, w21, sxtw 2]
    add     w21, w21, 1
    b       sort_count_zero

sort_count_zeroed:
    bl      sort_clear_marks
    bl      sort_render
    ldr     x0, =sort_fmt_czero
    bl      sort_say
    bl      sort_wait_move

    mov     w21, 0
sort_count_tally:
    cmp     w21, w19
    b.ge    sort_count_sums

    ldr     w22, [x20, w21, sxtw 2]
    ldr     w23, [x24, w22, sxtw 2]
    add     w23, w23, 1
    str     w23, [x24, w22, sxtw 2]
    bl      sort_tally_move

    bl      sort_clear_marks
    ldr     x0, =sort_hand
    str     w21, [x0]
    ldr     x0, =sort_bucket_at
    str     w22, [x0]

    bl      sort_render
    ldr     x0, =sort_fmt_ccount
    mov     w1, w21
    mov     w2, w22
    mov     w3, w22
    bl      sort_say
    bl      sort_wait_move

    add     w21, w21, 1
    b       sort_count_tally

sort_count_sums:
    bl      sort_clear_marks
    ldr     x0, =sort_bucket_at
    mov     w1, -1
    str     w1, [x0]

    bl      sort_render
    ldr     x0, =sort_fmt_csums
    bl      sort_say
    bl      sort_wait_move

    mov     w21, 1
sort_count_sum:
    cmp     w21, SORT_KEYS
    b.ge    sort_count_place

    sub     w0, w21, 1
    ldr     w22, [x24, w0, sxtw 2]
    ldr     w23, [x24, w21, sxtw 2]
    add     w23, w23, w22
    str     w23, [x24, w21, sxtw 2]
    bl      sort_tally_move

    ldr     x0, =sort_bucket_at
    str     w21, [x0]

    bl      sort_render
    ldr     x0, =sort_fmt_csum
    mov     w1, w21
    mov     w2, w23
    mov     w3, w21
    bl      sort_say
    bl      sort_wait_move

    add     w21, w21, 1
    b       sort_count_sum

sort_count_place:
    sub     w21, w19, 1
sort_count_out:
    cmp     w21, 0
    b.lt    sort_count_home

    ldr     w22, [x20, w21, sxtw 2]         // the key
    ldr     w23, [x24, w22, sxtw 2]
    sub     w23, w23, 1
    str     w23, [x24, w22, sxtw 2]         // one fewer of that key to place
    str     w22, [x25, w23, sxtw 2]
    ldr     x0, =sort_out_fill
    mov     w1, 1
    str     w1, [x0, w23, sxtw 2]
    bl      sort_tally_move

    // the value is in the output now, so the slot it came from empties
    mov     w0, w21
    mov     w1, SORT_FROM_NONE
    bl      sort_src_set

    bl      sort_clear_marks
    ldr     x0, =sort_hand
    str     w21, [x0]
    ldr     x0, =sort_bucket_at
    str     w22, [x0]
    ldr     x0, =sort_out_at
    str     w23, [x0]

    bl      sort_render
    ldr     x0, =sort_fmt_cplace
    mov     w1, w22
    mov     w2, w23
    bl      sort_say
    bl      sort_wait_move

    sub     w21, w21, 1
    b       sort_count_out

sort_count_home:
    mov     w21, 0
sort_count_copy:
    cmp     w21, w19
    b.ge    sort_count_end

    ldr     w22, [x25, w21, sxtw 2]
    str     w22, [x20, w21, sxtw 2]
    bl      sort_tally_move

    mov     w0, w21
    mov     w1, SORT_FROM_ARRAY
    bl      sort_src_set

    // the output hands the value over rather than keeping a copy of it
    ldr     x0, =sort_out_fill
    str     wzr, [x0, w21, sxtw 2]

    bl      sort_clear_marks
    ldr     x0, =sort_bucket_at
    mov     w1, -1
    str     w1, [x0]
    ldr     x0, =sort_out_at
    mov     w1, -1
    str     w1, [x0]
    mov     w0, w21
    bl      sort_lock

    bl      sort_render
    ldr     x0, =sort_fmt_cback
    mov     w1, w21
    bl      sort_say
    bl      sort_wait_move

    add     w21, w21, 1
    b       sort_count_copy

sort_count_end:
    bl      sort_clear_marks
    ldr     x0, =sort_out_at
    mov     w1, -1
    str     w1, [x0]

    bl      sort_render
    ldr     x0, =sort_fmt_cnone
    bl      sort_say
    bl      sort_wait_move

    ldr     x27, [sp, 80]
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96
    ret
