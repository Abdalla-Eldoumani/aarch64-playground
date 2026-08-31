	.text
	.section .rodata
	.align	3
.LC0:
	.string	"w"
	.align	3
.LC1:
	.string	"out.txt"
	.align	3
.LC2:
	.string	"open failed\n"
	.align	3
.LC3:
	.string	"two"
	.align	3
.LC4:
	.string	"line %d %s %.2f\n"
	.align	3
.LC5:
	.string	"wrote=%d closed=%d\n"
	.align	3
.LC6:
	.string	"r"
	.align	3
.LC7:
	.string	"missing.txt"
	.align	3
.LC8:
	.string	"missing_is_null=%d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	adrp	x1, .LC0
	adrp	x0, .LC1
	mov	x29, sp
	add	x1, x1, :lo12:.LC0
	add	x0, x0, :lo12:.LC1
	bl	fopen
	cbz	x0, .L6
	fmov	d0, 3.0e+0
	adrp	x3, .LC3
	adrp	x1, .LC4
	add	x3, x3, :lo12:.LC3
	add	x1, x1, :lo12:.LC4
	mov	w2, 1
	stp	x19, x20, [sp, 16]
	mov	x19, x0
	bl	fprintf
	mov	w20, w0
	mov	x0, x19
	bl	fclose
	mov	w2, w0
	mov	w1, w20
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x1, .LC6
	adrp	x0, .LC7
	add	x1, x1, :lo12:.LC6
	add	x0, x0, :lo12:.LC7
	bl	fopen
	cmp	x0, 0
	cset	w1, eq
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldp	x19, x20, [sp, 16]
	mov	w0, 0
.L1:
	ldp	x29, x30, [sp], 32
	ret
.L6:
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 1
	b	.L1

