	.text
	.data
	.align	2
calls:
	.word	3000
	.align	3
odd_sizes:
	.word	1
	.word	3
	.word	17
	.word	33
	.word	100
	.word	4097
	.align	2
chain_depth:
	.word	120
	.section .rodata
	.align	3
.LC0:
	.string	"alloca(%d): mod16=%d len=%d first=%c\n"
	.text
	.align	2
odd:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x19, [sp, 16]
	str	wzr, [x29, 44]
	b	.L2
.L5:
	adrp	x0, odd_sizes
	add	x0, x0, :lo12:odd_sizes
	ldrsw	x1, [x29, 44]
	ldr	w0, [x0, x1, lsl 2]
	str	w0, [x29, 40]
	ldrsw	x0, [x29, 40]
	add	x0, x0, 15
	lsr	x0, x0, 4
	lsl	x0, x0, 4
	sub	sp, sp, x0
	mov	x0, sp
	add	x0, x0, 15
	lsr	x0, x0, 4
	lsl	x0, x0, 4
	str	x0, [x29, 32]
	ldr	w0, [x29, 44]
	add	w0, w0, 97
	ldrsw	x1, [x29, 40]
	mov	x2, x1
	mov	w1, w0
	ldr	x0, [x29, 32]
	bl	memset
	ldrsw	x0, [x29, 40]
	sub	x0, x0, #1
	ldr	x1, [x29, 32]
	add	x0, x1, x0
	strb	wzr, [x0]
	ldr	x0, [x29, 32]
	and	w19, w0, 15
	ldr	x0, [x29, 32]
	bl	strlen
	mov	w1, w0
	ldr	w0, [x29, 40]
	cmp	w0, 1
	ble	.L3
	ldr	x0, [x29, 32]
	ldrb	w0, [x0]
	b	.L4
.L3:
	mov	w0, 45
.L4:
	mov	w4, w0
	mov	w3, w1
	mov	w2, w19
	ldr	w1, [x29, 40]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w0, [x29, 44]
	add	w0, w0, 1
	str	w0, [x29, 44]
.L2:
	ldr	w0, [x29, 44]
	cmp	w0, 5
	ble	.L5
	nop
	nop
	mov	sp, x29
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"block %d of %d"
	.align	3
.LC2:
	.string	"pile: %s | %s | total=%d\n"
	.text
	.align	2
pile:
	stp	x29, x30, [sp, -352]!
	mov	x29, sp
	str	wzr, [x29, 344]
	str	wzr, [x29, 348]
	b	.L7
.L8:
	ldr	w0, [x29, 348]
	add	w0, w0, 24
	sxtw	x0, w0
	add	x0, x0, 15
	lsr	x0, x0, 4
	lsl	x0, x0, 4
	sub	sp, sp, x0
	mov	x0, sp
	add	x0, x0, 15
	lsr	x0, x0, 4
	lsl	x0, x0, 4
	mov	x2, x0
	ldrsw	x0, [x29, 348]
	lsl	x0, x0, 3
	add	x1, x29, 24
	str	x2, [x1, x0]
	ldrsw	x0, [x29, 348]
	lsl	x0, x0, 3
	add	x1, x29, 24
	ldr	x4, [x1, x0]
	mov	w3, 40
	ldr	w2, [x29, 348]
	adrp	x0, .LC1
	add	x1, x0, :lo12:.LC1
	mov	x0, x4
	bl	sprintf
	ldr	w0, [x29, 348]
	add	w0, w0, 1
	str	w0, [x29, 348]
.L7:
	ldr	w0, [x29, 348]
	cmp	w0, 39
	ble	.L8
	str	wzr, [x29, 348]
	b	.L9
.L10:
	ldrsw	x0, [x29, 348]
	lsl	x0, x0, 3
	add	x1, x29, 24
	ldr	x0, [x1, x0]
	bl	strlen
	mov	w1, w0
	ldr	w0, [x29, 348]
	add	w0, w0, 1
	mul	w0, w1, w0
	ldr	w1, [x29, 344]
	add	w0, w1, w0
	str	w0, [x29, 344]
	ldr	w0, [x29, 348]
	add	w0, w0, 1
	str	w0, [x29, 348]
.L9:
	ldr	w0, [x29, 348]
	cmp	w0, 39
	ble	.L10
	ldr	x0, [x29, 24]
	ldr	x1, [x29, 336]
	ldr	w3, [x29, 344]
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	nop
	mov	sp, x29
	ldp	x29, x30, [sp], 352
	ret
	.align	2
once:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	w0, [x29, 28]
	sub	sp, sp, #4096
	mov	x0, sp
	add	x0, x0, 15
	lsr	x0, x0, 4
	lsl	x0, x0, 4
	str	x0, [x29, 40]
	ldr	w0, [x29, 28]
	and	w1, w0, 255
	ldr	x0, [x29, 40]
	strb	w1, [x0]
	ldr	w0, [x29, 28]
	asr	w1, w0, 4
	ldr	x0, [x29, 40]
	add	x0, x0, 4095
	and	w1, w1, 255
	strb	w1, [x0]
	ldr	x0, [x29, 40]
	ldrb	w0, [x0]
	mov	w1, w0
	ldr	x0, [x29, 40]
	add	x0, x0, 4095
	ldrb	w0, [x0]
	add	w0, w1, w0
	mov	sp, x29
	ldp	x29, x30, [sp], 48
	ret
	.align	2
chain:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	w0, [x29, 28]
	str	x1, [x29, 16]
	sub	sp, sp, #48
	mov	x0, sp
	add	x0, x0, 15
	lsr	x0, x0, 4
	lsl	x0, x0, 4
	str	x0, [x29, 56]
	str	xzr, [x29, 48]
	ldr	x0, [x29, 56]
	ldr	x1, [x29, 16]
	str	x1, [x0]
	str	wzr, [x29, 44]
	b	.L14
.L15:
	ldrsw	x1, [x29, 28]
	ldr	w0, [x29, 44]
	add	w0, w0, 1
	sxtw	x0, w0
	mul	x0, x1, x0
	sub	x2, x0, #200
	ldr	x1, [x29, 56]
	ldrsw	x0, [x29, 44]
	lsl	x0, x0, 3
	add	x0, x1, x0
	str	x2, [x0, 8]
	ldr	w0, [x29, 44]
	add	w0, w0, 1
	str	w0, [x29, 44]
.L14:
	ldr	w0, [x29, 44]
	cmp	w0, 3
	ble	.L15
	ldr	w0, [x29, 28]
	cmp	w0, 0
	ble	.L16
	ldr	w0, [x29, 28]
	sub	w0, w0, #1
	ldr	x1, [x29, 56]
	bl	chain
	b	.L17
.L16:
	str	wzr, [x29, 44]
	b	.L18
.L19:
	ldr	x1, [x29, 48]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x1, x0, x1
	ldr	w0, [x29, 44]
	negs	w2, w0
	and	w0, w0, 3
	and	w2, w2, 3
	csneg	w0, w0, w2, mi
	ldr	x2, [x29, 56]
	sxtw	x0, w0
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	x0, [x0, 8]
	add	x0, x1, x0
	str	x0, [x29, 48]
	ldr	x0, [x29, 56]
	ldr	x0, [x0]
	str	x0, [x29, 56]
	ldr	w0, [x29, 44]
	add	w0, w0, 1
	str	w0, [x29, 44]
.L18:
	ldr	x0, [x29, 56]
	cmp	x0, 0
	bne	.L19
	ldrsw	x1, [x29, 44]
	ldr	x0, [x29, 48]
	add	x0, x1, x0
.L17:
	mov	sp, x29
	ldp	x29, x30, [sp], 64
	ret
	.align	2
survive:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	w0, [x29, 28]
	ldrsw	x0, [x29, 28]
	lsl	x0, x0, 2
	add	x0, x0, 15
	lsr	x0, x0, 4
	lsl	x0, x0, 4
	sub	sp, sp, x0
	mov	x0, sp
	add	x0, x0, 15
	lsr	x0, x0, 4
	lsl	x0, x0, 4
	str	x0, [x29, 48]
	str	wzr, [x29, 56]
	str	wzr, [x29, 60]
	b	.L21
.L22:
	ldrsw	x0, [x29, 60]
	lsl	x0, x0, 2
	ldr	x1, [x29, 48]
	add	x1, x1, x0
	ldr	w0, [x29, 60]
	mul	w0, w0, w0
	str	w0, [x1]
	ldr	w0, [x29, 60]
	add	w0, w0, 1
	str	w0, [x29, 60]
.L21:
	ldr	w1, [x29, 60]
	ldr	w0, [x29, 28]
	cmp	w1, w0
	blt	.L22
	mov	x0, sp
	mov	x11, x0
	ldr	w0, [x29, 28]
	lsl	w0, w0, 2
	sxtw	x1, w0
	sub	x1, x1, #1
	str	x1, [x29, 40]
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
	str	x0, [x29, 32]
	str	wzr, [x29, 60]
	b	.L23
.L24:
	ldr	x0, [x29, 32]
	ldrsw	x1, [x29, 60]
	mov	w2, -1
	str	w2, [x0, x1, lsl 2]
	ldr	w0, [x29, 60]
	add	w0, w0, 1
	str	w0, [x29, 60]
