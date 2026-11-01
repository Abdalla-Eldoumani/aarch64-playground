// hand_off moves lr on by one instruction and reaches finish with b, so
// finish's ret skips the nop after main's bl and goes to no caller. The ret
// is in finish's code. main still prints 7 and exits 0.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "%ld\n"

.text

// finish() returns to whatever lr holds
        .balign 4
        .global finish
finish:
        ret

// hand_off() ends in finish (bug: lr moved past the instruction after its call)
        .balign 4
        .global hand_off
hand_off:
        add     lr, lr, 4                   // past the nop after the bl
        b       finish

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      hand_off
        nop                                 // skipped by finish's ret

        ldr     x0, =fmt_out
        mov     x1, 7
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
