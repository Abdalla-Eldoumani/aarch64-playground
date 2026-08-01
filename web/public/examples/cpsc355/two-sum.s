// two-sum - the menu-driven visualizer, driven from the terminal pane
//
// The full project (the plain solver, build files, history) lives at
//   https://github.com/Abdalla-Eldoumani/twosum-arm
//
// how to run: press assemble, then run -- the visualizer takes over
// the terminal pane and reads its menu from there. Or run it the
// course way from the term tab:  ./program  (the Makefile in the
// repo builds this same source as ./two_sum_viz).
//
// how to use: enter gets past the splash, then the menu is numbers.
// [1] loads one of six presets, [2] types an array in by hand (1 to
// 10 values, each -99 to 999), [3] sets the target, [4] sets the
// frame delay in milliseconds. [5] watches brute force, [6] watches
// the hash set, [7] runs both back to back, and enter steps past each
// finished run. [0] quits. ctrl+c in the terminal stops the program
// at any point.

// two_sum_viz.asm
// Animated terminal visualizer for the two-sum problem, in ARMv8
// AArch64 assembly. The companion of two_sum.asm: same two
// algorithms, same inputs, but wired up with ANSI colours so you can
// watch them work step by step.
//
// Build:
//     make            native, on aarch64 hardware
//     make cross      from an x86_64 host
//
// Or by hand, the same steps the Makefile runs:
//     m4 two_sum_viz.asm > two_sum_viz.s
//     gcc -g two_sum_viz.s -o two_sum_viz
//
// Needs a terminal at least 80 columns wide and around 26 rows tall,
// with ANSI colour support (any modern xterm, gnome-terminal, iTerm,
// kitty, alacritty, wezterm, Windows Terminal, etc.).

define(fp, x29)
define(lr, x30)

define(ARRAY_MAX, 10)
define(HASH_SIZE, 16)
define(HASH_MASK, 0x0F)
define(DEFAULT_DELAY, 700)

// Array cells are drawn five columns wide, so a value outside this
// range would spill into its neighbour. The target gets a wider
// range because it is only ever printed as plain text, and both
// ranges keep target - arr[i] far away from a 32-bit wrap.
define(VALUE_MIN, -99)
define(VALUE_MAX, 999)
define(TARGET_MIN, -9999)
define(TARGET_MAX, 9999)

// Longest run of digits a typed number may have (nine keeps the
// parsed value inside 32 bits, so anything a user can type is
// reported as out of range rather than as junk), and the rows where
// an input handler confirms or explains an answer.
define(DIGIT_MAX, 9)
define(NOTICE_ROW, 24)
define(STATUS_ROW, 22)

// ANSI escape sequences. printf treats them as any other text, so
// the drawing code is just a sequence of printfs with the right
// control bytes mixed in. Colour codes: 30-37 foreground, 40-47
// background, 90-97 bright foreground, 100-107 bright background.
        .data
seq_clear:      .string "\x1b[2J\x1b[H"
seq_reset:      .string "\x1b[0m"
seq_hide:       .string "\x1b[?25l"
seq_show:       .string "\x1b[?25h"
fmt_move:       .string "\x1b[%d;%dH"
fmt_sgr:        .string "\x1b[%dm"

app_title:      .string "TWO-SUM, TRACED"
app_sub:        .string "companion visualizer for two_sum.asm"

menu_title:     .string "MAIN MENU"
menu_opt_1:     .string "[1] Pick a preset array and target"
menu_opt_2:     .string "[2] Enter array manually"
menu_opt_3:     .string "[3] Set target"
menu_opt_4:     .string "[4] Set animation speed"
menu_opt_5:     .string "[5] Watch brute force    O(n^2)"
menu_opt_6:     .string "[6] Watch hash set       O(n)"
menu_opt_7:     .string "[7] Watch both, back to back"
menu_opt_0:     .string "[0] Exit"
menu_prompt:    .string "  choice: "

preset_title:   .string "PRESETS"
preset_1:       .string "[1] classic       arr=[2,7,11,15]         target=9"
preset_2:       .string "[2] negatives     arr=[-3,4,1,-1]          target=0"
preset_3:       .string "[3] duplicates    arr=[5,5]                target=10"
preset_4:       .string "[4] no pair       arr=[1,2,3,4,5]          target=100"
preset_5:       .string "[5] late match    arr=[3,3,4,7,1,8]        target=10"
preset_6:       .string "[6] collision     arr=[0,16,32,48,33]      target=49"
preset_0:       .string "[0] cancel"

// Each preset_table row is 24 bytes: 8-byte pointer to the array,
// 4-byte length, 4-byte target, 8 bytes of padding to keep the next
// row 8-aligned. The stride lets us index with one multiply.
preset_d1:      .word 2, 7, 11, 15
preset_d2:      .word -3, 4, 1, -1
preset_d3:      .word 5, 5
preset_d4:      .word 1, 2, 3, 4, 5
preset_d5:      .word 3, 3, 4, 7, 1, 8
preset_d6:      .word 0, 16, 32, 48, 33

        .balign 8
preset_table:
        .dword  preset_d1
        .word   4, 9
        .dword  0
        .dword  preset_d2
        .word   4, 0
        .dword  0
        .dword  preset_d3
        .word   2, 10
        .dword  0
        .dword  preset_d4
        .word   5, 100
        .dword  0
        .dword  preset_d5
        .word   6, 10
        .dword  0
        .dword  preset_d6
        .word   5, 49
        .dword  0
define(PRESET_STRIDE, 24)

prompt_size:    .string "how many elements (1 to 10): "
prompt_elem:    .string "arr[%d] = "
prompt_target:  .string "target sum (-9999 to 9999): "
prompt_speed:   .string "animation delay in ms (100 to 3000): "
prompt_cont:    .string "  press enter to continue . . ."
hint_values:    .string "values run from -99 to 999, which is what the cells have room for."

msg_need_arr:   .string "set an array first.  menu option [1] or [2]."
msg_need_tgt:   .string "set a target first.  menu option [1] or [3]."
msg_saved:      .string "saved."
msg_bye:        .string "bye."

// Shown on the notice row when an answer is rejected. Both name the
// cause and the range, so the fix is on screen with the complaint.
err_not_int:    .string "that is not a whole number.  enter a value from %d to %d."
err_range:      .string "%d is out of range.  enter a value from %d to %d."

phase_brute:    .string "BRUTE FORCE     check every pair (i, j) with i < j"
phase_hash:     .string "HASH SET        for each i, look up target - arr[i]"

sec_array:      .string "─── ARRAY ────────────────────────────────────────────────────────────"
sec_hash:       .string "─── HASH TABLE ─── 16 slots, start = val & 0x0F, linear probing ──────"
sec_trace:      .string "─── TRACE ────────────────────────────────────────────────────────────"
sec_stats:      .string "─── STATS ────────────────────────────────────────────────────────────"

narr_bf_start:  .string "starting sweep.  pair (i, j) walks every combination until sum == target."
narr_bf_check:  .string "i=%d  j=%d   arr[%d]+arr[%d] = %d + %d = %d   target = %d"
narr_bf_miss:   .string "                                                   miss.  advance j."
narr_bf_match:  .string "                                                   MATCH."
narr_bf_none:   .string "checked every pair.  no two elements sum to %d."
narr_bf_result: .string "result: arr[%d] (%d) + arr[%d] (%d) = %d.  comparisons: %d."

narr_hs_start:       .string "starting sweep.  for each arr[i], look up (target - arr[i]) in the table."
narr_hs_iter:        .string "i=%d   val = arr[%d] = %d   complement = target - val = %d"
narr_hs_probe_start: .string "look up %d.  initial slot = %d & 0x0F = %d."
narr_hs_probe_empty: .string "slot %d is empty.  complement is not in the table yet."
narr_hs_probe_hit:   .string "slot %d holds %d, from arr[%d].  that is our complement."
narr_hs_probe_coll:  .string "slot %d holds %d (not %d).  linear-probe to slot %d."
narr_hs_ins_start:   .string "insert %d.  initial slot = %d & 0x0F = %d."
narr_hs_insert:      .string "record (val=%d, idx=%d) at slot %d, then move on."
narr_hs_ins_dup:     .string "%d is already at slot %d, from arr[%d].  the first index stays."
narr_hs_none:        .string "walked every element.  no pair sums to %d."
narr_hs_result:      .string "result: arr[%d] (%d) + arr[%d] (%d) = %d.  probes: %d  inserts: %d."

stats_bf_fmt:   .string "comparisons: %-3d / %-3d  (max n*(n-1)/2)"
stats_hs_fmt:   .string "probes: %-4d   inserts: %-4d"

// State block on the main menu -- three lines (array, target, speed)
// instead of one cramped line. Shows the actual array values.
state_lbl_arr:  .string "array:   "
state_lbl_tgt:  .string "target:  "
state_lbl_spd:  .string "speed:   %d ms/frame"
state_unset:    .string "<unset>"
state_open:     .string "["
state_close:    .string "]"
state_comma:    .string ", "

// One-line hint shown on the main menu to orient newcomers.
menu_tip:       .string "tip: first time?  try [1] preset 1, then [7] to compare both algorithms."

// Right-side readout in the run-screen header.
run_target_fmt: .string "target = %d"

// Colour legends drawn once per run.  The SGR codes are embedded
// directly in the string so the word "yellow" literally renders in
// yellow, "cyan" in cyan, and so on -- self-demonstrating legend.
// Both start at column 4 and stay inside 80 columns, which is why
// the hash legend says "probe" rather than "probing".
legend_bf:      .string "\x1b[90mlegend:\x1b[0m  \x1b[33myellow\x1b[0m = i    \x1b[36mcyan\x1b[0m = j    \x1b[32mgreen\x1b[0m = match"
legend_hs:      .string "\x1b[90mlegend:\x1b[0m  \x1b[35mmagenta\x1b[0m = probe    \x1b[32mgreen\x1b[0m = hit    \x1b[31mred\x1b[0m = collision    \x1b[33myellow\x1b[0m = insert"

// Welcome splash shown once on startup.
splash_box_t:   .string "╭──────────────────────────────────╮"
splash_box_m:   .string "│         TWO-SUM, TRACED          │"
splash_box_b:   .string "╰──────────────────────────────────╯"
splash_l1:      .string "walk two-sum step by step in aarch64 assembly."
splash_l2:      .string "brute force O(n^2) and hash set O(n), side by side,"
splash_l3:      .string "with colour, carets, and a narration panel."
splash_l4:      .string "6 presets, manual input, adjustable speed.  MIT licensed."
splash_prmpt:   .string "press enter to begin . . ."

fmt_int:        .string "%d"
fmt_token:      .string "%15s"
fmt_idx_head:   .string " [%d] "
fmt_cell_val:   .string "[%3d]"
fmt_cell_empty: .string "[ . ]"
fmt_blank_80:   .string "                                                                                "
newline:        .string "\n"

caret_s:        .string "^"
lbl_i_s:        .string "i"
lbl_j_s:        .string "j"


// Program state. Menu, input handlers, and the two algorithm
// runners all read this directly out of memory rather than passing
// it around in registers.
        .bss
        .balign 4
n:              .skip 4
target:         .skip 4
target_set:     .skip 4
arr:            .skip ARRAY_MAX * 4
hash_vals:      .skip HASH_SIZE * 4
hash_idx:       .skip HASH_SIZE * 4
hash_used:      .skip HASH_SIZE
anim_delay:     .skip 4
tok_buf:        .skip 32

// Where the live prompt sits and what it says, so a rejected answer
// can wipe the line and ask again in the same place.
        .balign 8
prompt_str:     .skip 8
prompt_row:     .skip 4
prompt_col:     .skip 4
prompt_arg:     .skip 4


        .text
        .balign 4
        .global main


// main seeds the animation delay, clears the "array set" and "target
// set" flags, and drops into the menu loop. Each menu option is a
// short helper that returns here; the loop exits only when the user
// picks option 0.
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =anim_delay
        mov     w1, DEFAULT_DELAY
        str     w1, [x0]

        ldr     x0, =n
        str     wzr, [x0]

        ldr     x0, =target_set
        str     wzr, [x0]

        bl      draw_splash

main_loop:
        bl      draw_main_menu

        mov     w0, 0
        mov     w1, 7
        bl      read_int_range
        cbz     w1, main_exit               // stdin closed: leave the same
                                            // way option 0 does
        cmp     w0, 0
        b.eq    main_exit
        cmp     w0, 1
        b.eq    mm_preset
        cmp     w0, 2
        b.eq    mm_manual
        cmp     w0, 3
        b.eq    mm_tgt
        cmp     w0, 4
        b.eq    mm_speed
        cmp     w0, 5
        b.eq    mm_brute
        cmp     w0, 6
        b.eq    mm_hash
        cmp     w0, 7
        b.eq    mm_both
        b       main_loop

mm_preset:
        bl      set_from_preset
        b       main_loop
mm_manual:
        bl      set_from_manual
        b       main_loop
mm_tgt:
        bl      set_target_interactive
        b       main_loop
mm_speed:
        bl      set_speed
        b       main_loop
mm_brute:
        bl      ensure_ready
        cbz     w0, main_loop
        bl      run_brute_force
        b       main_loop
mm_hash:
        bl      ensure_ready
        cbz     w0, main_loop
        bl      run_hash_set
        b       main_loop
mm_both:
        bl      ensure_ready
        cbz     w0, main_loop
        bl      run_brute_force
        bl      run_hash_set
        b       main_loop

main_exit:
        bl      show_cursor_call
        bl      clear_screen
        ldr     x0, =msg_bye
        bl      printf
        ldr     x0, =newline
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret


// draw_splash paints a one-time welcome screen on startup: a boxed
// title, three lines of description, and a press-enter prompt.  It
// blocks on the user's keypress and returns so main_loop can take
// over.  Running it again would look fine, but we only call it
// once -- on menu returns the main menu stands on its own.
draw_splash:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      clear_screen
        bl      hide_cursor_call

        mov     w0, 6
        mov     w1, 22
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =splash_box_t
        bl      printf
        bl      reset_sgr

        mov     w0, 7
        mov     w1, 22
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =splash_box_m
        bl      printf
        bl      reset_sgr

        mov     w0, 8
        mov     w1, 22
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =splash_box_b
        bl      printf
        bl      reset_sgr

        mov     w0, 11
        mov     w1, 14
        bl      move_cursor
        ldr     x0, =splash_l1
        bl      printf

        mov     w0, 12
        mov     w1, 14
        bl      move_cursor
        ldr     x0, =splash_l2
        bl      printf

        mov     w0, 13
        mov     w1, 14
        bl      move_cursor
        ldr     x0, =splash_l3
        bl      printf

        mov     w0, 15
        mov     w1, 14
        bl      move_cursor
        ldr     x0, =splash_l4
        bl      printf

        mov     w0, 19
        mov     w1, 26
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =splash_prmpt
        bl      printf
        bl      reset_sgr

        mov     x0, 0
        bl      fflush
        bl      clear_input_buffer

        ldp     fp, lr, [sp], 16
        ret


// draw_legend_bf and draw_legend_hs paint a one-line colour key at
// the bottom of a run screen.  The SGR codes that colour each word
// are baked into the string itself, so one printf renders the
// whole legend -- no per-word set_sgr / reset_sgr dance.
draw_legend_bf:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 24
        mov     w1, 4
        bl      move_cursor
        ldr     x0, =legend_bf
        bl      printf
        bl      reset_sgr
        ldp     fp, lr, [sp], 16
        ret


draw_legend_hs:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 24
        mov     w1, 4
        bl      move_cursor
        ldr     x0, =legend_hs
        bl      printf
        bl      reset_sgr
        ldp     fp, lr, [sp], 16
        ret


// draw_main_menu repaints the whole main menu: title header, eight
// numbered options, a state summary line, and the input prompt. The
// state line reads n, target, and delay straight from memory so it
// always reflects whatever the user last set.
draw_main_menu:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      clear_screen
        bl      draw_header

        mov     w0, 5
        mov     w1, 4
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =menu_title
        bl      printf
        bl      reset_sgr

        mov     w0, 7
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =menu_opt_1
        bl      printf
        mov     w0, 8
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =menu_opt_2
        bl      printf
        mov     w0, 9
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =menu_opt_3
        bl      printf
        mov     w0, 10
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =menu_opt_4
        bl      printf
        mov     w0, 11
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =menu_opt_5
        bl      printf
        mov     w0, 12
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =menu_opt_6
        bl      printf
        mov     w0, 13
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =menu_opt_7
        bl      printf
        mov     w0, 14
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =menu_opt_0
        bl      printf

        mov     w0, 16
        mov     w1, 4
        bl      move_cursor
        bl      draw_state_block

        // Onboarding tip, dim so it does not compete with the menu.
        mov     w0, 20
        mov     w1, 4
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =menu_tip
        bl      printf
        bl      reset_sgr

        mov     w0, STATUS_ROW
        mov     w1, 4
        ldr     x2, =menu_prompt
        mov     w3, 0
        bl      ask_prompt

        ldp     fp, lr, [sp], 16
        ret


// draw_header paints the title in yellow and subtitle in dim grey at
// the top of the screen.
draw_header:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w0, 2
        mov     w1, 4
        bl      move_cursor
        mov     w0, 33
        bl      set_sgr
        ldr     x0, =app_title
        bl      printf
        bl      reset_sgr

        mov     w0, 3
        mov     w1, 4
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =app_sub
        bl      printf
        bl      reset_sgr

        ldp     fp, lr, [sp], 16
        ret


// draw_state_block paints a three-line summary of current state at
// rows 16 / 17 / 18 -- array contents, target, animation speed.
// Everything is dim grey so the block reads as secondary info
// rather than competing with the menu options.  The array is
// printed element by element with commas so the user sees exactly
// what got loaded (from preset or manual entry).
draw_state_block:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp

        mov     w0, 90
        bl      set_sgr

        // Row 16: "array:   [v0, v1, ..., vN-1]" or "<unset>".
        mov     w0, 16
        mov     w1, 4
        bl      move_cursor
        ldr     x0, =state_lbl_arr
        bl      printf

        ldr     x9, =n
        ldr     w9, [x9]
        cbz     w9, dsb_arr_unset

        ldr     x0, =state_open
        bl      printf
        str     wzr, [fp, 16]
dsb_arr_loop:
        ldr     w9, [fp, 16]
        ldr     x10, =n
        ldr     w10, [x10]
        cmp     w9, w10
        b.ge    dsb_arr_done

        cbz     w9, dsb_arr_first
        ldr     x0, =state_comma
        bl      printf
