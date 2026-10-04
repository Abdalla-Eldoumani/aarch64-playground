// read up to 16 numbers, reverse them in place, and print them
define(fp, x29)
define(lr, x30)

define(base_r, x19)
define(n_r, w20)
define(i_r, w21)
define(left_r, x22)
define(right_r, x23)
define(a_r, w24)
define(b_r, w25)

define(MAX, 16)

.data
fmt_in:     .string "%d"
fmt_head:   .string "mirrored:"
fmt_el:     .string " %d"
fmt_end:    .string "\n"

.bss
.align 4
list:       .skip 64                        // MAX ints
count:      .skip 4

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // how many numbers follow
        ldr     x1, =count
        bl      scanf
        ldr     x9, =count
        ldr     n_r, [x9]

        cmp     n_r, 0                      // keep n between 0 and MAX
        b.ge    n_not_negative
        mov     n_r, 0
n_not_negative:
        cmp     n_r, MAX
        b.le    n_in_range
        mov     n_r, MAX
n_in_range:
        ldr     base_r, =list

        mov     i_r, 0                      // read the numbers into list
        b       fill_test
fill_loop:
        ldr     x0, =fmt_in
        add     x1, base_r, i_r, sxtw 2     // the address of list[i]
        bl      scanf
        add     i_r, i_r, 1
fill_test:
        cmp     i_r, n_r
        b.lt    fill_loop

        mov     left_r, base_r              // first element
        sub     w9, n_r, 1
        add     right_r, base_r, w9, sxtw 2 // last element (before list when n is 0)
        b       swap_test
swap_loop:
        ldr     a_r, [left_r]
        ldr     b_r, [right_r]
        str     b_r, [left_r], 4            // store, then step toward the middle
        str     a_r, [right_r], -4
swap_test:
        cmp     left_r, right_r
        b.lo    swap_loop                   // stop once the pointers meet or cross

        ldr     x0, =fmt_head               // print list as it now sits in memory
        bl      printf
        mov     i_r, 0
        b       show_test
show_loop:
        ldr     x0, =fmt_el
        ldr     w1, [base_r, i_r, sxtw 2]
        bl      printf
        add     i_r, i_r, 1
show_test:
        cmp     i_r, n_r
        b.lt    show_loop
        ldr     x0, =fmt_end
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
