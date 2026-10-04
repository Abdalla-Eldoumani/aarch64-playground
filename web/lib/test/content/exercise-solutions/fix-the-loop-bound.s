// compute n factorial and print the result
define(fp, x29)
define(lr, x30)

define(acc_r, x19)
define(i_r, x20)
define(n_r, x21)

        .data
fmt_in:     .string "%lld"
fmt_out:    .string "%lld! = %lld\n"

        .bss
        .balign 8
n_m:        .skip 8

        .text
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

        mov     acc_r, 1                    // running product
        mov     i_r, 1                      // loop counter
loop:
        cmp     i_r, n_r
        b.gt    done
        mul     acc_r, acc_r, i_r
        add     i_r, i_r, 1
        b       loop
done:
        ldr     x0, =fmt_out
        mov     x1, n_r
        mov     x2, acc_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
