// count_down(1) calls count_down(0), whose ret skips the instruction after
// the bl and goes to no caller. count_down(1) still hands fp back with its
// ldp before its own ret to main, which prints 7 and exits 0.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "%ld\n"

.text

// count_down(x0 = n) calls itself down to 0 (bug: the base case moves lr)
        .balign 4
        .global count_down
count_down:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        cbz     x0, cd_base
        sub     x0, x0, 1
        bl      count_down
        nop                                 // skipped by the base case's ret
        b       cd_done
cd_base:
        ldp     fp, lr, [sp], 16
        add     lr, lr, 4                   // past the nop after the bl
        ret
cd_done:
        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 1
        bl      count_down

        ldr     x0, =fmt_out
        mov     x1, 7
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
