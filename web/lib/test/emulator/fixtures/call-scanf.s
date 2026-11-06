// Reads every kind of scanf conversion into .bss variables with two
// scanf calls, then prints the first two back.

define(fp, x29)
define(lr, x30)

.data
fmt_ints:   .string "%d %i %u %ld %lld"
fmt_rest:   .string "%x %lx %c %s %f %lf"
fmt_out:    .string "%d %d\n"

.bss
.align 8
long_m:     .skip 8
llong_m:    .skip 8
lhex_m:     .skip 8
double_m:   .skip 8
int_m:      .skip 4
any_m:      .skip 4
uint_m:     .skip 4
hex_m:      .skip 4
float_m:    .skip 4
char_m:     .skip 1
word_m:     .skip 16

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // scanf("%d %i %u %ld %lld", &int_m, &any_m, &uint_m, &long_m, &llong_m)
        ldr     x0, =fmt_ints
        ldr     x1, =int_m
        ldr     x2, =any_m
        ldr     x3, =uint_m
        ldr     x4, =long_m
        ldr     x5, =llong_m
        bl      scanf

        // scanf("%x %lx %c %s %f %lf", &hex_m, &lhex_m, &char_m, word_m, &float_m, &double_m)
        ldr     x0, =fmt_rest
        ldr     x1, =hex_m
        ldr     x2, =lhex_m
        ldr     x3, =char_m
        ldr     x4, =word_m
        ldr     x5, =float_m
        ldr     x6, =double_m
        bl      scanf

        ldr     x0, =fmt_out
        ldr     x9, =int_m
        ldr     w1, [x9]
        ldr     x9, =any_m
        ldr     w2, [x9]
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
