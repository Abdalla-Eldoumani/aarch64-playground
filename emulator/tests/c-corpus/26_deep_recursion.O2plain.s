	.text
	.align	2
	.p2align 5,,15
	.global	depth
depth:
	mov	w2, w0
	add	w3, w1, w0
	mov	w0, w1
	cbz	w2, .L1
	.p2align 5,,15
.L4:
	sub	w2, w2, #1
	mov	w0, w3
	add	w3, w3, w2
	cbnz	w2, .L4
.L1:
	ret
	.align	2
	.p2align 5,,15
	.global	is_odd
is_odd:
	cbz	w0, .L11
.L12:
	cmp	w0, 1
	bne	.L22
.L11:
	ret
	.p2align 2,,3
.L22:
	cmp	w0, 2
	beq	.L13
	cmp	w0, 3
	bne	.L23
	mov	w0, 1
	ret
	.p2align 2,,3
.L13:
	mov	w0, 0
	ret
	.p2align 2,,3
.L23:
	subs	w0, w0, #4
	bne	.L12
	ret
	.align	2
	.p2align 5,,15
is_even.part.0:
	cmp	w0, 1
	beq	.L28
	cmp	w0, 2
	bne	.L27
.L29:
	mov	w0, 1
	ret
	.p2align 2,,3
.L28:
	mov	w0, 0
	ret
	.p2align 2,,3
.L27:
	cmp	w0, 3
	beq	.L28
	cmp	w0, 4
	beq	.L29
	cmp	w0, 5
	beq	.L28
	cmp	w0, 6
	beq	.L29
	cmp	w0, 7
	beq	.L28
	cmp	w0, 8
	beq	.L29
	sub	w0, w0, #9
	b	is_odd
	.align	2
	.p2align 5,,15
is_odd.part.0:
	cmp	w0, 1
	bne	.L75
	ret
	.p2align 2,,3
.L75:
	cmp	w0, 2
	beq	.L52
	cmp	w0, 3
	bne	.L51
.L53:
	mov	w0, 1
	ret
	.p2align 2,,3
.L51:
	cmp	w0, 4
	bne	.L76
.L52:
	mov	w0, 0
	ret
	.p2align 2,,3
.L76:
	cmp	w0, 5
	beq	.L53
	cmp	w0, 6
	beq	.L52
	cmp	w0, 7
	beq	.L53
	cmp	w0, 8
	beq	.L52
	cmp	w0, 9
	beq	.L53
	sub	w0, w0, #10
	b	is_odd
	.align	2
	.p2align 5,,15
	.global	is_even
is_even:
	cbnz	w0, .L78
.L81:
	mov	w0, 1
	ret
	.p2align 2,,3
.L78:
	cmp	w0, 1
	beq	.L82
	cmp	w0, 2
	beq	.L81
	cmp	w0, 3
	beq	.L82
	cmp	w0, 4
	beq	.L81
	cmp	w0, 5
	beq	.L82
	cmp	w0, 6
	beq	.L81
	cmp	w0, 7
	beq	.L82
	cmp	w0, 8
	beq	.L81
	sub	w0, w0, #9
	b	is_odd
	.p2align 2,,3
.L82:
	mov	w0, 0
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%d\n"
	.align	3
.LC1:
	.string	"%d %d\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -16]!
	mov	w1, 41748
	movk	w1, 0x7, lsl 16
	mov	x29, sp
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, 198
	bl	is_even.part.0
	mov	w1, w0
	mov	w0, 199
	bl	is_odd.part.0
	mov	w2, w0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 16
	ret

