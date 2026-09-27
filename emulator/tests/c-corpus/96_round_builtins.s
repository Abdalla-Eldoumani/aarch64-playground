	.text
	.align	2
dbits:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	str	d31, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
d_of:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	str	x0, [sp, 24]
	ldr	d31, [sp, 24]
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.align	2
r_floor:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	frintm	d31, d31
	fmov	d0, d31
	add	sp, sp, 16
	ret
	.align	2
r_ceil:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	frintp	d31, d31
	fmov	d0, d31
	add	sp, sp, 16
	ret
	.align	2
r_trunc:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	frintz	d31, d31
	fmov	d0, d31
	add	sp, sp, 16
	ret
	.align	2
r_round:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	frinta	d31, d31
	fmov	d0, d31
	add	sp, sp, 16
	ret
	.align	2
r_rint:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	frintx	d31, d31
	fmov	d0, d31
	add	sp, sp, 16
	ret
	.align	2
r_nearby:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	frinti	d31, d31
	fmov	d0, d31
	add	sp, sp, 16
	ret
	.align	2
r_even:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	frintn	d31, d31
	fmov	d0, d31
	add	sp, sp, 16
	ret
	.align	2
s_floor:
	sub	sp, sp, #16
	str	s0, [sp, 12]
	ldr	s31, [sp, 12]
	frintm	s31, s31
	fmov	s0, s31
	add	sp, sp, 16
	ret
	.align	2
s_ceil:
	sub	sp, sp, #16
	str	s0, [sp, 12]
	ldr	s31, [sp, 12]
	frintp	s31, s31
	fmov	s0, s31
	add	sp, sp, 16
	ret
	.align	2
s_trunc:
	sub	sp, sp, #16
	str	s0, [sp, 12]
	ldr	s31, [sp, 12]
	frintz	s31, s31
	fmov	s0, s31
	add	sp, sp, 16
	ret
	.align	2
s_round:
	sub	sp, sp, #16
	str	s0, [sp, 12]
	ldr	s31, [sp, 12]
	frinta	s31, s31
	fmov	s0, s31
	add	sp, sp, 16
	ret
	.align	2
s_rint:
	sub	sp, sp, #16
	str	s0, [sp, 12]
	ldr	s31, [sp, 12]
	frintx	s31, s31
	fmov	s0, s31
	add	sp, sp, 16
	ret
	.align	2
s_nearby:
	sub	sp, sp, #16
	str	s0, [sp, 12]
	ldr	s31, [sp, 12]
	frinti	s31, s31
	fmov	s0, s31
	add	sp, sp, 16
	ret
	.align	2
s_even:
	sub	sp, sp, #16
	str	s0, [sp, 12]
	ldr	s31, [sp, 12]
	frintn	s31, s31
	fmov	s0, s31
	add	sp, sp, 16
	ret
	.section .rodata
	.align	3
dops:
	.quad	r_floor
	.quad	r_ceil
	.quad	r_trunc
	.quad	r_round
	.quad	r_rint
	.quad	r_nearby
	.quad	r_even
	.align	3
fops:
	.quad	s_floor
	.quad	s_ceil
	.quad	s_trunc
	.quad	s_round
	.quad	s_rint
	.quad	s_nearby
	.quad	s_even
	.text
	.align	2
l_floor:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	frintm	d31, d31
	fcvtzs	d31, d31
	fmov	x0, d31
	add	sp, sp, 16
	ret
	.align	2
l_ceil:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	frintp	d31, d31
	fcvtzs	d31, d31
	fmov	x0, d31
	add	sp, sp, 16
	ret
	.align	2
l_round:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	frinta	d31, d31
	fcvtzs	d31, d31
	fmov	x0, d31
	add	sp, sp, 16
	ret
	.align	2
l_even:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	frintn	d31, d31
	fcvtzs	d31, d31
	fmov	x0, d31
	add	sp, sp, 16
	ret
	.align	2
i_floorf:
	sub	sp, sp, #16
	str	s0, [sp, 12]
	ldr	s31, [sp, 12]
	frintm	s31, s31
	fcvtzs	s31, s31
	fmov	w0, s31
	add	sp, sp, 16
	ret
	.align	2
u_roundf:
	sub	sp, sp, #16
	str	s0, [sp, 12]
	ldr	s31, [sp, 12]
	frinta	s31, s31
	fcvtzu	s31, s31
	fmov	w0, s31
	add	sp, sp, 16
	ret
	.data
	.align	3
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
	.align	3
nanbits:
	.quad	9221120237041090561
	.quad	-4503599627370495
	.align	3
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
	.section .rodata
	.align	3
.LC0:
	.string	" nan:%016lx"
	.align	3
.LC1:
	.string	" %.17g"
	.text
	.align	2
show:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	d0, [sp, 24]
	ldr	d30, [sp, 24]
	ldr	d31, [sp, 24]
	fcmp	d30, d31
	beq	.L46
	ldr	d0, [sp, 24]
	bl	dbits
	mov	x1, x0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	b	.L48
.L46:
	ldr	d0, [sp, 24]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
.L48:
	nop
	ldp	x29, x30, [sp], 32
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
	.global	main
main:
	stp	x29, x30, [sp, -144]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	str	x21, [sp, 32]
	str	d15, [sp, 40]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	puts
	mov	w0, 23
	str	w0, [sp, 96]
	str	wzr, [sp, 140]
	b	.L50
.L53:
	adrp	x0, dv
	add	x0, x0, :lo12:dv
	ldrsw	x1, [sp, 140]
	ldr	d31, [x0, x1, lsl 3]
	str	d31, [sp, 48]
	ldr	d0, [sp, 48]
	ldr	w1, [sp, 140]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	str	wzr, [sp, 136]
	b	.L51
.L52:
	adrp	x0, dops
	add	x0, x0, :lo12:dops
	ldrsw	x1, [sp, 136]
	ldr	x0, [x0, x1, lsl 3]
	ldr	d0, [sp, 48]
	blr	x0
	fmov	d31, d0
	fmov	d0, d31
	bl	show
	ldr	w0, [sp, 136]
	add	w0, w0, 1
	str	w0, [sp, 136]
.L51:
	ldr	w0, [sp, 136]
	cmp	w0, 6
	ble	.L52
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w0, [sp, 140]
	add	w0, w0, 1
	str	w0, [sp, 140]
.L50:
	ldr	w1, [sp, 140]
	ldr	w0, [sp, 96]
	cmp	w1, w0
	blt	.L53
	str	wzr, [sp, 132]
	b	.L54
.L57:
	adrp	x0, nanbits
	add	x0, x0, :lo12:nanbits
	ldrsw	x1, [sp, 132]
	ldr	x0, [x0, x1, lsl 3]
	bl	d_of
	str	d0, [sp, 56]
	adrp	x0, nanbits
	add	x0, x0, :lo12:nanbits
	ldrsw	x1, [sp, 132]
	ldr	x0, [x0, x1, lsl 3]
	mov	x2, x0
	ldr	w1, [sp, 132]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	str	wzr, [sp, 128]
	b	.L55
.L56:
	adrp	x0, dops
	add	x0, x0, :lo12:dops
	ldrsw	x1, [sp, 128]
	ldr	x0, [x0, x1, lsl 3]
	ldr	d0, [sp, 56]
	blr	x0
	fmov	d31, d0
	fmov	d0, d31
	bl	show
	ldr	w0, [sp, 128]
	add	w0, w0, 1
	str	w0, [sp, 128]
.L55:
	ldr	w0, [sp, 128]
	cmp	w0, 6
	ble	.L56
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w0, [sp, 132]
	add	w0, w0, 1
	str	w0, [sp, 132]
.L54:
	ldr	w0, [sp, 132]
	cmp	w0, 1
	ble	.L57
	mov	w0, 14
	str	w0, [sp, 96]
	str	wzr, [sp, 124]
	b	.L58
.L61:
	adrp	x0, fv
	add	x0, x0, :lo12:fv
	ldrsw	x1, [sp, 124]
	ldr	s31, [x0, x1, lsl 2]
	str	s31, [sp, 68]
	ldr	s31, [sp, 68]
	fcvt	d31, s31
	fmov	d0, d31
	ldr	w1, [sp, 124]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	str	wzr, [sp, 120]
	b	.L59
.L60:
	adrp	x0, fops
	add	x0, x0, :lo12:fops
	ldrsw	x1, [sp, 120]
	ldr	x0, [x0, x1, lsl 3]
	ldr	s0, [sp, 68]
	blr	x0
	fmov	s31, s0
	fcvt	d31, s31
	fmov	d0, d31
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	w0, [sp, 120]
	add	w0, w0, 1
	str	w0, [sp, 120]
.L59:
	ldr	w0, [sp, 120]
	cmp	w0, 6
	ble	.L60
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w0, [sp, 124]
	add	w0, w0, 1
	str	w0, [sp, 124]
.L58:
	ldr	w1, [sp, 124]
	ldr	w0, [sp, 96]
	cmp	w1, w0
	blt	.L61
	mov	w0, 23
	str	w0, [sp, 96]
	str	wzr, [sp, 116]
	b	.L62
.L65:
	adrp	x0, dv
	add	x0, x0, :lo12:dv
	ldrsw	x1, [sp, 116]
	ldr	d31, [x0, x1, lsl 3]
	str	d31, [sp, 72]
	ldr	d31, [sp, 72]
	fabs	d31, d31
	mov	x0, 4886405595696988160
	fmov	d30, x0
	fcmpe	d31, d30
	cset	w0, mi
	and	w0, w0, 255
	eor	w0, w0, 1
	and	w0, w0, 255
	and	w0, w0, 1
	cmp	w0, 0
	bne	.L76
	ldr	d0, [sp, 72]
	bl	l_floor
	mov	x19, x0
	ldr	d0, [sp, 72]
	bl	l_ceil
	mov	x20, x0
	ldr	d0, [sp, 72]
	bl	l_round
	mov	x21, x0
	ldr	d0, [sp, 72]
	bl	l_even
	mov	x5, x0
	mov	x4, x21
	mov	x3, x20
	mov	x2, x19
	ldr	w1, [sp, 116]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	b	.L64
.L76:
	nop
.L64:
	ldr	w0, [sp, 116]
	add	w0, w0, 1
	str	w0, [sp, 116]
.L62:
	ldr	w1, [sp, 116]
	ldr	w0, [sp, 96]
	cmp	w1, w0
	blt	.L65
	mov	w0, 14
	str	w0, [sp, 96]
	str	wzr, [sp, 112]
	b	.L66
.L71:
	adrp	x0, fv
	add	x0, x0, :lo12:fv
	ldrsw	x1, [sp, 112]
	ldr	s31, [x0, x1, lsl 2]
	str	s31, [sp, 84]
	ldr	s31, [sp, 84]
	fabs	s31, s31
	mov	w0, 1317011456
	fmov	s30, w0
	fcmpe	s31, s30
	cset	w0, mi
	and	w0, w0, 255
	eor	w0, w0, 1
	and	w0, w0, 255
	and	w0, w0, 1
	cmp	w0, 0
	bne	.L77
	ldr	s0, [sp, 84]
	bl	i_floorf
	mov	w2, w0
	ldr	w1, [sp, 112]
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	ldr	s31, [sp, 84]
	fcmpe	s31, #0.0
	bge	.L75
	b	.L69
.L75:
	ldr	s0, [sp, 84]
	bl	u_roundf
	mov	w1, w0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
.L69:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	b	.L68
.L77:
	nop
.L68:
	ldr	w0, [sp, 112]
	add	w0, w0, 1
	str	w0, [sp, 112]
.L66:
	ldr	w1, [sp, 112]
	ldr	w0, [sp, 96]
	cmp	w1, w0
	blt	.L71
	adrp	x0, dv
	add	x0, x0, :lo12:dv
	ldr	d31, [x0, 48]
	str	d31, [sp, 88]
	ldr	d30, [sp, 88]
	fmov	d31, 5.0e-1
	fadd	d31, d30, d31
	fmov	d0, d31
	bl	r_floor
	fmov	d15, d0
	ldr	d0, [sp, 88]
	bl	r_round
	fmov	d31, d0
	fmov	d1, d31
	fmov	d0, d15
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	str	xzr, [sp, 104]
	mov	w0, -8
	str	w0, [sp, 100]
	b	.L72
.L73:
	ldr	w0, [sp, 100]
	scvtf	d30, w0
	fmov	d31, 5.0e-1
	fadd	d31, d30, d31
	fmov	d0, d31
	bl	r_rint
	fmov	d30, d0
	mov	x0, 70368744177664
	movk	x0, 0x408f, lsl 48
	fmov	d31, x0
	fmul	d15, d30, d31
	ldr	w0, [sp, 100]
	scvtf	d30, w0
	fmov	d31, 5.0e-1
	fadd	d31, d30, d31
	fmov	d0, d31
	bl	r_round
	fmov	d31, d0
	fadd	d31, d15, d31
	ldr	d30, [sp, 104]
	fadd	d31, d30, d31
	str	d31, [sp, 104]
	ldr	w0, [sp, 100]
	add	w0, w0, 1
	str	w0, [sp, 100]
.L72:
	ldr	w0, [sp, 100]
	cmp	w0, 8
	ble	.L73
	ldr	d0, [sp, 104]
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	mov	w0, 0
	ldr	d15, [sp, 40]
	ldp	x19, x20, [sp, 16]
	ldr	x21, [sp, 32]
	ldp	x29, x30, [sp], 144
	ret

