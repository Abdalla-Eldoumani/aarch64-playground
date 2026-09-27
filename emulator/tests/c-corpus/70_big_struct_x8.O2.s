	.text
	.align	2
	.p2align 5,,15
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
	.p2align 5,,15
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
	.p2align 5,,15
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
	.p2align 5,,15
	.global	triple
triple:
	stp	x29, x30, [sp, -128]!
	mov	x7, x0
	mov	x9, x8
	mov	x29, sp
	add	x8, sp, 80
	ldp	x2, x3, [x0]
	stp	x2, x3, [sp, 48]
	ldr	x0, [x0, 16]
	str	x0, [sp, 64]
	ldp	x2, x3, [x1]
	ldr	x0, [x1, 16]
	add	x1, sp, 16
	stp	x2, x3, [sp, 16]
	str	x0, [sp, 32]
	add	x0, sp, 48
	bl	cross
	add	x8, sp, 104
	ldp	x2, x3, [x7]
	stp	x2, x3, [sp, 48]
	mov	x1, 2
	ldr	x0, [x7, 16]
	str	x0, [sp, 64]
	add	x0, sp, 48
	bl	scale
	add	x1, sp, 16
	ldp	x2, x3, [sp, 80]
	stp	x2, x3, [sp, 48]
	ldp	x2, x3, [sp, 104]
	ldr	x0, [sp, 96]
	str	x0, [sp, 64]
	ldr	x0, [x8, 16]
	mov	x8, x9
	stp	x2, x3, [sp, 16]
	str	x0, [sp, 32]
	add	x0, sp, 48
	bl	add3
	ldp	x29, x30, [sp], 128
	ret
	.align	2
	.p2align 5,,15
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
	.p2align 5,,15
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
	.p2align 5,,15
	.global	mpow
mpow:
	cbnz	w1, .L10
	adrp	x0, .LANCHOR0
	add	x1, x0, :lo12:.LANCHOR0
	ldr	q31, [x0, :lo12:.LANCHOR0]
	ldr	q30, [x1, 16]
	stp	q31, q30, [x8]
	ret
	.p2align 2,,3
.L10:
	stp	x29, x30, [sp, -176]!
	mov	x3, x0
	mov	w2, w1
	mov	x29, sp
	lsr	w1, w1, 1
	str	x19, [sp, 16]
	add	x0, sp, 112
	mov	x19, x8
	add	x8, sp, 144
	ldp	q30, q31, [x3]
	str	w2, [sp, 36]
	str	x3, [sp, 40]
	stp	q30, q31, [sp, 112]
	bl	mpow
	add	x8, sp, 112
	ldp	q30, q31, [sp, 144]
	add	x1, sp, 48
	add	x0, sp, 80
	stp	q30, q31, [sp, 48]
	stp	q30, q31, [sp, 80]
	bl	mmul
	ldr	w2, [sp, 36]
	ldp	q30, q31, [sp, 112]
	stp	q30, q31, [sp, 144]
	tbz	x2, 0, .L12
	ldr	x3, [sp, 40]
	stp	q30, q31, [sp, 80]
	add	x1, sp, 48
	add	x0, sp, 80
	ldp	q30, q31, [x3]
	stp	q30, q31, [sp, 48]
	bl	mmul
	ldp	q31, q30, [sp, 112]
	stp	q31, q30, [sp, 144]
.L12:
	ldp	q31, q30, [sp, 144]
	stp	q31, q30, [x19]
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 176
	ret
	.align	2
	.p2align 5,,15
	.global	mkrec
mkrec:
	ldrb	w5, [x0]
	sub	sp, sp, #48
	cbz	w5, .L25
	add	x7, sp, 8
	mov	x4, 1
	.p2align 5,,15
.L22:
	add	x6, x7, x4
	strb	w5, [x6, -1]
	ldrb	w5, [x0, x4]
	cbz	w5, .L20
	add	x4, x4, 1
	cmp	x4, 13
	bne	.L22
	mov	w4, 12
.L20:
	sxtw	x6, w4
	mov	w5, 12
	sub	w4, w5, w4
	add	x5, sp, 9
	add	x4, x4, x6
	add	x0, x7, x6
	add	x4, x4, x5
	.p2align 5,,15
.L23:
	strb	wzr, [x0], 1
	cmp	x0, x4
	bne	.L23
	str	w1, [sp, 24]
	str	x2, [sp, 32]
	strh	w3, [sp, 40]
	ldp	q31, q30, [x7]
	ldr	x0, [x7, 32]
	str	x0, [x8, 32]
	stp	q31, q30, [x8]
	add	sp, sp, 48
	ret
.L25:
	add	x7, sp, 8
	mov	w4, 0
	b	.L20
	.align	2
	.p2align 5,,15
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
	.p2align 5,,15
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
	.p2align 5,,15
.L32:
	mov	v30.16b, v29.16b
	shl	v28.4s, v31.4s, 7
	mla	v30.4s, v31.4s, v29.4s
	add	v31.4s, v31.4s, v27.4s
	eor	v30.16b, v30.16b, v28.16b
	str	q30, [x0], 16
	cmp	x1, x0
	bne	.L32
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
	.p2align 5,,15
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
	.p2align 5,,15
.L36:
	ldr	w2, [x1], 4
	eor	x0, x2, x0
	mul	x0, x0, x3
	cmp	x4, x1
	bne	.L36
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
.LC18:
	.string	"direct %u %016lx\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #1712
	mov	x0, 3
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x21, x22, [sp, 48]
	adrp	x21, .LANCHOR1
	stp	x23, x24, [sp, 64]
	adrp	x24, .LANCHOR0
	add	x23, x24, :lo12:.LANCHOR0
	ldr	x22, [x21, :lo12:.LANCHOR1]
	add	x21, x21, :lo12:.LANCHOR1
	ldr	q31, [x23, 64]
	stp	x19, x20, [sp, 32]
	add	x20, sp, 968
	str	x0, [sp, 704]
	neg	x0, x22
	mov	w19, 1
	str	x25, [sp, 80]
	str	x22, [sp, 968]
	str	x0, [sp, 976]
	lsl	x0, x22, 1
	str	x0, [sp, 984]
	str	q31, [sp, 688]
.L39:
	sbfiz	x0, x19, 1, 32
	add	x25, x0, w19, sxtw
	sub	w0, w19, #1
	add	x8, sp, 640
	sbfiz	x1, x0, 1, 32
	add	x0, x1, w0, sxtw
	add	x1, sp, 608
	add	x0, x20, x0, lsl 3
	ldp	x2, x3, [x0]
	ldr	x0, [x0, 16]
	stp	x2, x3, [x1]
	add	x2, sp, 576
	str	x0, [sp, 624]
	add	x0, sp, 688
	ldp	x0, x1, [x0]
	stp	x0, x1, [x2]
	ldr	x0, [sp, 704]
	str	x0, [sp, 592]
	ubfiz	x0, x19, 3, 1
	add	x1, sp, 576
	add	x0, x21, x0
	add	w19, w19, 1
	ldr	x2, [x0, 16]
	add	x0, sp, 608
	blr	x2
	add	x1, sp, 640
	add	x0, x20, x25, lsl 3
	ldp	x2, x3, [x1]
	ldr	x1, [sp, 656]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	cmp	w19, 6
	bne	.L39
	adrp	x25, .LC9
	mov	x19, x20
	add	x25, x25, :lo12:.LC9
	mov	w21, 0
	.p2align 5,,15
.L40:
	ldr	x4, [x19, 16]
	mov	w1, w21
	ldp	x2, x3, [x19], 24
	add	w21, w21, 1
	mov	x0, x25
	bl	printf
	cmp	w21, 6
	bne	.L40
	add	x0, sp, 1088
	add	x2, sp, 640
	add	x6, sp, 720
	add	x8, sp, 712
	add	x19, sp, 672
	add	x21, sp, 688
	ldp	x0, x1, [x0]
	stp	x0, x1, [x2]
	ldr	x0, [sp, 1104]
	mov	x1, -3
	str	x0, [sp, 656]
	mov	x0, x2
	bl	scale
	ldp	x2, x3, [x6]
	adrp	x0, .LC10
	ldp	x4, x5, [x6, 368]
	add	x0, x0, :lo12:.LC10
	ldr	x1, [sp, 712]
	ldr	x6, [sp, 1104]
	bl	printf
	add	x0, sp, 688
	add	x2, sp, 640
	add	x8, sp, 736
	ldp	x0, x1, [x0]
	stp	x0, x1, [x2]
	ldr	x0, [sp, 704]
	add	x1, sp, 712
	str	x0, [sp, 656]
	ldr	x0, [sp, 728]
	ldp	x2, x3, [x1]
	add	x1, sp, 608
	stp	x2, x3, [x1]
	str	x0, [sp, 624]
	add	x0, sp, 640
	bl	triple
	ldr	x1, [sp, 736]
	adrp	x0, .LC11
	ldr	x2, [sp, 744]
	add	x0, x0, :lo12:.LC11
	ldr	x3, [sp, 752]
	bl	printf
	add	x0, sp, 688
	add	x2, sp, 640
	add	x8, sp, 760
	add	x7, sp, 416
	ldp	x0, x1, [x0]
	stp	x0, x1, [x2]
	ldr	x0, [sp, 704]
	add	x1, sp, 712
	str	x0, [sp, 656]
	ldr	x0, [sp, 728]
	ldp	x2, x3, [x1]
	add	x1, sp, 608
	stp	x2, x3, [x1]
	str	x0, [sp, 624]
	add	x0, sp, 640
	bl	cross
	add	x1, sp, 968
	add	x6, sp, 448
	ldr	x0, [x20, 16]
	add	x5, sp, 480
	ldp	x2, x3, [x1]
	add	x1, sp, 640
	add	x4, sp, 512
	adrp	x20, .LC14
	add	x20, x20, :lo12:.LC14
	stp	x2, x3, [x1]
	add	x2, sp, 608
	str	x0, [sp, 656]
	add	x0, sp, 992
	ldp	x0, x1, [x0]
	stp	x0, x1, [x2]
	add	x2, sp, 576
	ldr	x0, [sp, 1008]
	str	x0, [sp, 624]
	add	x0, sp, 1016
	ldp	x0, x1, [x0]
	stp	x0, x1, [x2]
	add	x2, sp, 544
	ldr	x0, [sp, 1032]
	str	x0, [sp, 592]
	add	x0, sp, 1040
	ldp	x0, x1, [x0]
	stp	x0, x1, [x2]
	add	x2, sp, 512
	ldr	x0, [sp, 1056]
	str	x0, [sp, 560]
	add	x0, sp, 1064
	ldp	x0, x1, [x0]
	stp	x0, x1, [x2]
	ldr	x0, [sp, 1080]
	str	x0, [sp, 528]
	add	x0, sp, 1088
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp, 480]
	ldr	x0, [sp, 1104]
	str	x0, [sp, 496]
	add	x0, sp, 688
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp, 448]
	ldr	x0, [sp, 704]
	add	x1, sp, 712
	str	x0, [sp, 464]
	ldr	x0, [sp, 728]
	ldp	x2, x3, [x1]
	stp	x2, x3, [sp, 416]
	str	x0, [sp, 432]
	add	x0, sp, 384
	ldr	x1, [x8, 16]
	ldp	x2, x3, [x8]
	str	x0, [sp]
	stp	x2, x3, [sp, 384]
	add	x0, sp, 640
	add	x3, sp, 544
	add	x2, sp, 576
	str	x1, [sp, 400]
	add	x1, sp, 608
	bl	nine
	mov	x1, x0
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	adrp	x0, .LC19
	ldr	q31, [x0, :lo12:.LC19]
	str	q31, [sp, 784]
	ldr	q31, [x24, :lo12:.LANCHOR0]
	str	q31, [sp, 800]
	ldr	q31, [x23, 80]
	str	q31, [sp, 672]
