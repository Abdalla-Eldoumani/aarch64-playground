// globals.s - multiply two values held in .data and store the product back
// Loads x and y from the .data section, multiplies them, writes the
// product into a third .data word, then reads that word back to show the
// store landed in memory, and prints it. The load-compute-store cycle over
// global storage, with no stack locals: the frame exists only so main can
// call printf.

define(fp, x29)
define(lr, x30)
define(x_r, w19)
define(y_r, w20)
define(prod_r, w21)

.data
x_m:        .word 5
y_m:        .word 3
result_m:   .word 0
fmt_out:    .string "Result: %d\n"

.text
.balign 4
.global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =x_m
        ldr     x_r, [x0]
        ldr     x0, =y_m
        ldr     y_r, [x0]

        mul     prod_r, x_r, y_r        // product = 15

        ldr     x0, =result_m
        str     prod_r, [x0]            // commit the product to .data
        ldr     w1, [x0]                // read it back from memory

        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
