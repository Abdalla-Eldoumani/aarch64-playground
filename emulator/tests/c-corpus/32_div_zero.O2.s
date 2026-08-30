	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%d %d %u %u %ld %ld\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	w0, w0, #1
	mov	x2, 42
	stp	x29, x30, [sp, -16]!
	sxtw	x6, w0
	udiv	w3, w2, w0
	mov	x29, sp
	sdiv	x5, x2, x6
	sdiv	w1, w2, w0
	msub	w4, w3, w0, w2
	msub	x6, x5, x6, x2
	msub	w2, w1, w0, w2
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 16
	ret

