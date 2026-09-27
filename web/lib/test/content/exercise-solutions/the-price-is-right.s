// work out a bill from a price and a quantity kept in .data
define(fp, x29)
define(lr, x30)

.data
        .balign 4
price:      .word 0                         // cents for one item, read from input
quantity:   .word 0                         // how many, read from input
total:      .word 0                         // price times quantity belongs here
fmt_in:     .string "%d %d"
fmt_out:    .string "%d x %d cents = %d cents\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // scanf writes straight into both words
        ldr     x1, =price
        ldr     x2, =quantity
        bl      scanf

        ldr     x9, =price                  // first the address,
        ldr     w10, [x9]                   // then the value stored there
        ldr     x9, =quantity
        ldr     w11, [x9]
        mul     w12, w10, w11               // the bill in cents
        ldr     x9, =total
        str     w12, [x9]                   // write it into the third word

        ldr     x0, =fmt_out                // print all three words from memory
        ldr     x9, =quantity
        ldr     w1, [x9]
        ldr     x9, =price
        ldr     w2, [x9]
        ldr     x9, =total
        ldr     w3, [x9]
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
