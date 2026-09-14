// Count the characters in a line sixteen at a time.
// cmeq marks every lane holding the zero byte that ends a string, and
// umaxv folds the sixteen marks into one number: nonzero means the end
// is somewhere in this block, and a byte loop finds exactly where.

define(fp, x29)
define(lr, x30)
define(text_r, x19)
define(len_r, w20)

define(LINE_MAX, 64)

        .data
prompt:     .string "Type a line: "
fmt_out:    .string "%d characters\n"

        .bss
        .align 4
line:       .skip 64                        // LINE_MAX bytes, zero-filled

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =prompt
        bl      printf

        ldr     x0, =line               // fgets(line, LINE_MAX, stdin)
        mov     w1, LINE_MAX
        ldr     x9, =stdin
        ldr     x2, [x9]
        bl      fgets

        movi    v16.16b, 0              // sixteen zero bytes to compare against
        ldr     text_r, =line
sl_block:
        ldr     q0, [text_r]            // sixteen characters in one load
        cmeq    v1.16b, v0.16b, v16.16b // lane = all ones where the byte is 0
        umaxv   b2, v1.16b              // b2 = 255 if any lane matched, else 0
        fmov    w9, s2                  // the byte, into an integer register
        cbnz    w9, sl_tail             // the end is in this block
        add     text_r, text_r, 16
        b       sl_block
sl_tail:
        ldrb    w9, [text_r]            // walk the last block one byte at a time
        cbz     w9, sl_done
        add     text_r, text_r, 1
        b       sl_tail
sl_done:
        ldr     x9, =line
        sub     x10, text_r, x9         // bytes before the zero
        sub     x11, text_r, 1
        ldrb    w11, [x11]
        cmp     w11, '\n'               // fgets keeps the newline; do not count it
        b.ne    sl_print
        sub     x10, x10, 1
sl_print:
        mov     len_r, w10

        ldr     x0, =fmt_out
        mov     w1, len_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
