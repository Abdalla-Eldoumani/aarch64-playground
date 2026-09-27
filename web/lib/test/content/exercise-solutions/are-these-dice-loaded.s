// tally dice rolls from the input and draw one bar per face
define(fp, x29)
define(lr, x30)

define(face_r, w19)
define(count_r, w20)
define(bar_r, w21)
define(tally_r, x22)
define(ignored_r, w23)

define(FACES, 6)

.data
fmt_in:      .string "%d"
fmt_label:   .string "%d |"
fmt_bar:     .string "#"
fmt_newline: .string "\n"
fmt_ignored: .string "ignored %d\n"

.bss
.align 4
tally:      .skip 24                        // FACES ints: the count for each face
roll_in:    .skip 4                         // scanf's landing spot

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     tally_r, =tally
        mov     ignored_r, 0
        b       fill_test

next_roll:
        ldr     x9, =roll_in
        ldr     face_r, [x9]

        cmp     face_r, 1
        b.lt    bad_roll
        cmp     face_r, FACES
        b.gt    bad_roll

        sub     w9, face_r, 1               // face 1 lives at index 0
        ldr     w10, [tally_r, w9, SXTW 2]
        add     w10, w10, 1
        str     w10, [tally_r, w9, SXTW 2]
        b       fill_test

bad_roll:
        add     ignored_r, ignored_r, 1

fill_test:
        ldr     x0, =fmt_in
        ldr     x1, =roll_in
        bl      scanf
        cmp     w0, 1                       // 1 value matched; -1 means the input ran out
        b.eq    next_roll

        mov     face_r, 1
        b       face_test
face_loop:
        ldr     x0, =fmt_label
        mov     w1, face_r
        bl      printf

        sub     w9, face_r, 1
        ldr     count_r, [tally_r, w9, SXTW 2]

        mov     bar_r, 0
        b       bar_test
bar_loop:
        ldr     x0, =fmt_bar
        bl      printf
        add     bar_r, bar_r, 1
bar_test:
        cmp     bar_r, count_r
        b.lt    bar_loop

        ldr     x0, =fmt_newline
        bl      printf
        add     face_r, face_r, 1
face_test:
        cmp     face_r, FACES
        b.le    face_loop

        ldr     x0, =fmt_ignored
        mov     w1, ignored_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
