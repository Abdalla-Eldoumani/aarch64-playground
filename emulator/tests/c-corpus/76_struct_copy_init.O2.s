	.text
	.align	2
	.align 5
	.global	counter
counter:
	sub	sp, sp, #16
	add	x4, sp, 13
	str	w1, [sp, 8]
	ubfx	x1, x1, 32, 8
	strb	w1, [sp, 12]
	adrp	x1, .LANCHOR0
	add	x5, x1, :lo12:.LANCHOR0
	str	x0, [sp]
	ldr	w0, [x1, :lo12:.LANCHOR0]
	ldr	x2, [x5, 8]
	add	w0, w0, 1
	str	w0, [x1, :lo12:.LANCHOR0]
	mov	x1, sp
	.align 5
.L2:
	ldrb	w3, [x1], 1
	add	x2, x2, x3
	cmp	x4, x1
	bne	.L2
	mov	x1, 63439
	str	x2, [x5, 8]
	movk	x1, 0xe353, lsl 16
	movk	x1, 0x9ba5, lsl 32
	add	sp, sp, 16
	movk	x1, 0x20c4, lsl 48
	smulh	x1, x2, x1
	asr	x1, x1, 7
	sub	x1, x1, x2, asr 63
	add	x1, x1, x1, lsl 2
	add	x1, x1, x1, lsl 2
	add	x1, x1, x1, lsl 2
	sub	x1, x2, x1, lsl 3
	mov	w2, 1000
	madd	w0, w0, w2, w1
	ret
	.align	2
	.align 5
	.global	make100
make100:
	adrp	x4, .LANCHOR1
	sub	sp, sp, #112
	dup	v31.4s, w0
	mov	x2, sp
	ldr	q30, [x4, :lo12:.LANCHOR1]
	adrp	x4, .LC1
	movi	v29.4s, 0x4
	add	x3, sp, 96
	movi	v28.4s, 0x8
	mov	x1, sp
	movi	v27.4s, 0xc
	ldr	q26, [x4, :lo12:.LC1]
	movi	v25.4s, 0x1a
	movi	v24.16b, 0x61
	movi	v23.4s, 0x10
	.align 5
.L7:
	add	v1.4s, v30.4s, v29.4s
	add	v0.4s, v30.4s, v28.4s
	add	v17.4s, v30.4s, v27.4s
	shl	v22.4s, v30.4s, 3
	shl	v20.4s, v1.4s, 3
	shl	v18.4s, v0.4s, 3
	shl	v21.4s, v17.4s, 3
	sub	v22.4s, v22.4s, v30.4s
	sub	v20.4s, v20.4s, v1.4s
	sub	v18.4s, v18.4s, v0.4s
	sub	v21.4s, v21.4s, v17.4s
	add	v22.4s, v22.4s, v31.4s
	add	v20.4s, v20.4s, v31.4s
	add	v18.4s, v18.4s, v31.4s
	add	v21.4s, v21.4s, v31.4s
	smull	v19.2d, v22.2s, v26.2s
	smull2	v16.2d, v22.4s, v26.4s
	smull	v6.2d, v20.2s, v26.2s
	smull2	v5.2d, v20.4s, v26.4s
	smull	v3.2d, v18.2s, v26.2s
	uzp2	v16.4s, v19.4s, v16.4s
	smull2	v2.2d, v18.4s, v26.4s
	smull	v0.2d, v21.2s, v26.2s
	smull2	v19.2d, v21.4s, v26.4s
	uzp2	v5.4s, v6.4s, v5.4s
	uzp2	v2.4s, v3.4s, v2.4s
	cmlt	v7.4s, v22.4s, #0
	uzp2	v19.4s, v0.4s, v19.4s
	cmlt	v4.4s, v20.4s, #0
	cmlt	v1.4s, v18.4s, #0
	cmlt	v17.4s, v21.4s, #0
	sshr	v16.4s, v16.4s, 3
	sshr	v5.4s, v5.4s, 3
	sshr	v2.4s, v2.4s, 3
	sshr	v19.4s, v19.4s, 3
	sub	v7.4s, v16.4s, v7.4s
	sub	v4.4s, v5.4s, v4.4s
	sub	v1.4s, v2.4s, v1.4s
	sub	v17.4s, v19.4s, v17.4s
	mls	v22.4s, v7.4s, v25.4s
	mls	v20.4s, v4.4s, v25.4s
	mls	v18.4s, v1.4s, v25.4s
	mls	v21.4s, v17.4s, v25.4s
	add	v30.4s, v30.4s, v23.4s
	uzp1	v20.8h, v22.8h, v20.8h
	uzp1	v21.8h, v18.8h, v21.8h
	uzp1	v21.16b, v20.16b, v21.16b
	add	v21.16b, v21.16b, v24.16b
	str	q21, [x1], 16
	cmp	x3, x1
	bne	.L7
	add	w1, w0, 672
	add	w4, w0, 700
	mov	w3, 26
	.align 5
.L8:
	sdiv	w0, w1, w3
	add	x2, x2, 1
	msub	w0, w0, w3, w1
	add	w1, w1, 7
	add	w0, w0, 97
	strb	w0, [x2, 95]
	cmp	w1, w4
	bne	.L8
	ldp	q27, q26, [sp]
	ldp	q29, q28, [sp, 32]
	ldp	q31, q30, [sp, 64]
	ldr	w0, [sp, 96]
	str	w0, [x8, 96]
	stp	q27, q26, [x8]
	stp	q29, q28, [x8, 32]
	stp	q31, q30, [x8, 64]
	add	sp, sp, 112
	ret
	.align	2
	.align 5
	.global	sum100
sum100:
	mov	x3, 16963
	mov	x2, x0
	add	x4, x0, 100
	movk	x3, 0xf, lsl 16
	mov	x0, 0
	.align 5
.L13:
	sbfiz	x1, x0, 1, 32
	add	x0, x1, w0, sxtw
	udiv	x1, x0, x3
	msub	x1, x1, x3, x0
	ldrb	w0, [x2], 1
	add	x0, x0, x1
	cmp	x4, x2
	bne	.L13
	ret
	.align	2
	.align 5
	.global	manhattan
manhattan:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x0
	sub	w0, w0, w1
	str	x1, [sp, 40]
	bl	abs
	ldr	x1, [sp, 40]
	mov	w20, w0
	asr	x0, x19, 32
	asr	x1, x1, 32
	sub	w0, w0, w1
	bl	abs
	add	w0, w20, w0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.align	2
	.align 5
	.global	mkfam
mkfam:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	sxtw	x19, w0
	add	x0, x19, 1
	lsl	x0, x0, 3
	bl	malloc
	cbz	x0, .L17
	str	w19, [x0]
	cmp	w19, 0
	ble	.L17
	add	x4, x0, 8
	mov	x1, 0
	mov	x3, -3
	.align 5
.L19:
	smaddl	x2, w1, w1, x3
	str	x2, [x4, x1, lsl 3]
	add	x1, x1, 1
	cmp	x19, x1
	bne	.L19
.L17:
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"%.*s\n%.*s\n%.*s\n"
	.align	3
.LC3:
	.string	"%.*s\n"
	.align	3
.LC4:
	.string	"counter %d\n"
	.align	3
.LC5:
	.string	"zeros %ld %ld %ld %.10s\n"
	.align	3
.LC6:
	.string	"outer %d: %d %d %d %d | %d %d %d %d\n"
	.align	3
.LC7:
	.string	"tails %ld %ld sizes %d %d\n"
	.align	3
.LC8:
	.string	"table %d: %d %d %d %d\n"
	.align	3
.LC9:
	.string	"%-5s %4d %7.3f\n"
	.align	3
.LC10:
	.string	"value %.3f first %s last %s\n"
	.align	3
.LC11:
	.string	"manhattan %d\n"
	.align	3
.LC12:
	.string	"literal %d %d\n"
	.align	3
.LC13:
	.string	"fam %d %ld %ld %ld size %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #480
	adrp	x2, .LC1
	movi	v19.4s, 0x4
	add	x0, sp, 128
	movi	v20.4s, 0x8
	add	x1, sp, 160
	movi	v21.4s, 0xc
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	movi	v24.4s, 0x1a
	movi	v22.16b, 0x41
	stp	x19, x20, [sp, 32]
	adrp	x20, .LANCHOR2
	adrp	x19, .LANCHOR1
	stp	x21, x22, [sp, 48]
	ldr	w22, [x20, :lo12:.LANCHOR2]
	ldr	q25, [x19, :lo12:.LANCHOR1]
	stp	x23, x24, [sp, 64]
	ldr	q27, [x2, :lo12:.LC1]
	stp	x25, x26, [sp, 80]
	movi	v23.4s, 0x10
	str	x27, [sp, 96]
	str	d15, [sp, 104]
.L26:
	add	v28.4s, v25.4s, v19.4s
	fmov	s30, w22
	fmov	s29, w22
	fmov	s31, w22
	fmov	s26, w22
	mul	v28.4s, v28.4s, v30.s[0]
	add	v30.4s, v25.4s, v20.4s
	mul	v31.4s, v25.4s, v31.s[0]
	mul	v30.4s, v30.4s, v29.s[0]
	add	v29.4s, v25.4s, v21.4s
	smull2	v18.2d, v31.4s, v27.4s
	add	v25.4s, v25.4s, v23.4s
	mul	v29.4s, v29.4s, v26.s[0]
	smull	v26.2d, v31.2s, v27.2s
	uzp2	v26.4s, v26.4s, v18.4s
	cmlt	v18.4s, v31.4s, #0
	sshr	v26.4s, v26.4s, 3
	sub	v26.4s, v26.4s, v18.4s
	smull2	v18.2d, v28.4s, v27.4s
	mls	v31.4s, v26.4s, v24.4s
	smull	v26.2d, v28.2s, v27.2s
	uzp2	v26.4s, v26.4s, v18.4s
	cmlt	v18.4s, v28.4s, #0
	sshr	v26.4s, v26.4s, 3
	sub	v26.4s, v26.4s, v18.4s
	mls	v28.4s, v26.4s, v24.4s
	smull2	v26.2d, v30.4s, v27.4s
	uzp1	v31.8h, v31.8h, v28.8h
	smull	v28.2d, v30.2s, v27.2s
	uzp2	v28.4s, v28.4s, v26.4s
	cmlt	v26.4s, v30.4s, #0
	sshr	v28.4s, v28.4s, 3
	sub	v28.4s, v28.4s, v26.4s
	smull2	v26.2d, v29.4s, v27.4s
	mls	v30.4s, v28.4s, v24.4s
	smull	v28.2d, v29.2s, v27.2s
	uzp2	v28.4s, v28.4s, v26.4s
	cmlt	v26.4s, v29.4s, #0
	sshr	v28.4s, v28.4s, 3
	sub	v28.4s, v28.4s, v26.4s
	mls	v29.4s, v28.4s, v24.4s
	uzp1	v30.8h, v30.8h, v29.8h
	uzp1	v31.16b, v31.16b, v30.16b
	add	v31.16b, v31.16b, v22.16b
	str	q31, [x0], 16
	cmp	x0, x1
	bne	.L26
	fmov	w0, s24
	lsl	w1, w22, 5
	fmov	w2, s24
	adrp	x21, .LANCHOR0
	ldp	q30, q31, [sp, 128]
	add	x21, x21, :lo12:.LANCHOR0
	sdiv	w0, w1, w0
	add	x6, x21, 16
	mov	w5, 33
	add	x4, sp, 168
	mov	w3, w5
	add	x23, sp, 288
	msub	w0, w0, w2, w1
	mov	w1, w5
	add	x2, sp, 128
	add	w0, w0, 65
	strb	w0, [sp, 160]
	add	x0, sp, 168
	stp	q30, q31, [x0]
	mov	w0, 42
	strb	w0, [sp, 168]
	mov	w0, 33
	strb	w0, [sp, 200]
	ldr	q30, [sp, 168]
	stp	q30, q31, [x21, 16]
	strb	w0, [x6, 32]
	mov	w0, 45
	strb	w0, [sp, 184]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w4, 52429
	mov	x3, x23
	mov	w1, 0
	movk	w4, 0xcccc, lsl 16
	.align 5
.L27:
	umull	x0, w1, w4
	lsr	x0, x0, 35
	add	w0, w0, w0, lsl 2
	sub	w0, w1, w0, lsl 1
	add	w1, w1, 1
	add	w0, w0, 48
	strb	w0, [x3], 1
	cmp	w1, 47
	bne	.L27
	mov	x3, x23
	mov	x4, x23
	mov	x2, x23
	mov	w0, 98
	mov	w5, 35
.L28:
	mov	x1, x2
	add	x3, x3, 46
	ldr	q30, [x2, 16]
	ldr	q29, [x1], 47
	ldr	q31, [x2, 31]
	str	q29, [x2, 47]
	mov	x2, x1
	str	q30, [x1, 16]
	str	q31, [x1, 31]
	strb	w0, [x4, 58]!
	add	w0, w0, 1
	and	w0, w0, 255
	strb	w5, [x3, 46]
	cmp	w0, 101
	bne	.L28
	adrp	x24, .LC3
	add	x25, x23, 188
	add	x24, x24, :lo12:.LC3
.L29:
	mov	x2, x23
	mov	x0, x24
	mov	w1, 47
	add	x23, x23, 47
	bl	printf
	cmp	x23, x25
	bne	.L29
	add	x1, sp, 112
	add	x2, sp, 125
	mov	w0, 1
	.align 5
.L30:
	strb	w0, [x1], 1
	add	w0, w22, w0
	cmp	x1, x2
	bne	.L30
	adrp	x24, .LC4
	add	x24, x24, :lo12:.LC4
	mov	w23, 3
.L31:
	ldp	x0, x1, [sp, 112]
	and	x1, x1, 1099511627775
	bl	counter
	mov	w1, w0
	mov	x0, x24
	bl	printf
	subs	w23, w23, #1
	bne	.L31
	add	x8, x21, 156
	mov	w0, w22
	bl	make100
	sxtw	x23, w22
	add	x0, x21, 56
	bl	sum100
	mov	x5, x0
	mov	x0, x8
	bl	sum100
	mov	x6, x0
	add	x0, x21, 256
	bl	sum100
	mov	x4, x8
	mov	x3, x0
	mov	x2, x6
	mov	x1, x5
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	add	x21, sp, 248
	mov	x0, 5
	stp	x0, xzr, [sp, 208]
	mov	x0, 30064771072
	movk	x0, 0x8, lsl 48
	str	x0, [sp, 224]
	mov	x0, 9
	adrp	x27, .LC6
	movk	x0, 0x71, lsl 16
	str	x0, [sp, 232]
	mov	x0, -1
	str	x0, [sp, 240]
	ldp	q31, q30, [sp, 208]
	neg	x26, x23
	add	x24, sp, 208
	add	x27, x27, :lo12:.LC6
	str	x0, [x21, 32]
	mov	w0, 80
	stp	q31, q30, [x21]
	mov	w25, 0
	strh	w0, [sp, 270]
	mov	w0, 122
	strb	w0, [sp, 258]
.L32:
	ldrb	w0, [x21, 10]
	mov	w1, w25
	ldrsh	w7, [x21, 6]
	add	w25, w25, 1
	ldrsh	w6, [x21, 4]
	add	x24, x24, 8
	str	w0, [sp, 8]
	ldrsh	w0, [x21, 8]!
	str	w0, [sp]
	mov	x0, x27
	ldrb	w5, [x24, 2]
	ldrsh	w4, [x24]
	ldrsh	w3, [x24, -2]
	ldrsh	w2, [x24, -4]
	bl	printf
	cmp	w25, 3
	bne	.L32
	add	x19, x19, :lo12:.LANCHOR1
	adrp	x24, .LC8
	add	x19, x19, 16
	add	x24, x24, :lo12:.LC8
	mov	w21, 0
	mov	x2, x26
	mov	w4, 40
	mov	w3, 8
	mov	x1, -1
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	.align 5
.L33:
	ldrb	w5, [x19, 6]
	mov	w1, w21
	ldrsh	w4, [x19, 4]
	mov	x0, x24
	ldrsh	w3, [x19, 2]
	ldrh	w2, [x19], 8
	add	w2, w21, w2
	add	w21, w21, 1
	sxth	w2, w2
	bl	printf
	cmp	w21, 6
	bne	.L33
	add	x20, x20, :lo12:.LANCHOR2
	movi	d15, #0
	adrp	x21, .LC9
	add	x19, x20, 8
	add	x24, x20, 104
	add	x21, x21, :lo12:.LC9
.L34:
	ldr	x1, [x19]
	mov	x0, x21
	ldr	w2, [x19, 8]
	add	x19, x19, 24
	ldr	d0, [x19, -8]
	bl	printf
	ldr	w0, [x19, -16]
	ldr	d31, [x19, -8]
	scvtf	d30, w0
	fmadd	d15, d30, d31, d15
	cmp	x24, x19
	bne	.L34
	ldp	x1, x5, [x20, 80]
	fmov	d0, d15
	ldr	x2, [x20, 8]
	adrp	x0, .LC10
	ldr	x4, [x20, 96]
	add	x0, x0, :lo12:.LC10
	ldr	w3, [x20, 16]
	ldr	d31, [x20, 24]
	stp	x1, x5, [x20, 8]
	str	x4, [x20, 24]
	str	x2, [x20, 80]
	str	w3, [x20, 88]
	str	d31, [x20, 96]
	bl	printf
	mov	x0, -3
	mov	x1, 0
	bfi	x1, x0, 0, 32
	mov	x0, 21474836480
	bfi	x1, x22, 32, 32
	bl	manhattan
	mov	w1, w0
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	mov	w2, 2
	mov	w1, 11
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	mov	w0, 5
	bl	mkfam
	mov	x20, x0
	cbz	x0, .L35
	mov	x1, 104
	bl	realloc
	mov	x19, x0
	cbz	x0, .L58
	ldr	w1, [x0]
	add	x0, x0, 8
	cmp	w1, 11
	bgt	.L38
	sxtw	x1, w1
	add	x0, x19, 8
	mneg	x2, x1, x23
	.align 5
.L39:
	str	x2, [x0, x1, lsl 3]
	add	x1, x1, 1
	sub	x2, x2, x23
	cmp	w1, 11
	ble	.L39
.L38:
	mov	x2, x19
	mov	w1, 12
	mov	x4, 0
	str	w1, [x2], 104
	.align 5
.L40:
	lsl	x1, x4, 3
	sub	x4, x1, x4
	ldr	x1, [x0], 8
	add	x4, x4, x1
	cmp	x2, x0
	bne	.L40
	ldr	x2, [x19, 40]
	mov	w5, 8
	ldr	x3, [x19, 96]
	mov	w1, 12
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	mov	x0, x19
	bl	free
	mov	w0, 0
.L25:
	ldr	x27, [sp, 96]
	ldr	d15, [sp, 104]
	ldp	x29, x30, [sp, 16]
	ldp	x19, x20, [sp, 32]
	ldp	x21, x22, [sp, 48]
	ldp	x23, x24, [sp, 64]
	ldp	x25, x26, [sp, 80]
	add	sp, sp, 480
	ret
.L58:
	mov	x0, x20
	bl	free
.L35:
	mov	w0, 1
	b	.L25
	.global	knob
	.global	g33
	.global	zeros
	.global	table
	.global	stock
	.section .rodata
	.align	3
.LC14:
	.string	"bolt"
	.align	3
.LC15:
	.string	"nut"
	.align	3
.LC16:
	.string	"gear"
	.align	3
.LC17:
	.string	"cam"
	.section .rodata
	.align	4
	.LANCHOR1:
.LC0:
	.word	0
	.word	1
	.word	2
	.word	3
table:
	.zero	8
	.hword	1
	.hword	2
	.hword	3
	.byte	120
	.zero	1
	.zero	16
	.zero	4
	.hword	-9
	.byte	121
	.zero	1
	.zero	8
.LC1:
	.word	1321528399
	.word	1321528399
	.word	1321528399
	.word	1321528399
	.data
	.align	3
	.LANCHOR2:
knob:
	.word	4
	.zero	4
stock:
	.quad	.LC14
	.word	120
	.zero	4
	.word	0
	.word	1070596096
	.quad	.LC15
	.word	300
	.zero	4
	.word	0
	.word	1069547520
	.quad	.LC16
	.word	7
	.zero	4
	.word	0
	.word	1076428800
	.quad	.LC17
	.word	2
	.zero	4
	.word	0
	.word	1078198272
	.bss
	.align	4
	.LANCHOR0:
st__0:
	.zero	16
g33:
	.zero	33
	.zero	7
zeros:
	.zero	300

