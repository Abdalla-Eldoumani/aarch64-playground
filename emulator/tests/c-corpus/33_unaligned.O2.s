	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%08x %016lx %04x\n"
	.align	3
.LC1:
	.string	"%02x %02x %02x %02x %02x\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -48]!
	mov	x5, 1
	add	x1, sp, 32
	mov	x29, sp
	.align 5
.L2:
	add	x0, x1, x5
	strb	w5, [x0, -1]
	add	x5, x5, 1
	cmp	x5, 17
	bne	.L2
	ldr	x2, [sp, 35]
	adrp	x0, .LC0
	ldrh	w3, [sp, 37]
	add	x0, x0, :lo12:.LC0
	ldr	w1, [sp, 33]
	str	x5, [sp, 24]
	bl	printf
	ldr	x5, [sp, 24]
	mov	w4, 34
	ldrb	w1, [sp, 32]
	mov	w3, 51
	mov	w2, 68
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 48
	ret

