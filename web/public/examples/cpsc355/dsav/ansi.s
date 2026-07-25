// ansi.asm - ANSI escape sequence helpers
// screen clearing, cursor movement, colors and attributes

define(fp, x29)
define(lr, x30)

    .data
    .balign 8

// screen control
seq_clear:              .string "\x1b[2J"
seq_clear_line:         .string "\x1b[2K"
seq_home:               .string "\x1b[H"
seq_reset:              .string "\x1b[0m"

// cursor control
seq_hide_cursor:        .string "\x1b[?25l"
seq_show_cursor:        .string "\x1b[?25h"
seq_save_cursor:        .string "\x1b[s"
seq_restore_cursor:     .string "\x1b[u"

// text attributes
seq_bold:               .string "\x1b[1m"
seq_dim:                .string "\x1b[2m"
seq_underline:          .string "\x1b[4m"
seq_blink:              .string "\x1b[5m"
seq_reverse:            .string "\x1b[7m"

// foreground colors (30-37)
seq_fg_black:           .string "\x1b[30m"
seq_fg_red:             .string "\x1b[31m"
seq_fg_green:           .string "\x1b[32m"
seq_fg_yellow:          .string "\x1b[33m"
seq_fg_blue:            .string "\x1b[34m"
seq_fg_magenta:         .string "\x1b[35m"
seq_fg_cyan:            .string "\x1b[36m"
seq_fg_white:           .string "\x1b[37m"

// bright foreground colors (90-97)
seq_fg_bright_black:    .string "\x1b[90m"
seq_fg_bright_red:      .string "\x1b[91m"
seq_fg_bright_green:    .string "\x1b[92m"
seq_fg_bright_yellow:   .string "\x1b[93m"
seq_fg_bright_blue:     .string "\x1b[94m"
seq_fg_bright_magenta:  .string "\x1b[95m"
seq_fg_bright_cyan:     .string "\x1b[96m"
seq_fg_bright_white:    .string "\x1b[97m"

// background colors (40-47)
seq_bg_black:           .string "\x1b[40m"
seq_bg_red:             .string "\x1b[41m"
seq_bg_green:           .string "\x1b[42m"
seq_bg_yellow:          .string "\x1b[43m"
seq_bg_blue:            .string "\x1b[44m"
seq_bg_magenta:         .string "\x1b[45m"
seq_bg_cyan:            .string "\x1b[46m"
seq_bg_white:           .string "\x1b[47m"

// printf templates for cursor position and color
fmt_position:           .string "\x1b[%d;%dH"
fmt_color:              .string "\x1b[%dm"

    .text
    .balign 4

// ansi_clear_screen() - clear everything and home the cursor
    .global ansi_clear_screen
ansi_clear_screen:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =seq_clear
    bl      printf

    ldr     x0, =seq_home
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// ansi_clear_line() - erase the current line
    .global ansi_clear_line
ansi_clear_line:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =seq_clear_line
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// ansi_reset_attributes() - back to default colors and attributes
    .global ansi_reset_attributes
ansi_reset_attributes:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =seq_reset
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// ansi_move_cursor(w0 = row, w1 = column), both 1-based
    .global ansi_move_cursor
ansi_move_cursor:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w2, w1                          // column -> 3rd printf arg
    mov     w1, w0                          // row -> 2nd printf arg
    ldr     x0, =fmt_position
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// ansi_hide_cursor()
    .global ansi_hide_cursor
ansi_hide_cursor:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =seq_hide_cursor
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// ansi_show_cursor()
    .global ansi_show_cursor
ansi_show_cursor:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =seq_show_cursor
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// ansi_set_color_fg(w0 = color code, 30-37 normal or 90-97 bright)
    .global ansi_set_color_fg
ansi_set_color_fg:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w1, w0                          // color code -> 2nd printf arg
    ldr     x0, =fmt_color
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// ansi_set_color_bg(w0 = color code, 40-47 normal or 100-107 bright)
    .global ansi_set_color_bg
ansi_set_color_bg:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w1, w0                          // color code -> 2nd printf arg
    ldr     x0, =fmt_color
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// ansi_print_color(x0 = string, w1 = color code) - print in color, then reset
    .global ansi_print_color
ansi_print_color:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0                         // x19 = string pointer
    mov     w20, w1                         // w20 = color code

    mov     w0, w20
    bl      ansi_set_color_fg

    mov     x0, x19
    bl      printf

    bl      ansi_reset_attributes

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret
