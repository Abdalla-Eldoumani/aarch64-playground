// bst_viz.asm - a binary search tree, drawn the way it is drawn on paper
//
// Every operation is the same descent: compare, go left or right, stop.
// The tree is redrawn between comparisons rather than after them, so the
// path a value takes is visible while it is being taken. The four
// traversals paint the nodes they have already visited, which turns an
// order that is easy to recite and hard to picture into one picture.
//
// Five levels fit the frame at four columns a node. Anything deeper is
// marked rather than drawn, because a tree that runs off the screen
// teaches nothing about a tree.

define(fp, x29)
define(lr, x30)

// node layout: value, left, right, and the flag a traversal paints
    BST_DATA  = 0
    BST_LEFT  = 8
    BST_RIGHT = 16
    BST_SEEN  = 24
    BST_SIZE  = 32

// Role numbers mirror the UI_ROLE_* set in ui.asm. They are repeated here
// so this file also assembles on its own, the way the web build feeds it.
    BST_ROLE_TEXT  = 0
    BST_ROLE_DIM   = 1
    BST_ROLE_FAINT = 2
    BST_ROLE_KEY   = 4
    BST_ROLE_OK    = 5
    BST_ROLE_WARN  = 6
    BST_ROLE_HOT   = 7
    BST_ROLE_BAD   = 8
    BST_ROLE_NODE  = 9

    BST_TOP_ROW  = 5                        // where the root sits
    BST_TOP_COL  = 38                       // the left edge of its cell
    BST_SPREAD   = 16                       // half the width of level one
    BST_LAST_LVL = 4                        // deepest level with room to draw
    BST_ORDER_MAX = 60                      // columns the order strip may use

    .data
    .balign 8

bst_root:           .dword 0
bst_hl_node:        .dword 0, 0, 0          // nodes wearing a state colour

    .balign 8
bst_queue:          .skip 512               // level order, sixty-four slots

    .balign 4
bst_node_count:     .word 0
bst_hl_role:        .word 0, 0, 0
bst_order_len:      .word 0
bst_delay:          .word 550               // milliseconds between beats

bst_cell:           .skip 8                 // one value, formatted
bst_order:          .skip 96                // the visit order, as text

bst_sp:             .string " "
bst_dash:           .string "\xe2\x94\x80"
bst_tee:            .string "\xe2\x94\xb4"  // a parent with both children
bst_elbow_l:        .string "\xe2\x95\xad"  // down to the left child
bst_elbow_r:        .string "\xe2\x95\xae"  // down to the right child
bst_elbow_lo:       .string "\xe2\x95\xaf"  // a left child and nothing else
bst_elbow_ro:       .string "\xe2\x95\xb0"  // a right child and nothing else
bst_deeper:         .string "\xe2\x8b\xae"  // the tree carries on below

bst_fmt_cell:       .string "%2d"
bst_fmt_order:      .string "%d "
bst_fmt_stat:       .string "%d nodes  \xc2\xb7  height %d"

bst_scr_menu:       .string "binary search tree  \xc2\xb7  ordered by construction"
bst_scr_insert:     .string "binary search tree  \xc2\xb7  insert"
bst_scr_delete:     .string "binary search tree  \xc2\xb7  delete"
bst_scr_search:     .string "binary search tree  \xc2\xb7  search"
bst_scr_in:         .string "binary search tree  \xc2\xb7  inorder traversal"
bst_scr_pre:        .string "binary search tree  \xc2\xb7  preorder traversal"
bst_scr_post:       .string "binary search tree  \xc2\xb7  postorder traversal"
bst_scr_level:      .string "binary search tree  \xc2\xb7  level order traversal"
bst_scr_sample:     .string "binary search tree  \xc2\xb7  build the sample tree"
bst_scr_show:       .string "binary search tree  \xc2\xb7  the tree right now"

bst_pan_ops:        .string "operations"
bst_pan_tree:       .string "tree"

bst_hint_menu:      .string "pick an operation  \xc2\xb7  0 goes back to the main menu"
bst_hint_run:       .string "enter returns to the tree menu  \xc2\xb7  a descent always starts at the root"

bst_opt_1:          .string "insert a value and watch it find its place"
bst_opt_2:          .string "delete a value, successor and all"
bst_opt_3:          .string "search for a value, one comparison a level"
bst_opt_4:          .string "inorder: left, node, right - out comes sorted order"
bst_opt_5:          .string "preorder: node, left, right - the shape, top down"
bst_opt_6:          .string "postorder: left, right, node - children first"
bst_opt_7:          .string "level order: one level at a time, out of a queue"
bst_opt_8:          .string "build the sample tree, one insert at a time"
bst_opt_9:          .string "show the tree as it stands"
bst_opt_0:          .string "back to the main menu"

bst_key_1:          .string "1"
bst_key_2:          .string "2"
bst_key_3:          .string "3"
bst_key_4:          .string "4"
bst_key_5:          .string "5"
bst_key_6:          .string "6"
bst_key_7:          .string "7"
bst_key_8:          .string "8"
bst_key_9:          .string "9"
bst_key_0:          .string "0"

bst_lg_hand:        .string "in hand"
bst_lg_cmp:         .string "comparing"
bst_lg_set:         .string "visited"
bst_lg_gone:        .string "leaving"

bst_lbl_rule:       .string "everything left of a node is smaller, everything right is larger"
bst_lbl_order:      .string "order"
bst_lbl_root:       .string "root"
bst_lbl_none:       .string "no root yet"

bst_ask_choice:     .string "choice "
bst_ask_insert:     .string "value to insert (0 to 99)  "
bst_ask_delete:     .string "value to delete  "
bst_ask_search:     .string "value to look for  "

bst_o1:             .string "O(1)"
bst_on:             .string "O(n)"
bst_oh:             .string "O(h)"
bst_ologn:          .string "O(log n)"

bst_msg_empty:      .string "the tree is empty. insert a value, or build the sample tree"
bst_msg_range:      .string "values run from 0 to 99, so every node stays two digits wide"
bst_msg_root:       .string "the tree was empty, so %d becomes the root"
bst_msg_sample:     .string "seven values, and the shape depends on the order they arrived in"
bst_msg_alloc:      .string "the allocator refused a node, so nothing was inserted"
bst_msg_start:      .string "every descent starts at the root, and every step throws half away"

bst_fmt_cmp_lt:     .string "%d is smaller than %d, so the descent goes left"
bst_fmt_cmp_gt:     .string "%d is larger than %d, so the descent goes right"
bst_fmt_dup:        .string "%d is already in the tree, and a search tree keeps one of each"
bst_fmt_hang_l:     .string "nothing left of %d, so %d hangs there as its left child"
bst_fmt_hang_r:     .string "nothing right of %d, so %d hangs there as its right child"
bst_fmt_placed:     .string "inserted %d  \xc2\xb7  comparisons %d  \xc2\xb7  depth %d"
bst_fmt_found:      .string "found %d  \xc2\xb7  comparisons %d  \xc2\xb7  depth %d"
bst_fmt_missing:    .string "the descent ran out of tree, so %d is not in here"
bst_fmt_leaf:       .string "%d is a leaf, so it can simply be unhooked"
bst_fmt_one:        .string "%d has one child, and that child moves up into its place"
bst_fmt_two:        .string "%d has two children, so its successor %d takes over the slot"
bst_fmt_deleted:    .string "deleted %d, and the order the tree encodes is unchanged"
bst_fmt_visit:      .string "visit %d"
bst_fmt_queued:     .string "%d came off the queue, and its children went on the back"
bst_fmt_done_in:    .string "inorder reads a search tree in sorted order, every time"
bst_fmt_done_pre:   .string "preorder writes a parent before its children, so the shape rebuilds"
bst_fmt_done_post:  .string "postorder finishes the children first, which is how a tree is freed"
bst_fmt_done_lvl:   .string "level order came out of a queue, not out of the call stack"
bst_fmt_state:      .string "%d nodes, %d levels deep. balance is what keeps a search short"

    .text
    .balign 4

// ------------------------------------------------------------ the tree

// bst_create_node(w0 = value) -> x0 = new node, 0 when malloc refused
    .global bst_create_node
bst_create_node:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0                         // the value has to survive malloc

    mov     x0, BST_SIZE
    bl      malloc
    cbz     x0, bst_create_done

    str     w19, [x0, BST_DATA]
    str     xzr, [x0, BST_LEFT]
    str     xzr, [x0, BST_RIGHT]
    str     xzr, [x0, BST_SEEN]

bst_create_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// bst_insert(x0 = address of root, w1 = value) -> w0 = 1 when inserted,
// 0 when the value was already there. A search tree is a set, so a repeat
// is dropped rather than stored twice.
    .global bst_insert
bst_insert:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    mov     x19, x0
    mov     w20, w1

    mov     w0, w20
    bl      bst_create_node
    mov     x23, x0
    cbz     x23, bst_insert_refused

    ldr     x21, [x19]
    cbz     x21, bst_insert_as_root

bst_insert_walk:
    mov     x22, x21                        // the parent this may hang off
    ldr     w0, [x21, BST_DATA]
    cmp     w20, w0
    b.eq    bst_insert_dup
    b.lt    bst_insert_left

    ldr     x21, [x21, BST_RIGHT]
    cbnz    x21, bst_insert_walk
    str     x23, [x22, BST_RIGHT]
    b       bst_insert_counted

bst_insert_left:
    ldr     x21, [x21, BST_LEFT]
    cbnz    x21, bst_insert_walk
    str     x23, [x22, BST_LEFT]
    b       bst_insert_counted

bst_insert_as_root:
    str     x23, [x19]

bst_insert_counted:
    ldr     x0, =bst_node_count
    ldr     w1, [x0]
    add     w1, w1, 1
    str     w1, [x0]
    mov     w0, 1
    b       bst_insert_done

bst_insert_dup:
    mov     x0, x23
    bl      free
    mov     w0, 0
    b       bst_insert_done

bst_insert_refused:
    mov     w0, 0

bst_insert_done:
    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// bst_search(x0 = node, w1 = value) -> x0 = the node, 0 when absent
    .global bst_search
bst_search:
bst_search_step:
    cbz     x0, bst_search_none
    ldr     w2, [x0, BST_DATA]
    cmp     w1, w2
    b.eq    bst_search_hit
    b.lt    bst_search_go_left
    ldr     x0, [x0, BST_RIGHT]
    b       bst_search_step

bst_search_go_left:
    ldr     x0, [x0, BST_LEFT]
    b       bst_search_step

bst_search_none:
    mov     x0, 0

bst_search_hit:
    ret

// bst_find_min(x0 = subtree) -> x0 = its leftmost node
    .global bst_find_min
bst_find_min:
    cbz     x0, bst_find_min_done

bst_find_min_loop:
    ldr     x1, [x0, BST_LEFT]
    cbz     x1, bst_find_min_done
    mov     x0, x1
    b       bst_find_min_loop

bst_find_min_done:
    ret

// bst_delete(x0 = address of root, w1 = value)
    .global bst_delete
bst_delete:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0
    mov     w20, w1

    ldr     x0, [x19]
    bl      bst_delete_node
    str     x0, [x19]

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// bst_delete_node(x0 = node, w20 = value) -> x0 = the new subtree root
// The value rides in w20 rather than w1: the recursion needs it to
// survive the calls it makes, and a callee-saved register does that for
// free.
bst_delete_node:
    cbz     x0, bst_delete_absent

    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     x19, x0

    ldr     w0, [x19, BST_DATA]
    cmp     w20, w0
    b.eq    bst_delete_this
    b.lt    bst_delete_recur_left

    ldr     x0, [x19, BST_RIGHT]
    bl      bst_delete_node
    str     x0, [x19, BST_RIGHT]
    mov     x0, x19
    b       bst_delete_node_done

bst_delete_recur_left:
    ldr     x0, [x19, BST_LEFT]
    bl      bst_delete_node
    str     x0, [x19, BST_LEFT]
    mov     x0, x19
    b       bst_delete_node_done

bst_delete_this:
    ldr     x1, [x19, BST_LEFT]
    ldr     x2, [x19, BST_RIGHT]

    cbz     x1, bst_delete_lift_right
    cbz     x2, bst_delete_lift_left

    // two children: the successor value moves up, and the successor node
    // is deleted from the right subtree, where it has at most one child
    ldr     x0, [x19, BST_RIGHT]
    bl      bst_find_min
    ldr     w1, [x0, BST_DATA]
    str     w1, [x19, BST_DATA]

    mov     w20, w1
    ldr     x0, [x19, BST_RIGHT]
    bl      bst_delete_node
    str     x0, [x19, BST_RIGHT]
    mov     x0, x19
    b       bst_delete_node_done

bst_delete_lift_right:
    mov     x21, x2
    mov     x0, x19
    bl      free
    mov     x0, x21
    b       bst_delete_node_done

bst_delete_lift_left:
    mov     x21, x1
    mov     x0, x19
    bl      free
    mov     x0, x21

bst_delete_node_done:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

bst_delete_absent:
    mov     x0, 0
    ret

// bst_free_all(x0 = address of root) - free every node and zero the count
    .global bst_free_all
bst_free_all:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0
    ldr     x0, [x19]
    bl      bst_free_recursive

    str     xzr, [x19]
    ldr     x0, =bst_node_count
    str     wzr, [x0]

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// bst_free_recursive(x0 = node) - children before parents, the one order
// in which no pointer is read after it has been freed
bst_free_recursive:
    cbz     x0, bst_free_rec_done

    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0
    ldr     x0, [x19, BST_LEFT]
    bl      bst_free_recursive
    ldr     x0, [x19, BST_RIGHT]
    bl      bst_free_recursive
    mov     x0, x19
    bl      free

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32

bst_free_rec_done:
    ret

// bst_height_of(x0 = node) -> w0 = levels below it, itself included
    .global bst_height_of
bst_height_of:
    cbz     x0, bst_height_empty

    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0
    ldr     x0, [x19, BST_LEFT]
    bl      bst_height_of
    mov     w20, w0
    ldr     x0, [x19, BST_RIGHT]
    bl      bst_height_of

    cmp     w20, w0
    csel    w0, w20, w0, gt
    add     w0, w0, 1

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

bst_height_empty:
    mov     w0, 0
    ret

// bst_depth_of(x0 = node, w1 = value) -> w0 = how far down the value
// sits, counting the root as zero
bst_depth_of:
    mov     w2, 0

bst_depth_step:
    cbz     x0, bst_depth_done
    ldr     w3, [x0, BST_DATA]
    cmp     w1, w3
    b.eq    bst_depth_done
    add     w2, w2, 1
    b.lt    bst_depth_left
    ldr     x0, [x0, BST_RIGHT]
    b       bst_depth_step

bst_depth_left:
    ldr     x0, [x0, BST_LEFT]
    b       bst_depth_step

bst_depth_done:
    mov     w0, w2
    ret

// bst_clear_seen(x0 = node) - drop the paint a previous traversal left
bst_clear_seen:
    cbz     x0, bst_clear_seen_done

    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0
    str     xzr, [x19, BST_SEEN]
    ldr     x0, [x19, BST_LEFT]
    bl      bst_clear_seen
    ldr     x0, [x19, BST_RIGHT]
    bl      bst_clear_seen

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32

bst_clear_seen_done:
    ret

// ------------------------------------------------------------- drawing

// bst_blank(w0 = row, w1 = column, w2 = run length)
bst_blank:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w2
    bl      ui_at
    ldr     x0, =bst_sp
    mov     w1, w19
    bl      ui_repeat

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// bst_flush() - push the drawing out before a delay
bst_flush:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     x0, 0
    bl      fflush

    ldp     fp, lr, [sp], 16
    ret

// bst_pause() - hold one beat of an animation
bst_pause:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      bst_flush
    ldr     x0, =bst_delay
    ldr     w0, [x0]
    bl      delay_ms

    ldp     fp, lr, [sp], 16
    ret

// bst_say(x0 = format, w1 = first value, w2 = second, w3 = third)
// The one line that says what just happened, wiped before it is written.
bst_say:
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
    bl      bst_blank

    mov     w0, 19
    mov     w1, 4
    bl      ui_at
    mov     w0, BST_ROLE_TEXT
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

// bst_role_of(x0 = node) -> w0 = the colour role this node wears now
bst_role_of:
    ldr     x1, =bst_hl_node
    ldr     x2, =bst_hl_role
    mov     w3, 0

bst_role_scan:
    cmp     w3, 3
    b.ge    bst_role_seen
    ldr     x4, [x1, w3, sxtw 3]
    cmp     x4, x0
    b.eq    bst_role_hit
    add     w3, w3, 1
    b       bst_role_scan

bst_role_hit:
    ldr     w0, [x2, w3, sxtw 2]
    ret

bst_role_seen:
    ldr     w1, [x0, BST_SEEN]
    cbnz    w1, bst_role_visited
    mov     w0, BST_ROLE_NODE
    ret

bst_role_visited:
    mov     w0, BST_ROLE_OK
    ret

// bst_chip(w0 = row, w1 = left column, w2 = role, w3 = value)
// One filled four-column cell, the same shape at every level.
bst_chip:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    mov     w20, w1
    mov     w21, w2

    ldr     x0, =bst_cell
    mov     w1, w3
    mov     w2, 2                           // the cell is two columns wide
    bl      ui_num

    mov     w0, w19
    mov     w1, w20
    mov     w2, w21
    ldr     x3, =bst_cell
    bl      ui_badge

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// bst_link(w0 = link row, w1 = parent centre, w2 = distance to a child,
//          w3 = 1 when a left child exists, w4 = 1 when a right one does)
// A parent with one child gets a corner rather than a tee, so no line
// ever points at empty space.
bst_link:
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

    cbz     w22, bst_link_right_only

    mov     w0, w19
    sub     w1, w20, w21
    bl      ui_at
    mov     w0, BST_ROLE_FAINT
    bl      th_fg
    ldr     x0, =bst_elbow_l
    bl      printf
    ldr     x0, =bst_dash
    sub     w1, w21, 1
    bl      ui_repeat

    cbz     w23, bst_link_left_only

    ldr     x0, =bst_tee
    bl      printf
    ldr     x0, =bst_dash
    sub     w1, w21, 1
    bl      ui_repeat
    ldr     x0, =bst_elbow_r
    bl      printf
    b       bst_link_close

bst_link_left_only:
    ldr     x0, =bst_elbow_lo
    bl      printf
    b       bst_link_close

bst_link_right_only:
    cbz     w23, bst_link_done

    mov     w0, w19
    mov     w1, w20
    bl      ui_at
    mov     w0, BST_ROLE_FAINT
    bl      th_fg
    ldr     x0, =bst_elbow_ro
    bl      printf
    ldr     x0, =bst_dash
    sub     w1, w21, 1
    bl      ui_repeat
    ldr     x0, =bst_elbow_r
    bl      printf

bst_link_close:
    bl      th_off

bst_link_done:
    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// bst_draw(x0 = node, w1 = row, w2 = left column, w3 = distance to a
//          child, w4 = level)
// Children first, then the elbows, then this cell, so a cell is never
// half covered by the line that reaches it.
bst_draw:
    cbz     x0, bst_draw_done

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

    ldr     x24, [x19, BST_LEFT]
    ldr     x25, [x19, BST_RIGHT]

    cmp     w23, BST_LAST_LVL
    b.ge    bst_draw_deeper

    lsr     w26, w22, 1
    cmp     w26, 2
    b.ge    bst_draw_left
    mov     w26, 2

bst_draw_left:
    cbz     x24, bst_draw_right

    mov     x0, x24
    add     w1, w20, 2
    sub     w2, w21, w22
    mov     w3, w26
    add     w4, w23, 1
    bl      bst_draw

bst_draw_right:
    cbz     x25, bst_draw_links

    mov     x0, x25
    add     w1, w20, 2
    add     w2, w21, w22
    mov     w3, w26
    add     w4, w23, 1
    bl      bst_draw

bst_draw_links:
    add     w0, w20, 1
    add     w1, w21, 2                      // the centre of a four-wide cell
    mov     w2, w22
    mov     w3, 0
    cbz     x24, bst_draw_no_left
    mov     w3, 1
bst_draw_no_left:
    mov     w4, 0
    cbz     x25, bst_draw_no_right
    mov     w4, 1
bst_draw_no_right:
    bl      bst_link
    b       bst_draw_cell

bst_draw_deeper:
    orr     x0, x24, x25
    cbz     x0, bst_draw_cell

    add     w0, w20, 1
    add     w1, w21, 2
    mov     w2, BST_ROLE_FAINT
    ldr     x3, =bst_deeper
    bl      ui_text

bst_draw_cell:
    mov     x0, x19
    bl      bst_role_of
    mov     w27, w0

    ldr     w3, [x19, BST_DATA]
    mov     w0, w20
    mov     w1, w21
    mov     w2, w27
    bl      bst_chip

    ldr     x27, [sp, 80]
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96

bst_draw_done:
    ret

// bst_render(x0 = node A, w1 = role A, x2 = node B, w3 = role B,
//            x4 = node C, w5 = role C)
// Repaints the tree from the nodes themselves. A node of 0 means nothing
// is highlighted in that slot. The caption row belongs to bst_say.
bst_render:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x6, =bst_hl_node
    str     x0, [x6]
    str     x2, [x6, 8]
    str     x4, [x6, 16]
    ldr     x6, =bst_hl_role
    str     w1, [x6]
    str     w3, [x6, 4]
    str     w5, [x6, 8]

    mov     w19, 5
bst_render_wipe:
    cmp     w19, 14
    b.gt    bst_render_tree
    mov     w0, w19
    mov     w1, 3
    mov     w2, 76
    bl      bst_blank
    add     w19, w19, 1
    b       bst_render_wipe

bst_render_tree:
    ldr     x0, =bst_root
    ldr     x19, [x0]
    cbz     x19, bst_render_empty

    mov     x0, x19
    mov     w1, BST_TOP_ROW
    mov     w2, BST_TOP_COL
    mov     w3, BST_SPREAD
    mov     w4, 0
    bl      bst_draw

    mov     w0, BST_TOP_ROW
    mov     w1, BST_TOP_COL - 7
    mov     w2, BST_ROLE_KEY
    ldr     x3, =bst_lbl_root
    bl      ui_text
    b       bst_render_stats

bst_render_empty:
    mov     w0, 9
    mov     w1, 35
    mov     w2, BST_ROLE_FAINT
    ldr     x3, =bst_lbl_none
    bl      ui_text

bst_render_stats:
    mov     w0, 16
    mov     w1, 55
    mov     w2, 23
    bl      bst_blank

    ldr     x0, =bst_root
    ldr     x0, [x0]
    bl      bst_height_of
    mov     w20, w0

    mov     w0, 16
    mov     w1, 55
    bl      ui_at
    mov     w0, BST_ROLE_DIM
    bl      th_fg
    ldr     x0, =bst_node_count
    ldr     w1, [x0]
    mov     w2, w20
    ldr     x0, =bst_fmt_stat
    bl      printf
    bl      th_off

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// bst_rest() - repaint with nothing highlighted
bst_rest:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     x0, 0
    mov     w1, 0
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    bl      bst_render

    ldp     fp, lr, [sp], 16
    ret

// bst_order_reset() - start a fresh visit order strip
bst_order_reset:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =bst_order_len
    str     wzr, [x0]
    ldr     x0, =bst_order
    strb    wzr, [x0]

    mov     w0, 17
    mov     w1, 3
    mov     w2, 76
    bl      bst_blank

    mov     w0, 17
    mov     w1, 4
    mov     w2, BST_ROLE_DIM
    ldr     x3, =bst_lbl_order
    bl      ui_text

    ldp     fp, lr, [sp], 16
    ret

// bst_order_add(w0 = value) - append one value to the strip and redraw it
bst_order_add:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0

    ldr     x20, =bst_order_len
    ldr     w0, [x20]
    cmp     w0, BST_ORDER_MAX
    b.ge    bst_order_show

    ldr     x1, =bst_order
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

bst_order_show:
    mov     w0, 17
    mov     w1, 10
    mov     w2, BST_ROLE_KEY
    ldr     x3, =bst_order
    bl      ui_text

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// ------------------------------------------------------------- screens

// bst_legend() - the states a cell can wear while an operation runs
bst_legend:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, 16
    mov     w1, 4
    mov     w2, BST_ROLE_HOT
    ldr     x3, =bst_lg_hand
    bl      ui_badge

    mov     w0, 16
    mov     w1, 15
    mov     w2, BST_ROLE_WARN
    ldr     x3, =bst_lg_cmp
    bl      ui_badge

    mov     w0, 16
    mov     w1, 28
    mov     w2, BST_ROLE_OK
    ldr     x3, =bst_lg_set
    bl      ui_badge

    mov     w0, 16
    mov     w1, 39
    mov     w2, BST_ROLE_BAD
    ldr     x3, =bst_lg_gone
    bl      ui_badge

    ldp     fp, lr, [sp], 16
    ret

// bst_frame(x0 = screen title, x1 = footer hint, x2 = best, x3 = avg,
//           x4 = worst, x5 = space)
// Everything on an operation screen that does not move while it runs.
bst_frame:
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
    ldr     x4, =bst_pan_tree
    bl      ui_panel

    bl      bst_legend

    mov     w0, 17
    mov     w1, 4
    mov     w2, BST_ROLE_DIM
    ldr     x3, =bst_lbl_rule
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

// bst_ask(x0 = prompt) -> w0 = value, w1 = 1 when the value is usable
// One reader for all three prompts. It refuses a closed stdin and a value
// too wide for a cell, so the drawing can never be pushed out of shape.
bst_ask:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0

    mov     w0, 18
    mov     w1, 2
    mov     w2, 78
    bl      bst_blank
    mov     w0, 18
    mov     w1, 4
    mov     x2, x19
    bl      ui_prompt
    bl      bst_flush

    bl      read_int
    mov     w19, w0
    mov     w20, w1

    cbz     w20, bst_ask_stop               // stdin closed: walk out quietly

    cmp     w19, 0
    b.lt    bst_ask_range
    cmp     w19, 99
    b.gt    bst_ask_range

    mov     w0, w19
    mov     w1, 1
    b       bst_ask_done

bst_ask_range:
    ldr     x0, =bst_msg_range
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      bst_say
    mov     w0, 0
    mov     w1, 0
    b       bst_ask_done

bst_ask_stop:
    mov     w0, 0
    mov     w1, 0

bst_ask_done:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// bst_menu() - operations menu; choice 0 frees the tree and returns
    .global bst_menu
bst_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

bst_menu_loop:
    bl      bst_menu_draw

    mov     w0, 0
    mov     w1, 9
    bl      read_int_range

    cmp     w0, 0
    b.eq    bst_menu_exit
    cmp     w0, 1
    b.eq    bst_menu_insert
    cmp     w0, 2
    b.eq    bst_menu_delete
    cmp     w0, 3
    b.eq    bst_menu_search
    cmp     w0, 4
    b.eq    bst_menu_inorder
    cmp     w0, 5
    b.eq    bst_menu_preorder
    cmp     w0, 6
    b.eq    bst_menu_postorder
    cmp     w0, 7
    b.eq    bst_menu_levelorder
    cmp     w0, 8
    b.eq    bst_menu_sample
    cmp     w0, 9
    b.eq    bst_menu_show
    b       bst_menu_loop

bst_menu_insert:
    bl      bst_insert_interactive
    bl      wait_for_enter
    b       bst_menu_loop

bst_menu_delete:
    bl      bst_delete_interactive
    bl      wait_for_enter
    b       bst_menu_loop

bst_menu_search:
    bl      bst_search_interactive
    bl      wait_for_enter
    b       bst_menu_loop

bst_menu_inorder:
    bl      bst_inorder_interactive
    bl      wait_for_enter
    b       bst_menu_loop

bst_menu_preorder:
    bl      bst_preorder_interactive
    bl      wait_for_enter
    b       bst_menu_loop

bst_menu_postorder:
    bl      bst_postorder_interactive
    bl      wait_for_enter
    b       bst_menu_loop

bst_menu_levelorder:
    bl      bst_levelorder_interactive
    bl      wait_for_enter
    b       bst_menu_loop

bst_menu_sample:
    bl      bst_sample_interactive
    bl      wait_for_enter
    b       bst_menu_loop

bst_menu_show:
    bl      bst_show
    bl      wait_for_enter
    b       bst_menu_loop

bst_menu_exit:
    ldr     x0, =bst_root
    bl      bst_free_all
    ldp     fp, lr, [sp], 16
    ret

// bst_menu_draw() - the operations screen
bst_menu_draw:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    ldr     x0, =bst_scr_menu
    bl      ui_screen

    ldr     x0, =bst_hint_menu
    bl      ui_footer

    mov     w0, 4
    mov     w1, 7
    mov     w2, 66
    mov     w3, 14
    ldr     x4, =bst_pan_ops
    bl      ui_panel

    mov     w0, 5
    ldr     x1, =bst_key_1
    ldr     x2, =bst_opt_1
    bl      bst_menu_line

    mov     w0, 6
    ldr     x1, =bst_key_2
    ldr     x2, =bst_opt_2
    bl      bst_menu_line

    mov     w0, 7
    ldr     x1, =bst_key_3
    ldr     x2, =bst_opt_3
    bl      bst_menu_line

    mov     w0, 8
    ldr     x1, =bst_key_4
    ldr     x2, =bst_opt_4
    bl      bst_menu_line

    mov     w0, 9
    ldr     x1, =bst_key_5
    ldr     x2, =bst_opt_5
    bl      bst_menu_line

    mov     w0, 10
    ldr     x1, =bst_key_6
    ldr     x2, =bst_opt_6
    bl      bst_menu_line

    mov     w0, 11
    ldr     x1, =bst_key_7
    ldr     x2, =bst_opt_7
    bl      bst_menu_line

    mov     w0, 12
    ldr     x1, =bst_key_8
    ldr     x2, =bst_opt_8
    bl      bst_menu_line

    mov     w0, 13
    ldr     x1, =bst_key_9
    ldr     x2, =bst_opt_9
    bl      bst_menu_line

    mov     w0, 14
    ldr     x1, =bst_key_0
    ldr     x2, =bst_opt_0
    bl      bst_menu_line

    // how much tree there is, so the menu is never a dead end
    mov     w0, 16
    mov     w1, 10
    bl      ui_at
    mov     w0, BST_ROLE_DIM
    bl      th_fg
    ldr     x0, =bst_root
    ldr     x0, [x0]
    bl      bst_height_of
    mov     w19, w0
    ldr     x0, =bst_node_count
    ldr     w1, [x0]
    mov     w2, w19
    ldr     x0, =bst_fmt_stat
    bl      printf
    bl      th_off

    mov     w0, 19
    mov     w1, 10
    ldr     x2, =bst_ask_choice
    bl      ui_prompt
    bl      bst_flush

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// bst_menu_line(w0 = row, x1 = key text, x2 = option text)
bst_menu_line:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0
    mov     x21, x1
    mov     x20, x2

    mov     w0, w19
    mov     w1, 10
    mov     w2, BST_ROLE_KEY
    mov     x3, x21
    bl      ui_badge

    mov     w0, w19
    mov     w1, 14
    mov     w2, BST_ROLE_TEXT
    mov     x3, x20
    bl      ui_text

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// bst_insert_interactive() - the descent, one comparison a beat, then the
// node hung where the descent ran out of tree
bst_insert_interactive:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x0, =bst_scr_insert
    ldr     x1, =bst_hint_run
    ldr     x2, =bst_ologn
    ldr     x3, =bst_ologn
    ldr     x4, =bst_on
    ldr     x5, =bst_o1
    bl      bst_frame

    ldr     x0, =bst_root
    ldr     x0, [x0]
    bl      bst_clear_seen
    bl      bst_rest

    ldr     x0, =bst_ask_insert
    bl      bst_ask
    mov     w19, w0
    mov     w20, w1
    cbz     w20, bst_insert_int_done

    ldr     x0, =bst_root
    ldr     x21, [x0]                       // the node being compared with
    mov     w22, 0                          // comparisons made
    cbz     x21, bst_insert_int_place

    ldr     x0, =bst_msg_start
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      bst_say
    bl      bst_pause

bst_insert_int_walk:
    mov     x0, x21
    mov     w1, BST_ROLE_WARN
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    bl      bst_render

    add     w22, w22, 1
    ldr     w23, [x21, BST_DATA]
    cmp     w19, w23
    b.eq    bst_insert_int_dup
    b.gt    bst_insert_int_right

    ldr     x0, =bst_fmt_cmp_lt
    mov     w1, w19
    mov     w2, w23
    mov     w3, 0
    bl      bst_say
    bl      bst_pause

    ldr     x24, [x21, BST_LEFT]
    cbz     x24, bst_insert_int_hang_left
    mov     x21, x24
    b       bst_insert_int_walk

bst_insert_int_right:
    ldr     x0, =bst_fmt_cmp_gt
    mov     w1, w19
    mov     w2, w23
    mov     w3, 0
    bl      bst_say
    bl      bst_pause

    ldr     x24, [x21, BST_RIGHT]
    cbz     x24, bst_insert_int_hang_right
    mov     x21, x24
    b       bst_insert_int_walk

bst_insert_int_hang_left:
    ldr     x0, =bst_fmt_hang_l
    mov     w1, w23
    mov     w2, w19
    mov     w3, 0
    bl      bst_say
    bl      bst_pause
    b       bst_insert_int_place

bst_insert_int_hang_right:
    ldr     x0, =bst_fmt_hang_r
    mov     w1, w23
    mov     w2, w19
    mov     w3, 0
    bl      bst_say
    bl      bst_pause
    b       bst_insert_int_place

bst_insert_int_dup:
    bl      bst_rest
    ldr     x0, =bst_fmt_dup
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      bst_say
    b       bst_insert_int_done

bst_insert_int_place:
    ldr     x0, =bst_root
    mov     w1, w19
    bl      bst_insert
    cbz     w0, bst_insert_int_refused

    ldr     x0, =bst_root
    ldr     x0, [x0]
    mov     w1, w19
    bl      bst_search
    mov     x21, x0

    mov     x0, x21
    mov     w1, BST_ROLE_HOT
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    bl      bst_render

    cbnz    w22, bst_insert_int_report

    ldr     x0, =bst_msg_root
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      bst_say
    b       bst_insert_int_done

bst_insert_int_report:
    ldr     x0, =bst_root
    ldr     x0, [x0]
    mov     w1, w19
    bl      bst_depth_of
    mov     w23, w0

    ldr     x0, =bst_fmt_placed
    mov     w1, w19
    mov     w2, w22
    mov     w3, w23
    bl      bst_say
    b       bst_insert_int_done

bst_insert_int_refused:
    ldr     x0, =bst_msg_alloc
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      bst_say

bst_insert_int_done:
    bl      bst_flush
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// bst_search_interactive() - the same descent, with nothing to store
bst_search_interactive:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x0, =bst_scr_search
    ldr     x1, =bst_hint_run
    ldr     x2, =bst_o1
    ldr     x3, =bst_ologn
    ldr     x4, =bst_on
    ldr     x5, =bst_o1
    bl      bst_frame

    ldr     x0, =bst_root
    ldr     x0, [x0]
    bl      bst_clear_seen
    bl      bst_rest

    ldr     x0, =bst_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    bst_search_int_empty

    ldr     x0, =bst_ask_search
    bl      bst_ask
    mov     w19, w0
    mov     w20, w1
    cbz     w20, bst_search_int_done

    ldr     x0, =bst_root
    ldr     x21, [x0]
    mov     w22, 0

bst_search_int_walk:
    cbz     x21, bst_search_int_missing

    mov     x0, x21
    mov     w1, BST_ROLE_WARN
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    bl      bst_render

    add     w22, w22, 1
    ldr     w23, [x21, BST_DATA]
    cmp     w19, w23
    b.eq    bst_search_int_hit
    b.gt    bst_search_int_right

    ldr     x0, =bst_fmt_cmp_lt
    mov     w1, w19
    mov     w2, w23
    mov     w3, 0
    bl      bst_say
    bl      bst_pause
    ldr     x21, [x21, BST_LEFT]
    b       bst_search_int_walk

bst_search_int_right:
    ldr     x0, =bst_fmt_cmp_gt
    mov     w1, w19
    mov     w2, w23
    mov     w3, 0
    bl      bst_say
    bl      bst_pause
    ldr     x21, [x21, BST_RIGHT]
    b       bst_search_int_walk

bst_search_int_hit:
    mov     x0, x21
    mov     w1, BST_ROLE_OK
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    bl      bst_render

    ldr     x0, =bst_root
    ldr     x0, [x0]
    mov     w1, w19
    bl      bst_depth_of
    mov     w24, w0

    ldr     x0, =bst_fmt_found
    mov     w1, w19
    mov     w2, w22
    mov     w3, w24
    bl      bst_say
    b       bst_search_int_done

bst_search_int_missing:
    bl      bst_rest
    ldr     x0, =bst_fmt_missing
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      bst_say
    b       bst_search_int_done

bst_search_int_empty:
    ldr     x0, =bst_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      bst_say

bst_search_int_done:
    bl      bst_flush
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// bst_delete_interactive() - find the node, name the case it falls into,
// then let the recursive delete do the work
bst_delete_interactive:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x0, =bst_scr_delete
    ldr     x1, =bst_hint_run
    ldr     x2, =bst_ologn
    ldr     x3, =bst_ologn
    ldr     x4, =bst_on
    ldr     x5, =bst_o1
    bl      bst_frame

    ldr     x0, =bst_root
    ldr     x0, [x0]
    bl      bst_clear_seen
    bl      bst_rest

    ldr     x0, =bst_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    bst_delete_int_empty

    ldr     x0, =bst_ask_delete
    bl      bst_ask
    mov     w19, w0
    mov     w20, w1
    cbz     w20, bst_delete_int_done

    ldr     x0, =bst_root
    ldr     x21, [x0]

bst_delete_int_walk:
    cbz     x21, bst_delete_int_missing

    mov     x0, x21
    mov     w1, BST_ROLE_WARN
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    bl      bst_render

    ldr     w23, [x21, BST_DATA]
    cmp     w19, w23
    b.eq    bst_delete_int_hit
    b.gt    bst_delete_int_right

    ldr     x0, =bst_fmt_cmp_lt
    mov     w1, w19
    mov     w2, w23
    mov     w3, 0
    bl      bst_say
    bl      bst_pause
    ldr     x21, [x21, BST_LEFT]
    b       bst_delete_int_walk

bst_delete_int_right:
    ldr     x0, =bst_fmt_cmp_gt
    mov     w1, w19
    mov     w2, w23
    mov     w3, 0
    bl      bst_say
    bl      bst_pause
    ldr     x21, [x21, BST_RIGHT]
    b       bst_delete_int_walk

bst_delete_int_hit:
    mov     x0, x21
    mov     w1, BST_ROLE_BAD
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    bl      bst_render

    ldr     x22, [x21, BST_LEFT]
    ldr     x23, [x21, BST_RIGHT]

    cbz     x22, bst_delete_int_thin
    cbz     x23, bst_delete_int_thin

    // two children: the successor is the smallest thing on the right
    ldr     x0, [x21, BST_RIGHT]
    bl      bst_find_min
    mov     x24, x0

    mov     x0, x21
    mov     w1, BST_ROLE_BAD
    mov     x2, x24
    mov     w3, BST_ROLE_HOT
    mov     x4, 0
    mov     w5, 0
    bl      bst_render

    ldr     w2, [x24, BST_DATA]
    ldr     x0, =bst_fmt_two
    mov     w1, w19
    mov     w3, 0
    bl      bst_say
    bl      bst_pause
    b       bst_delete_int_apply

bst_delete_int_thin:
    orr     x0, x22, x23
    cbnz    x0, bst_delete_int_one

    ldr     x0, =bst_fmt_leaf
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      bst_say
    bl      bst_pause
    b       bst_delete_int_apply

bst_delete_int_one:
    ldr     x0, =bst_fmt_one
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      bst_say
    bl      bst_pause

bst_delete_int_apply:
    ldr     x0, =bst_root
    mov     w1, w19
    bl      bst_delete

    ldr     x0, =bst_node_count
    ldr     w1, [x0]
    sub     w1, w1, 1
    str     w1, [x0]

    bl      bst_rest
    ldr     x0, =bst_fmt_deleted
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      bst_say
    b       bst_delete_int_done

bst_delete_int_missing:
    bl      bst_rest
    ldr     x0, =bst_fmt_missing
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      bst_say
    b       bst_delete_int_done

bst_delete_int_empty:
    ldr     x0, =bst_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      bst_say

bst_delete_int_done:
    bl      bst_flush
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// ---------------------------------------------------------- traversals

// bst_visit(x0 = node, x1 = caption naming the value) - paint it, say it,
// and add it to the order strip
bst_visit:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0
    mov     x20, x1

    mov     x0, x19
    mov     w1, BST_ROLE_HOT
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    bl      bst_render

    mov     x0, x20
    ldr     w1, [x19, BST_DATA]
    mov     w2, 0
    mov     w3, 0
    bl      bst_say

    ldr     w0, [x19, BST_DATA]
    bl      bst_order_add
    bl      bst_pause

    mov     w0, 1
    str     w0, [x19, BST_SEEN]             // the paint outlives the beat

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// bst_inorder_walk(x0 = node) - left, node, right
bst_inorder_walk:
    cbz     x0, bst_inorder_walk_done

    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0
    ldr     x0, [x19, BST_LEFT]
    bl      bst_inorder_walk
    mov     x0, x19
    ldr     x1, =bst_fmt_visit
    bl      bst_visit
    ldr     x0, [x19, BST_RIGHT]
    bl      bst_inorder_walk

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32

bst_inorder_walk_done:
    ret

// bst_preorder_walk(x0 = node) - node, left, right
bst_preorder_walk:
    cbz     x0, bst_preorder_walk_done

    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0
    mov     x0, x19
    ldr     x1, =bst_fmt_visit
    bl      bst_visit
    ldr     x0, [x19, BST_LEFT]
    bl      bst_preorder_walk
    ldr     x0, [x19, BST_RIGHT]
    bl      bst_preorder_walk

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32

bst_preorder_walk_done:
    ret

// bst_postorder_walk(x0 = node) - left, right, node
bst_postorder_walk:
    cbz     x0, bst_postorder_walk_done

    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0
    ldr     x0, [x19, BST_LEFT]
    bl      bst_postorder_walk
    ldr     x0, [x19, BST_RIGHT]
    bl      bst_postorder_walk
    mov     x0, x19
    ldr     x1, =bst_fmt_visit
    bl      bst_visit

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32

bst_postorder_walk_done:
    ret

// bst_traverse_frame(x0 = screen title) - the shell every traversal wears
bst_traverse_frame:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0

    mov     x0, x19
    ldr     x1, =bst_hint_run
    ldr     x2, =bst_on
    ldr     x3, =bst_on
    ldr     x4, =bst_on
    ldr     x5, =bst_oh
    bl      bst_frame

    ldr     x0, =bst_root
    ldr     x0, [x0]
    bl      bst_clear_seen

    bl      bst_rest
    bl      bst_order_reset

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// bst_inorder_interactive() - sorted order, and the reason it is sorted
bst_inorder_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =bst_scr_in
    bl      bst_traverse_frame

    ldr     x0, =bst_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    bst_inorder_int_empty

    ldr     x0, =bst_root
    ldr     x0, [x0]
    bl      bst_inorder_walk

    bl      bst_rest
    ldr     x0, =bst_fmt_done_in
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      bst_say
    b       bst_inorder_int_done

bst_inorder_int_empty:
    ldr     x0, =bst_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      bst_say

bst_inorder_int_done:
    bl      bst_flush
    ldp     fp, lr, [sp], 16
    ret

// bst_preorder_interactive() - the shape, parent first
bst_preorder_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =bst_scr_pre
    bl      bst_traverse_frame

    ldr     x0, =bst_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    bst_preorder_int_empty

    ldr     x0, =bst_root
    ldr     x0, [x0]
    bl      bst_preorder_walk

    bl      bst_rest
    ldr     x0, =bst_fmt_done_pre
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      bst_say
    b       bst_preorder_int_done

bst_preorder_int_empty:
    ldr     x0, =bst_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      bst_say

bst_preorder_int_done:
    bl      bst_flush
    ldp     fp, lr, [sp], 16
    ret

// bst_postorder_interactive() - children before parents
bst_postorder_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =bst_scr_post
    bl      bst_traverse_frame

    ldr     x0, =bst_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    bst_postorder_int_empty

    ldr     x0, =bst_root
    ldr     x0, [x0]
    bl      bst_postorder_walk

    bl      bst_rest
    ldr     x0, =bst_fmt_done_post
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      bst_say
    b       bst_postorder_int_done

bst_postorder_int_empty:
    ldr     x0, =bst_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      bst_say

bst_postorder_int_done:
    bl      bst_flush
    ldp     fp, lr, [sp], 16
    ret

// bst_levelorder_interactive() - the one traversal with no recursion in
// it: a queue holds the frontier, so the tree comes out a level at a time
bst_levelorder_interactive:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x0, =bst_scr_level
    bl      bst_traverse_frame

    ldr     x0, =bst_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    bst_level_int_empty

    ldr     x19, =bst_queue
    mov     w20, 0                          // the end values come off
    mov     w21, 0                          // the end children go on
    mov     w22, 0                          // how many are waiting

    ldr     x0, =bst_root
    ldr     x0, [x0]
    str     x0, [x19]
    mov     w21, 1
    mov     w22, 1

bst_level_int_loop:
    cmp     w22, 0
    b.le    bst_level_int_over

    ldr     x23, [x19, w20, uxtw 3]
    add     w20, w20, 1
    and     w20, w20, 63                    // the ring holds sixty-four
    sub     w22, w22, 1

    // the children join the back before the node is painted, so the
    // caption is already true when it appears
    ldr     x24, [x23, BST_LEFT]
    cbz     x24, bst_level_int_right
    str     x24, [x19, w21, uxtw 3]
    add     w21, w21, 1
    and     w21, w21, 63
    add     w22, w22, 1

bst_level_int_right:
    ldr     x24, [x23, BST_RIGHT]
    cbz     x24, bst_level_int_paint
    str     x24, [x19, w21, uxtw 3]
    add     w21, w21, 1
    and     w21, w21, 63
    add     w22, w22, 1

bst_level_int_paint:
    mov     x0, x23
    ldr     x1, =bst_fmt_queued
    bl      bst_visit
    b       bst_level_int_loop

bst_level_int_over:
    bl      bst_rest
    ldr     x0, =bst_fmt_done_lvl
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      bst_say
    b       bst_level_int_done

bst_level_int_empty:
    ldr     x0, =bst_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      bst_say

bst_level_int_done:
    bl      bst_flush
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// ------------------------------------------------------ whole-tree work

// bst_sample_interactive() - seven values in an order that happens to
// balance, inserted one at a time so the shape builds in view
bst_sample_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =bst_scr_sample
    ldr     x1, =bst_hint_run
    ldr     x2, =bst_on
    ldr     x3, =bst_on
    ldr     x4, =bst_on
    ldr     x5, =bst_o1
    bl      bst_frame

    ldr     x0, =bst_root
    bl      bst_free_all
    bl      bst_rest

    mov     w0, 50
    bl      bst_sample_step
    mov     w0, 30
    bl      bst_sample_step
    mov     w0, 70
    bl      bst_sample_step
    mov     w0, 20
    bl      bst_sample_step
    mov     w0, 40
    bl      bst_sample_step
    mov     w0, 60
    bl      bst_sample_step
    mov     w0, 80
    bl      bst_sample_step

    bl      bst_rest
    ldr     x0, =bst_msg_sample
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      bst_say
    bl      bst_flush

    ldp     fp, lr, [sp], 16
    ret

// bst_sample_step(w0 = value) - one insert, drawn
bst_sample_step:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0

    ldr     x0, =bst_root
    mov     w1, w19
    bl      bst_insert

    ldr     x0, =bst_root
    ldr     x0, [x0]
    mov     w1, w19
    bl      bst_search

    mov     w1, BST_ROLE_HOT
    mov     x2, 0
    mov     w3, 0
    mov     x4, 0
    mov     w5, 0
    bl      bst_render

    ldr     x0, =bst_fmt_visit
    mov     w1, w19
    mov     w2, 0
    mov     w3, 0
    bl      bst_say
    bl      bst_pause

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// bst_show() - the tree, nothing moving
bst_show:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x0, =bst_scr_show
    ldr     x1, =bst_hint_run
    ldr     x2, =bst_o1
    ldr     x3, =bst_ologn
    ldr     x4, =bst_on
    ldr     x5, =bst_o1
    bl      bst_frame

    ldr     x0, =bst_root
    ldr     x0, [x0]
    bl      bst_clear_seen
    bl      bst_rest

    ldr     x0, =bst_node_count
    ldr     w19, [x0]
    cmp     w19, 0
    b.le    bst_show_empty

    ldr     x0, =bst_root
    ldr     x0, [x0]
    bl      bst_height_of
    mov     w20, w0

    ldr     x0, =bst_fmt_state
    mov     w1, w19
    mov     w2, w20
    mov     w3, 0
    bl      bst_say
    b       bst_show_done

bst_show_empty:
    ldr     x0, =bst_msg_empty
    mov     w1, 0
    mov     w2, 0
    mov     w3, 0
    bl      bst_say

bst_show_done:
    bl      bst_flush
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret
