	.text
	.align	2
	.p2align 5,,15
s_even:
	frintn	s0, s0
	ret
	.align	2
	.p2align 5,,15
s_nearby:
	frinti	s0, s0
	ret
	.align	2
	.p2align 5,,15
s_rint:
	frintx	s0, s0
	ret
	.align	2
	.p2align 5,,15
s_round:
	frinta	s0, s0
	ret
	.align	2
	.p2align 5,,15
s_trunc:
	frintz	s0, s0
	ret
	.align	2
	.p2align 5,,15
s_ceil:
	frintp	s0, s0
	ret
	.align	2
	.p2align 5,,15
s_floor:
	frintm	s0, s0
	ret
	.align	2
	.p2align 5,,15
r_even:
	frintn	d0, d0
	ret
	.align	2
	.p2align 5,,15
r_nearby:
	frinti	d0, d0
	ret
	.align	2
	.p2align 5,,15
r_trunc:
	frintz	d0, d0
	ret
	.align	2
	.p2align 5,,15
r_ceil:
	frintp	d0, d0
	ret
	.align	2
	.p2align 5,,15
r_round:
	frinta	d0, d0
	ret
	.align	2
	.p2align 5,,15
r_floor:
	frintm	d0, d0
	ret
	.align	2
	.p2align 5,,15
r_rint:
	frintx	d0, d0
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"floor ceil trunc round rint nearbyint roundeven"
	.align	3
.LC1:
	.string	"d%02d %.17g:"
	.align	3
.LC2:
	.string	" nan:%016lx"
	.align	3
.LC3:
	.string	" %.17g"
	.align	3
.LC4:
	.string	"nan%d %016lx:"
	.align	3
.LC5:
	.string	"f%02d %.9g:"
	.align	3
.LC6:
	.string	" %.9g"
	.align	3
.LC7:
	.string	"l%02d %ld %ld %ld %ld\n"
	.align	3
.LC8:
	.string	"i%02d %d"
	.align	3
.LC9:
	.string	" %u"
	.align	3
.LC10:
	.string	"trap %.17g %.17g\n"
	.align	3
.LC11:
	.string	"sum %.17g\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -96]!
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	mov	x29, sp
	stp	x21, x22, [sp, 32]
	adrp	x22, .LANCHOR0
	add	x22, x22, :lo12:.LANCHOR0
	stp	x23, x24, [sp, 48]
	adrp	x23, .LANCHOR1
	adrp	x24, .LC2
	add	x23, x23, :lo12:.LANCHOR1
	add	x24, x24, :lo12:.LC2
	stp	x25, x26, [sp, 64]
	adrp	x26, .LC1
	adrp	x25, .LC3
	add	x26, x26, :lo12:.LC1
	add	x25, x25, :lo12:.LC3
	mov	w21, 0
	stp	x19, x20, [sp, 16]
	stp	d14, d15, [sp, 80]
	bl	puts
	.p2align 5,,15
.L20:
	ldr	d15, [x22, w21, sxtw 3]
	mov	w1, w21
	mov	x0, x26
	add	x20, x23, 56
	mov	x19, x23
	fmov	d0, d15
	bl	printf
	b	.L19
	.p2align 2,,3
.L50:
	fmov	x1, d0
	mov	x0, x24
	add	x19, x19, 8
	bl	printf
	cmp	x19, x20
	beq	.L49
.L19:
	ldr	x0, [x19]
	fmov	d0, d15
	blr	x0
	fcmp	d0, d0
	bne	.L50
	mov	x0, x25
	add	x19, x19, 8
	bl	printf
	cmp	x19, x20
	bne	.L19
.L49:
	mov	w0, 10
	add	w21, w21, 1
	bl	putchar
	cmp	w21, 23
	bne	.L20
	adrp	x26, .LC4
	adrp	x24, .LC3
	adrp	x21, .LC2
	add	x26, x26, :lo12:.LC4
	add	x24, x24, :lo12:.LC3
	add	x21, x21, :lo12:.LC2
	mov	w25, 0
.L24:
	ubfiz	x1, x25, 3, 1
	mov	x19, x23
	add	x1, x22, x1
	ldr	x0, [x1, 192]
	fmov	d15, x0
	ldr	x2, [x1, 192]
	mov	x0, x26
	mov	w1, w25
	bl	printf
	b	.L23
	.p2align 2,,3
.L52:
	fmov	x1, d0
	mov	x0, x21
	add	x19, x19, 8
	bl	printf
	cmp	x19, x20
	beq	.L51
.L23:
	ldr	x0, [x19]
	fmov	d0, d15
	blr	x0
	fcmp	d0, d0
	bne	.L52
	mov	x0, x24
	add	x19, x19, 8
	bl	printf
	cmp	x19, x20
	bne	.L23
.L51:
	mov	w0, 10
	bl	putchar
	cbz	w25, .L37
	adrp	x25, .LC5
	adrp	x20, .LC6
	add	x25, x25, :lo12:.LC5
	add	x20, x20, :lo12:.LC6
	add	x26, x22, 208
	add	x21, x23, 120
	mov	w24, 0
	.p2align 5,,15
