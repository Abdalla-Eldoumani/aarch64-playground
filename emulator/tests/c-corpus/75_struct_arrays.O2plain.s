	.text
	.align	2
	.p2align 5,,15
	.global	score
score:
	ubfx	x2, x0, 32, 16
	sub	sp, sp, #16
	add	sp, sp, 16
	sbfiz	w3, w2, 2, 16
	add	w2, w3, w2, sxth
	mov	w3, 1000
	lsl	w2, w2, 1
	sxtw	x2, w2
	smaddl	x2, w0, w3, x2
	add	x0, x2, x0, asr 48
	sub	x0, x0, w1, sxtw
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"d %d %d: %ld %ld %ld bytes %ld\n"
	.text
	.align	2
	.p2align 5,,15
	.global	distances
distances:
	mov	w1, w3
	sxtw	x3, w4
	mov	x2, x3
	mov	x5, 36409
	sub	x3, x3, w1, sxtw
	movk	x5, 0x38e3, lsl 16
	mov	x0, -6148914691236517206
	movk	x5, 0xe38e, lsl 32
	add	x4, x3, x3, lsl 3
	add	x3, x3, x3, lsl 1
	movk	x0, 0xaaab, lsl 0
	movk	x5, 0x8e38, lsl 48
	lsl	x6, x4, 2
	mul	x5, x4, x5
	mul	x4, x3, x0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	mov	x3, x4
	b	printf
	.align	2
	.p2align 5,,15
	.global	sort24
sort24:
	cmp	w1, 1
	ble	.L15
	sub	sp, sp, #32
	add	x8, x0, 24
	sub	w11, w1, #1
	add	x9, sp, 8
	mov	w10, 0
	mov	w12, 24
	.p2align 5,,15
.L11:
	ldp	x2, x3, [x8]
	stp	x2, x3, [x9]
	ldr	w7, [x8, 8]
	ldr	x6, [x8]
	mov	w2, w10
	ldr	x1, [x8, 16]
	str	x1, [x9, 16]
	mov	x1, x8
	.p2align 5,,15
.L7:
	ldr	x3, [x1, -24]
	cmp	x3, x6
	bgt	.L9
	bne	.L18
	ldr	w3, [x1, -16]
	cmp	w3, w7
	bge	.L18
.L9:
	ldp	x4, x5, [x1, -24]
	sub	w2, w2, #1
	ldr	x3, [x1, -8]
	stp	x4, x5, [x1]
	sub	x1, x1, #24
	str	x3, [x1, 40]
	cmn	w2, #1
	bne	.L7
	mov	x1, x0
.L8:
	ldp	x4, x5, [x9]
	add	w10, w10, 1
	ldr	x2, [x9, 16]
	stp	x4, x5, [x1]
	add	x8, x8, 24
	str	x2, [x1, 16]
	cmp	w11, w10
	bne	.L11
	add	sp, sp, 32
	ret
	.p2align 2,,3
.L18:
	add	w1, w2, 1
	umaddl	x1, w1, w12, x0
	b	.L8
.L15:
	ret
	.align	2
	.p2align 5,,15
	.global	find24
find24:
	mov	x6, x0
	mov	w4, w1
	mov	w0, 0
	mov	w7, 24
	b	.L21
	.p2align 2,,3
.L22:
	sub	w3, w4, w0
	add	w3, w0, w3, asr 1
	smull	x5, w3, w7
	ldr	x5, [x6, x5]
	cmp	x5, x2
	blt	.L26
	mov	w4, w3
.L21:
	cmp	w4, w0
	bgt	.L22
	cmp	w1, w0
	ble	.L25
	mov	w1, 24
	smull	x1, w0, w1
	ldr	x1, [x6, x1]
	cmp	x1, x2
	csinv	w0, w0, wzr, eq
	ret
	.p2align 2,,3
.L26:
	add	w0, w3, 1
	b	.L21
.L25:
	mov	w0, -1
	ret
	.align	2
	.p2align 5,,15
	.global	bump
bump:
	adrp	x2, .LANCHOR0
	add	x3, x2, :lo12:.LANCHOR0
	ldr	q0, [x0, 4]
	fmov	s31, w1
	ldr	q30, [x3, 16]
	ldr	q29, [x0, 20]
	ldr	q1, [x2, :lo12:.LANCHOR0]
	mla	v29.4s, v30.4s, v31.s[0]
	ldrb	w1, [x0]
	mla	v0.4s, v1.4s, v31.s[0]
	add	w1, w1, 1
	strb	w1, [x0]
	str	q29, [x0, 20]
	str	q0, [x0, 4]
	ldp	q31, q30, [x0]
	ldr	w0, [x0, 32]
	str	w0, [x8, 32]
	stp	q31, q30, [x8]
	ret
	.align	2
	.p2align 5,,15
	.global	reverse36
reverse36:
	cmp	w1, 1
	ble	.L33
	sub	x3, x0, #36
	mov	w2, 36
	sub	sp, sp, #48
	add	x5, sp, 8
	umaddl	x2, w1, w2, x3
	sub	w1, w1, #1
	mov	w3, 0
	.p2align 5,,15
.L30:
	ldp	q31, q30, [x0]
	add	w3, w3, 1
	ldr	w4, [x0, 32]
	str	w4, [x5, 32]
	stp	q31, q30, [x5]
	ldr	w6, [x2, 32]
	ldp	q29, q28, [x2]
	str	w6, [x0, 32]
	stp	q29, q28, [x0]
	add	x0, x0, 36
	stp	q31, q30, [x2]
	sub	x2, x2, #36
	str	w4, [x2, 68]
	sub	w4, w1, w3
	cmp	w3, w4
	blt	.L30
	add	sp, sp, 48
	ret
	.p2align 2,,3
.L33:
	ret
	.section .rodata
	.align	3
.LC3:
	.string	"grow %d\n"
	.text
	.align	2
	.p2align 5,,15
	.global	push
push:
	stp	x29, x30, [sp, -48]!
	mov	x3, x0
	mov	x4, x1
	mov	x29, sp
	ldp	w1, w0, [x0, 8]
	cmp	w1, w0
	beq	.L43
.L37:
	ldr	x0, [x3]
	add	w2, w1, 1
	str	w2, [x3, 8]
	mov	w2, 20
	smaddl	x1, w1, w2, x0
	ldr	w0, [x4, 16]
	ldp	x2, x3, [x4]
	stp	x2, x3, [x1]
	str	w0, [x1, 16]
	mov	w0, 1
.L36:
	ldp	x29, x30, [sp], 48
	ret
	.p2align 2,,3
.L43:
	cbnz	w1, .L44
	mov	x1, 20
	mov	w2, 1
.L38:
	ldr	x0, [x3]
	str	x3, [sp, 24]
	str	w2, [sp, 36]
	str	x4, [sp, 40]
	bl	realloc
	cbz	x0, .L41
	ldr	x3, [sp, 24]
	ldr	w2, [sp, 36]
	str	x0, [x3]
	mov	w1, w2
	str	w2, [x3, 12]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	x3, [sp, 24]
	ldr	x4, [sp, 40]
	ldr	w1, [x3, 8]
	b	.L37
	.p2align 2,,3
.L44:
	lsl	w2, w1, 1
	mov	w1, 20
	smull	x1, w2, w1
	b	.L38
.L41:
	mov	w0, 0
	b	.L36
	.section .rodata
	.align	3
.LC4:
	.string	"score %ld last %ld\n"
	.align	3
.LC5:
	.string	"%ld:%d:%s%c"
	.align	3
.LC6:
	.string	"%d%c"
	.align	3
.LC7:
	.string	"%c%d,%d%c"
	.align	3
.LC8:
	.string	"grid %ld %ld %d\n"
	.align	3
.LC9:
	.string	"out of memory"
	.align	3
.LC10:
	.string	"vec %d %d %ld\n"
	.align	3
.LC11:
	.string	"sizes %d %d %d %d\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #832
	adrp	x0, .LANCHOR1
	add	x6, sp, 208
	mov	w3, 0
	mov	x1, x6
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x23, x24, [sp, 48]
	ldr	w24, [x0, :lo12:.LANCHOR1]
	mov	w0, 0
	stp	x19, x20, [sp, 16]
	and	w5, w24, 65535
	neg	w4, w5
	stp	x21, x22, [sp, 32]
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	.p2align 5,,15
.L46:
	mul	w2, w0, w0
	str	w0, [x1]
	add	w0, w0, 1
	sub	w2, w2, #7
	strh	w4, [x1, 4]
	strh	w3, [x1, 6]
	add	w4, w4, 1
	str	w2, [x1, 8]
	add	w3, w5, w3
	add	x1, x1, 12
	cmp	w0, 10
	bne	.L46
	add	x20, sp, 556
	mov	w5, 0
	mov	x4, x20
	mov	w3, 26
	.p2align 5,,15
.L48:
	add	w1, w5, w5, lsl 2
	add	w2, w5, w5, lsl 1
	str	w5, [x4, -4]
	sdiv	w0, w1, w24
	msub	w0, w0, w24, w1
	mov	x1, 0
	sub	w0, w0, #3
	sxtw	x0, w0
	str	x0, [x4, -12]
	.p2align 5,,15
.L47:
	sdiv	w0, w2, w3
	msub	w0, w0, w3, w2
	add	w2, w2, w24
	add	w0, w0, 97
	strb	w0, [x4, x1]
	add	x1, x1, 1
	cmp	x1, 7
	bne	.L47
	add	w5, w5, 1
	strb	wzr, [x4, 7]
	add	x4, x4, 24
	cmp	w5, 12
	bne	.L48
	adrp	x22, .LANCHOR0
	add	x21, x22, :lo12:.LANCHOR0
	add	x19, sp, 328
	mov	w1, 0
	mov	x0, x19
	mov	w2, 65
	ldp	q29, q28, [x21]
	.p2align 5,,15
.L49:
	dup	v31.4s, w1
	add	w1, w1, 10
	strb	w2, [x0]
	add	w2, w2, 1
	add	x0, x0, 36
	add	v30.4s, v31.4s, v29.4s
	add	v31.4s, v31.4s, v28.4s
	str	q30, [x0, -32]
	str	q31, [x0, -16]
	cmp	w1, 60
	bne	.L49
	add	x4, x6, 120
	mov	x1, 0
	mov	w3, 1000
	.p2align 5,,15
.L50:
	ldrsh	w0, [x6, 4]
	add	x6, x6, 12
	ldr	w2, [x6, -12]
	add	w0, w0, w0, lsl 2
	lsl	w0, w0, 1
	sxtw	x0, w0
	smaddl	x0, w2, w3, x0
	ldrsh	x2, [x6, -6]
	add	x0, x0, x2
	ldrsw	x2, [x6, -4]
	sub	x0, x0, x2
	add	x1, x1, x0
	cmp	x6, x4
	bne	.L50
	ldrsh	w0, [sp, 320]
	adrp	x23, .LC0
	ldr	w2, [sp, 316]
	adrp	x26, .LC5
	add	x26, x26, :lo12:.LC5
	mov	w28, 32
	add	w0, w0, w0, lsl 2
	mov	w27, 10
	add	x25, sp, 544
	lsl	w0, w0, 1
	sxtw	x0, w0
	smaddl	x0, w2, w3, x0
	ldrsh	x2, [sp, 322]
	add	x0, x0, x2
	ldrsw	x2, [sp, 324]
	sub	x2, x0, x2
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	x5, 4
	add	x0, x23, :lo12:.LC0
	mov	x4, x5
	mov	x3, x5
	mov	x6, 144
	mov	w2, 5
	mov	w1, 1
	bl	printf
	sub	w1, w24, #2
	mov	x5, 36409
	movk	x5, 0x38e3, lsl 16
	mov	x3, -6148914691236517206
	sxtw	x0, w1
	movk	x5, 0xe38e, lsl 32
	movk	x3, 0xaaab, lsl 0
	movk	x5, 0x8e38, lsl 48
	neg	x2, x0, lsl 3
	sub	x2, x2, x0
	sub	x0, x0, x0, lsl 2
	lsl	x6, x2, 2
	mul	x4, x0, x3
	add	x0, x23, :lo12:.LC0
	mul	x5, x2, x5
	mov	w23, 0
	mov	x3, x4
	mov	w2, 0
	bl	printf
	mov	x0, x25
	mov	w1, 12
	bl	sort24
	.p2align 5,,15
.L52:
	ldr	x1, [x20, -12]
	and	w0, w23, 3
	ldr	w2, [x20, -4]
	cmp	w0, 3
	mov	x3, x20
	csel	w4, w28, w27, ne
	mov	x0, x26
	add	w23, w23, 1
	add	x20, x20, 24
	bl	printf
	cmp	w23, 12
	bne	.L52
	adrp	x20, .LC6
	add	x20, x20, :lo12:.LC6
	mov	x23, -4
	mov	w26, 24
	.p2align 5,,15
.L53:
	mov	w2, 12
	mov	w1, 0
	b	.L54
	.p2align 2,,3
.L55:
	sub	w0, w2, w1
	add	w0, w1, w0, asr 1
	smull	x3, w0, w26
	ldr	x3, [x25, x3]
	cmp	x3, x23
	blt	.L86
	mov	w2, w0
.L54:
	cmp	w2, w1
	bgt	.L55
	cmp	w1, 11
	bgt	.L73
	smull	x0, w1, w26
	ldr	x0, [x25, x0]
	cmp	x0, x23
	csinv	w1, w1, wzr, eq
.L56:
	cmp	x23, 4
	beq	.L87
	mov	x0, x20
	mov	w2, 32
	add	x23, x23, 1
	bl	printf
	b	.L53
	.p2align 2,,3
.L86:
	add	w1, w0, 1
	b	.L54
	.p2align 2,,3
.L87:
	mov	x0, x20
	mov	w2, 10
	bl	printf
	add	x20, sp, 168
	ldp	q30, q31, [sp, 400]
	fmov	s29, w24
	ldr	w1, [sp, 432]
	add	x0, sp, 328
	str	w1, [sp, 160]
	stp	q30, q31, [sp, 128]
	ldrb	w1, [sp, 400]
	ldr	q31, [sp, 132]
	add	w1, w1, 1
	ldr	q30, [x22, :lo12:.LANCHOR0]
	strb	w1, [sp, 128]
	add	x22, sp, 508
	mla	v31.4s, v30.4s, v29.s[0]
	ldr	q30, [x21, 16]
	adrp	x21, .LC7
	add	x21, x21, :lo12:.LC7
	str	q31, [sp, 132]
	ldr	q31, [sp, 148]
	mla	v31.4s, v30.4s, v29.s[0]
	str	q31, [sp, 148]
	ldr	w1, [sp, 160]
	ldp	q30, q31, [sp, 128]
	str	w1, [sp, 432]
	str	q30, [sp, 168]
	stp	q30, q31, [sp, 400]
	str	w1, [x20, 32]
	mov	w1, 6
	str	q31, [x20, 16]
	bl	reverse36
	ldrb	w1, [sp, 328]
	ldr	w2, [sp, 336]
	ldr	w3, [sp, 360]
.L58:
	mov	x0, x21
	mov	w4, 32
	bl	printf
	add	x19, x19, 36
	ldrb	w1, [x19]
	ldr	w2, [x19, 8]
	ldr	w3, [x19, 32]
	cmp	x19, x22
	bne	.L58
	mov	x0, x21
	mov	w4, 10
	bl	printf
	adrp	x7, .LANCHOR2
	add	x7, x7, :lo12:.LANCHOR2
	mov	x9, x7
	mov	w5, 0
	mov	w8, 0
.L60:
	mul	w6, w8, w8
	mov	w3, w8
	mov	x1, x9
	mov	w2, 0
	mov	w0, 0
	.p2align 5,,15
.L62:
	add	w4, w0, w5
	str	w4, [x1]
	sub	w4, w3, w0
	strh	w4, [x1, 4]
	msub	w4, w0, w0, w6
	add	w0, w0, 1
	strh	w2, [x1, 6]
	add	w2, w2, w3
	str	w4, [x1, 8]
	add	x1, x1, 12
	cmp	w0, 7
	bne	.L62
	add	w8, w8, 1
	add	x9, x9, 84
	add	w5, w5, 7
	cmp	w8, 5
	bne	.L60
	add	x6, x7, 420
	mov	x4, x7
	mov	x2, 0
	mov	x1, 0
	mov	w5, 1000
.L64:
	ldrsh	w0, [x7, 4]
	add	x4, x4, 84
	ldr	w3, [x7]
	add	x7, x7, 96
	add	w0, w0, w0, lsl 2
	lsl	w0, w0, 1
	sxtw	x0, w0
	smaddl	x0, w3, w5, x0
	ldrsh	x3, [x7, -90]
	add	x0, x0, x3
	ldrsw	x3, [x7, -88]
	sub	x0, x0, x3
	ldr	w3, [x4, -12]
	add	x1, x1, x0
	ldrsh	w0, [x4, -8]
	add	w0, w0, w0, lsl 2
	lsl	w0, w0, 1
	sxtw	x0, w0
	smaddl	x0, w3, w5, x0
	ldrsh	x3, [x4, -6]
	add	x0, x0, x3
	ldrsw	x3, [x4, -4]
	sub	x0, x0, x3
	add	x2, x2, x0
	cmp	x4, x6
	bne	.L64
	mov	w3, 408
	adrp	x0, .LC8
	mov	w19, 0
	add	x0, x0, :lo12:.LC8
	mov	w21, 40
	bl	printf
	stp	xzr, xzr, [sp, 128]
	b	.L67
	.p2align 2,,3
.L65:
	add	w19, w19, 1
	cmp	w19, 40
	beq	.L88
.L67:
	neg	w0, w19
	stp	w19, w0, [sp, 168]
	mul	w0, w19, w19
	add	x1, sp, 96
	str	w0, [sp, 176]
	eor	w0, w24, w19
	str	w0, [sp, 180]
	sub	w0, w21, w19
	str	w0, [sp, 184]
	ldp	x2, x3, [x20]
	stp	x2, x3, [sp, 96]
	str	w0, [sp, 112]
	add	x0, sp, 128
	bl	push
	cbnz	w0, .L65
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	puts
	mov	w0, 1
.L45:
	ldp	x29, x30, [sp]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	add	sp, sp, 832
	ret
.L88:
	ldr	w1, [sp, 136]
	cmp	w1, 0
	ble	.L74
	ldr	x4, [sp, 128]
	mov	w7, 20
	mov	x6, 36837
	mov	x5, 51719
	add	x4, x4, 20
	movk	x6, 0x12a2, lsl 16
	movk	x6, 0x5f31, lsl 32
	mov	x3, 0
	movk	x6, 0x8970, lsl 48
	movk	x5, 0x3b9a, lsl 16
	umaddl	x7, w1, w7, x4
	.p2align 5,,15
.L69:
	sub	x2, x4, #20
.L70:
	lsl	x0, x3, 5
	sub	x0, x0, x3
	ldrsw	x3, [x2], 4
	add	x0, x0, x3
	smulh	x3, x0, x6
	add	x3, x0, x3
	asr	x3, x3, 29
	sub	x3, x3, x0, asr 63
	msub	x3, x3, x5, x0
	cmp	x2, x4
	bne	.L70
	add	x4, x4, 20
	cmp	x4, x7
	bne	.L69
.L68:
	ldr	w2, [sp, 140]
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldr	x0, [sp, 128]
	bl	free
	mov	w4, 36
	mov	w3, 24
	mov	w2, 20
	mov	w1, 12
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	mov	w0, 0
	b	.L45
.L73:
	mov	w1, -1
	b	.L56
.L74:
	mov	x3, 0
	b	.L68
	.global	knob
	.global	grid
	.section .rodata
	.align	4
	.LANCHOR0:
.LC1:
	.word	0
	.word	1
	.word	2
	.word	3
.LC2:
	.word	4
	.word	5
	.word	6
	.word	7
	.data
	.align	2
	.LANCHOR1:
knob:
	.word	7
	.bss
	.align	3
	.LANCHOR2:
grid:
	.zero	420

