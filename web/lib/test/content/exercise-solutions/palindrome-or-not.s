// read one word and report whether it reads the same both ways, ignoring case
define(fp, x29)
define(lr, x30)

define(left_r, x19)
define(right_r, x20)
define(lch_r, w21)
define(rch_r, w22)

.data
fmt_word:   .string "%63s"
fmt_yes:    .string "%s is a palindrome\n"
fmt_no:     .string "%s is not a palindrome\n"
fmt_none:   .string "no word given\n"

.bss
word:       .skip 64                        // 63 letters plus the zero byte

.text

// lower(w0 = ch) -> w0 = ch with a capital folded to lower case
// Leaf: no frame, touches only w0
        .balign 4
        .global lower
lower:
        cmp     w0, 'A'
        b.lt    lower_done
        cmp     w0, 'Z'
        b.gt    lower_done
        add     w0, w0, 32                  // 'A' + 32 = 'a'
lower_done:
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_word
        ldr     x1, =word
        bl      scanf
        cmp     w0, 1                       // scanf answers how many it filled
        b.ne    no_word

        // right_r walks to the zero byte, then steps back onto the last letter
        ldr     left_r, =word
        mov     right_r, left_r
find_end:
        ldrb    w9, [right_r]
        cmp     w9, 0
        b.eq    found_end
        add     right_r, right_r, 1
        b       find_end
found_end:
        sub     right_r, right_r, 1
        b       pal_test

pal_loop:
        ldrb    w0, [left_r]
        bl      lower
        mov     lch_r, w0                   // keep it past the next call
        ldrb    w0, [right_r]
        bl      lower
        mov     rch_r, w0
        cmp     lch_r, rch_r
        b.ne    not_pal
        add     left_r, left_r, 1
        sub     right_r, right_r, 1
pal_test:
        cmp     left_r, right_r
        b.lt    pal_loop

        ldr     x0, =fmt_yes
        b       print
not_pal:
        ldr     x0, =fmt_no
print:
        ldr     x1, =word                   // the word as it was typed
        bl      printf
        mov     w0, 0
        b       done

no_word:
        ldr     x0, =fmt_none
        bl      printf
        mov     w0, 1

done:
        ldp     fp, lr, [sp], 16
        ret
