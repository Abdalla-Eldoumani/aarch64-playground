// value-stack.s - a bounded value stack over an equate-sized buffer
// the buffer is reserved in .bss with .skip STACKSIZE * 4, the top
// index lives in .data, and push guards the capacity before storing
// with the word-array form [base, Wi, SXTW 2]. later assignments build
// small data structures around a reserved buffer exactly this way.

define(fp, x29)
define(lr, x30)
define(val_r, w19)

STACKSIZE = 4

        .data
top:        .word 0
fmt_pop:    .string "popped %d\n"
msg_full:   .string "stack full\n"

        .bss
stack:      .skip STACKSIZE * 4

        .text
        .balign 4
        .global main

// push: w0 holds the value; prints the full message when out of room.
push:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =top
        ldr     w10, [x9]
        cmp     w10, STACKSIZE          // full when top reaches capacity
        b.ge    push_full
        ldr     x11, =stack
        str     w0, [x11, w10, SXTW 2]  // stack[top] = value
        add     w10, w10, 1
        str     w10, [x9]
        b       push_done
push_full:
        ldr     x0, =msg_full
        bl      printf
push_done:
        ldp     fp, lr, [sp], 16
        ret

// pop: returns the top value in w0. callers only pop what they pushed.
pop:
        ldr     x9, =top
        ldr     w10, [x9]
        sub     w10, w10, 1
        str     w10, [x9]
        ldr     x11, =stack
        ldr     w0, [x11, w10, SXTW 2]  // value = stack[top]
        ret

main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w0, 10                  // fill the four slots
        bl      push
        mov     w0, 20
        bl      push
        mov     w0, 30
        bl      push
        mov     w0, 40
        bl      push
        mov     w0, 50                  // fifth push has no room
        bl      push

        bl      pop
        mov     val_r, w0
        ldr     x0, =fmt_pop
        mov     w1, val_r
        bl      printf

        bl      pop
        mov     val_r, w0
        ldr     x0, =fmt_pop
        mov     w1, val_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
