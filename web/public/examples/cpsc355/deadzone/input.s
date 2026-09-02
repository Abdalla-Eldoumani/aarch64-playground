// Non-blocking keyboard input. An arrow key arrives as three bytes, so a
// sequence in progress reads again at once rather than waiting for the next
// frame; the four arrows come back as the w/a/s/d codes.

define(key_reg, w19)                            // Current key value
define(state_reg, w20)                          // Escape sequence state

// Escape sequence states
ESC_STATE_NONE = 0                              // No escape sequence
ESC_STATE_ESC = 1                               // Received ESC
ESC_STATE_BRACKET = 2                           // Received ESC [

                .data

current_key:    .word   KEY_NONE                // Last key read

esc_state:      .word   ESC_STATE_NONE          // Current escape state

                .balign 4
input_buf:      .byte   0
                .balign 4

                .text

                .balign 4

// input_init - Initialize input system
// Called after terminal_init to set up input handling
                .global input_init
input_init:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                adrp    x0, current_key
                add     x0, x0, :lo12:current_key
                mov     w1, KEY_NONE
                str     w1, [x0]

                adrp    x0, esc_state
                add     x0, x0, :lo12:esc_state
                mov     w1, ESC_STATE_NONE
                str     w1, [x0]

                ldp     fp, lr, [sp], 16
                ret

// input_poll - Poll for keyboard input (non-blocking)
// Returns: w0 = key code, or KEY_NONE (-1) if no key pressed
// Handles arrow keys as escape sequences
                .global input_poll
input_poll:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]

                adrp    x0, esc_state
                add     x0, x0, :lo12:esc_state
                ldr     state_reg, [x0]

                // Try to read a byte (non-blocking due to VMIN=0, VTIME=0)
                mov     x0, STDIN
                adrp    x1, input_buf
                add     x1, x1, :lo12:input_buf
                mov     x2, 1
                mov     x8, SYS_READ
                svc     0

                cmp     x0, 0
                b.le    poll_no_input           // No input available

                adrp    x0, input_buf
                add     x0, x0, :lo12:input_buf
                ldrb    key_reg, [x0]

                // Handle escape sequence state machine
                cmp     state_reg, ESC_STATE_NONE
                b.ne    poll_in_escape          // In escape sequence

                // Outside a sequence, ESC starts one
                cmp     key_reg, KEY_ESC        // Is it ESC?
                b.ne    poll_return_key         // No, return the key

                // Got ESC - start escape sequence
                mov     state_reg, ESC_STATE_ESC
                adrp    x0, esc_state
                add     x0, x0, :lo12:esc_state
                str     state_reg, [x0]

                // Try to read next byte immediately
                b       input_poll_again

poll_in_escape:
                cmp     state_reg, ESC_STATE_ESC
                b.ne    poll_in_bracket         // Must be in bracket state

                // In ESC state - expect [
                cmp     key_reg, '['
                b.ne    poll_reset_return_esc   // No, return ESC

                // Got [ - advance to bracket state
                mov     state_reg, ESC_STATE_BRACKET
                adrp    x0, esc_state
                add     x0, x0, :lo12:esc_state
                str     state_reg, [x0]

                // Try to read next byte immediately
                b       input_poll_again

poll_in_bracket:
                // In bracket state - expect A/B/C/D for arrows
                mov     state_reg, ESC_STATE_NONE
                adrp    x0, esc_state
                add     x0, x0, :lo12:esc_state
                str     state_reg, [x0]

                cmp     key_reg, 'A'
                b.eq    poll_arrow_up
                cmp     key_reg, 'B'
                b.eq    poll_arrow_down
                cmp     key_reg, 'C'
                b.eq    poll_arrow_right
                cmp     key_reg, 'D'
                b.eq    poll_arrow_left

                // Unknown sequence - return the character
                b       poll_return_key

poll_arrow_up:
                mov     key_reg, KEY_W
                b       poll_return_key

poll_arrow_down:
                mov     key_reg, KEY_S
                b       poll_return_key

poll_arrow_right:
                mov     key_reg, KEY_D
                b       poll_return_key

poll_arrow_left:
                mov     key_reg, KEY_A
                b       poll_return_key

poll_reset_return_esc:
                mov     state_reg, ESC_STATE_NONE
                adrp    x0, esc_state
                add     x0, x0, :lo12:esc_state
                str     state_reg, [x0]
                mov     key_reg, KEY_ESC
                b       poll_return_key

poll_no_input:
                // A bare ESC: the sequence never got its bracket
                cmp     state_reg, ESC_STATE_NONE
                b.eq    poll_return_none        // Not in escape, return none

                // In escape sequence but no more input - return ESC
                mov     state_reg, ESC_STATE_NONE
                adrp    x0, esc_state
                add     x0, x0, :lo12:esc_state
                str     state_reg, [x0]
                mov     key_reg, KEY_ESC
                b       poll_return_key

poll_return_none:
                mov     key_reg, KEY_NONE
                b       poll_done

poll_return_key:
                adrp    x0, current_key
                add     x0, x0, :lo12:current_key
                str     key_reg, [x0]

poll_done:
                mov     w0, key_reg
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

input_poll_again:
                // Try another read immediately (for escape sequences)
                mov     x0, STDIN
                adrp    x1, input_buf
                add     x1, x1, :lo12:input_buf
                mov     x2, 1
                mov     x8, SYS_READ
                svc     0

                cmp     x0, 0                   // Check bytes read
                b.le    poll_no_input           // No more input

                // Got another byte - load and continue
                adrp    x0, input_buf
                add     x0, x0, :lo12:input_buf
                ldrb    key_reg, [x0]
                b       poll_in_escape          // Continue escape handling

