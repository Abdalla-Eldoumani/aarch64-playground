	.text
	.section .rodata
	.align	3
.LC0:
	.string	"lines=%d words=%d chars=%d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	w19, 0
	mov	w20, 0
	stp	x21, x22, [sp, 32]
	mov	w21, 0
	mov	w22, 0
.L2:
	bl	getchar
	cmn	w0, #1
	beq	.L13
.L7:
	add	w20, w20, 1
	cmp	w0, 10
	beq	.L14
	cmp	w0, 9
	beq	.L9
	cmp	w0, 32
	beq	.L9
	eor	w19, w19, 1
	sub	w1, w0, #97
	add	w21, w21, w19
	mov	w19, 1
	cmp	w1, 25
	bls	.L15
	bl	putchar
.L16:
	bl	getchar
	cmn	w0, #1
	bne	.L7
.L13:
	mov	w3, w20
	mov	w2, w21
	mov	w1, w22
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, w22
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 48
	ret
	.align 2
.L15:
	sub	w0, w0, #32
	bl	putchar
	b	.L2
	.align 2
.L14:
	add	w22, w22, 1
	mov	w19, 0
	bl	putchar
	b	.L16
.L9:
	mov	w19, 0
	bl	putchar
	b	.L16

