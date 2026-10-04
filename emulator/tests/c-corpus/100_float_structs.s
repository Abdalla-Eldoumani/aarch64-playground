	.text
	.align	2
v2_add:
	sub	sp, sp, #32
	fmov	s30, s0
	fmov	s31, s1
	fmov	x0, d30
	fmov	w1, s31
	bfi	x0, x1, 32, 32
	str	x0, [sp, 8]
	fmov	s30, s2
	fmov	s31, s3
	fmov	x0, d30
	fmov	w1, s31
	bfi	x0, x1, 32, 32
	str	x0, [sp]
	ldr	s30, [sp, 8]
	ldr	s31, [sp]
	fadd	s31, s30, s31
	str	s31, [sp, 24]
	ldr	s30, [sp, 12]
	ldr	s31, [sp, 4]
	fadd	s31, s30, s31
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
v3_cross:
	sub	sp, sp, #80
	fmov	s26, s0
	fmov	s27, s1
	fmov	s28, s2
	fmov	s29, s3
	fmov	s30, s4
	fmov	s31, s5
	str	s26, [sp, 32]
	str	s27, [sp, 36]
	str	s28, [sp, 40]
	str	s29, [sp, 16]
	str	s30, [sp, 20]
	str	s31, [sp, 24]
	ldr	s30, [sp, 36]
	ldr	s31, [sp, 24]
	fmul	s30, s30, s31
	ldr	s29, [sp, 40]
	ldr	s31, [sp, 20]
	fmul	s31, s29, s31
	fsub	s31, s30, s31
	str	s31, [sp, 48]
	ldr	s30, [sp, 40]
	ldr	s31, [sp, 16]
	fmul	s30, s30, s31
	ldr	s29, [sp, 32]
	ldr	s31, [sp, 24]
	fmul	s31, s29, s31
	fsub	s31, s30, s31
	str	s31, [sp, 52]
	ldr	s30, [sp, 32]
	ldr	s31, [sp, 20]
	fmul	s30, s30, s31
	ldr	s29, [sp, 36]
	ldr	s31, [sp, 16]
	fmul	s31, s29, s31
	fsub	s31, s30, s31
	str	s31, [sp, 56]
	add	x0, sp, 64
	add	x1, sp, 48
	ldr	x2, [x1]
	ldr	w1, [x1, 8]
	str	x2, [x0]
	str	w1, [x0, 8]
	ldr	s29, [sp, 64]
	ldr	s30, [sp, 68]
	ldr	s31, [sp, 72]
	fmov	s0, s29
	fmov	s1, s30
	fmov	s2, s31
	add	sp, sp, 80
	ret
	.align	2
d4_scale:
	sub	sp, sp, #144
	fmov	d28, d0
	fmov	d29, d1
	fmov	d30, d2
	fmov	d31, d3
	str	d4, [sp, 40]
	str	d28, [sp, 48]
	str	d29, [sp, 56]
	str	d30, [sp, 64]
	str	d31, [sp, 72]
	ldr	d30, [sp, 48]
	ldr	d31, [sp, 40]
	fmul	d31, d30, d31
	str	d31, [sp, 80]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 40]
	fmul	d31, d30, d31
	str	d31, [sp, 88]
	ldr	d30, [sp, 64]
	ldr	d31, [sp, 40]
	fmul	d31, d30, d31
	str	d31, [sp, 96]
	ldr	d30, [sp, 72]
	ldr	d31, [sp, 40]
	fmul	d31, d30, d31
	str	d31, [sp, 104]
	add	x0, sp, 112
	add	x1, sp, 80
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	str	q30, [x0]
	str	q31, [x0, 16]
	ldr	d28, [sp, 112]
	ldr	d29, [sp, 120]
	ldr	d30, [sp, 128]
	ldr	d31, [sp, 136]
	fmov	d0, d28
	fmov	d1, d29
	fmov	d2, d30
	fmov	d3, d31
	add	sp, sp, 144
	ret
	.align	2
f5_rev:
	str	x19, [sp, -48]!
	mov	x2, x8
	mov	x19, x0
	str	wzr, [sp, 44]
	b	.L8
.L9:
	mov	w1, 4
	ldr	w0, [sp, 44]
	sub	w0, w1, w0
	sxtw	x0, w0
	ldr	s31, [x19, x0, lsl 2]
	fadd	s31, s31, s31
	ldrsw	x0, [sp, 44]
	lsl	x0, x0, 2
	add	x1, sp, 24
	str	s31, [x1, x0]
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L8:
	ldr	w0, [sp, 44]
	cmp	w0, 4
	ble	.L9
	mov	x3, x2
	add	x2, sp, 24
	ldp	x0, x1, [x2]
	ldr	w2, [x2, 16]
	stp	x0, x1, [x3]
	str	w2, [x3, 16]
	ldr	x19, [sp], 48
	ret
	.align	2
fi_mix:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	s0, [sp, 4]
	ldr	s30, [sp, 8]
	ldr	s31, [sp, 4]
	fmul	s31, s30, s31
	str	s31, [sp, 24]
	ldr	w0, [sp, 12]
	ldr	s31, [sp, 4]
	fcvtzs	s31, s31
	fmov	w1, s31
	add	w0, w0, w1
	str	w0, [sp, 28]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
fd_swap:
	sub	sp, sp, #32
	stp	x0, x1, [sp]
	ldr	d31, [sp, 8]
	fcvt	s31, d31
	str	s31, [sp, 16]
	ldr	s31, [sp]
	fcvt	d31, s31
	str	d31, [sp, 24]
	ldp	x0, x1, [sp, 16]
	add	sp, sp, 32
	ret
	.align	2
nv_norm:
	sub	sp, sp, #64
	fmov	s29, s0
	fmov	s30, s1
	fmov	s31, s2
	str	s29, [sp, 16]
	str	s30, [sp, 20]
	str	s31, [sp, 24]
	ldr	s30, [sp, 16]
	ldr	s31, [sp, 16]
	fmul	s30, s30, s31
	ldr	s29, [sp, 20]
	ldr	s31, [sp, 20]
	fmul	s31, s29, s31
	fadd	s30, s30, s31
	ldr	s29, [sp, 24]
	ldr	s31, [sp, 24]
	fmul	s31, s29, s31
	fadd	s31, s30, s31
	str	s31, [sp, 60]
	ldr	s30, [sp, 16]
	ldr	s31, [sp, 60]
	fdiv	s31, s30, s31
	str	s31, [sp, 32]
	ldr	s30, [sp, 20]
	ldr	s31, [sp, 60]
	fdiv	s31, s30, s31
	str	s31, [sp, 36]
	ldr	s30, [sp, 24]
	ldr	s31, [sp, 60]
	fdiv	s31, s30, s31
	str	s31, [sp, 40]
	add	x0, sp, 48
	add	x1, sp, 32
	ldr	x2, [x1]
	ldr	w1, [x1, 8]
	str	x2, [x0]
	str	w1, [x0, 8]
	ldr	s29, [sp, 48]
	ldr	s30, [sp, 52]
	ldr	s31, [sp, 56]
	fmov	s0, s29
	fmov	s1, s30
	fmov	s2, s31
	add	sp, sp, 64
	ret
	.align	2
spill:
	sub	sp, sp, #64
	fmov	d24, d0
	fmov	d25, d1
	fmov	d26, d2
	fmov	d27, d3
	fmov	d28, d4
	fmov	d29, d5
	fmov	d30, d6
	fmov	d31, d7
	str	d24, [sp, 32]
	str	d25, [sp, 40]
	str	d26, [sp, 48]
	str	d27, [sp, 56]
	str	d28, [sp]
	str	d29, [sp, 8]
	str	d30, [sp, 16]
	str	d31, [sp, 24]
	ldr	d30, [sp, 32]
	ldr	d31, [sp, 24]
	fadd	d31, d31, d31
	fadd	d30, d30, d31
	ldr	s29, [sp, 64]
	ldr	s31, [sp, 68]
	fmul	s31, s29, s31
	fcvt	d31, s31
	fadd	d30, d30, d31
	ldr	d31, [sp, 72]
	fadd	d31, d30, d31
	fmov	d0, d31
	add	sp, sp, 64
	ret
	.align	2
no_backfill:
	sub	sp, sp, #48
	str	d0, [sp, 40]
	str	d1, [sp, 32]
	str	d2, [sp, 24]
	str	d3, [sp, 16]
	str	d4, [sp, 8]
	ldr	d31, [sp, 32]
	fadd	d30, d31, d31
	ldr	d31, [sp, 40]
	fadd	d30, d30, d31
	ldr	d29, [sp, 24]
	fmov	d31, 3.0e+0
	fmul	d31, d29, d31
	fadd	d30, d30, d31
	ldr	d29, [sp, 16]
	fmov	d31, 4.0e+0
	fmul	d31, d29, d31
	fadd	d30, d30, d31
	ldr	d29, [sp, 8]
	fmov	d31, 5.0e+0
	fmul	d31, d29, d31
	fadd	d30, d30, d31
	ldr	d29, [sp, 48]
	fmov	d31, 6.0e+0
	fmul	d31, d29, d31
	fadd	d30, d30, d31
	ldr	d29, [sp, 56]
	fmov	d31, 7.0e+0
	fmul	d31, d29, d31
	fadd	d30, d30, d31
	ldr	d29, [sp, 64]
	fmov	d31, 8.0e+0
	fmul	d31, d29, d31
	fadd	d30, d30, d31
	ldr	d29, [sp, 72]
	fmov	d31, 9.0e+0
	fmul	d31, d29, d31
	fadd	d30, d30, d31
	ldr	d29, [sp, 80]
	fmov	d31, 1.0e+1
	fmul	d31, d29, d31
	fadd	d31, d30, d31
	fmov	d0, d31
	add	sp, sp, 48
	ret
	.align	2
range:
	sub	sp, sp, #48
	mov	x2, x8
	str	x0, [sp, 8]
	str	w1, [sp, 4]
	ldr	x0, [sp, 8]
	ldr	d31, [x0]
	str	d31, [sp, 16]
	ldr	x0, [sp, 8]
	ldr	d31, [x0]
	str	d31, [sp, 24]
	ldrsw	x0, [sp, 4]
	str	x0, [sp, 32]
	mov	w0, 1
	str	w0, [sp, 44]
	b	.L22
.L27:
	ldrsw	x0, [sp, 44]
	lsl	x0, x0, 3
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	ldr	d30, [x0]
	ldr	d31, [sp, 16]
	fcmpe	d30, d31
	bmi	.L29
	b	.L23
.L29:
	ldrsw	x0, [sp, 44]
	lsl	x0, x0, 3
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	ldr	d31, [x0]
	str	d31, [sp, 16]
.L23:
	ldrsw	x0, [sp, 44]
	lsl	x0, x0, 3
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	ldr	d30, [x0]
	ldr	d31, [sp, 24]
	fcmpe	d30, d31
	bgt	.L30
	b	.L25
.L30:
	ldrsw	x0, [sp, 44]
	lsl	x0, x0, 3
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	ldr	d31, [x0]
	str	d31, [sp, 24]
.L25:
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L22:
	ldr	w1, [sp, 44]
	ldr	w0, [sp, 4]
	cmp	w1, w0
	blt	.L27
	mov	x3, x2
	add	x2, sp, 16
	ldp	x0, x1, [x2]
	ldr	x2, [x2, 16]
	stp	x0, x1, [x3]
	str	x2, [x3, 16]
	add	sp, sp, 48
	ret
	.align	2
bf_sum:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	w1, [sp, 4]
	str	wzr, [sp, 28]
	str	wzr, [sp, 24]
	b	.L32
.L35:
	ldrsw	x1, [sp, 24]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x0
	ldr	x0, [sp, 8]
	add	x0, x0, x1
	ldrb	w0, [x0, 8]
	and	w0, w0, 1
	and	w0, w0, 255
	and	w0, w0, 1
	cmp	w0, 0
	beq	.L33
	ldrsw	x1, [sp, 24]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x0
	ldr	x0, [sp, 8]
	add	x0, x0, x1
	ldr	s30, [x0, 4]
	ldrsw	x1, [sp, 24]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x0
	ldr	x0, [sp, 8]
	add	x0, x0, x1
	ldr	w0, [x0]
	ubfx	x0, x0, 0, 3
	and	w0, w0, 255
	fmov	s31, w0
	ucvtf	s31, s31
	fmul	s31, s30, s31
	b	.L34
.L33:
	ldrsw	x1, [sp, 24]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x0
	ldr	x0, [sp, 8]
	add	x0, x0, x1
	ldr	s31, [x0, 4]
	fneg	s31, s31
.L34:
	ldr	s30, [sp, 28]
	fadd	s31, s30, s31
	str	s31, [sp, 28]
	ldr	w0, [sp, 24]
	add	w0, w0, 1
	str	w0, [sp, 24]
.L32:
	ldr	w1, [sp, 24]
	ldr	w0, [sp, 4]
	cmp	w1, w0
	blt	.L35
	ldr	s31, [sp, 28]
	fmov	s0, s31
	add	sp, sp, 32
	ret
	.align	2
step:
	sub	sp, sp, #32
	fmov	s28, s0
	fmov	s29, s1
	fmov	s30, s2
	fmov	s31, s3
	mov	x0, 0
	mov	x1, 0
	fmov	w2, s28
	bfi	x0, x2, 0, 32
	fmov	w2, s29
	bfi	x0, x2, 32, 32
	fmov	w2, s30
	bfi	x1, x2, 0, 32
	fmov	w2, s31
	bfi	x1, x2, 32, 32
	stp	x0, x1, [sp, 16]
	str	s4, [sp, 12]
	ldr	s30, [sp, 16]
	ldr	s29, [sp, 24]
	ldr	s31, [sp, 12]
	fmul	s31, s29, s31
	fadd	s31, s30, s31
	str	s31, [sp, 16]
	ldr	s30, [sp, 20]
	ldr	s29, [sp, 28]
	ldr	s31, [sp, 12]
	fmul	s31, s29, s31
	fadd	s31, s30, s31
	str	s31, [sp, 20]
	ldr	s30, [sp, 28]
	ldr	s31, [sp, 12]
	mov	w0, 52429
	movk	w0, 0x411c, lsl 16
	fmov	s29, w0
	fmul	s31, s31, s29
	fsub	s31, s30, s31
	str	s31, [sp, 28]
	ldp	x0, x1, [sp, 16]
	lsr	w3, w0, 0
	lsr	x2, x0, 32
	mov	w4, w2
	lsr	w2, w1, 0
	lsr	x0, x1, 32
	fmov	s28, w3
	fmov	s29, w4
	fmov	s30, w2
	fmov	s31, w0
	fmov	s0, s28
	fmov	s1, s29
	fmov	s2, s30
	fmov	s3, s31
	add	sp, sp, 32
	ret
	.data
	.align	3
seed:
	.word	1036831949
	.word	-1071644672
	.word	1081081856
	.word	981668463
	.word	1178658486
	.word	-2147483648
	.section .rodata
	.align	3
.LC0:
	.string	"v2 %.9g %.9g\n"
	.align	3
.LC1:
	.string	"v3 %.9g %.9g %.9g\n"
	.align	3
.LC2:
	.string	"d4 %.17g %.17g %.17g %.17g\n"
	.align	3
.LC3:
	.string	"f5 %.9g %.9g %.9g %.9g %.9g\n"
	.align	3
.LC5:
	.string	"fi %.9g %d fd %.9g %.17g\n"
	.align	3
.LC6:
	.string	"nv %.9g %.9g %.9g\n"
	.align	3
.LC7:
	.string	"spill %.17g\n"
	.align	3
.LC8:
	.string	"backfill %.17g\n"
	.align	3
.LC9:
	.string	"range %.17g %.17g %ld\n"
	.align	3
.LC10:
	.string	"bf %.9g size %zu %zu %zu %zu off %zu %zu\n"
	.align	3
.LC11:
	.string	"p%d %.9g %.9g %.9g %.9g\n"
	.align	3
.LC12:
	.string	"fu %08x %02x %02x %02x %02x\n"
	.align	3
.LC13:
	.string	"fu %.9g\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #576
	stp	x29, x30, [sp, 48]
	add	x29, sp, 48
	stp	x19, x20, [sp, 64]
	str	x21, [sp, 80]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0]
	str	s31, [sp, 552]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 4]
	str	s31, [sp, 556]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 8]
	str	s31, [sp, 544]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 12]
	str	s31, [sp, 548]
	ldr	s28, [sp, 544]
	ldr	s29, [sp, 548]
	ldr	s30, [sp, 552]
	ldr	s31, [sp, 556]
	fmov	s2, s28
	fmov	s3, s29
	fmov	s0, s30
	fmov	s1, s31
	bl	v2_add
	fmov	s30, s0
	fmov	s31, s1
	str	s30, [sp, 536]
	str	s31, [sp, 540]
	ldr	s31, [sp, 536]
	fcvt	d30, s31
	ldr	s31, [sp, 540]
	fcvt	d31, s31
	fmov	d1, d31
	fmov	d0, d30
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0]
	str	s31, [sp, 520]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 4]
	str	s31, [sp, 524]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 8]
	str	s31, [sp, 528]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 12]
	str	s31, [sp, 504]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 16]
	str	s31, [sp, 508]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 20]
	str	s31, [sp, 512]
	ldr	s26, [sp, 504]
	ldr	s27, [sp, 508]
	ldr	s28, [sp, 512]
	ldr	s29, [sp, 520]
	ldr	s30, [sp, 524]
	ldr	s31, [sp, 528]
	fmov	s3, s26
	fmov	s4, s27
	fmov	s5, s28
	fmov	s0, s29
	fmov	s1, s30
	fmov	s2, s31
	bl	v3_cross
	fmov	s29, s0
	fmov	s30, s1
	fmov	s31, s2
	str	s29, [sp, 488]
	str	s30, [sp, 492]
	str	s31, [sp, 496]
	ldr	s31, [sp, 488]
	fcvt	d30, s31
	ldr	s31, [sp, 492]
	fcvt	d29, s31
	ldr	s31, [sp, 496]
	fcvt	d31, s31
	fmov	d2, d31
	fmov	d1, d29
	fmov	d0, d30
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0]
	fcvt	d31, s31
	str	d31, [sp, 456]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 4]
	fcvt	d31, s31
	str	d31, [sp, 464]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 8]
	fcvt	d31, s31
	str	d31, [sp, 472]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 16]
	fcvt	d31, s31
	str	d31, [sp, 480]
	ldr	d28, [sp, 456]
	ldr	d29, [sp, 464]
	ldr	d30, [sp, 472]
	ldr	d31, [sp, 480]
	mov	x0, 6148914691236517205
	movk	x0, 0x3fd5, lsl 48
	fmov	d4, x0
	fmov	d0, d28
	fmov	d1, d29
	fmov	d2, d30
	fmov	d3, d31
	bl	d4_scale
	fmov	d28, d0
	fmov	d29, d1
	fmov	d30, d2
	fmov	d31, d3
	str	d28, [sp, 424]
	str	d29, [sp, 432]
	str	d30, [sp, 440]
	str	d31, [sp, 448]
	ldr	d31, [sp, 424]
	ldr	d30, [sp, 432]
	ldr	d29, [sp, 440]
	ldr	d28, [sp, 448]
	fmov	d3, d28
	fmov	d2, d29
	fmov	d1, d30
	fmov	d0, d31
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0]
	str	s31, [sp, 400]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 4]
	str	s31, [sp, 404]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 8]
	str	s31, [sp, 408]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 12]
	str	s31, [sp, 412]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 16]
	str	s31, [sp, 416]
	add	x0, sp, 96
	add	x1, sp, 400
	ldp	x2, x3, [x1]
	ldr	w1, [x1, 16]
	stp	x2, x3, [x0]
	str	w1, [x0, 16]
	add	x0, sp, 96
	add	x1, sp, 376
	mov	x8, x1
	bl	f5_rev
	ldr	s31, [sp, 376]
	fcvt	d30, s31
	ldr	s31, [sp, 380]
	fcvt	d29, s31
	ldr	s31, [sp, 384]
	fcvt	d28, s31
	ldr	s31, [sp, 388]
	fcvt	d27, s31
	ldr	s31, [sp, 392]
	fcvt	d31, s31
	fmov	d4, d31
	fmov	d3, d27
	fmov	d2, d28
	fmov	d1, d29
	fmov	d0, d30
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 8]
	fmov	w0, s31
	bfi	x19, x0, 0, 32
	mov	x0, -7
	bfi	x19, x0, 32, 32
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 4]
	fmov	s0, s31
	mov	x0, x19
	bl	fi_mix
	str	x0, [sp, 368]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 16]
	fmov	w0, s31
	bfi	x20, x0, 0, 32
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	ldr	x21, [x0]
	mov	x0, x20
	mov	x1, x21
	bl	fd_swap
	stp	x0, x1, [sp, 352]
	ldr	s31, [sp, 368]
	fcvt	d30, s31
	ldr	w0, [sp, 372]
	ldr	s31, [sp, 352]
	fcvt	d31, s31
	ldr	d29, [sp, 360]
	fmov	d2, d29
	fmov	d1, d31
	mov	w1, w0
	fmov	d0, d30
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 4]
	str	s31, [sp, 320]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 8]
	str	s31, [sp, 324]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0]
	str	s31, [sp, 328]
	ldr	s29, [sp, 320]
	ldr	s30, [sp, 324]
	ldr	s31, [sp, 328]
	fmov	s0, s29
	fmov	s1, s30
	fmov	s2, s31
	bl	nv_norm
	fmov	s29, s0
	fmov	s30, s1
	fmov	s31, s2
	str	s29, [sp, 336]
	str	s30, [sp, 340]
	str	s31, [sp, 344]
	ldr	s31, [sp, 336]
	fcvt	d30, s31
	ldr	s31, [sp, 340]
	fcvt	d29, s31
	ldr	s31, [sp, 344]
	fcvt	d31, s31
	fmov	d2, d31
	fmov	d1, d29
	fmov	d0, d30
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	d24, [sp, 424]
	ldr	d25, [sp, 432]
	ldr	d26, [sp, 440]
	ldr	d27, [sp, 448]
	ldr	d28, [sp, 456]
	ldr	d29, [sp, 464]
	ldr	d30, [sp, 472]
	ldr	d31, [sp, 480]
	fmov	d23, 5.0e-1
	str	d23, [sp, 8]
	ldr	x0, [sp, 552]
	str	x0, [sp]
	fmov	d4, d24
	fmov	d5, d25
	fmov	d6, d26
	fmov	d7, d27
	fmov	d0, d28
	fmov	d1, d29
	fmov	d2, d30
	fmov	d3, d31
	bl	spill
	fmov	d31, d0
	fmov	d0, d31
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 12]
	fcvt	d31, s31
	str	d31, [sp, 32]
	mov	x1, sp
	add	x0, sp, 456
	ldr	q30, [x0]
	ldr	q31, [x0, 16]
	str	q30, [x1]
	str	q31, [x1, 16]
	fmov	d4, 5.0e+0
	fmov	d3, 4.0e+0
	fmov	d2, 3.0e+0
	fmov	d1, 2.0e+0
	fmov	d0, 1.0e+0
	bl	no_backfill
	fmov	d31, d0
	fmov	d0, d31
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	str	wzr, [sp, 572]
	b	.L40
.L41:
	ldr	w1, [sp, 572]
	mov	w0, 43691
	movk	w0, 0x2aaa, lsl 16
	smull	x0, w1, w0
	lsr	x2, x0, 32
	asr	w0, w1, 31
	sub	w2, w2, w0
	mov	w0, w2
	lsl	w0, w0, 1
	add	w0, w0, w2
	lsl	w0, w0, 1
	sub	w2, w1, w0
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	sxtw	x1, w2
	ldr	s30, [x0, x1, lsl 2]
	ldr	w0, [sp, 572]
	add	w0, w0, 1
	scvtf	s31, w0
	fmul	s31, s30, s31
	fcvt	d30, s31
	fmov	d31, 1.0e+0
	fsub	d31, d30, d31
	ldrsw	x0, [sp, 572]
	lsl	x0, x0, 3
	add	x1, sp, 264
	str	d31, [x1, x0]
	ldr	w0, [sp, 572]
	add	w0, w0, 1
	str	w0, [sp, 572]
.L40:
	ldr	w0, [sp, 572]
	cmp	w0, 6
	ble	.L41
	add	x0, sp, 264
	add	x1, sp, 240
	mov	x8, x1
	mov	w1, 7
	bl	range
	ldr	d31, [sp, 240]
	ldr	d30, [sp, 248]
	ldr	x0, [sp, 256]
	mov	x1, x0
	fmov	d1, d30
	fmov	d0, d31
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	ldrb	w0, [sp, 192]
	mov	w1, 5
	bfi	w0, w1, 0, 3
	strb	w0, [sp, 192]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0]
	str	s31, [sp, 196]
	ldrb	w0, [sp, 200]
	orr	w0, w0, 1
	strb	w0, [sp, 200]
	ldrb	w0, [sp, 204]
	mov	w1, 3
	bfi	w0, w1, 0, 3
	strb	w0, [sp, 204]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 8]
	str	s31, [sp, 208]
	ldrb	w0, [sp, 212]
	and	w0, w0, -2
	strb	w0, [sp, 212]
	ldrb	w0, [sp, 216]
	orr	w0, w0, 7
	strb	w0, [sp, 216]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 12]
	str	s31, [sp, 220]
	ldrb	w0, [sp, 224]
	orr	w0, w0, 1
	strb	w0, [sp, 224]
	ldrb	w0, [sp, 228]
	mov	w1, 1
	bfi	w0, w1, 0, 3
	strb	w0, [sp, 228]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 4]
	str	s31, [sp, 232]
	ldrb	w0, [sp, 236]
	orr	w0, w0, 1
	strb	w0, [sp, 236]
	add	x0, sp, 192
	mov	w1, 4
	bl	bf_sum
	fmov	s31, s0
	fcvt	d31, s31
	mov	x6, 8
	mov	x5, 8
	mov	x4, 20
	mov	x3, 24
	mov	x2, 16
	mov	x1, 12
	fmov	d0, d31
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	str	wzr, [sp, 144]
	str	wzr, [sp, 148]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 8]
	str	s31, [sp, 152]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 8]
	str	s31, [sp, 156]
	fmov	s31, 1.0e+0
	str	s31, [sp, 160]
	fmov	s31, 2.0e+0
	str	s31, [sp, 164]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0]
	fneg	s31, s31
	str	s31, [sp, 168]
	str	wzr, [sp, 172]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 16]
	str	s31, [sp, 176]
	str	wzr, [sp, 180]
	str	wzr, [sp, 184]
	fmov	s31, 2.0e+1
	str	s31, [sp, 188]
	str	wzr, [sp, 568]
	b	.L42
.L45:
	str	wzr, [sp, 564]
	b	.L43
.L44:
	ldrsw	x0, [sp, 564]
	lsl	x0, x0, 4
	add	x1, sp, 144
	add	x19, x1, x0
	ldrsw	x0, [sp, 564]
	lsl	x0, x0, 4
	add	x1, sp, 144
	add	x0, x1, x0
	ldr	s28, [x0]
	ldr	s29, [x0, 4]
	ldr	s30, [x0, 8]
	ldr	s31, [x0, 12]
	mov	w0, 52429
	movk	w0, 0x3d4c, lsl 16
	fmov	s4, w0
	fmov	s0, s28
	fmov	s1, s29
	fmov	s2, s30
	fmov	s3, s31
	bl	step
	fmov	s28, s0
	fmov	s29, s1
	fmov	s30, s2
	fmov	s31, s3
	str	s28, [x19]
	str	s29, [x19, 4]
	str	s30, [x19, 8]
	str	s31, [x19, 12]
	ldr	w0, [sp, 564]
	add	w0, w0, 1
	str	w0, [sp, 564]
.L43:
	ldr	w0, [sp, 564]
	cmp	w0, 2
	ble	.L44
	ldr	w0, [sp, 568]
	add	w0, w0, 1
	str	w0, [sp, 568]
.L42:
	ldr	w0, [sp, 568]
	cmp	w0, 9
	ble	.L45
	str	wzr, [sp, 560]
	b	.L46
.L47:
	ldrsw	x0, [sp, 560]
	lsl	x0, x0, 4
	add	x1, sp, 144
	ldr	s31, [x1, x0]
	fcvt	d30, s31
	ldrsw	x0, [sp, 560]
	lsl	x0, x0, 4
	add	x1, sp, 148
	ldr	s31, [x1, x0]
	fcvt	d29, s31
	ldrsw	x0, [sp, 560]
	lsl	x0, x0, 4
	add	x1, sp, 152
	ldr	s31, [x1, x0]
	fcvt	d28, s31
	ldrsw	x0, [sp, 560]
	lsl	x0, x0, 4
	add	x1, sp, 156
	ldr	s31, [x1, x0]
	fcvt	d31, s31
	fmov	d3, d31
	fmov	d2, d28
	fmov	d1, d29
	fmov	d0, d30
	ldr	w1, [sp, 560]
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	ldr	w0, [sp, 560]
	add	w0, w0, 1
	str	w0, [sp, 560]
.L46:
	ldr	w0, [sp, 560]
	cmp	w0, 2
	ble	.L47
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	s31, [x0, 4]
	str	s31, [sp, 136]
	ldr	w0, [sp, 136]
	ldrb	w1, [sp, 136]
	ldrb	w2, [sp, 137]
	ldrb	w3, [sp, 138]
	ldrb	w4, [sp, 139]
	mov	w5, w4
	mov	w4, w3
	mov	w3, w2
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	ldr	w0, [sp, 136]
	eor	w0, w0, -2147483648
	str	w0, [sp, 136]
	ldr	s31, [sp, 136]
	fcvt	d31, s31
	fmov	d0, d31
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 48]
	ldp	x19, x20, [sp, 64]
	ldr	x21, [sp, 80]
	add	sp, sp, 576
	ret
	.section .rodata
	.align	3
.LC4:
	.word	-1840700270
	.word	1069697316

