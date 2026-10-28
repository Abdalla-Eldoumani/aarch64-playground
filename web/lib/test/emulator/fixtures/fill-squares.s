// Fills an array of four ints in main's frame with the squares 0, 1, 4, 9
// through a pointer, then prints them. Two calls deep: main, fill, square.
define(fp, x29)
define(lr, x30)
define(i_r, w19)

define(COUNT, 4)

// main's frame
arr_s = 16                              // int arr[4]: bytes 16 to 31
main_alloc = -(16 + 16) & -16           // 16 bytes of locals: -32
main_dealloc = -main_alloc

// fill's frame
dest_s = 16                             // int *dest: bytes 16 to 23
i_s = 24                                // int i: bytes 24 to 27
sq_s = 28                               // int sq: bytes 28 to 31
fill_alloc = -(16 + 16) & -16           // 16 bytes of locals: -32
fill_dealloc = -fill_alloc

.data
fmt_out:    .string "%d\n"

.text
// square(x0 = where, w1 = n): stores n * n at where
// Leaf function: no frame of its own
        .balign 4
        .global square
square:
        mul     w9, w1, w1
        str     w9, [x0]                // *where = n * n
        ret

// fill(x0 = arr base): arr[i] = i * i for i < COUNT
        .balign 4
        .global fill
fill:
        stp     fp, lr, [sp, fill_alloc]!
        mov     fp, sp

        str     x0, [fp, dest_s]        // dest = &arr[0]
        str     wzr, [fp, i_s]          // i = 0
        b       fill_test
fill_loop:
        add     x0, fp, sq_s            // square writes into this frame's sq
        ldr     w1, [fp, i_s]
        bl      square
        ldr     x9, [fp, dest_s]
        ldr     w10, [fp, sq_s]
        str     w10, [x9], 4            // *dest++ = sq
        str     x9, [fp, dest_s]
        ldr     w11, [fp, i_s]
        add     w11, w11, 1
        str     w11, [fp, i_s]          // i++
fill_test:
        ldr     w11, [fp, i_s]
        cmp     w11, COUNT
        b.lt    fill_loop

        ldp     fp, lr, [sp], fill_dealloc
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, main_alloc]!
        mov     fp, sp

        add     x0, fp, arr_s           // x0 = &arr[0]
        bl      fill

        mov     i_r, 0
        b       main_test
main_loop:
        ldr     x0, =fmt_out
        add     x9, fp, arr_s
        ldr     w1, [x9, i_r, sxtw 2]   // w1 = arr[i]
        bl      printf
        add     i_r, i_r, 1
main_test:
        cmp     i_r, COUNT
        b.lt    main_loop

        mov     w0, 0
        ldp     fp, lr, [sp], main_dealloc
        ret
