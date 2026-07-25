// hash_viz.asm - open-addressed hash table with linear probing
//
// Thirteen buckets, listed on the left and laid out flat on the strip
// below, so the walk a collision forces is visible as a walk. A key that
// did not land in its own bucket says where it came from, which is the
// only honest way to show what probing costs.
//
// Deleting writes a tombstone rather than clearing the slot: a cleared
// slot would cut every probe path that once passed through it, and the
// keys behind it would vanish.

define(fp, x29)
define(lr, x30)

    .data
    .balign 8

    hash_buckets = 13

    HASH_FREE = 0
    HASH_USED = 1
    HASH_TOMB = 2

// Role numbers mirror ui.asm's UI_ROLE_* set. They are repeated here so
// this file also assembles on its own, the way the web build feeds it.
    HASH_ROLE_TEXT  = 0
    HASH_ROLE_DIM   = 1
    HASH_ROLE_FAINT = 2
    HASH_ROLE_KEY   = 4
    HASH_ROLE_OK    = 5
    HASH_ROLE_WARN  = 6
    HASH_ROLE_HOT   = 7
    HASH_ROLE_BAD   = 8
    HASH_ROLE_NODE  = 9

hash_keys:          .skip hash_buckets * 4
hash_state:         .skip hash_buckets
    .balign 4
hash_count:         .word 0
hash_tombs:         .word 0
hash_collisions:    .word 0

// The slots painted in something other than their resting colour this
// frame, filled in by hash_render and read back by hash_role_of.
hash_hl_slot:       .word -1, -1, -1
hash_hl_role:       .word 0, 0, 0

hash_sp:            .string " "

hash_fmt_slot:      .string "%2d"
hash_fmt_key:       .string "%5d"
hash_fmt_cell:      .string "%4d"
hash_lbl_tomb_wide: .string " tomb"
hash_lbl_tomb_thin: .string "tomb"
hash_cell_free_w:   .string "    \xc2\xb7"
hash_cell_free_t:   .string "   \xc2\xb7"
hash_fmt_from:      .string "from %2d"

hash_scr_menu:      .string "hash table  \xc2\xb7  linear probing"
hash_scr_insert:    .string "hash table  \xc2\xb7  insert"
hash_scr_search:    .string "hash table  \xc2\xb7  search"
hash_scr_delete:    .string "hash table  \xc2\xb7  delete"
hash_scr_show:      .string "hash table  \xc2\xb7  the table right now"
hash_scr_clear:     .string "hash table  \xc2\xb7  clear"

hash_pan_ops:       .string "operations"
hash_pan_buckets:   .string "buckets"
hash_pan_state:     .string "state"
hash_pan_probe:     .string "probe path"

hash_hint_menu:     .string "pick an operation  \xc2\xb7  0 goes back to the main menu"
hash_hint_run:      .string "enter returns to the table menu  \xc2\xb7  every probe step is one comparison"

hash_lbl_rest:      .string "at rest:"
hash_lbl_akey:      .string "a key"
hash_lbl_tomb:      .string "tomb"
hash_lbl_free:      .string "\xc2\xb7 free"
hash_lbl_load:      .string "load factor"
hash_lbl_pct:       .string "load"
hash_lbl_coll:      .string "collisions"
hash_lbl_prime:     .string "13 is prime: keys spread"
hash_lbl_formula:   .string "h(k) = k mod 13  \xc2\xb7  a taken slot sends the probe on, wrapping past slot 12"

hash_fmt_counts:    .string "%2d keys  %2d tomb  %2d free"
hash_fmt_pct:       .string "%3d%%"
hash_fmt_coll:      .string "%3d"

hash_opt_1:         .string "insert a key and watch it probe"
hash_opt_2:         .string "search for a key"
hash_opt_3:         .string "delete a key and leave a tombstone"
hash_opt_4:         .string "show the table as it stands"
hash_opt_5:         .string "clear the table"
hash_opt_0:         .string "back to the main menu"

hash_key_1:         .string "1"
hash_key_2:         .string "2"
hash_key_3:         .string "3"
hash_key_4:         .string "4"
hash_key_5:         .string "5"
hash_key_0:         .string "0"

hash_ask_choice:    .string "choice "
hash_ask_insert:    .string "key to insert (0 to 999)  "
hash_ask_search:    .string "key to search for (0 to 999)  "
hash_ask_delete:    .string "key to delete (0 to 999)  "
hash_fmt_used:      .string "%d of %d slots hold a key"

hash_o1:            .string "O(1)"
hash_on:            .string "O(n)"

hash_msg_full:      .string "the table is full: thirteen slots, thirteen keys"
hash_msg_empty:     .string "the table is empty. insert a key to watch it find a slot"
hash_msg_range:     .string "keys run from 0 to 999, which keeps the modulus easy to check by hand"
hash_msg_cleared:   .string "cleared. thirteen empty slots, no tombstones, no collisions"
hash_msg_tomb_why:  .string "a tombstone, not an empty slot: probe paths through it still work"

hash_fmt_hash:      .string "h(%d) = %d mod 13 = %d, so the probe starts there"
hash_fmt_taken:     .string "slot %d is taken by %d, so the probe steps on to slot %d"
hash_fmt_land:      .string "slot %d is free, so %d lands there  \xc2\xb7  probes %d"
hash_fmt_reuse:     .string "slot %d is a tombstone, so %d reuses it  \xc2\xb7  probes %d"
hash_fmt_dup:       .string "%d is already at slot %d, and a key may only appear once"
hash_fmt_hole:      .string "slot %d is empty, so %d is nowhere further along this path"
hash_fmt_found:     .string "found %d at slot %d  \xc2\xb7  probes %d"
hash_fmt_miss:      .string "slot %d holds %d, not %d, so the probe keeps walking"
hash_fmt_pass:      .string "slot %d is a tombstone, and a search walks straight past it"
hash_fmt_spent:     .string "thirteen probes and no match, so %d is not in the table"
hash_fmt_removed:   .string "removed %d from slot %d"
hash_fmt_absent:    .string "%d is not in the table, so there is nothing to delete"
hash_fmt_state:     .string "%d slots hold a key and %d are tombstones"

    .text
    .balign 4

// hash_menu() - operations menu; choice 0 hands control back to main
    .global hash_menu
hash_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

hash_menu_loop:
    bl      hash_menu_draw

    mov     w0, 0
    mov     w1, 5
    bl      read_int_range

    cmp     w0, 0
    b.eq    hash_menu_exit
    cmp     w0, 1
    b.eq    hash_menu_insert
    cmp     w0, 2
    b.eq    hash_menu_search
    cmp     w0, 3
    b.eq    hash_menu_delete
    cmp     w0, 4
    b.eq    hash_menu_show
    cmp     w0, 5
    b.eq    hash_menu_clear
    b       hash_menu_loop

hash_menu_insert:
    bl      hash_insert_interactive
    bl      wait_for_enter
    b       hash_menu_loop

hash_menu_search:
    bl      hash_search_interactive
    bl      wait_for_enter
    b       hash_menu_loop

hash_menu_delete:
    bl      hash_delete_interactive
    bl      wait_for_enter
    b       hash_menu_loop

hash_menu_show:
    bl      hash_show
    bl      wait_for_enter
    b       hash_menu_loop

hash_menu_clear:
    bl      hash_clear_interactive
    bl      wait_for_enter
    b       hash_menu_loop

hash_menu_exit:
    ldp     fp, lr, [sp], 16
    ret

// hash_menu_draw() - the operations screen
hash_menu_draw:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =hash_scr_menu
    bl      ui_screen

    ldr     x0, =hash_hint_menu
    bl      ui_footer

    mov     w0, 4
    mov     w1, 12
    mov     w2, 56
    mov     w3, 12
    ldr     x4, =hash_pan_ops
    bl      ui_panel

    mov     w0, 6
    ldr     x1, =hash_key_1
    ldr     x2, =hash_opt_1
    bl      hash_menu_line

    mov     w0, 7
    ldr     x1, =hash_key_2
    ldr     x2, =hash_opt_2
    bl      hash_menu_line

    mov     w0, 8
    ldr     x1, =hash_key_3
    ldr     x2, =hash_opt_3
    bl      hash_menu_line

    mov     w0, 9
    ldr     x1, =hash_key_4
    ldr     x2, =hash_opt_4
    bl      hash_menu_line

    mov     w0, 10
    ldr     x1, =hash_key_5
    ldr     x2, =hash_opt_5
    bl      hash_menu_line

    mov     w0, 11
    ldr     x1, =hash_key_0
    ldr     x2, =hash_opt_0
    bl      hash_menu_line

    mov     w0, 13
    mov     w1, 15
    bl      ui_at
    mov     w0, HASH_ROLE_DIM
    bl      th_fg
    ldr     x19, =hash_count
    ldr     w1, [x19]
    mov     w2, hash_buckets
    ldr     x0, =hash_fmt_used
    bl      printf
    bl      th_off

    mov     w0, 18
    mov     w1, 15
    ldr     x2, =hash_ask_choice
    bl      ui_prompt
    bl      hash_flush

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// hash_menu_line(w0 = row, x1 = key text, x2 = option text)
hash_menu_line:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    mov     x21, x1
    mov     x20, x2

    mov     w0, w19
    mov     w1, 15
    mov     w2, HASH_ROLE_KEY
    mov     x3, x21
    bl      ui_badge

    mov     w0, w19
    mov     w1, 19
    mov     w2, HASH_ROLE_TEXT
    mov     x3, x20
    bl      ui_text

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// hash_frame(x0 = screen title, x1 = footer hint, x2 = best, x3 = avg,
//            x4 = worst, x5 = space)
// Everything on an operation screen that does not move while it runs.
hash_frame:
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
    mov     w2, 46
    mov     w3, 10
    ldr     x4, =hash_pan_buckets
    bl      ui_panel

    mov     w0, 4
    mov     w1, 49
    mov     w2, 30
    mov     w3, 10
    ldr     x4, =hash_pan_state
    bl      ui_panel

    mov     w0, 14
    mov     w1, 2
    mov     w2, 78
    mov     w3, 4
    ldr     x4, =hash_pan_probe
    bl      ui_panel

    mov     w0, 18
    mov     w1, 4
    mov     w2, HASH_ROLE_DIM
    ldr     x3, =hash_lbl_formula
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

// hash_blank(w0 = row, w1 = column, w2 = run length)
hash_blank:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w2
    bl      ui_at
    ldr     x0, =hash_sp
    mov     w1, w19
    bl      ui_repeat

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// hash_flush() - push the drawing out before a delay
hash_flush:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     x0, 0
    bl      fflush

    ldp     fp, lr, [sp], 16
    ret

// hash_pause(w0 = milliseconds)
hash_pause:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0
    bl      hash_flush
    mov     w0, w19
    bl      delay_ms

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// hash_say(x0 = format, w1 = first value, w2 = second, w3 = third)
// The line that names what the probe just did. It wipes the row first,
// so a prompt or an older caption never shows through.
hash_say:
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
    bl      hash_blank

    mov     w0, 19
    mov     w1, 4
    bl      ui_at
    mov     w0, HASH_ROLE_TEXT
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

// hash_of(w0 = key) -> w0 = home bucket, k mod 13
hash_of:
    mov     w1, hash_buckets
    udiv    w2, w0, w1
    msub    w0, w2, w1, w0
    ret

// hash_role_of(w0 = slot) -> w0 = the colour role this slot wears now
hash_role_of:
    ldr     x1, =hash_hl_slot
    ldr     x2, =hash_hl_role
    mov     w3, 0

hash_role_scan:
    cmp     w3, 3
    b.ge    hash_role_rest
    ldr     w4, [x1, w3, sxtw 2]
    cmp     w4, w0
    b.eq    hash_role_hit
    add     w3, w3, 1
    b       hash_role_scan

hash_role_hit:
    ldr     w0, [x2, w3, sxtw 2]
    ret

hash_role_rest:
    mov     w0, HASH_ROLE_NODE
    ret

// hash_state_of(w0 = slot) -> w0 = free, used or tombstoned
hash_state_of:
    ldr     x1, =hash_state
    sxtw    x0, w0
    add     x1, x1, x0
    ldrb    w0, [x1]
    ret

// hash_find(w0 = key) -> w0 = slot holding it, or -1
// The silent probe. Insert uses it to refuse a duplicate before it has
// drawn anything.
hash_find:
    ldr     x1, =hash_keys
    ldr     x2, =hash_state
    mov     w3, hash_buckets
    udiv    w4, w0, w3
    msub    w4, w4, w3, w0                  // start at the home bucket
    mov     w5, 0

hash_find_loop:
    cmp     w5, hash_buckets
    b.ge    hash_find_miss
    sxtw    x4, w4
    add     x7, x2, x4
    ldrb    w6, [x7]
    cmp     w6, HASH_FREE
    b.eq    hash_find_miss                  // an empty slot ends every path
    cmp     w6, HASH_USED
    b.ne    hash_find_step
    ldr     w7, [x1, w4, sxtw 2]
    cmp     w7, w0
    b.eq    hash_find_hit

hash_find_step:
    add     w4, w4, 1
    cmp     w4, hash_buckets
    b.lt    hash_find_wrapped
    mov     w4, 0

hash_find_wrapped:
    add     w5, w5, 1
    b       hash_find_loop

hash_find_hit:
    mov     w0, w4
    ret

hash_find_miss:
    mov     w0, -1
    ret

// hash_next(w0 = slot) -> w0 = the slot linear probing tries next
hash_next:
    add     w0, w0, 1
    cmp     w0, hash_buckets
    b.lt    hash_next_done
    mov     w0, 0

hash_next_done:
    ret

// hash_draw_entry(w0 = slot) - one line of the bucket list: the slot
// number, what it holds, and where the key would have gone if it had
// found its own bucket free
hash_draw_entry:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    mov     w19, w0

    cmp     w19, 7
    b.lt    hash_entry_left
    add     w20, w19, 5                     // rows 5..10 for slots 7..12
    sub     w20, w20, 7
    mov     w21, 25
    b       hash_entry_place

hash_entry_left:
    add     w20, w19, 5                     // rows 5..11 for slots 0..6
    mov     w21, 4

hash_entry_place:
    mov     w0, w20
    mov     w1, w21
    bl      ui_at
    mov     w0, HASH_ROLE_KEY
    bl      th_fg
    ldr     x0, =hash_fmt_slot
    mov     w1, w19
    bl      printf
    bl      th_off

    mov     w0, w19
    bl      hash_role_of
    mov     w22, w0
    mov     w0, w19
    bl      hash_state_of
    mov     w23, w0

    mov     w0, w20
    add     w1, w21, 3
    bl      ui_at

    cmp     w22, HASH_ROLE_NODE
    b.ne    hash_entry_lit                  // the algorithm is touching it

    cmp     w23, HASH_USED
    b.eq    hash_entry_quiet_key
    cmp     w23, HASH_TOMB
    b.eq    hash_entry_quiet_tomb
    mov     w0, HASH_ROLE_FAINT
    b       hash_entry_paint

hash_entry_quiet_key:
    mov     w0, HASH_ROLE_NODE
    b       hash_entry_paint

hash_entry_quiet_tomb:
    mov     w0, HASH_ROLE_BAD
    b       hash_entry_paint

hash_entry_lit:
    mov     w0, w22
    bl      th_bg
    b       hash_entry_field

hash_entry_paint:
    bl      th_fg

hash_entry_field:
    cmp     w23, HASH_USED
    b.eq    hash_entry_show_key
    cmp     w23, HASH_TOMB
    b.eq    hash_entry_show_tomb
    ldr     x0, =hash_cell_free_w
    bl      printf
    b       hash_entry_close

hash_entry_show_tomb:
    ldr     x0, =hash_lbl_tomb_wide
    bl      printf
    b       hash_entry_close

hash_entry_show_key:
    ldr     x0, =hash_keys
    ldr     w1, [x0, w19, sxtw 2]
    ldr     x0, =hash_fmt_key
    bl      printf

hash_entry_close:
    bl      th_off

    // a key that did not land at home carries the bucket it came from
    cmp     w23, HASH_USED
    b.ne    hash_entry_done
    ldr     x0, =hash_keys
    ldr     w0, [x0, w19, sxtw 2]
    bl      hash_of
    mov     w24, w0
    cmp     w24, w19
    b.eq    hash_entry_done

    mov     w0, w20
    add     w1, w21, 9
    bl      ui_at
    mov     w0, HASH_ROLE_DIM
    bl      th_fg
    ldr     x0, =hash_fmt_from
    mov     w1, w24
    bl      printf
    bl      th_off

hash_entry_done:
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// hash_draw_cell(w0 = slot) - one cell of the flat strip, where the
// wrap from slot 12 back to slot 0 is a step to the left
hash_draw_cell:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     w19, w0
    mov     w0, 5
    mul     w20, w19, w0
    add     w20, w20, 8                     // column of this cell

    mov     w0, 15
    mov     w1, w20
    bl      ui_at
    mov     w0, HASH_ROLE_FAINT
    bl      th_fg
    ldr     x0, =hash_fmt_cell
    mov     w1, w19
    bl      printf
    bl      th_off

    mov     w0, w19
    bl      hash_role_of
    mov     w21, w0
    mov     w0, w19
    bl      hash_state_of
    mov     w22, w0

    mov     w0, 16
    mov     w1, w20
    bl      ui_at

    cmp     w21, HASH_ROLE_NODE
    b.ne    hash_cell_lit

    cmp     w22, HASH_USED
    b.eq    hash_cell_quiet_key
    cmp     w22, HASH_TOMB
    b.eq    hash_cell_quiet_tomb
    mov     w0, HASH_ROLE_FAINT
    b       hash_cell_paint

hash_cell_quiet_key:
    mov     w0, HASH_ROLE_NODE
    b       hash_cell_paint

hash_cell_quiet_tomb:
    mov     w0, HASH_ROLE_BAD
    b       hash_cell_paint

hash_cell_lit:
    mov     w0, w21
    bl      th_bg
    b       hash_cell_field

hash_cell_paint:
    bl      th_fg

hash_cell_field:
    cmp     w22, HASH_USED
    b.eq    hash_cell_show_key
    cmp     w22, HASH_TOMB
    b.eq    hash_cell_show_tomb
    ldr     x0, =hash_cell_free_t
    bl      printf
    b       hash_cell_close

hash_cell_show_tomb:
    ldr     x0, =hash_lbl_tomb_thin
    bl      printf
    b       hash_cell_close

hash_cell_show_key:
    ldr     x0, =hash_keys
    ldr     w1, [x0, w19, sxtw 2]
    ldr     x0, =hash_fmt_cell
    bl      printf

hash_cell_close:
    bl      th_off

    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// hash_draw_state() - the load factor as a bar of thirteen blocks, and
// the counts behind it
hash_draw_state:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    ldr     x0, =hash_count
    ldr     w19, [x0]
    ldr     x0, =hash_tombs
    ldr     w20, [x0]
    mov     w21, hash_buckets
    sub     w21, w21, w19
    sub     w21, w21, w20                   // slots still untouched

    mov     w0, 5
    mov     w1, 51
    mov     w2, HASH_ROLE_DIM
    ldr     x3, =hash_lbl_load
    bl      ui_text

    mov     w0, 6
    mov     w1, 51
    bl      ui_at

    mov     w22, 0
hash_state_bar:
    cmp     w22, hash_buckets
    b.ge    hash_state_bar_done
    cmp     w22, w19
    b.lt    hash_state_bar_full
    add     w0, w19, w20
    cmp     w22, w0
    b.lt    hash_state_bar_tomb
    mov     w0, HASH_ROLE_FAINT
    b       hash_state_bar_paint

hash_state_bar_full:
    mov     w0, HASH_ROLE_OK
    b       hash_state_bar_paint

hash_state_bar_tomb:
    mov     w0, HASH_ROLE_WARN

hash_state_bar_paint:
    bl      th_bg
    ldr     x0, =hash_sp
    mov     w1, 2
    bl      ui_repeat
    add     w22, w22, 1
    b       hash_state_bar

hash_state_bar_done:
    bl      th_off

    mov     w0, 7
    mov     w1, 51
    bl      ui_at
    mov     w0, HASH_ROLE_DIM
    bl      th_fg
    ldr     x0, =hash_fmt_counts
    mov     w1, w19
    mov     w2, w20
    mov     w3, w21
    bl      printf
    bl      th_off

    mov     w0, 9
    mov     w1, 51
    mov     w2, HASH_ROLE_DIM
    ldr     x3, =hash_lbl_pct
    bl      ui_text

    mov     w0, 100
    mul     w0, w19, w0
    mov     w1, hash_buckets
    udiv    w23, w0, w1                     // load factor as a percentage

    mov     w0, 9
    mov     w1, 63
    bl      ui_at
    mov     w0, HASH_ROLE_KEY
    bl      th_fg
    ldr     x0, =hash_fmt_pct
    mov     w1, w23
    bl      printf
    bl      th_off

    mov     w0, 10
    mov     w1, 51
    mov     w2, HASH_ROLE_DIM
    ldr     x3, =hash_lbl_coll
    bl      ui_text

    mov     w0, 10
    mov     w1, 63
    bl      ui_at
    mov     w0, HASH_ROLE_HOT
    bl      th_fg
    ldr     x0, =hash_collisions
    ldr     w1, [x0]
    ldr     x0, =hash_fmt_coll
    bl      printf
    bl      th_off

    mov     w0, 12
    mov     w1, 51
    mov     w2, HASH_ROLE_DIM
    ldr     x3, =hash_lbl_prime
    bl      ui_text

    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// hash_render(w0 = slot A, w1 = role A, w2 = slot B, w3 = role B,
//             w4 = slot C, w5 = role C)
// Repaints the bucket list, the state panel and the flat strip from the
// same thirteen slots. A slot of -1 means "nothing highlighted here".
hash_render:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x6, =hash_hl_slot
    str     w0, [x6]
    str     w2, [x6, 4]
    str     w4, [x6, 8]
    ldr     x6, =hash_hl_role
    str     w1, [x6]
    str     w3, [x6, 4]
    str     w5, [x6, 8]

    mov     w19, 5
hash_render_wipe:
    cmp     w19, 12
    b.gt    hash_render_strip
    mov     w0, w19
    mov     w1, 3
    mov     w2, 44
    bl      hash_blank
    mov     w0, w19
    mov     w1, 50
    mov     w2, 28
    bl      hash_blank
    add     w19, w19, 1
    b       hash_render_wipe

hash_render_strip:
    mov     w0, 16
    mov     w1, 3
    mov     w2, 76
    bl      hash_blank

    mov     w19, 0
hash_render_slots:
    cmp     w19, hash_buckets
    b.ge    hash_render_legend
    mov     w0, w19
    bl      hash_draw_entry
    mov     w0, w19
    bl      hash_draw_cell
    add     w19, w19, 1
    b       hash_render_slots

hash_render_legend:
    mov     w0, 12
    mov     w1, 4
    mov     w2, HASH_ROLE_DIM
    ldr     x3, =hash_lbl_rest
    bl      ui_text

    mov     w0, 12
    mov     w1, 14
    mov     w2, HASH_ROLE_NODE
    ldr     x3, =hash_lbl_akey
    bl      ui_text

    mov     w0, 12
    mov     w1, 22
    mov     w2, HASH_ROLE_BAD
    ldr     x3, =hash_lbl_tomb
    bl      ui_text

    mov     w0, 12
    mov     w1, 29
    mov     w2, HASH_ROLE_FAINT
    ldr     x3, =hash_lbl_free
    bl      ui_text

    bl      hash_draw_state

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// hash_rest() - repaint with nothing highlighted
hash_rest:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, -1
    mov     w1, 0
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      hash_render

    ldp     fp, lr, [sp], 16
    ret

// hash_ask(x0 = prompt) -> w0 = key, w1 = 1 when the key is usable
// One reader for all three operations: it refuses a closed stdin and a
// key outside the range the modulus is easy to check by hand.
hash_ask:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0

    mov     w0, 19
    mov     w1, 2
    mov     w2, 78
    bl      hash_blank
    mov     w0, 19
    mov     w1, 4
    mov     x2, x19
    bl      ui_prompt
    bl      hash_flush

    bl      read_int
    mov     w19, w0
    mov     w20, w1

    cmp     w20, 0
    b.eq    hash_ask_stop                   // stdin closed: walk out quietly

    cmp     w19, 0
    b.lt    hash_ask_range
    cmp     w19, 999
    b.gt    hash_ask_range

    mov     w0, w19
    mov     w1, 1
    b       hash_ask_done

hash_ask_range:
    ldr     x0, =hash_msg_range
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      hash_say
    mov     w0, 0
    mov     w1, 0
    b       hash_ask_done

hash_ask_stop:
    mov     w0, 19
    mov     w1, 2
    mov     w2, 78
    bl      hash_blank
    mov     w0, 0
    mov     w1, 0

hash_ask_done:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// hash_insert_interactive() - hash the key, then walk forward until a
// slot is free, counting every step the collisions cost
hash_insert_interactive:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    str     x25, [sp, 64]

    ldr     x0, =hash_scr_insert
    ldr     x1, =hash_hint_run
    ldr     x2, =hash_o1
    ldr     x3, =hash_o1
    ldr     x4, =hash_on
    ldr     x5, =hash_on
    bl      hash_frame
    bl      hash_rest

    ldr     x0, =hash_count
    ldr     w0, [x0]
    cmp     w0, hash_buckets
    b.ge    hash_insert_full

    ldr     x0, =hash_ask_insert
    bl      hash_ask
    cmp     w1, 0
    b.eq    hash_insert_done
    mov     w19, w0

    mov     w0, w19
    bl      hash_find
    mov     w20, w0
    cmp     w20, 0
    b.ge    hash_insert_dup

    mov     w0, w19
    bl      hash_of
    mov     w21, w0                         // home bucket
    mov     w20, w21                        // the slot being tested
    mov     w22, 0                          // probes so far

    mov     w0, w20
    mov     w1, HASH_ROLE_WARN
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      hash_render
    ldr     x0, =hash_fmt_hash
    mov     w1, w19
    mov     w2, w19
    mov     w3, w21
    bl      hash_say
    mov     w0, 950
    bl      hash_pause

hash_insert_probe:
    cmp     w22, hash_buckets
    b.ge    hash_insert_full                // cannot happen while a slot is free

    mov     w0, w20
    bl      hash_state_of
    mov     w23, w0
    cmp     w23, HASH_USED
    b.ne    hash_insert_land

    ldr     x24, =hash_collisions
    ldr     w0, [x24]
    add     w0, w0, 1
    str     w0, [x24]

    mov     w0, w20
    bl      hash_next
    mov     w25, w0

    mov     w0, w20
    mov     w1, HASH_ROLE_HOT
    mov     w2, w25
    mov     w3, HASH_ROLE_WARN
    mov     w4, -1
    mov     w5, 0
    bl      hash_render
    ldr     x24, =hash_keys
    ldr     w2, [x24, w20, sxtw 2]
    mov     w1, w20
    mov     w3, w25
    ldr     x0, =hash_fmt_taken
    bl      hash_say
    mov     w0, 850
    bl      hash_pause

    mov     w20, w25
    add     w22, w22, 1
    b       hash_insert_probe

hash_insert_land:
    ldr     x24, =hash_keys
    str     w19, [x24, w20, sxtw 2]
    ldr     x24, =hash_state
    sxtw    x20, w20
    add     x24, x24, x20
    mov     w0, HASH_USED
    strb    w0, [x24]

    ldr     x24, =hash_count
    ldr     w0, [x24]
    add     w0, w0, 1
    str     w0, [x24]

    cmp     w23, HASH_TOMB
    b.ne    hash_insert_settled
    ldr     x24, =hash_tombs
    ldr     w0, [x24]
    sub     w0, w0, 1
    str     w0, [x24]

hash_insert_settled:
    mov     w0, w20
    mov     w1, HASH_ROLE_OK
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      hash_render

    cmp     w23, HASH_TOMB
    b.eq    hash_insert_said_reuse
    ldr     x0, =hash_fmt_land
    b       hash_insert_say

hash_insert_said_reuse:
    ldr     x0, =hash_fmt_reuse

hash_insert_say:
    mov     w1, w20
    mov     w2, w19
    mov     w3, w22
    bl      hash_say
    b       hash_insert_done

hash_insert_dup:
    mov     w0, w20
    mov     w1, HASH_ROLE_WARN
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      hash_render
    ldr     x0, =hash_fmt_dup
    mov     w1, w19
    mov     w2, w20
    mov     w3, 0
    bl      hash_say
    b       hash_insert_done

hash_insert_full:
    ldr     x0, =hash_msg_full
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      hash_say

hash_insert_done:
    bl      hash_flush
    ldr     x25, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// hash_probe_anim(w0 = key) -> w0 = the slot holding it, or -1
// The animated lookup that search and delete both run.
hash_probe_anim:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    mov     w19, w0
    bl      hash_of
    mov     w20, w0                         // the slot being tested
    mov     w21, 0                          // probes so far

    mov     w0, w20
    mov     w1, HASH_ROLE_WARN
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      hash_render
    ldr     x0, =hash_fmt_hash
    mov     w1, w19
    mov     w2, w19
    mov     w3, w20
    bl      hash_say
    mov     w0, 950
    bl      hash_pause

hash_probe_step:
    cmp     w21, hash_buckets
    b.ge    hash_probe_spent

    mov     w0, w20
    bl      hash_state_of
    mov     w22, w0

    cmp     w22, HASH_FREE
    b.eq    hash_probe_hole
    cmp     w22, HASH_TOMB
    b.eq    hash_probe_tomb

    ldr     x24, =hash_keys
    ldr     w0, [x24, w20, sxtw 2]
    cmp     w0, w19
    b.eq    hash_probe_found

    mov     w0, w20
    bl      hash_next
    mov     w23, w0

    mov     w0, w20
    mov     w1, HASH_ROLE_HOT
    mov     w2, w23
    mov     w3, HASH_ROLE_WARN
    mov     w4, -1
    mov     w5, 0
    bl      hash_render
    ldr     x24, =hash_keys
    ldr     w2, [x24, w20, sxtw 2]
    mov     w1, w20
    mov     w3, w19
    ldr     x0, =hash_fmt_miss
    bl      hash_say
    mov     w0, 850
    bl      hash_pause

    mov     w20, w23
    add     w21, w21, 1
    b       hash_probe_step

hash_probe_tomb:
    mov     w0, w20
    bl      hash_next
    mov     w23, w0

    mov     w0, w20
    mov     w1, HASH_ROLE_WARN
    mov     w2, w23
    mov     w3, HASH_ROLE_WARN
    mov     w4, -1
    mov     w5, 0
    bl      hash_render
    ldr     x0, =hash_fmt_pass
    mov     w1, w20
    mov     w2, 0
    mov     w3, 0
    bl      hash_say
    mov     w0, 850
    bl      hash_pause

    mov     w20, w23
    add     w21, w21, 1
    b       hash_probe_step

hash_probe_hole:
    mov     w0, w20
    mov     w1, HASH_ROLE_BAD
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      hash_render
    ldr     x0, =hash_fmt_hole
    mov     w1, w20
    mov     w2, w19
    mov     w3, 0
    bl      hash_say
    mov     w0, -1
    b       hash_probe_ret

hash_probe_found:
    mov     w0, w20
    mov     w1, HASH_ROLE_OK
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      hash_render
    ldr     x0, =hash_fmt_found
    mov     w1, w19
    mov     w2, w20
    mov     w3, w21
    bl      hash_say
    mov     w0, w20
    b       hash_probe_ret

hash_probe_spent:
    bl      hash_rest
    ldr     x0, =hash_fmt_spent
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      hash_say
    mov     w0, -1

