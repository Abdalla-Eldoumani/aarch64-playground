// helper writes 8 ints into a 4-int local array: the last four land on
// main's saved fp and lr.
define(fp, x29)
define(lr, x30)
arr_s = 16
alloc = -(16 + 16) & -16
dealloc = -alloc
.data
fmt:    .string "done\n"
.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        bl      helper
        ldr     x0, =fmt
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
// helper(): arr[i] = i for i = 0 to 7 (bug: arr holds 4)
        .balign 4
        .global helper
helper:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        add     x9, fp, arr_s           // x9 = &arr[0]
        mov     w10, 0                  // i = 0
loop:   cmp     w10, 8                  // bug: should be 4
        b.ge    out
        str     w10, [x9, w10, sxtw 2]  // arr[i] = i
        add     w10, w10, 1
        b       loop
out:    ldp     fp, lr, [sp], dealloc
        ret
