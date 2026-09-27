// decode one add/sub (shifted register) instruction word back into assembly
define(fp, x29)
define(lr, x30)

define(word_r, w19)
define(sf_r, w20)
define(op_r, w21)
define(s_r, w22)
define(shift_r, w23)
define(imm6_r, w24)
define(rm_r, w25)
define(rn_r, w26)
define(rd_r, w27)

.data
fmt_hex:    .string "%x"
fmt_fields: .string "sf=%d op=%d S=%d shift=%d imm6=%d\n"
fmt_regs:   .string "Rm=%d Rn=%d Rd=%d\n"
fmt_str:    .string "%s"
fmt_reg:    .string "%s%s%d"
fmt_zr:     .string "%s%szr"
fmt_shift:  .string ", %s %d"
fmt_not:    .string "not an add or sub (shifted register)\n"
str_x:      .string "x"
str_w:      .string "w"
str_space:  .string " "
str_comma:  .string ", "
str_end:    .string "\n"
s_add:      .string "add"
s_adds:     .string "adds"
s_sub:      .string "sub"
s_subs:     .string "subs"
s_lsl:      .string "lsl"
s_lsr:      .string "lsr"
s_asr:      .string "asr"

        .balign 8
mnems:      .dword  s_add, s_adds, s_sub, s_subs    // by op * 2 + S
shifts:     .dword  s_lsl, s_lsr, s_asr             // by the shift field

.bss
.align 2
word:       .skip 4

.text

// print_reg(x0 = text before it, w1 = sf, w2 = register number)
// 31 in these fields names the zero register, not sp
        .balign 4
        .global print_reg
print_reg:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x10, =str_w
        cmp     w1, 0
        b.eq    pr_format
        ldr     x10, =str_x                 // sf = 1 means 64-bit registers
pr_format:
        mov     w3, w2
        ldr     x9, =fmt_reg
        cmp     w3, 31
        b.ne    pr_print
        ldr     x9, =fmt_zr
pr_print:
        mov     x1, x0
        mov     x2, x10
        mov     x0, x9
        bl      printf

        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_hex
        ldr     x1, =word
        bl      scanf
        ldr     x9, =word
        ldr     word_r, [x9]

        // bits 28 to 24 are 01011 and bit 21 is 0 for this format only
        ubfx    w9, word_r, 24, 5
        cmp     w9, 0b01011
        b.ne    not_addsub
        ubfx    w9, word_r, 21, 1
        cmp     w9, 0
        b.ne    not_addsub
        ubfx    shift_r, word_r, 22, 2
        cmp     shift_r, 3                  // shift 11 is reserved
        b.eq    not_addsub

        ubfx    sf_r, word_r, 31, 1
        ubfx    op_r, word_r, 30, 1
        ubfx    s_r, word_r, 29, 1
        ubfx    rm_r, word_r, 16, 5
        ubfx    imm6_r, word_r, 10, 6
        ubfx    rn_r, word_r, 5, 5
        ubfx    rd_r, word_r, 0, 5

        ldr     x0, =fmt_fields
        mov     w1, sf_r
        mov     w2, op_r
        mov     w3, s_r
        mov     w4, shift_r
        mov     w5, imm6_r
        bl      printf
        ldr     x0, =fmt_regs
        mov     w1, rm_r
        mov     w2, rn_r
        mov     w3, rd_r
        bl      printf

        add     w9, s_r, op_r, lsl 1        // op * 2 + S picks the mnemonic
        ldr     x10, =mnems
        ldr     x1, [x10, w9, SXTW 3]
        ldr     x0, =fmt_str
        bl      printf

        ldr     x0, =str_space
        mov     w1, sf_r
        mov     w2, rd_r
        bl      print_reg
        ldr     x0, =str_comma
        mov     w1, sf_r
        mov     w2, rn_r
        bl      print_reg
        ldr     x0, =str_comma
        mov     w1, sf_r
        mov     w2, rm_r
        bl      print_reg

        cmp     imm6_r, 0                   // a zero shift amount is left out
        b.eq    end_line
        ldr     x10, =shifts
        ldr     x1, [x10, shift_r, SXTW 3]
        ldr     x0, =fmt_shift
        mov     w2, imm6_r
        bl      printf
end_line:
        ldr     x0, =str_end
        bl      printf
        mov     w0, 0
        b       done

not_addsub:
        ldr     x0, =fmt_not
        bl      printf
        mov     w0, 1

done:
        ldp     fp, lr, [sp], 16
        ret
