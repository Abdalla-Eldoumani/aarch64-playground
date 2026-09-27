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
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -112]!
	mov	x29, sp
	add	x1, sp, 52
	stp	x21, x22, [sp, 32]
	adrp	x21, .LC0
	add	x21, x21, :lo12:.LC0
	mov	x0, x21
	bl scanf
	mov	w1, w0
	mov	w0, 1
	cmp	w1, w0
	bne	.L1
	ldr	w1, [sp, 52]
	stp	x19, x20, [sp, 16]
	cmp	w1, 0
	ble	.L6
	add	x22, sp, 80
	mov	w19, 0
	mov	x20, 0
	.align 5
.L4:
	mov	x1, x22
	mov	x0, x21
	bl scanf
	add	w19, w19, 1
	ldrsw	x0, [sp, 80]
	ldr	w1, [sp, 52]
	add	x20, x20, x0
	cmp	w1, w19
	bgt	.L4
.L3:
	mov	x2, x20
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	x1, x22
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl scanf
	mov	x1, x22
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	add	x2, sp, 72
	add	x1, sp, 64
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl scanf
	ldp	d0, d31, [sp, 64]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	fdiv	d2, d0, d31
	fmul	d1, d0, d31
	fadd	d0, d0, d31
	bl	printf
	add	x1, sp, 56
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl scanf
	ldr	w2, [sp, 56]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	mov	w1, w2
	bl	printf
	add	x1, sp, 51
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl scanf
	ldrb	w1, [sp, 51]
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	add	x1, sp, 60
	mov	x0, x21
	bl scanf
	add	w0, w0, 1
	cmp	w0, 1
	adrp	x0, .LC10
	cset	w1, ls
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldp	x19, x20, [sp, 16]
	mov	w0, 0
.L1:
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 112
	ret
.L6:
	add	x22, sp, 80
	mov	x20, 0
	b	.L3

