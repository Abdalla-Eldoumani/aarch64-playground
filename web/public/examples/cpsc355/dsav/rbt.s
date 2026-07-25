// rbt_viz.asm - a red-black tree, and the repair work that keeps it short
//
// A search tree only stays fast while it stays shallow, and nothing in a
// plain insert makes it stay shallow. This one pays a small, bounded
// price on every insert instead: recolour, and rotate at most twice. The
// three cases of that repair are the whole idea, so the insert screen
// stops on each one, paints the family it is looking at, and says in
// plain words what it is about to do and why.
//
// The rules, in the order they matter: the root is black; a red node
// never has a red child; every path from a node down to a nil leaf passes
// the same number of black nodes. The last one bounds the height, and the
// first two are what keep it true.

define(fp, x29)
define(lr, x30)

// node layout: value, links, parent, colour, and the flag a walk paints
    RB_DATA   = 0
    RB_LEFT   = 8
    RB_RIGHT  = 16
    RB_PARENT = 24
    RB_COLOR  = 32
    RB_SEEN   = 40
    RB_SIZE   = 48

// Colours are plain flags on the node, nothing to do with what is drawn
    RB_BLACK = 0
    RB_RED   = 1

// Role numbers mirror the UI_ROLE_* set in ui.asm. They are repeated here
// so this file also assembles on its own, the way the web build feeds it.
    RB_ROLE_TEXT   = 0
    RB_ROLE_DIM    = 1
    RB_ROLE_FAINT  = 2
    RB_ROLE_ACCENT = 3
    RB_ROLE_KEY    = 4
    RB_ROLE_OK     = 5
    RB_ROLE_WARN   = 6
    RB_ROLE_HOT    = 7
    RB_ROLE_BAD    = 8
    RB_ROLE_NODE   = 9

    RB_TOP_ROW   = 5                        // where the root sits
    RB_TOP_COL   = 38                       // the left edge of its cell
    RB_SPREAD    = 16                       // half the width of level one
    RB_LAST_LVL  = 4                        // deepest level with room to draw
    RB_ORDER_MAX = 60                       // columns the order strip may use

    .data
    .balign 8

rb_root:            .dword 0
rb_nil:             .dword 0                // one shared black leaf
rb_hl_node:         .dword 0, 0, 0, 0       // nodes wearing a state colour

    .balign 4
rb_node_count:      .word 0
rb_hl_role:         .word 0, 0, 0, 0
rb_order_len:       .word 0
rb_delay:           .word 600               // milliseconds between beats
rb_narrate:         .word 0                 // is anyone watching the repair?
rb_fix_steps:       .word 0                 // cases the last repair fired

rb_cell:            .skip 8                 // one value, formatted
rb_order:           .skip 96                // the visit order, as text

rb_sp:              .string " "
rb_dash:            .string "\xe2\x94\x80"
rb_tee:             .string "\xe2\x94\xb4"  // a parent with both children
rb_elbow_l:         .string "\xe2\x95\xad"  // down to the left child
rb_elbow_r:         .string "\xe2\x95\xae"  // down to the right child
rb_elbow_lo:        .string "\xe2\x95\xaf"  // a left child and nothing else
rb_elbow_ro:        .string "\xe2\x95\xb0"  // a right child and nothing else
rb_deeper:          .string "\xe2\x8b\xae"  // the tree carries on below

rb_fmt_cell:        .string "%2d"
rb_fmt_order:       .string "%d "
rb_fmt_stat:        .string "%d nodes  \xc2\xb7  height %d"

rb_scr_menu:        .string "red-black tree  \xc2\xb7  it rebalances itself"
rb_scr_insert:      .string "red-black tree  \xc2\xb7  insert, and the repair it triggers"
rb_scr_search:      .string "red-black tree  \xc2\xb7  search"
rb_scr_delete:      .string "red-black tree  \xc2\xb7  delete"
rb_scr_in:          .string "red-black tree  \xc2\xb7  inorder traversal"
rb_scr_sample:      .string "red-black tree  \xc2\xb7  build the sample tree"
rb_scr_show:        .string "red-black tree  \xc2\xb7  the tree right now"
rb_scr_verify:      .string "red-black tree  \xc2\xb7  check the rules"

rb_pan_ops:         .string "operations"
rb_pan_tree:        .string "tree"
rb_pan_rules:       .string "the rules, measured against this tree"

rb_hint_menu:       .string "pick an operation  \xc2\xb7  0 goes back to the main menu"
rb_hint_run:        .string "enter returns to the tree menu  \xc2\xb7  red is a node colour, not a state"
rb_hint_rules:      .string "enter returns to the tree menu  \xc2\xb7  every check runs over the live tree"

rb_opt_1:           .string "insert a value and watch the tree rebalance"
rb_opt_2:           .string "search for a value, one comparison a level"
rb_opt_3:           .string "delete a value and repair the black heights"
rb_opt_4:           .string "inorder: sorted order, off a tree that stays short"
rb_opt_5:           .string "build the sample tree, one insert at a time"
rb_opt_6:           .string "show the tree as it stands"
rb_opt_7:           .string "check the five rules against the tree"
rb_opt_0:           .string "back to the main menu"

rb_key_1:           .string "1"
rb_key_2:           .string "2"
rb_key_3:           .string "3"
rb_key_4:           .string "4"
rb_key_5:           .string "5"
rb_key_6:           .string "6"
rb_key_7:           .string "7"
rb_key_0:           .string "0"

rb_lg_red:          .string "red"
rb_lg_black:        .string "black"
rb_lg_new:          .string "new"
rb_lg_parent:       .string "parent"
rb_lg_gp:           .string "grandparent"
rb_lg_uncle:        .string "uncle"

rb_lbl_rule:        .string "a red node never has a red child, and every path holds the same blacks"
rb_lbl_order:       .string "order"
rb_lbl_root:        .string "root"
rb_lbl_none:        .string "no root yet"
rb_lbl_yes:         .string "holds"
rb_lbl_no:          .string "broken"

rb_rule_1:          .string "every node is either red or black"
rb_rule_2:          .string "the root is black"
rb_rule_3:          .string "every empty branch ends at the same black nil leaf"
rb_rule_4:          .string "a red node has no red child"
rb_rule_5:          .string "every path down to a leaf passes the same number of blacks"

rb_ask_choice:      .string "choice "
rb_ask_insert:      .string "value to insert (0 to 99)  "
rb_ask_delete:      .string "value to delete  "
rb_ask_search:      .string "value to look for  "

rb_o1:              .string "O(1)"
rb_on:              .string "O(n)"
rb_oh:              .string "O(h)"
rb_ologn:           .string "O(log n)"

rb_msg_empty:       .string "the tree is empty. insert a value, or build the sample tree"
rb_msg_range:       .string "values run from 0 to 99, so every node stays two digits wide"
rb_msg_alloc:       .string "the allocator refused a node, so nothing was inserted"
rb_msg_start:       .string "a new node always arrives red, so no black height changes yet"
rb_msg_root:        .string "the tree was empty, so %d becomes the root and is painted black"

rb_msg_case1:       .string "the uncle is red too, so repaint parent and uncle black, grandparent red"
rb_msg_case2:       .string "the new node bends inward, so one rotation straightens the run first"
rb_msg_case3:       .string "the run is straight, so recolour and rotate once at the grandparent"
rb_msg_fixed:       .string "no red node has a red child again, and the root is black"
rb_msg_nofix:       .string "the parent was already black, so nothing had to be repaired"

rb_fmt_cmp_lt:      .string "%d is smaller than %d, so the descent goes left"
rb_fmt_cmp_gt:      .string "%d is larger than %d, so the descent goes right"
rb_fmt_dup:         .string "%d is already in the tree, and a search tree keeps one of each"
rb_fmt_arrived:     .string "%d hangs off %d, red, which is the colour that changes nothing"
rb_fmt_placed:      .string "inserted %d  \xc2\xb7  comparisons %d  \xc2\xb7  repair steps %d"
rb_fmt_found:       .string "found %d  \xc2\xb7  comparisons %d  \xc2\xb7  depth %d"
rb_fmt_missing:     .string "the descent ran out of tree, so %d is not in here"
rb_fmt_del_red:     .string "%d is red, so removing it changes no black height at all"
rb_fmt_del_black:   .string "%d is black, so its path ends one black short and needs repair"
rb_fmt_del_two:     .string "%d has two children, so its successor moves up and keeps the colour"
rb_fmt_deleted:     .string "deleted %d, and every path still counts the same number of blacks"
rb_fmt_visit:       .string "visit %d"
rb_fmt_done_in:     .string "sorted order again, but off a tree that cannot go lopsided"
rb_fmt_sample:      .string "eight values, and not one of them left the tree taller than it had to be"
rb_fmt_state:       .string "%d nodes, %d levels. a plain search tree could be %d levels here"
rb_fmt_facts:       .string "%d nodes  \xc2\xb7  height %d  \xc2\xb7  black height %d"
rb_msg_all_ok:      .string "every rule holds, so no path down can be more than twice the shortest"
rb_msg_broken:      .string "a rule is broken, which should not happen: the repair missed a case"

    .text
    .balign 4

// ---------------------------------------------------------- the algorithm

// rb_init_nil() - allocate the shared black nil sentinel (safe to call again)
    .global rb_init_nil
rb_init_nil:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =rb_nil
    ldr     x1, [x0]
    cbnz    x1, rb_init_nil_done

    mov     x0, RB_SIZE
    bl      malloc
    cbz     x0, rb_init_nil_done

    mov     x1, 0
    str     x1, [x0, RB_DATA]
    str     x1, [x0, RB_LEFT]
    str     x1, [x0, RB_RIGHT]
    str     x1, [x0, RB_PARENT]
    mov     w1, RB_BLACK
    strb    w1, [x0, RB_COLOR]
    str     xzr, [x0, RB_SEEN]

    ldr     x1, =rb_nil
    str     x0, [x1]

rb_init_nil_done:
    ldp     fp, lr, [sp], 16
    ret

// rb_create_node(w0 = value) -> x0 = new red node with nil children
    .global rb_create_node
rb_create_node:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     w19, w0

    bl      rb_init_nil

    mov     x0, RB_SIZE
    bl      malloc
    cbz     x0, rb_create_fail

    str     w19, [x0, RB_DATA]

    ldr     x1, =rb_nil
    ldr     x1, [x1]
    str     x1, [x0, RB_LEFT]
    str     x1, [x0, RB_RIGHT]

    mov     x1, 0
    str     x1, [x0, RB_PARENT]

    mov     w1, RB_RED
    strb    w1, [x0, RB_COLOR]
    str     xzr, [x0, RB_SEEN]

rb_create_fail:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_get_color(x0 = node) -> w0 = color; nil and null read as black
    .global rb_get_color
rb_get_color:
    ldr     x1, =rb_nil
    ldr     x1, [x1]
    cmp     x0, x1
    b.eq    rb_get_color_nil
    cbz     x0, rb_get_color_nil

    ldrb    w0, [x0, RB_COLOR]
    ret

rb_get_color_nil:
    mov     w0, RB_BLACK
    ret

// rb_set_color(x0 = node, w1 = color) - does nothing for nil or null
    .global rb_set_color
rb_set_color:
    ldr     x2, =rb_nil
    ldr     x2, [x2]
    cmp     x0, x2
    b.eq    rb_set_color_done
    cbz     x0, rb_set_color_done

    strb    w1, [x0, RB_COLOR]

rb_set_color_done:
    ret

// rb_rotate_left(x0 = pivot) - the right child takes over the pivot slot
    .global rb_rotate_left
rb_rotate_left:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     x19, x0

    ldr     x20, [x19, RB_RIGHT]
    cbz     x20, rotate_left_done

    ldr     x21, [x20, RB_LEFT]
    str     x21, [x19, RB_RIGHT]

    ldr     x22, =rb_nil
    ldr     x22, [x22]
    cmp     x21, x22
    b.eq    rotate_left_skip_b_parent
    str     x19, [x21, RB_PARENT]

rotate_left_skip_b_parent:
    ldr     x21, [x19, RB_PARENT]
    str     x21, [x20, RB_PARENT]

    cbz     x21, rotate_left_at_root
    ldr     x22, [x21, RB_LEFT]
    cmp     x22, x19
    b.eq    rotate_left_x_was_left

    str     x20, [x21, RB_RIGHT]
    b       rotate_left_finish

rotate_left_x_was_left:
    str     x20, [x21, RB_LEFT]
    b       rotate_left_finish

rotate_left_at_root:
    ldr     x21, =rb_root
    str     x20, [x21]

rotate_left_finish:
    str     x19, [x20, RB_LEFT]
    str     x20, [x19, RB_PARENT]

rotate_left_done:
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// rb_rotate_right(x0 = pivot) - the left child takes over the pivot slot
    .global rb_rotate_right
rb_rotate_right:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     x19, x0

    ldr     x20, [x19, RB_LEFT]
    cbz     x20, rotate_right_done

    ldr     x21, [x20, RB_RIGHT]
    str     x21, [x19, RB_LEFT]

    ldr     x22, =rb_nil
    ldr     x22, [x22]
    cmp     x21, x22
    b.eq    rotate_right_skip_b_parent
    str     x19, [x21, RB_PARENT]

rotate_right_skip_b_parent:
    ldr     x21, [x19, RB_PARENT]
    str     x21, [x20, RB_PARENT]

    cbz     x21, rotate_right_at_root
    ldr     x22, [x21, RB_LEFT]
    cmp     x22, x19
    b.eq    rotate_right_y_was_left

    str     x20, [x21, RB_RIGHT]
    b       rotate_right_finish

rotate_right_y_was_left:
    str     x20, [x21, RB_LEFT]
    b       rotate_right_finish

rotate_right_at_root:
    ldr     x21, =rb_root
    str     x20, [x21]

rotate_right_finish:
    str     x19, [x20, RB_RIGHT]
    str     x20, [x19, RB_PARENT]

rotate_right_done:
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// rb_insert_fixup(x0 = new node) - recolor and rotate until the red rules hold
    .global rb_insert_fixup
rb_insert_fixup:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    mov     x19, x0

rb_fix_loop:
    ldr     x20, [x19, RB_PARENT]
    cbz     x20, rb_fix_done
    ldrb    w0, [x20, RB_COLOR]
    cmp     w0, RB_BLACK
    b.eq    rb_fix_done

    ldr     x21, [x20, RB_PARENT]

    ldr     x22, [x21, RB_LEFT]
    cmp     x20, x22
    b.eq    rb_fix_parent_is_left

rb_fix_parent_is_right:
    ldr     x23, [x21, RB_LEFT]
    ldrb    w0, [x23, RB_COLOR]
    cmp     w0, RB_RED
    b.eq    rb_fix_case1_right

    ldr     x24, [x20, RB_LEFT]
    cmp     x19, x24
    b.eq    rb_fix_case2_right

rb_fix_case3_right:
    ldr     x0, =rb_msg_case3
    bl      rb_note_case
    mov     w1, RB_BLACK
    strb    w1, [x20, RB_COLOR]
    mov     w1, RB_RED
    strb    w1, [x21, RB_COLOR]
    mov     x0, x21
    bl      rb_rotate_left
    b       rb_fix_done

rb_fix_case2_right:
    ldr     x0, =rb_msg_case2
    bl      rb_note_case
    mov     x19, x20
    mov     x0, x20
    bl      rb_rotate_right
    b       rb_fix_loop

rb_fix_case1_right:
    ldr     x0, =rb_msg_case1
    bl      rb_note_case
    mov     w1, RB_BLACK
    strb    w1, [x20, RB_COLOR]
    strb    w1, [x23, RB_COLOR]
    mov     w1, RB_RED
    strb    w1, [x21, RB_COLOR]
    mov     x19, x21
    b       rb_fix_loop

rb_fix_parent_is_left:
    ldr     x23, [x21, RB_RIGHT]
    ldrb    w0, [x23, RB_COLOR]
    cmp     w0, RB_RED
    b.eq    rb_fix_case1_left

    ldr     x24, [x20, RB_RIGHT]
    cmp     x19, x24
    b.eq    rb_fix_case2_left

rb_fix_case3_left:
    ldr     x0, =rb_msg_case3
    bl      rb_note_case
    mov     w1, RB_BLACK
    strb    w1, [x20, RB_COLOR]
    mov     w1, RB_RED
    strb    w1, [x21, RB_COLOR]
    mov     x0, x21
    bl      rb_rotate_right
    b       rb_fix_done

rb_fix_case2_left:
    ldr     x0, =rb_msg_case2
    bl      rb_note_case
    mov     x19, x20
    mov     x0, x20
    bl      rb_rotate_left
    b       rb_fix_loop

rb_fix_case1_left:
    ldr     x0, =rb_msg_case1
    bl      rb_note_case
    mov     w1, RB_BLACK
    strb    w1, [x20, RB_COLOR]
    strb    w1, [x23, RB_COLOR]
    mov     w1, RB_RED
    strb    w1, [x21, RB_COLOR]
    mov     x19, x21
    b       rb_fix_loop

rb_fix_done:
    ldr     x0, =rb_root
    ldr     x0, [x0]
    mov     w1, RB_BLACK
    bl      rb_set_color
    bl      rb_note_settled

    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// rb_insert(x0 = &root, w1 = value) -> x0 = root, w1 = 1 if inserted
    .global rb_insert
rb_insert:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]

    mov     x19, x0
    mov     w20, w1
    mov     w26, 0                       // nothing is inserted until it is

    mov     w0, w20
    bl      rb_create_node
    mov     x24, x0
    cbz     x24, rb_insert_done

    ldr     x21, [x19]
    ldr     x25, =rb_nil
    ldr     x25, [x25]

    cmp     x21, x25
    b.eq    rb_insert_as_root
    cbz     x21, rb_insert_as_root

    mov     x22, 0
rb_insert_loop:
    mov     x22, x21
    ldr     w0, [x21, RB_DATA]
    cmp     w20, w0
    b.eq    rb_insert_duplicate
    b.lt    rb_insert_go_left

rb_insert_go_right:
    ldr     x21, [x21, RB_RIGHT]
    cmp     x21, x25
    b.eq    rb_insert_right_child
    cbz     x21, rb_insert_right_child
    b       rb_insert_loop

rb_insert_go_left:
    ldr     x21, [x21, RB_LEFT]
    cmp     x21, x25
    b.eq    rb_insert_left_child
    cbz     x21, rb_insert_left_child
    b       rb_insert_loop

rb_insert_right_child:
    str     x24, [x22, RB_RIGHT]
    str     x22, [x24, RB_PARENT]
    b       rb_insert_fixup_call

rb_insert_left_child:
    str     x24, [x22, RB_LEFT]
    str     x22, [x24, RB_PARENT]
    b       rb_insert_fixup_call

rb_insert_as_root:
    str     x24, [x19]
    mov     w1, RB_BLACK
    strb    w1, [x24, RB_COLOR]
    b       rb_insert_success

rb_insert_duplicate:
    mov     x0, x24
    bl      free
    mov     w26, 0
    ldr     x21, [x19]
    b       rb_insert_done

rb_insert_fixup_call:
    mov     x0, x24
    bl      rb_insert_fixup

rb_insert_success:
    ldr     x0, =rb_node_count
    ldr     w1, [x0]
    add     w1, w1, 1
    str     w1, [x0]
    ldr     x21, [x19]
    mov     w26, 1

rb_insert_done:
    mov     x0, x21
    mov     w1, w26
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// rb_search(x0 = root, w1 = value) -> x0 = matching node or 0
    .global rb_search
rb_search:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x2, =rb_nil
    ldr     x2, [x2]

rb_search_loop:
    cmp     x0, x2
    b.eq    rb_search_not_found
    cbz     x0, rb_search_not_found

    ldr     w3, [x0, RB_DATA]
    cmp     w1, w3
    b.eq    rb_search_found
    b.lt    rb_search_left

rb_search_right:
    ldr     x0, [x0, RB_RIGHT]
    b       rb_search_loop

rb_search_left:
    ldr     x0, [x0, RB_LEFT]
    b       rb_search_loop

rb_search_not_found:
    mov     x0, 0

rb_search_found:
    ldp     fp, lr, [sp], 16
    ret

// rb_minimum(x0 = node) -> x0 = leftmost node of the subtree
    .global rb_minimum
rb_minimum:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0

    ldr     x1, =rb_nil
    ldr     x1, [x1]

rb_min_loop:
    ldr     x2, [x19, RB_LEFT]
    cmp     x2, x1
    b.eq    rb_min_done
    cbz     x2, rb_min_done
    mov     x19, x2
    b       rb_min_loop

rb_min_done:
    mov     x0, x19
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_transplant(x0 = u, x1 = v) - splice subtree v into the slot u held
    .global rb_transplant
rb_transplant:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0                      // x19 = u
    mov     x20, x1                      // x20 = v

    ldr     x2, [x19, RB_PARENT]
    cbz     x2, rb_transplant_root

    ldr     x3, [x2, RB_LEFT]
    cmp     x19, x3
    b.eq    rb_transplant_left_child

rb_transplant_right_child:
    str     x20, [x2, RB_RIGHT]
    b       rb_transplant_set_parent

rb_transplant_left_child:
    str     x20, [x2, RB_LEFT]
    b       rb_transplant_set_parent

rb_transplant_root:
    ldr     x2, =rb_root
    str     x20, [x2]

rb_transplant_set_parent:
    // v takes over the parent link even when v is the nil sentinel: the
    // delete fixup climbs from x through this pointer.
    ldr     x2, [x19, RB_PARENT]
    str     x2, [x20, RB_PARENT]

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_delete_fixup(x0 = x) - rebalance after removing a black node
    .global rb_delete_fixup
rb_delete_fixup:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    str     x25, [sp, 64]

    mov     x19, x0                      // x19 = x (fixup node)

    ldr     x25, =rb_nil
    ldr     x25, [x25]

rb_delete_fixup_loop:
    ldr     x0, =rb_root
    ldr     x0, [x0]
    cmp     x19, x0
    b.eq    rb_delete_fixup_done

    mov     x0, x19
    bl      rb_get_color
    cmp     w0, RB_RED
    b.eq    rb_delete_fixup_done

    ldr     x20, [x19, RB_PARENT]
    ldr     x21, [x20, RB_LEFT]
    cmp     x19, x21
    b.eq    rb_delete_fixup_left_child

rb_delete_fixup_right_child:
    ldr     x21, [x20, RB_LEFT]     // x21 = sibling

    mov     x0, x21
    bl      rb_get_color
    cmp     w0, RB_RED
    b.eq    rb_delete_fixup_case1_right

    ldr     x22, [x21, RB_RIGHT]
    mov     x0, x22
    bl      rb_get_color
    cmp     w0, RB_RED
    b.eq    rb_delete_fixup_case4_right

    ldr     x22, [x21, RB_LEFT]
    mov     x0, x22
    bl      rb_get_color
    cmp     w0, RB_RED
    b.eq    rb_delete_fixup_case3_right

rb_delete_fixup_case2_right:
    mov     x0, x21
    mov     w1, RB_RED
    bl      rb_set_color
    mov     x19, x20
    b       rb_delete_fixup_loop

rb_delete_fixup_case3_right:
    mov     x0, x22
    mov     w1, RB_BLACK
    bl      rb_set_color
    mov     x0, x21
    mov     w1, RB_RED
    bl      rb_set_color
    mov     x0, x21
    bl      rb_rotate_right
    ldr     x21, [x20, RB_LEFT]

rb_delete_fixup_case4_right:
    mov     x0, x20
    bl      rb_get_color
    mov     w1, w0
    mov     x0, x21
    bl      rb_set_color
    mov     x0, x20
    mov     w1, RB_BLACK
    bl      rb_set_color
    ldr     x22, [x21, RB_RIGHT]
    mov     x0, x22
    mov     w1, RB_BLACK
    bl      rb_set_color
    mov     x0, x20
    bl      rb_rotate_right
    b       rb_delete_fixup_done

rb_delete_fixup_case1_right:
    mov     x0, x21
    mov     w1, RB_BLACK
    bl      rb_set_color
    mov     x0, x20
    mov     w1, RB_RED
    bl      rb_set_color
    mov     x0, x20
    bl      rb_rotate_right
    ldr     x21, [x20, RB_LEFT]
    b       rb_delete_fixup_right_child

rb_delete_fixup_left_child:
    ldr     x21, [x20, RB_RIGHT]    // x21 = sibling

    mov     x0, x21
    bl      rb_get_color
    cmp     w0, RB_RED
    b.eq    rb_delete_fixup_case1_left

    ldr     x22, [x21, RB_LEFT]
    mov     x0, x22
    bl      rb_get_color
    cmp     w0, RB_RED
    b.eq    rb_delete_fixup_case4_left

    ldr     x22, [x21, RB_RIGHT]
    mov     x0, x22
    bl      rb_get_color
    cmp     w0, RB_RED
    b.eq    rb_delete_fixup_case3_left

rb_delete_fixup_case2_left:
    mov     x0, x21
    mov     w1, RB_RED
    bl      rb_set_color
    mov     x19, x20
    b       rb_delete_fixup_loop

rb_delete_fixup_case3_left:
    mov     x0, x22
    mov     w1, RB_BLACK
    bl      rb_set_color
    mov     x0, x21
    mov     w1, RB_RED
    bl      rb_set_color
    mov     x0, x21
    bl      rb_rotate_left
    ldr     x21, [x20, RB_RIGHT]

rb_delete_fixup_case4_left:
    mov     x0, x20
    bl      rb_get_color
    mov     w1, w0
    mov     x0, x21
    bl      rb_set_color
    mov     x0, x20
    mov     w1, RB_BLACK
    bl      rb_set_color
    ldr     x22, [x21, RB_LEFT]
    mov     x0, x22
    mov     w1, RB_BLACK
    bl      rb_set_color
    mov     x0, x20
    bl      rb_rotate_left
    b       rb_delete_fixup_done

rb_delete_fixup_case1_left:
    mov     x0, x21
    mov     w1, RB_BLACK
    bl      rb_set_color
    mov     x0, x20
    mov     w1, RB_RED
    bl      rb_set_color
    mov     x0, x20
    bl      rb_rotate_left
    ldr     x21, [x20, RB_RIGHT]
    b       rb_delete_fixup_left_child

rb_delete_fixup_done:
    mov     x0, x19
    mov     w1, RB_BLACK
    bl      rb_set_color

    ldr     x25, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// rb_delete(x0 = &root, w1 = value) -> w0 = 1 if deleted
    .global rb_delete
rb_delete:
    stp     fp, lr, [sp, -96]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]
    str     x27, [sp, 80]

    mov     x19, x0                      // x19 = &root
    mov     w20, w1                      // w20 = value to delete

    ldr     x0, [x19]
    mov     w1, w20
    bl      rb_search
    mov     x21, x0                      // x21 = node to delete
    cbz     x21, rb_delete_not_found

    ldr     x25, =rb_nil
    ldr     x25, [x25]

    mov     x22, x21                     // x22 = y (node to splice out)
    mov     x0, x21
    bl      rb_get_color
    mov     w23, w0                      // the colour y wore before all this

    ldr     x24, [x21, RB_LEFT]
    cmp     x24, x25
    b.eq    rb_delete_no_left

    ldr     x26, [x21, RB_RIGHT]
    cmp     x26, x25
    b.eq    rb_delete_no_right

rb_delete_two_children:
    ldr     x0, [x21, RB_RIGHT]
    bl      rb_minimum
    mov     x22, x0

    mov     x0, x22
    bl      rb_get_color
    mov     w23, w0

    ldr     x24, [x22, RB_RIGHT]

    ldr     x26, [x22, RB_PARENT]
    cmp     x26, x21
    b.eq    rb_delete_successor_is_child

    mov     x0, x22
    mov     x1, x24
    bl      rb_transplant

    ldr     x26, [x21, RB_RIGHT]
    str     x26, [x22, RB_RIGHT]
    str     x22, [x26, RB_PARENT]

rb_delete_successor_is_child:
    // x may be the nil sentinel; it still needs y as its parent for
    // the fixup climb.
    str     x22, [x24, RB_PARENT]

    mov     x0, x21
    mov     x1, x22
    bl      rb_transplant

    ldr     x26, [x21, RB_LEFT]
    str     x26, [x22, RB_LEFT]
    str     x22, [x26, RB_PARENT]

    ldrb    w0, [x21, RB_COLOR]
    strb    w0, [x22, RB_COLOR]

    b       rb_delete_fixup_check

rb_delete_no_left:
    ldr     x24, [x21, RB_RIGHT]
    mov     x0, x21
    mov     x1, x24
    bl      rb_transplant
    b       rb_delete_fixup_check

rb_delete_no_right:
    // x24 already holds the left child; splice it up (x26 is nil here)
    mov     x0, x21
    mov     x1, x24
    bl      rb_transplant

rb_delete_fixup_check:
    cmp     w23, RB_BLACK
    b.ne    rb_delete_success

    mov     x0, x24
    bl      rb_delete_fixup

rb_delete_success:
    mov     x0, x21
    bl      free

    ldr     x0, =rb_node_count
    ldr     w1, [x0]
    sub     w1, w1, 1
    str     w1, [x0]

    mov     w0, 1
    b       rb_delete_done

rb_delete_not_found:
    mov     w0, 0

rb_delete_done:
    ldr     x27, [sp, 80]
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96
    ret

// rb_free_all(x0 = &root) - free the whole tree and zero the count
    .global rb_free_all
rb_free_all:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0
    ldr     x0, [x19]

    // free only a real tree (not null, not the sentinel)
    cbz     x0, rb_free_skip
    ldr     x1, =rb_nil
    ldr     x1, [x1]
    cmp     x0, x1
    b.eq    rb_free_skip

    bl      rb_free_recursive

rb_free_skip:
    mov     x0, 0
    str     x0, [x19]

    ldr     x0, =rb_node_count
    mov     w1, 0
    str     w1, [x0]

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_free_recursive(x0 = node) - post-order free; the shared sentinel stays
rb_free_recursive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0

    ldr     x20, =rb_nil
    ldr     x20, [x20]
    cmp     x19, x20
    b.eq    rb_free_rec_done
    cbz     x19, rb_free_rec_done

    ldr     x0, [x19, RB_LEFT]
    cmp     x0, x20
    b.eq    rb_free_skip_left
    bl      rb_free_recursive

rb_free_skip_left:
    ldr     x0, [x19, RB_RIGHT]
    ldr     x20, =rb_nil
    ldr     x20, [x20]
    cmp     x0, x20
    b.eq    rb_free_skip_right
    bl      rb_free_recursive

rb_free_skip_right:
    mov     x0, x19
    bl      free

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32

rb_free_rec_done:
    ret

// ------------------------------------------------------- the small parts

// rb_is_nil(x0 = pointer) -> w0 = 1 when it is the sentinel or nothing
rb_is_nil:
    cbz     x0, rb_is_nil_yes
    ldr     x1, =rb_nil
    ldr     x1, [x1]
    cmp     x0, x1
    b.eq    rb_is_nil_yes
    mov     w0, 0
    ret

rb_is_nil_yes:
    mov     w0, 1
    ret

// rb_child(x0 = node, w1 = offset of the link) -> x0 = the real child, or
// 0 when the branch ends at the sentinel. Everything that walks the tree
// goes through here, so nil is handled once instead of at every step.
rb_child:
    ldr     x2, [x0, w1, sxtw]
    ldr     x3, =rb_nil
    ldr     x3, [x3]
    cmp     x2, x3
    b.eq    rb_child_none
    mov     x0, x2
    ret

rb_child_none:
    mov     x0, 0
    ret

// rb_height_of(x0 = node) -> w0 = levels below it, itself included
rb_height_of:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0
    bl      rb_is_nil
    cbnz    w0, rb_height_none

    mov     x0, x19
    mov     w1, RB_LEFT
    bl      rb_child
    bl      rb_height_of
    mov     w20, w0

    mov     x0, x19
    mov     w1, RB_RIGHT
    bl      rb_child
    bl      rb_height_of

    cmp     w20, w0
    csel    w0, w20, w0, gt
    add     w0, w0, 1
    b       rb_height_out

rb_height_none:
    mov     w0, 0

rb_height_out:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_size_of(x0 = node) -> w0 = how many real nodes hang off it
// The stats line counts the tree rather than reading rb_node_count,
// because the counter is only bumped once the repair has finished and the
// repair is exactly when someone is reading the screen.
rb_size_of:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0
    bl      rb_is_nil
    cbnz    w0, rb_size_none

    mov     x0, x19
    mov     w1, RB_LEFT
    bl      rb_child
    bl      rb_size_of
    mov     w20, w0

    mov     x0, x19
    mov     w1, RB_RIGHT
    bl      rb_child
    bl      rb_size_of

    add     w0, w0, w20
    add     w0, w0, 1
    b       rb_size_out

rb_size_none:
    mov     w0, 0

rb_size_out:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_black_height(x0 = node) -> w0 = blacks on any path down from it, or
// -1 when two paths disagree. This is the rule that bounds the height, so
// the verify screen measures it rather than asserting it.
rb_black_height:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0
    bl      rb_is_nil
    cbnz    w0, rb_black_leaf

    mov     x0, x19
    mov     w1, RB_LEFT
    bl      rb_child
    bl      rb_black_height
    mov     w20, w0
    cmp     w20, 0
    b.lt    rb_black_bad

    mov     x0, x19
    mov     w1, RB_RIGHT
    bl      rb_child
    bl      rb_black_height
    cmp     w0, 0
    b.lt    rb_black_bad
    cmp     w0, w20
    b.ne    rb_black_bad

    ldrb    w1, [x19, RB_COLOR]
    cmp     w1, RB_BLACK
    b.ne    rb_black_out
    add     w0, w0, 1
    b       rb_black_out

rb_black_leaf:
    mov     w0, 1                           // the nil leaf counts itself
    b       rb_black_out

rb_black_bad:
    mov     w0, -1

rb_black_out:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_no_red_red(x0 = node) -> w0 = 1 when no red node has a red child
rb_no_red_red:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0
    bl      rb_is_nil
    cbnz    w0, rb_red_ok

    ldrb    w20, [x19, RB_COLOR]

    mov     x0, x19
    mov     w1, RB_LEFT
    bl      rb_child
    cbz     x0, rb_red_left_done
    cmp     w20, RB_RED
    b.ne    rb_red_left_walk
    ldrb    w1, [x0, RB_COLOR]
    cmp     w1, RB_RED
    b.eq    rb_red_bad

rb_red_left_walk:
    bl      rb_no_red_red
    cbz     w0, rb_red_bad

rb_red_left_done:
    mov     x0, x19
    mov     w1, RB_RIGHT
    bl      rb_child
    cbz     x0, rb_red_ok
    cmp     w20, RB_RED
    b.ne    rb_red_right_walk
    ldrb    w1, [x0, RB_COLOR]
    cmp     w1, RB_RED
    b.eq    rb_red_bad

rb_red_right_walk:
    bl      rb_no_red_red
    cbz     w0, rb_red_bad

rb_red_ok:
    mov     w0, 1
    b       rb_red_out

rb_red_bad:
    mov     w0, 0

rb_red_out:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_depth_of(x0 = node, w1 = value) -> w0 = how far down the value sits
rb_depth_of:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     x19, x0
    mov     w20, w1
    mov     w21, 0

rb_depth_step:
    mov     x0, x19
    bl      rb_is_nil
    cbnz    w0, rb_depth_out

    ldr     w0, [x19, RB_DATA]
    cmp     w20, w0
    b.eq    rb_depth_out
    add     w21, w21, 1
    b.lt    rb_depth_left

    mov     x0, x19
    mov     w1, RB_RIGHT
    bl      rb_child
    mov     x19, x0
    b       rb_depth_step

rb_depth_left:
    mov     x0, x19
    mov     w1, RB_LEFT
    bl      rb_child
    mov     x19, x0
    b       rb_depth_step

rb_depth_out:
    mov     w0, w21
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// rb_clear_seen(x0 = node) - drop the paint a previous walk left
rb_clear_seen:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0
    bl      rb_is_nil
    cbnz    w0, rb_clear_seen_done

    str     xzr, [x19, RB_SEEN]
    mov     x0, x19
    mov     w1, RB_LEFT
    bl      rb_child
    bl      rb_clear_seen
    mov     x0, x19
    mov     w1, RB_RIGHT
    bl      rb_child
    bl      rb_clear_seen

rb_clear_seen_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// --------------------------------------------------------------- drawing

// rb_blank(w0 = row, w1 = column, w2 = run length)
rb_blank:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w2
    bl      ui_at
    ldr     x0, =rb_sp
    mov     w1, w19
    bl      ui_repeat

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_flush() - push the drawing out before a delay
rb_flush:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     x0, 0
    bl      fflush

    ldp     fp, lr, [sp], 16
    ret

// rb_pause() - hold one beat of an animation
rb_pause:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      rb_flush
    ldr     x0, =rb_delay
    ldr     w0, [x0]
    bl      delay_ms

    ldp     fp, lr, [sp], 16
    ret

// rb_say(x0 = format, w1 = first value, w2 = second, w3 = third)
rb_say:
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
    bl      rb_blank

    mov     w0, 19
    mov     w1, 4
    bl      ui_at
    mov     w0, RB_ROLE_TEXT
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

// rb_role_of(x0 = node) -> w0 = the colour role this node wears now
// At rest a node wears its own colour, red or black. A node the current
// step is working on wears the state instead, which is why the legend
// names both kinds.
rb_role_of:
    ldr     x1, =rb_hl_node
    ldr     x2, =rb_hl_role
    mov     w3, 0

rb_role_scan:
    cmp     w3, 4
    b.ge    rb_role_own
    ldr     x4, [x1, w3, sxtw 3]
    cbz     x4, rb_role_next
    cmp     x4, x0
    b.eq    rb_role_hit

rb_role_next:
    add     w3, w3, 1
    b       rb_role_scan

rb_role_hit:
    ldr     w0, [x2, w3, sxtw 2]
    ret

rb_role_own:
    ldrb    w1, [x0, RB_COLOR]
    cmp     w1, RB_RED
    b.eq    rb_role_red
    mov     w0, RB_ROLE_NODE
    ret

rb_role_red:
    mov     w0, RB_ROLE_BAD
    ret

// rb_chip(w0 = row, w1 = left column, w2 = role, w3 = value)
rb_chip:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    mov     w20, w1
    mov     w21, w2

    ldr     x0, =rb_cell
    mov     w1, w3
    mov     w2, 2                           // the cell is two columns wide
    bl      ui_num

    mov     w0, w19
    mov     w1, w20
    mov     w2, w21
    ldr     x3, =rb_cell
    bl      ui_badge

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// rb_link(w0 = link row, w1 = parent centre, w2 = distance to a child,
//         w3 = 1 when a left child exists, w4 = 1 when a right one does)
// A parent with one child gets a corner rather than a tee, so no line
// ever points at empty space.
rb_link:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    mov     w19, w0
    mov     w20, w1
    mov     w21, w2
    mov     w22, w3
    mov     w23, w4

    cbz     w22, rb_link_right_only

    mov     w0, w19
    sub     w1, w20, w21
    bl      ui_at
    mov     w0, RB_ROLE_FAINT
    bl      th_fg
    ldr     x0, =rb_elbow_l
    bl      printf
    ldr     x0, =rb_dash
    sub     w1, w21, 1
    bl      ui_repeat

    cbz     w23, rb_link_left_only

    ldr     x0, =rb_tee
    bl      printf
    ldr     x0, =rb_dash
    sub     w1, w21, 1
    bl      ui_repeat
    ldr     x0, =rb_elbow_r
    bl      printf
    b       rb_link_close

rb_link_left_only:
    ldr     x0, =rb_elbow_lo
    bl      printf
    b       rb_link_close

rb_link_right_only:
    cbz     w23, rb_link_done

    mov     w0, w19
    mov     w1, w20
    bl      ui_at
    mov     w0, RB_ROLE_FAINT
    bl      th_fg
    ldr     x0, =rb_elbow_ro
    bl      printf
    ldr     x0, =rb_dash
    sub     w1, w21, 1
    bl      ui_repeat
    ldr     x0, =rb_elbow_r
    bl      printf

rb_link_close:
    bl      th_off

rb_link_done:
    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// rb_draw(x0 = node, w1 = row, w2 = left column, w3 = distance to a
//         child, w4 = level)
// Children first, then the elbows, then this cell, so a cell is never
// half covered by the line that reaches it.
rb_draw:
    stp     fp, lr, [sp, -96]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]
    str     x27, [sp, 80]

    mov     x19, x0
    mov     w20, w1
    mov     w21, w2
    mov     w22, w3
    mov     w23, w4

    mov     x0, x19
    bl      rb_is_nil
    cbnz    w0, rb_draw_out

    mov     x0, x19
    mov     w1, RB_LEFT
    bl      rb_child
    mov     x24, x0
    mov     x0, x19
    mov     w1, RB_RIGHT
    bl      rb_child
    mov     x25, x0

    cmp     w23, RB_LAST_LVL
    b.ge    rb_draw_deeper

    lsr     w26, w22, 1
    cmp     w26, 2
    b.ge    rb_draw_left
    mov     w26, 2

rb_draw_left:
    cbz     x24, rb_draw_right

    mov     x0, x24
    add     w1, w20, 2
    sub     w2, w21, w22
    mov     w3, w26
    add     w4, w23, 1
    bl      rb_draw

rb_draw_right:
    cbz     x25, rb_draw_links

    mov     x0, x25
    add     w1, w20, 2
    add     w2, w21, w22
    mov     w3, w26
    add     w4, w23, 1
    bl      rb_draw

rb_draw_links:
    add     w0, w20, 1
    add     w1, w21, 2                      // the centre of a four-wide cell
    mov     w2, w22
    mov     w3, 0
    cbz     x24, rb_draw_no_left
    mov     w3, 1
rb_draw_no_left:
    mov     w4, 0
    cbz     x25, rb_draw_no_right
    mov     w4, 1
rb_draw_no_right:
    bl      rb_link
    b       rb_draw_cell

rb_draw_deeper:
    orr     x0, x24, x25
    cbz     x0, rb_draw_cell

    add     w0, w20, 1
    add     w1, w21, 2
    mov     w2, RB_ROLE_FAINT
    ldr     x3, =rb_deeper
    bl      ui_text

rb_draw_cell:
    mov     x0, x19
    bl      rb_role_of
    mov     w27, w0

    ldr     w3, [x19, RB_DATA]
    mov     w0, w20
    mov     w1, w21
    mov     w2, w27
    bl      rb_chip

rb_draw_out:
    ldr     x27, [sp, 80]
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96
    ret

// rb_render(x0 = node A, w1 = role A, x2 = node B, w3 = role B,
//           x4 = node C, w5 = role C, x6 = node D, w7 = role D)
// Four highlight slots, because the insert repair looks at four nodes at
// once: the new one, its parent, its grandparent and its uncle.
rb_render:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x19, =rb_hl_node
    str     x0, [x19]
    str     x2, [x19, 8]
    str     x4, [x19, 16]
    str     x6, [x19, 24]
    ldr     x19, =rb_hl_role
    str     w1, [x19]
    str     w3, [x19, 4]
    str     w5, [x19, 8]
    str     w7, [x19, 12]

    mov     w19, 5
rb_render_wipe:
    cmp     w19, 14
    b.gt    rb_render_tree
    mov     w0, w19
    mov     w1, 3
    mov     w2, 76
    bl      rb_blank
    add     w19, w19, 1
    b       rb_render_wipe

rb_render_tree:
    ldr     x0, =rb_root
    ldr     x19, [x0]
    mov     x0, x19
    bl      rb_is_nil
    cbnz    w0, rb_render_empty

    mov     x0, x19
    mov     w1, RB_TOP_ROW
    mov     w2, RB_TOP_COL
    mov     w3, RB_SPREAD
    mov     w4, 0
    bl      rb_draw

    mov     w0, RB_TOP_ROW
    mov     w1, RB_TOP_COL - 7
    mov     w2, RB_ROLE_KEY
    ldr     x3, =rb_lbl_root
    bl      ui_text
    b       rb_render_stats

rb_render_empty:
    mov     w0, 9
    mov     w1, 35
    mov     w2, RB_ROLE_FAINT
    ldr     x3, =rb_lbl_none
    bl      ui_text

rb_render_stats:
    mov     w0, 16
    mov     w1, 56
    // 18 columns of literal plus two counts, and a full tree is 100 nodes.
    // Wipe to the last inner column so the line can never leave a stale
    // digit behind when it shrinks.
    mov     w2, 24
    bl      rb_blank

    ldr     x0, =rb_root
    ldr     x0, [x0]
    bl      rb_height_of
    mov     w20, w0
    ldr     x0, =rb_root
    ldr     x0, [x0]
    bl      rb_size_of
    mov     w19, w0

    mov     w0, 16
    mov     w1, 56
    bl      ui_at
    mov     w0, RB_ROLE_DIM
    bl      th_fg
    mov     w1, w19
    mov     w2, w20
    ldr     x0, =rb_fmt_stat
    bl      printf
    bl      th_off

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// rb_rest() - repaint with every node back in its own colour
rb_rest:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     x0, 0
    mov     w1, 0
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    mov     x6, 0
    mov     w7, 0
    bl      rb_render

    ldp     fp, lr, [sp], 16
    ret

// rb_note_case(x0 = the sentence for this case)
// Called from inside the repair. The four nodes it draws are still in the
// registers of rb_insert_fixup, and a call does not disturb them.
rb_note_case:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x25, x26, [sp, 16]

    mov     x25, x0
    ldr     x26, =rb_narrate
    ldr     w26, [x26]
    cbz     w26, rb_note_case_done

    mov     x0, x19
    mov     w1, RB_ROLE_HOT
    mov     x2, x20
    mov     w3, RB_ROLE_WARN
    mov     x4, x21
    mov     w5, RB_ROLE_ACCENT
    mov     x6, x23
    mov     w7, RB_ROLE_KEY
    bl      rb_render

    mov     x0, x25
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      rb_say
    bl      rb_pause

    ldr     x0, =rb_fix_steps
    ldr     w1, [x0]
    add     w1, w1, 1
    str     w1, [x0]

rb_note_case_done:
    ldp     x25, x26, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// rb_note_settled() - the line that closes a repair, whether or not one
// turned out to be needed
rb_note_settled:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =rb_narrate
    ldr     w0, [x0]
    cbz     w0, rb_note_settled_done

    bl      rb_rest
    ldr     x0, =rb_fix_steps
    ldr     w0, [x0]
    cbz     w0, rb_note_settled_quiet

    ldr     x0, =rb_msg_fixed
    b       rb_note_settled_say

rb_note_settled_quiet:
    ldr     x0, =rb_msg_nofix

rb_note_settled_say:
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      rb_say
    bl      rb_pause

rb_note_settled_done:
    ldp     fp, lr, [sp], 16
    ret

// rb_order_reset() - start a fresh visit order strip
rb_order_reset:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =rb_order_len
    str     wzr, [x0]
    ldr     x0, =rb_order
    strb    wzr, [x0]

    mov     w0, 17
    mov     w1, 3
    mov     w2, 76
    bl      rb_blank

    mov     w0, 17
    mov     w1, 4
    mov     w2, RB_ROLE_DIM
    ldr     x3, =rb_lbl_order
    bl      ui_text

    ldp     fp, lr, [sp], 16
    ret

// rb_order_add(w0 = value) - append one value and redraw the strip
rb_order_add:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0

    ldr     x20, =rb_order_len
    ldr     w0, [x20]
    cmp     w0, RB_ORDER_MAX
    b.ge    rb_order_show

    ldr     x1, =rb_order
    sxtw    x0, w0
    add     x21, x1, x0                     // where this value lands

    mov     x0, x21
    mov     w1, w19
    mov     w2, 0                           // the strip spaces itself
    bl      ui_num

    sxtw    x2, w0
    add     x1, x21, x2
    mov     w2, ' '
    strb    w2, [x1], 1
    strb    wzr, [x1]
    add     w0, w0, 1                       // the separator counts too

    ldr     w1, [x20]
    add     w1, w1, w0
    str     w1, [x20]

rb_order_show:
    mov     w0, 17
    mov     w1, 10
    mov     w2, RB_ROLE_KEY
    ldr     x3, =rb_order
    bl      ui_text

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// --------------------------------------------------------------- screens

// rb_legend() - two node colours, and the four parts the repair names
rb_legend:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, 16
    mov     w1, 4
    mov     w2, RB_ROLE_BAD
    ldr     x3, =rb_lg_red
    bl      ui_badge

    mov     w0, 16
    mov     w1, 10
    mov     w2, RB_ROLE_NODE
    ldr     x3, =rb_lg_black
    bl      ui_badge

    mov     w0, 16
    mov     w1, 18
    mov     w2, RB_ROLE_HOT
    ldr     x3, =rb_lg_new
    bl      ui_badge

    mov     w0, 16
    mov     w1, 24
    mov     w2, RB_ROLE_WARN
    ldr     x3, =rb_lg_parent
    bl      ui_badge

    mov     w0, 16
    mov     w1, 33
    mov     w2, RB_ROLE_ACCENT
    ldr     x3, =rb_lg_gp
    bl      ui_badge

    mov     w0, 16
    mov     w1, 47
    mov     w2, RB_ROLE_KEY
    ldr     x3, =rb_lg_uncle
    bl      ui_badge

    ldp     fp, lr, [sp], 16
    ret

// rb_frame(x0 = screen title, x1 = footer hint, x2 = best, x3 = avg,
//          x4 = worst, x5 = space)
// Everything on an operation screen that does not move while it runs.
rb_frame:
    stp     fp, lr, [sp, -80]!
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
    mov     w3, 12
    ldr     x4, =rb_pan_tree
    bl      ui_panel

    bl      rb_legend

    mov     w0, 17
    mov     w1, 4
    mov     w2, RB_ROLE_DIM
    ldr     x3, =rb_lbl_rule
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
    ldp     fp, lr, [sp], 80
    ret

// rb_ask(x0 = prompt) -> w0 = value, w1 = 1 when the value is usable
// One reader for all three prompts. It refuses a closed stdin and a value
// too wide for a cell, so the drawing can never be pushed out of shape.
rb_ask:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     x21, x0                         // kept, so a refused value can
                                            // be asked for again
rb_ask_prompt:
    mov     w0, 18
    mov     w1, 2
    mov     w2, 78
    bl      rb_blank
    mov     w0, 18
    mov     w1, 4
    mov     x2, x21
    bl      ui_prompt
    bl      rb_flush

    bl      read_int
    mov     w19, w0
    mov     w20, w1

    cbz     w20, rb_ask_stop                // stdin closed: walk out quietly

    cmp     w19, 0
    b.lt    rb_ask_range
    cmp     w19, 99
    b.gt    rb_ask_range

    mov     w0, w19
    mov     w1, 1
    b       rb_ask_done

rb_ask_range:
    // Say why and ask again. Answering 0 here would be indistinguishable
    // from a closed stdin, and the operation was being abandoned silently.
    ldr     x0, =rb_msg_range
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      rb_say
    b       rb_ask_prompt

rb_ask_stop:
    mov     w0, 0
    mov     w1, 0

rb_ask_done:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// rb_menu() - operations menu. The sentinel outlives the module, the tree
// does not.
    .global rb_menu
rb_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      rb_init_nil

rb_menu_loop:
    bl      rb_menu_draw

    mov     w0, 0
    mov     w1, 7
    bl      read_int_range

    cmp     w0, 0
    b.eq    rb_menu_exit
    cmp     w0, 1
    b.eq    rb_menu_insert
    cmp     w0, 2
    b.eq    rb_menu_search
    cmp     w0, 3
    b.eq    rb_menu_delete
    cmp     w0, 4
    b.eq    rb_menu_inorder
    cmp     w0, 5
    b.eq    rb_menu_sample
    cmp     w0, 6
    b.eq    rb_menu_show
    cmp     w0, 7
    b.eq    rb_menu_verify
    b       rb_menu_loop

rb_menu_insert:
    bl      rb_insert_interactive
    bl      wait_for_enter
    b       rb_menu_loop

rb_menu_search:
    bl      rb_search_interactive
    bl      wait_for_enter
    b       rb_menu_loop

rb_menu_delete:
    bl      rb_delete_interactive
    bl      wait_for_enter
    b       rb_menu_loop

rb_menu_inorder:
    bl      rb_inorder_interactive
    bl      wait_for_enter
    b       rb_menu_loop

rb_menu_sample:
    bl      rb_sample_interactive
    bl      wait_for_enter
    b       rb_menu_loop

rb_menu_show:
    bl      rb_show
    bl      wait_for_enter
    b       rb_menu_loop

rb_menu_verify:
    bl      rb_verify_interactive
    bl      wait_for_enter
    b       rb_menu_loop

rb_menu_exit:
    ldr     x0, =rb_root
    bl      rb_free_all
    ldp     fp, lr, [sp], 16
    ret

// rb_menu_draw() - the operations screen
rb_menu_draw:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =rb_scr_menu
    bl      ui_screen

    ldr     x0, =rb_hint_menu
    bl      ui_footer

    mov     w0, 4
    mov     w1, 9
    mov     w2, 62
    mov     w3, 13
    ldr     x4, =rb_pan_ops
    bl      ui_panel

    mov     w0, 6
    ldr     x1, =rb_key_1
    ldr     x2, =rb_opt_1
    bl      rb_menu_line

    mov     w0, 7
    ldr     x1, =rb_key_2
    ldr     x2, =rb_opt_2
    bl      rb_menu_line

    mov     w0, 8
    ldr     x1, =rb_key_3
    ldr     x2, =rb_opt_3
    bl      rb_menu_line

    mov     w0, 9
    ldr     x1, =rb_key_4
    ldr     x2, =rb_opt_4
    bl      rb_menu_line

    mov     w0, 10
    ldr     x1, =rb_key_5
    ldr     x2, =rb_opt_5
    bl      rb_menu_line

    mov     w0, 11
    ldr     x1, =rb_key_6
    ldr     x2, =rb_opt_6
    bl      rb_menu_line

    mov     w0, 12
    ldr     x1, =rb_key_7
    ldr     x2, =rb_opt_7
    bl      rb_menu_line

    mov     w0, 13
    ldr     x1, =rb_key_0
    ldr     x2, =rb_opt_0
    bl      rb_menu_line

    // how much tree there is, so the menu is never a dead end
    mov     w0, 15
    mov     w1, 12
    bl      ui_at
    mov     w0, RB_ROLE_DIM
    bl      th_fg
    ldr     x0, =rb_root
    ldr     x0, [x0]
    bl      rb_height_of
    mov     w19, w0
    ldr     x0, =rb_node_count
    ldr     w1, [x0]
    mov     w2, w19
    ldr     x0, =rb_fmt_stat
    bl      printf
    bl      th_off

    mov     w0, 18
    mov     w1, 12
    ldr     x2, =rb_ask_choice
    bl      ui_prompt
    bl      rb_flush

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_menu_line(w0 = row, x1 = key text, x2 = option text)
rb_menu_line:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    mov     x21, x1
    mov     x20, x2

    mov     w0, w19
    mov     w1, 12
    mov     w2, RB_ROLE_KEY
    mov     x3, x21
    bl      ui_badge

    mov     w0, w19
    mov     w1, 16
    mov     w2, RB_ROLE_TEXT
    mov     x3, x20
    bl      ui_text

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// rb_insert_interactive() - the descent, then the repair, case by case
rb_insert_interactive:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x0, =rb_scr_insert
    ldr     x1, =rb_hint_run
    ldr     x2, =rb_ologn
    ldr     x3, =rb_ologn
    ldr     x4, =rb_ologn
    ldr     x5, =rb_o1
    bl      rb_frame

    ldr     x0, =rb_root
    ldr     x0, [x0]
    bl      rb_clear_seen
    bl      rb_rest

    ldr     x0, =rb_ask_insert
    bl      rb_ask
    mov     w19, w0
    mov     w20, w1
    cbz     w20, rb_insert_int_done

    ldr     x0, =rb_root
    ldr     x21, [x0]
    mov     w22, 0                          // comparisons made
    mov     x0, x21
    bl      rb_is_nil
    cbnz    w0, rb_insert_int_place

    ldr     x0, =rb_msg_start
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      rb_say
    bl      rb_pause

rb_insert_int_walk:
    mov     x0, x21
    mov     w1, RB_ROLE_HOT
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    mov     x6, 0
    mov     w7, 0
    bl      rb_render

    add     w22, w22, 1
    ldr     w23, [x21, RB_DATA]
    cmp     w19, w23
    b.eq    rb_insert_int_dup
    b.gt    rb_insert_int_right

    ldr     x0, =rb_fmt_cmp_lt
    mov     w1, w19
    mov     w2, w23
    mov     w3, 0
    bl      rb_say
    bl      rb_pause

    mov     x0, x21
    mov     w1, RB_LEFT
    bl      rb_child
    mov     x24, x0
    cbz     x24, rb_insert_int_arrived
    mov     x21, x24
    b       rb_insert_int_walk

rb_insert_int_right:
    ldr     x0, =rb_fmt_cmp_gt
    mov     w1, w19
    mov     w2, w23
    mov     w3, 0
    bl      rb_say
    bl      rb_pause

    mov     x0, x21
    mov     w1, RB_RIGHT
    bl      rb_child
    mov     x24, x0
    cbz     x24, rb_insert_int_arrived
    mov     x21, x24
    b       rb_insert_int_walk

rb_insert_int_arrived:
    ldr     x0, =rb_fmt_arrived
    mov     w1, w19
    ldr     w2, [x21, RB_DATA]
    mov     w3, 0
    bl      rb_say
    bl      rb_pause

rb_insert_int_place:
    ldr     x0, =rb_fix_steps
    str     wzr, [x0]
    ldr     x0, =rb_narrate
    mov     w1, 1
    str     w1, [x0]                        // the repair may speak now

    ldr     x0, =rb_root
    mov     w1, w19
    bl      rb_insert
    mov     w23, w1                         // a printf below would eat w1

    ldr     x0, =rb_narrate
    str     wzr, [x0]

    cbz     w23, rb_insert_int_refused

    ldr     x0, =rb_root
    ldr     x0, [x0]
    mov     w1, w19
    bl      rb_search
    mov     x21, x0

    mov     x0, x21
    mov     w1, RB_ROLE_OK
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    mov     x6, 0
    mov     w7, 0
    bl      rb_render

    cbnz    w22, rb_insert_int_report

    ldr     x0, =rb_msg_root
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      rb_say
    b       rb_insert_int_done

rb_insert_int_report:
    ldr     x0, =rb_fix_steps
    ldr     w24, [x0]
    ldr     x0, =rb_fmt_placed
    mov     w1, w19
    mov     w2, w22
    mov     w3, w24
    bl      rb_say
    b       rb_insert_int_done

rb_insert_int_dup:
    bl      rb_rest
    ldr     x0, =rb_fmt_dup
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      rb_say
    b       rb_insert_int_done

rb_insert_int_refused:
    ldr     x0, =rb_msg_alloc
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      rb_say

rb_insert_int_done:
    bl      rb_flush
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// rb_search_interactive() - the descent, with nothing to repair after it
rb_search_interactive:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x0, =rb_scr_search
    ldr     x1, =rb_hint_run
    ldr     x2, =rb_o1
    ldr     x3, =rb_ologn
    ldr     x4, =rb_ologn
    ldr     x5, =rb_o1
    bl      rb_frame

    ldr     x0, =rb_root
    ldr     x0, [x0]
    bl      rb_clear_seen
    bl      rb_rest

    ldr     x0, =rb_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    rb_search_int_empty

    ldr     x0, =rb_ask_search
    bl      rb_ask
    mov     w19, w0
    mov     w20, w1
    cbz     w20, rb_search_int_done

    ldr     x0, =rb_root
    ldr     x21, [x0]
    mov     w22, 0

rb_search_int_walk:
    mov     x0, x21
    bl      rb_is_nil
    cbnz    w0, rb_search_int_missing

    mov     x0, x21
    mov     w1, RB_ROLE_HOT
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    mov     x6, 0
    mov     w7, 0
    bl      rb_render

    add     w22, w22, 1
    ldr     w23, [x21, RB_DATA]
    cmp     w19, w23
    b.eq    rb_search_int_hit
    b.gt    rb_search_int_right

    ldr     x0, =rb_fmt_cmp_lt
    mov     w1, w19
    mov     w2, w23
    mov     w3, 0
    bl      rb_say
    bl      rb_pause
    mov     x0, x21
    mov     w1, RB_LEFT
    bl      rb_child
    mov     x21, x0
    b       rb_search_int_walk

rb_search_int_right:
    ldr     x0, =rb_fmt_cmp_gt
    mov     w1, w19
    mov     w2, w23
    mov     w3, 0
    bl      rb_say
    bl      rb_pause
    mov     x0, x21
    mov     w1, RB_RIGHT
    bl      rb_child
    mov     x21, x0
    b       rb_search_int_walk

rb_search_int_hit:
    mov     x0, x21
    mov     w1, RB_ROLE_OK
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    mov     x6, 0
    mov     w7, 0
    bl      rb_render

    ldr     x0, =rb_root
    ldr     x0, [x0]
    mov     w1, w19
    bl      rb_depth_of
    mov     w24, w0

    ldr     x0, =rb_fmt_found
    mov     w1, w19
    mov     w2, w22
    mov     w3, w24
    bl      rb_say
    b       rb_search_int_done

rb_search_int_missing:
    bl      rb_rest
    ldr     x0, =rb_fmt_missing
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      rb_say
    b       rb_search_int_done

rb_search_int_empty:
    ldr     x0, =rb_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      rb_say

rb_search_int_done:
    bl      rb_flush
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// rb_delete_interactive() - find the node, say what its colour costs, and
// hand the work to the delete that knows how to pay it
rb_delete_interactive:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x0, =rb_scr_delete
    ldr     x1, =rb_hint_run
    ldr     x2, =rb_ologn
    ldr     x3, =rb_ologn
    ldr     x4, =rb_ologn
    ldr     x5, =rb_o1
    bl      rb_frame

    ldr     x0, =rb_root
    ldr     x0, [x0]
    bl      rb_clear_seen
    bl      rb_rest

    ldr     x0, =rb_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    rb_delete_int_empty

    ldr     x0, =rb_ask_delete
    bl      rb_ask
    mov     w19, w0
    mov     w20, w1
    cbz     w20, rb_delete_int_done

    ldr     x0, =rb_root
    ldr     x21, [x0]

rb_delete_int_walk:
    mov     x0, x21
    bl      rb_is_nil
    cbnz    w0, rb_delete_int_missing

    mov     x0, x21
    mov     w1, RB_ROLE_HOT
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    mov     x6, 0
    mov     w7, 0
    bl      rb_render

    ldr     w23, [x21, RB_DATA]
    cmp     w19, w23
    b.eq    rb_delete_int_hit
    b.gt    rb_delete_int_right

    ldr     x0, =rb_fmt_cmp_lt
    mov     w1, w19
    mov     w2, w23
    mov     w3, 0
    bl      rb_say
    bl      rb_pause
    mov     x0, x21
    mov     w1, RB_LEFT
    bl      rb_child
    mov     x21, x0
    b       rb_delete_int_walk

rb_delete_int_right:
    ldr     x0, =rb_fmt_cmp_gt
    mov     w1, w19
    mov     w2, w23
    mov     w3, 0
    bl      rb_say
    bl      rb_pause
    mov     x0, x21
    mov     w1, RB_RIGHT
    bl      rb_child
    mov     x21, x0
    b       rb_delete_int_walk

rb_delete_int_hit:
    mov     x0, x21
    mov     w1, RB_ROLE_BAD
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    mov     x6, 0
    mov     w7, 0
    bl      rb_render

    // with two real children the successor moves up wearing this colour,
    // so it is the successor whose own colour decides the repair
    mov     x0, x21
    mov     w1, RB_LEFT
    bl      rb_child
    mov     x22, x0
    mov     x0, x21
    mov     w1, RB_RIGHT
    bl      rb_child
    mov     x23, x0

    cbz     x22, rb_delete_int_colour
    cbz     x23, rb_delete_int_colour

    ldr     x0, =rb_fmt_del_two
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      rb_say
    bl      rb_pause

    mov     x0, x23
    bl      rb_minimum
    mov     x21, x0

rb_delete_int_colour:
    ldrb    w24, [x21, RB_COLOR]
    cmp     w24, RB_RED
    b.eq    rb_delete_int_red

    ldr     x0, =rb_fmt_del_black
    ldr     w1, [x21, RB_DATA]
    mov     w2, 0
    mov     w3, 0
    bl      rb_say
    bl      rb_pause
    b       rb_delete_int_apply

rb_delete_int_red:
    ldr     x0, =rb_fmt_del_red
    ldr     w1, [x21, RB_DATA]
    mov     w2, 0
    mov     w3, 0
    bl      rb_say
    bl      rb_pause

rb_delete_int_apply:
    ldr     x0, =rb_root
    mov     w1, w19
    bl      rb_delete

    bl      rb_rest
    ldr     x0, =rb_fmt_deleted
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      rb_say
    b       rb_delete_int_done

rb_delete_int_missing:
    bl      rb_rest
    ldr     x0, =rb_fmt_missing
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      rb_say
    b       rb_delete_int_done

rb_delete_int_empty:
    ldr     x0, =rb_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      rb_say

rb_delete_int_done:
    bl      rb_flush
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// rb_visit(x0 = node) - paint it, name it, and add it to the strip
rb_visit:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0

    mov     x0, x19
    mov     w1, RB_ROLE_HOT
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    mov     x6, 0
    mov     w7, 0
    bl      rb_render

    ldr     x0, =rb_fmt_visit
    ldr     w1, [x19, RB_DATA]
    mov     w2, 0
    mov     w3, 0
    bl      rb_say

    ldr     w0, [x19, RB_DATA]
    bl      rb_order_add
    bl      rb_pause

    mov     w0, 1
    str     w0, [x19, RB_SEEN]

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_inorder_walk(x0 = node) - left, node, right
rb_inorder_walk:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0
    bl      rb_is_nil
    cbnz    w0, rb_inorder_walk_done

    mov     x0, x19
    mov     w1, RB_LEFT
    bl      rb_child
    bl      rb_inorder_walk

    mov     x0, x19
    bl      rb_visit

    mov     x0, x19
    mov     w1, RB_RIGHT
    bl      rb_child
    bl      rb_inorder_walk

rb_inorder_walk_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_inorder_interactive() - sorted order, off a tree that stays short
rb_inorder_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =rb_scr_in
    ldr     x1, =rb_hint_run
    ldr     x2, =rb_on
    ldr     x3, =rb_on
    ldr     x4, =rb_on
    ldr     x5, =rb_oh
    bl      rb_frame

    ldr     x0, =rb_root
    ldr     x0, [x0]
    bl      rb_clear_seen
    bl      rb_rest
    bl      rb_order_reset

    ldr     x0, =rb_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    rb_inorder_int_empty

    ldr     x0, =rb_root
    ldr     x0, [x0]
    bl      rb_inorder_walk

    bl      rb_rest
    ldr     x0, =rb_fmt_done_in
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      rb_say
    b       rb_inorder_int_done

rb_inorder_int_empty:
    ldr     x0, =rb_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      rb_say

rb_inorder_int_done:
    bl      rb_flush
    ldp     fp, lr, [sp], 16
    ret

// rb_sample_interactive() - the eight values in order, so the rotations
// that keep the tree short happen in view
rb_sample_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =rb_scr_sample
    ldr     x1, =rb_hint_run
    ldr     x2, =rb_on
    ldr     x3, =rb_on
    ldr     x4, =rb_on
    ldr     x5, =rb_o1
    bl      rb_frame

    ldr     x0, =rb_root
    bl      rb_free_all
    bl      rb_rest

    mov     w0, 50
    bl      rb_sample_step
    mov     w0, 30
    bl      rb_sample_step
    mov     w0, 70
    bl      rb_sample_step
    mov     w0, 20
    bl      rb_sample_step
    mov     w0, 40
    bl      rb_sample_step
    mov     w0, 60
    bl      rb_sample_step
    mov     w0, 80
    bl      rb_sample_step
    mov     w0, 10
    bl      rb_sample_step

    bl      rb_rest
    ldr     x0, =rb_fmt_sample
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      rb_say
    bl      rb_flush

    ldp     fp, lr, [sp], 16
    ret

// rb_sample_step(w0 = value) - one insert, drawn
rb_sample_step:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0

    ldr     x0, =rb_root
    mov     w1, w19
    bl      rb_insert

    ldr     x0, =rb_root
    ldr     x0, [x0]
    mov     w1, w19
    bl      rb_search

    mov     w1, RB_ROLE_HOT
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    mov     x6, 0
    mov     w7, 0
    bl      rb_render

    ldr     x0, =rb_fmt_visit
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      rb_say
    bl      rb_pause

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_show() - the tree, nothing moving
rb_show:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    ldr     x0, =rb_scr_show
    ldr     x1, =rb_hint_run
    ldr     x2, =rb_o1
    ldr     x3, =rb_ologn
    ldr     x4, =rb_ologn
    ldr     x5, =rb_o1
    bl      rb_frame

    ldr     x0, =rb_root
    ldr     x0, [x0]
    bl      rb_clear_seen
    bl      rb_rest

    ldr     x0, =rb_node_count
    ldr     w19, [x0]
    cmp     w19, 0
    b.le    rb_show_empty

    ldr     x0, =rb_root
    ldr     x0, [x0]
    bl      rb_height_of
    mov     w20, w0
    mov     w21, w19                        // a plain tree can be n levels

    ldr     x0, =rb_fmt_state
    mov     w1, w19
    mov     w2, w20
    mov     w3, w21
    bl      rb_say
    b       rb_show_done

rb_show_empty:
    ldr     x0, =rb_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      rb_say

rb_show_done:
    bl      rb_flush
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// rb_rule_line(w0 = row, x1 = the rule, w2 = 1 when it holds)
rb_rule_line:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    mov     x20, x1
    mov     w21, w2

    mov     w0, w19
    mov     w1, 14
    mov     w2, RB_ROLE_TEXT
    mov     x3, x20
    bl      ui_text

    cbz     w21, rb_rule_line_broken

    mov     w0, w19
    mov     w1, 5
    mov     w2, RB_ROLE_OK
    ldr     x3, =rb_lbl_yes
    bl      ui_badge
    b       rb_rule_line_done

rb_rule_line_broken:
    mov     w0, w19
    mov     w1, 5
    mov     w2, RB_ROLE_BAD
    ldr     x3, =rb_lbl_no
    bl      ui_badge

rb_rule_line_done:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// rb_verify_interactive() - the five rules, each measured against the
// tree that is actually in memory rather than asserted about it
rb_verify_interactive:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x0, =rb_scr_verify
    bl      ui_screen
    ldr     x0, =rb_hint_rules
    bl      ui_footer

    mov     w0, 4
    mov     w1, 2
    mov     w2, 78
    mov     w3, 10
    ldr     x4, =rb_pan_rules
    bl      ui_panel

    mov     w0, 20
    mov     w1, 4
    ldr     x2, =rb_on
    ldr     x3, =rb_on
    ldr     x4, =rb_on
    ldr     x5, =rb_oh
    bl      ui_complexity

    ldr     x0, =rb_node_count
    ldr     w19, [x0]
    cmp     w19, 0
    b.le    rb_verify_int_empty

    // rule two: the root is black
    ldr     x0, =rb_root
    ldr     x0, [x0]
    bl      rb_get_color
    cmp     w0, RB_BLACK
    cset    w20, eq

    // rule four: no red node has a red child
    ldr     x0, =rb_root
    ldr     x0, [x0]
    bl      rb_no_red_red
    mov     w21, w0

    // rule five: one black height, whichever way you walk down
    ldr     x0, =rb_root
    ldr     x0, [x0]
    bl      rb_black_height
    mov     w22, w0
    cmp     w22, 0
    cset    w23, ge

    mov     w0, 6
    ldr     x1, =rb_rule_1
    mov     w2, 1                           // a colour byte is one or the other
    bl      rb_rule_line

    mov     w0, 7
    ldr     x1, =rb_rule_2
    mov     w2, w20
    bl      rb_rule_line

    mov     w0, 8
    ldr     x1, =rb_rule_3
    mov     w2, 1                           // one sentinel, shared by everything
    bl      rb_rule_line

    mov     w0, 9
    ldr     x1, =rb_rule_4
    mov     w2, w21
    bl      rb_rule_line

    mov     w0, 10
    ldr     x1, =rb_rule_5
    mov     w2, w23
    bl      rb_rule_line

    // the measurements the checks were made from
    ldr     x0, =rb_root
    ldr     x0, [x0]
    bl      rb_height_of
    mov     w24, w0

    mov     w0, 15
    mov     w1, 4
    bl      ui_at
    mov     w0, RB_ROLE_DIM
    bl      th_fg
    ldr     x0, =rb_node_count
    ldr     w1, [x0]
    mov     w2, w24
    mov     w3, w22
    ldr     x0, =rb_fmt_facts
    bl      printf
    bl      th_off

    and     w0, w20, w21
    and     w0, w0, w23
    cbz     w0, rb_verify_int_broken

    mov     w0, 17
    mov     w1, 4
    mov     w2, RB_ROLE_DIM
    ldr     x3, =rb_msg_all_ok
    bl      ui_text
    b       rb_verify_int_done

rb_verify_int_broken:
    mov     w0, 17
    mov     w1, 4
    mov     w2, RB_ROLE_BAD
    ldr     x3, =rb_msg_broken
    bl      ui_text
    b       rb_verify_int_done

rb_verify_int_empty:
    mov     w0, 6
    mov     w1, 4
    mov     w2, RB_ROLE_FAINT
    ldr     x3, =rb_msg_empty
    bl      ui_text

rb_verify_int_done:
    bl      rb_flush
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret
