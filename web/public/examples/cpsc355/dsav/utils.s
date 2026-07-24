// utils.asm - input, delays, and random numbers

define(fp, x29)
define(lr, x30)

    .data
    .balign 8

int_fmt:            .string "%d"
press_enter_msg:    .string "\x1b[33mPress Enter to continue...\x1b[0m"
// The complaint always lands on one fixed line, centered under the menu
// box and clear of its bottom border (the boxes end at row 22 at the
// deepest), and clears that line first -- so retries overwrite it in
// place instead of stacking copies down the screen.
invalid_input_msg:  .string "\x1b[24;25H\x1b[2K\x1b[31mInvalid input! Please try again.\x1b[0m"
clear_msg_row:      .string "\x1b[24;1H\x1b[2K"
input_prompt:       .string "> "
save_input_pos:     .string "\x1b[s"        // remember where typing begins
restore_input_pos:  .string "\x1b[u\x1b[0K" // jump back there and wipe the try

input_buffer:       .skip 64                // scratch space for user input

    .text
    .balign 4

// delay_ms(w0 = milliseconds)
    .global delay_ms
delay_ms:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w1, 1000
    mul     w0, w0, w1                      // usleep wants microseconds
    bl      usleep

    ldp     fp, lr, [sp], 16
    ret

// delay_us(w0 = microseconds)
    .global delay_us
delay_us:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      usleep

    ldp     fp, lr, [sp], 16
    ret

// read_int() -> w0 = value, w1 = 1 on success, 0 on end of input
// remembers where typing begins; a bad line is flushed, the complaint
// lands on the fixed message row under the menu, and the cursor comes
// back to the same spot, so retries never scroll the menu away
    .global read_int
read_int:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]                   // w19 holds the value across calls

    ldr     x0, =save_input_pos
    bl      printf

read_int_retry:
    sub     sp, sp, 16                      // scratch slot for scanf
    mov     x1, sp
    ldr     x0, =int_fmt
    bl      scanf

    cmp     w0, 1                           // items converted
    b.ne    read_int_no_value

    ldr     w19, [sp]                       // hold the value across the calls
    add     sp, sp, 16
    bl      read_int_clear_message
    mov     w0, w19
    mov     w1, 1
    b       read_int_done

read_int_no_value:
    add     sp, sp, 16
    cmp     w0, 0                           // negative means end of input
    b.lt    read_int_eof

    bl      clear_input_buffer              // flush the bad line
    bl      read_int_complain
    b       read_int_retry

read_int_eof:
    mov     w0, 0
    mov     w1, 0

read_int_done:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// read_int_complain() - paint the complaint on the message row, then put
// the cursor back where the student was typing
    .global read_int_complain
read_int_complain:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =invalid_input_msg
    bl      printf
    ldr     x0, =restore_input_pos
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// read_int_clear_message() - wipe the message row once a good value
// lands, so a stale complaint never outlives the mistake
read_int_clear_message:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =clear_msg_row
    bl      printf
    ldr     x0, =restore_input_pos
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// read_int_range(w0 = min, w1 = max) -> w0 = value in range
// reprompts in place until a number in [min, max] is entered; the
// complaint sits on the line under the prompt and stays put
    .global read_int_range
read_int_range:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]

    mov     w19, w0                         // min
    mov     w20, w1                         // max

    ldr     x0, =input_prompt
    bl      printf

read_int_range_loop:
    bl      read_int
    mov     w21, w0                         // value
    mov     w22, w1                         // success flag

    cmp     w22, 0
    b.eq    read_int_range_invalid
    cmp     w21, w19
    b.lt    read_int_range_invalid
    cmp     w21, w20
    b.gt    read_int_range_invalid

    mov     w0, w21
    b       read_int_range_done

read_int_range_invalid:
    bl      read_int_complain               // out of range reads the same
    b       read_int_range_loop

read_int_range_done:
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// wait_for_enter() - prompt on the bottom row, block until enter
    .global wait_for_enter
wait_for_enter:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, 23                          // bottom of screen
    mov     w1, 1
    bl      ansi_move_cursor

    ldr     x0, =press_enter_msg
    bl      printf

    bl      clear_input_buffer              // drop any leftover line
    bl      getchar

    ldp     fp, lr, [sp], 16
    ret

// clear_input_buffer() - eat characters up to newline or eof
    .global clear_input_buffer
clear_input_buffer:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

clear_input_loop:
    bl      getchar
    cmp     w0, '\n'
    b.eq    clear_input_done
    cmp     w0, -1                          // eof
    b.ne    clear_input_loop

clear_input_done:
    ldp     fp, lr, [sp], 16
    ret

// print_string(x0 = string address)
    .global print_string
print_string:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// print_int(w0 = value)
    .global print_int
print_int:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w1, w0                          // value is the second printf arg
    ldr     x0, =int_fmt
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// print_newline()
    .global print_newline
print_newline:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =.Lnewline
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

    .data
.Lnewline: .string "\n"
    .text

// get_random(w0 = max) -> w0 = random value in [0, max)
    .global get_random
get_random:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0                         // max

    bl      rand
    udiv    w1, w0, w19
    msub    w0, w1, w19, w0                 // rand() % max

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// seed_random() - srand(time(NULL))
    .global seed_random
seed_random:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     x0, 0                           // NULL
    bl      time
    bl      srand

    ldp     fp, lr, [sp], 16
    ret
