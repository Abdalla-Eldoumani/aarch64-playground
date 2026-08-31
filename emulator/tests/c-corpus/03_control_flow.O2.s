	.text
	.align	2
	.align 5
	.global	classify
classify:
	tbnz	w0, #31, .L3
	mov	w1, 0
	cbz	w0, .L1
	mov	w1, 1
	cmp	w0, 9
	ble	.L1
	cmp	w0, 99
	cset	w1, gt
	add	w1, w1, 2
.L1:
	mov	w0, w1
	ret
.L3:
	mov	w1, -1
	b	.L1
	.section .rodata
	.align	3
.LC1:
	.string	"%d:%d "
	.align	3
.LC2:
	.string	"\n"
	.align	3
.LC3:
	.string	"%d %d\n"
	.align	3
.LC4:
	.string	"%d\n"
	.align	3
.LC5:
	.string	"%d %d %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -80]!
	mov	w0, 4294967289
	mov	x29, sp
	str	x0, [sp, 56]
	mov	x0, 5
	movk	x0, 0x2a, lsl 32
	stp	x19, x20, [sp, 16]
	adrp	x20, .LC1
	add	x19, sp, 56
	add	x20, x20, :lo12:.LC1
	str	x21, [sp, 32]
	add	x21, sp, 76
	str	x0, [sp, 64]
	mov	w0, 500
	str	w0, [sp, 72]
.L9:
	ldr	w3, [x19], 4
	mov	w0, w3
	bl	classify
	mov	w1, w3
	mov	w2, w0
	mov	x0, x20
	bl	printf
	cmp	x19, x21
	bne	.L9
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w4, 43691
	mov	w2, 0
	mov	w1, 0
	movk	w4, 0xaaaa, lsl 16
	mov	w3, 1431655765
.L13:
	add	w1, w1, 1
	mul	w0, w1, w4
	cmp	w0, w3
	bls	.L10
.L23:
	cmp	w1, 15
	bgt	.L11
	add	w2, w2, w1
	add	w1, w1, 1
	mul	w0, w1, w4
	cmp	w0, w3
	bhi	.L23
.L10:
	cmp	w1, 20
	bne	.L13
.L11:
	adrp	x0, .LC3
	adrp	x19, .LC4
	add	x0, x0, :lo12:.LC3
	add	x19, x19, :lo12:.LC4
	bl	printf
	mov	w1, -2
	mov	x0, x19
	bl	printf
	mov	w3, 0
	mov	w1, 0
	.align 5
.L14:
	mov	w0, 0
	.align 5
.L15:
	cmp	w3, w0
	add	w4, w0, w3
	cset	w2, ne
	add	w0, w0, 1
	bic	w2, w2, w4
	add	w1, w1, w2
	cmp	w0, 6
	bne	.L15
	add	w3, w3, 1
	cmp	w3, 6
	bne	.L14
	mov	x0, x19
	bl	printf
	mov	x0, x19
	mov	w1, 5
	bl	printf
	mov	w3, 0
	mov	w2, 1
	mov	w1, 100
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	x21, [sp, 32]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 80
	ret

