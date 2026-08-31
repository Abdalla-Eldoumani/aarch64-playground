// basics.asm - Demonstrate all arithmetic operations
// Compile: m4 basics.asm > basics.s && gcc basics.s -o basics && ./basics

define(a, x19)
define(b, x20)
define(result, x21)
define(temp, x22)

            .data
add_fmt:    .string  "%d + %d = %d\n"
sub_fmt:    .string  "%d - %d = %d\n"
mul_fmt:    .string  "%d * %d = %d\n"
div_fmt:    .string  "%d / %d = %d\n"
mod_fmt:    .string  "%d %% %d = %d\n"

            .text
            .balign 4
            .global main

main:
            stp     x29, x30, [sp, -16]!
            mov     x29, sp

            // Initialize operands
            mov     a, 47
            mov     b, 5

            add     result, a, b            // result = 47 + 5 = 52

            ldr     x0, =add_fmt
            mov     x1, a
            mov     x2, b
            mov     x3, result
            bl      printf

            sub     result, a, b            // result = 47 - 5 = 42

            ldr     x0, =sub_fmt
            mov     x1, a
            mov     x2, b
            mov     x3, result
            bl      printf

            mul     result, a, b            // result = 47 * 5 = 235

            ldr     x0, =mul_fmt
            mov     x1, a
            mov     x2, b
            mov     x3, result
            bl      printf

            udiv    result, a, b            // result = 47 / 5 = 9

            ldr     x0, =div_fmt
            mov     x1, a
            mov     x2, b
            mov     x3, result
            bl      printf

            // remainder = a - (a / b) * b
            udiv    result, a, b            // result = 47 / 5 = 9

            mul     temp, result, b         // temp = 9 * 5 = 45

            sub     result, a, temp         // result = 47 - 45 = 2

            ldr     x0, =mod_fmt
            mov     x1, a
            mov     x2, b
            mov     x3, result
            bl      printf

            mov     x0, 0
            ldp     x29, x30, [sp], 16
            ret
