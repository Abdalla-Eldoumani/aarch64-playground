	.text
	.align	2
	.align 5
	.global	popcount
popcount:
	mov	w1, w0
	mov	w0, 0
	cbz	w1, .L1
	.align 5
.L3:
	and	w2, w1, 1
	lsr	w1, w1, 1
	add	w0, w2, w0
	cbnz	w1, .L3
.L1:
	ret
	.align	2
	.align 5
	.global	reverse_bits
reverse_bits:
	mov	w1, w0
	mov	w2, 32
	mov	w0, 0
	.align 5
.L8:
	and	w3, w1, 1
	subs	w2, w2, #1
	orr	w0, w3, w0, lsl 1
	lsr	w1, w1, 1
	bne	.L8
	ret
	.align	2
	.align 5
	.global	rotl
rotl:
	neg	w1, w1
	ror	w0, w0, w1
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%x %x %x %x\n"
	.align	3
.LC1:
	.string	"%d %d %d\n"
	.align	3
.LC2:
	.string	"%x %x\n"
	.align	3
.LC3:
	.string	"%x %x %x\n"
	.align	3
.LC4:
	.string	"%d %d %x\n"
	.align	3
.LC5:
	.string	"%lx %lx %lx\n"
	.align	3
.LC6:
	.string	"%d %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -16]!
	mov	w2, 63224
	mov	w1, 20592
	movk	w2, 0xf2f4, lsl 16
	movk	w1, 0x1030, lsl 16
	mov	w3, 42632
	mov	x29, sp
	mov	w4, 252645135
	movk	w3, 0xe2c4, lsl 16
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, -252645136
	bl	popcount
	mov	w4, w0
	mov	w0, 22136
	movk	w0, 0x1234, lsl 16
	bl	popcount
	mov	w5, w0
	mov	w0, 0
	bl	popcount
	mov	w3, w0
	mov	w2, w5
	mov	w1, w4
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, 22136
	movk	w0, 0x1234, lsl 16
	bl	reverse_bits
	mov	w3, w0
	mov	w0, 22136
	mov	w1, 8
	movk	w0, 0x1234, lsl 16
	bl	rotl
	mov	w2, w0
	mov	w1, w3
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w2, 41651
	mov	w1, 52992
	mov	w3, 1
	movk	w2, 0x91, lsl 16
	movk	w1, 0x468a, lsl 16
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w3, 15
	mov	w2, -64
	mov	w1, -4
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	x1, 61440
	mov	x3, 2309685248
	mov	x2, 39612
	movk	x1, 0xbcde, lsl 16
	movk	x3, 0x123, lsl 48
	movk	x2, 0x5678, lsl 16
	movk	x1, 0x789a, lsl 32
	movk	x2, 0x1234, lsl 32
	movk	x1, 0x3456, lsl 48
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w2, 1
	adrp	x0, .LC6
	mov	w1, w2
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 16
	ret

