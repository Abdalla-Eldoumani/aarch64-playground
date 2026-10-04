// read up to 32 temperatures, print their average and how many beat it
define(fp, x29)
define(lr, x30)

define(n_r, x19)
define(base_r, x20)
define(day_r, x21)
define(above_r, w22)

define(MAX_READINGS, 32)

n_s = 16                                    // the count read by scanf
alloc = -(16 + 4) & -16
dealloc = -alloc

.data
fmt_count:  .string "%d"
fmt_temp:   .string "%lf"
fmt_avg:    .string "average = %.2f\n"
fmt_above:  .string "above average: %d\n"
fmt_none:   .string "no readings\n"
fmt_range:  .string "between 0 and 32 readings, please\n"

.bss
.align 3
temps:      .skip 256                       // MAX_READINGS doubles

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x0, =fmt_count
        add     x1, fp, n_s
        bl      scanf
        ldrsw   n_r, [fp, n_s]              // an int, widened to 64 bits

        cmp     n_r, 0
        b.lt    out_of_range
        b.eq    no_readings
        cmp     n_r, MAX_READINGS
        b.gt    out_of_range

        ldr     base_r, =temps
        mov     day_r, 0
        b       fill_test
fill_loop:
        ldr     x0, =fmt_temp
        add     x1, base_r, day_r, lsl 3    // &temps[i]
        bl      scanf
        add     day_r, day_r, 1
fill_test:
        cmp     day_r, n_r
        b.lt    fill_loop

        // sum, then divide by n converted to a double
        fmov    d0, xzr
        mov     day_r, 0
sum_loop:
        ldr     d1, [base_r, day_r, lsl 3]
        fadd    d0, d0, d1
        add     day_r, day_r, 1
        cmp     day_r, n_r
        b.lt    sum_loop
        scvtf   d2, n_r
        fdiv    d0, d0, d2                  // d0 = average

        // count before printing: printf is free to change d0 to d7
        mov     above_r, 0
        mov     day_r, 0
above_loop:
        ldr     d1, [base_r, day_r, lsl 3]
        fcmp    d1, d0
        b.le    above_next                  // equal to the average is not above it
        add     above_r, above_r, 1
above_next:
        add     day_r, day_r, 1
        cmp     day_r, n_r
        b.lt    above_loop

        ldr     x0, =fmt_avg                // the average is still in d0
        bl      printf
        ldr     x0, =fmt_above
        mov     w1, above_r
        bl      printf
        mov     w0, 0
        b       avg_end

no_readings:
        ldr     x0, =fmt_none
        bl      printf
        mov     w0, 0
        b       avg_end

out_of_range:
        ldr     x0, =fmt_range
        bl      printf
        mov     w0, 1

avg_end:
        ldp     fp, lr, [sp], dealloc
        ret
