// shout every command-line argument: upper case, one per line, with a !
define(fp, x29)
define(lr, x30)

define(nargs_r, w19)
define(args_r, x20)
define(i_r, w21)
define(ptr_r, x22)

.data
fmt_shout:  .string "%s!\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     nargs_r, w0
        mov     args_r, x1
        mov     i_r, 1                      // argv[0] is the program itself
        b       arg_test

arg_loop:
        ldr     ptr_r, [args_r, i_r, SXTW 3]
        mov     x9, ptr_r                   // walk a copy, keep the start for printf
        b       up_test
up_loop:
        cmp     w10, 'a'
        b.lt    up_next
        cmp     w10, 'z'
        b.gt    up_next
        sub     w10, w10, 32                // 'a' - 32 = 'A'
        strb    w10, [x9]
up_next:
        add     x9, x9, 1
up_test:
        ldrb    w10, [x9]
        cmp     w10, 0
        b.ne    up_loop

        ldr     x0, =fmt_shout
        mov     x1, ptr_r
        bl      printf
        add     i_r, i_r, 1
arg_test:
        cmp     i_r, nargs_r
        b.lt    arg_loop

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
