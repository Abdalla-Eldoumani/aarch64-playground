// tty_: raw mode, terminal size, non-blocking input, key decoding, write_all and sleeping.

define(tty_n_r, x19)
define(tty_i_r, x20)
define(tty_tick_r, x21)
define(tty_reads_r, x22)
define(tty_fd_r, w19)
define(tty_buf_r, x20)
define(tty_len_r, x21)
define(tty_waits_r, x22)

TTY_IFLAG = 0
TTY_LFLAG = 12
// after the four flag words come c_line and the 19 control characters, 20 bytes read as two
// doublewords and a word
TTY_CC = 16
TTY_CC_TAIL = TTY_CC + 16
TTY_VTIME = 22
TTY_VMIN = 23
TTY_IOFF = 0x500
TTY_LOFF = 0x800B
TTY_INBUF = 64
TTY_MAXREADS = 16
TTY_MAXFLAPS = 8
TTY_ESC_TICKS = 2
TTY_WAIT_NS = 1000000
TTY_WAIT_MAX = 2000

// decoder states; 0 is ground, outside any sequence
TTY_ESC = 1
TTY_CSI = 2
TTY_SS3 = 3
TTY_MOUSE = 4
// the bytes the decoder looks for
TTY_K_CTRL_C = 3
TTY_K_LF = 10
TTY_K_CR = 13
TTY_K_ESC = 27
TTY_K_SPACE = 32
TTY_K_ZERO = 48
TTY_K_SEMI = 59
TTY_K_LT = 60
TTY_K_UP = 65
TTY_K_M = 77
TTY_K_O = 79
TTY_K_BRACKET = 91
TTY_K_D = 100
TTY_K_K = 107
TTY_K_P = 112
TTY_K_Q = 113
TTY_K_W = 119
// or-ing this bit turns an ASCII capital into its lower case
TTY_K_LOWER = 32
// a CSI sequence ends at its first byte from here up
TTY_K_FINAL = 64
// a mouse report is ESC [ < button ; x ; y M: a decimal button number, capped, and the y field
// is the last before the M
TTY_DIGIT_MAX = 9
TTY_DEC = 10
TTY_NUM_CAP = 9999
TTY_MOUSE_YFIELD = 2

        .bss
        .balign 16
tty_orig:   .skip   64
tty_raw:    .skip   64
tty_in:     .skip   TTY_INBUF
tty_ws:     .skip   8
tty_ts:     .skip   16
tty_flags:  .skip   8
tty_ok:     .skip   8
tty_dstate: .skip   8
tty_desc:   .skip   8
tty_dfirst: .skip   8
tty_dnum:   .skip   8
tty_dfield: .skip   8
        .balign 8
        .global tty_flaps
        .global tty_quit
        .global tty_pause
        .global tty_debug
        .global tty_nocc
tty_flaps:  .skip   8
tty_quit:   .skip   8
tty_pause:  .skip   8
tty_debug:  .skip   8
// 1 when the terminal's TCGETS gave no control character at all, which is the playground's sign
tty_nocc:   .skip   8

        .text

// tty_open() -> w0 = 0 in raw mode, -1 when stdin is not a terminal
        .balign 4
        .global tty_open
tty_open:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x0, 0
        mov     x1, TCGETS
        ldr     x2, =tty_orig
        mov     x8, SYS_IOCTL
        svc     0
        tbnz    x0, 63, tty_open_fail
        ldr     x9, =tty_orig
        // the playground's TCGETS writes the four flag words and zeroes the rest, so every
        // control character reads 0; a real terminal starts with Ctrl-C, Ctrl-D, DEL and the
        // others in place and VMIN 1. Its size cannot tell: the playground may report one.
        // shortcut: a terminal with every control character switched off by hand gets lite too;
        // revisit if the playground's TCGETS ever reports control characters
        ldp     x10, x11, [x9, TTY_CC]
        ldr     w12, [x9, TTY_CC_TAIL]
        orr     x10, x10, x11
        orr     x10, x10, x12
        cmp     x10, 0
        cset    x10, eq
        ldr     x11, =tty_nocc
        str     x10, [x11]
        ldr     x10, =tty_raw
        ldp     x11, x12, [x9]
        stp     x11, x12, [x10]
        ldp     x11, x12, [x9, 16]
        stp     x11, x12, [x10, 16]
        ldp     x11, x12, [x9, 32]
        stp     x11, x12, [x10, 32]
        ldp     x11, x12, [x9, 48]
        stp     x11, x12, [x10, 48]
        // IXON off or Ctrl-S freezes output; ICRNL off so Enter arrives as CR
        ldr     w11, [x10, TTY_IFLAG]
        mov     w12, TTY_IOFF
        bic     w11, w11, w12
        str     w11, [x10, TTY_IFLAG]
        ldr     w11, [x10, TTY_LFLAG]
        mov     w12, TTY_LOFF
        bic     w11, w11, w12
        str     w11, [x10, TTY_LFLAG]
        strb    wzr, [x10, TTY_VTIME]
        strb    wzr, [x10, TTY_VMIN]
        mov     x0, 0
        mov     x1, TCSETS
        ldr     x2, =tty_raw
        mov     x8, SYS_IOCTL
        svc     0
        mov     x0, 0
        mov     x1, F_GETFL
        mov     x8, SYS_FCNTL
        svc     0
        ldr     x9, =tty_flags
        str     x0, [x9]
        // the playground ignores VMIN and VTIME, so only O_NONBLOCK makes reads return
        orr     x2, x0, O_NONBLOCK
        mov     x0, 0
        mov     x1, F_SETFL
        mov     x8, SYS_FCNTL
        svc     0
        ldr     x9, =tty_ok
        mov     x10, 1
        str     x10, [x9]
        mov     w0, 0
        b       tty_open_done
tty_open_fail:
        mov     w0, -1
tty_open_done:
        ldp     fp, lr, [sp], 16
        ret

// tty_close(): puts back the saved termios and fd flags; safe to call twice
        .balign 4
        .global tty_close
tty_close:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =tty_ok
        ldr     x10, [x9]
        cbz     x10, tty_close_done
        mov     x0, 0
        mov     x1, TCSETS
        ldr     x2, =tty_orig
        mov     x8, SYS_IOCTL
        svc     0
        ldr     x9, =tty_flags
        ldr     x2, [x9]
        mov     x0, 0
        mov     x1, F_SETFL
        mov     x8, SYS_FCNTL
        svc     0
        // cleared only after both calls, so a SIGTERM in here runs them again from the handler,
        // which sets the same saved termios and flags a second time
        ldr     x9, =tty_ok
        str     xzr, [x9]
tty_close_done:
        ldp     fp, lr, [sp], 16
        ret

// tty_size() -> w0 = columns, w1 = rows; both 0 when unknown
        .balign 4
        .global tty_size
tty_size:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =tty_ws
        str     xzr, [x9]
        mov     x0, 1
        mov     x1, TIOCGWINSZ
        mov     x2, x9
        mov     x8, SYS_IOCTL
        svc     0
        mov     w1, 0
        tbnz    x0, 63, tty_size_none
        ldr     x9, =tty_ws
        ldrh    w1, [x9]
        ldrh    w0, [x9, 2]
        cbz     w0, tty_size_none
        cbnz    w1, tty_size_done
tty_size_none:
        mov     w0, 0
        mov     w1, 0
tty_size_done:
        ldp     fp, lr, [sp], 16
        ret

// tty_flap(): queues one flap; a burst beyond the cap is dropped
        .balign 4
tty_flap:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =tty_flaps
        ldr     x10, [x9]
        cmp     x10, TTY_MAXFLAPS
        b.ge    tty_flap_done
        add     x10, x10, 1
        str     x10, [x9]
tty_flap_done:
        ldp     fp, lr, [sp], 16
        ret

// tty_set(x0 = event word): marks quit, pause or debug
        .balign 4
tty_set:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, [x0]
        add     x9, x9, 1
        str     x9, [x0]
        ldp     fp, lr, [sp], 16
        ret

// tty_feed(w0 = byte, x1 = tick): one byte through the key decoder
        .balign 4
tty_feed:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =tty_dstate
        ldr     x10, [x9]
        cmp     x10, TTY_ESC
        b.eq    tty_feed_esc
        cmp     x10, TTY_CSI
        b.eq    tty_feed_csi
        cmp     x10, TTY_SS3
        b.eq    tty_feed_ss3
        cmp     x10, TTY_MOUSE
        b.eq    tty_feed_mouse
