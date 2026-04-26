// A1 -- minimum of a cubic over an integer range
//
// scaffold -- fill in the YOUR CODE blocks. As shipped this file
// compiles, halts cleanly, and prints nothing so you can check that
// the build pipeline runs before you start adding logic.
//
// Goal: find the integer x in [a, b] that minimizes
//   f(x) = x*x*x + p*x*x + q*x + r
// for the constants below, and print x and f(x).

define(fp, x29)
define(lr, x30)

// Loop variables -- pick callee-saved registers so printf does not
// clobber them between iterations.
define(x_r,    w19)
define(min_x,  w20)
define(min_f,  w21)
define(p_r,    w22)
define(q_r,    w23)
define(r_r,    w24)

a   = -10
b   =  10
p_v =  -1
q_v =  -4
r_v =   3

alloc   = -16
dealloc = -alloc

        .data
fmt_out:    .string "min at x=%d, f(x)=%d\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        // YOUR CODE -- initialize p_r/q_r/r_r from p_v/q_v/r_v,
        // x_r = a, and seed min_f with a sentinel like 0x7fffffff.

        // YOUR CODE -- loop x_r from a to b inclusive:
        //   compute f = x*x*x + p*x*x + q*x + r
        //   if (f < min_f) { min_f = f; min_x = x_r; }

        // YOUR CODE -- ldr x0, =fmt_out; mov w1, min_x; mov w2, min_f;
        //   bl printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
