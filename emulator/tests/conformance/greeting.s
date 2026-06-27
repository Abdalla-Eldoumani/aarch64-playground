// greeting.s - read a name and age, print a personalized message
// Reads a name with %s into a stack buffer and an age with %d, computes
// an approximate birth year from a fixed reference year, and prints both.

define(fp, x29)
define(lr, x30)
define(age_r, w19)
define(birth_r, w20)

name_s = 16
age_s = 48
alloc = -(16 + 48) & -16
dealloc = -alloc
ref_year = 2025

.data
prompt_name:    .string "Enter your name: "
prompt_age:     .string "Enter your age: "
fmt_name:       .string "%s"
fmt_age:        .string "%d"
fmt_out:        .string "Hello, %s! You were born around %d.\n"

.text
.balign 4
.global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x0, =prompt_name
        bl      printf
        ldr     x0, =fmt_name
        add     x1, fp, name_s          // name buffer on the stack
        bl      scanf

        ldr     x0, =prompt_age
        bl      printf
        ldr     x0, =fmt_age
        add     x1, fp, age_s
        bl      scanf

        ldr     age_r, [fp, age_s]
        mov     w9, ref_year
        sub     birth_r, w9, age_r      // birth year = reference - age

        ldr     x0, =fmt_out
        add     x1, fp, name_s
        mov     w2, birth_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