.L41:
	ldr	w13, [x19], 4
	ldp	q31, q30, [sp, 784]
	mov	w1, w13
	add	x0, sp, 352
	add	x8, sp, 816
	stp	q31, q30, [sp, 352]
	bl	mpow
	mov	w1, w13
	ldr	x2, [sp, 824]
	mov	x0, x20
	bl	printf
	cmp	x19, x21
	bne	.L41
	add	x8, sp, 848
	mov	w3, 12
	mov	x2, 1815
	mov	w1, 7
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	mkrec
	add	x8, sp, 928
	ldp	q30, q31, [sp, 848]
	mov	w1, 3
	ldr	x0, [sp, 880]
	str	x0, [sp, 336]
	add	x0, sp, 304
	stp	q30, q31, [sp, 304]
	bl	promote
	ldp	q30, q31, [x8]
	mov	w1, 4
	ldr	x0, [x8, 32]
	add	x8, sp, 888
	stp	q30, q31, [sp, 304]
	mov	x5, x8
	str	x0, [sp, 336]
	add	x0, sp, 304
	bl	promote
	ldr	w6, [sp, 904]
	ldr	x3, [sp, 872]
	mov	w0, 40
	ldr	x7, [sp, 912]
	str	w0, [sp, 8]
	ldrsh	w4, [sp, 880]
	add	x1, sp, 848
	ldr	w2, [sp, 864]
	ldrsh	w0, [sp, 920]
	str	w0, [sp]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	add	x8, sp, 1112
	mov	w0, w22
	bl	fill
	ldr	w6, [sp, 1308]
	ldr	w5, [sp, 1112]
	ldp	q26, q28, [x8]
	ldp	q27, q30, [x8, 32]
	ldp	q29, q31, [x8, 64]
	str	q26, [sp, 96]
	stp	q28, q27, [sp, 112]
	stp	q30, q29, [sp, 144]
	str	q31, [sp, 176]
	ldp	q27, q26, [x8, 96]
	ldp	q29, q28, [x8, 128]
	ldp	q31, q30, [x8, 160]
	stp	q27, q26, [sp, 192]
	stp	q29, q28, [sp, 224]
	stp	q31, q30, [sp, 256]
	ldr	x0, [x8, 192]
	str	x0, [sp, 288]
	add	x0, sp, 96
	bl	digest
	mov	w2, w6
	mov	w1, w5
	mov	x3, x0
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	add	x8, sp, 1312
	mov	w0, 7
	bl	fill
	add	x8, sp, 1512
	ldr	w5, [sp, 1444]
	mov	w0, 8
	bl	fill
	ldp	q26, q28, [x8]
	ldp	q27, q30, [x8, 32]
	ldp	q29, q31, [x8, 64]
	str	q26, [sp, 96]
	stp	q28, q27, [sp, 112]
	stp	q30, q29, [sp, 144]
	str	q31, [sp, 176]
	ldp	q27, q26, [x8, 96]
	ldp	q29, q28, [x8, 128]
	ldp	q31, q30, [x8, 160]
	stp	q27, q26, [sp, 192]
	stp	q29, q28, [sp, 224]
	stp	q31, q30, [sp, 256]
	ldr	x0, [x8, 192]
	str	x0, [sp, 288]
	add	x0, sp, 96
	bl	digest
	mov	w1, w5
	mov	x2, x0
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	printf
	ldr	x25, [sp, 80]
	mov	w0, 0
	ldp	x29, x30, [sp, 16]
	ldp	x19, x20, [sp, 32]
	ldp	x21, x22, [sp, 48]
	ldp	x23, x24, [sp, 64]
	add	sp, sp, 1712
	ret
	.global	knob
	.global	ops
	.section .rodata
	.align	4
	.LANCHOR0:
.LC3:
	.xword	1
	.xword	0
.LC4:
	.xword	0
	.xword	1
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
	.xword	1
	.xword	2
.LC13:
	.word	10
	.word	50
	.word	90
	.word	1000000
.LC19:
	.xword	1
	.xword	1
	.data
	.align	4
	.LANCHOR1:
knob:
	.xword	5
	.zero	8
ops:
	.xword	cross
	.xword	add3

