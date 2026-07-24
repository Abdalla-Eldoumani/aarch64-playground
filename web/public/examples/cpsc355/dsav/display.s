// display.asm - box drawing and centered text

define(fp, x29)
define(lr, x30)

    .data
    .balign 8

// single-line box characters (utf-8)
char_top_left:      .string "\xe2\x94\x8c"        // ┌ (U+250C)
char_top_right:     .string "\xe2\x94\x90"        // ┐ (U+2510)
char_bottom_left:   .string "\xe2\x94\x94"        // └ (U+2514)
char_bottom_right:  .string "\xe2\x94\x98"        // ┘ (U+2518)
char_horizontal:    .string "\xe2\x94\x80"        // ─ (U+2500)
char_vertical:      .string "\xe2\x94\x82"        // │ (U+2502)
char_t_down:        .string "\xe2\x94\xac"        // ┬ (U+252C)
char_t_up:          .string "\xe2\x94\xb4"        // ┴ (U+2534)
char_t_right:       .string "\xe2\x94\x9c"        // ├ (U+251C)
char_t_left:        .string "\xe2\x94\xa4"        // ┤ (U+2524)
char_cross:         .string "\xe2\x94\xbc"        // ┼ (U+253C)

// double-line box characters (utf-8)
char_d_top_left:    .string "\xe2\x95\x94"        // ╔ (U+2554)
char_d_top_right:   .string "\xe2\x95\x97"        // ╗ (U+2557)
char_d_bottom_left: .string "\xe2\x95\x9a"        // ╚ (U+255A)
char_d_bottom_right:.string "\xe2\x95\x9d"        // ╝ (U+255D)
char_d_horizontal:  .string "\xe2\x95\x90"        // ═ (U+2550)
char_d_vertical:    .string "\xe2\x95\x91"        // ║ (U+2551)
char_d_t_down:      .string "\xe2\x95\xa6"        // ╦ (U+2566)
char_d_t_up:        .string "\xe2\x95\xa9"        // ╩ (U+2569)
char_d_t_right:     .string "\xe2\x95\xa0"        // ╠ (U+2560)
char_d_t_left:      .string "\xe2\x95\xa3"        // ╣ (U+2563)

char_space:         .string " "

    .text
    .balign 4

// draw_box(w0 = row, w1 = col, w2 = width, w3 = height, w4 = style)
// style: 0 = single line, 1 = double line
    .global draw_box
draw_box:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    str     x25, [sp, 64]

    mov     w19, w0                         // row
    mov     w20, w1                         // col
    mov     w21, w2                         // width
    mov     w22, w3                         // height
    mov     w23, w4                         // style

    // top border
    mov     w0, w19
    mov     w1, w20
    mov     w2, w21
    mov     w3, w23
    bl      draw_horizontal_border_top

    // side rows
    mov     w24, 1                          // line counter
draw_box_middle_loop:
    cmp     w24, w22
    b.ge    draw_box_middle_done
    sub     w0, w22, 1
    cmp     w24, w0
    b.ge    draw_box_middle_done

    add     w0, w19, w24                    // row + line
    mov     w1, w20
    bl      ansi_move_cursor

    cmp     w23, 0
    b.eq    draw_box_single_left
    ldr     x0, =char_d_vertical
    b       draw_box_print_left
draw_box_single_left:
    ldr     x0, =char_vertical
draw_box_print_left:
    bl      printf

    mov     w25, 2                          // interior columns, borders counted
draw_box_spaces_loop:
    cmp     w25, w21
    b.ge    draw_box_spaces_done
    ldr     x0, =char_space
    bl      printf
    add     w25, w25, 1
    b       draw_box_spaces_loop
draw_box_spaces_done:

    cmp     w23, 0
    b.eq    draw_box_single_right
    ldr     x0, =char_d_vertical
    b       draw_box_print_right
draw_box_single_right:
    ldr     x0, =char_vertical
draw_box_print_right:
    bl      printf

    add     w24, w24, 1
    b       draw_box_middle_loop

draw_box_middle_done:
    // bottom border
    add     w0, w19, w22
    sub     w0, w0, 1                       // last row of the box
    mov     w1, w20
    mov     w2, w21
    mov     w3, w23
    bl      draw_horizontal_border_bottom

    ldr     x25, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// draw_horizontal_border_top(w0 = row, w1 = col, w2 = width, w3 = style)
    .global draw_horizontal_border_top
draw_horizontal_border_top:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    mov     w19, w0                         // row
    mov     w20, w1                         // col
    mov     w21, w2                         // width
    mov     w22, w3                         // style

    mov     w0, w19
    mov     w1, w20
    bl      ansi_move_cursor

    // top-left corner
    cmp     w22, 0
    b.eq    draw_htop_single_tl
    ldr     x0, =char_d_top_left
    b       draw_htop_print_tl
draw_htop_single_tl:
    ldr     x0, =char_top_left
draw_htop_print_tl:
    bl      printf

    // horizontal run
    mov     w23, 2                          // two corners already counted
draw_htop_loop:
    cmp     w23, w21
    b.ge    draw_htop_done
    cmp     w22, 0
    b.eq    draw_htop_single_h
    ldr     x0, =char_d_horizontal
    b       draw_htop_print_h
draw_htop_single_h:
    ldr     x0, =char_horizontal
draw_htop_print_h:
    bl      printf
    add     w23, w23, 1
    b       draw_htop_loop

draw_htop_done:
    // top-right corner
    cmp     w22, 0
    b.eq    draw_htop_single_tr
    ldr     x0, =char_d_top_right
    b       draw_htop_print_tr
draw_htop_single_tr:
    ldr     x0, =char_top_right
draw_htop_print_tr:
    bl      printf

    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// draw_horizontal_border_bottom(w0 = row, w1 = col, w2 = width, w3 = style)
    .global draw_horizontal_border_bottom
draw_horizontal_border_bottom:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    mov     w19, w0                         // row
    mov     w20, w1                         // col
    mov     w21, w2                         // width
    mov     w22, w3                         // style

    mov     w0, w19
    mov     w1, w20
    bl      ansi_move_cursor

    // bottom-left corner
    cmp     w22, 0
    b.eq    draw_hbot_single_bl
    ldr     x0, =char_d_bottom_left
    b       draw_hbot_print_bl
draw_hbot_single_bl:
    ldr     x0, =char_bottom_left
draw_hbot_print_bl:
    bl      printf

    // horizontal run
    mov     w23, 2                          // two corners already counted
draw_hbot_loop:
    cmp     w23, w21
    b.ge    draw_hbot_done
    cmp     w22, 0
    b.eq    draw_hbot_single_h
    ldr     x0, =char_d_horizontal
    b       draw_hbot_print_h
draw_hbot_single_h:
    ldr     x0, =char_horizontal
draw_hbot_print_h:
    bl      printf
    add     w23, w23, 1
    b       draw_hbot_loop

draw_hbot_done:
    // bottom-right corner
    cmp     w22, 0
    b.eq    draw_hbot_single_br
    ldr     x0, =char_d_bottom_right
    b       draw_hbot_print_br
draw_hbot_single_br:
    ldr     x0, =char_bottom_right
draw_hbot_print_br:
    bl      printf

    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// print_centered(x0 = string, w1 = field width)
    .global print_centered
print_centered:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    str     x23, [sp, 48]

    mov     x19, x0                         // string
    mov     w20, w1                         // field width

    bl      strlen
    mov     w21, w0                         // string length

    // a string wider than the field gets no padding, not a 2^31 run
    subs    w0, w20, w21
    b.pl    print_centered_have_pad
    mov     w0, 0
print_centered_have_pad:
    lsr     w0, w0, 1                       // padding = (width - length) / 2
    mov     w22, w0

    mov     w23, 0
print_centered_pad_loop:
    cmp     w23, w22
    b.ge    print_centered_pad_done
    ldr     x0, =char_space
    bl      printf
    add     w23, w23, 1
    b       print_centered_pad_loop

print_centered_pad_done:
    mov     x0, x19
    bl      printf

    ldr     x23, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 64
    ret

// print_title(x0 = title string, w1 = row)
    .global print_title
print_title:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     x19, x0                         // title
    mov     w20, w1                         // row

    mov     w0, w20
    mov     w1, 1
    bl      ansi_move_cursor

    mov     x0, x19
    mov     w1, 60                          // field width
    bl      print_centered

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret
