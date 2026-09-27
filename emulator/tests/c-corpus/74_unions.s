	.text
	.align	2
	.global	flipsign
flipsign:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	eor	x0, x0, -9223372036854775808
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	add	sp, sp, 16
	ret
	.align	2
	.global	fvswap
fvswap:
	sub	sp, sp, #32
	fmov	s30, s0
	fmov	s31, s1
	fmov	x0, d30
	fmov	w1, s31
	bfi	x0, x1, 32, 32
	str	x0, [sp, 8]
	ldr	s31, [sp, 12]
	fadd	s31, s31, s31
	str	s31, [sp, 24]
	ldr	s30, [sp, 8]
	ldr	s31, [sp, 12]
	fsub	s31, s30, s31
	str	s31, [sp, 28]
	ldr	x0, [sp, 24]
	lsr	w1, w0, 0
	lsr	x0, x0, 32
	fmov	s30, w1
	fmov	s31, w0
	fmov	s0, s30
	fmov	s1, s31
	add	sp, sp, 32
	ret
	.align	2
	.global	widemix
widemix:
	sub	sp, sp, #32
	stp	x0, x1, [sp]
	ldr	x1, [sp, 8]
	ldr	x0, [sp]
	eor	x0, x1, x0
	str	x0, [sp, 16]
	ldr	d30, [sp]
	fmov	d31, -2.0e+0
	fmul	d31, d30, d31
	str	d31, [sp, 24]
	ldp	x0, x1, [sp, 16]
	add	sp, sp, 32
	ret
	.align	2
	.global	shout
shout:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	wzr, [sp, 28]
	b	.L8
.L10:
	ldrsw	x0, [sp, 28]
	add	x1, sp, 8
	ldrb	w0, [x1, x0]
	sub	w0, w0, #32
	and	w2, w0, 255
	ldrsw	x0, [sp, 28]
	add	x1, sp, 8
	strb	w2, [x1, x0]
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L8:
	ldr	w0, [sp, 28]
	cmp	w0, 7
	bgt	.L9
	ldrsw	x0, [sp, 28]
	add	x1, sp, 8
	ldrb	w0, [x1, x0]
	cmp	w0, 0
	bne	.L10
.L9:
	ldr	x0, [sp, 8]
	add	sp, sp, 32
	ret
	.align	2
	.global	next_up
next_up:
	sub	sp, sp, #32
	str	s0, [sp, 12]
	ldr	s31, [sp, 12]
	str	s31, [sp, 24]
	ldr	w0, [sp, 24]
	add	w0, w0, 1
	str	w0, [sp, 24]
	ldr	s31, [sp, 24]
	fmov	s0, s31
	add	sp, sp, 32
	ret
	.align	2
	.global	num
num:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	wzr, [sp, 16]
	ldr	x0, [sp, 8]
	str	x0, [sp, 24]
	ldp	x0, x1, [sp, 16]
	add	sp, sp, 32
	ret
	.align	2
	.global	op
op:
	sub	sp, sp, #32
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	str	w2, [sp, 4]
	ldr	w0, [sp, 12]
	str	w0, [sp, 16]
	ldr	w0, [sp, 8]
	str	w0, [sp, 24]
	ldr	w0, [sp, 4]
	str	w0, [sp, 28]
	ldp	x0, x1, [sp, 16]
	add	sp, sp, 32
	ret
	.align	2
	.global	eval
eval:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x19, [sp, 16]
	str	x0, [sp, 40]
	str	w1, [sp, 36]
	ldrsw	x0, [sp, 36]
	lsl	x0, x0, 4
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	ldr	w0, [x0]
	cmp	w0, 3
	beq	.L19
	cmp	w0, 3
	bhi	.L20
	cmp	w0, 2
	beq	.L21
	cmp	w0, 2
	bhi	.L20
	cmp	w0, 0
	beq	.L22
	cmp	w0, 1
	beq	.L23
	b	.L20
.L22:
	ldrsw	x0, [sp, 36]
	lsl	x0, x0, 4
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	ldr	x0, [x0, 8]
	b	.L24
.L23:
	ldrsw	x0, [sp, 36]
	lsl	x0, x0, 4
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	ldr	w0, [x0, 8]
	mov	w1, w0
	ldr	x0, [sp, 40]
	bl	eval
	mov	x19, x0
	ldrsw	x0, [sp, 36]
	lsl	x0, x0, 4
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	ldr	w0, [x0, 12]
	mov	w1, w0
	ldr	x0, [sp, 40]
	bl	eval
	add	x0, x19, x0
	b	.L24
.L21:
	ldrsw	x0, [sp, 36]
	lsl	x0, x0, 4
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	ldr	w0, [x0, 8]
	mov	w1, w0
	ldr	x0, [sp, 40]
	bl	eval
	mov	x19, x0
	ldrsw	x0, [sp, 36]
	lsl	x0, x0, 4
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	ldr	w0, [x0, 12]
	mov	w1, w0
	ldr	x0, [sp, 40]
	bl	eval
	mul	x0, x19, x0
	b	.L24
.L19:
	ldrsw	x0, [sp, 36]
	lsl	x0, x0, 4
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	ldr	w0, [x0, 8]
	mov	w1, w0
	ldr	x0, [sp, 40]
	bl	eval
	neg	x0, x0
	b	.L24
.L20:
	mov	x0, 0
.L24:
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.global	knob
	.data
	.align	2
knob:
	.word	1065353216
	.section .rodata
	.align	3
.LC0:
	.string	"f %-12g %08x exp %3u man %06x bytes %02x %02x %02x %02x\n"
	.align	3
.LC1:
	.string	"next %.9g %.9g\n"
	.align	3
.LC2:
	.string	"%g%c"
	.align	3
.LC3:
	.string	"tiny %g\n"
	.align	3
.LC5:
	.string	"d %016lx lo %08x hi %08x h %04x %04x %04x %04x flip %.2f\n"
	.align	3
.LC6:
	.string	"inf %f %f pi %.15f\n"
	.align	3
.LC7:
	.string	"fv %.4f %.4f g %.4f\n"
	.align	3
.LC8:
	.string	"wide %016lx %016lx %.3f\n"
	.align	3
.LC9:
	.string	"any %s %s %lx\n"
	.align	3
.LC10:
	.string	"eval %ld %ld %ld\n"
	.align	3
.LC11:
	.string	"sizes %d %d %d %d %d %d\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -352]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	str	d15, [sp, 32]
	adrp	x0, knob
	add	x0, x0, :lo12:knob
	ldr	s31, [x0]
	str	s31, [sp, 332]
	ldr	s31, [sp, 332]
	str	s31, [sp, 304]
	fmov	s31, -1.5e+0
	str	s31, [sp, 308]
	fmov	s31, 1.5625e-1
	str	s31, [sp, 312]
	mov	w0, 45542
	movk	w0, 0x7f61, lsl 16
	fmov	s31, w0
	str	s31, [sp, 316]
	mov	w0, 5826
	movk	w0, 0x1, lsl 16
	fmov	s31, w0
	str	s31, [sp, 320]
	movi	v31.2s, 0x80, lsl 24
	str	s31, [sp, 324]
	str	wzr, [sp, 348]
	b	.L26
.L27:
	ldrsw	x0, [sp, 348]
	lsl	x0, x0, 2
	add	x1, sp, 304
	ldr	s31, [x1, x0]
	str	s31, [sp, 72]
	ldr	s31, [sp, 72]
	fcvt	d31, s31
	ldr	w1, [sp, 72]
	ldr	w0, [sp, 72]
	lsr	w0, w0, 23
	and	w2, w0, 255
	ldr	w0, [sp, 72]
	and	w0, w0, 8388607
	ldrb	w3, [sp, 72]
	ldrb	w4, [sp, 73]
	ldrb	w5, [sp, 74]
	ldrb	w6, [sp, 75]
	mov	w7, w6
	mov	w6, w5
	mov	w5, w4
	mov	w4, w3
	mov	w3, w0
	fmov	d0, d31
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w0, [sp, 348]
	add	w0, w0, 1
	str	w0, [sp, 348]
.L26:
	ldr	w0, [sp, 348]
	cmp	w0, 5
	ble	.L27
	ldr	s0, [sp, 332]
	bl	next_up
	fmov	s31, s0
	fcvt	d15, s31
	ldr	s31, [sp, 332]
	mov	w0, 1149239296
	fmov	s30, w0
	fmul	s31, s31, s30
	fmov	s0, s31
	bl	next_up
	fmov	s31, s0
	fmov	s0, s31
	bl	next_up
	fmov	s31, s0
	fcvt	d31, s31
	fmov	d1, d31
	fmov	d0, d15
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, -3
	str	w0, [sp, 344]
	b	.L28
.L31:
	ldr	w0, [sp, 344]
	add	w0, w0, 127
	lsl	w0, w0, 23
	str	w0, [sp, 64]
	ldr	s31, [sp, 64]
	fcvt	d31, s31
	ldr	w0, [sp, 344]
	cmp	w0, 3
	bne	.L29
	mov	w0, 10
	b	.L30
.L29:
	mov	w0, 32
.L30:
	mov	w1, w0
	fmov	d0, d31
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	w0, [sp, 344]
	add	w0, w0, 1
	str	w0, [sp, 344]
.L28:
	ldr	w0, [sp, 344]
	cmp	w0, 3
	ble	.L31
	mov	w0, 1
	str	w0, [sp, 296]
	ldr	s31, [sp, 296]
	fcvt	d31, s31
	fmov	d0, d31
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	ldr	d31, [x0]
	str	d31, [sp, 264]
	fmov	d31, 1.0e+0
	str	d31, [sp, 272]
	mov	x0, -9223372036854775808
	fmov	d31, x0
	str	d31, [sp, 280]
	ldr	s31, [sp, 332]
	fcvt	d30, s31
	fmov	d31, 3.5e+0
	fmul	d31, d30, d31
	str	d31, [sp, 288]
	str	wzr, [sp, 340]
	b	.L32
.L33:
	ldrsw	x0, [sp, 340]
	lsl	x0, x0, 3
	add	x1, sp, 264
	ldr	d31, [x1, x0]
	str	d31, [sp, 56]
	ldr	x0, [sp, 56]
	bl	flipsign
	str	x0, [sp, 48]
	ldr	x0, [sp, 56]
	ldr	w1, [sp, 56]
	ldr	w2, [sp, 60]
	ldrh	w3, [sp, 56]
	ldrh	w4, [sp, 58]
	ldrh	w5, [sp, 60]
	ldrh	w6, [sp, 62]
	ldr	d31, [sp, 48]
	fmov	d0, d31
	mov	w7, w6
	mov	w6, w5
	mov	w5, w4
	mov	w4, w3
	mov	w3, w2
	mov	w2, w1
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [sp, 340]
	add	w0, w0, 1
	str	w0, [sp, 340]
.L32:
	ldr	w0, [sp, 340]
	cmp	w0, 3
	ble	.L33
	mov	x0, 9218868437227405312
	str	x0, [sp, 256]
	mov	x0, 11544
	movk	x0, 0x5444, lsl 16
	movk	x0, 0x21fb, lsl 32
	movk	x0, 0x4009, lsl 48
	str	x0, [sp, 248]
	ldr	d15, [sp, 256]
	ldr	x0, [sp, 256]
	bl	flipsign
	fmov	d30, x0
	ldr	d31, [sp, 248]
	fmov	d2, d31
	fmov	d1, d30
	fmov	d0, d15
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	s30, [sp, 332]
	fmov	s31, 3.0e+0
	fmul	s31, s30, s31
	str	s31, [sp, 240]
	ldr	s31, [sp, 332]
	fneg	s30, s31
	fmov	s31, 4.0e+0
	fdiv	s31, s30, s31
	str	s31, [sp, 244]
	str	wzr, [sp, 336]
	b	.L34
.L35:
	ldr	s30, [sp, 240]
	ldr	s31, [sp, 244]
	fmov	s0, s30
	fmov	s1, s31
	bl	fvswap
	fmov	s30, s0
	fmov	s31, s1
	str	s30, [sp, 240]
	str	s31, [sp, 244]
	ldr	s31, [sp, 240]
	fcvt	d30, s31
	ldr	s31, [sp, 244]
	fcvt	d29, s31
	ldr	s31, [sp, 240]
	fcvt	d31, s31
	fmov	d2, d31
	fmov	d1, d29
	fmov	d0, d30
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	w0, [sp, 336]
	add	w0, w0, 1
	str	w0, [sp, 336]
.L34:
	ldr	w0, [sp, 336]
	cmp	w0, 2
	ble	.L35
	fmov	d31, 2.0e+0
	str	d31, [sp, 224]
	fmov	d31, -5.0e-1
	str	d31, [sp, 232]
	ldp	x0, x1, [sp, 224]
	bl	widemix
	stp	x0, x1, [sp, 224]
	ldr	x0, [sp, 224]
	ldr	x1, [sp, 232]
	ldr	d31, [sp, 232]
	fmov	d0, d31
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	mov	x0, 25960
	movk	x0, 0x6c6c, lsl 16
	movk	x0, 0x6f, lsl 32
	str	x0, [sp, 216]
	ldr	x0, [sp, 216]
	bl	shout
	str	x0, [sp, 208]
	ldr	x2, [sp, 208]
	add	x1, sp, 208
	add	x0, sp, 216
	mov	x3, x2
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	mov	w2, 4
	mov	w1, 1
	mov	w0, 2
	bl	op
	stp	x0, x1, [sp, 80]
	mov	w2, 3
	mov	w1, 2
	mov	w0, 1
	bl	op
	stp	x0, x1, [sp, 96]
	mov	x0, 3
	bl	num
	stp	x0, x1, [sp, 112]
	mov	x0, 4
	bl	num
	stp	x0, x1, [sp, 128]
	mov	w2, 0
	mov	w1, 5
	mov	w0, 3
	bl	op
	stp	x0, x1, [sp, 144]
	mov	w2, 7
	mov	w1, 6
	mov	w0, 1
	bl	op
	stp	x0, x1, [sp, 160]
	mov	x0, 10
	bl	num
	stp	x0, x1, [sp, 176]
	ldr	s31, [sp, 332]
	fcvtzs	x1, s31
	mov	x0, x1
	lsl	x2, x1, 2
	sub	x0, x0, x2
	lsl	x0, x0, 3
	sub	x0, x0, x1
	bl	num
	stp	x0, x1, [sp, 192]
	add	x0, sp, 80
	mov	w1, 0
	bl	eval
	mov	x19, x0
	add	x0, sp, 80
	mov	w1, 5
	bl	eval
	mov	x20, x0
	add	x0, sp, 80
	mov	w1, 4
	bl	eval
	mov	x3, x0
	mov	x2, x20
	mov	x1, x19
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	mov	w6, 16
	mov	w5, 8
	mov	w4, 16
	mov	w3, 8
	mov	w2, 8
	mov	w1, 4
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	mov	w0, 0
	ldr	d15, [sp, 32]
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 352
	ret
	.section .rodata
	.align	3
.LC4:
	.word	-1717986918
	.word	1069128089