.L23:
	ldr	w0, [x29, 28]
	lsl	w0, w0, 2
	ldr	w1, [x29, 60]
	cmp	w1, w0
	blt	.L24
	ldr	x0, [x29, 32]
	ldrsw	x1, [x29, 28]
	ldr	w0, [x0, x1, lsl 2]
	ldr	w1, [x29, 56]
	add	w0, w1, w0
	str	w0, [x29, 56]
	mov	sp, x11
	str	wzr, [x29, 60]
	b	.L25
.L26:
	ldrsw	x0, [x29, 60]
	lsl	x0, x0, 2
	ldr	x1, [x29, 48]
	add	x0, x1, x0
	ldr	w0, [x0]
	ldr	w1, [x29, 56]
	add	w0, w1, w0
	str	w0, [x29, 56]
	ldr	w0, [x29, 60]
	add	w0, w0, 1
	str	w0, [x29, 60]
.L25:
	ldr	w1, [x29, 60]
	ldr	w0, [x29, 28]
	cmp	w1, w0
	blt	.L26
	ldr	w0, [x29, 56]
	mov	sp, x29
	ldp	x29, x30, [sp], 64
	ret
	.align	2
big:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	w0, [x29, 28]
	ldrsw	x0, [x29, 28]
	add	x0, x0, 15
	lsr	x0, x0, 4
	lsl	x0, x0, 4
	sub	sp, sp, x0
	mov	x0, sp
	add	x0, x0, 15
	lsr	x0, x0, 4
	lsl	x0, x0, 4
	str	x0, [x29, 32]
	str	wzr, [x29, 44]
	ldrsw	x0, [x29, 28]
	mov	x2, x0
	mov	w1, 17
	ldr	x0, [x29, 32]
	bl	memset
	str	wzr, [x29, 40]
	b	.L29
.L30:
	ldrsw	x0, [x29, 40]
	ldr	x1, [x29, 32]
	add	x0, x1, x0
	ldr	w1, [x29, 40]
	and	w1, w1, 255
	strb	w1, [x0]
	ldr	w1, [x29, 40]
	mov	w0, 4099
	add	w0, w1, w0
	str	w0, [x29, 40]
.L29:
	ldr	w1, [x29, 40]
	ldr	w0, [x29, 28]
	cmp	w1, w0
	blt	.L30
	str	wzr, [x29, 40]
	b	.L31
.L32:
	ldr	w1, [x29, 44]
	mov	w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	ldrsw	x1, [x29, 40]
	ldr	x2, [x29, 32]
	add	x1, x2, x1
	ldrb	w1, [x1]
	add	w0, w0, w1
	str	w0, [x29, 44]
	ldr	w0, [x29, 40]
	add	w0, w0, 997
	str	w0, [x29, 40]
.L31:
	ldr	w1, [x29, 40]
	ldr	w0, [x29, 28]
	cmp	w1, w0
	blt	.L32
	ldrsw	x0, [x29, 28]
	sub	x0, x0, #1
	ldr	x1, [x29, 32]
	add	x0, x1, x0
	ldrb	w0, [x0]
	mov	w1, w0
	ldr	w0, [x29, 44]
	add	w0, w1, w0
	mov	sp, x29
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC3:
	.string	"once x%d: sum=%lld\n"
	.align	3
.LC4:
	.string	"chain=%llu\n"
	.align	3
.LC5:
	.string	"survive=%d\n"
	.align	3
.LC6:
	.string	"big=%u\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	xzr, [sp, 24]
	bl	odd
	bl	pile
	str	wzr, [sp, 20]
	b	.L35
.L36:
	ldr	w0, [sp, 20]
	bl	once
	sxtw	x0, w0
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	str	x0, [sp, 24]
	ldr	w0, [sp, 20]
	add	w0, w0, 1
	str	w0, [sp, 20]
.L35:
	adrp	x0, calls
	add	x0, x0, :lo12:calls
	ldr	w0, [x0]
	ldr	w1, [sp, 20]
	cmp	w1, w0
	blt	.L36
	adrp	x0, calls
	add	x0, x0, :lo12:calls
	ldr	w0, [x0]
	ldr	x2, [sp, 24]
	mov	w1, w0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	adrp	x0, chain_depth
	add	x0, x0, :lo12:chain_depth
	ldr	w0, [x0]
	mov	x1, 0
	bl	chain
	mov	x1, x0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, 25
	bl	survive
	mov	w1, w0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w0, 4464
	movk	w0, 0x1, lsl 16
	bl	big
	mov	w1, w0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret

