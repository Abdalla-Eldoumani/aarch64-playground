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
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x19, [sp, 16]
	sub	w19, w0, #1
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	sxtw	x19, w19
	bl	printf
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	ldr	w1, [x19]
	bl	printf
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	x19, [sp, 16]
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret

