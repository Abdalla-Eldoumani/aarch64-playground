// a snack machine that sells one item for 75 cents; its memory lives in .bss
define(fp, x29)
define(lr, x30)

define(value_r, w19)
define(credit_r, w20)

define(PRICE, 75)

// coin's frame: fp and lr, then the two registers it borrows from its caller
coin_alloc = -(16 + 16) & -16
coin_dealloc = -coin_alloc
save19_s = 16

.data
fmt_in:     .string "%d"
fmt_credit: .string "credit %d\n"
fmt_vend:   .string "vend! change %d\n"
fmt_back:   .string "returned %d\n"
fmt_reject: .string "rejected %d\n"
fmt_end:    .string "sold %d, holding %d\n"

.bss
.align 4
credit:     .skip 4                         // cents put in toward the next snack
sold:       .skip 4                         // snacks handed out so far
value_in:   .skip 4                         // scanf's landing spot

.text

// coin(w0 = coin value in cents, or 0 for the return lever)
        .balign 4
        .global coin
coin:
        stp     fp, lr, [sp, coin_alloc]!
        mov     fp, sp
        stp     x19, x20, [fp, save19_s]

        mov     value_r, w0
        ldr     x9, =credit
        ldr     credit_r, [x9]              // the state left behind by the last call

        cmp     value_r, 0
        b.eq    c_lever
        cmp     value_r, 5
        b.eq    c_accept
        cmp     value_r, 10
        b.eq    c_accept
        cmp     value_r, 25
        b.eq    c_accept
        cmp     value_r, 100
        b.eq    c_accept
        cmp     value_r, 200
        b.eq    c_accept

        ldr     x0, =fmt_reject             // not a coin it takes: credit stays as it was
        mov     w1, value_r
        bl      printf
        b       c_done

c_lever:
        ldr     x0, =fmt_back
        mov     w1, credit_r
        bl      printf
        mov     credit_r, 0
        b       c_save

c_accept:
        add     credit_r, credit_r, value_r
        cmp     credit_r, PRICE
        b.ge    c_vend
        ldr     x0, =fmt_credit
        mov     w1, credit_r
        bl      printf
        b       c_save

c_vend:
        ldr     x0, =fmt_vend
        sub     w1, credit_r, PRICE
        bl      printf
        mov     credit_r, 0
        ldr     x10, =sold
        ldr     w11, [x10]
        add     w11, w11, 1
        str     w11, [x10]

c_save:
        ldr     x9, =credit                 // printf did not keep x9, so fetch the address again
        str     credit_r, [x9]
c_done:
        ldp     x19, x20, [fp, save19_s]
        ldp     fp, lr, [sp], coin_dealloc
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        b       fill_test

next_value:
        ldr     x9, =value_in
        ldr     w0, [x9]
        bl      coin

fill_test:
        ldr     x0, =fmt_in
        ldr     x1, =value_in
        bl      scanf
        cmp     w0, 1                       // 1 value matched; -1 means the input ran out
        b.eq    next_value

        ldr     x0, =fmt_end
        ldr     x9, =sold
        ldr     w1, [x9]
        ldr     x9, =credit
        ldr     w2, [x9]
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
