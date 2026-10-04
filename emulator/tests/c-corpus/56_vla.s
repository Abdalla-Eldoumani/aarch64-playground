	.text
	.data
	.align	2
loop_size:
	.word	6000
	.align	2
loop_passes:
	.word	1500
	.align	2
mat_n:
	.word	7
	.align	2
rec_top:
	.word	180
	.section .rodata
	.align	3
.LC0:
	.string	"churn pass=%d size=%d s=%llu\n"
	.text
	.align	2
churn:
	stp	x29, x30, [sp, -144]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	str	x27, [sp, 80]
	str	xzr, [x29, 136]
	str	wzr, [x29, 132]
	b	.L2
.L4:
	mov	x0, sp
	mov	x19, x0
	ldr	w0, [x29, 132]
	and	w1, w0, 7
	adrp	x0, loop_size
	add	x0, x0, :lo12:loop_size
	ldr	w0, [x0]
	add	w0, w1, w0
	sxtw	x1, w0
	sub	x1, x1, #1
	str	x1, [x29, 120]
	sxtw	x1, w0
	mov	x20, x1
	mov	x21, 0
	lsr	x1, x20, 61
	lsl	x25, x21, 3
	mov	x2, x25
	add	x1, x1, x2
	mov	x25, x1
	lsl	x24, x20, 3
	sxtw	x1, w0
	mov	x22, x1
	mov	x23, 0
	lsr	x1, x22, 61
	lsl	x27, x23, 3
	mov	x2, x27
	add	x1, x1, x2
	mov	x27, x1
	lsl	x26, x22, 3
	sxtw	x1, w0
	add	x1, x1, 15
	lsr	x1, x1, 4
	lsl	x1, x1, 4
	sub	sp, sp, x1
	mov	x1, sp
	str	x1, [x29, 112]
	sub	w0, w0, #1
	str	w0, [x29, 108]
	ldr	w0, [x29, 132]
	and	w1, w0, 255
	ldr	x0, [x29, 112]
	strb	w1, [x0]
	ldr	w0, [x29, 132]
	asr	w2, w0, 3
	ldr	w0, [x29, 108]
	lsr	w1, w0, 31
	add	w0, w1, w0
	asr	w0, w0, 1
	and	w2, w2, 255
	ldr	x1, [x29, 112]
	sxtw	x0, w0
	strb	w2, [x1, x0]
	ldr	w0, [x29, 132]
	and	w0, w0, 255
	mov	w1, w0
	mov	w0, w1
	ubfiz	w0, w0, 3, 5
	sub	w0, w0, w1
	and	w2, w0, 255
	ldr	x1, [x29, 112]
	ldrsw	x0, [x29, 108]
	strb	w2, [x1, x0]
	ldr	x1, [x29, 136]
	mov	x0, x1
	lsl	x0, x0, 5
	add	x1, x0, x1
	ldr	x0, [x29, 112]
	ldrb	w0, [x0]
	and	x0, x0, 255
	add	x1, x1, x0
	ldr	w0, [x29, 108]
	lsr	w2, w0, 31
	add	w0, w2, w0
	asr	w0, w0, 1
	ldr	x2, [x29, 112]
	sxtw	x0, w0
	ldrb	w0, [x2, x0]
	and	x0, x0, 255
	add	x1, x1, x0
	ldr	x2, [x29, 112]
	ldrsw	x0, [x29, 108]
	ldrb	w0, [x2, x0]
	and	x0, x0, 255
	add	x1, x1, x0
	ldr	w0, [x29, 108]
	uxtw	x0, w0
	add	x0, x1, x0
	str	x0, [x29, 136]
	ldr	w0, [x29, 132]
	mov	w1, 500
	sdiv	w2, w0, w1
	mov	w1, 500
	mul	w1, w2, w1
	sub	w0, w0, w1
	cmp	w0, 0
	bne	.L3
	ldr	w0, [x29, 108]
	add	w0, w0, 1
	ldr	x3, [x29, 136]
	mov	w2, w0
	ldr	w1, [x29, 132]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
.L3:
	mov	sp, x19
	ldr	w0, [x29, 132]
	add	w0, w0, 1
	str	w0, [x29, 132]
.L2:
	adrp	x0, loop_passes
	add	x0, x0, :lo12:loop_passes
	ldr	w0, [x0]
	ldr	w1, [x29, 132]
	cmp	w1, w0
	blt	.L4
	ldr	x0, [x29, 136]
	mov	sp, x29
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldr	x27, [sp, 80]
	ldp	x29, x30, [sp], 144
	ret
	.align	2
matmul:
	sub	sp, sp, #80
	str	w0, [sp, 28]
	str	x1, [sp, 16]
	str	x2, [sp, 8]
	str	x3, [sp]
	ldr	w1, [sp, 28]
	sxtw	x0, w1
	sub	x0, x0, #1
	str	x0, [sp, 56]
	sxtw	x0, w1
	mov	x8, x0
	mov	x9, 0
	lsr	x0, x8, 58
	lsl	x15, x9, 6
	mov	x2, x15
	add	x0, x0, x2
	mov	x15, x0
	lsl	x14, x8, 6
	ldr	w2, [sp, 28]
	sxtw	x0, w2
	sub	x0, x0, #1
	str	x0, [sp, 48]
	sxtw	x0, w2
	mov	x6, x0
	mov	x7, 0
	lsr	x0, x6, 58
	lsl	x13, x7, 6
	mov	x3, x13
	add	x0, x0, x3
	mov	x13, x0
	lsl	x12, x6, 6
	ldr	w0, [sp, 28]
	sxtw	x3, w0
	sub	x3, x3, #1
	str	x3, [sp, 40]
	sxtw	x3, w0
	mov	x4, x3
	mov	x5, 0
	lsr	x3, x4, 58
	lsl	x11, x5, 6
	mov	x6, x11
	add	x3, x3, x6
	mov	x11, x3
	lsl	x10, x4, 6
	str	wzr, [sp, 76]
	b	.L7
.L12:
	str	wzr, [sp, 72]
	b	.L8
.L11:
	ldrsw	x4, [sp, 76]
	sxtw	x3, w0
	mul	x3, x4, x3
	lsl	x3, x3, 3
	ldr	x4, [sp]
	add	x3, x4, x3
	ldrsw	x4, [sp, 72]
	str	xzr, [x3, x4, lsl 3]
	str	wzr, [sp, 68]
	b	.L9
.L10:
	ldrsw	x4, [sp, 76]
	sxtw	x3, w1
	mul	x3, x4, x3
	lsl	x3, x3, 3
	ldr	x4, [sp, 16]
	add	x3, x4, x3
	ldrsw	x4, [sp, 68]
	ldr	x4, [x3, x4, lsl 3]
	ldrsw	x5, [sp, 68]
	sxtw	x3, w2
	mul	x3, x5, x3
	lsl	x3, x3, 3
	ldr	x5, [sp, 8]
	add	x3, x5, x3
	ldrsw	x5, [sp, 72]
	ldr	x3, [x3, x5, lsl 3]
	mul	x5, x4, x3
	ldrsw	x4, [sp, 76]
	sxtw	x3, w0
	mul	x3, x4, x3
	lsl	x3, x3, 3
	ldr	x4, [sp]
	add	x3, x4, x3
	ldrsw	x4, [sp, 72]
	ldr	x4, [x3, x4, lsl 3]
	ldrsw	x6, [sp, 76]
	sxtw	x3, w0
	mul	x3, x6, x3
	lsl	x3, x3, 3
	ldr	x6, [sp]
	add	x3, x6, x3
	add	x5, x5, x4
	ldrsw	x4, [sp, 72]
	str	x5, [x3, x4, lsl 3]
	ldr	w3, [sp, 68]
	add	w3, w3, 1
	str	w3, [sp, 68]
.L9:
	ldr	w4, [sp, 68]
	ldr	w3, [sp, 28]
	cmp	w4, w3
	blt	.L10
	ldr	w3, [sp, 72]
	add	w3, w3, 1
	str	w3, [sp, 72]
.L8:
	ldr	w4, [sp, 72]
	ldr	w3, [sp, 28]
	cmp	w4, w3
	blt	.L11
	ldr	w3, [sp, 76]
	add	w3, w3, 1
	str	w3, [sp, 76]
.L7:
	ldr	w4, [sp, 76]
	ldr	w3, [sp, 28]
	cmp	w4, w3
	blt	.L12
	nop
	nop
	add	sp, sp, 80
	ret
	.align	2
levels:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	str	x19, [sp, 16]
	str	w0, [x29, 44]
	mov	x0, sp
	mov	x19, x0
	ldr	w0, [x29, 44]
	add	w0, w0, 1
	sxtw	x1, w0
	sub	x1, x1, #1
	str	x1, [x29, 56]
	sxtw	x1, w0
	mov	x4, x1
	mov	x5, 0
	lsr	x1, x4, 59
	lsl	x9, x5, 5
	mov	x10, x9
	add	x1, x1, x10
	mov	x9, x1
	lsl	x8, x4, 5
	sxtw	x1, w0
	mov	x2, x1
	mov	x3, 0
	lsr	x1, x2, 59
	lsl	x7, x3, 5
	mov	x4, x7
	add	x1, x1, x4
	mov	x7, x1
	lsl	x6, x2, 5
	sxtw	x0, w0
	lsl	x0, x0, 2
	add	x0, x0, 15
	lsr	x0, x0, 4
	lsl	x0, x0, 4
	sub	sp, sp, x0
	mov	x0, sp
	add	x0, x0, 3
	lsr	x0, x0, 2
	lsl	x0, x0, 2
	str	x0, [x29, 48]
	str	xzr, [x29, 72]
	str	wzr, [x29, 68]
	b	.L14
.L15:
	ldr	w1, [x29, 68]
	ldr	w0, [x29, 44]
	mul	w0, w1, w0
	sub	w2, w0, #50
	ldr	x0, [x29, 48]
	ldrsw	x1, [x29, 68]
	str	w2, [x0, x1, lsl 2]
	ldr	w0, [x29, 68]
	add	w0, w0, 1
	str	w0, [x29, 68]
.L14:
	ldr	w1, [x29, 68]
	ldr	w0, [x29, 44]
	cmp	w1, w0
	ble	.L15
	ldr	w0, [x29, 44]
	cmp	w0, 0
	ble	.L16
	ldr	w0, [x29, 44]
	sub	w0, w0, #1
	bl	levels
	str	x0, [x29, 72]
.L16:
	str	wzr, [x29, 68]
	b	.L17
.L18:
	ldr	x0, [x29, 48]
	ldrsw	x1, [x29, 68]
	ldr	w0, [x0, x1, lsl 2]
	sxtw	x0, w0
	ldr	x1, [x29, 72]
	add	x0, x1, x0
	str	x0, [x29, 72]
	ldr	w0, [x29, 68]
	add	w0, w0, 1
	str	w0, [x29, 68]
.L17:
	ldr	w1, [x29, 68]
	ldr	w0, [x29, 44]
	cmp	w1, w0
	ble	.L18
	ldr	x0, [x29, 72]
	mov	sp, x19
	mov	sp, x29
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 80
	ret
	.align	2
nine:
	sub	sp, sp, #64
	str	x0, [sp, 56]
	str	x1, [sp, 48]
	str	x2, [sp, 40]
	str	x3, [sp, 32]
	str	x4, [sp, 24]
	str	x5, [sp, 16]
	str	x6, [sp, 8]
	str	x7, [sp]
	ldr	x0, [sp, 48]
	lsl	x1, x0, 1
	ldr	x0, [sp, 56]
	add	x2, x1, x0
	ldr	x1, [sp, 40]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	add	x1, x2, x0
	ldr	x0, [sp, 32]
	lsl	x0, x0, 2
	add	x2, x1, x0
	ldr	x1, [sp, 24]
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	add	x2, x2, x0
	ldr	x1, [sp, 16]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 1
	add	x2, x2, x0
	ldr	x1, [sp, 8]
	mov	x0, x1
	lsl	x0, x0, 3
	sub	x0, x0, x1
	add	x1, x2, x0
	ldr	x0, [sp]
	lsl	x0, x0, 3
	add	x2, x1, x0
	ldr	x1, [sp, 64]
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	add	x0, x2, x0
	add	sp, sp, 64
	ret
	.align	2
with_vla_and_call:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	str	x19, [sp, 16]
	sub	sp, sp, #16
	str	w0, [x29, 44]
	mov	x0, sp
	mov	x19, x0
	ldr	w0, [x29, 44]
	sxtw	x1, w0
	sub	x1, x1, #1
	str	x1, [x29, 56]
	sxtw	x1, w0
	mov	x4, x1
	mov	x5, 0
	lsr	x1, x4, 58
	lsl	x9, x5, 6
	mov	x10, x9
	add	x1, x1, x10
	mov	x9, x1
	lsl	x8, x4, 6
	sxtw	x1, w0
	mov	x2, x1
	mov	x3, 0
	lsr	x1, x2, 58
	lsl	x7, x3, 6
	mov	x4, x7
	add	x1, x1, x4
	mov	x7, x1
	lsl	x6, x2, 6
	sxtw	x0, w0
	lsl	x0, x0, 3
	add	x0, x0, 15
	lsr	x0, x0, 4
	lsl	x0, x0, 4
	sub	sp, sp, x0
	add	x0, sp, 16
	add	x0, x0, 7
	lsr	x0, x0, 3
	lsl	x0, x0, 3
	str	x0, [x29, 48]
	str	xzr, [x29, 72]
	str	wzr, [x29, 68]
	b	.L23
.L24:
	ldr	w0, [x29, 68]
	mul	w0, w0, w0
	sxtw	x2, w0
	ldr	x0, [x29, 48]
	ldrsw	x1, [x29, 68]
	str	x2, [x0, x1, lsl 3]
	ldr	w0, [x29, 68]
	add	w0, w0, 1
	str	w0, [x29, 68]
.L23:
	ldr	w1, [x29, 68]
	ldr	w0, [x29, 44]
	cmp	w1, w0
	blt	.L24
	str	wzr, [x29, 68]
	b	.L25
.L26:
	ldr	x0, [x29, 48]
	ldrsw	x1, [x29, 68]
	ldr	x8, [x0, x1, lsl 3]
	ldr	w0, [x29, 68]
	add	w1, w0, 1
	ldr	x0, [x29, 48]
	sxtw	x1, w1
	ldr	x9, [x0, x1, lsl 3]
	ldr	w0, [x29, 68]
	add	w1, w0, 2
	ldr	x0, [x29, 48]
	sxtw	x1, w1
	ldr	x2, [x0, x1, lsl 3]
	ldr	w0, [x29, 68]
	add	w1, w0, 3
	ldr	x0, [x29, 48]
	sxtw	x1, w1
	ldr	x3, [x0, x1, lsl 3]
	ldr	w0, [x29, 68]
	add	w1, w0, 4
	ldr	x0, [x29, 48]
	sxtw	x1, w1
	ldr	x4, [x0, x1, lsl 3]
	ldr	w0, [x29, 68]
	add	w1, w0, 5
	ldr	x0, [x29, 48]
	sxtw	x1, w1
	ldr	x5, [x0, x1, lsl 3]
	ldr	w0, [x29, 68]
	add	w1, w0, 6
	ldr	x0, [x29, 48]
	sxtw	x1, w1
	ldr	x6, [x0, x1, lsl 3]
	ldr	w0, [x29, 68]
	add	w1, w0, 7
	ldr	x0, [x29, 48]
	sxtw	x1, w1
	ldr	x7, [x0, x1, lsl 3]
	ldr	w0, [x29, 68]
	add	w1, w0, 8
	ldr	x0, [x29, 48]
	sxtw	x1, w1
	ldr	x0, [x0, x1, lsl 3]
	str	x0, [sp]
	mov	x1, x9
	mov	x0, x8
	bl	nine
	mov	x1, x0
	ldr	x0, [x29, 72]
	add	x0, x0, x1
	str	x0, [x29, 72]
	ldr	w0, [x29, 68]
	add	w0, w0, 5
	str	w0, [x29, 68]
.L25:
	ldr	w0, [x29, 68]
	add	w0, w0, 8
	ldr	w1, [x29, 44]
	cmp	w1, w0
	bgt	.L26
	ldr	w0, [x29, 44]
	sub	w1, w0, #1
	ldr	x0, [x29, 48]
	sxtw	x1, w1
	ldr	x1, [x0, x1, lsl 3]
	ldr	x0, [x29, 72]
	add	x0, x1, x0
	mov	sp, x19
	mov	sp, x29
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 80
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"churn=%llu\n"
	.align	3
.LC2:
	.string	"row %d: %lld %lld %lld\n"
	.align	3
.LC3:
	.string	"trace=%lld sizeof row=%d sizeof matrix=%d\n"
	.align	3
.LC4:
	.string	"found=%d at i=%d\n"
	.align	3
.LC5:
	.string	"levels=%lld\n"
	.align	3
.LC6:
	.string	"vla+call=%lld\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #592
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	mov	x0, sp
	str	x0, [x29, 112]
	adrp	x0, mat_n
	add	x0, x0, :lo12:mat_n
	ldr	w0, [x0]
	str	w0, [x29, 564]
	mov	w0, -1
	str	w0, [x29, 580]
	ldr	w30, [x29, 564]
	str	w30, [x29, 108]
	ldr	w28, [x29, 564]
	sxtw	x0, w30
	sub	x0, x0, #1
	str	x0, [x29, 552]
	sxtw	x0, w30
	mov	x2, x0
	mov	x3, 0
	lsr	x1, x2, 58
	lsl	x15, x3, 6
	mov	x0, x15
	add	x0, x1, x0
	mov	x15, x0
	lsl	x14, x2, 6
	sxtw	x0, w30
	lsl	x0, x0, 3
	str	x0, [x29, 120]
	sxtw	x0, w28
	sub	x0, x0, #1
	str	x0, [x29, 544]
	mov	w2, w30
	sxtw	x0, w2
	mov	x6, x0
	mov	x7, 0
	sxtw	x0, w28
	mov	x4, x0
	mov	x5, 0
	mul	x1, x6, x4
	umulh	x0, x6, x4
	madd	x0, x7, x4, x0
	madd	x0, x6, x5, x0
	mov	x12, x1
	mov	x13, x0
	lsr	x1, x12, 58
	lsl	x0, x13, 6
	str	x0, [x29, 456]
	ldr	x0, [x29, 456]
	add	x0, x1, x0
	str	x0, [x29, 456]
	lsl	x0, x12, 6
	str	x0, [x29, 448]
	sxtw	x0, w2
	mov	x10, x0
	mov	x11, 0
	sxtw	x0, w28
	mov	x8, x0
	mov	x9, 0
	mul	x1, x10, x8
	umulh	x0, x10, x8
	madd	x0, x11, x8, x0
	madd	x0, x10, x9, x0
	mov	x16, x1
	mov	x17, x0
	lsr	x1, x16, 58
	lsl	x0, x17, 6
	str	x0, [x29, 440]
	ldr	x0, [x29, 440]
	add	x0, x1, x0
	str	x0, [x29, 440]
	lsl	x0, x16, 6
	str	x0, [x29, 432]
	sxtw	x1, w2
	sxtw	x0, w28
	mul	x0, x1, x0
	lsl	x0, x0, 3
	add	x0, x0, 15
	lsr	x0, x0, 4
	lsl	x0, x0, 4
	sub	sp, sp, x0
	mov	x0, sp
	add	x0, x0, 7
	lsr	x0, x0, 3
	lsl	x0, x0, 3
	str	x0, [x29, 536]
	ldr	w2, [x29, 564]
	ldr	w3, [x29, 564]
	sxtw	x0, w2
	sub	x0, x0, #1
	str	x0, [x29, 528]
	sxtw	x0, w2
	mov	x22, x0
	mov	x23, 0
	lsr	x1, x22, 58
	lsl	x0, x23, 6
	str	x0, [x29, 424]
	ldr	x0, [x29, 424]
	add	x0, x1, x0
	str	x0, [x29, 424]
	lsl	x0, x22, 6
	str	x0, [x29, 416]
	sxtw	x0, w2
	lsl	x22, x0, 3
	sxtw	x0, w3
	sub	x0, x0, #1
	str	x0, [x29, 520]
	sxtw	x0, w2
	mov	x20, x0
	mov	x21, 0
	sxtw	x0, w3
	mov	x18, x0
	mov	x19, 0
	mul	x1, x20, x18
	umulh	x0, x20, x18
	madd	x0, x21, x18, x0
	madd	x0, x20, x19, x0
	str	x1, [x29, 288]
	str	x0, [x29, 296]
	ldp	x4, x5, [x29, 288]
	mov	x0, x4
	lsr	x1, x0, 58
	mov	x0, x5
	lsl	x0, x0, 6
	str	x0, [x29, 408]
	ldr	x0, [x29, 408]
	add	x0, x1, x0
	str	x0, [x29, 408]
	mov	x0, x4
	lsl	x0, x0, 6
	str	x0, [x29, 400]
	sxtw	x0, w2
	mov	x26, x0
	mov	x27, 0
	sxtw	x0, w3
	mov	x24, x0
	mov	x25, 0
	mul	x1, x26, x24
	umulh	x0, x26, x24
	madd	x0, x27, x24, x0
	madd	x0, x26, x25, x0
	str	x1, [x29, 272]
	str	x0, [x29, 280]
	ldp	x4, x5, [x29, 272]
	mov	x0, x4
	lsr	x1, x0, 58
	mov	x0, x5
	lsl	x0, x0, 6
	str	x0, [x29, 392]
	ldr	x0, [x29, 392]
	add	x0, x1, x0
	str	x0, [x29, 392]
	mov	x0, x4
	lsl	x0, x0, 6
	str	x0, [x29, 384]
	sxtw	x1, w2
	sxtw	x0, w3
	mul	x0, x1, x0
	lsl	x0, x0, 3
	add	x0, x0, 15
	lsr	x0, x0, 4
	lsl	x0, x0, 4
	sub	sp, sp, x0
	mov	x0, sp
	add	x0, x0, 7
	lsr	x0, x0, 3
	lsl	x0, x0, 3
	str	x0, [x29, 512]
	ldr	w20, [x29, 564]
	ldr	w21, [x29, 564]
	sxtw	x0, w20
	sub	x0, x0, #1
	str	x0, [x29, 504]
	sxtw	x0, w20
	str	x0, [x29, 256]
	str	xzr, [x29, 264]
	ldp	x2, x3, [x29, 256]
	mov	x0, x2
	lsr	x1, x0, 58
	mov	x0, x3
	lsl	x0, x0, 6
	str	x0, [x29, 376]
	ldr	x0, [x29, 376]
	add	x0, x1, x0
	str	x0, [x29, 376]
	mov	x0, x2
	lsl	x0, x0, 6
	str	x0, [x29, 368]
	sxtw	x0, w20
	lsl	x19, x0, 3
	sxtw	x0, w21
	sub	x0, x0, #1
	str	x0, [x29, 496]
	sxtw	x0, w20
	str	x0, [x29, 240]
	str	xzr, [x29, 248]
	sxtw	x0, w21
	str	x0, [x29, 224]
	str	xzr, [x29, 232]
	ldp	x4, x5, [x29, 240]
	mov	x0, x4
	ldp	x2, x3, [x29, 224]
	mov	x1, x2
	mul	x1, x0, x1
	mov	x0, x4
	mov	x6, x2
	umulh	x0, x0, x6
	mov	x6, x5
	mov	x7, x2
	madd	x0, x6, x7, x0
	mov	x2, x3
	madd	x0, x4, x2, x0
	str	x1, [x29, 208]
	str	x0, [x29, 216]
	ldp	x2, x3, [x29, 208]
	mov	x0, x2
	lsr	x0, x0, 58
	mov	x1, x3
	lsl	x1, x1, 6
	str	x1, [x29, 360]
	ldr	x1, [x29, 360]
	add	x0, x0, x1
	str	x0, [x29, 360]
	mov	x0, x2
	lsl	x0, x0, 6
	str	x0, [x29, 352]
	sxtw	x0, w20
	str	x0, [x29, 192]
	str	xzr, [x29, 200]
	sxtw	x0, w21
	str	x0, [x29, 176]
	str	xzr, [x29, 184]
	ldp	x4, x5, [x29, 192]
	mov	x0, x4
	ldp	x2, x3, [x29, 176]
	mov	x1, x2
	mul	x1, x0, x1
	mov	x0, x4
	mov	x6, x2
	umulh	x0, x0, x6
	mov	x6, x5
	mov	x7, x2
	madd	x0, x6, x7, x0
	mov	x2, x3
	madd	x0, x4, x2, x0
	str	x1, [x29, 160]
	str	x0, [x29, 168]
	ldp	x2, x3, [x29, 160]
	mov	x0, x2
	lsr	x0, x0, 58
	mov	x1, x3
	lsl	x1, x1, 6
	str	x1, [x29, 344]
	ldr	x1, [x29, 344]
	add	x0, x0, x1
	str	x0, [x29, 344]
	mov	x0, x2
	lsl	x0, x0, 6
	str	x0, [x29, 336]
	sxtw	x1, w20
	sxtw	x0, w21
	mul	x0, x1, x0
	lsl	x0, x0, 3
	add	x0, x0, 15
	lsr	x0, x0, 4
	lsl	x0, x0, 4
	sub	sp, sp, x0
	mov	x0, sp
	add	x0, x0, 7
	lsr	x0, x0, 3
	lsl	x0, x0, 3
	str	x0, [x29, 488]
	str	xzr, [x29, 568]
	bl	churn
	mov	x1, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	str	wzr, [x29, 588]
	b	.L29
.L32:
	str	wzr, [x29, 584]
	b	.L30
.L31:
	ldr	w1, [x29, 588]
	mov	w0, w1
	lsl	w0, w0, 1
	add	w1, w0, w1
	ldr	w0, [x29, 584]
	sub	w0, w1, w0
	ldr	x1, [x29, 120]
	lsr	x1, x1, 3
	sxtw	x4, w0
	ldr	x0, [x29, 536]
	ldrsw	x2, [x29, 584]
	ldrsw	x3, [x29, 588]
	mul	x1, x3, x1
	add	x1, x2, x1
	str	x4, [x0, x1, lsl 3]
	ldr	w1, [x29, 588]
	ldr	w0, [x29, 584]
	cmp	w1, w0
	cset	w0, eq
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [x29, 584]
	add	w1, w1, w0
	ldr	w0, [x29, 588]
	lsl	w0, w0, 1
	sub	w0, w1, w0
	lsr	x1, x22, 3
	sxtw	x4, w0
	ldr	x0, [x29, 512]
	ldrsw	x2, [x29, 584]
	ldrsw	x3, [x29, 588]
	mul	x1, x3, x1
	add	x1, x2, x1
	str	x4, [x0, x1, lsl 3]
	ldr	w0, [x29, 584]
	add	w0, w0, 1
	str	w0, [x29, 584]
