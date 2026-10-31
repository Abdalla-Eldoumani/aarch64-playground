// bump uses x20 as scratch and returns with it changed. main keeps its own
// value in x19 without saving it, as course programs do in main. 42 prints.

define(fp, x29)
define(lr, x30)

define(total_r, x19)

.data
fmt_out:    .string "%ld\n"

.text

// bump(x0 = n) -> x0 = n + 1 (bug: x20 is callee-saved)
        .balign 4
        .global bump
bump:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x20, x0                     // scratch copy of n
        add     x20, x20, 1
        mov     x0, x20
        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     total_r, 41
        mov     x0, total_r
        bl      bump                        // x0 = 42

        mov     x1, x0
        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
