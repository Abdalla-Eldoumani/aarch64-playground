	.text
	.align	2
	.p2align 5,,15
	.global	avg
avg:
	cmp	w1, 0
	ble	.L4
	movi	d31, #0
	add	x2, x0, w1, uxtw 3
	.p2align 5,,15
.L3:
	ldr	d30, [x0], 8
	fadd	d31, d31, d30
	cmp	x0, x2
	bne	.L3
	scvtf	d0, w1
	fdiv	d0, d31, d0
	ret
	.p2align 2,,3
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
.LC4:
	.string	"%.3f %.3f %.3f %.3f\n"
	.align	3
.LC8:
	.string	"%.4f %.4f %.4f\n"
	.align	3
.LC10:
	.string	"%.6f %.1f\n"
	.align	3
.LC12:
	.string	"%d %d %.1f %.1f\n"
	.align	3
.LC13:
	.string	"%d %d %d\n"
	.align	3
.LC14:
	.string	"%d %d\n"
	.align	3
.LC17:
	.string	"%8.2f|%-8.2f|%08.3f\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -80]!
	adrp	x1, .LANCHOR0
	add	x1, x1, :lo12:.LANCHOR0
	add	x0, sp, 40
	mov	x29, sp
	movi	d0, #0
	str	d15, [sp, 16]
	ldp	q31, q30, [x1]
	mov	x2, x0
	ldr	x1, [x1, 32]
	str	x1, [x0, 32]
	mov	x1, x0
	stp	q31, q30, [x0]
	.p2align 5,,15
.L8:
	ldr	d31, [x2], 8
	add	x3, sp, 80
	fadd	d0, d0, d31
	cmp	x2, x3
	bne	.L8
	fmov	d31, 5.0e+0
	movi	d1, #0
	fdiv	d0, d0, d31
	.p2align 5,,15
.L9:
	ldr	d31, [x0], 8
	add	x2, sp, 80
	fadd	d1, d1, d31
	cmp	x0, x2
	bne	.L9
	fmov	d31, 5.0e+0
	movi	d2, #0
	fdiv	d1, d1, d31
	.p2align 5,,15
.L10:
	ldr	d31, [x1], 8
	add	x0, sp, 80
	fadd	d2, d2, d31
	cmp	x1, x0
	bne	.L10
	fmov	d15, 5.0e+0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	fdiv	d2, d2, d15
	bl	printf
	fmov	d1, d15
	fmov	d3, 3.5e+0
	fmov	d2, 1.4e+1
	fmov	d0, 9.0e+0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	x0, 4652218415073722368
	fmov	d1, x0
	adrp	x0, .LC3
	fmov	d3, -3.0e+0
	fmov	d2, 4.5e+0
	ldr	d0, [x0, :lo12:.LC3]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	adrp	x0, .LC5
	ldr	d2, [x0, :lo12:.LC5]
	adrp	x0, .LC6
	ldr	d1, [x0, :lo12:.LC6]
	adrp	x0, .LC7
	ldr	d0, [x0, :lo12:.LC7]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	adrp	x0, .LC9
	fmov	d0, 1.5e+0
	ldr	d1, [x0, :lo12:.LC9]
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	adrp	x0, .LC11
	fmov	d0, 3.5e+0
	mov	w2, -3
	mov	w1, 3
	ldr	d1, [x0, :lo12:.LC11]
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	mov	w3, 0
	mov	w2, 1
	adrp	x0, .LC13
	mov	w1, w2
	add	x0, x0, :lo12:.LC13
	bl	printf
	fmov	d0, -1.0e+0
	bl	sqrt
	mov	w2, 1
	mov	w1, 0
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	printf
	adrp	x0, .LC15
	fmov	d2, -1.5e+0
	ldr	d1, [x0, :lo12:.LC15]
	adrp	x0, .LC16
	ldr	d0, [x0, :lo12:.LC16]
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	ldr	d15, [sp, 16]
	mov	w0, 0
	ldp	x29, x30, [sp], 80
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
.LC3:
	.word	1719614413
	.word	1073127582
.LC5:
	.word	-1145744106
	.word	1073900465
.LC6:
	.word	263521932
	.word	1071729192
.LC7:
	.word	-1895232274
	.word	1072360788
.LC9:
	.word	-1961601175
	.word	1074118410
.LC11:
	.word	-1683627180
	.word	1083394628
.LC15:
	.word	-1783957616
	.word	1074118409
.LC16:
	.word	-266631570
	.word	1074340345

