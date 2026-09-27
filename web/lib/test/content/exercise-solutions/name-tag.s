// print a name tag from two initials and an age read from input
define(fp, x29)
define(lr, x30)

define(first_r, w19)
define(last_r, w20)
define(age_r, w21)

.data
fmt_in:     .string " %c %c %d"
fmt_tag:    .string "HELLO my name is\n%c.%c. (age %d)\n"

.bss
first_in:   .skip 1                         // scanf stores one character here
last_in:    .skip 1                         // and one here
        .balign 4
age_in:     .skip 4                         // and the age here

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read the initials and the age
        ldr     x1, =first_in
        ldr     x2, =last_in
        ldr     x3, =age_in
        bl      scanf

        ldr     x9, =first_in               // bring all three into registers
        ldrb    first_r, [x9]
        ldr     x9, =last_in
        ldrb    last_r, [x9]
        ldr     x9, =age_in
        ldr     age_r, [x9]

        ldr     x0, =fmt_tag
        mov     w1, first_r                 // %c prints the character with this code
        mov     w2, last_r
        mov     w3, age_r                   // %d reads 32 bits, so a w register
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
