	.text
	.section .rodata
	.align	3
.LC1:
	.string	"%d %d %d %d\n"
	.align	3
.LC2:
	.string	"%ld %ld %ld\n"
	.align	3
.LC3:
	.string	"%d %d %x\n"
	.align	3
.LC4:
	.string	"%ld %ld\n"
	.align	3
.LC5:
	.string	"%d %d\n"
	.align	3
.LC6:
	.string	"%ld %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -16]!
	mov	w4, 65535
	mov	w2, 255
	mov	x29, sp
	mov	w1, w2
	mov	w3, -2
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	x2, 255
	mov	x3, -2
	mov	x1, x2
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w3, 120
	mov	w2, 22136
	mov	w1, w3
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	x2, -1
	mov	x1, 4294967295
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w2, 510
	adrp	x0, .LC5
	mov	w1, w2
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w2, 10
	mov	x1, -200
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 16
	ret

