// add a doubled bonus to the running total
define(fp, x29)
define(lr, x30)

define(total_r, x19)

        .data
fmt_in:     .string "%lld %lld"
fmt_out:    .string "total = %lld\n"

        .bss
        .balign 8
total_m:    .skip 8
bonus_m:    .skip 8

        .text

// double_it(x0 = n) -> x0 = 2 * n
        .balign 4
        .global double_it
double_it:
        mov     x9, x0                      // scratch belongs in x9-x15
        add     x9, x9, x9
        mov     x0, x9
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read the total and the bonus
        ldr     x1, =total_m
        ldr     x2, =bonus_m
        bl      scanf
        ldr     x9, =total_m
        ldr     total_r, [x9]
        ldr     x9, =bonus_m
        ldr     x0, [x9]                    // the bonus goes to the helper

        bl      double_it                   // x0 = the doubled bonus
        add     total_r, total_r, x0

        ldr     x0, =fmt_out
        mov     x1, total_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
