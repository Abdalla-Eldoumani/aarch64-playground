// show prints a number through print_n, but calls out before saving lr,
// so its ret comes back to itself and the program never ends.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "n = %d\n"

.text

// print_n(w0 = n): prints n
        .balign 4
        .global print_n
print_n:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w1, w0                      // the number to print
        ldr     x0, =fmt_out
        bl      printf
        ldp     fp, lr, [sp], 16
        ret

// show(w0 = n): prints n (bug: no prologue, so lr is never saved)
        .balign 4
        .global show
show:
        bl      print_n
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 7
        bl      show
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
