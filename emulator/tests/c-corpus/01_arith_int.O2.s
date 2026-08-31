	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%d %d %d %d %d\n"
	.align	3
.LC1:
	.string	"%d %d %d %d\n"
	.align	3
.LC2:
	.string	"%d %d\n"
	.align	3
.LC3:
	.string	"%u %u %u %u\n"
	.align	3
.LC4:
	.string	"%d %d %d\n"
	.align	3
.LC5:
	.string	"%d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	w5, 2
	mov	w4, -3
	mov	x29, sp
	mov	w3, -85
	mov	w2, 22
	mov	w1, 12
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	stp	x19, x20, [sp, 16]
	bl	printf
	mov	w4, -2
	mov	w3, 3
	mov	w2, -5
	mov	w1, 0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w2, 47424
	mov	w1, 58368
	adrp	x19, .LC2
	movk	w2, 0x7ffe, lsl 16
	add	x0, x19, :lo12:.LC2
	movk	w1, 0x540b, lsl 16
	bl	printf
	adrp	x20, .LC4
	mov	w3, 3413
	mov	w2, 30720
	mov	w1, 10243
	mov	w4, 1
	movk	w3, 0x4f79, lsl 16
	movk	w2, 0xcb41, lsl 16
	movk	w1, 0xee6b, lsl 16
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w3, 45696
	add	x0, x20, :lo12:.LC4
	movk	w3, 0xee6, lsl 16
	mov	w2, -3
	mov	w1, 136
	bl	printf
	mov	w3, 0
	mov	w2, 1
	add	x0, x20, :lo12:.LC4
	mov	w1, w2
	bl	printf
	mov	w1, 670
	adrp	x0, .LC5
	movk	w1, 0x5, lsl 16
	add	x0, x0, :lo12:.LC5
	bl	printf
	add	x0, x19, :lo12:.LC2
	mov	w2, -2147483648
	mov	w1, 2147483647
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret

