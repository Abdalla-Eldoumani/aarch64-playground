// draw a box around one word read from input
define(fp, x29)
define(lr, x30)

.data
fmt_in:     .string "%10s"
fmt_mid:    .string "| %-10s |\n"
border:     .string "+------------+\n"      // printf adds no line break of its own

.bss
word_buf:   .skip 11                        // up to 10 characters and the zero byte

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read one word, cut to 10 characters
        ldr     x1, =word_buf
        bl      scanf

        ldr     x0, =border                 // top edge
        bl      printf

        ldr     x0, =fmt_mid                // the word, padded to 10 columns
        ldr     x1, =word_buf
        bl      printf

        ldr     x0, =border                 // printf may have changed x0, so load it again
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
