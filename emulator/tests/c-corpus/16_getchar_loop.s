	.text
	.section .rodata
	.align	3
.LC0:
	.string	"lines=%d words=%d chars=%d\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	wzr, [sp, 44]
	str	wzr, [sp, 40]
	str	wzr, [sp, 36]
	str	wzr, [sp, 32]
	b	.L2
.L9:
	ldr	w0, [sp, 36]
	add	w0, w0, 1
	str	w0, [sp, 36]
	ldr	w0, [sp, 28]
	cmp	w0, 10
	bne	.L3
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L3:
	ldr	w0, [sp, 28]
	cmp	w0, 32
	beq	.L4
	ldr	w0, [sp, 28]
	cmp	w0, 10
	beq	.L4
	ldr	w0, [sp, 28]
	cmp	w0, 9
	bne	.L5
.L4:
	str	wzr, [sp, 32]
	b	.L6
.L5:
	ldr	w0, [sp, 32]
	cmp	w0, 0
	bne	.L6
	mov	w0, 1
	str	w0, [sp, 32]
	ldr	w0, [sp, 40]
	add	w0, w0, 1
	str	w0, [sp, 40]
.L6:
	ldr	w0, [sp, 28]
	cmp	w0, 96
	ble	.L7
	ldr	w0, [sp, 28]
	cmp	w0, 122
	bgt	.L7
	ldr	w0, [sp, 28]
	sub	w0, w0, #32
	bl	putchar
	b	.L2
.L7:
	ldr	w0, [sp, 28]
	bl	putchar
.L2:
	bl	getchar
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	cmn	w0, #1
	bne	.L9
	ldr	w3, [sp, 36]
	ldr	w2, [sp, 40]
	ldr	w1, [sp, 44]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w0, [sp, 44]
	ldp	x29, x30, [sp], 48
	ret

