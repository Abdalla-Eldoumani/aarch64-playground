	.text
	.section .rodata
	.align	3
.LC0:
	.string	"walk n=%d c=%d s=%u i=%d l=%lld r=%016llx\n"
	.text
	.align	2
	.align 5
walk:
	mov	x6, x1
	cbnz	w0, .L15
	mov	x0, x1
	ret
	.align 2
.L15:
	mov	w5, 48573
	stp	x29, x30, [sp, -48]!
	movk	w5, 0xfff0, lsl 16
	mov	w7, w0
	mov	w4, 23130
	smull	x5, w0, w5
	eor	w4, w0, w4
	lsl	x1, x1, 5
	mov	x29, sp
	sub	x1, x1, x6
	str	w7, [sp, 24]
	add	x1, x1, w0, uxtw
	sub	w0, w0, #1
	str	x5, [sp, 32]
	str	w4, [sp, 44]
	bl	walk
	ldr	w7, [sp, 24]
	mov	w3, 1009
	ldr	w4, [sp, 44]
	mov	x1, 435
	ldr	x5, [sp, 32]
	add	w6, w7, w7, lsl 3
	mul	w3, w7, w3
	movk	x1, 0x100, lsl 32
	add	w6, w7, w6, lsl 2
	and	w3, w3, 65535
	mul	x0, x0, x1
	sxtb	w2, w6
	add	w6, w3, w6, sxtb
	add	w6, w6, w4
	mov	w1, 1000
	sxtw	x6, w6
	eor	x6, x6, x5
	eor	x6, x6, x0
	sdiv	w0, w7, w1
	msub	w0, w0, w1, w7
	cmp	w0, 0
	ccmp	w7, 2, 4, ne
	bgt	.L2
	mov	w1, w7
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	str	x6, [sp, 24]
	bl	printf
	ldr	x6, [sp, 24]
.L2:
	mov	x0, x6
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"ten n=%d h=%d i=%d j=%u k=%lld r=%lld\n"
	.text
	.align	2
	.align 5
ten:
	sub	sp, sp, #96
	mov	x16, x3
	mov	x15, x5
	sxtw	x3, w2
	sxtw	x5, w4
	sxtw	x6, w6
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	ldrsb	x11, [sp, 96]
	ldrsh	x10, [sp, 104]
	ldrb	w9, [sp, 112]
	cbnz	w0, .L17
	add	x2, x1, x3
	add	x3, x2, x16
	add	x3, x3, x5
	add	x5, x3, x15
	add	x5, x5, x6
	add	x0, x5, x7
	ldr	x1, [sp, 120]
	add	x0, x0, x11
	add	x0, x0, x10
	add	x0, x0, x9
	ldp	x29, x30, [sp, 32]
	add	x0, x0, x1
	add	sp, sp, 96
	ret
	.align 2
.L17:
	mov	w8, w0
	mov	w0, 3
	add	w7, w8, w7
	strb	w7, [sp]
	mov	w2, w1
	mov	x7, x6
	smaddl	x0, w8, w0, x9
	mov	w6, w15
	str	x0, [sp, 24]
	add	w0, w10, 7
	strb	w0, [sp, 16]
	mov	w0, 300
	mov	w4, w16
	str	w8, [sp, 48]
	mul	w0, w11, w0
	stp	x9, x11, [sp, 56]
	strh	w0, [sp, 8]
	ldr	x0, [sp, 120]
	str	x10, [sp, 72]
	stp	w11, w10, [sp, 84]
	str	w9, [sp, 92]
	add	x1, x0, w8, sxtw
	sub	w0, w8, #1
	bl	ten
	mov	x6, x0
	ldr	w8, [sp, 48]
	mov	w1, 200
	ldr	x10, [sp, 72]
	ldp	x9, x11, [sp, 56]
	sdiv	w0, w8, w1
	msub	w0, w0, w1, w8
	cmp	w0, 0
	ccmp	w8, 1, 4, ne
	bne	.L19
	ldr	w4, [sp, 92]
	mov	w1, w8
	ldr	x5, [sp, 120]
	adrp	x0, .LC1
	ldp	w2, w3, [sp, 84]
	add	x0, x0, :lo12:.LC1
	str	x6, [sp, 48]
	bl	printf
	ldp	x6, x9, [sp, 48]
	ldp	x11, x10, [sp, 64]
.L19:
	sub	x0, x6, x11
	add	x0, x0, x10
	ldp	x29, x30, [sp, 32]
	sub	x0, x0, x9
	add	sp, sp, 96
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"keep n=%d q=%.2f w=%.2f r=%016llx\n"
	.text
	.align	2
	.align 5
keep:
	mov	x2, x1
	cbnz	w0, .L34
	mov	x0, x1
	ret
	.align 2
.L34:
	stp	x29, x30, [sp, -64]!
	add	x4, x1, 3
	orr	x3, x1, 256
	mov	x29, sp
	mov	w5, w0
	mul	x4, x4, x1
	add	x3, x3, x1, lsl 5
	mov	x1, 32557
	stp	d14, d15, [sp, 16]
	scvtf	d15, w0, #2
	mov	x0, 33103
	movk	x1, 0x4c95, lsl 16
	movk	x0, 0xf767, lsl 16
	movk	x1, 0xf42d, lsl 32
	movk	x0, 0x7b7e, lsl 32
	fmov	d14, 1.5e+0
	movk	x0, 0x1405, lsl 48
	movk	x1, 0x5851, lsl 48
	fadd	d14, d15, d14
	str	w5, [sp, 32]
	madd	x1, x2, x1, x0
	sub	w0, w5, #1
	stp	x2, x3, [sp, 40]
	str	x4, [sp, 56]
	bl	keep
	ldp	x2, x3, [sp, 40]
	fmov	d31, 4.0e+0
	ldr	x4, [sp, 56]
	fmadd	d31, d15, d31, d14
	ldr	w5, [sp, 32]
	mvn	x1, x2
	sub	x3, x3, x1
	and	x1, x2, 4080
	sub	x3, x3, x1
	add	x3, x3, x0
	mov	x0, 85
	eor	x0, x2, x0
	sub	x4, x4, x0
	fcvtzu	x0, d31
	sub	x2, x4, x2, lsr 3
	add	x2, x2, 18
	add	x2, x2, x3
	mov	w3, 30933
	movk	w3, 0x26e9, lsl 16
	eor	x2, x0, x2
	mov	w0, 9436
	movk	w0, 0x106, lsl 16
	madd	w3, w5, w3, w0
	mov	w0, 4718
	movk	w0, 0x83, lsl 16
	ror	w3, w3, 2
	cmp	w3, w0
	bls	.L35
	ldp	d14, d15, [sp, 16]
	mov	x0, x2
	ldp	x29, x30, [sp], 64
	ret
	.align 2
.L35:
	fmov	d1, d14
	fmov	d0, d15
	mov	w1, w5
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	str	x2, [sp, 32]
	bl	printf
	ldr	x2, [sp, 32]
	ldp	d14, d15, [sp, 16]
	mov	x0, x2
	ldp	x29, x30, [sp], 64
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
	.align 5
	.global	main
main:
	sub	sp, sp, #80
	adrp	x0, .LANCHOR0
	mov	x1, 5381
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	stp	x19, x20, [sp, 48]
	add	x19, x0, :lo12:.LANCHOR0
	ldr	w0, [x0, :lo12:.LANCHOR0]
	str	x21, [sp, 64]
	bl	walk
	mov	x21, x0
	mov	x0, -11
	str	x0, [sp, 24]
	mov	w0, 10
	strb	w0, [sp, 16]
	mov	w0, 9
	strh	w0, [sp, 8]
	mov	w0, -8
	strb	w0, [sp]
	mov	x7, 7
	mov	w6, -6
	ldr	w0, [x19, 4]
	mov	x5, 5
	mov	w4, -4
	mov	x3, 3
	mov	w2, -2
	mov	x1, 1
	bl	ten
	mov	x20, x0
	ldr	w0, [x19, 8]
	mov	x1, 42
	bl	keep
	mov	x19, x0
	mov	x1, x21
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	x1, x20
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	x1, x19
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	x21, [sp, 64]
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	ldp	x19, x20, [sp, 48]
	add	sp, sp, 80
	ret
	.data
	.align	2
	.LANCHOR0:
walk_depth:
	.word	3000
ten_depth:
	.word	600
keep_depth:
	.word	1500

