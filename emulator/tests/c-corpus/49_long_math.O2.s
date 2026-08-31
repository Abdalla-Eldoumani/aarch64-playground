	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%ld %ld %lu %lu %ld %ld\n"
	.align	3
.LC1:
	.string	"%ld %lu %ld\n"
	.align	3
.LC2:
	.string	"%d %d %ld\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	x2, 9223372036854775807
	mov	x29, sp
	str	x19, [sp, 16]
	add	w19, w0, 2
	sxtw	x0, w19
	lsl	x5, x0, 63
	sdiv	x1, x2, x0
	sub	x5, x5, x0
	udiv	x3, x2, x0
	neg	x6, x1
	msub	x4, x3, x0, x2
	msub	x2, x1, x0, x2
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w1, 52501
	adrp	x0, .LC1
	movk	w1, 0x75b, lsl 16
	add	x0, x0, :lo12:.LC1
	smull	x1, w19, w1
	mul	x1, x1, x1
	lsl	x3, x1, 3
	lsr	x2, x1, 7
	bl	printf
	mov	w2, -2147483648
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	sdiv	w1, w2, w19
	smull	x3, w19, w2
	msub	w2, w1, w19, w2
	bl	printf
	ldr	x19, [sp, 16]
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret

