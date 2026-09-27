	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%d "
	.align	3
.LC1:
	.string	"%d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LC0
	add	x20, x20, :lo12:.LC0
	mov	w19, 5
	str	x21, [sp, 32]
.L2:
	bl	rand
	mov	w1, w0
	mov	x0, x20
	bl	printf
	subs	w19, w19, #1
	bne	.L2
	mov	w19, 5
	mov	w21, 100
	mov	w0, 10
	bl	putchar
	mov	w0, 42
	bl	srand
.L3:
	bl	rand
	sdiv	w1, w0, w21
	msub	w1, w1, w21, w0
	mov	x0, x20
	bl	printf
	subs	w19, w19, #1
	bne	.L3
	mov	w0, 10
	bl	putchar
	mov	w0, 1
	bl	srand
	bl	rand
	mov	w1, w0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	x21, [sp, 32]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret

