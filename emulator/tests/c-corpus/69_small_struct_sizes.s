	.text
	.align	2
	.global	mix1
mix1:
	sub	sp, sp, #32
	strb	w0, [sp, 12]
	str	w1, [sp, 8]
	str	wzr, [sp, 28]
	b	.L2
.L3:
	ldrsw	x0, [sp, 28]
	add	x1, sp, 12
	ldrb	w0, [x1, x0]
	mov	w1, w0
	mov	w0, w1
	ubfiz	w0, w0, 3, 5
	sub	w0, w0, w1
	and	w1, w0, 255
	ldr	w0, [sp, 28]
	and	w2, w0, 255
	ldr	w0, [sp, 8]
	and	w0, w0, 255
	mul	w0, w2, w0
	and	w0, w0, 255
	add	w0, w1, w0
	and	w0, w0, 255
	add	w0, w0, 1
	and	w2, w0, 255
	ldrsw	x0, [sp, 28]
	add	x1, sp, 12
	strb	w2, [x1, x0]
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L2:
	ldr	w0, [sp, 28]
	cmp	w0, 0
	ble	.L3
	ldrb	w0, [sp, 12]
	add	sp, sp, 32
	ret
	.align	2
	.global	mix2
mix2:
	sub	sp, sp, #32
	strh	w0, [sp, 12]
	str	w1, [sp, 8]
	str	wzr, [sp, 28]
	b	.L6
.L7:
	ldrsw	x0, [sp, 28]
	add	x1, sp, 12
	ldrb	w0, [x1, x0]
	mov	w1, w0
	mov	w0, w1
	ubfiz	w0, w0, 3, 5
	sub	w0, w0, w1
	and	w1, w0, 255
	ldr	w0, [sp, 28]
	and	w2, w0, 255
	ldr	w0, [sp, 8]
	and	w0, w0, 255
	mul	w0, w2, w0
	and	w0, w0, 255
	add	w0, w1, w0
	and	w0, w0, 255
	add	w0, w0, 2
	and	w2, w0, 255
	ldrsw	x0, [sp, 28]
	add	x1, sp, 12
	strb	w2, [x1, x0]
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L6:
	ldr	w0, [sp, 28]
	cmp	w0, 1
	ble	.L7
	ldrh	w0, [sp, 12]
	add	sp, sp, 32
	ret
	.align	2
	.global	mix3
mix3:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	w1, [sp, 4]
	str	wzr, [sp, 28]
	b	.L10
.L11:
	ldrsw	x0, [sp, 28]
	add	x1, sp, 8
	ldrb	w0, [x1, x0]
	mov	w1, w0
	mov	w0, w1
	ubfiz	w0, w0, 3, 5
	sub	w0, w0, w1
	and	w1, w0, 255
	ldr	w0, [sp, 28]
	and	w2, w0, 255
	ldr	w0, [sp, 4]
	and	w0, w0, 255
	mul	w0, w2, w0
	and	w0, w0, 255
	add	w0, w1, w0
	and	w0, w0, 255
	add	w0, w0, 3
	and	w2, w0, 255
	ldrsw	x0, [sp, 28]
	add	x1, sp, 8
	strb	w2, [x1, x0]
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L10:
	ldr	w0, [sp, 28]
	cmp	w0, 2
	ble	.L11
	add	x0, sp, 24
	add	x1, sp, 8
	ldrh	w2, [x1]
	ldrb	w1, [x1, 2]
	strh	w2, [x0]
	strb	w1, [x0, 2]
	mov	x0, 0
	ldrh	w1, [sp, 24]
	bfi	x0, x1, 0, 16
	ldrb	w1, [sp, 26]
	bfi	x0, x1, 16, 8
	add	sp, sp, 32
	ret
	.align	2
	.global	mix5
mix5:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	w1, [sp, 4]
	str	wzr, [sp, 28]
	b	.L14
.L15:
	ldrsw	x0, [sp, 28]
	add	x1, sp, 8
	ldrb	w0, [x1, x0]
	mov	w1, w0
	mov	w0, w1
	ubfiz	w0, w0, 3, 5
	sub	w0, w0, w1
	and	w1, w0, 255
	ldr	w0, [sp, 28]
	and	w2, w0, 255
	ldr	w0, [sp, 4]
	and	w0, w0, 255
	mul	w0, w2, w0
	and	w0, w0, 255
	add	w0, w1, w0
	and	w0, w0, 255
	add	w0, w0, 5
	and	w2, w0, 255
	ldrsw	x0, [sp, 28]
	add	x1, sp, 8
	strb	w2, [x1, x0]
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L14:
	ldr	w0, [sp, 28]
	cmp	w0, 4
	ble	.L15
	add	x0, sp, 16
	add	x1, sp, 8
	ldr	w2, [x1]
	ldrb	w1, [x1, 4]
	str	w2, [x0]
	strb	w1, [x0, 4]
	mov	x0, 0
	ldr	w1, [sp, 16]
	bfi	x0, x1, 0, 32
	ldrb	w1, [sp, 20]
	bfi	x0, x1, 32, 8
	add	sp, sp, 32
	ret
	.align	2
	.global	mix7
mix7:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	w1, [sp, 4]
	str	wzr, [sp, 28]
	b	.L18
.L19:
	ldrsw	x0, [sp, 28]
	add	x1, sp, 8
	ldrb	w0, [x1, x0]
	mov	w1, w0
	mov	w0, w1
	ubfiz	w0, w0, 3, 5
	sub	w0, w0, w1
	and	w1, w0, 255
	ldr	w0, [sp, 28]
	and	w2, w0, 255
	ldr	w0, [sp, 4]
	and	w0, w0, 255
	mul	w0, w2, w0
	and	w0, w0, 255
	add	w0, w1, w0
	and	w0, w0, 255
	add	w0, w0, 7
	and	w2, w0, 255
	ldrsw	x0, [sp, 28]
	add	x1, sp, 8
	strb	w2, [x1, x0]
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L18:
	ldr	w0, [sp, 28]
	cmp	w0, 6
	ble	.L19
	add	x0, sp, 16
	add	x1, sp, 8
	ldr	w2, [x1]
	ldr	w1, [x1, 3]
	str	w2, [x0]
	str	w1, [x0, 3]
	mov	x0, 0
	ldr	w1, [sp, 16]
	bfi	x0, x1, 0, 32
	ldrh	w1, [sp, 20]
	bfi	x0, x1, 32, 16
	ldrb	w1, [sp, 22]
	bfi	x0, x1, 48, 8
	add	sp, sp, 32
	ret
	.align	2
	.global	mix9
mix9:
	sub	sp, sp, #48
	str	w2, [sp, 12]
	str	x0, [sp, 16]
	ldrb	w0, [sp, 24]
	bfi	w0, w1, 0, 8
	strb	w0, [sp, 24]
	str	wzr, [sp, 44]
	b	.L22
.L23:
	ldrsw	x0, [sp, 44]
	add	x1, sp, 16
	ldrb	w0, [x1, x0]
	mov	w1, w0
	mov	w0, w1
	ubfiz	w0, w0, 3, 5
	sub	w0, w0, w1
	and	w1, w0, 255
	ldr	w0, [sp, 44]
	and	w2, w0, 255
	ldr	w0, [sp, 12]
	and	w0, w0, 255
	mul	w0, w2, w0
	and	w0, w0, 255
	add	w0, w1, w0
	and	w0, w0, 255
	add	w0, w0, 9
	and	w2, w0, 255
	ldrsw	x0, [sp, 44]
	add	x1, sp, 16
	strb	w2, [x1, x0]
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L22:
	ldr	w0, [sp, 44]
	cmp	w0, 8
	ble	.L23
	add	x0, sp, 32
	add	x1, sp, 16
	ldr	x2, [x1]
	ldrb	w1, [x1, 8]
	str	x2, [x0]
	strb	w1, [x0, 8]
	ldr	x2, [sp, 32]
	mov	x0, 0
	ldrb	w1, [sp, 40]
	bfi	x0, x1, 0, 8
	mov	x4, x2
	mov	x5, x0
	mov	x0, x4
	mov	x1, x5
	add	sp, sp, 48
	ret
	.align	2
	.global	mix12
mix12:
	sub	sp, sp, #48
	str	w2, [sp, 12]
	str	x0, [sp, 16]
	ldr	w0, [sp, 24]
	bfi	w0, w1, 0, 32
	str	w0, [sp, 24]
	str	wzr, [sp, 44]
	b	.L26
.L27:
	ldrsw	x0, [sp, 44]
	add	x1, sp, 16
	ldrb	w0, [x1, x0]
	mov	w1, w0
	mov	w0, w1
	ubfiz	w0, w0, 3, 5
	sub	w0, w0, w1
	and	w1, w0, 255
	ldr	w0, [sp, 44]
	and	w2, w0, 255
	ldr	w0, [sp, 12]
	and	w0, w0, 255
	mul	w0, w2, w0
	and	w0, w0, 255
	add	w0, w1, w0
	and	w0, w0, 255
	add	w0, w0, 12
	and	w2, w0, 255
	ldrsw	x0, [sp, 44]
	add	x1, sp, 16
	strb	w2, [x1, x0]
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L26:
	ldr	w0, [sp, 44]
	cmp	w0, 11
	ble	.L27
	add	x0, sp, 32
	add	x1, sp, 16
	ldr	x2, [x1]
	ldr	w1, [x1, 8]
	str	x2, [x0]
	str	w1, [x0, 8]
	ldr	x2, [sp, 32]
	mov	x0, 0
	ldr	w1, [sp, 40]
	bfi	x0, x1, 0, 32
	mov	x4, x2
	mov	x5, x0
	mov	x0, x4
	mov	x1, x5
	add	sp, sp, 48
	ret
	.align	2
	.global	mix15
mix15:
	sub	sp, sp, #64
	mov	x3, x0
	mov	x0, x1
	str	w2, [sp, 12]
	str	x3, [sp, 16]
	and	x1, x0, 4294967295
	ldr	w2, [sp, 24]
	mov	w3, 0
	and	w2, w2, w3
	orr	w1, w2, w1
	str	w1, [sp, 24]
	lsr	x1, x0, 32
	and	x3, x1, 65535
	ldrh	w1, [sp, 28]
	mov	w2, 0
	and	w1, w1, w2
	mov	w2, w1
	mov	w1, w3
	orr	w1, w2, w1
	strh	w1, [sp, 28]
	lsr	x0, x0, 48
	and	x2, x0, 255
	ldrb	w0, [sp, 30]
	mov	w1, 0
	and	w0, w0, w1
	mov	w1, w0
	mov	w0, w2
	orr	w0, w1, w0
	strb	w0, [sp, 30]
	str	wzr, [sp, 60]
	b	.L30
.L31:
	ldrsw	x0, [sp, 60]
	add	x1, sp, 16
	ldrb	w0, [x1, x0]
	mov	w1, w0
	mov	w0, w1
	ubfiz	w0, w0, 3, 5
	sub	w0, w0, w1
	and	w1, w0, 255
	ldr	w0, [sp, 60]
	and	w2, w0, 255
	ldr	w0, [sp, 12]
	and	w0, w0, 255
	mul	w0, w2, w0
	and	w0, w0, 255
	add	w0, w1, w0
	and	w0, w0, 255
	add	w0, w0, 15
	and	w2, w0, 255
	ldrsw	x0, [sp, 60]
	add	x1, sp, 16
	strb	w2, [x1, x0]
	ldr	w0, [sp, 60]
	add	w0, w0, 1
	str	w0, [sp, 60]
.L30:
	ldr	w0, [sp, 60]
	cmp	w0, 14
	ble	.L31
	add	x0, sp, 40
	add	x1, sp, 16
	ldr	x2, [x1]
	ldr	x1, [x1, 7]
	str	x2, [x0]
	str	x1, [x0, 7]
	ldr	x2, [sp, 40]
	mov	x0, 0
	ldr	w1, [sp, 48]
	bfi	x0, x1, 0, 32
	ldrh	w1, [sp, 52]
	bfi	x0, x1, 32, 16
	ldrb	w1, [sp, 54]
	bfi	x0, x1, 48, 8
	mov	x4, x2
	mov	x5, x0
	mov	x0, x4
	mov	x1, x5
	add	sp, sp, 64
	ret
	.align	2
	.global	mix16
mix16:
	sub	sp, sp, #48
	stp	x0, x1, [sp, 16]
	str	w2, [sp, 12]
	str	wzr, [sp, 44]
	b	.L34
.L35:
	ldrsw	x0, [sp, 44]
	add	x1, sp, 16
	ldrb	w0, [x1, x0]
	mov	w1, w0
	mov	w0, w1
	ubfiz	w0, w0, 3, 5
	sub	w0, w0, w1
	and	w1, w0, 255
	ldr	w0, [sp, 44]
	and	w2, w0, 255
	ldr	w0, [sp, 12]
	and	w0, w0, 255
	mul	w0, w2, w0
	and	w0, w0, 255
	add	w0, w1, w0
	and	w0, w0, 255
	add	w0, w0, 16
	and	w2, w0, 255
	ldrsw	x0, [sp, 44]
	add	x1, sp, 16
	strb	w2, [x1, x0]
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L34:
	ldr	w0, [sp, 44]
	cmp	w0, 15
	ble	.L35
	ldp	x0, x1, [sp, 16]
	add	sp, sp, 48
	ret
	.align	2
	.global	neg6
neg6:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	ldrsb	w0, [sp, 8]
	and	w0, w0, 255
	neg	w0, w0
	and	w0, w0, 255
	sxtb	w0, w0
	strb	w0, [sp, 16]
	ldrsh	w0, [sp, 10]
	and	w0, w0, 65535
	mov	w1, w0
	ubfiz	w0, w0, 2, 14
	sub	w0, w1, w0
	and	w0, w0, 65535
	sxth	w0, w0
	strh	w0, [sp, 18]
	ldrsb	w0, [sp, 12]
	lsr	w1, w0, 31
	add	w0, w1, w0
	asr	w0, w0, 1
	sxtb	w0, w0
	and	w0, w0, 255
	sub	w0, w0, #50
	and	w0, w0, 255
	sxtb	w0, w0
	strb	w0, [sp, 20]
	add	x0, sp, 24
	add	x1, sp, 16
	ldr	w2, [x1]
	ldrh	w1, [x1, 4]
	str	w2, [x0]
	strh	w1, [x0, 4]
	mov	x0, 0
	ldr	w1, [sp, 24]
	bfi	x0, x1, 0, 32
	ldrh	w1, [sp, 28]
	bfi	x0, x1, 32, 16
	add	sp, sp, 32
	ret
	.align	2
	.global	rot12
rot12:
	sub	sp, sp, #48
	str	x0, [sp]
	ldr	w0, [sp, 8]
	bfi	w0, w1, 0, 32
	str	w0, [sp, 8]
	ldr	w0, [sp, 4]
	str	w0, [sp, 16]
	ldr	w0, [sp, 8]
	str	w0, [sp, 20]
	ldr	w1, [sp]
	ldr	w0, [sp, 4]
	sub	w1, w1, w0
	ldr	w0, [sp, 8]
	sub	w0, w1, w0
	str	w0, [sp, 24]
	add	x0, sp, 32
	add	x1, sp, 16
	ldr	x4, [x1]
	ldr	w1, [x1, 8]
	str	x4, [x0]
	str	w1, [x0, 8]
	ldr	x4, [sp, 32]
	mov	x0, 0
	ldr	w1, [sp, 40]
	bfi	x0, x1, 0, 32
	mov	x2, x4
	mov	x3, x0
	mov	x0, x2
	mov	x1, x3
	add	sp, sp, 48
	ret
	.align	2
	.global	next16
next16:
	sub	sp, sp, #32
	stp	x0, x1, [sp]
	ldrb	w0, [sp]
	add	w0, w0, 1
	and	w0, w0, 255
	strb	w0, [sp, 16]
	ldr	x1, [sp, 8]
	mov	x0, 0
	sub	x0, x0, x1
	lsl	x0, x0, 1
	sub	x0, x0, #1
	str	x0, [sp, 24]
	ldp	x0, x1, [sp, 16]
	add	sp, sp, 32
	ret
	.align	2
	.global	spill
spill:
	sub	sp, sp, #96
	str	x0, [sp, 56]
	str	x1, [sp, 48]
	str	x2, [sp, 40]
	mov	x0, x3
	mov	x1, x4
	stp	x5, x6, [sp, 8]
	str	x0, [sp, 24]
	ldrb	w0, [sp, 32]
	bfi	w0, w1, 0, 8
	strb	w0, [sp, 32]
	ldrsw	x0, [sp, 112]
	str	x0, [sp, 88]
	str	wzr, [sp, 84]
	b	.L44
.L45:
	ldr	x1, [sp, 88]
	mov	x0, x1
	lsl	x0, x0, 6
	add	x0, x0, x1
	lsl	x0, x0, 1
	add	x1, x0, x1
	ldrsw	x0, [sp, 84]
	add	x2, sp, 56
	ldrb	w0, [x2, x0]
	and	x0, x0, 255
	add	x0, x1, x0
	str	x0, [sp, 88]
	ldr	w0, [sp, 84]
	add	w0, w0, 1
	str	w0, [sp, 84]
.L44:
	ldr	w0, [sp, 84]
	cmp	w0, 2
	ble	.L45
	str	wzr, [sp, 80]
	b	.L46
.L47:
	ldr	x1, [sp, 88]
	mov	x0, x1
	lsl	x0, x0, 6
	add	x0, x0, x1
	lsl	x0, x0, 1
	add	x1, x0, x1
	ldrsw	x0, [sp, 80]
	add	x2, sp, 48
	ldrb	w0, [x2, x0]
	and	x0, x0, 255
	add	x0, x1, x0
	str	x0, [sp, 88]
	ldr	w0, [sp, 80]
	add	w0, w0, 1
	str	w0, [sp, 80]
.L46:
	ldr	w0, [sp, 80]
	cmp	w0, 4
	ble	.L47
	str	wzr, [sp, 76]
	b	.L48
.L49:
	ldr	x1, [sp, 88]
	mov	x0, x1
	lsl	x0, x0, 6
	add	x0, x0, x1
	lsl	x0, x0, 1
	add	x1, x0, x1
	ldrsw	x0, [sp, 76]
	add	x2, sp, 40
	ldrb	w0, [x2, x0]
	and	x0, x0, 255
	add	x0, x1, x0
	str	x0, [sp, 88]
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L48:
	ldr	w0, [sp, 76]
	cmp	w0, 6
	ble	.L49
	str	wzr, [sp, 72]
	b	.L50
.L51:
	ldr	x1, [sp, 88]
	mov	x0, x1
	lsl	x0, x0, 6
	add	x0, x0, x1
	lsl	x0, x0, 1
	add	x1, x0, x1
	ldrsw	x0, [sp, 72]
	add	x2, sp, 24
	ldrb	w0, [x2, x0]
	and	x0, x0, 255
	add	x0, x1, x0
	str	x0, [sp, 88]
	ldr	w0, [sp, 72]
	add	w0, w0, 1
	str	w0, [sp, 72]
.L50:
	ldr	w0, [sp, 72]
	cmp	w0, 8
	ble	.L51
	str	wzr, [sp, 68]
	b	.L52
.L53:
	ldr	x1, [sp, 88]
	mov	x0, x1
	lsl	x0, x0, 6
	add	x0, x0, x1
	lsl	x0, x0, 1
	add	x1, x0, x1
	ldrsw	x0, [sp, 68]
	add	x2, sp, 8
	ldrb	w0, [x2, x0]
	and	x0, x0, 255
	add	x0, x1, x0
	str	x0, [sp, 88]
	ldr	w0, [sp, 68]
	add	w0, w0, 1
	str	w0, [sp, 68]
.L52:
	ldr	w0, [sp, 68]
	cmp	w0, 15
	ble	.L53
	str	wzr, [sp, 64]
	b	.L54
.L55:
	ldr	x1, [sp, 88]
	mov	x0, x1
	lsl	x0, x0, 6
	add	x0, x0, x1
	lsl	x0, x0, 1
	add	x1, x0, x1
	ldrsw	x0, [sp, 64]
	add	x2, sp, 96
	ldrb	w0, [x2, x0]
	and	x0, x0, 255
	add	x0, x1, x0
	str	x0, [sp, 88]
	ldr	w0, [sp, 64]
	add	w0, w0, 1
	str	w0, [sp, 64]
.L54:
	ldr	w0, [sp, 64]
	cmp	w0, 14
	ble	.L55
	ldr	x0, [sp, 88]
	add	sp, sp, 96
	ret
	.section .rodata
	.align	3
.LC3:
	.string	"%-4s"
	.align	3
.LC4:
	.string	" %02x"
	.align	3
.LC5:
	.string	" | %u\n"
	.text
	.align	2
	.global	show
show:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x0, [sp, 40]
	str	x1, [sp, 32]
	str	w2, [sp, 28]
	str	wzr, [sp, 60]
	ldr	x1, [sp, 40]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	str	wzr, [sp, 56]
	b	.L58
.L59:
	ldrsw	x0, [sp, 56]
	ldr	x1, [sp, 32]
	add	x0, x1, x0
	ldrb	w0, [x0]
	mov	w1, w0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w1, [sp, 60]
	mov	w0, w1
	lsl	w0, w0, 5
	sub	w0, w0, w1
	ldrsw	x1, [sp, 56]
	ldr	x2, [sp, 32]
	add	x1, x2, x1
	ldrb	w1, [x1]
	add	w0, w0, w1
	str	w0, [sp, 60]
	ldr	w0, [sp, 56]
	add	w0, w0, 1
	str	w0, [sp, 56]
.L58:
	ldr	w1, [sp, 56]
	ldr	w0, [sp, 28]
	cmp	w1, w0
	blt	.L59
	ldr	w1, [sp, 60]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	nop
	ldp	x29, x30, [sp], 64
	ret
	.global	knob
	.data
	.align	2
knob:
	.word	3
	.section .rodata
	.align	3
.LC6:
	.string	"b1"
	.align	3
.LC7:
	.string	"b2"
	.align	3
.LC8:
	.string	"b3"
	.align	3
.LC9:
	.string	"b5"
	.align	3
.LC10:
	.string	"b7"
	.align	3
.LC11:
	.string	"b9"
	.align	3
.LC12:
	.string	"b12"
	.align	3
.LC13:
	.string	"b15"
	.align	3
.LC14:
	.string	"b16"
	.align	3
.LC15:
	.string	"direct %u %u\n"
	.align	3
.LC16:
	.string	"spill %lu %016lx\n"
	.align	3
.LC17:
	.string	"s6 %d %d %d\n"
	.align	3
.LC18:
	.string	"s12 %d %d %d\n"
	.align	3
.LC19:
	.string	"s16 %c %ld\n"
	.align	3
.LC20:
	.string	"sizes %d %d %d %d\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #304
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	str	x19, [sp, 48]
	adrp	x0, knob
	add	x0, x0, :lo12:knob
	ldr	w0, [x0]
	str	w0, [sp, 284]
	mov	w0, -128
	strb	w0, [sp, 208]
	mov	w0, 511
	strh	w0, [sp, 200]
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 192
	ldrh	w2, [x1]
	ldrb	w1, [x1, 2]
	strh	w2, [x0]
	strb	w1, [x0, 2]
	adrp	x0, .LC1
	add	x1, x0, :lo12:.LC1
	add	x0, sp, 184
	ldr	w2, [x1]
	ldrb	w1, [x1, 4]
	str	w2, [x0]
	strb	w1, [x0, 4]
	str	wzr, [sp, 300]
	b	.L61
.L66:
	ldr	w0, [sp, 300]
	and	w0, w0, 255
	mov	w1, w0
	mov	w0, w1
	ubfiz	w0, w0, 4, 4
	add	w0, w0, w1
	and	w0, w0, 255
	add	w0, w0, 15
	strb	w0, [sp, 271]
	ldr	w0, [sp, 300]
	cmp	w0, 6
	bgt	.L62
	ldrsw	x0, [sp, 300]
	add	x1, sp, 176
	ldrb	w2, [sp, 271]
	strb	w2, [x1, x0]
.L62:
	ldr	w0, [sp, 300]
	cmp	w0, 8
	bgt	.L63
	ldrb	w1, [sp, 271]
	mov	w0, 90
	eor	w0, w1, w0
	and	w2, w0, 255
	ldrsw	x0, [sp, 300]
	add	x1, sp, 160
	strb	w2, [x1, x0]
.L63:
	ldr	w0, [sp, 300]
	cmp	w0, 11
	bgt	.L64
	ldrb	w0, [sp, 271]
	sub	w0, w0, #128
	and	w2, w0, 255
	ldrsw	x0, [sp, 300]
	add	x1, sp, 144
	strb	w2, [x1, x0]
.L64:
	ldr	w0, [sp, 300]
	cmp	w0, 14
	bgt	.L65
	ldrb	w0, [sp, 271]
	mvn	w0, w0
	and	w2, w0, 255
	ldrsw	x0, [sp, 300]
	add	x1, sp, 128
	strb	w2, [x1, x0]
.L65:
	ldr	w0, [sp, 300]
	and	w1, w0, 255
	ldr	w0, [sp, 300]
	and	w0, w0, 255
	mul	w0, w1, w0
	and	w2, w0, 255
	ldrsw	x0, [sp, 300]
	add	x1, sp, 112
	strb	w2, [x1, x0]
	ldr	w0, [sp, 300]
	add	w0, w0, 1
	str	w0, [sp, 300]
.L61:
	ldr	w0, [sp, 300]
	cmp	w0, 15
	ble	.L66
	ldr	w1, [sp, 284]
	ldrb	w0, [sp, 208]
	bl	mix1
	strb	w0, [sp, 208]
	add	x0, sp, 208
	mov	w2, 1
	mov	x1, x0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	show
	ldr	w1, [sp, 284]
	ldrh	w0, [sp, 200]
	bl	mix2
	strh	w0, [sp, 200]
	add	x0, sp, 200
	mov	w2, 2
	mov	x1, x0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	show
	ldr	w1, [sp, 284]
	ldr	x0, [sp, 192]
	bl	mix3
	sxtw	x0, w0
	mov	w1, w0
	strb	w1, [sp, 192]
	ubfx	x1, x0, 8, 8
	strb	w1, [sp, 193]
	ubfx	x0, x0, 16, 8
	strb	w0, [sp, 194]
	add	x0, sp, 192
	mov	w2, 3
	mov	x1, x0
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	show
	ldr	w1, [sp, 284]
	ldr	x0, [sp, 184]
	bl	mix5
	mov	w1, w0
	strb	w1, [sp, 184]
	ubfx	x1, x0, 8, 8
	strb	w1, [sp, 185]
	ubfx	x1, x0, 16, 8
	strb	w1, [sp, 186]
	lsr	w1, w0, 24
	strb	w1, [sp, 187]
	ubfx	x0, x0, 32, 8
	strb	w0, [sp, 188]
	add	x0, sp, 184
	mov	w2, 5
	mov	x1, x0
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	show
	ldr	w1, [sp, 284]
	ldr	x0, [sp, 176]
	bl	mix7
	mov	w1, w0
	strb	w1, [sp, 176]
	ubfx	x1, x0, 8, 8
	strb	w1, [sp, 177]
	ubfx	x1, x0, 16, 8
	strb	w1, [sp, 178]
	lsr	w1, w0, 24
	strb	w1, [sp, 179]
	ubfx	x1, x0, 32, 8
	strb	w1, [sp, 180]
	ubfx	x1, x0, 40, 8
	strb	w1, [sp, 181]
	ubfx	x0, x0, 48, 8
	strb	w0, [sp, 182]
	add	x0, sp, 176
	mov	w2, 7
	mov	x1, x0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	show
	ldr	x0, [sp, 160]
	ldrb	w1, [sp, 168]
	ldr	w2, [sp, 284]
	bl	mix9
	mov	w2, w0
	strb	w2, [sp, 160]
	ubfx	x2, x0, 8, 8
	strb	w2, [sp, 161]
	ubfx	x2, x0, 16, 8
	strb	w2, [sp, 162]
	lsr	w2, w0, 24
	strb	w2, [sp, 163]
	ubfx	x2, x0, 32, 8
	strb	w2, [sp, 164]
	ubfx	x2, x0, 40, 8
	strb	w2, [sp, 165]
	ubfx	x2, x0, 48, 8
	strb	w2, [sp, 166]
	lsr	x2, x0, 56
	strb	w2, [sp, 167]
	mov	w0, w1
	strb	w0, [sp, 168]
	add	x0, sp, 160
	mov	w2, 9
	mov	x1, x0
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	show
	ldr	x0, [sp, 144]
	ldr	w1, [sp, 152]
	ldr	w2, [sp, 284]
	bl	mix12
	mov	w2, w0
	strb	w2, [sp, 144]
	ubfx	x2, x0, 8, 8
	strb	w2, [sp, 145]
	ubfx	x2, x0, 16, 8
	strb	w2, [sp, 146]
	lsr	w2, w0, 24
	strb	w2, [sp, 147]
	ubfx	x2, x0, 32, 8
	strb	w2, [sp, 148]
	ubfx	x2, x0, 40, 8
	strb	w2, [sp, 149]
	ubfx	x2, x0, 48, 8
	strb	w2, [sp, 150]
	lsr	x2, x0, 56
	strb	w2, [sp, 151]
	mov	w2, w1
	strb	w2, [sp, 152]
	ubfx	x2, x1, 8, 8
	strb	w2, [sp, 153]
	ubfx	x2, x1, 16, 8
	strb	w2, [sp, 154]
	lsr	w0, w1, 24
	strb	w0, [sp, 155]
	add	x0, sp, 144
	mov	w2, 12
	mov	x1, x0
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	show
	ldr	x3, [sp, 128]
	ldr	x0, [sp, 136]
	ubfx	x1, x0, 0, 56
	ldr	w2, [sp, 284]
	mov	x0, x3
	bl	mix15
	mov	w2, w0
	strb	w2, [sp, 128]
	ubfx	x2, x0, 8, 8
	strb	w2, [sp, 129]
	ubfx	x2, x0, 16, 8
	strb	w2, [sp, 130]
	lsr	w2, w0, 24
	strb	w2, [sp, 131]
	ubfx	x2, x0, 32, 8
	strb	w2, [sp, 132]
	ubfx	x2, x0, 40, 8
	strb	w2, [sp, 133]
	ubfx	x2, x0, 48, 8
	strb	w2, [sp, 134]
	lsr	x2, x0, 56
	strb	w2, [sp, 135]
	mov	w2, w1
	strb	w2, [sp, 136]
	ubfx	x2, x1, 8, 8
	strb	w2, [sp, 137]
	ubfx	x2, x1, 16, 8
	strb	w2, [sp, 138]
	lsr	w2, w1, 24
	strb	w2, [sp, 139]
	ubfx	x2, x1, 32, 8
	strb	w2, [sp, 140]
	ubfx	x2, x1, 40, 8
	strb	w2, [sp, 141]
	ubfx	x0, x1, 48, 8
	strb	w0, [sp, 142]
	add	x0, sp, 128
	mov	w2, 15
	mov	x1, x0
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	show
	ldr	w2, [sp, 284]
	ldp	x0, x1, [sp, 112]
	bl	mix16
	mov	x4, x0
	mov	x5, x1
	ldr	w0, [sp, 284]
	add	w0, w0, 1
	mov	w2, w0
	mov	x0, x4
	mov	x1, x5
	bl	mix16
	stp	x0, x1, [sp, 112]
	add	x0, sp, 112
	mov	w2, 16
	mov	x1, x0
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	show
	mov	w1, 5
	ldr	x0, [sp, 192]
	bl	mix3
	sxtw	x0, w0
	mov	w1, w0
	strb	w1, [sp, 216]
	ubfx	x1, x0, 8, 8
	strb	w1, [sp, 217]
	ubfx	x0, x0, 16, 8
	strb	w0, [sp, 218]
	ldrb	w0, [sp, 218]
	mov	w19, w0
	ldr	w0, [sp, 284]
	neg	w2, w0
	ldr	x0, [sp, 144]
	ldr	w1, [sp, 152]
	bl	mix12
	mov	w2, w0
	strb	w2, [sp, 224]
	ubfx	x2, x0, 8, 8
	strb	w2, [sp, 225]
	ubfx	x2, x0, 16, 8
	strb	w2, [sp, 226]
	lsr	w2, w0, 24
	strb	w2, [sp, 227]
	ubfx	x2, x0, 32, 8
	strb	w2, [sp, 228]
	ubfx	x2, x0, 40, 8
	strb	w2, [sp, 229]
	ubfx	x2, x0, 48, 8
	strb	w2, [sp, 230]
	lsr	x2, x0, 56
	strb	w2, [sp, 231]
	mov	w2, w1
	strb	w2, [sp, 232]
	ubfx	x2, x1, 8, 8
	strb	w2, [sp, 233]
	ubfx	x2, x1, 16, 8
	strb	w2, [sp, 234]
	lsr	w0, w1, 24
	strb	w0, [sp, 235]
	ldrb	w0, [sp, 235]
	mov	w2, w0
	mov	w1, w19
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	mov	w1, 1
	ldr	x0, [sp, 192]
	bl	mix3
	sxtw	x0, w0
	mov	w1, w0
	strb	w1, [sp, 240]
	ubfx	x1, x0, 8, 8
	strb	w1, [sp, 241]
	ubfx	x0, x0, 16, 8
	strb	w0, [sp, 242]
	mov	w1, 2
	ldr	x0, [sp, 176]
	bl	mix7
	mov	w1, w0
	strb	w1, [sp, 248]
	ubfx	x1, x0, 8, 8
	strb	w1, [sp, 249]
	ubfx	x1, x0, 16, 8
	strb	w1, [sp, 250]
	lsr	w1, w0, 24
	strb	w1, [sp, 251]
	ubfx	x1, x0, 32, 8
	strb	w1, [sp, 252]
	ubfx	x1, x0, 40, 8
	strb	w1, [sp, 253]
	ubfx	x0, x0, 48, 8
	strb	w0, [sp, 254]
	ldr	x3, [sp, 128]
	ldr	x0, [sp, 136]
	ubfx	x1, x0, 0, 56
	mov	w2, 3
	mov	x0, x3
	bl	mix15
	mov	w2, w0
	strb	w2, [sp, 256]
	ubfx	x2, x0, 8, 8
	strb	w2, [sp, 257]
	ubfx	x2, x0, 16, 8
	strb	w2, [sp, 258]
	lsr	w2, w0, 24
	strb	w2, [sp, 259]
	ubfx	x2, x0, 32, 8
	strb	w2, [sp, 260]
	ubfx	x2, x0, 40, 8
	strb	w2, [sp, 261]
	ubfx	x2, x0, 48, 8
	strb	w2, [sp, 262]
	lsr	x2, x0, 56
	strb	w2, [sp, 263]
	mov	w2, w1
	strb	w2, [sp, 264]
	ubfx	x2, x1, 8, 8
	strb	w2, [sp, 265]
	ubfx	x2, x1, 16, 8
	strb	w2, [sp, 266]
	lsr	w2, w1, 24
	strb	w2, [sp, 267]
	ubfx	x2, x1, 32, 8
	strb	w2, [sp, 268]
	ubfx	x2, x1, 40, 8
	strb	w2, [sp, 269]
	ubfx	x0, x1, 48, 8
	strb	w0, [sp, 270]
	ldr	w1, [sp, 284]
	mov	w0, -1000
	mul	w0, w1, w0
	ldr	x3, [sp, 160]
	ldrb	w2, [sp, 168]
	str	w0, [sp, 16]
	mov	x1, sp
	add	x0, sp, 256
	ldr	x4, [x0]
	ldr	x0, [x0, 7]
	str	x4, [x1]
	str	x0, [x1, 7]
	ldp	x5, x6, [sp, 112]
	mov	x4, x2
	ldr	x2, [sp, 248]
	ldr	x1, [sp, 184]
	ldr	x0, [sp, 240]
	bl	spill
	str	x0, [sp, 272]
	ldr	x2, [sp, 272]
	ldr	x1, [sp, 272]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	adrp	x0, .LC2
	add	x1, x0, :lo12:.LC2
	add	x0, sp, 104
	ldr	w2, [x1]
	ldrh	w1, [x1, 4]
	str	w2, [x0]
	strh	w1, [x0, 4]
	str	wzr, [sp, 296]
	b	.L67
.L68:
	ldr	x0, [sp, 104]
	bl	neg6
	mov	w1, w0
	strh	w1, [sp, 104]
	lsr	w1, w0, 16
	strh	w1, [sp, 106]
	ubfx	x0, x0, 32, 16
	strh	w0, [sp, 108]
	ldrsb	w0, [sp, 104]
	ldrsh	w1, [sp, 106]
	ldrsb	w2, [sp, 108]
	mov	w3, w2
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	ldr	w0, [sp, 296]
	add	w0, w0, 1
	str	w0, [sp, 296]
.L67:
	ldr	w0, [sp, 296]
	cmp	w0, 2
	ble	.L68
	ldr	w0, [sp, 284]
	str	w0, [sp, 88]
	mov	w0, -7
	str	w0, [sp, 92]
	mov	w0, 34464
	movk	w0, 0x1, lsl 16
	str	w0, [sp, 96]
	str	wzr, [sp, 292]
	b	.L69
.L70:
	ldr	x0, [sp, 88]
	ldr	w1, [sp, 96]
	bl	rot12
	mov	w2, w0
	str	w2, [sp, 88]
	lsr	x2, x0, 32
	str	w2, [sp, 92]
	mov	w0, w1
	str	w0, [sp, 96]
	ldr	w0, [sp, 88]
	ldr	w1, [sp, 92]
	ldr	w2, [sp, 96]
	mov	w3, w2
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	printf
	ldr	w0, [sp, 292]
	add	w0, w0, 1
	str	w0, [sp, 292]
.L69:
	ldr	w0, [sp, 292]
	cmp	w0, 3
	ble	.L70
	mov	w0, 97
	strb	w0, [sp, 72]
	mov	x0, 1000
	str	x0, [sp, 80]
	str	wzr, [sp, 288]
	b	.L71
.L72:
	ldp	x0, x1, [sp, 72]
	bl	next16
	stp	x0, x1, [sp, 72]
	ldrb	w0, [sp, 72]
	mov	w1, w0
	ldr	x0, [sp, 80]
	mov	x2, x0
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	printf
	ldr	w0, [sp, 288]
	add	w0, w0, 1
	str	w0, [sp, 288]
.L71:
	ldr	w0, [sp, 288]
	cmp	w0, 2
	ble	.L72
	mov	w4, 16
	mov	w3, 12
	mov	w2, 6
	mov	w1, 15
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	ldr	x19, [sp, 48]
	add	sp, sp, 304
	ret
	.section .rodata
	.align	3
.LC0:
	.byte 1, 2, 3
	.align	3
.LC1:
	.byte 240, 225, 210, 195, 180
	.align	3
.LC2:
	.byte	-100
	.zero	1
	.hword	1000
	.byte	20
	.zero	1
	.text

