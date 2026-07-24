// search_viz.asm - linear and binary search animations
// linear search scans left to right with each probe highlighted;
// binary search walks a low/mid/high window on a sorted array

define(fp, x29)
define(lr, x30)

    .data
    .balign 8

// search array storage, separate from the main array
search_array:       .skip 40                // room for 10 ints
search_size:        .word 0                 // elements in use
search_delay:       .word 200               // animation delay in ms
search_target:      .word 0                 // value being searched for

// visualization state, -1 means hidden
current_idx:        .word -1                // index under the probe (yellow)
found_idx:          .word -1                // matching index (green)
checked_up_to:      .word -1                // scanned prefix (gray)
low_idx:            .word -1                // binary search low bound (cyan)
mid_idx:            .word -1                // binary search midpoint (yellow)
high_idx:           .word -1                // binary search high bound (cyan)

// menu strings
search_menu_prompt:        .string "Enter your choice: "
menu_title:         .string "\n╔══════════════════════════════════════════════════╗\n"
menu_title2:        .string "║         SEARCH ALGORITHM VISUALIZER              ║\n"
menu_line:          .string "╠══════════════════════════════════════════════════╣\n"
menu_opt1:          .string "║   [1] Linear Search                              ║\n"
menu_opt2:          .string "║   [2] Binary Search (requires sorted array)      ║\n"
menu_opt3:          .string "║   [3] Display Array                              ║\n"
menu_opt4:          .string "║   [4] Initialize Random Array                    ║\n"
menu_opt5:          .string "║   [5] Sort Array (for Binary Search)             ║\n"
menu_opt0:          .string "║   [0] Back to Main Menu                          ║\n"
menu_bottom:        .string "╚══════════════════════════════════════════════════╝\n"

// input prompts
prompt_target:      .string "Enter target value to search for: "
search_prompt_size:        .string "Enter array size (3-10): "
search_prompt_speed:       .string "Enter animation speed in ms (100-2500): "

// status messages
search_msg_found:          .string "\x1b[32mTarget %d found at index %d!\x1b[0m\n"
search_msg_not_found:      .string "\x1b[31mTarget %d not found in array.\x1b[0m\n"
search_msg_initialized:    .string "\x1b[32mArray initialized with %d random elements.\x1b[0m\n"
search_msg_sorted:         .string "\x1b[32mArray sorted successfully.\x1b[0m\n"
msg_sort_prompt:    .string "\x1b[33mBinary search requires a sorted array. Sort it now? (y/n): \x1b[0m"
msg_sorting:        .string "\x1b[36mSorting array...\x1b[0m\n"
search_msg_empty:          .string "\x1b[31mError: Array is empty. Initialize first.\x1b[0m\n"
msg_press_enter:    .string "\x1b[36mPress Enter to start searching...\x1b[0m"
msg_checking:       .string "Checking index %d..."
search_msg_comparing:      .string "Comparing with mid element..."
msg_eliminating:    .string "Eliminating %s half..."

str_left:           .string "left"
str_right:          .string "right"

// display formatting
display_header:     .string "SEARCH ARRAY VISUALIZATION"
display_index_label: .string "Index:"
display_value_label: .string "Value:"
display_target:     .string "\n  Target: %d\n"
index_fmt:          .string "%3d"
value_fmt:          .string "%3d"

// ansi codes for the cell highlighting
ansi_reset:         .string "\x1b[0m"
ansi_yellow_bg:     .string "\x1b[43m\x1b[30m"      // yellow bg, black text (probe)
ansi_green_bg:      .string "\x1b[42m\x1b[30m"      // green bg, black text (found)
ansi_gray_bg:       .string "\x1b[100m\x1b[37m"     // gray bg, white text (checked)
ansi_cyan_bg:       .string "\x1b[46m\x1b[30m"      // cyan bg, black text (bounds)
ansi_clear:         .string "\x1b[2J"
ansi_home:          .string "\x1b[H"

// printf format strings
search_int_fmt:            .string "%d"
scan_fmt:           .string "%d"
char_fmt:           .string "%c"

    .text
    .balign 4

    .data
.Lclear_line:       .string "\x1b[2K"       // clear the whole line
    .text

// search_menu() - search module menu, loops until back is chosen
    .global search_menu
search_menu:
    define(choice, w19)

    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

search_menu_loop:
    // clear the screen and redraw the menu
    ldr     x0, =ansi_clear
    bl      printf

    ldr     x0, =ansi_home
    bl      printf

    ldr     x0, =menu_title
    bl      printf

    ldr     x0, =menu_title2
    bl      printf

    ldr     x0, =menu_line
    bl      printf

    ldr     x0, =menu_opt1
    bl      printf

    ldr     x0, =menu_opt2
    bl      printf

    ldr     x0, =menu_opt3
    bl      printf

    ldr     x0, =menu_opt4
    bl      printf

    ldr     x0, =menu_opt5
    bl      printf

    ldr     x0, =menu_opt0
    bl      printf

    ldr     x0, =menu_line
    bl      printf

    ldr     x0, =menu_bottom
    bl      printf

    ldr     x0, =search_menu_prompt
    bl      printf

    mov     w0, 0                           // valid choices are 0-5
    mov     w1, 5
    bl      read_int_range
    mov     choice, w0

    cmp     choice, 0
    b.eq    search_menu_exit

    cmp     choice, 1
    b.eq    search_menu_linear

    cmp     choice, 2
    b.eq    search_menu_binary

    cmp     choice, 3
    b.eq    search_menu_display

    cmp     choice, 4
    b.eq    search_menu_init

    cmp     choice, 5
    b.eq    search_menu_sort

    b       search_menu_loop

search_menu_linear:
    bl      search_run_linear
    bl      wait_for_enter
    b       search_menu_loop

search_menu_binary:
    bl      search_run_binary
    bl      wait_for_enter
    b       search_menu_loop

search_menu_display:
    // nothing to show until the array is initialized
    ldr     x0, =search_size
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    search_menu_display_empty

    bl      search_display_array
    bl      wait_for_enter
    b       search_menu_loop

search_menu_display_empty:
    ldr     x0, =ansi_clear
    bl      printf

    mov     w0, 10
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =search_msg_empty
    bl      printf

    bl      wait_for_enter
    b       search_menu_loop

search_menu_init:
    bl      search_initialize_array
    bl      wait_for_enter
    b       search_menu_loop

search_menu_sort:
    bl      search_sort_array
    bl      wait_for_enter
    b       search_menu_loop

search_menu_exit:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

    undefine(`choice')

// search_initialize_array() - fill the array with random values 1-99
search_initialize_array:
    define(size, w19)
    define(counter, w20)
    define(array_ptr, x21)

    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    // ask for the size on the status row
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =search_prompt_size
    bl      printf

    mov     w0, 3                           // size must be 3-10
    mov     w1, 10
    bl      read_int_range
    mov     size, w0

    ldr     x0, =search_size
    str     size, [x0]

    ldr     array_ptr, =search_array

    mov     counter, 0

search_init_loop:
    cmp     counter, size
    b.ge    search_init_done

    bl      rand                            // value = rand() % 99 + 1
    mov     w1, 99
    udiv    w2, w0, w1
    msub    w0, w2, w1, w0
    add     w0, w0, 1

    str     w0, [array_ptr, counter, SXTW 2] // array[i] = value

    add     counter, counter, 1
    b       search_init_loop

search_init_done:
    mov     w0, 22                          // status row
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =search_msg_initialized
    mov     w1, size
    bl      printf

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

    undefine(`size')
    undefine(`counter')
    undefine(`array_ptr')

// search_sort_array() - bubble sort the array ascending
search_sort_array:
    define(size, w19)
    define(outer, w20)
    define(inner, w21)
    define(array_ptr, x22)
    define(temp, w23)

    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    ldr     x0, =search_size
    ldr     size, [x0]

    cmp     size, 0
    b.le    search_sort_empty

    ldr     array_ptr, =search_array

    mov     outer, 0                        // i = 0

search_sort_outer:
    sub     w0, size, 1
    cmp     outer, w0
    b.ge    search_sort_done                // done when i >= n-1

    mov     inner, 0                        // j = 0

search_sort_inner:
    sub     w0, size, outer                 // inner pass ends at n-i-1
    sub     w0, w0, 1
    cmp     inner, w0
    b.ge    search_sort_inner_done

    ldr     w0, [array_ptr, inner, SXTW 2]  // arr[j]
    add     w1, inner, 1
    ldr     w1, [array_ptr, w1, SXTW 2]     // arr[j+1]

    cmp     w0, w1
    b.le    search_sort_no_swap

    mov     temp, w0                        // swap arr[j] and arr[j+1]
    str     w1, [array_ptr, inner, SXTW 2]
    add     w1, inner, 1
    str     temp, [array_ptr, w1, SXTW 2]

search_sort_no_swap:
    add     inner, inner, 1
    b       search_sort_inner

search_sort_inner_done:
    add     outer, outer, 1
    b       search_sort_outer

search_sort_done:
    mov     w0, 22                          // status row
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =search_msg_sorted
    bl      printf

    b       search_sort_exit

search_sort_empty:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =search_msg_empty
    bl      printf

search_sort_exit:
    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

    undefine(`size')
    undefine(`outer')
    undefine(`inner')
    undefine(`array_ptr')
    undefine(`temp')

// search_get_speed() - prompt for the animation delay, store it in search_delay
search_get_speed:
    define(speed, w19)

    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w0, 22                          // prompt on the status row
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =search_prompt_speed
    bl      printf

    mov     w0, 100                         // delay must be 100-2500 ms
    mov     w1, 2500
    bl      read_int_range
    mov     speed, w0

    ldr     x0, =search_delay
    str     speed, [x0]

    // clear the line so the next prompt does not overlap
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Lclear_line
    bl      printf

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

    undefine(`speed')

// search_check_if_sorted() -> w0 = 1 if ascending, 0 if not
search_check_if_sorted:
    define(size, w19)
    define(index, w20)
    define(array_ptr, x21)

    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    ldr     x0, =search_size
    ldr     size, [x0]

    cmp     size, 1                         // 0 or 1 elements count as sorted
    b.le    search_is_sorted

    ldr     array_ptr, =search_array

    mov     index, 0

search_check_loop:
    add     w0, index, 1
    cmp     w0, size
    b.ge    search_is_sorted                // reached the end, no violation

    ldr     w0, [array_ptr, index, SXTW 2]  // arr[i]
    add     w1, index, 1
    ldr     w1, [array_ptr, w1, SXTW 2]     // arr[i+1]

    cmp     w0, w1
    b.gt    search_not_sorted

    add     index, index, 1
    b       search_check_loop

search_is_sorted:
    mov     w0, 1
    b       search_check_done

search_not_sorted:
    mov     w0, 0

search_check_done:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

    undefine(`size')
    undefine(`index')
    undefine(`array_ptr')

// search_run_linear() - animated linear search for a user-entered target
search_run_linear:
    define(size, w19)
    define(target, w20)
    define(index, w21)
    define(array_ptr, x22)
    define(delay, w23)

    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    ldr     x0, =search_size
    ldr     size, [x0]

    cmp     size, 0
    b.le    search_linear_empty

    bl      search_get_speed

    mov     w0, 22                          // target prompt on the status row
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =prompt_target
    bl      printf

    bl      read_int
    mov     target, w0

    ldr     x0, =search_target
    str     target, [x0]

    // reset the visualization state
    ldr     x0, =current_idx
    mov     w1, -1
    str     w1, [x0]

    ldr     x0, =found_idx
    str     w1, [x0]

    ldr     x0, =checked_up_to
    str     w1, [x0]

    // wait for the user to start
    mov     w0, 23
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =msg_press_enter
    bl      printf

    bl      clear_input_buffer
    bl      getchar

    ldr     array_ptr, =search_array

    ldr     x0, =search_delay
    ldr     delay, [x0]

    mov     index, 0

search_linear_loop:
    cmp     index, size
    b.ge    search_linear_not_found

    ldr     x0, =current_idx                // highlight the probe
    str     index, [x0]

    bl      search_display_array

    mov     w0, delay
    bl      delay_ms

    ldr     w0, [array_ptr, index, SXTW 2]  // arr[i]
    cmp     w0, target
    b.eq    search_linear_found

    ldr     x0, =checked_up_to              // extend the gray prefix
    str     index, [x0]

    ldr     x0, =current_idx
    mov     w1, -1
    str     w1, [x0]

    add     index, index, 1
    b       search_linear_loop

search_linear_found:
    ldr     x0, =found_idx
    str     index, [x0]

    ldr     x0, =current_idx
    mov     w1, -1
    str     w1, [x0]

    bl      search_display_array            // final frame

    mov     w0, 22                          // status row
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =search_msg_found
    mov     w1, target
    mov     w2, index
    bl      printf

    b       search_linear_exit

search_linear_not_found:
    ldr     x0, =current_idx
    mov     w1, -1
    str     w1, [x0]

    bl      search_display_array            // final frame

    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =search_msg_not_found
    mov     w1, target
    bl      printf

    b       search_linear_exit

search_linear_empty:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =search_msg_empty
    bl      printf

search_linear_exit:
    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

    undefine(`size')
    undefine(`target')
    undefine(`index')
    undefine(`array_ptr')
    undefine(`delay')

// search_run_binary() - animated binary search, offers to sort first
search_run_binary:
    define(size, w19)
    define(target, w20)
    define(low, w21)
    define(high, w22)
    define(mid, w23)
    define(array_ptr, x24)
    define(delay, w25)

    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    str     x25, [sp, 64]

    ldr     x0, =search_size
    ldr     size, [x0]

    cmp     size, 0
    b.le    search_binary_empty

    bl      search_get_speed

    mov     w0, 22                          // target prompt on the status row
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =prompt_target
    bl      printf

    bl      read_int
    mov     target, w0

    ldr     x0, =search_target
    str     target, [x0]

    ldr     x0, =found_idx
    mov     w1, -1
    str     w1, [x0]

    // clear the probe and gray-prefix markers too, or frames repaint
    // cells a previous linear run scanned
    ldr     x0, =current_idx
    str     w1, [x0]

    ldr     x0, =checked_up_to
    str     w1, [x0]

    // binary search needs sorted input, offer to sort if it is not
    bl      search_check_if_sorted
    cmp     w0, 0
    b.ne    search_binary_array_sorted

    mov     w0, 23
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =msg_sort_prompt
    bl      printf

    // read the y/n answer
    bl      clear_input_buffer
    bl      getchar

    cmp     w0, 'y'
    b.eq    search_binary_do_sort
    cmp     w0, 'Y'
    b.eq    search_binary_do_sort

    // answered no, search the unsorted array anyway
    b       search_binary_continue

search_binary_do_sort:
    mov     w0, 23
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Lclear_line
    bl      printf

    mov     w0, 23
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =msg_sorting
    bl      printf

    bl      search_sort_array

    b       search_binary_continue

search_binary_array_sorted:
    // already sorted, go straight to the start prompt
    mov     w0, 23
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =msg_press_enter
    bl      printf

    bl      clear_input_buffer
    bl      getchar
    b       search_binary_start

search_binary_continue:
    mov     w0, 23
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =.Lclear_line
    bl      printf

    mov     w0, 23
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =msg_press_enter
    bl      printf

    bl      clear_input_buffer
    bl      getchar

search_binary_start:

    ldr     array_ptr, =search_array

    ldr     x0, =search_delay
    ldr     delay, [x0]

    mov     low, 0
    sub     high, size, 1

search_binary_loop:
    cmp     low, high                       // window empty when low > high
    b.gt    search_binary_not_found

    add     mid, low, high                  // mid = (low + high) / 2
    lsr     mid, mid, 1

    // publish the window for the display
    ldr     x0, =low_idx
    str     low, [x0]

    ldr     x0, =mid_idx
    str     mid, [x0]

    ldr     x0, =high_idx
    str     high, [x0]

    bl      search_display_array

    mov     w0, delay
    bl      delay_ms

    ldr     w0, [array_ptr, mid, SXTW 2]    // arr[mid] against target
    cmp     w0, target
    b.eq    search_binary_found
    b.lt    search_binary_go_right

    sub     high, mid, 1                    // arr[mid] > target, drop right half
    b       search_binary_loop

search_binary_go_right:
    add     low, mid, 1                     // arr[mid] < target, drop left half
    b       search_binary_loop

search_binary_found:
    ldr     x0, =found_idx
    str     mid, [x0]

    // hide the window markers
    ldr     x0, =low_idx
    mov     w1, -1
    str     w1, [x0]

    ldr     x0, =mid_idx
    str     w1, [x0]

    ldr     x0, =high_idx
    str     w1, [x0]

    bl      search_display_array            // final frame

    mov     w0, 22                          // status row
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =search_msg_found
    mov     w1, target
    mov     w2, mid
    bl      printf

    b       search_binary_exit

search_binary_not_found:
    // hide the window markers
    ldr     x0, =low_idx
    mov     w1, -1
    str     w1, [x0]

    ldr     x0, =mid_idx
    str     w1, [x0]

    ldr     x0, =high_idx
    str     w1, [x0]

    bl      search_display_array            // final frame

    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =search_msg_not_found
    mov     w1, target
    bl      printf

    b       search_binary_exit

search_binary_empty:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =search_msg_empty
    bl      printf

search_binary_exit:
    ldr     x25, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

    undefine(`size')
    undefine(`target')
    undefine(`low')
    undefine(`high')
    undefine(`mid')
    undefine(`array_ptr')
    undefine(`delay')

// search_display_array() - draw the array as a table with color-coded cells
search_display_array:
    define(size, w19)
    define(counter, w20)
    define(array_ptr, x21)
    define(current, w22)
    define(found, w23)
    define(checked, w24)
    define(low, w25)
    define(mid, w26)
    define(high, w27)
    define(column, w28)

    stp     fp, lr, [sp, -96]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]
    stp     x27, x28, [sp, 80]

    ldr     x0, =ansi_clear
    bl      printf

    ldr     x0, =ansi_home
    bl      printf

    ldr     x0, =search_size
    ldr     size, [x0]

    cmp     size, 0
    b.le    search_display_exit

    ldr     array_ptr, =search_array

    // load the visualization state
    ldr     x0, =current_idx
    ldr     current, [x0]

    ldr     x0, =found_idx
    ldr     found, [x0]

    ldr     x0, =checked_up_to
    ldr     checked, [x0]

    ldr     x0, =low_idx
    ldr     low, [x0]

    ldr     x0, =mid_idx
    ldr     mid, [x0]

    ldr     x0, =high_idx
    ldr     high, [x0]

    mov     w0, 3                           // box at row 3, col 2, 80x10
    mov     w1, 2
    mov     w2, 80
    mov     w3, 10
    mov     w4, 0                           // single-line border
    bl      draw_box

    mov     w0, 4
    mov     w1, 4
    bl      ansi_move_cursor
    ldr     x0, =display_header
    mov     w1, 76                          // centered across the box width
    bl      print_centered

    mov     w0, 6
    mov     w1, 10
    bl      ansi_move_cursor
    ldr     x0, =display_index_label
    bl      printf

    mov     counter, 0
    mov     column, 20                      // first cell column

search_display_indices_loop:
    cmp     counter, size
    b.ge    search_display_values_start

    mov     w0, 6
    mov     w1, column
    bl      ansi_move_cursor

    ldr     x0, =index_fmt
    mov     w1, counter
    bl      printf

    add     column, column, 6               // next cell column
    add     counter, counter, 1
    b       search_display_indices_loop

search_display_values_start:
    mov     w0, 7
    mov     w1, 10
    bl      ansi_move_cursor
    ldr     x0, =display_value_label
    bl      printf

    mov     counter, 0
    mov     column, 20                      // first cell column

search_display_values_loop:
    cmp     counter, size
    b.ge    search_display_footer

    mov     w0, 7
    mov     w1, column
    bl      ansi_move_cursor

    // pick the cell color, priority: found > mid > low/high > current > checked
    cmp     counter, found
    b.eq    search_display_found

    cmp     counter, mid
    b.eq    search_display_mid

    cmp     counter, low
    b.eq    search_display_low_high

    cmp     counter, high
    b.eq    search_display_low_high

    cmp     counter, current
    b.eq    search_display_current

    cmp     counter, checked
    b.le    search_display_checked

    b       search_display_normal

search_display_found:
    mov     w0, 42                          // green background
    bl      ansi_set_color_bg
    b       search_display_value

search_display_mid:
    mov     w0, 43                          // yellow background
    bl      ansi_set_color_bg
    b       search_display_value

search_display_low_high:
    mov     w0, 46                          // cyan background
    bl      ansi_set_color_bg
    b       search_display_value

search_display_current:
    mov     w0, 43                          // yellow background
    bl      ansi_set_color_bg
    b       search_display_value

search_display_checked:
    mov     w0, 100                         // gray background
    bl      ansi_set_color_bg
    b       search_display_value

search_display_normal:
    // no highlight

search_display_value:
    ldr     w1, [array_ptr, counter, SXTW 2]
    ldr     x0, =value_fmt
    bl      printf

    bl      ansi_reset_attributes

    add     column, column, 6               // next cell column
    add     counter, counter, 1
    b       search_display_values_loop

search_display_footer:
    mov     w0, 9
    mov     w1, 10
    bl      ansi_move_cursor

    ldr     x0, =search_target
    ldr     w1, [x0]

    ldr     x0, =display_target
    bl      printf

search_display_exit:
    ldp     x27, x28, [sp, 80]
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96
    ret
