// Returns the bits 0x80000000 twice, as a long and as an int, then the
// address of a string, and prints all three.
define(fp, x29)
define(lr, x30)
define(long_r, x19)
define(int_r, w20)
define(str_r, x21)

.data
msg:        .string "hi"
fmt_out:    .string "%ld %d %s\n"

.text
// as_long() -> x0 = 2147483648
// Leaf function: no frame of its own
        .balign 4
        .global as_long
as_long:
        mov     w0, 1                   // an int first
        lsl     x0, x0, 31              // then the long: 2^31
        ret

// as_int() -> w0 = -2147483648
// Leaf function: no frame of its own
        .balign 4
        .global as_int
as_int:
        mov     x0, 1                   // a long first
        lsl     w0, w0, 31              // then the int: bit 31 is its sign
        ret

// greeting() -> x0 = the address of msg
// Leaf function: no frame of its own
        .balign 4
        .global greeting
greeting:
        ldr     x0, =msg
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      as_long
        mov     long_r, x0
        bl      as_int
        mov     int_r, w0
        bl      greeting
        mov     str_r, x0

        // printf("%ld %d %s\n", long, int, str)
        ldr     x0, =fmt_out
        mov     x1, long_r
        mov     w2, int_r
        mov     x3, str_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
