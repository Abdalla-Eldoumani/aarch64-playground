	.text
	.align	2
	.align 5
	.global	sum
sum:
	sub	sp, sp, #96
	mov	w8, w0
	add	x0, sp, 96
	stp	x0, x0, [sp]
	add	x0, sp, 32
	str	x0, [sp, 16]
	str	wzr, [sp, 28]
	stp	x1, x2, [sp, 40]
	stp	x3, x4, [sp, 56]
	mov	w3, -56
	str	w3, [sp, 24]
	stp	x5, x6, [sp, 72]
	str	x7, [sp, 88]
	cmp	w8, 0
	ble	.L8
	add	x2, sp, 96
	mov	w1, 0
	mov	x0, 0
.L7:
	tbz	w3, #31, .L4
	add	w4, w3, 8
	cmp	w4, 0
	ble	.L5
	ldr	x3, [x2]
	add	w1, w1, 1
	add	x0, x0, x3
	cmp	w8, w1
	beq	.L1
	add	x2, x2, 8
.L4:
	ldr	x3, [x2]
	add	w1, w1, 1
	add	x2, x2, 8
	add	x0, x0, x3
	cmp	w8, w1
	bne	.L4
.L1:
	add	sp, sp, 96
	ret
	.align 2
.L5:
	ldr	x3, [x2, w3, sxtw]
	add	w1, w1, 1
	add	x0, x0, x3
	cmp	w8, w1
	beq	.L1
	mov	w3, w4
	b	.L7
	.align 2
.L8:
	mov	x0, 0
	add	sp, sp, 96
	ret
	.align	2
	.align 5
	.global	maxi
maxi:
	sub	sp, sp, #96
	mov	w8, w0
	add	x0, sp, 96
	stp	x0, x0, [sp]
	add	x0, sp, 32
	str	x0, [sp, 16]
	str	wzr, [sp, 28]
	stp	x1, x2, [sp, 40]
	stp	x3, x4, [sp, 56]
	mov	w3, -56
	str	w3, [sp, 24]
	stp	x5, x6, [sp, 72]
	str	x7, [sp, 88]
	cmp	w8, 0
	ble	.L19
	mov	w0, 48576
	add	x2, sp, 96
	mov	w1, 0
	movk	w0, 0xfff0, lsl 16
.L17:
	tbz	w3, #31, .L18
	add	w4, w3, 8
	cmp	w4, 0
	ble	.L23
	ldr	w3, [x2]
	add	w1, w1, 1
	cmp	w0, w3
	csel	w0, w0, w3, ge
	cmp	w8, w1
	beq	.L13
	add	x2, x2, 8
.L18:
	ldr	w3, [x2]
	add	w1, w1, 1
	add	x2, x2, 8
	cmp	w0, w3
	csel	w0, w0, w3, ge
	cmp	w8, w1
	bne	.L18
.L13:
	add	sp, sp, 96
	ret
	.align 2
.L23:
	ldr	w3, [x2, w3, sxtw]
	add	w1, w1, 1
	cmp	w0, w3
	csel	w0, w0, w3, ge
	cmp	w8, w1
	beq	.L13
	mov	w3, w4
	b	.L17
	.align 2
.L19:
	mov	w0, 48576
	add	sp, sp, 96
	movk	w0, 0xfff0, lsl 16
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%ld %ld %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #64
	mov	x3, 3
	mov	x2, 2
	mov	w0, w3
	mov	x1, 1
	mov	x9, 10
	stp	x29, x30, [sp, 48]
	add	x29, sp, 48
	mov	x10, 9
	bl	sum
	mov	x11, x0
	mov	x1, 11
	mov	x0, 12
	stp	x9, x1, [sp, 16]
	mov	x1, 8
	mov	x6, 6
	stp	x1, x10, [sp]
	mov	x5, 5
	mov	x7, 7
	str	x0, [sp, 32]
	mov	x4, 4
	mov	x3, 3
	mov	x2, 2
	mov	x1, 1
	bl	sum
	mov	w1, w5
	mov	x12, x0
	mov	w0, 4
	str	w0, [sp]
	str	w1, [sp, 8]
	mov	w7, 3
	str	w6, [sp, 16]
	mov	w5, 100
	mov	w4, 7
	mov	w6, 2
	mov	w2, w10
	mov	w0, w9
	mov	w3, -3
	bl	maxi
	mov	x2, x12
	mov	w3, w0
	mov	x1, x11
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldp	x29, x30, [sp, 48]
	mov	w0, 0
	add	sp, sp, 64
	ret

