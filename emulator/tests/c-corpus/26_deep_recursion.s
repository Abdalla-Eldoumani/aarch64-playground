	.text
	.align	2
	.global	depth
depth:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	w1, [sp, 24]
	ldr	w0, [sp, 28]
	str	w0, [sp, 32]
	ldr	w0, [sp, 24]
	str	w0, [sp, 36]
	ldr	w1, [sp, 28]
	ldr	w0, [sp, 24]
	add	w0, w1, w0
	str	w0, [sp, 40]
	str	wzr, [sp, 44]
	ldr	w0, [sp, 28]
	cmp	w0, 0
	bne	.L2
	ldr	w1, [sp, 44]
	ldr	w0, [sp, 24]
	add	w0, w1, w0
	b	.L4
.L2:
	ldr	w0, [sp, 28]
	sub	w2, w0, #1
	ldr	w1, [sp, 32]
	ldr	w0, [sp, 24]
	add	w0, w1, w0
	mov	w1, w0
	mov	w0, w2
	bl	depth
.L4:
	ldp	x29, x30, [sp], 48
	ret
	.align	2
	.global	is_odd
is_odd:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	cmp	w0, 0
	beq	.L6
	ldr	w0, [sp, 28]
	sub	w0, w0, #1
	bl	is_even
	b	.L8
.L6:
	mov	w0, 0
.L8:
	ldp	x29, x30, [sp], 32
	ret
	.align	2
	.global	is_even
is_even:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	cmp	w0, 0
	beq	.L10
	ldr	w0, [sp, 28]
	sub	w0, w0, #1
	bl	is_odd
	b	.L12
.L10:
	mov	w0, 1
.L12:
	ldp	x29, x30, [sp], 32
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%d\n"
	.align	3
.LC1:
	.string	"%d %d\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x19, [sp, 16]
	mov	w1, 0
	mov	w0, 1000
	bl	depth
	mov	w1, w0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, 200
	bl	is_even
	mov	w19, w0
	mov	w0, 201
	bl	is_odd
	mov	w2, w0
	mov	w1, w19
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, 0
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret

