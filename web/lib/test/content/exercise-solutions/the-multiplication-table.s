// print an n-by-n multiplication table
define(fp, x29)
define(lr, x30)

define(row_r, x19)
define(col_r, x20)
define(cell_r, x21)
define(n_r, x22)

        .data
fmt_in:     .string "%lld"
fmt_cell:   .string "%4lld"
fmt_eol:     .string "\n"

        .bss
        .balign 8
n_m:        .skip 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read the table's size
        ldr     x1, =n_m
        bl      scanf
        ldr     x9, =n_m
        ldr     n_r, [x9]

        mov     row_r, 1
        b       row_test
row_loop:
        mov     col_r, 1
        b       col_test
col_loop:
        mul     cell_r, row_r, col_r
        ldr     x0, =fmt_cell
        mov     x1, cell_r
        bl      printf
        add     col_r, col_r, 1
col_test:
        cmp     col_r, n_r
        b.le    col_loop
        ldr     x0, =fmt_eol                 // end of the row
        bl      printf
        add     row_r, row_r, 1
row_test:
        cmp     row_r, n_r
        b.le    row_loop

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
