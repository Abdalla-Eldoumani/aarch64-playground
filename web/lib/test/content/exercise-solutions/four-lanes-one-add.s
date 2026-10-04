// add one bonus to four scores with a single vector add, then total them
define(fp, x29)
define(lr, x30)

define(total_r, w19)

        .data
fmt_in:     .string "%d %d %d %d %d"
fmt_scores: .string "scores: %d %d %d %d\n"
fmt_total:  .string "total: %d\n"

        .bss
        .align 4
scores_m:   .skip 16                        // four ints, one v register's worth
bonus_m:    .skip 4

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_in                 // read four scores, then the bonus
        ldr     x1, =scores_m
        add     x2, x1, 4
        add     x3, x1, 8
        add     x4, x1, 12
        ldr     x5, =bonus_m
        bl      scanf

        ldr     x9, =scores_m
        ld1     {v0.4s}, [x9]               // the four scores, one per lane
        ldr     x9, =bonus_m
        ldr     w10, [x9]
        dup     v1.4s, w10                  // the bonus in all four lanes
        add     v2.4s, v0.4s, v1.4s         // four adds in one instruction
        addv    s3, v2.4s                   // s3 = the four new scores added up
        mov     total_r, v3.s[0]            // printf may change v3, so keep it in w19

        ldr     x0, =fmt_scores
        mov     w1, v2.s[0]                 // copy each lane to a general register
        mov     w2, v2.s[1]
        mov     w3, v2.s[2]
        mov     w4, v2.s[3]
        bl      printf

        ldr     x0, =fmt_total
        mov     w1, total_r
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
