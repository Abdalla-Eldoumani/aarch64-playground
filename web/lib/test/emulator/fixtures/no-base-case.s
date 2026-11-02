// A recursion with no base case: count calls itself until the stack runs
// out, 16 bytes a call.
define(fp, x29)
define(lr, x30)

.text
// count(w0 = n) never returns: it calls count(n + 1)
        .balign 4
        .global count
count:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        add     w0, w0, 1
        bl      count                   // no test of n stops this

        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w0, 0
        bl      count

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
