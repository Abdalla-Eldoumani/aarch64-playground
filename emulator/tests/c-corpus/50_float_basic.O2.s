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
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -64]!
	adrp	x1, .LANCHOR0
	scvtf	s0, w0
	mov	x29, sp
	ldr	d3, [x1, :lo12:.LANCHOR0]
	stp	d13, d14, [sp, 32]
	scvtf	d13, w0
	fmov	d14, -2.5e+0
	fmov	s31, 2.5e+0
	stp	d11, d12, [sp, 16]
	mov	x0, 3689348814741910323
	fmul	d12, d13, d3
	fmul	d14, d13, d14
	movk	x0, 0x3fe3, lsl 48
	str	d15, [sp, 48]
	fmul	s15, s0, s31
	fmov	d31, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	fadd	d30, d12, d12
	fsub	d31, d14, d31
	fcvtzs	w2, d14
	fmov	d3, d12
	fmov	d2, d12
	fmov	d1, d12
	fmov	d0, d12
	fcvtzs	w1, d30
	fcvtzs	w3, d31
	bl	printf
	fadd	d0, d13, d13
	bl	sqrt
	fmov	d11, d0
	fmov	d1, 1.0e+1
	fmov	d0, 2.0e+0
	fmul	d1, d13, d1
	bl	pow
	fmov	d13, d0
	fmov	d0, d14
	bl	floor
	fcvtzs	x1, s15, #2
	fmov	d2, d0
	fmov	d1, d13
	fmov	d0, d11
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	fcvt	d0, s15
	fmov	d1, 3.0e+0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	fdiv	d1, d0, d1
	fcmpe	d0, d12
	cset	w1, mi
	bl	printf
	ldr	d15, [sp, 48]
	mov	w0, 0
	ldp	d11, d12, [sp, 16]
	ldp	d13, d14, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	3
	.LANCHOR0:
.LC0:
	.word	-266631570
	.word	1074340345

