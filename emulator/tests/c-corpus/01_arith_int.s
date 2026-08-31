	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%d %d %d %d %d\n"
	.align	3
.LC1:
	.string	"%d %d %d %d\n"
	.align	3
.LC2:
	.string	"%d %d\n"
	.align	3
.LC3:
	.string	"%u %u %u %u\n"
	.align	3
.LC4:
	.string	"%d %d %d\n"
	.align	3
.LC5:
	.string	"%d\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	mov	w0, 17
	str	w0, [sp, 36]
	mov	w0, -5
	str	w0, [sp, 32]
	mov	w0, 34464
	movk	w0, 0x1, lsl 16
	str	w0, [sp, 28]
	ldr	w1, [sp, 36]
	ldr	w0, [sp, 32]
	add	w6, w1, w0
	ldr	w1, [sp, 36]
	ldr	w0, [sp, 32]
	sub	w7, w1, w0
	ldr	w1, [sp, 36]
	ldr	w0, [sp, 32]
	mul	w3, w1, w0
	ldr	w1, [sp, 36]
	ldr	w0, [sp, 32]
	sdiv	w4, w1, w0
	ldr	w0, [sp, 36]
	ldr	w1, [sp, 32]
	sdiv	w2, w0, w1
	ldr	w1, [sp, 32]
	mul	w1, w2, w1
	sub	w0, w0, w1
	mov	w5, w0
	mov	w2, w7
	mov	w1, w6
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w1, [sp, 32]
	ldr	w0, [sp, 36]
	sdiv	w5, w1, w0
	ldr	w0, [sp, 32]
	ldr	w1, [sp, 36]
	sdiv	w2, w0, w1
	ldr	w1, [sp, 36]
	mul	w1, w2, w1
	sub	w6, w0, w1
	ldr	w0, [sp, 36]
	neg	w1, w0
	ldr	w0, [sp, 32]
	sdiv	w3, w1, w0
	ldr	w0, [sp, 36]
	neg	w0, w0
	ldr	w1, [sp, 32]
	sdiv	w2, w0, w1
	ldr	w1, [sp, 32]
	mul	w1, w2, w1
	sub	w0, w0, w1
	mov	w4, w0
	mov	w2, w6
	mov	w1, w5
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 28]
	mul	w3, w0, w0
	ldr	w1, [sp, 28]
	mov	w0, 21474
	mul	w0, w1, w0
	mov	w2, w0
	mov	w1, w3
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 10240
	movk	w0, 0xee6b, lsl 16
	str	w0, [sp, 24]
	mov	w0, 3
	str	w0, [sp, 20]
	ldr	w1, [sp, 24]
	ldr	w0, [sp, 20]
	add	w5, w1, w0
	ldr	w1, [sp, 24]
	ldr	w0, [sp, 20]
	mul	w6, w1, w0
	ldr	w1, [sp, 24]
	ldr	w0, [sp, 20]
	udiv	w3, w1, w0
	ldr	w0, [sp, 24]
	ldr	w1, [sp, 20]
	udiv	w2, w0, w1
	ldr	w1, [sp, 20]
	mul	w1, w2, w1
	sub	w0, w0, w1
	mov	w4, w0
	mov	w2, w6
	mov	w1, w5
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w0, [sp, 36]
	lsl	w1, w0, 3
	ldr	w0, [sp, 32]
	asr	w2, w0, 1
	ldr	w0, [sp, 24]
	lsr	w0, w0, 4
	mov	w3, w0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w1, [sp, 36]
	ldr	w0, [sp, 32]
	cmp	w1, w0
	cset	w0, gt
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 36]
	cmp	w0, 17
	cset	w0, eq
	and	w0, w0, 255
	mov	w2, w0
	ldr	w0, [sp, 32]
	cmn	w0, #5
	cset	w0, ne
	and	w0, w0, 255
	mov	w3, w0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	str	wzr, [sp, 44]
	str	wzr, [sp, 40]
	b	.L2
.L3:
	ldr	w0, [sp, 40]
	mul	w0, w0, w0
	ldr	w1, [sp, 44]
	add	w0, w1, w0
	str	w0, [sp, 44]
	ldr	w0, [sp, 40]
	add	w0, w0, 1
	str	w0, [sp, 40]
.L2:
	ldr	w0, [sp, 40]
	cmp	w0, 99
	ble	.L3
	ldr	w1, [sp, 44]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w2, -2147483648
	mov	w1, 2147483647
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 48
	ret

