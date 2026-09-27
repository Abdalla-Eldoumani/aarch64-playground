// is-prime.s - is_prime(w0) -> w0
// Returns 1 if w0 is prime, 0 otherwise.
// main asks is_prime about every number from 1 to 30 and prints the primes.

define(fp, x29)
define(lr, x30)
define(n_r, w19)

        .text
fmt_head:   .string "primes up to 30:"
fmt_num:    .string " %d"
fmt_end:    .string "\n"

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

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     x19, [fp, 16]           // n_r lives in x19, which main must hand back unchanged

        ldr     x0, =fmt_head
        bl      printf

        mov     n_r, 1
        b       main_test

main_loop:
        mov     w0, n_r
        bl      is_prime                // w0 = 1 if n_r is prime
        cbz     w0, main_next           // not prime: print nothing

        ldr     x0, =fmt_num
        mov     w1, n_r
        bl      printf

main_next:
        add     n_r, n_r, 1
main_test:
        cmp     n_r, 30
        b.le    main_loop

        ldr     x0, =fmt_end
        bl      printf

        mov     w0, 0                   // exit status 0
        ldr     x19, [fp, 16]
        ldp     fp, lr, [sp], 32
        ret
