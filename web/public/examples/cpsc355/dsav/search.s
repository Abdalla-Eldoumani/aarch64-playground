// search_viz.asm - four ways to look for a value, told as one lesson
//
// Linear reads every cell in order. Binary halves the window and never
// looks at a value to decide where to look next. Jump strides by the
// square root of n and then walks one block. Interpolation reads the
// values at the ends of the window and guesses where the target should
// sit. The screen is built so those four stories can be compared: one
// array row, one index ruler under it, one marker row, one sentence
// naming what the current frame is doing, and one line of arithmetic
// showing where the next probe came from. The chrome is drawn once per
// operation; a frame repaints the array, the ruler and the status lines
// and nothing else.

define(fp, x29)
define(lr, x30)

    search_max = 10                     // cells the array row has room for
    search_col_first = 6                // column the first cell starts in
    search_pitch = 7                    // columns from one cell to the next

    // body rows: the kernel owns everything outside 4 to 20
    search_row_cells = 5
    search_row_ruler = 6
    search_row_mark = 7
    search_row_legend = 9
    search_row_say = 11
    search_row_form = 12
    search_row_calc = 13
    search_row_count = 14
    search_row_ask = 16
    search_row_result = 17
    search_row_lesson = 18
    search_row_cost = 20

    // what a cell is, which is all the colour it needs
    search_st_live = 0                  // not read yet
    search_st_win = 1                   // still inside the live window
    search_st_out = 2                   // read and discarded
    search_st_probe = 3                 // being compared in this frame
    search_st_hit = 4                   // the match

    // marker ids, indexes into search_mark_text and search_mark_role
    search_mk_low = 1
    search_mk_mid = 2
    search_mk_high = 3
    search_mk_step = 4
    search_mk_jump = 5
    search_mk_guess = 6

    // roles th_fg, th_bg, ui_text and ui_badge understand
    search_role_text = 0
    search_role_dim = 1
    search_role_faint = 2
    search_role_accent = 3
    search_role_key = 4
    search_role_ok = 5
    search_role_warn = 6
    search_role_hot = 7
    search_role_bad = 8
    search_role_node = 9

    .data
    .balign 8

// ---------------------------------------------------------------- state

search_array:       .skip 40                // ten values, one word each
    .balign 4
search_size:        .word 0                 // values in use
search_delay:       .word 220               // ms one compare holds
search_target:      .word 0
search_probes:      .word 0                 // compares this run has made
search_active:      .word 0                 // is a run under way?
search_ready:       .word 0                 // sample array laid in yet?

// What a first visit finds already loaded. The values ascend with uneven
// gaps, and that is the point: a search for 67 costs interpolation one
// guess and binary four halvings, which is the lesson the arithmetic line
// is there to show.
    .balign 4
search_seed:        .word 4, 11, 19, 28, 35, 46, 67, 73, 81, 94

// One byte per cell for what it is and what is pointing at it. Every run
// starts by clearing both, so a marker from a previous algorithm can
// never survive into the next one.
search_state:       .skip 16
search_mark:        .skip 16

    .balign 4
search_line_a:      .word 0                 // the status sentence takes three
search_line_b:      .word 0
search_line_c:      .word 0
search_calc_args:   .word 0, 0, 0, 0, 0     // the arithmetic line takes five
search_result_a:    .word 0
search_result_b:    .word 0
search_result_role: .word 0

    .balign 8
search_line_fmt:    .dword 0                // 0 means the row stays blank
search_form_fmt:    .dword 0
search_calc_fmt:    .dword 0
search_result_fmt:  .dword 0

// -------------------------------------------------------------- markers

    .balign 8
search_mark_text:
    .dword search_mk_low_txt, search_mk_mid_txt, search_mk_high_txt
    .dword search_mk_step_txt, search_mk_jump_txt, search_mk_guess_txt

    .balign 4
search_mark_role:
    .word search_role_key, search_role_warn, search_role_accent
    .word search_role_warn, search_role_hot, search_role_hot

search_mk_low_txt:      .string "low"
search_mk_mid_txt:      .string "mid"
search_mk_high_txt:     .string "high"
search_mk_step_txt:     .string "read"
search_mk_jump_txt:     .string "jump"
search_mk_guess_txt:    .string "guess"

// -------------------------------------------------------------- strings

search_title:        .string "searching"
search_title_linear: .string "linear search"
search_title_binary: .string "binary search"
search_title_jump:   .string "jump search"
search_title_interp: .string "interpolation search"
search_title_array:  .string "the search array"
search_title_own:    .string "your own values"

search_foot_menu:    .string "linear O(n)  binary O(log n)  jump O(sqrt n)  interpolation O(log log n)"
search_foot_run:     .string "one frame per step: only the array row, the ruler and the status lines move"
search_foot_pick:    .string "the value is clamped to the range shown"

search_panel_array:  .string "array"
search_panel_what:   .string "what this frame is doing"
search_panel_menu:   .string "operations"
search_panel_set:    .string "setting"
search_panel_note:   .string "notice"

search_lg_live:      .string "untouched"
search_lg_win:       .string "in play"
search_lg_probe:     .string "comparing"
search_lg_out:       .string "eliminated"
search_lg_hit:       .string "found"
search_sw_txt:       .string " 42 "
search_sp:           .string " "

search_mi1:          .string "linear search"
search_mi2:          .string "binary search"
search_mi3:          .string "jump search"
search_mi4:          .string "interpolation search"
search_mi5:          .string "show the array"
search_mi6:          .string "fill with random values"
search_mi7:          .string "type in your own values"
search_mi8:          .string "sort the array"
search_mi9:          .string "animation speed"
search_mi0:          .string "back to the main menu"

// One byte of text and one terminator each, so digit i lives at
// search_digits + 2*i.
search_digits:
    .string "1"
    .string "2"
    .string "3"
    .string "4"
    .string "5"
    .string "6"
    .string "7"
    .string "8"
    .string "9"
    .string "0"

search_lbl_choice:   .string "choice "
search_lbl_value:    .string "value "
search_ask_size:     .string "how many values should the array hold?"
search_hint_size:    .string "3 to 10"
search_ask_speed:    .string "how long should one compare hold, in milliseconds?"
search_hint_speed:   .string "60 is brisk, 1200 is a crawl"
search_ask_target:   .string "value to search for  "
search_ask_cell:     .string "value for a[%d]  "

search_fmt_cell:     .string " %3d "
search_fmt_idx:      .string "%3d"
search_fmt_count:    .string "probes %d      target %d      cells %d"
search_fmt_setup:    .string "%d values      one compare holds %d ms"
search_fmt_state:    .string "%d values      %s      speed %d ms"
search_word_sorted:  .string "sorted"
search_word_plain:   .string "unsorted"
search_word_empty:   .string "empty"

search_msg_empty:    .string "the array is empty, so fill it or type values first"

search_say_ready:    .string "the array is ready and nothing has been read yet"
search_say_sorted:   .string "the array was out of order, so it was sorted before the run"
search_say_compare:  .string "comparing a[%d] = %d with the target %d"
search_say_step:     .string "a[%d] = %d is not %d, so step one cell to the right"
search_say_left:     .string "a[%d] = %d is below %d, so every cell up to it is gone"
search_say_right:    .string "a[%d] = %d is above %d, so every cell from it on is gone"
search_say_hit:      .string "%d sits at index %d, and the probe count is %d"
search_say_miss:     .string "%d is not in the array, and the probe count is %d"
search_say_block:    .string "the block size is fixed at %d, which is floor(sqrt(n))"
search_say_edge:     .string "the block ends at a[%d] = %d; is the target %d past it?"
search_say_skip:     .string "a[%d] = %d is still below %d, so the whole block is skipped"
search_say_land:     .string "%d cannot sit past a[%d], so walk this block from index %d"
search_say_walk:     .string "walking the block: a[%d] = %d against the target %d"
search_say_past:     .string "a[%d] = %d is past %d, and a sorted array only climbs from here"
search_say_guess:    .string "the guess landed on a[%d] = %d, against the target %d"
search_say_outside:  .string "%d is outside the window values %d to %d, so no guess can reach it"
search_say_typing:   .string "a[%d] is waiting for a value, 0 to 999"
search_say_stored:   .string "%d values stored, so a search for any of them is a guaranteed hit"
search_say_random:   .string "%d random values, so a hit is luck; type your own to be certain"
search_say_inorder:  .string "%d values in order: binary, jump and interpolation can all run"
search_say_jumbled:  .string "%d values out of order: only linear search is honest here"

