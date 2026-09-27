	.text
	.align	2
dbits:
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
fma_:
	sub	sp, sp, #32
	str	d0, [sp, 24]
	str	d1, [sp, 16]
	str	d2, [sp, 8]
	ldr	d29, [sp, 24]
	ldr	d30, [sp, 16]
	ldr	d31, [sp, 8]
	fmadd	d31, d29, d30, d31
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.align	2
fms_:
	sub	sp, sp, #32
	str	d0, [sp, 24]
	str	d1, [sp, 16]
	str	d2, [sp, 8]
	ldr	d31, [sp, 24]
	fneg	d30, d31
	ldr	d29, [sp, 16]
	ldr	d31, [sp, 8]
	fmadd	d31, d29, d30, d31
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.align	2
fnma_:
	sub	sp, sp, #32
	str	d0, [sp, 24]
	str	d1, [sp, 16]
	str	d2, [sp, 8]
	ldr	d31, [sp, 24]
	fneg	d30, d31
	ldr	d31, [sp, 8]
	fneg	d31, d31
	ldr	d29, [sp, 16]
	fmadd	d31, d29, d30, d31
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.align	2
fnms_:
	sub	sp, sp, #32
	str	d0, [sp, 24]
	str	d1, [sp, 16]
	str	d2, [sp, 8]
	ldr	d31, [sp, 8]
	fneg	d31, d31
	ldr	d29, [sp, 24]
	ldr	d30, [sp, 16]
	fmadd	d31, d29, d30, d31
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.align	2
fmaf_:
	sub	sp, sp, #16
	str	s0, [sp, 12]
	str	s1, [sp, 8]
	str	s2, [sp, 4]
	ldr	s29, [sp, 12]
	ldr	s30, [sp, 8]
	ldr	s31, [sp, 4]
	fmadd	s31, s29, s30, s31
	fmov	s0, s31
	add	sp, sp, 16
	ret
	.align	2
fnmaf_:
	sub	sp, sp, #16
	str	s0, [sp, 12]
	str	s1, [sp, 8]
	str	s2, [sp, 4]
	ldr	s31, [sp, 12]
	fneg	s30, s31
	ldr	s31, [sp, 4]
	fneg	s31, s31
	ldr	s29, [sp, 8]
	fmadd	s31, s29, s30, s31
	fmov	s0, s31
	add	sp, sp, 16
	ret
	.align	2
unfused:
	sub	sp, sp, #48
	str	d0, [sp, 24]
	str	d1, [sp, 16]
	str	d2, [sp, 8]
	ldr	d30, [sp, 24]
	ldr	d31, [sp, 16]
	fmul	d31, d30, d31
	str	d31, [sp, 40]
	ldr	d30, [sp, 40]
	ldr	d31, [sp, 8]
	fadd	d31, d30, d31
	fmov	d0, d31
	add	sp, sp, 48
	ret
	.align	2
unfusedf:
	sub	sp, sp, #32
	str	s0, [sp, 12]
	str	s1, [sp, 8]
	str	s2, [sp, 4]
	ldr	s30, [sp, 12]
	ldr	s31, [sp, 8]
	fmul	s31, s30, s31
	str	s31, [sp, 28]
	ldr	s30, [sp, 28]
	ldr	s31, [sp, 4]
	fadd	s31, s30, s31
	fmov	s0, s31
	add	sp, sp, 32
	ret
	.data
	.align	3
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
	.align	3
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
	.text
	.align	2
dot:
	sub	sp, sp, #16
	str	xzr, [sp, 8]
	str	wzr, [sp, 4]
	b	.L22
.L23:
	adrp	x0, xs
	add	x0, x0, :lo12:xs
	ldrsw	x1, [sp, 4]
	ldr	d30, [x0, x1, lsl 3]
	adrp	x0, ys
	add	x0, x0, :lo12:ys
	ldrsw	x1, [sp, 4]
	ldr	d31, [x0, x1, lsl 3]
	fmul	d31, d30, d31
	ldr	d30, [sp, 8]
	fadd	d31, d30, d31
	str	d31, [sp, 8]
	ldr	w0, [sp, 4]
	add	w0, w0, 1
	str	w0, [sp, 4]
.L22:
	ldr	w0, [sp, 4]
	cmp	w0, 7
	ble	.L23
	ldr	d31, [sp, 8]
	fmov	d0, d31
	add	sp, sp, 16
	ret
	.align	2
fma_lanes:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	b	.L26
.L27:
	adrp	x0, la
	add	x0, x0, :lo12:la
	ldrsw	x1, [sp, 12]
	ldr	d29, [x0, x1, lsl 3]
	adrp	x0, lb
	add	x0, x0, :lo12:lb
	ldrsw	x1, [sp, 12]
	ldr	d30, [x0, x1, lsl 3]
	adrp	x0, lc
	add	x0, x0, :lo12:lc
	ldrsw	x1, [sp, 12]
	ldr	d31, [x0, x1, lsl 3]
	fmadd	d31, d29, d30, d31
	adrp	x0, lc
	add	x0, x0, :lo12:lc
	ldrsw	x1, [sp, 12]
	str	d31, [x0, x1, lsl 3]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 12]
.L26:
	ldr	w0, [sp, 12]
	cmp	w0, 3
	ble	.L27
	nop
	nop
	add	sp, sp, 16
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
	.global	main
main:
	stp	x29, x30, [sp, -192]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	mov	w0, 14
	str	w0, [sp, 144]
	str	wzr, [sp, 188]
	b	.L29
.L30:
	adrp	x0, dv
	add	x2, x0, :lo12:dv
	ldrsw	x1, [sp, 188]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	d31, [x0]
	str	d31, [sp, 88]
	adrp	x0, dv
	add	x2, x0, :lo12:dv
	ldrsw	x1, [sp, 188]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	d31, [x0, 8]
	str	d31, [sp, 80]
	adrp	x0, dv
	add	x2, x0, :lo12:dv
	ldrsw	x1, [sp, 188]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	d31, [x0, 16]
	str	d31, [sp, 72]
	ldr	d2, [sp, 72]
	ldr	d1, [sp, 80]
	ldr	d0, [sp, 88]
	bl	fma_
	str	d0, [sp, 64]
	ldr	d0, [sp, 64]
	bl	dbits
	mov	x19, x0
	ldr	d2, [sp, 72]
	ldr	d1, [sp, 80]
	ldr	d0, [sp, 88]
	bl	fms_
	fmov	d31, d0
	fmov	d0, d31
	bl	dbits
	mov	x20, x0
	ldr	d2, [sp, 72]
	ldr	d1, [sp, 80]
	ldr	d0, [sp, 88]
	bl	fnma_
	fmov	d31, d0
	fmov	d0, d31
	bl	dbits
	mov	x21, x0
	ldr	d2, [sp, 72]
	ldr	d1, [sp, 80]
	ldr	d0, [sp, 88]
	bl	fnms_
	fmov	d31, d0
	fmov	d0, d31
	bl	dbits
	mov	x22, x0
	ldr	d2, [sp, 72]
	ldr	d1, [sp, 80]
	ldr	d0, [sp, 88]
	bl	unfused
	fmov	d31, d0
	fmov	d0, d31
	bl	dbits
	ldr	d0, [sp, 64]
	mov	x6, x0
	mov	x5, x22
	mov	x4, x21
	mov	x3, x20
	mov	x2, x19
	ldr	w1, [sp, 188]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w0, [sp, 188]
	add	w0, w0, 1
	str	w0, [sp, 188]
.L29:
	ldr	w1, [sp, 188]
	ldr	w0, [sp, 144]
	cmp	w1, w0
	blt	.L30
	mov	w0, 7
	str	w0, [sp, 144]
	str	wzr, [sp, 184]
	b	.L31
.L32:
	adrp	x0, fv
	add	x2, x0, :lo12:fv
	ldrsw	x1, [sp, 184]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x0, x2, x0
	ldr	s31, [x0]
	str	s31, [sp, 108]
	adrp	x0, fv
	add	x2, x0, :lo12:fv
	ldrsw	x1, [sp, 184]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x0, x2, x0
	ldr	s31, [x0, 4]
	str	s31, [sp, 104]
	adrp	x0, fv
	add	x2, x0, :lo12:fv
	ldrsw	x1, [sp, 184]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x0, x2, x0
	ldr	s31, [x0, 8]
	str	s31, [sp, 100]
	ldr	s2, [sp, 100]
	ldr	s1, [sp, 104]
	ldr	s0, [sp, 108]
	bl	fmaf_
	str	s0, [sp, 96]
	ldr	s0, [sp, 96]
	bl	fbits
	mov	w19, w0
	ldr	s2, [sp, 100]
	ldr	s1, [sp, 104]
	ldr	s0, [sp, 108]
	bl	fnmaf_
	fmov	s31, s0
	fmov	s0, s31
	bl	fbits
	mov	w20, w0
	ldr	s2, [sp, 100]
	ldr	s1, [sp, 104]
	ldr	s0, [sp, 108]
	bl	unfusedf
	fmov	s31, s0
	fmov	s0, s31
	bl	fbits
	ldr	s31, [sp, 96]
	fcvt	d31, s31
	fmov	d0, d31
	mov	w4, w0
	mov	w3, w20
	mov	w2, w19
	ldr	w1, [sp, 184]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 184]
	add	w0, w0, 1
	str	w0, [sp, 184]
.L31:
	ldr	w1, [sp, 184]
	ldr	w0, [sp, 144]
	cmp	w1, w0
	blt	.L32
	mov	w0, 14
	str	w0, [sp, 144]
	str	wzr, [sp, 180]
	b	.L33
.L34:
	adrp	x0, dv
	add	x2, x0, :lo12:dv
	ldrsw	x1, [sp, 180]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	d31, [x0]
	mov	x0, 7378697629483820646
	movk	x0, 0x3fe6, lsl 48
	fmov	d30, x0
	fmul	d31, d31, d30
	str	d31, [sp, 128]
	adrp	x0, dv
	add	x2, x0, :lo12:dv
	ldrsw	x1, [sp, 180]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	d31, [x0, 8]
	mov	x0, 3689348814741910323
	movk	x0, 0x3fd3, lsl 48
	fmov	d30, x0
	fadd	d31, d31, d30
	str	d31, [sp, 120]
	ldr	d30, [sp, 128]
	ldr	d31, [sp, 120]
	fmul	d31, d30, d31
	str	d31, [sp, 56]
	ldr	d31, [sp, 56]
	fneg	d31, d31
	fmov	d2, d31
	ldr	d1, [sp, 120]
	ldr	d0, [sp, 128]
	bl	fma_
	str	d0, [sp, 112]
	ldr	d31, [sp, 56]
	fmov	d0, d31
	bl	dbits
	mov	x19, x0
	ldr	d0, [sp, 112]
	bl	dbits
	ldr	d0, [sp, 112]
	mov	x3, x0
	mov	x2, x19
	ldr	w1, [sp, 180]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	w0, [sp, 180]
	add	w0, w0, 1
	str	w0, [sp, 180]
.L33:
	ldr	w1, [sp, 180]
	ldr	w0, [sp, 144]
	cmp	w1, w0
	blt	.L34
	mov	w0, -3
	str	w0, [sp, 176]
	b	.L35
.L38:
	ldr	w0, [sp, 176]
	scvtf	d30, w0
	adrp	x0, dv
	add	x0, x0, :lo12:dv
	ldr	d31, [x0]
	fmul	d30, d30, d31
	fmov	d31, 2.5e+0
	fmul	d31, d30, d31
	str	d31, [sp, 136]
	str	xzr, [sp, 168]
	str	wzr, [sp, 164]
	str	wzr, [sp, 160]
	b	.L36
.L37:
	adrp	x0, coef.0
	add	x0, x0, :lo12:coef.0
	ldrsw	x1, [sp, 160]
	ldr	d31, [x0, x1, lsl 3]
	fmov	d2, d31
	ldr	d1, [sp, 136]
	ldr	d0, [sp, 168]
	bl	fma_
	str	d0, [sp, 168]
	ldr	d31, [sp, 136]
	fcvt	s30, d31
	adrp	x0, coef.0
	add	x0, x0, :lo12:coef.0
	ldrsw	x1, [sp, 160]
	ldr	d31, [x0, x1, lsl 3]
	fcvt	s31, d31
	fmov	s2, s31
	fmov	s1, s30
	ldr	s0, [sp, 164]
	bl	fmaf_
	str	s0, [sp, 164]
	ldr	w0, [sp, 160]
	add	w0, w0, 1
	str	w0, [sp, 160]
.L36:
	ldr	w0, [sp, 160]
	cmp	w0, 7
	ble	.L37
	ldr	d0, [sp, 168]
	bl	dbits
	mov	x19, x0
	ldr	s0, [sp, 164]
	bl	fbits
	ldr	d0, [sp, 168]
	mov	w3, w0
	mov	x2, x19
	ldr	w1, [sp, 176]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w0, [sp, 176]
	add	w0, w0, 1
	str	w0, [sp, 176]
.L35:
	ldr	w0, [sp, 176]
	cmp	w0, 3
	ble	.L38
	str	wzr, [sp, 156]
	b	.L39
.L40:
	adrp	x0, dv
	add	x0, x0, :lo12:dv
	ldr	d30, [x0]
	ldr	w0, [sp, 156]
	add	w0, w0, 1
	scvtf	d31, w0
	fmul	d31, d30, d31
	mov	x0, 6148914691236517205
	movk	x0, 0x3fd5, lsl 48
	fmov	d30, x0
	fadd	d31, d31, d30
	adrp	x0, xs
	add	x0, x0, :lo12:xs
	ldrsw	x1, [sp, 156]
	str	d31, [x0, x1, lsl 3]
	adrp	x0, dv
	add	x0, x0, :lo12:dv
	ldr	d30, [x0, 24]
	ldr	w0, [sp, 156]
	add	w0, w0, 7
	scvtf	d31, w0
	fdiv	d31, d30, d31
	adrp	x0, ys
	add	x0, x0, :lo12:ys
	ldrsw	x1, [sp, 156]
	str	d31, [x0, x1, lsl 3]
	ldr	w0, [sp, 156]
	add	w0, w0, 1
	str	w0, [sp, 156]
.L39:
	ldr	w0, [sp, 156]
	cmp	w0, 7
	ble	.L40
	bl	dot
	fmov	d31, d0
	fmov	d0, d31
	bl	dbits
	mov	x19, x0
	bl	dot
	fmov	d31, d0
	fmov	d0, d31
	mov	x1, x19
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	str	wzr, [sp, 152]
	b	.L41
.L42:
	adrp	x0, dv
	add	x2, x0, :lo12:dv
	ldrsw	x1, [sp, 152]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	d31, [x0]
	adrp	x0, la
	add	x0, x0, :lo12:la
	ldrsw	x1, [sp, 152]
	str	d31, [x0, x1, lsl 3]
	adrp	x0, dv
	add	x2, x0, :lo12:dv
	ldrsw	x1, [sp, 152]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	d31, [x0, 8]
	adrp	x0, lb
	add	x0, x0, :lo12:lb
	ldrsw	x1, [sp, 152]
	str	d31, [x0, x1, lsl 3]
	adrp	x0, dv
	add	x2, x0, :lo12:dv
	ldrsw	x1, [sp, 152]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	d31, [x0, 16]
	adrp	x0, lc
	add	x0, x0, :lo12:lc
	ldrsw	x1, [sp, 152]
	str	d31, [x0, x1, lsl 3]
	ldr	w0, [sp, 152]
	add	w0, w0, 1
	str	w0, [sp, 152]
.L41:
	ldr	w0, [sp, 152]
	cmp	w0, 3
	ble	.L42
	bl	fma_lanes
	str	wzr, [sp, 148]
	b	.L43
.L44:
	adrp	x0, lc
	add	x0, x0, :lo12:lc
	ldrsw	x1, [sp, 148]
	ldr	d31, [x0, x1, lsl 3]
	fmov	d0, d31
	bl	dbits
	mov	x2, x0
	ldr	w1, [sp, 148]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [sp, 148]
	add	w0, w0, 1
	str	w0, [sp, 148]
.L43:
	ldr	w0, [sp, 148]
	cmp	w0, 3
	ble	.L44
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 192
	ret
	.section .rodata
	.align	3
coef.0:
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


	.bss
	.balign 8
xs:
	.skip 64
	.balign 8
ys:
	.skip 64
	.balign 8
la:
	.skip 32
	.balign 8
lb:
	.skip 32
	.balign 8
lc:
	.skip 32
