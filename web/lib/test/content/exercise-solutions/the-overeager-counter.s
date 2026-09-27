// count down from n to one, one number per line
define(fp, x29)
define(lr, x30)

define(i_r, x19)

        .data
fmt_in:     .string "%lld"
fmt_out:    .string "%lld\n"

        .bss
        .balign 8
start_m:    .skip 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read where the countdown starts
        ldr     x1, =start_m
        bl      scanf
        ldr     x9, =start_m
        ldr     i_r, [x9]
loop:
        cmp     i_r, 0
        b.le    done                        // stop once i_r runs out
        ldr     x0, =fmt_out
        mov     x1, i_r
        bl      printf
        sub     i_r, i_r, 1
        b       loop
done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
