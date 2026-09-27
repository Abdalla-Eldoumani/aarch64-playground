	.text
	.align	2
	.align 5
dbits:
	fmov	x0, d0
	ret
	.align	2
	.align 5
d_of:
	fmov	d0, x0
	ret
	.section .rodata
	.align	3
.LC0:
	.string	" nan:%016lx"
	.align	3
.LC1:
	.string	" %.17g"
	.text
	.align	2
	.align 5
show:
	fcmp	d0, d0
	beq	.L5
	stp	x29, x30, [sp, -16]!
	mov	x29, sp
	bl	dbits
	ldp	x29, x30, [sp], 16
	mov	x1, x0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	b	printf
	.align 2
.L5:
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	b	printf
	.align	2
	.align 5
s_even:
	frintn	s0, s0
	ret
	.align	2
	.align 5
s_nearby:
	frinti	s0, s0
	ret
	.align	2
	.align 5
s_rint:
	frintx	s0, s0
	ret
	.align	2
	.align 5
s_round:
	frinta	s0, s0
	ret
	.align	2
	.align 5
u_roundf:
	fcvtau	w0, s0
	ret
	.align	2
	.align 5
s_trunc:
	frintz	s0, s0
	ret
	.align	2
	.align 5
s_ceil:
	frintp	s0, s0
	ret
	.align	2
	.align 5
s_floor:
	frintm	s0, s0
	ret
	.align	2
	.align 5
i_floorf:
	fcvtms	w0, s0
	ret
	.align	2
	.align 5
r_even:
	frintn	d0, d0
	ret
	.align	2
	.align 5
l_even:
	fcvtns	x0, d0
	ret
	.align	2
	.align 5
r_nearby:
	frinti	d0, d0
	ret
	.align	2
	.align 5
r_trunc:
	frintz	d0, d0
	ret
	.align	2
	.align 5
r_ceil:
	frintp	d0, d0
	ret
	.align	2
	.align 5
l_floor:
	fcvtms	x0, d0
	ret
	.align	2
	.align 5
l_ceil:
	fcvtps	x0, d0
	ret
	.align	2
	.align 5
l_round:
	fcvtas	x0, d0
	ret
	.align	2
	.align 5
r_round:
	frinta	d0, d0
	ret
	.align	2
	.align 5
r_floor:
	frintm	d0, d0
	ret
	.align	2
	.align 5
r_rint:
	frintx	d0, d0
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"floor ceil trunc round rint nearbyint roundeven"
	.align	3
.LC3:
	.string	"d%02d %.17g:"
	.align	3
.LC4:
	.string	"\n"
	.align	3
.LC5:
	.string	"nan%d %016lx:"
	.align	3
.LC6:
	.string	"f%02d %.9g:"
	.align	3
.LC7:
	.string	" %.9g"
	.align	3
.LC8:
	.string	"l%02d %ld %ld %ld %ld\n"
	.align	3
.LC9:
	.string	"i%02d %d"
	.align	3
.LC10:
	.string	" %u"
	.align	3
.LC11:
	.string	"trap %.17g %.17g\n"
	.align	3
.LC12:
	.string	"sum %.17g\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -112]!
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	mov	x29, sp
	stp	x23, x24, [sp, 48]
	adrp	x24, .LANCHOR1
	add	x24, x24, :lo12:.LANCHOR1
	adrp	x23, .LC4
	add	x23, x23, :lo12:.LC4
	stp	x19, x20, [sp, 16]
	add	x20, x24, 56
	stp	x21, x22, [sp, 32]
	adrp	x22, .LANCHOR0
	mov	w21, 0
	add	x22, x22, :lo12:.LANCHOR0
	stp	x25, x26, [sp, 64]
	adrp	x25, .LC3
	add	x25, x25, :lo12:.LC3
	str	x27, [sp, 80]
	stp	d14, d15, [sp, 96]
	bl	puts
	.align 5
.L31:
	ldr	d15, [x22, w21, sxtw 3]
	mov	x19, x24
	mov	w1, w21
	mov	x0, x25
	fmov	d0, d15
	bl	printf
	.align 5
.L30:
	ldr	x0, [x19], 8
	fmov	d0, d15
	blr	x0
	bl	show
	cmp	x20, x19
	bne	.L30
	mov	x0, x23
	add	w21, w21, 1
	bl	printf
	cmp	w21, 23
	bne	.L31
	adrp	x25, .LC5
	add	x25, x25, :lo12:.LC5
	mov	w21, 0
