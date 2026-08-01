// calc -- a pocket scientific calculator: a terminal device, or a line
// calculator on plain stdio. https://github.com/Abdalla-Eldoumani/calc
//
// run: make, then ./calculator for the device or ./calculator console for
// the line calculator. In the playground: assemble, then run, with the
// arguments line carrying the same thing.
//
// device: type digits and operators; arrows walk the highlight and enter
// presses it, tab switches entry mode, d flips DEG/RAD, C and A clear.
// console: type an expression; deg and rad switch mode. q quits either.

define(fp, x29)
define(lr, x30)

// The expression parser threads its scan pointer through every
// recursive call, so x19 belongs to the cursor and to nothing else.
define(cursor_r, x19)

        .text
        .global main

// System call numbers for ARMv8 Linux
SYS_READ = 63
SYS_WRITE = 64
SYS_IOCTL = 29
SYS_FCNTL = 25
SYS_NANOSLEEP = 101

STDIN_FILENO = 0
STDOUT_FILENO = 1

// Terminal control
TCGETS = 0x5401
TCSETS = 0x5402
ICANON = 0x0002
ECHO = 0x0008
F_GETFL = 3
F_SETFL = 4
O_NONBLOCK = 0x800

// The poll interval. Every trip through the loop sleeps, so the program
// never spins on an empty stdin, and 16 ms is short enough that a
// keypress lands on the next repaint instead of the one after it.
POLL_NS = 16000000

// A typed key stays lit for this many polls -- about a tenth of a
// second, long enough to see and short enough not to smear.
FLASH_POLLS = 6

// Device geometry. The chassis is 53 columns wide and 23 rows tall so it
// fits an 80x24 terminal with room to spare, and the key grid columns
// line up with the display window above them.
BRAND_ROW = 2
IND_ROW = 4
ENTRY_ROW = 5
RESULT_ROW = 6
TAPE_ROW = 8
KEY_ROW0 = 12
HINT_ROW = 23
LCD_COL = 4
LCD_WIDTH = 47
KEY_COLS = 8
KEY_ROWS = 5
KEY_COUNT = 40
KEY_PITCH = 6
KEY_WIDTH = 5

// The separator inside a cursor address, as a number rather than as a
// character literal: assembly preprocessors treat a bare semicolon as
// the start of a comment and truncate the line around it.
CHAR_SEMI = 0x3b

// The bytes at the edges of a typed line, named so the console reader
// says what it means.
CHAR_TAB = 9
CHAR_LF = 10
CHAR_CR = 13

// Entry limits. A typed number stops at 20 characters and a typed
// expression at 40: past that the display cannot show what you typed,
// so the grid simply stops accepting.
MAX_ENTRY = 20
MAX_EXPR = 40
LINE_MAX = 120
TAPE_SLOT = 96
TAPE_MAX = 94
SEG_MAX = 40

// The console prompt has no display to fit, so its line is longer. Past
// the cap the rest is read and dropped: truncating an expression would
// answer a different question than the one that was typed.
CMD_MAX = 120

// Repaint flags. Nothing is redrawn unless the state behind it moved,
// which is what keeps the device from flickering.
DIRTY_DISPLAY = 1
DIRTY_TAPE = 2
DIRTY_KEYS = 4

// Key actions. A digit key's action is its own value, so it needs no
// translation on the way in.
ACT_D0 = 0
ACT_D1 = 1
ACT_D2 = 2
ACT_D3 = 3
ACT_D4 = 4
ACT_D5 = 5
ACT_D6 = 6
ACT_D7 = 7
ACT_D8 = 8
ACT_D9 = 9
ACT_DOT = 10
ACT_SIGN = 11
ACT_ADD = 12
ACT_SUB = 13
ACT_MUL = 14
ACT_DIV = 15
ACT_EQ = 16
ACT_C = 17
ACT_AC = 18
ACT_BSP = 19
ACT_LPAREN = 20
ACT_RPAREN = 21
ACT_PCT = 22
ACT_SQRT = 23
ACT_SQR = 24
ACT_POW = 25
ACT_INV = 26
ACT_SIN = 27
ACT_COS = 28
ACT_TAN = 29
ACT_LOG = 30
ACT_LN = 31
ACT_EXPF = 32
ACT_PI = 33
ACT_MC = 34
ACT_MR = 35
ACT_MPLUS = 36
ACT_MMINUS = 37
ACT_DRG = 38
ACT_MODE = 39

// Pending-operator codes, kept apart from the action numbers so the
// fold in imm_binop reads as arithmetic rather than as key handling.
OP_ADD = 1
OP_SUB = 2
OP_MUL = 3
OP_DIV = 4
OP_POW = 5

// Error codes, in the order err_tab lists their words.
ERR_DIV0 = 1
ERR_SQRT = 2
ERR_LOG = 3
ERR_OVER = 4
ERR_SYNTAX = 5
ERR_UNDEF = 6

main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // The argument picks the front end. No argument is the device;
        // "console" keeps the program on plain stdio.
        cmp     w0, 2
        b.lt    main_device
        ldr     x0, [x1, 8]
        ldr     x1, =txt_console
        bl      str_equal
        cbnz    w0, main_console

        ldr     x0, =usage_txt
        mov     x1, usage_txt_len
        bl      console_write
        mov     w0, 1
        ldp     fp, lr, [sp], 16
        ret

main_console:
        bl      console_repl
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

main_device:
        bl      save_terminal_settings
        bl      set_raw_mode
        bl      set_nonblocking_input

        bl      reset_all
        bl      draw_static
        bl      repaint

main_loop:
        bl      poll_input

        ldr     x9, =quit_flag
        ldr     w9, [x9]
        cbnz    w9, main_quit

        bl      tick_flash
        bl      repaint
        bl      poll_sleep
        b       main_loop

main_quit:
        bl      leave_screen
        bl      restore_terminal_settings

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

// ------------------------------------------------------------------ //
// console mode -- the line calculator                                  //
//                                                                      //
// The same expression engine EXPR mode runs, driven from cooked stdio.  //
// Nothing on this path touches termios or fcntl and nothing on it       //
// writes an escape byte: a plain-text console shows an escape as        //
// literal garbage, and a redirected stdin has to read the same.         //
// ------------------------------------------------------------------ //

console_repl:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        ldr     x0, =banner_txt
        mov     x1, banner_txt_len
        bl      console_write

console_repl_loop:
        ldr     x0, =prompt_txt
        mov     x1, prompt_txt_len
        bl      console_write

        bl      read_line
        cbz     w0, console_repl_eof
        cmp     w0, 2
        b.eq    console_repl_long

        bl      trim_line
        mov     x20, x0

        // A blank line is not a mistake, so it gets no answer and no
        // complaint.
        ldrb    w9, [x20]
        cbz     w9, console_repl_loop

        mov     x0, x20
        ldr     x1, =txt_q
        bl      str_equal
        cbnz    w0, console_repl_bye
        mov     x0, x20
        ldr     x1, =txt_quit
        bl      str_equal
        cbnz    w0, console_repl_bye
        mov     x0, x20
        ldr     x1, =txt_deg
        bl      str_equal
        cbnz    w0, console_repl_deg
        mov     x0, x20
        ldr     x1, =txt_rad
        bl      str_equal
        cbnz    w0, console_repl_rad

        mov     x0, x20
        bl      console_eval
        b       console_repl_loop

console_repl_long:
        ldr     x0, =long_txt
        mov     x1, long_txt_len
        bl      console_write
        b       console_repl_loop

console_repl_deg:
        ldr     x9, =deg_mode
        mov     w10, 1
        str     w10, [x9]
        ldr     x0, =deg_word
        mov     x1, deg_word_len
        bl      console_write
        b       console_repl_loop

console_repl_rad:
        ldr     x9, =deg_mode
        str     wzr, [x9]
        ldr     x0, =rad_word
        mov     x1, rad_word_len
        bl      console_write
        b       console_repl_loop

console_repl_eof:
        // End of input rather than a typed q: close the line the prompt
        // opened, since nothing echoed one.
        ldr     x0, =nl_txt
        mov     x1, nl_txt_len
        bl      console_write

console_repl_bye:
        ldr     x0, =bye_txt
        mov     x1, bye_txt_len
        bl      console_write

        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// read_line: one line of cooked stdin into cmd_buf, one getchar at a
// time. Answers 0 at end of input, 1 for a line, 2 for a line that ran
// past the cap.
read_line:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, 0
        mov     w21, 0

read_line_loop:
        bl      getchar
        cmp     w0, 0
        b.lt    read_line_eof
        cmp     w0, CHAR_LF
        b.eq    read_line_end
        // A carriage return belongs to the line ending, not to the line,
        // so a file written on another platform still reads.
        cmp     w0, CHAR_CR
        b.eq    read_line_loop
        cmp     w20, CMD_MAX
        b.ge    read_line_over
        ldr     x9, =cmd_buf
        strb    w0, [x9, x20]
        add     w20, w20, 1
        b       read_line_loop

read_line_over:
        mov     w21, 1
        b       read_line_loop

read_line_eof:
        cbnz    w20, read_line_end
        cbnz    w21, read_line_end
        mov     w0, 0
        b       read_line_done

read_line_end:
        ldr     x9, =cmd_buf
        strb    wzr, [x9, x20]
        ldr     x9, =cmd_len
        str     w20, [x9]
        mov     w0, 1
        cbz     w21, read_line_done
        mov     w0, 2

read_line_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// trim_line: hand back the line with the blanks either side of it gone,
// so a command word is recognised however it was spaced.
trim_line:
        ldr     x0, =cmd_buf
        ldr     x9, =cmd_len
        ldr     w9, [x9]
        add     x2, x0, x9

trim_line_tail:
        cmp     x2, x0
        b.eq    trim_line_cut
        sub     x3, x2, 1
        ldrb    w4, [x3]
        cmp     w4, ' '
        b.eq    trim_line_tail_step
        cmp     w4, CHAR_TAB
        b.ne    trim_line_cut
trim_line_tail_step:
        mov     x2, x3
        b       trim_line_tail

trim_line_cut:
        strb    wzr, [x2]

trim_line_head:
        ldrb    w4, [x0]
        cmp     w4, ' '
        b.eq    trim_line_head_step
        cmp     w4, CHAR_TAB
        b.ne    trim_line_done
trim_line_head_step:
        add     x0, x0, 1
        b       trim_line_head

trim_line_done:
        ret

// console_eval: read the whole of the line at x0 as an expression and
// print either the reading or the word for what went wrong.
console_eval:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x19, x20, [sp, -16]!

        ldr     x9, =parse_err
        str     wzr, [x9]
        ldr     x9, =parse_depth
        str     wzr, [x9]
        mov     cursor_r, x0

        bl      parse_expr

        // Anything left over is text the parser could not read, which is
        // what catches a trailing operator and a stray word.
        bl      skip_spaces
        ldrb    w9, [cursor_r]
        cbz     w9, console_eval_check
        ldr     x9, =parse_err
        mov     w10, ERR_SYNTAX
        str     w10, [x9]

console_eval_check:
        ldr     x9, =parse_err
        ldr     w20, [x9]
        cbnz    w20, console_eval_err
        bl      check_result
        mov     w20, w0
        cbnz    w20, console_eval_err

        ldr     x0, =console_out
        ldr     x1, =ans_txt
        mov     x2, ans_txt_len
        bl      emit_bytes

        // The reading renders straight onto the staged line. format_double
        // answers a length rather than a cursor, so the end is worked out
        // from the fixed base instead of parked in a register.
        bl      format_double
        ldr     x9, =console_out
        add     x9, x9, ans_txt_len
        add     x0, x9, x0
        b       console_eval_line

console_eval_err:
        ldr     x9, =err_tab
        add     x9, x9, x20, lsl 3
        ldr     x1, [x9]
        ldr     x0, =console_out
        bl      emit_str

console_eval_line:
        mov     w9, CHAR_LF
        strb    w9, [x0], 1
        ldr     x9, =console_out
        sub     x1, x0, x9
        mov     x0, x9
        bl      console_write

        ldp     x19, x20, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// console_write: x1 bytes at x0, straight to stdout.
console_write:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x2, x1
        mov     x1, x0
        mov     x0, STDOUT_FILENO
        mov     x8, SYS_WRITE
        svc     0

        ldp     fp, lr, [sp], 16
        ret

// str_equal: 1 when the null-terminated strings in x0 and x1 match.
str_equal:
        ldrb    w2, [x0]
        ldrb    w3, [x1]
        cmp     w2, w3
        b.ne    str_equal_no
        cbz     w2, str_equal_yes
        add     x0, x0, 1
        add     x1, x1, 1
        b       str_equal
str_equal_yes:
        mov     w0, 1
        ret
str_equal_no:
        mov     w0, 0
        ret

// ------------------------------------------------------------------ //
// terminal handling                                                    //
//                                                                      //
// The same handshake a real-time terminal program needs: ioctl for raw  //
// mode so keys arrive unbuffered and unechoed, a non-blocking stdin so  //
// the loop never parks in read(), and nanosleep so it never spins       //
// either.                                                              //
// ------------------------------------------------------------------ //

save_terminal_settings:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, STDIN_FILENO
        mov     x1, TCGETS
        ldr     x2, =termios_orig
        mov     x8, SYS_IOCTL
        svc     0

        ldp     fp, lr, [sp], 16
        ret

set_raw_mode:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =termios_orig
        ldr     x1, =termios_raw
        mov     x2, 60
        bl      copy_bytes

        // Clearing ICANON and ECHO is what hands the program every
        // keystroke as it happens and stops the terminal printing them
        // into the middle of the drawn device.
        ldr     x0, =termios_raw
        ldr     w1, [x0, 12]
        mov     w2, ICANON
        orr     w2, w2, ECHO
        bic     w1, w1, w2
        str     w1, [x0, 12]

        mov     w1, 1
        strb    w1, [x0, 17]
        mov     w1, 0
        strb    w1, [x0, 18]

        mov     x0, STDIN_FILENO
        mov     x1, TCSETS
        ldr     x2, =termios_raw
        mov     x8, SYS_IOCTL
        svc     0

        ldp     fp, lr, [sp], 16
        ret

set_nonblocking_input:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, STDIN_FILENO
        mov     x1, F_GETFL
        mov     x8, SYS_FCNTL
        svc     0

        // Keep the original flags. Leaving a shell's stdin non-blocking
        // after exit breaks the next program that reads it.
        ldr     x9, =stdin_flags
        str     x0, [x9]

        orr     x2, x0, O_NONBLOCK
        mov     x0, STDIN_FILENO
        mov     x1, F_SETFL
        mov     x8, SYS_FCNTL
        svc     0

        ldp     fp, lr, [sp], 16
        ret

restore_terminal_settings:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =stdin_flags
        ldr     x2, [x9]
        mov     x0, STDIN_FILENO
        mov     x1, F_SETFL
        mov     x8, SYS_FCNTL
        svc     0

        mov     x0, STDIN_FILENO
        mov     x1, TCSETS
        ldr     x2, =termios_orig
        mov     x8, SYS_IOCTL
        svc     0

        ldp     fp, lr, [sp], 16
        ret

poll_sleep:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =sleep_time
        mov     x1, 0
        mov     x8, SYS_NANOSLEEP
        svc     0

        ldp     fp, lr, [sp], 16
        ret

// ------------------------------------------------------------------ //
// buffer helpers                                                       //
//                                                                      //
// The four below are the only functions in the file without a frame:    //
// each is a leaf with no call inside it to protect one from.            //
// ------------------------------------------------------------------ //

// copy_bytes: x2 bytes from x0 to x1, leaving x1 past the last one.
copy_bytes:
        cbz     x2, copy_bytes_done
copy_bytes_loop:
        ldrb    w3, [x0], 1
        strb    w3, [x1], 1
        subs    x2, x2, 1
        b.ne    copy_bytes_loop
copy_bytes_done:
        ret

// emit_bytes: append x2 bytes from x1 to the output cursor in x0 and
// hand back the advanced cursor. Every painter stages its update through
// this and issues a single write at the end.
emit_bytes:
        cbz     x2, emit_bytes_done
emit_bytes_loop:
        ldrb    w3, [x1], 1
        strb    w3, [x0], 1
        subs    x2, x2, 1
        b.ne    emit_bytes_loop
emit_bytes_done:
        ret

// emit_str: append the null-terminated string in x1 to the cursor in x0.
emit_str:
        ldrb    w3, [x1]
        cbz     w3, emit_str_done
        strb    w3, [x0], 1
        add     x1, x1, 1
        b       emit_str
emit_str_done:
        ret

// emit_spaces: append x1 blanks to the cursor in x0.
emit_spaces:
        cbz     x1, emit_spaces_done
emit_spaces_loop:
        mov     w3, ' '
        strb    w3, [x0], 1
        subs    x1, x1, 1
        b.ne    emit_spaces_loop
emit_spaces_done:
        ret

// emit_num: append w1 as decimal digits, for the one and two digit
// numbers a cursor address is made of.
emit_num:
        cmp     w1, 10
        b.lt    emit_num_one
        mov     w2, 10
        udiv    w3, w1, w2
        msub    w4, w3, w2, w1
        add     w3, w3, '0'
        strb    w3, [x0], 1
        add     w4, w4, '0'
        strb    w4, [x0], 1
        ret
emit_num_one:
        add     w1, w1, '0'
        strb    w1, [x0], 1
        ret

// str_len: length of the null-terminated string in x0.
str_len:
        mov     x1, x0
str_len_loop:
        ldrb    w2, [x1]
        cbz     w2, str_len_done
        add     x1, x1, 1
        b       str_len_loop
str_len_done:
        sub     x0, x1, x0
        ret

// emit_goto: append the cursor address for row w1, column w2. Addressing
// each changed cell is what makes the repaint local -- nothing clears
// the screen after the opening draw.
emit_goto:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, w1
        mov     w21, w2

        ldr     x1, =esc_csi
        mov     x2, esc_csi_len
        bl      emit_bytes

        mov     w1, w20
        bl      emit_num
        mov     w3, CHAR_SEMI
        strb    w3, [x0], 1
        mov     w1, w21
        bl      emit_num
        mov     w3, 'H'
        strb    w3, [x0], 1

        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// flush_frame: write everything the painters staged, in one syscall.
// x0 holds the end of the staged bytes.
flush_frame:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x1, =frame_out
        subs    x2, x0, x1
        b.eq    flush_frame_done
        mov     x0, STDOUT_FILENO
        mov     x8, SYS_WRITE
        svc     0
flush_frame_done:
        ldp     fp, lr, [sp], 16
        ret

// ------------------------------------------------------------------ //
// drawing                                                              //
// ------------------------------------------------------------------ //

// draw_static: the chassis, the display bezel and the empty key grid,
// drawn once. Nothing below ever repaints them, so the borders cannot
// flicker. The caps and the display fill in on the first repaint.
draw_static:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =frame_out

        ldr     x1, =enter_screen
        mov     x2, enter_screen_len
        bl      emit_bytes
        ldr     x1, =chassis
        mov     x2, chassis_len
        bl      emit_bytes

        // The one word on the device that is not a key.
        mov     w1, BRAND_ROW
        mov     w2, LCD_COL
        bl      emit_goto
        ldr     x1, =brand_txt
        mov     x2, brand_txt_len
        bl      emit_bytes

        bl      flush_frame

        ldp     fp, lr, [sp], 16
        ret

// leave_screen: put the cursor back, park it under the device and leave
// one clean line, so the shell prompt does not land inside the frame.
leave_screen:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =frame_out
        mov     w1, HINT_ROW
        mov     w2, 1
        bl      emit_goto
        ldr     x1, =leave_seq
        mov     x2, leave_seq_len
        bl      emit_bytes
        bl      flush_frame

        ldp     fp, lr, [sp], 16
        ret

// repaint: stage every part of the device whose state moved since the
// last poll, then hand the whole update to one write. An idle poll
// writes nothing at all.
repaint:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        ldr     x9, =dirty_flags
        ldr     w20, [x9]
        cbz     w20, repaint_done
        str     wzr, [x9]

        ldr     x0, =frame_out

        tst     w20, DIRTY_DISPLAY
        b.eq    repaint_tape
        bl      paint_display
repaint_tape:
        tst     w20, DIRTY_TAPE
        b.eq    repaint_keys
        bl      paint_tape
repaint_keys:
        tst     w20, DIRTY_KEYS
        b.eq    repaint_flush
        bl      paint_dirty_keys
repaint_flush:
        bl      flush_frame

repaint_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// paint_display: the three rows inside the bezel -- the lamp strip, the
// working line, and the reading.
paint_display:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      paint_indicators
        bl      paint_entry_line
        bl      paint_result_line

        ldp     fp, lr, [sp], 16
        ret

// paint_indicators: every lamp is always drawn. A lamp that is off goes
// dim rather than blank, so the strip never reflows under you.
paint_indicators:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w1, IND_ROW
        mov     w2, LCD_COL
        bl      emit_goto

        ldr     x9, =deg_mode
        ldr     w20, [x9]
        ldr     x1, =lamp_deg
        mov     w2, w20
        bl      emit_lamp
        mov     x1, 1
        bl      emit_spaces
        ldr     x1, =lamp_rad
        eor     w2, w20, 1
        bl      emit_lamp
        mov     x1, 3
        bl      emit_spaces

        // The M lamp answers the only question memory raises: is there
        // anything in it? The staging cursor has to be parked first --
        // memory_is_set answers in x0, which is where the cursor lives.
        mov     x21, x0
        bl      memory_is_set
        mov     w2, w0
        mov     x0, x21
        ldr     x1, =lamp_m
        bl      emit_lamp
        mov     x1, 3
        bl      emit_spaces

        ldr     x9, =expr_mode
        ldr     w20, [x9]
        ldr     x1, =lamp_imm
        eor     w2, w20, 1
        bl      emit_lamp
        mov     x1, 1
        bl      emit_spaces
        ldr     x1, =lamp_expr
        mov     w2, w20
        bl      emit_lamp
        mov     x1, 20
        bl      emit_spaces

        ldr     x9, =err_code
        ldr     w9, [x9]
        cmp     w9, 0
        cset    w2, ne
        ldr     x1, =lamp_err
        bl      emit_err_lamp
        mov     x1, 2
        bl      emit_spaces

        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// emit_lamp: the word in x1, lit amber when w2 is set and dim otherwise.
emit_lamp:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     x20, x1
        cbz     w2, emit_lamp_off
        ldr     x1, =col_lamp_on
        mov     x2, col_lamp_on_len
        b       emit_lamp_text
emit_lamp_off:
        ldr     x1, =col_dim
        mov     x2, col_dim_len
emit_lamp_text:
        bl      emit_bytes
        mov     x1, x20
        bl      emit_str
        ldr     x1, =col_reset
        mov     x2, col_reset_len
        bl      emit_bytes

        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// emit_err_lamp: the same lamp in red, because an error is the one
// indicator that has to read differently from the rest at a glance.
emit_err_lamp:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     x20, x1
        cbz     w2, emit_err_lamp_off
        ldr     x1, =col_err
        mov     x2, col_err_len
        b       emit_err_lamp_text
emit_err_lamp_off:
        ldr     x1, =col_dim
        mov     x2, col_dim_len
emit_err_lamp_text:
        bl      emit_bytes
        mov     x1, x20
        bl      emit_str
        ldr     x1, =col_reset
        mov     x2, col_reset_len
        bl      emit_bytes

        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// paint_entry_line: the working line. In immediate mode it grows into a
// running record of the chain ("12 + 5"); in expression mode it is the
// expression itself. Either way it is what you typed, kept dim so the
// reading below stays the loud thing on the device.
paint_entry_line:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w1, ENTRY_ROW
        mov     w2, LCD_COL
        bl      emit_goto
        ldr     x1, =col_entry
        mov     x2, col_entry_len
        bl      emit_bytes

        // Assemble the visible text once so the alignment below only has
        // to count it.
        mov     x21, x0
        ldr     x20, =work_txt
        mov     x0, x20
        ldr     x1, =line_buf
        ldr     x9, =line_len
        ldr     w2, [x9]
        bl      emit_bytes
        ldr     x1, =entry_buf
        ldr     x9, =entry_len
        ldr     w2, [x9]
        bl      emit_bytes
        sub     x2, x0, x20

        mov     x0, x21
        mov     x1, x20
        bl      emit_right
        ldr     x1, =col_reset
        mov     x2, col_reset_len
        bl      emit_bytes

        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// paint_result_line: the reading. An error takes this line over
// entirely, in red, which is the whole of the ERR state a person needs.
paint_result_line:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w1, RESULT_ROW
        mov     w2, LCD_COL
        bl      emit_goto

        ldr     x9, =err_code
        ldr     w9, [x9]
        cbnz    w9, paint_result_err

        ldr     x1, =col_result
        mov     x2, col_result_len
        bl      emit_bytes

        ldr     x9, =entry_active
        ldr     w9, [x9]
        cbz     w9, paint_result_stored
        ldr     x1, =entry_buf
        ldr     x9, =entry_len
        ldr     w2, [x9]
        b       paint_result_text
paint_result_stored:
        ldr     x1, =disp_txt
        ldr     x9, =disp_len
        ldr     w2, [x9]
        b       paint_result_text

paint_result_err:
        ldr     x1, =col_err
        mov     x2, col_err_len
        bl      emit_bytes
        mov     x21, x0
        ldr     x9, =err_tab
        ldr     x10, =err_code
        ldr     w10, [x10]
        add     x9, x9, x10, lsl 3
        ldr     x20, [x9]
        mov     x0, x20
        bl      str_len
        mov     x2, x0
        mov     x0, x21
        mov     x1, x20

paint_result_text:
        bl      emit_right
        ldr     x1, =col_reset
        mov     x2, col_reset_len
        bl      emit_bytes

        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// emit_right: x2 bytes at x1, right-aligned in the display window. Text
// wider than the window keeps its tail, the way a device scrolls what
// you are still typing into view.
emit_right:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     x20, x1
        mov     x21, x2

        cmp     x21, LCD_WIDTH
        b.le    emit_right_pad
        sub     x9, x21, LCD_WIDTH
        add     x20, x20, x9
        mov     x21, LCD_WIDTH
        mov     x1, 0
        b       emit_right_text
emit_right_pad:
        mov     x1, LCD_WIDTH
        sub     x1, x1, x21
emit_right_text:
        bl      emit_spaces
        mov     x1, x20
        mov     x2, x21
        bl      emit_bytes

        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// paint_tape: the three history rows. The newest calculation sits
// nearest the display and stays brighter than the two behind it.
paint_tape:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!
        stp     x22, x23, [sp, -16]!

        ldr     x9, =tape_count
        ldr     w23, [x9]
        mov     w20, 0

paint_tape_row:
        cmp     w20, 3
        b.ge    paint_tape_done

        add     w1, w20, TAPE_ROW
        mov     w2, LCD_COL
        bl      emit_goto

        cmp     w20, w23
        b.ge    paint_tape_blank

        cbz     w20, paint_tape_fresh
        ldr     x1, =col_dim
        mov     x2, col_dim_len
        b       paint_tape_colored
paint_tape_fresh:
        ldr     x1, =col_tape
        mov     x2, col_tape_len
paint_tape_colored:
        bl      emit_bytes

        ldr     x21, =tape_buf
        mov     x9, TAPE_SLOT
        madd    x21, x20, x9, x21
        ldr     x9, =tape_lens
        add     x9, x9, x20, lsl 2
        ldr     w22, [x9]

        // A line too wide for the window loses its head, not its tail:
        // the answer is the part worth keeping.
        cmp     x22, LCD_WIDTH
        b.le    paint_tape_text
        ldr     x1, =tape_cut
        mov     x2, tape_cut_len
        bl      emit_bytes
        sub     x9, x22, LCD_WIDTH
        add     x21, x21, x9
        add     x21, x21, tape_cut_len
        mov     x22, LCD_WIDTH
        sub     x22, x22, tape_cut_len
paint_tape_text:
        mov     x1, x21
        mov     x2, x22
        bl      emit_bytes
        mov     x1, LCD_WIDTH
        sub     x1, x1, x22
        bl      emit_spaces
        b       paint_tape_end

paint_tape_blank:
        // The empty tape says so on its middle row instead of leaving a
        // hole in the chassis.
        ldr     x1, =col_dim
        mov     x2, col_dim_len
        bl      emit_bytes
        cmp     w20, 1
        b.ne    paint_tape_empty_pad
        ldr     x1, =tape_empty
        mov     x2, tape_empty_len
        bl      emit_bytes
        mov     x1, LCD_WIDTH
        sub     x1, x1, tape_empty_len
        bl      emit_spaces
        b       paint_tape_end
paint_tape_empty_pad:
        mov     x1, LCD_WIDTH
        bl      emit_spaces

paint_tape_end:
        ldr     x1, =col_reset
        mov     x2, col_reset_len
        bl      emit_bytes
        add     w20, w20, 1
        b       paint_tape_row

paint_tape_done:
        ldp     x22, x23, [sp], 16
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// paint_dirty_keys: only the caps whose look changed. Moving the
// highlight one square repaints two cells, not forty.
paint_dirty_keys:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, 0
paint_dirty_keys_loop:
        cmp     w20, KEY_COUNT
        b.ge    paint_dirty_keys_done
        ldr     x9, =key_dirty
        ldrb    w21, [x9, x20]
        cbz     w21, paint_dirty_keys_next
        strb    wzr, [x9, x20]
        mov     w1, w20
        bl      paint_key
paint_dirty_keys_next:
        add     w20, w20, 1
        b       paint_dirty_keys_loop

paint_dirty_keys_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// paint_key: one cap, at key index w1. A cap has three looks -- resting
// in its own colour, lit amber for the moment after you type it, and
// held under the cyan navigation highlight.
paint_key:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!
        stp     x22, x23, [sp, -16]!

        mov     w20, w1

        mov     w9, KEY_COLS
        udiv    w21, w20, w9
        msub    w22, w21, w9, w20

        lsl     w1, w21, 1
        add     w1, w1, KEY_ROW0
        mov     w9, KEY_PITCH
        mul     w2, w22, w9
        add     w2, w2, LCD_COL
        bl      emit_goto

        ldr     x9, =flash_key
        ldr     w9, [x9]
        cmp     w9, w20
        b.ne    paint_key_sel
        ldr     x1, =col_flash
        mov     x2, col_flash_len
        b       paint_key_face
paint_key_sel:
        ldr     x9, =sel_key
        ldr     w9, [x9]
        cmp     w9, w20
        b.ne    paint_key_rest
        ldr     x1, =col_select
        mov     x2, col_select_len
        b       paint_key_face
paint_key_rest:
        ldr     x9, =key_actions
        ldrb    w9, [x9, x20]
        bl      key_colour

paint_key_face:
        bl      emit_bytes
        ldr     x1, =key_labels
        mov     x9, KEY_WIDTH
        madd    x1, x20, x9, x1
        mov     x2, KEY_WIDTH
        bl      emit_bytes
        ldr     x1, =col_reset
        mov     x2, col_reset_len
        bl      emit_bytes

        ldp     x22, x23, [sp], 16
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// key_colour: the resting colour for the action in w9. Colour carries
// the same grouping the layout does -- white for what you enter, amber
// for what combines it, red for what throws it away, cyan for the
// functions.
key_colour:
        cmp     w9, ACT_SIGN
        b.le    key_colour_entry
        cmp     w9, ACT_EQ
        b.le    key_colour_op
        cmp     w9, ACT_BSP
        b.le    key_colour_clear
        ldr     x1, =col_func
        mov     x2, col_func_len
        ret
key_colour_entry:
        ldr     x1, =col_digit
        mov     x2, col_digit_len
        ret
key_colour_op:
        ldr     x1, =col_op
        mov     x2, col_op_len
        ret
key_colour_clear:
        ldr     x1, =col_clear
        mov     x2, col_clear_len
        ret

// mark_key: queue one cap for repaint. A negative index means there is
// no cap to queue, which is how "nothing is flashing" is spelled.
mark_key:
        cmp     w0, 0
        b.lt    mark_key_done
        cmp     w0, KEY_COUNT
        b.ge    mark_key_done
        ldr     x9, =key_dirty
        mov     w10, 1
        strb    w10, [x9, x0]
        ldr     x9, =dirty_flags
        ldr     w10, [x9]
        orr     w10, w10, DIRTY_KEYS
        str     w10, [x9]
mark_key_done:
        ret

mark_display:
        ldr     x9, =dirty_flags
        ldr     w10, [x9]
        orr     w10, w10, DIRTY_DISPLAY
        str     w10, [x9]
        ret

mark_tape:
        ldr     x9, =dirty_flags
        ldr     w10, [x9]
        orr     w10, w10, DIRTY_TAPE
        str     w10, [x9]
        ret

mark_all:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        bl      mark_display
        bl      mark_tape
        mov     w20, 0
mark_all_keys:
        cmp     w20, KEY_COUNT
        b.ge    mark_all_done
        mov     w0, w20
        bl      mark_key
        add     w20, w20, 1
        b       mark_all_keys
mark_all_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// ------------------------------------------------------------------ //
// input                                                                //
// ------------------------------------------------------------------ //

// poll_input: drain whatever stdin has and feed it through the escape
// state machine. An arrow key arrives as three bytes that may or may not
// land in the same read, which is why that state lives outside the call.
poll_input:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     x0, STDIN_FILENO
        ldr     x1, =key_in
        mov     x2, 16
        mov     x8, SYS_READ
        svc     0

        cmp     x0, 0
        b.le    poll_input_done
        mov     x21, x0
        mov     x20, 0
poll_input_loop:
        cmp     x20, x21
        b.ge    poll_input_done
        ldr     x9, =key_in
        ldrb    w0, [x9, x20]
        bl      feed_byte
        add     x20, x20, 1
        b       poll_input_loop

poll_input_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

feed_byte:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, w0
        ldr     x9, =esc_state
        ldr     w21, [x9]

        cmp     w21, 1
        b.eq    feed_byte_bracket
        cmp     w21, 2
        b.eq    feed_byte_arrow

        cmp     w20, 0x1b
        b.ne    feed_byte_plain
        ldr     x9, =esc_state
        mov     w10, 1
        str     w10, [x9]
        b       feed_byte_done

feed_byte_bracket:
        ldr     x9, =esc_state
        cmp     w20, '['
        b.ne    feed_byte_esc_drop
        mov     w10, 2
        str     w10, [x9]
        b       feed_byte_done
feed_byte_esc_drop:
        str     wzr, [x9]
        b       feed_byte_plain

feed_byte_arrow:
        ldr     x9, =esc_state
        str     wzr, [x9]
        mov     w0, w20
        bl      move_selection
        b       feed_byte_done

feed_byte_plain:
        mov     w0, w20
        bl      handle_char

feed_byte_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// move_selection: walk the highlight. It stops at the edges rather than
// wrapping, so holding an arrow never teleports it across the device.
move_selection:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!
        stp     x22, x23, [sp, -16]!

        mov     w23, w0
        ldr     x9, =sel_key
        ldr     w20, [x9]
        mov     w9, KEY_COLS
        udiv    w21, w20, w9
        msub    w22, w21, w9, w20

        cmp     w23, 'A'
        b.eq    move_selection_up
        cmp     w23, 'B'
        b.eq    move_selection_down
        cmp     w23, 'C'
        b.eq    move_selection_right
        cmp     w23, 'D'
        b.eq    move_selection_left
        b       move_selection_done

move_selection_up:
        cbz     w21, move_selection_done
        sub     w21, w21, 1
        b       move_selection_apply
move_selection_down:
        cmp     w21, (KEY_ROWS - 1)
        b.ge    move_selection_done
        add     w21, w21, 1
        b       move_selection_apply
move_selection_left:
        cbz     w22, move_selection_done
        sub     w22, w22, 1
        b       move_selection_apply
move_selection_right:
        cmp     w22, (KEY_COLS - 1)
        b.ge    move_selection_done
        add     w22, w22, 1

move_selection_apply:
        mov     w0, w20
        bl      mark_key
        mov     w9, KEY_COLS
        madd    w20, w21, w9, w22
        ldr     x9, =sel_key
        str     w20, [x9]
        mov     w0, w20
        bl      mark_key

move_selection_done:
        ldp     x22, x23, [sp], 16
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// handle_char: one typed byte. Digits and operators go straight to the
// key that carries them, which is also what lights it.
handle_char:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, w0

        cmp     w20, 'q'
        b.eq    handle_char_quit
        cmp     w20, 'Q'
        b.eq    handle_char_quit
        cmp     w20, 0x0a
        b.eq    handle_char_enter
        cmp     w20, 0x0d
        b.eq    handle_char_enter
        cmp     w20, 0x09
        b.eq    handle_char_mode

        cmp     w20, '0'
        b.lt    handle_char_symbols
        cmp     w20, '9'
        b.gt    handle_char_symbols
        sub     w0, w20, '0'
        b       handle_char_press

handle_char_symbols:
        ldr     x21, =char_map
handle_char_scan:
        ldrb    w9, [x21]
        cbz     w9, handle_char_done
        cmp     w9, w20
        b.eq    handle_char_hit
        add     x21, x21, 2
        b       handle_char_scan
handle_char_hit:
        ldrb    w0, [x21, 1]
        b       handle_char_press

handle_char_enter:
        ldr     x9, =sel_key
        ldr     w9, [x9]
        ldr     x10, =key_actions
        ldrb    w0, [x10, x9]
        b       handle_char_press

handle_char_mode:
        mov     w0, ACT_MODE
        b       handle_char_press

handle_char_quit:
        ldr     x9, =quit_flag
        mov     w10, 1
        str     w10, [x9]
        b       handle_char_done

handle_char_press:
        bl      press_action

handle_char_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// press_action: light the key that carries this action, then run it.
press_action:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, w0
        bl      flash_action
        mov     w0, w20
        bl      key_press

        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// flash_action: find the cap carrying action w0 and light it.
flash_action:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, w0
        mov     w21, 0
flash_action_scan:
        cmp     w21, KEY_COUNT
        b.ge    flash_action_done
        ldr     x9, =key_actions
        ldrb    w9, [x9, x21]
        cmp     w9, w20
        b.eq    flash_action_hit
        add     w21, w21, 1
        b       flash_action_scan

flash_action_hit:
        // The cap that was lit has to go back to its resting face before
        // the new one takes over.
        ldr     x9, =flash_key
        ldr     w0, [x9]
        mov     w10, -1
        str     w10, [x9]
        bl      mark_key
        ldr     x9, =flash_key
        str     w21, [x9]
        ldr     x9, =flash_ticks
        mov     w10, FLASH_POLLS
        str     w10, [x9]
        mov     w0, w21
        bl      mark_key

flash_action_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

tick_flash:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =flash_ticks
        ldr     w0, [x9]
        cbz     w0, tick_flash_done
        sub     w0, w0, 1
        str     w0, [x9]
        cbnz    w0, tick_flash_done
        ldr     x9, =flash_key
        ldr     w0, [x9]
        mov     w10, -1
        str     w10, [x9]
        bl      mark_key

tick_flash_done:
        ldp     fp, lr, [sp], 16
        ret

// ------------------------------------------------------------------ //
// key actions                                                          //
// ------------------------------------------------------------------ //

// key_press: the one door every key goes through, however it was
// pressed. An error locks the device to C and AC, the way a calculator
// refuses to carry on until you acknowledge it.
key_press:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, w0

        ldr     x9, =err_code
        ldr     w9, [x9]
        cbz     w9, key_press_live
        cmp     w20, ACT_C
        b.eq    key_press_live
        cmp     w20, ACT_AC
        b.eq    key_press_live
        b       key_press_done

key_press_live:
        cmp     w20, ACT_MODE
        b.eq    key_press_mode
        cmp     w20, ACT_DRG
        b.eq    key_press_drg
        cmp     w20, ACT_C
        b.eq    key_press_clear
        cmp     w20, ACT_AC
        b.eq    key_press_all
        cmp     w20, ACT_MC
        b.lt    key_press_route
        cmp     w20, ACT_MMINUS
        b.gt    key_press_route
        mov     w0, w20
        bl      memory_key
        b       key_press_done

key_press_route:
        ldr     x9, =expr_mode
        ldr     w9, [x9]
        mov     w0, w20
        cbz     w9, key_press_immediate
        bl      expr_key
        b       key_press_done
key_press_immediate:
        bl      imm_key
        b       key_press_done

key_press_mode:
        // Switching entry style mid-calculation would strand half a
        // chain, so the mode key starts clean.
        ldr     x9, =expr_mode
        ldr     w10, [x9]
        eor     w10, w10, 1
        str     w10, [x9]
        bl      clear_all
        bl      mark_display
        b       key_press_done

key_press_drg:
        ldr     x9, =deg_mode
        ldr     w10, [x9]
        eor     w10, w10, 1
        str     w10, [x9]
        bl      mark_display
        b       key_press_done

key_press_clear:
        // An error killed the calculation, so C ends it rather than
        // handing back a chain that can no longer be finished.
        ldr     x9, =err_code
        ldr     w9, [x9]
        cbnz    w9, key_press_all
        bl      clear_entry
        bl      mark_display
        b       key_press_done

key_press_all:
        bl      clear_all
        bl      mark_display

key_press_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// clear_entry: C. It takes back what you are typing and nothing else --
// the pending operator and the running total survive.
clear_entry:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =entry_len
        str     wzr, [x9]
        ldr     x9, =entry_buf
        strb    wzr, [x9]
        ldr     x9, =entry_active
        str     wzr, [x9]
        ldr     x9, =operand_ready
        str     wzr, [x9]
        ldr     x9, =err_code
        str     wzr, [x9]

        // In expression mode the expression is the entry, so C takes the
        // whole line.
        ldr     x9, =expr_mode
        ldr     w9, [x9]
        cbz     w9, clear_entry_done
        ldr     x9, =line_len
        str     wzr, [x9]
        ldr     x9, =line_buf
        strb    wzr, [x9]
        ldr     x9, =just_eq
        str     wzr, [x9]

clear_entry_done:
        ldp     fp, lr, [sp], 16
        ret

// clear_all: AC. The whole calculation goes; memory and the tape stay,
// because memory belongs to MC and the tape is a record, not a state.
clear_all:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =entry_len
        str     wzr, [x9]
        ldr     x9, =entry_buf
        strb    wzr, [x9]
        ldr     x9, =entry_active
        str     wzr, [x9]
        ldr     x9, =line_len
        str     wzr, [x9]
        ldr     x9, =line_buf
        strb    wzr, [x9]
        ldr     x9, =pend_op
        str     wzr, [x9]
        ldr     x9, =just_eq
        str     wzr, [x9]
        ldr     x9, =operand_ready
        str     wzr, [x9]
        ldr     x9, =err_code
        str     wzr, [x9]
        ldr     x9, =seg_start
        str     wzr, [x9]

        ldr     x9, =zero_m
        ldr     d0, [x9]
        ldr     x9, =acc_m
        str     d0, [x9]
        bl      set_value

        ldp     fp, lr, [sp], 16
        ret

// reset_all: the state the device wakes up in.
reset_all:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =zero_m
        ldr     d0, [x9]
        ldr     x9, =mem_m
        str     d0, [x9]
        ldr     x9, =tape_count
        str     wzr, [x9]
        ldr     x9, =deg_mode
        mov     w10, 1
        str     w10, [x9]
        ldr     x9, =expr_mode
        str     wzr, [x9]
        ldr     x9, =flash_key
        mov     w10, -1
        str     w10, [x9]

        bl      clear_all
        bl      mark_all

        ldp     fp, lr, [sp], 16
        ret

// set_err: an error takes the reading over and stops the chain there.
set_err:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =err_code
        str     w0, [x9]
        ldr     x9, =entry_active
        str     wzr, [x9]
        ldr     x9, =entry_len
        str     wzr, [x9]
        ldr     x9, =pend_op
        str     wzr, [x9]
        ldr     x9, =operand_ready
        str     wzr, [x9]
        bl      mark_display

        ldp     fp, lr, [sp], 16
        ret

// memory_key: MC, MR, M+ and M-, identical in both entry modes except
// for where MR puts what it recalls.
memory_key:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, w0

        cmp     w20, ACT_MC
        b.eq    memory_key_clear
        cmp     w20, ACT_MR
        b.eq    memory_key_recall

        bl      current_value
        ldr     x9, =mem_m
        ldr     d1, [x9]
        cmp     w20, ACT_MPLUS
        b.eq    memory_key_add
        fsub    d0, d1, d0
        b       memory_key_store
memory_key_add:
        fadd    d0, d1, d0
memory_key_store:
        ldr     x9, =mem_m
        str     d0, [x9]
        // Banking the reading also finishes it, so the next digit opens a
        // fresh entry instead of extending the one just stored.
        bl      current_value
        bl      set_value
        bl      mark_display
        b       memory_key_done

memory_key_clear:
        ldr     x9, =zero_m
        ldr     d0, [x9]
        ldr     x9, =mem_m
        str     d0, [x9]
        bl      mark_display
        b       memory_key_done

memory_key_recall:
        ldr     x9, =mem_m
        ldr     d0, [x9]
        ldr     x9, =expr_mode
        ldr     w9, [x9]
        cbnz    w9, memory_key_recall_expr

        bl      line_prepare
        bl      set_value
        ldr     x0, =disp_txt
        ldr     x9, =disp_len
        ldr     w1, [x9]
        bl      seg_replace
        ldr     x9, =operand_ready
        mov     w10, 1
        str     w10, [x9]
        bl      mark_display
        b       memory_key_done

memory_key_recall_expr:
        ldr     x0, =scratch_txt
        bl      format_double
        mov     w0, ACT_MR
        bl      expr_prepare
        ldr     x0, =scratch_txt
        bl      expr_append
        bl      mark_display

memory_key_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

memory_is_set:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =mem_m
        ldr     d0, [x9]
        ldr     x9, =zero_m
        ldr     d1, [x9]
        fcmp    d0, d1
        cset    w0, ne

        ldp     fp, lr, [sp], 16
        ret

// ------------------------------------------------------------------ //
// immediate mode -- a pocket calculator that chains                    //
// ------------------------------------------------------------------ //

imm_key:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, w0

        cmp     w20, ACT_D9
        b.le    imm_key_digit
        cmp     w20, ACT_DOT
        b.eq    imm_key_dot
        cmp     w20, ACT_SIGN
        b.eq    imm_key_sign
        cmp     w20, ACT_ADD
        b.eq    imm_key_add
        cmp     w20, ACT_SUB
        b.eq    imm_key_sub
        cmp     w20, ACT_MUL
        b.eq    imm_key_mul
        cmp     w20, ACT_DIV
        b.eq    imm_key_div
        cmp     w20, ACT_POW
        b.eq    imm_key_pow
        cmp     w20, ACT_EQ
        b.eq    imm_key_equals
        cmp     w20, ACT_BSP
        b.eq    imm_key_backspace
        cmp     w20, ACT_PCT
        b.eq    imm_key_percent
        cmp     w20, ACT_PI
        b.eq    imm_key_pi

        // Everything left in the function block is unary. Parentheses
        // fall out here: they mean nothing without an expression.
        cmp     w20, ACT_SQRT
        b.lt    imm_key_done
        cmp     w20, ACT_EXPF
        b.gt    imm_key_done
        mov     w0, w20
        bl      imm_unary
        b       imm_key_done

imm_key_digit:
        mov     w0, w20
        bl      imm_digit
        b       imm_key_done
imm_key_dot:
        bl      imm_dot
        b       imm_key_done
imm_key_sign:
        bl      imm_sign
        b       imm_key_done
imm_key_add:
        mov     w0, OP_ADD
        bl      imm_binop
        b       imm_key_done
imm_key_sub:
        mov     w0, OP_SUB
        bl      imm_binop
        b       imm_key_done
imm_key_mul:
        mov     w0, OP_MUL
        bl      imm_binop
        b       imm_key_done
imm_key_div:
        mov     w0, OP_DIV
        bl      imm_binop
        b       imm_key_done
imm_key_pow:
        mov     w0, OP_POW
        bl      imm_binop
        b       imm_key_done
imm_key_equals:
        bl      imm_equals
        b       imm_key_done
imm_key_backspace:
        bl      imm_backspace
        b       imm_key_done
imm_key_percent:
        bl      imm_percent
        b       imm_key_done
imm_key_pi:
        bl      imm_pi

imm_key_done:
        bl      mark_display
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// line_prepare: a key that starts a new calculation wipes the finished
// one off the working line first.
line_prepare:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =just_eq
        ldr     w9, [x9]
        cbz     w9, line_prepare_done
        ldr     x9, =just_eq
        str     wzr, [x9]
        ldr     x9, =line_len
        str     wzr, [x9]
        ldr     x9, =line_buf
        strb    wzr, [x9]
        ldr     x9, =seg_start
        str     wzr, [x9]

line_prepare_done:
        ldp     fp, lr, [sp], 16
        ret

// seg_text: copy the current operand's text into operand_txt and return
// its length. The operand is whatever the last operator left behind --
// the digits being typed, the segment already on the line, or the stored
// reading when the line has nothing after the operator yet.
seg_text:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        ldr     x9, =entry_active
        ldr     w9, [x9]
        cbz     w9, seg_text_line
        ldr     x20, =entry_buf
        ldr     x9, =entry_len
        ldr     w21, [x9]
        b       seg_text_copy

seg_text_line:
        ldr     x9, =seg_start
        ldr     w9, [x9]
        ldr     x10, =line_len
        ldr     w10, [x10]
        subs    w21, w10, w9
        b.le    seg_text_stored
        ldr     x20, =line_buf
        add     x20, x20, x9
        b       seg_text_copy

seg_text_stored:
        ldr     x20, =disp_txt
        ldr     x9, =disp_len
        ldr     w21, [x9]

seg_text_copy:
        cmp     x21, SEG_MAX
        b.le    seg_text_run
        mov     x21, SEG_MAX
seg_text_run:
        mov     x0, x20
        ldr     x1, =operand_txt
        mov     x2, x21
        bl      copy_bytes
        strb    wzr, [x1]
        mov     x0, x21

        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// seg_replace: cut the working line back to the start of the current
// operand and put x1 bytes from x0 there instead, so a function applied
// to a function reads ln(exp(1)) rather than one appended to the other.
seg_replace:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     x20, x0
        mov     x21, x1

        ldr     x9, =seg_start
        ldr     w9, [x9]
        ldr     x10, =line_len
        str     w9, [x10]
        ldr     x10, =line_buf
        strb    wzr, [x10, x9]

        mov     x0, x20
        mov     x1, x21
        bl      line_append

        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// seg_clear: empty the current operand's slot. A fresh number replaces
// whatever finished operand is sitting there instead of running on from
// the end of it.
seg_clear:
        ldr     x9, =seg_start
        ldr     w9, [x9]
        ldr     x10, =line_len
        str     w9, [x10]
        ldr     x10, =line_buf
        strb    wzr, [x10, x9]
        ret

// seg_open: the operand about to be typed starts here.
seg_open:
        ldr     x9, =line_len
        ldr     w10, [x9]
        ldr     x9, =seg_start
        str     w10, [x9]
        ret

imm_digit:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, w0
        bl      line_prepare

        ldr     x9, =entry_active
        ldr     w9, [x9]
        cbnz    w9, imm_digit_open
        // A finished operand already in this slot is replaced, not
        // extended: after sqrt(9) reads 3, typing 5 means five.
        ldr     x9, =operand_ready
        ldr     w9, [x9]
        cbz     w9, imm_digit_fresh
        bl      seg_clear
imm_digit_fresh:
        ldr     x9, =entry_len
        str     wzr, [x9]
        ldr     x9, =entry_active
        mov     w10, 1
        str     w10, [x9]

imm_digit_open:
        // A lone leading zero is a placeholder, not a digit: typing 7
        // after it should read 7, not 07.
        ldr     x9, =entry_len
        ldr     w21, [x9]
        cmp     w21, 1
        b.ne    imm_digit_room
        ldr     x9, =entry_buf
        ldrb    w9, [x9]
        cmp     w9, '0'
        b.ne    imm_digit_room
        mov     w21, 0
        ldr     x9, =entry_len
        str     wzr, [x9]

imm_digit_room:
        cmp     w21, MAX_ENTRY
        b.ge    imm_digit_done
        add     w0, w20, '0'
        bl      entry_push
        ldr     x9, =operand_ready
        mov     w10, 1
        str     w10, [x9]

imm_digit_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

imm_dot:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        bl      line_prepare

        ldr     x9, =entry_active
        ldr     w9, [x9]
        cbnz    w9, imm_dot_open
        ldr     x9, =operand_ready
        ldr     w9, [x9]
        cbz     w9, imm_dot_fresh
        bl      seg_clear
imm_dot_fresh:
        // A decimal point with nothing in front of it opens "0." so the
        // entry always reads as a number.
        ldr     x9, =entry_len
        str     wzr, [x9]
        ldr     x9, =entry_active
        mov     w10, 1
        str     w10, [x9]
        mov     w0, '0'
        bl      entry_push

imm_dot_open:
        ldr     x9, =entry_len
        ldr     w20, [x9]
        mov     w21, 0
imm_dot_scan:
        cmp     w21, w20
        b.ge    imm_dot_push
        ldr     x9, =entry_buf
        ldrb    w9, [x9, x21]
        cmp     w9, '.'
        b.eq    imm_dot_done
        add     w21, w21, 1
        b       imm_dot_scan

imm_dot_push:
        cmp     w20, MAX_ENTRY
        b.ge    imm_dot_done
        mov     w0, '.'
        bl      entry_push
        ldr     x9, =operand_ready
        mov     w10, 1
        str     w10, [x9]

imm_dot_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// imm_sign: +/- flips the sign of whatever the display is showing -- the
// digits being typed if there are any, otherwise the stored value.
imm_sign:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        ldr     x9, =entry_active
        ldr     w9, [x9]
        cbz     w9, imm_sign_stored

        ldr     x9, =entry_buf
        ldrb    w9, [x9]
        cmp     w9, '-'
        b.eq    imm_sign_strip

        // Shift everything one place right and drop a minus in front.
        ldr     x9, =entry_len
        ldr     w20, [x9]
        cmp     w20, MAX_ENTRY
        b.ge    imm_sign_done
        mov     w21, w20
imm_sign_shift:
        cbz     w21, imm_sign_head
        sub     w9, w21, 1
        ldr     x10, =entry_buf
        ldrb    w11, [x10, x9]
        strb    w11, [x10, x21]
        sub     w21, w21, 1
        b       imm_sign_shift
imm_sign_head:
        ldr     x10, =entry_buf
        mov     w11, '-'
        strb    w11, [x10]
        add     w20, w20, 1
        ldr     x9, =entry_len
        str     w20, [x9]
        strb    wzr, [x10, x20]
        b       imm_sign_done

imm_sign_strip:
        ldr     x9, =entry_len
        ldr     w20, [x9]
        mov     w21, 0
imm_sign_strip_loop:
        add     w9, w21, 1
        ldr     x10, =entry_buf
        ldrb    w11, [x10, x9]
        strb    w11, [x10, x21]
        add     w21, w21, 1
        cmp     w21, w20
        b.lt    imm_sign_strip_loop
        sub     w20, w20, 1
        ldr     x9, =entry_len
        str     w20, [x9]
        b       imm_sign_done

imm_sign_stored:
        ldr     x9, =disp_m
        ldr     d0, [x9]
        fneg    d0, d0
        bl      set_value
        ldr     x9, =operand_ready
        mov     w10, 1
        str     w10, [x9]

imm_sign_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

imm_backspace:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =entry_active
        ldr     w9, [x9]
        cbz     w9, imm_backspace_done
        ldr     x9, =entry_len
        ldr     w10, [x9]
        cbz     w10, imm_backspace_done
        sub     w10, w10, 1
        str     w10, [x9]
        ldr     x9, =entry_buf
        strb    wzr, [x9, x10]
        cbnz    w10, imm_backspace_done
        // Deleting the last character leaves nothing to read, so the
        // stored value takes the display back.
        ldr     x9, =entry_active
        str     wzr, [x9]
        ldr     x9, =operand_ready
        str     wzr, [x9]

imm_backspace_done:
        ldp     fp, lr, [sp], 16
        ret

// commit_entry: move what is on the entry onto the working line, so the
// line always reads as the calculation so far.
commit_entry:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =just_eq
        ldr     w9, [x9]
        cbz     w9, commit_entry_typed
        ldr     x9, =just_eq
        str     wzr, [x9]
        ldr     x9, =line_len
        str     wzr, [x9]
        ldr     x9, =seg_start
        str     wzr, [x9]
        ldr     x0, =disp_txt
        ldr     x9, =disp_len
        ldr     w1, [x9]
        bl      line_append
        b       commit_entry_done

commit_entry_typed:
        ldr     x9, =entry_active
        ldr     w9, [x9]
        cbz     w9, commit_entry_stored
        ldr     x0, =entry_buf
        ldr     x9, =entry_len
        ldr     w1, [x9]
        bl      line_append
        b       commit_entry_done

commit_entry_stored:
        // Nothing typed and nothing on the line yet: the stored reading
        // is the operand, so it opens the record.
        ldr     x9, =line_len
        ldr     w9, [x9]
        cbnz    w9, commit_entry_done
        ldr     x0, =disp_txt
        ldr     x9, =disp_len
        ldr     w1, [x9]
        bl      line_append

commit_entry_done:
        ldp     fp, lr, [sp], 16
        ret

imm_binop:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, w0

        // Two operators in a row mean you changed your mind about the
        // first, so it is replaced rather than stacked.
        ldr     x9, =pend_op
        ldr     w9, [x9]
        cbz     w9, imm_binop_value
        ldr     x9, =operand_ready
        ldr     w9, [x9]
        cbnz    w9, imm_binop_value
        ldr     x9, =line_len
        ldr     w10, [x9]
        cmp     w10, 3
        b.lt    imm_binop_swap
        sub     w10, w10, 3
        str     w10, [x9]
imm_binop_swap:
        ldr     x9, =pend_op
        str     w20, [x9]
        mov     w0, w20
        bl      line_append_op
        bl      seg_open
        b       imm_binop_done

imm_binop_value:
        bl      current_value
        ldr     x9, =scratch_m
        str     d0, [x9]
        bl      commit_entry

        ldr     x9, =pend_op
        ldr     w21, [x9]
        cbz     w21, imm_binop_first

        ldr     x9, =scratch_m
        ldr     d1, [x9]
        ldr     x9, =acc_m
        ldr     d0, [x9]
        mov     w0, w21
        bl      apply_binary
        cbz     w0, imm_binop_fold
        bl      set_err
        b       imm_binop_done
imm_binop_fold:
        ldr     x9, =acc_m
        str     d0, [x9]
        bl      set_value
        b       imm_binop_arm

imm_binop_first:
        ldr     x9, =scratch_m
        ldr     d0, [x9]
        ldr     x9, =acc_m
        str     d0, [x9]
        bl      set_value

imm_binop_arm:
        ldr     x9, =pend_op
        str     w20, [x9]
        ldr     x9, =operand_ready
        str     wzr, [x9]
        mov     w0, w20
        bl      line_append_op
        bl      seg_open

imm_binop_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

imm_equals:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        // A second equals has nothing left to finish, so it does nothing
        // rather than logging the answer against itself.
        ldr     x9, =just_eq
        ldr     w9, [x9]
        cbz     w9, imm_equals_run
        ldr     x9, =pend_op
        ldr     w9, [x9]
        cbz     w9, imm_equals_done

imm_equals_run:
        bl      current_value
        ldr     x9, =scratch_m
        str     d0, [x9]
        bl      commit_entry

        ldr     x9, =pend_op
        ldr     w20, [x9]
        cbz     w20, imm_equals_plain

        ldr     x9, =scratch_m
        ldr     d1, [x9]
        ldr     x9, =acc_m
        ldr     d0, [x9]
        mov     w0, w20
        bl      apply_binary
        cbz     w0, imm_equals_store
        bl      set_err
        b       imm_equals_done

imm_equals_plain:
        ldr     x9, =scratch_m
        ldr     d0, [x9]

imm_equals_store:
        ldr     x9, =acc_m
        str     d0, [x9]
        bl      set_value
        bl      tape_from_line

        ldr     x0, =txt_eq_tail
        mov     x1, txt_eq_tail_len
        bl      line_append
        ldr     x9, =pend_op
        str     wzr, [x9]
        ldr     x9, =operand_ready
        str     wzr, [x9]
        ldr     x9, =just_eq
        mov     w10, 1
        str     w10, [x9]

imm_equals_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// imm_unary: a function key acts on the reading the moment it is
// pressed, and the working line records the call as sqrt(2) rather than
// letting a new number appear from nowhere.
imm_unary:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!
        stp     x22, x23, [sp, -16]!

        mov     w20, w0

        // Take the operand and its text before the value underneath them
        // changes.
        bl      current_value
        ldr     x9, =scratch_m
        str     d0, [x9]
        bl      line_prepare
        bl      seg_text
        mov     x21, x0

        ldr     x9, =scratch_m
        ldr     d0, [x9]
        mov     w0, w20
        bl      apply_unary
        cbz     w0, imm_unary_ok
        bl      set_err
        b       imm_unary_done

imm_unary_ok:
        bl      set_value

        // Build the record of the call once and use it for both the
        // working line and the tape.
        sub     w22, w20, ACT_SQRT
        ldr     x9, =unary_txt
        add     x9, x9, x22, lsl 4
        ldr     x22, [x9]
        ldr     x23, [x9, 8]

        ldr     x0, =segment_txt
        mov     x1, x22
        bl      emit_str
        ldr     x1, =operand_txt
        mov     x2, x21
        bl      emit_bytes
        mov     x1, x23
        bl      emit_str
        ldr     x9, =segment_txt
        sub     x21, x0, x9

        ldr     x0, =segment_txt
        mov     x1, x21
        bl      seg_replace
        ldr     x0, =segment_txt
        mov     x1, x21
        bl      tape_from_segment

        ldr     x9, =operand_ready
        mov     w10, 1
        str     w10, [x9]

imm_unary_done:
        ldp     x22, x23, [sp], 16
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// imm_percent: the convention a pocket calculator ships. After + or -,
// a percent is a percent OF the running total, so 200 + 10 % is 220.
// After * or / -- and with nothing pending at all -- it is a plain
// divide by a hundred, so 200 * 10 % is 20 and 50 % on its own is 0.5.
imm_percent:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        bl      current_value
        ldr     x9, =scratch_m
        str     d0, [x9]
        bl      line_prepare
        bl      seg_text
        mov     x21, x0

        ldr     x9, =scratch_m
        ldr     d0, [x9]
        ldr     x9, =hundred_m
        ldr     d1, [x9]
        fdiv    d0, d0, d1

        // Only the additive operators scale by the running total. After
        // a multiply, a divide or a power the hundredth stands on its
        // own, which is what 200 * 10 % = 20 means on a real device.
        ldr     x9, =pend_op
        ldr     w9, [x9]
        cbz     w9, imm_percent_store
        cmp     w9, OP_SUB
        b.gt    imm_percent_store
        ldr     x9, =operand_ready
        ldr     w9, [x9]
        cbz     w9, imm_percent_store
        ldr     x9, =acc_m
        ldr     d1, [x9]
        fmul    d0, d0, d1

imm_percent_store:
        bl      set_value

        ldr     x0, =segment_txt
        ldr     x1, =operand_txt
        mov     x2, x21
        bl      emit_bytes
        mov     w9, '%'
        strb    w9, [x0], 1
        ldr     x9, =segment_txt
        sub     x1, x0, x9
        mov     x0, x9
        bl      seg_replace

        ldr     x9, =operand_ready
        mov     w10, 1
        str     w10, [x9]

        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

imm_pi:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      line_prepare
        ldr     x9, =pi_m
        ldr     d0, [x9]
        bl      set_value
        ldr     x0, =txt_pi
        mov     x1, txt_pi_len
        bl      seg_replace
        ldr     x9, =operand_ready
        mov     w10, 1
        str     w10, [x9]

        ldp     fp, lr, [sp], 16
        ret

// ------------------------------------------------------------------ //
// expression mode -- precedence and parentheses                        //
// ------------------------------------------------------------------ //

expr_key:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, w0

        cmp     w20, ACT_EQ
        b.eq    expr_key_equals
        cmp     w20, ACT_BSP
        b.eq    expr_key_backspace

        ldr     x9, =expr_ins
        add     x9, x9, x20, lsl 3
        ldr     x21, [x9]
        cbz     x21, expr_key_done

        mov     w0, w20
        bl      expr_prepare
        mov     x0, x21
        bl      expr_append
        b       expr_key_done

expr_key_equals:
        bl      expr_evaluate
        b       expr_key_done

expr_key_backspace:
        ldr     x9, =line_len
        ldr     w10, [x9]
        cbz     w10, expr_key_done
        sub     w10, w10, 1
        str     w10, [x9]
        ldr     x9, =line_buf
        strb    wzr, [x9, x10]

expr_key_done:
        bl      mark_display
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// expr_prepare: typing after an evaluated expression starts the next
// one. An operator is the exception -- it carries the answer forward, so
// you can keep working from what you just got.
expr_prepare:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, w0
        ldr     x9, =just_eq
        ldr     w9, [x9]
        cbz     w9, expr_prepare_done

        ldr     x9, =just_eq
        str     wzr, [x9]
        ldr     x9, =line_len
        str     wzr, [x9]
        ldr     x9, =line_buf
        strb    wzr, [x9]

        cmp     w20, ACT_ADD
        b.lt    expr_prepare_done
        cmp     w20, ACT_DIV
        b.le    expr_prepare_carry
        cmp     w20, ACT_PCT
        b.eq    expr_prepare_carry
        cmp     w20, ACT_POW
        b.ne    expr_prepare_done

expr_prepare_carry:
        ldr     x0, =disp_txt
        ldr     x9, =disp_len
        ldr     w1, [x9]
        bl      line_append

expr_prepare_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// expr_append: put the null-terminated text in x0 on the expression, as
// long as the whole of it still fits inside the entry cap.
expr_append:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     x20, x0
        bl      str_len
        mov     x21, x0
        ldr     x9, =line_len
        ldr     w9, [x9]
        add     x9, x9, x21
        cmp     x9, MAX_EXPR
        b.gt    expr_append_done
        mov     x0, x20
        mov     x1, x21
        bl      line_append

expr_append_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// expr_evaluate: parse the whole line, and only take the answer if the
// parser consumed all of it.
expr_evaluate:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x19, x20, [sp, -16]!

        ldr     x9, =line_len
        ldr     w9, [x9]
        cbz     w9, expr_evaluate_done
        // The line already carries its own trailing "=", so a second
        // press would only feed that back to the parser.
        ldr     x9, =just_eq
        ldr     w9, [x9]
        cbnz    w9, expr_evaluate_done

        ldr     x9, =parse_err
        str     wzr, [x9]
        ldr     x9, =parse_depth
        str     wzr, [x9]
        ldr     cursor_r, =line_buf

        bl      parse_expr

        bl      skip_spaces
        ldrb    w9, [cursor_r]
        cbz     w9, expr_evaluate_check
        ldr     x9, =parse_err
        mov     w10, ERR_SYNTAX
        str     w10, [x9]

expr_evaluate_check:
        ldr     x9, =parse_err
        ldr     w20, [x9]
        cbz     w20, expr_evaluate_range
        mov     w0, w20
        bl      set_err
        b       expr_evaluate_done

expr_evaluate_range:
        bl      check_result
        cbz     w0, expr_evaluate_ok
        bl      set_err
        b       expr_evaluate_done

expr_evaluate_ok:
        bl      set_value
        bl      tape_from_line
        ldr     x0, =txt_eq_tail
        mov     x1, txt_eq_tail_len
        bl      line_append
        ldr     x9, =just_eq
        mov     w10, 1
        str     w10, [x9]

expr_evaluate_done:
        ldp     x19, x20, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// Every parser level parks its left operand in its own frame while the
// level below recurses, so they all take the same sixteen-byte local.
parse_alloc = -(16 + 16) & -16
parse_dealloc = -parse_alloc
lhs_s = 16

// parse_expr: addition and subtraction, the loosest binding.
parse_expr:
        stp     fp, lr, [sp, parse_alloc]!
        mov     fp, sp

        // A wall of open parentheses would otherwise recurse until the
        // stack ran out.
        ldr     x9, =parse_depth
        ldr     w10, [x9]
        add     w10, w10, 1
        str     w10, [x9]
        cmp     w10, 32
        b.gt    parse_expr_too_deep

        bl      parse_term
parse_expr_loop:
        str     d0, [fp, lhs_s]
        bl      skip_spaces
        ldrb    w9, [cursor_r]
        cmp     w9, '+'
        b.eq    parse_expr_add
        cmp     w9, '-'
        b.eq    parse_expr_sub
        ldr     d0, [fp, lhs_s]
        b       parse_expr_done

parse_expr_add:
        add     cursor_r, cursor_r, 1
        bl      parse_term
        ldr     d1, [fp, lhs_s]
        bl      pct_scale
        fadd    d0, d1, d0
        b       parse_expr_loop

parse_expr_sub:
        add     cursor_r, cursor_r, 1
        bl      parse_term
        ldr     d1, [fp, lhs_s]
        bl      pct_scale
        fsub    d0, d1, d0
        b       parse_expr_loop

parse_expr_too_deep:
        ldr     x9, =parse_err
        mov     w10, ERR_SYNTAX
        str     w10, [x9]
        ldr     x9, =zero_m
        ldr     d0, [x9]

parse_expr_done:
        ldr     x9, =parse_depth
        ldr     w10, [x9]
        sub     w10, w10, 1
        str     w10, [x9]
        ldp     fp, lr, [sp], parse_dealloc
        ret

// parse_term: multiplication and division, binding tighter than the
// additive level above -- which is the whole of why 2+3*4 is 14.
parse_term:
        stp     fp, lr, [sp, parse_alloc]!
        mov     fp, sp

        bl      parse_unary
parse_term_loop:
        str     d0, [fp, lhs_s]
        bl      skip_spaces
        ldrb    w9, [cursor_r]
        cmp     w9, '*'
        b.eq    parse_term_mul
        cmp     w9, '/'
        b.eq    parse_term_div
        ldr     d0, [fp, lhs_s]
        ldp     fp, lr, [sp], parse_dealloc
        ret

parse_term_mul:
        add     cursor_r, cursor_r, 1
        bl      parse_unary
        ldr     d1, [fp, lhs_s]
        fmul    d0, d1, d0
        bl      pct_clear
        b       parse_term_loop

parse_term_div:
        add     cursor_r, cursor_r, 1
        bl      parse_unary
        ldr     x9, =zero_m
        ldr     d2, [x9]
        fcmp    d0, d2
        b.eq    parse_term_div0
        ldr     d1, [fp, lhs_s]
        fdiv    d0, d1, d0
        bl      pct_clear
        b       parse_term_loop

parse_term_div0:
        ldr     x9, =parse_err
        mov     w10, ERR_DIV0
        str     w10, [x9]
        ldr     x9, =zero_m
        ldr     d0, [x9]
        b       parse_term_loop

// parse_unary: a leading minus binds looser than the power below it, so
// -2^2 is -4 rather than 4.
parse_unary:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      skip_spaces
        ldrb    w9, [cursor_r]
        cmp     w9, '-'
        b.eq    parse_unary_neg
        cmp     w9, '+'
        b.eq    parse_unary_pos
        bl      parse_power
        ldp     fp, lr, [sp], 16
        ret

parse_unary_neg:
        add     cursor_r, cursor_r, 1
        bl      parse_unary
        fneg    d0, d0
        ldp     fp, lr, [sp], 16
        ret

parse_unary_pos:
        add     cursor_r, cursor_r, 1
        bl      parse_unary
        ldp     fp, lr, [sp], 16
        ret

// parse_power: right-associative, and its exponent goes back through the
// unary level so 2^-1 reads as a half.
parse_power:
        stp     fp, lr, [sp, parse_alloc]!
        mov     fp, sp

        bl      parse_postfix
        str     d0, [fp, lhs_s]
        bl      skip_spaces
        ldrb    w9, [cursor_r]
        cmp     w9, '^'
        b.ne    parse_power_plain

        add     cursor_r, cursor_r, 1
        bl      parse_unary
        fmov    d1, d0
        ldr     d0, [fp, lhs_s]
        bl      pow
        bl      pct_clear
        ldp     fp, lr, [sp], parse_dealloc
        ret

parse_power_plain:
        ldr     d0, [fp, lhs_s]
        ldp     fp, lr, [sp], parse_dealloc
        ret

// parse_postfix: percent after a value divides it by a hundred, and
// leaves a note that it did. parse_expr reads the note: a term that is
// nothing but a percent, sitting to the right of + or -, is a percent OF
// the left operand rather than a bare hundredth.
parse_postfix:
        stp     fp, lr, [sp, parse_alloc]!
        mov     fp, sp

        bl      pct_clear
        bl      parse_primary
parse_postfix_loop:
        str     d0, [fp, lhs_s]
        ldrb    w9, [cursor_r]
        cmp     w9, '%'
        b.ne    parse_postfix_done
        add     cursor_r, cursor_r, 1
        ldr     x9, =hundred_m
        ldr     d1, [x9]
        ldr     d0, [fp, lhs_s]
        fdiv    d0, d0, d1
        ldr     x9, =pct_direct
        mov     w10, 1
        str     w10, [x9]
        b       parse_postfix_loop

parse_postfix_done:
        ldr     d0, [fp, lhs_s]
        ldp     fp, lr, [sp], parse_dealloc
        ret

// pct_scale: apply the note parse_postfix left. Preserves d1, which the
// caller still needs as the left operand.
pct_scale:
        ldr     x9, =pct_direct
        ldr     w9, [x9]
        cbz     w9, pct_scale_done
        fmul    d0, d0, d1
pct_scale_done:
        ret

// pct_clear: any further operation on the value means the term is no
// longer a bare percent.
pct_clear:
        ldr     x9, =pct_direct
        str     wzr, [x9]
        ret

parse_primary:
        stp     fp, lr, [sp, parse_alloc]!
        mov     fp, sp

        bl      skip_spaces
        ldrb    w9, [cursor_r]

        cmp     w9, '('
        b.eq    parse_primary_group
        cmp     w9, '.'
        b.eq    parse_primary_number
        cmp     w9, '0'
        b.lt    parse_primary_name
        cmp     w9, '9'
        b.le    parse_primary_number

parse_primary_name:
        bl      parse_named
        ldp     fp, lr, [sp], parse_dealloc
        ret

parse_primary_number:
        bl      scan_number
        ldp     fp, lr, [sp], parse_dealloc
        ret

parse_primary_group:
        add     cursor_r, cursor_r, 1
        bl      parse_expr
        str     d0, [fp, lhs_s]
        bl      skip_spaces
        ldrb    w9, [cursor_r]
        cmp     w9, ')'
        b.ne    parse_primary_unclosed
        add     cursor_r, cursor_r, 1
        ldr     d0, [fp, lhs_s]
        ldp     fp, lr, [sp], parse_dealloc
        ret

parse_primary_unclosed:
        ldr     x9, =parse_err
        mov     w10, ERR_SYNTAX
        str     w10, [x9]
        ldr     d0, [fp, lhs_s]
        ldp     fp, lr, [sp], parse_dealloc
        ret

// parse_named: pi, or one of the function words followed by a
// parenthesised argument.
parse_named:
        stp     fp, lr, [sp, parse_alloc]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, 0
parse_named_scan:
        cmp     w20, KEYWORD_COUNT
        b.ge    parse_named_bad
        ldr     x9, =keyword_tab
        add     x9, x9, x20, lsl 4
        ldr     x0, [x9]
        bl      match_word
        cbnz    w0, parse_named_hit
        add     w20, w20, 1
        b       parse_named_scan

parse_named_hit:
        ldr     x9, =keyword_tab
        add     x9, x9, x20, lsl 4
        ldrb    w21, [x9, 8]

        // pi is a value, not a call, so it takes no argument.
        cmp     w21, 0xff
        b.ne    parse_named_call
        ldr     x9, =pi_m
        ldr     d0, [x9]
        b       parse_named_done

parse_named_call:
        bl      skip_spaces
        ldrb    w9, [cursor_r]
        cmp     w9, '('
        b.ne    parse_named_bad
        add     cursor_r, cursor_r, 1
        bl      parse_expr
        str     d0, [fp, lhs_s]
        bl      skip_spaces
        ldrb    w9, [cursor_r]
        cmp     w9, ')'
        b.ne    parse_named_bad
        add     cursor_r, cursor_r, 1

        ldr     d0, [fp, lhs_s]
        mov     w0, w21
        bl      apply_unary
        cbz     w0, parse_named_done
        // An error already on the board came first and keeps its word.
        ldr     x9, =parse_err
        ldr     w10, [x9]
        cbnz    w10, parse_named_done
        str     w0, [x9]
        b       parse_named_done

parse_named_bad:
        ldr     x9, =parse_err
        mov     w10, ERR_SYNTAX
        str     w10, [x9]
        ldr     x9, =zero_m
        ldr     d0, [x9]

parse_named_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], parse_dealloc
        ret

// match_word: if the cursor sits on the word in x0, step past it.
match_word:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     x20, x0
        mov     x21, cursor_r
match_word_loop:
        ldrb    w9, [x20]
        cbz     w9, match_word_hit
        ldrb    w10, [x21]
        cmp     w9, w10
        b.ne    match_word_miss
        add     x20, x20, 1
        add     x21, x21, 1
        b       match_word_loop

match_word_hit:
        mov     cursor_r, x21
        mov     w0, 1
        b       match_word_done
match_word_miss:
        mov     w0, 0

match_word_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

skip_spaces:
        ldrb    w9, [cursor_r]
        cmp     w9, ' '
        b.ne    skip_spaces_done
        add     cursor_r, cursor_r, 1
        b       skip_spaces
skip_spaces_done:
        ret

// scan_number: read one decimal literal at the cursor. The digits go
// into an integer and the fraction is applied once at the end, which
// keeps the value as exact as a double can hold it instead of letting it
// drift one divide at a time.
scan_number:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x2, 0
        mov     w3, 0
        mov     w4, 0
        mov     w5, 0

scan_number_loop:
        ldrb    w6, [cursor_r]
        cmp     w6, '.'
        b.ne    scan_number_digit
        cbnz    w4, scan_number_end
        mov     w4, 1
        add     cursor_r, cursor_r, 1
        b       scan_number_loop

scan_number_digit:
        sub     w7, w6, '0'
        cmp     w7, 9
        b.hi    scan_number_end
        // Past seventeen digits a double has nothing left to record, so
        // the rest are read and dropped.
        cmp     w5, 17
        b.ge    scan_number_step
        mov     x10, 10
        madd    x2, x2, x10, x7
        add     w5, w5, 1
        cbz     w4, scan_number_step
        add     w3, w3, 1
scan_number_step:
        add     cursor_r, cursor_r, 1
        b       scan_number_loop

scan_number_end:
        scvtf   d0, x2
        cbz     w3, scan_number_done
        ldr     x9, =pow10_m
        add     x9, x9, x3, lsl 3
        ldr     d1, [x9]
        fdiv    d0, d0, d1

scan_number_done:
        ldp     fp, lr, [sp], 16
        ret

// ------------------------------------------------------------------ //
// arithmetic                                                           //
// ------------------------------------------------------------------ //

// apply_binary: w0 names the operator, d0 and d1 hold the operands.
// Returns the value in d0 and an error code in w0.
apply_binary:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, w0

        cmp     w20, OP_ADD
        b.eq    apply_binary_add
        cmp     w20, OP_SUB
        b.eq    apply_binary_sub
        cmp     w20, OP_MUL
        b.eq    apply_binary_mul
        cmp     w20, OP_DIV
        b.eq    apply_binary_div
        bl      pow
        b       apply_binary_check

apply_binary_add:
        fadd    d0, d0, d1
        b       apply_binary_check
apply_binary_sub:
        fsub    d0, d0, d1
        b       apply_binary_check
apply_binary_mul:
        fmul    d0, d0, d1
        b       apply_binary_check
apply_binary_div:
        // Dividing by zero is an error here, not an infinity: a
        // calculator says so rather than printing a symbol.
        ldr     x9, =zero_m
        ldr     d2, [x9]
        fcmp    d1, d2
        b.eq    apply_binary_div0
        fdiv    d0, d0, d1
        b       apply_binary_check

apply_binary_div0:
        mov     w0, ERR_DIV0
        b       apply_binary_done

apply_binary_check:
        bl      check_result

apply_binary_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// apply_unary: w0 names the function, d0 holds the operand. Returns the
// value in d0 and an error code in w0.
apply_unary:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     w20, w0

        cmp     w20, ACT_SQRT
        b.eq    apply_unary_sqrt
        cmp     w20, ACT_SQR
        b.eq    apply_unary_sqr
        cmp     w20, ACT_INV
        b.eq    apply_unary_inv
        cmp     w20, ACT_SIN
        b.eq    apply_unary_sin
        cmp     w20, ACT_COS
        b.eq    apply_unary_cos
        cmp     w20, ACT_TAN
        b.eq    apply_unary_tan
        cmp     w20, ACT_LOG
        b.eq    apply_unary_log
        cmp     w20, ACT_LN
        b.eq    apply_unary_ln
        cmp     w20, ACT_EXPF
        b.eq    apply_unary_exp
        mov     w0, ERR_SYNTAX
        b       apply_unary_done

apply_unary_sqrt:
        ldr     x9, =zero_m
        ldr     d1, [x9]
        fcmp    d0, d1
        b.lt    apply_unary_neg_root
        bl      sqrt
        b       apply_unary_check

apply_unary_sqr:
        fmul    d0, d0, d0
        b       apply_unary_check

apply_unary_inv:
        ldr     x9, =zero_m
        ldr     d1, [x9]
        fcmp    d0, d1
        b.eq    apply_unary_div0
        fmov    d1, d0
        ldr     x9, =one_m
        ldr     d0, [x9]
        fdiv    d0, d0, d1
        b       apply_unary_check

apply_unary_sin:
        bl      to_radians
        bl      sin
        b       apply_unary_check
apply_unary_cos:
        bl      to_radians
        bl      cos
        b       apply_unary_check
apply_unary_tan:
        bl      to_radians
        bl      tan
        b       apply_unary_check

apply_unary_log:
        bl      check_positive
        cbnz    w0, apply_unary_done
        bl      log10
        b       apply_unary_check
apply_unary_ln:
        bl      check_positive
        cbnz    w0, apply_unary_done
        bl      log
        b       apply_unary_check
apply_unary_exp:
        bl      exp
        b       apply_unary_check

apply_unary_neg_root:
        mov     w0, ERR_SQRT
        b       apply_unary_done
apply_unary_div0:
        mov     w0, ERR_DIV0
        b       apply_unary_done

