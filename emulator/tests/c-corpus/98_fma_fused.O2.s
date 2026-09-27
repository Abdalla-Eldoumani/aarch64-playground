	.text
	.align	2
	.align 5
dbits:
	fmov	x0, d0
	ret
	.align	2
	.align 5
fbits:
	fmov	w0, s0
	ret
	.align	2
	.align 5
unfused:
	fmul	d0, d0, d1
	sub	sp, sp, #16
	str	d0, [sp, 8]
	ldr	d0, [sp, 8]
	add	sp, sp, 16
	fadd	d0, d0, d2
	ret
	.align	2
	.align 5
unfusedf:
	fmul	s0, s0, s1
	sub	sp, sp, #16
	str	s0, [sp, 12]
	ldr	s0, [sp, 12]
	add	sp, sp, 16
	fadd	s0, s0, s2
	ret
	.align	2
	.align 5
dot:
	adrp	x1, .LANCHOR0
	movi	d0, #0
	add	x1, x1, :lo12:.LANCHOR0
	mov	x0, 0
	add	x2, x1, 64
	.align 5
.L9:
	ldr	d31, [x1, x0]
	ldr	d30, [x0, x2]
	add	x0, x0, 8
	fmadd	d0, d31, d30, d0
	cmp	x0, 64
	bne	.L9
	ret
	.align	2
	.align 5
fms_:
	fmsub	d0, d0, d1, d2
	ret
	.align	2
	.align 5
fnma_:
	fnmadd	d0, d0, d1, d2
	ret
	.align	2
	.align 5
fnms_:
	fnmsub	d0, d0, d1, d2
	ret
	.align	2
	.align 5
fma_:
	fmadd	d0, d0, d1, d2
	ret
	.align	2
	.align 5
fma_lanes:
	adrp	x0, .LANCHOR0
	add	x0, x0, :lo12:.LANCHOR0
	ldp	q26, q29, [x0, 128]
	ldp	q28, q30, [x0, 160]
	ldp	q27, q31, [x0, 192]
	fmla	v26.2d, v28.2d, v27.2d
	fmla	v29.2d, v31.2d, v30.2d
	stp	q26, q29, [x0, 128]
	ret
	.align	2
	.align 5
fnmaf_:
	fnmadd	s0, s0, s1, s2
	ret
	.align	2
	.align 5
fmaf_:
	fmadd	s0, s0, s1, s2
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"d%02d %016lx %016lx %016lx %016lx un %016lx %.17g\n"
	.align	3
.LC1:
	.string	"f%02d %08x %08x un %08x %.9g\n"
	.align	3
.LC2:
	.string	"e%02d %016lx %016lx %.17g\n"
	.align	3
.LC3:
	.string	"h%+d %016lx %08x %.17g\n"
	.align	3
.LC4:
	.string	"dot %016lx %.17g\n"
	.align	3
.LC5:
	.string	"lane%d %016lx\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -96]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x19, .LANCHOR1
	add	x19, x19, :lo12:.LANCHOR1
	stp	x21, x22, [sp, 32]
	adrp	x21, .LC0
	add	x21, x21, :lo12:.LC0
	mov	w20, 0
	str	x23, [sp, 48]
	stp	d14, d15, [sp, 64]
	.align 5
.L19:
	sbfiz	x0, x20, 1, 32
	add	x0, x0, w20, sxtw
	add	x1, x19, x0, lsl 3
	ldr	d31, [x19, x0, lsl 3]
	ldr	d1, [x1, 8]
	fmov	d0, d31
	ldr	d2, [x1, 16]
	mov	w1, w20
	add	w20, w20, 1
	bl	fma_
	fmov	d30, d0
	bl	dbits
	fmov	d0, d31
	mov	x2, x0
	bl	fms_
	bl	dbits
	fmov	d0, d31
	mov	x3, x0
	bl	fnma_
	bl	dbits
	fmov	d0, d31
	mov	x4, x0
	bl	fnms_
	bl	dbits
	fmov	d0, d31
	mov	x5, x0
	bl	unfused
	bl	dbits
	fmov	d0, d30
	mov	x6, x0
	mov	x0, x21
	bl	printf
	cmp	w20, 14
	bne	.L19
	adrp	x22, .LC1
	add	x21, x19, 336
	add	x22, x22, :lo12:.LC1
	mov	w20, 0
	.align 5
.L20:
	sbfiz	x0, x20, 1, 32
	add	x0, x0, w20, sxtw
	add	x1, x21, x0, lsl 2
	ldr	s31, [x21, x0, lsl 2]
	ldr	s1, [x1, 4]
	fmov	s0, s31
	ldr	s2, [x1, 8]
	mov	w1, w20
	add	w20, w20, 1
	bl	fmaf_
	fmov	s30, s0
	bl	fbits
	fmov	s0, s31
	mov	w2, w0
	bl	fnmaf_
	bl	fbits
	fmov	s0, s31
	mov	w3, w0
	bl	unfusedf
	bl	fbits
	fcvt	d0, s30
	mov	w4, w0
	mov	x0, x22
	bl	printf
	cmp	w20, 7
	bne	.L20
	mov	x0, 7378697629483820646
	adrp	x21, .LC2
	movk	x0, 0x3fe6, lsl 48
	add	x21, x21, :lo12:.LC2
	fmov	d14, x0
	mov	x0, 3689348814741910323
	movk	x0, 0x3fd3, lsl 48
	mov	w20, 0
	fmov	d15, x0
	.align 5
.L21:
	sbfiz	x0, x20, 1, 32
	add	x0, x0, w20, sxtw
	add	x1, x19, x0, lsl 3
	ldr	d0, [x19, x0, lsl 3]
	ldr	d1, [x1, 8]
	mov	w1, w20
	fmul	d0, d0, d14
	add	w20, w20, 1
	fadd	d1, d1, d15
	fmul	d31, d0, d1
	str	d31, [sp, 88]
	ldr	d2, [sp, 88]
	fneg	d2, d2
	bl	fma_
	fmov	d31, d0
	ldr	d0, [sp, 88]
	bl	dbits
	fmov	d0, d31
	mov	x2, x0
	bl	dbits
	mov	x3, x0
	mov	x0, x21
	bl	printf
	cmp	w20, 14
	bne	.L21
	adrp	x22, .LANCHOR2
	add	x22, x22, :lo12:.LANCHOR2
	adrp	x23, .LC3
	add	x20, x22, 64
	add	x23, x23, :lo12:.LC3
	mov	w21, -3
	fmov	d15, 2.5e+0
	.align 5
.L23:
	scvtf	d29, w21
	ldr	d31, [x19]
	movi	v30.2s, #0
	mov	x0, x22
	fmul	d29, d29, d31
	movi	d31, #0
	fmul	d29, d29, d15
	fcvt	s28, d29
	.align 5
.L22:
	fmov	d1, d29
	fmov	d0, d31
	ldr	d2, [x0], 8
	bl	fma_
	fcvt	s2, d2
	fmov	d31, d0
	fmov	s1, s28
	fmov	s0, s30
	bl	fmaf_
	fmov	s30, s0
	cmp	x0, x20
	bne	.L22
	fmov	d0, d31
	mov	w1, w21
	add	w21, w21, 1
	bl	dbits
	fmov	s0, s30
	mov	x2, x0
	bl	fbits
	fmov	d0, d31
	mov	w3, w0
	mov	x0, x23
	bl	printf
	cmp	w21, 4
	bne	.L23
	adrp	x20, .LANCHOR0
	add	x20, x20, :lo12:.LANCHOR0
	mov	x1, 6148914691236517205
	add	x3, x20, 64
	movk	x1, 0x3fd5, lsl 48
	mov	x0, 1
	fmov	d29, x1
	.align 5
.L24:
	scvtf	d30, w0
	ldr	d31, [x19]
	add	x1, x20, x0, lsl 3
	add	w2, w0, 6
	fmadd	d31, d31, d30, d29
	scvtf	d30, w2
	str	d31, [x1, -8]
	add	x1, x3, x0, lsl 3
	ldr	d31, [x19, 24]
	add	x0, x0, 1
	fdiv	d31, d31, d30
	str	d31, [x1, -8]
	cmp	x0, 9
	bne	.L24
	bl	dot
	bl	dbits
	mov	x1, x0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	add	x5, x20, 192
	add	x4, x20, 160
	add	x3, x20, 128
	mov	x0, 0
.L25:
	sbfiz	x1, x0, 1, 32
	add	x1, x1, w0, sxtw
	add	x2, x19, x1, lsl 3
	ldr	d31, [x19, x1, lsl 3]
	str	d31, [x5, x0, lsl 3]
	ldr	d31, [x2, 8]
	str	d31, [x4, x0, lsl 3]
	ldr	d31, [x2, 16]
	str	d31, [x3, x0, lsl 3]
	add	x0, x0, 1
	cmp	x0, 4
	bne	.L25
	adrp	x21, .LC5
	add	x20, x20, 128
	add	x21, x21, :lo12:.LC5
	mov	x19, 0
	bl	fma_lanes
.L26:
	ldr	d0, [x20, x19, lsl 3]
	mov	w1, w19
	add	x19, x19, 1
	bl	dbits
	mov	x2, x0
	mov	x0, x21
	bl	printf
	cmp	x19, 4
	bne	.L26
	ldr	x23, [sp, 48]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	d14, d15, [sp, 64]
	ldp	x29, x30, [sp], 96
	ret
	.section .rodata
	.align	4
	.LANCHOR2:
coef__0:
	.word	436314138
	.word	1059717536
	.word	381774871
	.word	1062650220
	.word	286331153
	.word	1065423121
	.word	1431655765
	.word	1067799893
	.word	1431655765
	.word	1069897045
	.word	0
	.word	1071644672
	.word	0
	.word	1072693248
	.word	0
	.word	1072693248
	.data
	.align	4
	.LANCHOR1:
dv:
	.word	-1717986918
	.word	1069128089
	.word	0
	.word	1076101120
	.word	0
	.word	-1074790400
	.word	4194304
	.word	1072693248
	.word	4194304
	.word	1072693248
	.word	8388608
	.word	-1074790400
	.word	-1
	.word	2146435071
	.word	0
	.word	1073741824
	.word	-1
	.word	-1048577
	.word	357496748
	.word	-1771536750
	.word	357496748
	.word	375946898
	.word	0
	.word	0
	.word	357496748
	.word	375946898
	.word	357496748
	.word	375946898
	.word	0
	.word	-2147483648
	.word	0
	.word	-2147483648
	.word	0
	.word	1075052544
	.word	0
	.word	-2147483648
	.word	0
	.word	-2147483648
	.word	0
	.word	1075052544
	.word	0
	.word	0
	.word	0
	.word	1073741824
	.word	0
	.word	1074266112
	.word	0
	.word	-1072168960
	.word	0
	.word	-1073741824
	.word	0
	.word	1074266112
	.word	0
	.word	1075314688
	.word	0
	.word	1048576
	.word	0
	.word	1071644672
	.word	0
	.word	0
	.word	1
	.word	0
	.word	0
	.word	1071644672
	.word	1
	.word	0
	.word	0
	.word	1074266112
	.word	1431655765
	.word	1070945621
	.word	0
	.word	-1074790400
	.word	-2048145248
	.word	2145504499
	.word	0
	.word	1076101120
	.word	-2048145248
	.word	-1979149
	.word	1
	.word	1072693248
	.word	-1
	.word	1072693247
	.word	0
	.word	-1074790400
fv:
	.word	1065355264
	.word	1065355264
	.word	562036736
	.word	1077936128
	.word	1051372203
	.word	-1082130432
	.word	2139095039
	.word	1073741824
	.word	-8388609
	.word	1
	.word	1056964608
	.word	1
	.word	-1918746016
	.word	228737632
	.word	0
	.word	1066192077
	.word	1066192077
	.word	-1080368824
	.word	1266679807
	.word	1266679807
	.word	-679477250
	.bss
	.align	4
	.LANCHOR0:
xs:
	.zero	64
ys:
	.zero	64
lc:
	.zero	32
lb:
	.zero	32
la:
	.zero	32

