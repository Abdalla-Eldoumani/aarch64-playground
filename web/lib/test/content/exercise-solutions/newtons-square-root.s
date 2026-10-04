// square root by Newton's method: improve a guess until it stops shrinking
define(fp, x29)
define(lr, x30)

n_s = 16                                    // the number read by scanf
alloc = -(16 + 8) & -16
dealloc = -alloc

.data
fmt_in:     .string "%lf"
fmt_root:   .string "square root = %.6f\n"
fmt_neg:    .string "no real square root\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x0, =fmt_in
        add     x1, fp, n_s
        bl      scanf

        ldr     d1, [fp, n_s]               // d1 = n
        fmov    d2, xzr                     // 0.0
        fcmp    d1, d2
        b.lt    negative
        fmov    d0, d1                      // fmov leaves the flags alone
        b.eq    print                       // the root of 0 is 0

        // start at or above the root: n itself, or 1 when n is below 1
        fmov    d2, 1.0
        fcmp    d1, d2
        b.ge    have_guess
        fmov    d0, d2
have_guess:
        fmov    d4, 0.5
newton:
        fdiv    d3, d1, d0                  // n / guess
        fadd    d3, d3, d0
        fmul    d3, d3, d4                  // next = (guess + n / guess) / 2
        fcmp    d3, d0
        b.ge    print                       // stopped shrinking: guess is the root
        fmov    d0, d3
        b       newton

print:
        ldr     x0, =fmt_root               // the root is already in d0
        bl      printf
        mov     w0, 0
        b       root_end

negative:
        ldr     x0, =fmt_neg
        bl      printf
        mov     w0, 1

root_end:
        ldp     fp, lr, [sp], dealloc
        ret
