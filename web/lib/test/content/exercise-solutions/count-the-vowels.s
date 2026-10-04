// count the vowels in a line of text
define(fp, x29)
define(lr, x30)

define(ptr_r, x19)
define(count_r, x20)
define(ch_r, w21)

define(LINE_MAX, 256)

        .data
fmt_out:    .string "vowels = %lld\n"

        .bss
line:       .skip 256                       // LINE_MAX bytes

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =line                   // read one line, newline and all
        mov     w1, LINE_MAX
        ldr     x9, =stdin
        ldr     x2, [x9]
        bl      fgets

        ldr     ptr_r, =line
        mov     count_r, 0

vowel_loop:
        ldrb    ch_r, [ptr_r], 1            // post-index: load, then advance
        cbz     ch_r, vowels_done
        cmp     ch_r, 'a'
        b.eq    vowel
        cmp     ch_r, 'e'
        b.eq    vowel
        cmp     ch_r, 'i'
        b.eq    vowel
        cmp     ch_r, 'o'
        b.eq    vowel
        cmp     ch_r, 'u'
        b.ne    vowel_loop
vowel:
        add     count_r, count_r, 1
        b       vowel_loop
vowels_done:

        ldr     x0, =fmt_out
        mov     x1, count_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
