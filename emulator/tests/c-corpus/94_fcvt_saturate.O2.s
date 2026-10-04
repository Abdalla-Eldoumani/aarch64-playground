	.text
	.align	2
	.p2align 5,,15
dbits:
	fmov	x0, d0
	ret
	.align	2
	.p2align 5,,15
fbits:
	fmov	w0, s0
	ret
	.align	2
	.p2align 5,,15
via_long:
	fcvtzs	d0, d0
	scvtf	d0, d0
	ret
	.align	2
	.p2align 5,,15
via_ulong:
	fcvtzu	d0, d0
	ucvtf	d0, d0
	ret
	.align	2
	.p2align 5,,15
via_int:
	fcvtzs	s0, s0
	scvtf	s0, s0
	ret
	.align	2
	.p2align 5,,15
via_uint:
	fcvtzu	s0, s0
	ucvtf	s0, s0
	ret
	.align	2
	.p2align 5,,15
convert_lanes:
	adrp	x0, .LANCHOR0
	add	x0, x0, :lo12:.LANCHOR0
	ldp	q29, q31, [x0]
	fcvtzs	v28.4s, v29.4s
	fcvtzs	v30.4s, v31.4s
	fcvtzu	v29.4s, v29.4s
	fcvtzu	v31.4s, v31.4s
	stp	q28, q30, [x0, 32]
	stp	q29, q31, [x0, 64]
	ret
	.align	2
	.p2align 5,,15
q16:
	mov	x0, 4679240012837945344
	fmov	d31, x0
	fmul	d0, d0, d31
	fcvtzs	w0, d0
	ret
	.align	2
	.p2align 5,,15
q32:
	mov	x0, 4751297606875873280
	fmov	d31, x0
	fmul	d0, d0, d31
	fcvtzs	x0, d0
	ret
	.align	2
	.p2align 5,,15
uq8:
	mov	w0, 1132462080
	fmov	s31, w0
	fmul	s0, s0, s31
	fcvtzu	w0, s0
	ret
	.align	2
	.p2align 5,,15
fcvtns_w:
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtns w0, d0
// 0 "" 2
	ret
	.align	2
	.p2align 5,,15
fcvtns_x:
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtns x0, d0
// 0 "" 2
	ret
	.align	2
	.p2align 5,,15
fcvtas_w:
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtas w0, d0
// 0 "" 2
	ret
	.align	2
	.p2align 5,,15
fcvtas_x:
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtas x0, d0
// 0 "" 2
	ret
	.align	2
	.p2align 5,,15
fcvtms_w:
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtms w0, d0
// 0 "" 2
	ret
	.align	2
	.p2align 5,,15
fcvtms_x:
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtms x0, d0
// 0 "" 2
	ret
	.align	2
	.p2align 5,,15
fcvtps_w:
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtps w0, d0
// 0 "" 2
	ret
	.align	2
	.p2align 5,,15
fcvtps_x:
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtps x0, d0
// 0 "" 2
	ret
	.align	2
	.p2align 5,,15
fcvtnu_w:
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtnu w0, d0
// 0 "" 2
	ret
	.align	2
	.p2align 5,,15
fcvtnu_x:
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtnu x0, d0
// 0 "" 2
	ret
	.align	2
	.p2align 5,,15
fcvtau_w:
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtau w0, d0
// 0 "" 2
	ret
	.align	2
	.p2align 5,,15
fcvtau_x:
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtau x0, d0
// 0 "" 2
	ret
	.align	2
	.p2align 5,,15
fcvtmu_w:
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtmu w0, d0
// 0 "" 2
	ret
	.align	2
	.p2align 5,,15
fcvtmu_x:
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtmu x0, d0
// 0 "" 2
	ret
	.align	2
	.p2align 5,,15
fcvtpu_w:
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtpu w0, d0
// 0 "" 2
	ret
	.align	2
	.p2align 5,,15
fcvtpu_x:
// 62 "programs/94_fcvt_saturate.c" 1
	fcvtpu x0, d0
// 0 "" 2
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"d%02d %016lx i=%d u=%u l=%ld ul=%lu\n"
	.align	3
.LC1:
	.string	"    via %.1f %.1f\n"
	.align	3
.LC2:
	.string	"f%02d %08x i=%d u=%u l=%ld ul=%lu via %.1f %.1f\n"
	.align	3
.LC3:
	.string	"lane%d %08x %d %u\n"
	.align	3
.LC4:
	.string	"q%d %d %ld %u\n"
	.align	3
.LC5:
	.string	"r%02d w"
	.align	3
.LC6:
	.string	" %s:%08x"
	.align	3
.LC7:
	.string	"\n    x"
	.align	3
.LC8:
	.string	" %s:%016lx"
	.align	3
.LC9:
	.string	"\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -128]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LC1
	add	x20, x20, :lo12:.LC1
	stp	x21, x22, [sp, 32]
	adrp	x21, .LC0
	add	x21, x21, :lo12:.LC0
	stp	x23, x24, [sp, 48]
	adrp	x24, .LANCHOR1
	add	x24, x24, :lo12:.LANCHOR1
	mov	w19, 0
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	str	d15, [sp, 96]
	.p2align 5,,15
.L29:
	ldr	d15, [x24, w19, sxtw 3]
	mov	w1, w19
	add	w19, w19, 1
	fmov	d0, d15
	fcvtzu	x6, d15
	fcvtzs	x5, d15
	fcvtzu	w4, d15
	fcvtzs	w3, d15
	bl	dbits
	mov	x2, x0
	mov	x0, x21
	bl	printf
	fmov	d0, d15
	mov	x0, x20
	bl	via_long
	fmov	d31, d0
	fmov	d0, d15
	bl	via_ulong
	fmov	d1, d0
	fmov	d0, d31
	bl	printf
	cmp	w19, 25
	bne	.L29
	adrp	x20, .LC2
	add	x21, x24, 208
	add	x20, x20, :lo12:.LC2
	mov	w19, 0
	.p2align 5,,15
.L30:
	ldr	s31, [x21, w19, sxtw 2]
	mov	w1, w19
	add	w19, w19, 1
	fmov	s0, s31
	fcvtzs	w3, s31
	fcvtzu	w4, s31
	fcvtzs	x5, s31
	fcvtzu	x6, s31
	bl	fbits
	mov	w2, w0
	bl	via_int
	fcvt	d30, s0
	fmov	s0, s31
	mov	x0, x20
	bl	via_uint
	fcvt	d1, s0
	fmov	d0, d30
	bl	printf
	cmp	w19, 24
	bne	.L30
	adrp	x20, .LANCHOR0
	add	x1, x24, 304
	add	x20, x20, :lo12:.LANCHOR0
	mov	x0, 0
	.p2align 5,,15
.L31:
	ldr	s31, [x1, w0, sxtw 2]
	str	s31, [x20, x0, lsl 2]
	add	x0, x0, 1
	cmp	x0, 8
	bne	.L31
	adrp	x21, .LC3
	add	x23, x20, 64
	add	x21, x21, :lo12:.LC3
	add	x22, x20, 32
	mov	x19, 0
	bl	convert_lanes
	.p2align 5,,15
.L32:
	ldr	s0, [x20, x19, lsl 2]
	mov	w1, w19
	bl	fbits
	ldr	w4, [x23, x19, lsl 2]
	ldr	w3, [x22, x19, lsl 2]
	mov	w2, w0
	add	x19, x19, 1
	mov	x0, x21
	bl	printf
	cmp	x19, 8
	bne	.L32
	adrp	x21, .LC4
	add	x20, x24, 336
	add	x21, x21, :lo12:.LC4
	mov	w19, 0
	.p2align 5,,15
.L33:
	ldr	d0, [x20, w19, sxtw 3]
	mov	w1, w19
	bl	q16
	mov	w2, w0
	ldr	d0, [x20, w19, sxtw 3]
	bl	q32
	mov	x3, x0
	ldr	d0, [x20, w19, sxtw 3]
	add	w19, w19, 1
	fcvt	s0, d0
	bl	uq8
	mov	w4, w0
	mov	x0, x21
	bl	printf
	cmp	w19, 8
	bne	.L33
	adrp	x25, .LANCHOR2
	add	x25, x25, :lo12:.LANCHOR2
	adrp	x28, .LC5
	adrp	x22, .LC6
	adrp	x27, .LC7
	adrp	x21, .LC8
	add	x0, x27, :lo12:.LC7
	add	x28, x28, :lo12:.LC5
	add	x22, x22, :lo12:.LC6
	add	x21, x21, :lo12:.LC8
	add	x24, x24, 400
	add	x20, x25, 192
	adrp	x26, .LC9
	mov	w23, 0
	str	x0, [sp, 112]
	add	x0, x26, :lo12:.LC9
	str	x0, [sp, 120]
	.p2align 5,,15
.L36:
	ldr	d15, [x24, w23, sxtw 3]
	mov	x19, x25
	mov	x26, x25
	mov	w1, w23
	mov	x0, x28
	bl	printf
	.p2align 5,,15
.L34:
	ldp	x27, x0, [x26], 24
	fmov	d0, d15
	blr	x0
	mov	w2, w0
	mov	x1, x27
	mov	x0, x22
	bl	printf
	cmp	x20, x26
	bne	.L34
	ldr	x0, [sp, 112]
	bl	printf
	.p2align 5,,15
.L35:
	ldr	x0, [x19, 16]
	fmov	d0, d15
	ldr	x26, [x19]
	add	x19, x19, 24
	blr	x0
	mov	x2, x0
	mov	x1, x26
	mov	x0, x21
	bl	printf
	cmp	x19, x20
	bne	.L35
	ldr	x0, [sp, 120]
	add	w23, w23, 1
	bl	printf
	cmp	w23, 11
	bne	.L36
	ldr	d15, [sp, 96]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 128
	ret
	.section .rodata
	.align	3
.LC10:
	.string	"ns"
	.align	3
.LC11:
	.string	"as"
	.align	3
.LC12:
	.string	"ms"
	.align	3
.LC13:
	.string	"ps"
	.align	3
.LC14:
	.string	"nu"
	.align	3
.LC15:
	.string	"au"
	.align	3
.LC16:
	.string	"mu"
	.align	3
.LC17:
	.string	"pu"
	.section .rodata
	.align	3
	.LANCHOR2:
modes:
	.xword	.LC10
	.xword	fcvtns_w
	.xword	fcvtns_x
	.xword	.LC11
	.xword	fcvtas_w
	.xword	fcvtas_x
	.xword	.LC12
	.xword	fcvtms_w
	.xword	fcvtms_x
	.xword	.LC13
	.xword	fcvtps_w
	.xword	fcvtps_x
	.xword	.LC14
	.xword	fcvtnu_w
	.xword	fcvtnu_x
	.xword	.LC15
	.xword	fcvtau_w
	.xword	fcvtau_x
	.xword	.LC16
	.xword	fcvtmu_w
	.xword	fcvtmu_x
	.xword	.LC17
	.xword	fcvtpu_w
	.xword	fcvtpu_x
	.data
	.align	4
	.LANCHOR1:
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
	.zero	8
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
lv:
	.word	2139095039
	.word	-8388609
	.word	2139095040
	.word	2143289344
	.word	-1077936128
	.word	1325400064
	.word	1333788672
	.word	-822083584
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
	.bss
	.align	4
	.LANCHOR0:
lanes:
	.zero	32
lane_i:
	.zero	32
lane_u:
	.zero	32

