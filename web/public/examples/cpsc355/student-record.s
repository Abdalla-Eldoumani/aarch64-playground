// Example 1: Student Record
// Read a student's name and ID, set grade to 'A', print everything.

define(fp, x29)
define(lr, x30)

// Struct layout (starting at fp + 16):
stu_name  = 16          // char name[20], 20 bytes
stu_id    = 36          // int id, 4 bytes (16 + 20 = 36)
stu_grade = 40          // char grade, 1 byte (16 + 24 = 40)
// total struct: 28 bytes (with 3 trailing padding)

alloc = -(16 + 32) & -16       // -48
dealloc = -alloc

.data
fmt_str:    .string "%s"
fmt_int:    .string "%d"
fmt_out:    .string "Name: %s, ID: %d, Grade: %c\n"
prompt_n:   .string "Enter name: "
prompt_id:  .string "Enter ID: "

.text
.balign 4
.global main

main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        // Prompt and read name
        ldr     x0, =prompt_n
        bl      printf

        ldr     x0, =fmt_str
        add     x1, fp, stu_name           // &student.name (address on stack)
        bl      scanf

        // Prompt and read ID
        ldr     x0, =prompt_id
        bl      printf

        ldr     x0, =fmt_int
        add     x1, fp, stu_id             // &student.id (address on stack)
        bl      scanf

        // Set grade = 'A'
        mov     w19, 'A'
        strb    w19, [fp, stu_grade]

        // Print everything
        ldr     x0, =fmt_out
        add     x1, fp, stu_name           // name: pass address (char array)
        ldr     w2, [fp, stu_id]            // id: pass value (int)
        ldrb    w3, [fp, stu_grade]         // grade: pass value (char)
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
