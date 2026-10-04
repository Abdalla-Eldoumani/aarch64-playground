// count the collatz steps that take n down to 1

define(fp, x29)
define(lr, x30)

define(n_r, x19)
define(steps_r, x20)
define(two_r, x21)
define(three_r, x22)
define(half_r, x23)
define(rem_r, x24)

.data
fmt_in:     .string "%ld"
fmt_out:    .string "steps = %ld\n"
msg_bad:    .string "n must be at least 1\n"

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

        mov     steps_r, 0

        cmp     n_r, 1                      // 0 would halve to 0 forever
        b.lt    bad_n

        mov     two_r, 2
        mov     three_r, 3
        b       cz_test                     // test first: n = 1 takes no steps

cz_loop:
        udiv    half_r, n_r, two_r
        msub    rem_r, half_r, two_r, n_r   // rem = n - (n / 2) * 2
        cmp     rem_r, 0
        b.ne    cz_odd
        mov     n_r, half_r                 // even: n = n / 2
        b       cz_count
cz_odd:
        mul     n_r, n_r, three_r           // odd: n = 3n + 1
        add     n_r, n_r, 1
cz_count:
        add     steps_r, steps_r, 1
cz_test:
        cmp     n_r, 1
        b.ne    cz_loop

        ldr     x0, =fmt_out
        mov     x1, steps_r
        bl      printf

        mov     w0, 0
        b       done

bad_n:
        ldr     x0, =msg_bad
        bl      printf
        mov     w0, 1

done:
        ldp     fp, lr, [sp], 16
        ret
