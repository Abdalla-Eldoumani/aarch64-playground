	.text
	.align	2
	.global	fsum
fsum:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	w1, [sp, 4]
	str	wzr, [sp, 28]
	str	wzr, [sp, 24]
	b	.L2
.L3:
	ldrsw	x0, [sp, 24]
	lsl	x0, x0, 2
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	ldr	s31, [x0]
	ldr	s30, [sp, 28]
	fadd	s31, s30, s31
	str	s31, [sp, 28]
	ldr	w0, [sp, 24]
	add	w0, w0, 1
	str	w0, [sp, 24]
.L2:
	ldr	w1, [sp, 24]
	ldr	w0, [sp, 4]
	cmp	w1, w0
	blt	.L3
	ldr	s31, [sp, 28]
	fmov	s0, s31
	add	sp, sp, 32
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"%f %.8f\n"
	.align	3
.LC2:
	.string	"%.10f %.10f\n"
	.align	3
.LC3:
	.string	"%.1f %.1f\n"
	.align	3
.LC4:
	.string	"%d %.1f\n"
	.align	3
.LC5:
	.string	"%.2f %.2f %.2f %.2f %d\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 24
	ldp	x2, x3, [x1]
	ldr	w1, [x1, 16]
	stp	x2, x3, [x0]
	str	w1, [x0, 16]
	add	x0, sp, 24
	mov	w1, 5
	bl	fsum
	str	s0, [sp, 76]
	ldr	s31, [sp, 76]
	fcvt	d30, s31
	ldr	s31, [sp, 76]
	fcvt	d31, s31
	fmov	d1, d31
	fmov	d0, d30
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, 43691
	movk	w0, 0x3eaa, lsl 16
	fmov	s31, w0
	str	s31, [sp, 72]
	ldr	s31, [sp, 72]
	fcvt	d31, s31
	str	d31, [sp, 64]
	ldr	s31, [sp, 72]
	fcvt	d31, s31
	ldr	d1, [sp, 64]
	fmov	d0, d31
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 1266679808
	fmov	s31, w0
	str	s31, [sp, 60]
	ldr	s30, [sp, 60]
	fmov	s31, 1.0e+0
	fadd	s31, s30, s31
	fcvt	d29, s31
	ldr	s30, [sp, 60]
	fmov	s31, 2.0e+0
	fadd	s31, s30, s31
	fcvt	d31, s31
	fmov	d1, d31
	fmov	d0, d29
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w0, 7
	str	w0, [sp, 56]
	mov	w0, 24910
	movk	w0, 0x4b3c, lsl 16
	fmov	s31, w0
	str	s31, [sp, 52]
	ldr	s31, [sp, 52]
	fcvt	d31, s31
	fmov	d0, d31
	ldr	w1, [sp, 56]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	fmov	s31, 5.5e+0
	str	s31, [sp, 48]
	fmov	s31, 2.0e+0
	str	s31, [sp, 44]
	ldr	s30, [sp, 48]
	ldr	s31, [sp, 44]
	fadd	s31, s30, s31
	fcvt	d29, s31
	ldr	s30, [sp, 48]
	ldr	s31, [sp, 44]
	fsub	s31, s30, s31
	fcvt	d28, s31
	ldr	s30, [sp, 48]
	ldr	s31, [sp, 44]
	fmul	s31, s30, s31
	fcvt	d27, s31
	ldr	s31, [sp, 44]
	ldr	s30, [sp, 48]
	fdiv	s31, s30, s31
	fcvt	d26, s31
	ldr	s30, [sp, 48]
	ldr	s31, [sp, 44]
	fcmpe	s30, s31
	cset	w0, gt
	and	w0, w0, 255
	mov	w1, w0
	fmov	d3, d26
	fmov	d2, d27
	fmov	d1, d28
	fmov	d0, d29
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 80
	ret
	.section .rodata
	.align	3
.LC0:
	.word	1036831949
	.word	1045220557
	.word	1050253722
	.word	1232348160
	.word	897988541
	.text

