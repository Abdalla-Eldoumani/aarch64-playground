// queue_viz.asm - circular queue visualizer: enqueue, dequeue, peek,
// display, and clear, plus accessors read by the C++ build

define(fp, x29)
define(lr, x30)

    .data
    .balign 8

queue_max_size = 8
queue_data:     .skip queue_max_size * 4    // circular buffer, 8 ints
queue_front:    .word 0                     // front index
queue_rear:     .word -1                    // rear index (-1 = empty)
queue_count:    .word 0                     // element count

queue_title:        .string "QUEUE VISUALIZATION (FIFO)"
queue_menu_title:   .string "QUEUE OPERATIONS MENU"

queue_menu_opt_1:         .string "[1] Enqueue Value"
queue_menu_opt_2:         .string "[2] Dequeue Value"
queue_menu_opt_3:         .string "[3] Peek Front"
queue_menu_opt_4:         .string "[4] Display Queue"
queue_menu_opt_5:         .string "[5] Clear Queue"
queue_menu_opt_0:         .string "[0] Back to Main Menu"

queue_menu_prompt:        .string "Enter your choice: "
queue_prompt_value:       .string "Enter value to enqueue: "

queue_msg_empty:          .string "\x1b[33mQueue is empty!\x1b[0m"
queue_msg_full:           .string "\x1b[31mQueue Overflow! Cannot enqueue.\x1b[0m"
msg_enqueued:       .string "\x1b[32mEnqueued %d to queue.\x1b[0m"
msg_dequeued:       .string "\x1b[32mDequeued %d from queue.\x1b[0m"
queue_msg_peek:           .string "Front element: \x1b[36m%d\x1b[0m"
queue_msg_cleared:        .string "\x1b[32mQueue cleared.\x1b[0m"

label_front:        .string "FRONT"
label_rear:         .string "REAR"
label_count:        .string "Count: %d/%d"

    .text
    .balign 4

// queue_menu() - queue module loop: dispatch choices until 0
    .global queue_menu
queue_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

queue_menu_loop:
    bl      ansi_clear_screen
    bl      display_queue_menu

    mov     w0, 0                           // min choice
    mov     w1, 5                           // max choice
    bl      read_int_range

    // dispatch on choice
    cmp     w0, 0
    b.eq    queue_menu_exit
    cmp     w0, 1
    b.eq    queue_menu_enqueue
    cmp     w0, 2
    b.eq    queue_menu_dequeue
    cmp     w0, 3
    b.eq    queue_menu_peek
    cmp     w0, 4
    b.eq    queue_menu_display
    cmp     w0, 5
    b.eq    queue_menu_clear
    b       queue_menu_loop

queue_menu_enqueue:
    bl      queue_enqueue_interactive
    bl      wait_for_enter
    b       queue_menu_loop

queue_menu_dequeue:
    bl      queue_dequeue_interactive
    bl      wait_for_enter
    b       queue_menu_loop

queue_menu_peek:
    bl      queue_peek_interactive
    bl      wait_for_enter
    b       queue_menu_loop

queue_menu_display:
    bl      queue_display
    bl      wait_for_enter
    b       queue_menu_loop

queue_menu_clear:
    bl      queue_clear

    mov     w0, 22                          // status row
    mov     w1, 1
    bl      ansi_move_cursor
    ldr     x0, =queue_msg_cleared
    bl      printf
    bl      print_newline
    bl      wait_for_enter
    b       queue_menu_loop

queue_menu_exit:
    ldp     fp, lr, [sp], 16
    ret

// display_queue_menu() - draw the menu box, options, and prompt
    .global display_queue_menu
display_queue_menu:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // menu box
    mov     w0, 3                           // row
    mov     w1, 15                          // column
    mov     w2, 50                          // width
    mov     w3, 14                          // height
    mov     w4, 1                           // double-line style
    bl      draw_box

    // title
    mov     w0, 4
    mov     w1, 17
    bl      ansi_move_cursor
    ldr     x0, =queue_menu_title
    mov     w1, 46
    bl      print_centered

    // separator under the title
    mov     w0, 5
    mov     w1, 15
    mov     w2, 50
    mov     w3, 1
    bl      draw_horizontal_border_top

    // options
    mov     w0, 7
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =queue_menu_opt_1
    bl      printf

    mov     w0, 8
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =queue_menu_opt_2
    bl      printf

    mov     w0, 9
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =queue_menu_opt_3
    bl      printf

    mov     w0, 10
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =queue_menu_opt_4
    bl      printf

    mov     w0, 11
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =queue_menu_opt_5
    bl      printf

    mov     w0, 12
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =queue_menu_opt_0
    bl      printf

    // separator above the prompt
    mov     w0, 14
    mov     w1, 15
    mov     w2, 50
    mov     w3, 1
    bl      draw_horizontal_border_top

    // input prompt
    mov     w0, 15
    mov     w1, 20
    bl      ansi_move_cursor
    ldr     x0, =queue_menu_prompt
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// queue_enqueue_interactive() - prompt for a value, enqueue it, redraw
    .global queue_enqueue_interactive
queue_enqueue_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      ansi_clear_screen

    bl      queue_is_full
    cmp     w0, 1
    b.eq    queue_enqueue_overflow

    ldr     x0, =queue_prompt_value
    bl      printf

    bl      read_int
    mov     w19, w0                         // w19 = value

    mov     w0, w19
    bl      queue_enqueue

    bl      queue_display

    mov     w0, 22                          // status row
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =msg_enqueued
    mov     w1, w19
    bl      printf
    bl      print_newline

    b       queue_enqueue_done

queue_enqueue_overflow:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =queue_msg_full
    bl      printf
    bl      print_newline

queue_enqueue_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// queue_dequeue_interactive() - remove the front value and redraw
    .global queue_dequeue_interactive
queue_dequeue_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      ansi_clear_screen

    bl      queue_is_empty
    cmp     w0, 1
    b.eq    queue_dequeue_underflow

    bl      queue_dequeue
    mov     w19, w0                         // w19 = dequeued value

    bl      queue_display

    mov     w0, 22                          // status row
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =msg_dequeued
    mov     w1, w19
    bl      printf
    bl      print_newline

    b       queue_dequeue_done

queue_dequeue_underflow:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =queue_msg_empty
    bl      printf
    bl      print_newline

queue_dequeue_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// queue_peek_interactive() - show the front value without removing it
    .global queue_peek_interactive
queue_peek_interactive:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    bl      ansi_clear_screen

    bl      queue_is_empty
    cmp     w0, 1
    b.eq    queue_peek_empty

    bl      queue_peek
    mov     w19, w0                         // w19 = front value

    bl      queue_display

    mov     w0, 22                          // status row
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =queue_msg_peek
    mov     w1, w19
    bl      printf
    bl      print_newline

    b       queue_peek_done

queue_peek_empty:
    mov     w0, 22
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =queue_msg_empty
    bl      printf
    bl      print_newline

queue_peek_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// queue_enqueue(w0 = value) -> w0 = 1 on success, 0 on overflow
    .global queue_enqueue
queue_enqueue:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     w19, w0                         // w19 = value

    ldr     x20, =queue_count
    ldr     w21, [x20]                      // w21 = count

    cmp     w21, queue_max_size
    b.ge    queue_enqueue_fail

    ldr     x22, =queue_rear
    ldr     w23, [x22]                      // w23 = rear

    // new rear = (rear + 1) % max
    add     w23, w23, 1
    mov     w24, queue_max_size
    udiv    w25, w23, w24
    msub    w23, w25, w24, w23

    ldr     x24, =queue_data
    str     w19, [x24, w23, SXTW 2]         // data[rear] = value

    str     w23, [x22]                      // update rear

    add     w21, w21, 1
    str     w21, [x20]                      // count++

    mov     w0, 1
    b       queue_enqueue_ret

queue_enqueue_fail:
    mov     w0, 0

queue_enqueue_ret:
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// queue_dequeue() -> w0 = dequeued value (0 if empty)
    .global queue_dequeue
queue_dequeue:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    ldr     x19, =queue_count
    ldr     w20, [x19]                      // w20 = count

    cmp     w20, 0
    b.le    queue_dequeue_fail

    ldr     x21, =queue_front
    ldr     w22, [x21]                      // w22 = front

    ldr     x23, =queue_data
    ldr     w0, [x23, w22, SXTW 2]          // return data[front]

    // new front = (front + 1) % max
    add     w22, w22, 1
    mov     w24, queue_max_size
    udiv    w25, w22, w24
    msub    w22, w25, w24, w22

    str     w22, [x21]                      // update front

    sub     w20, w20, 1
    str     w20, [x19]                      // count--

    b       queue_dequeue_ret

queue_dequeue_fail:
    mov     w0, 0

queue_dequeue_ret:
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// queue_peek() -> w0 = front value (0 if empty), queue unchanged
    .global queue_peek
queue_peek:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x19, =queue_count
    ldr     w20, [x19]                      // w20 = count

    cmp     w20, 0
    b.le    queue_peek_fail

    ldr     x21, =queue_front
    ldr     w22, [x21]                      // w22 = front

    ldr     x23, =queue_data
    ldr     w0, [x23, w22, SXTW 2]          // data[front], not removed

    b       queue_peek_ret

queue_peek_fail:
    mov     w0, 0

queue_peek_ret:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// queue_display() - draw the queue as a row of cells, front on the left
    .global queue_display
queue_display:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    bl      ansi_clear_screen

    ldr     x19, =queue_count
    ldr     w19, [x19]                      // w19 = count

    cmp     w19, 0
    b.le    queue_display_empty

    // outer box
    mov     w0, 3
    mov     w1, 10
    mov     w2, 60
    mov     w3, 14
    mov     w4, 0                           // single-line style
    bl      draw_box

    // title
    mov     w0, 4
    mov     w1, 12
    bl      ansi_move_cursor
    ldr     x0, =queue_title
    mov     w1, 56
    bl      print_centered

    // separator
    mov     w0, 5
    mov     w1, 10
    mov     w2, 60
    mov     w3, 0
    bl      draw_horizontal_border_top

    // FRONT label
    mov     w0, 8
    mov     w1, 15
    bl      ansi_move_cursor
    ldr     x0, =label_front
    bl      printf

    // REAR label
    mov     w0, 8
    mov     w1, 58
    bl      ansi_move_cursor
    ldr     x0, =label_rear
    bl      printf

    // front arrow
    mov     w0, 9
    mov     w1, 16
    bl      ansi_move_cursor
    ldr     x0, =.Lqueue_arrow_down
    bl      printf

    // rear arrow column = count * 4 + 12
    mov     w0, 9
    add     w1, w19, w19                    // count * 2
    add     w1, w1, w19                     // count * 3
    add     w1, w1, w19                     // count * 4
    add     w1, w1, 12
    bl      ansi_move_cursor
    ldr     x0, =.Lqueue_arrow_down
    bl      printf

    // top border of the cell row
    mov     w0, 10
    mov     w1, 14
    bl      ansi_move_cursor
    ldr     x0, =.Lbox_line
    bl      printf

    ldr     x20, =queue_front
    ldr     w20, [x20]                      // w20 = front

    ldr     x21, =queue_data                // x21 = data base

    // values row
    mov     w0, 11
    mov     w1, 14
    bl      ansi_move_cursor

    mov     w22, 0                          // cells printed
    mov     w23, w20                        // walk starts at front

queue_display_loop:
    cmp     w22, w19
    b.ge    queue_display_bottom

    ldr     x0, =.Lcell_start
    bl      printf

    ldr     w1, [x21, w23, SXTW 2]
    ldr     x0, =.Lqueue_value_fmt
    bl      printf

    // next index, wrapping at max
    add     w23, w23, 1
    mov     w24, queue_max_size
    udiv    w25, w23, w24
    msub    w23, w25, w24, w23

    add     w22, w22, 1
    b       queue_display_loop

queue_display_bottom:
    // pad the unused cells
    mov     w24, w19
queue_display_empty_cells:
    cmp     w24, queue_max_size
    b.ge    queue_display_bottom_done

    ldr     x0, =.Lcell_empty
    bl      printf

    add     w24, w24, 1
    b       queue_display_empty_cells

queue_display_bottom_done:
    // closing edge of the row
    ldr     x0, =.Lcell_end
    bl      printf

    // bottom border
    bl      print_newline
    mov     w0, 12
    mov     w1, 14
    bl      ansi_move_cursor
    ldr     x0, =.Lbox_line
    bl      printf

    // count readout
    mov     w0, 14
    mov     w1, 15
    bl      ansi_move_cursor
    ldr     x0, =label_count
    mov     w1, w19
    mov     w2, queue_max_size
    bl      printf

    bl      print_newline
    b       queue_display_done

queue_display_empty:
    mov     w0, 10
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =queue_msg_empty
    bl      printf
    bl      print_newline

queue_display_done:
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

    .data
.Lqueue_arrow_down:   .string "↓"
.Lbox_line:     .string "└────┴────┴────┴────┴────┴────┴────┴────┘"
.Lcell_start:   .string "│"
.Lcell_end:     .string "│"
.Lqueue_value_fmt:    .string "%3d "
.Lcell_empty:   .string "│    "
    .text

// queue_is_empty() -> w0 = 1 if empty, 0 otherwise
    .global queue_is_empty
queue_is_empty:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =queue_count
    ldr     w0, [x0]

    cmp     w0, 0
    b.le    queue_empty_yes
    mov     w0, 0
    b       queue_empty_ret

queue_empty_yes:
    mov     w0, 1

queue_empty_ret:
    ldp     fp, lr, [sp], 16
    ret

// queue_is_full() -> w0 = 1 if full, 0 otherwise
    .global queue_is_full
queue_is_full:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =queue_count
    ldr     w0, [x0]

    cmp     w0, queue_max_size
    b.ge    queue_full_yes
    mov     w0, 0
    b       queue_full_ret

queue_full_yes:
    mov     w0, 1

queue_full_ret:
    ldp     fp, lr, [sp], 16
    ret

// queue_clear() - reset front, rear, and count to the empty state
    .global queue_clear
queue_clear:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =queue_front
    mov     w1, 0
    str     w1, [x0]

    ldr     x0, =queue_rear
    mov     w1, -1                          // -1 marks an empty queue
    str     w1, [x0]

    ldr     x0, =queue_count
    mov     w1, 0
    str     w1, [x0]

    ldp     fp, lr, [sp], 16
    ret

// accessors: let the C++ build read queue state directly

// queue_get_data() -> x0 = address of queue_data
    .global queue_get_data
queue_get_data:
    ldr     x0, =queue_data
    ret

// queue_get_front() -> w0 = front index
    .global queue_get_front
queue_get_front:
    ldr     x0, =queue_front
    ldr     w0, [x0]
    ret

// queue_get_rear() -> w0 = rear index (-1 if empty)
    .global queue_get_rear
queue_get_rear:
    ldr     x0, =queue_rear
    ldr     w0, [x0]
    ret

// queue_get_count() -> w0 = element count
    .global queue_get_count
queue_get_count:
    ldr     x0, =queue_count
    ldr     w0, [x0]
    ret

// queue_get_capacity() -> w0 = maximum capacity
    .global queue_get_capacity
queue_get_capacity:
    mov     w0, queue_max_size
    ret
