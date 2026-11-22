// count_down builds its frame in two steps (sp down first, then the frame
// record above the caller's saved x19) and keeps n in x19. The base case's
// ret skips the nop after the bl and goes to no caller; main prints 7 and
// exits 0.

define(fp, x29)
define(lr, x30)

define(n_r, x19)

.data
fmt_out:    .string "%ld\n"

.text

// count_down(x0 = n) calls itself down to 0 (bug: the base case moves lr)
        .balign 4
        .global count_down
count_down:
        sub     sp, sp, 32
        stp     fp, lr, [sp, 16]            // the frame record, above x19's slot
        add     fp, sp, 16
        str     n_r, [sp]                   // the caller's x19

        mov     n_r, x0
        cbz     n_r, cd_base
        sub     x0, n_r, 1
        bl      count_down
        nop                                 // skipped by the base case's ret
        b       cd_done
cd_base:
        ldr     n_r, [sp]
        ldp     fp, lr, [sp, 16]
        add     sp, sp, 32
        add     lr, lr, 4                   // past the nop after the bl
        ret
cd_done:
        ldr     n_r, [sp]
        ldp     fp, lr, [sp, 16]
        add     sp, sp, 32
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 3
        bl      count_down

        ldr     x0, =fmt_out
        mov     x1, 7
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
