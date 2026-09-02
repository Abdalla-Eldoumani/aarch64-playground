// two_sum_viz.asm solves the two-sum problem in ARMv8 AArch64 assembly:
// an animated visualizer, and the same two algorithms as plain text.
// Project: https://github.com/Abdalla-Eldoumani/twosum-arm
//
// make cross && qemu-aarch64-static ./two_sum_viz            visualizer
//               qemu-aarch64-static ./two_sum_viz console    plain text
// In the playground, assemble and run with the args line "./two-sum",
// or "./two-sum console" for the plain text path.
// Menu: enter clears the splash, then 1 preset, 2 array, 3 target,
// 4 speed, 5 brute force, 6 hash set, 7 both, 0 quits.

define(fp, x29)
define(lr, x30)

define(ARRAY_MAX, 10)
define(HASH_SIZE, 16)
define(HASH_MASK, 0x0F)
define(DEFAULT_DELAY, 700)

// Colour roles, numbered the way the sibling project numbers them
// (github.com/Abdalla-Eldoumani/dsav). Drawing code asks for a role,
// never for a colour, so the whole program restyles from one table.
define(UI_ROLE_TEXT, 0)
define(UI_ROLE_DIM, 1)
define(UI_ROLE_FAINT, 2)
define(UI_ROLE_ACCENT, 3)
define(UI_ROLE_KEY, 4)
define(UI_ROLE_OK, 5)
define(UI_ROLE_WARN, 6)
define(UI_ROLE_HOT, 7)
define(UI_ROLE_BAD, 8)
define(UI_ROLE_NODE, 9)

// The canvas is a fixed 80x25: the frame is rows 1 and 25, the title
// bar row 2, rules on rows 3 and 21, the standing line row 22, the
// message row 23 that a rejected answer lands on, and the press-enter
// prompt row 24. Screens own rows 4-20.
define(TITLE_ROW, 2)
define(RULE_TOP, 3)
define(BODY_TOP, 4)
define(RULE_BOTTOM, 21)
define(FOOTER_ROW, 22)
define(NOTICE_ROW, 23)
define(PROMPT_ROW, 24)
define(FRAME_BOTTOM, 25)

// Where an input screen confirms an answer: the same row its prompt
// sat on, so "saved." replaces the question instead of chasing it.
define(STATUS_ROW, 20)

// Array cells are drawn five columns wide, so a value outside this
// range would spill into its neighbour. The target gets a wider
// range because it is only ever printed as plain text, and both
// ranges keep target - arr[i] far away from a 32-bit wrap.
define(VALUE_MIN, -99)
define(VALUE_MAX, 999)
define(TARGET_MIN, -9999)
define(TARGET_MAX, 9999)

// Longest run of digits a typed number may have. Nine keeps the
// parsed value inside 32 bits, so anything a user can type is
// reported as out of range rather than as junk.
define(DIGIT_MAX, 9)

// The palette, by role rather than by name. These are 256-colour SGR
// escapes; printf treats them as any other text, so drawing is just a
// sequence of printfs with the right control bytes mixed in.
        .data
th_fg_text:     .string "\x1b[38;5;189m"   // body text
th_fg_dim:      .string "\x1b[38;5;146m"   // labels, secondary text
th_fg_faint:    .string "\x1b[38;5;243m"   // rules, hints, empty slots
th_fg_accent:   .string "\x1b[38;5;183m"   // headings and the app mark
th_fg_key:      .string "\x1b[38;5;111m"   // menu numbers, typed input
th_fg_ok:       .string "\x1b[38;5;157m"   // the pair, once it is found
th_fg_warn:     .string "\x1b[38;5;223m"   // the cell being compared
th_fg_hot:      .string "\x1b[38;5;216m"   // the element in hand
th_fg_bad:      .string "\x1b[38;5;211m"   // collisions, rejected input
th_fg_node:     .string "\x1b[38;5;158m"   // cells at rest

// Filled cells: the background carries the state and the text goes
// dark, so a highlighted cell reads as a block rather than as ink.
th_bg_ok:       .string "\x1b[48;5;157m\x1b[38;5;235m"
th_bg_warn:     .string "\x1b[48;5;223m\x1b[38;5;235m"
th_bg_hot:      .string "\x1b[48;5;216m\x1b[38;5;235m"
th_bg_bad:      .string "\x1b[48;5;211m\x1b[38;5;235m"
th_bg_faint:    .string "\x1b[48;5;237m\x1b[38;5;189m"

seq_clear:      .string "\x1b[2J\x1b[H"
seq_reset:      .string "\x1b[0m"
seq_bold:       .string "\x1b[1m"
seq_hide:       .string "\x1b[?25l"
seq_show:       .string "\x1b[?25h"
fmt_move:       .string "\x1b[%d;%dH"

// Role -> escape, indexed by the UI_ROLE_* numbers. A table rather
// than a branch, so a caller can hold a role in a register and hand
// it straight to th_fg or th_bg.
        .balign 8
th_fg_table:
        .dword  th_fg_text, th_fg_dim, th_fg_faint, th_fg_accent, th_fg_key
        .dword  th_fg_ok, th_fg_warn, th_fg_hot, th_fg_bad, th_fg_node
        .balign 8
th_bg_table:
        .dword  th_bg_faint, th_bg_faint, th_bg_faint, th_bg_faint, th_bg_faint
        .dword  th_bg_ok, th_bg_warn, th_bg_hot, th_bg_bad, th_bg_faint

// The frame. 78 glyphs of rule between the corners is exactly 80
// columns, and the sides go down both edges in one printf per row.
ui_frame_top:   .string "╭──────────────────────────────────────────────────────────────────────────────╮"
ui_frame_bot:   .string "╰──────────────────────────────────────────────────────────────────────────────╯"
ui_rule_line:   .string "├──────────────────────────────────────────────────────────────────────────────┤"
ui_side_fmt:    .string "\x1b[%d;1H│\x1b[%d;80H│"

app_mark:       .string "TWO-SUM"
app_sub:        .string "two-sum, traced in ARMv8 assembly"
ui_dot:         .string "  ·  "

// Screen names for the title bar, and the same words again as menu
// entries where they fit: one string, both places.
nm_home:        .string "home"
nm_presets:     .string "presets"
nm_preset:      .string "preset"
nm_array:       .string "array"
nm_target:      .string "target"
nm_speed:       .string "speed"
nm_brute:       .string "brute force"
nm_hash:        .string "hash set"
nm_both:        .string "both"
nm_exit:        .string "exit"
nm_cancel:      .string "cancel"
nm_run:         .string "run"
nm_welcome:     .string "welcome"

grp_input:      .string "INPUT"
grp_run:        .string "RUN"
grp_presets:    .string "PRESETS"

// One line of context each, so the menu teaches before a key is spent.
sub_preset:     .string "six arrays and targets worth watching"
sub_array:      .string "type your own, 1 to 10 values"
sub_target:     .string "the sum a pair has to make"
sub_speed:      .string "how long one frame stays on screen"
sub_brute:      .string "check every pair, O(n^2)"
sub_hash:       .string "one pass and a lookup table, O(n)"
sub_both:       .string "the two back to back, same input"
sub_exit:       .string "leave two-sum"
sub_cancel:     .string "keep whatever is loaded now"

num_0:          .string "0"
num_1:          .string "1"
num_2:          .string "2"
num_3:          .string "3"
num_4:          .string "4"
num_5:          .string "5"
num_6:          .string "6"
num_7:          .string "7"

pre_nm1:        .string "classic"
pre_nm2:        .string "negatives"
pre_nm3:        .string "duplicates"
pre_nm4:        .string "no pair"
pre_nm5:        .string "late match"
pre_nm6:        .string "collision"
pre_txt1:       .string "arr=[2,7,11,15]        target=9"
pre_txt2:       .string "arr=[-3,4,1,-1]        target=0"
pre_txt3:       .string "arr=[5,5]              target=10"
pre_txt4:       .string "arr=[1,2,3,4,5]        target=100"
pre_txt5:       .string "arr=[3,3,4,7,1,8]      target=10"
pre_txt6:       .string "arr=[0,16,32,48,33]    target=49"

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
prompt_choose:  .string "choose "
prompt_cont:    .string "press enter to continue"

// The standing line on row 22: what this screen expects, and one
// thing worth knowing about it.
hint_home:      .string "type a number and press enter  ·  new here?  1, then 7"
hint_presets:   .string "1 to 6 loads a preset  ·  0 keeps what you have"
hint_manual:    .string "values run from -99 to 999  ·  that is what a cell has room for"
hint_target:    .string "any whole number from -9999 to 9999"
hint_speed:     .string "lower is faster  ·  100 ms is brisk, 3000 ms is a slideshow"
hint_ready:     .string "1 loads a preset  ·  2 types an array in  ·  3 sets the target"
hint_bf:        .string "enter returns to the menu  ·  one frame per comparison"
hint_hs:        .string "enter returns to the menu  ·  one frame per probe"
hint_welcome:   .string "press enter to begin"

msg_need_arr:   .string "no array yet."
msg_need_tgt:   .string "no target yet."
msg_saved:      .string "saved."
msg_bye:        .string "thanks for watching."

// Shown on the message row when an answer is rejected. Both name the
// cause and the range, so the fix is on screen with the complaint.
err_not_int:    .string "that is not a whole number.  enter a value from %d to %d."
err_range:      .string "%d is out of range.  enter a value from %d to %d."

phase_brute:    .string "check every pair (i, j) with i < j"
phase_hash:     .string "for each i, look up target - arr[i]"

// The card that turns a pretty animation into a lesson: what the run
// costs in the three cases and in memory. Labels dim, the three time
// bounds in the roles the cells use for settled, working, and worst.
cx_brute:       .string "\x1b[38;5;146mbest \x1b[38;5;157mO(1)   \x1b[38;5;146mavg \x1b[38;5;223mO(n^2)   \x1b[38;5;146mworst \x1b[38;5;211mO(n^2)   \x1b[38;5;146mspace \x1b[38;5;111mO(1)\x1b[0m"
cx_hash:        .string "\x1b[38;5;146mbest \x1b[38;5;157mO(n)   \x1b[38;5;146mavg \x1b[38;5;223mO(n)     \x1b[38;5;146mworst \x1b[38;5;211mO(n^2)   \x1b[38;5;146mspace \x1b[38;5;111mO(n)\x1b[0m"

// Panel rules. The name rides in the rule the way a titled box would
// carry it, and each one is 74 columns so it stops short of the frame.
sec_array:      .string "── array ─────────────────────────────────────────────────────────────────"
sec_hash:       .string "── hash table  ·  slot = val & 0x0F, then probe forward ──────────────────"
sec_trace:      .string "── trace ─────────────────────────────────────────────────────────────────"

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

// The counters, on the standing line. Labels carry the dim role and
// the numbers the text role, both baked into the format string so one
// printf paints the whole line.
stats_bf_fmt:   .string "\x1b[38;5;146mcomparisons \x1b[38;5;189m%-3d\x1b[38;5;146m of \x1b[38;5;189m%-3d\x1b[38;5;146m  worst case n(n-1)/2\x1b[0m"
stats_hs_fmt:   .string "\x1b[38;5;146mprobes \x1b[38;5;189m%-4d\x1b[38;5;146m  inserts \x1b[38;5;189m%-4d\x1b[0m"

// State block on the home screen, three lines (array, target,
// speed) instead of one cramped line. Shows the actual array values.
state_lbl_arr:  .string "array:   "
state_lbl_tgt:  .string "target:  "
state_lbl_spd:  .string "speed:   "
state_fmt_spd:  .string "%d ms/frame"
state_unset:    .string "not set yet"
state_open:     .string "["
state_close:    .string "]"
state_comma:    .string ", "

// Right-side readout in the run-screen header.
run_target_fmt: .string "\x1b[38;5;146mtarget \x1b[38;5;189m%d\x1b[0m"

// Colour keys, drawn once per run on the message row. Each swatch is
// filled with the same background the cell it describes gets, so the
// key and the screen cannot drift apart.
legend_bf:      .string "\x1b[38;5;243mkey  \x1b[48;5;216m\x1b[38;5;235m i \x1b[0m\x1b[38;5;243m in hand   \x1b[48;5;223m\x1b[38;5;235m j \x1b[0m\x1b[38;5;243m compared   \x1b[48;5;157m\x1b[38;5;235m pair \x1b[0m\x1b[38;5;243m found\x1b[0m"
legend_hs:      .string "\x1b[38;5;243mkey  \x1b[48;5;223m\x1b[38;5;235m probe \x1b[0m\x1b[38;5;243m  \x1b[48;5;211m\x1b[38;5;235m collision \x1b[0m\x1b[38;5;243m  \x1b[48;5;157m\x1b[38;5;235m hit \x1b[0m\x1b[38;5;243m  \x1b[48;5;216m\x1b[38;5;235m insert \x1b[0m\x1b[38;5;243m  ·  free\x1b[0m"

// Welcome splash shown once on startup.
splash_box_t:   .string "╭──────────────────────────────────╮"
splash_box_m:   .string "│         TWO-SUM, TRACED          │"
splash_box_b:   .string "╰──────────────────────────────────╯"
splash_l1:      .string "walk two-sum step by step in aarch64 assembly."
splash_l2:      .string "brute force O(n^2) and hash set O(n), side by side,"
splash_l3:      .string "with colour, carets, and a narration panel."
splash_l4:      .string "6 presets, manual input, adjustable speed.  MIT licensed."

fmt_int:        .string "%d"
fmt_token:      .string "%15s"
fmt_idx_head:   .string " [%d] "
fmt_cell_val:   .string "[%3d]"
fmt_cell_empty: .string "[ · ]"
fmt_blank_row:  .string "                                                                              "
newline:        .string "\n"

caret_s:        .string "^"
lbl_i_s:        .string "i"
lbl_j_s:        .string "j"

// The console path. Started by "./two_sum_viz console", it runs the
// same two algorithms over the same input and prints plain lines --
// no cursor moves, no colour, nothing a pipe or a log would mangle.
arg_console:    .string "console"
con_line_1:     .string "two-sum: brute force O(n^2) and hash set O(n)\n"
con_line_2:     .string "type an array and a target; each solver prints the pair it finds.\n"
con_bf_found:   .string "brute force:  arr[%d] (%d) + arr[%d] (%d) = %d   comparisons: %d\n"
con_bf_none:    .string "brute force:  no pair sums to %d   comparisons: %d\n"
con_hs_found:   .string "hash set:     arr[%d] (%d) + arr[%d] (%d) = %d   probes: %d\n"
con_hs_none:    .string "hash set:     no pair sums to %d   probes: %d\n"
con_close:      .string "brute force checks every pair; the hash set trades a table for the loop.\n"
con_eof:        .string "input ended before the program had everything it needed.\n"


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

// 1 once the console path has taken over. The three helpers that
// paint a prompt or a complaint read it and stay in plain text, so
// the same hardened reader serves both paths.
console_mode:   .skip 4

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
// set" flags, and then picks a face. Started as "two_sum_viz console"
// it runs the solver as plain lines and returns; started with no
// arguments it drops into the menu loop, and each menu option is a
// short helper that returns here. The loop exits only on option 0.
//
// Input:  w0 = argc, x1 = argv
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x2, =anim_delay
        mov     w3, DEFAULT_DELAY
        str     w3, [x2]

        ldr     x2, =n
        str     wzr, [x2]

        ldr     x2, =target_set
        str     wzr, [x2]

        cmp     w0, 2
        b.lt    main_visual
        ldr     x0, [x1, 8]                 // argv[1]
        bl      is_console_arg
        cbz     w0, main_visual

        bl      console_main
        ldp     fp, lr, [sp], 16
        ret

main_visual:
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
        mov     w0, UI_ROLE_OK
        bl      th_fg
        ldr     x0, =msg_bye
        bl      printf
        bl      th_off
        ldr     x0, =newline
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret


// is_console_arg compares one argument against "console". Leaf
// function, no calls, so it needs no frame.
//
// Input:  x0 = candidate string
// Output: w0 = 1 on a match, 0 otherwise
is_console_arg:
        ldr     x1, =arg_console
ica_loop:
        ldrb    w2, [x0], 1
        ldrb    w3, [x1], 1
        cmp     w2, w3
        b.ne    ica_no
        cbnz    w2, ica_loop
        mov     w0, 1
        ret
ica_no:
        mov     w0, 0
        ret


// console_main is the whole program without the screen: two lines of
// banner, the same prompts the visualizer asks (same reader, same
// bounds, same complaints), then both algorithms over the same input,
// one labelled line each. Nothing here emits an escape byte, so the
// output survives a pipe, a log, or a plain console pane.
//
// Output: w0 = exit code
console_main:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp

        ldr     x0, =console_mode
        mov     w1, 1
        str     w1, [x0]

        ldr     x0, =con_line_1
        bl      printf
        ldr     x0, =con_line_2
        bl      printf

        mov     w0, 0
        mov     w1, 0
        ldr     x2, =prompt_size
        mov     w3, 0
        bl      ask_prompt
        mov     w0, 1
        mov     w1, ARRAY_MAX
        bl      read_int_range
        cbz     w1, cm_eof

        ldr     x9, =n
        str     w0, [x9]

        str     wzr, [fp, 16]               // i
cm_read_loop:
        ldr     w9, [fp, 16]
        ldr     x10, =n
        ldr     w10, [x10]
        cmp     w9, w10
        b.ge    cm_read_done

        mov     w0, 0
        mov     w1, 0
        ldr     x2, =prompt_elem
        mov     w3, w9
        bl      ask_prompt
        mov     w0, VALUE_MIN
        mov     w1, VALUE_MAX
        bl      read_int_range
        cbz     w1, cm_eof

        ldr     x9, =arr
        ldr     w10, [fp, 16]
        str     w0, [x9, w10, SXTW #2]

        ldr     w9, [fp, 16]
        add     w9, w9, 1
        str     w9, [fp, 16]
        b       cm_read_loop
cm_read_done:

        mov     w0, 0
        mov     w1, 0
        ldr     x2, =prompt_target
        mov     w3, 0
        bl      ask_prompt
        mov     w0, TARGET_MIN
        mov     w1, TARGET_MAX
        bl      read_int_range
        cbz     w1, cm_eof

        // target_set is a menu concern (it lets ensure_ready tell a
        // target of zero from no target at all), so the console path
        // does not touch it.
        ldr     x9, =target
        str     w0, [x9]

        bl      console_brute_force
        bl      console_hash_set
        ldr     x0, =con_close
        bl      printf

        mov     w0, 0
        b       cm_done

cm_eof:
        ldr     x0, =con_eof
        bl      printf
        mov     w0, 1

cm_done:
        ldp     fp, lr, [sp], 32
        ret


// console_brute_force checks every pair (i, j) with i < j and prints
// the first one that sums to the target, or a line saying there is
// none. The comparison count rides on the same line: it is the number
// the O(n^2) claim is about.
//
// Register usage:
//   x19  arr base
//   w20  n
//   w21  target
//   w22  i
//   w23  j
//   w24  comparisons
console_brute_force:
        stp     fp, lr, [sp, -64]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        stp     x23, x24, [sp, 48]

        ldr     x19, =arr
        ldr     x9, =n
        ldr     w20, [x9]
        ldr     x9, =target
        ldr     w21, [x9]
        mov     w22, 0
        mov     w24, 0

cbf_outer:
        sub     w9, w20, 1
        cmp     w22, w9
        b.ge    cbf_none

        add     w23, w22, 1
cbf_inner:
        cmp     w23, w20
        b.ge    cbf_next_i

        add     w24, w24, 1
        ldr     w9,  [x19, w22, SXTW #2]
        ldr     w10, [x19, w23, SXTW #2]
        add     w11, w9, w10
        cmp     w11, w21
        b.eq    cbf_found

        add     w23, w23, 1
        b       cbf_inner

cbf_next_i:
        add     w22, w22, 1
        b       cbf_outer

cbf_found:
        ldr     x0, =con_bf_found
        mov     w1, w22
        ldr     w2, [x19, w22, SXTW #2]
        mov     w3, w23
        ldr     w4, [x19, w23, SXTW #2]
        mov     w5, w21
        mov     w6, w24
        bl      printf
        b       cbf_done

cbf_none:
        ldr     x0, =con_bf_none
        mov     w1, w21
        mov     w2, w24
        bl      printf

cbf_done:
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     x23, x24, [sp, 48]
        ldp     fp, lr, [sp], 64
        ret


// chs_lookup walks the table from val's slot until it meets val or an
// empty slot, and hands back where it stopped. The running probe
// count goes in and comes back out, so the lookup walk and the insert
// walk add up to one honest number. ARRAY_MAX is below HASH_SIZE, so
// an empty slot always exists and the walk always terminates. Leaf
// function, no calls, so it needs no frame.
//
// Input:  w0 = val
//         w1 = probes so far
// Output: w0 = slot index
//         w1 = 1 if val sits at that slot, 0 if the slot is empty
//         w2 = probes, counting every slot this walk looked at
chs_lookup:
        and     w3, w0, HASH_MASK           // start at val mod table size
        mov     w2, w1
        ldr     x4, =hash_used
        ldr     x5, =hash_vals
chsl_loop:
        add     w2, w2, 1
        ldrb    w6, [x4, w3, UXTW]
        cbz     w6, chsl_empty
        ldr     w7, [x5, w3, UXTW #2]
        cmp     w7, w0
        b.eq    chsl_found
        add     w3, w3, 1
        and     w3, w3, HASH_MASK           // wrap around the table
        b       chsl_loop

chsl_empty:
        mov     w0, w3
        mov     w1, 0
        ret

chsl_found:
        mov     w0, w3
        mov     w1, 1
        ret


// console_hash_set is the linear-time counterpart. For each arr[i] it
// asks whether target - arr[i] has turned up already; if it has, that
// is the pair, and if it has not, (arr[i], i) goes into the table so
// a later index can find it.
//
// Register usage:
//   x19  arr base
//   w20  n
//   w21  target
//   w22  i
//   w23  val = arr[i]
//   w24  complement = target - val
//   w25  probes
console_hash_set:
        stp     fp, lr, [sp, -80]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        stp     x23, x24, [sp, 48]
        str     x25, [sp, 64]

        // Wipe the occupancy map so a second run cannot start with
        // stale slots from the first.
        ldr     x9, =hash_used
        mov     w10, 0
chs_reset:
        strb    wzr, [x9, w10, UXTW]
        add     w10, w10, 1
        cmp     w10, HASH_SIZE
        b.lt    chs_reset

        ldr     x19, =arr
        ldr     x9, =n
        ldr     w20, [x9]
        ldr     x9, =target
        ldr     w21, [x9]
        mov     w22, 0
        mov     w25, 0

chs_outer:
        cmp     w22, w20
        b.ge    chs_none

        ldr     w23, [x19, w22, SXTW #2]    // val
        sub     w24, w21, w23               // complement

        mov     w0, w24
        mov     w1, w25
        bl      chs_lookup
        mov     w25, w2
        cbz     w1, chs_insert

        // The complement is already here: read back the index it was
        // stored with and print both sides of the pair.
        ldr     x9, =hash_idx
        ldr     w10, [x9, w0, UXTW #2]

        ldr     x0, =con_hs_found
        mov     w1, w10                     // earlier index
        mov     w2, w24                     // arr[earlier] = complement
        mov     w3, w22                     // current index
        mov     w4, w23                     // arr[i] = val
        mov     w5, w21
        mov     w6, w25
        bl      printf
        b       chs_done

chs_insert:
        // No match yet. Record (val, i) unless val is already in the
        // table, in which case the index sitting there is the earlier
        // one and it stays; the rule the visualizer follows too, so
        // a repeated value names the same index on both paths.
        mov     w0, w23
        mov     w1, w25
        bl      chs_lookup
        mov     w25, w2
        cbnz    w1, chs_next_i

        ldr     x9, =hash_vals
        str     w23, [x9, w0, UXTW #2]
        ldr     x9, =hash_idx
        str     w22, [x9, w0, UXTW #2]
        ldr     x9, =hash_used
        mov     w10, 1
        strb    w10, [x9, w0, UXTW]

chs_next_i:
        add     w22, w22, 1
        b       chs_outer

chs_none:
        ldr     x0, =con_hs_none
        mov     w1, w21
        mov     w2, w25
        bl      printf

chs_done:
        ldr     x25, [sp, 64]
        ldp     x23, x24, [sp, 48]
        ldp     x21, x22, [sp, 32]
        ldp     x19, x20, [sp, 16]
        ldp     fp, lr, [sp], 80
        ret


// draw_splash paints a one-time welcome screen on startup: the
// frame, a boxed title, four lines of description, and the hint to
// press enter.  It blocks on the user's keypress and returns so
// main_loop can take over.  Running it again would look fine, but we
// only call it once: on menu returns the home screen stands alone.
draw_splash:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      clear_screen
        ldr     x0, =nm_welcome
        bl      draw_header

        mov     w0, 6
        mov     w1, 22
        mov     w2, UI_ROLE_FAINT
        ldr     x3, =splash_box_t
        bl      ui_text

        mov     w0, 7
        mov     w1, 22
        mov     w2, UI_ROLE_ACCENT
        ldr     x3, =splash_box_m
        bl      ui_text

        mov     w0, 8
        mov     w1, 22
        mov     w2, UI_ROLE_FAINT
        ldr     x3, =splash_box_b
        bl      ui_text

        mov     w0, 11
        mov     w1, 14
        mov     w2, UI_ROLE_TEXT
        ldr     x3, =splash_l1
        bl      ui_text

        mov     w0, 12
        mov     w1, 14
        mov     w2, UI_ROLE_TEXT
        ldr     x3, =splash_l2
        bl      ui_text

        mov     w0, 13
        mov     w1, 14
        mov     w2, UI_ROLE_TEXT
        ldr     x3, =splash_l3
        bl      ui_text

        mov     w0, 15
        mov     w1, 14
        mov     w2, UI_ROLE_DIM
        ldr     x3, =splash_l4
        bl      ui_text

        ldr     x0, =hint_welcome
        bl      draw_footer

        mov     x0, 0
        bl      fflush
        bl      clear_input_buffer

        ldp     fp, lr, [sp], 16
        ret


// draw_legend_bf and draw_legend_hs paint the colour key on the
// message row of a run screen.  The escapes that fill each swatch are
// baked into the string itself, so one printf renders the whole key
// and the swatches are the same fills the cells get.
draw_legend_bf:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, NOTICE_ROW
        mov     w1, 4
        bl      move_cursor
        ldr     x0, =legend_bf
        bl      printf
        bl      th_off
        ldp     fp, lr, [sp], 16
        ret


draw_legend_hs:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, NOTICE_ROW
        mov     w1, 4
        bl      move_cursor
        ldr     x0, =legend_hs
        bl      printf
        bl      th_off
        ldp     fp, lr, [sp], 16
        ret


// draw_main_menu repaints the home screen: the two groups of
// numbered entries, the state block, the standing hint, and the
// prompt. The state block reads n, target, and delay straight from
// memory so it always reflects whatever the user last set.
draw_main_menu:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      clear_screen
        ldr     x0, =nm_home
        bl      draw_header
        bl      draw_tagline

        mov     w0, BODY_TOP
        mov     w1, 4
        mov     w2, UI_ROLE_ACCENT
        ldr     x3, =grp_input
        bl      ui_text

        mov     w0, 5
        ldr     x1, =num_1
        ldr     x2, =nm_preset
        ldr     x3, =sub_preset
        bl      menu_entry

        mov     w0, 6
        ldr     x1, =num_2
        ldr     x2, =nm_array
        ldr     x3, =sub_array
        bl      menu_entry

        mov     w0, 7
        ldr     x1, =num_3
        ldr     x2, =nm_target
        ldr     x3, =sub_target
        bl      menu_entry

        mov     w0, 8
        ldr     x1, =num_4
        ldr     x2, =nm_speed
        ldr     x3, =sub_speed
        bl      menu_entry

        mov     w0, 10
        mov     w1, 4
        mov     w2, UI_ROLE_ACCENT
        ldr     x3, =grp_run
        bl      ui_text

        mov     w0, 11
        ldr     x1, =num_5
        ldr     x2, =nm_brute
        ldr     x3, =sub_brute
        bl      menu_entry

        mov     w0, 12
        ldr     x1, =num_6
        ldr     x2, =nm_hash
        ldr     x3, =sub_hash
        bl      menu_entry

        mov     w0, 13
        ldr     x1, =num_7
        ldr     x2, =nm_both
        ldr     x3, =sub_both
        bl      menu_entry

        mov     w0, 15
        ldr     x1, =num_0
        ldr     x2, =nm_exit
        ldr     x3, =sub_exit
        bl      menu_entry

        bl      draw_state_block

        ldr     x0, =hint_home
        bl      draw_footer

        mov     w0, STATUS_ROW
        mov     w1, 4
        ldr     x2, =prompt_choose
        mov     w3, 0
        bl      ask_prompt

        ldp     fp, lr, [sp], 16
        ret


// menu_entry draws one menu line: the number in its own colour, the
// name, then the quiet blurb that says what the thing is before a
// keystroke is spent on it.
//
// Input:  w0 = row, x1 = number, x2 = name, x3 = blurb
menu_entry:
        stp     fp, lr, [sp, -64]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]

        mov     w19, w0
        mov     x20, x1
        mov     x21, x2
        mov     x22, x3

        mov     w0, w19
        mov     w1, 4
        mov     w2, UI_ROLE_KEY
        mov     x3, x20
        bl      ui_text

        mov     w0, w19
        mov     w1, 8
        mov     w2, UI_ROLE_TEXT
        mov     x3, x21
        bl      ui_text

        mov     w0, w19
        mov     w1, 30
        mov     w2, UI_ROLE_FAINT
        mov     x3, x22
        bl      ui_text

        ldp     x21, x22, [sp, 32]
        ldp     x19, x20, [sp, 16]
        ldp     fp, lr, [sp], 64
        ret


// draw_header lays down the frame and the title bar: the app mark,
// a faint separator, and the name of the screen the reader is on.
// Every screen starts here, so the shape of all of them changes from
// this one function.
//
// Input:  x0 = screen name
draw_header:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     x19, [sp, 16]
        mov     x19, x0

        bl      hide_cursor_call
        bl      draw_frame

        mov     w0, TITLE_ROW
        mov     w1, 4
        bl      move_cursor
        mov     w0, UI_ROLE_ACCENT
        bl      th_fg
        bl      th_bold_on
        ldr     x0, =app_mark
        bl      printf
        bl      th_off

        mov     w0, UI_ROLE_FAINT
        bl      th_fg
        ldr     x0, =ui_dot
        bl      printf
        bl      th_off

        mov     w0, UI_ROLE_TEXT
        bl      th_fg
        mov     x0, x19
        bl      printf
        bl      th_off

        mov     w0, RULE_TOP
        bl      draw_rule
        mov     w0, RULE_BOTTOM
        bl      draw_rule

        ldr     x19, [sp, 16]
        ldp     fp, lr, [sp], 32
        ret


// draw_frame paints the border: each corner row in one printf, then
// both sides of every row in between with one more.
draw_frame:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     x19, [sp, 16]

        mov     w0, UI_ROLE_FAINT
        bl      th_fg

        mov     w0, 1
        mov     w1, 1
        bl      move_cursor
        ldr     x0, =ui_frame_top
        bl      printf

        mov     w0, FRAME_BOTTOM
        mov     w1, 1
        bl      move_cursor
        ldr     x0, =ui_frame_bot
        bl      printf

        mov     w19, 2
df_sides:
        cmp     w19, FRAME_BOTTOM
        b.ge    df_done
        ldr     x0, =ui_side_fmt
        mov     w1, w19
        mov     w2, w19
        bl      printf
        add     w19, w19, 1
        b       df_sides

df_done:
        bl      th_off
        ldr     x19, [sp, 16]
        ldp     fp, lr, [sp], 32
        ret


// draw_rule joins a full-width rule into the frame.
//
// Input:  w0 = row
draw_rule:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w1, 1
        bl      move_cursor
        mov     w0, UI_ROLE_FAINT
        bl      th_fg
        ldr     x0, =ui_rule_line
        bl      printf
        bl      th_off
        ldp     fp, lr, [sp], 16
        ret


// draw_tagline sets what the program is on the right of the title
// bar. Only the home screen wears it; every other screen keeps the
// bar for its own name. app_sub is 33 columns, so column 44 lands its
// last character on 76, clear of the frame.
draw_tagline:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, TITLE_ROW
        mov     w1, 44
        mov     w2, UI_ROLE_FAINT
        ldr     x3, =app_sub
        bl      ui_text
        ldp     fp, lr, [sp], 16
        ret


// draw_footer writes the standing line under the bottom rule: what
// the screen expects next, and one thing worth knowing about it.
//
// Input:  x0 = hint text
draw_footer:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     x19, [sp, 16]
        mov     x19, x0

        mov     w0, FOOTER_ROW
        mov     w1, 2
        bl      move_cursor
        ldr     x0, =fmt_blank_row
        bl      printf

        mov     w0, FOOTER_ROW
        mov     w1, 4
        mov     w2, UI_ROLE_FAINT
        mov     x3, x19
        bl      ui_text

        ldr     x19, [sp, 16]
        ldp     fp, lr, [sp], 32
        ret


// draw_state_block paints a three-line summary of current state at
// rows 17 / 18 / 19 (array contents, target, animation speed). The
// labels are dim and the values plain, so the block reads as a
// readout rather than competing with the menu entries. The array is
// printed element by element with commas, so the user sees exactly
// what got loaded (from a preset or from manual entry).
draw_state_block:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp

        // Row 17: "array:   [v0, v1, ..., vN-1]" or "not set yet".
        mov     w0, 17
        mov     w1, 4
        mov     w2, UI_ROLE_DIM
        ldr     x3, =state_lbl_arr
        bl      ui_text

        ldr     x9, =n
        ldr     w9, [x9]
        cbz     w9, dsb_arr_unset

        mov     w0, UI_ROLE_TEXT
        bl      th_fg
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
        bl      th_off
        b       dsb_target
dsb_arr_unset:
        mov     w0, UI_ROLE_FAINT
        bl      th_fg
        ldr     x0, =state_unset
        bl      printf
        bl      th_off

dsb_target:
        // Row 18: "target:  N" or "not set yet".
        mov     w0, 18
        mov     w1, 4
        mov     w2, UI_ROLE_DIM
        ldr     x3, =state_lbl_tgt
        bl      ui_text

        ldr     x9, =target_set
        ldr     w9, [x9]
        cbz     w9, dsb_tgt_unset
        mov     w0, UI_ROLE_TEXT
        bl      th_fg
        ldr     x0, =fmt_int
        ldr     x9, =target
        ldr     w1, [x9]
        bl      printf
        bl      th_off
        b       dsb_speed
dsb_tgt_unset:
        mov     w0, UI_ROLE_FAINT
        bl      th_fg
        ldr     x0, =state_unset
        bl      printf
        bl      th_off

dsb_speed:
        // Row 19: "speed:   N ms/frame".
        mov     w0, 19
        mov     w1, 4
        mov     w2, UI_ROLE_DIM
        ldr     x3, =state_lbl_spd
        bl      ui_text

        mov     w0, UI_ROLE_TEXT
        bl      th_fg
        ldr     x0, =state_fmt_spd
        ldr     x9, =anim_delay
        ldr     w1, [x9]
        bl      printf
        bl      th_off

        ldp     fp, lr, [sp], 32
        ret


// set_from_preset shows six canned (array, target) pairs and copies
// the chosen one into shared state. Option 0 cancels.
set_from_preset:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      clear_screen
        ldr     x0, =nm_presets
        bl      draw_header

        mov     w0, BODY_TOP
        mov     w1, 4
        mov     w2, UI_ROLE_ACCENT
        ldr     x3, =grp_presets
        bl      ui_text

        mov     w0, 5
        ldr     x1, =num_1
        ldr     x2, =pre_nm1
        ldr     x3, =pre_txt1
        bl      menu_entry

        mov     w0, 6
        ldr     x1, =num_2
        ldr     x2, =pre_nm2
        ldr     x3, =pre_txt2
        bl      menu_entry

        mov     w0, 7
        ldr     x1, =num_3
        ldr     x2, =pre_nm3
        ldr     x3, =pre_txt3
        bl      menu_entry

        mov     w0, 8
        ldr     x1, =num_4
        ldr     x2, =pre_nm4
        ldr     x3, =pre_txt4
        bl      menu_entry

        mov     w0, 9
        ldr     x1, =num_5
        ldr     x2, =pre_nm5
        ldr     x3, =pre_txt5
        bl      menu_entry

        mov     w0, 10
        ldr     x1, =num_6
        ldr     x2, =pre_nm6
        ldr     x3, =pre_txt6
        bl      menu_entry

        mov     w0, 12
        ldr     x1, =num_0
        ldr     x2, =nm_cancel
        ldr     x3, =sub_cancel
        bl      menu_entry

        ldr     x0, =hint_presets
        bl      draw_footer

        mov     w0, STATUS_ROW
        mov     w1, 4
        ldr     x2, =prompt_choose
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
        ldr     x0, =nm_array
        bl      draw_header
        ldr     x0, =hint_manual
        bl      draw_footer

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
        ldr     x0, =nm_target
        bl      draw_header
        ldr     x0, =hint_target
        bl      draw_footer

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
        ldr     x0, =nm_speed
        bl      draw_header
        ldr     x0, =hint_speed
        bl      draw_footer

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
        ldr     x0, =nm_run
        bl      draw_header
        mov     w0, 5
        mov     w1, 4
        mov     w2, UI_ROLE_BAD
        ldr     x3, =msg_need_arr
        bl      ui_text
        ldr     x0, =hint_ready
        bl      draw_footer
        bl      wait_enter
        mov     w0, 0
        b       er_done

er_no_tgt:
        bl      clear_screen
        ldr     x0, =nm_run
        bl      draw_header
        mov     w0, 5
        mov     w1, 4
        mov     w2, UI_ROLE_BAD
        ldr     x3, =msg_need_tgt
        bl      ui_text
        ldr     x0, =hint_ready
        bl      draw_footer
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
//   0  normal:  cell i is the element in hand, cell j the one being
//               compared against it, carets rendered
//   1  match:   both i and j settled, no carets
//   2  dim all: every cell faint, used for the "no pair" state
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
        mov     w1, 2
        bl      move_cursor
        ldr     x0, =fmt_blank_row
        bl      printf
        mov     w0, 10
        mov     w1, 2
        bl      move_cursor
        ldr     x0, =fmt_blank_row
        bl      printf

        // Panel rule.
        mov     w0, 6
        mov     w1, 4
        mov     w2, UI_ROLE_FAINT
        ldr     x3, =sec_array
        bl      ui_text

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
        mov     w0, UI_ROLE_FAINT
        bl      th_fg
        ldr     x0, =fmt_idx_head
        ldr     w1, [fp, 28]
        bl      printf
        bl      th_off

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
        mov     w0, UI_ROLE_FAINT
        bl      th_fg
        b       da_val_print
da_val_hi_i:
        ldr     w10, [fp, 24]
        cmp     w10, 1
        b.eq    da_val_match
        mov     w0, UI_ROLE_HOT
        bl      th_bg
        b       da_val_print
da_val_hi_j:
        ldr     w10, [fp, 24]
        cmp     w10, 1
        b.eq    da_val_match
        mov     w0, UI_ROLE_WARN
        bl      th_bg
        b       da_val_print
da_val_match:
        mov     w0, UI_ROLE_OK
        bl      th_bg
        b       da_val_print
da_val_plain:
        mov     w0, UI_ROLE_NODE
        bl      th_fg

da_val_print:
        ldr     x0, =fmt_cell_val
        ldr     x9, =arr
        ldr     w10, [fp, 28]
        ldr     w1, [x9, w10, SXTW #2]
        bl      printf
        bl      th_off

        ldr     w9, [fp, 28]
        add     w9, w9, 1
        str     w9, [fp, 28]
        b       da_val_loop
da_val_done:

        // Carets and labels, only in normal mode.
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
        mov     w0, UI_ROLE_HOT
        bl      th_fg
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
        bl      th_off

da_ptr_j:
        ldr     w9, [fp, 20]
        cmp     w9, 0
        b.lt    da_ptr_skip
        mov     w0, 9
        mov     w11, 6
        mul     w1, w9, w11
        add     w1, w1, 8
        bl      move_cursor
        mov     w0, UI_ROLE_WARN
        bl      th_fg
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
        bl      th_off

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
// An empty slot is a faint dot. A highlighted slot gets a filled
// background, one role per state:
//   0 probing    (warn)
//   1 hit        (ok)
//   2 collision  (bad)
//   3 inserted   (hot)
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
        mov     w2, UI_ROLE_FAINT
        ldr     x3, =sec_hash
        bl      ui_text

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
        mov     w0, UI_ROLE_FAINT
        bl      th_fg
        ldr     x0, =fmt_idx_head           // same shape as the array's
        ldr     w1, [fp, 24]                // index row, so a label never
        bl      printf                      // reads as a stored value
        bl      th_off

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
        mov     w0, UI_ROLE_WARN
        bl      th_bg
        b       dh_draw_value
dh_col_hit:
        mov     w0, UI_ROLE_OK
        bl      th_bg
        b       dh_draw_value
dh_col_coll:
        mov     w0, UI_ROLE_BAD
        bl      th_bg
        b       dh_draw_value
dh_col_ins:
        mov     w0, UI_ROLE_HOT
        bl      th_bg
        b       dh_draw_value

dh_plain:
        ldr     w9, [fp, 24]
        ldr     x10, =hash_used
        ldrb    w10, [x10, w9, UXTW]
        cbz     w10, dh_plain_free
        mov     w0, UI_ROLE_NODE
        bl      th_fg
        b       dh_draw_value
dh_plain_free:
        mov     w0, UI_ROLE_FAINT
        bl      th_fg

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
        bl      th_off
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
        mov     w2, UI_ROLE_FAINT
        ldr     x3, =sec_trace
        bl      ui_text

        mov     w9, 19
        str     w9, [fp, 16]
cta_loop:
        ldr     w9, [fp, 16]
        mov     w0, w9
        mov     w1, 2
        bl      move_cursor
        ldr     x0, =fmt_blank_row
        bl      printf
        ldr     w9, [fp, 16]
        add     w9, w9, 1
        str     w9, [fp, 16]
        cmp     w9, 21
        b.lt    cta_loop

        ldp     fp, lr, [sp], 32
        ret


// draw_stats writes the counters on the standing line, where every
// other screen puts what it expects next: during a run, what the run
// has cost so far. Brute force shows one counter, hash set two.
//
// Params:
//   w0 = mode    (0 = brute force, 1 = hash set)
//   w1 = stat_a  (comparisons for BF, probes for HS)
//   w2 = stat_b  (worst case for BF, inserts for HS)
draw_stats:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     w0, [fp, 16]
        str     w1, [fp, 20]
        str     w2, [fp, 24]

        mov     w0, FOOTER_ROW
        mov     w1, 2
        bl      move_cursor
        ldr     x0, =fmt_blank_row
        bl      printf

        mov     w0, FOOTER_ROW
        mov     w1, 4
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
        bl      th_off
        ldp     fp, lr, [sp], 32
        ret


// run_brute_force drives the O(n^2) walk. It loops over every pair
// (i, j) with i < j and paints a frame for each comparison: array
// with i in hand and j compared against it, narration below, and a
// running counter on the standing line. On a match we settle both
// cells and wait for enter; running off the end lands on the "no
// pair" screen instead.
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

        bl      clear_screen
        ldr     x0, =nm_brute
        bl      draw_header
        ldr     x0, =hint_bf
        bl      draw_footer

        mov     w0, BODY_TOP
        mov     w1, 4
        mov     w2, UI_ROLE_ACCENT
        ldr     x3, =phase_brute
        bl      ui_text

        mov     w0, 5
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =cx_brute
        bl      printf
        bl      th_off

        ldr     x19, =arr
        ldr     x9, =n
        ldr     w20, [x9]
        ldr     x9, =target
        ldr     w21, [x9]
        mov     w22, 0
        mov     w23, 0
        mov     w24, 0

        // Target readout on the right of the phase row.
        mov     w0, BODY_TOP
        mov     w1, 62
        bl      move_cursor
        ldr     x0, =run_target_fmt
        mov     w1, w21
        bl      printf
        bl      th_off

        // max = n*(n-1)/2 for the counter line.  Computed once and
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
        mov     w2, UI_ROLE_TEXT
        ldr     x3, =narr_bf_start
        bl      ui_text

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
        mov     w0, UI_ROLE_TEXT
        bl      th_fg

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
        bl      th_off

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
        mov     w2, UI_ROLE_FAINT
        ldr     x3, =narr_bf_miss
        bl      ui_text
        bl      frame_flush_delay

        add     w24, w24, 1
        b       bf_inner

bf_next_i:
        add     w23, w23, 1
        b       bf_outer

bf_match:
        mov     w0, 20
        mov     w1, 6
        mov     w2, UI_ROLE_OK
        ldr     x3, =narr_bf_match
        bl      ui_text
        bl      frame_flush_delay

        // Final result screen: both cells filled, result line settled.
        // narr_bf_result has six %d args, all fit in w1-w6.
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        mov     w0, UI_ROLE_OK
        bl      th_fg
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
        bl      th_off

        mov     w0, w23
        mov     w1, w24
        mov     w2, 1
        bl      draw_array
        mov     w0, 0
        mov     w1, w22
        mov     w2, w28
        bl      draw_stats
        bl      wait_enter
        b       bf_end

bf_none:
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        mov     w0, UI_ROLE_BAD
        bl      th_fg
        mov     w1, w21
        ldr     x0, =narr_bf_none
        bl      printf
        bl      th_off

        mov     w0, -1
        mov     w1, -1
        mov     w2, 2
        bl      draw_array
        mov     w0, 0
        mov     w1, w22
        mov     w2, w28
        bl      draw_stats
        bl      wait_enter

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
// can find it. Every probe paints a frame: warm while probing, bad on
// a collision, settled on a hit, and the insert colour when a fresh
// entry lands.
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

        bl      clear_screen
        ldr     x0, =nm_hash
        bl      draw_header
        ldr     x0, =hint_hs
        bl      draw_footer

        mov     w0, BODY_TOP
        mov     w1, 4
        mov     w2, UI_ROLE_ACCENT
        ldr     x3, =phase_hash
        bl      ui_text

        mov     w0, 5
        mov     w1, 6
        bl      move_cursor
        ldr     x0, =cx_hash
        bl      printf
        bl      th_off

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
        mov     w0, BODY_TOP
        mov     w1, 62
        bl      move_cursor
        ldr     x0, =run_target_fmt
        mov     w1, w21
        bl      printf
        bl      th_off

        bl      draw_legend_hs

        // Intro frame.
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        mov     w2, UI_ROLE_TEXT
        ldr     x3, =narr_hs_start
        bl      ui_text

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
        mov     w0, UI_ROLE_TEXT
        bl      th_fg
        mov     w1, w24
        mov     w2, w24
        mov     w3, w25
        mov     w4, w26
        ldr     x0, =narr_hs_iter
        bl      printf
        bl      th_off

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
        mov     w0, UI_ROLE_TEXT
        bl      th_fg
        mov     w1, w26
        mov     w2, w26
        mov     w3, w27
        ldr     x0, =narr_hs_probe_start
        bl      printf
        bl      th_off

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

        mov     w0, UI_ROLE_BAD
        bl      th_fg
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
        bl      th_off

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
        mov     w0, UI_ROLE_FAINT
        bl      th_fg
        mov     w1, w27
        ldr     x0, =narr_hs_probe_empty
        bl      printf
        bl      th_off

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
        mov     w0, UI_ROLE_TEXT
        bl      th_fg
        mov     w1, w25
        mov     w2, w25
        mov     w3, w28
        ldr     x0, =narr_hs_ins_start
        bl      printf
        bl      th_off

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

        mov     w0, UI_ROLE_BAD
        bl      th_fg
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
        bl      th_off

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
        // value first appeared, which is what the console path does
        // too, so a repeated value names the same index either way.
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        mov     w0, UI_ROLE_TEXT
        bl      th_fg
        ldr     x9, =hash_idx
        ldr     w10, [x9, w28, UXTW #2]
        mov     w1, w25
        mov     w2, w28
        mov     w3, w10
        ldr     x0, =narr_hs_ins_dup
        bl      printf
        bl      th_off

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
        mov     w0, UI_ROLE_TEXT
        bl      th_fg
        mov     w1, w25
        mov     w2, w24
        mov     w3, w28
        ldr     x0, =narr_hs_insert
        bl      printf
        bl      th_off

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
        mov     w0, UI_ROLE_OK
        bl      th_fg
        mov     w1, w27
        mov     w2, w26
        mov     w3, w28
        ldr     x0, =narr_hs_probe_hit
        bl      printf
        bl      th_off

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
        mov     w0, UI_ROLE_OK
        bl      th_fg

        mov     w1, w28
        mov     w2, w26
        mov     w3, w24
        mov     w4, w25
        mov     w5, w21
        mov     w6, w22
        mov     w7, w23
        ldr     x0, =narr_hs_result
        bl      printf
        bl      th_off
        bl      wait_enter
        b       hs_end

hs_none:
        bl      clear_trace_area
        mov     w0, 19
        mov     w1, 6
        bl      move_cursor
        mov     w0, UI_ROLE_BAD
        bl      th_fg
        mov     w1, w21
        ldr     x0, =narr_hs_none
        bl      printf
        bl      th_off

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
        bl      wait_enter

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


// th_fg paints the text that follows in one role's colour.
//
// Input:  w0 = role
th_fg:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x1, =th_fg_table
        ldr     x0, [x1, w0, SXTW #3]
        bl      printf
        ldp     fp, lr, [sp], 16
        ret


// th_bg fills the cell that follows with one role's colour, and
// darkens the text sitting on it.
//
// Input:  w0 = role
th_bg:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x1, =th_bg_table
        ldr     x0, [x1, w0, SXTW #3]
        bl      printf
        ldp     fp, lr, [sp], 16
        ret


// th_off clears every colour and attribute back to plain text.
th_off:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =seq_reset
        bl      printf
        ldp     fp, lr, [sp], 16
        ret


// th_bold_on adds weight until the next th_off.
th_bold_on:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =seq_bold
        bl      printf
        ldp     fp, lr, [sp], 16
        ret


// ui_text is the one way a screen writes a line: park the cursor,
// take the role, print, and hand the colour back. Almost every draw
// in the file goes through it.
//
// Input:  w0 = row, w1 = col, w2 = role, x3 = text
ui_text:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]

        mov     w19, w2
        mov     x20, x3

        bl      move_cursor
        mov     w0, w19
        bl      th_fg
        mov     x0, x20
        bl      printf
        bl      th_off

        ldp     x19, x20, [sp, 16]
        ldp     fp, lr, [sp], 32
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


// repaint_prompt draws the staged prompt again and leaves the cursor
// after it. On the visual path it blanks the row first and hands the
// key colour to whatever the student types; on the console path it
// prints the prompt and nothing else, so that transcript carries no
// escape bytes at all.
repaint_prompt:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =console_mode
        ldr     w9, [x9]
        cbnz    w9, rp_plain

        ldr     x9, =prompt_row
        ldr     w0, [x9]
        mov     w1, 2
        bl      move_cursor
        ldr     x0, =fmt_blank_row
        bl      printf

        ldr     x9, =prompt_row
        ldr     w0, [x9]
        ldr     x9, =prompt_col
        ldr     w1, [x9]
        bl      move_cursor
        mov     w0, UI_ROLE_TEXT
        bl      th_fg
        ldr     x9, =prompt_str
        ldr     x0, [x9]
        ldr     x9, =prompt_arg
        ldr     w1, [x9]
        bl      printf
        bl      th_off
        mov     w0, UI_ROLE_KEY
        bl      th_fg
        bl      show_cursor_call
        b       rp_flush

rp_plain:
        ldr     x9, =prompt_str
        ldr     x0, [x9]
        ldr     x9, =prompt_arg
        ldr     w1, [x9]
        bl      printf

rp_flush:
        mov     x0, 0
        bl      fflush

        ldp     fp, lr, [sp], 16
        ret


// clear_notice wipes the message row and takes the typing colour back
// off. Called once an answer is accepted, so a stale complaint never
// outlives the thing it was complaining about. The console path has
// no message row: its complaints are lines that already scrolled by.
clear_notice:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =console_mode
        ldr     w9, [x9]
        cbnz    w9, cn_done

        mov     w0, NOTICE_ROW
        mov     w1, 2
        bl      move_cursor
        ldr     x0, =fmt_blank_row
        bl      printf
        bl      th_off

cn_done:
        ldp     fp, lr, [sp], 16
        ret


// show_notice says why the last answer was rejected: one line in the
// error colour on the message row, or one plain line on the console
// path. The arguments go to the stack first because move_cursor needs
// w0-w2 for itself.
//
// Input:  x0 = format, w1 / w2 / w3 = its arguments
show_notice:
        stp     fp, lr, [sp, -48]!
        mov     fp, sp
        str     x0, [fp, 16]
        str     w1, [fp, 24]
        str     w2, [fp, 28]
        str     w3, [fp, 32]

        ldr     x9, =console_mode
        ldr     w9, [x9]
        cbnz    w9, sn_plain

        bl      clear_notice
        mov     w0, NOTICE_ROW
        mov     w1, 4
        bl      move_cursor
        mov     w0, UI_ROLE_BAD
        bl      th_fg
        ldr     x0, [fp, 16]
        ldr     w1, [fp, 24]
        ldr     w2, [fp, 28]
        ldr     w3, [fp, 32]
        bl      printf
        bl      th_off
        b       sn_done

sn_plain:
        ldr     x0, [fp, 16]
        ldr     w1, [fp, 24]
        ldr     w2, [fp, 28]
        ldr     w3, [fp, 32]
        bl      printf
        ldr     x0, =newline
        bl      printf

sn_done:
        ldp     fp, lr, [sp], 48
        ret


// show_saved confirms that an input screen took what was typed, then
// waits. It lands on the row the prompt was asked from, so the answer
// replaces the question instead of piling up under it.
show_saved:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      hide_cursor_call

        mov     w0, STATUS_ROW
        mov     w1, 2
        bl      move_cursor
        ldr     x0, =fmt_blank_row
        bl      printf

        mov     w0, STATUS_ROW
        mov     w1, 4
        mov     w2, UI_ROLE_OK
        ldr     x3, =msg_saved
        bl      ui_text

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
// numbers each get their own line on the message row and the prompt
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


// wait_enter prints the press-enter prompt on the prompt row and
// blocks until the user hits enter. Every screen that pauses (an
// input handler that just saved, a run that just finished) ends
// here, so the pause is always in the same place.
wait_enter:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, PROMPT_ROW
        mov     w1, 4
        mov     w2, UI_ROLE_FAINT
        ldr     x3, =prompt_cont
        bl      ui_text
        mov     x0, 0
        bl      fflush
        bl      clear_input_buffer
        bl      getchar
        ldp     fp, lr, [sp], 16
        ret
