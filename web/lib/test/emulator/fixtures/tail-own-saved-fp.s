// pass_on reaches keep with b. keep stores its local at fp + 0, over its own
// saved fp, so its ldp loads the local into fp and main's call to pass_on
// comes back with fp changed. main prints 7 and exits 0.

define(fp, x29)
define(lr, x30)

local_s = 0
alloc = -(16 + 8) & -16
dealloc = -alloc

.data
fmt_out:    .string "%ld\n"

.text

// keep(x0 = n): keeps n in a local (bug: local_s should be 16)
        .balign 4
        .global keep
keep:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        str     x0, [fp, local_s]           // the local, over the saved fp

        ldp     fp, lr, [sp], dealloc
        ret

// pass_on(x0 = n) finishes in keep
        .balign 4
        .global pass_on
pass_on:
        b       keep                        // tail call: keep returns to main

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 5
        bl      pass_on

        ldr     x0, =fmt_out
        mov     x1, 7
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