hash_probe_ret:
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// hash_search_interactive() - the same walk as insert, stopping at the
// key or at the first empty slot
hash_search_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =hash_scr_search
    ldr     x1, =hash_hint_run
    ldr     x2, =hash_o1
    ldr     x3, =hash_o1
    ldr     x4, =hash_on
    ldr     x5, =hash_on
    bl      hash_frame
    bl      hash_rest

    ldr     x0, =hash_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    hash_search_empty

    ldr     x0, =hash_ask_search
    bl      hash_ask
    cmp     w1, 0
    b.eq    hash_search_done
    mov     w19, w0

    mov     w0, w19
    bl      hash_probe_anim
    b       hash_search_done

hash_search_empty:
    ldr     x0, =hash_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      hash_say

hash_search_done:
    bl      hash_flush
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// hash_delete_interactive() - find the key, then leave a tombstone so
// the probe paths that run through this slot keep working
hash_delete_interactive:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    ldr     x0, =hash_scr_delete
    ldr     x1, =hash_hint_run
    ldr     x2, =hash_o1
    ldr     x3, =hash_o1
    ldr     x4, =hash_on
    ldr     x5, =hash_on
    bl      hash_frame
    bl      hash_rest

    ldr     x0, =hash_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    hash_delete_empty

    ldr     x0, =hash_ask_delete
    bl      hash_ask
    cmp     w1, 0
    b.eq    hash_delete_done
    mov     w19, w0

    mov     w0, w19
    bl      hash_probe_anim
    mov     w20, w0
    cmp     w20, 0
    b.lt    hash_delete_absent

    mov     w0, 900
    bl      hash_pause

    ldr     x21, =hash_state
    sxtw    x20, w20
    add     x21, x21, x20
    mov     w0, HASH_TOMB
    strb    w0, [x21]

    ldr     x21, =hash_count
    ldr     w0, [x21]
    sub     w0, w0, 1
    str     w0, [x21]
    ldr     x21, =hash_tombs
    ldr     w0, [x21]
    add     w0, w0, 1
    str     w0, [x21]

    mov     w0, w20
    mov     w1, HASH_ROLE_BAD
    mov     w2, -1
    mov     w3, 0
    mov     w4, -1
    mov     w5, 0
    bl      hash_render
    ldr     x0, =hash_fmt_removed
    mov     w1, w19
    mov     w2, w20
    mov     w3, 0
    bl      hash_say
    mov     w0, 1100
    bl      hash_pause

    ldr     x0, =hash_msg_tomb_why
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      hash_say
    b       hash_delete_done

hash_delete_absent:
    mov     w0, 900
    bl      hash_pause
    ldr     x0, =hash_fmt_absent
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      hash_say
    b       hash_delete_done

hash_delete_empty:
    ldr     x0, =hash_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      hash_say

hash_delete_done:
    bl      hash_flush
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// hash_show() - the table at rest
hash_show:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x0, =hash_scr_show
    ldr     x1, =hash_hint_run
    ldr     x2, =hash_o1
    ldr     x3, =hash_o1
    ldr     x4, =hash_on
    ldr     x5, =hash_on
    bl      hash_frame
    bl      hash_rest

    ldr     x0, =hash_count
    ldr     w19, [x0]
    ldr     x0, =hash_tombs
    ldr     w20, [x0]

    cmp     w19, 0
    b.le    hash_show_empty

    ldr     x0, =hash_fmt_state
    mov     w1, w19
    mov     w2, w20
    mov     w3, 0
    bl      hash_say
    b       hash_show_done

hash_show_empty:
    ldr     x0, =hash_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      hash_say

hash_show_done:
    bl      hash_flush
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// hash_clear_interactive() - thirteen empty slots again
hash_clear_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =hash_scr_clear
    ldr     x1, =hash_hint_run
    ldr     x2, =hash_o1
    ldr     x3, =hash_o1
    ldr     x4, =hash_on
    ldr     x5, =hash_on
    bl      hash_frame

    ldr     x0, =hash_state
    mov     w19, 0
hash_clear_loop:
    cmp     w19, hash_buckets
    b.ge    hash_clear_counts
    sxtw    x19, w19
    add     x1, x0, x19
    strb    wzr, [x1]
    add     w19, w19, 1
    b       hash_clear_loop

hash_clear_counts:
    ldr     x0, =hash_count
    str     wzr, [x0]
    ldr     x0, =hash_tombs
    str     wzr, [x0]
    ldr     x0, =hash_collisions
    str     wzr, [x0]

    bl      hash_rest
    ldr     x0, =hash_msg_cleared
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      hash_say
    bl      hash_flush

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret
