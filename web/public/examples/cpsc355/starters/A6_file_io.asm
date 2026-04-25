// A6 -- file I/O with floating point: ln(x) over inputs read from a file
//
// scaffold -- fill in the YOUR CODE blocks. As shipped this file
// compiles, halts cleanly, and prints nothing.
//
// Goal: open "input.txt" with openat, read its contents into a buffer,
// parse each line as a double via atof, compute ln(x) (or e^x -- pick
// one), printf the result, and write a summary line into "output.txt"
// with write+close. Use the syscall numbers documented in the I/O
// week's notes (openat=56, read=63, write=64, close=57).

define(fp, x29)
define(lr, x30)
define(fd_r, w19)
define(n_r,  x20)

buf_size = 256
alloc    = -(16 + buf_size) & -16
dealloc  = -alloc
buf_s    = 16

        .data
in_name:    .string "input.txt"
out_name:   .string "output.txt"
fmt_val:    .string "ln(%g) = %.4f\n"
fmt_err:    .string "Error: could not open %s\n"
summary:    .string "Computed ln() for the input lines.\n"
summary_len = . - summary - 1

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        // YOUR CODE -- openat(AT_FDCWD=-100, in_name, O_RDONLY=0, 0)
        //   via x8=56; check w0 < 0 and branch to error; save fd_r.

        // YOUR CODE -- read(fd_r, buf, buf_size-1) via x8=63; null-
        //   terminate at offset n_r; close(fd_r) via x8=57.

        // YOUR CODE -- walk the buffer line by line; bl atof to convert
        //   each line to a double in d0; compute ln(x) (taylor series, a
        //   table, or just call a custom helper); printf the result.

        // YOUR CODE -- openat out_name with O_WRONLY|O_CREAT|O_TRUNC=01101
        //   and 0644 mode; write(fd_r, summary, summary_len); close.

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
