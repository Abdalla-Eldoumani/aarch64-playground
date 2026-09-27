	.text
	.align	2
	.align 5
	.global	mkpt
mkpt:
	uxtw	x0, w0
	orr	x0, x0, x1, lsl 32
	ret
	.align	2
	.align 5
	.global	mkbig
mkbig:
	lsl	x1, x0, 1
	stp	x0, x1, [x8]
	add	x1, x1, x0
	lsl	x0, x0, 2
	stp	x1, x0, [x8, 16]
	ret
	.align	2
	.align 5
	.global	dot
dot:
	asr	x2, x0, 32
	asr	x3, x1, 32
	mul	w2, w2, w3
	madd	w0, w0, w1, w2
	ret
	.align	2
	.align 5
	.global	scale
scale:
	ldp	w2, w3, [x0]
	mul	w2, w2, w1
	mul	w3, w3, w1
	stp	w2, w3, [x0]
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%d %d %d %d %d\n"
	.align	3
.LC1:
	.string	"%ld %ld %ld %ld\n"
	.align	3
.LC2:
	.string	"%d\n"
	.align	3
.LC3:
	.string	"%c %d %d %ld %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -48]!
	mov	w5, 55
	mov	w4, 10
	mov	x29, sp
	mov	w3, 5
	mov	w2, 4
	mov	w1, 3
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	x1, 11
	mov	x4, 44
	mov	x3, 33
	mov	x2, 22
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	x0, 4294967297
	stp	xzr, x0, [sp, 16]
	mov	x0, 2
	movk	x0, 0x4, lsl 32
	str	x0, [sp, 32]
	mov	x0, 3
	mov	w1, 0
	movk	x0, 0x9, lsl 32
	str	x0, [sp, 40]
	add	x0, sp, 16
.L7:
	ldp	w2, w3, [x0], 8
	add	w2, w2, w3
	add	w1, w1, w2
	add	x2, sp, 48
	cmp	x2, x0
	bne	.L7
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w3, 34464
	mov	w5, 16
	mov	x4, -1
	movk	w3, 0x1, lsl 16
	mov	w2, -7
	mov	w1, 122
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 48
	ret

