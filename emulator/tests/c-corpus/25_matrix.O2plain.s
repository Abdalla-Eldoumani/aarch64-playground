	.text
	.align	2
	.align 5
	.global	matmul
matmul:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x20, x0
	mov	x0, x2
	mov	x2, 64
	mov	x19, x1
	mov	w1, 0
	bl	memset
	mov	x2, x0
	add	x8, x19, 16
	mov	x0, x20
	add	x9, x2, 64
	mov	w3, 0
.L2:
	mov	x6, x19
	mov	x7, x2
.L6:
	mov	x1, 0
.L3:
	ubfiz	x4, x1, 4, 32
	ldr	w5, [x6, x4]
	ldr	w4, [x0, x1, lsl 2]
	add	x1, x1, 1
	madd	w3, w5, w4, w3
	str	w3, [x7]
	cmp	x1, 4
	bne	.L3
	add	x6, x6, 4
	cmp	x8, x6
	beq	.L4
	ldr	w3, [x7, 4]!
	b	.L6
	.align 2
.L4:
	add	x2, x2, 16
	cmp	x2, x9
	beq	.L1
	ldr	w3, [x2]
	add	x0, x0, 16
	b	.L2
	.align 2
.L1:
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%d "
	.align	3
.LC1:
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
	str	x21, [sp, 32]
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
	add	x20, sp, 240
	add	x2, sp, 176
	add	x1, sp, 112
	add	x0, sp, 48
	bl	matmul
	adrp	x21, .LC0
	ldp	x6, x7, [sp, 176]
	add	x21, x21, :lo12:.LC0
	ldp	x4, x5, [sp, 192]
	stp	x6, x7, [sp, 240]
	ldp	x2, x3, [sp, 208]
	stp	x4, x5, [x20, 16]
	ldp	x0, x1, [sp, 224]
	stp	x2, x3, [x20, 32]
	stp	x0, x1, [x20, 48]
.L14:
	mov	x19, 0
.L15:
	ldr	w1, [x20, x19, lsl 2]
	mov	x0, x21
	add	x19, x19, 1
	bl	printf
	cmp	x19, 4
	bne	.L15
	mov	w0, 10
	bl	putchar
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
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	x21, [sp, 32]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 304
	ret

