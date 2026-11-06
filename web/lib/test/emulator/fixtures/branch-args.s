// Three functions that test their argument with a branch before anything
// else: a null check on a pointer, a zero check and an odd check on ints.
define(fp, x29)
define(lr, x30)

.data
msg:        .string "hi"

.text
// first_byte(x0 = string) -> w0 = its first byte, 0 for a null pointer
// Leaf function: no frame of its own
        .balign 4
        .global first_byte
first_byte:
        cbz     x0, first_byte_null
        ldrb    w0, [x0]
        ret
first_byte_null:
        mov     w0, 0
        ret

// not_zero(w0 = n) -> w0 = 1 when n is not 0, else 0
// Leaf function: no frame of its own
        .balign 4
        .global not_zero
not_zero:
        cbz     w0, not_zero_done
        mov     w0, 1
not_zero_done:
        ret

// is_odd(w0 = n) -> w0 = 1 when n is odd, else 0
// Leaf function: no frame of its own
        .balign 4
        .global is_odd
is_odd:
        tbnz    w0, 0, is_odd_yes
        mov     w0, 0
        ret
is_odd_yes:
        mov     w0, 1
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =msg
        bl      first_byte
        mov     w0, -3
        bl      not_zero
        mov     w0, 7
        bl      is_odd

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
