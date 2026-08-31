	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%d"
	.align	3
.LC1:
	.string	"n=%d sum=%ld\n"
	.align	3
.LC2:
	.string	"%s"
	.align	3
.LC3:
	.string	"word=%s\n"
	.align	3
.LC4:
	.string	"%lf %lf"
	.align	3
.LC5:
	.string	"%.3f %.3f %.3f\n"
	.align	3
.LC6:
	.string	"%x"
	.align	3
.LC7:
	.string	"%u %x\n"
	.align	3
.LC8:
	.string	" %c"
	.align	3
.LC9:
	.string	"c=%c\n"
	.align	3
.LC10:
	.string	"eof=%d\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -112]!
	mov	x29, sp
	add	x0, sp, 92
	mov	x1, x0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl scanf
	cmp	w0, 1
	beq	.L2
	mov	w0, 1
	b	.L9
.L2:
	str	xzr, [sp, 104]
	str	wzr, [sp, 100]
	b	.L4
.L5:
	add	x0, sp, 24
	mov	x1, x0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl scanf
	ldr	w0, [sp, 24]
	sxtw	x0, w0
	ldr	x1, [sp, 104]
	add	x0, x1, x0
	str	x0, [sp, 104]
	ldr	w0, [sp, 100]
	add	w0, w0, 1
	str	w0, [sp, 100]
.L4:
	ldr	w0, [sp, 92]
	ldr	w1, [sp, 100]
	cmp	w1, w0
	blt	.L5
	ldr	w0, [sp, 92]
	ldr	x2, [sp, 104]
	mov	w1, w0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	add	x0, sp, 56
	mov	x1, x0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl scanf
	add	x0, sp, 56
	mov	x1, x0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	add	x1, sp, 40
	add	x0, sp, 48
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl scanf
	ldr	d30, [sp, 48]
	ldr	d31, [sp, 40]
	fadd	d29, d30, d31
	ldr	d30, [sp, 48]
	ldr	d31, [sp, 40]
	fmul	d28, d30, d31
	ldr	d30, [sp, 48]
	ldr	d31, [sp, 40]
	fdiv	d31, d30, d31
	fmov	d2, d31
	fmov	d1, d28
	fmov	d0, d29
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	add	x0, sp, 36
	mov	x1, x0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl scanf
	ldr	w0, [sp, 36]
	ldr	w1, [sp, 36]
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	add	x0, sp, 35
	mov	x1, x0
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl scanf
	ldrb	w0, [sp, 35]
	mov	w1, w0
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	add	x0, sp, 28
	mov	x1, x0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl scanf
	str	w0, [sp, 96]
	ldr	w0, [sp, 96]
	cmn	w0, #1
	beq	.L6
	ldr	w0, [sp, 96]
	cmp	w0, 0
	bne	.L7
.L6:
	mov	w0, 1
	b	.L8
.L7:
	mov	w0, 0
.L8:
	mov	w1, w0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	mov	w0, 0
.L9:
	ldp	x29, x30, [sp], 112
	ret

