// linkedlist_viz.asm - singly linked list with malloc/free
// insert front/back, delete by value, animated search, arrow display

define(fp, x29)
define(lr, x30)

    .data
    .balign 8

// node layout: [data: 8 bytes][next: 8 bytes]
node_data_offset = 0
node_next_offset = 8
node_size = 16

list_head:      .dword 0                     // first node, NULL when empty
list_count:     .word 0                     // nodes in the list

list_title:         .string "LINKED LIST VISUALIZATION"
list_menu_title:    .string "LINKED LIST OPERATIONS MENU"

list_menu_opt_1:         .string "[1] Insert at Front"
list_menu_opt_2:         .string "[2] Insert at Back"
list_menu_opt_3:         .string "[3] Delete by Value"
list_menu_opt_4:         .string "[4] Search Value"
list_menu_opt_5:         .string "[5] Display List"
list_menu_opt_6:         .string "[6] Clear List"
list_menu_opt_0:         .string "[0] Back to Main Menu"

list_menu_prompt:        .string "Enter your choice: "
list_prompt_value:       .string "Enter value: "
prompt_delete:      .string "Enter value to delete: "
prompt_search:      .string "Enter value to search: "

list_msg_empty:          .string "\x1b[33mList is empty!\x1b[0m"
msg_inserted_front: .string "\x1b[32mInserted %d at front.\x1b[0m"
msg_inserted_back:  .string "\x1b[32mInserted %d at back.\x1b[0m"
list_msg_deleted:        .string "\x1b[32mDeleted %d from list.\x1b[0m"
list_msg_not_found:      .string "\x1b[33mValue %d not found in list.\x1b[0m"
list_msg_found:          .string "\x1b[32mValue %d found in list!\x1b[0m"
list_msg_cleared:        .string "\x1b[32mList cleared. All nodes freed.\x1b[0m"
msg_alloc_fail:     .string "\x1b[31mMemory allocation failed!\x1b[0m"

label_head:         .string "HEAD"
label_null:         .string "NULL"
list_label_nodes:        .string "Nodes: %d"

list_highlight_color:    .string "\x1b[43;30m"       // yellow background, black text
list_color_reset:        .string "\x1b[0m"

    .text
    .balign 4

// linkedlist_menu() - dispatch loop for the linked list module
    .global linkedlist_menu
linkedlist_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

linkedlist_menu_loop:
    bl      ansi_clear_screen
    bl      display_linkedlist_menu

    mov     w0, 0                            // min
    mov     w1, 6                            // max
    bl      read_int_range

    // dispatch
    cmp     w0, 0
    b.eq    linkedlist_menu_exit

    cmp     w0, 1
    b.eq    linkedlist_menu_insert_front

    cmp     w0, 2
    b.eq    linkedlist_menu_insert_back

    cmp     w0, 3
    b.eq    linkedlist_menu_delete

    cmp     w0, 4
    b.eq    linkedlist_menu_search

    cmp     w0, 5
    b.eq    linkedlist_menu_display

    cmp     w0, 6
    b.eq    linkedlist_menu_clear

    b       linkedlist_menu_loop

linkedlist_menu_insert_front:
    bl      list_insert_front_interactive
    bl      wait_for_enter
    b       linkedlist_menu_loop

linkedlist_menu_insert_back:
    bl      list_insert_back_interactive
    bl      wait_for_enter
    b       linkedlist_menu_loop

linkedlist_menu_delete:
    bl      list_delete_interactive
    bl      wait_for_enter
    b       linkedlist_menu_loop

linkedlist_menu_search:
    bl      list_search_interactive
    bl      wait_for_enter
    b       linkedlist_menu_loop

linkedlist_menu_display:
    bl      list_display
    bl      wait_for_enter
    b       linkedlist_menu_loop

linkedlist_menu_clear:
    bl      list_free_all

    mov     w0, 22                           // status line
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =list_msg_cleared
    bl      printf
    bl      print_newline
    bl      wait_for_enter
    b       linkedlist_menu_loop

linkedlist_menu_exit:
    bl      list_free_all                    // free everything on the way out
    ldp     fp, lr, [sp], 16
    ret

// display_linkedlist_menu() - draw the menu box and options
    .global display_linkedlist_menu
display_linkedlist_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, 3                            // row
    mov     w1, 15                           // column
    mov     w2, 50                           // width
    mov     w3, 15                           // height
    mov     w4, 1                            // double-line style
    bl      draw_box

    // title, centered in the box
    mov     w0, 4
    mov     w1, 17
    bl      ansi_move_cursor
    ldr     x0, =list_menu_title
    mov     w1, 46
    bl      print_centered

    // separator under the title
    mov     w0, 5
    mov     w1, 15
    mov     w2, 50
    mov     w3, 1
    bl      draw_horizontal_border_top

    // menu options, one per row
    mov     w0, 7
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =list_menu_opt_1
    bl      printf

    mov     w0, 8
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =list_menu_opt_2
    bl      printf

    mov     w0, 9
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =list_menu_opt_3
    bl      printf

    mov     w0, 10
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =list_menu_opt_4
    bl      printf

    mov     w0, 11
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =list_menu_opt_5
    bl      printf

    mov     w0, 12
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =list_menu_opt_6
    bl      printf

    mov     w0, 13
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =list_menu_opt_0
    bl      printf

    // separator above the prompt
    mov     w0, 15
    mov     w1, 15
    mov     w2, 50
    mov     w3, 1
    bl      draw_horizontal_border_top

    // park the cursor where the prompt goes
    mov     w0, 16
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =list_menu_prompt
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// list_create_node(x0 = value) -> x0 = new node, NULL on failure
    .global list_create_node
list_create_node:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0                          // save value across malloc

    mov     x0, node_size
    bl      malloc
    cmp     x0, 0
    b.eq    list_create_node_fail

    str     x19, [x0, node_data_offset]
    mov     x1, 0
    str     x1, [x0, node_next_offset]      // next = NULL

    b       list_create_node_done

list_create_node_fail:
    mov     x0, 0

list_create_node_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// list_insert_front(x0 = value) -> w0 = 1 on success, 0 on failure
    .global list_insert_front
list_insert_front:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      list_create_node
    cmp     x0, 0
    b.eq    list_insert_front_fail

    mov     x19, x0                          // x19 = new node

    ldr     x1, =list_head
    ldr     x2, [x1]

    // new_node->next = head
    str     x2, [x19, node_next_offset]

    // head = new_node
    str     x19, [x1]

    // bump the count
    ldr     x1, =list_count
    ldr     w2, [x1]
    add     w2, w2, 1
    str     w2, [x1]

    mov     w0, 1
    b       list_insert_front_done

list_insert_front_fail:
    mov     w0, 0

list_insert_front_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// list_insert_back(x0 = value) -> w0 = 1 on success, 0 on failure
    .global list_insert_back
list_insert_back:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     x19, x0                          // save value

    bl      list_create_node
    cmp     x0, 0
    b.eq    list_insert_back_fail

    mov     x20, x0                          // x20 = new node

    ldr     x1, =list_head
    ldr     x21, [x1]

    cmp     x21, 0
    b.eq    list_insert_back_empty

    // walk to the last node
list_insert_back_traverse:
    ldr     x2, [x21, node_next_offset]
    cmp     x2, 0
    b.eq    list_insert_back_found_last
    mov     x21, x2
    b       list_insert_back_traverse

list_insert_back_found_last:
    // last->next = new_node
    str     x20, [x21, node_next_offset]
    b       list_insert_back_success

list_insert_back_empty:
    // head = new_node
    ldr     x1, =list_head
    str     x20, [x1]

list_insert_back_success:
    // bump the count
    ldr     x1, =list_count
    ldr     w2, [x1]
    add     w2, w2, 1
    str     w2, [x1]

    mov     w0, 1
    b       list_insert_back_done

list_insert_back_fail:
    mov     w0, 0

list_insert_back_done:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// list_delete(x0 = value) -> w0 = 1 if deleted, 0 if not found
// removes the first node holding the value
    .global list_delete
list_delete:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     x19, x0                          // x19 = value to delete

    ldr     x1, =list_head
    ldr     x20, [x1]

    cmp     x20, 0
    b.eq    list_delete_not_found

    // head itself may be the match
    ldr     x2, [x20, node_data_offset]
    cmp     x2, x19
    b.eq    list_delete_head

    mov     x21, x20                         // prev = head
list_delete_traverse:
    ldr     x20, [x20, node_next_offset]    // current = current->next
    cmp     x20, 0
    b.eq    list_delete_not_found

    ldr     x2, [x20, node_data_offset]
    cmp     x2, x19
    b.eq    list_delete_found
    mov     x21, x20
    b       list_delete_traverse

list_delete_head:
    // head = head->next, then free the old head
    ldr     x2, [x20, node_next_offset]
    ldr     x1, =list_head
    str     x2, [x1]

    mov     x0, x20
    bl      free

    b       list_delete_success

list_delete_found:
    // unlink a middle or last node
    ldr     x2, [x20, node_next_offset]
    str     x2, [x21, node_next_offset]

    mov     x0, x20
    bl      free

list_delete_success:
    // drop the count
    ldr     x1, =list_count
    ldr     w2, [x1]
    sub     w2, w2, 1
    str     w2, [x1]

    mov     w0, 1
    b       list_delete_done

list_delete_not_found:
    mov     w0, 0

list_delete_done:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// list_search(x0 = value) -> x0 = node, NULL if not found
    .global list_search
list_search:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0                          // x19 = search value

    ldr     x1, =list_head
    ldr     x0, [x1]

list_search_loop:
    cmp     x0, 0
    b.eq    list_search_not_found

    ldr     x2, [x0, node_data_offset]
    cmp     x2, x19
    b.eq    list_search_found

    ldr     x0, [x0, node_next_offset]
    b       list_search_loop

list_search_found:
    // x0 already holds the node
    b       list_search_done

list_search_not_found:
    mov     x0, 0

list_search_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// list_free_all() - free every node, reset head and count
    .global list_free_all
list_free_all:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x1, =list_head
    ldr     x19, [x1]

list_free_all_loop:
    cmp     x19, 0
    b.eq    list_free_all_done

    ldr     x20, [x19, node_next_offset]    // grab next before freeing

    mov     x0, x19
    bl      free

    mov     x19, x20
    b       list_free_all_loop

list_free_all_done:
    ldr     x1, =list_head
    mov     x2, 0
    str     x2, [x1]

    ldr     x1, =list_count
    str     w2, [x1]

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// list_insert_front_interactive() - prompt for a value, insert, show the list
    .global list_insert_front_interactive
list_insert_front_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      ansi_clear_screen

    ldr     x0, =list_prompt_value
    bl      printf

    bl      read_int
    sxtw    x19, w0                          // sign-extend to 64-bit

    mov     x0, x19
    bl      list_insert_front

    cmp     w0, 0
    b.eq    list_insert_front_int_fail

    bl      list_display

    mov     w0, 22                           // status line
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =msg_inserted_front
    mov     w1, w19
    bl      printf
    bl      print_newline

    b       list_insert_front_int_done

list_insert_front_int_fail:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =msg_alloc_fail
    bl      printf
    bl      print_newline

list_insert_front_int_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// list_insert_back_interactive() - prompt for a value, insert, show the list
    .global list_insert_back_interactive
list_insert_back_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      ansi_clear_screen

    ldr     x0, =list_prompt_value
    bl      printf

    bl      read_int
    sxtw    x19, w0                          // sign-extend to 64-bit

    mov     x0, x19
    bl      list_insert_back

    cmp     w0, 0
    b.eq    list_insert_back_int_fail

    bl      list_display

    mov     w0, 22                           // status line
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =msg_inserted_back
    mov     w1, w19
    bl      printf
    bl      print_newline

    b       list_insert_back_int_done

list_insert_back_int_fail:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =msg_alloc_fail
    bl      printf
    bl      print_newline

list_insert_back_int_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// list_delete_interactive() - prompt for a value, delete it, show the list
    .global list_delete_interactive
list_delete_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      ansi_clear_screen

    ldr     x0, =list_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    list_delete_int_empty

    ldr     x0, =prompt_delete
    bl      printf

    bl      read_int
    sxtw    x19, w0

    mov     x0, x19
    bl      list_delete

    cmp     w0, 0
    b.eq    list_delete_int_not_found

    bl      list_display

    mov     w0, 22                           // status line
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =list_msg_deleted
    mov     w1, w19
    bl      printf
    bl      print_newline

    b       list_delete_int_done

list_delete_int_empty:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =list_msg_empty
    bl      printf
    bl      print_newline
    b       list_delete_int_done

list_delete_int_not_found:
    bl      list_display

    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =list_msg_not_found
    mov     w1, w19
    bl      printf
    bl      print_newline

list_delete_int_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// list_search_interactive() - animated walk from head, 500ms per node
    .global list_search_interactive
list_search_interactive:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    bl      ansi_clear_screen

    ldr     x0, =list_count
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    list_search_int_empty

    ldr     x0, =prompt_search
    bl      printf

    bl      read_int
    sxtw    x19, w0                          // x19 = search target

    bl      list_display

    // wait for enter before the walk starts
    mov     w0, 23
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Lmsg_press_enter
    bl      printf

    bl      clear_input_buffer
    bl      getchar

    ldr     x1, =list_head
    ldr     x20, [x1]                        // x20 = current node
    mov     w21, 0                           // w21 = node index

list_search_anim_loop:
    cmp     x20, 0
    b.eq    list_search_int_not_found

    bl      ansi_clear_screen
    bl      list_display_with_highlight      // x20 = node to highlight

    mov     w0, 15
    mov     w1, 10
    bl      ansi_move_cursor
    ldr     x0, =.Lmsg_checking
    ldr     x1, [x20, node_data_offset]
    mov     w2, w21
    bl      printf

    mov     w0, 500                          // 500ms per step
    bl      delay_ms

    ldr     x2, [x20, node_data_offset]
    cmp     x2, x19
    b.eq    list_search_int_found

    ldr     x20, [x20, node_next_offset]
    add     w21, w21, 1
    b       list_search_anim_loop

list_search_int_found:
    // redraw with the found node still highlighted
    bl      ansi_clear_screen
    bl      list_display_with_highlight

    mov     w0, 22                           // status line
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =list_msg_found
    mov     w1, w19
    bl      printf
    bl      print_newline

    b       list_search_int_done

list_search_int_empty:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =list_msg_empty
    bl      printf
    bl      print_newline
    b       list_search_int_done

list_search_int_not_found:
    bl      ansi_clear_screen
    bl      list_display

    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =list_msg_not_found
    mov     w1, w19
    bl      printf
    bl      print_newline

list_search_int_done:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// list_display() - draw the list as value boxes joined by arrows
    .global list_display
list_display:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    bl      ansi_clear_screen

    ldr     x1, =list_head
    ldr     x19, [x1]

    cmp     x19, 0
    b.eq    list_display_empty

    mov     w0, 3                            // row
    mov     w1, 5                            // column
    mov     w2, 70                           // width
    mov     w3, 12                           // height
    mov     w4, 0                            // single-line style
    bl      draw_box

    // title, centered in the box
    mov     w0, 4
    mov     w1, 7
    bl      ansi_move_cursor
    ldr     x0, =list_title
    mov     w1, 66
    bl      print_centered

    // separator under the title
    mov     w0, 5
    mov     w1, 5
    mov     w2, 70
    mov     w3, 0
    bl      draw_horizontal_border_top

    // HEAD label with an arrow down to the first node
    mov     w0, 8
    mov     w1, 10
    bl      ansi_move_cursor
    ldr     x0, =label_head
    bl      printf

    mov     w0, 9
    mov     w1, 11
    bl      ansi_move_cursor
    ldr     x0, =.Llist_arrow_down
    bl      printf

    mov     w20, 10                          // row
    mov     w21, 10                          // column

list_display_loop:
    cmp     x19, 0
    b.eq    list_display_footer

    mov     w0, w20
    mov     w1, w21
    bl      ansi_move_cursor

    ldr     x1, [x19, node_data_offset]
    ldr     x0, =.Llist_node_fmt
    bl      printf

    ldr     x19, [x19, node_next_offset]
    cmp     x19, 0
    b.eq    list_display_last_node

    ldr     x0, =.Larrow_right
    bl      printf

    add     w21, w21, 11                     // next node column
    b       list_display_loop

list_display_last_node:
    // last arrow points at NULL
    ldr     x0, =.Larrow_right
    bl      printf

    ldr     x0, =label_null
    bl      printf

list_display_footer:
    mov     w0, 13
    mov     w1, 10
    bl      ansi_move_cursor

    ldr     x1, =list_count
    ldr     w1, [x1]

    ldr     x0, =list_label_nodes
    bl      printf

    bl      print_newline
    b       list_display_done

list_display_empty:
    mov     w0, 10
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =list_msg_empty
    bl      printf
    bl      print_newline

list_display_done:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

    .data
.Llist_arrow_down:   .string "↓"
.Larrow_right:  .string "──>"
.Llist_node_fmt:     .string "[%3ld]"
.Lmsg_press_enter: .string "\x1b[33mPress Enter to start searching...\x1b[0m"
.Lmsg_checking: .string "Checking node value %ld at index %d..."
    .text

// list_display_with_highlight(x20 = node to highlight)
// same drawing as list_display, with one node on the highlight color
    .global list_display_with_highlight
list_display_with_highlight:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     x21, x20                         // x21 = highlighted node

    ldr     x1, =list_head
    ldr     x19, [x1]

    cmp     x19, 0
    b.eq    list_display_hl_empty

    mov     w0, 3                            // row
    mov     w1, 5                            // column
    mov     w2, 70                           // width
    mov     w3, 12                           // height
    mov     w4, 0                            // single-line style
    bl      draw_box

    // title, centered in the box
    mov     w0, 4
    mov     w1, 7
    bl      ansi_move_cursor
    ldr     x0, =list_title
    mov     w1, 66
    bl      print_centered

    // separator under the title
    mov     w0, 5
    mov     w1, 5
    mov     w2, 70
    mov     w3, 0
    bl      draw_horizontal_border_top

    // HEAD label with an arrow down to the first node
    mov     w0, 8
    mov     w1, 10
    bl      ansi_move_cursor
    ldr     x0, =label_head
    bl      printf

    mov     w0, 9
    mov     w1, 11
    bl      ansi_move_cursor
    ldr     x0, =.Llist_arrow_down
    bl      printf

    mov     w20, 10                          // row
    mov     w22, 10                          // column

list_display_hl_loop:
    cmp     x19, 0
    b.eq    list_display_hl_footer

    mov     w0, w20
    mov     w1, w22
    bl      ansi_move_cursor

    // switch on the highlight color for the matching node
    cmp     x19, x21
    b.ne    list_display_hl_normal

    ldr     x0, =list_highlight_color
    bl      printf

list_display_hl_normal:
    ldr     x1, [x19, node_data_offset]
    ldr     x0, =.Llist_node_fmt
    bl      printf

    // switch the color back off after the highlighted node
    cmp     x19, x21
    b.ne    list_display_hl_no_reset

    ldr     x0, =list_color_reset
    bl      printf

list_display_hl_no_reset:
    ldr     x19, [x19, node_next_offset]
    cmp     x19, 0
    b.eq    list_display_hl_last_node

    ldr     x0, =.Larrow_right
    bl      printf

    add     w22, w22, 11                     // next node column
    b       list_display_hl_loop

list_display_hl_last_node:
    // last arrow points at NULL
    ldr     x0, =.Larrow_right
    bl      printf

    ldr     x0, =label_null
    bl      printf

list_display_hl_footer:
    mov     w0, 13
    mov     w1, 10
    bl      ansi_move_cursor

    ldr     x1, =list_count
    ldr     w1, [x1]

    ldr     x0, =list_label_nodes
    bl      printf

    bl      print_newline
    b       list_display_hl_done

list_display_hl_empty:
    mov     w0, 10
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =list_msg_empty
    bl      printf
    bl      print_newline

list_display_hl_done:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret
