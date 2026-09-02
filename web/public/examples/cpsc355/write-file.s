// write-file.s
// Create "output.txt", write two lines to it, close it.
// Uses openat, write, close via svc. Reports result with printf.
//
// Compile: m4 write-file.s > write-file.gen.s && gcc write-file.gen.s -o write-file

define(fp, x29)
define(lr, x30)
define(fd_r, w19)
define(total_r, x20)

        .text
fname:      .string "output.txt"
line1:      .string "Line 1: Hello from assembly\n"
line1_len = . - line1 - 1       // -1 drops the .string NUL
line2:      .string "Line 2: File I/O works!\n"
line2_len = . - line2 - 1

fmt_ok:     .string "Wrote %ld bytes to output.txt\n"
fmt_err:    .string "Error: could not open output.txt\n"

        .balign 4
        .global main
main:   stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // openat(AT_FDCWD, "output.txt", O_WRONLY|O_CREAT|O_TRUNC, 0644)
        mov     w0, -100                // AT_FDCWD
        ldr     x1, =fname
        mov     w2, 01101               // O_WRONLY | O_CREAT | O_TRUNC
        mov     w3, 0644                // permissions
        mov     x8, 56                  // openat
        svc     0

        cmp     w0, 0
        b.lt    error
        mov     fd_r, w0
        mov     total_r, 0

        // write line 1
        mov     w0, fd_r
        ldr     x1, =line1
        mov     x2, line1_len
        mov     x8, 64
        svc     0
        add     total_r, total_r, x0

        // write line 2
        mov     w0, fd_r
        ldr     x1, =line2
        mov     x2, line2_len
        mov     x8, 64
        svc     0
        add     total_r, total_r, x0

        // close
        mov     w0, fd_r
        mov     x8, 57
        svc     0

        ldr     x0, =fmt_ok
        mov     x1, total_r
        bl      printf
        b       done

error:
        ldr     x0, =fmt_err
        bl      printf

done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
