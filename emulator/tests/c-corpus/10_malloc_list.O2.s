	.text
	.align	2
	.align 5
	.global	push
push:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	w20, w1
	mov	x19, x0
	mov	x0, 16
	bl	malloc
	str	w20, [x0]
	str	x19, [x0, 8]
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 32
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
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	w20, 1
	mov	x19, 0
	stp	x21, x22, [sp, 32]
	str	x23, [sp, 48]
	.align 5
.L5:
	mul	w1, w20, w20
	mov	x0, x19
	add	w20, w20, 1
	bl	push
	mov	x19, x0
	cmp	w20, 9
	bne	.L5
	mov	w1, 0
	mov	w2, 0
	.align 5
.L6:
	ldr	w3, [x0]
	add	w1, w1, 1
	ldr	x0, [x0, 8]
	add	w2, w2, w3
	cbnz	x0, .L6
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	.align 5
.L7:
	mov	x0, x19
	ldr	x19, [x19, 8]
	bl	free
	cbnz	x19, .L7
	mov	x0, 16
	mov	w22, 4
	bl	malloc
	mov	x20, x0
	b	.L12
	.align 2
.L8:
	add	w0, w19, w19, lsl 1
	str	w0, [x20, x19, lsl 2]
	add	x19, x19, 1
	cmp	x19, 50
	beq	.L20
.L12:
	mov	w21, w19
	cmp	w19, w22
	bne	.L8
	lsl	w22, w22, 1
	ubfiz	x0, x22, 2, 32
	bl	malloc
	mov	x23, x0
	mov	x1, 0
	.align 5
.L9:
	ldr	w3, [x20, x1, lsl 2]
	str	w3, [x23, x1, lsl 2]
	add	x1, x1, 1
	cmp	w21, w1
	bgt	.L9
	mov	x0, x20
	bl	free
	add	w0, w19, w19, lsl 1
	mov	x20, x23
	str	w0, [x23, x19, lsl 2]
	add	x19, x19, 1
	b	.L12
	.align 2
.L20:
	mov	x1, x20
	add	x0, x20, 200
	mov	x3, 0
	.align 5
.L13:
	ldrsw	x4, [x1], 4
	add	x3, x3, x4
	cmp	x0, x1
	bne	.L13
	mov	w2, w22
	mov	w1, 50
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	x0, x20
	bl	free
	mov	x0, 0
	bl	malloc
	mov	x20, x0
	mov	x0, 1
	bl	malloc
	cmp	x0, 0
	cset	w1, ne
	mov	x19, x0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	x0, x20
	bl	free
	mov	x0, x19
	bl	free
	ldr	x23, [sp, 48]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret

