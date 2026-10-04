// build a 64-bit code one halfword at a time, then add a number from input
define(fp, x29)
define(lr, x30)

define(code_r, x19)
define(n_r, x20)
define(sum_r, x21)

.data
fmt_in:     .string "%ld"
fmt_out:    .string "0x%lx + %ld = 0x%lx\n"

.bss
        .balign 8
n_in:       .skip 8                         // scanf stores n here

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read n: scanf gets its own lesson later
        ldr     x1, =n_in
        bl      scanf
        ldr     x9, =n_in
        ldr     n_r, [x9]

        movz    code_r, 0xffff              // bits 0 to 15; every other bit cleared
        movk    code_r, 0xf00d, lsl 16      // bits 16 to 31; the rest kept
        movk    code_r, 0xcafe, lsl 32      // bits 32 to 47
        movk    code_r, 0xbeef, lsl 48      // bits 48 to 63

        add     sum_r, code_r, n_r          // the code plus n

        ldr     x0, =fmt_out
        mov     x1, code_r
        mov     x2, n_r
        mov     x3, sum_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
