	.text
	.section .rodata
	.align	3
.LC0:
	.string	"chars=%d lines=%d last=%d\n"
	.align	3
.LC1:
	.string	"after eof=%d\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	w20, 0
	mov	w19, 0
	stp	x21, x22, [sp, 32]
	mov	w21, -1
	str	x23, [sp, 48]
	adrp	x23, stdin
	b	.L2
	.p2align 2,,3
.L4:
	cmp	w0, 10
	add	w19, w19, 1
	cinc	w20, w20, eq
	mov	w21, w0
.L2:
	ldr	x0, [x23, :lo12:stdin]
	bl	getc
	cmn	w0, #1
	bne	.L4
	mov	w3, w21
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	x0, [x23, :lo12:stdin]
	bl	getc
	mov	w1, w0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	x23, [sp, 48]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret

