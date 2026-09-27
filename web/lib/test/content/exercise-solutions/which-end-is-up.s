// print the four bytes of a word in the order they sit in memory
define(fp, x29)
define(lr, x30)

word_s = 16                                 // the word's frame offset
alloc = -(16 + 4) & -16
dealloc = -alloc

.data
fmt_in:     .string "%x"
fmt_out:    .string "%02x %02x %02x %02x\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read one word, typed in hex
        add     x1, fp, word_s
        bl      scanf

        ldrb    w1, [fp, word_s]            // lowest address first
        ldrb    w2, [fp, word_s + 1]
        ldrb    w3, [fp, word_s + 2]
        ldrb    w4, [fp, word_s + 3]        // highest address last
        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
