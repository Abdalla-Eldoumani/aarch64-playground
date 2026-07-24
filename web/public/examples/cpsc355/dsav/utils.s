// utils.asm - input, delays, and random numbers

define(fp, x29)
define(lr, x30)

    .data
    .balign 8

int_fmt:            .string "%d"
press_enter_msg:    .string "\x1b[33mPress Enter to continue...\x1b[0m"
// the complaint clears its own line first, so retries overwrite it in
// place instead of stacking a new copy under the menu every time
invalid_input_msg:  .string "\x1b[2K\x1b[31mInvalid input! Please try again.\x1b[0m"
input_prompt:       .string "> "
save_input_pos:     .string "\x1b[s"        // remember where typing begins
redo_input_pos:     .string "\x1b[u\x1b[0K" // jump back there and wipe the try

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
// lands on the line below, and the cursor comes back to the same spot,
// so retries never scroll the menu away
    .global read_int
read_int:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp

    ldr     x0, =save_input_pos
    bl      printf

read_int_retry:
    sub     sp, sp, 16                      // scratch slot for scanf
    mov     x1, sp
    ldr     x0, =int_fmt
    bl      scanf

    cmp     w0, 1                           // items converted
    b.ne    read_int_no_value

    ldr     w0, [sp]
    add     sp, sp, 16
    mov     w1, 1
    b       read_int_done

read_int_no_value:
    add     sp, sp, 16
    cmp     w0, 0                           // negative means end of input
    b.lt    read_int_eof

    bl      clear_input_buffer              // flush the bad line
    ldr     x0, =invalid_input_msg          // complaint on the line below
    bl      printf
    ldr     x0, =redo_input_pos             // back to the input spot
    bl      printf
    b       read_int_retry

read_int_eof:
    mov     w0, 0
    mov     w1, 0

read_int_done:
    ldp     fp, lr, [sp], 32
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
    ldr     x0, =invalid_input_msg          // complaint on the line below
    bl      printf
    ldr     x0, =redo_input_pos             // back to the input spot
    bl      printf
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

    .section .rodata
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
