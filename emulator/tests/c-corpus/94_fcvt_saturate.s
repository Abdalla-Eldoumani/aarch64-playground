	.text
	.data
	.align	3
dv:
	.word	0
	.word	0
	.word	0
	.word	-2147483648
	.word	1
	.word	0
	.word	1
	.word	-2147483648
	.word	-1
	.word	1072693247
	.word	0
	.word	-1074266112
	.word	-1
	.word	1105199103
	.word	0
	.word	1105199104
	.word	0
	.word	-1042284544
	.word	2097151
	.word	-1042284544
	.word	2097152
	.word	-1042284544
	.word	-1
	.word	1106247679
	.word	0
	.word	1106247680
	.word	-1
	.word	1138753535
	.word	0
	.word	1138753536
	.word	0
	.word	-1008730112
	.word	1
	.word	-1008730112
	.word	-1
	.word	1139802111
	.word	0
	.word	1139802112
	.word	-2013235812
	.word	2117592124
	.word	-2013235812
	.word	-29891524
	.word	0
	.word	2146435072
	.word	0
	.word	-1048576
	.word	0
	.word	2146959360
	.word	0
	.word	-524288
	.align	3
fv:
	.word	0
	.word	-2147483648
	.word	1
	.word	-2147483647
	.word	1065353215
	.word	-1077936128
	.word	1325400063
	.word	1325400064
	.word	-822083584
	.word	-822083583
	.word	1333788671
	.word	1333788672
	.word	1593835519
	.word	1593835520
	.word	-553648128
	.word	-553648127
	.word	1602224127
	.word	1602224128
	.word	2139095039
	.word	-8388609
	.word	2139095040
	.word	-8388608
	.word	2143289344
	.word	-4194304
	.align	3
lv:
	.word	2139095039
	.word	-8388609
	.word	2139095040
	.word	2143289344
	.word	-1077936128
	.word	1325400064
	.word	1333788672
	.word	-822083584
	.align	3
qv:
	.word	0
	.word	1073217536
	.word	0
	.word	-1075314688
	.word	-2748779
	.word	1088421887
	.word	0
	.word	1088421888
	.word	0
	.word	-1059061760
	.word	0
	.word	-1059061728
	.word	-1073741824
	.word	1105615371
	.word	0
	.word	2146959360
	.align	3
rv:
	.word	0
	.word	1071644672
	.word	0
	.word	-1075838976
	.word	0
	.word	1073217536
	.word	0
	.word	1074003968
	.word	0
	.word	-1073479680
	.word	-2097152
	.word	1105199103
	.word	1048576
	.word	-1042284544
	.word	-1048576
	.word	1106247679
	.word	1620131072
	.word	1138841828
	.word	1620131072
	.word	-1008641820
	.word	0
	.word	2146959360
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
via_long:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	fcvtzs	d31, d31
	scvtf	d31, d31
	fmov	d0, d31
	add	sp, sp, 16
	ret
	.align	2
via_ulong:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	fcvtzu	d31, d31
	ucvtf	d31, d31
	fmov	d0, d31
	add	sp, sp, 16
	ret
	.align	2
via_int:
	sub	sp, sp, #16
	str	s0, [sp, 12]
	ldr	s31, [sp, 12]
	fcvtzs	s31, s31
	scvtf	s31, s31
	fmov	s0, s31
	add	sp, sp, 16
	ret
	.align	2
via_uint:
	sub	sp, sp, #16
	str	s0, [sp, 12]
	ldr	s31, [sp, 12]
	fcvtzu	s31, s31
	ucvtf	s31, s31
	fmov	s0, s31
	add	sp, sp, 16
	ret
	.align	2
convert_lanes:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	b	.L14
.L15:
	adrp	x0, lanes
	add	x0, x0, :lo12:lanes
	ldrsw	x1, [sp, 12]
	ldr	s31, [x0, x1, lsl 2]
	fcvtzs	s31, s31
	adrp	x0, lane_i
	add	x0, x0, :lo12:lane_i
	ldrsw	x1, [sp, 12]
	str	s31, [x0, x1, lsl 2]
	adrp	x0, lanes
	add	x0, x0, :lo12:lanes
	ldrsw	x1, [sp, 12]
	ldr	s31, [x0, x1, lsl 2]
	fcvtzu	s31, s31
	adrp	x0, lane_u
	add	x0, x0, :lo12:lane_u
	ldrsw	x1, [sp, 12]
	str	s31, [x0, x1, lsl 2]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 12]
.L14:
	ldr	w0, [sp, 12]
	cmp	w0, 7
	ble	.L15
	nop
	nop
	add	sp, sp, 16
	ret
	.align	2
q16:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	mov	x0, 4679240012837945344
	fmov	d30, x0
	fmul	d31, d31, d30
	fcvtzs	w0, d31
	add	sp, sp, 16
	ret
	.align	2
q32:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	mov	x0, 4751297606875873280
	fmov	d30, x0
	fmul	d31, d31, d30
	fcvtzs	d31, d31
	fmov	x0, d31
	add	sp, sp, 16
	ret
	.align	2
uq8:
	sub	sp, sp, #16
	str	s0, [sp, 12]
	ldr	s31, [sp, 12]
	mov	w0, 1132462080
	fmov	s30, w0
	fmul	s31, s31, s30
	fcvtzu	s31, s31
	fmov	w0, s31
	add	sp, sp, 16
	ret
	.align	2
fcvtns_w:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtns w0, d31
// 0 "" 2
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
fcvtns_x:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtns x0, d31
// 0 "" 2
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
fcvtas_w:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtas w0, d31
// 0 "" 2
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
fcvtas_x:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtas x0, d31
// 0 "" 2
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
fcvtms_w:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtms w0, d31
// 0 "" 2
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
fcvtms_x:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtms x0, d31
// 0 "" 2
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
fcvtps_w:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtps w0, d31
// 0 "" 2
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
fcvtps_x:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtps x0, d31
// 0 "" 2
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
fcvtnu_w:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtnu w0, d31
// 0 "" 2
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
fcvtnu_x:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtnu x0, d31
// 0 "" 2
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
fcvtau_w:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtau w0, d31
// 0 "" 2
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
fcvtau_x:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtau x0, d31
// 0 "" 2
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
fcvtmu_w:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtmu w0, d31
// 0 "" 2
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
fcvtmu_x:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtmu x0, d31
// 0 "" 2
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
fcvtpu_w:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtpu w0, d31
// 0 "" 2
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
fcvtpu_x:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtpu x0, d31
// 0 "" 2
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"ns"
	.align	3
.LC1:
	.string	"as"
	.align	3
.LC2:
	.string	"ms"
	.align	3
.LC3:
	.string	"ps"
	.align	3
.LC4:
	.string	"nu"
	.align	3
.LC5:
	.string	"au"
	.align	3
.LC6:
	.string	"mu"
	.align	3
.LC7:
	.string	"pu"
	.align	3
modes:
	.xword	.LC0
	.xword	fcvtns_w
	.xword	fcvtns_x
	.xword	.LC1
	.xword	fcvtas_w
	.xword	fcvtas_x
	.xword	.LC2
	.xword	fcvtms_w
	.xword	fcvtms_x
	.xword	.LC3
	.xword	fcvtps_w
	.xword	fcvtps_x
	.xword	.LC4
	.xword	fcvtnu_w
	.xword	fcvtnu_x
	.xword	.LC5
	.xword	fcvtau_w
	.xword	fcvtau_x
	.xword	.LC6
	.xword	fcvtmu_w
	.xword	fcvtmu_x
	.xword	.LC7
	.xword	fcvtpu_w
	.xword	fcvtpu_x
	.align	3
.LC8:
	.string	"d%02d %016lx i=%d u=%u l=%ld ul=%lu\n"
	.align	3
.LC9:
	.string	"    via %.1f %.1f\n"
	.align	3
.LC10:
	.string	"f%02d %08x i=%d u=%u l=%ld ul=%lu via %.1f %.1f\n"
	.align	3
.LC11:
	.string	"lane%d %08x %d %u\n"
	.align	3
.LC12:
	.string	"q%d %d %ld %u\n"
	.align	3
.LC13:
	.string	"r%02d w"
	.align	3
.LC14:
	.string	" %s:%08x"
	.align	3
.LC15:
	.string	"\n    x"
	.align	3
.LC16:
	.string	" %s:%016lx"
	.align	3
.LC17:
	.string	"\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -144]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	str	x23, [sp, 48]
	str	d15, [sp, 56]
	mov	w0, 25
	str	w0, [sp, 108]
	str	wzr, [sp, 140]
	b	.L55
.L56:
	adrp	x0, dv
	add	x0, x0, :lo12:dv
	ldrsw	x1, [sp, 140]
	ldr	d31, [x0, x1, lsl 3]
	str	d31, [sp, 72]
	ldr	d0, [sp, 72]
	bl	dbits
	mov	x2, x0
	ldr	d31, [sp, 72]
	fcvtzs	w0, d31
	ldr	d31, [sp, 72]
	fcvtzu	w1, d31
	ldr	d31, [sp, 72]
	fcvtzs	x3, d31
	ldr	d31, [sp, 72]
	fcvtzu	x4, d31
	mov	x6, x4
	mov	x5, x3
	mov	w4, w1
	mov	w3, w0
	ldr	w1, [sp, 140]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldr	d0, [sp, 72]
	bl	via_long
	fmov	d15, d0
	ldr	d0, [sp, 72]
	bl	via_ulong
	fmov	d31, d0
	fmov	d1, d31
	fmov	d0, d15
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	ldr	w0, [sp, 140]
	add	w0, w0, 1
	str	w0, [sp, 140]
.L55:
	ldr	w1, [sp, 140]
	ldr	w0, [sp, 108]
	cmp	w1, w0
	blt	.L56
	mov	w0, 24
	str	w0, [sp, 104]
	str	wzr, [sp, 136]
	b	.L57
.L58:
	adrp	x0, fv
	add	x0, x0, :lo12:fv
	ldrsw	x1, [sp, 136]
	ldr	s31, [x0, x1, lsl 2]
	str	s31, [sp, 84]
	ldr	s0, [sp, 84]
	bl	fbits
	mov	w21, w0
	ldr	s31, [sp, 84]
	fcvtzs	w22, s31
	ldr	s31, [sp, 84]
	fcvtzu	w23, s31
	ldr	s31, [sp, 84]
	fcvtzs	x19, s31
	ldr	s31, [sp, 84]
	fcvtzu	x20, s31
	ldr	s0, [sp, 84]
	bl	via_int
	fmov	s31, s0
	fcvt	d15, s31
	ldr	s0, [sp, 84]
	bl	via_uint
	fmov	s31, s0
	fcvt	d31, s31
	fmov	d1, d31
	fmov	d0, d15
	mov	x6, x20
	mov	x5, x19
	mov	w4, w23
	mov	w3, w22
	mov	w2, w21
	ldr	w1, [sp, 136]
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldr	w0, [sp, 136]
	add	w0, w0, 1
	str	w0, [sp, 136]
.L57:
	ldr	w1, [sp, 136]
	ldr	w0, [sp, 104]
	cmp	w1, w0
	blt	.L58
	str	wzr, [sp, 132]
	b	.L59
.L60:
	adrp	x0, lv
	add	x0, x0, :lo12:lv
	ldrsw	x1, [sp, 132]
	ldr	s31, [x0, x1, lsl 2]
	adrp	x0, lanes
	add	x0, x0, :lo12:lanes
	ldrsw	x1, [sp, 132]
	str	s31, [x0, x1, lsl 2]
	ldr	w0, [sp, 132]
	add	w0, w0, 1
	str	w0, [sp, 132]
.L59:
	ldr	w0, [sp, 132]
	cmp	w0, 7
	ble	.L60
	bl	convert_lanes
	str	wzr, [sp, 128]
	b	.L61
.L62:
	adrp	x0, lanes
	add	x0, x0, :lo12:lanes
	ldrsw	x1, [sp, 128]
	ldr	s31, [x0, x1, lsl 2]
	fmov	s0, s31
	bl	fbits
	mov	w5, w0
	adrp	x0, lane_i
	add	x0, x0, :lo12:lane_i
	ldrsw	x1, [sp, 128]
	ldr	w2, [x0, x1, lsl 2]
	adrp	x0, lane_u
	add	x0, x0, :lo12:lane_u
	ldrsw	x1, [sp, 128]
	ldr	w0, [x0, x1, lsl 2]
	mov	w4, w0
	mov	w3, w2
	mov	w2, w5
	ldr	w1, [sp, 128]
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	ldr	w0, [sp, 128]
	add	w0, w0, 1
	str	w0, [sp, 128]
.L61:
	ldr	w0, [sp, 128]
	cmp	w0, 7
	ble	.L62
	mov	w0, 8
	str	w0, [sp, 100]
	str	wzr, [sp, 124]
	b	.L63
.L64:
	adrp	x0, qv
	add	x0, x0, :lo12:qv
	ldrsw	x1, [sp, 124]
	ldr	d31, [x0, x1, lsl 3]
	fmov	d0, d31
	bl	q16
	mov	w19, w0
	adrp	x0, qv
	add	x0, x0, :lo12:qv
	ldrsw	x1, [sp, 124]
	ldr	d31, [x0, x1, lsl 3]
	fmov	d0, d31
	bl	q32
	mov	x20, x0
	adrp	x0, qv
	add	x0, x0, :lo12:qv
	ldrsw	x1, [sp, 124]
	ldr	d31, [x0, x1, lsl 3]
	fcvt	s31, d31
	fmov	s0, s31
	bl	uq8
	mov	w4, w0
	mov	x3, x20
	mov	w2, w19
	ldr	w1, [sp, 124]
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	ldr	w0, [sp, 124]
	add	w0, w0, 1
	str	w0, [sp, 124]
.L63:
	ldr	w1, [sp, 124]
	ldr	w0, [sp, 100]
	cmp	w1, w0
	blt	.L64
	mov	w0, 11
	str	w0, [sp, 96]
	str	wzr, [sp, 120]
	b	.L65
.L70:
	adrp	x0, rv
	add	x0, x0, :lo12:rv
	ldrsw	x1, [sp, 120]
	ldr	d31, [x0, x1, lsl 3]
	str	d31, [sp, 88]
	ldr	w1, [sp, 120]
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	str	wzr, [sp, 116]
	b	.L66
.L67:
	adrp	x0, modes
	add	x2, x0, :lo12:modes
	ldrsw	x1, [sp, 116]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	x19, [x0]
	adrp	x0, modes
	add	x2, x0, :lo12:modes
	ldrsw	x1, [sp, 116]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	x0, [x0, 8]
	ldr	d0, [sp, 88]
	blr	x0
	mov	w2, w0
	mov	x1, x19
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	printf
	ldr	w0, [sp, 116]
	add	w0, w0, 1
	str	w0, [sp, 116]
.L66:
	ldr	w0, [sp, 116]
	cmp	w0, 7
	ble	.L67
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	str	wzr, [sp, 112]
	b	.L68
.L69:
	adrp	x0, modes
	add	x2, x0, :lo12:modes
	ldrsw	x1, [sp, 112]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	x19, [x0]
	adrp	x0, modes
	add	x2, x0, :lo12:modes
	ldrsw	x1, [sp, 112]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	x0, [x0, 16]
	ldr	d0, [sp, 88]
	blr	x0
	mov	x2, x0
	mov	x1, x19
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	ldr	w0, [sp, 112]
	add	w0, w0, 1
	str	w0, [sp, 112]
.L68:
	ldr	w0, [sp, 112]
	cmp	w0, 7
	ble	.L69
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	ldr	w0, [sp, 120]
	add	w0, w0, 1
	str	w0, [sp, 120]
.L65:
	ldr	w1, [sp, 120]
	ldr	w0, [sp, 96]
	cmp	w1, w0
	blt	.L70
	mov	w0, 0
	ldr	d15, [sp, 56]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldr	x23, [sp, 48]
	ldp	x29, x30, [sp], 144
	ret


	.bss
	.balign 8
lanes:
	.skip 32
	.balign 8
lane_i:
	.skip 32
	.balign 8
lane_u:
	.skip 32