.L26:
	ldr	s15, [x26, w24, sxtw 2]
	add	x19, x23, 64
	mov	w1, w24
	mov	x0, x25
	fcvt	d0, s15
	bl	printf
	.p2align 5,,15
.L25:
	ldr	x0, [x19], 8
	fmov	s0, s15
	blr	x0
	fcvt	d0, s0
	mov	x0, x20
	bl	printf
	cmp	x19, x21
	bne	.L25
	mov	w0, 10
	add	w24, w24, 1
	bl	putchar
	cmp	w24, 14
	bne	.L26
	adrp	x20, .LC7
	add	x20, x20, :lo12:.LC7
	mov	x0, 4886405595696988160
	mov	w19, 0
	fmov	d15, x0
	.p2align 5,,15
.L29:
	ldr	d31, [x22, w19, sxtw 3]
	fabs	d30, d31
	fcmpe	d30, d15
	bmi	.L38
.L27:
	add	w19, w19, 1
	cmp	w19, 23
	bne	.L29
	adrp	x20, .LC8
	adrp	x21, .LC9
	add	x20, x20, :lo12:.LC8
	add	x21, x21, :lo12:.LC9
	mov	w0, 1317011456
	mov	w19, 0
	fmov	s14, w0
	.p2align 5,,15
.L34:
	add	x0, x22, 208
	ldr	s15, [x0, w19, sxtw 2]
	fabs	s31, s15
	fcmpe	s31, s14
	bmi	.L39
.L30:
	add	w19, w19, 1
	cmp	w19, 14
	bne	.L34
	ldr	d1, [x22, 48]
	fmov	d15, 5.0e-1
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	fadd	d0, d1, d15
	frinta	d1, d1
	frintm	d0, d0
	bl	printf
	fmov	d30, -8.0e+0
	mov	x1, 70368744177664
	movk	x1, 0x408f, lsl 48
	movi	d0, #0
	fmov	d31, d30
	mov	w0, -8
	fmov	d29, x1
	b	.L36
	.p2align 2,,3
.L53:
	scvtf	d31, w0
	fadd	d30, d31, d15
	frinta	d30, d30
.L36:
	fadd	d31, d31, d15
	add	w0, w0, 1
	frintx	d31, d31
	fmadd	d30, d31, d29, d30
	fadd	d0, d0, d30
	cmp	w0, 9
	bne	.L53
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	ldp	d14, d15, [sp, 80]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x29, x30, [sp], 96
	ret
	.p2align 2,,3
.L38:
	fcvtns	x5, d31
	fcvtas	x4, d31
	fcvtps	x3, d31
	fcvtms	x2, d31
	mov	w1, w19
	mov	x0, x20
	bl	printf
	b	.L27
	.p2align 2,,3
.L39:
	fcvtms	w2, s15
	mov	w1, w19
	mov	x0, x20
	bl	printf
	fcmpe	s15, #0.0
	bge	.L40
.L32:
	mov	w0, 10
	bl	putchar
	b	.L30
	.p2align 2,,3
.L40:
	fcvtau	w1, s15
	mov	x0, x21
	bl	printf
	b	.L32
.L37:
	mov	w25, 1
	b	.L24
	.section .rodata
	.align	4
	.LANCHOR1:
dops:
	.xword	r_floor
	.xword	r_ceil
	.xword	r_trunc
	.xword	r_round
	.xword	r_rint
	.xword	r_nearby
	.xword	r_even
	.zero	8
fops:
	.xword	s_floor
	.xword	s_ceil
	.xword	s_trunc
	.xword	s_round
	.xword	s_rint
	.xword	s_nearby
	.xword	s_even
	.data
	.align	4
	.LANCHOR0:
dv:
	.word	0
	.word	1071644672
	.word	0
	.word	-1075838976
	.word	0
	.word	1073217536
	.word	0
	.word	-1074266112
	.word	0
	.word	1074003968
	.word	0
	.word	-1073479680
	.word	-1
	.word	1071644671
	.word	-1
	.word	-1075838977
	.word	-1
	.word	1127219199
	.word	-1
	.word	-1020264449
	.word	1
	.word	1127219200
	.word	0
	.word	1138753536
	.word	0
	.word	-2147483648
	.word	0
	.word	0
	.word	-1023872167
	.word	27618847
	.word	-1023872167
	.word	-2119864801
	.word	1
	.word	0
	.word	0
	.word	-1057086456
	.word	1717986918
	.word	1072064102
	.word	1717986918
	.word	-1075419546
	.word	-2013235812
	.word	2117592124
	.word	0
	.word	2146435072
	.word	0
	.word	-1048576
	.zero	8
nanbits:
	.xword	9221120237041090561
	.xword	-4503599627370495
fv:
	.word	1056964608
	.word	-1090519040
	.word	1075838976
	.word	-1071644672
	.word	1258291199
	.word	-889192449
	.word	1258291200
	.word	1266679807
	.word	-2147483648
	.word	1
	.word	-2147483647
	.word	1056964607
	.word	-1080033280
	.word	2139095039

