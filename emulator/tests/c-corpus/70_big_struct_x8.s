	.text
	.align	2
	.global	cross
cross:
	stp	x19, x20, [sp, -48]!
	mov	x3, x8
	mov	x20, x0
	mov	x19, x1
	ldr	x1, [x20, 8]
	ldr	x0, [x19, 16]
	mul	x1, x1, x0
	ldr	x2, [x20, 16]
	ldr	x0, [x19, 8]
	mul	x0, x2, x0
	sub	x0, x1, x0
	str	x0, [sp, 24]
	ldr	x1, [x20, 16]
	ldr	x0, [x19]
	mul	x1, x1, x0
	ldr	x2, [x20]
	ldr	x0, [x19, 16]
	mul	x0, x2, x0
	sub	x0, x1, x0
	str	x0, [sp, 32]
	ldr	x1, [x20]
	ldr	x0, [x19, 8]
	mul	x1, x1, x0
	ldr	x2, [x20, 8]
	ldr	x0, [x19]
	mul	x0, x2, x0
	sub	x0, x1, x0
	str	x0, [sp, 40]
	add	x2, sp, 24
	ldp	x0, x1, [x2]
	ldr	x2, [x2, 16]
	stp	x0, x1, [x3]
	str	x2, [x3, 16]
	ldp	x19, x20, [sp], 48
	ret
	.align	2
	.global	add3
add3:
	stp	x19, x20, [sp, -48]!
	mov	x2, x8
	mov	x20, x0
	mov	x19, x1
	ldr	x1, [x20]
	ldr	x0, [x19]
	add	x0, x1, x0
	str	x0, [sp, 24]
	ldr	x1, [x20, 8]
	ldr	x0, [x19, 8]
	add	x0, x1, x0
	str	x0, [sp, 32]
	ldr	x1, [x20, 16]
	ldr	x0, [x19, 16]
	add	x0, x1, x0
	str	x0, [sp, 40]
	mov	x3, x2
	add	x2, sp, 24
	ldp	x0, x1, [x2]
	ldr	x2, [x2, 16]
	stp	x0, x1, [x3]
	str	x2, [x3, 16]
	ldp	x19, x20, [sp], 48
	ret
	.align	2
	.global	scale
scale:
	str	x19, [sp, -32]!
	mov	x2, x8
	mov	x19, x0
	str	x1, [sp, 24]
	ldr	x1, [x19]
	ldr	x0, [sp, 24]
	mul	x0, x1, x0
	str	x0, [x19]
	ldr	x1, [x19, 8]
	ldr	x0, [sp, 24]
	mul	x0, x1, x0
	str	x0, [x19, 8]
	ldr	x1, [x19, 16]
	ldr	x0, [sp, 24]
	mul	x0, x1, x0
	str	x0, [x19, 16]
	mov	x3, x19
	ldp	x0, x1, [x3]
	ldr	x3, [x3, 16]
	stp	x0, x1, [x2]
	str	x3, [x2, 16]
	ldr	x19, [sp], 32
	ret
	.align	2
	.global	triple
triple:
	stp	x29, x30, [sp, -160]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	str	x21, [sp, 32]
	mov	x19, x8
	mov	x20, x0
	mov	x21, x1
	add	x0, sp, 80
	mov	x1, x20
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 48
	mov	x1, x21
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x1, sp, 48
	add	x0, sp, 80
	add	x2, sp, 112
	mov	x8, x2
	bl	cross
	add	x0, sp, 48
	mov	x1, x20
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 48
	add	x1, sp, 136
	mov	x8, x1
	mov	x1, 2
	bl	scale
	add	x0, sp, 48
	add	x1, sp, 112
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 80
	add	x1, sp, 136
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x1, sp, 80
	add	x0, sp, 48
	mov	x8, x19
	bl	add3
	ldp	x19, x20, [sp, 16]
	ldr	x21, [sp, 32]
	ldp	x29, x30, [sp], 160
	ret
	.align	2
	.global	nine
nine:
	stp	x19, x20, [sp, -80]!
	stp	x21, x22, [sp, 16]
	stp	x23, x24, [sp, 32]
	stp	x25, x26, [sp, 48]
	str	x27, [sp, 64]
	mov	x26, x0
	mov	x25, x1
	mov	x24, x2
	mov	x23, x3
	mov	x22, x4
	mov	x21, x5
	mov	x20, x6
	mov	x19, x7
	ldr	x27, [sp, 80]
	ldr	x1, [x26]
	ldr	x0, [x25, 8]
	lsl	x0, x0, 1
	add	x2, x1, x0
	ldr	x1, [x24, 16]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	add	x1, x2, x0
	ldr	x0, [x23]
	lsl	x0, x0, 2
	add	x2, x1, x0
	ldr	x1, [x22, 8]
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	add	x2, x2, x0
	ldr	x1, [x21, 16]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 1
	add	x2, x2, x0
	ldr	x1, [x20]
	mov	x0, x1
	lsl	x0, x0, 3
	sub	x0, x0, x1
	add	x1, x2, x0
	ldr	x0, [x19, 8]
	lsl	x0, x0, 3
	add	x2, x1, x0
	ldr	x1, [x27, 16]
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	add	x0, x2, x0
	ldp	x21, x22, [sp, 16]
	ldp	x23, x24, [sp, 32]
	ldp	x25, x26, [sp, 48]
	ldr	x27, [sp, 64]
	ldp	x19, x20, [sp], 80
	ret
	.align	2
	.global	mmul
mmul:
	stp	x19, x20, [sp, -48]!
	mov	x9, x8
	mov	x20, x0
	mov	x19, x1
	ldr	x1, [x20]
	ldr	x0, [x19]
	mul	x1, x1, x0
	ldr	x8, [x20, 8]
	ldr	x0, [x19, 16]
	mul	x0, x8, x0
	add	x0, x1, x0
	mov	x1, 36837
	movk	x1, 0x12a2, lsl 16
	movk	x1, 0x5f31, lsl 32
	movk	x1, 0x8970, lsl 48
	mul	x8, x0, x1
	smulh	x1, x0, x1
	mov	x10, x8
	mov	x11, x1
	mov	x1, x11
	add	x1, x0, x1
	asr	x8, x1, 29
	asr	x1, x0, 63
	sub	x1, x8, x1
	mov	x8, 51719
	movk	x8, 0x3b9a, lsl 16
	mul	x1, x1, x8
	sub	x1, x0, x1
	str	x1, [sp, 16]
	ldr	x1, [x20]
	ldr	x0, [x19, 8]
	mul	x1, x1, x0
	ldr	x8, [x20, 8]
	ldr	x0, [x19, 24]
	mul	x0, x8, x0
	add	x0, x1, x0
	mov	x1, 36837
	movk	x1, 0x12a2, lsl 16
	movk	x1, 0x5f31, lsl 32
	movk	x1, 0x8970, lsl 48
	mul	x8, x0, x1
	smulh	x1, x0, x1
	mov	x6, x8
	mov	x7, x1
	mov	x1, x7
	add	x1, x0, x1
	asr	x6, x1, 29
	asr	x1, x0, 63
	sub	x1, x6, x1
	mov	x6, 51719
	movk	x6, 0x3b9a, lsl 16
	mul	x1, x1, x6
	sub	x1, x0, x1
	str	x1, [sp, 24]
	ldr	x1, [x20, 16]
	ldr	x0, [x19]
	mul	x1, x1, x0
	ldr	x6, [x20, 24]
	ldr	x0, [x19, 16]
	mul	x0, x6, x0
	add	x0, x1, x0
	mov	x1, 36837
	movk	x1, 0x12a2, lsl 16
	movk	x1, 0x5f31, lsl 32
	movk	x1, 0x8970, lsl 48
	mul	x6, x0, x1
	smulh	x1, x0, x1
	mov	x4, x6
	mov	x5, x1
	mov	x1, x5
	add	x1, x0, x1
	asr	x4, x1, 29
	asr	x1, x0, 63
	sub	x1, x4, x1
	mov	x4, 51719
	movk	x4, 0x3b9a, lsl 16
	mul	x1, x1, x4
	sub	x1, x0, x1
	str	x1, [sp, 32]
	ldr	x1, [x20, 16]
	ldr	x0, [x19, 8]
	mul	x1, x1, x0
	ldr	x4, [x20, 24]
	ldr	x0, [x19, 24]
	mul	x0, x4, x0
	add	x0, x1, x0
	mov	x1, 36837
	movk	x1, 0x12a2, lsl 16
	movk	x1, 0x5f31, lsl 32
	movk	x1, 0x8970, lsl 48
	mul	x4, x0, x1
	smulh	x1, x0, x1
	mov	x2, x4
	mov	x3, x1
	mov	x1, x3
	add	x1, x0, x1
	asr	x2, x1, 29
	asr	x1, x0, 63
	sub	x1, x2, x1
	mov	x2, 51719
	movk	x2, 0x3b9a, lsl 16
	mul	x1, x1, x2
	sub	x1, x0, x1
	str	x1, [sp, 40]
	mov	x1, x9
	add	x0, sp, 16
	ldr	q30, [x0]
	ldr	q31, [x0, 16]
	str	q30, [x1]
	str	q31, [x1, 16]
	ldp	x19, x20, [sp], 48
	ret
	.align	2
	.global	mpow
mpow:
	stp	x29, x30, [sp, -208]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x8
	mov	x20, x0
	str	w1, [sp, 140]
	ldr	w0, [sp, 140]
	cmp	w0, 0
	bne	.L14
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 144
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	str	q30, [x0]
	str	q31, [x0, 16]
	mov	x1, x19
	add	x0, sp, 144
	ldr	q30, [x0]
	ldr	q31, [x0, 16]
	str	q30, [x1]
	str	q31, [x1, 16]
	b	.L13
.L14:
	ldr	w0, [sp, 140]
	lsr	w2, w0, 1
	add	x0, sp, 96
	mov	x1, x20
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	str	q30, [x0]
	str	q31, [x0, 16]
	add	x0, sp, 96
	add	x1, sp, 176
	mov	x8, x1
	mov	w1, w2
	bl	mpow
	add	x0, sp, 64
	add	x1, sp, 176
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	str	q30, [x0]
	str	q31, [x0, 16]
	add	x0, sp, 32
	add	x1, sp, 176
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	str	q30, [x0]
	str	q31, [x0, 16]
	add	x1, sp, 32
	add	x0, sp, 64
	add	x2, sp, 96
	mov	x8, x2
	bl	mmul
	add	x0, sp, 176
	add	x1, sp, 96
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	str	q30, [x0]
	str	q31, [x0, 16]
	ldr	w0, [sp, 140]
	and	w0, w0, 1
	cmp	w0, 0
	beq	.L16
	add	x0, sp, 64
	add	x1, sp, 176
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	str	q30, [x0]
	str	q31, [x0, 16]
	add	x0, sp, 96
	mov	x1, x20
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	str	q30, [x0]
	str	q31, [x0, 16]
	add	x1, sp, 96
	add	x0, sp, 64
	add	x2, sp, 32
	mov	x8, x2
	bl	mmul
	add	x0, sp, 176
	add	x1, sp, 32
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	str	q30, [x0]
	str	q31, [x0, 16]
.L16:
	mov	x1, x19
	add	x0, sp, 176
	ldr	q30, [x0]
	ldr	q31, [x0, 16]
	str	q30, [x1]
	str	q31, [x1, 16]
.L13:
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 208
	ret
	.section .rodata
	.align	3
.LC0:
	.quad	1
	.quad	0
	.quad	0
	.quad	1
	.text
	.align	2
	.global	mkrec
mkrec:
	sub	sp, sp, #80
	mov	x4, x8
	str	x0, [sp, 24]
	str	w1, [sp, 20]
	str	x2, [sp, 8]
	strh	w3, [sp, 18]
	str	wzr, [sp, 76]
	b	.L19
.L21:
	ldrsw	x0, [sp, 76]
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	ldrb	w2, [x0]
	ldrsw	x0, [sp, 76]
	add	x1, sp, 32
	strb	w2, [x1, x0]
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L19:
	ldrsw	x0, [sp, 76]
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	ldrb	w0, [x0]
	cmp	w0, 0
	beq	.L22
	ldr	w0, [sp, 76]
	cmp	w0, 11
	ble	.L21
	b	.L22
.L23:
	ldrsw	x0, [sp, 76]
	add	x1, sp, 32
	strb	wzr, [x1, x0]
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L22:
	ldr	w0, [sp, 76]
	cmp	w0, 12
	ble	.L23
	ldr	w0, [sp, 20]
	str	w0, [sp, 48]
	ldr	x0, [sp, 8]
	str	x0, [sp, 56]
	ldrh	w0, [sp, 18]
	strh	w0, [sp, 64]
	mov	x1, x4
	add	x0, sp, 32
	ldr	q30, [x0]
	ldr	q31, [x0, 16]
	ldr	x0, [x0, 32]
	str	q30, [x1]
	str	q31, [x1, 16]
	str	x0, [x1, 32]
	add	sp, sp, 80
	ret
	.align	2
	.global	promote
promote:
	str	x19, [sp, -32]!
	mov	x2, x8
	mov	x19, x0
	str	w1, [sp, 28]
	ldr	w1, [x19, 16]
	ldr	w0, [sp, 28]
	add	w0, w1, w0
	str	w0, [x19, 16]
	ldr	x1, [x19, 24]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x1, x0, x1
	ldrsw	x0, [sp, 28]
	sub	x0, x1, x0
	str	x0, [x19, 24]
	ldrsh	w0, [x19, 32]
	and	w0, w0, 65535
	neg	w0, w0
	and	w0, w0, 65535
	sxth	w0, w0
	strh	w0, [x19, 32]
	ldrb	w0, [x19]
	sub	w0, w0, #32
	and	w0, w0, 255
	strb	w0, [x19]
	mov	x0, x2
	mov	x1, x19
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	ldr	x1, [x1, 32]
	str	q30, [x0]
	str	q31, [x0, 16]
	str	x1, [x0, 32]
	ldr	x19, [sp], 32
	ret
	.align	2
	.global	fill
fill:
	sub	sp, sp, #224
	mov	x3, x8
	str	w0, [sp, 12]
	str	wzr, [sp, 220]
	b	.L28
.L29:
	ldr	w0, [sp, 220]
	add	w1, w0, 1
	ldr	w0, [sp, 12]
	mul	w1, w1, w0
	ldr	w0, [sp, 220]
	lsl	w0, w0, 7
	eor	w2, w1, w0
	ldr	w0, [sp, 220]
	lsl	x0, x0, 2
	add	x1, sp, 16
	str	w2, [x1, x0]
	ldr	w0, [sp, 220]
	add	w0, w0, 1
	str	w0, [sp, 220]
.L28:
	ldr	w0, [sp, 220]
	cmp	w0, 49
	bls	.L29
	mov	x1, x3
	add	x0, sp, 16
	ldr	q26, [x0]
	ldr	q27, [x0, 16]
	ldr	q28, [x0, 32]
	ldr	q29, [x0, 48]
	ldr	q30, [x0, 64]
	ldr	q31, [x0, 80]
	str	q26, [x1]
	str	q27, [x1, 16]
	str	q28, [x1, 32]
	str	q29, [x1, 48]
	str	q30, [x1, 64]
	str	q31, [x1, 80]
	ldr	q26, [x0, 96]
	ldr	q27, [x0, 112]
	ldr	q28, [x0, 128]
	ldr	q29, [x0, 144]
	ldr	q30, [x0, 160]
	ldr	q31, [x0, 176]
	str	q26, [x1, 96]
	str	q27, [x1, 112]
	str	q28, [x1, 128]
	str	q29, [x1, 144]
	str	q30, [x1, 160]
	str	q31, [x1, 176]
	ldr	x0, [x0, 192]
	str	x0, [x1, 192]
	add	sp, sp, 224
	ret
	.align	2
	.global	digest
digest:
	str	x19, [sp, -32]!
	mov	x19, x0
	mov	x0, 899
	movk	x0, 0x739d, lsl 16
	movk	x0, 0xfb0, lsl 32
	movk	x0, 0x1465, lsl 48
	str	x0, [sp, 24]
	str	wzr, [sp, 20]
	b	.L32
.L33:
	ldrsw	x0, [sp, 20]
	ldr	w0, [x19, x0, lsl 2]
	uxtw	x1, w0
	ldr	x0, [sp, 24]
	eor	x1, x1, x0
	mov	x0, 435
	movk	x0, 0x100, lsl 32
	mul	x0, x1, x0
	str	x0, [sp, 24]
	ldr	w0, [sp, 20]
	add	w0, w0, 1
	str	w0, [sp, 20]
.L32:
	ldr	w0, [sp, 20]
	cmp	w0, 49
	ble	.L33
	ldr	x0, [sp, 24]
	ldr	x19, [sp], 32
	ret
	.global	ops
	.data
	.align	3
ops:
	.quad	cross
	.quad	add3
	.global	knob
	.align	3
knob:
	.quad	5
	.section .rodata
	.align	3
.LC3:
	.string	"path %d: %ld %ld %ld\n"
	.align	3
.LC4:
	.string	"scaled %ld %ld %ld from %ld %ld %ld\n"
	.align	3
.LC5:
	.string	"triple %ld %ld %ld\n"
	.align	3
.LC6:
	.string	"nine %ld\n"
	.align	3
.LC7:
	.string	"fib(%u) mod p = %ld\n"
	.align	3
.LC8:
	.string	"ada lovelace!"
	.align	3
.LC9:
	.string	"%s %d %ld %d | %s %d %ld %d | %d\n"
	.align	3
.LC10:
	.string	"blob %u %u %016lx\n"
	.align	3
.LC11:
	.string	"direct %u %016lx\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #1424
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x19, x20, [sp, 32]
	adrp	x0, knob
	add	x0, x0, :lo12:knob
	ldr	x0, [x0]
	str	x0, [sp, 1400]
	adrp	x0, .LC1
	add	x1, x0, :lo12:.LC1
	add	x0, sp, 880
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	ldr	x0, [sp, 1400]
	neg	x1, x0
	ldr	x0, [sp, 1400]
	lsl	x0, x0, 1
	ldr	x2, [sp, 1400]
	str	x2, [sp, 736]
	str	x1, [sp, 744]
	str	x0, [sp, 752]
	mov	w0, 1
	str	w0, [sp, 1420]
	b	.L36
.L37:
	ldr	w0, [sp, 1420]
	and	w1, w0, 1
	adrp	x0, ops
	add	x0, x0, :lo12:ops
	sxtw	x1, w1
	ldr	x4, [x0, x1, lsl 3]
	ldr	w0, [sp, 1420]
	sub	w1, w0, #1
	ldrsw	x0, [sp, 1420]
	mov	x19, x0
	lsl	x19, x19, 1
	add	x19, x19, x0
	lsl	x0, x19, 3
	mov	x19, x0
	add	x20, sp, 736
	sxtw	x1, w1
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x2, sp, 736
	add	x1, sp, 272
	add	x0, x2, x0
	ldp	x2, x3, [x0]
	ldr	x0, [x0, 16]
	stp	x2, x3, [x1]
	str	x0, [x1, 16]
	add	x0, sp, 240
	add	x1, sp, 880
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x1, sp, 240
	add	x0, sp, 272
	add	x2, sp, 304
	mov	x8, x2
	blr	x4
	add	x0, x20, x19
	add	x1, sp, 304
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	ldr	w0, [sp, 1420]
	add	w0, w0, 1
	str	w0, [sp, 1420]
.L36:
	ldr	w0, [sp, 1420]
	cmp	w0, 5
	ble	.L37
	str	wzr, [sp, 1416]
	b	.L38
.L39:
	ldrsw	x1, [sp, 1416]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x1, sp, 736
	ldr	x2, [x1, x0]
	ldrsw	x1, [sp, 1416]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x1, sp, 744
	ldr	x3, [x1, x0]
	ldrsw	x1, [sp, 1416]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x1, sp, 752
	ldr	x0, [x1, x0]
	mov	x4, x0
	ldr	w1, [sp, 1416]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w0, [sp, 1416]
	add	w0, w0, 1
	str	w0, [sp, 1416]
.L38:
	ldr	w0, [sp, 1416]
	cmp	w0, 5
	ble	.L39
	add	x0, sp, 240
	add	x1, sp, 856
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 240
	add	x1, sp, 688
	mov	x8, x1
	mov	x1, -3
	bl	scale
	ldr	x0, [sp, 688]
	ldr	x1, [sp, 696]
	ldr	x2, [sp, 704]
	ldr	x3, [sp, 856]
	ldr	x4, [sp, 864]
	ldr	x5, [sp, 872]
	mov	x6, x5
	mov	x5, x4
	mov	x4, x3
	mov	x3, x2
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	add	x0, sp, 240
	add	x1, sp, 880
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 272
	add	x1, sp, 688
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x1, sp, 272
	add	x0, sp, 240
	add	x2, sp, 664
	mov	x8, x2
	bl	triple
	ldr	x0, [sp, 664]
	ldr	x1, [sp, 672]
	ldr	x2, [sp, 680]
	mov	x3, x2
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	add	x0, sp, 240
	add	x1, sp, 880
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 272
	add	x1, sp, 688
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x1, sp, 272
	add	x0, sp, 240
	add	x2, sp, 904
	mov	x8, x2
	bl	cross
	add	x0, sp, 240
	add	x1, sp, 736
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 272
	add	x1, sp, 760
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 304
	add	x1, sp, 784
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 208
	add	x1, sp, 808
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 176
	add	x1, sp, 832
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 144
	add	x1, sp, 856
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 112
	add	x1, sp, 880
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 80
	add	x1, sp, 688
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 48
	add	x1, sp, 904
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x7, sp, 80
	add	x6, sp, 112
	add	x5, sp, 144
	add	x4, sp, 176
	add	x3, sp, 208
	add	x2, sp, 304
	add	x1, sp, 272
	add	x0, sp, 240
	add	x8, sp, 48
	str	x8, [sp]
	bl	nine
	mov	x1, x0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	adrp	x0, .LC2
	add	x1, x0, :lo12:.LC2
	add	x0, sp, 632
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	str	q30, [x0]
	str	q31, [x0, 16]
	mov	w0, 10
	str	w0, [sp, 616]
	mov	w0, 50
	str	w0, [sp, 620]
	mov	w0, 90
	str	w0, [sp, 624]
	mov	w0, 16960
	movk	w0, 0xf, lsl 16
	str	w0, [sp, 628]
	str	wzr, [sp, 1412]
	b	.L40
.L41:
	ldrsw	x0, [sp, 1412]
	lsl	x0, x0, 2
	add	x1, sp, 616
	ldr	w19, [x1, x0]
	ldrsw	x0, [sp, 1412]
	lsl	x0, x0, 2
	add	x1, sp, 616
	ldr	w2, [x1, x0]
	add	x0, sp, 176
	add	x1, sp, 632
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	str	q30, [x0]
	str	q31, [x0, 16]
	add	x0, sp, 176
	add	x1, sp, 928
	mov	x8, x1
	mov	w1, w2
	bl	mpow
	ldr	x0, [sp, 936]
	mov	x2, x0
	mov	w1, w19
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	w0, [sp, 1412]
	add	w0, w0, 1
	str	w0, [sp, 1412]
