	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%d "
	.align	3
.LC1:
	.string	"\n"
	.align	3
.LC2:
	.string	"%d\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	wzr, [sp, 28]
	b	.L2
.L3:
	bl	rand
	mov	w1, w0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L2:
	ldr	w0, [sp, 28]
	cmp	w0, 4
	ble	.L3
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, 42
	bl	srand
	str	wzr, [sp, 24]
	b	.L4
.L5:
	bl	rand
	mov	w1, 100
	sdiv	w2, w0, w1
	mov	w1, 100
	mul	w1, w2, w1
	sub	w0, w0, w1
	mov	w1, w0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w0, [sp, 24]
	add	w0, w0, 1
	str	w0, [sp, 24]
.L4:
	ldr	w0, [sp, 24]
	cmp	w0, 4
	ble	.L5
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, 1
	bl	srand
	bl	rand
	mov	w1, w0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret

