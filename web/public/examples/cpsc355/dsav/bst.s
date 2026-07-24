// bst_viz.asm - binary search tree: insert, delete, search, four traversals
// every operation redraws the tree with ANSI cursor moves

define(fp, x29)
define(lr, x30)

    .data
    .balign 8

// node layout: data, then left and right child pointers, 8 bytes each
define(NODE_DATA, 0)
define(NODE_LEFT, 8)
define(NODE_RIGHT, 16)
define(NODE_SIZE, 24)
NULL = 0

// tree state
bst_root:           .dword 0                 // Root pointer
bst_node_count:     .word 0                 // Number of nodes in tree
bst_height:         .word 0                 // Tree height

// ui strings
bst_title:          .string "BINARY SEARCH TREE VISUALIZATION"
bst_menu_title:     .string "BST OPERATIONS MENU"

menu_bst_1:         .string "[1] Insert Node"
menu_bst_2:         .string "[2] Delete Node"
menu_bst_3:         .string "[3] Search Node"
menu_bst_4:         .string "[4] Inorder Traversal"
menu_bst_5:         .string "[5] Preorder Traversal"
menu_bst_6:         .string "[6] Postorder Traversal"
menu_bst_7:         .string "[7] Levelorder Traversal"
menu_bst_8:         .string "[8] Initialize Sample Tree"
menu_bst_9:         .string "[9] Display Tree (ASCII)"
menu_bst_0:         .string "[0] Back to Main Menu"

bst_menu_prompt:        .string "Enter your choice: "
bst_prompt_value:       .string "Enter value: "
bst_prompt_continue:    .string "\n\x1b[33mPress Enter to continue...\x1b[0m"

bst_msg_inserted:       .string "\x1b[32m✓ Node %d inserted\x1b[0m"
bst_msg_deleted:        .string "\x1b[32m✓ Node %d deleted\x1b[0m"
bst_msg_found:          .string "\x1b[32m✓ Node %d found!\x1b[0m"
bst_msg_not_found:      .string "\x1b[31m✗ Node %d not found\x1b[0m"
bst_msg_empty_tree:     .string "\x1b[33mTree is empty!\x1b[0m"
msg_tree_cleared:   .string "\x1b[32mTree cleared!\x1b[0m"

bst_label_nodes:        .string "Nodes: %d"
label_height:       .string "Height: %d"
label_traversal:    .string "Traversal: "

// Temporary buffer for traversal output
traversal_buffer:   .skip 256

// Queue for level-order traversal (256 pointers = 2048 bytes)
    .balign 8
levelorder_queue:   .skip 2048

// Tree visualization data
tree_visual_delay:  .word 500              // Animation delay in ms

// Characters for tree drawing
tree_branch_left:   .string "/"
tree_branch_right:  .string "\\"
tree_branch_horiz:  .string "─"
tree_space:         .string " "
tree_pipe:          .string "|"

// Node highlight colors for animation
highlight_current:  .string "\x1b[43;30m"  // Yellow background, black text
highlight_found:    .string "\x1b[42;30m"  // Green background
highlight_path:     .string "\x1b[46;30m"  // Cyan background
bst_color_reset:        .string "\x1b[0m"

    .text
    .balign 4

// bst_create_node(w0 = value) -> x0 = new node, or 0 if malloc failed
    .global bst_create_node
bst_create_node:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     w19, w0                      // Save data value

    // Allocate memory for node
    mov     x0, NODE_SIZE                // Size of node
    bl      malloc
    cbz     x0, bst_create_node_fail         // Check if allocation failed

    // Initialize node
    str     w19, [x0, NODE_DATA]         // Store data
    mov     x1, 0
    str     x1, [x0, NODE_LEFT]          // left = NULL
    str     x1, [x0, NODE_RIGHT]         // right = NULL

bst_create_node_fail:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// bst_insert(x0 = &root, w1 = value) -> x0 = root
// duplicates are dropped, not inserted twice
    .global bst_insert
bst_insert:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    mov     x19, x0                      // x19 = root_ptr_ptr
    mov     w20, w1                      // w20 = value

    // Create new node
    mov     w0, w20
    bl      bst_create_node
    mov     x23, x0                      // x23 = new_node
    cbz     x23, insert_done             // Check allocation

    // Load current root
    ldr     x21, [x19]                   // x21 = current
    cbz     x21, insert_as_root          // If tree empty, make root

    // Find insertion position
    mov     x22, 0                       // x22 = parent
insert_loop:
    mov     x22, x21                     // Remember parent
    ldr     w0, [x21, NODE_DATA]         // Load current node's data
    cmp     w20, w0
    b.eq    insert_duplicate             // Don't insert duplicates
    b.lt    insert_go_left

insert_go_right:
    ldr     x21, [x21, NODE_RIGHT]
    cbnz    x21, insert_loop
    // Insert as right child
    str     x23, [x22, NODE_RIGHT]
    b       insert_success

insert_go_left:
    ldr     x21, [x21, NODE_LEFT]
    cbnz    x21, insert_loop
    // Insert as left child
    str     x23, [x22, NODE_LEFT]
    b       insert_success

insert_as_root:
    str     x23, [x19]                   // Set as root
    b       insert_success

insert_duplicate:
    // Free the new node since it's a duplicate
    mov     x0, x23
    bl      free
    ldr     x21, [x19]
    b       insert_done

insert_success:
    // Increment node count
    ldr     x0, =bst_node_count
    ldr     w1, [x0]
    add     w1, w1, 1
    str     w1, [x0]
    ldr     x21, [x19]

insert_done:
    mov     x0, x21                      // Return root
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// bst_search(x0 = root, w1 = value) -> x0 = node, or 0 if not found
    .global bst_search
bst_search:
    cbz     x0, search_not_found         // Empty tree (x0 = current)

search_loop:
    ldr     w2, [x0, NODE_DATA]          // Load current data
    cmp     w1, w2                       // Compare target (w1) with current
    b.eq    search_found                 // Found it!
    b.lt    search_left

search_right:
    ldr     x0, [x0, NODE_RIGHT]
    cbnz    x0, search_loop
    b       search_not_found

search_left:
    ldr     x0, [x0, NODE_LEFT]
    cbnz    x0, search_loop

search_not_found:
    mov     x0, 0

search_found:
    ret

// bst_find_min(x0 = subtree) -> x0 = leftmost node
    .global bst_find_min
bst_find_min:
    cbz     x0, find_min_done

find_min_loop:
    ldr     x1, [x0, NODE_LEFT]          // Get left child
    cbz     x1, find_min_done            // If no left, this is min
    mov     x0, x1                       // Move to left child
    b       find_min_loop

find_min_done:
    ret

// bst_delete(x0 = &root, w1 = value) -> x0 = new root
    .global bst_delete
bst_delete:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     x19, x0                      // x19 = root_ptr_ptr
    mov     w20, w1                      // w20 = target

    ldr     x0, [x19]                    // Load root
    bl      bst_delete_node              // Call recursive delete
    str     x0, [x19]                    // Store new root

    mov     x0, x0                       // Return root
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// bst_delete_node(x0 = node, w20 = target) -> x0 = new subtree root
// recursive helper: the target value rides in w20, not w1
bst_delete_node:
    cbz     x0, delete_not_found         // Base case: not found

    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     x19, x0                      // x19 = node

    ldr     w0, [x19, NODE_DATA]         // Load node's data
    cmp     w20, w0                      // Compare with target
    b.eq    delete_this_node
    b.lt    delete_go_left

delete_go_right:
    ldr     x0, [x19, NODE_RIGHT]        // Recurse right
    bl      bst_delete_node
    str     x0, [x19, NODE_RIGHT]        // Update right child
    mov     x0, x19
    b       delete_done

delete_go_left:
    ldr     x0, [x19, NODE_LEFT]         // Recurse left
    bl      bst_delete_node
    str     x0, [x19, NODE_LEFT]         // Update left child
    mov     x0, x19
    b       delete_done

delete_this_node:
    // Case 1: No children or one child
    ldr     x1, [x19, NODE_LEFT]
    ldr     x2, [x19, NODE_RIGHT]

    cbz     x1, delete_no_left           // No left child
    cbz     x2, delete_no_right          // No right child

    // Case 3: Two children - find inorder successor
    ldr     x0, [x19, NODE_RIGHT]
    bl      bst_find_min                 // Find minimum in right subtree
    ldr     w1, [x0, NODE_DATA]          // Get successor value
    str     w1, [x19, NODE_DATA]         // Copy to current node

    // Delete successor
    mov     w20, w1                      // Target = successor value
    ldr     x0, [x19, NODE_RIGHT]
    bl      bst_delete_node
    str     x0, [x19, NODE_RIGHT]
    mov     x0, x19
    b       delete_done

delete_no_left:
    mov     x21, x2                      // x21 = temp, right child becomes new root
    mov     x0, x19
    bl      free                         // Free current node
    mov     x0, x21
    b       delete_done

delete_no_right:
    mov     x21, x1                      // x21 = temp, left child becomes new root
    mov     x0, x19
    bl      free
    mov     x0, x21
    b       delete_done

delete_not_found:
    mov     x0, 0
    ret

delete_done:
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// bst_inorder(x0 = root) - print left-root-right (sorted order)
    .global bst_inorder
bst_inorder:
    cbz     x0, inorder_done

    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0                      // Save current node

    // Traverse left
    ldr     x0, [x19, NODE_LEFT]
    bl      bst_inorder

    // Print current
    ldr     x0, =fmt_int
    ldr     w1, [x19, NODE_DATA]
    bl      printf

    // Traverse right
    ldr     x0, [x19, NODE_RIGHT]
    bl      bst_inorder

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32

inorder_done:
    ret

// bst_preorder(x0 = root) - print root-left-right
    .global bst_preorder
bst_preorder:
    cbz     x0, preorder_done

    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0

    // Print current
    ldr     x0, =fmt_int
    ldr     w1, [x19, NODE_DATA]
    bl      printf

    // Traverse left
    ldr     x0, [x19, NODE_LEFT]
    bl      bst_preorder

    // Traverse right
    ldr     x0, [x19, NODE_RIGHT]
    bl      bst_preorder

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32

preorder_done:
    ret

// bst_postorder(x0 = root) - print left-right-root
    .global bst_postorder
bst_postorder:
    cbz     x0, postorder_done

    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0

    // Traverse left
    ldr     x0, [x19, NODE_LEFT]
    bl      bst_postorder

    // Traverse right
    ldr     x0, [x19, NODE_RIGHT]
    bl      bst_postorder

    // Print current
    ldr     x0, =fmt_int
    ldr     w1, [x19, NODE_DATA]
    bl      printf

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32

postorder_done:
    ret

// bst_levelorder(x0 = root) - print breadth-first
    .global bst_levelorder
bst_levelorder:
    cbz     x0, levelorder_done              // Empty tree

    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    mov     x19, x0                          // x19 = root

    // Use static global queue
    ldr     x20, =levelorder_queue           // x20 = queue base

    mov     w21, 0                           // w21 = front index
    mov     w22, 0                           // w22 = rear index
    mov     w23, 0                           // w23 = count

    // Enqueue root
    str     x19, [x20]                       // queue[0] = root
    mov     w22, 1                           // rear = 1
    mov     w23, 1                           // count = 1

levelorder_loop:
    cmp     w23, 0                           // Check if queue empty
    b.le    levelorder_complete              // Exit if empty

    // Dequeue front node
    ldr     x19, [x20, w21, UXTW #3]         // x19 = queue[front]
    add     w21, w21, 1                      // front++
    and     w21, w21, 0xFF                   // front %= 256 (circular)
    sub     w23, w23, 1                      // count--

    // Print current node
    ldr     x0, =fmt_int
    ldr     w1, [x19, NODE_DATA]
    bl      printf

    // Enqueue left child if exists
    ldr     x24, [x19, NODE_LEFT]
    cbz     x24, levelorder_skip_left
    str     x24, [x20, w22, UXTW #3]         // queue[rear] = left
    add     w22, w22, 1                      // rear++
    and     w22, w22, 0xFF                   // rear %= 256
    add     w23, w23, 1                      // count++

levelorder_skip_left:
    // Enqueue right child if exists
    ldr     x24, [x19, NODE_RIGHT]
    cbz     x24, levelorder_skip_right
    str     x24, [x20, w22, UXTW #3]         // queue[rear] = right
    add     w22, w22, 1                      // rear++
    and     w22, w22, 0xFF                   // rear %= 256
    add     w23, w23, 1                      // count++

levelorder_skip_right:
    b       levelorder_loop

levelorder_complete:
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64

levelorder_done:
    ret

// bst_free_all(x0 = &root) - free every node, zero the root and count
    .global bst_free_all
bst_free_all:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0                      // Save root pointer address
    ldr     x0, [x19]                    // Load root
    bl      bst_free_recursive

    mov     x0, 0
    str     x0, [x19]                    // Set root to NULL

    // Reset node count
    ldr     x0, =bst_node_count
    mov     w1, 0
    str     w1, [x0]

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// bst_free_recursive(x0 = node) - postorder free
bst_free_recursive:
    cbz     x0, free_rec_done

    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0

    // Free left subtree
    ldr     x0, [x19, NODE_LEFT]
    bl      bst_free_recursive

    // Free right subtree
    ldr     x0, [x19, NODE_RIGHT]
    bl      bst_free_recursive

    // Free this node
    mov     x0, x19
    bl      free

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32

free_rec_done:
    ret

// bst_menu() - operations menu loop; frees the tree on exit
    .global bst_menu
bst_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

bst_menu_loop:
    // Clear screen and display menu
    bl      ansi_clear_screen
    bl      display_bst_menu

    // Get user choice
    mov     w0, 0                            // min
    mov     w1, 9                            // max
    bl      read_int_range

    // Dispatch based on choice
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
    b.eq    bst_menu_init

    cmp     w0, 9
    b.eq    bst_menu_display_tree

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

bst_menu_init:
    bl      bst_init_sample
    bl      wait_for_enter
    b       bst_menu_loop

bst_menu_display_tree:
    bl      bst_display_tree_visual
    bl      wait_for_enter
    b       bst_menu_loop

bst_menu_exit:
    // Free tree before exit
    ldr     x0, =bst_root
    bl      bst_free_all
    ldp     fp, lr, [sp], 16
    ret

// display_bst_menu() - draw the menu box and options
    .global display_bst_menu
display_bst_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // Draw menu box
    mov     w0, 3                            // row
    mov     w1, 15                           // column
    mov     w2, 50                           // width
    mov     w3, 20                           // height
    mov     w4, 1                            // double-line style
    bl      draw_box

    // Print title
    mov     w0, 4
    mov     w1, 17
    bl      ansi_move_cursor
    ldr     x0, =bst_menu_title
    mov     w1, 46
    bl      print_centered

    // Print separator
    mov     w0, 5
    mov     w1, 15
    mov     w2, 50
    mov     w3, 1
    bl      draw_horizontal_border_top

    // Print menu options
    mov     w0, 7
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_bst_1
    bl      printf

    mov     w0, 8
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_bst_2
    bl      printf

    mov     w0, 9
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_bst_3
    bl      printf

    mov     w0, 10
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_bst_4
    bl      printf

    mov     w0, 11
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_bst_5
    bl      printf

    mov     w0, 12
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_bst_6
    bl      printf

    mov     w0, 13
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_bst_7
    bl      printf

    mov     w0, 14
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_bst_8
    bl      printf

    mov     w0, 15
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_bst_9
    bl      printf

    mov     w0, 16
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_bst_0
    bl      printf

    // Print separator
    mov     w0, 18
    mov     w1, 15
    mov     w2, 50
    mov     w3, 1
    bl      draw_horizontal_border_top

    // Position cursor for input
    mov     w0, 19
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =bst_menu_prompt
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// bst_insert_interactive() - prompt for a value, insert it, redraw the tree
    .global bst_insert_interactive
bst_insert_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      ansi_clear_screen

    // Prompt for value
    ldr     x0, =bst_prompt_value
    bl      printf

    bl      read_int
    mov     w19, w0                          // Save value

    // Insert into tree
    ldr     x0, =bst_root
    mov     w1, w19
    bl      bst_insert

    // Display tree visually
    bl      bst_display_tree_visual

    // Position cursor for success message
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =bst_msg_inserted
    mov     w1, w19
    bl      printf
    bl      print_newline

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// bst_delete_interactive() - prompt for a value, delete it if present
    .global bst_delete_interactive
bst_delete_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      ansi_clear_screen

    // Check if tree is empty
    ldr     x0, =bst_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    bst_delete_int_empty

    // Prompt for value
    ldr     x0, =bst_prompt_value
    bl      printf

    bl      read_int
    mov     w19, w0

    // First, search if the node exists
    ldr     x0, =bst_root
    ldr     x0, [x0]
    mov     w1, w19
    bl      bst_search

    cmp     x0, 0
    b.eq    bst_delete_node_not_found    // Node doesn't exist

    // Node exists, delete it
    ldr     x0, =bst_root
    mov     w1, w19
    bl      bst_delete

    // Display tree visually
    bl      bst_display_tree_visual

    // Decrement node count
    ldr     x0, =bst_node_count
    ldr     w1, [x0]
    sub     w1, w1, 1
    str     w1, [x0]

    // Position cursor for success message
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =bst_msg_deleted
    mov     w1, w19
    bl      printf
    bl      print_newline

    b       bst_delete_int_done

bst_delete_node_not_found:
    // Display tree (unchanged)
    bl      bst_display_tree_visual

    // Show not found message
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =bst_msg_not_found
    mov     w1, w19
    bl      printf
    bl      print_newline

    b       bst_delete_int_done

bst_delete_int_empty:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =bst_msg_empty_tree
    bl      printf
    bl      print_newline

bst_delete_int_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// bst_search_interactive() - prompt for a value, run the animated search
    .global bst_search_interactive
bst_search_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      ansi_clear_screen

    // Check if tree is empty
    ldr     x0, =bst_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    bst_search_int_empty

    // Prompt for value
    ldr     x0, =bst_prompt_value
    bl      printf

    bl      read_int
    mov     w19, w0

    // Clear screen before animation
    bl      ansi_clear_screen

    // Draw title
    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_title
    mov     w1, 80
    bl      print_centered

    // Search for value with animation
    ldr     x0, =bst_root
    ldr     x0, [x0]
    mov     w1, w19
    bl      bst_search_animated

    cmp     x0, 0
    b.eq    bst_search_int_not_found

    // Position cursor for success message
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =bst_msg_found
    mov     w1, w19
    bl      printf
    bl      print_newline

    b       bst_search_int_done

bst_search_int_empty:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =bst_msg_empty_tree
    bl      printf
    bl      print_newline
    b       bst_search_int_done

bst_search_int_not_found:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =bst_msg_not_found
    mov     w1, w19
    bl      printf
    bl      print_newline

bst_search_int_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// bst_inorder_interactive() - animated inorder traversal
bst_inorder_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      ansi_clear_screen

    // Check if empty
    ldr     x0, =bst_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    bst_inorder_empty

    // Draw title
    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_title
    mov     w1, 80
    bl      print_centered

    // Do animated inorder traversal
    ldr     x0, =bst_root
    ldr     x0, [x0]
    bl      bst_inorder_animated

    b       bst_inorder_done

bst_inorder_empty:
    mov     w0, 10
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_msg_empty_tree
    bl      printf
    bl      print_newline

bst_inorder_done:
    ldp     fp, lr, [sp], 16
    ret

// bst_preorder_interactive() - animated preorder traversal
bst_preorder_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      ansi_clear_screen

    // Check if empty
    ldr     x0, =bst_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    bst_preorder_empty

    // Draw title
    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_title
    mov     w1, 80
    bl      print_centered

    // Do animated preorder traversal
    ldr     x0, =bst_root
    ldr     x0, [x0]
    bl      bst_preorder_animated

    b       bst_preorder_done

bst_preorder_empty:
    mov     w0, 10
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_msg_empty_tree
    bl      printf
    bl      print_newline

bst_preorder_done:
    ldp     fp, lr, [sp], 16
    ret

// bst_postorder_interactive() - animated postorder traversal
bst_postorder_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      ansi_clear_screen

    // Check if empty
    ldr     x0, =bst_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    bst_postorder_empty

    // Draw title
    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_title
    mov     w1, 80
    bl      print_centered

    // Do animated postorder traversal
    ldr     x0, =bst_root
    ldr     x0, [x0]
    bl      bst_postorder_animated

    b       bst_postorder_done

bst_postorder_empty:
    mov     w0, 10
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_msg_empty_tree
    bl      printf
    bl      print_newline

bst_postorder_done:
    ldp     fp, lr, [sp], 16
    ret

// bst_levelorder_interactive() - animated levelorder traversal
bst_levelorder_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      ansi_clear_screen

    // Check if empty
    ldr     x0, =bst_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    bst_levelorder_empty

    // Draw title
    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_title
    mov     w1, 80
    bl      print_centered

    // Do animated levelorder traversal
    ldr     x0, =bst_root
    ldr     x0, [x0]
    bl      bst_levelorder_animated

    b       bst_levelorder_done

bst_levelorder_empty:
    mov     w0, 10
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_msg_empty_tree
    bl      printf
    bl      print_newline

bst_levelorder_done:
    ldp     fp, lr, [sp], 16
    ret

// bst_init_sample() - rebuild the tree from the sample values
bst_init_sample:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    // Free existing tree
    ldr     x0, =bst_root
    bl      bst_free_all

    // Insert sample values: 50, 30, 70, 20, 40, 60, 80
    ldr     x19, =bst_root

    // Get animation delay
    ldr     x20, =tree_visual_delay
    ldr     w20, [x20]

    // Insert and display each node
    mov     x0, x19
    mov     w1, 50
    bl      bst_insert
    mov     w1, 50
    mov     w0, w20
    bl      bst_show_sample_insert

    mov     x0, x19
    mov     w1, 30
    bl      bst_insert
    mov     w1, 30
    mov     w0, w20
    bl      bst_show_sample_insert

    mov     x0, x19
    mov     w1, 70
    bl      bst_insert
    mov     w1, 70
    mov     w0, w20
    bl      bst_show_sample_insert

    mov     x0, x19
    mov     w1, 20
    bl      bst_insert
    mov     w1, 20
    mov     w0, w20
    bl      bst_show_sample_insert

    mov     x0, x19
    mov     w1, 40
    bl      bst_insert
    mov     w1, 40
    mov     w0, w20
    bl      bst_show_sample_insert

    mov     x0, x19
    mov     w1, 60
    bl      bst_insert
    mov     w1, 60
    mov     w0, w20
    bl      bst_show_sample_insert

    mov     x0, x19
    mov     w1, 80
    bl      bst_insert
    mov     w1, 80
    mov     w0, w20
    bl      bst_show_sample_insert

    // Final message
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Lbst_sample_complete
    bl      printf
    bl      print_newline

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// bst_show_sample_insert(w0 = delay ms, w1 = value) - redraw after one sample insert
bst_show_sample_insert:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     w19, w0                      // Save delay
    mov     w20, w1                      // Save value

    // Clear and show tree
    bl      ansi_clear_screen
    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_title
    mov     w1, 80
    bl      print_centered

    mov     w0, 3
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Lbuilding_tree_msg
    bl      printf

    // Draw tree
    ldr     x0, =bst_root
    ldr     x0, [x0]
    mov     w1, 6
    mov     w2, 40
    mov     w3, 20
    mov     x4, 0
    bl      bst_draw_node_recursive

    // Show message
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Linserted_val_msg
    mov     w1, w20
    bl      printf

    // Flush and delay
    mov     x0, 0
    bl      fflush
    mov     w0, w19
    bl      delay_ms

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// bst_display_simple() - boxed inorder listing with node count
bst_display_simple:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // Draw box
    mov     w0, 3
    mov     w1, 5
    mov     w2, 70
    mov     w3, 14
    mov     w4, 0
    bl      draw_box

    // Print title
    mov     w0, 4
    mov     w1, 7
    bl      ansi_move_cursor
    ldr     x0, =bst_title
    mov     w1, 66
    bl      print_centered

    // Draw separator
    mov     w0, 5
    mov     w1, 5
    mov     w2, 70
    mov     w3, 0
    bl      draw_horizontal_border_top

    // Check if empty
    ldr     x0, =bst_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    bst_display_empty

    // Print inorder traversal
    mov     w0, 8
    mov     w1, 10
    bl      ansi_move_cursor
    ldr     x0, =.Lbst_inorder_label
    bl      printf

    ldr     x0, =bst_root
    ldr     x0, [x0]
    bl      bst_inorder
    bl      print_newline

    // Print node count and height
    mov     w0, 14
    mov     w1, 10
    bl      ansi_move_cursor

    ldr     x1, =bst_node_count
    ldr     w1, [x1]

    ldr     x0, =bst_label_nodes
    bl      printf

    b       bst_display_done

bst_display_empty:
    mov     w0, 10
    mov     w1, 10
    bl      ansi_move_cursor
    ldr     x0, =bst_msg_empty_tree
    bl      printf
    bl      print_newline

bst_display_done:
    ldp     fp, lr, [sp], 16
    ret

// bst_calculate_height(x0 = root) -> w0 = height (0 when empty)
    .global bst_calculate_height
bst_calculate_height:
    cbz     x0, calc_height_empty        // Empty tree has height 0

    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0                      // Save current node

    // Calculate left subtree height
    ldr     x0, [x19, NODE_LEFT]
    bl      bst_calculate_height
    mov     w20, w0                      // Save left height

    // Calculate right subtree height
    ldr     x0, [x19, NODE_RIGHT]
    bl      bst_calculate_height

    // Return 1 + max(left_height, right_height)
    cmp     w20, w0
    csel    w0, w20, w0, gt              // w0 = max(left, right)
    add     w0, w0, 1                     // height = 1 + max

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

calc_height_empty:
    mov     w0, 0                         // Empty tree height = 0
    ret

// bst_display_tree_visual() - clear the screen and draw the whole tree
    .global bst_display_tree_visual
bst_display_tree_visual:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      ansi_clear_screen

    // Check if tree is empty
    ldr     x0, =bst_node_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    display_tree_visual_empty

    // Draw title
    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_title
    mov     w1, 80
    bl      print_centered

    // Draw tree starting at row 4
    ldr     x0, =bst_root
    ldr     x0, [x0]
    mov     w1, 5                         // Starting row
    mov     w2, 40                        // Center column
    mov     w3, 20                        // Initial horizontal spacing
    mov     x4, 0                         // No highlight
    bl      bst_draw_node_recursive

    b       display_tree_visual_done

display_tree_visual_empty:
    mov     w0, 10
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_msg_empty_tree
    bl      printf
    bl      print_newline

display_tree_visual_done:
    ldp     fp, lr, [sp], 16
    ret

// bst_draw_node_recursive(x0 = node, w1 = row, w2 = col,
//                         w3 = child spacing, x4 = node to highlight or 0)
    .global bst_draw_node_recursive
bst_draw_node_recursive:
    cbz     x0, draw_node_rec_done       // Base case: null node

    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]

    mov     x19, x0                      // Save current node
    mov     w20, w1                      // Save row
    mov     w21, w2                      // Save column
    mov     w22, w3                      // Save spacing
    mov     x23, x4                      // Save highlight pointer

    // Calculate new spacing for children (spacing / 2)
    lsr     w24, w22, 1                  // w24 = spacing / 2
    cmp     w24, 2
    b.ge    draw_node_spacing_ok
    mov     w24, 2                       // Minimum spacing = 2
draw_node_spacing_ok:

    // Draw left subtree (if exists)
    ldr     x0, [x19, NODE_LEFT]
    cbz     x0, draw_node_skip_left

    add     w1, w20, 2                   // Child row = current + 2
    sub     w2, w21, w24                 // Child column = current - spacing
    mov     w3, w24                      // New spacing
    mov     x4, x23                      // Pass highlight pointer
    bl      bst_draw_node_recursive

    // Draw connection line to left child
    add     w0, w20, 1                   // Line row = current + 1
    sub     w1, w21, 1                   // Line column = current - 1
    bl      ansi_move_cursor
    ldr     x0, =tree_branch_left
    bl      printf

draw_node_skip_left:

    // Draw right subtree (if exists)
    ldr     x0, [x19, NODE_RIGHT]
    cbz     x0, draw_node_skip_right

    add     w1, w20, 2                   // Child row = current + 2
    add     w2, w21, w24                 // Child column = current + spacing
    mov     w3, w24                      // New spacing
    mov     x4, x23                      // Pass highlight pointer
    bl      bst_draw_node_recursive

    // Draw connection line to right child
    add     w0, w20, 1                   // Line row = current + 1
    add     w1, w21, 1                   // Line column = current + 1
    bl      ansi_move_cursor
    ldr     x0, =tree_branch_right
    bl      printf

draw_node_skip_right:

    // Draw current node
    mov     w0, w20                      // Row
    sub     w1, w21, 1                   // Column - 1 (to center 2-digit numbers)
    bl      ansi_move_cursor

    // Check if this node should be highlighted
    cmp     x19, x23
    b.ne    draw_node_no_highlight

    // Apply highlight color
    ldr     x0, =highlight_current
    bl      printf

draw_node_no_highlight:
    // Print node value
    ldr     x0, =.Lbst_node_fmt
    ldr     w1, [x19, NODE_DATA]
    bl      printf

    // Reset color if highlighted
    cmp     x19, x23
    b.ne    draw_node_no_reset
    ldr     x0, =bst_color_reset
    bl      printf

draw_node_no_reset:

    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80

draw_node_rec_done:
    ret

// bst_search_animated(x0 = root, w1 = target) -> x0 = node, or 0 if not found
// redraws the tree at each step with the current node highlighted
    .global bst_search_animated
bst_search_animated:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     x19, x0                      // x19 = current node
    mov     w20, w1                      // w20 = target value
    ldr     x21, =tree_visual_delay
    ldr     w21, [x21]                   // w21 = delay

    cbz     x19, search_anim_not_found   // Empty tree

search_anim_loop:
    // Clear screen and draw title
    bl      ansi_clear_screen
    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_title
    mov     w1, 80
    bl      print_centered

    // Show search message
    mov     w0, 3
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Lsearching_msg
    ldr     w1, [x19, NODE_DATA]
    bl      printf

    // Draw tree with current node highlighted
    mov     x4, x19                      // Highlight current node
    ldr     x0, =bst_root
    ldr     x0, [x0]
    mov     w1, 6                        // Starting row
    mov     w2, 40                       // Center column
    mov     w3, 20                       // Initial spacing
    bl      bst_draw_node_recursive

    // Flush output to ensure frame is displayed
    mov     x0, 0                        // fflush(0) flushes every stream
    bl      fflush

    // Add delay for animation
    mov     w0, w21
    bl      delay_ms

    // Check if found
    ldr     w2, [x19, NODE_DATA]
    cmp     w20, w2
    b.eq    search_anim_found

    // Decide direction
    b.lt    search_anim_go_left

search_anim_go_right:
    ldr     x19, [x19, NODE_RIGHT]
    cbnz    x19, search_anim_loop
    b       search_anim_not_found

search_anim_go_left:
    ldr     x19, [x19, NODE_LEFT]
    cbnz    x19, search_anim_loop

search_anim_not_found:
    mov     x0, 0
    b       search_anim_done

search_anim_found:
    mov     x0, x19

search_anim_done:
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// bst_inorder_animated(x0 = root) - one redraw per visited node
    .global bst_inorder_animated
bst_inorder_animated:
    cbz     x0, inorder_anim_done

    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     x19, x0                      // Save current node

    // Get delay
    ldr     x20, =tree_visual_delay
    ldr     w20, [x20]

    // Traverse left
    ldr     x0, [x19, NODE_LEFT]
    bl      bst_inorder_animated

    // Clear screen and display tree with current node highlighted
    bl      ansi_clear_screen

    // Draw title
    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_title
    mov     w1, 80
    bl      print_centered

    // Show inorder label
    mov     w0, 3
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Lbst_inorder_trav_msg
    bl      printf

    // Draw tree
    ldr     x0, =bst_root
    ldr     x0, [x0]
    mov     w1, 6
    mov     w2, 40
    mov     w3, 20
    mov     x4, x19                      // Highlight current
    bl      bst_draw_node_recursive

    // Show value being visited
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Lvisiting_msg
    ldr     w1, [x19, NODE_DATA]
    bl      printf

    // Flush output to ensure frame is displayed
    mov     x0, 0
    bl      fflush

    // Delay
    mov     w0, w20
    bl      delay_ms

    // Traverse right
    ldr     x0, [x19, NODE_RIGHT]
    bl      bst_inorder_animated

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48

inorder_anim_done:
    ret

// bst_preorder_animated(x0 = root) - one redraw per visited node
    .global bst_preorder_animated
bst_preorder_animated:
    cbz     x0, preorder_anim_done

    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     x19, x0                      // Save current node

    // Get delay
    ldr     x20, =tree_visual_delay
    ldr     w20, [x20]

    // Clear screen and display tree with current node highlighted
    bl      ansi_clear_screen

    // Draw title
    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_title
    mov     w1, 80
    bl      print_centered

    // Show preorder label
    mov     w0, 3
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Lpreorder_trav_msg
    bl      printf

    // Draw tree
    ldr     x0, =bst_root
    ldr     x0, [x0]
    mov     w1, 6
    mov     w2, 40
    mov     w3, 20
    mov     x4, x19                      // Highlight current
    bl      bst_draw_node_recursive

    // Show value being visited
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Lvisiting_msg
    ldr     w1, [x19, NODE_DATA]
    bl      printf

    // Flush output to ensure frame is displayed
    mov     x0, 0
    bl      fflush

    // Delay
    mov     w0, w20
    bl      delay_ms

    // Traverse left
    ldr     x0, [x19, NODE_LEFT]
    bl      bst_preorder_animated

    // Traverse right
    ldr     x0, [x19, NODE_RIGHT]
    bl      bst_preorder_animated

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48

preorder_anim_done:
    ret

// bst_postorder_animated(x0 = root) - one redraw per visited node
    .global bst_postorder_animated
bst_postorder_animated:
    cbz     x0, postorder_anim_done

    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     x19, x0                      // Save current node

    // Get delay
    ldr     x20, =tree_visual_delay
    ldr     w20, [x20]

    // Traverse left
    ldr     x0, [x19, NODE_LEFT]
    bl      bst_postorder_animated

    // Traverse right
    ldr     x0, [x19, NODE_RIGHT]
    bl      bst_postorder_animated

    // Clear screen and display tree with current node highlighted
    bl      ansi_clear_screen

    // Draw title
    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_title
    mov     w1, 80
    bl      print_centered

    // Show postorder label
    mov     w0, 3
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Lpostorder_trav_msg
    bl      printf

    // Draw tree
    ldr     x0, =bst_root
    ldr     x0, [x0]
    mov     w1, 6
    mov     w2, 40
    mov     w3, 20
    mov     x4, x19                      // Highlight current
    bl      bst_draw_node_recursive

    // Show value being visited
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Lvisiting_msg
    ldr     w1, [x19, NODE_DATA]
    bl      printf

    // Flush output to ensure frame is displayed
    mov     x0, 0
    bl      fflush

    // Delay
    mov     w0, w20
    bl      delay_ms

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48

postorder_anim_done:
    ret

// bst_levelorder_animated(x0 = root) - breadth-first, queue on the stack
    .global bst_levelorder_animated
bst_levelorder_animated:
    cbz     x0, levelorder_anim_done         // Empty tree

    // Frame: register saves at 0-87, delay slot at 88, 512-byte queue
    // at 96-607
    sub     sp, sp, #608
    stp     fp, lr, [sp, 0]
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]
    str     x27, [sp, 80]

    mov     x19, x0                          // x19 = current node (will be updated in loop)
    add     x20, sp, #96                     // x20 = queue base
    mov     w21, 0                           // w21 = front index
    mov     w22, 0                           // w22 = rear index
    mov     w23, 0                           // w23 = count

    // Get delay value
    ldr     x0, =tree_visual_delay
    ldr     w23, [x0]                        // w23 = delay (temp use)
    str     w23, [sp, 88]                    // delay slot below the queue
    mov     w23, 0                           // Reset w23 to count

    // Enqueue root
    str     x19, [x20]                       // queue[0] = root
    mov     w22, 1                           // rear = 1
    mov     w23, 1                           // count = 1

levelorder_anim_loop:
    cmp     w23, 0                           // Check if queue empty
    b.le    levelorder_anim_complete         // Exit if empty

    // Dequeue front node
    ldr     x19, [x20, w21, UXTW #3]         // x19 = queue[front]
    add     w21, w21, 1                      // front++
    and     w21, w21, 0x3F                   // front %= 64 (circular, for 64-element queue)
    sub     w23, w23, 1                      // count--

    // stash queue state in registers the draw calls preserve
    mov     x24, x19                         // x24 = backup current node
    mov     w25, w21                         // w25 = backup front index
    mov     w26, w22                         // w26 = backup rear index
    mov     w27, w23                         // w27 = backup count

    // Clear screen and display tree with current node highlighted
    bl      ansi_clear_screen

    // Draw title
    mov     w0, 2
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =bst_title
    mov     w1, 80
    bl      print_centered

    // Show levelorder label
    mov     w0, 3
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Llevelorder_trav_msg
    bl      printf

    // Draw tree
    ldr     x0, =bst_root
    ldr     x0, [x0]
    mov     w1, 6
    mov     w2, 40
    mov     w3, 20
    mov     x4, x24                          // Highlight current node (from backup)
    bl      bst_draw_node_recursive

    // Show value being visited
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Lvisiting_msg
    ldr     w1, [x24, NODE_DATA]             // Get node data from backup pointer
    bl      printf

    // Flush and delay
    mov     x0, 0
    bl      fflush

    ldr     w0, [sp, 88]                     // Load delay from stack
    bl      delay_ms

    // recover queue state after the calls
    mov     x19, x24                         // Restore current node
    mov     w21, w25                         // Restore front
    mov     w22, w26                         // Restore rear
    mov     w23, w27                         // Restore count

    // Enqueue left child if exists
    ldr     x1, [x19, NODE_LEFT]
    cbz     x1, levelorder_anim_skip_left
    str     x1, [x20, w22, UXTW #3]          // queue[rear] = left
    add     w22, w22, 1                      // rear++
    and     w22, w22, 0x3F                   // rear %= 64
    add     w23, w23, 1                      // count++

levelorder_anim_skip_left:
    // Enqueue right child if exists
    ldr     x1, [x19, NODE_RIGHT]
    cbz     x1, levelorder_anim_skip_right
    str     x1, [x20, w22, UXTW #3]          // queue[rear] = right
    add     w22, w22, 1                      // rear++
    and     w22, w22, 0x3F                   // rear %= 64
    add     w23, w23, 1                      // count++

levelorder_anim_skip_right:
    b       levelorder_anim_loop

levelorder_anim_complete:
    ldr     x27, [sp, 80]
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp, 0]
    add     sp, sp, #608

levelorder_anim_done:
    ret

// format strings and messages
    .data
fmt_int:            .string "%d "
fmt_newline:        .string "\n"
.Lsample_msg:       .string " Initialized with sample tree."
.Lbst_inorder_label:    .string "Tree (Inorder): "
.Lbst_node_fmt:         .string "%02d"
.Lvisiting_msg:     .string "Visiting node: %d"
.Lsearching_msg:    .string "Searching at node: %d"
.Lbst_inorder_trav_msg: .string "Inorder Traversal (Left-Root-Right)"
.Lpreorder_trav_msg: .string "Preorder Traversal (Root-Left-Right)"
.Lpostorder_trav_msg: .string "Postorder Traversal (Left-Right-Root)"
.Llevelorder_trav_msg: .string "Levelorder Traversal (Breadth-First)"
.Lbuilding_tree_msg: .string "Building Sample Tree..."
.Linserted_val_msg: .string "Inserted: %d"
.Lbst_sample_complete:  .string "Sample tree initialization complete!"
