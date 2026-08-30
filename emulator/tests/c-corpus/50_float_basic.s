	.text
	.section .rodata
	.align	3
.LC1:
	.string	"%f %.2f %e %g %d %d %d\n"
	.align	3
.LC2:
	.string	"%.3f %.3f %.1f %ld\n"
	.align	3
.LC3:
	.string	"%f %f %d\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	stp	d14, d15, [sp, 16]
	str	w0, [sp, 44]
	str	x1, [sp, 32]
	ldr	w0, [sp, 44]
	scvtf	d30, w0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	ldr	d31, [x0]
	fmul	d31, d30, d31
	str	d31, [sp, 72]
	ldr	s31, [sp, 44]
	scvtf	s30, s31
	fmov	s31, 2.5e+0
	fmul	s31, s30, s31
	str	s31, [sp, 68]
	ldr	d31, [sp, 72]
	fadd	d31, d31, d31
	fcvtzs	w0, d31
	str	w0, [sp, 64]
	ldr	w0, [sp, 44]
	scvtf	d30, w0
	fmov	d31, -2.5e+0
	fmul	d31, d30, d31
	str	d31, [sp, 56]
	ldr	d31, [sp, 56]
	fcvtzs	w0, d31
	ldr	d31, [sp, 56]
	mov	x1, 3689348814741910323
	movk	x1, 0x3fe3, lsl 48
	fmov	d30, x1
	fsub	d31, d31, d30
	fcvtzs	w1, d31
	mov	w3, w1
	mov	w2, w0
	ldr	w1, [sp, 64]
	ldr	d3, [sp, 72]
	ldr	d2, [sp, 72]
	ldr	d1, [sp, 72]
	ldr	d0, [sp, 72]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 44]
	scvtf	d31, w0
	fadd	d31, d31, d31
	fmov	d0, d31
	bl	sqrt
	fmov	d15, d0
	ldr	w0, [sp, 44]
	scvtf	d30, w0
	fmov	d31, 1.0e+1
	fmul	d31, d30, d31
	fmov	d1, d31
	fmov	d0, 2.0e+0
	bl	pow
	fmov	d14, d0
	ldr	d0, [sp, 56]
	bl	floor
	fmov	d29, d0
	ldr	s30, [sp, 68]
	fmov	s31, 4.0e+0
	fmul	s31, s30, s31
	fcvtzs	x0, s31
	mov	x1, x0
	fmov	d2, d29
	fmov	d1, d14
	fmov	d0, d15
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	s31, [sp, 68]
	fcvt	d29, s31
	ldr	s31, [sp, 68]
	fcvt	d30, s31
	fmov	d31, 3.0e+0
	fdiv	d28, d30, d31
	ldr	s31, [sp, 68]
	fcvt	d31, s31
	ldr	d30, [sp, 72]
	fcmpe	d30, d31
	cset	w0, gt
	and	w0, w0, 255
	mov	w1, w0
	fmov	d1, d28
	fmov	d0, d29
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w0, 0
	ldp	d14, d15, [sp, 16]
	ldp	x29, x30, [sp], 80
	ret
	.section .rodata
	.align	3
.LC0:
	.word	-266631570
	.word	1074340345

