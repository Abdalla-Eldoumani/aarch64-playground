	.text
	.data
	.align	2
walk_depth:
	.word	3000
	.align	2
ten_depth:
	.word	600
	.align	2
keep_depth:
	.word	1500
	.section .rodata
	.align	3
.LC0:
	.string	"walk n=%d c=%d s=%u i=%d l=%lld r=%016llx\n"
	.text
	.align	2
walk:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	x1, [sp, 16]
	ldr	w0, [sp, 28]
	and	w0, w0, 255
	mov	w1, w0
	mov	w0, w1
	ubfiz	w0, w0, 3, 5
	mov	w2, w1
	add	w0, w0, w2
	ubfiz	w0, w0, 2, 6
	mov	w2, w0
	mov	w0, w1
	add	w0, w2, w0
	and	w0, w0, 255
	strb	w0, [sp, 63]
	ldr	w0, [sp, 28]
	and	w1, w0, 65535
	mov	w0, 1009
	mul	w0, w1, w0
	strh	w0, [sp, 60]
	ldr	w1, [sp, 28]
	mov	w0, 23130
	eor	w0, w1, w0
	str	w0, [sp, 56]
	ldrsw	x1, [sp, 28]
	mov	x0, -16963
	movk	x0, 0xfff0, lsl 16
	mul	x0, x1, x0
	str	x0, [sp, 48]
	ldr	w0, [sp, 28]
	cmp	w0, 0
	bne	.L2
	ldr	x0, [sp, 16]
	b	.L3
.L2:
	ldr	w0, [sp, 28]
	sub	w2, w0, #1
	ldr	x1, [sp, 16]
	mov	x0, x1
	lsl	x0, x0, 5
	sub	x1, x0, x1
	ldr	w0, [sp, 28]
	uxtw	x0, w0
	add	x0, x1, x0
	mov	x1, x0
	mov	w0, w2
	bl	walk
	str	x0, [sp, 40]
	ldr	x1, [sp, 40]
	mov	x0, 435
	movk	x0, 0x100, lsl 32
	mul	x1, x1, x0
	ldrsb	w2, [sp, 63]
	ldrh	w0, [sp, 60]
	add	w2, w2, w0
	ldr	w0, [sp, 56]
	add	w0, w2, w0
	sxtw	x0, w0
	eor	x1, x1, x0
	ldr	x0, [sp, 48]
	eor	x0, x1, x0
	str	x0, [sp, 40]
	ldr	w0, [sp, 28]
	mov	w1, 1000
	sdiv	w2, w0, w1
	mov	w1, 1000
	mul	w1, w2, w1
	sub	w0, w0, w1
	cmp	w0, 0
	beq	.L4
	ldr	w0, [sp, 28]
	cmp	w0, 2
	bgt	.L5
.L4:
	ldrsb	w0, [sp, 63]
	ldrh	w1, [sp, 60]
	ldr	x6, [sp, 40]
	ldr	x5, [sp, 48]
	ldr	w4, [sp, 56]
	mov	w3, w1
	mov	w2, w0
	ldr	w1, [sp, 28]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
.L5:
	ldr	x0, [sp, 40]
.L3:
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"ten n=%d h=%d i=%d j=%u k=%lld r=%lld\n"
	.text
	.align	2
ten:
	sub	sp, sp, #112
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	str	w0, [sp, 92]
	str	x1, [sp, 80]
	str	w2, [sp, 88]
	str	x3, [sp, 72]
	str	w4, [sp, 68]
	str	x5, [sp, 56]
	str	w6, [sp, 64]
	str	x7, [sp, 48]
	ldr	w0, [sp, 92]
	cmp	w0, 0
	bne	.L7
	ldrsw	x1, [sp, 88]
	ldr	x0, [sp, 80]
	add	x1, x1, x0
	ldr	x0, [sp, 72]
	add	x1, x1, x0
	ldrsw	x0, [sp, 68]
	add	x1, x1, x0
	ldr	x0, [sp, 56]
	add	x1, x1, x0
	ldrsw	x0, [sp, 64]
	add	x1, x1, x0
	ldr	x0, [sp, 48]
	add	x1, x1, x0
	ldrsb	x0, [sp, 112]
	add	x1, x1, x0
	ldrsh	x0, [sp, 120]
	add	x1, x1, x0
	ldrb	w0, [sp, 128]
	add	x1, x1, x0
	ldr	x0, [sp, 136]
	add	x0, x1, x0
	b	.L8
