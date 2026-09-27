	.text
	.align	2
	.align 5
twist:
	sxtw	x4, w1
	mov	x2, 4800
	mov	x1, x0
	add	x7, x0, x2
	lsl	x6, x0, 1
	stp	x29, x30, [sp, -16]!
	mov	x5, 4792
	mov	x29, sp
	.align 5
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
	.align 5
show:
	mov	x2, 4800
	mov	x3, x1
	add	x5, x1, x2
	mov	x2, 0
	.align 5
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
	.align 5
frame_4k:
	mov	x12, 4144
	sub	sp, sp, x12
	mov	w1, w0
	mov	x2, 4100
	add	x0, sp, 40
	stp	x29, x30, [sp]
	mov	x29, sp
	str	w1, [sp, 28]
	bl	memset
	ldr	w1, [sp, 28]
	mov	x3, 4149
	add	x3, sp, x3
	add	w0, w1, 7
	add	x1, sp, 40
	add	x2, x1, 1
	.align 5
.L10:
	strb	w0, [x2], 13
	add	w0, w0, 91
	cmp	x2, x3
	bne	.L10
	mov	x0, 4139
	add	x0, sp, x0
	mov	x2, 4140
	add	x3, sp, x2
	ldrb	w4, [x0]
	eor	w4, w4, 60
	strb	w4, [x0]
	ldrb	w0, [sp, 2090]
	add	w0, w0, 9
	strb	w0, [sp, 2090]
	mov	x0, 0
	.align 5
.L11:
	lsl	x2, x0, 5
	sub	x0, x2, x0
	ldrb	w2, [x1], 5
	add	x0, x2, x0
	cmp	x1, x3
	bne	.L11
	ldp	x29, x30, [sp]
	add	x0, x0, w4, uxtw
	mov	x12, 4144
	add	sp, sp, x12
	ret
	.align	2
	.align 5
frame_40k:
	mov	x12, 40032
	sub	sp, sp, x12
	mov	x2, 40000
	mov	w1, 0
	stp	x29, x30, [sp]
	mov	x29, sp
	str	x19, [sp, 16]
	mov	w19, w0
	add	x0, sp, 32
	bl	memset
	mov	w0, 97
	add	x2, sp, 32
	mov	x4, 40384
	mov	x1, -12241
	smull	x3, w19, w0
	sxtw	x5, w19
	add	x4, sp, x4
	mov	x0, x2
	movk	x1, 0xfffe, lsl 16
	.align 5
.L16:
	str	x1, [x0]
	add	x0, x0, 776
	add	x1, x1, x3
	cmp	x0, x4
	bne	.L16
	mov	x4, -1227
	mov	x0, 40024
	movk	x4, 0x8e04, lsl 16
	add	x0, sp, x0
	movk	x4, 0xfee0, lsl 32
	mov	x1, 40072
	add	x3, sp, x1
	str	x4, [x0]
	mov	x0, 0
	sdiv	x4, x4, x5
	str	x4, [sp, 20032]
	.align 5
.L17:
	ldr	x1, [x2], 56
	eor	x1, x1, x0, lsr 3
	add	x0, x0, x1
	cmp	x2, x3
	bne	.L17
	mov	x1, -1227
	mov	x12, 40032
	movk	x1, 0x8e04, lsl 16
	movk	x1, 0xfee0, lsl 32
	add	x4, x4, x1
	ldr	x19, [sp, 16]
	add	x0, x4, x0
	ldp	x29, x30, [sp]
	add	sp, sp, x12
	ret
	.align	2
	.align 5
frame_72k:
	sub	sp, sp, #2400
	mov	x2, 6464
	sub	sp, sp, #69632
	movk	x2, 0x1, lsl 16
	mov	w1, 255
	stp	x29, x30, [sp]
	mov	x29, sp
	str	x19, [sp, 16]
	mov	w19, w0
	add	x0, sp, 32
	bl	memset
	add	x1, sp, 32
	mov	w0, 0
	mov	x2, x1
	mov	w4, 18000
	.align 5
.L22:
	eor	w3, w19, w0
	add	w0, w0, 1000
	str	w3, [x2]
	add	x2, x2, 4000
	cmp	w0, w4
	bne	.L22
	add	x3, sp, 69632
	mov	x0, 0
	add	x3, x3, 2400
	.align 5
.L23:
	ldr	w2, [x1]
	add	x0, x0, x0, lsl 1
	add	x1, x1, 1000
	add	x0, x2, x0
	cmp	x3, x1
	bne	.L23
	lsl	w19, w19, 20
	ldp	x29, x30, [sp]
	add	x0, x19, x0
	ldr	x19, [sp, 16]
	add	sp, sp, 2400
	add	sp, sp, 69632
	ret
	.align	2
	.align 5
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
	.align 5
.L28:
	asr	w3, w0, 12
	add	w0, w0, 4096
	strb	w3, [x2]
	add	x2, x2, 4096
	cmp	w0, 602112
	bne	.L28
	add	x2, sp, 598016
	add	x3, sp, 598016
	add	x2, x2, 1999
	mov	w0, 119
	add	x3, x3, 2626
	strb	w0, [x2]
	mov	x0, 0
	.align 5
.L29:
	lsl	x2, x0, 3
	sub	x0, x2, x0
	ldrb	w2, [x1]
	add	x1, x1, 1777
	add	x0, x2, x0
	cmp	x3, x1
	bne	.L29
	add	x1, sp, 299008
	add	x1, x1, 1008
	ldp	x29, x30, [sp]
	ldrb	w1, [x1]
	add	sp, sp, 2000
	add	sp, sp, 598016
	add	x1, x1, 119
	add	x0, x1, x0
	ret
	.align	2
	.align 5
deep8k:
	mov	x12, 8224
	sub	sp, sp, x12
	mov	w1, w0
	mov	x2, 8192
	stp	x29, x30, [sp]
	mov	x29, sp
	str	w0, [sp, 28]
	add	x0, sp, 32
	bl	memset
	ldr	w1, [sp, 28]
	mov	x3, 4128
	add	x2, sp, x3
	add	w0, w1, w1, lsl 1
	strb	w0, [x2]
	mov	x0, 0
	cbz	w1, .L33
	sub	w0, w1, #1
	bl	deep8k
	mov	x1, 8223
	add	x1, sp, x1
	mov	x2, 4128
	add	x2, sp, x2
	add	x0, x0, x0, lsl 1
	ldrb	w1, [x1]
	ldrb	w2, [x2]
	add	x0, x0, x1
	ldrb	w1, [sp, 32]
	add	x1, x1, x2
	add	x0, x0, x1
.L33:
	ldp	x29, x30, [sp]
	mov	x12, 8224
	add	sp, sp, x12
	ret
	.align	2
	.align 5
far_args__constprop__0:
	mov	x12, 40032
	sub	sp, sp, x12
	mov	x2, 40000
	mov	w1, 0
	stp	x29, x30, [sp]
	mov	x29, sp
	str	x19, [sp, 16]
	mov	x19, x0
	add	x0, sp, 32
	bl	memset
	mov	x0, 5
	str	x0, [sp, 32]
	mov	x0, 504
	str	x0, [sp, 4024]
	mov	x0, 1003
	str	x0, [sp, 8016]
	mov	x0, 1502
	str	x0, [sp, 12008]
	mov	x0, 2001
	str	x0, [sp, 16000]
	mov	x0, 2500
	mov	x1, 35960
	add	x1, sp, x1
	str	x0, [sp, 19992]
	mov	x0, 2999
	str	x0, [sp, 23984]
	mov	x0, 3498
	str	x0, [sp, 27976]
	mov	x0, 3997
	mov	x5, 39952
	str	x0, [sp, 31968]
	mov	x0, 4496
	str	x0, [x1]
	add	x1, sp, x5
	mov	x0, 4995
	mov	x6, 40024
	neg	x4, x19, lsl 3
	mov	x2, 43944
	str	x0, [x1]
	add	x0, sp, x6
	sub	x4, x4, x19
	add	x3, sp, x2
	mov	x1, 0
	str	x4, [x0]
	add	x0, sp, 32
	.align 5
.L38:
	ldr	x2, [x0]
	add	x0, x0, 3992
	add	x1, x1, x2
	cmp	x3, x0
	bne	.L38
	add	x0, x4, x1
	mov	x12, 40032
	add	x0, x0, 9
	ldp	x29, x30, [sp]
	add	x0, x0, x19
	ldr	x19, [sp, 16]
	add	sp, sp, x12
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
	.align 5
	.global	main
main:
	mov	x12, 24032
	sub	sp, sp, x12
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LANCHOR1
	add	x19, x20, :lo12:.LANCHOR1
	ldr	w0, [x20, :lo12:.LANCHOR1]
	bl	frame_4k
	mov	x1, x0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	w0, [x20, :lo12:.LANCHOR1]
	bl	frame_40k
	mov	x1, x0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w0, [x20, :lo12:.LANCHOR1]
	bl	frame_72k
	mov	x1, x0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w0, [x20, :lo12:.LANCHOR1]
	bl	frame_600k
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [x19, 4]
	bl	deep8k
	mov	x1, x0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	w0, [x20, :lo12:.LANCHOR1]
	mov	w1, 1000
	mul	w0, w0, w1
	sxtw	x0, w0
	bl	far_args__constprop__0
	mov	x1, x0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	adrp	x1, .LANCHOR0
	mov	x7, 4832
	movi	v29.4s, 0x4
	add	x0, sp, x7
	ldr	q31, [x1, :lo12:.LANCHOR0]
	adrp	x1, .LC11
	mov	x8, 4800
	add	x19, x0, x8
	ldr	q30, [x1, :lo12:.LC11]
	.align 5
.L42:
	add	v0.4s, v31.4s, v30.4s
	add	v31.4s, v31.4s, v29.4s
	add	v27.4s, v0.4s, v0.4s
	add	v27.4s, v27.4s, v0.4s
	sxtl	v28.2d, v27.2s
	sxtl2	v27.2d, v27.4s
	stp	q28, q27, [x0], 32
	cmp	x19, x0
	bne	.L42
	mov	x0, 4832
	ldr	w20, [x20, :lo12:.LANCHOR1]
	add	x1, sp, x0
	mov	x2, 4800
	add	x0, sp, 32
	bl	memcpy
	mov	x8, x19
	mov	w1, w20
	add	x0, sp, 32
	bl	twist
	mov	x1, x19
	mov	x2, 4800
	add	x0, sp, 32
	bl	memcpy
	mov	x1, 19232
	add	x0, sp, 32
	add	x8, sp, x1
	mov	w1, 5
	bl	twist
	mov	x3, 19232
	mov	x2, 4800
	add	x1, sp, x3
	add	x0, sp, 32
	bl	memcpy
	mov	x4, 14432
	add	x0, sp, 32
	add	x8, sp, x4
	mov	w1, 7
	bl	twist
	mov	x5, 4832
	adrp	x0, .LC8
	add	x1, sp, x5
	add	x0, x0, :lo12:.LC8
	bl	show
	mov	x1, x19
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	show
	mov	x6, 14432
	adrp	x0, .LC10
	add	x1, sp, x6
	add	x0, x0, :lo12:.LC10
	bl	show
	ldp	x29, x30, [sp]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	mov	x12, 24032
	add	sp, sp, x12
	ret
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

