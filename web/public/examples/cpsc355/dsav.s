// main.asm - the home screen and dispatch
// dsav: terminal data structures and algorithms visualizer

define(fp, x29)
define(lr, x30)

// The roles ui.asm draws with. Each file assembles on its own, so every
// module that names a role repeats the block; theme.asm holds the colours
// the numbers stand for.
    UI_ROLE_TEXT   = 0
    UI_ROLE_DIM    = 1
    UI_ROLE_FAINT  = 2
    UI_ROLE_ACCENT = 3
    UI_ROLE_KEY    = 4

    HOME_NUM_COL   = 4
    HOME_NAME_COL  = 8
    HOME_BLURB_COL = 30

    .data
    .balign 8

home_title:     .string "home"

group_struct:   .string "STRUCTURES"
group_algo:     .string "ALGORITHMS"

opt_array:      .string "array"
opt_stack:      .string "stack"
opt_queue:      .string "queue"
opt_list:       .string "linked list"
opt_bst:        .string "binary search tree"
opt_rbt:        .string "red-black tree"
opt_heap:       .string "heap"
opt_hash:       .string "hash table"
opt_graph:      .string "graph"
opt_sort:       .string "sorting"
opt_search:     .string "searching"
opt_recursion:  .string "recursion"
opt_exit:       .string "exit"

// One line of context each, so the menu teaches before a key is pressed.
sub_array:      .string "indexed cells, constant-time access"
sub_stack:      .string "last in, first out"
sub_queue:      .string "first in, first out"
sub_list:       .string "nodes joined by pointers"
sub_bst:        .string "ordered, log n while it stays balanced"
sub_rbt:        .string "balances itself on every insert"
sub_heap:       .string "the smallest value is always on top"
sub_hash:       .string "key to bucket, constant time on average"
sub_graph:      .string "vertices and edges, walked breadth and depth"
sub_sort:       .string "eight algorithms over the same array"
sub_search:     .string "four ways to find one value"
sub_recursion:  .string "towers of hanoi, with the call stack shown"
sub_exit:       .string "leave dsav"

num_1:          .string "1"
num_2:          .string "2"
num_3:          .string "3"
num_4:          .string "4"
num_5:          .string "5"
num_6:          .string "6"
num_7:          .string "7"
num_8:          .string "8"
num_9:          .string "9"
num_10:         .string "10"
num_11:         .string "11"
num_12:         .string "12"
num_0:          .string "0"

home_prompt:    .string "choose "
home_hint:      .string "type a number and press enter"
goodbye_msg:    .string "\x1b[38;5;157mthanks for using dsav.\x1b[0m\n"

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

    mov     w0, 0                           // min choice
    mov     w1, 12                          // max choice
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
    b.eq    handle_heap_menu
    cmp     w0, 8
    b.eq    handle_hash_menu
    cmp     w0, 9
    b.eq    handle_graph_menu
    cmp     w0, 10
    b.eq    handle_sort_menu
    cmp     w0, 11
    b.eq    handle_search_menu
    cmp     w0, 12
    b.eq    handle_recursion_menu

    b       main_loop                       // unreachable: choice already validated

// Every module runs its own loop and only returns when the student picks
// back, so there is nothing left to read here: redraw home straight away.
handle_array_menu:
    bl      array_menu
    b       main_loop

handle_stack_menu:
    bl      stack_menu
    b       main_loop

handle_queue_menu:
    bl      queue_menu
    b       main_loop

handle_linkedlist_menu:
    bl      linkedlist_menu
    b       main_loop

handle_bst_menu:
    bl      bst_menu
    b       main_loop

handle_rbtree_menu:
    bl      rb_menu
    b       main_loop

handle_heap_menu:
    bl      heap_menu
    b       main_loop

handle_hash_menu:
    bl      hash_menu
    b       main_loop

handle_graph_menu:
    bl      graph_menu
    b       main_loop

handle_sort_menu:
    bl      sort_menu
    b       main_loop

handle_search_menu:
    bl      search_menu
    b       main_loop

handle_recursion_menu:
    bl      rec_menu
    b       main_loop

main_exit:
    bl      ansi_show_cursor
    bl      ansi_clear_screen

    ldr     x0, =goodbye_msg
    bl      printf

    mov     w0, 0
    ldp     fp, lr, [sp], 16
    ret

// home_entry(w0 = row, x1 = number, x2 = name, x3 = blurb or 0)
// One menu line: the key in its own colour, the name, then the quiet
// blurb that says what the thing is before a keystroke is spent on it.
home_entry:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     w19, w0                         // row
    mov     x20, x1                         // number
    mov     x21, x2                         // name
    mov     x22, x3                         // blurb

    mov     w0, w19
    mov     w1, HOME_NUM_COL
    mov     w2, UI_ROLE_KEY
    mov     x3, x20
    bl      ui_text

    mov     w0, w19
    mov     w1, HOME_NAME_COL
    mov     w2, UI_ROLE_TEXT
    mov     x3, x21
    bl      ui_text

    cbz     x22, home_entry_done
    mov     w0, w19
    mov     w1, HOME_BLURB_COL
    mov     w2, UI_ROLE_FAINT
    mov     x3, x22
    bl      ui_text

home_entry_done:
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// display_main_menu() - draw the home screen and park the cursor on the
// prompt, ready for read_int_range
    .global display_main_menu
display_main_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =home_title
    bl      ui_screen
    bl      ui_tagline

    mov     w0, 4
    mov     w1, HOME_NUM_COL
    mov     w2, UI_ROLE_ACCENT
    ldr     x3, =group_struct
    bl      ui_text

    mov     w0, 5
    ldr     x1, =num_1
    ldr     x2, =opt_array
    ldr     x3, =sub_array
    bl      home_entry

    mov     w0, 6
    ldr     x1, =num_2
    ldr     x2, =opt_stack
    ldr     x3, =sub_stack
    bl      home_entry

    mov     w0, 7
    ldr     x1, =num_3
    ldr     x2, =opt_queue
    ldr     x3, =sub_queue
    bl      home_entry

    mov     w0, 8
    ldr     x1, =num_4
    ldr     x2, =opt_list
    ldr     x3, =sub_list
    bl      home_entry

    mov     w0, 9
    ldr     x1, =num_5
    ldr     x2, =opt_bst
    ldr     x3, =sub_bst
    bl      home_entry

    mov     w0, 10
    ldr     x1, =num_6
    ldr     x2, =opt_rbt
    ldr     x3, =sub_rbt
    bl      home_entry

    mov     w0, 11
    ldr     x1, =num_7
    ldr     x2, =opt_heap
    ldr     x3, =sub_heap
    bl      home_entry

    mov     w0, 12
    ldr     x1, =num_8
    ldr     x2, =opt_hash
    ldr     x3, =sub_hash
    bl      home_entry

    mov     w0, 13
    ldr     x1, =num_9
    ldr     x2, =opt_graph
    ldr     x3, =sub_graph
    bl      home_entry

    mov     w0, 15
    mov     w1, HOME_NUM_COL
    mov     w2, UI_ROLE_ACCENT
    ldr     x3, =group_algo
    bl      ui_text

    mov     w0, 16
    ldr     x1, =num_10
    ldr     x2, =opt_sort
    ldr     x3, =sub_sort
    bl      home_entry

    mov     w0, 17
    ldr     x1, =num_11
    ldr     x2, =opt_search
    ldr     x3, =sub_search
    bl      home_entry

    mov     w0, 18
    ldr     x1, =num_12
    ldr     x2, =opt_recursion
    ldr     x3, =sub_recursion
    bl      home_entry

    mov     w0, 19
    ldr     x1, =num_0
    ldr     x2, =opt_exit
    ldr     x3, =sub_exit
    bl      home_entry

    ldr     x0, =home_hint
    bl      ui_footer

    mov     w0, 20
    mov     w1, HOME_NUM_COL
    ldr     x2, =home_prompt
    bl      ui_prompt

    ldp     fp, lr, [sp], 16
    ret
