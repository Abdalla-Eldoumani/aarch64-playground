// count_down keeps n in x19, saved at fp + 16. Its base case frees its frame
// and then its caller's, so its ret skips its caller. After each recursive
// call count_down moves sp down 32 bytes and has fill store into that space.
// main prints 99 and exits 0.

define(fp, x29)
define(lr, x30)

define(n_r, x19)

n_s = 16
alloc = -(16 + 8) & -16
dealloc = -alloc

.data
fmt_out:    .string "%ld\n"

.text

// fill(x0 = address) stores 5 there
        .balign 4
        .global fill
fill:
        mov     x9, 5
        str     x9, [x0]
        ret

// count_down(x0 = n) calls itself down to 0 (bug: the base case frees two frames)
        .balign 4
        .global count_down
count_down:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        str     n_r, [fp, n_s]              // the caller's x19

        mov     n_r, x0
        cbz     n_r, cd_base
        sub     x0, n_r, 1
        bl      count_down

        sub     sp, sp, 32                  // room for fill to store into
        mov     x0, sp
        bl      fill
        add     sp, sp, 32

        ldr     n_r, [fp, n_s]
        ldp     fp, lr, [sp], dealloc
        ret
cd_base:
        ldr     n_r, [fp, n_s]
        add     sp, sp, dealloc             // frees this frame
        ldp     fp, lr, [sp], dealloc       // and the caller's
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     n_r, 99
        mov     x0, 2
        bl      count_down

        ldr     x0, =fmt_out
        mov     x1, n_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
