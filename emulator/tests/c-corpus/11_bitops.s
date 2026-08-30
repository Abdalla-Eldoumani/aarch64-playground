	.text
	.align	2
	.global	popcount
popcount:
	sub	sp, sp, #32
	str	w0, [sp, 12]
	str	wzr, [sp, 28]
	b	.L2
.L3:
	ldr	w0, [sp, 12]
	and	w1, w0, 1
	ldr	w0, [sp, 28]
	add	w0, w1, w0
	str	w0, [sp, 28]
	ldr	w0, [sp, 12]
	lsr	w0, w0, 1
	str	w0, [sp, 12]
.L2:
	ldr	w0, [sp, 12]
	cmp	w0, 0
	bne	.L3
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
	.global	reverse_bits
reverse_bits:
	sub	sp, sp, #32
	str	w0, [sp, 12]
	str	wzr, [sp, 28]
	str	wzr, [sp, 24]
	b	.L6
.L7:
	ldr	w0, [sp, 28]
	lsl	w1, w0, 1
	ldr	w0, [sp, 12]
	and	w0, w0, 1
	orr	w0, w1, w0
	str	w0, [sp, 28]
	ldr	w0, [sp, 12]
	lsr	w0, w0, 1
	str	w0, [sp, 12]
	ldr	w0, [sp, 24]
	add	w0, w0, 1
	str	w0, [sp, 24]
.L6:
	ldr	w0, [sp, 24]
	cmp	w0, 31
	ble	.L7
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
	.global	rotl
rotl:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 8]
	ldr	w1, [sp, 12]
	neg	w0, w0
	ror	w0, w1, w0
	add	sp, sp, 16
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
	.global	main
main:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	w0, -252645136
	str	w0, [sp, 60]
	mov	w0, 22136
	movk	w0, 0x1234, lsl 16
	str	w0, [sp, 56]
	ldr	w1, [sp, 60]
	ldr	w0, [sp, 56]
	and	w5, w1, w0
	ldr	w1, [sp, 60]
	ldr	w0, [sp, 56]
	orr	w2, w1, w0
	ldr	w1, [sp, 60]
	ldr	w0, [sp, 56]
	eor	w1, w1, w0
	ldr	w0, [sp, 60]
	mvn	w0, w0
	mov	w4, w0
	mov	w3, w1
	mov	w1, w5
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w0, [sp, 60]
	bl	popcount
	mov	w19, w0
	ldr	w0, [sp, 56]
	bl	popcount
	mov	w20, w0
	mov	w0, 0
	bl	popcount
	mov	w3, w0
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 56]
	bl	reverse_bits
	mov	w19, w0
	mov	w1, 8
	ldr	w0, [sp, 56]
	bl	rotl
	mov	w2, w0
	mov	w1, w19
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	w0, [sp, 56]
	lsl	w1, w0, 5
	ldr	w0, [sp, 56]
	lsr	w2, w0, 5
	ldr	w0, [sp, 56]
	asr	w0, w0, 28
	mov	w3, w0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w0, -16
	str	w0, [sp, 52]
	ldr	w0, [sp, 52]
	asr	w1, w0, 2
	ldr	w0, [sp, 52]
	lsl	w2, w0, 2
	ldr	w0, [sp, 52]
	lsr	w0, w0, 28
	mov	w3, w0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	x0, 52719
	movk	x0, 0x89ab, lsl 16
	movk	x0, 0x4567, lsl 32
	movk	x0, 0x123, lsl 48
	str	x0, [sp, 40]
	ldr	x0, [sp, 40]
	lsl	x1, x0, 12
	ldr	x0, [sp, 40]
	lsr	x2, x0, 12
	ldr	x0, [sp, 40]
	and	x0, x0, -281470681808896
	mov	x3, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [sp, 56]
	and	w0, w0, 16
	ubfx	x0, x0, 4, 1
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 56]
	and	w0, w0, 32
	ubfx	x0, x0, 5, 1
	and	w0, w0, 255
	mov	w2, w0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 64
	ret

