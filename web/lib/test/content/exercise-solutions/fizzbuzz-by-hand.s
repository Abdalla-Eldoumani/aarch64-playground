// fizzbuzz: multiples of 3 say fizz, of 5 say buzz, of both say fizzbuzz
define(fp, x29)
define(lr, x30)

define(i_r, x19)
define(limit_r, x20)
define(q_r, x21)
define(rem3_r, x22)
define(rem5_r, x23)

        .data
fmt_in:     .string "%lld"
fmt_num:    .string "%lld\n"
fmt_fizz:   .string "fizz\n"
fmt_buzz:   .string "buzz\n"
fmt_both:   .string "fizzbuzz\n"

        .bss
        .balign 8
limit_m:    .skip 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read the limit
        ldr     x1, =limit_m
        bl      scanf
        ldr     x9, =limit_m
        ldr     limit_r, [x9]
        mov     i_r, 1                      // count 1 through limit

loop:
        cmp     i_r, limit_r
        b.gt    done

        mov     x9, 3
        udiv    q_r, i_r, x9
        msub    rem3_r, q_r, x9, i_r        // i - (i / 3) * 3
        mov     x9, 5
        udiv    q_r, i_r, x9
        msub    rem5_r, q_r, x9, i_r        // i - (i / 5) * 5

        cbnz    rem3_r, not_both
        cbnz    rem5_r, fizz_only
        ldr     x0, =fmt_both
        bl      printf
        b       next
not_both:
        cbnz    rem5_r, plain
        ldr     x0, =fmt_buzz
        bl      printf
        b       next
fizz_only:
        ldr     x0, =fmt_fizz
        bl      printf
        b       next
plain:
        ldr     x0, =fmt_num
        mov     x1, i_r
        bl      printf
next:
        add     i_r, i_r, 1
        b       loop
done:

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
