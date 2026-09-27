	.text
	.align	2
d_of:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	str	x0, [sp, 24]
	ldr	d31, [sp, 24]
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.align	2
bits:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	str	d31, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
fbits:
	sub	sp, sp, #32
	str	s0, [sp, 12]
	ldr	s31, [sp, 12]
	str	s31, [sp, 24]
	ldr	w0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
add:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	str	d1, [sp]
	ldr	d31, [sp, 8]
	ldr	d30, [sp]
// 15 "programs/97_nan_zero_subnormal.c" 1
	fadd d31, d31, d30
// 0 "" 2
	str	d31, [sp, 24]
	ldr	d31, [sp, 24]
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.align	2
sub:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	str	d1, [sp]
	ldr	d31, [sp, 8]
	ldr	d30, [sp]
// 15 "programs/97_nan_zero_subnormal.c" 1
	fsub d31, d31, d30
// 0 "" 2
	str	d31, [sp, 24]
	ldr	d31, [sp, 24]
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.align	2
mul:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	str	d1, [sp]
	ldr	d31, [sp, 8]
	ldr	d30, [sp]
// 15 "programs/97_nan_zero_subnormal.c" 1
	fmul d31, d31, d30
// 0 "" 2
	str	d31, [sp, 24]
	ldr	d31, [sp, 24]
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.align	2
dvd:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	str	d1, [sp]
	ldr	d31, [sp, 8]
	ldr	d30, [sp]
// 15 "programs/97_nan_zero_subnormal.c" 1
	fdiv d31, d31, d30
// 0 "" 2
	str	d31, [sp, 24]
	ldr	d31, [sp, 24]
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.align	2
nmul:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	str	d1, [sp]
	ldr	d31, [sp, 8]
	ldr	d30, [sp]
// 15 "programs/97_nan_zero_subnormal.c" 1
	fnmul d31, d31, d30
// 0 "" 2
	str	d31, [sp, 24]
	ldr	d31, [sp, 24]
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.align	2
max:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	str	d1, [sp]
	ldr	d31, [sp, 8]
	ldr	d30, [sp]
// 16 "programs/97_nan_zero_subnormal.c" 1
	fmax d31, d31, d30
// 0 "" 2
	str	d31, [sp, 24]
	ldr	d31, [sp, 24]
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.align	2
min:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	str	d1, [sp]
	ldr	d31, [sp, 8]
	ldr	d30, [sp]
// 16 "programs/97_nan_zero_subnormal.c" 1
	fmin d31, d31, d30
// 0 "" 2
	str	d31, [sp, 24]
	ldr	d31, [sp, 24]
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.align	2
maxnm:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	str	d1, [sp]
	ldr	d31, [sp, 8]
	ldr	d30, [sp]
// 16 "programs/97_nan_zero_subnormal.c" 1
	fmaxnm d31, d31, d30
// 0 "" 2
	str	d31, [sp, 24]
	ldr	d31, [sp, 24]
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.align	2
minnm:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	str	d1, [sp]
	ldr	d31, [sp, 8]
	ldr	d30, [sp]
// 16 "programs/97_nan_zero_subnormal.c" 1
	fminnm d31, d31, d30
// 0 "" 2
	str	d31, [sp, 24]
	ldr	d31, [sp, 24]
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.align	2
madd:
	sub	sp, sp, #48
	str	d0, [sp, 24]
	str	d1, [sp, 16]
	str	d2, [sp, 8]
	ldr	d31, [sp, 24]
	ldr	d30, [sp, 16]
	ldr	d29, [sp, 8]
// 19 "programs/97_nan_zero_subnormal.c" 1
	fmadd d31, d31, d30, d29
// 0 "" 2
	str	d31, [sp, 40]
	ldr	d31, [sp, 40]
	fmov	d0, d31
	add	sp, sp, 48
	ret
	.align	2
msub:
	sub	sp, sp, #48
	str	d0, [sp, 24]
	str	d1, [sp, 16]
	str	d2, [sp, 8]
	ldr	d31, [sp, 24]
	ldr	d30, [sp, 16]
	ldr	d29, [sp, 8]
// 19 "programs/97_nan_zero_subnormal.c" 1
	fmsub d31, d31, d30, d29
// 0 "" 2
	str	d31, [sp, 40]
	ldr	d31, [sp, 40]
	fmov	d0, d31
	add	sp, sp, 48
	ret
	.align	2
nmadd:
	sub	sp, sp, #48
	str	d0, [sp, 24]
	str	d1, [sp, 16]
	str	d2, [sp, 8]
	ldr	d31, [sp, 24]
	ldr	d30, [sp, 16]
	ldr	d29, [sp, 8]
// 19 "programs/97_nan_zero_subnormal.c" 1
	fnmadd d31, d31, d30, d29
// 0 "" 2
	str	d31, [sp, 40]
	ldr	d31, [sp, 40]
	fmov	d0, d31
	add	sp, sp, 48
	ret
	.align	2
nmsub:
	sub	sp, sp, #48
	str	d0, [sp, 24]
	str	d1, [sp, 16]
	str	d2, [sp, 8]
	ldr	d31, [sp, 24]
	ldr	d30, [sp, 16]
	ldr	d29, [sp, 8]
// 19 "programs/97_nan_zero_subnormal.c" 1
	fnmsub d31, d31, d30, d29
// 0 "" 2
	str	d31, [sp, 40]
	ldr	d31, [sp, 40]
	fmov	d0, d31
	add	sp, sp, 48
	ret
	.align	2
root:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 20 "programs/97_nan_zero_subnormal.c" 1
	fsqrt d31, d31
// 0 "" 2
	str	d31, [sp, 24]
	ldr	d31, [sp, 24]
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.data
	.align	3
in:
	.xword	9221120237041090560
	.xword	-2251799813685247
	.xword	9218868437227405317
	.xword	-3377699720527872
	.xword	9218868437227405312
	.xword	-4503599627370496
	.xword	0
	.xword	-9223372036854775808
	.xword	4607182418800017408
	.xword	1
	.section .rodata
	.align	3
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
	.text
	.align	2
val:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	w0, [sp, 28]
	adrp	x0, in
	add	x0, x0, :lo12:in
	ldrsw	x1, [sp, 28]
	ldr	x0, [x0, x1, lsl 3]
	bl	d_of
	fmov	d31, d0
	fmov	d0, d31
	ldp	x29, x30, [sp], 32
	ret
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
	.global	main
main:
	sub	sp, sp, #576
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	stp	x19, x20, [sp, 48]
	stp	x21, x22, [sp, 64]
	stp	x23, x24, [sp, 80]
	stp	x25, x26, [sp, 96]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	puts
	str	wzr, [sp, 572]
	b	.L38
.L41:
	str	wzr, [sp, 568]
	b	.L39
.L40:
	ldr	w0, [sp, 572]
	bl	val
	str	d0, [sp, 440]
	ldr	w0, [sp, 568]
	bl	val
	str	d0, [sp, 432]
	ldr	d1, [sp, 432]
	ldr	d0, [sp, 440]
	bl	add
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x19, x0
	ldr	d1, [sp, 432]
	ldr	d0, [sp, 440]
	bl	sub
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x20, x0
	ldr	d1, [sp, 432]
	ldr	d0, [sp, 440]
	bl	mul
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x21, x0
	ldr	d1, [sp, 432]
	ldr	d0, [sp, 440]
	bl	dvd
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x22, x0
	ldr	d1, [sp, 432]
	ldr	d0, [sp, 440]
	bl	nmul
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x23, x0
	ldr	d1, [sp, 432]
	ldr	d0, [sp, 440]
	bl	max
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x24, x0
	ldr	d1, [sp, 432]
	ldr	d0, [sp, 440]
	bl	min
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x25, x0
	ldr	d1, [sp, 432]
	ldr	d0, [sp, 440]
	bl	maxnm
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x26, x0
	ldr	d1, [sp, 432]
	ldr	d0, [sp, 440]
	bl	minnm
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	str	x0, [sp, 24]
	str	x26, [sp, 16]
	str	x25, [sp, 8]
	str	x24, [sp]
	mov	x7, x23
	mov	x6, x22
	mov	x5, x21
	mov	x4, x20
	mov	x3, x19
	ldr	w2, [sp, 568]
	ldr	w1, [sp, 572]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 568]
	add	w0, w0, 1
	str	w0, [sp, 568]
.L39:
	ldr	w0, [sp, 568]
	cmp	w0, 9
	ble	.L40
	ldr	w0, [sp, 572]
	add	w0, w0, 1
	str	w0, [sp, 572]
.L38:
	ldr	w0, [sp, 572]
	cmp	w0, 9
	ble	.L41
	mov	w0, 12
	str	w0, [sp, 512]
	str	wzr, [sp, 564]
	b	.L42
.L43:
	adrp	x0, fma_cases
	add	x2, x0, :lo12:fma_cases
	ldrsw	x1, [sp, 564]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	add	x0, x2, x0
	ldrb	w0, [x0]
	bl	val
	str	d0, [sp, 464]
	adrp	x0, fma_cases
	add	x2, x0, :lo12:fma_cases
	ldrsw	x1, [sp, 564]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	add	x0, x2, x0
	ldrb	w0, [x0, 1]
	bl	val
	str	d0, [sp, 456]
	adrp	x0, fma_cases
	add	x2, x0, :lo12:fma_cases
	ldrsw	x1, [sp, 564]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	add	x0, x2, x0
	ldrb	w0, [x0, 2]
	bl	val
	str	d0, [sp, 448]
	ldr	d2, [sp, 448]
	ldr	d1, [sp, 456]
	ldr	d0, [sp, 464]
	bl	madd
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x19, x0
	ldr	d2, [sp, 448]
	ldr	d1, [sp, 456]
	ldr	d0, [sp, 464]
	bl	msub
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x20, x0
	ldr	d2, [sp, 448]
	ldr	d1, [sp, 456]
	ldr	d0, [sp, 464]
	bl	nmadd
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x21, x0
	ldr	d2, [sp, 448]
	ldr	d1, [sp, 456]
	ldr	d0, [sp, 464]
	bl	nmsub
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x5, x0
	mov	x4, x21
	mov	x3, x20
	mov	x2, x19
	ldr	w1, [sp, 564]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	w0, [sp, 564]
	add	w0, w0, 1
	str	w0, [sp, 564]
.L42:
	ldr	w1, [sp, 564]
	ldr	w0, [sp, 512]
	cmp	w1, w0
	blt	.L43
	str	wzr, [sp, 560]
	b	.L44
.L45:
	ldr	w0, [sp, 560]
	bl	val
	str	d0, [sp, 472]
	ldr	d0, [sp, 472]
	bl	root
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x19, x0
	ldr	d31, [sp, 472]
	fneg	d31, d31
	fmov	d0, d31
	bl	bits
	mov	x20, x0
	ldr	d31, [sp, 472]
	fabs	d31, d31
	fmov	d0, d31
	bl	bits
	mov	x21, x0
	ldr	d30, [sp, 472]
	movi	v31.4s, 0
	fneg	v31.2d, v31.2d
	orr	v31.16b, v30.16b, v31.16b
	fmov	d0, d31
	bl	bits
	mov	x22, x0
	fmov	d31, 1.0e+0
	ldr	d30, [sp, 472]
	movi	v29.4s, 0
	fneg	v29.2d, v29.2d
	bit	v31.8b, v30.8b, v29.8b
	fmov	d0, d31
	bl	bits
	mov	x6, x0
	mov	x5, x22
	mov	x4, x21
	mov	x3, x20
	mov	x2, x19
	ldr	w1, [sp, 560]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w0, [sp, 560]
	add	w0, w0, 1
	str	w0, [sp, 560]
.L44:
	ldr	w0, [sp, 560]
	cmp	w0, 9
	ble	.L45
	mov	w0, 8
	bl	val
	fmov	d31, d0
	fneg	d31, d31
	str	d31, [sp, 504]
	mov	w0, 4
	bl	val
	str	d0, [sp, 496]
	mov	w0, 1
	bl	val
	str	d0, [sp, 488]
	ldr	d0, [sp, 504]
	bl	sqrt
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x19, x0
	ldr	d0, [sp, 504]
	bl	log
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x20, x0
	ldr	d31, [sp, 504]
	fadd	d31, d31, d31
	fmov	d0, d31
	bl	log10
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x21, x0
	ldr	d30, [sp, 504]
	fmov	d31, 8.0e+0
	fmul	d31, d30, d31
	mov	x0, 6148914691236517205
	movk	x0, 0x3fd5, lsl 48
	fmov	d1, x0
	fmov	d0, d31
	bl	pow
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x4, x0
	mov	x3, x21
	mov	x2, x20
	mov	x1, x19
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, 6
	bl	val
	fmov	d31, d0
	fmov	d1, d31
	fmov	d0, 1.0e+0
	bl	fmod
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x19, x0
	fmov	d1, 2.0e+0
	ldr	d0, [sp, 496]
	bl	fmod
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x20, x0
	ldr	d0, [sp, 496]
	bl	sin
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x21, x0
	ldr	d31, [sp, 496]
	fneg	d31, d31
	fmov	d0, d31
	bl	cos
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x22, x0
	ldr	d0, [sp, 496]
	bl	tan
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x5, x0
	mov	x4, x22
	mov	x3, x21
	mov	x2, x20
	mov	x1, x19
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w0, 6
	bl	val
	fmov	d31, d0
	fmov	d0, d31
	bl	log
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x19, x0
	mov	w0, 7
	bl	val
	fmov	d31, d0
	fmov	d0, d31
	bl	log
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x20, x0
	mov	w0, 7
	bl	val
	fmov	d31, d0
	fmov	d0, d31
	bl	sqrt
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x21, x0
	ldr	d0, [sp, 488]
	bl	fabs
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x22, x0
	mov	w0, 7
	bl	val
	fmov	d31, d0
	fmov	d0, d31
	bl	floor
	fmov	d31, d0
	fmov	d0, d31
	bl	bits
	mov	x5, x0
	mov	x4, x22
	mov	x3, x21
	mov	x2, x20
	mov	x1, x19
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	str	xzr, [sp, 424]
	mov	x0, -9223372036854775808
	fmov	d31, x0
	str	d31, [sp, 416]
	fmov	d31, 1.0e+0
	str	d31, [sp, 408]
	fmov	d31, 5.0e+0
	str	d31, [sp, 400]
	mov	x0, 1
	fmov	d31, x0
	str	d31, [sp, 392]
	mov	x0, 9214364837600034816
	fmov	d31, x0
	str	d31, [sp, 384]
	ldr	d30, [sp, 424]
	ldr	d31, [sp, 416]
	fadd	d31, d30, d31
	str	d31, [sp, 272]
	ldr	d30, [sp, 416]
	ldr	d31, [sp, 416]
	fadd	d31, d30, d31
	str	d31, [sp, 280]
	ldr	d30, [sp, 416]
	ldr	d31, [sp, 424]
	fsub	d31, d30, d31
	str	d31, [sp, 288]
	ldr	d30, [sp, 424]
	ldr	d31, [sp, 416]
	fsub	d31, d30, d31
	str	d31, [sp, 296]
	ldr	d30, [sp, 408]
	ldr	d31, [sp, 408]
	fsub	d31, d30, d31
	str	d31, [sp, 304]
	ldr	d30, [sp, 416]
	ldr	d31, [sp, 400]
	fmul	d31, d30, d31
	str	d31, [sp, 312]
	ldr	d31, [sp, 400]
	fneg	d30, d31
	ldr	d31, [sp, 424]
	fmul	d31, d30, d31
	str	d31, [sp, 320]
	ldr	d31, [sp, 416]
	fneg	d30, d31
	ldr	d31, [sp, 400]
	fdiv	d31, d30, d31
	str	d31, [sp, 328]
	ldr	d31, [sp, 424]
	fneg	d31, d31
	str	d31, [sp, 336]
	ldr	d30, [sp, 408]
	ldr	d31, [sp, 416]
	fdiv	d31, d30, d31
	str	d31, [sp, 344]
	ldr	d31, [sp, 392]
	fneg	d30, d31
	ldr	d31, [sp, 392]
	fmul	d31, d30, d31
	str	d31, [sp, 352]
	ldr	d31, [sp, 392]
	fneg	d30, d31
	ldr	d31, [sp, 384]
	fdiv	d31, d30, d31
	str	d31, [sp, 360]
	ldr	d30, [sp, 416]
	ldr	d31, [sp, 416]
	fsub	d31, d30, d31
	str	d31, [sp, 368]
	ldr	d30, [sp, 408]
	ldr	d31, [sp, 408]
	fsub	d31, d30, d31
	fneg	d31, d31
	str	d31, [sp, 376]
	str	wzr, [sp, 556]
	b	.L46
.L47:
	ldrsw	x0, [sp, 556]
	lsl	x0, x0, 3
	add	x1, sp, 272
	ldr	d31, [x1, x0]
	fmov	d0, d31
	bl	bits
	mov	x2, x0
	ldrsw	x0, [sp, 556]
	lsl	x0, x0, 3
	add	x1, sp, 272
	ldr	d31, [x1, x0]
	fmov	d0, d31
	ldr	w1, [sp, 556]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	w0, [sp, 556]
	add	w0, w0, 1
	str	w0, [sp, 556]
.L46:
	ldr	w0, [sp, 556]
	cmp	w0, 13
	ble	.L47
	ldr	d31, [sp, 408]
	mov	x0, 4503599627370496
	fmov	d30, x0
	fmul	d31, d31, d30
	str	d31, [sp, 544]
	str	wzr, [sp, 540]
	b	.L48
.L49:
	ldr	d30, [sp, 544]
	fmov	d31, 5.0e-1
	fmul	d31, d30, d31
	str	d31, [sp, 544]
	ldr	w0, [sp, 540]
	add	w0, w0, 1
	str	w0, [sp, 540]
.L48:
	ldr	d31, [sp, 544]
	fcmp	d31, #0.0
	bne	.L49
	ldr	w1, [sp, 540]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	str	xzr, [sp, 528]
	str	wzr, [sp, 524]
	b	.L50
.L51:
	ldr	d31, [sp, 408]
	mov	x0, 2024
	fmov	d30, x0
	fmul	d31, d31, d30
	ldr	d30, [sp, 528]
	fadd	d31, d30, d31
	str	d31, [sp, 528]
	ldr	w0, [sp, 524]
	add	w0, w0, 1
	str	w0, [sp, 524]
.L50:
	ldr	w0, [sp, 524]
	cmp	w0, 999
	ble	.L51
	ldr	d31, [sp, 408]
	mov	x0, 4503599627370496
	fmov	d30, x0
	fmul	d31, d31, d30
	str	d31, [sp, 480]
	ldr	d31, [sp, 528]
	str	d31, [sp, 160]
	ldr	d30, [sp, 392]
	fmov	d31, 5.0e-1
	fmul	d31, d30, d31
	str	d31, [sp, 168]
	ldr	d30, [sp, 392]
	fmov	d31, 1.5e+0
	fmul	d31, d30, d31
	str	d31, [sp, 176]
	ldr	d30, [sp, 392]
	fmov	d31, 7.5e-1
	fmul	d31, d30, d31
	str	d31, [sp, 184]
	ldr	d30, [sp, 392]
	fmov	d31, 2.5e+0
	fmul	d31, d30, d31
	str	d31, [sp, 192]
	fmov	d31, 3.0e+0
	ldr	d30, [sp, 480]
	fdiv	d30, d30, d31
	fmov	d31, 3.0e+0
	fmul	d31, d30, d31
	str	d31, [sp, 200]
	ldr	d31, [sp, 392]
	ldr	d30, [sp, 480]
	fsub	d31, d30, d31
	str	d31, [sp, 208]
	ldr	d31, [sp, 392]
	ldr	d30, [sp, 480]
	fsub	d30, d30, d31
	ldr	d31, [sp, 392]
	fadd	d31, d30, d31
	str	d31, [sp, 216]
	ldr	d30, [sp, 408]
	ldr	d31, [sp, 384]
	fdiv	d30, d30, d31
	fmov	d31, 4.0e+0
	fdiv	d31, d30, d31
	str	d31, [sp, 224]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	ldr	d31, [x0]
	str	d31, [sp, 232]
	ldr	d31, [sp, 480]
	mov	x0, 4607182418800017407
	fmov	d30, x0
	fmul	d31, d31, d30
	str	d31, [sp, 240]
	ldr	d31, [sp, 392]
	mov	x0, 9110782046170513408
	fmov	d30, x0
	fmul	d31, d31, d30
	mov	x0, 4940448791225434112
	fmov	d30, x0
	fmul	d31, d31, d30
	str	d31, [sp, 248]
	ldr	d30, [sp, 480]
	fmov	d31, 7.5e-1
	fmul	d30, d30, d31
	fmov	d31, 7.5e-1
	fdiv	d31, d30, d31
	str	d31, [sp, 256]
	ldr	d31, [sp, 392]
	fmov	d0, d31
	bl	sqrt
	fmov	d31, d0
	str	d31, [sp, 264]
	str	wzr, [sp, 520]
	b	.L52
