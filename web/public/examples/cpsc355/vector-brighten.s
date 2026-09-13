// Brighten a tiny grayscale picture and print it before and after.
// Each pixel is one byte, 0 for black up to 255 for white. uqadd adds
// the same amount to sixteen pixels at once and stops at 255 instead of
// wrapping past it, which is what a plain add would do to the bright ones.

define(fp, x29)
define(lr, x30)
define(row_r, x19)
define(col_r, w20)
define(rows_r, w21)

define(ROWS, 3)
define(COLS, 16)
define(BOOST, 96)

        .data
        .align 4
picture:    .byte 0, 16, 32, 48, 64, 80, 96, 112
            .byte 128, 144, 160, 176, 192, 208, 224, 240
            .byte 240, 224, 208, 192, 176, 160, 144, 128
            .byte 112, 96, 80, 64, 48, 32, 16, 0
            .byte 0, 0, 32, 32, 64, 64, 96, 96
            .byte 128, 128, 160, 160, 192, 192, 224, 224
ramp:       .string " .:-=+#@"              // eight shades, darkest first
fmt_before: .string "before:\n"
fmt_after:  .string "after:\n"

        .text

// show(): print the picture, one character per pixel, one line per row
        .balign 4
show:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        stp     x19, x20, [fp, 16]      // main keeps values in these
        str     x21, [fp, 24]

        ldr     row_r, =picture
        mov     rows_r, 0
        b       sh_row_test
sh_row:
        mov     col_r, 0
        b       sh_col_test
sh_col:
        ldrb    w9, [row_r, col_r, sxtw] // one pixel
        lsr     w9, w9, 5               // 0..255 down to 0..7
        ldr     x10, =ramp
        ldrb    w0, [x10, x9]           // the shade for that pixel
        bl      putchar
        add     col_r, col_r, 1
sh_col_test:
        cmp     col_r, COLS
        b.lt    sh_col
        mov     w0, '\n'
        bl      putchar
        add     row_r, row_r, COLS
        add     rows_r, rows_r, 1
sh_row_test:
        cmp     rows_r, ROWS
        b.lt    sh_row

        ldp     x19, x20, [fp, 16]
        ldr     x21, [fp, 24]
        ldp     fp, lr, [sp], 32
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_before
        bl      printf
        bl      show

        movi    v16.16b, BOOST          // sixteen copies of the boost
        ldr     row_r, =picture
        mov     rows_r, 0
        b       br_test
br_loop:
        ldr     q0, [row_r]             // one row of sixteen pixels
        uqadd   v0.16b, v0.16b, v16.16b // brighten, capped at 255
        str     q0, [row_r]
        add     row_r, row_r, COLS
        add     rows_r, rows_r, 1
br_test:
        cmp     rows_r, ROWS
        b.lt    br_loop

        ldr     x0, =fmt_after
        bl      printf
        bl      show

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
