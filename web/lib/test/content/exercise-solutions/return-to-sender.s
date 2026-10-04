// describe each number read with one call that returns a 24-byte struct through x8
define(fp, x29)
define(lr, x30)

// struct profile { long square; int sign; int odd; int last; }
square_o = 0
sign_o = 8
odd_o = 12
last_o = 16
profile_size = 24                           // 20 bytes of fields, padded to a multiple of 8 for the long

n_s = 16
profile_s = 24
alloc = -(16 + 8 + profile_size) & -16
dealloc = -alloc

.data
fmt_in:     .string "%ld"
fmt_out:    .string "%ld: square %ld, sign %d, odd %d, last digit %d\n"

.text

// describe(x0 = n) -> struct profile, written to the address in x8
// Over 16 bytes, the struct cannot come back in x0 and x1, so the caller says where it goes.
        .balign 4
        .global describe
describe:
        mul     x9, x0, x0                  // 64 bits: the square of 100000 needs more than 32
        str     x9, [x8, square_o]

        cmp     x0, 0
        b.gt    d_positive
        b.lt    d_negative
        mov     w9, 0
        b       d_sign
d_positive:
        mov     w9, 1
        b       d_sign
d_negative:
        mov     w9, -1
d_sign:
        str     w9, [x8, sign_o]

        and     x9, x0, 1                   // the lowest bit marks odd numbers, negative ones too
        str     w9, [x8, odd_o]

        mov     x10, 10
        sdiv    x11, x0, x10
        msub    x9, x11, x10, x0            // n % 10 takes n's sign
        cmp     x9, 0
        b.ge    d_last
        neg     x9, x9
d_last:
        str     w9, [x8, last_o]
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        b       fill_test

next_n:
        ldr     x0, [fp, n_s]
        add     x8, fp, profile_s           // where describe must deliver the struct
        bl      describe

        ldr     x2, [fp, profile_s + square_o]
        ldr     w3, [fp, profile_s + sign_o]
        ldr     w4, [fp, profile_s + odd_o]
        ldr     w5, [fp, profile_s + last_o]
        ldr     x0, =fmt_out
        ldr     x1, [fp, n_s]
        bl      printf

fill_test:
        ldr     x0, =fmt_in
        add     x1, fp, n_s
        bl      scanf
        cmp     w0, 1                       // 1 value matched; -1 means the input ran out
        b.eq    next_n

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
