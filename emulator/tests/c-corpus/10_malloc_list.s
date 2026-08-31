	.text
	.align	2
	.global	push
push:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	w1, [sp, 20]
	mov	x0, 16
	bl	malloc
	str	x0, [sp, 40]
	ldr	x0, [sp, 40]
	ldr	w1, [sp, 20]
	str	w1, [x0]
	ldr	x0, [sp, 40]
	ldr	x1, [sp, 24]
	str	x1, [x0, 8]
	ldr	x0, [sp, 40]
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%d %d\n"
	.align	3
.LC1:
	.string	"%d %d %ld\n"
	.align	3
.LC2:
	.string	"%d\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -128]!
	mov	x29, sp
	str	xzr, [sp, 120]
	mov	w0, 1
	str	w0, [sp, 116]
	b	.L4
.L5:
	ldr	w0, [sp, 116]
	mul	w0, w0, w0
	mov	w1, w0
	ldr	x0, [sp, 120]
	bl	push
	str	x0, [sp, 120]
	ldr	w0, [sp, 116]
	add	w0, w0, 1
	str	w0, [sp, 116]
.L4:
	ldr	w0, [sp, 116]
	cmp	w0, 8
	ble	.L5
	str	wzr, [sp, 112]
	str	wzr, [sp, 108]
	ldr	x0, [sp, 120]
	str	x0, [sp, 96]
	b	.L6
.L7:
	ldr	x0, [sp, 96]
	ldr	w0, [x0]
	ldr	w1, [sp, 112]
	add	w0, w1, w0
	str	w0, [sp, 112]
	ldr	w0, [sp, 108]
	add	w0, w0, 1
	str	w0, [sp, 108]
	ldr	x0, [sp, 96]
	ldr	x0, [x0, 8]
	str	x0, [sp, 96]
.L6:
	ldr	x0, [sp, 96]
	cmp	x0, 0
	bne	.L7
	ldr	w2, [sp, 112]
	ldr	w1, [sp, 108]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	b	.L8
.L9:
	ldr	x0, [sp, 120]
	ldr	x0, [x0, 8]
	str	x0, [sp, 24]
	ldr	x0, [sp, 120]
	bl	free
	ldr	x0, [sp, 24]
	str	x0, [sp, 120]
.L8:
	ldr	x0, [sp, 120]
	cmp	x0, 0
	bne	.L9
	mov	w0, 4
	str	w0, [sp, 92]
	str	wzr, [sp, 88]
	ldrsw	x0, [sp, 92]
	lsl	x0, x0, 2
	bl	malloc
	str	x0, [sp, 80]
	str	wzr, [sp, 76]
	b	.L10
.L14:
	ldr	w1, [sp, 88]
	ldr	w0, [sp, 92]
	cmp	w1, w0
	bne	.L11
	ldr	w0, [sp, 92]
	lsl	w0, w0, 1
	sxtw	x0, w0
	lsl	x0, x0, 2
	bl	malloc
	str	x0, [sp, 32]
	str	wzr, [sp, 72]
	b	.L12
.L13:
	ldrsw	x0, [sp, 72]
	lsl	x0, x0, 2
	ldr	x1, [sp, 80]
	add	x1, x1, x0
	ldrsw	x0, [sp, 72]
	lsl	x0, x0, 2
	ldr	x2, [sp, 32]
	add	x0, x2, x0
	ldr	w1, [x1]
	str	w1, [x0]
	ldr	w0, [sp, 72]
	add	w0, w0, 1
	str	w0, [sp, 72]
.L12:
	ldr	w1, [sp, 72]
	ldr	w0, [sp, 88]
	cmp	w1, w0
	blt	.L13
	ldr	x0, [sp, 80]
	bl	free
	ldr	x0, [sp, 32]
	str	x0, [sp, 80]
	ldr	w0, [sp, 92]
	lsl	w0, w0, 1
	str	w0, [sp, 92]
.L11:
	ldr	w0, [sp, 88]
	add	w1, w0, 1
	str	w1, [sp, 88]
	sxtw	x0, w0
	lsl	x0, x0, 2
	ldr	x1, [sp, 80]
	add	x2, x1, x0
	ldr	w1, [sp, 76]
	mov	w0, w1
	lsl	w0, w0, 1
	add	w0, w0, w1
	str	w0, [x2]
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L10:
	ldr	w0, [sp, 76]
	cmp	w0, 49
	ble	.L14
	str	xzr, [sp, 64]
	str	wzr, [sp, 60]
	b	.L15
.L16:
	ldrsw	x0, [sp, 60]
	lsl	x0, x0, 2
	ldr	x1, [sp, 80]
	add	x0, x1, x0
	ldr	w0, [x0]
	sxtw	x0, w0
	ldr	x1, [sp, 64]
	add	x0, x1, x0
	str	x0, [sp, 64]
	ldr	w0, [sp, 60]
	add	w0, w0, 1
	str	w0, [sp, 60]
.L15:
	ldr	w1, [sp, 60]
	ldr	w0, [sp, 88]
	cmp	w1, w0
	blt	.L16
	ldr	x3, [sp, 64]
	ldr	w2, [sp, 92]
	ldr	w1, [sp, 88]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	x0, [sp, 80]
	bl	free
	mov	x0, 0
	bl	malloc
	str	x0, [sp, 48]
	mov	x0, 1
	bl	malloc
	str	x0, [sp, 40]
	ldr	x0, [sp, 40]
	cmp	x0, 0
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	x0, [sp, 48]
	bl	free
	ldr	x0, [sp, 40]
	bl	free
	mov	w0, 0
	ldp	x29, x30, [sp], 128
	ret