dsb_arr_first:
        ldr     x0, =fmt_int
        ldr     x9, =arr
        ldr     w10, [fp, 16]
        ldr     w1, [x9, w10, SXTW #2]
        bl      printf

        ldr     w9, [fp, 16]
        add     w9, w9, 1
        str     w9, [fp, 16]
        b       dsb_arr_loop
dsb_arr_done:
        ldr     x0, =state_close
        bl      printf
        b       dsb_target
dsb_arr_unset:
        ldr     x0, =state_unset
        bl      printf

dsb_target:
        // Row 17: "target:  N" or "<unset>".
        mov     w0, 17
        mov     w1, 4
        bl      move_cursor
        ldr     x0, =state_lbl_tgt
        bl      printf
        ldr     x9, =target_set
        ldr     w9, [x9]
        cbz     w9, dsb_tgt_unset
        ldr     x0, =fmt_int
        ldr     x9, =target
        ldr     w1, [x9]
        bl      printf
        b       dsb_speed
dsb_tgt_unset:
        ldr     x0, =state_unset
        bl      printf

dsb_speed:
        // Row 18: "speed:   N ms/frame".
        mov     w0, 18
        mov     w1, 4
        bl      move_cursor
        ldr     x0, =state_lbl_spd
        ldr     x9, =anim_delay
        ldr     w1, [x9]
        bl      printf

        bl      reset_sgr
        ldp     fp, lr, [sp], 32
        ret


// set_from_preset shows six canned (array, target) pairs and copies
// the chosen one into shared state. Option 0 cancels.
set_from_preset:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      clear_screen
        bl      draw_header

        mov     w0, 5
        mov     w1, 4
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =preset_title
        bl      printf
        bl      reset_sgr

        mov     w0, 7
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =preset_1
        bl      printf
        mov     w0, 8
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =preset_2
        bl      printf
        mov     w0, 9
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =preset_3
        bl      printf
        mov     w0, 10
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =preset_4
        bl      printf
        mov     w0, 11
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =preset_5
        bl      printf
        mov     w0, 12
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =preset_6
        bl      printf
        mov     w0, 13
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =preset_0
        bl      printf

        mov     w0, 15
        mov     w1, 4
        ldr     x2, =menu_prompt
        mov     w3, 0
        bl      ask_prompt

        mov     w0, 0
        mov     w1, 6
        bl      read_int_range
        cbz     w1, sfp_cancel
        cbz     w0, sfp_cancel

        // Look up the chosen row: &preset_table + (choice - 1) * 24.
        // Each row holds (pointer, length, target), so we pass
        // &row[0], &row[8], &row[12] to apply_preset.
        sub     w0, w0, 1
        mov     w9, PRESET_STRIDE
        mul     w0, w0, w9
        ldr     x1, =preset_table
        add     x1, x1, w0, SXTW

        ldr     x0, [x1]
        add     x2, x1, 12
        add     x1, x1, 8
        bl      apply_preset
        bl      show_saved

sfp_cancel:
        ldp     fp, lr, [sp], 16
        ret


// apply_preset copies one preset into shared state. The copy loop
// has no bl call inside it, so scratch registers survive iteration
// to iteration without any spills.
//
// Input:  x0 = data pointer (length * 4 bytes)
//         x1 = &length
//         x2 = &target
apply_preset:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     w9, [x1]
        ldr     w10, [x2]

        ldr     x11, =n
        str     w9, [x11]
        ldr     x11, =target
        str     w10, [x11]
        ldr     x11, =target_set
        mov     w12, 1
        str     w12, [x11]

        ldr     x11, =arr
        mov     w12, 0
ap_loop:
        cmp     w12, w9
        b.ge    ap_done
        ldr     w13, [x0, w12, SXTW #2]
        str     w13, [x11, w12, SXTW #2]
        add     w12, w12, 1
        b       ap_loop
ap_done:
        ldp     fp, lr, [sp], 16
        ret


// set_from_manual asks for a size, then loops reading that many
// integers into arr[]. The size and index need to survive across
// printf and scanf calls in the loop, so we park them in the stack
// frame rather than using callee-saved registers.
//
// Each element gets its own row (7 upwards) so a rejected value can
// be re-asked in place without the screen sliding around.
set_from_manual:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp

        bl      clear_screen
        bl      draw_header

        mov     w0, 6
        mov     w1, 4
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =hint_values
        bl      printf
        bl      reset_sgr

        mov     w0, 5
        mov     w1, 4
        ldr     x2, =prompt_size
        mov     w3, 0
        bl      ask_prompt

        mov     w0, 1
        mov     w1, ARRAY_MAX
        bl      read_int_range
        cbz     w1, sfm_leave
        str     w0, [fp, 16]

        ldr     x9, =n
        str     w0, [x9]

        str     wzr, [fp, 20]
sfm_loop:
        ldr     w9, [fp, 20]
        ldr     w10, [fp, 16]
        cmp     w9, w10
        b.ge    sfm_done

        add     w0, w9, 7                   // one row per element
        mov     w1, 6
        ldr     x2, =prompt_elem
        mov     w3, w9
        bl      ask_prompt

        mov     w0, VALUE_MIN
        mov     w1, VALUE_MAX
        bl      read_int_range
        cbz     w1, sfm_leave

        ldr     x9, =arr
        ldr     w10, [fp, 20]
        str     w0, [x9, w10, SXTW #2]

        ldr     w9, [fp, 20]
        add     w9, w9, 1
        str     w9, [fp, 20]
        b       sfm_loop
sfm_done:
        bl      show_saved

sfm_leave:
        ldp     fp, lr, [sp], 32
        ret


// set_target_interactive reads one integer and stores it as the
// target. It also sets target_set so ensure_ready can tell the
// difference between "target is zero" and "target not yet set".
set_target_interactive:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      clear_screen
        bl      draw_header

        mov     w0, 5
        mov     w1, 4
        ldr     x2, =prompt_target
        mov     w3, 0
        bl      ask_prompt

        mov     w0, TARGET_MIN
        mov     w1, TARGET_MAX
        bl      read_int_range
        cbz     w1, sti_leave

        ldr     x9, =target
        str     w0, [x9]
        ldr     x9, =target_set
        mov     w10, 1
        str     w10, [x9]

        bl      show_saved

sti_leave:
        ldp     fp, lr, [sp], 16
        ret


// set_speed reads the per-frame animation delay. Lower is faster;
// 100 ms gives a brisk sweep, 2-3 seconds lets you pause and read.
set_speed:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      clear_screen
        bl      draw_header

        mov     w0, 5
        mov     w1, 4
        ldr     x2, =prompt_speed
        mov     w3, 0
        bl      ask_prompt

        mov     w0, 100
        mov     w1, 3000
        bl      read_int_range
        cbz     w1, ss_leave

        ldr     x1, =anim_delay
        str     w0, [x1]

        bl      show_saved

ss_leave:
        ldp     fp, lr, [sp], 16
        ret


// ensure_ready is the guard the menu runs before starting either
// algorithm. It returns w0 = 1 if the user has set both an array
// and a target, and w0 = 0 otherwise (after showing an error screen
// and waiting for enter).
ensure_ready:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =n
        ldr     w0, [x0]
        cbz     w0, er_no_arr

        ldr     x0, =target_set
        ldr     w0, [x0]
        cbz     w0, er_no_tgt

        mov     w0, 1
        b       er_done

er_no_arr:
        bl      clear_screen
        bl      draw_header
        mov     w0, 5
        mov     w1, 4
        bl      move_cursor
        mov     w0, 31
        bl      set_sgr
        ldr     x0, =msg_need_arr
        bl      printf
        bl      reset_sgr
        bl      wait_enter
        mov     w0, 0
        b       er_done

er_no_tgt:
        bl      clear_screen
        bl      draw_header
        mov     w0, 5
        mov     w1, 4
        bl      move_cursor
        mov     w0, 31
        bl      set_sgr
        ldr     x0, =msg_need_tgt
        bl      printf
        bl      reset_sgr
        bl      wait_enter
        mov     w0, 0

er_done:
        ldp     fp, lr, [sp], 16
        ret


// draw_array paints the array row, optional i/j pointer carets
// beneath it, and picks per-cell colours based on the mode. Rows
// 6-10 of the terminal are ours:
//   row 6   section label "ARRAY"
//   row 7   index row      " [0]  [1]  [2] ... "
//   row 8   value row      "[ 42][  7][ 11] ..."
//   row 9   caret row      "   ^          ^"
//   row 10  label row      "   i          j"
//
// Modes:
//   0  normal  -- cell i is yellow, cell j is cyan, carets rendered
//   1  match   -- both i and j are green, no carets
//   2  dim all -- every cell dimmed, used for the "no pair" state
//
// Rows 9 and 10 are blanked on every entry so carets from the
// previous frame do not linger when i / j advance.
//
// Params:
//   w0 = highlight_i (-1 for none)
//   w1 = highlight_j (-1 for none)
//   w2 = mode
draw_array:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     w0, [fp, 16]
        str     w1, [fp, 20]
        str     w2, [fp, 24]

        // Wipe the caret rows so old ^ / i / j characters are gone.
        mov     w0, 9
        mov     w1, 1
        bl      move_cursor
        ldr     x0, =fmt_blank_80
        bl      printf
        mov     w0, 10
        mov     w1, 1
        bl      move_cursor
        ldr     x0, =fmt_blank_80
        bl      printf

        // Section label.
        mov     w0, 6
        mov     w1, 4
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =sec_array
        bl      printf
        bl      reset_sgr

        // Index row.
        str     wzr, [fp, 28]
da_idx_loop:
        ldr     w9, [fp, 28]
        ldr     x10, =n
        ldr     w10, [x10]
        cmp     w9, w10
        b.ge    da_idx_done

        mov     w0, 7
        mov     w11, 6
        mul     w1, w9, w11
        add     w1, w1, 6
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =fmt_idx_head
        ldr     w1, [fp, 28]
        bl      printf
        bl      reset_sgr

        ldr     w9, [fp, 28]
        add     w9, w9, 1
        str     w9, [fp, 28]
        b       da_idx_loop
da_idx_done:

        // Value row.
        str     wzr, [fp, 28]
da_val_loop:
        ldr     w9, [fp, 28]
        ldr     x10, =n
        ldr     w10, [x10]
        cmp     w9, w10
        b.ge    da_val_done

        mov     w0, 8
        mov     w11, 6
        mul     w1, w9, w11
        add     w1, w1, 6
        bl      move_cursor

        ldr     w9, [fp, 28]
        ldr     w10, [fp, 24]
        cmp     w10, 2
        b.eq    da_val_dim

        ldr     w11, [fp, 16]
        cmp     w9, w11
        b.eq    da_val_hi_i

        ldr     w11, [fp, 20]
        cmp     w9, w11
        b.eq    da_val_hi_j
        b       da_val_plain

da_val_dim:
        mov     w0, 90
        bl      set_sgr
        b       da_val_print
da_val_hi_i:
        ldr     w10, [fp, 24]
        cmp     w10, 1
        b.eq    da_val_match
        mov     w0, 43
        bl      set_sgr
        mov     w0, 30
        bl      set_sgr
        b       da_val_print
da_val_hi_j:
        ldr     w10, [fp, 24]
        cmp     w10, 1
        b.eq    da_val_match
        mov     w0, 46
        bl      set_sgr
        mov     w0, 30
        bl      set_sgr
        b       da_val_print
da_val_match:
        mov     w0, 42
        bl      set_sgr
        mov     w0, 30
        bl      set_sgr
        b       da_val_print
da_val_plain:

da_val_print:
        ldr     x0, =fmt_cell_val
        ldr     x9, =arr
        ldr     w10, [fp, 28]
        ldr     w1, [x9, w10, SXTW #2]
        bl      printf
        bl      reset_sgr

        ldr     w9, [fp, 28]
        add     w9, w9, 1
        str     w9, [fp, 28]
        b       da_val_loop
da_val_done:

        // Carets and labels -- only in normal mode.
        ldr     w9, [fp, 24]
        cbnz    w9, da_ptr_skip

        ldr     w9, [fp, 16]
        cmp     w9, 0
        b.lt    da_ptr_j
        mov     w0, 9
        mov     w11, 6
        mul     w1, w9, w11
        add     w1, w1, 8
        bl      move_cursor
        mov     w0, 33
        bl      set_sgr
        ldr     x0, =caret_s
        bl      printf
        mov     w0, 10
        ldr     w9, [fp, 16]
        mov     w11, 6
        mul     w1, w9, w11
        add     w1, w1, 8
        bl      move_cursor
        ldr     x0, =lbl_i_s
        bl      printf
        bl      reset_sgr

da_ptr_j:
        ldr     w9, [fp, 20]
        cmp     w9, 0
        b.lt    da_ptr_skip
        mov     w0, 9
        mov     w11, 6
        mul     w1, w9, w11
        add     w1, w1, 8
        bl      move_cursor
        mov     w0, 36
        bl      set_sgr
        ldr     x0, =caret_s
        bl      printf
        mov     w0, 10
        ldr     w9, [fp, 20]
        mov     w11, 6
        mul     w1, w9, w11
        add     w1, w1, 8
        bl      move_cursor
        ldr     x0, =lbl_j_s
        bl      printf
        bl      reset_sgr

da_ptr_skip:
        ldp     fp, lr, [sp], 32
        ret


// draw_hash paints the 16-slot hash table as two rows of eight cells
// each. Rows 12-16 are ours:
//   row 12  section label "HASH TABLE ..."
//   row 13  slot labels 00-07
//   row 14  slot values  0-7
//   row 15  slot labels 08-15
//   row 16  slot values  8-15
//
// Empty slots show as "[ . ]" in dim grey. A highlighted slot gets
// a coloured background by state:
//   0 probing    (magenta)
//   1 hit        (green)
//   2 collision  (red)
//   3 inserted   (yellow)
//
// Params:
//   w0 = highlight_slot (-1 for none)
//   w1 = highlight_mode
draw_hash:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     w0, [fp, 16]
        str     w1, [fp, 20]

        mov     w0, 12
        mov     w1, 4
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =sec_hash
        bl      printf
        bl      reset_sgr

        str     wzr, [fp, 24]
dh_loop:
        ldr     w9, [fp, 24]
        cmp     w9, HASH_SIZE
        b.ge    dh_done

        // Label row for this slot: 13 if slot < 8, else 15.
        // Column: 6 + (slot mod 8) * 6.
        lsr     w10, w9, 3
        add     w10, w10, w10
        add     w11, w10, 13
        and     w12, w9, 7
        mov     w13, 6
        mul     w12, w12, w13
        add     w12, w12, 6

        mov     w0, w11
        mov     w1, w12
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =fmt_idx_head           // same shape as the array's
        ldr     w1, [fp, 24]                // index row, so a label never
        bl      printf                      // reads as a stored value
        bl      reset_sgr

        // Value row, one below the label row.
        ldr     w9, [fp, 24]
        lsr     w10, w9, 3
        add     w10, w10, w10
        add     w11, w10, 14
        and     w12, w9, 7
        mov     w13, 6
        mul     w12, w12, w13
        add     w12, w12, 6

        mov     w0, w11
        mov     w1, w12
        bl      move_cursor

        // Colour pick: is this slot the highlighted one?
        ldr     w9, [fp, 24]
        ldr     w10, [fp, 16]
        cmp     w9, w10
        b.ne    dh_plain

        ldr     w10, [fp, 20]
        cmp     w10, 0
        b.eq    dh_col_probing
        cmp     w10, 1
        b.eq    dh_col_hit
        cmp     w10, 2
        b.eq    dh_col_coll
        cmp     w10, 3
        b.eq    dh_col_ins
        b       dh_plain

dh_col_probing:
        mov     w0, 45
        bl      set_sgr
        mov     w0, 30
        bl      set_sgr
        b       dh_draw_value
dh_col_hit:
        mov     w0, 42
        bl      set_sgr
        mov     w0, 30
        bl      set_sgr
        b       dh_draw_value
dh_col_coll:
        mov     w0, 41
        bl      set_sgr
        mov     w0, 30
        bl      set_sgr
        b       dh_draw_value
dh_col_ins:
        mov     w0, 43
        bl      set_sgr
        mov     w0, 30
        bl      set_sgr
        b       dh_draw_value

dh_plain:
        ldr     w9, [fp, 24]
        ldr     x10, =hash_used
        ldrb    w10, [x10, w9, UXTW]
        cbnz    w10, dh_draw_value
        mov     w0, 90
        bl      set_sgr

dh_draw_value:
        ldr     w9, [fp, 24]
        ldr     x10, =hash_used
        ldrb    w10, [x10, w9, UXTW]
        cbz     w10, dh_empty_cell

        ldr     x0, =fmt_cell_val
        ldr     x10, =hash_vals
        ldr     w9, [fp, 24]
        ldr     w1, [x10, w9, UXTW #2]
        bl      printf
        b       dh_advance

dh_empty_cell:
        ldr     x0, =fmt_cell_empty
        bl      printf

dh_advance:
        bl      reset_sgr
        ldr     w9, [fp, 24]
        add     w9, w9, 1
        str     w9, [fp, 24]
        b       dh_loop
dh_done:
        ldp     fp, lr, [sp], 32
        ret


// clear_trace_area draws the "TRACE" header on row 18 and blanks the
// two narration rows below it (19, 20). Called before each frame's
// narration is printed so that previous text is wiped first.
clear_trace_area:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp

        mov     w0, 18
        mov     w1, 4
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =sec_trace
        bl      printf
        bl      reset_sgr

        mov     w9, 19
        str     w9, [fp, 16]
cta_loop:
        ldr     w9, [fp, 16]
        mov     w0, w9
        mov     w1, 1
        bl      move_cursor
        ldr     x0, =fmt_blank_80
        bl      printf
        ldr     w9, [fp, 16]
        add     w9, w9, 1
        str     w9, [fp, 16]
        cmp     w9, 21
        b.lt    cta_loop

        ldp     fp, lr, [sp], 32
        ret


// draw_stats paints the STATS panel on rows 22 and 23: a dim header
// and one line of counters. Brute force shows one counter, hash set
// shows two.
//
// Params:
//   w0 = mode    (0 = brute force, 1 = hash set)
//   w1 = stat_a  (comparisons for BF, probes for HS)
//   w2 = stat_b  (inserts for HS, unused for BF)
draw_stats:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     w0, [fp, 16]
        str     w1, [fp, 20]
        str     w2, [fp, 24]

        mov     w0, 22
        mov     w1, 4
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =sec_stats
        bl      printf
        bl      reset_sgr

        mov     w0, 23
        mov     w1, 1
        bl      move_cursor
        ldr     x0, =fmt_blank_80
        bl      printf

        mov     w0, 23
        mov     w1, 6
        bl      move_cursor

        ldr     w9, [fp, 16]
        cbnz    w9, ds_hs

        ldr     x0, =stats_bf_fmt
        ldr     w1, [fp, 20]
        ldr     w2, [fp, 24]
        bl      printf
        b       ds_done
ds_hs:
        ldr     x0, =stats_hs_fmt
        ldr     w1, [fp, 20]
        ldr     w2, [fp, 24]
        bl      printf
ds_done:
        ldp     fp, lr, [sp], 32
        ret


// run_brute_force drives the O(n^2) walk. It loops over every pair
// (i, j) with i < j and paints a frame for each comparison: array
// with i in yellow and j in cyan, narration below, a running
// counter in the STATS panel. On a match we paint both cells green
// and wait for enter; running off the end lands on the "no pair"
// screen instead.
//
// Register usage:
//   x19  arr base
//   w20  n
//   w21  target
//   w22  comparisons counter
//   w23  i
//   w24  j
//   w28  max pairs = n*(n-1)/2, printed next to the live counter
run_brute_force:
        stp     fp, lr, [sp, -80]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        stp     x23, x24, [sp, 48]
        stp     x27, x28, [sp, 64]

        bl      hide_cursor_call
        bl      clear_screen
        bl      draw_header

        mov     w0, 5
        mov     w1, 4
        bl      move_cursor
        mov     w0, 33
        bl      set_sgr
        ldr     x0, =phase_brute
        bl      printf
        bl      reset_sgr

        ldr     x19, =arr
        ldr     x9, =n
        ldr     w20, [x9]
        ldr     x9, =target
        ldr     w21, [x9]
        mov     w22, 0
        mov     w23, 0
        mov     w24, 0

        // Target readout on the right of the phase row.
        mov     w0, 5
        mov     w1, 62
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =run_target_fmt
        mov     w1, w21
        bl      printf
        bl      reset_sgr

        // max = n*(n-1)/2 for the STATS readout.  Computed once and
        // stashed in w28 because scratch regs get clobbered by the
        // draw helpers below.
        sub     w9, w20, 1
        mul     w28, w20, w9
        lsr     w28, w28, 1

        bl      draw_legend_bf

        // Intro frame: array with no highlights, intro narration.
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =narr_bf_start
        bl      printf

        mov     w0, -1
        mov     w1, -1
        mov     w2, 0
        bl      draw_array
        mov     w0, 0
        mov     w1, w22
        mov     w2, w28
        bl      draw_stats
        bl      frame_flush_delay

bf_outer:
        sub     w9, w20, 1
        cmp     w23, w9
        b.ge    bf_none

        add     w24, w23, 1

bf_inner:
        cmp     w24, w20
        b.ge    bf_next_i

        add     w22, w22, 1

        // Narration frame. The format string has eight %d slots:
        // i, j, i, j, a, b, sum, target. The AArch64 variadic ABI
        // puts the first seven int args in w1-w7 and the eighth on
        // the stack, so we shove target onto [sp] and keep the rest
        // in registers.
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor

        ldr     w9,  [x19, w23, SXTW #2]
        ldr     w10, [x19, w24, SXTW #2]
        add     w11, w9, w10
        sub     sp, sp, 16
        str     w21, [sp]
        mov     w1, w23
        mov     w2, w24
        mov     w3, w23
        mov     w4, w24
        mov     w5, w9
        mov     w6, w10
        mov     w7, w11
        ldr     x0, =narr_bf_check
        bl      printf
        add     sp, sp, 16

        mov     w0, w23
        mov     w1, w24
        mov     w2, 0
        bl      draw_array
        mov     w0, 0
        mov     w1, w22
        mov     w2, w28
        bl      draw_stats

        // Miss vs match. The helpers clobbered scratch regs, so
        // reload arr[i], arr[j], and re-add before comparing.
        ldr     w9,  [x19, w23, SXTW #2]
        ldr     w10, [x19, w24, SXTW #2]
        add     w11, w9, w10
        cmp     w11, w21
        b.eq    bf_match

        mov     w0, 20
        mov     w1, 6
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =narr_bf_miss
        bl      printf
        bl      reset_sgr
        bl      frame_flush_delay

        add     w24, w24, 1
        b       bf_inner

bf_next_i:
        add     w23, w23, 1
        b       bf_outer

bf_match:
        mov     w0, 20
        mov     w1, 6
        bl      move_cursor
        mov     w0, 32
        bl      set_sgr
        ldr     x0, =narr_bf_match
        bl      printf
        bl      reset_sgr
        bl      frame_flush_delay

        // Final result screen: both cells green, result line green.
        // narr_bf_result has six %d args, all fit in w1-w6.
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        mov     w0, 32
        bl      set_sgr
        ldr     w9,  [x19, w23, SXTW #2]
        ldr     w10, [x19, w24, SXTW #2]
        mov     w1, w23
        mov     w2, w9
        mov     w3, w24
        mov     w4, w10
        mov     w5, w21
        mov     w6, w22
        ldr     x0, =narr_bf_result
        bl      printf
        bl      reset_sgr

        mov     w0, w23
        mov     w1, w24
        mov     w2, 1
        bl      draw_array
        mov     w0, 0
        mov     w1, w22
        mov     w2, w28
        bl      draw_stats
        bl      frame_wait_then_return
        b       bf_end

bf_none:
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        mov     w0, 31
        bl      set_sgr
        mov     w1, w21
        ldr     x0, =narr_bf_none
        bl      printf
        bl      reset_sgr

        mov     w0, -1
        mov     w1, -1
        mov     w2, 2
        bl      draw_array
        mov     w0, 0
        mov     w1, w22
        mov     w2, w28
        bl      draw_stats
        bl      frame_wait_then_return

bf_end:
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     x23, x24, [sp, 48]
        ldp     x27, x28, [sp, 64]
        ldp     fp, lr, [sp], 80
        ret


// run_hash_set drives the O(n) walk. For each arr[i] it announces
// the iteration, computes the complement, probes the table for it,
// and either reports a match or inserts (val, i) so later indices
// can find it. Every probe paints a frame: magenta while probing,
// red on collision, green on a hit, yellow when a fresh insert
// happens.
//
// Register usage:
//   x19  arr base
//   w20  n
//   w21  target
//   w22  probes counter
//   w23  inserts counter
//   w24  i
//   w25  val = arr[i]
//   w26  complement = target - val
//   w27  current probe slot
//   w28  found slot (on hit) / insertion slot (on insert)
run_hash_set:
        stp     fp, lr, [sp, -96]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        stp     x23, x24, [sp, 48]
        stp     x25, x26, [sp, 64]
        stp     x27, x28, [sp, 80]

        bl      hide_cursor_call
        bl      clear_screen
        bl      draw_header

        mov     w0, 5
        mov     w1, 4
        bl      move_cursor
        mov     w0, 33
        bl      set_sgr
        ldr     x0, =phase_hash
        bl      printf
        bl      reset_sgr

        // Wipe the occupancy map so a second run does not start
        // with stale slots from the first.
        ldr     x9, =hash_used
        mov     w10, 0
rh_reset:
        strb    wzr, [x9, w10, UXTW]
        add     w10, w10, 1
        cmp     w10, HASH_SIZE
        b.lt    rh_reset

        ldr     x19, =arr
        ldr     x9, =n
        ldr     w20, [x9]
        ldr     x9, =target
        ldr     w21, [x9]
        mov     w22, 0
        mov     w23, 0
        mov     w24, 0

        // Target readout on the right of the phase row.
        mov     w0, 5
        mov     w1, 62
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =run_target_fmt
        mov     w1, w21
        bl      printf
        bl      reset_sgr

        bl      draw_legend_hs

        // Intro frame.
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =narr_hs_start
        bl      printf

        mov     w0, -1
        mov     w1, -1
        mov     w2, 0
        bl      draw_array
        mov     w0, -1
        mov     w1, 0
        bl      draw_hash
        mov     w0, 1
        mov     w1, w22
        mov     w2, w23
        bl      draw_stats
        bl      frame_flush_delay

hs_outer:
        cmp     w24, w20
        b.ge    hs_none

        ldr     w25, [x19, w24, SXTW #2]
        sub     w26, w21, w25

        // Start-of-iteration frame: just i highlighted, no slot yet.
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        mov     w1, w24
        mov     w2, w24
        mov     w3, w25
        mov     w4, w26
        ldr     x0, =narr_hs_iter
        bl      printf

        mov     w0, w24
        mov     w1, -1
        mov     w2, 0
        bl      draw_array
        mov     w0, -1
        mov     w1, 0
        bl      draw_hash
        mov     w0, 1
        mov     w1, w22
        mov     w2, w23
        bl      draw_stats
        bl      frame_flush_delay

        // Announce the initial probe slot.
        and     w27, w26, HASH_MASK
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        mov     w1, w26
        mov     w2, w26
        mov     w3, w27
        ldr     x0, =narr_hs_probe_start
        bl      printf

        mov     w0, w24
        mov     w1, -1
        mov     w2, 0
        bl      draw_array
        mov     w0, w27
        mov     w1, 0
        bl      draw_hash
        mov     w0, 1
        mov     w1, w22
        mov     w2, w23
        bl      draw_stats
        bl      frame_flush_delay

hs_probe_loop:
        add     w22, w22, 1

        ldr     x9, =hash_used
        ldrb    w10, [x9, w27, UXTW]
        cbz     w10, hs_probe_empty

        ldr     x9, =hash_vals
        ldr     w10, [x9, w27, UXTW #2]
        cmp     w10, w26
        b.eq    hs_probe_hit

        // Collision: announce, advance, frame.
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor

        ldr     x9, =hash_vals
        ldr     w10, [x9, w27, UXTW #2]
        add     w11, w27, 1
        and     w11, w11, HASH_MASK
        mov     w1, w27
        mov     w2, w10
        mov     w3, w26
        mov     w4, w11
        ldr     x0, =narr_hs_probe_coll
        bl      printf

        mov     w0, w24
        mov     w1, -1
        mov     w2, 0
        bl      draw_array
        mov     w0, w27
        mov     w1, 2
        bl      draw_hash
        mov     w0, 1
        mov     w1, w22
        mov     w2, w23
        bl      draw_stats
        bl      frame_flush_delay

        add     w27, w27, 1
        and     w27, w27, HASH_MASK
        b       hs_probe_loop

hs_probe_empty:
        // Complement is not in the table. Announce, insert val.
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        mov     w1, w27
        ldr     x0, =narr_hs_probe_empty
        bl      printf
        bl      reset_sgr

        mov     w0, w24
        mov     w1, -1
        mov     w2, 0
        bl      draw_array
        mov     w0, w27
        mov     w1, 0
        bl      draw_hash
        mov     w0, 1
        mov     w1, w22
        mov     w2, w23
        bl      draw_stats
        bl      frame_flush_delay

        // Now find where val itself belongs. This walk gets the same
        // frame-per-slot treatment as the lookup above, and each slot
        // it steps over counts as a probe, so the collision chain the
        // insert pays for is visible instead of happening off screen.
        and     w28, w25, HASH_MASK
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        mov     w1, w25
        mov     w2, w25
        mov     w3, w28
        ldr     x0, =narr_hs_ins_start
        bl      printf

        mov     w0, w24
        mov     w1, -1
        mov     w2, 0
        bl      draw_array
        mov     w0, w28
        mov     w1, 0
        bl      draw_hash
        mov     w0, 1
        mov     w1, w22
        mov     w2, w23
        bl      draw_stats
        bl      frame_flush_delay

rh_ins_scan:
        add     w22, w22, 1

        ldr     x9, =hash_used
        ldrb    w10, [x9, w28, UXTW]
        cbz     w10, rh_ins_place

        ldr     x9, =hash_vals
        ldr     w10, [x9, w28, UXTW #2]
        cmp     w10, w25
        b.eq    rh_ins_dup

        // Somebody else is here: announce, advance, frame.
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor

        ldr     x9, =hash_vals
        ldr     w10, [x9, w28, UXTW #2]
        add     w11, w28, 1
        and     w11, w11, HASH_MASK
        mov     w1, w28
        mov     w2, w10
        mov     w3, w25
        mov     w4, w11
        ldr     x0, =narr_hs_probe_coll
        bl      printf

        mov     w0, w24
        mov     w1, -1
        mov     w2, 0
        bl      draw_array
        mov     w0, w28
        mov     w1, 2
        bl      draw_hash
        mov     w0, 1
        mov     w1, w22
        mov     w2, w23
        bl      draw_stats
        bl      frame_flush_delay

        add     w28, w28, 1
        and     w28, w28, HASH_MASK
        b       rh_ins_scan

rh_ins_dup:
        // val is already in the table from an earlier index. Leave
        // that entry alone: a later lookup should report where the
        // value first appeared, which is also what two_sum.asm does.
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        ldr     x9, =hash_idx
        ldr     w10, [x9, w28, UXTW #2]
        mov     w1, w25
        mov     w2, w28
        mov     w3, w10
        ldr     x0, =narr_hs_ins_dup
        bl      printf

        mov     w0, w24
        mov     w1, -1
        mov     w2, 0
        bl      draw_array
        mov     w0, w28
        mov     w1, 1
        bl      draw_hash
        mov     w0, 1
        mov     w1, w22
        mov     w2, w23
        bl      draw_stats
        bl      frame_flush_delay

        add     w24, w24, 1
        b       hs_outer

rh_ins_place:
        ldr     x9, =hash_vals
        str     w25, [x9, w28, UXTW #2]
        ldr     x9, =hash_idx
        str     w24, [x9, w28, UXTW #2]
        ldr     x9, =hash_used
        mov     w10, 1
        strb    w10, [x9, w28, UXTW]
        add     w23, w23, 1

        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        mov     w1, w25
        mov     w2, w24
        mov     w3, w28
        ldr     x0, =narr_hs_insert
        bl      printf

        mov     w0, w24
        mov     w1, -1
        mov     w2, 0
        bl      draw_array
        mov     w0, w28
        mov     w1, 3
        bl      draw_hash
        mov     w0, 1
        mov     w1, w22
        mov     w2, w23
        bl      draw_stats
        bl      frame_flush_delay

        add     w24, w24, 1
        b       hs_outer

hs_probe_hit:
        // Pair found. Look up the earlier index (j).
        ldr     x9, =hash_idx
        ldr     w28, [x9, w27, UXTW #2]

        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        mov     w0, 32
        bl      set_sgr
        mov     w1, w27
        mov     w2, w26
        mov     w3, w28
        ldr     x0, =narr_hs_probe_hit
        bl      printf
        bl      reset_sgr

        mov     w0, w28
        mov     w1, w24
        mov     w2, 1
        bl      draw_array
        mov     w0, w27
        mov     w1, 1
        bl      draw_hash
        mov     w0, 1
        mov     w1, w22
        mov     w2, w23
        bl      draw_stats
        bl      frame_flush_delay

        // Final result line. narr_hs_result has seven %d args,
        // all fit in w1-w7.
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        mov     w0, 32
        bl      set_sgr

        mov     w1, w28
        mov     w2, w26
        mov     w3, w24
        mov     w4, w25
        mov     w5, w21
        mov     w6, w22
        mov     w7, w23
        ldr     x0, =narr_hs_result
        bl      printf
        bl      reset_sgr
        bl      frame_wait_then_return
        b       hs_end

hs_none:
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        mov     w0, 31
        bl      set_sgr
        mov     w1, w21
        ldr     x0, =narr_hs_none
        bl      printf
        bl      reset_sgr

        mov     w0, -1
        mov     w1, -1
        mov     w2, 2
        bl      draw_array
        mov     w0, -1
        mov     w1, 0
        bl      draw_hash
        mov     w0, 1
        mov     w1, w22
        mov     w2, w23
        bl      draw_stats
        bl      frame_wait_then_return

hs_end:
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     x23, x24, [sp, 48]
        ldp     x25, x26, [sp, 64]
        ldp     x27, x28, [sp, 80]
        ldp     fp, lr, [sp], 96
        ret


// frame_flush_delay pushes pending output to the terminal and then
// sleeps for the current animation delay. Called once per animation
// frame.
frame_flush_delay:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x0, 0
        bl      fflush
        ldr     x0, =anim_delay
        ldr     w0, [x0]
        bl      delay_ms
        ldp     fp, lr, [sp], 16
        ret


// frame_wait_then_return prints the "press enter" prompt at row 25
// and blocks until the user hits enter. Used at the end of each run
// so the final frame is visible before the main menu takes over.
frame_wait_then_return:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 25
        mov     w1, 4
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =prompt_cont
        bl      printf
        bl      reset_sgr
        mov     x0, 0
        bl      fflush
        bl      clear_input_buffer
        bl      getchar
        ldp     fp, lr, [sp], 16
        ret


// clear_screen clears the terminal and moves the cursor to row 1,
// column 1.
clear_screen:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =seq_clear
        bl      printf
        ldp     fp, lr, [sp], 16
        ret


// hide_cursor_call sends the DECTCEM hide sequence so the cursor
// does not blink over the animation.
hide_cursor_call:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =seq_hide
        bl      printf
        ldp     fp, lr, [sp], 16
        ret


// show_cursor_call re-enables the cursor so input prompts are
// obvious and the terminal is left in a sane state on exit.
show_cursor_call:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =seq_show
        bl      printf
        ldp     fp, lr, [sp], 16
        ret


// move_cursor positions the cursor at (row, col) using a CSI H
// escape. Rows and columns are 1-indexed, matching the terminal's
// own conventions.
//
// Input:  w0 = row, w1 = col
move_cursor:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w2, w1
        mov     w1, w0
        ldr     x0, =fmt_move
        bl      printf
        ldp     fp, lr, [sp], 16
        ret


// set_sgr sends one SGR (Select Graphic Rendition) code. Used for
// setting foreground/background colours and text attributes.
//
// Input:  w0 = SGR code (30-37 fg, 40-47 bg, 90-97 bright, etc.)
set_sgr:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w1, w0
        ldr     x0, =fmt_sgr
        bl      printf
        ldp     fp, lr, [sp], 16
        ret


// reset_sgr clears every text attribute back to the terminal default.
reset_sgr:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =seq_reset
        bl      printf
        ldp     fp, lr, [sp], 16
        ret


// delay_ms sleeps for the given number of milliseconds by calling
// usleep, which takes microseconds.
//
// Input:  w0 = milliseconds
delay_ms:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w1, 1000
        mul     w0, w0, w1
        bl      usleep
        ldp     fp, lr, [sp], 16
        ret


// ask_prompt paints a prompt and remembers where it sits, so a
// rejected answer can wipe the line and ask again in the same place
// instead of letting the screen scroll away underneath the frame.
//
// Input:  w0 = row, w1 = col, x2 = prompt string, w3 = printf argument
ask_prompt:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =prompt_row
        str     w0, [x9]
        ldr     x9, =prompt_col
        str     w1, [x9]
        ldr     x9, =prompt_str
        str     x2, [x9]
        ldr     x9, =prompt_arg
        str     w3, [x9]
        bl      repaint_prompt
        ldp     fp, lr, [sp], 16
        ret


// repaint_prompt blanks the prompt row and draws the staged prompt
// again, leaving the cursor after it and visible.
repaint_prompt:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =prompt_row
        ldr     w0, [x9]
        mov     w1, 1
        bl      move_cursor
        ldr     x0, =fmt_blank_80
        bl      printf

        ldr     x9, =prompt_row
        ldr     w0, [x9]
        ldr     x9, =prompt_col
        ldr     w1, [x9]
        bl      move_cursor
        ldr     x9, =prompt_str
        ldr     x0, [x9]
        ldr     x9, =prompt_arg
        ldr     w1, [x9]
        bl      printf

        bl      show_cursor_call
        mov     x0, 0
        bl      fflush

        ldp     fp, lr, [sp], 16
        ret


// clear_notice wipes the notice row. Called once an answer is
// accepted so a stale complaint never outlives the thing it was
// complaining about.
clear_notice:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, NOTICE_ROW
        mov     w1, 1
        bl      move_cursor
        ldr     x0, =fmt_blank_80
        bl      printf
        ldp     fp, lr, [sp], 16
        ret


// show_notice paints one red line on the notice row saying why the
// last answer was rejected. The arguments go to the stack first
// because move_cursor needs w0-w2 for itself.
//
// Input:  x0 = format, w1 / w2 / w3 = its arguments
show_notice:
        stp     fp, lr, [sp, -48]!
        mov     fp, sp
        str     x0, [fp, 16]
        str     w1, [fp, 24]
        str     w2, [fp, 28]
        str     w3, [fp, 32]

        bl      clear_notice
        mov     w0, NOTICE_ROW
        mov     w1, 4
        bl      move_cursor
        mov     w0, 31
        bl      set_sgr
        ldr     x0, [fp, 16]
        ldr     w1, [fp, 24]
        ldr     w2, [fp, 28]
        ldr     w3, [fp, 32]
        bl      printf
        bl      reset_sgr

        ldp     fp, lr, [sp], 48
        ret


// show_saved confirms that an input screen took what was typed, then
// waits. Every screen puts it on the same row, right above the
// continue prompt, so the confirmation is always in one place.
show_saved:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      hide_cursor_call
        mov     w0, STATUS_ROW
        mov     w1, 4
        bl      move_cursor
        mov     w0, 32
        bl      set_sgr
        ldr     x0, =msg_saved
        bl      printf
        bl      reset_sgr
        bl      wait_enter
        ldp     fp, lr, [sp], 16
        ret


// read_token reads one whitespace-delimited token into tok_buf. The
// width in the format string keeps a long line from running past the
// end of the buffer, and reading a token rather than a number means
// junk gets consumed instead of jamming every later read.
//
// Output: w0 = 1 when a token arrived, 0 at end of input
read_token:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =fmt_token
        ldr     x1, =tok_buf
        bl      scanf
        cmp     w0, 1
        b.eq    rt_ok
        mov     w0, 0
        b       rt_done
rt_ok:
        mov     w0, 1
rt_done:
        ldp     fp, lr, [sp], 16
        ret


// parse_int converts the token sitting in tok_buf to an integer. A
// leading sign is allowed, everything after it has to be a digit,
// and the digit count is capped so the value stays well inside the
// 32-bit range. Leaf function, no calls, so it needs no frame.
//
// Output: w0 = value
//         w1 = 1 when the token was a whole number, 0 otherwise
parse_int:
        ldr     x9, =tok_buf
        ldrb    w10, [x9]
        mov     w11, 0                      // 1 once we have seen a -
        cmp     w10, '-'
        b.ne    pi_plus
        mov     w11, 1
        add     x9, x9, 1
        b       pi_digits
pi_plus:
        cmp     w10, '+'
        b.ne    pi_digits
        add     x9, x9, 1

pi_digits:
        mov     w12, 0                      // value so far
        mov     w13, 0                      // digits seen
pi_loop:
        ldrb    w10, [x9]
        cbz     w10, pi_end
        cmp     w10, '0'
        b.lt    pi_bad
        cmp     w10, '9'
        b.gt    pi_bad
        sub     w10, w10, '0'
        mov     w14, 10
        mul     w12, w12, w14
        add     w12, w12, w10
        add     w13, w13, 1
        cmp     w13, DIGIT_MAX
        b.gt    pi_bad
        add     x9, x9, 1
        b       pi_loop

pi_end:
        cbz     w13, pi_bad                 // a lone sign is not a number
        cbz     w11, pi_pos
        sub     w12, wzr, w12
pi_pos:
        mov     w0, w12
        mov     w1, 1
        ret

pi_bad:
        mov     w0, 0
        mov     w1, 0
        ret


// read_int_range asks the staged prompt until the answer is a whole
// number inside the inclusive [min, max] range. Junk and out-of-range
// numbers each get their own line on the notice row and the prompt
// comes back; running out of input is reported to the caller instead
// of looping on a read that can never succeed again.
//
// Input:  w0 = min, w1 = max
// Output: w0 = validated integer
//         w1 = 1 when the value is good, 0 when stdin ran out
read_int_range:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     w0, [fp, 16]
        str     w1, [fp, 20]
rir_try:
        bl      read_token
        cbz     w0, rir_eof

        bl      parse_int
        cbz     w1, rir_not_int
        str     w0, [fp, 24]

        ldr     w9, [fp, 16]
        cmp     w0, w9
        b.lt    rir_out
        ldr     w9, [fp, 20]
        cmp     w0, w9
        b.gt    rir_out

        bl      clear_notice
        ldr     w0, [fp, 24]
        mov     w1, 1
        b       rir_done

rir_not_int:
        ldr     x0, =err_not_int
        ldr     w1, [fp, 16]
        ldr     w2, [fp, 20]
        mov     w3, 0
        bl      show_notice
        bl      repaint_prompt
        b       rir_try

rir_out:
        ldr     x0, =err_range
        ldr     w1, [fp, 24]
        ldr     w2, [fp, 16]
        ldr     w3, [fp, 20]
        bl      show_notice
        bl      repaint_prompt
        b       rir_try

rir_eof:
        mov     w0, 0
        mov     w1, 0

rir_done:
        ldp     fp, lr, [sp], 32
        ret


// clear_input_buffer drains getchar until a newline or EOF. Used
// after scanf so the next getchar or scanf starts on a fresh line.
clear_input_buffer:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
cib_loop:
        bl      getchar
        cmp     w0, '\n'
        b.eq    cib_done
        cmp     w0, -1
        b.ne    cib_loop
cib_done:
        ldp     fp, lr, [sp], 16
        ret


// wait_enter prints the "press enter" prompt at row 23 and blocks
// until the user hits enter. Used after the input-handler screens.
wait_enter:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 23
        mov     w1, 4
        bl      move_cursor
        mov     w0, 90
        bl      set_sgr
        ldr     x0, =prompt_cont
        bl      printf
        bl      reset_sgr
        mov     x0, 0
        bl      fflush
        bl      clear_input_buffer
        bl      getchar
        ldp     fp, lr, [sp], 16
        ret