tty_feed_ground:
        cmp     w0, TTY_K_ESC
        b.eq    tty_feed_goesc
        cmp     w0, TTY_K_SPACE
        b.eq    tty_feed_flap
        cmp     w0, TTY_K_CR
        b.eq    tty_feed_flap
        cmp     w0, TTY_K_LF
        b.eq    tty_feed_flap
        orr     w11, w0, TTY_K_LOWER
        cmp     w11, TTY_K_W
        b.eq    tty_feed_flap
        cmp     w11, TTY_K_K
        b.eq    tty_feed_flap
        cmp     w11, TTY_K_P
        b.eq    tty_feed_pause
        cmp     w11, TTY_K_Q
        b.eq    tty_feed_quit
        cmp     w0, TTY_K_CTRL_C
        b.eq    tty_feed_quit
        cmp     w11, TTY_K_D
        b.eq    tty_feed_debug
        b       tty_feed_done
tty_feed_goesc:
        mov     x10, TTY_ESC
        str     x10, [x9]
        ldr     x11, =tty_desc
        str     x1, [x11]
        b       tty_feed_done
tty_feed_esc:
        cmp     w0, TTY_K_BRACKET
        b.eq    tty_feed_gocsi
        cmp     w0, TTY_K_O
        b.eq    tty_feed_goss3
        // a second ESC means the first was the Esc key on its own
        cmp     w0, TTY_K_ESC
        b.eq    tty_feed_quit
        str     xzr, [x9]
        b       tty_feed_ground
tty_feed_gocsi:
        mov     x10, TTY_CSI
        str     x10, [x9]
        ldr     x11, =tty_dfirst
        mov     x12, 1
        str     x12, [x11]
        b       tty_feed_done
tty_feed_goss3:
        mov     x10, TTY_SS3
        str     x10, [x9]
        b       tty_feed_done
tty_feed_csi:
        ldr     x11, =tty_dfirst
        ldr     x12, [x11]
        str     xzr, [x11]
        cbz     x12, tty_feed_cbody
        cmp     w0, TTY_K_LT
        b.ne    tty_feed_cbody
        mov     x10, TTY_MOUSE
        str     x10, [x9]
        ldr     x11, =tty_dnum
        str     xzr, [x11]
        ldr     x11, =tty_dfield
        str     xzr, [x11]
        b       tty_feed_done
tty_feed_cbody:
        cmp     w0, TTY_K_FINAL
        b.lt    tty_feed_done
        str     xzr, [x9]
        cmp     w0, TTY_K_UP
        b.eq    tty_feed_flap
        b       tty_feed_done
tty_feed_ss3:
        str     xzr, [x9]
        cmp     w0, TTY_K_UP
        b.eq    tty_feed_flap
        b       tty_feed_done
tty_feed_mouse:
        ldr     x11, =tty_dfield
        ldr     x12, [x11]
        sub     w13, w0, TTY_K_ZERO
        cmp     w13, TTY_DIGIT_MAX
        b.hi    tty_feed_mnot
        cbnz    x12, tty_feed_done
        ldr     x14, =tty_dnum
        ldr     x15, [x14]
        mov     x2, TTY_DEC
        madd    x15, x15, x2, x13
        mov     x2, TTY_NUM_CAP
        cmp     x15, x2
        csel    x15, x15, x2, le
        str     x15, [x14]
        b       tty_feed_done
tty_feed_mnot:
        cmp     w0, TTY_K_SEMI
        b.ne    tty_feed_mend
        add     x12, x12, 1
        str     x12, [x11]
        b       tty_feed_done
tty_feed_mend:
        str     xzr, [x9]
        // only a left press acts; releases, motion and the wheel do not
        cmp     w0, TTY_K_M
        b.ne    tty_feed_done
        cmp     x12, TTY_MOUSE_YFIELD
        b.ne    tty_feed_done
        ldr     x14, =tty_dnum
        ldr     x15, [x14]
        cbnz    x15, tty_feed_done
tty_feed_flap:
        bl      tty_flap
        b       tty_feed_done
tty_feed_pause:
        ldr     x0, =tty_pause
        bl      tty_set
        b       tty_feed_done
tty_feed_quit:
        str     xzr, [x9]
        ldr     x0, =tty_quit
        bl      tty_set
        b       tty_feed_done
tty_feed_debug:
        ldr     x0, =tty_debug
        bl      tty_set
