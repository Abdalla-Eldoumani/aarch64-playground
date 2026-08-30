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
	.global	main
main:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	wzr, [sp, 44]
	str	wzr, [sp, 40]
	mov	w0, -1
	str	w0, [sp, 36]
	b	.L2
.L4:
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
	ldr	w0, [sp, 32]
	cmp	w0, 10
	bne	.L3
	ldr	w0, [sp, 40]
	add	w0, w0, 1
	str	w0, [sp, 40]
.L3:
	ldr	w0, [sp, 32]
	str	w0, [sp, 36]
.L2:
	bl	getchar
	str	w0, [sp, 32]
	ldr	w0, [sp, 32]
	cmn	w0, #1
	bne	.L4
	ldr	w3, [sp, 36]
	ldr	w2, [sp, 40]
	ldr	w1, [sp, 44]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	bl	getchar
	str	w0, [sp, 28]
	ldr	w1, [sp, 28]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 48
	ret

