// decide whether a number is a power of two
define(fp, x29)
define(lr, x30)

define(n_r, x19)

.data
fmt_num:    .string "%ld"
fmt_yes:    .string "%ld is a power of two\n"
fmt_no:     .string "%ld is not a power of two\n"

.bss
.balign 8
n_m:        .skip 8

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_num                // read n into n_m
        ldr     x1, =n_m
        bl      scanf
        ldr     x9, =n_m
        ldr     n_r, [x9]

        ldr     x0, =fmt_no                 // assume no until n proves it
        cmp     n_r, 0
        b.le    pw_print                    // zero and negatives never are
        sub     x9, n_r, 1
        tst     n_r, x9                     // no bits shared with n - 1
        b.ne    pw_print
        ldr     x0, =fmt_yes
pw_print:
        mov     x1, n_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
