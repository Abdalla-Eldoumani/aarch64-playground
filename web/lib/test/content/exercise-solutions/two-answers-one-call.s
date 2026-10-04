// divide pairs of numbers with one call that hands back quotient and remainder
define(fp, x29)
define(lr, x30)

define(a_r, x19)
define(b_r, x20)
define(fails_r, w21)

alloc = -(16 + 32) & -16                    // fp and lr, then four 8-byte slots
dealloc = -alloc
a_s = 16
b_s = 24
q_s = 32
r_s = 40

.data
fmt_in:     .string "%ld %ld"
fmt_ok:     .string "%ld / %ld = %ld remainder %ld\n"
fmt_zero:   .string "%ld / 0 has no answer\n"

.text

// divmod(x0 = a, x1 = b, x2 = &quotient, x3 = &remainder) -> w0 = 0, or -1 when b is 0
        .balign 4
        .global divmod
divmod:
        cmp     x1, 0
        b.eq    dm_zero                     // sdiv would quietly answer 0, so refuse first

        sdiv    x9, x0, x1                  // rounds toward zero, like C
        msub    x10, x9, x1, x0             // a - quotient * b
        str     x9, [x2]                    // the answers go where the caller asked
        str     x10, [x3]
        mov     w0, 0
        ret

dm_zero:
        mov     w0, -1
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        mov     fails_r, 0
        b       fill_test

next_pair:
        ldr     a_r, [fp, a_s]
        ldr     b_r, [fp, b_s]

        mov     x0, a_r
        mov     x1, b_r
        add     x2, fp, q_s                 // addresses of the slots, not their contents
        add     x3, fp, r_s
        bl      divmod

        cmp     w0, 0
        b.ne    no_answer

        ldr     x0, =fmt_ok
        mov     x1, a_r
        mov     x2, b_r
        ldr     x3, [fp, q_s]
        ldr     x4, [fp, r_s]
        bl      printf
        b       fill_test

no_answer:
        add     fails_r, fails_r, 1
        ldr     x0, =fmt_zero
        mov     x1, a_r
        bl      printf

fill_test:
        ldr     x0, =fmt_in
        add     x1, fp, a_s
        add     x2, fp, b_s
        bl      scanf
        cmp     w0, 2                       // both numbers matched; anything else ends the input
        b.eq    next_pair

        mov     w0, fails_r                 // the exit status counts the pairs with no answer
        ldp     fp, lr, [sp], dealloc
        ret
