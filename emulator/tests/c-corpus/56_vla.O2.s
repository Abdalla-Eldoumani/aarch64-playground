	.text
	.align	2
	.p2align 5,,15
matmul:
	cmp	w0, 0
	ble	.L1
	ubfiz	x8, x0, 3, 32
	mov	x11, x1
	mov	x9, x3
	add	x10, x1, x8
	mov	w12, 0
	.p2align 5,,15
.L3:
	mov	x7, 0
	.p2align 5,,15
.L5:
	add	x4, x2, x7
	mov	x3, x11
	mov	x1, 0
	str	xzr, [x9, x7]
	.p2align 5,,15
.L4:
	ldr	x5, [x4]
	add	x4, x4, x8
	ldr	x6, [x3], 8
	madd	x1, x6, x5, x1
	str	x1, [x9, x7]
	cmp	x3, x10
	bne	.L4
	add	x7, x7, 8
	cmp	x7, x8
	bne	.L5
	add	w12, w12, 1
	add	x11, x11, x8
	add	x9, x9, x8
	add	x10, x10, x8
	cmp	w0, w12
	bne	.L3
.L1:
	ret
	.align	2
	.p2align 5,,15
nine:
	add	x1, x0, x1, lsl 1
	add	x2, x2, x2, lsl 1
	add	x1, x1, x2
	add	x4, x4, x4, lsl 2
	add	x3, x1, x3, lsl 2
	add	x5, x5, x5, lsl 1
	ldr	x8, [sp]
	add	x3, x3, x4
	add	x5, x3, x5, lsl 1
	add	x5, x5, x6, lsl 3
	sub	x5, x5, x6
	add	x8, x8, x8, lsl 3
	add	x0, x5, x7, lsl 3
	add	x0, x0, x8
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"churn pass=%d size=%d s=%llu\n"
	.text
	.align	2
	.p2align 5,,15
churn:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	adrp	x23, .LANCHOR0
	stp	x25, x26, [sp, 64]
	ldr	w0, [x23, :lo12:.LANCHOR0]
	cmp	w0, 0
	ble	.L14
	mov	w25, 30933
	mov	w24, 4718
	adrp	x21, .LC0
	add	x23, x23, :lo12:.LANCHOR0
	add	x21, x21, :lo12:.LC0
	mov	w20, 0
	mov	w19, 0
	mov	x22, 0
	movk	w25, 0x26e9, lsl 16
	movk	w24, 0x83, lsl 16
	b	.L13
	.p2align 2,,3
.L12:
	ldr	w0, [x23]
	add	w20, w20, 7
	add	w19, w19, 1
	mov	sp, x26
	and	w20, w20, 255
	cmp	w0, w19
	ble	.L10
.L13:
	ldr	w0, [x23, 4]
	and	w2, w19, 7
	mov	x26, sp
	asr	w3, w19, 3
	add	w2, w2, w0
	add	x22, x22, x22, lsl 5
	sxtw	x1, w2
	add	x1, x1, 15
	and	x1, x1, -16
	sub	sp, sp, x1
	sub	w1, w2, #1
	add	w0, w1, w1, lsr 31
	strb	w19, [sp]
	asr	w0, w0, 1
	strb	w3, [sp, w0, sxtw]
	strb	w20, [sp, w1, sxtw]
	ldrb	w0, [sp, w0, sxtw]
	ldrb	w4, [sp]
	add	x1, x0, w1, uxtw
	mul	w0, w19, w25
	add	x4, x4, w20, uxtw
	add	x1, x4, x1
	add	x22, x1, x22
	ror	w0, w0, 2
	cmp	w0, w24
	bhi	.L12
	mov	w1, w19
	mov	x3, x22
	mov	x0, x21
	bl	printf
	ldr	w0, [x23]
	add	w20, w20, 7
	add	w19, w19, 1
	mov	sp, x26
	and	w20, w20, 255
	cmp	w0, w19
	bgt	.L13
.L10:
	mov	sp, x29
	mov	x0, x22
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x29, x30, [sp], 80
	ret
.L14:
	mov	x22, 0
	b	.L10
	.align	2
	.p2align 5,,15
levels:
	add	w1, w0, 1
	stp	x29, x30, [sp, -32]!
	sbfiz	x1, x1, 2, 32
	mov	x29, sp
	add	x1, x1, 15
	and	x1, x1, -16
	sub	sp, sp, x1
	tbnz	w0, #31, .L22
	sxtw	x4, w0
	mov	x1, sp
	add	x4, x4, 1
	mov	w3, -50
	mov	x2, 0
	.p2align 5,,15
.L19:
	str	w3, [x1, x2, lsl 2]
	add	x2, x2, 1
	add	w3, w3, w0
	cmp	x2, x4
	bne	.L19
	mov	w2, w0
	mov	x0, 0
	cbnz	w2, .L28
.L20:
	add	x4, x1, w4, uxtw 2
	.p2align 5,,15
.L21:
	ldrsw	x2, [x1], 4
	add	x0, x0, x2
	cmp	x1, x4
	bne	.L21
	mov	sp, x29
	ldp	x29, x30, [sp], 32
	ret
	.p2align 2,,3
.L28:
	sub	w0, w2, #1
	stp	x1, x4, [x29, 16]
	bl	levels
	ldp	x1, x4, [x29, 16]
	b	.L20
	.p2align 2,,3
.L22:
	mov	sp, x29
	mov	x0, 0
	ldp	x29, x30, [sp], 32
	ret
	.align	2
	.p2align 5,,15
with_vla_and_call:
	sxtw	x2, w0
	stp	x29, x30, [sp, -16]!
	mov	x14, x2
	sbfiz	x0, x2, 3, 32
	mov	x29, sp
	add	x0, x0, 15
	sub	sp, sp, #16
	and	x0, x0, -16
	sub	sp, sp, x0
	mov	x0, 0
	add	x15, sp, 16
	cmp	w2, 0
	ble	.L32
	.p2align 5,,15
.L30:
	mul	w1, w0, w0
	sxtw	x1, w1
	str	x1, [x15, x0, lsl 3]
	add	x0, x0, 1
	cmp	x2, x0
	bne	.L30
	cmp	w14, 8
	ble	.L32
	mov	x9, x15
	mov	x10, 8
	ldp	x6, x7, [x15, 8]
	mov	x13, 0
	ldr	x12, [x15, 24]
	ldr	x11, [x9], 32
	.p2align 5,,15
.L33:
	mov	x0, x11
	mov	x1, x6
	mov	x2, x7
	mov	x3, x12
	add	x10, x10, 5
	ldr	x12, [x9, 32]
	ldp	x6, x7, [x9, 16]
	ldp	x4, x11, [x9], 40
	str	x12, [sp]
	mov	x5, x11
	bl	nine
	add	x13, x13, x0
	cmp	w14, w10
	bgt	.L33
.L31:
	sub	w14, w14, #1
	ldr	x0, [x15, w14, sxtw 3]
	mov	sp, x29
	add	x0, x13, x0
	ldp	x29, x30, [sp], 16
	ret
.L32:
	mov	x13, 0
	b	.L31
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
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -96]!
	mov	x29, sp
	stp	x21, x22, [sp, 32]
	adrp	x21, .LANCHOR0
	add	x21, x21, :lo12:.LANCHOR0
	stp	x19, x20, [sp, 16]
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	ldr	w27, [x21, 8]
	smull	x0, w27, w27
	lsl	x0, x0, 3
	add	x0, x0, 15
	and	x0, x0, -16
	sub	sp, sp, x0
	mov	x23, sp
	sub	sp, sp, x0
	mov	x24, sp
	sub	sp, sp, x0
	bl	churn
	mov	x22, sp
	mov	x1, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	cmp	w27, 0
	ble	.L41
	sxtw	x19, w27
	mov	x6, x23
	and	x20, x19, 2305843009213693951
	mov	x5, x24
	mov	x4, 0
	mov	w3, 0
	.p2align 5,,15
.L42:
	lsl	w7, w3, 1
	mov	x0, 0
	.p2align 5,,15
.L43:
	sub	x1, x4, x0
	cmp	w3, w0
	str	x1, [x6, x0, lsl 3]
	cinc	w1, w0, eq
	sub	w1, w1, w7
	sxtw	x1, w1
	str	x1, [x5, x0, lsl 3]
	add	x0, x0, 1
	cmp	x19, x0
	bne	.L43
	add	w3, w3, 1
	add	x4, x4, 3
	add	x6, x6, x19, lsl 3
	add	x5, x5, x19, lsl 3
	cmp	w27, w3
	bne	.L42
	mov	x2, x24
	mov	x1, x23
	sub	w24, w27, #1
	asr	w23, w27, 1
	adrp	x25, .LC2
	add	x26, x20, 1
	sxtw	x24, w24
	sxtw	x23, w23
	add	x25, x25, :lo12:.LC2
	mov	x28, 0
	mov	w19, 0
	mov	x3, x22
	mov	w0, w27
	bl	matmul
	.p2align 5,,15
.L46:
	sxtw	x0, w19
	mul	x1, x26, x0
	mul	x0, x0, x20
	add	x2, x24, x0
	ldr	x1, [x22, x1, lsl 3]
	ldr	x4, [x22, x2, lsl 3]
	add	x28, x28, x1
	add	x1, x23, x0
	ldr	x2, [x22, x0, lsl 3]
	mov	x0, x25
	ldr	x3, [x22, x1, lsl 3]
	mov	w1, w19
	add	w19, w19, 1
	bl	printf
	cmp	w27, w19
	bne	.L46
.L45:
	mul	w3, w27, w27
	lsl	w2, w27, 3
	mov	x1, x28
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	lsl	w3, w3, 3
	bl	printf
	mov	x4, sp
	mov	w3, 5
	mov	w2, 63314
	mov	x0, 12
	.p2align 5,,15
.L47:
	add	x1, x0, 15
	mov	sp, x4
	and	x1, x1, -16
	add	x0, x0, 6
	sub	sp, sp, x1
	strh	w2, [sp, w3, sxtw 1]
	sub	w2, w2, #1111
	add	w3, w3, 3
	cmp	x0, 108
	bne	.L47
	mov	w2, 17
	mov	w1, -18887
	adrp	x0, .LC4
	mov	sp, x4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w0, [x21, 12]
	bl	levels
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [x21, 8]
	add	w0, w0, 40
	bl	with_vla_and_call
	mov	x1, x0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	sp, x29
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 96
	ret
.L41:
	mov	x3, sp
	mov	x2, x24
	mov	x1, x23
	mov	w0, w27
	mov	x28, 0
	bl	matmul
	b	.L45
	.data
	.align	2
	.LANCHOR0:
loop_passes:
	.word	1500
loop_size:
	.word	6000
mat_n:
	.word	7
rec_top:
	.word	180

