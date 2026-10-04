	.text
	.align	2
	.p2align 5,,15
	.global	t
t:
	adrp	x1, .LANCHOR0
	ldr	w0, [x1, :lo12:.LANCHOR0]
	add	w0, w0, 1
	str	w0, [x1, :lo12:.LANCHOR0]
	mov	w0, 1
	ret
	.align	2
	.p2align 5,,15
	.global	f
f:
	adrp	x1, .LANCHOR0
	ldr	w0, [x1, :lo12:.LANCHOR0]
	add	w0, w0, 1
	str	w0, [x1, :lo12:.LANCHOR0]
	mov	w0, 0
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%d %d %d %d calls=%d\n"
	.align	3
.LC1:
	.string	"%d %d\n"
	.align	3
.LC2:
	.string	"%d\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	adrp	x0, .LANCHOR0
	mov	w4, 0
	mov	x29, sp
	ldr	w5, [x0, :lo12:.LANCHOR0]
	mov	w3, 0
	mov	w2, 1
	add	w5, w5, 6
	mov	w1, 0
	str	w5, [x0, :lo12:.LANCHOR0]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	str	x19, [sp, 16]
	bl	printf
	adrp	x19, .LC2
	mov	w2, 1
	mov	w1, 9
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	add	x0, x19, :lo12:.LC2
	mov	w1, 3
	bl	printf
	add	x0, x19, :lo12:.LC2
	mov	w1, 1
	bl	printf
	ldr	x19, [sp, 16]
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret
	.global	calls
	.bss
	.align	2
	.LANCHOR0:
calls:
	.zero	4

