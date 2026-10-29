// Prints 4! from a recursive fact, then the cubes of 1 to 7 from a loop
// that calls cube once a pass.
define(fp, x29)
define(lr, x30)
define(i_r, w19)
define(cube_r, w20)

define(LAST, 7)

// fact's frame
n_s = 16                                // int n: bytes 16 to 19
fact_alloc = -(16 + 4) & -16            // 4 bytes of locals, rounded up: -32
fact_dealloc = -fact_alloc

.data
fmt_fact:   .string "4! = %d\n"
fmt_cube:   .string "%d cubed = %d\n"

.text
// fact(w0 = n) -> w0 = n!
        .balign 4
        .global fact
fact:
        stp     fp, lr, [sp, fact_alloc]!
        mov     fp, sp

        str     w0, [fp, n_s]           // this call's n
        cmp     w0, 1
        b.gt    fact_recurse
        mov     w0, 1                   // fact(1) = 1
        b       fact_done
fact_recurse:
        sub     w0, w0, 1
        bl      fact                    // w0 = fact(n - 1)
        ldr     w9, [fp, n_s]           // n is still in this call's frame
        mul     w0, w0, w9
fact_done:
        ldp     fp, lr, [sp], fact_dealloc
        ret

// cube(w0 = n) -> w0 = n * n * n
// Leaf function: no frame of its own
        .balign 4
        .global cube
cube:
        mul     w9, w0, w0
        mul     w0, w9, w0
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w0, 4
        bl      fact                    // w0 = 4!
        mov     w1, w0
        ldr     x0, =fmt_fact
        bl      printf

        mov     i_r, 1
        b       cube_test
cube_loop:
        mov     w0, i_r
        bl      cube                    // w0 = i * i * i
        mov     cube_r, w0
        ldr     x0, =fmt_cube
        mov     w1, i_r
        mov     w2, cube_r
        bl      printf
        add     i_r, i_r, 1
cube_test:
        cmp     i_r, LAST
        b.le    cube_loop

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
