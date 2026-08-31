	.text
	.align	2
	.global	rec
rec:
	sub	sp, sp, #1056
	stp	x29, x30, [sp]
	mov	x29, sp
	str	x0, [sp, 24]
	mov	w0, 1
	strb	w0, [sp, 32]
	ldr	x0, [sp, 24]
	add	x0, x0, 1
	bl	rec
	mov	x1, x0
	ldrb	w0, [sp, 32]
	and	x0, x0, 255
	add	x0, x1, x0
	ldp	x29, x30, [sp]
	add	sp, sp, 1056
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"start\n"
	.align	3
.LC1:
	.string	"%ld\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -16]!
	mov	x29, sp
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	x0, 0
	bl	rec
	mov	x1, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 16
	ret

