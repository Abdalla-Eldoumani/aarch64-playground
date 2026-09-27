	.text
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
	sub	sp, sp, #496
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	stp	x19, x20, [sp, 48]
	adrp	x20, .LANCHOR0
	add	x20, x20, :lo12:.LANCHOR0
	stp	x21, x22, [sp, 64]
	mov	w21, 0
	stp	x23, x24, [sp, 80]
	adrp	x23, .LC1
	add	x23, x23, :lo12:.LC1
	str	x25, [sp, 96]
	stp	d12, d13, [sp, 112]
	stp	d14, d15, [sp, 128]
	bl	puts
	.align 5
.L2:
	sxtw	x22, w21
	mov	w19, 0
	.align 5
.L3:
	ldr	d31, [x20, x22, lsl 3]
	mov	w2, w19
	ldr	d30, [x20, w19, sxtw 3]
// 15 "programs/97_nan_zero_subnormal.c" 1
	fadd d29, d31, d30
// 0 "" 2
// 15 "programs/97_nan_zero_subnormal.c" 1
	fsub d28, d31, d30
// 0 "" 2
// 15 "programs/97_nan_zero_subnormal.c" 1
	fmul d27, d31, d30
// 0 "" 2
// 15 "programs/97_nan_zero_subnormal.c" 1
	fdiv d26, d31, d30
// 0 "" 2
// 15 "programs/97_nan_zero_subnormal.c" 1
	fnmul d25, d31, d30
// 0 "" 2
	fmov	x6, d26
	fmov	x7, d25
	fmov	x5, d27
	fmov	x4, d28
	fmov	x3, d29
	mov	w1, w21
// 16 "programs/97_nan_zero_subnormal.c" 1
	fmax d24, d31, d30
// 0 "" 2
// 16 "programs/97_nan_zero_subnormal.c" 1
	fmin d23, d31, d30
// 0 "" 2
// 16 "programs/97_nan_zero_subnormal.c" 1
	fmaxnm d22, d31, d30
// 0 "" 2
	mov	x0, x23
	add	w19, w19, 1
// 16 "programs/97_nan_zero_subnormal.c" 1
	fminnm d31, d31, d30
// 0 "" 2
	stp	d24, d23, [sp]
	stp	d22, d31, [sp, 16]
	bl	printf
	cmp	w19, 10
	bne	.L3
	add	w21, w21, 1
	cmp	w21, 10
	bne	.L2
	adrp	x22, .LANCHOR1
	add	x22, x22, :lo12:.LANCHOR1
	adrp	x23, .LC2
	mov	x19, x22
	add	x23, x23, :lo12:.LC2
	mov	w21, 0
	.align 5
.L5:
	ldrb	w0, [x19]
	mov	w1, w21
	add	w21, w21, 1
	add	x19, x19, 3
	ldr	d31, [x20, w0, sxtw 3]
	ldrb	w0, [x19, -2]
	ldr	d30, [x20, w0, sxtw 3]
	ldrb	w0, [x19, -1]
	ldr	d29, [x20, w0, sxtw 3]
// 19 "programs/97_nan_zero_subnormal.c" 1
	fmadd d28, d31, d30, d29
// 0 "" 2
// 19 "programs/97_nan_zero_subnormal.c" 1
	fmsub d27, d31, d30, d29
// 0 "" 2
// 19 "programs/97_nan_zero_subnormal.c" 1
	fnmadd d26, d31, d30, d29
// 0 "" 2
	fmov	x3, d27
	fmov	x4, d26
// 19 "programs/97_nan_zero_subnormal.c" 1
	fnmsub d31, d31, d30, d29
// 0 "" 2
	fmov	x2, d28
	fmov	x5, d31
	mov	x0, x23
	bl	printf
	cmp	w21, 12
	bne	.L5
	movi	v29.4s, 0
	adrp	x21, .LC3
	add	x21, x21, :lo12:.LC3
	mov	w19, 0
	fmov	d15, 1.0e+0
	fneg	v29.2d, v29.2d
	.align 5
.L6:
	ldr	d31, [x20, w19, sxtw 3]
// 20 "programs/97_nan_zero_subnormal.c" 1
	fsqrt d28, d31
// 0 "" 2
	fmov	x2, d28
	mov	w1, w19
	mov	x0, x21
	add	w19, w19, 1
	fmov	d30, d31
	orr	v27.16b, v29.16b, v31.16b
	bif	v31.8b, v15.8b, v29.8b
	fmov	x5, d27
	fmov	x6, d31
	fabs	d31, d30
	fmov	x4, d31
	fneg	d31, d30
	fmov	x3, d31
	bl	printf
	movi	v29.4s, 0
	cmp	w19, 10
	fneg	v29.2d, v29.2d
	bne	.L6
	ldr	x0, [x20, 64]
	fmov	d31, x0
	ldr	x0, [x20, 32]
	fmov	d14, x0
	ldr	x0, [x20, 8]
	fmov	d13, x0
	mov	x0, -9223372036854775808
	fmov	d30, x0
	fneg	d15, d31
	fcmp	d31, d30
	ble	.L23
	fmov	d0, d15
	bl	sqrt
	fmov	d12, d0
	b	.L9
	.align 2
.L23:
	fsqrt	d31, d15
	fmov	d12, d31
.L9:
	fmov	d0, d14
	add	x1, sp, 160
	add	x0, sp, 168
	bl	sincos
	fmov	d0, d15
	ldp	x25, x24, [sp, 160]
	bl	log
	fmov	x19, d0
	fadd	d0, d15, d15
	bl	log10
	fmov	x21, d0
	fmov	d0, 8.0e+0
	mov	x0, 6148914691236517205
	movk	x0, 0x3fd5, lsl 48
	fmov	d1, x0
	fmul	d0, d15, d0
	bl	pow
	fmov	x1, d12
	fmov	x4, d0
	mov	x3, x21
	mov	x2, x19
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	adrp	x19, .LC5
	add	x19, x19, :lo12:.LC5
	bl	printf
	ldr	d1, [x20, 48]
	fmov	d0, 1.0e+0
	bl	fmod
	fmov	x21, d0
	fmov	d0, d14
	fmov	d1, 2.0e+0
	bl	fmod
	fmov	x23, d0
	fmov	d0, d14
	bl	tan
	fmov	x5, d0
	mov	x2, x23
	mov	x1, x21
	mov	x4, x25
	mov	x3, x24
	mov	x0, x19
	bl	printf
	ldr	d0, [x20, 48]
	bl	log
	fmov	x21, d0
	ldr	d0, [x20, 56]
	bl	log
	fmov	x2, d0
	ldr	x0, [x20, 56]
	fmov	d0, x0
	fcmp	d0, #0.0
	bpl	.L24
	str	x2, [sp, 152]
	bl	sqrt
	ldr	x2, [sp, 152]
	b	.L12
	.align 2
.L24:
	fsqrt	d0, d0
.L12:
	ldr	d31, [x20, 56]
	fmov	x3, d0
	mov	x1, x21
	mov	x0, x19
	adrp	x21, .LC6
	add	x20, sp, 272
	frintm	d31, d31
	add	x21, x21, :lo12:.LC6
	mov	w19, 0
	fmov	x5, d31
	fabs	d31, d13
	fmov	x4, d31
	bl	printf
	str	xzr, [sp, 192]
	mov	x0, -9223372036854775808
	fmov	d31, 1.0e+0
	str	x0, [sp, 200]
	mov	x0, 1
	str	d31, [sp, 208]
	fmov	d31, 5.0e+0
	str	d31, [sp, 216]
	str	x0, [sp, 224]
	mov	x0, 9214364837600034816
	str	x0, [sp, 232]
	ldr	d30, [sp, 192]
	ldr	d29, [sp, 200]
	ldr	d0, [sp, 200]
	ldr	d31, [sp, 200]
	ldr	d2, [sp, 200]
	fadd	d29, d30, d29
	ldr	d1, [sp, 192]
	ldr	d4, [sp, 192]
	fadd	d31, d0, d31
	ldr	d3, [sp, 200]
	ldr	d6, [sp, 208]
	fsub	d1, d2, d1
	ldr	d5, [sp, 208]
	ldr	d16, [sp, 200]
	fsub	d3, d4, d3
	ldr	d7, [sp, 216]
	ldr	d18, [sp, 216]
	fsub	d5, d6, d5
	ldr	d17, [sp, 192]
	ldr	d20, [sp, 200]
	fmul	d7, d16, d7
	ldr	d19, [sp, 216]
	ldr	d21, [sp, 192]
	fnmul	d17, d18, d17
	fneg	d20, d20
	ldr	d23, [sp, 208]
	ldr	d22, [sp, 200]
	fneg	d21, d21
	ldr	d25, [sp, 224]
	ldr	d24, [sp, 224]
	fdiv	d20, d20, d19
	stp	d29, d31, [sp, 272]
	stp	d1, d3, [sp, 288]
	fnmul	d24, d25, d24
	fdiv	d22, d23, d22
	stp	d5, d7, [sp, 304]
	str	d21, [sp, 336]
	stp	d17, d20, [sp, 320]
	ldr	d27, [sp, 224]
	ldr	d26, [sp, 232]
	ldr	d29, [sp, 200]
	fneg	d27, d27
	ldr	d28, [sp, 200]
	ldr	d31, [sp, 208]
	ldr	d30, [sp, 208]
	fsub	d28, d29, d28
	stp	d22, d24, [sp, 344]
	fdiv	d27, d27, d26
	fsub	d30, d31, d30
	fneg	d30, d30
	str	d30, [sp, 376]
	stp	d27, d28, [sp, 360]
	.align 5
.L13:
	ldr	d0, [x20], 8
	mov	w1, w19
	mov	x0, x21
	add	w19, w19, 1
	fmov	x2, d0
	bl	printf
	cmp	w19, 14
	bne	.L13
	ldr	d31, [sp, 208]
	mov	x0, 4503599627370496
	fmov	d30, x0
	mov	w1, 0
	fmul	d31, d31, d30
	fcmp	d31, #0.0
	beq	.L14
	fmov	d30, 5.0e-1
	.align 5
.L15:
	fmul	d31, d31, d30
	add	w1, w1, 1
	fcmp	d31, #0.0
	bne	.L15
.L14:
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	movi	d31, #0
	mov	x1, 2024
	mov	w0, 1000
	fmov	d29, x1
	.align 5
.L16:
	ldr	d30, [sp, 208]
	subs	w0, w0, #1
	fmadd	d31, d30, d29, d31
	bne	.L16
	ldr	d30, [sp, 208]
	mov	x0, 4503599627370496
	fmov	d29, x0
	str	d31, [sp, 384]
	ldr	d31, [sp, 224]
	fmov	d28, 2.5e+0
	fmul	d30, d30, d29
	fmov	d29, 5.0e-1
	mov	x0, 4607182418800017407
	fmul	d31, d31, d29
	fmov	d29, 1.5e+0
	str	d31, [sp, 392]
	ldr	d31, [sp, 224]
	fmul	d31, d31, d29
	fmov	d29, 7.5e-1
	str	d31, [sp, 400]
	ldr	d31, [sp, 224]
	fmul	d31, d31, d29
	str	d31, [sp, 408]
	ldr	d31, [sp, 224]
	fmul	d31, d31, d28
	fmov	d28, 3.0e+0
	str	d31, [sp, 416]
	fdiv	d31, d30, d28
	fmul	d31, d31, d28
	str	d31, [sp, 424]
	ldr	d31, [sp, 224]
	fsub	d31, d30, d31
	str	d31, [sp, 432]
	ldr	d31, [sp, 224]
	ldr	d28, [sp, 224]
	fsub	d31, d30, d31
	fadd	d31, d31, d28
	str	d31, [sp, 440]
	ldr	d31, [sp, 208]
	ldr	d28, [sp, 232]
	fdiv	d31, d31, d28
	fmov	d28, 2.5e-1
	fmul	d31, d31, d28
	str	d31, [sp, 448]
	ldr	d31, [x22, 40]
	str	d31, [sp, 456]
	fmov	d31, x0
	mov	x0, 9110782046170513408
	fmov	d28, x0
	fmul	d31, d30, d31
	mov	x0, 4940448791225434112
	str	d31, [sp, 464]
	ldr	d31, [sp, 224]
	ldr	d0, [sp, 224]
	fmul	d31, d31, d28
	fmov	d28, x0
	fcmp	d0, #0.0
	fmul	d31, d31, d28
	str	d31, [sp, 472]
	fmul	d31, d30, d29
	fdiv	d31, d31, d29
	str	d31, [sp, 480]
	bpl	.L25
	bl	sqrt
	b	.L19
	.align 2
.L25:
	fsqrt	d0, d0
.L19:
	adrp	x21, .LC9
	add	x20, sp, 384
	add	x21, x21, :lo12:.LC9
	mov	w19, 0
	str	d0, [sp, 488]
	.align 5
.L20:
	ldr	d0, [x20], 8
	mov	w1, w19
	mov	x0, x21
	add	w19, w19, 1
	fcmpe	d0, #0.0
	fmov	x2, d0
	cset	w3, gt
	bl	printf
	cmp	w19, 14
	bne	.L20
	movi	v31.2s, 0x80, lsl 16
	fmov	s23, 3.0e+0
	fmov	s17, 5.0e-1
	fmov	s19, 1.5e+0
	mov	w0, 2122317824
	fmov	s27, 2.5e-1
	fmov	s30, w0
	adrp	x21, .LC10
	str	s31, [sp, 184]
	movi	v31.2s, 0x1
	add	x0, sp, 264
	add	x20, sp, 240
	add	x21, x21, :lo12:.LC10
	mov	w19, 0
	str	s31, [sp, 188]
	ldr	s7, [sp, 184]
	ldr	s18, [sp, 188]
	ldr	s20, [sp, 188]
	ldr	s22, [sp, 184]
	fmul	s7, s7, s17
	ldr	s21, [sp, 188]
	fmul	s18, s18, s17
	ldr	s24, [sp, 184]
	fmul	s19, s20, s19
	ldr	s31, [sp, 188]
	ldr	s26, [sp, 184]
	fsub	s21, s22, s21
	fdiv	s24, s24, s23
	ldr	s25, [sp, 184]
	ldr	s28, [sp, 188]
	fmul	s31, s31, s30
	stp	s7, s18, [sp, 240]
	fmul	s25, s26, s25
	fnmul	s27, s28, s27
	stp	s19, s21, [sp, 248]
	stp	s25, s27, [x0]
	fmul	s24, s24, s23
	stp	s24, s31, [x0, -8]
	.align 5
.L21:
	ldr	s31, [x20], 4
	mov	w1, w19
	mov	x0, x21
	add	w19, w19, 1
	fcvt	d0, s31
	fmov	w2, s31
	bl	printf
	cmp	w19, 8
	bne	.L21
	ldr	x25, [sp, 96]
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	ldp	x23, x24, [sp, 80]
	ldp	d12, d13, [sp, 112]
	ldp	d14, d15, [sp, 128]
	add	sp, sp, 496
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

