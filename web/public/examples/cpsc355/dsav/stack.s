// stack_viz.asm - stack visualizer: push, pop, peek, vertical display
// stack_get_data / stack_get_top expose the state to the C side

define(fp, x29)
define(lr, x30)

    .data
    .balign 8

stack_max_size = 8
stack_data:     .skip stack_max_size * 4    // 8 slots of 4 bytes
stack_top:      .word -1                    // top index, -1 = empty

stack_title:        .string "STACK VISUALIZATION (LIFO)"
stack_menu_title:   .string "STACK OPERATIONS MENU"

stack_menu_opt_1:         .string "[1] Push Value"
stack_menu_opt_2:         .string "[2] Pop Value"
stack_menu_opt_3:         .string "[3] Peek Top"
stack_menu_opt_4:         .string "[4] Display Stack"
stack_menu_opt_5:         .string "[5] Clear Stack"
stack_menu_opt_0:         .string "[0] Back to Main Menu"

stack_menu_prompt:        .string "Enter your choice: "
stack_prompt_value:       .string "Enter value to push: "

stack_msg_empty:          .string "\x1b[33mStack is empty!\x1b[0m"
stack_msg_full:           .string "\x1b[31mStack Overflow! Cannot push.\x1b[0m"
msg_pushed:         .string "\x1b[32mPushed %d onto stack.\x1b[0m"
msg_popped:         .string "\x1b[32mPopped %d from stack.\x1b[0m"
stack_msg_peek:           .string "Top element: \x1b[36m%d\x1b[0m"
stack_msg_cleared:        .string "\x1b[32mStack cleared.\x1b[0m"

label_top:          .string "TOP"
label_bottom:       .string "BOTTOM"
stack_label_size:         .string "Size: %d/%d"

    .text
    .balign 4

// stack_menu() - stack operations menu loop; choice 0 returns to main
    .global stack_menu
stack_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

stack_menu_loop:
    bl      ansi_clear_screen
    bl      display_stack_menu

    mov     w0, 0                            // min
    mov     w1, 5                            // max
    bl      read_int_range

    cmp     w0, 0
    b.eq    stack_menu_exit

    cmp     w0, 1
    b.eq    stack_menu_push

    cmp     w0, 2
    b.eq    stack_menu_pop

    cmp     w0, 3
    b.eq    stack_menu_peek

    cmp     w0, 4
    b.eq    stack_menu_display

    cmp     w0, 5
    b.eq    stack_menu_clear

    b       stack_menu_loop

stack_menu_push:
    bl      stack_push_interactive
    bl      wait_for_enter
    b       stack_menu_loop

stack_menu_pop:
    bl      stack_pop_interactive
    bl      wait_for_enter
    b       stack_menu_loop

stack_menu_peek:
    bl      stack_peek_interactive
    bl      wait_for_enter
    b       stack_menu_loop

stack_menu_display:
    bl      stack_display
    bl      wait_for_enter
    b       stack_menu_loop

stack_menu_clear:
    bl      stack_clear

    mov     w0, 22                           // status row
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =stack_msg_cleared
    bl      printf
    bl      print_newline
    bl      wait_for_enter
    b       stack_menu_loop

stack_menu_exit:
    ldp     fp, lr, [sp], 16
    ret

// display_stack_menu() - draw the menu box and its options
    .global display_stack_menu
display_stack_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, 3                            // row
    mov     w1, 15                           // column
    mov     w2, 50                           // width
    mov     w3, 14                           // height
    mov     w4, 1                            // double-line style
    bl      draw_box

    mov     w0, 4
    mov     w1, 17
    bl      ansi_move_cursor
    ldr     x0, =stack_menu_title
    mov     w1, 46
    bl      print_centered

    // separator under the title
    mov     w0, 5
    mov     w1, 15
    mov     w2, 50
    mov     w3, 1
    bl      draw_horizontal_border_top

    mov     w0, 7
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =stack_menu_opt_1
    bl      printf

    mov     w0, 8
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =stack_menu_opt_2
    bl      printf

    mov     w0, 9
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =stack_menu_opt_3
    bl      printf

    mov     w0, 10
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =stack_menu_opt_4
    bl      printf

    mov     w0, 11
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =stack_menu_opt_5
    bl      printf

    mov     w0, 12
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =stack_menu_opt_0
    bl      printf

    // separator above the prompt
    mov     w0, 14
    mov     w1, 15
    mov     w2, 50
    mov     w3, 1
    bl      draw_horizontal_border_top

    mov     w0, 15
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =stack_menu_prompt
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// stack_push_interactive() - prompt for a value, push it, show the result
    .global stack_push_interactive
stack_push_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      ansi_clear_screen

    // full check before prompting
    ldr     x19, =stack_top
    ldr     w19, [x19]
    cmp     w19, stack_max_size - 1
    b.ge    stack_push_overflow

    ldr     x0, =stack_prompt_value
    bl      printf

    bl      read_int
    mov     w19, w0                          // w19 = value to push

    mov     w0, w19
    bl      stack_push

    bl      stack_display

    mov     w0, 22                           // status row
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =msg_pushed
    mov     w1, w19
    bl      printf
    bl      print_newline

    b       stack_push_done

stack_push_overflow:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =stack_msg_full
    bl      printf
    bl      print_newline

stack_push_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// stack_pop_interactive() - pop the top value and show the result
    .global stack_pop_interactive
stack_pop_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      ansi_clear_screen

    bl      stack_is_empty
    cmp     w0, 1
    b.eq    stack_pop_underflow

    bl      stack_pop
    mov     w19, w0                          // w19 = popped value

    bl      stack_display

    mov     w0, 22                           // status row
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =msg_popped
    mov     w1, w19
    bl      printf
    bl      print_newline

    b       stack_pop_done

stack_pop_underflow:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =stack_msg_empty
    bl      printf
    bl      print_newline

stack_pop_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// stack_peek_interactive() - show the top value without removing it
    .global stack_peek_interactive
stack_peek_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      ansi_clear_screen

    bl      stack_is_empty
    cmp     w0, 1
    b.eq    stack_peek_empty

    bl      stack_peek
    mov     w19, w0                          // w19 = top value

    bl      stack_display

    mov     w0, 22                           // status row
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =stack_msg_peek
    mov     w1, w19
    bl      printf
    bl      print_newline

    b       stack_peek_done

stack_peek_empty:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =stack_msg_empty
    bl      printf
    bl      print_newline

stack_peek_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// stack_push(w0 = value) -> w0 = 1 on success, 0 on overflow
    .global stack_push
stack_push:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     w19, w0                          // w19 = value

    ldr     x20, =stack_top
    ldr     w21, [x20]                       // w21 = top index

    cmp     w21, stack_max_size - 1
    b.ge    stack_push_fail

    add     w21, w21, 1
    str     w21, [x20]

    ldr     x20, =stack_data
    str     w19, [x20, w21, SXTW 2]

    mov     w0, 1
    b       stack_push_ret

stack_push_fail:
    mov     w0, 0

stack_push_ret:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// stack_pop() -> w0 = popped value, 0 if empty
    .global stack_pop
stack_pop:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x19, =stack_top
    ldr     w20, [x19]                       // w20 = top index

    cmp     w20, 0
    b.lt    stack_pop_fail

    ldr     x21, =stack_data
    ldr     w0, [x21, w20, SXTW 2]

    sub     w20, w20, 1
    str     w20, [x19]

    b       stack_pop_ret

stack_pop_fail:
    mov     w0, 0

stack_pop_ret:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// stack_peek() -> w0 = top value, 0 if empty
    .global stack_peek
stack_peek:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x19, =stack_top
    ldr     w20, [x19]                       // w20 = top index

    cmp     w20, 0
    b.lt    stack_peek_fail

    // read without removing
    ldr     x21, =stack_data
    ldr     w0, [x21, w20, SXTW 2]

    b       stack_peek_ret

stack_peek_fail:
    mov     w0, 0

stack_peek_ret:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// stack_display() - draw the stack top-down, one boxed cell per element
    .global stack_display
stack_display:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    bl      ansi_clear_screen

    ldr     x19, =stack_top
    ldr     w19, [x19]                       // w19 = top index

    cmp     w19, 0
    b.lt    stack_display_empty

    mov     w0, 3                            // row
    mov     w1, 20                           // column
    mov     w2, 40                           // width
    mov     w3, 29                           // height
    mov     w4, 0                            // single-line style
    bl      draw_box

    mov     w0, 4
    mov     w1, 22
    bl      ansi_move_cursor
    ldr     x0, =stack_title
    mov     w1, 36
    bl      print_centered

    // separator under the title
    mov     w0, 5
    mov     w1, 20
    mov     w2, 40
    mov     w3, 0
    bl      draw_horizontal_border_top

    // walk from the top index down to slot 0
    ldr     x20, =stack_data

    mov     w21, w19                         // w21 = current index
    mov     w22, 7                           // w22 = screen row

stack_display_loop:
    cmp     w21, 0
    b.lt    stack_display_footer

    mov     w0, w22
    mov     w1, 28
    bl      ansi_move_cursor

    ldr     x0, =.Lbox_top
    bl      printf

    // next row: the value
    add     w22, w22, 1
    mov     w0, w22
    mov     w1, 28
    bl      ansi_move_cursor

    ldr     x0, =.Lbox_mid
    ldr     w1, [x20, w21, SXTW 2]
    bl      printf

    // arrow marks the top element
    cmp     w21, w19
    b.ne    stack_display_no_top_label
    ldr     x0, =.Ltop_arrow
    bl      printf

stack_display_no_top_label:
    // next row: the cell bottom
    add     w22, w22, 1
    mov     w0, w22
    mov     w1, 28
    bl      ansi_move_cursor

    ldr     x0, =.Lbox_bot
    bl      printf

    add     w22, w22, 1
    sub     w21, w21, 1
    b       stack_display_loop

stack_display_footer:
    add     w22, w22, 1
    mov     w0, w22
    mov     w1, 30
    bl      ansi_move_cursor
    ldr     x0, =.Lbottom_label
    bl      printf

    mov     w0, 30
    mov     w1, 25
    bl      ansi_move_cursor
    ldr     x0, =stack_label_size
    add     w1, w19, 1                       // size = top + 1
    mov     w2, stack_max_size
    bl      printf

    bl      print_newline
    b       stack_display_done

stack_display_empty:
    mov     w0, 10
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =stack_msg_empty
    bl      printf
    bl      print_newline

stack_display_done:
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

    .data
.Lbox_top:      .string "┌───────────┐"
.Lbox_mid:      .string "│   %4d    │"
.Lbox_bot:      .string "└───────────┘"
.Ltop_arrow:    .string " <- TOP"
.Lbottom_label: .string "[BOTTOM]"
    .text

// stack_is_empty() -> w0 = 1 if empty, 0 otherwise
    .global stack_is_empty
stack_is_empty:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =stack_top
    ldr     w0, [x0]

    cmp     w0, 0
    b.lt    stack_empty_yes
    mov     w0, 0
    b       stack_empty_ret

stack_empty_yes:
    mov     w0, 1

stack_empty_ret:
    ldp     fp, lr, [sp], 16
    ret

// stack_is_full() -> w0 = 1 if full, 0 otherwise
    .global stack_is_full
stack_is_full:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =stack_top
    ldr     w0, [x0]

    cmp     w0, stack_max_size - 1
    b.ge    stack_full_yes
    mov     w0, 0
    b       stack_full_ret

stack_full_yes:
    mov     w0, 1

stack_full_ret:
    ldp     fp, lr, [sp], 16
    ret

// stack_clear() - reset the stack to empty
    .global stack_clear
stack_clear:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =stack_top
    mov     w1, -1
    str     w1, [x0]

    ldp     fp, lr, [sp], 16
    ret

// accessors for the C-linked build: read stack state without touching it

// stack_get_data() -> x0 = address of the stack array
    .global stack_get_data
stack_get_data:
    ldr     x0, =stack_data
    ret

// stack_get_top() -> w0 = top index, -1 if empty
    .global stack_get_top
stack_get_top:
    ldr     x0, =stack_top
    ldr     w0, [x0]
    ret

// stack_get_capacity() -> w0 = capacity
    .global stack_get_capacity
stack_get_capacity:
    mov     w0, stack_max_size
    ret