search_form_linear:  .string "every cell, left to right, and the array need not be in any order"
search_form_binary:  .string "mid = (low + high) / 2      the values never enter the arithmetic"
search_form_jump:    .string "block = floor(sqrt(n)), stride block by block, then walk one block"
search_form_interp:  .string "guess = low + (target - a[low]) x (high - low) / (a[high] - a[low])"

search_calc_scan:    .string "read %d of %d cells so far"
search_calc_mid:     .string "mid = (%d + %d) / 2 = %d"
search_calc_window:  .string "the window is now [%d .. %d], %d cells left"
search_calc_empty:   .string "the window is empty, so the value is not in the array"
search_calc_block:   .string "floor(sqrt(%d)) = %d, so every jump moves %d cells"
search_calc_span:    .string "block [%d .. %d], stride %d"
search_calc_walk:    .string "inside block [%d .. %d], one cell at a time"
search_calc_guess:   .string "guess = %d + (%d x %d) / %d = %d"
search_calc_flat:    .string "both ends hold %d, so the guess can only be the low end"

search_res_found:    .string "found      %d is at index %d"
search_res_miss:     .string "not found  %d is in none of these %d cells"

search_lesson_linear: .string "the cost is the array itself: n cells is n compares in the worst case"
search_lesson_binary: .string "binary picks the middle without ever reading a value to decide"
search_lesson_jump:   .string "sqrt(n) jumps to find the block, then sqrt(n) steps inside it at most"
search_lesson_interp: .string "interpolation reads the values and guesses where the target should sit"
search_lesson_array:  .string "a value you can see here is a value a search is guaranteed to find"

search_cx_o1:        .string "O(1)"
search_cx_on:        .string "O(n)"
search_cx_ologn:     .string "O(log n)"
search_cx_osqrt:     .string "O(sqrt n)"
search_cx_ololog:    .string "O(log log n)"

    .text
    .balign 4

// ----------------------------------------------------------- small parts

// search_cell_col(w0 = index) -> w0 = the column that cell starts in
search_cell_col:
    mov     w1, search_pitch
    mul     w0, w0, w1
    add     w0, w0, search_col_first
    ret

// search_isqrt(w0 = n) -> w0 = floor(sqrt(n)), never below 1
search_isqrt:
    mov     w1, 1
.Lsearch_isqrt_loop:
    add     w2, w1, 1
    mul     w3, w2, w2
    cmp     w3, w0
    b.gt    .Lsearch_isqrt_done
    mov     w1, w2
    b       .Lsearch_isqrt_loop
.Lsearch_isqrt_done:
    mov     w0, w1
    ret

// search_set_state(w0 = index, w1 = state)
search_set_state:
    ldr     x2, =search_state
    strb    w1, [x2, w0, sxtw]
    ret

// search_set_mark(w0 = index, w1 = marker id)
search_set_mark:
    ldr     x2, =search_mark
    strb    w1, [x2, w0, sxtw]
    ret

// search_state_range(w0 = from, w1 = to, w2 = state) - inclusive
search_state_range:
    ldr     x3, =search_state
.Lsearch_range_loop:
    cmp     w0, w1
    b.gt    .Lsearch_range_done
    cmp     w0, 0
    b.lt    .Lsearch_range_next
    cmp     w0, search_max
    b.ge    .Lsearch_range_done
    strb    w2, [x3, w0, sxtw]
.Lsearch_range_next:
    add     w0, w0, 1
    b       .Lsearch_range_loop
.Lsearch_range_done:
    ret

// search_clear_marks() - no pointer outlives the frame that placed it
search_clear_marks:
    ldr     x0, =search_mark
    mov     w1, 0
.Lsearch_marks_loop:
    cmp     w1, 16
    b.ge    .Lsearch_marks_done
    strb    wzr, [x0, w1, sxtw]
    add     w1, w1, 1
    b       .Lsearch_marks_loop
.Lsearch_marks_done:
    ret

// search_bump() - count one compare
search_bump:
    ldr     x0, =search_probes
    ldr     w1, [x0]
    add     w1, w1, 1
    str     w1, [x0]
    ret

// search_say(x0 = sentence, w1, w2, w3 = its numbers)
search_say:
    ldr     x4, =search_line_fmt
    str     x0, [x4]
    ldr     x4, =search_line_a
    str     w1, [x4]
    str     w2, [x4, 4]
    str     w3, [x4, 8]
    ret

// search_form(x0 = the rule in symbols, or 0 for none)
search_form:
    ldr     x1, =search_form_fmt
    str     x0, [x1]
    ret

// search_calc(x0 = the arithmetic, w1..w5 = its numbers)
search_calc:
    ldr     x6, =search_calc_fmt
    str     x0, [x6]
    ldr     x6, =search_calc_args
    str     w1, [x6]
    str     w2, [x6, 4]
    str     w3, [x6, 8]
    str     w4, [x6, 12]
    str     w5, [x6, 16]
    ret

// search_result(x0 = verdict, w1, w2 = its numbers, w3 = role)
search_result:
    ldr     x4, =search_result_fmt
    str     x0, [x4]
    ldr     x4, =search_result_a
    str     w1, [x4]
    str     w2, [x4, 4]
    str     w3, [x4, 8]
    ret

// search_reset() - every run starts from the same clean state, so no
// marker, no grey prefix and no probe count crosses from one run to the
// next
search_reset:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, 0
.Lsearch_reset_loop:
    cmp     w19, 16
    b.ge    .Lsearch_reset_fields
    ldr     x0, =search_state
    strb    wzr, [x0, w19, sxtw]
    ldr     x0, =search_mark
    strb    wzr, [x0, w19, sxtw]
    add     w19, w19, 1
    b       .Lsearch_reset_loop

.Lsearch_reset_fields:
    ldr     x0, =search_probes
    str     wzr, [x0]
    ldr     x0, =search_active
    str     wzr, [x0]
    ldr     x0, =search_line_fmt
    str     xzr, [x0]
    ldr     x0, =search_form_fmt
    str     xzr, [x0]
    ldr     x0, =search_calc_fmt
    str     xzr, [x0]
    ldr     x0, =search_result_fmt
    str     xzr, [x0]

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// search_blank(w0 = row, w1 = col, w2 = cells) - wipe a run in place
search_blank:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w2
    bl      ui_at
    ldr     x0, =search_sp
    mov     w1, w19
    bl      ui_repeat

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// search_hold(w0 = halvings of the step delay) - flush, then wait. A
// compare holds the full delay, a move half of it, so the eye learns
// which frames are decisions.
search_hold:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0
    mov     x0, 0                           // fflush(0) drains every stream
    bl      fflush

    ldr     x0, =search_delay
    ldr     w0, [x0]
    lsr     w0, w0, w19
    cmp     w0, 15                          // below this nothing reads
    b.ge    .Lsearch_hold_wait
    mov     w0, 15
.Lsearch_hold_wait:
    bl      delay_ms

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// -------------------------------------------------------------- drawing

// search_style(w0 = cell state) - the colours a cell in that state wears
search_style:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    cmp     w0, search_st_win
    b.eq    .Lsearch_style_win
    cmp     w0, search_st_out
    b.eq    .Lsearch_style_out
    cmp     w0, search_st_probe
    b.eq    .Lsearch_style_probe
    cmp     w0, search_st_hit
    b.eq    .Lsearch_style_hit

    mov     w0, search_role_node            // untouched
    bl      th_fg
    b       .Lsearch_style_done

.Lsearch_style_win:
    mov     w0, search_role_key
    bl      th_fg
    b       .Lsearch_style_done

.Lsearch_style_out:
    mov     w0, search_role_faint           // greyed: read and discarded
    bl      th_bg
    b       .Lsearch_style_done

.Lsearch_style_probe:
    mov     w0, search_role_warn
    bl      th_bg
    b       .Lsearch_style_done

.Lsearch_style_hit:
    mov     w0, search_role_ok
    bl      th_bg

.Lsearch_style_done:
    ldp     fp, lr, [sp], 16
    ret

// search_draw_cells() - the array row, one cell per value
search_draw_cells:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     w0, search_row_cells
    mov     w1, 3
    mov     w2, 76
    bl      search_blank

    ldr     x0, =search_size
    ldr     w19, [x0]
    ldr     x22, =search_array

    mov     w20, 0
.Lsearch_cells_loop:
    cmp     w20, w19
    b.ge    .Lsearch_cells_done

    mov     w0, w20
    bl      search_cell_col
    mov     w21, w0

    mov     w0, search_row_cells
    mov     w1, w21
    bl      ui_at

    ldr     x0, =search_state
    ldrb    w0, [x0, w20, sxtw]
    bl      search_style

    ldr     x0, =search_fmt_cell
    ldr     w1, [x22, w20, sxtw 2]
    bl      printf
    bl      th_off

    add     w20, w20, 1
    b       .Lsearch_cells_loop

.Lsearch_cells_done:
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// search_draw_ruler() - the index under every cell, so a sentence naming
// a[4] can be pointed at
search_draw_ruler:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w0, search_row_ruler
    mov     w1, 3
    mov     w2, 76
    bl      search_blank

    ldr     x0, =search_size
    ldr     w19, [x0]

    mov     w20, 0
.Lsearch_ruler_loop:
    cmp     w20, w19
    b.ge    .Lsearch_ruler_done

    mov     w0, w20
    bl      search_cell_col
    add     w21, w0, 1

    mov     w0, search_row_ruler
    mov     w1, w21
    bl      ui_at
    mov     w0, search_role_faint
    bl      th_fg
    ldr     x0, =search_fmt_idx
    mov     w1, w20
    bl      printf
    bl      th_off

    add     w20, w20, 1
    b       .Lsearch_ruler_loop

.Lsearch_ruler_done:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// search_draw_marks() - low, mid, high, and whatever the running
// algorithm is pointing at, each in its own colour
search_draw_marks:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    mov     w0, search_row_mark
    mov     w1, 3
    mov     w2, 76
    bl      search_blank

    ldr     x0, =search_size
    ldr     w19, [x0]

    mov     w20, 0
.Lsearch_marks_cell:
    cmp     w20, w19
    b.ge    .Lsearch_marks_out

    ldr     x0, =search_mark
    ldrb    w22, [x0, w20, sxtw]
    cbz     w22, .Lsearch_marks_next

    mov     w0, w20
    bl      search_cell_col
    add     w21, w0, 1

    sub     w22, w22, 1                     // ids are 1 based
    ldr     x0, =search_mark_text
    ldr     x23, [x0, w22, sxtw 3]
    ldr     x0, =search_mark_role
    ldr     w0, [x0, w22, sxtw 2]

    mov     w2, w0
    mov     x3, x23
    mov     w0, search_row_mark
    mov     w1, w21
    bl      ui_text

.Lsearch_marks_next:
    add     w20, w20, 1
    b       .Lsearch_marks_cell

.Lsearch_marks_out:
    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// search_draw_status() - the sentence, the rule, the arithmetic, the
// counters, and the verdict once there is one
search_draw_status:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, search_row_say
.Lsearch_status_wipe:
    cmp     w19, search_row_count
    b.gt    .Lsearch_status_line
    mov     w0, w19
    mov     w1, 3
    mov     w2, 76
    bl      search_blank
    add     w19, w19, 1
    b       .Lsearch_status_wipe

.Lsearch_status_line:
    ldr     x19, =search_line_fmt
    ldr     x19, [x19]
    cbz     x19, .Lsearch_status_form

    mov     w0, search_row_say
    mov     w1, 4
    bl      ui_at
    mov     w0, search_role_text
    bl      th_fg
    mov     x0, x19
    ldr     x4, =search_line_a
    ldr     w1, [x4]
    ldr     w2, [x4, 4]
    ldr     w3, [x4, 8]
    bl      printf
    bl      th_off

.Lsearch_status_form:
    ldr     x19, =search_form_fmt
    ldr     x19, [x19]
    cbz     x19, .Lsearch_status_calc

    mov     w0, search_row_form
    mov     w1, 4
    mov     w2, search_role_dim
    mov     x3, x19
    bl      ui_text

.Lsearch_status_calc:
    ldr     x19, =search_calc_fmt
    ldr     x19, [x19]
    cbz     x19, .Lsearch_status_count

    mov     w0, search_row_calc
    mov     w1, 4
    bl      ui_at
    mov     w0, search_role_key
    bl      th_fg
    mov     x0, x19
    ldr     x6, =search_calc_args
    ldr     w1, [x6]
    ldr     w2, [x6, 4]
    ldr     w3, [x6, 8]
    ldr     w4, [x6, 12]
    ldr     w5, [x6, 16]
    bl      printf
    bl      th_off

.Lsearch_status_count:
    mov     w0, search_row_count
    mov     w1, 4
    bl      ui_at
    mov     w0, search_role_dim
    bl      th_fg

    ldr     x0, =search_active
    ldr     w0, [x0]
    cbz     w0, .Lsearch_status_setup

    ldr     x0, =search_fmt_count
    ldr     x1, =search_probes
    ldr     w1, [x1]
    ldr     x2, =search_target
    ldr     w2, [x2]
    ldr     x3, =search_size
    ldr     w3, [x3]
    bl      printf
    b       .Lsearch_status_verdict

.Lsearch_status_setup:
    ldr     x0, =search_fmt_setup
    ldr     x1, =search_size
    ldr     w1, [x1]
    ldr     x2, =search_delay
    ldr     w2, [x2]
    bl      printf

.Lsearch_status_verdict:
    bl      th_off

    mov     w0, search_row_result
    mov     w1, 3
    mov     w2, 76
    bl      search_blank

    ldr     x19, =search_result_fmt
    ldr     x19, [x19]
    cbz     x19, .Lsearch_status_out

    mov     w0, search_row_result
    mov     w1, 4
    bl      ui_at
    ldr     x0, =search_result_role
    ldr     w0, [x0]
    bl      th_fg
    mov     x0, x19
    ldr     x4, =search_result_a
    ldr     w1, [x4]
    ldr     w2, [x4, 4]
    bl      printf
    bl      th_off

.Lsearch_status_out:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// search_paint() - one frame, and only the parts that can change
search_paint:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      search_draw_cells
    bl      search_draw_ruler
    bl      search_draw_marks
    bl      search_draw_status
    mov     x0, 0
    bl      fflush

    ldp     fp, lr, [sp], 16
    ret

// search_swatch(w0 = row, w1 = col, w2 = state, x3 = label) - one entry
// of the legend, drawn as a real cell in that state
search_swatch:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     w19, w0
    mov     w20, w1
    mov     w21, w2
    mov     x22, x3

    bl      ui_at
    mov     w0, w21
    bl      search_style
    ldr     x0, =search_sw_txt
    bl      printf
    bl      th_off

    mov     w0, w19
    add     w1, w20, 5
    mov     w2, search_role_dim
    mov     x3, x22
    bl      ui_text

    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// search_legend() - what each colour means, in the colour it means it
search_legend:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, search_row_legend
    mov     w1, 3
    mov     w2, search_st_live
    ldr     x3, =search_lg_live
    bl      search_swatch

    mov     w0, search_row_legend
    mov     w1, 19
    mov     w2, search_st_win
    ldr     x3, =search_lg_win
    bl      search_swatch

    mov     w0, search_row_legend
    mov     w1, 35
    mov     w2, search_st_probe
    ldr     x3, =search_lg_probe
    bl      search_swatch

    mov     w0, search_row_legend
    mov     w1, 51
    mov     w2, search_st_out
    ldr     x3, =search_lg_out
    bl      search_swatch

    mov     w0, search_row_legend
    mov     w1, 67
    mov     w2, search_st_hit
    ldr     x3, =search_lg_hit
    bl      search_swatch

    ldp     fp, lr, [sp], 16
    ret

// search_chrome(x0 = title, x1 = the lesson line) - everything that does
// not move, drawn once per operation
search_chrome:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0
    mov     x20, x1

    mov     x0, x19
    bl      ui_screen
    ldr     x0, =search_foot_run
    bl      ui_footer

    mov     w0, 4
    mov     w1, 2
    mov     w2, 78
    mov     w3, 5
    ldr     x4, =search_panel_array
    bl      ui_panel

    mov     w0, 10
    mov     w1, 2
    mov     w2, 78
    mov     w3, 6
    ldr     x4, =search_panel_what
    bl      ui_panel

    bl      search_legend

    mov     w0, search_row_lesson
    mov     w1, 4
    mov     w2, search_role_dim
    mov     x3, x20
    bl      ui_text

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// search_notice(x0 = message, w1 = role) - a complaint on its own screen,
// so it never lands on top of an animation
search_notice:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0
    mov     w20, w1

    ldr     x0, =search_title
    bl      ui_screen
    ldr     x0, =search_foot_menu
    bl      ui_footer

    // 60 wide from column 10, so the wall stands at column 69 and the
    // longest message here stops well short of it
    mov     w0, 10
    mov     w1, 10
    mov     w2, 60
    mov     w3, 5
    ldr     x4, =search_panel_note
    bl      ui_panel

    mov     w0, 12
    mov     w1, 13
    mov     w2, w20
    mov     x3, x19
    bl      ui_text

    bl      wait_for_enter

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// --------------------------------------------------------------- array

// search_check_if_sorted() -> w0 = 1 when the values ascend
search_check_if_sorted:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    ldr     x0, =search_size
    ldr     w19, [x0]

    cmp     w19, 1                          // one value is already in order
    b.le    .Lsearch_sorted_yes

    ldr     x21, =search_array
    mov     w20, 0

.Lsearch_sorted_loop:
    add     w0, w20, 1
    cmp     w0, w19
    b.ge    .Lsearch_sorted_yes

    ldr     w0, [x21, w20, sxtw 2]
    add     w1, w20, 1
    ldr     w1, [x21, w1, sxtw 2]
    cmp     w0, w1
    b.gt    .Lsearch_sorted_no

    add     w20, w20, 1
    b       .Lsearch_sorted_loop

.Lsearch_sorted_yes:
    mov     w0, 1
    b       .Lsearch_sorted_out

.Lsearch_sorted_no:
    mov     w0, 0

.Lsearch_sorted_out:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// search_sort_array() - bubble sort, ascending
search_sort_array:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    ldr     x0, =search_size
    ldr     w19, [x0]
    cmp     w19, 1
    b.le    .Lsearch_sort_out

    ldr     x22, =search_array
    mov     w20, 0                          // passes made

.Lsearch_sort_outer:
    sub     w0, w19, 1
    cmp     w20, w0
    b.ge    .Lsearch_sort_out

    mov     w21, 0                          // the pair under test

.Lsearch_sort_inner:
    sub     w0, w19, w20
    sub     w0, w0, 1
    cmp     w21, w0
    b.ge    .Lsearch_sort_pass

    ldr     w0, [x22, w21, sxtw 2]
    add     w1, w21, 1
    ldr     w1, [x22, w1, sxtw 2]
    cmp     w0, w1
    b.le    .Lsearch_sort_keep

    mov     w23, w0
    str     w1, [x22, w21, sxtw 2]
    add     w1, w21, 1
    str     w23, [x22, w1, sxtw 2]

.Lsearch_sort_keep:
    add     w21, w21, 1
    b       .Lsearch_sort_inner

.Lsearch_sort_pass:
    add     w20, w20, 1
    b       .Lsearch_sort_outer

.Lsearch_sort_out:
    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// search_ask(x0 = question, x1 = hint, w2 = min, w3 = max)
//   -> w0 = value clamped to the range, w1 = 1 when a value was read
search_ask:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    mov     x19, x0
    mov     x20, x1
    mov     w21, w2
    mov     w22, w3

    ldr     x0, =search_title
    bl      ui_screen
    ldr     x0, =search_foot_pick
    bl      ui_footer

    // the speed question is 50 characters, so the panel is sized to hold
    // it with room to spare rather than the other way round
    mov     w0, 8
    mov     w1, 10
    mov     w2, 60
    mov     w3, 9
    ldr     x4, =search_panel_set
    bl      ui_panel

    mov     w0, 10
    mov     w1, 13
    mov     w2, search_role_text
    mov     x3, x19
    bl      ui_text

    mov     w0, 12
    mov     w1, 13
    mov     w2, search_role_dim
    mov     x3, x20
    bl      ui_text

    bl      ansi_show_cursor
    mov     w0, 14
    mov     w1, 13
    mov     w2, search_role_text
    ldr     x3, =search_lbl_value
    bl      ui_text
    mov     w0, search_role_key
    bl      th_fg

    bl      read_int
    mov     w23, w0
    mov     w24, w1                         // 0 means stdin ended
    bl      th_off
    bl      ansi_hide_cursor

    cbz     w24, .Lsearch_ask_out

    cmp     w23, w21
    b.ge    .Lsearch_ask_top
    mov     w23, w21
.Lsearch_ask_top:
    cmp     w23, w22
    b.le    .Lsearch_ask_out
    mov     w23, w22

.Lsearch_ask_out:
    mov     w0, w23
    mov     w1, w24
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// search_seed_array() - lay in the sample values, so the first search a
// student picks has something to look for
search_seed_array:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    ldr     x19, =search_seed
    ldr     x20, =search_array
    mov     w21, 0

.Lsearch_seed_loop:
    cmp     w21, search_max
    b.ge    .Lsearch_seed_done
    ldr     w0, [x19, w21, sxtw 2]
    str     w0, [x20, w21, sxtw 2]
    add     w21, w21, 1
    b       .Lsearch_seed_loop

.Lsearch_seed_done:
    ldr     x0, =search_size
    mov     w1, search_max
    str     w1, [x0]
    bl      search_reset

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// search_fill_random() - the quick way to get an array, and the reason
// the typed-in one exists: a hit here is luck
search_fill_random:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    ldr     x0, =search_ask_size
    ldr     x1, =search_hint_size
    mov     w2, 3
    mov     w3, search_max
    bl      search_ask
    cbz     w1, .Lsearch_fill_out
    mov     w19, w0

    ldr     x0, =search_size
    str     w19, [x0]
    ldr     x21, =search_array

    mov     w20, 0
.Lsearch_fill_loop:
    cmp     w20, w19
    b.ge    .Lsearch_fill_done

    mov     w0, 99
    bl      get_random
    add     w0, w0, 1                       // 1 to 99 reads better than 0
    str     w0, [x21, w20, sxtw 2]

    add     w20, w20, 1
    b       .Lsearch_fill_loop

.Lsearch_fill_done:
    bl      search_reset
    ldr     x0, =search_title_array
    ldr     x1, =search_lesson_array
    bl      search_chrome

    ldr     x0, =search_say_random
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      search_say
    bl      search_paint
    bl      wait_for_enter

.Lsearch_fill_out:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// search_type_values() - the student picks the values, so a search can be
// aimed at something that is certainly there
search_type_values:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    ldr     x0, =search_ask_size
    ldr     x1, =search_hint_size
    mov     w2, 3
    mov     w3, search_max
    bl      search_ask
    cbz     w1, .Lsearch_type_out
    mov     w19, w0

    ldr     x0, =search_size
    str     w19, [x0]
    ldr     x21, =search_array

    bl      search_reset
    mov     w0, 0
    sub     w1, w19, 1
    mov     w2, search_st_out               // nothing has been typed yet
    bl      search_state_range

    ldr     x0, =search_title_own
    ldr     x1, =search_lesson_array
    bl      search_chrome

    mov     w20, 0
.Lsearch_type_loop:
    cmp     w20, w19
    b.ge    .Lsearch_type_done

    mov     w0, w20
    mov     w1, search_st_probe
    bl      search_set_state
    bl      search_clear_marks
    mov     w0, w20
    mov     w1, search_mk_step
    bl      search_set_mark

    ldr     x0, =search_say_typing
    mov     w1, w20
    mov     w2, 0
    mov     w3, 0
    bl      search_say
    bl      search_paint

    bl      ansi_show_cursor
    mov     w0, search_row_ask
    mov     w1, 4
    bl      ui_at
    mov     w0, search_role_text
    bl      th_fg
    ldr     x0, =search_ask_cell
    mov     w1, w20
    bl      printf
    bl      th_off
    mov     w0, search_role_key
    bl      th_fg

    bl      read_int
    mov     w22, w0
    mov     w23, w1                         // hold it across the two calls
    bl      th_off
    bl      ansi_hide_cursor
    cbz     w23, .Lsearch_type_short

    cmp     w22, 0                          // a cell is three columns wide, so
    b.ge    .Lsearch_type_cap               // the value has to stay inside it
    mov     w22, 0
.Lsearch_type_cap:
    cmp     w22, 999
    b.le    .Lsearch_type_store
    mov     w22, 999

.Lsearch_type_store:
    str     w22, [x21, w20, sxtw 2]
    mov     w0, w20
    mov     w1, search_st_live
    bl      search_set_state

    add     w20, w20, 1
    b       .Lsearch_type_loop

.Lsearch_type_short:
    mov     w19, w20                        // stdin ended, keep what landed
    ldr     x0, =search_size
    str     w19, [x0]

.Lsearch_type_done:
    bl      search_clear_marks
    mov     w0, search_row_ask
    mov     w1, 3
    mov     w2, 76
    bl      search_blank

    ldr     x0, =search_say_stored
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      search_say
    bl      search_paint
    bl      wait_for_enter

.Lsearch_type_out:
    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// search_show_array() - the array on its own, with whether it is in order
search_show_array:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =search_size
    ldr     w19, [x0]
    cmp     w19, 0
    b.gt    .Lsearch_show_draw

    ldr     x0, =search_msg_empty
    mov     w1, search_role_bad
    bl      search_notice
    b       .Lsearch_show_out

.Lsearch_show_draw:
    bl      search_reset
    ldr     x0, =search_title_array
    ldr     x1, =search_lesson_array
    bl      search_chrome

    bl      search_check_if_sorted
    cbz     w0, .Lsearch_show_jumbled
    ldr     x0, =search_say_inorder
    b       .Lsearch_show_say
.Lsearch_show_jumbled:
    ldr     x0, =search_say_jumbled
.Lsearch_show_say:
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      search_say
    bl      search_paint
    bl      wait_for_enter

.Lsearch_show_out:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// search_sort_screen() - sort, then show what sorting bought
search_sort_screen:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =search_size
    ldr     w19, [x0]
    cmp     w19, 0
    b.gt    .Lsearch_sortscreen_run

    ldr     x0, =search_msg_empty
    mov     w1, search_role_bad
    bl      search_notice
    b       .Lsearch_sortscreen_out

.Lsearch_sortscreen_run:
    bl      search_sort_array
    bl      search_reset
    ldr     x0, =search_title_array
    ldr     x1, =search_lesson_array
    bl      search_chrome

    ldr     x0, =search_say_inorder
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      search_say
    bl      search_paint
    bl      wait_for_enter

.Lsearch_sortscreen_out:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// ----------------------------------------------------------- the runs

// search_open(x0 = title, x1 = lesson, x2 = best, x3 = average,
//             x4 = worst, x5 = space, w6 = 1 when the values must ascend)
//   -> w0 = target, w1 = 1 to run, 0 to go back
// One place for everything the four searches share: the empty check, the
// full state reset, the sort binary and its two relatives depend on, the
// chrome, and the target prompt.
search_open:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]

    mov     x19, x0
    mov     x20, x1
    mov     x21, x2
    mov     x22, x3
    mov     x23, x4
    mov     x24, x5
    mov     w25, w6

    ldr     x0, =search_size
    ldr     w0, [x0]
    cmp     w0, 0
    b.gt    .Lsearch_open_reset

    ldr     x0, =search_msg_empty
    mov     w1, search_role_bad
    bl      search_notice
    mov     w0, 0
    mov     w1, 0
    b       .Lsearch_open_out

.Lsearch_open_reset:
    bl      search_reset

    mov     w26, 0                          // did the run have to sort?
    cbz     w25, .Lsearch_open_chrome
    bl      search_check_if_sorted
    cbnz    w0, .Lsearch_open_chrome
    bl      search_sort_array
    mov     w26, 1

.Lsearch_open_chrome:
    mov     x0, x19
    mov     x1, x20
    bl      search_chrome

    mov     w0, search_row_cost
    mov     w1, 3
    mov     x2, x21
    mov     x3, x22
    mov     x4, x23
    mov     x5, x24
    bl      ui_complexity

    cbz     w26, .Lsearch_open_ready
    ldr     x0, =search_say_sorted
    b       .Lsearch_open_say
.Lsearch_open_ready:
    ldr     x0, =search_say_ready
.Lsearch_open_say:
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      search_say
    bl      search_paint

    bl      ansi_show_cursor
    mov     w0, search_row_ask
    mov     w1, 4
    mov     w2, search_role_text
    ldr     x3, =search_ask_target
    bl      ui_text
    mov     w0, search_role_key
    bl      th_fg

    bl      read_int
    mov     w19, w0
    mov     w20, w1
    bl      th_off
    bl      ansi_hide_cursor

    mov     w0, search_row_ask
    mov     w1, 3
    mov     w2, 76
    bl      search_blank

    cbz     w20, .Lsearch_open_bail         // stdin ended, back to the menu

    ldr     x0, =search_target
    str     w19, [x0]
    ldr     x0, =search_active
    mov     w1, 1
    str     w1, [x0]
    mov     w0, w19
    mov     w1, 1
    b       .Lsearch_open_out

.Lsearch_open_bail:
    mov     w0, 0
    mov     w1, 0