.L30:
	ldr	w1, [x29, 584]
	ldr	w0, [x29, 564]
	cmp	w1, w0
	blt	.L31
	ldr	w0, [x29, 588]
	add	w0, w0, 1
	str	w0, [x29, 588]
.L29:
	ldr	w1, [x29, 588]
	ldr	w0, [x29, 564]
	cmp	w1, w0
	blt	.L32
	ldr	x3, [x29, 488]
	ldr	x2, [x29, 512]
	ldr	x1, [x29, 536]
	ldr	w0, [x29, 564]
	bl	matmul
	str	wzr, [x29, 588]
	b	.L33
.L34:
	lsr	x1, x19, 3
	ldr	x0, [x29, 488]
	add	x2, x1, 1
	ldrsw	x1, [x29, 588]
	mul	x1, x2, x1
	ldr	x0, [x0, x1, lsl 3]
	ldr	x1, [x29, 568]
	add	x0, x1, x0
	str	x0, [x29, 568]
	lsr	x1, x19, 3
	ldr	x0, [x29, 488]
	ldrsw	x2, [x29, 588]
	mul	x1, x2, x1
	ldr	x5, [x0, x1, lsl 3]
	lsr	x1, x19, 3
	ldr	w0, [x29, 564]
	lsr	w2, w0, 31
	add	w0, w2, w0
	asr	w0, w0, 1
	mov	w2, w0
	ldr	x0, [x29, 488]
	sxtw	x2, w2
	ldrsw	x3, [x29, 588]
	mul	x1, x3, x1
	add	x1, x2, x1
	ldr	x6, [x0, x1, lsl 3]
	lsr	x1, x19, 3
	ldr	w0, [x29, 564]
	sub	w2, w0, #1
	ldr	x0, [x29, 488]
	sxtw	x2, w2
	ldrsw	x3, [x29, 588]
	mul	x1, x3, x1
	add	x1, x2, x1
	ldr	x0, [x0, x1, lsl 3]
	mov	x4, x0
	mov	x3, x6
	mov	x2, x5
	ldr	w1, [x29, 588]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	w0, [x29, 588]
	add	w0, w0, 1
	str	w0, [x29, 588]
.L33:
	ldr	w1, [x29, 588]
	ldr	w0, [x29, 564]
	cmp	w1, w0
	blt	.L34
	ldr	w0, [x29, 108]
	lsl	w0, w0, 3
	mov	w2, w0
	mov	w1, w20
	mov	w0, w21
	mul	w0, w1, w0
	lsl	w0, w0, 3
	mov	w3, w0
	ldr	x1, [x29, 568]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w0, 1
	str	w0, [x29, 588]
	b	.L35
.L39:
	mov	x0, sp
	mov	x1, x0
	ldr	w2, [x29, 588]
	mov	w0, w2
	lsl	w0, w0, 1
	add	w0, w0, w2
	sxtw	x2, w0
	sub	x2, x2, #1
	str	x2, [x29, 480]
	sxtw	x2, w0
	str	x2, [x29, 144]
	str	xzr, [x29, 152]
	ldp	x4, x5, [x29, 144]
	mov	x2, x4
	lsr	x2, x2, 60
	mov	x3, x5
	lsl	x3, x3, 4
	str	x3, [x29, 328]
	ldr	x3, [x29, 328]
	add	x2, x2, x3
	str	x2, [x29, 328]
	mov	x2, x4
	lsl	x2, x2, 4
	str	x2, [x29, 320]
	sxtw	x2, w0
	str	x2, [x29, 128]
	str	xzr, [x29, 136]
	ldp	x4, x5, [x29, 128]
	mov	x2, x4
	lsr	x2, x2, 60
	mov	x3, x5
	lsl	x3, x3, 4
	str	x3, [x29, 312]
	ldr	x3, [x29, 312]
	add	x2, x2, x3
	str	x2, [x29, 312]
	mov	x2, x4
	lsl	x2, x2, 4
	str	x2, [x29, 304]
	sxtw	x0, w0
	lsl	x0, x0, 1
	add	x0, x0, 15
	lsr	x0, x0, 4
	lsl	x0, x0, 4
	sub	sp, sp, x0
	mov	x0, sp
	add	x0, x0, 1
	lsr	x0, x0, 1
	lsl	x0, x0, 1
	str	x0, [x29, 472]
	ldr	w0, [x29, 588]
	and	w2, w0, 65535
	mov	w0, -1111
	mul	w0, w2, w0
	and	w3, w0, 65535
	ldr	w2, [x29, 588]
	mov	w0, w2
	lsl	w0, w0, 1
	add	w0, w0, w2
	sub	w2, w0, #1
	sxth	w3, w3
	ldr	x0, [x29, 472]
	sxtw	x2, w2
	strh	w3, [x0, x2, lsl 1]
	ldr	w2, [x29, 588]
	mov	w0, w2
	lsl	w0, w0, 1
	add	w0, w0, w2
	cmp	w0, 50
	ble	.L36
	ldr	w2, [x29, 588]
	mov	w0, w2
	lsl	w0, w0, 1
	add	w0, w0, w2
	sub	w2, w0, #1
	ldr	x0, [x29, 472]
	sxtw	x2, w2
	ldrsh	w0, [x0, x2, lsl 1]
	str	w0, [x29, 580]
	mov	sp, x1
	b	.L38
.L36:
	mov	sp, x1
	ldr	w0, [x29, 588]
	add	w0, w0, 1
	str	w0, [x29, 588]
.L35:
	ldr	w0, [x29, 588]
	cmp	w0, 99
	ble	.L39
.L38:
	ldr	w2, [x29, 588]
	ldr	w1, [x29, 580]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	adrp	x0, rec_top
	add	x0, x0, :lo12:rec_top
	ldr	w0, [x0]
	bl	levels
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, mat_n
	add	x0, x0, :lo12:mat_n
	ldr	w0, [x0]
	add	w0, w0, 40
	bl	with_vla_and_call
	mov	x1, x0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	w0, 0
	ldr	x1, [x29, 112]
	mov	sp, x1
	mov	sp, x29
	ldp	x29, x30, [sp]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	add	sp, sp, 592
	ret

