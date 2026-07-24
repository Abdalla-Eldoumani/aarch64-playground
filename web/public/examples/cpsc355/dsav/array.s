// array_viz.asm - array visualizer: init, display, get/set, swap, clear
// static 10-slot int array with an optional highlight for animations

define(fp, x29)
define(lr, x30)

    .data
.balign 8

array_max_size = 10                         // capacity in elements

array_data:     .skip array_max_size * 4    // 10 x 4-byte ints
array_count:    .word 0                     // elements in use

// highlight state for algorithm visualization
highlight_index: .word -1                   // index to highlight (-1 = none)
array_highlight_color: .word 33                   // yellow

array_title:        .string "ARRAY VISUALIZATION"
array_menu_title:   .string "ARRAY OPERATIONS MENU"

array_menu_opt_1:         .string "[1] Initialize with Random Values"
array_menu_opt_2:         .string "[2] Initialize with User Input"
array_menu_opt_3:         .string "[3] Display Array"
array_menu_opt_4:         .string "[4] Set Element at Index"
array_menu_opt_5:         .string "[5] Get Element at Index"
array_menu_opt_6:         .string "[6] Swap Two Elements"
array_menu_opt_7:         .string "[7] Clear Array"
array_menu_opt_0:         .string "[0] Back to Main Menu"

array_menu_prompt:        .string "Enter your choice: "
prompt_count:       .string "Enter number of elements (1-%d): "
array_prompt_value:       .string "Enter value for element %d: "
prompt_index:       .string "Enter index (0-%d): "
prompt_index1:      .string "Enter first index (0-%d): "
prompt_index2:      .string "Enter second index (0-%d): "
prompt_new_value:   .string "Enter new value: "

array_msg_empty:          .string "\x1b[33mArray is empty!\x1b[0m"
array_msg_initialized:    .string "\x1b[32mArray initialized with %d elements.\x1b[0m"
msg_value_at:       .string "Value at index %d: \x1b[36m%d\x1b[0m"
msg_swapped:        .string "\x1b[32mSwapped elements at indices %d and %d\x1b[0m"
array_msg_cleared:        .string "\x1b[32mArray cleared.\x1b[0m"
msg_updated:        .string "\x1b[32mElement at index %d updated to %d\x1b[0m"

label_index:        .string "Index:"
label_value:        .string "Value:"
array_label_size:         .string "Size: %d/%d"

    .text
.balign 4

// array_menu - operations menu loop; returns when the user picks 0
    .global array_menu
array_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

array_menu_loop:
    bl      ansi_clear_screen
    bl      display_array_menu

    mov     w0, 0                           // min
    mov     w1, 7                           // max
    bl      read_int_range

    cmp     w0, 0
    b.eq    array_menu_exit
    cmp     w0, 1
    b.eq    array_menu_init_random
    cmp     w0, 2
    b.eq    array_menu_init_user
    cmp     w0, 3
    b.eq    array_menu_display
    cmp     w0, 4
    b.eq    array_menu_set
    cmp     w0, 5
    b.eq    array_menu_get
    cmp     w0, 6
    b.eq    array_menu_swap
    cmp     w0, 7
    b.eq    array_menu_clear
    b       array_menu_loop

array_menu_init_random:
    bl      array_init_random
    bl      wait_for_enter
    b       array_menu_loop

array_menu_init_user:
    bl      array_init_user
    bl      wait_for_enter
    b       array_menu_loop

array_menu_display:
    bl      array_display
    bl      wait_for_enter
    b       array_menu_loop

array_menu_set:
    bl      array_set_interactive
    bl      wait_for_enter
    b       array_menu_loop

array_menu_get:
    bl      array_get_interactive
    bl      wait_for_enter
    b       array_menu_loop

array_menu_swap:
    bl      array_swap_interactive
    bl      wait_for_enter
    b       array_menu_loop

array_menu_clear:
    bl      array_clear

    mov     w0, 22                          // status line
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =array_msg_cleared
    bl      printf
    bl      print_newline
    bl      wait_for_enter
    b       array_menu_loop

array_menu_exit:
    ldp     fp, lr, [sp], 16
    ret

// display_array_menu - draw the boxed operations menu
    .global display_array_menu
display_array_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // menu box
    mov     w0, 3                           // row
    mov     w1, 10                          // column
    mov     w2, 60                          // width
    mov     w3, 16                          // height
    mov     w4, 1                           // double-line style
    bl      draw_box

    // title
    mov     w0, 4
    mov     w1, 12
    bl      ansi_move_cursor
    ldr     x0, =array_menu_title
    mov     w1, 56
    bl      print_centered

    // separator under the title
    mov     w0, 5
    mov     w1, 10
    mov     w2, 60
    mov     w3, 1
    bl      draw_horizontal_border_top

    // options, one per row
    mov     w0, 7
    mov     w1, 15
    bl      ansi_move_cursor
    ldr     x0, =array_menu_opt_1
    bl      printf

    mov     w0, 8
    mov     w1, 15
    bl      ansi_move_cursor
    ldr     x0, =array_menu_opt_2
    bl      printf

    mov     w0, 9
    mov     w1, 15
    bl      ansi_move_cursor
    ldr     x0, =array_menu_opt_3
    bl      printf

    mov     w0, 10
    mov     w1, 15
    bl      ansi_move_cursor
    ldr     x0, =array_menu_opt_4
    bl      printf

    mov     w0, 11
    mov     w1, 15
    bl      ansi_move_cursor
    ldr     x0, =array_menu_opt_5
    bl      printf

    mov     w0, 12
    mov     w1, 15
    bl      ansi_move_cursor
    ldr     x0, =array_menu_opt_6
    bl      printf

    mov     w0, 13
    mov     w1, 15
    bl      ansi_move_cursor
    ldr     x0, =array_menu_opt_7
    bl      printf

    mov     w0, 14
    mov     w1, 15
    bl      ansi_move_cursor
    ldr     x0, =array_menu_opt_0
    bl      printf

    // separator above the prompt
    mov     w0, 16
    mov     w1, 10
    mov     w2, 60
    mov     w3, 1
    bl      draw_horizontal_border_top

    // input prompt
    mov     w0, 17
    mov     w1, 15
    bl      ansi_move_cursor
    ldr     x0, =array_menu_prompt
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// array_init_random - fill with random values (0-99), then show the result
    .global array_init_random
array_init_random:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    bl      ansi_clear_screen

    // ask how many elements
    ldr     x0, =prompt_count
    mov     w1, array_max_size
    bl      printf

    mov     w0, 1
    mov     w1, array_max_size
    bl      read_int_range
    mov     w19, w0                         // w19 = count

    ldr     x20, =array_count
    str     w19, [x20]

    ldr     x20, =array_data                // x20 = array base
    mov     w21, 0                          // w21 = index

array_init_random_loop:
    cmp     w21, w19
    b.ge    array_init_random_done

    mov     w0, 100                         // values in [0, 100)
    bl      get_random
    str     w0, [x20, w21, SXTW 2]

    add     w21, w21, 1
    b       array_init_random_loop

array_init_random_done:
    bl      array_display

    mov     w0, 15                          // status line below the box
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =array_msg_initialized
    mov     w1, w19
    bl      printf
    bl      print_newline

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// array_init_user - fill with values typed by the user
    .global array_init_user
array_init_user:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    bl      ansi_clear_screen

    // ask how many elements
    ldr     x0, =prompt_count
    mov     w1, array_max_size
    bl      printf

    mov     w0, 1
    mov     w1, array_max_size
    bl      read_int_range
    mov     w19, w0                         // w19 = count

    ldr     x20, =array_count
    str     w19, [x20]

    ldr     x20, =array_data                // x20 = array base
    mov     w21, 0                          // w21 = index

array_init_user_loop:
    cmp     w21, w19
    b.ge    array_init_user_done

    ldr     x0, =array_prompt_value
    mov     w1, w21
    bl      printf

    bl      read_int
    mov     w22, w0                         // w22 = value
    str     w22, [x20, w21, SXTW 2]

    add     w21, w21, 1
    b       array_init_user_loop

array_init_user_done:
    bl      array_display

    mov     w0, 15                          // status line below the box
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =array_msg_initialized
    mov     w1, w19
    bl      printf
    bl      print_newline

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// array_display - draw the array as an index row and a value row,
// with highlight_index drawn on a yellow background when set
    .global array_display
array_display:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    bl      ansi_clear_screen

    ldr     x19, =array_count
    ldr     w19, [x19]                      // w19 = count

    cmp     w19, 0
    b.le    array_display_empty

    // frame box
    mov     w0, 3
    mov     w1, 2
    mov     w2, 80
    mov     w3, 10
    mov     w4, 0                           // single-line style
    bl      draw_box

    // title
    mov     w0, 4
    mov     w1, 4
    bl      ansi_move_cursor
    ldr     x0, =array_title
    mov     w1, 76
    bl      print_centered

    // index row
    mov     w0, 6
    mov     w1, 10
    bl      ansi_move_cursor
    ldr     x0, =label_index
    bl      printf

    ldr     x20, =array_data                // x20 = array base
    mov     w21, 0                          // w21 = index
    mov     w22, 20                         // w22 = column

array_display_indices:
    cmp     w21, w19
    b.ge    array_display_values_start

    mov     w0, 6
    mov     w1, w22
    bl      ansi_move_cursor

    ldr     x0, =.Lindex_fmt
    mov     w1, w21
    bl      printf

    add     w22, w22, 6                     // next column
    add     w21, w21, 1
    b       array_display_indices

array_display_values_start:
    // value row
    mov     w0, 7
    mov     w1, 10
    bl      ansi_move_cursor
    ldr     x0, =label_value
    bl      printf

    mov     w21, 0                          // w21 = index
    mov     w22, 20                         // w22 = column

    ldr     x23, =highlight_index
    ldr     w23, [x23]                      // w23 = highlight index (-1 = none)

array_display_values:
    cmp     w21, w19
    b.ge    array_display_footer

    mov     w0, 7
    mov     w1, w22
    bl      ansi_move_cursor

    cmp     w21, w23
    b.ne    array_display_normal

    mov     w0, 43                          // yellow background
    bl      ansi_set_color_bg

array_display_normal:
    ldr     w1, [x20, w21, SXTW 2]
    ldr     x0, =.Larray_value_fmt
    bl      printf

    // drop the highlight again
    cmp     w21, w23
    b.ne    array_display_next
    bl      ansi_reset_attributes

array_display_next:
    add     w22, w22, 6                     // next column
    add     w21, w21, 1
    b       array_display_values

array_display_footer:
    mov     w0, 9
    mov     w1, 10
    bl      ansi_move_cursor
    ldr     x0, =array_label_size
    mov     w1, w19
    mov     w2, array_max_size
    bl      printf

    bl      print_newline
    b       array_display_done

array_display_empty:
    mov     w0, 10
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =array_msg_empty
    bl      printf
    bl      print_newline

array_display_done:
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

    .data
.Lindex_fmt: .string "%2d    "
.Larray_value_fmt: .string "%4d  "
    .text

// array_get_interactive - prompt for an index, print the value there
    .global array_get_interactive
array_get_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x19, =array_count
    ldr     w19, [x19]                      // w19 = count

    cmp     w19, 0
    b.le    array_get_empty

    bl      ansi_clear_screen

    ldr     x0, =prompt_index
    sub     w1, w19, 1                      // highest valid index
    bl      printf

    mov     w0, 0
    sub     w1, w19, 1
    bl      read_int_range
    mov     w20, w0                         // w20 = index

    ldr     x0, =array_data
    ldr     w21, [x0, w20, SXTW 2]          // w21 = value

    mov     w0, 22                          // status line
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =msg_value_at
    mov     w2, w21
    mov     w1, w20
    bl      printf
    bl      print_newline

    b       array_get_done

array_get_empty:
    mov     w0, 22                          // status line
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =array_msg_empty
    bl      printf
    bl      print_newline

array_get_done:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// array_set_interactive - prompt for an index and a new value, store it
    .global array_set_interactive
array_set_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x19, =array_count
    ldr     w19, [x19]                      // w19 = count

    cmp     w19, 0
    b.le    array_set_empty

    bl      ansi_clear_screen

    ldr     x0, =prompt_index
    sub     w1, w19, 1                      // highest valid index
    bl      printf

    mov     w0, 0
    sub     w1, w19, 1
    bl      read_int_range
    mov     w20, w0                         // w20 = index

    ldr     x0, =prompt_new_value
    bl      printf

    bl      read_int
    mov     w21, w0                         // w21 = new value

    ldr     x22, =array_data
    str     w21, [x22, w20, SXTW 2]

    bl      array_display

    mov     w0, 15                          // status line below the box
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =msg_updated
    mov     w1, w20
    mov     w2, w21
    bl      printf
    bl      print_newline

    b       array_set_done

array_set_empty:
    mov     w0, 22                          // status line
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =array_msg_empty
    bl      printf
    bl      print_newline

array_set_done:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// array_swap_interactive - prompt for two indices and swap their values
    .global array_swap_interactive
array_swap_interactive:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    ldr     x19, =array_count
    ldr     w19, [x19]                      // w19 = count

    cmp     w19, 2
    b.lt    array_swap_too_small

    bl      ansi_clear_screen

    ldr     x0, =prompt_index1
    sub     w1, w19, 1                      // highest valid index
    bl      printf

    mov     w0, 0
    sub     w1, w19, 1
    bl      read_int_range
    mov     w20, w0                         // w20 = first index

    ldr     x0, =prompt_index2
    sub     w1, w19, 1
    bl      printf

    mov     w0, 0
    sub     w1, w19, 1
    bl      read_int_range
    mov     w21, w0                         // w21 = second index

    ldr     x22, =array_data

    ldr     w23, [x22, w20, SXTW 2]         // temp = arr[i]
    ldr     w24, [x22, w21, SXTW 2]         // arr[j]
    str     w24, [x22, w20, SXTW 2]         // arr[i] = arr[j]
    str     w23, [x22, w21, SXTW 2]         // arr[j] = temp

    bl      array_display

    mov     w0, 15                          // status line below the box
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =msg_swapped
    mov     w1, w20
    mov     w2, w21
    bl      printf
    bl      print_newline

    b       array_swap_done

array_swap_too_small:
    mov     w0, 22                          // status line
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =.Lswap_err
    bl      printf
    bl      print_newline

array_swap_done:
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

    .data
.Lswap_err: .string "\x1b[33mNeed at least 2 elements to swap!\x1b[0m"
    .text

// array_clear - drop every element and any highlight
    .global array_clear
array_clear:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =array_count
    mov     w1, 0
    str     w1, [x0]

    ldr     x0, =highlight_index
    mov     w1, -1                          // -1 = no highlight
    str     w1, [x0]

    ldp     fp, lr, [sp], 16
    ret
