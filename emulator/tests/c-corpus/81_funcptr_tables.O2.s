	.text
	.align	2
	.p2align 5,,15
add:
	add	w0, w0, w1
	ret
	.align	2
	.p2align 5,,15
sub:
	sub	w0, w0, w1
	ret
	.align	2
	.p2align 5,,15
mul:
	mul	w0, w0, w1
	ret
	.align	2
	.p2align 5,,15
bxor:
	eor	w0, w0, w1
	ret
	.align	2
	.p2align 5,,15
band:
	and	w0, w0, w1
	ret
	.align	2
	.p2align 5,,15
bor:
	orr	w0, w0, w1
	ret
	.align	2
	.p2align 5,,15
mn:
	cmp	w1, w0
	csel	w0, w1, w0, le
	ret
	.align	2
	.p2align 5,,15
mx:
	cmp	w1, w0
	csel	w0, w1, w0, ge
	ret
	.align	2
	.p2align 5,,15
quo:
	cbz	w1, .L11
	sdiv	w1, w0, w1
.L11:
	mov	w0, w1
	ret
	.align	2
	.p2align 5,,15
rem_:
	cbz	w1, .L16
	sdiv	w2, w0, w1
	msub	w1, w2, w1, w0
.L16:
	mov	w0, w1
	ret
	.align	2
	.p2align 5,,15
pick:
	adrp	x4, .LANCHOR0
	add	x4, x4, :lo12:.LANCHOR0
	and	w0, w0, 255
	mov	x2, x4
	mov	w1, 0
	.p2align 5,,15
.L23:
	ldrb	w3, [x2]
	cmp	w3, w0
	beq	.L25
	add	w1, w1, 1
	add	x2, x2, 24
	cmp	w1, 10
	bne	.L23
	mov	x0, 0
	ret
	.p2align 2,,3
.L25:
	sbfiz	x0, x1, 1, 32
	add	x1, x0, w1, sxtw
	add	x1, x4, x1, lsl 3
	ldr	x0, [x1, 16]
	ret
	.align	2
	.p2align 5,,15
rpn:
	stp	x29, x30, [sp, -128]!
	mov	x29, sp
	stp	x21, x22, [sp, 32]
	mov	x22, x1
	ldrb	w6, [x0]
	cbz	w6, .L27
	add	x21, sp, 64
	mov	w5, 0
	stp	x19, x20, [sp, 16]
	mov	x20, x0
	str	x23, [sp, 48]
	b	.L34
	.p2align 2,,3
.L46:
	cmp	w5, 15
	bgt	.L29
	str	w0, [x21, w5, sxtw 2]
	add	w5, w5, 1
.L30:
	ldrb	w6, [x20, 1]!
	cbz	w6, .L45
.L34:
	mov	w0, w6
	bl	pick
	mov	x2, x0
	sub	w0, w6, #48
	and	w3, w0, 255
	cmp	w3, 9
	bls	.L46
	cmp	x2, 0
	ccmp	w5, 1, 4, ne
	bgt	.L31
	cmp	w6, 32
	beq	.L30
	.p2align 5,,15
.L36:
	str	wzr, [x22]
	cbz	w5, .L44
	sub	w5, w5, #1
.L38:
	add	x0, sp, 64
	ldp	x19, x20, [sp, 16]
	ldr	x23, [sp, 48]
	ldr	w5, [x0, w5, sxtw 2]
.L26:
	ldp	x21, x22, [sp, 32]
	mov	w0, w5
	ldp	x29, x30, [sp], 128
	ret
	.p2align 2,,3
.L29:
	cbz	x2, .L36
.L31:
	sub	w23, w5, #1
	sub	w5, w5, #2
	sbfiz	x19, x5, 2, 32
	ldr	w1, [x21, w23, sxtw 2]
	ldr	w0, [x21, x19]
	blr	x2
	str	w0, [x21, x19]
	ldrb	w6, [x20, 1]!
	mov	w5, w23
	cbnz	w6, .L34
.L45:
	cmp	w5, 1
	bne	.L36
	str	w5, [x22]
	mov	w5, 0
	b	.L38
	.p2align 2,,3
.L44:
	ldr	x23, [sp, 48]
	mov	w0, w5
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 128
	ret
.L27:
	mov	w5, 0
	str	wzr, [x1]
	b	.L26
	.align	2
	.p2align 5,,15
ten:
	add	x1, x0, w1, sxtw 1
	sxth	w2, w2
	mov	w0, 3
	add	x4, x4, x4, lsl 2
	ldr	x8, [sp]
	smaddl	x2, w2, w0, x1
	mov	w0, 6
	ldrsh	w1, [sp, 8]
	add	x2, x2, w3, uxtb 2
	add	x8, x8, x8, lsl 3
	add	x2, x2, x4
	smaddl	x5, w5, w0, x2
	mov	w0, 10
	add	x5, x5, x6, lsl 3
	sub	x5, x5, x6
	add	x7, x5, w7, sxtw 3
	add	x7, x7, x8
	smaddl	x0, w1, w0, x7
	ret
	.align	2
	.p2align 5,,15
one:
	mov	x0, 1
	ret
	.align	2
	.p2align 5,,15
fact:
	stp	x29, x30, [sp, -32]!
	adrp	x1, .LANCHOR0
	add	x1, x1, :lo12:.LANCHOR0
	mov	x29, sp
	str	x19, [sp, 16]
	sxtw	x19, w0
	cmp	w19, 1
	cset	x0, gt
	add	x0, x1, x0, lsl 3
	ldr	x1, [x0, 240]
	sub	w0, w19, #1
	blr	x1
	mul	x0, x19, x0
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
	.align	2
	.p2align 5,,15
rect_area2:
	ldp	w0, w1, [x0, 8]
	smull	x0, w0, w1
	lsl	x0, x0, 1
	ret
	.align	2
	.p2align 5,,15
rect_perim:
	ldp	w0, w1, [x0, 8]
	add	w0, w0, w1
	sbfiz	x0, x0, 1, 32
	ret
	.align	2
	.p2align 5,,15
rect_grow:
	dup	v31.2s, w1
	ldr	d30, [x0, 8]
	add	v30.2s, v30.2s, v31.2s
	str	d30, [x0, 8]
	ret
	.align	2
	.p2align 5,,15
tri_area2:
	ldp	w1, w0, [x0, 8]
	smull	x0, w1, w0
	ret
	.align	2
	.p2align 5,,15
tri_perim:
	ldpsw	x1, x2, [x0, 8]
	ldrsw	x0, [x0, 16]
	add	x1, x1, x2
	add	x0, x1, x0
	ret
	.align	2
	.p2align 5,,15
tri_grow:
	ldr	d31, [x0, 8]
	fmov	s30, w1
	ldr	w2, [x0, 16]
	mul	v31.2s, v31.2s, v30.s[0]
	mul	w2, w2, w1
	str	w2, [x0, 16]
	str	d31, [x0, 8]
	ret
	.align	2
	.p2align 5,,15
st_err:
	adrp	x0, st_err
	add	x0, x0, :lo12:st_err
	ret
	.align	2
	.p2align 5,,15
st_need:
	sub	w0, w0, #48
	cmp	w0, 9
	bhi	.L60
	ldr	x2, [x1]
	sxtw	x0, w0
	add	x2, x2, x2, lsl 2
	add	x2, x0, x2, lsl 1
	adrp	x0, st_digit
	add	x0, x0, :lo12:st_digit
	str	x2, [x1]
	ret
	.p2align 2,,3
.L60:
	adrp	x0, st_err
	add	x0, x0, :lo12:st_err
	ret
	.align	2
	.p2align 5,,15
st_digit:
	cmp	w0, 95
	beq	.L63
	mov	x2, 0
	cbnz	w0, .L70
	mov	x0, x2
	ret
	.p2align 2,,3
.L70:
	stp	x29, x30, [sp, -16]!
	mov	x29, sp
	bl	st_need
	ldp	x29, x30, [sp], 16
	ret
	.p2align 2,,3
.L63:
	adrp	x2, st_need
	add	x2, x2, :lo12:st_need
	mov	x0, x2
	ret
	.align	2
	.p2align 5,,15
st_start:
	cmp	w0, 45
	beq	.L82
	cmp	w0, 43
	bne	.L83
	adrp	x0, st_need
	add	x0, x0, :lo12:st_need
	ret
	.p2align 2,,3
.L83:
	stp	x29, x30, [sp, -16]!
	mov	x29, sp
	bl	st_need
	ldp	x29, x30, [sp], 16
	ret
	.p2align 2,,3
.L82:
	mov	x0, -1
	str	x0, [x1, 8]
	adrp	x0, st_need
	add	x0, x0, :lo12:st_need
	ret
	.align	2
	.p2align 5,,15
parse:
	stp	x29, x30, [sp, -64]!
	adrp	x2, st_start
	add	x2, x2, :lo12:st_start
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x0
	adrp	x0, .LANCHOR0+256
	adrp	x20, st_err
	add	x20, x20, :lo12:st_err
	ldr	q31, [x0, :lo12:.LANCHOR0+256]
	str	x21, [sp, 32]
	mov	x21, x1
	str	q31, [sp, 48]
	b	.L87
	.p2align 2,,3
.L93:
	add	x19, x19, 1
	cmp	x2, x20
	beq	.L91
.L87:
	ldrb	w0, [x19]
	add	x1, sp, 48
	blr	x2
	mov	x2, x0
	ldrb	w0, [x19]
	cbz	w0, .L92
	cbnz	x2, .L93
	ldp	x1, x2, [sp, 48]
	mov	w0, 1
	mul	x1, x1, x2
	str	x1, [x21]
	ldr	x21, [sp, 32]
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 64
	ret
	.p2align 2,,3
.L91:
	ldp	x1, x2, [sp, 48]
	mov	w0, 0
	mul	x1, x1, x2
	str	x1, [x21]
	ldr	x21, [sp, 32]
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 64
	ret
	.p2align 2,,3
.L92:
	cmp	x2, 0
	ldp	x1, x2, [sp, 48]
	cset	w0, eq
	mul	x1, x1, x2
	str	x1, [x21]
	ldr	x21, [sp, 32]
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 64
	ret
	.align	2
	.p2align 5,,15
repeat.constprop.0:
	stp	x29, x30, [sp, -32]!
	mov	w2, 1
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x20, x0
	mov	w19, 6
	.p2align 5,,15
.L95:
	mov	w1, w19
	mov	w0, w2
	blr	x20
	mov	w2, w0
	subs	w19, w19, #1
	bne	.L95
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
	.align	2
	.p2align 5,,15
apply.constprop.0:
	mov	x16, x0
	mov	w1, 5
	mov	w0, -17
	br	x16
	.section .rodata
	.align	3
.LC20:
	.string	""
	.align	3
.LC24:
	.string	" (bad)"
	.align	3
.LC25:
	.string	"ops: "
	.align	3
.LC26:
	.string	"rect"
	.align	3
.LC27:
	.string	"ok"
	.align	3
.LC28:
	.string	"no"
	.align	3
.LC30:
	.string	"rpn [%s] = %d%s\n"
	.align	3
.LC31:
	.string	"%s%s(-17,5)=%d"
	.align	3
.LC32:
	.string	" "
	.align	3
.LC33:
	.string	"\nsame: %d %d %d %d\n"
	.align	3
.LC34:
	.string	"round %d: %d repeat=%d\n"
	.align	3
.LC35:
	.string	"ten: %ld\n"
	.align	3
.LC36:
	.string	"fact:"
	.align	3
.LC37:
	.string	" %ld"
	.align	3
.LC38:
	.string	" %ld\n"
	.align	3
.LC42:
	.string	"%s area2=%ld perim=%ld\n"
	.align	3
.LC44:
	.string	"parse [%s] %s %ld\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #288
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x23, x24, [sp, 64]
	adrp	x23, .LANCHOR0
	add	x23, x23, :lo12:.LANCHOR0
	stp	x19, x20, [sp, 32]
	add	x19, sp, 128
	add	x20, sp, 208
	ldr	q31, [x23, 336]
	stp	x21, x22, [sp, 48]
	adrp	x21, .LC30
	ldp	q27, q28, [x23, 272]
	add	x21, x21, :lo12:.LC30
	ldp	q29, q30, [x23, 304]
	adrp	x24, .LC24
	adrp	x22, .LC20
	stp	x25, x26, [sp, 80]
	stp	x27, x28, [sp, 96]
	stp	q27, q28, [sp, 128]
	stp	q29, q30, [sp, 160]
	str	q31, [sp, 192]
	.p2align 5,,15
.L101:
	add	x1, sp, 116
	ldr	x25, [x19]
	add	x19, x19, 8
	mov	x0, x25
	bl	rpn
	ldr	w2, [sp, 116]
	add	x1, x22, :lo12:.LC20
	add	x3, x24, :lo12:.LC24
	cmp	w2, 0
	mov	w2, w0
	csel	x3, x3, x1, eq
	mov	x0, x21
	mov	x1, x25
	bl	printf
	cmp	x20, x19
	bne	.L101
	adrp	x22, .LC25
	adrp	x25, .LC31
	mov	x19, x23
	add	x22, x22, :lo12:.LC25
	add	x25, x25, :lo12:.LC31
	mov	w21, 0
	adrp	x26, .LC32
	.p2align 5,,15
.L102:
	ldp	x24, x0, [x19, 8]
	add	w21, w21, 1
	add	x19, x19, 24
	bl	apply.constprop.0
	mov	w3, w0
	mov	x1, x22
	mov	x2, x24
	mov	x0, x25
	bl	printf
	add	x22, x26, :lo12:.LC32
	cmp	w21, 10
	bne	.L102
	mov	w0, 43
	bl	pick
	mov	x5, x0
	mov	w0, 63
	bl	pick
	mov	x6, x0
	mov	w0, 60
	bl	pick
	mov	x7, x0
	mov	w0, 62
	bl	pick
	cmp	x7, x0
	cset	w4, eq
	adrp	x0, add
	cmp	x6, 0
	add	x0, x0, :lo12:add
	adrp	x21, .LANCHOR1
	add	x21, x21, :lo12:.LANCHOR1
	cset	w2, eq
	adrp	x27, .LC34
	cmp	x5, x0
	add	x27, x27, :lo12:.LC34
	add	x25, x21, 32
	mov	x22, 0
	cset	w1, eq
	mov	w3, 1
	adrp	x0, .LC33
	add	x0, x0, :lo12:.LC33
	bl	printf
.L103:
	mov	w26, w22
	add	w24, w22, 7
	mov	x28, x21
	mov	w19, 1000
.L104:
	ldr	x2, [x28], 8
	mov	w0, w19
	mov	w1, w24
	blr	x2
	mov	w19, w0
	cmp	x25, x28
	bne	.L104
	ldp	q31, q30, [x21]
	ext	v29.16b, v31.16b, v30.16b, #8
	ext	v30.16b, v30.16b, v31.16b, #8
	stp	q29, q30, [x21]
	ldr	x0, [x21, x22, lsl 3]
	add	x22, x22, 1
	bl	repeat.constprop.0
	mov	w3, w0
	mov	w2, w19
	mov	w1, w26
	mov	x0, x27
	bl	printf
	cmp	x22, 4
	bne	.L103
	ldr	x8, [x21, 32]
	mov	w0, -10
	strh	w0, [sp, 8]
	mov	x0, -34359738368
	str	x0, [sp]
	mov	w1, -2
	mov	w7, 8
	mov	x6, -7
	mov	w5, -6
	mov	x4, 1099511627776
	mov	w3, -56
	mov	w2, -3
	mov	x0, -1
	blr	x8
	mov	x1, x0
	adrp	x0, .LC35
	add	x0, x0, :lo12:.LC35
	bl	printf
	adrp	x21, .LC37
	adrp	x0, .LC36
	add	x21, x21, :lo12:.LC37
	add	x0, x0, :lo12:.LC36
	mov	w19, 1
	bl	printf
	.p2align 5,,15
.L106:
	mov	w0, w19
	bl	fact
	add	w19, w19, 3
	mov	x1, x0
	mov	x0, x21
	bl	printf
	cmp	w19, 22
	bne	.L106
	mov	w0, 20
	bl	fact
	mov	x1, x0
	adrp	x0, .LC38
	add	x0, x0, :lo12:.LC38
	bl	printf
	mov	x0, 96
	adrp	x22, .LC26
	bl	malloc
	mov	x21, x0
	ldr	d31, [x23, 384]
	mov	w1, 8
	add	x0, x23, 352
	adrp	x24, .LC42
	str	w1, [x21, 40]
	add	x1, x23, 432
	str	d31, [x21, 8]
	add	x22, x22, :lo12:.LC26
	ldr	d31, [x23, 424]
	add	x24, x24, :lo12:.LC42
	str	x0, [x21]
	mov	w0, 5
	str	x1, [x21, 48]
	mov	w1, 11
	str	d31, [x21, 32]
	movi	v31.2s, 0x5
	add	x26, x21, 96
	str	w0, [x21, 16]
	add	x0, x23, 392
	str	w1, [x21, 64]
	adrp	x1, rect_area2
	add	x1, x1, :lo12:rect_area2
	str	d31, [x21, 56]
	mov	w25, 2
	ldr	d31, [x23, 464]
	str	x0, [x21, 24]
	str	x0, [x21, 72]
	mov	w0, 14
	str	w0, [x21, 88]
	str	d31, [x21, 80]
.L107:
	mov	x19, x21
.L110:
	mov	x0, x19
	blr	x1
	mov	x27, x0
	ldr	x0, [x19]
	ldr	x1, [x0, 16]
	mov	x0, x19
	blr	x1
	mov	x3, x0
	mov	x2, x27
	mov	x1, x22
	mov	x0, x24
	bl	printf
	ldr	x0, [x19]
	mov	w1, 2
	ldr	x2, [x0, 24]
	mov	x0, x19
	add	x19, x19, 24
	blr	x2
	cmp	x19, x26
	beq	.L121
	ldr	x0, [x19]
	ldp	x22, x1, [x0]
	b	.L110
	.p2align 2,,3
.L121:
	cmp	w25, 1
	beq	.L109
	ldr	x0, [x21]
	mov	w25, 1
	ldp	x22, x1, [x0]
	b	.L107
	.p2align 2,,3
.L109:
	add	x23, x23, 472
	mov	x0, x21
	bl	free
	adrp	x21, .LC44
	mov	x19, x20
	add	x21, x21, :lo12:.LC44
	ldr	q31, [x23, 64]
	adrp	x22, .LC27
	ldp	q28, q27, [x23]
	ldp	q30, q29, [x23, 32]
	adrp	x23, .LC28
	stp	q28, q27, [x20]
	stp	q30, q29, [x20, 32]
	str	q31, [x20, 64]
	b	.L112
	.p2align 2,,3
.L123:
	ldr	x3, [sp, 120]
	add	x2, x22, :lo12:.LC27
	mov	x1, x20
	mov	x0, x21
	add	x19, x19, 8
	bl	printf
	add	x0, sp, 288
	cmp	x0, x19
	beq	.L122
.L112:
	ldr	x20, [x19]
	add	x1, sp, 120
	mov	x0, x20
	bl	parse
	cbnz	w0, .L123
	add	x2, x23, :lo12:.LC28
	mov	x1, x20
	mov	x0, x21
	mov	x3, 0
	bl	printf
	add	x19, x19, 8
	add	x0, sp, 288
	cmp	x0, x19
	bne	.L112
.L122:
	ldp	x29, x30, [sp, 16]
	mov	w0, 0
	ldp	x19, x20, [sp, 32]
	ldp	x21, x22, [sp, 48]
	ldp	x23, x24, [sp, 64]
	ldp	x25, x26, [sp, 80]
	ldp	x27, x28, [sp, 96]
	add	sp, sp, 288
	ret
	.section .rodata
	.align	3
.LC12:
	.string	"-12_345"
	.align	3
.LC13:
	.string	"+7"
	.align	3
.LC14:
	.string	"1__2"
	.align	3
.LC15:
	.string	"-"
	.align	3
.LC16:
	.string	"12a"
	.align	3
.LC17:
	.string	"0"
	.align	3
.LC18:
	.string	"_5"
	.align	3
.LC19:
	.string	"9_"
	.align	3
.LC21:
	.string	"-0_0_1"
	.align	3
.LC0:
	.string	"3 4 + 2 *"
	.align	3
.LC1:
	.string	"9 7 % 5 ^"
	.align	3
.LC2:
	.string	"8 5 < 9 >"
	.align	3
.LC3:
	.string	"1 2 3 4 + + +"
	.align	3
.LC4:
	.string	"5 0 /"
	.align	3
.LC5:
	.string	"2 +"
	.align	3
.LC6:
	.string	"9 6 & 6 |"
	.align	3
.LC7:
	.string	"7 3 - 4 - 1 2 * *"
	.align	3
.LC8:
	.string	"9 x"
	.align	3
.LC9:
	.string	"9 9 * 9 * 9 * 9 -"
	.align	3
.LC46:
	.string	"square"
	.align	3
.LC47:
	.string	"tri"
	.align	3
.LC48:
	.string	"add"
	.align	3
.LC49:
	.string	"sub"
	.align	3
.LC50:
	.string	"mul"
	.align	3
.LC51:
	.string	"quo"
	.align	3
.LC52:
	.string	"rem"
	.align	3
.LC53:
	.string	"and"
	.align	3
.LC54:
	.string	"or"
	.align	3
.LC55:
	.string	"xor"
	.align	3
.LC56:
	.string	"min"
	.align	3
.LC57:
	.string	"max"
	.section .rodata
	.align	4
	.LANCHOR0:
optab:
	.byte	43
	.zero	7
	.xword	.LC48
	.xword	add
	.byte	45
	.zero	7
	.xword	.LC49
	.xword	sub
	.byte	42
	.zero	7
	.xword	.LC50
	.xword	mul
	.byte	47
	.zero	7
	.xword	.LC51
	.xword	quo
	.byte	37
	.zero	7
	.xword	.LC52
	.xword	rem_
	.byte	38
	.zero	7
	.xword	.LC53
	.xword	band
	.byte	124
	.zero	7
	.xword	.LC54
	.xword	bor
	.byte	94
	.zero	7
	.xword	.LC55
	.xword	bxor
	.byte	60
	.zero	7
	.xword	.LC56
	.xword	mn
	.byte	62
	.zero	7
	.xword	.LC57
	.xword	mx
fact_step:
	.xword	one
	.xword	fact
.LC23:
	.xword	0
	.xword	1
.LC29:
	.xword	.LC0
	.xword	.LC1
	.xword	.LC2
	.xword	.LC3
	.xword	.LC4
	.xword	.LC5
	.xword	.LC6
	.xword	.LC7
	.xword	.LC8
	.xword	.LC9
rect_vt:
	.xword	.LC26
	.xword	rect_area2
	.xword	rect_perim
	.xword	rect_grow
.LC39:
	.word	3
	.word	4
tri_vt:
	.xword	.LC47
	.xword	tri_area2
	.xword	tri_perim
	.xword	tri_grow
.LC40:
	.word	4
	.word	6
square_vt:
	.xword	.LC46
	.xword	rect_area2
	.xword	rect_perim
	.xword	rect_grow
.LC41:
	.word	6
	.word	10
.LC43:
	.xword	.LC12
	.xword	.LC13
	.xword	.LC14
	.xword	.LC15
	.xword	.LC16
	.xword	.LC17
	.xword	.LC18
	.xword	.LC19
	.xword	.LC20
	.xword	.LC21
	.data
	.align	4
	.LANCHOR1:
slots:
	.xword	add
	.xword	sub
	.xword	mul
	.xword	bxor
tenp:
	.xword	ten

