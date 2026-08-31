	.text
	.align	2
	.align 5
	.global	rec
rec:
	sub	sp, sp, #1040
	mov	w1, 1
	add	x0, x0, 1
	stp	x29, x30, [sp]
	mov	x29, sp
	strb	w1, [sp, 16]
	bl	rec
	ldrb	w1, [sp, 16]
	ldp	x29, x30, [sp]
	add	x0, x1, x0
	add	sp, sp, 1040
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
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -16]!
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	mov	x29, sp
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

