	.text
	.align	2
	.align 5
	.global	matmul
matmul:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x20, x2
	mov	x19, x1
	mov	x2, 64
	mov	w1, 0
	str	x21, [sp, 32]
	mov	x21, x0
	mov	x0, x20
	bl	memset
	add	x8, x19, 16
	mov	x7, 0
.L2:
	add	x6, x21, x7
	add	x5, x20, x7
	mov	x4, x19
.L6:
	ldr	w1, [x5]
	mov	x0, 0
.L3:
	ubfiz	x2, x0, 4, 32
	ldr	w3, [x4, x2]
	ldr	w2, [x6, x0, lsl 2]
	add	x0, x0, 1
	madd	w1, w3, w2, w1
	str	w1, [x5]
	cmp	x0, 4
	bne	.L3
	add	x4, x4, 4
	add	x5, x5, 4
	cmp	x8, x4
	bne	.L6
	add	x7, x7, 16
	cmp	x7, 64
	bne	.L2
	ldr	x21, [sp, 32]
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%d "
	.align	3
.LC1:
	.string	"\n"
	.align	3
.LC2:
	.string	"%ld\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -304]!
	mov	w2, 0
	mov	x29, sp
	add	x4, sp, 48
	add	x3, sp, 112
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
.L11:
	mov	x0, 0
.L12:
	add	w1, w2, w0
	cmp	w2, w0
	str	w1, [x4, x0, lsl 2]
	cset	w1, eq
	lsl	w1, w1, 1
	str	w1, [x3, x0, lsl 2]
	add	x0, x0, 1
	cmp	x0, 4
	bne	.L12
	add	w2, w2, 1
	add	x4, x4, 16
	add	x3, x3, 16
	cmp	w2, 4
	bne	.L11
	adrp	x21, .LC0
	adrp	x22, .LC1
	add	x20, sp, 240
	add	x21, x21, :lo12:.LC0
	add	x22, x22, :lo12:.LC1
	add	x2, sp, 176
	add	x1, sp, 112
	add	x0, sp, 48
	bl	matmul
	add	x1, sp, 176
	add	x0, sp, 240
	mov	x2, 64
	bl	memcpy
.L14:
	mov	x19, 0
.L15:
	ldr	w1, [x20, x19, lsl 2]
	mov	x0, x21
	add	x19, x19, 1
	bl	printf
	cmp	x19, 4
	bne	.L15
	mov	x0, x22
	bl	printf
	add	x20, x20, 16
	add	x0, sp, 304
	cmp	x20, x0
	bne	.L14
	ldrsw	x0, [sp, 260]
	ldrsw	x1, [sp, 240]
	add	x1, x1, x0
	ldrsw	x0, [sp, 280]
	add	x0, x0, x1
	ldrsw	x1, [sp, 300]
	add	x1, x1, x0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 304
	ret

