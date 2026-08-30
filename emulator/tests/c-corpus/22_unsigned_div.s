	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%u %u\n"
	.align	3
.LC1:
	.string	"%d %d %d\n"
	.align	3
.LC2:
	.string	"%d %d\n"
	.align	3
.LC3:
	.string	"%ld %ld\n"
	.align	3
.LC4:
	.string	"%lu %lu\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	mov	w0, 24064
	movk	w0, 0xb2d0, lsl 16
	str	w0, [sp, 60]
	mov	w0, 7
	str	w0, [sp, 56]
	ldr	w1, [sp, 60]
	ldr	w0, [sp, 56]
	udiv	w3, w1, w0
	ldr	w0, [sp, 60]
	ldr	w1, [sp, 56]
	udiv	w2, w0, w1
	ldr	w1, [sp, 56]
	mul	w1, w2, w1
	sub	w0, w0, w1
	mov	w2, w0
	mov	w1, w3
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, 13824
	movk	w0, 0xc465, lsl 16
	str	w0, [sp, 52]
	ldr	w0, [sp, 52]
	mov	w1, 9363
	movk	w1, 0x9249, lsl 16
	smull	x1, w0, w1
	lsr	x1, x1, 32
	add	w1, w0, w1
	asr	w1, w1, 2
	asr	w0, w0, 31
	sub	w4, w1, w0
	ldr	w0, [sp, 52]
	mov	w1, 9363
	movk	w1, 0x9249, lsl 16
	smull	x1, w0, w1
	lsr	x1, x1, 32
	add	w1, w0, w1
	asr	w2, w1, 2
	asr	w1, w0, 31
	sub	w2, w2, w1
	mov	w1, w2
	lsl	w1, w1, 3
	sub	w1, w1, w2
	sub	w2, w0, w1
	ldr	w0, [sp, 52]
	mov	w1, 9363
	movk	w1, 0x9249, lsl 16
	smull	x1, w0, w1
	lsr	x1, x1, 32
	add	w1, w0, w1
	asr	w1, w1, 2
	asr	w0, w0, 31
	sub	w0, w0, w1
	mov	w3, w0
	mov	w1, w4
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, 5
	str	w0, [sp, 48]
	mov	w0, -1
	str	w0, [sp, 44]
	ldr	w0, [sp, 44]
	ldr	w1, [sp, 48]
	cmp	w1, w0
	cset	w0, hi
	and	w0, w0, 255
	mov	w3, w0
	ldr	w0, [sp, 48]
	ldr	w1, [sp, 44]
	cmp	w1, w0
	cset	w0, lt
	and	w0, w0, 255
	mov	w2, w0
	mov	w1, w3
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, -6
	strb	w0, [sp, 43]
	ldrb	w0, [sp, 43]
	add	w0, w0, 10
	strb	w0, [sp, 43]
	mov	w0, 120
	strb	w0, [sp, 42]
	ldrb	w0, [sp, 42]
	add	w0, w0, 10
	and	w0, w0, 255
	strb	w0, [sp, 42]
	ldrb	w0, [sp, 43]
	ldrsb	w1, [sp, 42]
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	x0, -6656
	movk	x0, 0xe78e, lsl 16
	movk	x0, 0xfffd, lsl 32
	str	x0, [sp, 32]
	ldr	x0, [sp, 32]
	mov	x1, 63439
	movk	x1, 0xe353, lsl 16
	movk	x1, 0x9ba5, lsl 32
	movk	x1, 0x20c4, lsl 48
	smulh	x1, x0, x1
	asr	x1, x1, 7
	asr	x0, x0, 63
	sub	x3, x1, x0
	ldr	x1, [sp, 32]
	mov	x0, 63439
	movk	x0, 0xe353, lsl 16
	movk	x0, 0x9ba5, lsl 32
	movk	x0, 0x20c4, lsl 48
	smulh	x0, x1, x0
	asr	x2, x0, 7
	asr	x0, x1, 63
	sub	x2, x2, x0
	mov	x0, x2
	lsl	x0, x0, 2
	add	x0, x0, x2
	lsl	x2, x0, 2
	add	x0, x0, x2
	lsl	x2, x0, 2
	add	x0, x0, x2
	lsl	x0, x0, 3
	sub	x2, x1, x0
	mov	x1, x3
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	x0, 19335
	movk	x0, 0x5d6b, lsl 16
	movk	x0, 0xdc54, lsl 32
	movk	x0, 0x2b, lsl 48
	str	x0, [sp, 24]
	ldr	x1, [sp, 24]
	mov	x0, 49695
	movk	x0, 0x18e7, lsl 16
	movk	x0, 0x77c7, lsl 32
	movk	x0, 0x54f0, lsl 48
	umulh	x0, x1, x0
	lsr	x3, x0, 12
	ldr	x1, [sp, 24]
	mov	x0, 49695
	movk	x0, 0x18e7, lsl 16
	movk	x0, 0x77c7, lsl 32
	movk	x0, 0x54f0, lsl 48
	umulh	x0, x1, x0
	lsr	x0, x0, 12
	mov	x2, 12345
	mul	x0, x0, x2
	sub	x0, x1, x0
	mov	x2, x0
	mov	x1, x3
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 64
	ret

