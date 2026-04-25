// A3 -- sort a 1D integer array in place
//
// scaffold -- fill in the YOUR CODE blocks. As shipped this file
// compiles, halts cleanly, and prints nothing.
//
// Goal: sort `arr` ascending (any algorithm works -- bubble, insertion,
// selection) and print each element on its own line. The scaffold sets
// up the array, the prologue, and the printf format string for you.

define(fp, x29)
define(lr, x30)
define(base_r, x19)
define(i_r,    w20)
define(j_r,    w21)
define(tmp_r,  w22)

n_v = 8

        .data
arr:        .word 5, 2, 8, 1, 9, 3, 7, 4
fmt_el:     .string "arr[%d] = %d\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // YOUR CODE -- ldr base_r, =arr to point at the array.

        // YOUR CODE -- two nested loops: outer i_r from 0 to n_v-1,
        //   inner j_r over the unsorted suffix; compare arr[j], arr[j+1]
        //   and swap via tmp_r when out of order.

        // YOUR CODE -- print each element via printf:
        //   for k in 0..n_v: ldr x0, =fmt_el; mov w1, k; ldr w2, [base_r, k, SXTW 2];
        //     bl printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