.L33:
	ubfiz	x1, x21, 3, 1
	mov	x19, x24
	add	x1, x22, x1
	ldr	x0, [x1, 192]
	bl	d_of
	fmov	d15, d0
	ldr	x2, [x1, 192]
	mov	x0, x25
	mov	w1, w21
	bl	printf
	.align 5
.L32:
	ldr	x0, [x19], 8
	fmov	d0, d15
	blr	x0
	bl	show
	cmp	x20, x19
	bne	.L32
	mov	x0, x23
	bl	printf
	cbz	w21, .L45
	adrp	x26, .LC6
	adrp	x20, .LC7
	add	x26, x26, :lo12:.LC6
	add	x20, x20, :lo12:.LC7
	add	x27, x22, 208
	add	x21, x24, 120
	mov	w25, 0
	.align 5
.L35:
	ldr	s15, [x27, w25, sxtw 2]
	add	x19, x24, 64
	mov	w1, w25
	mov	x0, x26
	fcvt	d0, s15
	bl	printf
	.align 5
.L34:
	ldr	x0, [x19], 8
	fmov	s0, s15
	blr	x0
	fcvt	d0, s0
	mov	x0, x20
	bl	printf
	cmp	x21, x19
	bne	.L34
	mov	x0, x23
	add	w25, w25, 1
	bl	printf
	cmp	w25, 14
	bne	.L35
	adrp	x20, .LC8
	add	x20, x20, :lo12:.LC8
	mov	x0, 4886405595696988160
	mov	w19, 0
	fmov	d15, x0
	.align 5
.L38:
	ldr	d0, [x22, w19, sxtw 3]
	fabs	d31, d0
	fcmpe	d31, d15
	bmi	.L46
.L36:
	add	w19, w19, 1
	cmp	w19, 23
	bne	.L38
	adrp	x20, .LC9
	adrp	x21, .LC10
	add	x20, x20, :lo12:.LC9
	add	x21, x21, :lo12:.LC10
	mov	w0, 1317011456
	mov	w19, 0
	fmov	s14, w0
	.align 5
.L43:
	add	x0, x22, 208
	ldr	s15, [x0, w19, sxtw 2]
	fabs	s31, s15
	fcmpe	s31, s14
	bmi	.L47
.L39:
	add	w19, w19, 1
	cmp	w19, 14
	bne	.L43
	ldr	d31, [x22, 48]
	fmov	d15, 5.0e-1
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	fadd	d0, d31, d15
	bl	r_floor
	fmov	d30, d0
	fmov	d0, d31
	bl	r_round
	fmov	d1, d0
	fmov	d0, d30
	bl	printf
	movi	d30, #0
	mov	x1, 70368744177664
	movk	x1, 0x408f, lsl 48
	mov	w0, -8
	fmov	d28, x1
	.align 5
.L44:
	scvtf	d31, w0
	add	w0, w0, 1
	fadd	d31, d31, d15
	fmov	d0, d31
	bl	r_rint
	fmov	d29, d0
	fmov	d0, d31
	bl	r_round
	fmadd	d0, d29, d28, d0
	fadd	d30, d30, d0
	cmp	w0, 9
	bne	.L44
	fmov	d0, d30
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	ldr	x27, [sp, 80]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	d14, d15, [sp, 96]
	ldp	x29, x30, [sp], 112
	ret
	.align 2
.L46:
	bl	l_floor
	mov	x2, x0
	bl	l_ceil
	mov	x3, x0
	bl	l_round
	mov	x4, x0
	bl	l_even
	mov	w1, w19
	mov	x5, x0
	mov	x0, x20
	bl	printf
	b	.L36
	.align 2
.L47:
	fmov	s0, s15
	mov	w1, w19
	bl	i_floorf
	mov	w2, w0
	mov	x0, x20
	bl	printf
	fcmpe	s15, #0.0
	bge	.L48
.L41:
	mov	x0, x23
	bl	printf
	b	.L39
	.align 2
.L48:
	fmov	s0, s15
	bl	u_roundf
	mov	w1, w0
	mov	x0, x21
	bl	printf
	b	.L41
.L45:
	mov	w21, 1
	b	.L33
	.section .rodata
	.align	4
	.LANCHOR1:
dops:
	.quad	r_floor
	.quad	r_ceil
	.quad	r_trunc
	.quad	r_round
	.quad	r_rint
	.quad	r_nearby
	.quad	r_even
	.zero	8
fops:
	.quad	s_floor
	.quad	s_ceil
	.quad	s_trunc
	.quad	s_round
	.quad	s_rint
	.quad	s_nearby
	.quad	s_even
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
	.quad	9221120237041090561
	.quad	-4503599627370495
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

