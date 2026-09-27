	.text
	.align	2
	.align 5
	.global	cross
cross:
	ldp	x3, x2, [x0]
	ldp	x5, x6, [x1]
	ldr	x4, [x0, 16]
	ldr	x0, [x1, 16]
	mul	x1, x2, x0
	msub	x1, x4, x6, x1
	mul	x4, x4, x5
	msub	x0, x3, x0, x4
	mul	x3, x3, x6
	stp	x1, x0, [x8]
	msub	x2, x2, x5, x3
	str	x2, [x8, 16]
	ret
	.align	2
	.align 5
	.global	add3
add3:
	ldr	q31, [x0]
	ldr	q30, [x1]
	ldr	x2, [x0, 16]
	add	v30.2d, v31.2d, v30.2d
	ldr	x3, [x1, 16]
	add	x2, x2, x3
	str	q30, [x8]
	str	x2, [x8, 16]
	ret
	.align	2
	.align 5
	.global	scale
scale:
	ldp	x2, x3, [x0]
	ldr	x0, [x0, 16]
	mul	x3, x1, x3
	mul	x2, x2, x1
	mul	x0, x1, x0
	stp	x2, x3, [x8]
	str	x0, [x8, 16]
	ret
	.align	2
	.align 5
	.global	triple
triple:
	ldp	x4, x3, [x0]
	ldp	x5, x6, [x1]
	ldr	x2, [x0, 16]
	ldr	x0, [x1, 16]
	mul	x7, x2, x5
	mul	x1, x3, x0
	msub	x1, x2, x6, x1
	msub	x0, x4, x0, x7
	add	x1, x1, x4, lsl 1
	mul	x4, x4, x6
	add	x0, x0, x3, lsl 1
	msub	x3, x3, x5, x4
	stp	x1, x0, [x8]
	add	x2, x3, x2, lsl 1
	str	x2, [x8, 16]
	ret
	.align	2
	.align 5
	.global	nine
nine:
	ldr	x0, [x0]
	ldr	x1, [x1, 8]
	add	x1, x0, x1, lsl 1
	ldr	x0, [x2, 16]
	add	x0, x0, x0, lsl 1
	add	x1, x1, x0
	ldr	x0, [x3]
	add	x0, x1, x0, lsl 2
	ldr	x1, [x4, 8]
	add	x1, x1, x1, lsl 2
	add	x1, x0, x1
	ldr	x0, [x5, 16]
	add	x0, x0, x0, lsl 1
	add	x0, x1, x0, lsl 1
	ldr	x1, [x6]
	add	x0, x0, x1, lsl 3
	sub	x0, x0, x1
	ldr	x1, [x7, 8]
	add	x0, x0, x1, lsl 3
	ldr	x1, [sp]
	ldr	x1, [x1, 16]
	add	x1, x1, x1, lsl 3
	add	x0, x0, x1
	ret
	.align	2
	.align 5
	.global	mmul
mmul:
	ldp	x5, x12, [x0]
	mov	x6, 51719
	ldp	x9, x11, [x1, 16]
	movk	x6, 0x3b9a, lsl 16
	ldp	x4, x10, [x1]
	ldp	x3, x7, [x0, 16]
	mov	x0, 36837
	mul	x2, x12, x9
	movk	x0, 0x12a2, lsl 16
	movk	x0, 0x5f31, lsl 32
	mul	x12, x12, x11
	madd	x2, x5, x4, x2
	movk	x0, 0x8970, lsl 48
	madd	x5, x5, x10, x12
	mul	x9, x7, x9
	mul	x7, x7, x11
	smulh	x1, x2, x0
	add	x1, x2, x1
	asr	x1, x1, 29
	sub	x1, x1, x2, asr 63
	msub	x1, x1, x6, x2
	smulh	x2, x5, x0
	add	x2, x5, x2
	asr	x2, x2, 29
	sub	x2, x2, x5, asr 63
	msub	x2, x2, x6, x5
	stp	x1, x2, [x8]
	madd	x2, x3, x4, x9
	smulh	x1, x2, x0
	add	x1, x2, x1
	asr	x1, x1, 29
	sub	x1, x1, x2, asr 63
	msub	x1, x1, x6, x2
	madd	x2, x3, x10, x7
	smulh	x0, x2, x0
	add	x0, x2, x0
	asr	x0, x0, 29
	sub	x0, x0, x2, asr 63
	msub	x0, x0, x6, x2
	stp	x1, x0, [x8, 16]
	ret
	.align	2
	.align 5
	.global	mpow
