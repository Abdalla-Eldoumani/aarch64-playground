// count-evens.s - non-leaf routine that counts even values in an array
// main fills a stack array and calls count_even, which loops over the
// elements calling the leaf is_even on each. count_even keeps its
// cross-call values in callee-saved registers it saves in its prologue,
// so the nested bl never clobbers the running count.

define(fp, x29)
define(lr, x30)

arr_s = 16
alloc = -(16 + 32) & -16
dealloc = -alloc

.data
fmt_out:    .string "Even count: %d\n"

.text
.balign 4
.global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        add     x19, fp, arr_s          // array base
        mov     w9, 2
        str     w9, [x19]
        mov     w9, 7
        str     w9, [x19, 4]
        mov     w9, 4
        str     w9, [x19, 8]
        mov     w9, 9
        str     w9, [x19, 12]
        mov     w9, 6
        str     w9, [x19, 16]

        mov     x0, x19                 // arr
        mov     w1, 5                   // n
        bl      count_even
        mov     w20, w0

        ldr     x0, =fmt_out
        mov     w1, w20
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret

// count_even(x0 = arr base, w1 = n) -> w0 = number of even elements.
// Non-leaf: saves fp/lr and the callee-saved registers it relies on
// across the bl is_even.
count_even:
        stp     fp, lr, [sp, -48]!
        mov     fp, sp
        stp     x19, x20, [fp, 16]
        stp     x21, x22, [fp, 32]

        mov     x19, x0                 // arr base
        mov     w20, w1                 // n
        mov     w21, 0                  // count
        mov     w22, 0                  // index
ce_loop:
        cmp     w22, w20
        b.ge    ce_done
        ldr     w0, [x19, w22, sxtw 2]
        bl      is_even
        add     w21, w21, w0            // += 1 when even
        add     w22, w22, 1
        b       ce_loop
ce_done:
        mov     w0, w21
        ldp     x21, x22, [fp, 32]
        ldp     x19, x20, [fp, 16]
        ldp     fp, lr, [sp], 48
        ret

// is_even(w0) -> w0 : 1 when w0 is even, else 0. Leaf, scratch only.
is_even:
        and     w0, w0, 1
        eor     w0, w0, 1
        ret
