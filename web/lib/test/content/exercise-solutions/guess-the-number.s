// a guessing game: the first number in the input is the secret,
// every number after it is a guess

define(fp, x29)
define(lr, x30)

define(secret_r, x19)
define(guess_r, x20)
define(count_r, x21)

.data
fmt_in:     .string "%ld"
msg_higher: .string "higher\n"
msg_lower:  .string "lower\n"
fmt_win:    .string "correct! guesses = %ld\n"

.bss
.balign 8
secret_m:   .skip 8
guess_m:    .skip 8

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read the secret
        ldr     x1, =secret_m
        bl      scanf
        ldr     x9, =secret_m
        ldr     secret_r, [x9]

        mov     count_r, 0

        // post-test loop: there is no guess to test until one is read
guess_loop:
        ldr     x0, =fmt_in
        ldr     x1, =guess_m
        bl      scanf
        ldr     x9, =guess_m
        ldr     guess_r, [x9]
        add     count_r, count_r, 1

        cmp     guess_r, secret_r
        b.eq    guess_test                  // a hit gets no hint
        b.gt    too_high
        ldr     x0, =msg_higher
        bl      printf
        b       guess_test
too_high:
        ldr     x0, =msg_lower
        bl      printf
guess_test:
        cmp     guess_r, secret_r
        b.ne    guess_loop

        ldr     x0, =fmt_win
        mov     x1, count_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
