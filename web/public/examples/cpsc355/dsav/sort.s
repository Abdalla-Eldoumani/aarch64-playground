// sort_viz.asm - bubble, selection, insertion, merge, quick sort animations
// repaints the array after every compare and swap, at a user-chosen speed

define(fp, x29)
define(lr, x30)

    .data
    .balign 8

sort_array:         .skip 40                // temporary array for sorting (10 elements)
sort_aux_array:     .skip 40                // auxiliary array for merge sort
sort_size:          .word 0                 // current array size
sort_delay:         .word 500               // animation delay in ms

// highlight indices for visualization
highlight_idx1:     .word -1                // first highlighted index
highlight_idx2:     .word -1                // second highlighted index
sorted_up_to:       .word -1                // elements up to this index are sorted
sorted_from:        .word -1                // elements from this index on are sorted
                                            // (bubble grows its sorted run from the right)

// for merge sort and quick sort
merge_left:         .word -1                // left bound of current merge/partition
merge_right:        .word -1                // right bound of current merge/partition
merge_mid:          .word -1                // middle point for merge

sort_title:         .string "SORTING ALGORITHM VISUALIZATION"
sort_menu_title:    .string "SORTING ALGORITHMS MENU"

sort_menu_opt_1:         .string "[1] Bubble Sort"
sort_menu_opt_2:         .string "[2] Selection Sort"
sort_menu_opt_3:         .string "[3] Insertion Sort"
sort_menu_opt_4:         .string "[4] Merge Sort"
sort_menu_opt_5:         .string "[5] Quick Sort"
sort_menu_opt_6:         .string "[6] Initialize Random Array"
sort_menu_opt_0:         .string "[0] Back to Main Menu"

sort_menu_prompt:        .string "Enter your choice: "
sort_prompt_size:        .string "Enter array size (3-10): "
sort_prompt_speed:       .string "Enter animation speed in ms (100-2500): "
sort_prompt_continue:    .string "\n\x1b[33mPress Enter to start sorting...\x1b[0m"

sort_msg_sorted:         .string "\x1b[32mArray is now sorted!\x1b[0m"
sort_msg_initialized:    .string "\x1b[32mArray initialized with %d random elements.\x1b[0m"
sort_msg_empty:          .string "\x1b[33mPlease initialize array first!\x1b[0m"
sort_msg_comparing:      .string "Comparing: "
msg_swapping:       .string "Swapping: "
msg_sorted_marker:  .string "✓ Sorted"

label_comparisons:  .string "Comparisons: %d"
label_swaps:        .string "Swaps: %d"

    .text
    .balign 4

// sort_menu() - menu loop for the sorting module
    .global sort_menu
sort_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

sort_menu_loop:
    bl      ansi_clear_screen
    bl      display_sort_menu

    mov     w0, 0                            // min
    mov     w1, 6                            // max
    bl      read_int_range

    // dispatch
    cmp     w0, 0
    b.eq    sort_menu_exit

    cmp     w0, 1
    b.eq    sort_menu_bubble

    cmp     w0, 2
    b.eq    sort_menu_selection

    cmp     w0, 3
    b.eq    sort_menu_insertion

    cmp     w0, 4
    b.eq    sort_menu_merge

    cmp     w0, 5
    b.eq    sort_menu_quick

    cmp     w0, 6
    b.eq    sort_menu_initialize

    b       sort_menu_loop

sort_menu_bubble:
    bl      sort_bubble_interactive
    bl      wait_for_enter
    b       sort_menu_loop

sort_menu_selection:
    bl      sort_selection_interactive
    bl      wait_for_enter
    b       sort_menu_loop

sort_menu_insertion:
    bl      sort_insertion_interactive
    bl      wait_for_enter
    b       sort_menu_loop

sort_menu_merge:
    bl      sort_merge_interactive
    bl      wait_for_enter
    b       sort_menu_loop

sort_menu_quick:
    bl      sort_quick_interactive
    bl      wait_for_enter
    b       sort_menu_loop

sort_menu_initialize:
    bl      sort_initialize_array
    bl      wait_for_enter
    b       sort_menu_loop

sort_menu_exit:
    ldp     fp, lr, [sp], 16
    ret

// display_sort_menu() - draw the menu box and options
    .global display_sort_menu
display_sort_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // menu box
    mov     w0, 3                            // row
    mov     w1, 15                           // column
    mov     w2, 50                           // width
    mov     w3, 15                           // height (increased for more options)
    mov     w4, 1                            // double-line style
    bl      draw_box

    // print title
    mov     w0, 4
    mov     w1, 17
    bl      ansi_move_cursor
    ldr     x0, =sort_menu_title
    mov     w1, 46
    bl      print_centered

    // print separator
    mov     w0, 5
    mov     w1, 15
    mov     w2, 50
    mov     w3, 1
    bl      draw_horizontal_border_top

    // print menu options
    mov     w0, 7
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =sort_menu_opt_1
    bl      printf

    mov     w0, 8
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =sort_menu_opt_2
    bl      printf

    mov     w0, 9
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =sort_menu_opt_3
    bl      printf

    mov     w0, 10
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =sort_menu_opt_4
    bl      printf

    mov     w0, 11
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =sort_menu_opt_5
    bl      printf

    mov     w0, 12
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =sort_menu_opt_6
    bl      printf

    mov     w0, 13
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =sort_menu_opt_0
    bl      printf

    // print separator
    mov     w0, 15
    mov     w1, 15
    mov     w2, 50
    mov     w3, 1
    bl      draw_horizontal_border_top

    // position cursor for input
    mov     w0, 16
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =sort_menu_prompt
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// sort_initialize_array() - read a size, fill sort_array with random values
    .global sort_initialize_array
sort_initialize_array:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    bl      ansi_clear_screen

    // prompt for size
    ldr     x0, =sort_prompt_size
    bl      printf

    mov     w0, 3
    mov     w1, 10
    bl      read_int_range
    mov     w19, w0                          // save size

    ldr     x20, =sort_size
    str     w19, [x20]

    // fill array with random values
    ldr     x20, =sort_array
    mov     w21, 0

sort_init_loop:
    cmp     w21, w19
    b.ge    sort_init_done

    mov     w0, 100
    bl      get_random
    str     w0, [x20, w21, SXTW 2]

    add     w21, w21, 1
    b       sort_init_loop

sort_init_done:
    bl      sort_display_array

    // position cursor for message
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =sort_msg_initialized
    mov     w1, w19
    bl      printf
    bl      print_newline

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// sort_display_array() - draw the array, coloring the highlight cells, the
// sorted prefix, and the active merge range
    .global sort_display_array
sort_display_array:
    stp     fp, lr, [sp, -96]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]
    str     x27, [sp, 80]

    ldr     x19, =sort_size
    ldr     w19, [x19]

    ldr     x20, =sort_array

    // highlight indices and the sorted prefix
    ldr     x21, =highlight_idx1
    ldr     w21, [x21]

    ldr     x22, =highlight_idx2
    ldr     w22, [x22]

    ldr     x23, =sorted_up_to
    ldr     w23, [x23]

    ldr     x27, =sorted_from
    ldr     w27, [x27]

    // active merge range for merge/quick visualization
    ldr     x25, =merge_left
    ldr     w25, [x25]

    ldr     x26, =merge_right
    ldr     w26, [x26]

    bl      ansi_clear_screen

    // draw box
    mov     w0, 3
    mov     w1, 2
    mov     w2, 80
    mov     w3, 10
    mov     w4, 0
    bl      draw_box

    // print title
    mov     w0, 4
    mov     w1, 4
    bl      ansi_move_cursor
    ldr     x0, =sort_title
    mov     w1, 76
    bl      print_centered

    // print separator
    mov     w0, 5
    mov     w1, 2
    mov     w2, 80
    mov     w3, 0
    bl      draw_horizontal_border_top

    // print array values
    mov     w0, 8
    mov     w1, 15
    bl      ansi_move_cursor

    mov     w24, 0                           // index counter
sort_display_loop:
    cmp     w24, w19
    b.ge    sort_display_done

    // determine color for this element
    cmp     w24, w21
    b.eq    sort_display_highlight1
    cmp     w24, w22
    b.eq    sort_display_highlight2
    cmp     w24, w23
    b.le    sort_display_sorted

    // sorted suffix marker (bubble sort)
    cmp     w27, 0
    b.lt    sort_display_check_merge
    cmp     w24, w27
    b.ge    sort_display_sorted

sort_display_check_merge:
    // check if in merge range (for merge/quick sort)
    cmp     w25, 0
    b.lt    sort_display_normal              // merge_left < 0, not in merge mode
    cmp     w24, w25
    b.lt    sort_display_normal              // element before merge range
    cmp     w24, w26
    b.gt    sort_display_normal              // element after merge range

    // element is in merge range - highlight with yellow
    mov     w0, 43                           // yellow background
    bl      ansi_set_color_bg
    b       sort_display_print

sort_display_normal:
    // normal color (white)
    bl      ansi_reset_attributes
    b       sort_display_print

sort_display_highlight1:
    mov     w0, 43                           // yellow background
    bl      ansi_set_color_bg
    b       sort_display_print

sort_display_highlight2:
    mov     w0, 46                           // cyan background
    bl      ansi_set_color_bg
    b       sort_display_print

sort_display_sorted:
    mov     w0, 42                           // green background
    bl      ansi_set_color_bg

sort_display_print:
    ldr     w1, [x20, w24, SXTW 2]
    ldr     x0, =.Lsort_value_fmt
    bl      printf

    bl      ansi_reset_attributes

    ldr     x0, =.Lspace
    bl      printf

    add     w24, w24, 1
    b       sort_display_loop

sort_display_done:
    bl      print_newline

    ldr     x27, [sp, 80]
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96
    ret

    .data
.Lsort_value_fmt:    .string "[%3d]"
.Lspace:        .string " "
    .text

// sort_bubble_interactive() - speed prompt, then animated bubble sort
    .global sort_bubble_interactive
sort_bubble_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // check if array is initialized
    ldr     x0, =sort_size
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    sort_bubble_empty

    // get speed from user
    bl      sort_get_speed

    bl      sort_reset_highlights

    bl      sort_display_array

    ldr     x0, =sort_prompt_continue
    bl      printf
    bl      wait_for_enter

    bl      bubble_sort

    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =sort_msg_sorted
    bl      printf
    bl      print_newline

    b       sort_bubble_done

sort_bubble_empty:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =sort_msg_empty
    bl      printf
    bl      print_newline

sort_bubble_done:
    ldp     fp, lr, [sp], 16
    ret

// bubble_sort() - sort sort_array in place, repainting every compare
    .global bubble_sort
bubble_sort:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x19, =sort_size
    ldr     w19, [x19]

    ldr     x20, =sort_array

    // outer loop: i = 0 to n-2
    mov     w21, 0
bubble_outer:
    sub     w0, w19, 1
    cmp     w21, w0
    b.ge    bubble_done

    // inner loop: j = 0 to n-i-2
    mov     w22, 0
bubble_inner:
    sub     w0, w19, w21
    sub     w0, w0, 2
    cmp     w22, w0
    b.gt    bubble_inner_done

    // highlight elements being compared
    ldr     x23, =highlight_idx1
    str     w22, [x23]

    add     w0, w22, 1
    ldr     x23, =highlight_idx2
    str     w0, [x23]

    bl      sort_display_array

    // load values to compare
    ldr     w23, [x20, w22, SXTW 2]          // arr[j]
    add     w0, w22, 1
    ldr     w24, [x20, w0, SXTW 2]           // arr[j+1]

    // delay for visualization
    ldr     x1, =sort_delay
    ldr     w0, [x1]
    bl      delay_ms

    // compare and swap if needed
    cmp     w23, w24
    b.le    bubble_no_swap

    // swap arr[j] and arr[j+1]
    str     w24, [x20, w22, SXTW 2]
    add     w0, w22, 1
    str     w23, [x20, w0, SXTW 2]

    // show swap with different delay
    bl      sort_display_array
    mov     w0, 100
    bl      delay_ms

bubble_no_swap:
    add     w22, w22, 1
    b       bubble_inner

bubble_inner_done:
    // the largest value just bubbled to slot n-i-1: grow the sorted
    // suffix leftward
    sub     w0, w19, w21
    sub     w0, w0, 1
    ldr     x23, =sorted_from
    str     w0, [x23]

    add     w21, w21, 1
    b       bubble_outer

bubble_done:
    bl      sort_reset_highlights

    // final frame: everything sorted
    sub     w0, w19, 1
    ldr     x23, =sorted_up_to
    str     w0, [x23]
    bl      sort_display_array

    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// sort_selection_interactive() - speed prompt, then animated selection sort
    .global sort_selection_interactive
sort_selection_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // check if array is initialized
    ldr     x0, =sort_size
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    sort_selection_empty

    // get speed from user
    bl      sort_get_speed

    bl      sort_reset_highlights
    bl      sort_display_array

    ldr     x0, =sort_prompt_continue
    bl      printf
    bl      wait_for_enter

    bl      selection_sort

    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =sort_msg_sorted
    bl      printf
    bl      print_newline

    b       sort_selection_done

sort_selection_empty:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =sort_msg_empty
    bl      printf
    bl      print_newline

sort_selection_done:
    ldp     fp, lr, [sp], 16
    ret

// selection_sort() - swap the minimum of the unsorted tail to the front
    .global selection_sort
selection_sort:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x19, =sort_size
    ldr     w19, [x19]

    ldr     x20, =sort_array

    // outer loop: i = 0 to n-2
    mov     w21, 0
selection_outer:
    sub     w0, w19, 1
    cmp     w21, w0
    b.ge    selection_done

    // min_idx = i
    mov     w22, w21

    // inner loop: j = i+1 to n-1
    add     w23, w21, 1
selection_inner:
    cmp     w23, w19
    b.ge    selection_inner_done

    // highlight current position and current min
    ldr     x24, =highlight_idx1
    str     w22, [x24]

    ldr     x24, =highlight_idx2
    str     w23, [x24]

    bl      sort_display_array

    ldr     x1, =sort_delay
    ldr     w0, [x1]
    bl      delay_ms

    // compare arr[j] < arr[min_idx]
    ldr     w0, [x20, w23, SXTW 2]
    ldr     w1, [x20, w22, SXTW 2]
    cmp     w0, w1
    b.ge    selection_no_update

    // update min_idx
    mov     w22, w23

selection_no_update:
    add     w23, w23, 1
    b       selection_inner

selection_inner_done:
    // swap arr[i] and arr[min_idx] if different
    cmp     w21, w22
    b.eq    selection_no_swap

    ldr     w0, [x20, w21, SXTW 2]
    ldr     w1, [x20, w22, SXTW 2]
    str     w1, [x20, w21, SXTW 2]
    str     w0, [x20, w22, SXTW 2]

    bl      sort_display_array
    mov     w0, 100
    bl      delay_ms

selection_no_swap:
    // mark element as sorted
    ldr     x23, =sorted_up_to
    str     w21, [x23]

    add     w21, w21, 1
    b       selection_outer

selection_done:
    sub     w0, w19, 1
    ldr     x23, =sorted_up_to
    str     w0, [x23]

    bl      sort_reset_highlights
    bl      sort_display_array

    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// sort_insertion_interactive() - speed prompt, then animated insertion sort
    .global sort_insertion_interactive
sort_insertion_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // check if array is initialized
    ldr     x0, =sort_size
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    sort_insertion_empty

    // get speed from user
    bl      sort_get_speed

    bl      sort_reset_highlights
    bl      sort_display_array

    ldr     x0, =sort_prompt_continue
    bl      printf
    bl      wait_for_enter

    bl      insertion_sort

    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =sort_msg_sorted
    bl      printf
    bl      print_newline

    b       sort_insertion_done

sort_insertion_empty:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =sort_msg_empty
    bl      printf
    bl      print_newline

sort_insertion_done:
    ldp     fp, lr, [sp], 16
    ret

// insertion_sort() - shift each key left into the sorted prefix
    .global insertion_sort
insertion_sort:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x19, =sort_size
    ldr     w19, [x19]

    ldr     x20, =sort_array

    // first element is already sorted
    mov     w0, 0
    ldr     x21, =sorted_up_to
    str     w0, [x21]

    // loop: i = 1 to n-1
    mov     w21, 1
insertion_outer:
    cmp     w21, w19
    b.ge    insertion_done

    // key = arr[i]
    ldr     w22, [x20, w21, SXTW 2]

    // j = i - 1
    sub     w23, w21, 1

insertion_inner:
    cmp     w23, 0
    b.lt    insertion_inner_done

    // highlight element being compared and the key position
    ldr     x24, =highlight_idx1
    str     w23, [x24]                   // element to compare

    ldr     x24, =highlight_idx2
    add     w0, w23, 1
    str     w0, [x24]                    // key position

    // display before comparison
    bl      sort_display_array

    // delay to show comparison
    ldr     x1, =sort_delay
    ldr     w0, [x1]
    bl      delay_ms

    // check if arr[j] > key
    ldr     w0, [x20, w23, SXTW 2]
    cmp     w0, w22
    b.le    insertion_inner_done

    // shift arr[j] to arr[j+1]
    add     w1, w23, 1
    str     w0, [x20, w1, SXTW 2]

    // display after shift to show movement
    bl      sort_display_array

    // shorter delay for shift
    ldr     x1, =sort_delay
    ldr     w0, [x1]
    lsr     w0, w0, 1                    // half delay for shift
    bl      delay_ms

    sub     w23, w23, 1
    b       insertion_inner

insertion_inner_done:
    // place key at arr[j+1]
    add     w0, w23, 1
    str     w22, [x20, w0, SXTW 2]

    // mark up to current as sorted
    ldr     x23, =sorted_up_to
    str     w21, [x23]

    add     w21, w21, 1
    b       insertion_outer

insertion_done:
    sub     w0, w19, 1
    ldr     x23, =sorted_up_to
    str     w0, [x23]

    bl      sort_reset_highlights
    bl      sort_display_array

    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// sort_get_speed() - read the animation delay (100-2500 ms) into sort_delay
    .global sort_get_speed
sort_get_speed:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    // position cursor for prompt
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =sort_prompt_speed
    bl      printf

    mov     w0, 100                          // min
    mov     w1, 2500                         // max
    bl      read_int_range
    mov     w19, w0                          // save speed

    ldr     x0, =sort_delay
    str     w19, [x0]

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// sort_reset_highlights() - clear every highlight and range index
    .global sort_reset_highlights
sort_reset_highlights:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, -1

    ldr     x1, =highlight_idx1
    str     w0, [x1]

    ldr     x1, =highlight_idx2
    str     w0, [x1]

    ldr     x1, =sorted_up_to
    str     w0, [x1]

    ldr     x1, =sorted_from
    str     w0, [x1]

    ldr     x1, =merge_left
    str     w0, [x1]

    ldr     x1, =merge_right
    str     w0, [x1]

    ldr     x1, =merge_mid
    str     w0, [x1]

    ldp     fp, lr, [sp], 16
    ret

// sort_merge_interactive() - speed prompt, then animated merge sort
    .global sort_merge_interactive
sort_merge_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // check if array is initialized
    ldr     x0, =sort_size
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    merge_empty

    // get speed from user
    bl      sort_get_speed

    bl      ansi_clear_screen
    bl      sort_reset_highlights
    bl      sort_display_array

    // position cursor for message
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =sort_prompt_continue
    bl      printf

    bl      wait_for_enter

    bl      sort_merge_sort

    // display final sorted array
    bl      sort_reset_highlights
    ldr     x0, =sort_size
    ldr     w0, [x0]
    sub     w0, w0, 1
    ldr     x1, =sorted_up_to
    str     w0, [x1]
    bl      sort_display_array

    // position cursor for message
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =sort_msg_sorted
    bl      printf
    bl      print_newline

    b       merge_done

merge_empty:
    bl      ansi_clear_screen
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =sort_msg_empty
    bl      printf
    bl      print_newline

merge_done:
    ldp     fp, lr, [sp], 16
    ret

// sort_merge_sort() - bottom-up merge sort, doubling the run width each pass
sort_merge_sort:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    ldr     x0, =sort_size
    ldr     w19, [x0]                    // w19 = size

    ldr     x22, =sort_array             // x22 = array_ptr

    // start with merge size of 1, double each iteration
    mov     w20, 1                       // w20 = curr_size

merge_outer_loop:
    cmp     w20, w19
    b.ge    merge_sort_done

    // start from leftmost subarray
    mov     w21, 0                       // w21 = left_start

merge_inner_loop:
    cmp     w21, w19
    b.ge    merge_next_size

    // calculate mid and right_end
    add     w23, w21, w20                // w23 = mid
    sub     w23, w23, 1

    // calculate right_end = min(left_start + 2*curr_size - 1, size - 1)
    lsl     w0, w20, 1
    add     w24, w21, w0                 // w24 = right_end
    sub     w24, w24, 1
    sub     w0, w19, 1
    cmp     w24, w0
    csel    w24, w24, w0, lt

    // only merge if mid < right_end
    cmp     w23, w24
    b.ge    merge_skip

    // set merge bounds for visualization
    ldr     x0, =merge_left
    str     w21, [x0]

    ldr     x0, =merge_right
    str     w24, [x0]

    ldr     x0, =merge_mid
    str     w23, [x0]

    // perform merge
    mov     w0, w21
    mov     w1, w23
    mov     w2, w24
    bl      sort_merge_arrays

    // clear highlights after merge completes
    bl      sort_reset_highlights

    // brief pause between merge operations
    ldr     x0, =sort_delay
    ldr     w0, [x0]
    lsr     w0, w0, 1                    // half delay between merges
    bl      delay_ms

merge_skip:
    // move to next pair of subarrays
    lsl     w0, w20, 1
    add     w21, w21, w0
    b       merge_inner_loop

merge_next_size:
    // double the merge size
    lsl     w20, w20, 1
    b       merge_outer_loop

merge_sort_done:
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// sort_merge_arrays(w0 = left, w1 = mid, w2 = right)
// merge two sorted runs through sort_aux_array
sort_merge_arrays:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]

    mov     w19, w0                      // w19 = left
    mov     w20, w1                      // w20 = mid
    mov     w21, w2                      // w21 = right

    ldr     x25, =sort_array             // x25 = array_ptr
    ldr     x26, =sort_aux_array         // x26 = aux_ptr

    // copy to auxiliary array
    mov     w22, w19                     // w22 = i = left
merge_copy_loop:
    cmp     w22, w21                     // compare i with right
    b.gt    merge_copy_done
    ldr     w0, [x25, w22, SXTW 2]       // load array[i]
    str     w0, [x26, w22, SXTW 2]       // store to aux[i]
    add     w22, w22, 1                  // i++
    b       merge_copy_loop

merge_copy_done:
    // merge back to original array
    mov     w22, w19                     // w22 = i = left (left subarray index)
    add     w23, w20, 1                  // w23 = j = mid + 1 (right subarray index)
    mov     w24, w19                     // w24 = k = left (merged array index)

merge_compare_loop:
    cmp     w22, w20                     // compare i with mid
    b.gt    merge_copy_right
    cmp     w23, w21                     // compare j with right
    b.gt    merge_copy_left

    // highlight the two elements being compared during merge
    // highlight_idx1 = i (from left subarray)
    // highlight_idx2 = j (from right subarray)
    ldr     x0, =highlight_idx1
    str     w22, [x0]

    ldr     x0, =highlight_idx2
    str     w23, [x0]

    // repaint to show the pair being compared
    bl      sort_display_array

    // delay to show comparison
    ldr     x0, =sort_delay
    ldr     w0, [x0]
    bl      delay_ms

    // compare aux[i] and aux[j]
    ldr     w0, [x26, w22, SXTW 2]       // load aux[i]
    ldr     w1, [x26, w23, SXTW 2]       // load aux[j]
    cmp     w0, w1
    b.le    merge_take_left

merge_take_right:
    str     w1, [x25, w24, SXTW 2]       // store aux[j] to array[k]
    add     w23, w23, 1                  // j++
    add     w24, w24, 1                  // k++

    // clear highlights and show element placed
    ldr     x0, =highlight_idx1
    mov     w1, -1
    str     w1, [x0]

    ldr     x0, =highlight_idx2
    str     w1, [x0]

    bl      sort_display_array

    ldr     x0, =sort_delay
    ldr     w0, [x0]
    lsr     w0, w0, 1                    // half delay for placement
    bl      delay_ms

    b       merge_compare_loop

merge_take_left:
    str     w0, [x25, w24, SXTW 2]       // store aux[i] to array[k]
    add     w22, w22, 1                  // i++
    add     w24, w24, 1                  // k++

    // clear highlights and show element placed
    ldr     x0, =highlight_idx1
    mov     w1, -1
    str     w1, [x0]

    ldr     x0, =highlight_idx2
    str     w1, [x0]

    bl      sort_display_array

    ldr     x0, =sort_delay
    ldr     w0, [x0]
    lsr     w0, w0, 1                    // half delay for placement
    bl      delay_ms

    b       merge_compare_loop

merge_copy_left:
    cmp     w22, w20                     // compare i with mid
    b.gt    merge_complete

    // highlight remaining element being copied
    ldr     x0, =highlight_idx1
    str     w22, [x0]

    ldr     w0, [x26, w22, SXTW 2]       // load aux[i]
    str     w0, [x25, w24, SXTW 2]       // store to array[k]

    bl      sort_display_array

    ldr     x0, =sort_delay
    ldr     w0, [x0]
    lsr     w0, w0, 1                    // half delay
    bl      delay_ms

    add     w22, w22, 1                  // i++
    add     w24, w24, 1                  // k++
    b       merge_copy_left

merge_copy_right:
    cmp     w23, w21                     // compare j with right
    b.gt    merge_complete

    // highlight remaining element being copied
    ldr     x0, =highlight_idx2
    str     w23, [x0]

    ldr     w0, [x26, w23, SXTW 2]       // load aux[j]
    str     w0, [x25, w24, SXTW 2]       // store to array[k]

    bl      sort_display_array

    ldr     x0, =sort_delay
    ldr     w0, [x0]
    lsr     w0, w0, 1                    // half delay
    bl      delay_ms

    add     w23, w23, 1                  // j++
    add     w24, w24, 1                  // k++
    b       merge_copy_right

merge_complete:
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// sort_quick_interactive() - speed prompt, then animated quick sort
    .global sort_quick_interactive
sort_quick_interactive:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // check if array is initialized
    ldr     x0, =sort_size
    ldr     w0, [x0]
    cmp     w0, 0
    b.le    quick_empty

    // get speed from user
    bl      sort_get_speed

    bl      ansi_clear_screen
    bl      sort_reset_highlights
    bl      sort_display_array

    // position cursor for message
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =sort_prompt_continue
    bl      printf

    bl      wait_for_enter

    // sort the full range
    mov     w0, 0
    ldr     x1, =sort_size
    ldr     w1, [x1]
    sub     w1, w1, 1
    bl      sort_quick_sort

    // display final sorted array
    bl      sort_reset_highlights
    ldr     x0, =sort_size
    ldr     w0, [x0]
    sub     w0, w0, 1
    ldr     x1, =sorted_up_to
    str     w0, [x1]
    bl      sort_display_array

    // position cursor for message
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =sort_msg_sorted
    bl      printf
    bl      print_newline

    b       quick_done

quick_empty:
    bl      ansi_clear_screen
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =sort_msg_empty
    bl      printf
    bl      print_newline

quick_done:
    ldp     fp, lr, [sp], 16
    ret

// sort_quick_sort(w0 = low, w1 = high) - recursive quick sort
sort_quick_sort:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    mov     w19, w0                      // w19 = low
    mov     w20, w1                      // w20 = high

    // base case: if low >= high, return
    cmp     w19, w20
    b.ge    quick_sort_done

    // partition array and get pivot index
    mov     w0, w19                      // pass low
    mov     w1, w20                      // pass high
    bl      sort_quick_partition
    mov     w21, w0                      // w21 = pivot index

    // recursively sort left partition
    mov     w0, w19                      // pass low
    sub     w1, w21, 1                   // pass pivot - 1
    bl      sort_quick_sort

    // recursively sort right partition
    add     w0, w21, 1                   // pass pivot + 1
    mov     w1, w20                      // pass high
    bl      sort_quick_sort

quick_sort_done:
    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// sort_quick_partition(w0 = low, w1 = high) -> w0 = pivot index
// last element is the pivot
sort_quick_partition:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]
    str     x24, [sp, 56]

    mov     w19, w0                      // w19 = low
    mov     w20, w1                      // w20 = high

    ldr     x24, =sort_array             // x24 = array_ptr

    // choose last element as pivot
    ldr     w21, [x24, w20, SXTW 2]      // w21 = pivot_val = array[high]

    // highlight pivot
    ldr     x0, =highlight_idx1
    str     w20, [x0]                    // store high as highlight

    bl      sort_display_array

    sub     w22, w19, 1                  // w22 = i = low - 1

    mov     w23, w19                     // w23 = j = low

partition_loop:
    cmp     w23, w20                     // compare j with high
    b.ge    partition_done

    // highlight current element being compared
    ldr     x0, =highlight_idx2
    str     w23, [x0]                    // store j as highlight

    // repaint before the compare
    bl      sort_display_array

    // delay to show comparison
    ldr     x0, =sort_delay
    ldr     w0, [x0]
    bl      delay_ms

    // compare arr[j] with pivot
    ldr     w0, [x24, w23, SXTW 2]       // load array[j]
    cmp     w0, w21                      // compare with pivot_val
    b.gt    partition_no_swap

    add     w22, w22, 1                  // i++

    // swap arr[i] and arr[j]
    ldr     w0, [x24, w22, SXTW 2]       // load array[i]
    ldr     w1, [x24, w23, SXTW 2]       // load array[j]
    str     w1, [x24, w22, SXTW 2]       // store array[j] to array[i]
    str     w0, [x24, w23, SXTW 2]       // store array[i] to array[j]

    // display after swap
    bl      sort_display_array

    // delay after swap
    ldr     x0, =sort_delay
    ldr     w0, [x0]
    bl      delay_ms

partition_no_swap:
    add     w23, w23, 1                  // j++
    b       partition_loop

partition_done:
    // swap arr[i+1] with arr[high] (pivot)
    add     w22, w22, 1                  // i++
    ldr     w0, [x24, w22, SXTW 2]       // load array[i]
    ldr     w1, [x24, w20, SXTW 2]       // load array[high]
    str     w1, [x24, w22, SXTW 2]       // store array[high] to array[i]
    str     w0, [x24, w20, SXTW 2]       // store array[i] to array[high]

    // display final pivot position
    ldr     x0, =highlight_idx2
    mov     w1, -1
    str     w1, [x0]
    bl      sort_display_array

    ldr     x0, =sort_delay
    ldr     w0, [x0]
    bl      delay_ms

    mov     w0, w22                      // return i

    ldr     x24, [sp, 56]
    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret
