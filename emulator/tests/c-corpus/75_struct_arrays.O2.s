	.text
	.align	2
	.align 5
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
	.align 5
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
	.align 5
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
	.align 5
.L11:
	ldp	x2, x3, [x8]
	stp	x2, x3, [x9]
	ldr	w7, [x8, 8]
	ldr	x6, [x8]
	mov	w2, w10
	ldr	x1, [x8, 16]
	str	x1, [x9, 16]
	mov	x1, x8
	.align 5
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
	.align 2
.L18:
	add	w1, w2, 1
	umaddl	x1, w1, w12, x0
	b	.L8
.L15:
	ret
	.align	2
	.align 5
	.global	find24
find24:
	mov	x6, x0
	mov	w4, w1
	mov	w0, 0
	mov	w7, 24
	b	.L21
	.align 2
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
	.align 2
.L26:
	add	w0, w3, 1
	b	.L21
.L25:
	mov	w0, -1
	ret
	.align	2
	.align 5
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
	.align 5
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
	.align 5
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
	.align 2
.L33:
	ret
	.section .rodata
	.align	3
.LC3:
	.string	"grow %d\n"
	.text
	.align	2
	.align 5
	.global	push
push:
	stp	x29, x30, [sp, -48]!
	mov	x3, x0
	mov	x4, x1
	mov	x29, sp
	ldp	w1, w0, [x0, 8]
	cmp	w1, w0
	beq	.L44
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
	.align 2
.L44:
	cbnz	w1, .L45
	mov	x1, 20
	mov	w2, 1
.L38:
	ldr	x0, [x3]
	str	x3, [sp, 24]
	str	w2, [sp, 36]
	str	x4, [sp, 40]
	bl	realloc
	mov	x1, x0
	mov	w0, 0
	cbz	x1, .L36
	ldr	x3, [sp, 24]
	adrp	x0, .LC3
	ldr	w2, [sp, 36]
	add	x0, x0, :lo12:.LC3
	str	x1, [x3]
	mov	w1, w2
	str	w2, [x3, 12]
	bl	printf
	ldr	x3, [sp, 24]
	ldr	x4, [sp, 40]
	ldr	w1, [x3, 8]
	b	.L37
	.align 2
.L45:
	lsl	w2, w1, 1
	mov	w1, 20
	smull	x1, w2, w1
	b	.L38
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
	.string	"out of memory\n"
	.align	3
.LC10:
	.string	"vec %d %d %ld\n"
	.align	3
.LC11:
	.string	"sizes %d %d %d %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #880
	adrp	x0, .LANCHOR1
	mov	w3, 0
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	ldr	w19, [x0, :lo12:.LANCHOR1]
	stp	x21, x22, [sp, 32]
	add	x22, sp, 256
	and	w5, w19, 65535
	mov	x1, x22
	neg	w4, w5
	mov	w0, 0
	stp	x23, x24, [sp, 48]
	str	x25, [sp, 64]
	.align 5
.L47:
	mul	w2, w0, w0
	str	w0, [x1]
	add	w0, w0, 1
	strh	w4, [x1, 4]
	sub	w2, w2, #7
	strh	w3, [x1, 6]
	str	w2, [x1, 8]
	add	w4, w4, 1
	add	w3, w5, w3
	add	x1, x1, 12
	cmp	w0, 10
	bne	.L47
	add	x21, sp, 604
	mov	w5, 0
	mov	x4, x21
	mov	w3, 26
	.align 5
.L49:
	add	w1, w5, w5, lsl 2
	add	w2, w5, w5, lsl 1
	str	w5, [x4, -4]
	sdiv	w0, w1, w19
	msub	w0, w0, w19, w1
	mov	x1, 0
	sub	w0, w0, #3
	sxtw	x0, w0
	str	x0, [x4, -12]
	.align 5
.L48:
	sdiv	w0, w2, w3
	msub	w0, w0, w3, w2
	add	w2, w2, w19
	add	w0, w0, 97
	strb	w0, [x4, x1]
	add	x1, x1, 1
	cmp	x1, 7
	bne	.L48
	add	w5, w5, 1
	strb	wzr, [x4, 7]
	add	x4, x4, 24
	cmp	w5, 12
	bne	.L49
	adrp	x3, .LANCHOR0
	add	x3, x3, :lo12:.LANCHOR0
	add	x23, sp, 376
	mov	w1, 0
	mov	x0, x23
	mov	w2, 65
	ldp	q31, q30, [x3]
	.align 5
.L50:
	dup	v29.4s, w1
	add	w1, w1, 10
	strb	w2, [x0]
	add	w2, w2, 1
	add	x0, x0, 36
	add	v28.4s, v29.4s, v31.4s
	add	v29.4s, v29.4s, v30.4s
	str	q28, [x0, -32]
	str	q29, [x0, -16]
	cmp	w1, 60
	bne	.L50
	mov	w20, 0
	mov	x4, 0
	.align 5
.L51:
	sbfiz	x0, x20, 1, 32
	add	x0, x0, w20, sxtw
	add	w20, w20, 1
	lsl	x2, x0, 2
	add	x1, x22, x0, lsl 2
	ldr	x0, [x22, x2]
	ldr	w1, [x1, 8]
	bl	score
	add	x4, x4, x0
	cmp	w20, 10
	bne	.L51
	add	x0, sp, 364
	ldr	w1, [sp, 372]
	adrp	x24, .LC5
	add	x24, x24, :lo12:.LC5
	mov	w25, 32
	ldr	x0, [x0]
	bl	score
	mov	x1, x4
	mov	x2, x0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	x0, x22
	add	x2, sp, 376
	add	x1, sp, 592
	mov	w4, 5
	mov	w3, 1
	bl	distances
	sub	w3, w19, #2
	add	x2, sp, 376
	mov	x0, x22
	mov	w4, 0
	mov	w22, 0
	add	x1, sp, 592
	bl	distances
	add	x0, sp, 592
	mov	w1, 12
	bl	sort24
	.align 5
.L53:
	ldr	x1, [x21, -12]
	and	w0, w22, 3
	ldr	w2, [x21, -4]
	cmp	w0, 3
	mov	x3, x21
	csel	w4, w25, w20, ne
	mov	x0, x24
	add	w22, w22, 1
	add	x21, x21, 24
	bl	printf
	cmp	w22, 12
	bne	.L53
	mov	x20, -4
	adrp	x21, .LC6
	mov	x2, x20
	add	x21, x21, :lo12:.LC6
	add	x0, sp, 592
	mov	w1, 12
	bl	find24
	cmp	x20, 4
	beq	.L81
.L54:
	mov	w1, w0
	add	x20, x20, 1
	mov	w2, 32
	mov	x0, x21
	bl	printf
	mov	x2, x20
	add	x0, sp, 592
	mov	w1, 12
	bl	find24
	cmp	x20, 4
	bne	.L54
.L81:
	mov	w2, 10
	mov	w1, w0
	mov	x0, x21
	bl	printf
	ldp	q30, q31, [sp, 448]
	add	x8, sp, 160
	ldr	w0, [sp, 480]
	mov	w1, w19
	str	w0, [sp, 144]
	add	x0, sp, 112
	stp	q30, q31, [sp, 112]
	bl	bump
	ldr	w0, [x8, 32]
	ldr	q31, [x8, 16]
	mov	w1, 6
	ldr	q30, [sp, 160]
	str	w0, [sp, 480]
	add	x0, sp, 376
	adrp	x20, .LC7
	add	x21, sp, 556
	add	x20, x20, :lo12:.LC7
	stp	q30, q31, [sp, 448]
	bl	reverse36
	ldrb	w1, [sp, 376]
	ldr	w2, [sp, 384]
	ldr	w3, [sp, 408]
.L55:
	mov	x0, x20
	mov	w4, 32
	bl	printf
	add	x23, x23, 36
	ldrb	w1, [x23]
	ldr	w2, [x23, 8]
	ldr	w3, [x23, 32]
	cmp	x23, x21
	bne	.L55
	mov	x0, x20
	mov	w4, 10
	bl	printf
	adrp	x8, .LANCHOR2
	add	x8, x8, :lo12:.LANCHOR2
	mov	x9, x8
	mov	w5, 0
	mov	w7, 0
.L57:
	mul	w6, w7, w7
	mov	w3, w7
	mov	x1, x9
	mov	w2, 0
	mov	w0, 0
	.align 5
.L59:
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
	bne	.L59
	add	w7, w7, 1
	add	x9, x9, 84
	add	w5, w5, 7
	cmp	w7, 5
	bne	.L57
	mov	w4, 0
	mov	x7, 0
	mov	x6, 0
.L60:
	sxtw	x5, w4
	add	x0, x5, w4, sxtw 1
	add	w4, w4, 1
	lsl	x0, x0, 5
	add	x1, x8, x0
	ldr	x0, [x8, x0]
	ldr	w1, [x1, 8]
	bl	score
	add	x1, x5, x5, lsl 2
	add	x6, x6, x0
	add	x1, x5, x1, lsl 2
	add	x1, x8, x1, lsl 2
	ldr	x0, [x1, 72]
	ldr	w1, [x1, 80]
	bl	score
	add	x7, x7, x0
	cmp	w4, 5
	bne	.L60
	mov	x2, x7
	mov	x1, x6
	mov	w3, 408
	adrp	x0, .LC8
	mov	w20, 0
	add	x0, x0, :lo12:.LC8
	mov	w21, 40
	bl	printf
	stp	xzr, xzr, [sp, 216]
	b	.L63
	.align 2
.L61:
	add	w20, w20, 1
	cmp	w20, 40
	beq	.L82
.L63:
	neg	w0, w20
	stp	w20, w0, [sp, 232]
	mul	w0, w20, w20
	add	x1, sp, 80
	str	w0, [sp, 240]
	eor	w0, w19, w20
	str	w0, [sp, 244]
	sub	w0, w21, w20
	str	w0, [sp, 96]
	ldp	x2, x3, [sp, 232]
	stp	x2, x3, [sp, 80]
	str	w0, [sp, 248]
	add	x0, sp, 216
	bl	push
	cbnz	w0, .L61
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	mov	w0, 1
.L46:
	ldr	x25, [sp, 64]
	ldp	x29, x30, [sp]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	add	sp, sp, 880
	ret
.L82:
	ldr	w1, [sp, 224]
	cmp	w1, 0
	ble	.L69
	ldr	x4, [sp, 216]
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
	.align 5
.L65:
	sub	x2, x4, #20
.L66:
	lsl	x0, x3, 5
	sub	x0, x0, x3
	ldrsw	x3, [x2], 4
	add	x0, x0, x3
	smulh	x3, x0, x6
	add	x3, x0, x3
	asr	x3, x3, 29
	sub	x3, x3, x0, asr 63
	msub	x3, x3, x5, x0
	cmp	x4, x2
	bne	.L66
	add	x4, x4, 20
	cmp	x4, x7
	bne	.L65
.L64:
	ldr	w2, [sp, 228]
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldr	x0, [sp, 216]
	bl	free
	mov	w4, 36
	mov	w3, 24
	mov	w2, 20
	mov	w1, 12
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	mov	w0, 0
	b	.L46
.L69:
	mov	x3, 0
	b	.L64
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