.L7:
	ldr	w0, [sp, 92]
	sub	w8, w0, #1
	ldrsw	x1, [sp, 92]
	ldr	x0, [sp, 136]
	add	x9, x1, x0
	ldr	x0, [sp, 80]
	mov	w10, w0
	ldrsw	x3, [sp, 88]
	ldr	x0, [sp, 72]
	mov	w11, w0
	ldrsw	x4, [sp, 68]
	ldr	x0, [sp, 56]
	mov	w6, w0
	ldrsw	x5, [sp, 64]
	ldr	x0, [sp, 48]
	and	w1, w0, 255
	ldr	w0, [sp, 92]
	and	w0, w0, 255
	add	w0, w1, w0
	and	w0, w0, 255
	sxtb	w7, w0
	ldrsb	w0, [sp, 112]
	and	w1, w0, 65535
	mov	w0, 300
	mul	w0, w1, w0
	and	w0, w0, 65535
	sxth	w12, w0
	ldrh	w0, [sp, 120]
	and	w0, w0, 255
	add	w0, w0, 7
	and	w13, w0, 255
	ldrb	w2, [sp, 128]
	ldrsw	x1, [sp, 92]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	add	x0, x2, x0
	str	x0, [sp, 24]
	mov	w0, w13
	strb	w0, [sp, 16]
	mov	w0, w12
	strh	w0, [sp, 8]
	mov	w0, w7
	strb	w0, [sp]
	mov	x7, x5
	mov	x5, x4
	mov	w4, w11
	mov	w2, w10
	mov	x1, x9
	mov	w0, w8
	bl	ten
	str	x0, [sp, 104]
	ldr	w0, [sp, 92]
	mov	w1, 200
	sdiv	w2, w0, w1
	mov	w1, 200
	mul	w1, w2, w1
	sub	w0, w0, w1
	cmp	w0, 0
	beq	.L9
	ldr	w0, [sp, 92]
	cmp	w0, 1
	bne	.L10
.L9:
	ldrsb	w0, [sp, 112]
	ldrsh	w1, [sp, 120]
	ldrb	w2, [sp, 128]
	ldr	x6, [sp, 104]
	ldr	x5, [sp, 136]
	mov	w4, w2
	mov	w3, w1
	mov	w2, w0
	ldr	w1, [sp, 92]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
.L10:
	ldrsb	x0, [sp, 112]
	ldr	x1, [sp, 104]
	sub	x1, x1, x0
	ldrsh	x0, [sp, 120]
	add	x1, x1, x0
	ldrb	w0, [sp, 128]
	sub	x0, x1, x0
.L8:
	ldp	x29, x30, [sp, 32]
	add	sp, sp, 112
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"keep n=%d q=%.2f w=%.2f r=%016llx\n"
	.text
	.align	2
keep:
	stp	x29, x30, [sp, -144]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	x1, [sp, 16]
	ldr	x1, [sp, 16]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	str	x0, [sp, 136]
	ldr	x1, [sp, 16]
	mov	x0, 85
	eor	x0, x1, x0
	str	x0, [sp, 128]
	ldr	x0, [sp, 16]
	add	x0, x0, 7
	str	x0, [sp, 120]
	ldr	x0, [sp, 16]
	lsr	x0, x0, 3
	str	x0, [sp, 112]
	ldr	x0, [sp, 16]
	mul	x0, x0, x0
	str	x0, [sp, 104]
	ldr	x0, [sp, 16]
	mvn	x0, x0
	str	x0, [sp, 96]
	ldr	x0, [sp, 16]
	lsl	x0, x0, 5
	str	x0, [sp, 88]
	ldr	x0, [sp, 16]
	sub	x0, x0, #11
	str	x0, [sp, 80]
	ldr	x0, [sp, 16]
	orr	x0, x0, 256
	str	x0, [sp, 72]
	ldr	x0, [sp, 16]
	and	x0, x0, 4080
	str	x0, [sp, 64]
	ldr	w0, [sp, 28]
	scvtf	d30, w0
	fmov	d31, 2.5e-1
	fmul	d31, d30, d31
	str	d31, [sp, 56]
	ldr	d30, [sp, 56]
	fmov	d31, 1.5e+0
	fadd	d31, d30, d31
	str	d31, [sp, 48]
	ldr	w0, [sp, 28]
	cmp	w0, 0
	bne	.L12
	ldr	x0, [sp, 16]
	b	.L13
.L12:
	ldr	w0, [sp, 28]
	sub	w2, w0, #1
	ldr	x1, [sp, 16]
	mov	x0, 32557
	movk	x0, 0x4c95, lsl 16
	movk	x0, 0xf42d, lsl 32
	movk	x0, 0x5851, lsl 48
	mul	x1, x1, x0
	mov	x0, 33103
	movk	x0, 0xf767, lsl 16
	movk	x0, 0x7b7e, lsl 32
	movk	x0, 0x1405, lsl 48
	add	x0, x1, x0
	mov	x1, x0
	mov	w0, w2
	bl	keep
	str	x0, [sp, 40]
	ldr	x1, [sp, 136]
	ldr	x0, [sp, 128]
	sub	x1, x1, x0
	ldr	x0, [sp, 120]
	add	x1, x1, x0
	ldr	x0, [sp, 112]
	sub	x1, x1, x0
	ldr	x0, [sp, 104]
	add	x1, x1, x0
	ldr	x0, [sp, 96]
	sub	x1, x1, x0
	ldr	x0, [sp, 88]
	add	x1, x1, x0
	ldr	x0, [sp, 80]
	sub	x1, x1, x0
	ldr	x0, [sp, 72]
	add	x1, x1, x0
	ldr	x0, [sp, 64]
	sub	x0, x1, x0
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	str	x0, [sp, 40]
	ldr	d30, [sp, 56]
	fmov	d31, 4.0e+0
	fmul	d30, d30, d31
	ldr	d31, [sp, 48]
	fadd	d31, d30, d31
	fcvtzu	d31, d31
	ldr	x0, [sp, 40]
	fmov	x1, d31
	eor	x0, x0, x1
	str	x0, [sp, 40]
	ldr	w0, [sp, 28]
	mov	w1, 500
	sdiv	w2, w0, w1
	mov	w1, 500
	mul	w1, w2, w1
	sub	w0, w0, w1
	cmp	w0, 0
	bne	.L14
	ldr	x2, [sp, 40]
	ldr	d1, [sp, 48]
	ldr	d0, [sp, 56]
	ldr	w1, [sp, 28]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
.L14:
	ldr	x0, [sp, 40]
.L13:
	ldp	x29, x30, [sp], 144
	ret
	.section .rodata
	.align	3
.LC3:
	.string	"walk=%016llx\n"
	.align	3
.LC4:
	.string	"ten=%lld\n"
	.align	3
.LC5:
	.string	"keep=%016llx\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #80
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	adrp	x0, walk_depth
	add	x0, x0, :lo12:walk_depth
	ldr	w0, [x0]
	mov	x1, 5381
	bl	walk
	str	x0, [sp, 72]
	adrp	x0, ten_depth
	add	x0, x0, :lo12:ten_depth
	ldr	w0, [x0]
	mov	x1, -11
	str	x1, [sp, 24]
	mov	w1, 10
	strb	w1, [sp, 16]
	mov	w1, 9
	strh	w1, [sp, 8]
	mov	w1, -8
	strb	w1, [sp]
	mov	x7, 7
	mov	w6, -6
	mov	x5, 5
	mov	w4, -4
	mov	x3, 3
	mov	w2, -2
	mov	x1, 1
	bl	ten
	str	x0, [sp, 64]
	adrp	x0, keep_depth
	add	x0, x0, :lo12:keep_depth
	ldr	w0, [x0]
	mov	x1, 42
	bl	keep
	str	x0, [sp, 56]
	ldr	x1, [sp, 72]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	x1, [sp, 64]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	x1, [sp, 56]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	add	sp, sp, 80
	ret

