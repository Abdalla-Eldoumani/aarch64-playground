// skip_next moves lr on by one instruction, so its ret skips the nop after
// main's bl and goes to no caller. main's ldp still hands fp back before its
// own ret, so main prints 7 and exits 0.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "%ld\n"

.text

// skip_next() returns past the instruction after its call (bug: lr moved)
        .balign 4
        .global skip_next
skip_next:
        add     lr, lr, 4                   // past the nop after the bl
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      skip_next
        nop                                 // skipped by skip_next's ret

        ldr     x0, =fmt_out
        mov     x1, 7
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
