// hello.s
// Write a message to stdout using the write system call.
//
// Compile: m4 hello.s > hello.gen.s && gcc hello.gen.s -o hello
// Output:  Hello from a system call!

define(fp, x29)
define(lr, x30)

        .text
msg:    .string "Hello from a system call!\n"
msg_len = . - msg - 1           // -1 drops the .string NUL

        .balign 4
        .global main
main:   stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // write(stdout, msg, msg_len)
        mov     w0, 1                   // fd = 1 (stdout)
        ldr     x1, =msg
        mov     x2, msg_len
        mov     x8, 64                  // syscall number for write
        svc     0

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
