	.text
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
	tbnz	w0, #31, .L6
	sxtw	x4, w0
	mov	x1, sp
	add	x4, x4, 1
	mov	w3, -50
	mov	x2, 0
	.p2align 5,,15
.L3:
	str	w3, [x1, x2, lsl 2]
	add	x2, x2, 1
	add	w3, w3, w0
	cmp	x2, x4
	bne	.L3
	mov	w2, w0
	mov	x0, 0
	cbnz	w2, .L13
.L4:
	add	x4, x1, w4, uxtw 2
	.p2align 5,,15
.L5:
	ldrsw	x2, [x1], 4
	add	x0, x0, x2
	cmp	x1, x4
	bne	.L5
	mov	sp, x29
	ldp	x29, x30, [sp], 32
	ret
	.p2align 2,,3
.L13:
	sub	w0, w2, #1
	stp	x1, x4, [x29, 16]
	bl	levels
	ldp	x1, x4, [x29, 16]
	b	.L4
	.p2align 2,,3
.L6:
	mov	sp, x29
	mov	x0, 0
	ldp	x29, x30, [sp], 32
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"churn pass=%d size=%d s=%llu\n"
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
	stp	x29, x30, [sp, -128]!
	adrp	x0, .LANCHOR0
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	add	x19, x0, :lo12:.LANCHOR0
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	ldr	w24, [x0, :lo12:.LANCHOR0]
	sxtw	x26, w24
	smull	x0, w24, w24
	lsl	x0, x0, 3
	add	x0, x0, 15
	and	x0, x0, -16
	sub	sp, sp, x0
	mov	x1, sp
	sub	sp, sp, x0
	mov	x25, sp
	sub	sp, sp, x0
	ldr	w0, [x19, 4]
	mov	x23, sp
	str	x1, [x29, 104]
	cmp	w0, 0
	ble	.L34
	mov	w20, 30933
	mov	w22, 4718
	adrp	x0, .LC0
	mov	w28, 0
	add	x0, x0, :lo12:.LC0
	mov	x21, 0
	mov	w27, 0
	movk	w20, 0x26e9, lsl 16
	movk	w22, 0x83, lsl 16
	str	x0, [x29, 112]
	b	.L17
.L16:
	ldr	w0, [x19, 4]
	add	w28, w28, 7
	add	w27, w27, 1
	mov	sp, x4
	and	w28, w28, 255
	cmp	w27, w0
	bge	.L15
.L17:
	ldr	w0, [x19, 8]
	and	w2, w27, 7
	mov	x4, sp
	asr	w7, w27, 3
	add	w2, w2, w0
	add	x3, x21, x21, lsl 5
	sxtw	x0, w2
	add	x0, x0, 15
	and	x0, x0, -16
	sub	sp, sp, x0
	sub	w0, w2, #1
	add	w1, w0, w0, lsr 31
	strb	w27, [sp]
	asr	w1, w1, 1
	strb	w7, [sp, w1, sxtw]
	strb	w28, [sp, w0, sxtw]
	ldrb	w1, [sp, w1, sxtw]
	add	x0, x1, w0, uxtw
	ldrb	w1, [sp]
	add	x1, x1, w28, uxtw
	add	x0, x0, x1
	add	x21, x0, x3
	mul	w0, w27, w20
	ror	w0, w0, 2
	cmp	w0, w22
	bhi	.L16
	ldr	x0, [x29, 112]
	mov	w1, w27
	mov	x3, x21
	str	x4, [x29, 120]
	add	w28, w28, 7
	add	w27, w27, 1
	bl	printf
	and	w28, w28, 255
	ldr	x4, [x29, 120]
	ldr	w0, [x19, 4]
	mov	sp, x4
	cmp	w27, w0
	blt	.L17
.L15:
	mov	x1, x21
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	x21, 0
	cmp	w24, 0
	ble	.L19
	ldr	x4, [x29, 104]
	lsl	x6, x26, 3
	and	x20, x26, 2305843009213693951
	mov	x5, x25
	mov	x9, x4
	mov	x3, 0
	mov	w2, 0
	.p2align 5,,15
.L21:
	lsl	w7, w2, 1
	mov	x0, 0
	.p2align 5,,15
.L20:
	sub	x1, x3, x0
	cmp	w2, w0
	str	x1, [x4, x0, lsl 3]
	cinc	w1, w0, eq
	sub	w1, w1, w7
	sxtw	x1, w1
	str	x1, [x5, x0, lsl 3]
	add	x0, x0, 1
	cmp	x26, x0
	bne	.L20
	add	w2, w2, 1
	add	x3, x3, 3
	add	x4, x4, x6
	add	x5, x5, x6
	cmp	w24, w2
	bne	.L21
	ldr	x0, [x29, 104]
	mov	x7, x23
	mov	w10, 0
	add	x8, x0, x6
	.p2align 5,,15
.L22:
	mov	x5, 0
	.p2align 5,,15
.L24:
	add	x2, x25, x5
	mov	x1, x9
	mov	x0, 0
	str	xzr, [x7, x5]
	.p2align 5,,15
.L23:
	ldr	x3, [x2]
	add	x2, x2, x6
	ldr	x4, [x1], 8
	madd	x0, x4, x3, x0
	str	x0, [x7, x5]
	cmp	x8, x1
	bne	.L23
	add	x5, x5, 8
	cmp	x6, x5
	bne	.L24
	add	w10, w10, 1
	add	x9, x9, x6
	add	x7, x7, x6
	add	x8, x8, x6
	cmp	w24, w10
	bne	.L22
	asr	w22, w24, 1
	sub	w25, w24, #1
	adrp	x26, .LC2
	add	x27, x20, 1
	sxtw	x25, w25
	sxtw	x22, w22
	add	x26, x26, :lo12:.LC2
	mov	x21, 0
	mov	w28, 0
	.p2align 5,,15
.L26:
	sxtw	x0, w28
	mul	x1, x27, x0
	mul	x0, x0, x20
	add	x2, x25, x0
	ldr	x1, [x23, x1, lsl 3]
	ldr	x4, [x23, x2, lsl 3]
	add	x21, x21, x1
	add	x1, x22, x0
	ldr	x2, [x23, x0, lsl 3]
	mov	x0, x26
	ldr	x3, [x23, x1, lsl 3]
	mov	w1, w28
	add	w28, w28, 1
	bl	printf
	cmp	w24, w28
	bne	.L26
.L19:
	mul	w3, w24, w24
	lsl	w2, w24, 3
	mov	x1, x21
	adrp	x0, .LC3
	mov	x20, sp
	add	x0, x0, :lo12:.LC3
	lsl	w3, w3, 3
	bl	printf
	mov	w3, 5
	mov	w2, 63314
	mov	x0, 12
	.p2align 5,,15
.L27:
	add	x1, x0, 15
	mov	sp, x20
	and	x1, x1, -16
	add	x0, x0, 6
	sub	sp, sp, x1
	strh	w2, [sp, w3, sxtw 1]
	sub	w2, w2, #1111
	add	w3, w3, 3
	cmp	x0, 108
	bne	.L27
	mov	w2, 17
	mov	w1, -18887
	adrp	x0, .LC4
	mov	sp, x20
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w0, [x19, 12]
	bl	levels
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, .LANCHOR0
	ldr	w11, [x0, :lo12:.LANCHOR0]
	add	w9, w11, 40
	sbfiz	x0, x9, 3, 32
	add	x0, x0, 15
	and	x0, x0, -16
	sub	sp, sp, x0
	mov	x10, sp
	cmp	w9, 0
	ble	.L28
	mov	x0, 0
	.p2align 5,,15
.L29:
	mul	w1, w0, w0
	sxtw	x1, w1
	str	x1, [x10, x0, lsl 3]
	add	x0, x0, 1
	cmp	w9, w0
	bgt	.L29
	cmp	w9, 8
	ble	.L28
	mov	x2, x10
	mov	x8, 8
	ldp	x6, x12, [x10, 8]
	mov	x1, 0
	ldr	x7, [x10, 24]
	ldr	x3, [x2], 32
	.p2align 5,,15
.L32:
	add	x0, x3, x6, lsl 1
	add	x5, x12, x12, lsl 1
	add	x8, x8, 5
	add	x0, x0, x5
	ldp	x6, x12, [x2, 16]
	add	x4, x0, x7, lsl 2
	ldr	x7, [x2, 32]
	ldp	x0, x3, [x2], 40
	add	x0, x0, x0, lsl 2
	add	x4, x4, x0
	add	x0, x3, x3, lsl 1
	add	x0, x4, x0, lsl 1
	lsl	x4, x6, 3
	sub	x4, x4, x6
	add	x0, x0, x4
	add	x4, x7, x7, lsl 3
	add	x0, x0, x12, lsl 3
	add	x0, x0, x4
	add	x1, x1, x0
	cmp	w9, w8
	bgt	.L32
.L31:
	add	w11, w11, 39
	ldr	x0, [x10, w11, sxtw 3]
	mov	sp, x20
	add	x1, x1, x0
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
	ldp	x29, x30, [sp], 128
	ret
.L34:
	mov	x21, 0
	b	.L15
.L28:
	mov	x1, 0
	b	.L31
	.data
	.align	2
	.LANCHOR0:
mat_n:
	.word	7
loop_passes:
	.word	1500
loop_size:
	.word	6000
rec_top:
	.word	180

