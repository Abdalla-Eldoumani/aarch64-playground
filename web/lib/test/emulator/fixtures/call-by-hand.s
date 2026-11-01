// main calls set_three by hand, outside course style: adr puts the return
// address in lr and b goes to set_three, whose ret comes back to main's back
// label. main prints 3 and exits 0.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "%ld\n"

.text

// set_three() -> x0 = 3
        .balign 4
        .global set_three
set_three:
        mov     x0, 3
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        adr     lr, back                    // the return address, set by hand
        b       set_three
back:
        mov     x1, x0
        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
