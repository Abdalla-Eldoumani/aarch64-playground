// Prints 0 + 1 + ... + 20000 from a recursive sumto: 20,001 calls deep.
define(fp, x29)
define(lr, x30)

define(N, 20000)

// sumto's frame
n_s = 16                                // int n: bytes 16 to 19
alloc = -(16 + 4) & -16                 // 4 bytes of locals, rounded up: -32
dealloc = -alloc

.data
fmt_sum:    .string "sum = %d\n"

.text
// sumto(w0 = n) -> w0 = n + (n - 1) + ... + 0
        .balign 4
        .global sumto
sumto:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        str     w0, [fp, n_s]           // this call's n
        cmp     w0, 0
        b.le    sumto_base
        sub     w0, w0, 1
        bl      sumto                   // w0 = sumto(n - 1)
        ldr     w9, [fp, n_s]
        add     w0, w0, w9
        b       sumto_done
sumto_base:
        mov     w0, 0                   // sumto(0) = 0
sumto_done:
        ldp     fp, lr, [sp], dealloc
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w0, N
        bl      sumto                   // w0 = 200010000
        mov     w1, w0
        ldr     x0, =fmt_sum
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
