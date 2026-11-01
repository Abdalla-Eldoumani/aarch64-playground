// add_three ends in a tail call: it pops its frame and reaches add_two with
// b, so add_two's ret goes back to main, where add_three's own ret would
// have gone. Every rule holds; main prints 7 and exits 0.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "%ld\n"

.text

// add_two(x0 = n) -> x0 = n + 2
        .balign 4
        .global add_two
add_two:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        add     x0, x0, 2

        ldp     fp, lr, [sp], 16
        ret

// add_three(x0 = n) -> x0 = n + 3, finished by add_two
        .balign 4
        .global add_three
add_three:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        add     x0, x0, 1

        ldp     fp, lr, [sp], 16
        b       add_two                     // tail call: add_two returns to main

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 4
        bl      add_three

        mov     x1, x0                      // 4 + 3
        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
