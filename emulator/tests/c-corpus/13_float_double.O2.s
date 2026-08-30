	.text
	.align	2
	.align 5
	.global	avg
avg:
	cmp	w1, 0
	ble	.L4
	movi	d31, #0
	add	x2, x0, w1, uxtw 3
	.align 5
.L3:
	ldr	d30, [x0], 8
	fadd	d31, d31, d30
	cmp	x0, x2
	bne	.L3
	scvtf	d0, w1
	fdiv	d0, d31, d0
	ret
	.align 2
.L4:
	movi	d31, #0
	scvtf	d0, w1
	fdiv	d0, d31, d0
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
.LC7:
	.string	"%d %d %.1f %.1f\n"
	.align	3
.LC8:
	.string	"%d %d %d\n"
	.align	3
.LC9:
	.string	"%d %d\n"
	.align	3
.LC12:
	.string	"%8.2f|%-8.2f|%08.3f\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -96]!
	mov	x29, sp
	add	x1, sp, 56
	str	x19, [sp, 16]
	adrp	x19, .LANCHOR0
	add	x19, x19, :lo12:.LANCHOR0
	str	d15, [sp, 24]
	ldp	q31, q30, [x19]
	ldr	x0, [x19, 32]
	stp	q31, q30, [x1]
	mov	w1, 5
	str	x0, [sp, 88]
	add	x0, sp, 56
	bl	avg
	fmov	d1, d0
	fmov	d2, d0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	fmov	d3, 3.5e+0
	fmov	d2, 1.4e+1
	fmov	d1, 5.0e+0
	fmov	d0, 9.0e+0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	fmov	d0, 2.0e+0
	bl	sqrt
	fmov	d15, d0
	fmov	d1, 1.0e+1
	fmov	d0, 2.0e+0
	bl	pow
	fmov	d1, d0
	fmov	d0, -4.5e+0
	str	d1, [sp, 40]
	bl	fabs
	fmov	d2, d0
	fmov	d0, -2.5e+0
	str	d2, [sp, 32]
	bl	floor
	ldp	d2, d1, [sp, 32]
	fmov	d3, d0
	fmov	d0, d15
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	fmov	d0, 1.0e+0
	bl	sin
	fmov	d15, d0
	fmov	d0, 1.0e+0
	bl	cos
	fmov	d1, d0
	fmov	d0, 1.0e+1
	str	d1, [sp, 32]
	bl	log
	fmov	d2, d0
	fmov	d0, d15
	ldr	d1, [sp, 32]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	fmov	d1, 3.0e+0
	fmov	d0, 1.05e+1
	bl	fmod
	fmov	d15, d0
	fmov	d0, 1.0e+0
	bl	exp
	fmov	d1, d0
	fmov	d0, d15
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	d1, [x19, 40]
	fmov	d0, 3.5e+0
	mov	w2, -3
	mov	w1, 3
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	mov	w3, 0
	mov	w2, 1
	adrp	x0, .LC8
	mov	w1, w2
	add	x0, x0, :lo12:.LC8
	bl	printf
	fmov	d0, -1.0e+0
	bl	sqrt
	fcmp	d0, d0
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	cset	w2, ne
	cset	w1, eq
	bl	printf
	ldp	d1, d0, [x19, 48]
	fmov	d2, -1.5e+0
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	ldr	x19, [sp, 16]
	mov	w0, 0
	ldr	d15, [sp, 24]
	ldp	x29, x30, [sp], 96
	ret
	.section .rodata
	.align	3
	.LANCHOR0:
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
.LC6:
	.word	-1683627180
	.word	1083394628
.LC10:
	.word	-1783957616
	.word	1074118409
.LC11:
	.word	-266631570
	.word	1074340345