.L40:
	ldr	w0, [sp, 1412]
	cmp	w0, 3
	ble	.L41
	add	x0, sp, 576
	mov	x8, x0
	mov	w3, 12
	mov	x2, 1815
	mov	w1, 7
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	mkrec
	add	x0, sp, 144
	add	x1, sp, 576
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	ldr	x1, [x1, 32]
	str	q30, [x0]
	str	q31, [x0, 16]
	str	x1, [x0, 32]
	add	x0, sp, 144
	add	x1, sp, 960
	mov	x8, x1
	mov	w1, 3
	bl	promote
	add	x0, sp, 112
	add	x1, sp, 960
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	ldr	x1, [x1, 32]
	str	q30, [x0]
	str	q31, [x0, 16]
	str	x1, [x0, 32]
	add	x0, sp, 112
	add	x1, sp, 536
	mov	x8, x1
	mov	w1, 4
	bl	promote
	ldr	w1, [sp, 592]
	ldr	x2, [sp, 600]
	ldrsh	w0, [sp, 608]
	mov	w8, w0
	ldr	w4, [sp, 552]
	ldr	x5, [sp, 560]
	ldrsh	w0, [sp, 568]
	mov	w7, w0
	add	x3, sp, 536
	add	x0, sp, 576
	mov	w6, 40
	str	w6, [sp, 8]
	str	w7, [sp]
	mov	x7, x5
	mov	w6, w4
	mov	x5, x3
	mov	w4, w8
	mov	x3, x2
	mov	w2, w1
	mov	x1, x0
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	ldr	x0, [sp, 1400]
	mov	w1, w0
	add	x0, sp, 336
	mov	x8, x0
	mov	w0, w1
	bl	fill
	add	x0, sp, 80
	mov	x8, x0
	mov	w0, 99
	bl	fill
	ldr	w19, [sp, 336]
	ldr	w20, [sp, 532]
	add	x0, sp, 48
	add	x1, sp, 336
	ldr	q26, [x1]
	ldr	q27, [x1, 16]
	ldr	q28, [x1, 32]
	ldr	q29, [x1, 48]
	ldr	q30, [x1, 64]
	ldr	q31, [x1, 80]
	str	q26, [x0]
	str	q27, [x0, 16]
	str	q28, [x0, 32]
	str	q29, [x0, 48]
	str	q30, [x0, 64]
	str	q31, [x0, 80]
	ldr	q26, [x1, 96]
	ldr	q27, [x1, 112]
	ldr	q28, [x1, 128]
	ldr	q29, [x1, 144]
	ldr	q30, [x1, 160]
	ldr	q31, [x1, 176]
	str	q26, [x0, 96]
	str	q27, [x0, 112]
	str	q28, [x0, 128]
	str	q29, [x0, 144]
	str	q30, [x0, 160]
	str	q31, [x0, 176]
	ldr	x1, [x1, 192]
	str	x1, [x0, 192]
	add	x0, sp, 48
	bl	digest
	mov	x3, x0
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	add	x0, sp, 1000
	mov	x8, x0
	mov	w0, 7
	bl	fill
	ldr	w19, [sp, 1132]
	add	x0, sp, 1200
	mov	x8, x0
	mov	w0, 8
	bl	fill
	add	x0, sp, 48
	add	x1, sp, 1200
	ldr	q26, [x1]
	ldr	q27, [x1, 16]
	ldr	q28, [x1, 32]
	ldr	q29, [x1, 48]
	ldr	q30, [x1, 64]
	ldr	q31, [x1, 80]
	str	q26, [x0]
	str	q27, [x0, 16]
	str	q28, [x0, 32]
	str	q29, [x0, 48]
	str	q30, [x0, 64]
	str	q31, [x0, 80]
	ldr	q26, [x1, 96]
	ldr	q27, [x1, 112]
	ldr	q28, [x1, 128]
	ldr	q29, [x1, 144]
	ldr	q30, [x1, 160]
	ldr	q31, [x1, 176]
	str	q26, [x0, 96]
	str	q27, [x0, 112]
	str	q28, [x0, 128]
	str	q29, [x0, 144]
	str	q30, [x0, 160]
	str	q31, [x0, 176]
	ldr	x1, [x1, 192]
	str	x1, [x0, 192]
	add	x0, sp, 48
	bl	digest
	mov	x2, x0
	mov	w1, w19
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 16]
	ldp	x19, x20, [sp, 32]
	add	sp, sp, 1424
	ret
	.section .rodata
	.align	3
.LC1:
	.quad	1
	.quad	2
	.quad	3
	.align	3
.LC2:
	.quad	1
	.quad	1
	.quad	1
	.quad	0
	.text

