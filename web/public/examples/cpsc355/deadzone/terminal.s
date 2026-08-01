// Terminal control and rendering. Puts the terminal in raw mode, then stages
// each frame in a cell buffer and sends only the cells that changed, so a
// frame costs one write instead of one per glyph.

                .data

// Original termios storage (60 bytes aligned to 8)
                .balign 8
old_termios:    .skip   TERMIOS_SIZE            // Original terminal settings

// New termios storage
                .balign 8
new_termios:    .skip   TERMIOS_SIZE            // Modified terminal settings

// Terminal initialized flag
term_init:      .word   0                       // 0 = not initialized

// Where the next staged glyph lands, and the colour it is staged in
fb_x:           .word   0                       // Column 0..SCREEN_WIDTH-1
fb_y:           .word   0                       // Row 0..SCREEN_HEIGHT-1
fb_attr_cur:    .word   COLOR_RESET             // Colour applied to new cells

// Frame buffer
// Drawing stages a whole frame in fb_*, and screen_flush sends only the cells
// that differ from pv_* (what the terminal is already showing). That is what
// keeps a frame at one write syscall instead of one per glyph.
FLUSH_BUF_SIZE = 4096                           // Bytes per outgoing write

                .bss
                .balign 8
fb_char:        .skip   SCREEN_SIZE             // Glyph staged for each cell
fb_attr:        .skip   SCREEN_SIZE             // Colour staged for each cell
pv_char:        .skip   SCREEN_SIZE             // Glyph the terminal shows
pv_attr:        .skip   SCREEN_SIZE             // Colour the terminal shows
flush_buf:      .skip   FLUSH_BUF_SIZE          // Bytes on their way to stdout
fill_pattern:   .skip   8                       // Byte replicated for row fills

                .text

// ANSI escape sequences
ansi_clear:     .string "\x1b[2J"               // Clear entire screen
ansi_clear_len = . - ansi_clear - 1

ansi_home:      .string "\x1b[H"                // Cursor to home (1,1)
ansi_home_len = . - ansi_home - 1

ansi_hide:      .string "\x1b[?25l"             // Hide cursor
ansi_hide_len = . - ansi_hide - 1

ansi_show:      .string "\x1b[?25h"             // Show cursor
ansi_show_len = . - ansi_show - 1

ansi_reset:     .string "\x1b[0m"               // Reset all attributes
ansi_reset_len = . - ansi_reset - 1

ansi_last_row:  .string "\x1b[24;1H"            // Cursor to the bottom row
ansi_last_row_len = . - ansi_last_row - 1

                .balign 4

// terminal_init - Initialize terminal in raw mode
// Saves current settings and configures for game input
// Returns: 0 on success, -1 on failure
                .global terminal_init
terminal_init:
                stp     fp, lr, [sp, -16]!      // Save frame pointer and link
                mov     fp, sp

                // Get current terminal attributes
                mov     x0, STDIN
                mov     x1, TCGETS              // TCGETS request
                adrp    x2, old_termios
                add     x2, x2, :lo12:old_termios
                mov     x8, SYS_IOCTL
                svc     0
                cmp     x0, 0
                b.lt    terminal_init_fail

                // Copy old_termios to new_termios
                adrp    x0, old_termios
                add     x0, x0, :lo12:old_termios
                adrp    x1, new_termios
                add     x1, x1, :lo12:new_termios
                mov     x2, TERMIOS_SIZE
                bl      memcpy_simple

                // Modify local flags: disable ICANON, ECHO, ISIG, IEXTEN
                adrp    x0, new_termios         // Get new_termios address
                add     x0, x0, :lo12:new_termios
                ldr     w1, [x0, TERMIOS_LFLAG] // Load current lflag
                mov     w2, ICANON              // Canonical mode flag
                orr     w2, w2, ECHO            // OR with echo flag
                orr     w2, w2, ISIG            // OR with signal flag
                orr     w2, w2, IEXTEN          // OR with extended flag
                bic     w1, w1, w2
                str     w1, [x0, TERMIOS_LFLAG] // Store modified lflag

                // Modify input flags: disable ICRNL, IXON
                ldr     w1, [x0, TERMIOS_IFLAG] // Load current iflag
                mov     w2, ICRNL               // CR to NL flag
                orr     w2, w2, IXON            // XON/XOFF flag
                bic     w1, w1, w2
                str     w1, [x0, TERMIOS_IFLAG] // Store modified iflag

                // Set VMIN = 0, VTIME = 0 for non-blocking reads
                add     x1, x0, TERMIOS_CC
                mov     w2, 0
                strb    w2, [x1, TERMIOS_CC_VMIN]  // VMIN = 0
                strb    w2, [x1, TERMIOS_CC_VTIME] // VTIME = 0

                // Apply new terminal attributes
                mov     x0, STDIN
                mov     x1, TCSETS              // TCSETS request
                adrp    x2, new_termios
                add     x2, x2, :lo12:new_termios
                mov     x8, SYS_IOCTL
                svc     0
                cmp     x0, 0
                b.lt    terminal_init_fail

                // VMIN/VTIME above is a tty setting, so a host that honours
                // only the descriptor's own flags would still block in read().
                // Ask for non-blocking stdin both ways.
                mov     x0, STDIN
                mov     x1, F_GETFL             // Read current status flags
                mov     x8, SYS_FCNTL
                svc     0

                orr     x2, x0, O_NONBLOCK      // Add the non-blocking bit
                mov     x0, STDIN
                mov     x1, F_SETFL             // Write status flags back
                mov     x8, SYS_FCNTL
                svc     0

                // Set initialized flag
                adrp    x0, term_init
                add     x0, x0, :lo12:term_init
                mov     w1, 1
                str     w1, [x0]

                // Hide the cursor, wipe the physical screen once, then start
                // the staged frame from a blank slate. pv_* is still all
                // zeroes, which no staged glyph matches, so the first flush
                // repaints every cell.
                bl      cursor_hide
                bl      term_clear_raw          // Clear the real terminal
                bl      screen_clear            // Blank the staged frame
                bl      screen_invalidate       // Nothing is on screen yet

                mov     x0, 0
                ldp     fp, lr, [sp], 16
                ret

terminal_init_fail:
                mov     x0, -1
                ldp     fp, lr, [sp], 16
                ret

// terminal_restore - Restore original terminal settings
// Should be called before program exit
// Returns: 0 on success, -1 on failure
                .global terminal_restore
terminal_restore:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Check if terminal was initialized
                adrp    x0, term_init
                add     x0, x0, :lo12:term_init
                ldr     w0, [x0]
                cbz     w0, restore_done

                // Show cursor first
                bl      cursor_show

                // Reset colors
                bl      reset_color             // Reset to default

                // Restore original terminal attributes
                mov     x0, STDIN
                mov     x1, TCSETS              // TCSETS request
                adrp    x2, old_termios
                add     x2, x2, :lo12:old_termios
                mov     x8, SYS_IOCTL
                svc     0
                cmp     x0, 0
                b.lt    restore_fail

                // Clear initialized flag
                adrp    x0, term_init
                add     x0, x0, :lo12:term_init
                mov     w1, 0
                str     w1, [x0]

restore_done:
                mov     x0, 0
                ldp     fp, lr, [sp], 16
                ret

restore_fail:
                mov     x0, -1
                ldp     fp, lr, [sp], 16
                ret

// term_clear_raw - Physically clear the terminal, bypassing the frame buffer
// Used once at startup; gameplay clears the staged frame instead.
term_clear_raw:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                mov     x0, STDOUT
                adrp    x1, ansi_clear          // Clear sequence
                add     x1, x1, :lo12:ansi_clear
                mov     x2, ansi_clear_len
                mov     x8, SYS_WRITE
                svc     0

                mov     x0, STDOUT
                adrp    x1, ansi_home           // Home sequence
                add     x1, x1, :lo12:ansi_home
                mov     x2, ansi_home_len
                mov     x8, SYS_WRITE
                svc     0

                ldp     fp, lr, [sp], 16
                ret

// term_write_raw - Send bytes straight to the terminal
// Parameters: x0 = pointer, x1 = length
// For the bell and for the messages printed once the game hands the terminal
// back; everything else belongs in the frame buffer.
                .global term_write_raw
term_write_raw:
                mov     x2, x1
                mov     x1, x0
                mov     x0, STDOUT
                mov     x8, SYS_WRITE
                svc     0
                ret

// write_str_raw - Send a null-terminated string straight to the terminal
// Parameters: x0 = pointer to string
                .global write_str_raw
write_str_raw:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                mov     x1, x0                  // Walk the string
raw_strlen_loop:
                ldrb    w2, [x1], 1
                cbnz    w2, raw_strlen_loop
                sub     x1, x1, x0              // Length + 1
                sub     x1, x1, 1               // Drop the terminator
                cbz     x1, write_str_raw_done  // Nothing to send

                bl      term_write_raw          // Hand it to the terminal

write_str_raw_done:
                ldp     fp, lr, [sp], 16
                ret

// screen_end - Park the cursor on the last row and reset colour, raw
// Called on the way out so the exit message lands where it used to.
                .global screen_end
screen_end:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                adrp    x0, ansi_last_row       // ESC [ 24 ; 1 H
                add     x0, x0, :lo12:ansi_last_row
                mov     x1, ansi_last_row_len
                bl      term_write_raw

                adrp    x0, ansi_reset          // ESC [ 0 m
                add     x0, x0, :lo12:ansi_reset
                mov     x1, ansi_reset_len
                bl      term_write_raw

                ldp     fp, lr, [sp], 16
                ret

// screen_clear - Blank the staged frame and send the cursor home
                .global screen_clear
screen_clear:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                mov     w19, 0
screen_clear_loop:
                cmp     w19, SCREEN_HEIGHT
                b.ge    screen_clear_done
                mov     w0, w19
                mov     w1, ' '
                mov     w2, COLOR_RESET
                bl      fb_fill_row
                add     w19, w19, 1
                b       screen_clear_loop

screen_clear_done:
                bl      cursor_home             // Staged cursor back to 0,0

                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// screen_invalidate - Force the next flush to repaint every cell
// The diff alone keeps the screen right; this exists so a state change can
// ask for a clean full repaint (first frame, menu <-> play, pause on/off,
// level-up, boss arrival).
// Both planes are written, not just the glyphs: a host that maps pages on
// first write leaves an untouched buffer unreadable, and the flush reads
// both planes before it ever writes them.
                .global screen_invalidate
screen_invalidate:
                adrp    x0, pv_char
                add     x0, x0, :lo12:pv_char
                adrp    x3, pv_attr
                add     x3, x3, :lo12:pv_attr
                mov     w1, SCREEN_SIZE / 8     // Eight cells per store
invalidate_loop:
                str     xzr, [x0], 8            // No glyph is ever zero
                str     xzr, [x3], 8
                subs    w1, w1, 1
                b.ne    invalidate_loop
                ret

// fb_fill_row - Fill one whole screen row with a glyph and colour
// Parameters: w0 = row, w1 = glyph, w2 = colour
// Eight cells at a time; a row costs about sixty steps instead of the eighty
// write syscalls the per-character path used.
                .global fb_fill_row
fb_fill_row:
                cmp     w0, SCREEN_HEIGHT
                b.ge    fb_fill_row_done
                cmp     w0, 0
                b.lt    fb_fill_row_done

                mov     w3, SCREEN_WIDTH
                mul     w3, w0, w3

                // Replicate the glyph and the colour across eight lanes
                adrp    x6, fill_pattern
                add     x6, x6, :lo12:fill_pattern
                strb    w1, [x6, 0]
                strb    w1, [x6, 1]
                strb    w1, [x6, 2]
                strb    w1, [x6, 3]
                strb    w1, [x6, 4]
                strb    w1, [x6, 5]
                strb    w1, [x6, 6]
                strb    w1, [x6, 7]
                ldr     x7, [x6]                // Eight copies of the glyph
                strb    w2, [x6, 0]
                strb    w2, [x6, 1]
                strb    w2, [x6, 2]
                strb    w2, [x6, 3]
                strb    w2, [x6, 4]
                strb    w2, [x6, 5]
                strb    w2, [x6, 6]
                strb    w2, [x6, 7]
                ldr     x8, [x6]                // Eight copies of the colour

                adrp    x4, fb_char
                add     x4, x4, :lo12:fb_char
                add     x4, x4, x3, uxtw
                adrp    x5, fb_attr
                add     x5, x5, :lo12:fb_attr
                add     x5, x5, x3, uxtw

                mov     w9, SCREEN_WIDTH / 8
fb_fill_row_loop:
                str     x7, [x4], 8
                str     x8, [x5], 8
                subs    w9, w9, 1
                b.ne    fb_fill_row_loop

fb_fill_row_done:
                ret

// cursor_home - Stage the next glyph at the top-left corner
                .global cursor_home
cursor_home:
                adrp    x0, fb_x
                add     x0, x0, :lo12:fb_x
                str     wzr, [x0]               // Column 0
                str     wzr, [x0, 4]            // Row 0
                ret

// cursor_move - Stage the next glyph at position (x, y)
// Parameters: w0 = x (column, 0-based), w1 = y (row, 0-based)
                .global cursor_move
cursor_move:
                adrp    x2, fb_x
                add     x2, x2, :lo12:fb_x
                str     w0, [x2]
                str     w1, [x2, 4]
                ret

// cursor_hide - Hide the cursor
                .global cursor_hide
cursor_hide:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                mov     x0, STDOUT
                adrp    x1, ansi_hide           // Hide sequence
                add     x1, x1, :lo12:ansi_hide
                mov     x2, ansi_hide_len
                mov     x8, SYS_WRITE
                svc     0

                ldp     fp, lr, [sp], 16
                ret

// cursor_show - Show the cursor
                .global cursor_show
cursor_show:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                mov     x0, STDOUT
                adrp    x1, ansi_show           // Show sequence
                add     x1, x1, :lo12:ansi_show
                mov     x2, ansi_show_len
                mov     x8, SYS_WRITE
                svc     0

                ldp     fp, lr, [sp], 16
                ret

// set_color - Colour applied to every cell staged from here on
// Parameters: w0 = color code (30-37 or 90-97)
                .global set_color
set_color:
                adrp    x1, fb_attr_cur
                add     x1, x1, :lo12:fb_attr_cur
                str     w0, [x1]
                ret

// reset_color - Go back to the terminal default colour
                .global reset_color
reset_color:
                adrp    x1, fb_attr_cur
                add     x1, x1, :lo12:fb_attr_cur
                mov     w0, COLOR_RESET
                str     w0, [x1]
                ret

// write_char - Stage one glyph at the current position
// Parameters: w0 = character to write
// A newline moves to the start of the next row; anything outside the screen
// is dropped rather than wrapped, so a long string cannot shift the layout.
                .global write_char
write_char:
                adrp    x1, fb_x
                add     x1, x1, :lo12:fb_x
                ldr     w2, [x1]
                ldr     w3, [x1, 4]

                cmp     w0, '\n'
                b.eq    write_char_newline

                cmp     w3, 0
                b.lt    write_char_done
                cmp     w3, SCREEN_HEIGHT
                b.ge    write_char_done
                cmp     w2, 0
                b.lt    write_char_done
                cmp     w2, SCREEN_WIDTH
                b.ge    write_char_done

                mov     w4, SCREEN_WIDTH
                madd    w4, w3, w4, w2          // Cell index = row * 80 + col

                adrp    x5, fb_char
                add     x5, x5, :lo12:fb_char
                strb    w0, [x5, w4, uxtw]

                ldr     w6, [x1, 8]             // Current colour
                adrp    x5, fb_attr
                add     x5, x5, :lo12:fb_attr
                strb    w6, [x5, w4, uxtw]

                add     w2, w2, 1
                str     w2, [x1]

write_char_done:
                ret

write_char_newline:
                str     wzr, [x1]               // Back to column 0
                add     w3, w3, 1
                str     w3, [x1, 4]
                ret

// write_str - Stage a null-terminated string at the current position
// Parameters: x0 = pointer to string
                .global write_str
write_str:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]

                mov     x19, x0

write_str_loop:
                ldrb    w20, [x19], 1
                cbz     w20, write_str_done
                mov     w0, w20
                bl      write_char
                b       write_str_loop

write_str_done:
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// write_num - Stage an integer at the current position
// Parameters: w0 = number to write
                .global write_num
write_num:
                stp     fp, lr, [sp, -64]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                str     x21, [sp, 32]

                mov     w1, w0
                add     x19, sp, 56
                mov     x20, x19

                cmp     w1, 0                   // Negative?
                b.ge    write_num_positive
                neg     w1, w1                  // Convert magnitude
                mov     w21, 1                  // Remember the sign
                b       write_num_convert

write_num_positive:
                mov     w21, 0

write_num_convert:
                mov     w4, 10
write_num_loop:
                udiv    w5, w1, w4
                msub    w6, w5, w4, w1
                add     w6, w6, '0'
                sub     x19, x19, 1
                strb    w6, [x19]
                mov     w1, w5
                cbnz    w1, write_num_loop

                cbz     w21, write_num_output   // Positive, nothing to prefix
                sub     x19, x19, 1
                mov     w6, '-'
                strb    w6, [x19]

write_num_output:
                cmp     x19, x20
                b.ge    write_num_done
                ldrb    w0, [x19], 1
                bl      write_char
                b       write_num_output

write_num_done:
                ldr     x21, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 64
                ret

// fb_emit_num - Append a small decimal to the outgoing byte buffer
// Parameters: w0 = value (0..999), x23 = write pointer
// Returns: x23 advanced. Clobbers w0, w1, w2 and nothing else, so the flush
// loop can keep its row and column in higher registers across the call.
fb_emit_num:
                cmp     w0, 10
                b.lt    fb_emit_num_ones
                cmp     w0, 100
                b.lt    fb_emit_num_tens

                mov     w1, 100
                udiv    w2, w0, w1
                msub    w0, w2, w1, w0
                add     w2, w2, '0'
                strb    w2, [x23], 1

fb_emit_num_tens:
                mov     w1, 10
                udiv    w2, w0, w1
                msub    w0, w2, w1, w0
                add     w2, w2, '0'
                strb    w2, [x23], 1

fb_emit_num_ones:
                add     w0, w0, '0'
                strb    w0, [x23], 1
                ret

// flush_buf_write - Hand the pending bytes to the terminal and start over
// Parameters: x23 = write pointer, x24 = buffer base
// Returns: x23 reset to x24
flush_buf_write:
                subs    x2, x23, x24            // Bytes pending
                b.eq    flush_buf_write_done
                mov     x1, x24
                mov     x0, STDOUT
                mov     x8, SYS_WRITE
                svc     0
                mov     x23, x24                // Buffer is empty again

flush_buf_write_done:
                ret

// screen_flush - Send the cells that changed since the last frame
// Walks the staged frame eight cells at a time and only looks at a cell when
// its eight-cell group differs, then emits each changed run as one cursor
// address, one colour change and the glyphs. One write syscall per frame in
// the normal case, a handful on a full repaint.
                .global screen_flush
screen_flush:
                stp     fp, lr, [sp, -112]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]
                stp     x23, x24, [sp, 48]
                stp     x25, x26, [sp, 64]
                stp     x27, x28, [sp, 80]

                adrp    x19, fb_char
                add     x19, x19, :lo12:fb_char
                adrp    x20, pv_char
                add     x20, x20, :lo12:pv_char
                adrp    x21, fb_attr
                add     x21, x21, :lo12:fb_attr
                adrp    x22, pv_attr
                add     x22, x22, :lo12:pv_attr
                adrp    x24, flush_buf
                add     x24, x24, :lo12:flush_buf
                mov     x23, x24

                mov     w25, -1                 // Colour last sent
                mov     w26, 0                  // Index of the current cell
                mov     w28, -1                 // Where the cursor now sits
                mov     w27, SCREEN_SIZE / 8

flush_group_loop:
                ldr     x0, [x19]
                ldr     x1, [x20]
                ldr     x2, [x21]
                ldr     x3, [x22]
                eor     x0, x0, x1              // Glyph differences
                eor     x2, x2, x3              // Colour differences
                orr     x0, x0, x2
                cbnz    x0, flush_group_dirty

flush_group_next:
                add     x19, x19, 8
                add     x20, x20, 8
                add     x21, x21, 8
                add     x22, x22, 8
                add     w26, w26, 8
                subs    w27, w27, 1
                b.ne    flush_group_loop
                b       flush_finish

flush_group_dirty:
                mov     w7, 0

flush_cell_loop:
                ldrb    w5, [x19, w7, uxtw]     // Staged glyph
                ldrb    w6, [x20, w7, uxtw]     // Glyph on screen
                ldrb    w4, [x21, w7, uxtw]     // Staged colour
                ldrb    w8, [x22, w7, uxtw]     // Colour on screen
                cmp     w5, w6
                b.ne    flush_cell_emit
                cmp     w4, w8
                b.eq    flush_cell_next

flush_cell_emit:
                // Keep at least one cell's worth of headroom in the buffer
                sub     x0, x23, x24
                cmp     x0, FLUSH_BUF_SIZE - 32
                b.lt    flush_cell_room
                bl      flush_buf_write

flush_cell_room:
                add     w9, w26, w7             // Absolute cell index
                cmp     w9, w28                 // Already under the cursor?
                b.eq    flush_cell_color

                mov     w1, SCREEN_WIDTH
                udiv    w10, w9, w1
                msub    w11, w10, w1, w9
                mov     w1, 0x1b
                strb    w1, [x23], 1
                mov     w1, '['
                strb    w1, [x23], 1
                add     w0, w10, 1              // ANSI rows are 1-based
                bl      fb_emit_num
                mov     w1, 59
                strb    w1, [x23], 1
                add     w0, w11, 1              // ANSI columns are 1-based
                bl      fb_emit_num
                mov     w1, 'H'
                strb    w1, [x23], 1

flush_cell_color:
                cmp     w4, w25                 // Colour already in effect?
                b.eq    flush_cell_glyph
                mov     w1, 0x1b
                strb    w1, [x23], 1
                mov     w1, '['
                strb    w1, [x23], 1
                mov     w0, w4
                bl      fb_emit_num
                mov     w1, 'm'
                strb    w1, [x23], 1
                mov     w25, w4

flush_cell_glyph:
                strb    w5, [x23], 1
                strb    w5, [x20, w7, uxtw]     // Screen now shows this
                strb    w4, [x22, w7, uxtw]
                add     w9, w26, w7
                add     w28, w9, 1              // Cursor advanced one cell

flush_cell_next:
                add     w7, w7, 1
                cmp     w7, 8
                b.lt    flush_cell_loop
                b       flush_group_next

flush_finish:
                bl      flush_buf_write         // Send whatever is left

                ldp     x27, x28, [sp, 80]
                ldp     x25, x26, [sp, 64]
                ldp     x23, x24, [sp, 48]
                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 112
                ret

// memcpy_simple - Simple memory copy
// Parameters: x0 = source, x1 = dest, x2 = count
memcpy_simple:
                cbz     x2, memcpy_done         // Return if count is 0
memcpy_loop:
                ldrb    w3, [x0], 1
                strb    w3, [x1], 1
                subs    x2, x2, 1
                b.ne    memcpy_loop
memcpy_done:
                ret
