	.text
	.align	2
	.align 5
differ:
	fcmp	d0, d1
	cset	w0, ne
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
	.string	"best %g above %d below %d unordered %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #336
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	stp	x19, x20, [sp, 48]
	mov	w19, 0
	stp	x21, x22, [sp, 64]
	adrp	x22, .LC1
	add	x22, x22, :lo12:.LC1
	stp	x23, x24, [sp, 80]
	adrp	x23, .LANCHOR0
	add	x23, x23, :lo12:.LANCHOR0
	stp	x25, x26, [sp, 96]
	stp	d13, d14, [sp, 112]
	str	d15, [sp, 128]
	bl	puts
	.align 5
.L4:
	sxtw	x20, w19
	mov	w24, 0
	mov	w21, 48
	.align 5
.L13:
	ldr	d0, [x23, x20, lsl 3]
	ldr	d1, [x23, w24, sxtw 3]
	fcmpe	d0, d1
	bmi	.L59
	strb	w21, [sp, 184]
	bls	.L60
	strb	w21, [sp, 185]
	bgt	.L64
	mov	w0, 48
	fmov	s31, w0
	fmov	s30, w0
	b	.L7
	.align 2
.L64:
	movi	v30.2s, 0x30
	mov	w0, 49
	fmov	s31, w0
.L7:
	strb	w0, [sp, 186]
	bl	differ
	fcmp	d0, d1
	ins	v31.b[1], v30.b[0]
	add	w0, w0, 48
	strb	wzr, [sp, 200]
	ins	v31.b[2], w0
	cset	w2, pl
	eor	w2, w2, 1
	cset	w5, hi
	add	w2, w2, 48
	eor	w5, w5, 1
	add	w5, w5, 48
	cset	w4, le
	ins	v31.b[3], w2
	eor	w4, w4, 1
	add	w4, w4, 48
	cset	w3, lt
	eor	w3, w3, 1
	cset	w6, vs
	add	w3, w3, 48
	csinc	w1, w6, wzr, ne
	ins	v31.b[4], w5
	eor	w1, w1, 1
	fcmpe	d0, d1
	add	w1, w1, 48
	add	w6, w6, 48
	mov	w2, w24
	add	w24, w24, 1
	strb	w6, [sp, 195]
	ins	v31.b[5], w4
	cset	w0, mi
	eor	w0, w0, 1
	add	w0, w0, 48
	strb	w0, [sp, 196]
	ins	v31.b[6], w3
	cset	w0, ge
	eor	w0, w0, 1
	add	x3, sp, 184
	add	w0, w0, 48
	strb	w0, [sp, 197]
	ins	v31.b[7], w1
	fmov	x1, d0
	str	d31, [sp, 187]
	fcsel	d31, d0, d1, ge
	fcsel	d1, d0, d1, mi
	fmov	x0, d1
	cmp	x1, x0
	cset	w0, ne
	add	w0, w0, 97
	strb	w0, [sp, 198]
	fmov	x0, d31
	cmp	x1, x0
	mov	w1, w19
	cset	w0, ne
	add	w0, w0, 97
	strb	w0, [sp, 199]
	mov	x0, x22
	bl	printf
	cmp	w24, 10
	bne	.L13
	add	w19, w19, 1
	cmp	w19, 10
	bne	.L4
	adrp	x26, .LC2
	adrp	x20, stdout
	add	x26, x26, :lo12:.LC2
	add	x20, x20, :lo12:stdout
	mov	w22, 0
	mov	w25, 63
	mov	w24, 61
	.align 5
.L14:
	sxtw	x21, w22
	mov	w19, 0
	mov	w1, w22
	mov	x0, x26
	bl	printf
	.align 5
.L16:
	ldr	d31, [x23, x21, lsl 3]
	mov	w0, 60
	ldr	d30, [x23, w19, sxtw 3]
	fcmpe	d31, d30
	bmi	.L15
	mov	w0, 62
	bgt	.L15
	fcmp	d31, d30
	csel	w0, w25, w24, ne
.L15:
	ldr	x1, [x20]
	add	w19, w19, 1
	bl	putc
	cmp	w19, 10
	bne	.L16
	ldr	x1, [x20]
	add	w22, w22, 1
	mov	w0, w19
	bl	putc
	cmp	w22, 10
	bne	.L14
	adrp	x20, .LC3
	add	x20, x20, :lo12:.LC3
	mov	w19, 0
	fmov	d15, -1.5e+0
	fmov	d14, 1.5e+0
	fmov	d13, 2.0e+0
	.align 5
.L27:
	ldr	d29, [x23, w19, sxtw 3]
	fcmpe	d29, d15
	bge	.L17
	bmi	.L61
	mov	w6, 0
	mov	w3, 0
	mov	w4, 0
	mov	w5, 0
	mov	w2, 0
	mov	w7, 0
	mov	w0, 0
.L18:
	str	w0, [sp]
	mov	w1, w19
	mov	x0, x20
	add	w19, w19, 1
	bl	printf
	cmp	w19, 10
	bne	.L27
	movi	v31.2s, 0x80, lsl 24
	mov	w0, 2143289344
	adrp	x20, .LANCHOR1
	add	x19, sp, 208
	mov	x21, x19
	str	s31, [sp, 152]
	str	w0, [sp, 156]
	mov	w0, 52429
	movk	w0, 0x3dcc, lsl 16
	fmov	s23, w0
	ldr	d31, [x20, :lo12:.LANCHOR1]
	mov	w0, 1266679808
	str	s23, [sp, 160]
	str	w0, [sp, 164]
	mov	x0, 268435456
	movk	x0, 0x4170, lsl 48
	str	d31, [sp, 168]
	str	x0, [sp, 176]
	ldr	s25, [sp, 152]
	ldr	s18, [sp, 156]
	ldr	s24, [sp, 156]
	ldr	s16, [sp, 156]
	ldr	s17, [sp, 156]
	ldr	s22, [sp, 160]
	ldr	s15, [sp, 156]
	ldr	s29, [sp, 160]
	ldr	d14, [sp, 168]
	ldr	s28, [sp, 160]
	ldr	d13, [sp, 168]
	fcvt	d29, s29
	ldr	s27, [sp, 160]
	ldr	d7, [sp, 168]
	fcvt	d28, s28
	ldr	s26, [sp, 164]
	ldr	d6, [sp, 176]
	fcvt	d27, s27
	ldr	s31, [sp, 164]
	fcvt	d26, s26
	ldr	d21, [sp, 176]
	ldr	d30, [sp, 176]
	ldr	s20, [sp, 164]
	fcvt	d31, s31
	ldr	s19, [sp, 152]
	fcmp	d26, d6
	fcvt	s30, d30
	cset	w7, eq
	fcmpe	d27, d7
	cset	w6, mi
	fcmpe	d28, d13
	cset	w5, gt
	fcmp	d29, d14
	cset	w4, eq
	fcmp	s22, s15
	fccmp	s22, s23, 4, ne
	cset	w3, eq
	fcmp	s24, s16
	fccmp	s24, s17, 4, ne
	cset	w2, eq
	fcmp	s25, #0.0
	fccmp	s25, s18, 4, ne
	cset	w1, eq
	fcmp	s19, #0.0
	cset	w0, eq
	fcmp	s30, s20
	str	w0, [sp, 16]
	cset	w0, eq
	fcmpe	d31, d21
	str	w0, [sp, 8]
	cset	w0, mi
	str	w0, [sp]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	x1, x19
	mov	w0, 9
	.align 5
.L28:
	ldr	d31, [x23, w0, sxtw 3]
	sub	w0, w0, #1
	str	d31, [x1], 8
	cmn	w0, #1
	bne	.L28
	add	x20, x20, :lo12:.LANCHOR1
	fmov	d26, 3.0e+0
	add	x22, x19, 128
	mov	x4, 1
	str	xzr, [sp, 320]
	ldr	q31, [x20, 16]
	add	x20, x19, 8
	mov	x3, x20
	str	q31, [sp, 288]
	ldr	d31, [x23, 64]
	ldr	d27, [x23, 40]
	str	d31, [sp, 304]
	fmov	d31, -2.0e+0
	fmul	d26, d27, d26
	str	d31, [sp, 312]
	str	d26, [sp, 328]
	.align 5
.L38:
	ldp	d31, d30, [x3, -8]
	mov	x2, x3
	fcmp	d31, d31
	bne	.L90
	fcmp	d30, d30
	beq	.L57
.L89:
	add	x0, x19, w4, uxtw 3
.L31:
	add	x3, x3, 8
	str	d30, [x0]
	add	x4, x4, 1
	cmp	x3, x22
	bne	.L38
	adrp	x0, .LC7
	adrp	x24, .LC9
	add	x0, x0, :lo12:.LC7
	adrp	x23, .LC8
	add	x24, x24, :lo12:.LC9
	add	x23, x23, :lo12:.LC8
	bl	printf
	b	.L41
	.align 2
.L92:
	fmov	x1, d0
	mov	x0, x23
	add	x19, x19, 8
	bl	printf
	cmp	x22, x19
	beq	.L91
.L41:
	ldr	d0, [x19]
	fcmp	d0, d0
	bne	.L92
	mov	x0, x24
	add	x19, x19, 8
	bl	printf
	cmp	x22, x19
	bne	.L41
.L91:
	mov	w0, 10
	bl	putchar
	mov	x0, -4503599627370496
	movi	d30, #0
	mov	w3, 0
	mov	w2, 0
	mov	w1, 0
	fmov	d0, x0
	b	.L42
	.align 2
.L93:
	add	x20, x20, 8
.L42:
	ldr	d31, [x21]
	mov	x21, x20
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
	cmp	x22, x20
	bne	.L93
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldr	d15, [sp, 128]
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	ldp	x23, x24, [sp, 80]
	ldp	x25, x26, [sp, 96]
	ldp	d13, d14, [sp, 112]
	add	sp, sp, 336
	ret
	.align 2
.L57:
	mov	x1, x3
	mov	x0, x4
	.align 5
.L33:
	fcmpe	d30, d31
	bmi	.L32
	fcmp	d30, d31
	bne	.L88
	fmov	x5, d30
	tbz	x5, #63, .L88
	fmov	x5, d31
	tbnz	x5, #63, .L88
	.align 5
.L32:
	str	d31, [x2]
	subs	x0, x0, #1
	beq	.L55
.L94:
	ldr	d31, [x1, -16]
	sub	x1, x1, #8
	mov	x2, x1
	fcmp	d31, d31
	beq	.L33
	str	d31, [x2]
	subs	x0, x0, #1
	bne	.L94
.L55:
	mov	x0, x19
	b	.L31
	.align 2
.L88:
	add	x0, x19, w0, uxtw 3
	b	.L31
	.align 2
.L59:
	mov	w0, 12593
	strh	w0, [sp, 184]
	mov	w0, 48
	fmov	s31, w0
	fmov	s30, w0
	b	.L7
	.align 2
.L17:
	fcmpe	d29, d14
	bls	.L62
	mov	w2, 0
	mov	w3, 1
.L20:
	fcmpe	d29, d13
	mov	w6, 1
	mov	w4, 0
	mov	w5, w6
	mov	w7, 0
	cset	w0, mi
	b	.L18
	.align 2
.L90:
	fcmp	d30, d30
	bne	.L89
	mov	x1, x3
	mov	x0, x4
	b	.L32
	.align 2
.L61:
	mov	w6, 1
	mov	w4, 0
	mov	w3, w6
	mov	w5, w6
	mov	w2, 0
	mov	w7, 0
	mov	w0, 0
	b	.L18
	.align 2
.L62:
	fcmpe	d29, #0.0
	bge	.L63
	fmov	d0, -1.0e+0
	fcmpe	d29, d0
	bgt	.L25
	mov	w6, 1
	mov	w3, 0
	mov	w5, w6
	mov	w2, w6
	mov	w4, 0
	mov	w7, 0
	mov	w0, 0
	b	.L18
	.align 2
.L63:
	fcmp	d29, #0.0
	mov	w4, 1
	mov	w5, 0
	bne	.L95
.L24:
	fneg	d1, d29
	mov	w6, 1
	mov	w3, 0
	mov	w2, w6
	mov	w7, w6
	fcmpe	d29, d1
	cset	w0, gt
	b	.L18
.L95:
	fmov	d28, 1.0e+0
	fcmpe	d29, d28
	bmi	.L25
	mov	w2, w4
	mov	w3, 0
	b	.L20
.L25:
	mov	w4, 0
	mov	w5, 1
	b	.L24
.L60:
	movi	v31.2s, 0x31
	mov	w0, 49
	strb	w0, [sp, 185]
	mov	w0, 48
	fmov	s30, s31
	b	.L7
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

