// add up every number handed to the program on its command line
define(fp, x29)
define(lr, x30)

define(argc_r, x19)
define(argv_r, x20)
define(i_r, x21)
define(total_r, x22)

        .data
fmt_step:   .string "%lld\n"
fmt_total:  .string "total = %lld\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     argc_r, x0
        mov     argv_r, x1
        mov     total_r, 0
        mov     i_r, 1                      // argv[0] is the program name

        b       arg_test
arg_loop:
        ldr     x0, [argv_r, i_r, lsl 3]    // argv[i], a char pointer
        bl      atoi
        sxtw    x0, w0                      // atoi answers an int
        add     total_r, total_r, x0
        ldr     x0, =fmt_step
        mov     x1, total_r
        bl      printf
        add     i_r, i_r, 1
arg_test:
        cmp     i_r, argc_r
        b.lt    arg_loop

        ldr     x0, =fmt_total
        mov     x1, total_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
