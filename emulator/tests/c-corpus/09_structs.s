	.text
	.align	2
	.global	mkpt
mkpt:
	sub	sp, sp, #32
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 12]
	str	w0, [sp, 24]
	ldr	w0, [sp, 8]
	str	w0, [sp, 28]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
	.global	mkbig
mkbig:
	sub	sp, sp, #48
	mov	x2, x8
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	str	x0, [sp, 16]
	ldr	x0, [sp, 8]
	lsl	x0, x0, 1
	str	x0, [sp, 24]
	ldr	x1, [sp, 8]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	str	x0, [sp, 32]
	ldr	x0, [sp, 8]
	lsl	x0, x0, 2
	str	x0, [sp, 40]
	mov	x4, x2
	add	x0, sp, 16
	ldp	x2, x3, [x0]
	ldp	x0, x1, [x0, 16]
	stp	x2, x3, [x4]
	stp	x0, x1, [x4, 16]
	add	sp, sp, 48
	ret
	.align	2
	.global	dot
dot:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	w1, [sp, 8]
	ldr	w0, [sp]
	mul	w1, w1, w0
	ldr	w2, [sp, 12]
	ldr	w0, [sp, 4]
	mul	w0, w2, w0
	add	w0, w1, w0
	add	sp, sp, 16
	ret
	.align	2
	.global	scale
scale:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	str	w1, [sp, 4]
	ldr	x0, [sp, 8]
	ldr	w1, [x0]
	ldr	w0, [sp, 4]
	mul	w1, w1, w0
	ldr	x0, [sp, 8]
	str	w1, [x0]
	ldr	x0, [sp, 8]
	ldr	w1, [x0, 4]
	ldr	w0, [sp, 4]
	mul	w1, w1, w0
	ldr	x0, [sp, 8]
	str	w1, [x0, 4]
	nop
	add	sp, sp, 16
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
	.global	main
main:
	stp	x29, x30, [sp, -160]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	mov	w1, 4
	mov	w0, 3
	bl	mkpt
	str	x0, [sp, 136]
	mov	w0, 1
	str	w0, [sp, 128]
	mov	w0, 2
	str	w0, [sp, 132]
	add	x0, sp, 128
	mov	w1, 5
	bl	scale
	ldr	w19, [sp, 136]
	ldr	w20, [sp, 140]
	ldr	w21, [sp, 128]
	ldr	w22, [sp, 132]
	ldr	x1, [sp, 128]
	ldr	x0, [sp, 136]
	bl	dot
	mov	w5, w0
	mov	w4, w22
	mov	w3, w21
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	add	x0, sp, 96
	mov	x8, x0
	mov	x0, 11
	bl	mkbig
	ldr	x0, [sp, 96]
	ldr	x1, [sp, 104]
	ldr	x2, [sp, 112]
	ldr	x3, [sp, 120]
	mov	x4, x3
	mov	x3, x2
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	str	wzr, [sp, 156]
	b	.L9
.L10:
	ldrsw	x0, [sp, 156]
	lsl	x0, x0, 3
	add	x1, sp, 64
	ldr	w2, [sp, 156]
	str	w2, [x1, x0]
	ldr	w0, [sp, 156]
	mul	w2, w0, w0
	ldrsw	x0, [sp, 156]
	lsl	x0, x0, 3
	add	x1, sp, 68
	str	w2, [x1, x0]
	ldr	w0, [sp, 156]
	add	w0, w0, 1
	str	w0, [sp, 156]
.L9:
	ldr	w0, [sp, 156]
	cmp	w0, 3
	ble	.L10
	str	wzr, [sp, 152]
	str	wzr, [sp, 148]
	b	.L11
.L12:
	ldrsw	x0, [sp, 148]
	lsl	x0, x0, 3
	add	x1, sp, 64
	ldr	w1, [x1, x0]
	ldrsw	x0, [sp, 148]
	lsl	x0, x0, 3
	add	x2, sp, 68
	ldr	w0, [x2, x0]
	add	w0, w1, w0
	ldr	w1, [sp, 152]
	add	w0, w1, w0
	str	w0, [sp, 152]
	ldr	w0, [sp, 148]
	add	w0, w0, 1
	str	w0, [sp, 148]
.L11:
	ldr	w0, [sp, 148]
	cmp	w0, 3
	ble	.L12
	ldr	w1, [sp, 152]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 122
	strb	w0, [sp, 48]
	mov	w0, -7
	strh	w0, [sp, 50]
	mov	w0, 34464
	movk	w0, 0x1, lsl 16
	str	w0, [sp, 52]
	mov	x0, -1
	str	x0, [sp, 56]
	ldrb	w0, [sp, 48]
	mov	w6, w0
	ldrsh	w0, [sp, 50]
	mov	w2, w0
	ldr	w0, [sp, 52]
	ldr	x1, [sp, 56]
	mov	w5, 16
	mov	x4, x1
	mov	w3, w0
	mov	w1, w6
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 160
	ret

