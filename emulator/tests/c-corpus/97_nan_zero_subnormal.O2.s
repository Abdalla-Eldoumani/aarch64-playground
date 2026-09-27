	.text
	.align	2
	.align 5
d_of:
	fmov	d0, x0
	ret
	.align	2
	.align 5
bits:
	fmov	x0, d0
	ret
	.align	2
	.align 5
fbits:
	fmov	w0, s0
	ret
	.align	2
	.align 5
add:
// 15 "programs/97_nan_zero_subnormal.c" 1
	fadd d0, d0, d1
// 0 "" 2
	ret
	.align	2
	.align 5
sub:
// 15 "programs/97_nan_zero_subnormal.c" 1
	fsub d0, d0, d1
// 0 "" 2
	ret
	.align	2
	.align 5
mul:
// 15 "programs/97_nan_zero_subnormal.c" 1
	fmul d0, d0, d1
// 0 "" 2
	ret
	.align	2
	.align 5
dvd:
// 15 "programs/97_nan_zero_subnormal.c" 1
	fdiv d0, d0, d1
// 0 "" 2
	ret
	.align	2
	.align 5
nmul:
// 15 "programs/97_nan_zero_subnormal.c" 1
	fnmul d0, d0, d1
// 0 "" 2
	ret
	.align	2
	.align 5
max:
// 16 "programs/97_nan_zero_subnormal.c" 1
	fmax d0, d0, d1
// 0 "" 2
	ret
	.align	2
	.align 5
min:
// 16 "programs/97_nan_zero_subnormal.c" 1
	fmin d0, d0, d1
// 0 "" 2
	ret
	.align	2
	.align 5
maxnm:
// 16 "programs/97_nan_zero_subnormal.c" 1
	fmaxnm d0, d0, d1
// 0 "" 2
	ret
	.align	2
	.align 5
minnm:
// 16 "programs/97_nan_zero_subnormal.c" 1
	fminnm d0, d0, d1
// 0 "" 2
	ret
	.align	2
	.align 5
madd:
// 19 "programs/97_nan_zero_subnormal.c" 1
	fmadd d0, d0, d1, d2
// 0 "" 2
	ret
	.align	2
	.align 5
msub:
// 19 "programs/97_nan_zero_subnormal.c" 1
	fmsub d0, d0, d1, d2
// 0 "" 2
	ret
	.align	2
	.align 5
nmadd:
// 19 "programs/97_nan_zero_subnormal.c" 1
	fnmadd d0, d0, d1, d2
// 0 "" 2
	ret
	.align	2
	.align 5
nmsub:
// 19 "programs/97_nan_zero_subnormal.c" 1
	fnmsub d0, d0, d1, d2
// 0 "" 2
	ret
	.align	2
	.align 5
root:
// 20 "programs/97_nan_zero_subnormal.c" 1
	fsqrt d0, d0
// 0 "" 2
	ret
	.align	2
	.align 5
val:
	adrp	x1, .LANCHOR0
	add	x1, x1, :lo12:.LANCHOR0
	ldr	x0, [x1, w0, sxtw 3]
	b	d_of
	.section .rodata
	.align	3
.LC0:
	.string	"a b: add sub mul div nmul max min maxnm minnm"
	.align	3
.LC1:
	.string	"%d%d %016lx %016lx %016lx %016lx %016lx %016lx %016lx %016lx %016lx\n"
	.align	3
.LC2:
	.string	"fma%02d %016lx %016lx %016lx %016lx\n"
	.align	3
.LC3:
	.string	"un%d sqrt %016lx neg %016lx abs %016lx copysign %016lx %016lx\n"
	.align	3
.LC4:
	.string	"libm %016lx %016lx %016lx %016lx\n"
	.align	3
.LC5:
	.string	"libm %016lx %016lx %016lx %016lx %016lx\n"
	.align	3
.LC6:
	.string	"z%02d %016lx %g\n"
	.align	3
.LC7:
	.string	"halvings %d\n"
	.align	3
.LC9:
	.string	"s%02d %016lx %.17g %d\n"
	.align	3
.LC10:
	.string	"fs%d %08x %.9g\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #448
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	stp	x21, x22, [sp, 64]
	adrp	x21, .LC1
	add	x21, x21, :lo12:.LC1
	stp	x19, x20, [sp, 48]
	mov	w20, 0
	stp	d12, d13, [sp, 80]
	stp	d14, d15, [sp, 96]
	bl	puts
	.align 5
.L21:
	mov	w19, 0
	.align 5
.L22:
	mov	w0, w20
	bl	val
	fmov	d31, d0
	mov	w0, w19
	bl	val
	fmov	d1, d0
	fmov	d0, d31
	bl	add
	bl	bits
	fmov	d0, d31
	mov	x3, x0
	bl	sub
	bl	bits
	fmov	d0, d31
	mov	x4, x0
	bl	mul
	bl	bits
	fmov	d0, d31
	mov	x5, x0
	bl	dvd
	bl	bits
	fmov	d0, d31
	mov	x6, x0
	bl	nmul
	bl	bits
	fmov	d0, d31
	mov	x7, x0
	bl	max
	bl	bits
	fmov	d0, d31
	mov	x1, x0
	bl	min
	bl	bits
	fmov	d0, d31
	mov	x2, x0
	bl	maxnm
	bl	bits
	fmov	d0, d31
	mov	x8, x0
	bl	minnm
	bl	bits
	stp	x1, x2, [sp]
	mov	w2, w19
	stp	x8, x0, [sp, 16]
	mov	w1, w20
	mov	x0, x21
	add	w19, w19, 1
	bl	printf
	cmp	w19, 10
	bne	.L22
	add	w20, w20, 1
	cmp	w20, 10
	bne	.L21
	adrp	x21, .LANCHOR1
	add	x21, x21, :lo12:.LANCHOR1
	adrp	x22, .LC2
	mov	x19, x21
	add	x22, x22, :lo12:.LC2
	mov	w20, 0
	.align 5
.L24:
	ldrb	w0, [x19]
	add	x19, x19, 3
	bl	val
	fmov	d31, d0
	ldrb	w0, [x19, -2]
	bl	val
	fmov	d1, d0
	ldrb	w0, [x19, -1]
	bl	val
	fmov	d2, d0
	fmov	d0, d31
	mov	w1, w20
	add	w20, w20, 1
	bl	madd
	bl	bits
	fmov	d0, d31
	mov	x2, x0
	bl	msub
	bl	bits
	fmov	d0, d31
	mov	x3, x0
	bl	nmadd
	bl	bits
	fmov	d0, d31
	mov	x4, x0
	bl	nmsub
	bl	bits
	mov	x5, x0
	mov	x0, x22
	bl	printf
	cmp	w20, 12
	bne	.L24
	adrp	x20, .LC3
	add	x20, x20, :lo12:.LC3
	mov	w19, 0
	fmov	d15, 1.0e+0
	.align 5
.L25:
	movi	v30.4s, 0
	mov	w0, w19
	bl	val
	fmov	d31, d0
	bl	root
	mov	w1, w19
	bl	bits
	mov	x2, x0
	fneg	v30.2d, v30.2d
	add	w19, w19, 1
	fneg	d0, d31
	bl	bits
	fabs	d0, d31
	mov	x3, x0
	bl	bits
	mov	x4, x0
	orr	v0.16b, v30.16b, v31.16b
	bsl	v30.8b, v31.8b, v15.8b
	bl	bits
	mov	x5, x0
	fmov	d0, d30
	bl	bits
	mov	x6, x0
	mov	x0, x20
	bl	printf
	cmp	w19, 10
	bne	.L25
	mov	w0, 8
	bl	val
	fneg	d14, d0
	mov	w0, 4
	bl	val
	fmov	d13, d0
	mov	w0, 1
	bl	val
	fmov	d12, d0
	fmov	d0, d14
	bl	sqrt
	bl	bits
	fmov	d0, d14
	mov	x19, x0
	bl	log
	bl	bits
	fadd	d0, d14, d14
	mov	x20, x0
	bl	log10
	bl	bits
	fmov	d0, 8.0e+0
	mov	x22, x0
	mov	x0, 6148914691236517205
	fmul	d0, d14, d0
	movk	x0, 0x3fd5, lsl 48
	fmov	d1, x0
	bl	pow
	mov	x1, x19
	bl	bits
	mov	x3, x22
	mov	x4, x0
	mov	x2, x20
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, 6
	bl	val
	fmov	d1, d0
	fmov	d0, 1.0e+0
	adrp	x19, .LC5
	bl	fmod
	bl	bits
	fmov	d0, d13
	fmov	d1, 2.0e+0
	mov	x20, x0
	bl	fmod
	bl	bits
	fmov	d0, d13
	mov	x22, x0
	bl	sin
	bl	bits
	fneg	d0, d13
	str	x0, [sp, 120]
	bl	cos
	bl	bits
	fmov	d0, d13
	str	x0, [sp, 112]
	bl	tan
	bl	bits
	mov	x1, x20
	ldp	x4, x3, [sp, 112]
	mov	x5, x0
	mov	x2, x22
	add	x0, x19, :lo12:.LC5
	bl	printf
	mov	w0, 6
	bl	val
	bl	log
	bl	bits
	mov	x20, x0
	mov	w0, 7
	bl	val
	bl	log
	bl	bits
	mov	x22, x0
	mov	w0, 7
	bl	val
	bl	sqrt
	bl	bits
	fmov	d0, d12
	str	x0, [sp, 120]
	bl	fabs
	bl	bits
	mov	x4, x0
	mov	w0, 7
	str	x4, [sp, 112]
	bl	val
	bl	floor
	bl	bits
	mov	x2, x22
	ldp	x4, x3, [sp, 112]
	mov	x5, x0
	mov	x1, x20
	add	x0, x19, :lo12:.LC5
	adrp	x22, .LC6
	add	x20, sp, 224
	add	x22, x22, :lo12:.LC6
	mov	w19, 0
	bl	printf
	str	xzr, [sp, 144]
	mov	x0, -9223372036854775808
	str	x0, [sp, 152]
	fmov	d31, 5.0e+0
	mov	x0, 1
	str	d15, [sp, 160]
	str	d31, [sp, 168]
	str	x0, [sp, 176]
	mov	x0, 9214364837600034816
	str	x0, [sp, 184]
	ldr	d30, [sp, 144]
	ldr	d29, [sp, 152]
	ldr	d0, [sp, 152]
	ldr	d31, [sp, 152]
	ldr	d2, [sp, 152]
	fadd	d29, d30, d29
	ldr	d1, [sp, 144]
	ldr	d4, [sp, 144]
	fadd	d31, d0, d31
	ldr	d3, [sp, 152]
	ldr	d6, [sp, 160]
	fsub	d1, d2, d1
	ldr	d5, [sp, 160]
	ldr	d16, [sp, 152]
	fsub	d3, d4, d3
	ldr	d7, [sp, 168]
	ldr	d18, [sp, 168]
	fsub	d5, d6, d5
	ldr	d17, [sp, 144]
	ldr	d20, [sp, 152]
	fmul	d7, d16, d7
	ldr	d19, [sp, 168]
	ldr	d21, [sp, 144]
	fnmul	d17, d18, d17
	fneg	d20, d20
	ldr	d23, [sp, 160]
	ldr	d22, [sp, 152]
	fneg	d21, d21
	ldr	d25, [sp, 176]
	ldr	d24, [sp, 176]
	fdiv	d20, d20, d19
	stp	d29, d31, [sp, 224]
	stp	d1, d3, [sp, 240]
	fnmul	d24, d25, d24
	fdiv	d22, d23, d22
	stp	d5, d7, [sp, 256]
	str	d21, [sp, 288]
	stp	d17, d20, [sp, 272]
	ldr	d27, [sp, 176]
	ldr	d26, [sp, 184]
	ldr	d29, [sp, 152]
	fneg	d27, d27
	ldr	d28, [sp, 152]
	ldr	d31, [sp, 160]
	ldr	d30, [sp, 160]
	fsub	d28, d29, d28
	stp	d22, d24, [sp, 296]
	fdiv	d27, d27, d26
	fsub	d30, d31, d30
	fneg	d30, d30
	str	d30, [sp, 328]
	stp	d27, d28, [sp, 312]
	.align 5
.L26:
	ldr	d0, [x20], 8
	mov	w1, w19
	add	w19, w19, 1
	bl	bits
	mov	x2, x0
	mov	x0, x22
	bl	printf
	cmp	w19, 14
	bne	.L26
	ldr	d31, [sp, 160]
	mov	x0, 4503599627370496
	fmov	d30, x0
	mov	w1, 0
	fmul	d31, d31, d30
	fcmp	d31, #0.0
	beq	.L27
	fmov	d30, 5.0e-1
	.align 5
.L28:
	fmul	d31, d31, d30
	add	w1, w1, 1
	fcmp	d31, #0.0
	bne	.L28
.L27:
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	movi	d31, #0
	mov	x1, 2024
	mov	w0, 1000
	fmov	d29, x1
	.align 5
.L29:
	ldr	d30, [sp, 160]
	subs	w0, w0, #1
	fmadd	d31, d30, d29, d31
	bne	.L29
	ldr	d30, [sp, 160]
	mov	x0, 4503599627370496
	fmov	d29, x0
	str	d31, [sp, 336]
	ldr	d31, [sp, 176]
	fmov	d28, 2.5e+0
	fmul	d30, d30, d29
	fmov	d29, 5.0e-1
	mov	x0, 4607182418800017407
	add	x20, sp, 336
	fmul	d31, d31, d29
	fmov	d29, 1.5e+0
	mov	w19, 0
	str	d31, [sp, 344]
	ldr	d31, [sp, 176]
	fmul	d31, d31, d29
	fmov	d29, 7.5e-1
	str	d31, [sp, 352]
	ldr	d31, [sp, 176]
	fmul	d31, d31, d29
	str	d31, [sp, 360]
	ldr	d31, [sp, 176]
	fmul	d31, d31, d28
	fmov	d28, 3.0e+0
	str	d31, [sp, 368]
	fdiv	d31, d30, d28
	fmul	d31, d31, d28
	str	d31, [sp, 376]
	ldr	d31, [sp, 176]
	fsub	d31, d30, d31
	str	d31, [sp, 384]
	ldr	d31, [sp, 176]
	ldr	d28, [sp, 176]
	fsub	d31, d30, d31
	fadd	d31, d31, d28
	str	d31, [sp, 392]
	ldr	d31, [sp, 160]
	ldr	d28, [sp, 184]
	fdiv	d31, d31, d28
	fmov	d28, 2.5e-1
	fmul	d31, d31, d28
	str	d31, [sp, 400]
	ldr	d31, [x21, 40]
	adrp	x21, .LC9
	add	x21, x21, :lo12:.LC9
	str	d31, [sp, 408]
	fmov	d31, x0
	mov	x0, 9110782046170513408
	fmov	d28, x0
	fmul	d31, d30, d31
	mov	x0, 4940448791225434112
	str	d31, [sp, 416]
	ldr	d31, [sp, 176]
	ldr	d0, [sp, 176]
	fmul	d31, d31, d28
	fmov	d28, x0
	fmul	d31, d31, d28
	str	d31, [sp, 424]
	fmul	d31, d30, d29
	fdiv	d31, d31, d29
	str	d31, [sp, 432]
	bl	sqrt
	str	d0, [sp, 440]
	.align 5
.L30:
	ldr	d28, [x20], 8
	mov	w1, w19
	add	w19, w19, 1
	fmov	d0, d28
	bl	bits
	mov	x2, x0
	fcmpe	d28, #0.0
	mov	x0, x21
	cset	w3, gt
	bl	printf
	cmp	w19, 14
	bne	.L30
	movi	v31.2s, 0x80, lsl 16
	fmov	s22, 3.0e+0
	fmov	s16, 5.0e-1
	fmov	s18, 1.5e+0
	mov	w0, 2122317824
	fmov	s26, 2.5e-1
	fmov	s30, w0
	adrp	x21, .LC10
	str	s31, [sp, 136]
	movi	v31.2s, 0x1
	add	x20, sp, 192
	add	x21, x21, :lo12:.LC10
	mov	w19, 0
	str	s31, [sp, 140]
	ldr	s7, [sp, 136]
	ldr	s17, [sp, 140]
	ldr	s19, [sp, 140]
	ldr	s21, [sp, 136]
	fmul	s7, s7, s16
	ldr	s20, [sp, 140]
	fmul	s17, s17, s16
	ldr	s23, [sp, 136]
	fmul	s18, s19, s18
	ldr	s31, [sp, 140]
	ldr	s25, [sp, 136]
	fsub	s20, s21, s20
	fdiv	s23, s23, s22
	ldr	s24, [sp, 136]
	ldr	s27, [sp, 140]
	fmul	s31, s31, s30
	stp	s7, s17, [sp, 192]
	fmul	s24, s25, s24
	fnmul	s26, s27, s26
	stp	s18, s20, [sp, 200]
	stp	s24, s26, [sp, 216]
	fmul	s23, s23, s22
	stp	s23, s31, [sp, 208]
	.align 5
.L31:
	ldr	s0, [x20], 4
	mov	w1, w19
	add	w19, w19, 1
	bl	fbits
	fcvt	d0, s0
	mov	w2, w0
	mov	x0, x21
	bl	printf
	cmp	w19, 8
	bne	.L31
	ldp	x29, x30, [sp, 32]
	mov	w0, 0
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	ldp	d12, d13, [sp, 80]
	ldp	d14, d15, [sp, 96]
	add	sp, sp, 448
	ret
	.section .rodata
	.align	4
	.LANCHOR1:
fma_cases:
	.byte 0, 8, 1
	.byte 2, 8, 1
	.byte 8, 1, 2
	.byte 1, 3, 0
	.byte 4, 6, 1
	.byte 4, 6, 8
	.byte 4, 8, 5
	.byte 4, 6, 2
	.byte 6, 8, 7
	.byte 7, 8, 6
	.byte 7, 8, 7
	.byte 9, 9, 7
	.zero	4
.LC8:
	.word	-1023872186
	.word	27618847
	.data
	.align	4
	.LANCHOR0:
in:
	.quad	9221120237041090560
	.quad	-2251799813685247
	.quad	9218868437227405317
	.quad	-3377699720527872
	.quad	9218868437227405312
	.quad	-4503599627370496
	.quad	0
	.quad	-9223372036854775808
	.quad	4607182418800017408
	.quad	1

