	.text
	.align	2
	.align 5
	.global	depth
depth:
	mov	w2, w0
	add	w3, w1, w0
	mov	w0, w1
	cbz	w2, .L1
	.align 5
.L4:
	sub	w2, w2, #1
	mov	w0, w3
	add	w3, w3, w2
	cbnz	w2, .L4
.L1:
	ret
	.align	2
	.align 5
	.global	is_even
is_even:
	cbnz	w0, .L12
	mov	w0, 1
	ret
	.align 2
.L12:
	sub	w0, w0, #1
	b	is_odd
	.align	2
	.align 5
	.global	is_odd
is_odd:
	cbnz	w0, .L15
	ret
	.align 2
.L15:
	sub	w0, w0, #1
	b	is_even
	.section .rodata
	.align	3
.LC0:
	.string	"%d\n"
	.align	3
.LC1:
	.string	"%d %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	w1, 0
	mov	w0, 1000
	mov	x29, sp
	bl	depth
	mov	w1, w0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, 200
	bl	is_even
	mov	w1, w0
	mov	w0, 201
	str	w1, [sp, 28]
	bl	is_odd
	mov	w2, w0
	ldr	w1, [sp, 28]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret

