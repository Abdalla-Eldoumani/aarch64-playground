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
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -16]!
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	mov	x29, sp
	bl	printf
	mov	w0, 98
	bl	putchar
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	puts
	adrp	x0, stdout
	mov	w2, 1
	adrp	x1, .LC2
	add	x1, x1, :lo12:.LC2
	ldr	x0, [x0, :lo12:stdout]
	bl	fprintf
	adrp	x0, stderr
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	ldr	x0, [x0, :lo12:stderr]
	bl	fprintf
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, 120
	bl	putchar
	mov	w0, 3
	ldp	x29, x30, [sp], 16
	ret

