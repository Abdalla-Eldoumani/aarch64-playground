// fill stores 6 ints into a 4-int array on its stack. The two extra land on
// the saved fp in main's frame; main's lr is untouched, so main still
// returns and the program prints "done" and exits 0.

define(fp, x29)
define(lr, x30)

arr_s = 16
alloc = -(16 + 16) & -16
dealloc = -alloc

.data
fmt_out:    .string "done\n"

.text

// fill(w0 = n): arr[i] = i for i = 0 to n - 1 (bug: arr holds 4)
        .balign 4
        .global fill
fill:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        add     x9, fp, arr_s               // x9 = &arr[0]
        mov     w10, 0
        b       fi_test
fi_loop:
        str     w10, [x9, w10, SXTW 2]      // arr[i] = i
        add     w10, w10, 1
fi_test:
        cmp     w10, w0
        b.lt    fi_loop

        ldp     fp, lr, [sp], dealloc
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w0, 6
        bl      fill

        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