mpow:
	mov	x7, x8
	cbnz	w1, .L9
	adrp	x0, .LANCHOR0
	add	x1, x0, :lo12:.LANCHOR0
	ldr	q31, [x0, :lo12:.LANCHOR0]
	ldr	q30, [x1, 16]
	stp	q31, q30, [x8]
	ret
	.align 2
.L9:
	stp	x29, x30, [sp, -112]!
	mov	x10, x0
	mov	w9, w1
	mov	x29, sp
	add	x8, sp, 80
	str	x7, [sp, 32]
	lsr	w1, w1, 1
	add	x0, sp, 48
	ldp	q30, q31, [x10]
	str	w9, [sp, 28]
	str	x10, [sp, 40]
	stp	q30, q31, [sp, 48]
	bl	mpow
	mov	x0, 36837
	ldp	x8, x5, [sp, 80]
	movk	x0, 0x12a2, lsl 16
	ldp	x3, x4, [sp, 96]
	movk	x0, 0x5f31, lsl 32
	movk	x0, 0x8970, lsl 48
	mov	x1, 51719
	movk	x1, 0x3b9a, lsl 16
	ldr	w9, [sp, 28]
	ldr	x7, [sp, 32]
	mul	x11, x3, x5
	madd	x2, x8, x8, x11
	smulh	x6, x2, x0
	add	x6, x2, x6
	asr	x6, x6, 29
	sub	x6, x6, x2, asr 63
	msub	x6, x6, x1, x2
	mul	x2, x4, x5
	madd	x5, x8, x5, x2
	smulh	x2, x5, x0
	add	x2, x5, x2
	asr	x2, x2, 29
	sub	x2, x2, x5, asr 63
	msub	x2, x2, x1, x5
	mul	x5, x4, x3
	madd	x3, x3, x8, x5
	madd	x4, x4, x4, x11
	smulh	x5, x3, x0
	add	x5, x3, x5
	asr	x5, x5, 29
	sub	x5, x5, x3, asr 63
	msub	x5, x5, x1, x3
	smulh	x3, x4, x0
	add	x3, x4, x3
	asr	x3, x3, 29
	sub	x3, x3, x4, asr 63
	msub	x3, x3, x1, x4
	tbz	x9, 0, .L11
	ldr	x10, [sp, 40]
	ldp	x12, x11, [x10, 16]
	ldp	x8, x9, [x10]
	mul	x10, x2, x12
	mul	x2, x2, x11
	madd	x10, x6, x8, x10
	madd	x6, x6, x9, x2
	mul	x12, x3, x12
	mul	x11, x3, x11
	madd	x8, x5, x8, x12
	smulh	x2, x6, x0
	madd	x5, x5, x9, x11
	add	x2, x6, x2
	smulh	x4, x10, x0
	asr	x2, x2, 29
	add	x4, x10, x4
	sub	x2, x2, x6, asr 63
	asr	x4, x4, 29
	sub	x4, x4, x10, asr 63
	msub	x2, x2, x1, x6
	smulh	x6, x8, x0
	smulh	x0, x5, x0
	add	x6, x8, x6
	add	x0, x5, x0
	asr	x6, x6, 29
	asr	x0, x0, 29
	sub	x6, x6, x8, asr 63
	sub	x3, x0, x5, asr 63
	msub	x3, x3, x1, x5
	msub	x5, x6, x1, x8
	msub	x6, x4, x1, x10
.L11:
	stp	x6, x2, [x7]
	stp	x5, x3, [x7, 16]
	ldp	x29, x30, [sp], 112
	ret
	.align	2
	.align 5
	.global	mkrec
mkrec:
	stp	x29, x30, [sp, -112]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x20, x8
	stp	x21, x22, [sp, 32]
	mov	x22, x2
	mov	w21, w3
	str	x23, [sp, 48]
	mov	w23, w1
	ldrb	w5, [x0]
	cbz	w5, .L22
	add	x19, sp, 72
	mov	x4, 1
	.align 5
.L21:
	add	x6, x19, x4
	strb	w5, [x6, -1]
	ldrb	w5, [x0, x4]
	cbz	w5, .L19
	add	x4, x4, 1
	cmp	x4, 13
	bne	.L21
	mov	w4, 12
.L19:
	add	x0, x19, w4, sxtw
	mov	w1, 0
	mov	w2, 13
	sub	w2, w2, w4
	bl	memset
	str	w23, [sp, 88]
	str	x22, [sp, 96]
	strh	w21, [sp, 104]
	ldp	q31, q30, [x19]
	ldr	x0, [x19, 32]
	str	x0, [x20, 32]
	stp	q31, q30, [x20]
	ldr	x23, [sp, 48]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 112
	ret
.L22:
	add	x19, sp, 72
	mov	w4, 0
	b	.L19
	.align	2
	.align 5
	.global	promote
promote:
	ldr	x2, [x0, 24]
	ldrb	w4, [x0]
	ldr	w3, [x0, 16]
	add	x2, x2, x2, lsl 1
	sub	w4, w4, #32
	add	w3, w1, w3
	sub	x2, x2, w1, sxtw
	strb	w4, [x0]
	str	w3, [x0, 16]
	str	x2, [x0, 24]
	ldrh	w1, [x0, 32]
	ldp	q31, q30, [x0]
	neg	w1, w1
	strh	w1, [x0, 32]
	ldr	x0, [x0, 32]
	stp	q31, q30, [x8]
	str	x0, [x8, 32]
	ret
	.align	2
	.align 5
	.global	fill
fill:
	adrp	x2, .LANCHOR0
	add	x2, x2, :lo12:.LANCHOR0
	fmov	s29, w0
	sub	sp, sp, #208
	movi	v27.4s, 0x4
	mov	x0, sp
	ldp	d26, d31, [x2, 48]
	add	x1, sp, 192
	mul	v26.2s, v26.2s, v29.s[0]
	dup	v29.4s, v29.s[0]
	eor	v26.8b, v26.8b, v31.8b
	ldr	q31, [x2, 32]
	.align 5
.L27:
	mov	v30.16b, v29.16b
	shl	v28.4s, v31.4s, 7
	mla	v30.4s, v31.4s, v29.4s
	add	v31.4s, v31.4s, v27.4s
	eor	v30.16b, v30.16b, v28.16b
	str	q30, [x0], 16
	cmp	x1, x0
	bne	.L27
	ldp	q27, q25, [sp]
	ldp	q29, q28, [sp, 32]
	ldp	q31, q30, [sp, 64]
	stp	q27, q25, [x8]
	stp	q29, q28, [x8, 32]
	stp	q31, q30, [x8, 64]
	ldp	q27, q25, [sp, 96]
	ldp	q29, q28, [sp, 128]
	ldp	q31, q30, [sp, 160]
	str	d26, [x8, 192]
	stp	q27, q25, [x8, 96]
	stp	q29, q28, [x8, 128]
	stp	q31, q30, [x8, 160]
	add	sp, sp, 208
	ret
	.align	2
	.align 5
	.global	digest
digest:
	mov	x1, x0
	add	x4, x0, 200
	mov	x0, 899
	mov	x3, 435
	movk	x0, 0x739d, lsl 16
	movk	x3, 0x100, lsl 32
	movk	x0, 0xfb0, lsl 32
	movk	x0, 0x1465, lsl 48
	.align 5
.L31:
	ldr	w2, [x1], 4
	eor	x0, x2, x0
	mul	x0, x0, x3
	cmp	x4, x1
	bne	.L31
	ret
	.section .rodata
	.align	3
.LC9:
	.string	"path %d: %ld %ld %ld\n"
	.align	3
.LC10:
	.string	"scaled %ld %ld %ld from %ld %ld %ld\n"
	.align	3
.LC11:
	.string	"triple %ld %ld %ld\n"
	.align	3
.LC12:
	.string	"nine %ld\n"
	.align	3
.LC14:
	.string	"fib(%u) mod p = %ld\n"
	.align	3
.LC15:
	.string	"ada lovelace!"
	.align	3
.LC16:
	.string	"%s %d %ld %d | %s %d %ld %d | %d\n"
	.align	3
.LC17:
	.string	"blob %u %u %016lx\n"
	.align	3
.LC19:
	.string	"direct %u %016lx\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #1232
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x25, x26, [sp, 80]
	adrp	x25, .LANCHOR1
	stp	x19, x20, [sp, 32]
	add	x19, sp, 480
	ldr	x20, [x25, :lo12:.LANCHOR1]
	add	x25, x25, :lo12:.LANCHOR1
	stp	x21, x22, [sp, 48]
	mov	w22, 1
	neg	x0, x20
	stp	x23, x24, [sp, 64]
	adrp	x24, .LANCHOR0
	add	x23, sp, 256
	add	x21, x24, :lo12:.LANCHOR0
	str	x27, [sp, 96]
	mov	x27, 3
	stp	x20, x0, [sp, 480]
	lsl	x0, x20, 1
	str	x0, [sp, 496]
.L34:
	ubfiz	x0, x22, 3, 1
	add	x8, sp, 208
	add	x0, x25, x0
	str	x27, [sp, 272]
	ldr	x2, [x0, 16]
	adrp	x0, .LANCHOR0+64
	ldr	q31, [x0, :lo12:.LANCHOR0+64]
	sbfiz	x0, x22, 1, 32
	add	x26, x0, w22, sxtw
	sub	w0, w22, #1
	add	w22, w22, 1
	sbfiz	x1, x0, 1, 32
	str	q31, [sp, 256]
	add	x0, x1, w0, sxtw
	add	x0, x19, x0, lsl 3
	ldp	x4, x5, [x0]
	ldr	x0, [x0, 16]
	str	x0, [sp, 192]
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	str	x27, [sp, 160]
	stp	x4, x5, [sp, 176]
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp, 144]
	add	x1, sp, 144
	add	x0, sp, 176
	blr	x2
	add	x0, x19, x26, lsl 3
	ldp	x2, x3, [sp, 208]
	ldr	x1, [sp, 224]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	cmp	w22, 6
	bne	.L34
	adrp	x25, .LC9
	add	x25, x25, :lo12:.LC9
	mov	w22, 0
	.align 5
.L35:
	ldr	x4, [x19, 16]
	mov	w1, w22
	ldp	x2, x3, [x19], 24
	add	w22, w22, 1
	mov	x0, x25
	bl	printf
	cmp	w22, 6
	bne	.L35
	ldr	x27, [sp, 600]
	adrp	x0, .LC10
	ldr	x19, [sp, 608]
	mov	x4, x27
	ldr	x6, [sp, 616]
	sub	x22, x27, x27, lsl 2
	sub	x26, x19, x19, lsl 2
	mov	x5, x19
	mov	x1, x22
	mov	x2, x26
	sub	x25, x6, x6, lsl 2
	add	x0, x0, :lo12:.LC10
	mov	x3, x25
	bl	printf
	neg	x0, x27, lsl 3
	add	x19, x19, x19, lsl 3
	sub	x0, x0, x27
	sub	x22, x26, x22, lsl 1
	sub	x2, x0, x25
	add	x1, x19, x25, lsl 1
	add	x3, x22, 6
	add	x2, x2, 4
	add	x1, x1, 2
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	ldr	x1, [sp, 512]
	add	x22, x22, x22, lsl 3
	ldr	x0, [sp, 544]
	add	x19, sp, 240
	add	x1, x20, x1, lsl 1
	add	x0, x0, x0, lsl 1
	add	x1, x1, x0
	ldr	x0, [sp, 552]
	add	x0, x1, x0, lsl 2
	ldr	x1, [sp, 584]
	add	x1, x1, x1, lsl 2
	add	x0, x0, x1
	sub	x0, x0, x25, lsl 1
	add	x0, x0, 7
	add	x1, x0, x26, lsl 3
	adrp	x0, .LC12
	add	x1, x1, x22
	add	x0, x0, :lo12:.LC12
	bl	printf
	adrp	x22, .LC14
	adrp	x0, .LC21
	add	x22, x22, :lo12:.LC14
	ldr	q31, [x0, :lo12:.LC21]
	str	q31, [sp, 288]
	ldr	q31, [x24, :lo12:.LANCHOR0]
	str	q31, [sp, 304]
	ldr	q31, [x21, 80]
	str	q31, [sp, 240]
.L36:
	ldr	w13, [x19], 4
	ldp	q31, q30, [sp, 288]
	mov	w1, w13
	add	x0, sp, 112
	add	x8, sp, 328
	stp	q31, q30, [sp, 112]
	bl	mpow
	mov	w1, w13
	ldr	x2, [sp, 336]
	mov	x0, x22
	bl	printf
	cmp	x19, x23
	bne	.L36
	add	x8, sp, 360
	mov	w3, 12
	mov	x2, 1815
	mov	w1, 7
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	mkrec
	add	x19, sp, 1024
	add	x0, sp, 360
	ldrb	w1, [sp, 360]
	ldr	w2, [sp, 376]
	add	x22, sp, 1216
	sub	w5, w1, #32
	ldrsh	w4, [sp, 392]
	ldp	q30, q31, [x0]
	sub	w1, w1, #64
	str	q30, [sp, 1024]
	str	q31, [x19, 16]
	ldp	x3, x0, [sp, 384]
	str	x0, [x19, 32]
	strb	w5, [sp, 1024]
	add	w5, w2, 3
	str	w5, [sp, 1040]
	ldr	q31, [sp, 1024]
	sub	x0, x3, #1
	add	x5, x0, x0, lsl 1
	str	x5, [sp, 1048]
	neg	w5, w4
	strh	w5, [sp, 1056]
	add	x5, sp, 440
	add	x0, x0, x0, lsl 3
	ldr	q30, [x19, 16]
	sub	x7, x0, #4
	ldr	x6, [x19, 32]
	stp	q31, q30, [x5]
	add	x5, sp, 400
	str	x6, [sp, 472]
	add	w6, w2, 7
	strb	w1, [sp, 1024]
	add	x1, sp, 360
	str	w6, [sp, 1040]
	str	x7, [sp, 1048]
	strh	w4, [sp, 1056]
	ldr	q31, [sp, 1024]
	ldr	q30, [x19, 16]
	ldr	x0, [x19, 32]
	str	w4, [sp]
	str	x0, [sp, 432]
	mov	w0, 40
	str	w0, [sp, 8]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	stp	q31, q30, [sp, 400]
	bl	printf
	ldr	q30, [x21, 32]
	dup	v31.4s, w20
	movi	v29.4s, 0x4
	mov	x0, x19
	.align 5
.L37:
	mov	v28.16b, v31.16b
	shl	v27.4s, v30.4s, 7
	mla	v28.4s, v30.4s, v31.4s
	add	v30.4s, v30.4s, v29.4s
	eor	v27.16b, v28.16b, v27.16b
	str	q27, [x0], 16
	cmp	x0, x22
	bne	.L37
	add	w0, w20, w20, lsl 1
	mov	w2, 50
	ldr	q27, [sp, 1024]
	mul	w2, w2, w20
	add	w0, w20, w0, lsl 4
	mov	x3, 899
	eor	w0, w0, 6144
	str	w0, [sp, 1216]
	mov	w0, 6272
	eor	w2, w2, w0
	str	w2, [sp, 1220]
	movk	x3, 0x739d, lsl 16
	movk	x3, 0xfb0, lsl 32
	mov	x5, 435
	ldr	q30, [x19, 80]
	add	x20, sp, 1224
	ldp	q26, q29, [x19, 16]
	mov	x0, x19
	ldp	q28, q31, [x19, 48]
	movk	x3, 0x1465, lsl 48
	stp	q27, q26, [sp, 624]
	movk	x5, 0x100, lsl 32
	stp	q29, q28, [sp, 656]
	stp	q31, q30, [sp, 688]
	ldp	q27, q26, [x19, 96]
	ldp	q29, q28, [x19, 128]
	ldp	q31, q30, [x19, 160]
	stp	q27, q26, [sp, 720]
	stp	q29, q28, [sp, 752]
	stp	q31, q30, [sp, 784]
	ldr	x1, [x19, 192]
	str	x1, [sp, 816]
	ldr	w1, [sp, 1024]
	.align 5
.L38:
	ldr	w4, [x0], 4
	eor	x3, x4, x3
	mul	x3, x3, x5
	cmp	x0, x20
	bne	.L38
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	ldr	q26, [x21, 32]
	mov	x0, x19
	movi	v25.4s, 0x1
	movi	v24.4s, 0x4
	.align 5
.L39:
	add	v0.4s, v26.4s, v25.4s
	shl	v23.4s, v26.4s, 7
	add	v26.4s, v26.4s, v24.4s
	shl	v22.4s, v0.4s, 3
	sub	v22.4s, v22.4s, v0.4s
	eor	v23.16b, v22.16b, v23.16b
	str	q23, [x0], 16
	cmp	x22, x0
	bne	.L39
	ldr	q21, [x21, 32]
	mov	x0, x19
	movi	v20.4s, 0x1
	ldr	w1, [sp, 1156]
	movi	v19.4s, 0x4
	.align 5
.L40:
	add	v18.4s, v21.4s, v20.4s
	shl	v17.4s, v21.4s, 7
	add	v21.4s, v21.4s, v19.4s
	shl	v18.4s, v18.4s, 3
	eor	v17.16b, v18.16b, v17.16b
	str	q17, [x0], 16
	cmp	x22, x0
	bne	.L40
	ldr	d31, [x21, 96]
	add	x0, sp, 824
	ldr	q27, [sp, 1024]
	mov	x2, 6536
	str	d31, [sp, 1216]
	movk	x2, 0x1910, lsl 32
	ldr	q30, [x19, 80]
	mov	x4, 435
	ldp	q26, q29, [x19, 16]
	movk	x4, 0x100, lsl 32
	ldp	q28, q31, [x19, 48]
	stp	q27, q26, [x0]
	stp	q29, q28, [x0, 32]
	stp	q31, q30, [x0, 64]
	ldp	q27, q26, [x19, 96]
	ldp	q29, q28, [x19, 128]
	ldp	q31, q30, [x19, 160]
	stp	q27, q26, [x0, 96]
	stp	q29, q28, [x0, 128]
	stp	q31, q30, [x0, 160]
	mov	x0, x19
	str	x2, [sp, 1016]
	mov	x2, 899
	movk	x2, 0x739d, lsl 16
	movk	x2, 0xfb0, lsl 32
	movk	x2, 0x1465, lsl 48
	.align 5
.L41:
	ldr	w3, [x0], 4
	eor	x2, x3, x2
	mul	x2, x2, x4
	cmp	x20, x0
	bne	.L41
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	printf
	ldr	x27, [sp, 96]
	mov	w0, 0
	ldp	x29, x30, [sp, 16]
	ldp	x19, x20, [sp, 32]
	ldp	x21, x22, [sp, 48]
	ldp	x23, x24, [sp, 64]
	ldp	x25, x26, [sp, 80]
	add	sp, sp, 1232
	ret
	.global	knob
	.global	ops
	.section .rodata
	.align	4
.LC20:
	.quad	1
	.quad	2
	.section .rodata
	.align	4
	.LANCHOR0:
.LC3:
	.quad	1
	.quad	0
.LC4:
	.quad	0
	.quad	1
.LC5:
	.word	0
	.word	1
	.word	2
	.word	3
.LC6:
	.word	49
	.word	50
.LC7:
	.word	6144
	.word	6272
.LC8:
	.quad	1
	.quad	2
.LC13:
	.word	10
	.word	50
	.word	90
	.word	1000000
.LC18:
	.word	6536
	.word	6416
	.zero	8
.LC21:
	.quad	1
	.quad	1
	.data
	.align	4
	.LANCHOR1:
knob:
	.quad	5
	.zero	8
ops:
	.quad	cross
	.quad	add3

