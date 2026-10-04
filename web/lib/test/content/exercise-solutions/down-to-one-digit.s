// for each number read, print its digit sum and its digital root
define(fp, x29)
define(lr, x30)

define(n_r, x19)
define(sum_r, x20)
define(root_r, x21)

.data
fmt_in:     .string "%ld"
fmt_out:    .string "%ld: digit sum %ld, digital root %ld\n"

.bss
.align 4
n_in:       .skip 8                         // scanf's landing spot

.text

// digsum(x0 = n, never negative) -> x0 = the sum of n's decimal digits
// A leaf: it calls nothing, so it needs no frame and stays in x9 to x15.
        .balign 4
        .global digsum
digsum:
        mov     x9, 0                       // running sum
        mov     x10, 10
        b       ds_test
ds_loop:
        udiv    x11, x0, x10                // the digits left after this one
        msub    x12, x11, x10, x0           // n % 10, the lowest digit
        add     x9, x9, x12
        mov     x0, x11
ds_test:
        cmp     x0, 0
        b.ne    ds_loop

        mov     x0, x9
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        b       fill_test

next_n:
        ldr     x9, =n_in
        ldr     n_r, [x9]

        mov     x0, n_r
        bl      digsum
        mov     sum_r, x0

        mov     root_r, sum_r               // a digit sum can still have two digits
        b       root_test
root_loop:
        mov     x0, root_r
        bl      digsum
        mov     root_r, x0
root_test:
        cmp     root_r, 9
        b.gt    root_loop

        ldr     x0, =fmt_out
        mov     x1, n_r
        mov     x2, sum_r
        mov     x3, root_r
        bl      printf

fill_test:
        ldr     x0, =fmt_in
        ldr     x1, =n_in
        bl      scanf
        cmp     w0, 1                       // 1 value matched; -1 means the input ran out
        b.eq    next_n

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
