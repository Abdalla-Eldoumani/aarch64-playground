// fib keeps n in x19 and fib(n - 1) in x20, saving the caller's pair at
// fp + 16 and putting it back before each ret. Its base case's ret skips the
// nop after a bl and goes to no caller; main prints fib(4) = 3 and exits 0.

define(fp, x29)
define(lr, x30)

define(n_r, x19)
define(prev_r, x20)

pair_s = 16
alloc = -(16 + 16) & -16
dealloc = -alloc

.data
fmt_out:    .string "%ld\n"

.text

// fib(x0 = n) -> x0 = fib(n) (bug: the base case moves lr)
        .balign 4
        .global fib
fib:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        stp     n_r, prev_r, [fp, pair_s]   // the caller's x19 and x20

        mov     n_r, x0
        cmp     n_r, 1
        b.le    fib_base
        sub     x0, n_r, 1
        bl      fib
        nop                                 // skipped when fib(n - 1) is a base case
        mov     prev_r, x0
        sub     x0, n_r, 2
        bl      fib
        nop                                 // skipped when fib(n - 2) is a base case
        add     x0, x0, prev_r

        ldp     n_r, prev_r, [fp, pair_s]
        ldp     fp, lr, [sp], dealloc
        ret
fib_base:
        ldp     n_r, prev_r, [fp, pair_s]   // x0 = n already
        ldp     fp, lr, [sp], dealloc
        add     lr, lr, 4                   // past the nop after the bl
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 4
        bl      fib

        mov     x1, x0
        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
