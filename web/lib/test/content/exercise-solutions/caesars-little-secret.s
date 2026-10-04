// decode a message caesar-shifted three letters forward
define(fp, x29)
define(lr, x30)

define(ptr_r, x19)
define(ch_r, w20)

define(LINE_MAX, 256)

        .data
fmt_out:    .string "%s"

        .bss
secret:     .skip 256                       // LINE_MAX bytes

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =secret                 // read the coded line, newline and all
        mov     w1, LINE_MAX
        ldr     x9, =stdin
        ldr     x2, [x9]
        bl      fgets

        ldr     ptr_r, =secret

decode_loop:
        ldrb    ch_r, [ptr_r]
        cbz     ch_r, decoded
        cmp     ch_r, 'a'
        b.lt    next_byte                   // not a lowercase letter
        cmp     ch_r, 'z'
        b.gt    next_byte
        sub     ch_r, ch_r, 3
        cmp     ch_r, 'a'
        b.ge    store
        add     ch_r, ch_r, 26              // wrap around past 'a'
store:
        strb    ch_r, [ptr_r]
next_byte:
        add     ptr_r, ptr_r, 1
        b       decode_loop
decoded:

        ldr     x0, =fmt_out
        ldr     x1, =secret                 // now decoded in place
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
