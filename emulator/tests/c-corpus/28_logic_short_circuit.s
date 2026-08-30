	.text
	.global	calls
	.bss
	.align	2
calls:
	.zero	4
	.text
	.align	2
	.global	t
t:
	adrp	x0, calls
	add	x0, x0, :lo12:calls
	ldr	w0, [x0]
	add	w1, w0, 1
	adrp	x0, calls
	add	x0, x0, :lo12:calls
	str	w1, [x0]
	mov	w0, 1
	ret
	.align	2
	.global	f
f:
	adrp	x0, calls
	add	x0, x0, :lo12:calls
	ldr	w0, [x0]
	add	w1, w0, 1
	adrp	x0, calls
	add	x0, x0, :lo12:calls
	str	w1, [x0]
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
	.global	main
main:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	bl	f
	cmp	w0, 0
	beq	.L6
	bl	t
	cmp	w0, 0
	beq	.L6
	mov	w0, 1
	b	.L7
.L6:
	mov	w0, 0
.L7:
	str	w0, [sp, 56]
	bl	t
	cmp	w0, 0
	bne	.L8
	bl	f
	cmp	w0, 0
	beq	.L9
.L8:
	mov	w0, 1
	b	.L10
.L9:
	mov	w0, 0
.L10:
	str	w0, [sp, 52]
	bl	t
	cmp	w0, 0
	beq	.L11
	bl	f
	cmp	w0, 0
	beq	.L11
	mov	w0, 1
	b	.L12
.L11:
	mov	w0, 0
.L12:
	str	w0, [sp, 48]
	bl	f
	cmp	w0, 0
	bne	.L13
	bl	f
	cmp	w0, 0
	beq	.L14
.L13:
	mov	w0, 1
	b	.L15
.L14:
	mov	w0, 0
.L15:
	str	w0, [sp, 44]
	adrp	x0, calls
	add	x0, x0, :lo12:calls
	ldr	w0, [x0]
	mov	w5, w0
	ldr	w4, [sp, 44]
	ldr	w3, [sp, 48]
	ldr	w2, [sp, 52]
	ldr	w1, [sp, 56]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, 5
	str	w0, [sp, 40]
	mov	w0, 9
	str	w0, [sp, 36]
	ldr	w0, [sp, 40]
	ldr	w2, [sp, 36]
	ldr	w1, [sp, 36]
	cmp	w2, w0
	csel	w0, w1, w0, ge
	str	w0, [sp, 32]
	ldr	w1, [sp, 40]
	ldr	w0, [sp, 36]
	cmp	w1, w0
	bge	.L16
	ldr	w0, [sp, 40]
	cmp	w0, 5
	bne	.L17
	mov	w0, 1
	str	w0, [sp, 60]
	b	.L18
.L17:
	mov	w0, 2
	str	w0, [sp, 60]
	b	.L18
.L16:
	mov	w0, 3
	str	w0, [sp, 60]
.L18:
	ldr	w2, [sp, 60]
	ldr	w1, [sp, 32]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w1, [sp, 40]
	ldr	w0, [sp, 36]
	cmp	w1, w0
	cset	w0, lt
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 40]
	cmp	w0, 5
	cset	w0, le
	and	w0, w0, 255
	add	w0, w1, w0
	ldr	w1, [sp, 36]
	cmp	w1, 9
	cset	w1, gt
	and	w1, w1, 255
	add	w0, w0, w1
	ldr	w2, [sp, 40]
	ldr	w1, [sp, 36]
	cmp	w2, w1
	cset	w1, ne
	and	w1, w1, 255
	add	w0, w0, w1
	ldr	w2, [sp, 40]
	ldr	w1, [sp, 36]
	cmp	w2, w1
	cset	w1, eq
	and	w1, w1, 255
	add	w0, w0, w1
	str	w0, [sp, 28]
	ldr	w1, [sp, 28]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	str	wzr, [sp, 24]
	ldr	w0, [sp, 24]
	sub	w0, w0, #1
	cmp	w0, 100
	cset	w0, hi
	and	w0, w0, 255
	str	w0, [sp, 20]
	ldr	w1, [sp, 20]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 64
	ret

