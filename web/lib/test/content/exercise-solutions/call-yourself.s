// compute a factorial with a recursive subroutine
define(fp, x29)
define(lr, x30)

define(n_r, x19)

        .data
fmt_in:     .string "%lld"
fmt_out:    .string "%lld! = %lld\n"

        .bss
        .balign 8
n_m:        .skip 8

        .text

// fact(x0 = n) -> x0 = n!
        .balign 4
        .global fact
fact:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     n_r, [fp, 16]               // the caller's x19, put back below

        mov     n_r, x0
        cmp     n_r, 1
        b.le    fact_base
        sub     x0, n_r, 1
        bl      fact                        // x0 = (n - 1)!
        mul     x0, x0, n_r
        b       fact_out
fact_base:
        mov     x0, 1
fact_out:
        ldr     n_r, [fp, 16]
        ldp     fp, lr, [sp], 32
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read n
        ldr     x1, =n_m
        bl      scanf
        ldr     x9, =n_m
        ldr     n_r, [x9]

        mov     x0, n_r                     // the argument
        bl      fact

        mov     x2, x0                      // n! prints after n itself
        mov     x1, n_r
        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
