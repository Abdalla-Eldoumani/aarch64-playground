// save_: the best score file and the binary PPM frame dump, through openat, read and write.

define(save_fd_r, w19)
define(save_buf_r, x20)
define(save_stride_r, x21)
define(save_pal_r, x22)
define(save_y_r, x23)
define(save_dw_r, x24)
define(save_dh_r, x25)
define(save_score_r, x19)

SAVE_BEST_READ = 32
SAVE_BEST_MAX = 99999
// the best score file holds the score in decimal
SAVE_DEC_BASE = 10
SAVE_LF = 10
SAVE_CR = 13
SAVE_SPACE = 32
// a binary ppm opens with P6, then its width, height and largest colour value
SAVE_PPM_P = 80
SAVE_PPM_6 = ART_CHAR_0 + 6
SAVE_PPM_MAX = 255
// a ppm row is three bytes a pixel, and the widest display is the logical width
SAVE_ROW_BYTES = LOG_W * 3
// the ppm header, or the best score as read and as written, which are all far shorter
SAVE_HDR_BYTES = 64

        .bss
        .balign 16
save_row:   .skip   SAVE_ROW_BYTES
save_hdr:   .skip   SAVE_HDR_BYTES
        .balign 8
        .global save_best
        .global save_new
save_best:  .skip   8
save_new:   .skip   8

        .section .rodata
save_s_best:    .asciz  ".flappy_best"

        .text

// save_ppm(x0 = path, x1 = buf, x2 = stride, x3 = palette) -> w0 = 0 written, -1 failed
save_ppm_alloc = -(16 + 56) & -16
save_ppm_dealloc = 0 - save_ppm_alloc
        .balign 4
        .global save_ppm
save_ppm:
        stp     fp, lr, [sp, save_ppm_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        stp     x23, x24, [sp, 48]
        str     x25, [sp, 64]
        mov     save_buf_r, x1
        mov     save_stride_r, x2
        mov     save_pal_r, x3
        mov     x1, x0
        mov     x0, AT_FDCWD
        mov     x2, FILE_NEW
        mov     x3, FILE_MODE
        mov     x8, SYS_OPENAT
        svc     0
        tbnz    x0, 63, save_ppm_fail
        mov     save_fd_r, w0
        ldr     x9, =gfx_dw
        ldr     save_dw_r, [x9]
        ldr     x9, =gfx_dh
        ldr     save_dh_r, [x9]
        ldr     x1, =save_hdr
        mov     w10, SAVE_PPM_P
        strb    w10, [x1], 1
        mov     w10, SAVE_PPM_6
        strb    w10, [x1], 1
        mov     w10, SAVE_LF
        strb    w10, [x1], 1
        mov     x0, save_dw_r
        bl      main_fmt_dec
        mov     w10, SAVE_SPACE
        strb    w10, [x0], 1
        mov     x1, x0
        mov     x0, save_dh_r
        bl      main_fmt_dec
        mov     w10, SAVE_LF
        strb    w10, [x0], 1
        mov     x1, x0
        mov     x0, SAVE_PPM_MAX
        bl      main_fmt_dec
        mov     w10, SAVE_LF
        strb    w10, [x0], 1
        ldr     x1, =save_hdr
        sub     x2, x0, x1
        mov     w0, save_fd_r
        bl      tty_write_all
        mov     save_y_r, 0
save_ppm_row:
        ldr     x10, =save_row
        mov     x11, 0
save_ppm_px:
        ldrb    w12, [save_buf_r, x11]
        add     x13, save_pal_r, x12, lsl 2
        ldrb    w14, [x13]
        strb    w14, [x10], 1
        ldrb    w14, [x13, 1]
        strb    w14, [x10], 1
        ldrb    w14, [x13, 2]
        strb    w14, [x10], 1
        add     x11, x11, 1
        cmp     x11, save_dw_r
        b.lt    save_ppm_px
        mov     w0, save_fd_r
        ldr     x1, =save_row
        sub     x2, x10, x1
        bl      tty_write_all
        add     save_buf_r, save_buf_r, save_stride_r
        add     save_y_r, save_y_r, 1
        cmp     save_y_r, save_dh_r
        b.lt    save_ppm_row
        mov     w0, save_fd_r
        mov     x8, SYS_CLOSE
        svc     0
        mov     w0, 0
        b       save_ppm_done
save_ppm_fail:
        mov     w0, -1
save_ppm_done:
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     x23, x24, [sp, 48]
        ldr     x25, [sp, 64]
        ldp     fp, lr, [sp], save_ppm_dealloc
        ret

// save_best_load(): save_best from .flappy_best, or 0 when it is missing or not a number
        .balign 4
        .global save_best_load
save_best_load:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x0, AT_FDCWD
        ldr     x1, =save_s_best
        mov     x2, O_RDONLY
        mov     x3, 0
        mov     x8, SYS_OPENAT
        svc     0
        tbnz    x0, 63, save_best_load_none
        mov     x9, x0
        ldr     x1, =save_hdr
        mov     x2, SAVE_BEST_READ
        mov     x8, SYS_READ
        svc     0
        mov     x10, x0
        mov     x0, x9
        mov     x8, SYS_CLOSE
        svc     0
        // digits, then at most a line end; anything else means the file is not ours to trust
        cmp     x10, 0
        b.le    save_best_load_none
        ldr     x11, =save_hdr
        mov     x12, 0
        mov     x0, 0
        mov     x13, SAVE_DEC_BASE
save_best_load_digit:
        ldrb    w14, [x11, x12]
        sub     w15, w14, ART_CHAR_0
        cmp     w15, ART_DIGIT_LAST
        b.hi    save_best_load_end
        madd    x0, x0, x13, x15
        ldr     x15, =SAVE_BEST_MAX
        cmp     x0, x15
        csel    x0, x0, x15, le
        add     x12, x12, 1
        cmp     x12, x10
        b.lt    save_best_load_digit
        b       save_best_load_check
save_best_load_end:
        cmp     w14, SAVE_LF
        b.eq    save_best_load_check
        cmp     w14, SAVE_CR
        b.ne    save_best_load_none
save_best_load_check:
        cbnz    x12, save_best_load_done
save_best_load_none:
        mov     x0, 0
save_best_load_done:
        ldr     x9, =save_best
        str     x0, [x9]
        ldp     fp, lr, [sp], 16
        ret

// save_best_check(x0 = score): a new best is kept, flagged in save_new and written out
save_best_check_alloc = -(16 + 8 + 8) & -16
save_best_check_dealloc = 0 - save_best_check_alloc
save_best_check_fd = 24
        .balign 4
        .global save_best_check
save_best_check:
        stp     fp, lr, [sp, save_best_check_alloc]!
        mov     fp, sp
        str     save_score_r, [sp, 16]
        ldr     x9, =SAVE_BEST_MAX
        cmp     x0, x9
        csel    save_score_r, x0, x9, le
        ldr     x9, =save_new
        str     xzr, [x9]
        ldr     x10, =save_best
        ldr     x11, [x10]
        cmp     save_score_r, x11
        b.le    save_best_check_done
        str     save_score_r, [x10]
        mov     x11, 1
        str     x11, [x9]
        // a file that cannot be written only costs the record, never the game
        mov     x0, AT_FDCWD
        ldr     x1, =save_s_best
        mov     x2, FILE_NEW
        mov     x3, FILE_MODE
        mov     x8, SYS_OPENAT
        svc     0
        tbnz    x0, 63, save_best_check_done
        str     x0, [sp, save_best_check_fd]
        mov     x0, save_score_r
        ldr     x1, =save_hdr
        bl      main_fmt_dec
        mov     w9, SAVE_LF
        strb    w9, [x0], 1
        ldr     x1, =save_hdr
        sub     x2, x0, x1
        ldr     x0, [sp, save_best_check_fd]
        bl      tty_write_all
        ldr     x0, [sp, save_best_check_fd]
        mov     x8, SYS_CLOSE
        svc     0
save_best_check_done:
        ldr     save_score_r, [sp, 16]
        ldp     fp, lr, [sp], save_best_check_dealloc
        ret
