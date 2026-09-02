// Example 4: Command-Line Arguments
// Print all arguments passed on the command line.
// Usage: hello world in the args box (argv[0] arrives as ./program)
// Output: ./program
//         hello
//         world

define(fp, x29)
define(lr, x30)
define(i_r, w19)
define(argc_r, w20)
define(argv_r, x21)

        .text
fmt:    .string "%s\n"

        .balign 4
        .global main
main:   stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // Save argc and argv immediately (w0 and x1 are caller-saved)
        mov     argc_r, w0
        mov     argv_r, x1

        mov     i_r, 0                 // i = 0
        b       test

top:
        ldr     x0, =fmt
        ldr     x1, [argv_r, i_r, SXTW 3]  // argv[i] (8-byte pointer)
        bl      printf

        add     i_r, i_r, 1
test:   cmp     i_r, argc_r
        b.lt    top

        ldp     fp, lr, [sp], 16
        ret
