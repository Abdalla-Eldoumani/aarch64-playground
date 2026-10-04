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
	mov	x29, sp
	str	x19, [sp, 16]
	sxtw	x19, w0
	cmp	w19, 1
	adrp	x0, .LANCHOR0
	cset	w1, gt
	add	x0, x0, :lo12:.LANCHOR0
	ldr	x1, [x0, w1, sxtw 3]
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
	bhi	.L33
	ldr	x2, [x1]
	sxtw	x0, w0
	add	x2, x2, x2, lsl 2
	add	x2, x0, x2, lsl 1
	adrp	x0, st_digit
	add	x0, x0, :lo12:st_digit
	str	x2, [x1]
	ret
	.p2align 2,,3
.L33:
	adrp	x0, st_err
	add	x0, x0, :lo12:st_err
	ret
	.align	2
	.p2align 5,,15
st_digit:
	cmp	w0, 95
	beq	.L36
	mov	x2, 0
	cbz	w0, .L35
	sub	w0, w0, #48
	cmp	w0, 9
	bhi	.L38
	ldr	x2, [x1]
	sxtw	x0, w0
	add	x2, x2, x2, lsl 2
	add	x2, x0, x2, lsl 1
	str	x2, [x1]
	adrp	x2, st_digit
	add	x2, x2, :lo12:st_digit
.L35:
	mov	x0, x2
	ret
	.p2align 2,,3
.L36:
	adrp	x2, st_need
	add	x2, x2, :lo12:st_need
	mov	x0, x2
	ret
	.p2align 2,,3
.L38:
	adrp	x2, st_err
	add	x2, x2, :lo12:st_err
	mov	x0, x2
	ret
	.align	2
	.p2align 5,,15
st_start:
	cmp	w0, 45
	beq	.L48
	cmp	w0, 43
	beq	.L43
	sub	w0, w0, #48
	cmp	w0, 9
	bhi	.L44
	ldr	x2, [x1]
	sxtw	x0, w0
	add	x2, x2, x2, lsl 2
	add	x2, x0, x2, lsl 1
	adrp	x0, st_digit
	add	x0, x0, :lo12:st_digit
	str	x2, [x1]
	ret
	.p2align 2,,3
.L48:
	mov	x0, -1
	str	x0, [x1, 8]
.L43:
	adrp	x0, st_need
	add	x0, x0, :lo12:st_need
	ret
	.p2align 2,,3
.L44:
	adrp	x0, st_err
	add	x0, x0, :lo12:st_err
	ret
	.section .rodata
	.align	3
.LC20:
	.string	""
	.align	3
.LC23:
	.string	" (bad)"
	.align	3
.LC24:
	.string	"ops: "
	.align	3
.LC25:
	.string	"rect"
	.align	3
.LC26:
	.string	"ok"
	.align	3
.LC27:
	.string	"no"
	.align	3
.LC29:
	.string	"rpn [%s] = %d%s\n"
	.align	3
.LC30:
	.string	"%s%s(-17,5)=%d"
	.align	3
.LC31:
	.string	" "
	.align	3
.LC32:
	.string	"\nsame: %d %d %d %d\n"
	.align	3
.LC33:
	.string	"round %d: %d repeat=%d\n"
	.align	3
.LC34:
	.string	"ten: %ld\n"
	.align	3
.LC35:
	.string	"fact:"
	.align	3
.LC36:
	.string	" %ld"
	.align	3
.LC37:
	.string	" %ld\n"
	.align	3
.LC41:
	.string	"%s area2=%ld perim=%ld\n"
	.align	3
.LC44:
	.string	"parse [%s] %s %ld\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #304
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x19, x20, [sp, 32]
	adrp	x20, .LANCHOR0
	add	x20, x20, :lo12:.LANCHOR0
	add	x19, sp, 224
	stp	x21, x22, [sp, 48]
	add	x22, sp, 144
	ldr	q31, [x20, 80]
	stp	x23, x24, [sp, 64]
	adrp	x24, .LC29
	ldp	q27, q28, [x20, 16]
	add	x24, x24, :lo12:.LC29
	ldp	q29, q30, [x20, 48]
	stp	x25, x26, [sp, 80]
	adrp	x25, .LC23
	stp	x27, x28, [sp, 96]
	stp	q27, q28, [sp, 144]
	stp	q29, q30, [sp, 176]
	str	q31, [sp, 208]
	.p2align 5,,15
.L62:
	adrp	x3, .LC23
	ldr	x23, [x22]
	add	x21, x20, 96
	add	x3, x3, :lo12:.LC23
	mov	w2, 0
	mov	x28, x23
	ldrb	w4, [x23]
	cbz	w4, .L51
	.p2align 5,,15
.L50:
	add	x1, x20, 96
	mov	w0, 0
	.p2align 5,,15
.L56:
	ldrb	w3, [x1]
	cmp	w3, w4
	beq	.L107
	add	w0, w0, 1
	add	x1, x1, 24
	cmp	w0, 10
	bne	.L56
	sub	w1, w4, #48
	and	w0, w1, 255
	cmp	w0, 9
	bls	.L108
.L57:
	cmp	w4, 32
	bne	.L60
.L59:
	ldrb	w4, [x28, 1]!
	cbnz	w4, .L50
	cmp	w2, 1
	beq	.L109
.L60:
	add	x3, x25, :lo12:.LC23
	cbnz	w2, .L58
.L51:
	mov	x1, x23
	mov	x0, x24
	add	x22, x22, 8
	bl	printf
	cmp	x22, x19
	bne	.L62
	add	x24, x20, 96
	adrp	x23, .LC24
	adrp	x26, .LC30
	mov	x21, x24
	add	x23, x23, :lo12:.LC24
	add	x26, x26, :lo12:.LC30
	mov	w22, 0
	adrp	x27, .LC31
	.p2align 5,,15
.L63:
	ldp	x25, x2, [x21, 8]
	mov	w1, 5
	mov	w0, -17
	add	w22, w22, 1
	add	x21, x21, 24
	blr	x2
	mov	w3, w0
	mov	x1, x23
	mov	x2, x25
	mov	x0, x26
	bl	printf
	add	x23, x27, :lo12:.LC31
	cmp	w22, 10
	bne	.L63
	mov	x1, x24
	mov	w0, 0
.L66:
	ldrb	w2, [x1]
	cmp	w2, 63
	beq	.L110
	add	w0, w0, 1
	add	x1, x1, 24
	cmp	w0, 10
	bne	.L66
	mov	x0, 0
.L65:
	cmp	x0, 0
	mov	x1, x24
	cset	w2, eq
	mov	w0, 0
.L69:
	ldrb	w3, [x1]
	cmp	w3, 60
	beq	.L111
	add	w0, w0, 1
	add	x1, x1, 24
	cmp	w0, 10
	bne	.L69
	mov	x3, 0
.L68:
	mov	w0, 0
.L72:
	ldrb	w1, [x24]
	cmp	w1, 62
	beq	.L112
	add	w0, w0, 1
	add	x24, x24, 24
	cmp	w0, 10
	bne	.L72
	mov	x0, 0
.L71:
	adrp	x23, .LANCHOR1
	add	x23, x23, :lo12:.LANCHOR1
	cmp	x0, x3
	adrp	x27, .LC33
	add	x25, x23, 32
	add	x27, x27, :lo12:.LC33
	mov	x24, 0
	mov	w3, 1
	cset	w4, eq
	mov	w1, w3
	adrp	x0, .LC32
	add	x0, x0, :lo12:.LC32
	bl	printf
.L73:
	mov	w26, w24
	add	w28, w24, 7
	mov	x22, x23
	mov	w21, 1000
.L74:
	ldr	x2, [x22], 8
	mov	w0, w21
	mov	w1, w28
	blr	x2
	mov	w21, w0
	cmp	x25, x22
	bne	.L74
	ldp	q31, q30, [x23]
	mov	w0, 1
	mov	w28, 6
	ext	v29.16b, v31.16b, v30.16b, #8
	ext	v30.16b, v30.16b, v31.16b, #8
	stp	q29, q30, [x23]
	ldr	x22, [x23, x24, lsl 3]
	.p2align 5,,15
.L75:
	mov	w1, w28
	blr	x22
	subs	w28, w28, #1
	bne	.L75
	mov	w3, w0
	mov	w2, w21
	mov	w1, w26
	mov	x0, x27
	add	x24, x24, 1
	bl	printf
	cmp	x24, 4
	bne	.L73
	ldr	x8, [x23, 32]
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
	adrp	x0, .LC34
	add	x0, x0, :lo12:.LC34
	bl	printf
	adrp	x0, .LC35
	add	x0, x0, :lo12:.LC35
	bl	printf
	adrp	x22, .LC36
	adrp	x1, one
	add	x22, x22, :lo12:.LC36
	add	x1, x1, :lo12:one
	mov	x21, 1
	adrp	x23, fact
.L77:
	sub	w0, w21, #1
	blr	x1
	mul	x1, x21, x0
	mov	x0, x22
	add	x21, x21, 3
	bl	printf
	add	x1, x23, :lo12:fact
	cmp	x21, 22
	bne	.L77
	mov	w0, 18
	bl	fact
	add	x1, x0, x0, lsl 1
	adrp	x23, .LC25
	adrp	x24, .LC41
	add	x23, x23, :lo12:.LC25
	lsl	x1, x1, 5
	add	x24, x24, :lo12:.LC41
	sub	x1, x1, x0
	adrp	x0, .LC37
	add	x0, x0, :lo12:.LC37
	mov	w25, 2
	lsl	x1, x1, 2
	bl	printf
	mov	x0, 96
	bl	malloc
	mov	x22, x0
	ldr	d31, [x20, 368]
	mov	w1, 8
	add	x0, x20, 336
	add	x26, x22, 96
	str	w1, [x22, 40]
	add	x1, x20, 416
	str	d31, [x22, 8]
	ldr	d31, [x20, 408]
	str	x0, [x22]
	mov	w0, 5
	str	x1, [x22, 48]
	mov	w1, 11
	str	d31, [x22, 32]
	movi	v31.2s, 0x5
	str	w0, [x22, 16]
	add	x0, x20, 376
	str	w1, [x22, 64]
	adrp	x1, rect_area2
	add	x1, x1, :lo12:rect_area2
	str	x0, [x22, 24]
	str	d31, [x22, 56]
	ldr	d31, [x20, 448]
	str	x0, [x22, 72]
	mov	w0, 14
	str	w0, [x22, 88]
	str	d31, [x22, 80]
.L78:
	mov	x21, x22
.L81:
	mov	x0, x21
	blr	x1
	mov	x27, x0
	ldr	x0, [x21]
	ldr	x1, [x0, 16]
	mov	x0, x21
	blr	x1
	mov	x3, x0
	mov	x2, x27
	mov	x1, x23
	mov	x0, x24
	bl	printf
	ldr	x0, [x21]
	mov	w1, 2
	ldr	x2, [x0, 24]
	mov	x0, x21
	add	x21, x21, 24
	blr	x2
	cmp	x21, x26
	beq	.L113
	ldr	x0, [x21]
	ldp	x23, x1, [x0]
	b	.L81
	.p2align 2,,3
.L107:
	sub	w1, w4, #48
	and	w3, w1, 255
	cmp	w3, 9
	bhi	.L53
	cmp	w2, 15
	bgt	.L55
.L54:
	str	w1, [x19, w2, sxtw 2]
	add	w2, w2, 1
	b	.L59
	.p2align 2,,3
.L53:
	cmp	w2, 1
	ble	.L57
.L55:
	sbfiz	x1, x0, 1, 32
	sub	w26, w2, #1
	add	x0, x1, w0, sxtw
	sub	w2, w2, #2
	add	x0, x21, x0, lsl 3
	sbfiz	x27, x2, 2, 32
	ldr	w1, [x19, w26, sxtw 2]
	ldr	x2, [x0, 16]
	ldr	w0, [x19, x27]
	blr	x2
	str	w0, [x19, x27]
	mov	w2, w26
	b	.L59
	.p2align 2,,3
.L108:
	cmp	w2, 15
	ble	.L54
.L58:
	sub	w2, w2, #1
	add	x3, x25, :lo12:.LC23
	ldr	w2, [x19, w2, sxtw 2]
	b	.L51
.L113:
	cmp	w25, 1
	beq	.L80
	ldr	x0, [x22]
	mov	w25, 1
	ldp	x23, x1, [x0]
	b	.L78
.L109:
	adrp	x0, .LC20
	ldr	w2, [sp, 224]
	add	x3, x0, :lo12:.LC20
	b	.L51
.L80:
	mov	x0, x22
	bl	free
	add	x0, x20, 456
	adrp	x22, .LC44
	adrp	x21, st_err
	add	x22, x22, :lo12:.LC44
	add	x21, x21, :lo12:st_err
	adrp	x23, st_start
	ldp	q27, q29, [x0]
	ldr	q30, [x0, 64]
	ldp	q28, q31, [x0, 32]
	str	q27, [sp, 224]
	stp	q31, q30, [x19, 48]
	ldr	q31, [x20, 544]
	stp	q29, q28, [x19, 16]
	str	q31, [sp, 112]
	.p2align 5,,15
.L87:
	add	x2, x23, :lo12:st_start
	ldr	q31, [sp, 112]
	ldr	x24, [x19]
	str	q31, [sp, 128]
	mov	x20, x24
	b	.L84
	.p2align 2,,3
.L114:
	add	x20, x20, 1
	cmp	x2, x21
	beq	.L86
.L84:
	ldrb	w0, [x20]
	add	x1, sp, 128
	blr	x2
	mov	x2, x0
	ldrb	w0, [x20]
	cbz	w0, .L82
	cbnz	x2, .L114
	ldp	x0, x3, [sp, 128]
.L88:
	mul	x3, x3, x0
	adrp	x2, .LC26
	add	x2, x2, :lo12:.LC26
.L89:
	mov	x1, x24
	mov	x0, x22
	bl	printf
	add	x19, x19, 8
	add	x0, sp, 304
	cmp	x0, x19
	bne	.L87
	ldp	x29, x30, [sp, 16]
	mov	w0, 0
	ldp	x19, x20, [sp, 32]
	ldp	x21, x22, [sp, 48]
	ldp	x23, x24, [sp, 64]
	ldp	x25, x26, [sp, 80]
	ldp	x27, x28, [sp, 96]
	add	sp, sp, 304
	ret
.L82:
	ldp	x0, x3, [sp, 128]
	cbz	x2, .L88
.L86:
	adrp	x2, .LC27
	mov	x3, 0
	add	x2, x2, :lo12:.LC27
	b	.L89
.L110:
	sxtw	x0, w0
	mov	x1, 24
	madd	x0, x0, x1, x20
	ldr	x0, [x0, 112]
	b	.L65
.L112:
	sxtw	x0, w0
	mov	x1, 24
	madd	x0, x0, x1, x20
	ldr	x0, [x0, 112]
	b	.L71
.L111:
	sxtw	x0, w0
	mov	x1, 24
	madd	x0, x0, x1, x20
	ldr	x3, [x0, 112]
	b	.L68
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
fact_step:
	.xword	one
	.xword	fact
.LC28:
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
rect_vt:
	.xword	.LC25
	.xword	rect_area2
	.xword	rect_perim
	.xword	rect_grow
.LC38:
	.word	3
	.word	4
tri_vt:
	.xword	.LC47
	.xword	tri_area2
	.xword	tri_perim
	.xword	tri_grow
.LC39:
	.word	4
	.word	6
square_vt:
	.xword	.LC46
	.xword	rect_area2
	.xword	rect_perim
	.xword	rect_grow
.LC40:
	.word	6
	.word	10
.LC42:
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
	.zero	8
.LC43:
	.xword	0
	.xword	1
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

