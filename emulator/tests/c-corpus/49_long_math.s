	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%ld %ld %lu %lu %ld %ld\n"
	.align	3
.LC1:
	.string	"%ld %lu %ld\n"
	.align	3
.LC2:
	.string	"%d %d %ld\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	x1, [sp, 16]
	mov	x0, 9223372036854775807
	str	x0, [sp, 72]
	ldr	w0, [sp, 28]
	add	w0, w0, 2
	sxtw	x0, w0
	str	x0, [sp, 64]
	ldr	x0, [sp, 72]
	str	x0, [sp, 56]
	ldr	x1, [sp, 72]
	ldr	x0, [sp, 64]
	sdiv	x7, x1, x0
	ldr	x0, [sp, 72]
	ldr	x1, [sp, 64]
	sdiv	x2, x0, x1
	ldr	x1, [sp, 64]
	mul	x1, x2, x1
	sub	x8, x0, x1
	ldr	x0, [sp, 64]
	ldr	x1, [sp, 56]
	udiv	x3, x1, x0
	ldr	x1, [sp, 64]
	ldr	x0, [sp, 56]
	udiv	x2, x0, x1
	mul	x1, x2, x1
	sub	x2, x0, x1
	ldr	x1, [sp, 72]
	ldr	x0, [sp, 64]
	mul	x4, x1, x0
	ldr	x0, [sp, 72]
	neg	x1, x0
	ldr	x0, [sp, 64]
	sdiv	x0, x1, x0
	mov	x6, x0
	mov	x5, x4
	mov	x4, x2
	mov	x2, x8
	mov	x1, x7
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	x1, [sp, 64]
	mov	x0, 52501
	movk	x0, 0x75b, lsl 16
	mul	x0, x1, x0
	str	x0, [sp, 48]
	ldr	x0, [sp, 48]
	mul	x0, x0, x0
	str	x0, [sp, 40]
	ldr	x0, [sp, 40]
	lsr	x1, x0, 7
	ldr	x0, [sp, 40]
	lsl	x0, x0, 3
	mov	x3, x0
	mov	x2, x1
	ldr	x1, [sp, 40]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, -2147483648
	str	w0, [sp, 36]
	ldr	x0, [sp, 64]
	mov	w1, w0
	ldr	w0, [sp, 36]
	sdiv	w4, w0, w1
	ldr	x0, [sp, 64]
	mov	w1, w0
	ldr	w0, [sp, 36]
	sdiv	w2, w0, w1
	mul	w1, w2, w1
	sub	w2, w0, w1
	ldrsw	x1, [sp, 36]
	ldr	x0, [sp, 64]
	mul	x0, x1, x0
	mov	x3, x0
	mov	w1, w4
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 80
	ret

