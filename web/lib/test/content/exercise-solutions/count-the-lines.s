// count the lines and bytes on standard input, reading it in chunks with svc
define(fp, x29)
define(lr, x30)

define(lines_r, x19)
define(bytes_r, x20)
define(got_r, x21)
define(buf_r, x22)

define(STDIN, 0)
define(SYS_READ, 63)
define(BUF_SIZE, 64)

.data
fmt_out:    .string "lines: %ld, bytes: %ld\n"

.bss
buf:        .skip 64                        // BUF_SIZE bytes

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     lines_r, 0
        mov     bytes_r, 0
        ldr     buf_r, =buf

chunk:
        mov     x0, STDIN
        mov     x1, buf_r
        mov     x2, BUF_SIZE
        mov     x8, SYS_READ
        svc     0
        mov     got_r, x0
        cmp     got_r, 0
        b.le    finished                    // 0 is end of input, negative an error
        add     bytes_r, bytes_r, got_r

        // look only at the bytes this read delivered; the rest is stale
        mov     x9, 0
        b       scan_test
scan_loop:
        ldrb    w10, [buf_r, x9]
        cmp     w10, 10                     // the newline byte
        b.ne    scan_next
        add     lines_r, lines_r, 1
scan_next:
        add     x9, x9, 1
scan_test:
        cmp     x9, got_r
        b.lt    scan_loop
        b       chunk

finished:
        ldr     x0, =fmt_out
        mov     x1, lines_r
        mov     x2, bytes_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
