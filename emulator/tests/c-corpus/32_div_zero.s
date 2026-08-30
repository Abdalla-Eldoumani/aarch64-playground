	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%d %d %u %u %ld %ld\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	x1, [sp, 16]
	ldr	w0, [sp, 28]
	sub	w0, w0, #1
	str	w0, [sp, 60]
	mov	w0, 42
	str	w0, [sp, 56]
	mov	w0, 42
	str	w0, [sp, 52]
	mov	x0, 42
	str	x0, [sp, 40]
	ldr	w1, [sp, 56]
	ldr	w0, [sp, 60]
	sdiv	w7, w1, w0
	ldr	w0, [sp, 56]
	ldr	w1, [sp, 60]
	sdiv	w2, w0, w1
	ldr	w1, [sp, 60]
	mul	w1, w2, w1
	sub	w8, w0, w1
	ldr	w0, [sp, 60]
	ldr	w1, [sp, 52]
	udiv	w3, w1, w0
	ldr	w1, [sp, 60]
	ldr	w0, [sp, 52]
	udiv	w2, w0, w1
	mul	w1, w2, w1
	sub	w4, w0, w1
	ldrsw	x0, [sp, 60]
	ldr	x1, [sp, 40]
	sdiv	x5, x1, x0
	ldrsw	x1, [sp, 60]
	ldr	x0, [sp, 40]
	sdiv	x2, x0, x1
	mul	x1, x2, x1
	sub	x0, x0, x1
	mov	x6, x0
	mov	w2, w8
	mov	w1, w7
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 64
	ret

