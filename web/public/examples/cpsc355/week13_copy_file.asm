// io_ex5_copy_file.asm
// Copy "source.txt" to "dest.txt" using openat, read, write, close.
//
// Compile: m4 io_ex5_copy_file.asm > io_ex5_copy_file.s && gcc io_ex5_copy_file.s -o io_ex5_copy_file
// Setup:   echo "This is the source file." > source.txt
// Output:  Copy complete.
// Verify:  cat dest.txt

define(fp, x29)
define(lr, x30)
define(src_fd, w19)
define(dst_fd, w20)

buf_size = 256
alloc = -(16 + buf_size) & -16
dealloc = -alloc
buf_s = 16

        .text
src_name:   .string "source.txt"
dst_name:   .string "dest.txt"
fmt_ok:     .string "Copy complete.\n"
fmt_err_s:  .string "Error: could not open source.txt\n"
fmt_err_d:  .string "Error: could not open dest.txt\n"

        .balign 4
        .global main
main:   stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        // open source for reading
        mov     w0, -100
        ldr     x1, =src_name
        mov     w2, 0                   // O_RDONLY
        mov     w3, 0
        mov     x8, 56
        svc     0
        cmp     w0, 0
        b.lt    err_src
        mov     src_fd, w0

        // open dest for writing (create/truncate)
        mov     w0, -100
        ldr     x1, =dst_name
        mov     w2, 01101               // O_WRONLY | O_CREAT | O_TRUNC
        mov     w3, 0644
        mov     x8, 56
        svc     0
        cmp     w0, 0
        b.lt    err_dst
        mov     dst_fd, w0

copy_loop:
        // read from source
        mov     w0, src_fd
        add     x1, fp, buf_s
        mov     x2, buf_size
        mov     x8, 63
        svc     0

        cmp     x0, 0
        b.le    copy_done

        // write to dest
        mov     x2, x0                  // write exactly what we read
        mov     w0, dst_fd
        add     x1, fp, buf_s
        mov     x8, 64
        svc     0

        b       copy_loop

copy_done:
        // close both files
        mov     w0, src_fd
        mov     x8, 57
        svc     0

        mov     w0, dst_fd
        mov     x8, 57
        svc     0

        ldr     x0, =fmt_ok
        bl      printf
        b       done

err_src:
        ldr     x0, =fmt_err_s
        bl      printf
        b       done

err_dst:
        // close src before printing error
        mov     w0, src_fd
        mov     x8, 57
        svc     0

        ldr     x0, =fmt_err_d
        bl      printf

done:
        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
