	.text
	.section .rodata
	.align	3
.LC0:
	.string	"c"
	.align	3
.LC1:
	.string	"d%d"
	.align	3
.LC2:
	.string	"ERR\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	w0, 97
	mov	x29, sp
	str	x19, [sp, 16]
	adrp	x19, stdout
	bl	putchar
	ldr	x1, [x19, :lo12:stdout]
	mov	w0, 98
	bl	putc
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	puts
	ldr	x0, [x19, :lo12:stdout]
	mov	w2, 1
	adrp	x1, .LC1
	add	x1, x1, :lo12:.LC1
	bl	fprintf
	adrp	x0, stderr
	mov	x2, 4
	mov	x1, 1
	ldr	x3, [x0, :lo12:stderr]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	fwrite
	mov	w0, 10
	bl	putchar
	ldr	x1, [x19, :lo12:stdout]
	mov	w0, 120
	bl	putc
	ldr	x19, [sp, 16]
	mov	w0, 3
	ldp	x29, x30, [sp], 32
	ret

