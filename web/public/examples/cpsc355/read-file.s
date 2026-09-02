// read-file.s
// Open "input.txt", read its contents, print them with printf.
// Uses a read loop to handle files larger than the buffer.
//
// Compile: m4 read-file.s > read-file.gen.s && gcc read-file.gen.s -o read-file
// Setup:   echo "Hello from a file!" > input.txt
// Output:  Hello from a file!

define(fp, x29)
define(lr, x30)
define(fd_r, w19)
define(n_read_r, x20)

buf_size = 256
alloc = -(16 + buf_size) & -16
dealloc = -alloc
buf_s = 16

        .text
fname:      .string "input.txt"
fmt_out:    .string "%s"
fmt_err:    .string "Error: could not open input.txt\n"

        .balign 4
        .global main
main:   stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        // openat(AT_FDCWD, "input.txt", O_RDONLY, 0)
        mov     w0, -100
        ldr     x1, =fname
        mov     w2, 0                   // O_RDONLY
        mov     w3, 0
        mov     x8, 56                  // openat
        svc     0

        cmp     w0, 0
        b.lt    error
        mov     fd_r, w0

read_loop:
        // read(fd, buf, buf_size - 1)
        mov     w0, fd_r
        add     x1, fp, buf_s
        mov     x2, buf_size - 1        // leave room for null
        mov     x8, 63                  // read
        svc     0
        mov     n_read_r, x0

        cmp     n_read_r, 0
        b.le    read_done

        // null-terminate and print
        add     x9, fp, buf_s
        strb    wzr, [x9, n_read_r]
        ldr     x0, =fmt_out
        add     x1, fp, buf_s
        bl      printf

        b       read_loop

read_done:
        mov     w0, fd_r
        mov     x8, 57                  // close
        svc     0
        b       done

error:
        ldr     x0, =fmt_err
        bl      printf

done:
        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
