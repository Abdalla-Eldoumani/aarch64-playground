	.text
	.align	2
	.p2align 5,,15
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
	.string	"%d %d\n"
	.align	3
.LC3:
	.string	"%d\n"
	.align	3
.LC4:
	.string	"%d %d %d\n"
	.text
	.align	2
	.p2align 5,,15
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
.L10:
	ldr	w1, [x19]
	tbnz	w1, #31, .L18
	mov	w2, 0
	cbz	w1, .L9
	mov	w2, 1
	cmp	w1, 9
	ble	.L9
	cmp	w1, 99
	cset	w2, gt
	add	w2, w2, 2
.L9:
	mov	x0, x20
	add	x19, x19, 4
	bl	printf
	cmp	x19, x21
	bne	.L10
	mov	w0, 10
	bl	putchar
	mov	w4, 43691
	mov	w2, 0
	mov	w1, 0
	movk	w4, 0xaaaa, lsl 16
	mov	w3, 1431655765
.L14:
	add	w1, w1, 1
	mul	w0, w1, w4
	cmp	w0, w3
	bls	.L11
.L28:
	cmp	w1, 15
	bgt	.L12
	add	w2, w2, w1
	add	w1, w1, 1
	mul	w0, w1, w4
	cmp	w0, w3
	bhi	.L28
.L11:
	cmp	w1, 20
	bne	.L14
.L12:
	adrp	x0, .LC2
	adrp	x19, .LC3
	add	x0, x0, :lo12:.LC2
	add	x19, x19, :lo12:.LC3
	bl	printf
	mov	w1, -2
	mov	x0, x19
	bl	printf
	mov	w3, 0
	mov	w1, 0
	.p2align 5,,15
.L15:
	mov	w0, 0
	.p2align 5,,15
.L16:
	cmp	w3, w0
	add	w4, w0, w3
	cset	w2, ne
	add	w0, w0, 1
	bic	w2, w2, w4
	add	w1, w1, w2
	cmp	w0, 6
	bne	.L16
	add	w3, w3, 1
	cmp	w3, 6
	bne	.L15
	mov	x0, x19
	bl	printf
	mov	x0, x19
	mov	w1, 5
	bl	printf
	mov	w3, 0
	mov	w2, 1
	mov	w1, 100
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	x21, [sp, 32]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 80
	ret
.L18:
	mov	w2, -1
	b	.L9

