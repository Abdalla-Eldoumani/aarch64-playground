	.text
	.align	2
	.align 5
dbits:
	fmov	x0, d0
	ret
	.align	2
	.align 5
relations:
	fcmpe	d0, d1
	stp	x29, x30, [sp, -16]!
	fmov	d31, d0
	mov	x29, sp
	mov	x1, x0
	bmi	.L17
	mov	w0, 48
	strb	w0, [x1]
	bls	.L18
	strb	w0, [x1, 1]
	bgt	.L13
	mov	w2, 48
	b	.L9
	.align 2
.L13:
	mov	w0, 49
	strb	w0, [x1, 2]
	mov	w0, 49
	mov	w3, w0
	mov	w2, 48
.L6:
	fcmp	d31, d1
	strb	w0, [x1, 3]
	strb	w2, [x1, 4]
	strb	w3, [x1, 5]
	cset	w0, pl
	cset	w2, vs
	eor	w0, w0, 1
	add	w0, w0, 48
	strb	w0, [x1, 6]
	cset	w0, hi
	eor	w0, w0, 1
	add	w0, w0, 48
	strb	w0, [x1, 7]
	cset	w0, le
	eor	w0, w0, 1
	add	w0, w0, 48
	strb	w0, [x1, 8]
	cset	w0, lt
	eor	w0, w0, 1
	add	w0, w0, 48
	strb	w0, [x1, 9]
	csinc	w0, w2, wzr, ne
	fcmpe	d31, d1
	eor	w0, w0, 1
	add	w2, w2, 48
	add	w0, w0, 48
	strb	w0, [x1, 10]
	strb	w2, [x1, 11]
	cset	w0, mi
	fcsel	d0, d31, d1, mi
	eor	w0, w0, 1
	fcsel	d30, d31, d1, ge
	add	w0, w0, 48
	strb	w0, [x1, 12]
	cset	w0, ge
	eor	w0, w0, 1
	add	w0, w0, 48
	strb	w0, [x1, 13]
	bl	dbits
	fmov	d0, d31
	mov	x3, x0
	bl	dbits
	cmp	x3, x0
	mov	x2, x0
	fmov	d0, d30
	cset	w0, ne
	add	w0, w0, 97
	strb	w0, [x1, 14]
	bl	dbits
	cmp	x2, x0
	cset	w0, ne
	strb	wzr, [x1, 16]
	add	w0, w0, 97
	strb	w0, [x1, 15]
	ldp	x29, x30, [sp], 16
	ret
	.align 2
.L17:
	mov	w0, 12593
	strh	w0, [x1]
	mov	w0, 48
	mov	w3, 49
	strb	w0, [x1, 2]
	mov	w0, 48
	mov	w2, w0
	b	.L6
.L18:
	mov	w0, 49
	mov	w2, 49
	strb	w0, [x1, 1]
.L9:
	mov	w0, 48
	mov	w3, 48
	strb	w0, [x1, 2]
	mov	w0, w2
	b	.L6
	.align	2
	.align 5
cmp3:
	fcmpe	d0, d1
	mov	w0, 60
	bmi	.L23
	mov	w0, 62
	bgt	.L23
	fcmp	d0, d1
	mov	w0, 61
	mov	w1, 63
	csel	w0, w0, w1, eq
.L23:
	ret
	.align	2
	.align 5
inside:
	fcmpe	d0, d1
	bge	.L32
	mov	w0, 0
	ret
	.align 2
.L32:
	fcmpe	d0, d2
	cset	w0, ls
	ret
	.align	2
	.align 5
outside:
	fcmpe	d0, d1
	mov	w0, 1
	bmi	.L35
	fcmpe	d0, d2
	cset	w0, gt
.L35:
	ret
	.align	2
	.align 5
both_less:
	fcmpe	d0, d1
	bmi	.L41
	mov	w0, 0
	ret
	.align 2
.L41:
	fcmpe	d2, d3
	cset	w0, mi
	ret
	.align	2
	.align 5
either_eq:
	fcmp	s0, s1
	fccmp	s0, s2, 4, ne
	cset	w0, eq
	ret
	.align	2
	.align 5
before:
	fcmp	d1, d1
	bne	.L53
	fcmp	d0, d0
	bne	.L48
	fcmpe	d1, d0
	mov	w0, 1
	bgt	.L44
	fcmp	d1, d0
	bne	.L48
	fmov	x1, d0
	lsr	x0, x1, 63
	tbz	x1, #63, .L44
	fmov	x0, d1
	cmp	x0, 0
	cset	w0, ge
.L44:
	ret
	.align 2
.L48:
	mov	w0, 0
	ret
	.align 2
.L53:
	fcmp	d0, d0
	cset	w0, eq
	ret
	.align	2
	.align 5
sort__constprop__0:
	mov	x4, x0
	add	x5, x0, 8
	stp	x29, x30, [sp, -16]!
	mov	w6, 1
	mov	x29, sp
	.align 5
.L58:
	ldr	d31, [x5]
	mov	x2, x5
	.align 5
.L55:
	ldr	d30, [x2, -8]
	fmov	d0, d31
	mov	x3, x2
	fmov	d1, d30
	bl	before
	cbz	w0, .L56
	str	d30, [x2]
	sub	x2, x3, #8
	cmp	x4, x2
	bne	.L55
	mov	x3, x4
.L56:
	add	w6, w6, 1
	str	d31, [x3]
	add	x5, x5, 8
	cmp	w6, 16
	bne	.L58
	ldp	x29, x30, [sp], 16
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"ij < <= > >= == != isless isle isgt isge islg isun !< !>= min max"
	.align	3
.LC1:
	.string	"%d%d %s\n"
	.align	3
.LC2:
	.string	"cmp%d "
	.align	3
.LC3:
	.string	"range%d %d%d %d%d %d %d%d\n"
	.align	3
.LC5:
	.string	"float %d%d%d %d%d%d %d%d%d%d\n"
	.align	3
.LC7:
	.string	"sorted"
	.align	3
.LC8:
	.string	" nan:%016lx"
	.align	3
.LC9:
	.string	" %g"
	.align	3
.LC10:
	.string	"\n"
	.align	3
.LC11:
	.string	"best %g above %d below %d unordered %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #288
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	stp	x19, x20, [sp, 48]
	adrp	x20, .LANCHOR0
	add	x20, x20, :lo12:.LANCHOR0
	str	x23, [sp, 80]
	adrp	x23, .LC1
	add	x23, x23, :lo12:.LC1
	stp	x21, x22, [sp, 64]
	mov	w21, 0
	str	d15, [sp, 88]
	bl	puts
	.align 5
.L63:
	sxtw	x22, w21
	mov	w19, 0
	.align 5
.L64:
	ldr	d0, [x20, x22, lsl 3]
	add	x0, sp, 136
	ldr	d1, [x20, w19, sxtw 3]
	bl	relations
	mov	w2, w19
	add	x3, sp, 136
	mov	w1, w21
	mov	x0, x23
	add	w19, w19, 1
	bl	printf
	cmp	w19, 10
	bne	.L64
	add	w21, w21, 1
	cmp	w21, 10
	bne	.L63
	adrp	x23, .LC2
	add	x23, x23, :lo12:.LC2
	mov	w22, 0
	.align 5
.L65:
	sxtw	x21, w22
	mov	w19, 0
	mov	w1, w22
	mov	x0, x23
	bl	printf
	.align 5
.L66:
	ldr	d0, [x20, x21, lsl 3]
	ldr	d1, [x20, w19, sxtw 3]
	add	w19, w19, 1
	bl	cmp3
	bl	putchar
	cmp	w19, 10
	bne	.L66
	mov	w0, w19
	add	w22, w22, 1
	bl	putchar
	cmp	w22, 10
	bne	.L65
	adrp	x21, .LC3
	add	x21, x21, :lo12:.LC3
	mov	x0, -9223372036854775808
	mov	w19, 0
	fmov	d15, x0
	.align 5
.L67:
	ldr	d0, [x20, w19, sxtw 3]
	fmov	d2, 1.5e+0
	fmov	d1, -1.5e+0
	mov	w1, w19
	add	w19, w19, 1
	bl	inside
	mov	w2, w0
	bl	outside
	movi	d2, #0
	fmov	d1, d15
	mov	w3, w0
	fmov	d3, d0
	bl	inside
	mov	w4, w0
	bl	outside
	fmov	d2, d0
	fmov	d1, d0
	mov	w5, w0
	bl	inside
	fmov	d2, -1.0e+0
	fmov	d1, 1.0e+0
	mov	w6, w0
	bl	both_less
	fmov	d2, d0
	fmov	d1, d0
	fneg	d0, d0
	fmov	d3, 2.0e+0
	mov	w7, w0
	bl	both_less
	str	w0, [sp]
	mov	x0, x21
	bl	printf
	cmp	w19, 10
	bne	.L67
	movi	v31.2s, 0x80, lsl 24
	mov	w0, 2143289344
	adrp	x19, .LANCHOR1
	movi	v1.2s, #0
	add	x21, sp, 160
	ldr	d30, [x19, :lo12:.LANCHOR1]
	str	s31, [sp, 104]
	str	w0, [sp, 108]
	mov	w0, 52429
	movk	w0, 0x3dcc, lsl 16
	fmov	s31, w0
	mov	w0, 1266679808
	str	s31, [sp, 112]
	str	w0, [sp, 116]
	mov	x0, 268435456
	movk	x0, 0x4170, lsl 48
	str	d30, [sp, 120]
	str	x0, [sp, 128]
	ldr	s0, [sp, 104]
	ldr	s2, [sp, 108]
	bl	either_eq
	ldr	s0, [sp, 108]
	ldr	s1, [sp, 108]
	mov	w1, w0
	ldr	s2, [sp, 108]
	bl	either_eq
	fmov	s2, s31
	ldr	s0, [sp, 112]
	mov	w2, w0
	ldr	s1, [sp, 108]
	bl	either_eq
	ldr	s31, [sp, 112]
	ldr	d30, [sp, 120]
	ldr	s29, [sp, 112]
	ldr	d28, [sp, 120]
	fcvt	d31, s31
	ldr	s27, [sp, 112]
	ldr	d26, [sp, 120]
	fcvt	d29, s29
	ldr	s25, [sp, 116]
	ldr	d24, [sp, 128]
	fcvt	d27, s27
	ldr	s23, [sp, 116]
	fcvt	d25, s25
	ldr	d22, [sp, 128]
	ldr	d21, [sp, 128]
	ldr	s20, [sp, 116]
	fcvt	d23, s23
	ldr	s19, [sp, 104]
	fcmp	d25, d24
	fcvt	s21, d21
	cset	w7, eq
	fcmpe	d27, d26
	cset	w6, mi
	fcmpe	d29, d28
	cset	w5, gt
	fcmp	d31, d30
	cset	w4, eq
	fcmp	s19, #0.0
	cset	w3, eq
	fcmp	s21, s20
	str	w3, [sp, 16]
	cset	w3, eq
	fcmpe	d23, d22
	str	w3, [sp, 8]
	cset	w3, mi
	str	w3, [sp]
	mov	w3, w0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	x1, x21
	mov	w0, 9
	.align 5
.L68:
	ldr	d31, [x20, w0, sxtw 3]
	sub	w0, w0, #1
	str	d31, [x1], 8
	cmn	w0, #1
	bne	.L68
	add	x19, x19, :lo12:.LANCHOR1
	fmov	d17, 3.0e+0
	add	x0, sp, 160
	str	xzr, [sp, 272]
	adrp	x22, .LC9
	add	x22, x22, :lo12:.LC9
	ldr	q31, [x19, 16]
	add	x19, sp, 160
	str	q31, [sp, 240]
	ldr	d31, [x20, 64]
	ldr	d18, [x20, 40]
	adrp	x20, .LC8
	add	x20, x20, :lo12:.LC8
	str	d31, [sp, 256]
	fmov	d31, -2.0e+0
	fmul	d17, d18, d17
	str	d31, [sp, 264]
	str	d17, [sp, 280]
	bl	sort__constprop__0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L71
	.align 2
.L83:
	bl	dbits
	mov	x1, x0
	mov	x0, x20
	bl	printf
	add	x19, x19, 8
	add	x0, sp, 288
	cmp	x0, x19
	beq	.L82
.L71:
	ldr	d15, [x19]
	fcmp	d15, d15
	fmov	d0, d15
	bne	.L83
	mov	x0, x22
	bl	printf
	add	x19, x19, 8
	add	x0, sp, 288
	cmp	x0, x19
	bne	.L71
.L82:
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	movi	d30, #0
	mov	x0, -4503599627370496
	mov	w3, 0
	mov	w2, 0
	mov	w1, 0
	fmov	d0, x0
	.align 5
.L72:
	ldr	d31, [x21], 8
	fcmpe	d31, d0
	fcsel	d0, d31, d0, gt
	fcmpe	d31, #0.0
	cset	w0, gt
	cinc	w1, w1, gt
	cinc	w2, w2, mi
	cmp	w0, 0
	fccmpe	d31, d30, 0, eq
	cset	w0, ls
	eor	w0, w0, 1
	add	w3, w3, w0
	add	x0, sp, 288
	cmp	x0, x21
	bne	.L72
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	ldr	x23, [sp, 80]
	mov	w0, 0
	ldr	d15, [sp, 88]
	ldp	x29, x30, [sp, 32]
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	add	sp, sp, 288
	ret
	.section .rodata
	.align	4
	.LANCHOR1:
.LC4:
	.word	-1717986918
	.word	1069128089
	.zero	8
.LC6:
	.word	0
	.word	1073741824
	.word	0
	.word	-2147483648
	.data
	.align	4
	.LANCHOR0:
vals:
	.word	0
	.word	-1048576
	.word	0
	.word	-1074266112
	.word	1
	.word	-2147483648
	.word	0
	.word	-2147483648
	.word	0
	.word	0
	.word	1
	.word	0
	.word	0
	.word	1073217536
	.word	0
	.word	2146435072
	.word	0
	.word	2146959360
	.word	0
	.word	-524288

