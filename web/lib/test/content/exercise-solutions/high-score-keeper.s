// keep the best score in a file: every new score is checked against it
define(fp, x29)
define(lr, x30)

define(n_r, x19)
define(i_r, x20)
define(score_r, x21)
define(fd_r, x22)

define(AT_FDCWD, -100)
define(SYS_OPENAT, 56)
define(SYS_CLOSE, 57)
define(SYS_READ, 63)
define(SYS_WRITE, 64)

.data
path:       .string "best.dat"
fmt_count:  .string "%ld"
fmt_score:  .string "%ld"
fmt_first:  .string "first score: %ld\n"
fmt_new:    .string "new best: %ld (was %ld)\n"
fmt_keep:   .string "%ld does not beat %ld\n"
fmt_high:   .string "high score: %ld\n"
fmt_empty:  .string "no scores yet\n"

.bss
.align 3
count:      .skip 8
score_in:   .skip 8
saved:      .skip 8                         // the 8 bytes the file holds

.text

// load_best() -> x0 = 1 with the score in saved, or 0 when there is no file
        .balign 4
        .global load_best
load_best:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     fd_r, [fp, 16]              // this routine uses x22: save it

        mov     x0, AT_FDCWD
        ldr     x1, =path
        mov     x2, 0                       // O_RDONLY
        mov     x3, 0
        mov     x8, SYS_OPENAT
        svc     0
        mov     w9, 0
        cmp     x0, 0
        b.lt    lb_done                     // no file yet
        mov     fd_r, x0

        mov     x0, fd_r
        ldr     x1, =saved
        mov     x2, 8
        mov     x8, SYS_READ
        svc     0

        mov     x0, fd_r
        mov     x8, SYS_CLOSE
        svc     0
        mov     w9, 1
lb_done:
        mov     w0, w9
        ldr     fd_r, [fp, 16]
        ldp     fp, lr, [sp], 32
        ret

// save_best(x0 = score): replace the file's contents with this score
        .balign 4
        .global save_best
save_best:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     fd_r, [fp, 16]

        ldr     x9, =saved
        str     x0, [x9]

        mov     x0, AT_FDCWD
        ldr     x1, =path
        mov     x2, 01101                   // O_WRONLY | O_CREAT | O_TRUNC, in octal
        mov     x3, 0644                    // owner may write, everyone may read
        mov     x8, SYS_OPENAT
        svc     0
        cmp     x0, 0
        b.lt    sb_done
        mov     fd_r, x0

        mov     x0, fd_r
        ldr     x1, =saved
        mov     x2, 8
        mov     x8, SYS_WRITE
        svc     0

        mov     x0, fd_r
        mov     x8, SYS_CLOSE
        svc     0
sb_done:
        ldr     fd_r, [fp, 16]
        ldp     fp, lr, [sp], 32
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_count
        ldr     x1, =count
        bl      scanf
        ldr     x9, =count
        ldr     n_r, [x9]

        mov     i_r, 0
        b       score_test
score_loop:
        ldr     x0, =fmt_score
        ldr     x1, =score_in
        bl      scanf
        ldr     x9, =score_in
        ldr     score_r, [x9]

        bl      load_best
        cmp     w0, 0
        b.eq    first_score

        ldr     x9, =saved
        ldr     x2, [x9]                    // the best so far
        cmp     score_r, x2
        b.gt    new_best
        ldr     x0, =fmt_keep
        mov     x1, score_r
        bl      printf
        b       score_next

new_best:
        ldr     x0, =fmt_new
        mov     x1, score_r
        bl      printf
        mov     x0, score_r
        bl      save_best
        b       score_next

first_score:
        ldr     x0, =fmt_first
        mov     x1, score_r
        bl      printf
        mov     x0, score_r
        bl      save_best

score_next:
        add     i_r, i_r, 1
score_test:
        cmp     i_r, n_r
        b.lt    score_loop

        bl      load_best
        cmp     w0, 0
        b.eq    no_scores
        ldr     x0, =fmt_high
        ldr     x9, =saved
        ldr     x1, [x9]
        bl      printf
        b       all_done
no_scores:
        ldr     x0, =fmt_empty
        bl      printf

all_done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