.L53:
	ldrsw	x0, [sp, 520]
	lsl	x0, x0, 3
	add	x1, sp, 160
	ldr	d31, [x1, x0]
	fmov	d0, d31
	bl	bits
	mov	x2, x0
	ldrsw	x0, [sp, 520]
	lsl	x0, x0, 3
	add	x1, sp, 160
	ldr	d30, [x1, x0]
	ldrsw	x0, [sp, 520]
	lsl	x0, x0, 3
	add	x1, sp, 160
	ldr	d31, [x1, x0]
	fcmpe	d31, #0.0
	cset	w0, gt
	and	w0, w0, 255
	mov	w3, w0
	fmov	d0, d30
	ldr	w1, [sp, 520]
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	ldr	w0, [sp, 520]
	add	w0, w0, 1
	str	w0, [sp, 520]
.L52:
	ldr	w0, [sp, 520]
	cmp	w0, 13
	ble	.L53
	movi	v31.2s, 0x80, lsl 16
	str	s31, [sp, 156]
	movi	v31.2s, 0x1
	str	s31, [sp, 152]
	ldr	s30, [sp, 156]
	fmov	s31, 5.0e-1
	fmul	s31, s30, s31
	str	s31, [sp, 120]
	ldr	s30, [sp, 152]
	fmov	s31, 5.0e-1
	fmul	s31, s30, s31
	str	s31, [sp, 124]
	ldr	s30, [sp, 152]
	fmov	s31, 1.5e+0
	fmul	s31, s30, s31
	str	s31, [sp, 128]
	ldr	s30, [sp, 156]
	ldr	s31, [sp, 152]
	fsub	s31, s30, s31
	str	s31, [sp, 132]
	ldr	s30, [sp, 156]
	fmov	s31, 3.0e+0
	fdiv	s30, s30, s31
	fmov	s31, 3.0e+0
	fmul	s31, s30, s31
	str	s31, [sp, 136]
	ldr	s31, [sp, 152]
	mov	w0, 2122317824
	fmov	s30, w0
	fmul	s31, s31, s30
	str	s31, [sp, 140]
	ldr	s30, [sp, 156]
	ldr	s31, [sp, 156]
	fmul	s31, s30, s31
	str	s31, [sp, 144]
	ldr	s31, [sp, 152]
	fneg	s30, s31
	fmov	s31, 2.5e-1
	fmul	s31, s30, s31
	str	s31, [sp, 148]
	str	wzr, [sp, 516]
	b	.L54
.L55:
	ldrsw	x0, [sp, 516]
	lsl	x0, x0, 2
	add	x1, sp, 120
	ldr	s31, [x1, x0]
	fmov	s0, s31
	bl	fbits
	mov	w2, w0
	ldrsw	x0, [sp, 516]
	lsl	x0, x0, 2
	add	x1, sp, 120
	ldr	s31, [x1, x0]
	fcvt	d31, s31
	fmov	d0, d31
	ldr	w1, [sp, 516]
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldr	w0, [sp, 516]
	add	w0, w0, 1
	str	w0, [sp, 516]
.L54:
	ldr	w0, [sp, 516]
	cmp	w0, 7
	ble	.L55
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	ldp	x23, x24, [sp, 80]
	ldp	x25, x26, [sp, 96]
	add	sp, sp, 576
	ret
	.section .rodata
	.align	3
.LC8:
	.word	-1023872186
	.word	27618847

