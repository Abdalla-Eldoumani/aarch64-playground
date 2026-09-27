	.text
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
.L2:
	sxtw	x20, w19
	mov	w24, 0
	mov	w21, 48
	.align 5
.L12:
	ldr	d31, [x23, x20, lsl 3]
	ldr	d30, [x23, w24, sxtw 3]
	fcmpe	d31, d30
	bmi	.L58
	strb	w21, [sp, 184]
	bls	.L59
	strb	w21, [sp, 185]
	bgt	.L57
	mov	w1, 48
	mov	w0, w1
	b	.L5
	.align 2
.L57:
	mov	w1, 49
	mov	w0, w1
.L5:
	mov	w2, 48
	strb	w1, [sp, 186]
	mov	w1, 49
.L8:
	fcmp	d31, d30
	strb	w0, [sp, 187]
	mov	w0, 0
	add	x3, sp, 184
	bfi	w0, w2, 0, 8
	mov	w2, w24
	add	w24, w24, 1
	strb	wzr, [sp, 200]
	bfi	w0, w1, 8, 8
	cset	w1, pl
	eor	w1, w1, 1
	add	w1, w1, 48
	bfi	w0, w1, 16, 8
	cset	w1, hi
	eor	w1, w1, 1
	add	w1, w1, 48
	bfi	w0, w1, 24, 8
	str	w0, [sp, 188]
	cset	w0, le
	cset	w1, vs
	eor	w0, w0, 1
	add	w0, w0, 48
	strb	w0, [sp, 192]
	cset	w0, lt
	eor	w0, w0, 1
	add	w0, w0, 48
	strb	w0, [sp, 193]
	csinc	w0, w1, wzr, ne
	fcmpe	d31, d30
	eor	w0, w0, 1
	add	w1, w1, 48
	add	w0, w0, 48
	strb	w0, [sp, 194]
	strb	w1, [sp, 195]
	fmov	x1, d31
	cset	w0, mi
	fcsel	d29, d31, d30, ge
	eor	w0, w0, 1
	fcsel	d31, d31, d30, mi
	add	w0, w0, 48
	strb	w0, [sp, 196]
	cset	w0, ge
	eor	w0, w0, 1
	add	w0, w0, 48
	strb	w0, [sp, 197]
	fmov	x0, d31
	cmp	x1, x0
	cset	w0, ne
	add	w0, w0, 97
	strb	w0, [sp, 198]
	fmov	x0, d29
	cmp	x1, x0
	mov	w1, w19
	cset	w0, ne
	add	w0, w0, 97
	strb	w0, [sp, 199]
	mov	x0, x22
	bl	printf
	cmp	w24, 10
	bne	.L12
	add	w19, w19, 1
	cmp	w19, 10
	bne	.L2
	adrp	x26, .LC2
	adrp	x20, stdout
	add	x26, x26, :lo12:.LC2
	add	x20, x20, :lo12:stdout
	mov	w22, 0
	mov	w25, 63
	mov	w24, 61
	.align 5
.L13:
	sxtw	x21, w22
	mov	w19, 0
	mov	w1, w22
	mov	x0, x26
	bl	printf
	.align 5
.L15:
	ldr	d31, [x23, x21, lsl 3]
	mov	w0, 60
	ldr	d30, [x23, w19, sxtw 3]
	fcmpe	d31, d30
	bmi	.L14
	mov	w0, 62
	bgt	.L14
	fcmp	d31, d30
	csel	w0, w25, w24, ne
.L14:
	ldr	x1, [x20]
	add	w19, w19, 1
	bl	putc
	cmp	w19, 10
	bne	.L15
	ldr	x1, [x20]
	add	w22, w22, 1
	mov	w0, w19
	bl	putc
	cmp	w22, 10
	bne	.L13
	adrp	x20, .LC3
	add	x20, x20, :lo12:.LC3
	mov	w19, 0
	fmov	d15, -1.5e+0
	fmov	d14, 1.5e+0
	fmov	d13, 2.0e+0
	.align 5
.L26:
	ldr	d29, [x23, w19, sxtw 3]
	fcmpe	d29, d15
	bge	.L16
	bmi	.L60
	mov	w6, 0
	mov	w3, 0
	mov	w4, 0
	mov	w5, 0
	mov	w2, 0
	mov	w7, 0
	mov	w0, 0
.L17:
	str	w0, [sp]
	mov	w1, w19
	mov	x0, x20
	add	w19, w19, 1
	bl	printf
	cmp	w19, 10
	bne	.L26
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
.L27:
	ldr	d31, [x23, w0, sxtw 3]
	sub	w0, w0, #1
	str	d31, [x1], 8
	cmn	w0, #1
	bne	.L27
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
.L37:
	ldp	d31, d30, [x3, -8]
	mov	x2, x3
	fcmp	d31, d31
	bne	.L89
	fcmp	d30, d30
	beq	.L56
.L87:
	add	x0, x19, w4, uxtw 3
.L30:
	add	x3, x3, 8
	str	d30, [x0]
	add	x4, x4, 1
	cmp	x22, x3
	bne	.L37
	adrp	x0, .LC7
	adrp	x24, .LC9
	add	x0, x0, :lo12:.LC7
	adrp	x23, .LC8
	add	x24, x24, :lo12:.LC9
	add	x23, x23, :lo12:.LC8
	bl	printf
	b	.L40
	.align 2
.L91:
	fmov	x1, d0
	mov	x0, x23
	add	x19, x19, 8
	bl	printf
	cmp	x22, x19
	beq	.L90
.L40:
	ldr	d0, [x19]
	fcmp	d0, d0
	bne	.L91
	mov	x0, x24
	add	x19, x19, 8
	bl	printf
	cmp	x22, x19
	bne	.L40
.L90:
	mov	w0, 10
	bl	putchar
	mov	x0, -4503599627370496
	movi	d30, #0
	mov	w3, 0
	mov	w2, 0
	mov	w1, 0
	fmov	d0, x0
	b	.L41
	.align 2
.L92:
	add	x20, x20, 8
.L41:
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
	bne	.L92
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
.L56:
	mov	x1, x3
	mov	x0, x4
	.align 5
.L32:
	fcmpe	d30, d31
	bmi	.L31
	fcmp	d30, d31
	bne	.L86
	fmov	x5, d30
	tbz	x5, #63, .L86
	fmov	x5, d31
	tbnz	x5, #63, .L86
	.align 5
.L31:
	str	d31, [x2]
	subs	x0, x0, #1
	beq	.L54
.L93:
	ldr	d31, [x1, -16]
	sub	x1, x1, #8
	mov	x2, x1
	fcmp	d31, d31
	beq	.L32
	str	d31, [x2]
	subs	x0, x0, #1
	bne	.L93
.L54:
	mov	x0, x19
	b	.L30
	.align 2
.L86:
	add	x0, x19, w0, uxtw 3
	b	.L30
.L59:
	mov	w0, 12337
	mov	w1, 48
	strh	w0, [sp, 185]
	mov	w0, 49
	mov	w2, w0
	b	.L8
	.align 2
.L58:
	mov	w0, 12593
	mov	w1, 48
	strh	w0, [sp, 184]
	mov	w0, w1
	b	.L5
	.align 2
.L16:
	fcmpe	d29, d14
	bls	.L61
	mov	w2, 0
	mov	w3, 1
.L19:
	fcmpe	d29, d13
	mov	w6, 1
	mov	w4, 0
	mov	w5, w6
	mov	w7, 0
	cset	w0, mi
	b	.L17
	.align 2
.L89:
	fcmp	d30, d30
	bne	.L87
	mov	x1, x3
	mov	x0, x4
	b	.L31
	.align 2
.L60:
	mov	w6, 1
	mov	w4, 0
	mov	w3, w6
	mov	w5, w6
	mov	w2, 0
	mov	w7, 0
	mov	w0, 0
	b	.L17
	.align 2
.L61:
	fcmpe	d29, #0.0
	bge	.L62
	fmov	d0, -1.0e+0
	fcmpe	d29, d0
	bgt	.L24
	mov	w6, 1
	mov	w3, 0
	mov	w5, w6
	mov	w2, w6
	mov	w4, 0
	mov	w7, 0
	mov	w0, 0
	b	.L17
	.align 2
.L62:
	fcmp	d29, #0.0
	mov	w4, 1
	mov	w5, 0
	bne	.L94
.L23:
	fneg	d1, d29
	mov	w6, 1
	mov	w3, 0
	mov	w2, w6
	mov	w7, w6
	fcmpe	d29, d1
	cset	w0, gt
	b	.L17
.L94:
	fmov	d28, 1.0e+0
	fcmpe	d29, d28
	bmi	.L24
	mov	w2, w4
	mov	w3, 0
	b	.L19
.L24:
	mov	w4, 0
	mov	w5, 1
	b	.L23
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

