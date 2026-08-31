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
	.global	main
main:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	fopen
	str	x0, [sp, 40]
	ldr	x0, [sp, 40]
	cmp	x0, 0
	bne	.L2
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 1
	b	.L3
.L2:
	fmov	d0, 3.0e+0
	adrp	x0, .LC3
	add	x3, x0, :lo12:.LC3
	mov	w2, 1
	adrp	x0, .LC4
	add	x1, x0, :lo12:.LC4
	ldr	x0, [sp, 40]
	bl	fprintf
	str	w0, [sp, 36]
	ldr	x0, [sp, 40]
	bl	fclose
	str	w0, [sp, 32]
	ldr	w2, [sp, 32]
	ldr	w1, [sp, 36]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, .LC6
	add	x1, x0, :lo12:.LC6
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	fopen
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	cmp	x0, 0
	cset	w0, eq
	and	w0, w0, 255
	mov	w1, w0
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	mov	w0, 0
.L3:
	ldp	x29, x30, [sp], 48
	ret

