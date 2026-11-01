// add_one pops its own frame and reaches keep with b. keep stores its local
// at fp + 0, over its own saved fp, so main's call to add_one comes back with
// fp changed. main prints 7 and exits 0.

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

// add_one(x0 = n) adds 1, then finishes in keep
        .balign 4
        .global add_one
add_one:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        add     x0, x0, 1

        ldp     fp, lr, [sp], 16
        b       keep                        // tail call: keep returns to main

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 5
        bl      add_one

        ldr     x0, =fmt_out
        mov     x1, 7
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
