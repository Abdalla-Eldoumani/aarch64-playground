// count_down keeps n in x19, saving the caller's x19 at fp + 16 and putting
// it back before each ret. The base case's ret skips the nop after the bl
// and goes to no caller; main prints 7 and exits 0.

define(fp, x29)
define(lr, x30)

define(n_r, x19)

x19_s = 16
alloc = -(16 + 8) & -16
dealloc = -alloc

.data
fmt_out:    .string "%ld\n"

.text

// count_down(x0 = n) calls itself down to 0 (bug: the base case moves lr)
        .balign 4
        .global count_down
count_down:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        str     n_r, [fp, x19_s]            // the caller's x19

        mov     n_r, x0
        cbz     n_r, cd_base
        sub     x0, n_r, 1
        bl      count_down
        nop                                 // skipped by the base case's ret
        b       cd_done
cd_base:
        ldr     n_r, [fp, x19_s]
        ldp     fp, lr, [sp], dealloc
        add     lr, lr, 4                   // past the nop after the bl
        ret
cd_done:
        ldr     n_r, [fp, x19_s]
        ldp     fp, lr, [sp], dealloc
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 2
        bl      count_down

        ldr     x0, =fmt_out
        mov     x1, 7
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
