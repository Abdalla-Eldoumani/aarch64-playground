// line-count.s - count the non-empty lines in a file
// Opens "notes.txt" with openat, reads it into a .bss buffer, walks the
// bytes counting each line that holds at least one character, then prints
// the total. Pure Linux syscalls for the file work, printf for the result.

define(fp, x29)
define(lr, x30)
define(fd_r, w19)
define(len_r, w20)
define(count_r, w21)
define(i_r, w22)
define(has_r, w23)
define(ptr_r, x24)

.data
fname:      .string "notes.txt"
fmt_out:    .string "Lines: %d\n"
fmt_err:    .string "Error: could not open notes.txt\n"

.bss
.balign 8
buf:        .skip 256

.text
.balign 4
.global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // openat(AT_FDCWD, "notes.txt", O_RDONLY, 0)
        mov     w0, -100
        ldr     x1, =fname
        mov     w2, 0
        mov     w3, 0
        mov     x8, 56
        svc     0
        cmp     w0, 0
        b.lt    open_err
        mov     fd_r, w0

        // read(fd, buf, 256)
        mov     w0, fd_r
        ldr     x1, =buf
        mov     x2, 256
        mov     x8, 63
        svc     0
        mov     len_r, w0

        // close(fd)
        mov     w0, fd_r
        mov     x8, 57
        svc     0

        // count lines that contain a non-newline character
        ldr     ptr_r, =buf
        mov     count_r, 0
        mov     i_r, 0
        mov     has_r, 0
scan:
        cmp     i_r, len_r
        b.ge    scan_done
        ldrb    w10, [ptr_r]
        cmp     w10, 10                 // '\n'
        b.eq    at_newline
        mov     has_r, 1                // saw content on this line
        b       advance
at_newline:
        cbz     has_r, reset_line       // blank line -> do not count
        add     count_r, count_r, 1
reset_line:
        mov     has_r, 0
advance:
        add     ptr_r, ptr_r, 1
        add     i_r, i_r, 1
        b       scan
scan_done:
        cbz     has_r, report           // count a final unterminated line
        add     count_r, count_r, 1
report:
        ldr     x0, =fmt_out
        mov     w1, count_r
        bl      printf
        b       done

open_err:
        ldr     x0, =fmt_err
        bl      printf
done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
