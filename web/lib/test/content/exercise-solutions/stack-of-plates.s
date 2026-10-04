// store four plates in the frame, then take them back top-first
define(fp, x29)
define(lr, x30)

define(plate_r, x19)

p1_s = 16                                   // bottom plate's offset
p2_s = 24
p3_s = 32
p4_s = 40                                   // top plate's offset
alloc = -(16 + 32) & -16
dealloc = -alloc

        .data
fmt_in:     .string "%lld"
fmt_out:    .string "%lld\n"

        .bss
        .balign 8
plate_m:    .skip 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // plate 1, the bottom one
        ldr     x1, =plate_m
        bl      scanf
        ldr     x9, =plate_m
        ldr     plate_r, [x9]
        str     plate_r, [fp, p1_s]

        ldr     x0, =fmt_in                 // plate 2
        ldr     x1, =plate_m
        bl      scanf
        ldr     x9, =plate_m
        ldr     plate_r, [x9]
        str     plate_r, [fp, p2_s]

        ldr     x0, =fmt_in                 // plate 3
        ldr     x1, =plate_m
        bl      scanf
        ldr     x9, =plate_m
        ldr     plate_r, [x9]
        str     plate_r, [fp, p3_s]

        ldr     x0, =fmt_in                 // plate 4, the top one
        ldr     x1, =plate_m
        bl      scanf
        ldr     x9, =plate_m
        ldr     plate_r, [x9]
        str     plate_r, [fp, p4_s]

        ldr     plate_r, [fp, p4_s]         // top plate first
        ldr     x0, =fmt_out
        mov     x1, plate_r
        bl      printf
        ldr     plate_r, [fp, p3_s]
        ldr     x0, =fmt_out
        mov     x1, plate_r
        bl      printf
        ldr     plate_r, [fp, p2_s]
        ldr     x0, =fmt_out
        mov     x1, plate_r
        bl      printf
        ldr     plate_r, [fp, p1_s]         // bottom plate last
        ldr     x0, =fmt_out
        mov     x1, plate_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