.Lsearch_open_out:
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// search_finish_hit(w0 = index, w1 = target) - the last frame of a run
// that found what it was after
search_finish_hit:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     w19, w0
    mov     w20, w1

    mov     w0, w19
    mov     w1, search_st_hit
    bl      search_set_state
    bl      search_clear_marks

    ldr     x0, =search_say_hit
    mov     w1, w20
    mov     w2, w19
    ldr     x3, =search_probes
    ldr     w3, [x3]
    bl      search_say

    ldr     x0, =search_res_found
    mov     w1, w20
    mov     w2, w19
    mov     w3, search_role_ok
    bl      search_result

    bl      search_paint
    bl      wait_for_enter

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// search_finish_miss(w0 = target) - the last frame of a run that did not
search_finish_miss:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     w19, w0

    ldr     x0, =search_size
    ldr     w20, [x0]
    bl      search_clear_marks

    ldr     x0, =search_say_miss
    mov     w1, w19
    ldr     x2, =search_probes
    ldr     w2, [x2]
    mov     w3, 0
    bl      search_say

    ldr     x0, =search_res_miss
    mov     w1, w19
    mov     w2, w20
    mov     w3, search_role_bad
    bl      search_result

    bl      search_paint
    bl      wait_for_enter

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// search_run_linear() - read the cells in order, one compare each
search_run_linear:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    ldr     x0, =search_title_linear
    ldr     x1, =search_lesson_linear
    ldr     x2, =search_cx_o1
    ldr     x3, =search_cx_on
    ldr     x4, =search_cx_on
    ldr     x5, =search_cx_o1
    mov     w6, 0                           // any order will do
    bl      search_open
    cbz     w1, .Lsearch_linear_out
    mov     w20, w0                         // target

    ldr     x0, =search_size
    ldr     w19, [x0]
    ldr     x22, =search_array

    ldr     x0, =search_form_linear
    bl      search_form

    mov     w21, 0
.Lsearch_linear_loop:
    cmp     w21, w19
    b.ge    .Lsearch_linear_miss

    mov     w0, w21
    mov     w1, search_st_probe
    bl      search_set_state
    bl      search_clear_marks
    mov     w0, w21
    mov     w1, search_mk_step
    bl      search_set_mark
    bl      search_bump

    ldr     w23, [x22, w21, sxtw 2]

    ldr     x0, =search_say_compare
    mov     w1, w21
    mov     w2, w23
    mov     w3, w20
    bl      search_say

    ldr     x0, =search_calc_scan
    add     w1, w21, 1
    mov     w2, w19
    mov     w3, 0
    mov     w4, 0
    mov     w5, 0
    bl      search_calc

    bl      search_paint
    mov     w0, 0                           // a compare holds the full delay
    bl      search_hold

    cmp     w23, w20
    b.eq    .Lsearch_linear_hit

    mov     w0, w21
    mov     w1, search_st_out
    bl      search_set_state
    bl      search_clear_marks

    ldr     x0, =search_say_step
    mov     w1, w21
    mov     w2, w23
    mov     w3, w20
    bl      search_say

    bl      search_paint
    mov     w0, 1                           // a move holds half
    bl      search_hold

    add     w21, w21, 1
    b       .Lsearch_linear_loop

.Lsearch_linear_hit:
    mov     w0, w21
    mov     w1, w20
    bl      search_finish_hit
    b       .Lsearch_linear_out

.Lsearch_linear_miss:
    mov     w0, w20
    bl      search_finish_miss

.Lsearch_linear_out:
    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// search_run_binary() - halve the window, and grey out the half that is
// gone so the elimination is the thing you watch
search_run_binary:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    str     x25, [sp, 64]

    ldr     x0, =search_title_binary
    ldr     x1, =search_lesson_binary
    ldr     x2, =search_cx_o1
    ldr     x3, =search_cx_ologn
    ldr     x4, =search_cx_ologn
    ldr     x5, =search_cx_o1
    mov     w6, 1                           // the values must ascend
    bl      search_open
    cbz     w1, .Lsearch_binary_out
    mov     w20, w0

    ldr     x0, =search_size
    ldr     w19, [x0]
    ldr     x24, =search_array

    ldr     x0, =search_form_binary
    bl      search_form

    mov     w0, 0
    sub     w1, w19, 1
    mov     w2, search_st_win
    bl      search_state_range

    mov     w21, 0                          // low
    sub     w22, w19, 1                     // high

.Lsearch_binary_loop:
    cmp     w21, w22
    b.gt    .Lsearch_binary_miss

    add     w23, w21, w22
    lsr     w23, w23, 1                     // mid, and the values had no say

    bl      search_clear_marks
    mov     w0, w21
    mov     w1, search_mk_low
    bl      search_set_mark
    mov     w0, w22
    mov     w1, search_mk_high
    bl      search_set_mark
    mov     w0, w23
    mov     w1, search_mk_mid               // last, so a collision reads mid
    bl      search_set_mark

    mov     w0, w23
    mov     w1, search_st_probe
    bl      search_set_state
    bl      search_bump

    ldr     w25, [x24, w23, sxtw 2]

    ldr     x0, =search_say_compare
    mov     w1, w23
    mov     w2, w25
    mov     w3, w20
    bl      search_say

    ldr     x0, =search_calc_mid
    mov     w1, w21
    mov     w2, w22
    mov     w3, w23
    mov     w4, 0
    mov     w5, 0
    bl      search_calc

    bl      search_paint
    mov     w0, 0
    bl      search_hold

    cmp     w25, w20
    b.eq    .Lsearch_binary_hit
    b.lt    .Lsearch_binary_right

    mov     w0, w23                         // arr[mid] is above the target
    mov     w1, w22
    mov     w2, search_st_out
    bl      search_state_range

    ldr     x0, =search_say_right
    mov     w1, w23
    mov     w2, w25
    mov     w3, w20
    bl      search_say

    sub     w22, w23, 1
    b       .Lsearch_binary_shrink

.Lsearch_binary_right:
    mov     w0, w21                         // arr[mid] is below the target
    mov     w1, w23
    mov     w2, search_st_out
    bl      search_state_range

    ldr     x0, =search_say_left
    mov     w1, w23
    mov     w2, w25
    mov     w3, w20
    bl      search_say

    add     w21, w23, 1

.Lsearch_binary_shrink:
    bl      search_clear_marks
    cmp     w21, w22
    b.gt    .Lsearch_binary_gone

    mov     w0, w21
    mov     w1, search_mk_low
    bl      search_set_mark
    mov     w0, w22
    mov     w1, search_mk_high
    bl      search_set_mark

    ldr     x0, =search_calc_window
    mov     w1, w21
    mov     w2, w22
    sub     w3, w22, w21
    add     w3, w3, 1
    mov     w4, 0
    mov     w5, 0
    bl      search_calc
    b       .Lsearch_binary_next

.Lsearch_binary_gone:
    ldr     x0, =search_calc_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    mov     w4, 0
    mov     w5, 0
    bl      search_calc

.Lsearch_binary_next:
    bl      search_paint
    mov     w0, 1
    bl      search_hold
    b       .Lsearch_binary_loop

.Lsearch_binary_hit:
    mov     w0, w23
    mov     w1, w20
    bl      search_finish_hit
    b       .Lsearch_binary_out

.Lsearch_binary_miss:
    mov     w0, 0
    sub     w1, w19, 1
    mov     w2, search_st_out
    bl      search_state_range
    mov     w0, w20
    bl      search_finish_miss

.Lsearch_binary_out:
    ldr     x25, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// search_run_jump() - stride by floor(sqrt(n)) until the block that could
