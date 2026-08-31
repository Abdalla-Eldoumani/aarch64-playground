	.text
	.align	2
	.global	sum
sum:
	sub	sp, sp, #128
	str	w0, [sp, 12]
	str	x1, [sp, 72]
	str	x2, [sp, 80]
	str	x3, [sp, 88]
	str	x4, [sp, 96]
	str	x5, [sp, 104]
	str	x6, [sp, 112]
	str	x7, [sp, 120]
	add	x0, sp, 128
	str	x0, [sp, 16]
	add	x0, sp, 128
	str	x0, [sp, 24]
	add	x0, sp, 64
	str	x0, [sp, 32]
	mov	w0, -56
	str	w0, [sp, 40]
	str	wzr, [sp, 44]
	str	xzr, [sp, 56]
	str	wzr, [sp, 52]
	b	.L2
.L6:
	ldr	w1, [sp, 40]
	ldr	x0, [sp, 16]
	cmp	w1, 0
	blt	.L3
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 16]
	b	.L4
.L3:
	add	w2, w1, 8
	str	w2, [sp, 40]
	ldr	w2, [sp, 40]
	cmp	w2, 0
	ble	.L5
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 16]
	b	.L4
.L5:
	ldr	x2, [sp, 24]
	sxtw	x0, w1
	add	x0, x2, x0
.L4:
	ldr	x0, [x0]
	ldr	x1, [sp, 56]
	add	x0, x1, x0
	str	x0, [sp, 56]
	ldr	w0, [sp, 52]
	add	w0, w0, 1
	str	w0, [sp, 52]
.L2:
	ldr	w1, [sp, 52]
	ldr	w0, [sp, 12]
	cmp	w1, w0
	blt	.L6
	ldr	x0, [sp, 56]
	add	sp, sp, 128
	ret
	.align	2
	.global	maxi
maxi:
	sub	sp, sp, #128
	str	w0, [sp, 12]
	str	x1, [sp, 72]
	str	x2, [sp, 80]
	str	x3, [sp, 88]
	str	x4, [sp, 96]
	str	x5, [sp, 104]
	str	x6, [sp, 112]
	str	x7, [sp, 120]
	add	x0, sp, 128
	str	x0, [sp, 16]
	add	x0, sp, 128
	str	x0, [sp, 24]
	add	x0, sp, 64
	str	x0, [sp, 32]
	mov	w0, -56
	str	w0, [sp, 40]
	str	wzr, [sp, 44]
	mov	w0, 48576
	movk	w0, 0xfff0, lsl 16
	str	w0, [sp, 60]
	str	wzr, [sp, 56]
	b	.L9
.L14:
	ldr	w1, [sp, 40]
	ldr	x0, [sp, 16]
	cmp	w1, 0
	blt	.L10
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 16]
	b	.L11
.L10:
	add	w2, w1, 8
	str	w2, [sp, 40]
	ldr	w2, [sp, 40]
	cmp	w2, 0
	ble	.L12
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 16]
	b	.L11
.L12:
	ldr	x2, [sp, 24]
	sxtw	x0, w1
	add	x0, x2, x0
.L11:
	ldr	w0, [x0]
	str	w0, [sp, 52]
	ldr	w1, [sp, 52]
	ldr	w0, [sp, 60]
	cmp	w1, w0
	ble	.L13
	ldr	w0, [sp, 52]
	str	w0, [sp, 60]
.L13:
	ldr	w0, [sp, 56]
	add	w0, w0, 1
	str	w0, [sp, 56]
.L9:
	ldr	w1, [sp, 56]
	ldr	w0, [sp, 12]
	cmp	w1, w0
	blt	.L14
	ldr	w0, [sp, 60]
	add	sp, sp, 128
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%ld %ld %d\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #80
	stp	x29, x30, [sp, 48]
	add	x29, sp, 48
	stp	x19, x20, [sp, 64]
	mov	x3, 3
	mov	x2, 2
	mov	x1, 1
	mov	w0, 3
	bl	sum
	mov	x19, x0
	mov	x0, 12
	str	x0, [sp, 32]
	mov	x0, 11
	str	x0, [sp, 24]
	mov	x0, 10
	str	x0, [sp, 16]
	mov	x0, 9
	str	x0, [sp, 8]
	mov	x0, 8
	str	x0, [sp]
	mov	x7, 7
	mov	x6, 6
	mov	x5, 5
	mov	x4, 4
	mov	x3, 3
	mov	x2, 2
	mov	x1, 1
	mov	w0, 12
	bl	sum
	mov	x20, x0
	mov	w0, 6
	str	w0, [sp, 16]
	mov	w0, 5
	str	w0, [sp, 8]
	mov	w0, 4
	str	w0, [sp]
	mov	w7, 3
	mov	w6, 2
	mov	w5, 100
	mov	w4, 7
	mov	w3, -3
	mov	w2, 9
	mov	w1, 5
	mov	w0, 10
	bl	maxi
	mov	w3, w0
	mov	x2, x20
	mov	x1, x19
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 48]
	ldp	x19, x20, [sp, 64]
	add	sp, sp, 80
	ret

