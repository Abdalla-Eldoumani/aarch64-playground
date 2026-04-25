// A2 -- integer multiply via shift-and-add (no MUL instruction)
//
// scaffold -- fill in the YOUR CODE blocks. As shipped this file
// compiles, halts cleanly, and prints nothing.
//
// Goal: compute product = multiplier * multiplicand using only
// shifts and adds. Standard "test the bit, conditionally add the
// shifted multiplicand, shift left" loop over the 32 bits of the
// multiplier.

define(fp, x29)
define(lr, x30)
define(mplier_r, w19)
define(mcand_r,  w20)
define(product_r, w21)
define(bit_r,    w22)
define(i_r,      w23)

mplier_v  = 13
mcand_v   = 17

        .data
fmt_out:    .string "%d * %d = %d\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // YOUR CODE -- load mplier_r = mplier_v, mcand_r = mcand_v,
        //   product_r = 0, i_r = 0.

        // YOUR CODE -- loop 32 times:
        //   bit_r = mplier_r & 1
        //   if (bit_r) product_r += mcand_r
        //   mcand_r <<= 1
        //   mplier_r >>= 1
        //   i_r++

        // YOUR CODE -- ldr x0, =fmt_out; mov w1, mplier_v; mov w2, mcand_v;
        //   mov w3, product_r; bl printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
