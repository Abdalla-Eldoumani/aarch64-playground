	.text
	.align	2
	.global	swap
swap:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldr	w0, [x0]
	str	w0, [sp, 28]
	ldr	x0, [sp]
	ldr	w1, [x0]
	ldr	x0, [sp, 8]
	str	w1, [x0]
	ldr	x0, [sp]
	ldr	w1, [sp, 28]
	str	w1, [x0]
	nop
	add	sp, sp, 32
	ret
	.align	2
	.global	add
add:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w1, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w1, w0
	add	sp, sp, 16
	ret
	.align	2
	.global	sub
sub:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w1, [sp, 12]
	ldr	w0, [sp, 8]
	sub	w0, w1, w0
	add	sp, sp, 16
	ret
	.align	2
	.global	mul
mul:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w1, [sp, 12]
	ldr	w0, [sp, 8]
	mul	w0, w1, w0
	add	sp, sp, 16
	ret
	.align	2
	.global	apply
apply:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	w1, [sp, 20]
	str	w2, [sp, 16]
	ldr	x2, [sp, 24]
	ldr	w1, [sp, 16]
	ldr	w0, [sp, 20]
	blr	x2
	ldp	x29, x30, [sp], 32
	ret
	.align	2
	.global	set
set:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldr	x1, [sp]
	str	x1, [x0]
	nop
	add	sp, sp, 16
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"%d %d\n"
	.align	3
.LC3:
	.string	"%d %d %ld %d\n"
	.align	3
.LC4:
	.string	"%d "
	.align	3
.LC5:
	.string	"\n"
	.align	3
.LC6:
	.string	"%ld %c\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -128]!
	mov	x29, sp
	mov	w0, 3
	str	w0, [sp, 92]
	mov	w0, 9
	str	w0, [sp, 88]
	add	x1, sp, 88
	add	x0, sp, 92
	bl	swap
	ldr	w0, [sp, 92]
	ldr	w1, [sp, 88]
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 64
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 64
	add	x0, x0, 4
	str	x0, [sp, 104]
	add	x0, sp, 64
	add	x0, x0, 20
	str	x0, [sp, 96]
	ldr	x0, [sp, 104]
	ldr	w5, [x0]
	ldr	x0, [sp, 96]
	ldr	w2, [x0]
	ldr	x1, [sp, 96]
	ldr	x0, [sp, 104]
	sub	x0, x1, x0
	asr	x0, x0, 2
	mov	x1, x0
	ldr	x0, [sp, 104]
	add	x0, x0, 8
	ldr	w0, [x0]
	mov	w4, w0
	mov	x3, x1
	mov	w1, w5
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	adrp	x0, .LC1
	add	x1, x0, :lo12:.LC1
	add	x0, sp, 40
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	str	wzr, [sp, 124]
	b	.L12
.L13:
	ldrsw	x0, [sp, 124]
	lsl	x0, x0, 3
	add	x1, sp, 40
	ldr	x0, [x1, x0]
	mov	w2, 4
	mov	w1, 7
	bl	apply
	mov	w1, w0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w0, [sp, 124]
	add	w0, w0, 1
	str	w0, [sp, 124]
.L12:
	ldr	w0, [sp, 124]
	cmp	w0, 2
	ble	.L13
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	str	xzr, [sp, 32]
	add	x0, sp, 64
	add	x1, x0, 8
	add	x0, sp, 32
	bl	set
	ldr	x0, [sp, 32]
	ldr	w3, [x0]
	ldr	x1, [sp, 32]
	add	x0, sp, 64
	add	x0, x0, 8
	cmp	x1, x0
	cset	w0, eq
	and	w0, w0, 255
	mov	w2, w0
	mov	w1, w3
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	x0, 28528
	movk	x0, 0x6e69, lsl 16
	movk	x0, 0x6574, lsl 32
	movk	x0, 0x72, lsl 48
	str	x0, [sp, 24]
	add	x0, sp, 24
	str	x0, [sp, 112]
	b	.L14
.L15:
	ldr	x0, [sp, 112]
	add	x0, x0, 1
	str	x0, [sp, 112]
.L14:
	ldr	x0, [sp, 112]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L15
	add	x0, sp, 24
	ldr	x1, [sp, 112]
	sub	x1, x1, x0
	ldr	x0, [sp, 112]
	sub	x0, x0, #1
	ldrb	w0, [x0]
	mov	w2, w0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 128
	ret
	.section .rodata
	.align	3
.LC0:
	.word	10
	.word	20
	.word	30
	.word	40
	.word	50
	.word	60
	.align	3
.LC1:
	.quad	add
	.quad	sub
	.quad	mul
	.text

