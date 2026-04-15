// io_ex2_echo.asm
// Read a line from stdin using svc, then print it using printf.
//
// Compile: m4 io_ex2_echo.asm > io_ex2_echo.s && gcc io_ex2_echo.s -o io_ex2_echo
//
// Example:
//   Enter text: Hello world
//   You typed: Hello world

define(fp, x29)
define(lr, x30)
define(n_read_r, x19)

buf_size = 128
alloc = -(16 + buf_size) & -16
dealloc = -alloc
buf_s = 16

        .text
prompt: .string "Enter text: "
fmt:    .string "You typed: %s"

        .balign 4
        .global main
main:   stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        // Print prompt with write(stdout, prompt, prompt_len)
        mov     w0, 1                   // fd = 1 (stdout)
        ldr     x1, =prompt
        mov     x2, 13                  // prompt length
        mov     x8, 64                  // syscall number for write
        svc     0

        // read(stdin, buf, buf_size)
        mov     w0, 0                   // fd = 0 (stdin)
        add     x1, fp, buf_s           // buffer on the stack
        mov     x2, buf_size
        mov     x8, 63                  // syscall number for read
        svc     0
        mov     n_read_r, x0            // save bytes read

        // Null-terminate the buffer so printf can use %s
        add     x9, fp, buf_s
        strb    wzr, [x9, n_read_r]

        // Print what we read
        ldr     x0, =fmt
        add     x1, fp, buf_s
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
