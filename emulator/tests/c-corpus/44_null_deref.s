	.text
	.section .rodata
	.align	3
.LC0:
	.string	"before\n"
	.align	3
.LC1:
	.string	"%d\n"
	.align	3
.LC2:
	.string	"after\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	x1, [sp, 16]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w0, [sp, 28]
	sub	w0, w0, #1
	sxtw	x0, w0
	str	x0, [sp, 40]
	ldr	x0, [sp, 40]
	ldr	w0, [x0]
	mov	w1, w0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 48
	ret

