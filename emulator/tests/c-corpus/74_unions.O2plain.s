	.text
	.align	2
	.p2align 5,,15
	.global	flipsign
flipsign:
	mov	x1, -9223372036854775808
	add	x0, x0, x1
	ret
	.align	2
	.p2align 5,,15
	.global	fvswap
fvswap:
	fmov	w1, s1
	fmov	x0, d0
	bfi	x0, x1, 32, 32
	lsr	x1, x0, 32
	fmov	s30, w1
	sbfx	x0, x0, 0, 32
	fmov	d31, x0
	fadd	s29, s30, s30
	mov	x0, 0
	fsub	s31, s31, s30
	fmov	x1, d29
	bfi	x0, x1, 0, 32
	fmov	x1, d31
	bfi	x0, x1, 32, 32
	lsr	w1, w0, 0
	lsr	x0, x0, 32
	fmov	s0, w1
	fmov	s1, w0
	ret
	.align	2
	.p2align 5,,15
	.global	widemix
widemix:
	fmov	d30, x0
	fmov	d31, -2.0e+0
	eor	x0, x0, x1
	fmul	d31, d31, d30
	fmov	x1, d31
	ret
	.align	2
	.p2align 5,,15
	.global	shout
shout:
	fmov	d31, x0
	sub	sp, sp, #16
	cmeq	v30.8b, v31.8b, #0
	str	x0, [sp, 8]
	fmov	x0, d30
	cbnz	x0, .L6
	movi	v30.8b, 0xffffffffffffffe0
	add	v31.8b, v31.8b, v30.8b
	str	d31, [sp, 8]
.L7:
	ldr	x0, [sp, 8]
	add	sp, sp, 16
	ret
.L6:
	add	x1, sp, 8
	.p2align 5,,15
.L8:
	ldrb	w0, [x1]
	cbz	w0, .L7
	sub	w0, w0, #32
	strb	w0, [x1], 1
	add	x0, sp, 16
	cmp	x0, x1
	bne	.L8
	ldr	x0, [sp, 8]
	add	sp, sp, 16
	ret
	.align	2
	.p2align 5,,15
	.global	next_up
next_up:
	fmov	w0, s0
	add	w0, w0, 1
	fmov	s0, w0
	ret
	.align	2
	.p2align 5,,15
	.global	num
num:
	mov	x1, x0
	mov	x0, 0
	ret
	.align	2
	.p2align 5,,15
	.global	op
op:
	mov	w3, w1
	mov	x1, 0
	uxtw	x0, w0
	bfi	x1, x3, 0, 32
	bfi	x1, x2, 32, 32
	ret
	.align	2
	.p2align 5,,15
	.global	eval
eval:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x20, x0
	mov	w19, w1
	stp	x21, x22, [sp, 32]
	mov	x21, 0
	mov	x22, 1
.L19:
	sbfiz	x1, x19, 4, 32
	add	x2, x20, x1
	ldr	w0, [x20, x1]
	cmp	w0, 2
	beq	.L20
.L30:
	bhi	.L21
	cbz	w0, .L29
	ldp	w1, w19, [x2, 8]
	mov	x0, x20
	bl	eval
	madd	x21, x0, x22, x21
	sbfiz	x1, x19, 4, 32
	add	x2, x20, x1
	ldr	w0, [x20, x1]
	cmp	w0, 2
	bne	.L30
.L20:
	ldp	w1, w19, [x2, 8]
	mov	x0, x20
	bl	eval
	mul	x22, x22, x0
	b	.L19
	.p2align 2,,3
.L21:
	cmp	w0, 3
	bne	.L18
	ldr	w19, [x2, 8]
	neg	x22, x22
	b	.L19
	.p2align 2,,3
.L29:
	ldr	x0, [x2, 8]
	madd	x21, x22, x0, x21
.L18:
	mov	x0, x21
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"f %-12g %08x exp %3u man %06x bytes %02x %02x %02x %02x\n"
	.align	3
.LC2:
	.string	"next %.9g %.9g\n"
	.align	3
.LC3:
	.string	"%g%c"
	.align	3
.LC4:
	.string	"tiny %g\n"
	.align	3
.LC6:
	.string	"d %016lx lo %08x hi %08x h %04x %04x %04x %04x flip %.2f\n"
	.align	3
.LC8:
	.string	"inf %f %f pi %.15f\n"
	.align	3
.LC9:
	.string	"fv %.4f %.4f g %.4f\n"
	.align	3
.LC10:
	.string	"wide %016lx %016lx %.3f\n"
	.align	3
.LC11:
	.string	"any %s %s %lx\n"
	.align	3
.LC16:
	.string	"eval %ld %ld %ld\n"
	.align	3
.LC17:
	.string	"sizes %d %d %d %d %d %d\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -288]!
	adrp	x0, .LANCHOR0
	fmov	s31, -1.5e+0
	mov	x29, sp
	stp	d13, d14, [sp, 64]
	ldr	s13, [x0, :lo12:.LANCHOR0]
	mov	x0, 1042284544
	str	x23, [sp, 48]
	movk	x0, 0xb1e6, lsl 32
	adrp	x23, .LANCHOR1
	movk	x0, 0x7f61, lsl 48
	stp	x19, x20, [sp, 16]
	add	x19, sp, 104
	add	x20, sp, 128
	stp	x21, x22, [sp, 32]
	stp	s13, s31, [sp, 104]
	ldr	d31, [x23, :lo12:.LANCHOR1]
	str	x0, [sp, 112]
	adrp	x0, .LC1
	add	x21, x0, :lo12:.LC1
	str	d15, [sp, 56]
	str	d31, [sp, 120]
	.p2align 5,,15
.L32:
	ldr	s0, [x19], 4
	mov	x0, x21
	fmov	w1, s0
	fcvt	d0, s0
	lsr	w7, w1, 24
	ubfx	x6, x1, 16, 8
	ubfx	x5, x1, 8, 8
	and	w4, w1, 255
	and	w3, w1, 8388607
	ubfx	x2, x1, 23, 8
	bl	printf
	cmp	x19, x20
	bne	.L32
	mov	w0, 1149239296
	fmov	s31, w0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	fmul	s1, s13, s31
	movi	v31.2s, 0x2
	mov	w19, 1048576000
	mov	w22, 1098907648
	add	v1.2s, v1.2s, v31.2s
	movi	v31.2s, 0x1
	add	v0.2s, v13.2s, v31.2s
	fcvt	d1, s1
	fcvt	d0, s0
	bl	printf
	adrp	x0, .LC3
	add	x21, x0, :lo12:.LC3
	fmov	d0, 1.25e-1
	.p2align 5,,15
.L33:
	mov	x0, x21
	mov	w1, 32
	bl	printf
	fmov	s31, w19
	add	w19, w19, 8388608
	fcvt	d0, s31
	cmp	w19, w22
	bne	.L33
	mov	w1, 10
	mov	x0, x21
	bl	printf
	add	x23, x23, :lo12:.LANCHOR1
	mov	x0, 3936146074321813504
	fmov	d0, x0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	x19, x20
	ldr	q31, [x23, 16]
	fmov	d30, 3.5e+0
	adrp	x22, .LC6
	add	x20, sp, 160
	add	x22, x22, :lo12:.LC6
	mov	x0, -9223372036854775808
	str	q31, [sp, 128]
	fcvt	d31, s13
	str	x0, [sp, 144]
	fmul	d31, d31, d30
	str	d31, [sp, 152]
.L34:
	ldr	d31, [x19], 8
	fmov	x1, d31
	eor	x0, x1, -9223372036854775808
	fmov	d0, x0
	lsr	x7, x1, 48
	ubfx	x6, x1, 32, 16
	lsr	w5, w1, 16
	and	w4, w1, 65535
	lsr	x3, x1, 32
	mov	w2, w1
	mov	x0, x22
	bl	printf
	cmp	x20, x19
	bne	.L34
	adrp	x2, .LC7
	mov	x1, -4503599627370496
	mov	x0, 9218868437227405312
	fmov	d1, x1
	ldr	d2, [x2, :lo12:.LC7]
	fmov	d0, x0
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	adrp	x22, .LC9
	add	x22, x22, :lo12:.LC9
	bl	printf
	mov	w19, 3
	fmov	s14, 3.0e+0
	fmov	s15, 2.5e-1
	fmul	s14, s13, s14
	fnmul	s15, s13, s15
.L36:
	fmov	s31, s14
	fadd	s14, s15, s15
	mov	x0, x22
	fsub	s15, s31, s15
	fcvt	d2, s14
	fcvt	d1, s15
	fmov	d0, d2
	bl	printf
	subs	w19, w19, #1
	bne	.L36
	fmov	d0, -4.0e+0
	mov	x2, -4607182418800017408
	mov	x1, -9007199254740992
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	mov	x0, 25960
	mov	x1, x20
	movk	x0, 0x6c6c, lsl 16
	add	x2, sp, 168
	movk	x0, 0x6f, lsl 32
	str	x0, [sp, 88]
	str	x0, [sp, 160]
	.p2align 5,,15
.L37:
	ldrb	w0, [x1]
	cbz	w0, .L38
	sub	w0, w0, #32
	strb	w0, [x1], 1
	cmp	x2, x1
	bne	.L37
.L38:
	ldr	x3, [sp, 160]
	add	x2, sp, 96
	add	x1, sp, 88
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	str	x3, [sp, 96]
	bl	printf
	mov	x19, 4
	mov	x1, 3
	str	x1, [sp, 200]
	str	w1, [sp, 224]
	fcvtzs	x1, s13
	ldp	d30, d31, [x23, 40]
	mov	w0, 2
	str	w0, [sp, 160]
	mov	w0, 1
	str	w0, [sp, 176]
	str	w0, [sp, 240]
	mov	x0, 10
	str	d30, [sp, 168]
	str	d31, [sp, 184]
	ldp	d30, d31, [x23, 56]
	str	x0, [sp, 264]
	sub	x0, x1, x1, lsl 2
	str	wzr, [sp, 192]
	str	wzr, [sp, 208]
	lsl	x0, x0, 3
	str	x19, [sp, 216]
	sub	x0, x0, x1
	mov	w1, 0
	str	d30, [sp, 232]
	str	d31, [sp, 248]
	str	wzr, [sp, 256]
	str	wzr, [sp, 272]
	str	x0, [sp, 280]
	mov	x0, x20
	bl	eval
	mov	x4, x0
	mov	w1, 5
	mov	x0, x20
	bl	eval
	mov	x5, x0
	mov	w1, w19
	mov	x0, x20
	bl	eval
	mov	x3, x0
	mov	x2, x5
	mov	x1, x4
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	mov	w5, 8
	mov	w1, w19
	mov	w6, 16
	mov	w3, w5
	mov	w4, w6
	mov	w2, w5
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	ldr	x23, [sp, 48]
	mov	w0, 0
	ldr	d15, [sp, 56]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	d13, d14, [sp, 64]
	ldp	x29, x30, [sp], 288
	ret
	.global	knob
	.section .rodata
	.align	4
	.LANCHOR1:
.LC0:
	.word	71362
	.word	-2147483648
	.zero	8
.LC5:
	.word	-1717986918
	.word	1069128089
	.word	0
	.word	1072693248
.LC7:
	.word	1413754136
	.word	1074340347
.LC12:
	.word	1
	.word	4
.LC13:
	.word	2
	.word	3
.LC14:
	.word	5
	.word	0
.LC15:
	.word	6
	.word	7
	.data
	.align	2
	.LANCHOR0:
knob:
	.word	1065353216

