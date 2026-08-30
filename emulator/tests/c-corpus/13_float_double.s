	.text
	.align	2
	.global	avg
avg:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	w1, [sp, 4]
	str	xzr, [sp, 24]
	str	wzr, [sp, 20]
	b	.L2
.L3:
	ldrsw	x0, [sp, 20]
	lsl	x0, x0, 3
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	ldr	d31, [x0]
	ldr	d30, [sp, 24]
	fadd	d31, d30, d31
	str	d31, [sp, 24]
	ldr	w0, [sp, 20]
	add	w0, w0, 1
	str	w0, [sp, 20]
.L2:
	ldr	w1, [sp, 20]
	ldr	w0, [sp, 4]
	cmp	w1, w0
	blt	.L3
	ldr	w0, [sp, 4]
	scvtf	d31, w0
	ldr	d30, [sp, 24]
	fdiv	d31, d30, d31
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"%f %.2f %.4f\n"
	.align	3
.LC2:
	.string	"%f %f %f %f\n"
	.align	3
.LC3:
	.string	"%.3f %.3f %.3f %.3f\n"
	.align	3
.LC4:
	.string	"%.4f %.4f %.4f\n"
	.align	3
.LC5:
	.string	"%.6f %.1f\n"
	.align	3
.LC6:
	.string	"%d %d %.1f %.1f\n"
	.align	3
.LC7:
	.string	"%d %d %d\n"
	.align	3
.LC8:
	.string	"%d %d\n"
	.align	3
.LC9:
	.string	"%8.2f|%-8.2f|%08.3f\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -144]!
	mov	x29, sp
	stp	d13, d14, [sp, 16]
	str	d15, [sp, 32]
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 56
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	ldr	x1, [x1, 32]
	str	q30, [x0]
	str	q31, [x0, 16]
	str	x1, [x0, 32]
	add	x0, sp, 56
	mov	w1, 5
	bl	avg
	fmov	d15, d0
	add	x0, sp, 56
	mov	w1, 5
	bl	avg
	fmov	d14, d0
	add	x0, sp, 56
	mov	w1, 5
	bl	avg
	fmov	d31, d0
	fmov	d2, d31
	fmov	d1, d14
	fmov	d0, d15
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	fmov	d31, 7.0e+0
	str	d31, [sp, 136]
	fmov	d31, 2.0e+0
	str	d31, [sp, 128]
	ldr	d30, [sp, 136]
	ldr	d31, [sp, 128]
	fadd	d29, d30, d31
	ldr	d30, [sp, 136]
	ldr	d31, [sp, 128]
	fsub	d28, d30, d31
	ldr	d30, [sp, 136]
	ldr	d31, [sp, 128]
	fmul	d27, d30, d31
	ldr	d31, [sp, 128]
	ldr	d30, [sp, 136]
	fdiv	d31, d30, d31
	fmov	d3, d31
	fmov	d2, d27
	fmov	d1, d28
	fmov	d0, d29
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	fmov	d0, 2.0e+0
	bl	sqrt
	fmov	d15, d0
	fmov	d1, 1.0e+1
	fmov	d0, 2.0e+0
	bl	pow
	fmov	d14, d0
	fmov	d0, -4.5e+0
	bl	fabs
	fmov	d13, d0
	fmov	d0, -2.5e+0
	bl	floor
	fmov	d31, d0
	fmov	d3, d31
	fmov	d2, d13
	fmov	d1, d14
	fmov	d0, d15
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	fmov	d0, 1.0e+0
	bl	sin
	fmov	d15, d0
	fmov	d0, 1.0e+0
	bl	cos
	fmov	d14, d0
	fmov	d0, 1.0e+1
	bl	log
	fmov	d31, d0
	fmov	d2, d31
	fmov	d1, d14
	fmov	d0, d15
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	fmov	d1, 3.0e+0
	fmov	d0, 1.05e+1
	bl	fmod
	fmov	d15, d0
	fmov	d0, 1.0e+0
	bl	exp
	fmov	d31, d0
	fmov	d1, d31
	fmov	d0, d15
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w0, 3
	str	w0, [sp, 124]
	mov	w0, -3
	str	w0, [sp, 120]
	fmov	d31, 7.0e+0
	str	d31, [sp, 112]
	mov	x0, 54919
	movk	x0, 0x12, lsl 16
	str	x0, [sp, 104]
	fmov	d31, 2.0e+0
	ldr	d30, [sp, 112]
	fdiv	d29, d30, d31
	ldr	d31, [sp, 104]
	scvtf	d31, d31
	mov	x0, 70368744177664
	movk	x0, 0x408f, lsl 48
	fmov	d30, x0
	fdiv	d31, d31, d30
	fmov	d1, d31
	fmov	d0, d29
	ldr	w2, [sp, 120]
	ldr	w1, [sp, 124]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	d30, [sp, 136]
	ldr	d31, [sp, 128]
	fcmpe	d30, d31
	cset	w0, gt
	and	w0, w0, 255
	ldr	d30, [sp, 136]
	fmov	d31, 7.0e+0
	fcmp	d30, d31
	cset	w1, eq
	and	w1, w1, 255
	ldr	d30, [sp, 128]
	fmov	d31, 2.0e+0
	fcmp	d30, d31
	cset	w2, ne
	and	w2, w2, 255
	mov	w3, w2
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	fmov	d0, -1.0e+0
	bl	sqrt
	str	d0, [sp, 96]
	ldr	d30, [sp, 96]
	ldr	d31, [sp, 96]
	fcmp	d30, d31
	cset	w0, eq
	and	w0, w0, 255
	ldr	d30, [sp, 96]
	ldr	d31, [sp, 96]
	fcmp	d30, d31
	cset	w1, ne
	and	w1, w1, 255
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	fmov	d2, -1.5e+0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	ldr	d1, [x0]
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	ldr	d0, [x0]
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	mov	w0, 0
	ldp	d13, d14, [sp, 16]
	ldr	d15, [sp, 32]
	ldp	x29, x30, [sp], 144
	ret
	.section .rodata
	.align	3
.LC0:
	.word	0
	.word	1073217536
	.word	0
	.word	1073872896
	.word	0
	.word	-1073217536
	.word	0
	.word	1076117504
	.word	0
	.word	1071644672
	.text
	.section .rodata
	.align	3
.LC10:
	.word	-1783957616
	.word	1074118409
	.align	3
.LC11:
	.word	-266631570
	.word	1074340345

