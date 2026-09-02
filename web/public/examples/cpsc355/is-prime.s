// is-prime.s - is_prime(w0) -> w0
// Returns 1 if w0 is prime, 0 otherwise.
// No main here: assemble it beside a caller that supplies one.

define(fp, x29)
define(lr, x30)

        .balign 4
        .global is_prime
is_prime:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // Handle n < 2
        cmp     w0, 2
        b.lt    not_prime

        // Handle n == 2
        cmp     w0, 2                   // flags still hold from the test above; kept for readability
        b.eq    yes_prime

        // Even numbers > 2 are not prime
        tst     w0, 1                   // b.eq fires when bit 0 is clear, so n is even
        b.eq    not_prime

        // Trial division from 3, step 2
        mov     w9, w0                  // w9 = n
        mov     w10, 3                  // w10 = divisor
        b       prime_test

prime_loop:
        // Check if n % divisor == 0
        sdiv    w11, w9, w10            // quotient
        msub    w11, w11, w10, w9       // remainder = n - (n / d) * d
        cbz     w11, not_prime          // divisible, not prime

        add     w10, w10, 2             // next odd divisor
prime_test:
        mul     w11, w10, w10           // divisor * divisor
        cmp     w11, w9
        b.le    prime_loop              // while divisor^2 <= n

yes_prime:
        mov     w0, 1
        b       prime_done
not_prime:
        mov     w0, 0
prime_done:
        ldp     fp, lr, [sp], 16
        ret
