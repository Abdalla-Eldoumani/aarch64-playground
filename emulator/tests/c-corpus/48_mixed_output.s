	.text
	.section .rodata
	.align	3
.LC0:
	.string	"a"
	.align	3
.LC1:
	.string	"c"
	.align	3
.LC2:
	.string	"d%d"
	.align	3
.LC3:
	.string	"ERR\n"
	.align	3
.LC4:
	.string	"\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -16]!
	mov	x29, sp
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, 98
	bl	putchar
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	puts
	adrp	x0, stdout
	add	x0, x0, :lo12:stdout
	ldr	x3, [x0]
	mov	w2, 1
	adrp	x0, .LC2
	add	x1, x0, :lo12:.LC2
	mov	x0, x3
	bl	fprintf
	adrp	x0, stderr
	add	x0, x0, :lo12:stderr
	ldr	x2, [x0]
	adrp	x0, .LC3
	add	x1, x0, :lo12:.LC3
	mov	x0, x2
	bl	fprintf
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, 120
	bl	putchar
	mov	w0, 3
	ldp	x29, x30, [sp], 16
	ret