tty_feed_done:
        ldp     fp, lr, [sp], 16
        ret

// tty_poll(x0 = tick): reads every waiting byte and decodes it; 0 and -EAGAIN both mean no key
tty_poll_alloc = -(16 + 32) & -16
tty_poll_dealloc = 0 - tty_poll_alloc
        .balign 4
        .global tty_poll
tty_poll:
        stp     fp, lr, [sp, tty_poll_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        mov     tty_tick_r, x0
        mov     tty_reads_r, 0
tty_poll_read:
        mov     x0, 0
        ldr     x1, =tty_in
        mov     x2, TTY_INBUF
        mov     x8, SYS_READ
        svc     0
        cmp     x0, 0
        b.le    tty_poll_esc
        mov     tty_n_r, x0
        mov     tty_i_r, 0
tty_poll_byte:
        ldr     x9, =tty_in
        ldrb    w0, [x9, tty_i_r]
        mov     x1, tty_tick_r
        bl      tty_feed
        add     tty_i_r, tty_i_r, 1
        cmp     tty_i_r, tty_n_r
        b.lt    tty_poll_byte
        add     tty_reads_r, tty_reads_r, 1
        cmp     tty_n_r, TTY_INBUF
        b.ne    tty_poll_esc
        cmp     tty_reads_r, TTY_MAXREADS
        b.lt    tty_poll_read
tty_poll_esc:
        // a lone ESC with nothing after it for two ticks is the Esc key
        ldr     x9, =tty_dstate
        ldr     x10, [x9]
        cmp     x10, TTY_ESC
        b.ne    tty_poll_done
        ldr     x11, =tty_desc
        ldr     x11, [x11]
        sub     x11, tty_tick_r, x11
        cmp     x11, TTY_ESC_TICKS
        b.lt    tty_poll_done
        str     xzr, [x9]
        ldr     x0, =tty_quit
        bl      tty_set
tty_poll_done:
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     fp, lr, [sp], tty_poll_dealloc
        ret

// tty_sleep(x0 = nanoseconds): nanosleep, split into seconds when needed
        .balign 4
        .global tty_sleep
tty_sleep:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =tty_ts
        ldr     x10, =1000000000
        udiv    x11, x0, x10
        msub    x12, x11, x10, x0
        stp     x11, x12, [x9]
        mov     x0, x9
        mov     x1, 0
        mov     x8, SYS_NANOSLEEP
        svc     0
        ldp     fp, lr, [sp], 16
        ret

// tty_write_all(w0 = fd, x1 = buf, x2 = len) -> w0 = 0 written, 1 cut short, 2 terminal gone
tty_write_all_alloc = -(16 + 32) & -16
tty_write_all_dealloc = 0 - tty_write_all_alloc
        .balign 4
        .global tty_write_all
tty_write_all:
        stp     fp, lr, [sp, tty_write_all_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        mov     tty_fd_r, w0
        mov     tty_buf_r, x1
        mov     tty_len_r, x2
        mov     tty_waits_r, 0
        b       tty_wa_test
tty_wa_loop:
        mov     w0, tty_fd_r
        mov     x1, tty_buf_r
        mov     x2, tty_len_r
        mov     x8, SYS_WRITE
        svc     0
        cmp     x0, 0
        b.le    tty_wa_err
        add     tty_buf_r, tty_buf_r, x0
        sub     tty_len_r, tty_len_r, x0
        b       tty_wa_test
tty_wa_err:
        cmn     x0, EINTR
        b.eq    tty_wa_test
        cmn     x0, EIO
        b.eq    tty_wa_gone
        cmn     x0, EAGAIN
        b.ne    tty_wa_cut
        // stdout shares the tty's file description, so O_NONBLOCK on stdin reaches it too
        cmp     tty_waits_r, TTY_WAIT_MAX
        b.ge    tty_wa_cut
        add     tty_waits_r, tty_waits_r, 1
        ldr     x0, =TTY_WAIT_NS
        bl      tty_sleep
tty_wa_test:
        cbnz    tty_len_r, tty_wa_loop
        mov     w0, 0
        b       tty_wa_done
tty_wa_cut:
        mov     w0, 1
        b       tty_wa_done
tty_wa_gone:
        mov     w0, 2
tty_wa_done:
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     fp, lr, [sp], tty_write_all_dealloc
        ret
