// Uppercase a line of text sixteen characters at a time.
// A v register holds 16 bytes, so one compare and one subtract fix all
// sixteen at once; the line buffer is exactly four registers wide.

define(fp, x29)
define(lr, x30)
define(text_r, x19)
define(end_r, x20)

define(LINE_MAX, 64)

        .data
prompt:     .string "Type a line: "
fmt_out:    .string "%s"

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

        // fgets(line, LINE_MAX, stdin): keeps the newline, so fmt_out needs none
        ldr     x0, =line
        mov     w1, LINE_MAX
        ldr     x9, =stdin
        ldr     x2, [x9]
        bl      fgets

        movi    v16.16b, 'a'            // sixteen copies of 'a'
        movi    v17.16b, 'z'            // sixteen copies of 'z'
        movi    v18.16b, 32             // 'a' - 'A', the gap between the cases

        ldr     text_r, =line
        add     end_r, text_r, LINE_MAX
        b       up_test
up_loop:
        ldr     q0, [text_r]            // sixteen characters in one load
        cmge    v1.16b, v0.16b, v16.16b // lane = all ones where c >= 'a'
        cmge    v2.16b, v17.16b, v0.16b // lane = all ones where c <= 'z'
        and     v1.16b, v1.16b, v2.16b  // both true: this lane is a lowercase letter
        and     v1.16b, v1.16b, v18.16b // 32 in those lanes, 0 in the rest
        sub     v0.16b, v0.16b, v1.16b  // so only the lowercase lanes move
        str     q0, [text_r]
        add     text_r, text_r, 16
up_test:
        cmp     text_r, end_r
        b.lt    up_loop

        ldr     x0, =fmt_out
        ldr     x1, =line
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
