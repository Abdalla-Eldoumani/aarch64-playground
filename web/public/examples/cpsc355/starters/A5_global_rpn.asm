// A5 -- global variables and an RPN calculator
//
// scaffold -- fill in the YOUR CODE blocks. As shipped this file
// compiles, halts cleanly, and prints nothing.
//
// Goal: implement a tiny reverse-polish-notation calculator over
// integer tokens. Push numbers onto a global stack; on +, -, *, /
// pop two operands, compute, push the result. Print the final value
// on the top of the stack. The token stream is hard-coded below for
// the scaffold; once your push/pop subroutines work, the result for
// "5 3 + 2 *" should be 16.

define(fp, x29)
define(lr, x30)
define(stack_max, 32)       // 32 slots, 4 bytes each

        .data
        .balign 4
stack_m: .skip 4 * stack_max
top_m:   .word 0            // index of the next free slot

// token stream: 5 3 + 2 *  (RPN for (5 + 3) * 2 = 16)
// Encoding: positive int = push that value, negative ASCII = operator.
// '+' = 43, '-' = 45, '*' = 42, '/' = 47. Stored as negative so the
// scaffold's loop can use sign as a quick discriminator.
tokens:
        .word 5
        .word 3
        .word -43           // '+'
        .word 2
        .word -42           // '*'
        .word 0             // sentinel: stop
n_tokens = (. - tokens) / 4

fmt_out: .string "result = %d\n"

        .text

// push(w0)
        .balign 4
        .global push
push:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // YOUR CODE -- ldr x9, =top_m; ldr w10, [x9]; bounds-check;
        //   ldr x11, =stack_m; str w0, [x11, w10, SXTW 2]; w10++; str w10, [x9].

        ldp     fp, lr, [sp], 16
        ret

// pop() -> w0
        .balign 4
        .global pop
pop:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // YOUR CODE -- ldr top_m, decrement, store back, then load
        //   stack_m[new_top] into w0.

        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // YOUR CODE -- iterate `tokens`: if positive, push; if negative
        //   ASCII, pop b then a, dispatch on the operator, and push the
        //   result. Stop on the zero sentinel. Then pop the final value
        //   and printf with fmt_out.

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
