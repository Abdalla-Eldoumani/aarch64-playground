// A table of two message addresses, but the second entry names byee
// instead of bye, and no line defines byee.

        .data
hi:     .string "hi\n"
bye:    .string "bye\n"

        .balign 8
msgs:   .quad   hi, byee

        .text
        .balign 4
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp

        ldr     x9, =msgs
        ldr     x0, [x9, 8]
        bl      printf

        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
