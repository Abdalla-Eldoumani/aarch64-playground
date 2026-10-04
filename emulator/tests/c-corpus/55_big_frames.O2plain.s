	.text
	.align	2
	.p2align 5,,15
twist:
	sxtw	x4, w1
	mov	x2, 4800
	mov	x1, x0
	add	x7, x0, x2
	lsl	x6, x0, 1
	stp	x29, x30, [sp, -16]!
	mov	x5, 4792
	mov	x29, sp
	.p2align 5,,15
.L2:
	sub	x3, x5, x1
	ldr	x2, [x1]
	ldr	x3, [x3, x6]
	madd	x2, x4, x2, x3
	str	x2, [x1], 8
	cmp	x1, x7
	bne	.L2
	ldr	x1, [x0, 4792]
	mov	x2, 4800
	eor	x1, x1, x4
	str	x1, [x0, 4792]
	mov	x1, x0
	mov	x0, x8
	bl	memcpy
	ldp	x29, x30, [sp], 16
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%s: sum=%lld first=%lld last=%lld\n"
	.text
	.align	2
	.p2align 5,,15
show:
	mov	x2, 4800
	mov	x3, x1
	add	x5, x1, x2
	mov	x2, 0
	.p2align 5,,15
.L7:
	ldr	x4, [x3], 8
	add	x2, x2, x4
	cmp	x3, x5
	bne	.L7
	ldr	x3, [x1]
	ldr	x4, [x1, 4792]
	mov	x1, x0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	b	printf
	.align	2
	.p2align 5,,15
frame_600k:
	sub	sp, sp, #2000
	mov	x2, 10176
	sub	sp, sp, #598016
	mov	w1, w0
	movk	x2, 0x9, lsl 16
	add	x0, sp, 16
	stp	x29, x30, [sp]
	mov	x29, sp
	bl	memset
	add	x1, sp, 16
	mov	w0, 0
	mov	x2, x1
	.p2align 5,,15
.L10:
	asr	w3, w0, 12
	add	w0, w0, 4096
	strb	w3, [x2]
	add	x2, x2, 4096
	cmp	w0, 602112
	bne	.L10
	add	x2, sp, 598016
	add	x3, sp, 598016
	add	x2, x2, 1999
	mov	w0, 119
	add	x3, x3, 2626
	strb	w0, [x2]
	mov	x0, 0
	.p2align 5,,15
.L11:
	lsl	x2, x0, 3
	sub	x0, x2, x0
	ldrb	w2, [x1]
	add	x1, x1, 1777
	add	x0, x2, x0
	cmp	x3, x1
	bne	.L11
	add	x1, sp, 299008
	add	x1, x1, 1008
	ldp	x29, x30, [sp]
	ldrb	w1, [x1]
	add	sp, sp, 2000
	add	sp, sp, 598016
	add	x1, x1, 119
	add	x0, x1, x0
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"frame_4k=%llu\n"
	.align	3
.LC3:
	.string	"frame_40k=%llu\n"
	.align	3
.LC4:
	.string	"frame_72k=%llu\n"
	.align	3
.LC5:
	.string	"frame_600k=%llu\n"
	.align	3
.LC6:
	.string	"deep8k=%llu\n"
	.align	3
.LC7:
	.string	"far_args=%lld\n"
	.align	3
.LC8:
	.string	"b1"
	.align	3
.LC9:
	.string	"b2"
	.align	3
.LC10:
	.string	"b3"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #1136
	mov	x15, 19248
	sub	sp, sp, #90112
	mov	x2, 4100
	add	x0, sp, x15
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LANCHOR1
	ldr	w19, [x20, :lo12:.LANCHOR1]
	str	x21, [sp, 32]
	mov	w1, w19
	bl	memset
	mov	x16, 19248
	add	x2, sp, x16
	mov	x17, 4109
	add	w0, w19, 7
	add	x1, x2, 1
	add	x3, x2, x17
	.p2align 5,,15
.L16:
	strb	w0, [x1], 13
	add	w0, w0, 91
	cmp	x3, x1
	bne	.L16
	mov	x11, 23347
	add	x0, sp, x11
	mov	x12, 21298
	mov	x13, 21298
	add	x1, sp, x13
	mov	x14, 23348
	ldrb	w4, [x0]
	add	x3, sp, x14
	eor	w4, w4, 60
	strb	w4, [x0]
	add	x0, sp, x12
	ldrb	w0, [x0]
	add	w0, w0, 9
	strb	w0, [x1]
	mov	x1, 0
	.p2align 5,,15
.L17:
	lsl	x0, x1, 5
	sub	x1, x0, x1
	ldrb	w0, [x2], 5
	add	x1, x0, x1
	cmp	x2, x3
	bne	.L17
	add	x1, x1, w4, uxtw
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	x8, 19248
	ldr	w19, [x20, :lo12:.LANCHOR1]
	mov	x2, 40000
	mov	w1, 0
	add	x0, sp, x8
	bl	memset
	mov	w0, 97
	mov	x9, 19248
	add	x2, sp, x9
	mov	x10, 40352
	smull	x3, w19, w0
	mov	x1, -12241
	sxtw	x5, w19
	mov	x0, x2
	add	x4, x2, x10
	movk	x1, 0xfffe, lsl 16
	.p2align 5,,15
.L18:
	str	x1, [x0]
	add	x0, x0, 776
	add	x1, x1, x3
	cmp	x4, x0
	bne	.L18
	mov	x4, -1227
	mov	x3, 59240
	movk	x4, 0x8e04, lsl 16
	add	x0, sp, x3
	movk	x4, 0xfee0, lsl 32
	mov	x7, 39248
	mov	x6, 59288
	add	x3, sp, x6
	str	x4, [x0]
	add	x0, sp, x7
	sdiv	x4, x4, x5
	mov	x1, 0
	str	x4, [x0]
	.p2align 5,,15
.L19:
	ldr	x0, [x2], 56
	eor	x0, x0, x1, lsr 3
	add	x1, x1, x0
	cmp	x2, x3
	bne	.L19
	mov	x0, -1227
	movk	x0, 0x8e04, lsl 16
	movk	x0, 0xfee0, lsl 32
	add	x4, x4, x0
	add	x1, x4, x1
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w19, [x20, :lo12:.LANCHOR1]
	mov	x2, 6464
	mov	w1, 255
	movk	x2, 0x1, lsl 16
	mov	x0, 19248
	add	x0, sp, x0
	bl	memset
	mov	x1, 19248
	add	x0, sp, x1
	mov	x2, x0
	mov	w1, 0
	mov	w4, 18000
	.p2align 5,,15
.L20:
	eor	w3, w19, w1
	add	w1, w1, 1000
	str	w3, [x2]
	add	x2, x2, 4000
	cmp	w1, w4
	bne	.L20
	add	x3, sp, 90112
	mov	x1, 0
	add	x3, x3, 1136
	.p2align 5,,15
.L21:
	ldr	w2, [x0]
	add	x1, x1, x1, lsl 1
	add	x0, x0, 1000
	add	x1, x2, x1
	cmp	x0, x3
	bne	.L21
	lsl	w19, w19, 20
	adrp	x0, .LC4
	add	x1, x19, x1
	add	x0, x0, :lo12:.LC4
	bl	printf
	add	x19, x20, :lo12:.LANCHOR1
	ldr	w0, [x20, :lo12:.LANCHOR1]
	bl	frame_600k
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [x19, 4]
	cbz	w0, .L39
	add	w2, w0, w0, lsl 1
	mov	x4, 1
	and	x2, x2, 255
	mov	x1, 0
	.p2align 5,,15
.L25:
	mov	w3, w0
	sub	w0, w0, #1
	add	x2, x2, w3, uxtb 1
	madd	x1, x2, x4, x1
	add	w2, w0, w0, lsl 1
	add	x4, x4, x4, lsl 1
	and	x2, x2, 255
	cbnz	w0, .L25
.L24:
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	w19, [x20, :lo12:.LANCHOR1]
	mov	w0, 1000
	mov	x9, 19248
	mov	w1, 0
	mov	x2, 40000
	mul	w19, w19, w0
	add	x0, sp, x9
	bl	memset
	mov	x0, 5
	mov	x10, 35216
	add	x1, sp, x10
	str	x0, [sp, 19248]
	mov	x0, 504
	str	x0, [sp, 23240]
	mov	x0, 1003
	str	x0, [sp, 27232]
	mov	x0, 1502
	str	x0, [sp, 31224]
	mov	x11, 39208
	mov	x0, 2001
	str	x0, [x1]
	add	x1, sp, x11
	mov	x0, 2500
	mov	x12, 43200
	mov	x13, 47192
	mov	x14, 51184
	str	x0, [x1]
	add	x1, sp, x12
	mov	x0, 2999
	mov	x15, 55176
	mov	x16, 59168
	sxtw	x21, w19
	str	x0, [x1]
	add	x1, sp, x13
	mov	x0, 3498
	mov	x17, 59240
	mov	x18, 19248
	mov	x30, 43912
	str	x0, [x1]
	add	x1, sp, x14
	mov	x0, 3997
	str	x0, [x1]
	add	x1, sp, x15
	mov	x0, 4496
	str	x0, [x1]
	add	x1, sp, x16
	mov	x0, 4995
	str	x0, [x1]
	mov	w0, -9
	mov	x1, 0
	smull	x19, w19, w0
	add	x0, sp, x17
	str	x19, [x0]
	add	x0, sp, x18
	add	x3, x0, x30
	.p2align 5,,15
.L23:
	ldr	x2, [x0]
	add	x0, x0, 3992
	add	x1, x1, x2
	cmp	x0, x3
	bne	.L23
	add	x19, x19, x1
	adrp	x0, .LC7
	add	x1, x19, 9
	add	x0, x0, :lo12:.LC7
	add	x1, x1, x21
	bl	printf
	adrp	x1, .LANCHOR0
	mov	x7, 4848
	movi	v29.4s, 0x4
	add	x19, sp, x7
	ldr	q31, [x1, :lo12:.LANCHOR0]
	adrp	x1, .LC11
	mov	x8, 4800
	add	x0, x19, x8
	ldr	q30, [x1, :lo12:.LC11]
	.p2align 5,,15
.L26:
	add	v0.4s, v31.4s, v30.4s
	add	v31.4s, v31.4s, v29.4s
	add	v27.4s, v0.4s, v0.4s
	add	v27.4s, v27.4s, v0.4s
	sxtl	v28.2d, v27.2s
	sxtl2	v27.2d, v27.4s
	stp	q28, q27, [x19], 32
	cmp	x19, x0
	bne	.L26
	mov	x0, 4848
	ldr	w20, [x20, :lo12:.LANCHOR1]
	add	x1, sp, x0
	mov	x2, 4800
	add	x0, sp, 48
	bl	memcpy
	mov	x8, x19
	mov	w1, w20
	add	x0, sp, 48
	bl	twist
	mov	x1, x19
	mov	x2, 4800
	add	x0, sp, 48
	bl	memcpy
	mov	x1, 19248
	add	x0, sp, 48
	add	x8, sp, x1
	mov	w1, 5
	bl	twist
	mov	x3, 19248
	mov	x2, 4800
	add	x1, sp, x3
	add	x0, sp, 48
	bl	memcpy
	mov	x4, 14448
	add	x0, sp, 48
	add	x8, sp, x4
	mov	w1, 7
	bl	twist
	mov	x5, 4848
	adrp	x0, .LC8
	add	x1, sp, x5
	add	x0, x0, :lo12:.LC8
	bl	show
	mov	x1, x19
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	show
	mov	x6, 14448
	adrp	x0, .LC10
	add	x1, sp, x6
	add	x0, x0, :lo12:.LC10
	bl	show
	ldr	x21, [sp, 32]
	mov	w0, 0
	ldp	x29, x30, [sp]
	ldp	x19, x20, [sp, 16]
	add	sp, sp, 1136
	add	sp, sp, 90112
	ret
.L39:
	mov	x1, 0
	b	.L24
	.section .rodata
	.align	4
	.LANCHOR0:
.LC1:
	.word	0
	.word	1
	.word	2
	.word	3
.LC11:
	.word	-300
	.word	-300
	.word	-300
	.word	-300
	.data
	.align	2
	.LANCHOR1:
knob:
	.word	3
deep_levels:
	.word	100

