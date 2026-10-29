// Prints one line for each kind of printf conversion: whole numbers, hex,
// a character and a string, doubles, and a pointer.

define(fp, x29)
define(lr, x30)

.data
fmt_int:    .string "%d %i %u %ld %lld\n"
fmt_hex:    .string "%x %lx\n"
fmt_text:   .string "%c%s%%\n"
fmt_real:   .string "%f %lf\n"
fmt_ptr:    .string "%p\n"
word_m:     .string "hi"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // printf("%d %i %u %ld %lld\n", -5, 42, -1, -7, 1 << 40)
        ldr     x0, =fmt_int
        mov     w1, -5
        mov     w2, 42
        mov     w3, -1                      // all 32 bits set
        mov     x4, -7
        mov     x5, 1
        lsl     x5, x5, 40
        bl      printf

        // printf("%x %lx\n", 255, -1)
        ldr     x0, =fmt_hex
        mov     w1, 255
        mov     x2, -1
        bl      printf

        // printf("%c%s%%\n", 'A', word_m)
        ldr     x0, =fmt_text
        mov     w1, 65                      // 'A'
        ldr     x2, =word_m
        bl      printf

        // printf("%f %lf\n", 2.5, -0.125)
        ldr     x0, =fmt_real
        fmov    d0, 2.5
        fmov    d1, -0.125
        bl      printf

        // printf("%p\n", 0x1234)
        ldr     x0, =fmt_ptr
        mov     x1, 0x1234
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
