	.text
	.section .rodata
	.align	3
.LC0:
	.string	"lines=%d words=%d chars=%d\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	stp	x21, x22, [sp, 32]
	adrp	x22, stdin
	add	x22, x22, :lo12:stdin
	mov	w21, 0
	stp	x19, x20, [sp, 16]
	mov	w19, 0
	mov	w20, 0
	stp	x23, x24, [sp, 48]
	mov	w23, 0
	adrp	x24, stdout
.L2:
	ldr	x0, [x22]
	bl	getc
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
.L4:
	ldr	x1, [x24, :lo12:stdout]
	bl	putc
	ldr	x0, [x22]
	bl	getc
	cmn	w0, #1
	bne	.L7
.L13:
	mov	w3, w20
	mov	w2, w21
	mov	w1, w23
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, w23
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 64
	ret
	.p2align 2,,3
.L14:
	add	w23, w23, 1
	mov	w19, 0
	b	.L4
	.p2align 2,,3
.L15:
	ldr	x1, [x24, :lo12:stdout]
	sub	w0, w0, #32
	bl	putc
	b	.L2
.L9:
	mov	w19, 0
	b	.L4

