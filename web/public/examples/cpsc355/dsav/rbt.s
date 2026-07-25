// rbt_viz.asm - red-black tree: insert, delete, search, fixups
// nodes are red or black, root and nil are black, a red node has black
// children, and every root-to-nil path counts the same number of blacks

define(fp, x29)
define(lr, x30)

    .data
    .balign 8

// node field offsets and size
define(RB_NODE_DATA, 0)
define(RB_NODE_LEFT, 8)
define(RB_NODE_RIGHT, 16)
define(RB_NODE_PARENT, 24)
define(RB_NODE_COLOR, 32)
define(RB_NODE_SIZE, 40)

// node colors are plain 0/1 flags, not the old shared ansi color numbers
define(COLOR_BLACK, 0)
define(COLOR_RED, 1)
NULL = 0

// tree state
rb_root:            .dword 0
rb_nil:             .dword 0
rb_node_count:      .word 0
rb_height:          .word 0

// ui strings
rb_title:           .string "RED-BLACK TREE VISUALIZATION"
rb_menu_title:      .string "RED-BLACK TREE OPERATIONS"

menu_rb_1:          .string "[1] Insert Node"
menu_rb_2:          .string "[2] Search Node"
menu_rb_3:          .string "[3] Delete Node"
menu_rb_4:          .string "[4] Inorder Traversal"
menu_rb_5:          .string "[5] Initialize Sample Tree"
menu_rb_6:          .string "[6] Display Tree"
menu_rb_7:          .string "[7] Verify RB Properties"
menu_rb_0:          .string "[0] Back to Main Menu"

rb_menu_prompt:        .string "Enter your choice: "
rb_prompt_value:       .string "Enter value: "

rb_msg_inserted:       .string "\x1b[32m✓ Node %d inserted successfully\x1b[0m"
rb_msg_found:          .string "\x1b[32m✓ Node %d found!\x1b[0m"
rb_msg_not_found:      .string "\x1b[31m✗ Node %d not found\x1b[0m"
rb_msg_empty_tree:     .string "\x1b[33mTree is empty!\x1b[0m"
msg_duplicate:      .string "\x1b[33m⚠ Node %d already exists\x1b[0m"
msg_searching:      .string "Searching for %d..."
msg_visiting:       .string "Visiting node: %d"
rb_msg_comparing:      .string "Comparing with node: %d"
msg_inserted_at:    .string "Inserted %d as %s child"
msg_left:           .string "LEFT"
msg_right:          .string "RIGHT"
rb_msg_deleted:        .string "\x1b[32m✓ Node %d deleted successfully\x1b[0m"
msg_deleting:       .string "Deleting node: %d"

// property verification messages
msg_prop_header:    .string "\x1b[1;36m=== RB TREE PROPERTIES ===\x1b[0m"
msg_prop_1:         .string "✓ Property 1: All nodes are RED or BLACK"
msg_prop_2:         .string "✓ Property 2: Root is BLACK"
msg_prop_3:         .string "✓ Property 3: NIL leaves are BLACK"
msg_prop_4:         .string "✓ Property 4: No consecutive RED nodes"
msg_prop_5:         .string "✓ Property 5: Equal black-height on all paths"
msg_prop_footer:    .string "\x1b[32mAll RB tree properties are satisfied!\x1b[0m"
msg_node_info:      .string "Total nodes: %d | Tree height: %d | Balanced: ✓"

// highlight colors
color_red_node:     .string "\x1b[41;97m"
color_black_node:   .string "\x1b[47;30m"
color_nil_node:     .string "\x1b[100;37m"
color_z:            .string "\x1b[43;30m"
color_parent:       .string "\x1b[46;30m"
color_gp:           .string "\x1b[45;37m"
color_uncle:        .string "\x1b[42;30m"
rb_color_reset:        .string "\x1b[0m"

rb_visual_delay:    .word 600

    .text
    .balign 4

// rb_init_nil() - allocate the shared black nil sentinel (safe to call again)
    .global rb_init_nil
rb_init_nil:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =rb_nil
    ldr     x1, [x0]
    cbnz    x1, init_nil_done

    mov     x0, RB_NODE_SIZE
    bl      malloc
    cbz     x0, init_nil_done

    mov     x1, 0
    str     x1, [x0, RB_NODE_DATA]
    str     x1, [x0, RB_NODE_LEFT]
    str     x1, [x0, RB_NODE_RIGHT]
    str     x1, [x0, RB_NODE_PARENT]
    mov     w1, COLOR_BLACK
    strb    w1, [x0, RB_NODE_COLOR]

    ldr     x1, =rb_nil
    str     x0, [x1]

init_nil_done:
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

    mov     x0, RB_NODE_SIZE
    bl      malloc
    cbz     x0, rb_create_node_fail

    str     w19, [x0, RB_NODE_DATA]

    ldr     x1, =rb_nil
    ldr     x1, [x1]
    str     x1, [x0, RB_NODE_LEFT]
    str     x1, [x0, RB_NODE_RIGHT]

    mov     x1, 0
    str     x1, [x0, RB_NODE_PARENT]

    mov     w1, COLOR_RED
    strb    w1, [x0, RB_NODE_COLOR]

rb_create_node_fail:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_get_color(x0 = node) -> w0 = color; nil and null read as black
    .global rb_get_color
rb_get_color:
    ldr     x1, =rb_nil
    ldr     x1, [x1]
    cmp     x0, x1
    b.eq    get_color_nil
    cbz     x0, get_color_nil

    ldrb    w0, [x0, RB_NODE_COLOR]
    ret

get_color_nil:
    mov     w0, COLOR_BLACK
    ret

// rb_set_color(x0 = node, w1 = color) - does nothing for nil or null
    .global rb_set_color
rb_set_color:
    ldr     x2, =rb_nil
    ldr     x2, [x2]
    cmp     x0, x2
    b.eq    set_color_done
    cbz     x0, set_color_done

    strb    w1, [x0, RB_NODE_COLOR]

set_color_done:
    ret

// rotate_left(x0 = pivot) - the right child takes the pivot's place
    .global rotate_left
rotate_left:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     x19, x0

    ldr     x20, [x19, RB_NODE_RIGHT]
    cbz     x20, rotate_left_done

    ldr     x21, [x20, RB_NODE_LEFT]
    str     x21, [x19, RB_NODE_RIGHT]

    ldr     x22, =rb_nil
    ldr     x22, [x22]
    cmp     x21, x22
    b.eq    rotate_left_skip_b_parent
    str     x19, [x21, RB_NODE_PARENT]

rotate_left_skip_b_parent:
    ldr     x21, [x19, RB_NODE_PARENT]
    str     x21, [x20, RB_NODE_PARENT]

    cbz     x21, rotate_left_at_root
    ldr     x22, [x21, RB_NODE_LEFT]
    cmp     x22, x19
    b.eq    rotate_left_x_was_left

    str     x20, [x21, RB_NODE_RIGHT]
    b       rotate_left_finish

rotate_left_x_was_left:
    str     x20, [x21, RB_NODE_LEFT]
    b       rotate_left_finish

rotate_left_at_root:
    ldr     x21, =rb_root
    str     x20, [x21]

rotate_left_finish:
    str     x19, [x20, RB_NODE_LEFT]
    str     x20, [x19, RB_NODE_PARENT]

rotate_left_done:
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// rotate_right(x0 = pivot) - the left child takes the pivot's place
    .global rotate_right
rotate_right:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     x19, x0

    ldr     x20, [x19, RB_NODE_LEFT]
    cbz     x20, rotate_right_done

    ldr     x21, [x20, RB_NODE_RIGHT]
    str     x21, [x19, RB_NODE_LEFT]

    ldr     x22, =rb_nil
    ldr     x22, [x22]
    cmp     x21, x22
    b.eq    rotate_right_skip_b_parent
    str     x19, [x21, RB_NODE_PARENT]

rotate_right_skip_b_parent:
    ldr     x21, [x19, RB_NODE_PARENT]
    str     x21, [x20, RB_NODE_PARENT]

    cbz     x21, rotate_right_at_root
    ldr     x22, [x21, RB_NODE_LEFT]
    cmp     x22, x19
    b.eq    rotate_right_y_was_left

    str     x20, [x21, RB_NODE_RIGHT]
    b       rotate_right_finish

rotate_right_y_was_left:
    str     x20, [x21, RB_NODE_LEFT]
    b       rotate_right_finish

rotate_right_at_root:
    ldr     x21, =rb_root
    str     x20, [x21]

rotate_right_finish:
    str     x19, [x20, RB_NODE_RIGHT]
    str     x20, [x19, RB_NODE_PARENT]

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

fixup_loop:
    ldr     x20, [x19, RB_NODE_PARENT]
    cbz     x20, fixup_done
    ldrb    w0, [x20, RB_NODE_COLOR]
    cmp     w0, COLOR_BLACK
    b.eq    fixup_done

    ldr     x21, [x20, RB_NODE_PARENT]

    ldr     x22, [x21, RB_NODE_LEFT]
    cmp     x20, x22
    b.eq    fixup_parent_is_left

fixup_parent_is_right:
    ldr     x23, [x21, RB_NODE_LEFT]
    ldrb    w0, [x23, RB_NODE_COLOR]
    cmp     w0, COLOR_RED
    b.eq    fixup_case1_right

    ldr     x24, [x20, RB_NODE_LEFT]
    cmp     x19, x24
    b.eq    fixup_case2_right

fixup_case3_right:
    mov     w1, COLOR_BLACK
    strb    w1, [x20, RB_NODE_COLOR]
    mov     w1, COLOR_RED
    strb    w1, [x21, RB_NODE_COLOR]
    mov     x0, x21
    bl      rotate_left
    b       fixup_done

fixup_case2_right:
    mov     x19, x20
    mov     x0, x20
    bl      rotate_right
    b       fixup_loop

fixup_case1_right:
    mov     w1, COLOR_BLACK
    strb    w1, [x20, RB_NODE_COLOR]
    strb    w1, [x23, RB_NODE_COLOR]
    mov     w1, COLOR_RED
    strb    w1, [x21, RB_NODE_COLOR]
    mov     x19, x21
    b       fixup_loop

fixup_parent_is_left:
    ldr     x23, [x21, RB_NODE_RIGHT]
    ldrb    w0, [x23, RB_NODE_COLOR]
    cmp     w0, COLOR_RED
    b.eq    fixup_case1_left

    ldr     x24, [x20, RB_NODE_RIGHT]
    cmp     x19, x24
    b.eq    fixup_case2_left

fixup_case3_left:
    mov     w1, COLOR_BLACK
    strb    w1, [x20, RB_NODE_COLOR]
    mov     w1, COLOR_RED
    strb    w1, [x21, RB_NODE_COLOR]
    mov     x0, x21
    bl      rotate_right
    b       fixup_done

fixup_case2_left:
    mov     x19, x20
    mov     x0, x20
    bl      rotate_left
    b       fixup_loop

fixup_case1_left:
    mov     w1, COLOR_BLACK
    strb    w1, [x20, RB_NODE_COLOR]
    strb    w1, [x23, RB_NODE_COLOR]
    mov     w1, COLOR_RED
    strb    w1, [x21, RB_NODE_COLOR]
    mov     x19, x21
    b       fixup_loop

fixup_done:
    ldr     x0, =rb_root
    ldr     x0, [x0]
    mov     w1, COLOR_BLACK
    bl      rb_set_color

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
    ldr     w0, [x21, RB_NODE_DATA]
    cmp     w20, w0
    b.eq    rb_insert_duplicate
    b.lt    rb_insert_go_left

rb_insert_go_right:
    ldr     x21, [x21, RB_NODE_RIGHT]
    cmp     x21, x25
    b.eq    rb_insert_right_child
    cbz     x21, rb_insert_right_child
    b       rb_insert_loop

rb_insert_go_left:
    ldr     x21, [x21, RB_NODE_LEFT]
    cmp     x21, x25
    b.eq    rb_insert_left_child
    cbz     x21, rb_insert_left_child
    b       rb_insert_loop

rb_insert_right_child:
    str     x24, [x22, RB_NODE_RIGHT]
    str     x22, [x24, RB_NODE_PARENT]
    b       rb_insert_fixup_call

rb_insert_left_child:
    str     x24, [x22, RB_NODE_LEFT]
    str     x22, [x24, RB_NODE_PARENT]
    b       rb_insert_fixup_call

rb_insert_as_root:
    str     x24, [x19]
    mov     w1, COLOR_BLACK
    strb    w1, [x24, RB_NODE_COLOR]
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

    ldr     w3, [x0, RB_NODE_DATA]
    cmp     w1, w3
    b.eq    rb_search_found
    b.lt    rb_search_left

rb_search_right:
    ldr     x0, [x0, RB_NODE_RIGHT]
    b       rb_search_loop

rb_search_left:
    ldr     x0, [x0, RB_NODE_LEFT]
    b       rb_search_loop

rb_search_not_found:
    mov     x0, 0

rb_search_found:
    ldp     fp, lr, [sp], 16
    ret

// rb_inorder(x0 = node) - print the subtree in sorted order
    .global rb_inorder
rb_inorder:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0

    ldr     x20, =rb_nil
    ldr     x20, [x20]
    cmp     x19, x20
    b.eq    rb_inorder_done
    cbz     x19, rb_inorder_done

    ldr     x0, [x19, RB_NODE_LEFT]
    bl      rb_inorder

    ldr     x0, =.Lfmt_int
    ldr     w1, [x19, RB_NODE_DATA]
    bl      printf

    ldr     x0, [x19, RB_NODE_RIGHT]
    bl      rb_inorder

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32

rb_inorder_done:
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

    ldr     x0, [x19, RB_NODE_LEFT]
    cmp     x0, x20
    b.eq    rb_free_skip_left
    bl      rb_free_recursive

rb_free_skip_left:
    ldr     x0, [x19, RB_NODE_RIGHT]
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

// rb_draw_node_recursive(x0 = node, w1 = row, w2 = col, w3 = spread)
// x4 and x5 pick nodes to draw highlighted
    .global rb_draw_node_recursive
rb_draw_node_recursive:
    cbz     x0, rb_draw_node_done

    stp     fp, lr, [sp, -112]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]
    stp     x27, x28, [sp, 80]
    str     x4, [sp, 96]
    str     x5, [sp, 104]

    mov     x19, x0
    mov     w20, w1
    mov     w21, w2
    mov     w22, w3

    ldr     x23, =rb_nil
    ldr     x23, [x23]

    cmp     x19, x23
    b.eq    rb_draw_node_done

    lsr     w24, w22, 1
    cmp     w24, 2
    b.ge    rb_draw_spacing_ok
    mov     w24, 2
rb_draw_spacing_ok:

    ldr     x0, [x19, RB_NODE_LEFT]
    cmp     x0, x23
    b.eq    rb_draw_skip_left

    add     w1, w20, 2
    sub     w2, w21, w24
    mov     w3, w24
    ldr     x4, [sp, 96]
    ldr     x5, [sp, 104]
    mov     x6, 0
    mov     x7, 0
    bl      rb_draw_node_recursive

    add     w0, w20, 1
    sub     w1, w21, 1
    bl      ansi_move_cursor
    ldr     x0, =.Ltree_branch_left
    bl      printf

rb_draw_skip_left:
    ldr     x0, [x19, RB_NODE_RIGHT]
    cmp     x0, x23
    b.eq    rb_draw_skip_right

    add     w1, w20, 2
    add     w2, w21, w24
    mov     w3, w24
    ldr     x4, [sp, 96]
    ldr     x5, [sp, 104]
    mov     x6, 0
    mov     x7, 0
    bl      rb_draw_node_recursive

    add     w0, w20, 1
    add     w1, w21, 1
    bl      ansi_move_cursor
    ldr     x0, =.Ltree_branch_right
    bl      printf

rb_draw_skip_right:
    mov     w0, w20
    sub     w1, w21, 1
    bl      ansi_move_cursor

    ldr     x4, [sp, 96]
    ldr     x5, [sp, 104]
    cmp     x19, x4
    b.eq    rb_draw_highlight_z
    cmp     x19, x5
    b.eq    rb_draw_highlight_parent

    ldrb    w0, [x19, RB_NODE_COLOR]
    cmp     w0, COLOR_RED
    b.eq    rb_draw_red_node

rb_draw_black_node:
    ldr     x0, =color_black_node
    bl      printf
    b       rb_draw_print_value

rb_draw_red_node:
    ldr     x0, =color_red_node
    bl      printf
    b       rb_draw_print_value

rb_draw_highlight_z:
    ldr     x0, =color_z
    bl      printf
    b       rb_draw_print_value

rb_draw_highlight_parent:
    ldr     x0, =color_parent
    bl      printf

rb_draw_print_value:
    ldr     x0, =.Lrb_node_fmt
    ldr     w1, [x19, RB_NODE_DATA]
    bl      printf

    ldr     x0, =rb_color_reset
    bl      printf

    ldr     x5, [sp, 104]
    ldr     x4, [sp, 96]
    ldp     x27, x28, [sp, 80]
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 112

rb_draw_node_done:
    ret

// rb_display_tree_visual() - clear the screen and draw the whole tree
    .global rb_display_tree_visual
rb_display_tree_visual:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      ansi_clear_screen

    ldr     x0, =rb_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    rb_display_visual_empty

    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =rb_title
    mov     w1, 80
    bl      print_centered

    ldr     x0, =rb_root
    ldr     x0, [x0]
    mov     w1, 5
    mov     w2, 40
    mov     w3, 20
    mov     x4, 0
    mov     x5, 0
    mov     x6, 0
    mov     x7, 0
    bl      rb_draw_node_recursive

    b       rb_display_visual_done

rb_display_visual_empty:
    mov     w0, 10
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =rb_msg_empty_tree
    bl      printf
    bl      print_newline

rb_display_visual_done:
    ldp     fp, lr, [sp], 16
    ret

// rb_insert_animated(x0 = &root, w1 = value) - animate the walk, then insert
    .global rb_insert_animated
rb_insert_animated:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    str     x25, [sp, 64]

    mov     x19, x0                      // x19 = &root
    mov     w20, w1                      // w20 = value to insert

    ldr     x25, =rb_visual_delay
    ldr     w25, [x25]

    ldr     x21, [x19]                   // x21 = current
    ldr     x22, =rb_nil
    ldr     x22, [x22]

    cmp     x21, x22
    b.eq    rb_insert_anim_empty
    cbz     x21, rb_insert_anim_empty

    // walk down, redrawing with each visited node highlighted
rb_insert_anim_search_loop:
    bl      ansi_clear_screen
    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =rb_title
    mov     w1, 80
    bl      print_centered

    mov     w0, 3
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =rb_msg_comparing
    ldr     w1, [x21, RB_NODE_DATA]
    bl      printf

    ldr     x0, =rb_root
    ldr     x0, [x0]
    mov     w1, 6
    mov     w2, 40
    mov     w3, 20
    mov     x4, x21                      // highlight current
    mov     x5, 0
    bl      rb_draw_node_recursive

    mov     x0, 0
    bl      fflush
    mov     w0, w25
    bl      delay_ms

    ldr     w0, [x21, RB_NODE_DATA]
    cmp     w20, w0
    b.eq    rb_insert_anim_duplicate
    b.lt    rb_insert_anim_go_left

rb_insert_anim_go_right:
    ldr     x23, [x21, RB_NODE_RIGHT]
    cmp     x23, x22
    b.eq    rb_insert_anim_do_insert
    cbz     x23, rb_insert_anim_do_insert
    mov     x21, x23
    b       rb_insert_anim_search_loop

rb_insert_anim_go_left:
    ldr     x23, [x21, RB_NODE_LEFT]
    cmp     x23, x22
    b.eq    rb_insert_anim_do_insert
    cbz     x23, rb_insert_anim_do_insert
    mov     x21, x23
    b       rb_insert_anim_search_loop

rb_insert_anim_empty:
rb_insert_anim_duplicate:
rb_insert_anim_do_insert:
    // hand off to the real insert
    mov     x0, x19
    mov     w1, w20
    bl      rb_insert
    mov     w23, w1                      // keep the inserted/duplicate flag
                                         // across the display calls

    bl      rb_display_tree_visual

    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    cmp     w23, 0
    b.eq    rb_insert_anim_dup_msg

    ldr     x0, =rb_msg_inserted
    mov     w1, w20
    bl      printf
    bl      print_newline
    b       rb_insert_anim_done

rb_insert_anim_dup_msg:
    ldr     x0, =msg_duplicate
    mov     w1, w20
    bl      printf
    bl      print_newline

rb_insert_anim_done:
    ldr     x25, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// rb_search_animated(x0 = root, w1 = target) -> x0 = node or 0
    .global rb_search_animated
rb_search_animated:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     x19, x0                      // x19 = root
    mov     w20, w1                      // w20 = target

    ldr     x21, =rb_visual_delay
    ldr     w21, [x21]

    ldr     x22, =rb_nil
    ldr     x22, [x22]

    cmp     x19, x22
    b.eq    rb_search_anim_not_found
    cbz     x19, rb_search_anim_not_found

rb_search_anim_loop:
    bl      ansi_clear_screen
    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =rb_title
    mov     w1, 80
    bl      print_centered

    mov     w0, 3
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =msg_searching
    mov     w1, w20
    bl      printf

    ldr     x0, =rb_root
    ldr     x0, [x0]
    mov     w1, 6
    mov     w2, 40
    mov     w3, 20
    mov     x4, x19
    mov     x5, 0
    bl      rb_draw_node_recursive

    mov     x0, 0
    bl      fflush
    mov     w0, w21
    bl      delay_ms

    ldr     w2, [x19, RB_NODE_DATA]
    cmp     w20, w2
    b.eq    rb_search_anim_found
    b.lt    rb_search_anim_go_left

rb_search_anim_go_right:
    ldr     x19, [x19, RB_NODE_RIGHT]
    cmp     x19, x22
    b.eq    rb_search_anim_not_found
    cbnz    x19, rb_search_anim_loop
    b       rb_search_anim_not_found

rb_search_anim_go_left:
    ldr     x19, [x19, RB_NODE_LEFT]
    cmp     x19, x22
    b.eq    rb_search_anim_not_found
    cbnz    x19, rb_search_anim_loop

rb_search_anim_not_found:
    mov     x0, 0
    b       rb_search_anim_done

rb_search_anim_found:
    mov     x0, x19

rb_search_anim_done:
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// rb_inorder_animated(x0 = node) - inorder walk, redrawing at every visit
    .global rb_inorder_animated
rb_inorder_animated:
    cbz     x0, rb_inorder_anim_done

    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     x19, x0

    ldr     x20, =rb_visual_delay
    ldr     w20, [x20]

    ldr     x21, =rb_nil
    ldr     x21, [x21]

    ldr     x0, [x19, RB_NODE_LEFT]
    cmp     x0, x21
    b.eq    rb_inorder_anim_skip_left
    bl      rb_inorder_animated

rb_inorder_anim_skip_left:
    bl      ansi_clear_screen

    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =rb_title
    mov     w1, 80
    bl      print_centered

    mov     w0, 3
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Lrb_inorder_trav_msg
    bl      printf

    ldr     x0, =rb_root
    ldr     x0, [x0]
    mov     w1, 6
    mov     w2, 40
    mov     w3, 20
    mov     x4, x19
    mov     x5, 0
    bl      rb_draw_node_recursive

    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =msg_visiting
    ldr     w1, [x19, RB_NODE_DATA]
    bl      printf

    mov     x0, 0
    bl      fflush

    mov     w0, w20
    bl      delay_ms

    ldr     x0, [x19, RB_NODE_RIGHT]
    ldr     x21, =rb_nil
    ldr     x21, [x21]
    cmp     x0, x21
    b.eq    rb_inorder_anim_skip_right
    bl      rb_inorder_animated

rb_inorder_anim_skip_right:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48

rb_inorder_anim_done:
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
    ldr     x2, [x19, RB_NODE_LEFT]
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

// rb_transplant(x0 = u, x1 = v) - splice subtree v into u's place
    .global rb_transplant
rb_transplant:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0                      // x19 = u
    mov     x20, x1                      // x20 = v

    ldr     x2, [x19, RB_NODE_PARENT]
    cbz     x2, rb_transplant_root

    ldr     x3, [x2, RB_NODE_LEFT]
    cmp     x19, x3
    b.eq    rb_transplant_left_child

rb_transplant_right_child:
    str     x20, [x2, RB_NODE_RIGHT]
    b       rb_transplant_set_parent

rb_transplant_left_child:
    str     x20, [x2, RB_NODE_LEFT]
    b       rb_transplant_set_parent

rb_transplant_root:
    ldr     x2, =rb_root
    str     x20, [x2]

rb_transplant_set_parent:
    // v takes u's parent even when v is the nil sentinel: the delete
    // fixup climbs from x through this pointer.
    ldr     x2, [x19, RB_NODE_PARENT]
    str     x2, [x20, RB_NODE_PARENT]

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
    cmp     w0, COLOR_RED
    b.eq    rb_delete_fixup_done

    ldr     x20, [x19, RB_NODE_PARENT]
    ldr     x21, [x20, RB_NODE_LEFT]
    cmp     x19, x21
    b.eq    rb_delete_fixup_left_child

rb_delete_fixup_right_child:
    ldr     x21, [x20, RB_NODE_LEFT]     // x21 = sibling

    mov     x0, x21
    bl      rb_get_color
    cmp     w0, COLOR_RED
    b.eq    rb_delete_fixup_case1_right

    ldr     x22, [x21, RB_NODE_RIGHT]
    mov     x0, x22
    bl      rb_get_color
    cmp     w0, COLOR_RED
    b.eq    rb_delete_fixup_case4_right

    ldr     x22, [x21, RB_NODE_LEFT]
    mov     x0, x22
    bl      rb_get_color
    cmp     w0, COLOR_RED
    b.eq    rb_delete_fixup_case3_right

rb_delete_fixup_case2_right:
    mov     x0, x21
    mov     w1, COLOR_RED
    bl      rb_set_color
    mov     x19, x20
    b       rb_delete_fixup_loop

rb_delete_fixup_case3_right:
    mov     x0, x22
    mov     w1, COLOR_BLACK
    bl      rb_set_color
    mov     x0, x21
    mov     w1, COLOR_RED
    bl      rb_set_color
    mov     x0, x21
    bl      rotate_right
    ldr     x21, [x20, RB_NODE_LEFT]

rb_delete_fixup_case4_right:
    mov     x0, x20
    bl      rb_get_color
    mov     w1, w0
    mov     x0, x21
    bl      rb_set_color
    mov     x0, x20
    mov     w1, COLOR_BLACK
    bl      rb_set_color
    ldr     x22, [x21, RB_NODE_RIGHT]
    mov     x0, x22
    mov     w1, COLOR_BLACK
    bl      rb_set_color
    mov     x0, x20
    bl      rotate_right
    b       rb_delete_fixup_done

rb_delete_fixup_case1_right:
    mov     x0, x21
    mov     w1, COLOR_BLACK
    bl      rb_set_color
    mov     x0, x20
    mov     w1, COLOR_RED
    bl      rb_set_color
    mov     x0, x20
    bl      rotate_right
    ldr     x21, [x20, RB_NODE_LEFT]
    b       rb_delete_fixup_right_child

rb_delete_fixup_left_child:
    ldr     x21, [x20, RB_NODE_RIGHT]    // x21 = sibling

    mov     x0, x21
    bl      rb_get_color
    cmp     w0, COLOR_RED
    b.eq    rb_delete_fixup_case1_left

    ldr     x22, [x21, RB_NODE_LEFT]
    mov     x0, x22
    bl      rb_get_color
    cmp     w0, COLOR_RED
    b.eq    rb_delete_fixup_case4_left

    ldr     x22, [x21, RB_NODE_RIGHT]
    mov     x0, x22
    bl      rb_get_color
    cmp     w0, COLOR_RED
    b.eq    rb_delete_fixup_case3_left

rb_delete_fixup_case2_left:
    mov     x0, x21
    mov     w1, COLOR_RED
    bl      rb_set_color
    mov     x19, x20
    b       rb_delete_fixup_loop

rb_delete_fixup_case3_left:
    mov     x0, x22
    mov     w1, COLOR_BLACK
    bl      rb_set_color
    mov     x0, x21
    mov     w1, COLOR_RED
    bl      rb_set_color
    mov     x0, x21
    bl      rotate_left
    ldr     x21, [x20, RB_NODE_RIGHT]

rb_delete_fixup_case4_left:
    mov     x0, x20
    bl      rb_get_color
    mov     w1, w0
    mov     x0, x21
    bl      rb_set_color
    mov     x0, x20
    mov     w1, COLOR_BLACK
    bl      rb_set_color
    ldr     x22, [x21, RB_NODE_LEFT]
    mov     x0, x22
    mov     w1, COLOR_BLACK
    bl      rb_set_color
    mov     x0, x20
    bl      rotate_left
    b       rb_delete_fixup_done

rb_delete_fixup_case1_left:
    mov     x0, x21
    mov     w1, COLOR_BLACK
    bl      rb_set_color
    mov     x0, x20
    mov     w1, COLOR_RED
    bl      rb_set_color
    mov     x0, x20
    bl      rotate_left
    ldr     x21, [x20, RB_NODE_RIGHT]
    b       rb_delete_fixup_left_child

rb_delete_fixup_done:
    mov     x0, x19
    mov     w1, COLOR_BLACK
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
    mov     w23, w0                      // w23 = y's original color

    ldr     x24, [x21, RB_NODE_LEFT]
    cmp     x24, x25
    b.eq    rb_delete_no_left

    ldr     x26, [x21, RB_NODE_RIGHT]
    cmp     x26, x25
    b.eq    rb_delete_no_right

rb_delete_two_children:
    ldr     x0, [x21, RB_NODE_RIGHT]
    bl      rb_minimum
    mov     x22, x0

    mov     x0, x22
    bl      rb_get_color
    mov     w23, w0

    ldr     x24, [x22, RB_NODE_RIGHT]

    ldr     x26, [x22, RB_NODE_PARENT]
    cmp     x26, x21
    b.eq    rb_delete_successor_is_child

    mov     x0, x22
    mov     x1, x24
    bl      rb_transplant

    ldr     x26, [x21, RB_NODE_RIGHT]
    str     x26, [x22, RB_NODE_RIGHT]
    str     x22, [x26, RB_NODE_PARENT]

rb_delete_successor_is_child:
    // x may be the nil sentinel; it still needs y as its parent for
    // the fixup climb.
    str     x22, [x24, RB_NODE_PARENT]

    mov     x0, x21
    mov     x1, x22
    bl      rb_transplant

    ldr     x26, [x21, RB_NODE_LEFT]
    str     x26, [x22, RB_NODE_LEFT]
    str     x22, [x26, RB_NODE_PARENT]

    ldrb    w0, [x21, RB_NODE_COLOR]
    strb    w0, [x22, RB_NODE_COLOR]

    b       rb_delete_fixup_check

rb_delete_no_left:
    ldr     x24, [x21, RB_NODE_RIGHT]
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
    cmp     w23, COLOR_BLACK
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

// rb_delete_animated(x0 = &root, w1 = value) - animate the walk, then delete
    .global rb_delete_animated
rb_delete_animated:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    str     x25, [sp, 64]

    mov     x19, x0                      // x19 = &root
    mov     w20, w1                      // w20 = value to delete

    ldr     x25, =rb_visual_delay
    ldr     w25, [x25]

    // walk down, redrawing with each visited node highlighted
    ldr     x21, [x19]                   // x21 = current
    ldr     x22, =rb_nil
    ldr     x22, [x22]

    cmp     x21, x22
    b.eq    rb_delete_anim_not_found
    cbz     x21, rb_delete_anim_not_found

rb_delete_anim_search_loop:
    bl      ansi_clear_screen
    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =rb_title
    mov     w1, 80
    bl      print_centered

    mov     w0, 3
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =msg_deleting
    mov     w1, w20
    bl      printf

    ldr     x0, =rb_root
    ldr     x0, [x0]
    mov     w1, 6
    mov     w2, 40
    mov     w3, 20
    mov     x4, x21                      // highlight current
    mov     x5, 0
    bl      rb_draw_node_recursive

    mov     x0, 0
    bl      fflush
    mov     w0, w25
    bl      delay_ms

    ldr     w0, [x21, RB_NODE_DATA]
    cmp     w20, w0
    b.eq    rb_delete_anim_found
    b.lt    rb_delete_anim_go_left

rb_delete_anim_go_right:
    ldr     x23, [x21, RB_NODE_RIGHT]
    cmp     x23, x22
    b.eq    rb_delete_anim_not_found
    cbz     x23, rb_delete_anim_not_found
    mov     x21, x23
    b       rb_delete_anim_search_loop

rb_delete_anim_go_left:
    ldr     x23, [x21, RB_NODE_LEFT]
    cmp     x23, x22
    b.eq    rb_delete_anim_not_found
    cbz     x23, rb_delete_anim_not_found
    mov     x21, x23
    b       rb_delete_anim_search_loop

rb_delete_anim_found:
    // hand off to the real delete
    mov     x0, x19
    mov     w1, w20
    bl      rb_delete

    bl      rb_display_tree_visual

    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =rb_msg_deleted
    mov     w1, w20
    bl      printf
    bl      print_newline
    b       rb_delete_anim_done

rb_delete_anim_not_found:
    bl      rb_display_tree_visual
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =rb_msg_not_found
    mov     w1, w20
    bl      printf
    bl      print_newline

rb_delete_anim_done:
    ldr     x25, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// rb_delete_interactive() - prompt for a value and delete it
    .global rb_delete_interactive
rb_delete_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      ansi_clear_screen

    ldr     x0, =rb_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    rb_delete_int_empty

    ldr     x0, =rb_prompt_value
    bl      printf

    bl      read_int
    mov     w19, w0

    ldr     x0, =rb_root
    mov     w1, w19
    bl      rb_delete_animated

    b       rb_delete_int_done

rb_delete_int_empty:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =rb_msg_empty_tree
    bl      printf
    bl      print_newline

rb_delete_int_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_insert_interactive() - prompt for a value and insert it
    .global rb_insert_interactive
rb_insert_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      ansi_clear_screen

    ldr     x0, =rb_prompt_value
    bl      printf

    bl      read_int
    mov     w19, w0

    ldr     x0, =rb_root
    mov     w1, w19
    bl      rb_insert_animated

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_search_interactive() - prompt for a value and search for it
    .global rb_search_interactive
rb_search_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      ansi_clear_screen

    ldr     x0, =rb_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    rb_search_int_empty

    ldr     x0, =rb_prompt_value
    bl      printf

    bl      read_int
    mov     w19, w0

    ldr     x0, =rb_root
    ldr     x0, [x0]
    mov     w1, w19
    bl      rb_search_animated

    cmp     x0, 0
    b.eq    rb_search_int_not_found

    bl      rb_display_tree_visual

    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =rb_msg_found
    mov     w1, w19
    bl      printf
    bl      print_newline

    b       rb_search_int_done

rb_search_int_empty:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =rb_msg_empty_tree
    bl      printf
    bl      print_newline
    b       rb_search_int_done

rb_search_int_not_found:
    bl      rb_display_tree_visual
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =rb_msg_not_found
    mov     w1, w19
    bl      printf
    bl      print_newline

rb_search_int_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_inorder_interactive() - run the animated traversal
rb_inorder_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      ansi_clear_screen

    ldr     x0, =rb_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    rb_inorder_int_empty

    ldr     x0, =rb_root
    ldr     x0, [x0]
    bl      rb_inorder_animated

    b       rb_inorder_int_done

rb_inorder_int_empty:
    mov     w0, 10
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =rb_msg_empty_tree
    bl      printf
    bl      print_newline

rb_inorder_int_done:
    ldp     fp, lr, [sp], 16
    ret

// rb_init_sample() - replace the tree with a fixed eight-node sample
rb_init_sample:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    // drop the old tree first
    ldr     x0, =rb_root
    bl      rb_free_all

    ldr     x19, =rb_root

    mov     x0, x19
    mov     w1, 50
    bl      rb_insert

    mov     x0, x19
    mov     w1, 30
    bl      rb_insert

    mov     x0, x19
    mov     w1, 70
    bl      rb_insert

    mov     x0, x19
    mov     w1, 20
    bl      rb_insert

    mov     x0, x19
    mov     w1, 40
    bl      rb_insert

    mov     x0, x19
    mov     w1, 60
    bl      rb_insert

    mov     x0, x19
    mov     w1, 80
    bl      rb_insert

    mov     x0, x19
    mov     w1, 10
    bl      rb_insert

    bl      rb_display_tree_visual

    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Lrb_sample_complete
    bl      printf
    bl      print_newline

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// rb_verify_interactive() - list the five red-black properties
rb_verify_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      ansi_clear_screen

    ldr     x0, =rb_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    rb_verify_empty

    bl      rb_display_tree_visual

    // properties start at row 25; row 23 holds the press-enter prompt
    mov     w0, 25
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =msg_prop_header
    bl      printf
    bl      print_newline

    mov     w0, 26
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =msg_prop_1
    bl      printf
    bl      print_newline

    mov     w0, 27
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =msg_prop_2
    bl      printf
    bl      print_newline

    mov     w0, 28
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =msg_prop_3
    bl      printf
    bl      print_newline

    mov     w0, 29
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =msg_prop_4
    bl      printf
    bl      print_newline

    mov     w0, 30
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =msg_prop_5
    bl      printf
    bl      print_newline

    mov     w0, 31
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =msg_prop_footer
    bl      printf
    bl      print_newline

    b       rb_verify_done

rb_verify_empty:
    mov     w0, 10
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =rb_msg_empty_tree
    bl      printf
    bl      print_newline

rb_verify_done:
    ldp     fp, lr, [sp], 16
    ret

// rb_menu() - module menu loop; frees the tree on exit, keeps the sentinel
    .global rb_menu
rb_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      rb_init_nil

rb_menu_loop:
    bl      ansi_clear_screen
    bl      rb_display_menu

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
    b.eq    rb_menu_init

    cmp     w0, 6
    b.eq    rb_menu_display

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

rb_menu_inorder:
    bl      rb_inorder_interactive
    bl      wait_for_enter
    b       rb_menu_loop

rb_menu_init:
    bl      rb_init_sample
    bl      wait_for_enter
    b       rb_menu_loop

rb_menu_display:
    bl      rb_display_tree_visual
    bl      wait_for_enter
    b       rb_menu_loop

rb_menu_verify:
    bl      rb_verify_interactive
    bl      wait_for_enter
    b       rb_menu_loop

rb_menu_delete:
    bl      rb_delete_interactive
    bl      wait_for_enter
    b       rb_menu_loop

rb_menu_exit:
    ldr     x0, =rb_root
    bl      rb_free_all
    ldp     fp, lr, [sp], 16
    ret

// rb_display_menu() - draw the menu box and options
    .global rb_display_menu
rb_display_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, 3
    mov     w1, 15
    mov     w2, 50
    mov     w3, 19
    mov     w4, 1
    bl      draw_box

    mov     w0, 4
    mov     w1, 17
    bl      ansi_move_cursor
    ldr     x0, =rb_menu_title
    mov     w1, 46
    bl      print_centered

    mov     w0, 5
    mov     w1, 15
    mov     w2, 50
    mov     w3, 1
    bl      draw_horizontal_border_top

    mov     w0, 7
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_rb_1
    bl      printf

    mov     w0, 8
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_rb_2
    bl      printf

    mov     w0, 9
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_rb_3
    bl      printf

    mov     w0, 10
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_rb_4
    bl      printf

    mov     w0, 11
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_rb_5
    bl      printf

    mov     w0, 12
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_rb_6
    bl      printf

    mov     w0, 13
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_rb_7
    bl      printf

    mov     w0, 14
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_rb_0
    bl      printf

    mov     w0, 17
    mov     w1, 15
    mov     w2, 50
    mov     w3, 1
    bl      draw_horizontal_border_top

    mov     w0, 18
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =rb_menu_prompt
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// format strings
    .data
.Lfmt_int:              .string "%d "
.Lrb_node_fmt:             .string "%02d"
.Lrb_inorder_label:        .string "Inorder: "
.Lrb_inorder_trav_msg:     .string "Inorder Traversal"
.Lrb_sample_complete:      .string "Sample tree complete!"
.Ltree_branch_left:     .string "/"
.Ltree_branch_right:    .string "\\"