apply_unary_check:
        bl      check_result

apply_unary_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// to_radians: the trig keys read the DEG lamp, so 30 means thirty
// degrees while the lamp says DEG and thirty radians while it says RAD.
to_radians:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =deg_mode
        ldr     w9, [x9]
        cbz     w9, to_radians_done
        ldr     x9, =deg_to_rad_m
        ldr     d1, [x9]
        fmul    d0, d0, d1

to_radians_done:
        ldp     fp, lr, [sp], 16
        ret

check_positive:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =zero_m
        ldr     d1, [x9]
        fcmp    d0, d1
        b.le    check_positive_bad
        mov     w0, 0
        b       check_positive_done
check_positive_bad:
        mov     w0, ERR_LOG

check_positive_done:
        ldp     fp, lr, [sp], 16
        ret

// check_result: the two ways a value stops being displayable -- it is
// not a number at all, or it has run past the hundred-decade window the
// display can address.
check_result:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        fcmp    d0, d0
        b.vs    check_result_undef
        fabs    d1, d0
        ldr     x9, =huge_m
        ldr     d2, [x9]
        fcmp    d1, d2
        b.ge    check_result_over
        mov     w0, 0
        b       check_result_done

check_result_undef:
        mov     w0, ERR_UNDEF
        b       check_result_done
check_result_over:
        mov     w0, ERR_OVER

check_result_done:
        ldp     fp, lr, [sp], 16
        ret

// current_value: what the display is showing right now, as a double --
// the digits being typed if there are any, otherwise the stored value.
current_value:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x19, x20, [sp, -16]!

        ldr     x9, =entry_active
        ldr     w9, [x9]
        cbz     w9, current_value_stored

        ldr     cursor_r, =entry_buf
        ldrb    w9, [cursor_r]
        cmp     w9, '-'
        b.ne    current_value_scan
        add     cursor_r, cursor_r, 1
        bl      scan_number
        fneg    d0, d0
        b       current_value_done
current_value_scan:
        bl      scan_number
        b       current_value_done

current_value_stored:
        ldr     x9, =disp_m
        ldr     d0, [x9]

current_value_done:
        ldp     x19, x20, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// set_value: park d0 as the reading, render it once, and hand the
// display back from the entry to the stored value.
set_value:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =disp_m
        str     d0, [x9]
        ldr     x0, =disp_txt
        bl      format_double
        ldr     x9, =disp_len
        str     w0, [x9]
        ldr     x9, =entry_active
        str     wzr, [x9]
        ldr     x9, =entry_len
        str     wzr, [x9]
        ldr     x9, =entry_buf
        strb    wzr, [x9]

        ldp     fp, lr, [sp], 16
        ret

// ------------------------------------------------------------------ //
// number formatting                                                    //
// ------------------------------------------------------------------ //

// format_double: render d0 into the buffer at x0 and return its length
// in x0. Ten significant digits with the trailing zeros trimmed is what
// a scientific calculator shows, and it is what makes 0.1 + 0.2 read 0.3
// instead of the double's true 0.30000000000000004.
format_double:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!
        stp     x22, x23, [sp, -16]!
        stp     x24, x25, [sp, -16]!

        mov     x20, x0
        mov     x25, x0

        // The caller turns these into an ERR state first; the guards are
        // here so a stray value cannot spin the scaling loop forever.
        fcmp    d0, d0
        b.vs    format_double_nan

        fabs    d1, d0

        // Anything under the snap threshold reads as a flat zero.
        // Without it sin(pi) would display its 1.2e-16 of rounding dust.
        ldr     x9, =tiny_m
        ldr     d2, [x9]
        fcmp    d1, d2
        b.lt    format_double_zero

        ldr     x9, =zero_m
        ldr     d2, [x9]
        fcmp    d0, d2
        b.ge    format_double_scale
        mov     w9, '-'
        strb    w9, [x20], 1

format_double_scale:
        mov     x22, 0
        ldr     x9, =ten_m
        ldr     d3, [x9]
        ldr     x9, =one_m
        ldr     d4, [x9]

format_double_down:
        fcmp    d1, d3
        b.lt    format_double_up
        fdiv    d1, d1, d3
        add     x22, x22, 1
        // An infinity divides to itself forever; the decade counter is
        // what notices.
        cmp     x22, 100
        b.ge    format_double_inf
        b       format_double_down

format_double_up:
        fcmp    d1, d4
        b.ge    format_double_round
        fmul    d1, d1, d3
        sub     x22, x22, 1
        b       format_double_up

format_double_round:
        // d1 now sits in [1,10). Scaling by 1e9 and adding a half turns
        // the truncating convert into a round-to-nearest at ten digits.
        ldr     x9, =scale_m
        ldr     d2, [x9]
        fmul    d1, d1, d2
        ldr     x9, =half_m
        ldr     d2, [x9]
        fadd    d1, d1, d2
        fcvtzs  x23, d1

        // Rounding 9.999999999 up carries into an eleventh digit.
        ldr     x10, =10000000000
        cmp     x23, x10
        b.lt    format_double_low
        mov     x11, 10
        udiv    x23, x23, x11
        add     x22, x22, 1
format_double_low:
        ldr     x10, =1000000000
        cmp     x23, x10
        b.ge    format_double_peel
        mov     x11, 10
        mul     x23, x23, x11
        sub     x22, x22, 1

format_double_peel:
        ldr     x12, =fmt_digits
        mov     x21, 9
        mov     x11, 10
format_double_peel_loop:
        udiv    x13, x23, x11
        msub    x14, x13, x11, x23
        add     w14, w14, '0'
        strb    w14, [x12, x21]
        mov     x23, x13
        subs    x21, x21, 1
        b.ge    format_double_peel_loop

        // Everything past the last non-zero digit is rounding padding
        // that nobody would write down.
        mov     x24, 9
format_double_trim:
        cbz     x24, format_double_place
        ldrb    w13, [x12, x24]
        cmp     w13, '0'
        b.ne    format_double_place
        sub     x24, x24, 1
        b       format_double_trim

format_double_place:
        cmp     x22, 10
        b.ge    format_double_sci
        cmp     x22, 0
        b.ge    format_double_whole
        // Below a ten-thousandth the fixed form spends the window on
        // leading zeros, so it hands over to the mantissa form.
        neg     x15, x22
        cmp     x15, 5
        b.ge    format_double_sci
        b       format_double_small

format_double_whole:
        mov     x21, 0
format_double_int:
        ldrb    w13, [x12, x21]
        strb    w13, [x20], 1
        cmp     x21, x22
        b.ge    format_double_frac_check
        add     x21, x21, 1
        b       format_double_int

format_double_frac_check:
        cmp     x24, x22
        b.le    format_double_done
        mov     w13, '.'
        strb    w13, [x20], 1
        add     x21, x22, 1
format_double_frac:
        ldrb    w13, [x12, x21]
        strb    w13, [x20], 1
        cmp     x21, x24
        b.ge    format_double_done
        add     x21, x21, 1
        b       format_double_frac

format_double_small:
        mov     w13, '0'
        strb    w13, [x20], 1
        mov     w13, '.'
        strb    w13, [x20], 1
        neg     x15, x22
        sub     x15, x15, 1
format_double_small_pad:
        cbz     x15, format_double_small_digits
        mov     w13, '0'
        strb    w13, [x20], 1
        sub     x15, x15, 1
        b       format_double_small_pad
format_double_small_digits:
        mov     x21, 0
format_double_small_loop:
        ldrb    w13, [x12, x21]
        strb    w13, [x20], 1
        cmp     x21, x24
        b.ge    format_double_done
        add     x21, x21, 1
        b       format_double_small_loop

format_double_sci:
        // Outside the window the display falls back to a mantissa and a
        // decade, the same way a pocket device does.
        ldrb    w13, [x12]
        strb    w13, [x20], 1
        cbz     x24, format_double_sci_exp
        mov     w13, '.'
        strb    w13, [x20], 1
        mov     x21, 1
format_double_sci_mant:
        ldrb    w13, [x12, x21]
        strb    w13, [x20], 1
        cmp     x21, x24
        b.ge    format_double_sci_exp
        add     x21, x21, 1
        b       format_double_sci_mant

format_double_sci_exp:
        mov     w13, 'e'
        strb    w13, [x20], 1
        mov     x15, x22
        cmp     x15, 0
        b.ge    format_double_sci_plus
        mov     w13, '-'
        strb    w13, [x20], 1
        neg     x15, x15
        b       format_double_sci_two
format_double_sci_plus:
        mov     w13, '+'
        strb    w13, [x20], 1
format_double_sci_two:
        mov     x11, 10
        udiv    x13, x15, x11
        msub    x14, x13, x11, x15
        add     w13, w13, '0'
        strb    w13, [x20], 1
        add     w14, w14, '0'
        strb    w14, [x20], 1
        b       format_double_done

format_double_zero:
        mov     w9, '0'
        strb    w9, [x20], 1
        b       format_double_done

format_double_nan:
        mov     x0, x20
        ldr     x1, =txt_nan
        mov     x2, txt_nan_len
        bl      emit_bytes
        mov     x20, x0
        b       format_double_done

format_double_inf:
        mov     x0, x20
        ldr     x1, =txt_inf
        mov     x2, txt_inf_len
        bl      emit_bytes
        mov     x20, x0

format_double_done:
        strb    wzr, [x20]
        sub     x0, x20, x25

        ldp     x24, x25, [sp], 16
        ldp     x22, x23, [sp], 16
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// ------------------------------------------------------------------ //
// text state                                                           //
// ------------------------------------------------------------------ //

// entry_push: one more character on the number being typed.
entry_push:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =entry_len
        ldr     w10, [x9]
        cmp     w10, MAX_ENTRY
        b.ge    entry_push_done
        ldr     x11, =entry_buf
        strb    w0, [x11, x10]
        add     w10, w10, 1
        str     w10, [x9]
        strb    wzr, [x11, x10]

entry_push_done:
        ldp     fp, lr, [sp], 16
        ret

// line_append: x1 bytes from x0 onto the working line.
line_append:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     x20, x0
        mov     x21, x1
        cbz     x21, line_append_done

        ldr     x9, =line_len
        ldr     w10, [x9]
        add     x11, x10, x21
        cmp     x11, LINE_MAX
        b.gt    line_append_done

        ldr     x1, =line_buf
        add     x1, x1, x10
        mov     x0, x20
        mov     x2, x21
        bl      copy_bytes
        strb    wzr, [x1]

        ldr     x9, =line_len
        ldr     w10, [x9]
        add     w10, w10, w21
        str     w10, [x9]

line_append_done:
        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// line_append_op: the operator with a space either side, so the working
// line reads the way a person would write the sum down.
line_append_op:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        sub     w0, w0, 1
        mov     x1, 3
        ldr     x9, =op_txt
        madd    x0, x0, x1, x9
        mov     x1, 3
        bl      line_append

        ldp     fp, lr, [sp], 16
        ret

// tape_from_line: log the working line and the answer it produced.
tape_from_line:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =line_buf
        ldr     x9, =line_len
        ldr     w1, [x9]
        bl      tape_from_segment

        ldp     fp, lr, [sp], 16
        ret

// tape_from_segment: x1 bytes at x0, plus " = " and the reading.
tape_from_segment:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     x20, x0
        mov     x21, x1

        ldr     x0, =tape_scratch
        mov     x1, x20
        mov     x2, x21
        bl      emit_bytes
        ldr     x1, =txt_equals
        mov     x2, txt_equals_len
        bl      emit_bytes
        ldr     x1, =disp_txt
        ldr     x9, =disp_len
        ldr     w2, [x9]
        bl      emit_bytes

        ldr     x9, =tape_scratch
        sub     x1, x0, x9
        mov     x0, x9
        bl      push_tape

        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// push_tape: newest first. Three slots is enough to see the shape of
// what you have been doing without turning the chassis into a log file.
push_tape:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x20, x21, [sp, -16]!

        mov     x20, x0
        mov     x21, x1
        cmp     x21, TAPE_MAX
        b.le    push_tape_shift
        mov     x21, TAPE_MAX

push_tape_shift:
        ldr     x0, =tape_buf
        add     x0, x0, TAPE_SLOT
        ldr     x1, =tape_buf
        add     x1, x1, (TAPE_SLOT * 2)
        mov     x2, TAPE_SLOT
        bl      copy_bytes
        ldr     x0, =tape_buf
        ldr     x1, =tape_buf
        add     x1, x1, TAPE_SLOT
        mov     x2, TAPE_SLOT
        bl      copy_bytes

        ldr     x9, =tape_lens
        ldr     w10, [x9, 4]
        str     w10, [x9, 8]
        ldr     w10, [x9]
        str     w10, [x9, 4]
        str     w21, [x9]

        mov     x0, x20
        ldr     x1, =tape_buf
        mov     x2, x21
        bl      copy_bytes

        ldr     x9, =tape_count
        ldr     w10, [x9]
        cmp     w10, 3
        b.ge    push_tape_mark
        add     w10, w10, 1
        str     w10, [x9]

push_tape_mark:
        bl      mark_tape

        ldp     x20, x21, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

        .data
        .align 3

sleep_time:
        .dword 0
        .dword POLL_NS

// Constants the fmov immediate form cannot reach, plus the ones the
// formatter leans on.
zero_m:         .double 0.0
one_m:          .double 1.0
half_m:         .double 0.5
ten_m:          .double 10.0
hundred_m:      .double 100.0
scale_m:        .double 1.0e9
tiny_m:         .double 1.0e-10
huge_m:         .double 1.0e100
pi_m:           .double 3.141592653589793
deg_to_rad_m:   .double 0.017453292519943295

pow10_m:
        .double 1.0e0
        .double 1.0e1
        .double 1.0e2
        .double 1.0e3
        .double 1.0e4
        .double 1.0e5
        .double 1.0e6
        .double 1.0e7
        .double 1.0e8
        .double 1.0e9
        .double 1.0e10
        .double 1.0e11
        .double 1.0e12
        .double 1.0e13
        .double 1.0e14
        .double 1.0e15
        .double 1.0e16
        .double 1.0e17

// Calculator state
acc_m:          .double 0.0
disp_m:         .double 0.0
mem_m:          .double 0.0
scratch_m:      .double 0.0

entry_len:      .word 0
entry_active:   .word 0
line_len:       .word 0
disp_len:       .word 0
pend_op:        .word 0
just_eq:        .word 0
operand_ready:  .word 0
err_code:       .word 0
expr_mode:      .word 0
deg_mode:       .word 1
quit_flag:      .word 0
parse_err:      .word 0
parse_depth:    .word 0
tape_count:     .word 0
sel_key:        .word 35
flash_key:      .word -1
flash_ticks:    .word 0
dirty_flags:    .word 0
esc_state:      .word 0
seg_start:      .word 0
pct_direct:     .word 0
cmd_len:        .word 0

tape_lens:      .word 0
                .word 0
                .word 0

        .align 3

// The key grid, five rows of eight. Each cap is exactly five columns, so
// the label table is a flat string the painter indexes by key number.
key_labels:
        .ascii " sin  cos  tan  DRG  MC   MR   M+   M-  "
        .ascii " log  ln   e^x  pi    7    8    9    /  "
        .ascii "sqrt  x^2  x^y  1/x   4    5    6    *  "
        .ascii "  %    (    )   <-    1    2    3    -  "
        .ascii "MODE   C   AC    =    0    .   +/-   +  "

key_actions:
        .byte   ACT_SIN, ACT_COS, ACT_TAN, ACT_DRG, ACT_MC, ACT_MR, ACT_MPLUS, ACT_MMINUS
        .byte   ACT_LOG, ACT_LN, ACT_EXPF, ACT_PI, ACT_D7, ACT_D8, ACT_D9, ACT_DIV
        .byte   ACT_SQRT, ACT_SQR, ACT_POW, ACT_INV, ACT_D4, ACT_D5, ACT_D6, ACT_MUL
        .byte   ACT_PCT, ACT_LPAREN, ACT_RPAREN, ACT_BSP, ACT_D1, ACT_D2, ACT_D3, ACT_SUB
        .byte   ACT_MODE, ACT_C, ACT_AC, ACT_EQ, ACT_D0, ACT_DOT, ACT_SIGN, ACT_ADD

        .align 3

// Typed characters that are not digits, paired with the key they press.
// A zero byte ends the table.
char_map:
        .byte   '.', ACT_DOT
        .byte   '~', ACT_SIGN
        .byte   '+', ACT_ADD
        .byte   '-', ACT_SUB
        .byte   '*', ACT_MUL
        .byte   '/', ACT_DIV
        .byte   '^', ACT_POW
        .byte   '=', ACT_EQ
        .byte   '(', ACT_LPAREN
        .byte   ')', ACT_RPAREN
        .byte   '%', ACT_PCT
        .byte   0x7f, ACT_BSP
        .byte   0x08, ACT_BSP
        .byte   'C', ACT_C
        .byte   'A', ACT_AC
        .byte   'v', ACT_SQRT
        .byte   'i', ACT_INV
        .byte   's', ACT_SIN
        .byte   'c', ACT_COS
        .byte   't', ACT_TAN
        .byte   'g', ACT_LOG
        .byte   'n', ACT_LN
        .byte   'e', ACT_EXPF
        .byte   'p', ACT_PI
        .byte   'm', ACT_MPLUS
        .byte   'M', ACT_MMINUS
        .byte   'r', ACT_MR
        .byte   'w', ACT_MC
        .byte   'd', ACT_DRG
        .byte   0, 0

        .align 3

// What each key types into an expression. A zero entry means the key is
// handled directly instead of inserted.
expr_ins:
        .dword  ins_0, ins_1, ins_2, ins_3, ins_4
        .dword  ins_5, ins_6, ins_7, ins_8, ins_9
        .dword  ins_dot, ins_neg
        .dword  ins_add, ins_sub, ins_mul, ins_div
        .dword  0, 0, 0, 0
        .dword  ins_lparen, ins_rparen
        .dword  ins_pct
        .dword  ins_sqrt, ins_sqr, ins_pow, ins_inv
        .dword  ins_sin, ins_cos, ins_tan
        .dword  ins_log, ins_ln, ins_exp
        .dword  ins_pi
        .dword  0, 0, 0, 0
        .dword  0, 0

ins_0:      .string "0"
ins_1:      .string "1"
ins_2:      .string "2"
ins_3:      .string "3"
ins_4:      .string "4"
ins_5:      .string "5"
ins_6:      .string "6"
ins_7:      .string "7"
ins_8:      .string "8"
ins_9:      .string "9"
ins_dot:    .string "."
ins_neg:    .string "-"
ins_add:    .string "+"
ins_sub:    .string "-"
ins_mul:    .string "*"
ins_div:    .string "/"
ins_lparen: .string "("
ins_rparen: .string ")"
ins_pct:    .string "%"
ins_sqrt:   .string "sqrt("
ins_sqr:    .string "^2"
ins_pow:    .string "^"
ins_inv:    .string "^-1"
ins_sin:    .string "sin("
ins_cos:    .string "cos("
ins_tan:    .string "tan("
ins_log:    .string "log("
ins_ln:     .string "ln("
ins_exp:    .string "exp("
ins_pi:     .string "pi"

        .align 3

// How the working line records a function call: the text before the
// operand and the text after it, indexed from the first unary action.
unary_txt:
        .dword  pre_sqrt, post_close
        .dword  pre_group, post_sqr
        .dword  pre_group, post_close
        .dword  pre_inv, post_close
        .dword  pre_sin, post_close
        .dword  pre_cos, post_close
        .dword  pre_tan, post_close
        .dword  pre_log, post_close
        .dword  pre_ln, post_close
        .dword  pre_exp, post_close

pre_sqrt:   .string "sqrt("
pre_group:  .string "("
pre_inv:    .string "1/("
pre_sin:    .string "sin("
pre_cos:    .string "cos("
pre_tan:    .string "tan("
pre_log:    .string "log("
pre_ln:     .string "ln("
pre_exp:    .string "exp("
post_close: .string ")"
post_sqr:   .string ")^2"

        .align 3

// Words the expression parser recognises. The byte after each pointer
// names the function it applies; 0xff marks a bare value.
KEYWORD_COUNT = 8

keyword_tab:
        .dword  kw_sqrt
        .byte   ACT_SQRT
        .skip   7
        .dword  kw_sin
        .byte   ACT_SIN
        .skip   7
        .dword  kw_cos
        .byte   ACT_COS
        .skip   7
        .dword  kw_tan
        .byte   ACT_TAN
        .skip   7
        .dword  kw_log
        .byte   ACT_LOG
        .skip   7
        .dword  kw_ln
        .byte   ACT_LN
        .skip   7
        .dword  kw_exp
        .byte   ACT_EXPF
        .skip   7
        .dword  kw_pi
        .byte   0xff
        .skip   7

kw_sqrt: .string "sqrt"
kw_sin:  .string "sin"
kw_cos:  .string "cos"
kw_tan:  .string "tan"
kw_log:  .string "log"
kw_ln:   .string "ln"
kw_exp:  .string "exp"
kw_pi:   .string "pi"

        .align 3

// Error words, indexed by error code.
err_tab:
        .dword  0
        .dword  err_div0
        .dword  err_sqrt
        .dword  err_log
        .dword  err_over
        .dword  err_syntax
        .dword  err_undef

err_div0:   .string "div by zero"
err_sqrt:   .string "sqrt of neg"
err_log:    .string "log of <= 0"
err_over:   .string "overflow"
err_syntax: .string "syntax"
err_undef:  .string "undefined"

// Operator text for the working line, three columns each.
op_txt:
        .ascii " + "
        .ascii " - "
        .ascii " * "
        .ascii " / "
        .ascii " ^ "

txt_equals: .ascii " = "
txt_equals_len = . - txt_equals
txt_eq_tail: .ascii " ="
txt_eq_tail_len = . - txt_eq_tail
txt_pi: .ascii "pi"
txt_pi_len = . - txt_pi
txt_nan: .ascii "nan"
txt_nan_len = . - txt_nan
txt_inf: .ascii "inf"
txt_inf_len = . - txt_inf
tape_cut: .ascii ".."
tape_cut_len = . - tape_cut
tape_empty: .ascii "the tape fills in as you finish calculations"
tape_empty_len = . - tape_empty
brand_txt: .ascii "calc"
brand_txt_len = . - brand_txt

// Console-mode text. Every byte of it is printable: this is the one path
// that has to survive a plain-text console and a redirected stdout.
txt_console: .string "console"
txt_q:       .string "q"
txt_quit:    .string "quit"
txt_deg:     .string "deg"
txt_rad:     .string "rad"

usage_txt: .ascii "usage: calculator [console]\n"
usage_txt_len = . - usage_txt
banner_txt:
        .ascii "calc -- scientific calculator\n"
        .ascii "type an expression, deg or rad for the trig mode, q to quit\n"
banner_txt_len = . - banner_txt
prompt_txt: .ascii "calc> "
prompt_txt_len = . - prompt_txt
ans_txt: .ascii "= "
ans_txt_len = . - ans_txt
deg_word: .ascii "DEG\n"
deg_word_len = . - deg_word
rad_word: .ascii "RAD\n"
rad_word_len = . - rad_word
long_txt: .ascii "too long\n"
long_txt_len = . - long_txt
bye_txt: .ascii "bye\n"
bye_txt_len = . - bye_txt
nl_txt: .ascii "\n"
nl_txt_len = . - nl_txt

// Lamp labels
lamp_deg:  .string "DEG"
lamp_rad:  .string "RAD"
lamp_m:    .string "M"
lamp_imm:  .string "IMM"
lamp_expr: .string "EXPR"
lamp_err:  .string "ERR"

// Palette. Grey is the chassis, green the display glass, cyan the
// functions and the navigation highlight, amber the operators and the
// lit lamps, red the destructive keys and every error.
esc_csi:      .ascii "\x1b["
esc_csi_len = . - esc_csi
col_reset:    .ascii "\x1b[0m"
col_reset_len = . - col_reset
col_dim:      .ascii "\x1b[90m"
col_dim_len = . - col_dim
col_lamp_on:  .ascii "\x1b[1;93m"
col_lamp_on_len = . - col_lamp_on
col_err:      .ascii "\x1b[1;91m"
col_err_len = . - col_err
col_entry:    .ascii "\x1b[32m"
col_entry_len = . - col_entry
col_result:   .ascii "\x1b[1;92m"
col_result_len = . - col_result
col_tape:     .ascii "\x1b[37m"
col_tape_len = . - col_tape
col_digit:    .ascii "\x1b[97m"
col_digit_len = . - col_digit
col_op:       .ascii "\x1b[33m"
col_op_len = . - col_op
col_clear:    .ascii "\x1b[91m"
col_clear_len = . - col_clear
col_func:     .ascii "\x1b[36m"
col_func_len = . - col_func
col_select:   .ascii "\x1b[1;96m\x1b[7m"
col_select_len = . - col_select
col_flash:    .ascii "\x1b[1;93m\x1b[7m"
col_flash_len = . - col_flash

enter_screen: .ascii "\x1b[2J\x1b[?25l"
enter_screen_len = . - enter_screen
leave_seq:    .ascii "\x1b[?25h\x1b[0m\n"
leave_seq_len = . - leave_seq

// The chassis, drawn once. Every row carries its own cursor address, so
// one write puts the whole device on the screen.
chassis:
        .ascii "\x1b[90m"
        .ascii "\x1b[1;1H┌───────────────────────────────────────────────────┐"
        .ascii "\x1b[2;1H│  calc                                 scientific  │"
        .ascii "\x1b[3;1H│ ┌───────────────────────────────────────────────┐ │"
        .ascii "\x1b[4;1H│ │                                               │ │"
        .ascii "\x1b[5;1H│ │                                               │ │"
        .ascii "\x1b[6;1H│ │                                               │ │"
        .ascii "\x1b[7;1H│ └───────────────────────────────────────────────┘ │"
        .ascii "\x1b[8;1H│                                                   │"
        .ascii "\x1b[9;1H│                                                   │"
        .ascii "\x1b[10;1H│                                                   │"
        .ascii "\x1b[11;1H│ ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐ │"
        .ascii "\x1b[12;1H│ │     │     │     │     │     │     │     │     │ │"
        .ascii "\x1b[13;1H│ ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤ │"
        .ascii "\x1b[14;1H│ │     │     │     │     │     │     │     │     │ │"
        .ascii "\x1b[15;1H│ ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤ │"
        .ascii "\x1b[16;1H│ │     │     │     │     │     │     │     │     │ │"
        .ascii "\x1b[17;1H│ ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤ │"
        .ascii "\x1b[18;1H│ │     │     │     │     │     │     │     │     │ │"
        .ascii "\x1b[19;1H│ ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤ │"
        .ascii "\x1b[20;1H│ │     │     │     │     │     │     │     │     │ │"
        .ascii "\x1b[21;1H│ └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘ │"
        .ascii "\x1b[22;1H└───────────────────────────────────────────────────┘"
        .ascii "\x1b[23;1H  0-9 . + - * / ^ ( ) =    arrows+enter    tab mode    d deg/rad    q quit"
        .ascii "\x1b[0m"
chassis_len = . - chassis

        .bss
        .align 3

termios_orig:   .skip 60
termios_raw:    .skip 60
stdin_flags:    .skip 8

entry_buf:      .skip 32
line_buf:       .skip 136
disp_txt:       .skip 32
operand_txt:    .skip 48
segment_txt:    .skip 96
scratch_txt:    .skip 32
work_txt:       .skip 200
tape_buf:       .skip 288
tape_scratch:   .skip 200
key_dirty:      .skip 40
key_in:         .skip 24
fmt_digits:     .skip 16
cmd_buf:        .skip 136
console_out:    .skip 64
frame_out:      .skip 8192
