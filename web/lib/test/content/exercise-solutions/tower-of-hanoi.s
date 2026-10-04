// print every move that shifts a tower of n discs from peg A to peg C
define(fp, x29)
define(lr, x30)

define(discs_r, w19)
define(from_r, w20)
define(to_r, w21)
define(spare_r, w22)
define(moves_r, w23)

// hanoi's frame: fp and lr, then the five registers it borrows from its caller
hanoi_alloc = -(16 + 40) & -16
hanoi_dealloc = -hanoi_alloc
save19_s = 16
save21_s = 32
save23_s = 48

.data
fmt_discs:  .string "%d"
fmt_move:   .string "disc %d: %c -> %c\n"
fmt_total:  .string "moves: %d\n"

.bss
.align 4
n_in:       .skip 4                         // scanf's landing spot

.text

// hanoi(w0 = n, w1 = from peg, w2 = to peg, w3 = spare peg) -> w0 = moves made
        .balign 4
        .global hanoi
hanoi:
        stp     fp, lr, [sp, hanoi_alloc]!
        mov     fp, sp
        stp     x19, x20, [fp, save19_s]    // the caller is using these too
        stp     x21, x22, [fp, save21_s]
        str     x23, [fp, save23_s]

        mov     discs_r, w0                 // the arguments must outlive the calls below
        mov     from_r, w1
        mov     to_r, w2
        mov     spare_r, w3
        mov     moves_r, 0

        cmp     discs_r, 0
        b.le    hanoi_done                  // an empty tower needs no moves

        sub     w0, discs_r, 1              // park the n - 1 smaller discs on the spare peg
        mov     w1, from_r
        mov     w2, spare_r
        mov     w3, to_r
        bl      hanoi
        mov     moves_r, w0

        ldr     x0, =fmt_move               // the largest disc now has a clear path
        mov     w1, discs_r
        mov     w2, from_r
        mov     w3, to_r
        bl      printf
        add     moves_r, moves_r, 1

        sub     w0, discs_r, 1              // stack the smaller discs back on top of it
        mov     w1, spare_r
        mov     w2, to_r
        mov     w3, from_r
        bl      hanoi
        add     moves_r, moves_r, w0

hanoi_done:
        mov     w0, moves_r
        ldp     x19, x20, [fp, save19_s]
        ldp     x21, x22, [fp, save21_s]
        ldr     x23, [fp, save23_s]
        ldp     fp, lr, [sp], hanoi_dealloc
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_discs
        ldr     x1, =n_in
        bl      scanf                       // no input leaves n_in at 0

        ldr     x9, =n_in
        ldr     w0, [x9]
        mov     w1, 'A'
        mov     w2, 'C'
        mov     w3, 'B'
        bl      hanoi

        mov     w1, w0                      // the count goes straight to printf
        ldr     x0, =fmt_total
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
