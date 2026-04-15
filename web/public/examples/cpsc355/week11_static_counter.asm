// Example 2: Static Local Counter
// A function with a static variable that persists across calls.
// C equivalent:
//   int increment() { static int count = 0; count++; return count; }
//   main: calls increment 3 times, prints each result

define(fp, x29)
define(lr, x30)
define(i_r, w19)

        .data
count_m:.word   0                       // static local: lives in .data

        .text
fmt:    .string "Call %d: count = %d\n"

// increment() -> w0
// Loads count from .data, increments, stores back, returns new value
        .balign 4
        .global increment
increment:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =count_m           // address of count
        ldr     w10, [x9]              // w10 = count
        add     w10, w10, 1            // count++
        str     w10, [x9]              // store back
        mov     w0, w10                // return count

        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:   stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     i_r, 1                 // call number
        b       test

loop:
        bl      increment              // w0 = new count
        mov     w20, w0                // save return value

        ldr     x0, =fmt
        mov     w1, i_r                // call number
        mov     w2, w20                // count value
        bl      printf

        add     i_r, i_r, 1
test:   cmp     i_r, 3
        b.le    loop

        ldp     fp, lr, [sp], 16
        ret
