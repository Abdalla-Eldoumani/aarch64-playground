// dsav - the data structures & algorithms visualizer, menu-driven:
// array, stack, queue, linked list, binary search tree, red-black tree,
// five sorts and two searches, all animated with ansi escape codes.
//
// The full project (assembly, c++, and rust versions) lives at
//   https://github.com/Abdalla-Eldoumani/dsav
//
// how to run: the program spans every file in the strip above; assemble
// links them into one image. For the full-screen feel run it from the
// term tab:  ./program  -- menus read a number plus enter, and every
// animation paces itself, so take your time.

define(fp, x29)
define(lr, x30)

    .data
    .balign 8

app_title:      .string "DATA STRUCTURES & ALGORITHMS VISUALIZER"
app_subtitle:   .string "ARMv8 Assembly Edition"

menu_option_1:  .string "[1] Array Operations"
menu_option_2:  .string "[2] Stack Operations"
menu_option_3:  .string "[3] Queue Operations"
menu_option_4:  .string "[4] Linked List Operations"
menu_option_5:  .string "[5] Binary Search Tree"
menu_option_6:  .string "[6] Red-Black Tree"
menu_option_7:  .string "[7] Sorting Algorithms"
menu_option_8:  .string "[8] Search Algorithms"
menu_option_0:  .string "[0] Exit"

main_menu_prompt:    .string "Enter your choice (0-8): "
invalid_choice: .string "\x1b[31mInvalid choice! Please select 0-8.\x1b[0m"
goodbye_msg:    .string "\n\x1b[32mThank you for using DSAV! Goodbye.\x1b[0m\n"
test_msg:       .string "\x1b[33m[This feature is not yet implemented]\x1b[0m\n"

    .text
    .balign 4
    .global main

// main() -> w0 = exit code
main:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      seed_random
    bl      ansi_hide_cursor                // menus redraw cleaner without it

main_loop:
    bl      display_main_menu

    ldr     x0, =main_menu_prompt
    bl      printf

    mov     w0, 0                           // min choice
    mov     w1, 8                           // max choice
    bl      read_int_range                  // w0 = validated choice

    // dispatch
    cmp     w0, 0
    b.eq    main_exit
    cmp     w0, 1
    b.eq    handle_array_menu
    cmp     w0, 2
    b.eq    handle_stack_menu
    cmp     w0, 3
    b.eq    handle_queue_menu
    cmp     w0, 4
    b.eq    handle_linkedlist_menu
    cmp     w0, 5
    b.eq    handle_bst_menu
    cmp     w0, 6
    b.eq    handle_rbtree_menu
    cmp     w0, 7
    b.eq    handle_sort_menu
    cmp     w0, 8
    b.eq    handle_search_menu

    b       main_loop                       // unreachable: choice already validated

handle_array_menu:
    bl      array_menu
    bl      wait_for_enter
    b       main_loop

handle_stack_menu:
    bl      stack_menu
    bl      wait_for_enter
    b       main_loop

handle_queue_menu:
    bl      queue_menu
    bl      wait_for_enter
    b       main_loop

handle_linkedlist_menu:
    bl      linkedlist_menu
    bl      wait_for_enter
    b       main_loop

handle_bst_menu:
    bl      bst_menu
    bl      wait_for_enter
    b       main_loop

handle_rbtree_menu:
    bl      rb_menu
    bl      wait_for_enter
    b       main_loop

handle_sort_menu:
    bl      sort_menu
    bl      wait_for_enter
    b       main_loop

handle_search_menu:
    bl      search_menu
    bl      wait_for_enter
    b       main_loop

main_exit:
    bl      ansi_show_cursor
    bl      ansi_clear_screen

    ldr     x0, =goodbye_msg
    bl      printf

    mov     w0, 0
    ldp     fp, lr, [sp], 16
    ret

// display_main_menu() - clear the screen, draw the menu box and options
    .global display_main_menu
display_main_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      ansi_clear_screen

    // outer box
    mov     w0, 3                           // row
    mov     w1, 15                          // column
    mov     w2, 54                          // width
    mov     w3, 20                          // height
    mov     w4, 1                           // style: double line
    bl      draw_box

    // title and subtitle, centered in the box
    mov     w0, 4
    mov     w1, 17
    bl      ansi_move_cursor
    ldr     x0, =app_title
    mov     w1, 50                          // field width
    bl      print_centered

    mov     w0, 5
    mov     w1, 17
    bl      ansi_move_cursor
    ldr     x0, =app_subtitle
    mov     w1, 50
    bl      print_centered

    // separator under the title
    mov     w0, 6                           // row
    mov     w1, 15                          // column
    mov     w2, 54                          // width
    mov     w3, 1                           // style
    bl      draw_horizontal_border_top

    // menu options, one per row
    mov     w0, 9
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_option_1
    bl      printf

    mov     w0, 10
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_option_2
    bl      printf

    mov     w0, 11
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_option_3
    bl      printf

    mov     w0, 12
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_option_4
    bl      printf

    mov     w0, 13
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_option_5
    bl      printf

    mov     w0, 14
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_option_6
    bl      printf

    mov     w0, 15
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_option_7
    bl      printf

    mov     w0, 16
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_option_8
    bl      printf

    mov     w0, 17
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =menu_option_0
    bl      printf

    // separator above the prompt
    mov     w0, 19                          // row
    mov     w1, 15                          // column
    mov     w2, 54                          // width
    mov     w3, 1                           // style
    bl      draw_horizontal_border_top

    // park the cursor where the prompt goes
    mov     w0, 21
    mov     w1, 18
    bl      ansi_move_cursor

    ldp     fp, lr, [sp], 16
    ret
