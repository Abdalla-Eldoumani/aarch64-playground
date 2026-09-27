	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%u %ld\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	mov	w1, 40389
	mov	w3, 403
	mov	w2, 33920
	stp	x29, x30, [sp, -16]!
	mov	w0, 0
	movk	w1, 0x811c, lsl 16
	movk	w3, 0x100, lsl 16
	movk	w2, 0x1e, lsl 16
	mov	x29, sp
	.align 5
.L2:
	eor	w1, w0, w1
	add	w0, w0, 1
	mul	w1, w1, w3
	cmp	w0, w2
	bne	.L2
	mov	w5, 16960
	mov	w3, 0
	mov	x2, 0
	mov	w6, 7
	movk	w5, 0xf, lsl 16
	.align 5
.L3:
	udiv	w4, w3, w6
	lsl	w0, w4, 3
	sub	w0, w0, w4
	sub	w0, w3, w0
	add	w3, w3, 1
	add	x2, x2, w0, sxtw
	cmp	w3, w5
	bne	.L3
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 16
	ret

