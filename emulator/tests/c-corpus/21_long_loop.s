	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%u %ld\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	mov	w0, 40389
	movk	w0, 0x811c, lsl 16
	str	w0, [sp, 44]
	str	wzr, [sp, 40]
	b	.L2
.L3:
	ldr	w0, [sp, 40]
	ldr	w1, [sp, 44]
	eor	w0, w1, w0
	str	w0, [sp, 44]
	ldr	w1, [sp, 44]
	mov	w0, 403
	movk	w0, 0x100, lsl 16
	mul	w0, w1, w0
	str	w0, [sp, 44]
	ldr	w0, [sp, 40]
	add	w0, w0, 1
	str	w0, [sp, 40]
.L2:
	ldr	w1, [sp, 40]
	mov	w0, 33919
	movk	w0, 0x1e, lsl 16
	cmp	w1, w0
	ble	.L3
	str	xzr, [sp, 32]
	str	wzr, [sp, 28]
	b	.L4
.L5:
	ldr	w1, [sp, 28]
	mov	w0, 7
	sdiv	w2, w1, w0
	mov	w0, w2
	lsl	w0, w0, 3
	sub	w0, w0, w2
	sub	w0, w1, w0
	sxtw	x0, w0
	ldr	x1, [sp, 32]
	add	x0, x1, x0
	str	x0, [sp, 32]
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L4:
	ldr	w1, [sp, 28]
	mov	w0, 16959
	movk	w0, 0xf, lsl 16
	cmp	w1, w0
	ble	.L5
	ldr	x2, [sp, 32]
	ldr	w1, [sp, 44]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 48
	ret

