// prime-test.s - leaf primality check called from main
// is_prime is a true leaf: it sets up no frame and touches only scratch
// registers, taking n in w0 and returning 1 (prime) or 0 in w0. main
// reports the result for one prime and one composite value.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "%d is prime: %d\n"

.text
.balign 4
.global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w0, 17
        bl      is_prime
        mov     w20, w0                 // hold the result across printf
        ldr     x0, =fmt_out
        mov     w1, 17
        mov     w2, w20
        bl      printf

        mov     w0, 21
        bl      is_prime
        mov     w20, w0
        ldr     x0, =fmt_out
        mov     w1, 21
        mov     w2, w20
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

// is_prime(w0) -> w0 : 1 when w0 is prime, else 0. Leaf, scratch only.
is_prime:
        cmp     w0, 2
        b.lt    not_prime               // 0 and 1 are not prime
        mov     w9, 2                   // trial divisor
ip_loop:
        mul     w10, w9, w9             // divisor squared
        cmp     w10, w0
        b.gt    is_prime_yes            // divisor^2 > n -> prime
        udiv    w11, w0, w9
        msub    w12, w11, w9, w0        // remainder = n - (n / d) * d
        cbz     w12, not_prime          // divides evenly -> composite
        add     w9, w9, 1
        b       ip_loop
is_prime_yes:
        mov     w0, 1
        ret
not_prime:
        mov     w0, 0
        ret
