// build the machine word for an add with an immediate, bit field by bit field
define(fp, x29)
define(lr, x30)

define(rd_r, x19)
define(rn_r, x20)
define(imm_r, x21)
define(word_r, w22)

.data
fmt_in:     .string "%ld %ld %ld"
fmt_ok:     .string "probe check: ok\n"
fmt_bad:    .string "probe check: mismatch\n"
fmt_add:    .string "add "
fmt_comma:  .string ", "
fmt_tail:   .string ", %ld = 0x%08x\n"
fmt_xreg:   .string "x%ld"
fmt_sp:     .string "sp"
fmt_range:  .string "cannot encode that\n"

.bss
.align 3
rd_in:      .skip 8
rn_in:      .skip 8
imm_in:     .skip 8

.text

// a real add for the encoder to match: it is never run, only read
        .balign 4
probe:  add     x1, x2, 42

// encode(x0 = Rd, x1 = Rn, x2 = imm12) -> w0 = the add (immediate) word
// Leaf: sf = 1, op = 0, S = 0, 100010, sh = 0, imm12, Rn, Rd
        .balign 4
        .global encode
encode:
        movz    w9, 0x9100, lsl 16          // bits 31 to 22: 1001000100
        lsl     w10, w2, 10                 // imm12 in bits 21 to 10
        orr     w9, w9, w10
        lsl     w10, w1, 5                  // Rn in bits 9 to 5
        orr     w9, w9, w10
        orr     w0, w9, w0                  // Rd in bits 4 to 0
        ret

// print_reg(x0 = register number): 31 is sp in this format
        .balign 4
        .global print_reg
print_reg:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x1, x0
        ldr     x0, =fmt_xreg
        cmp     x1, 31
        b.ne    pr_print
        ldr     x0, =fmt_sp
pr_print:
        bl      printf

        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // check the encoder against the assembler's own word first
        mov     x0, 1
        mov     x1, 2
        mov     x2, 42
        bl      encode
        ldr     x9, =probe
        ldr     w10, [x9]
        cmp     w0, w10
        ldr     x0, =fmt_ok                 // ldr leaves the flags alone
        b.eq    probe_print
        ldr     x0, =fmt_bad
probe_print:
        bl      printf

        ldr     x0, =fmt_in
        ldr     x1, =rd_in
        ldr     x2, =rn_in
        ldr     x3, =imm_in
        bl      scanf
        ldr     x9, =rd_in
        ldr     rd_r, [x9]
        ldr     x9, =rn_in
        ldr     rn_r, [x9]
        ldr     x9, =imm_in
        ldr     imm_r, [x9]

        // unsigned compares also turn away negatives, which look huge
        cmp     rd_r, 31
        b.hi    out_of_range
        cmp     rn_r, 31
        b.hi    out_of_range
        cmp     imm_r, 4095                 // imm12 holds 0 to 4095
        b.hi    out_of_range

        mov     x0, rd_r
        mov     x1, rn_r
        mov     x2, imm_r
        bl      encode
        mov     word_r, w0

        ldr     x0, =fmt_add
        bl      printf
        mov     x0, rd_r
        bl      print_reg
        ldr     x0, =fmt_comma
        bl      printf
        mov     x0, rn_r
        bl      print_reg
        ldr     x0, =fmt_tail
        mov     x1, imm_r
        mov     w2, word_r
        bl      printf
        mov     w0, 0
        b       done

out_of_range:
        ldr     x0, =fmt_range
        bl      printf
        mov     w0, 1

done:
        ldp     fp, lr, [sp], 16
        ret