// hold the target is found, then walk that block. The two phases are
// meant to look different: a jump discards a whole block at once, the
// walk gives up one cell at a time.
search_run_jump:
    stp     fp, lr, [sp, -96]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]
    str     x27, [sp, 80]

    ldr     x0, =search_title_jump
    ldr     x1, =search_lesson_jump
    ldr     x2, =search_cx_o1
    ldr     x3, =search_cx_osqrt
    ldr     x4, =search_cx_osqrt
    ldr     x5, =search_cx_o1
    mov     w6, 1
    bl      search_open
    cbz     w1, .Lsearch_jump_out
    mov     w20, w0

    ldr     x0, =search_size
    ldr     w19, [x0]
    ldr     x21, =search_array

    ldr     x0, =search_form_jump
    bl      search_form

    mov     w0, 0
    sub     w1, w19, 1
    mov     w2, search_st_win
    bl      search_state_range

    mov     w0, w19
    bl      search_isqrt
    mov     w22, w0                         // the block size, fixed for the run

    ldr     x0, =search_say_block
    mov     w1, w22
    mov     w2, 0
    mov     w3, 0
    bl      search_say

    ldr     x0, =search_calc_block
    mov     w1, w19
    mov     w2, w22
    mov     w3, w22
    mov     w4, 0
    mov     w5, 0
    bl      search_calc

    bl      search_paint
    mov     w0, 0
    bl      search_hold

    mov     w23, 0                          // first index of the block

.Lsearch_jump_stride:
    cmp     w23, w19
    b.ge    .Lsearch_jump_miss

    add     w26, w23, w22                   // one past the block
    cmp     w26, w19
    b.le    .Lsearch_jump_edge
    mov     w26, w19
.Lsearch_jump_edge:
    sub     w24, w26, 1                     // the block ends here

    bl      search_clear_marks
    mov     w0, w24
    mov     w1, search_mk_jump
    bl      search_set_mark
    mov     w0, w24
    mov     w1, search_st_probe
    bl      search_set_state
    bl      search_bump

    ldr     w25, [x21, w24, sxtw 2]

    ldr     x0, =search_say_edge
    mov     w1, w24
    mov     w2, w25
    mov     w3, w20
    bl      search_say

    ldr     x0, =search_calc_span
    mov     w1, w23
    mov     w2, w24
    mov     w3, w22
    mov     w4, 0
    mov     w5, 0
    bl      search_calc

    bl      search_paint
    mov     w0, 0
    bl      search_hold

    cmp     w25, w20
    b.eq    .Lsearch_jump_edge_hit
    b.gt    .Lsearch_jump_land

    mov     w0, w23                         // the whole block is too small
    mov     w1, w24
    mov     w2, search_st_out
    bl      search_state_range
    bl      search_clear_marks

    ldr     x0, =search_say_skip
    mov     w1, w24
    mov     w2, w25
    mov     w3, w20
    bl      search_say

    bl      search_paint
    mov     w0, 1
    bl      search_hold

    mov     w23, w26
    b       .Lsearch_jump_stride

.Lsearch_jump_edge_hit:
    mov     w27, w24
    b       .Lsearch_jump_hit

.Lsearch_jump_land:
    bl      search_clear_marks
    mov     w0, w24
    mov     w1, search_st_win
    bl      search_set_state

    ldr     x0, =search_say_land
    mov     w1, w20
    mov     w2, w24
    mov     w3, w23
    bl      search_say

    ldr     x0, =search_calc_walk
    mov     w1, w23
    mov     w2, w24
    mov     w3, 0
    mov     w4, 0
    mov     w5, 0
    bl      search_calc

    bl      search_paint
    mov     w0, 1
    bl      search_hold

    mov     w27, w23                        // walk the block from its start

.Lsearch_jump_walk:
    cmp     w27, w24
    b.gt    .Lsearch_jump_miss

    mov     w0, w27
    mov     w1, search_st_probe
    bl      search_set_state
    bl      search_clear_marks
    mov     w0, w27
    mov     w1, search_mk_step
    bl      search_set_mark
    bl      search_bump

    ldr     w25, [x21, w27, sxtw 2]

    ldr     x0, =search_say_walk
    mov     w1, w27
    mov     w2, w25
    mov     w3, w20
    bl      search_say

    bl      search_paint
    mov     w0, 0
    bl      search_hold

    cmp     w25, w20
    b.eq    .Lsearch_jump_hit
    b.gt    .Lsearch_jump_past

    mov     w0, w27
    mov     w1, search_st_out
    bl      search_set_state
    bl      search_clear_marks

    ldr     x0, =search_say_step
    mov     w1, w27
    mov     w2, w25
    mov     w3, w20
    bl      search_say

    bl      search_paint
    mov     w0, 1
    bl      search_hold

    add     w27, w27, 1
    b       .Lsearch_jump_walk

.Lsearch_jump_past:
    ldr     x0, =search_say_past
    mov     w1, w27
    mov     w2, w25
    mov     w3, w20
    bl      search_say
    bl      search_paint
    mov     w0, 1
    bl      search_hold
    b       .Lsearch_jump_miss

.Lsearch_jump_hit:
    mov     w0, w27
    mov     w1, w20
    bl      search_finish_hit
    b       .Lsearch_jump_out

.Lsearch_jump_miss:
    mov     w0, 0
    sub     w1, w19, 1
    mov     w2, search_st_out
    bl      search_state_range
    mov     w0, w20
    bl      search_finish_miss

.Lsearch_jump_out:
    ldr     x27, [sp, 80]
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96
    ret

// search_run_interp() - the same window as binary search, but the probe
// comes from the values at its ends rather than from the middle. Watch
// the arithmetic line next to binary search: this is the whole lesson.
search_run_interp:
    stp     fp, lr, [sp, -96]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]
    stp     x27, x28, [sp, 80]

    ldr     x0, =search_title_interp
    ldr     x1, =search_lesson_interp
    ldr     x2, =search_cx_o1
    ldr     x3, =search_cx_ololog
    ldr     x4, =search_cx_on
    ldr     x5, =search_cx_o1
    mov     w6, 1
    bl      search_open
    cbz     w1, .Lsearch_interp_out
    mov     w20, w0

    ldr     x0, =search_size
    ldr     w19, [x0]
    ldr     x21, =search_array

    ldr     x0, =search_form_interp
    bl      search_form

    mov     w0, 0
    sub     w1, w19, 1
    mov     w2, search_st_win
    bl      search_state_range

    mov     w22, 0                          // low
    sub     w23, w19, 1                     // high

.Lsearch_interp_loop:
    cmp     w22, w23
    b.gt    .Lsearch_interp_miss

    ldr     w26, [x21, w22, sxtw 2]         // the value at the low end
    ldr     w27, [x21, w23, sxtw 2]         // the value at the high end

    cmp     w20, w26
    b.lt    .Lsearch_interp_outside
    cmp     w20, w27
    b.gt    .Lsearch_interp_outside

    sub     w28, w27, w26                   // the spread across the window
    cbz     w28, .Lsearch_interp_flat

    sub     w0, w20, w26                    // how far in the target sits
    sub     w1, w23, w22                    // how many cells that spans
    mul     w0, w0, w1
    sdiv    w0, w0, w28
    add     w24, w22, w0                    // the guessed position

    ldr     x0, =search_calc_guess
    mov     w1, w22
    sub     w2, w20, w26
    sub     w3, w23, w22
    mov     w4, w28
    mov     w5, w24
    bl      search_calc
    b       .Lsearch_interp_clamp

.Lsearch_interp_flat:
    mov     w24, w22                        // every value is the same
    ldr     x0, =search_calc_flat
    mov     w1, w26
    mov     w2, 0
    mov     w3, 0
    mov     w4, 0
    mov     w5, 0
    bl      search_calc

.Lsearch_interp_clamp:
    cmp     w24, w22
    b.ge    .Lsearch_interp_top
    mov     w24, w22
.Lsearch_interp_top:
    cmp     w24, w23
    b.le    .Lsearch_interp_probe
    mov     w24, w23

.Lsearch_interp_probe:
    bl      search_clear_marks
    mov     w0, w22
    mov     w1, search_mk_low
    bl      search_set_mark
    mov     w0, w23
    mov     w1, search_mk_high
    bl      search_set_mark
    mov     w0, w24
    mov     w1, search_mk_guess
    bl      search_set_mark

    mov     w0, w24
    mov     w1, search_st_probe
    bl      search_set_state
    bl      search_bump

    ldr     w25, [x21, w24, sxtw 2]

    ldr     x0, =search_say_guess
    mov     w1, w24
    mov     w2, w25
    mov     w3, w20
    bl      search_say

    bl      search_paint
    mov     w0, 0
    bl      search_hold

    cmp     w25, w20
    b.eq    .Lsearch_interp_hit
    b.lt    .Lsearch_interp_right

    mov     w0, w24                         // the guess landed above
    mov     w1, w23
    mov     w2, search_st_out
    bl      search_state_range

    ldr     x0, =search_say_right
    mov     w1, w24
    mov     w2, w25
    mov     w3, w20
    bl      search_say

    sub     w23, w24, 1
    b       .Lsearch_interp_shrink

.Lsearch_interp_right:
    mov     w0, w22                         // the guess landed below
    mov     w1, w24
    mov     w2, search_st_out
    bl      search_state_range

    ldr     x0, =search_say_left
    mov     w1, w24
    mov     w2, w25
    mov     w3, w20
    bl      search_say

    add     w22, w24, 1

.Lsearch_interp_shrink:
    bl      search_clear_marks
    cmp     w22, w23
    b.gt    .Lsearch_interp_gone

    mov     w0, w22
    mov     w1, search_mk_low
    bl      search_set_mark
    mov     w0, w23
    mov     w1, search_mk_high
    bl      search_set_mark

    ldr     x0, =search_calc_window
    mov     w1, w22
    mov     w2, w23
    sub     w3, w23, w22
    add     w3, w3, 1
    mov     w4, 0
    mov     w5, 0
    bl      search_calc
    b       .Lsearch_interp_next

.Lsearch_interp_gone:
    ldr     x0, =search_calc_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    mov     w4, 0
    mov     w5, 0
    bl      search_calc

.Lsearch_interp_next:
    bl      search_paint
    mov     w0, 1
    bl      search_hold
    b       .Lsearch_interp_loop

.Lsearch_interp_outside:
    ldr     x0, =search_say_outside
    mov     w1, w20
    mov     w2, w26
    mov     w3, w27
    bl      search_say
    bl      search_paint
    mov     w0, 1
    bl      search_hold
    b       .Lsearch_interp_miss

.Lsearch_interp_hit:
    mov     w0, w24
    mov     w1, w20
    bl      search_finish_hit
    b       .Lsearch_interp_out

.Lsearch_interp_miss:
    mov     w0, 0
    sub     w1, w19, 1
    mov     w2, search_st_out
    bl      search_state_range
    mov     w0, w20
    bl      search_finish_miss

.Lsearch_interp_out:
    ldp     x27, x28, [sp, 80]
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96
    ret

// ----------------------------------------------------------------- menu

// search_menu_draw() - the operations, with the state of the array under
// them so the choice is an informed one
search_menu_draw:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    ldr     x0, =search_title
    bl      ui_screen
    ldr     x0, =search_foot_menu
    bl      ui_footer

    mov     w0, 4
    mov     w1, 15
    mov     w2, 50
    mov     w3, 16
    ldr     x4, =search_panel_menu
    bl      ui_panel

    ldr     x21, =search_menu_items
    mov     w19, 0
.Lsearch_menu_item:
    cmp     w19, 10
    b.ge    .Lsearch_menu_state

    add     w20, w19, 6                     // the options begin on row 6
    mov     w0, w20
    mov     w1, 18
    mov     w2, search_role_key
    ldr     x3, =search_digits
    sxtw    x19, w19
    add     x3, x3, x19, lsl 1
    bl      ui_badge

    mov     w0, w20
    mov     w1, 22
    mov     w2, search_role_text
    ldr     x3, [x21, w19, sxtw 3]
    bl      ui_text

    add     w19, w19, 1
    b       .Lsearch_menu_item

.Lsearch_menu_state:
    ldr     x0, =search_size
    ldr     w19, [x0]
    cmp     w19, 0
    b.gt    .Lsearch_menu_order
    ldr     x22, =search_word_empty
    b       .Lsearch_menu_row

.Lsearch_menu_order:
    bl      search_check_if_sorted
    cbz     w0, .Lsearch_menu_jumbled
    ldr     x22, =search_word_sorted
    b       .Lsearch_menu_row
.Lsearch_menu_jumbled:
    ldr     x22, =search_word_plain

.Lsearch_menu_row:
    mov     w0, 17
    mov     w1, 18
    bl      ui_at
    mov     w0, search_role_dim
    bl      th_fg
    ldr     x0, =search_fmt_state
    mov     w1, w19
    mov     x2, x22
    ldr     x3, =search_delay
    ldr     w3, [x3]
    bl      printf
    bl      th_off

    bl      ansi_show_cursor
    mov     w0, 18
    mov     w1, 18
    mov     w2, search_role_text
    ldr     x3, =search_lbl_choice
    bl      ui_text
    mov     w0, 18
    mov     w1, 25
    bl      ui_at

    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// search_menu() - the module loop; choice 0 hands control back to main
    .global search_menu
search_menu:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    // the first visit finds the sample array already loaded
    ldr     x0, =search_ready
    ldr     w1, [x0]
    cbnz    w1, .Lsearch_menu_loop
    mov     w1, 1
    str     w1, [x0]
    bl      search_seed_array

.Lsearch_menu_loop:
    bl      search_menu_draw

    mov     w0, 0
    mov     w1, 9
    bl      read_int_range
    mov     w19, w0                         // hold it: printf answers in w0
    bl      ansi_hide_cursor

    cmp     w19, 0
    b.eq    .Lsearch_menu_exit
    cmp     w19, 1
    b.eq    .Lsearch_menu_linear
    cmp     w19, 2
    b.eq    .Lsearch_menu_binary
    cmp     w19, 3
    b.eq    .Lsearch_menu_jump
    cmp     w19, 4
    b.eq    .Lsearch_menu_interp
    cmp     w19, 5
    b.eq    .Lsearch_menu_show
    cmp     w19, 6
    b.eq    .Lsearch_menu_random
    cmp     w19, 7
    b.eq    .Lsearch_menu_typed
    cmp     w19, 8
    b.eq    .Lsearch_menu_sort
    cmp     w19, 9
    b.eq    .Lsearch_menu_speed
    b       .Lsearch_menu_loop

.Lsearch_menu_linear:
    bl      search_run_linear
    b       .Lsearch_menu_loop

.Lsearch_menu_binary:
    bl      search_run_binary
    b       .Lsearch_menu_loop

.Lsearch_menu_jump:
    bl      search_run_jump
    b       .Lsearch_menu_loop

.Lsearch_menu_interp:
    bl      search_run_interp
    b       .Lsearch_menu_loop

.Lsearch_menu_show:
    bl      search_show_array
    b       .Lsearch_menu_loop

.Lsearch_menu_random:
    bl      search_fill_random
    b       .Lsearch_menu_loop

.Lsearch_menu_typed:
    bl      search_type_values
    b       .Lsearch_menu_loop

.Lsearch_menu_sort:
    bl      search_sort_screen
    b       .Lsearch_menu_loop

.Lsearch_menu_speed:
    ldr     x0, =search_ask_speed
    ldr     x1, =search_hint_speed
    mov     w2, 60
    mov     w3, 1200
    bl      search_ask
    cbz     w1, .Lsearch_menu_loop
    ldr     x1, =search_delay
    str     w0, [x1]
    b       .Lsearch_menu_loop

.Lsearch_menu_exit:
    bl      ansi_hide_cursor
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

    .data
    .balign 8
search_menu_items:
    .dword search_mi1, search_mi2, search_mi3, search_mi4, search_mi5
    .dword search_mi6, search_mi7, search_mi8, search_mi9, search_mi0

    .text
