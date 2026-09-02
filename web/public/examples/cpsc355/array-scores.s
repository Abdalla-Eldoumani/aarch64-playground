// Example 1: Three Test Scores
// Reads 3 scores from the user, stores them on the stack, computes and prints the average.

define(fp, x29)
define(lr, x30)

// Register aliases
define(score1_r, w19)
define(score2_r, w20)
define(score3_r, w21)
define(sum_r, w22)
define(avg_r, w23)

score1_s = 16
score2_s = 20
score3_s = 24

alloc = -(16 + 16) & -16
dealloc = -alloc

.data
fmt_prompt:     .string "Enter score %d: "
fmt_input:      .string "%d"
fmt_score:      .string "Score %d: %d\n"
fmt_avg:        .string "Average: %d\n"

.text
.balign 4
.global main

main:
        stp     fp, lr, [sp, alloc]!        // Allocate 32 bytes, save fp/lr
        mov     fp, sp

        ldr     x0, =fmt_prompt
        mov     w1, 1                       // "Enter score 1: "
        bl      printf

        ldr     x0, =fmt_input
        add     x1, fp, score1_s            // x1 = address of score1 on stack
        bl      scanf

        ldr     x0, =fmt_prompt
        mov     w1, 2                       // "Enter score 2: "
        bl      printf

        ldr     x0, =fmt_input
        add     x1, fp, score2_s            // x1 = address of score2 on stack
        bl      scanf

        ldr     x0, =fmt_prompt
        mov     w1, 3                       // "Enter score 3: "
        bl      printf

        ldr     x0, =fmt_input
        add     x1, fp, score3_s            // x1 = address of score3 on stack
        bl      scanf

        ldr     score1_r, [fp, score1_s]    // w19 = score1
        ldr     score2_r, [fp, score2_s]    // w20 = score2
        ldr     score3_r, [fp, score3_s]    // w21 = score3

        // Print each score
        ldr     x0, =fmt_score
        mov     w1, 1
        mov     w2, score1_r
        bl      printf

        ldr     x0, =fmt_score
        mov     w1, 2
        mov     w2, score2_r
        bl      printf

        ldr     x0, =fmt_score
        mov     w1, 3
        mov     w2, score3_r
        bl      printf

        // Compute average
        add     sum_r, score1_r, score2_r   // sum = s1 + s2
        add     sum_r, sum_r, score3_r      // sum += s3
        mov     w24, 3                      // w24 holds the divisor; sdiv takes no immediate
        sdiv    avg_r, sum_r, w24           // integer divide, so 85.0 prints as 85

        // Print average
        ldr     x0, =fmt_avg
        mov     w1, avg_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc       // Restore fp/lr, free frame
        ret
