	.text
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
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -144]!
	mov	x29, sp
	stp	x21, x22, [sp, 32]
	adrp	x22, .LC1
	add	x22, x22, :lo12:.LC1
	stp	x23, x24, [sp, 48]
	adrp	x23, .LC0
	add	x23, x23, :lo12:.LC0
	stp	x25, x26, [sp, 64]
	adrp	x25, .LANCHOR0
	add	x25, x25, :lo12:.LANCHOR0
	stp	x19, x20, [sp, 16]
	mov	w19, 0
	stp	x27, x28, [sp, 80]
	stp	d13, d14, [sp, 96]
	str	d15, [sp, 112]
	.p2align 5,,15
.L19:
	ldr	d31, [x25, w19, sxtw 3]
	mov	w1, w19
	mov	x0, x23
	add	w19, w19, 1
	fcvtzs	x20, d31
	fcvtzu	x21, d31
	fcvtzu	w4, d31
	fcvtzs	w3, d31
	fmov	x2, d31
	mov	x6, x21
	mov	x5, x20
	bl	printf
	ucvtf	d1, x21
	scvtf	d0, x20
	mov	x0, x22
	bl	printf
	cmp	w19, 25
	bne	.L19
	adrp	x20, .LC2
	add	x21, x25, 208
	add	x20, x20, :lo12:.LC2
	mov	w19, 0
	.p2align 5,,15
.L20:
	ldr	s31, [x21, w19, sxtw 2]
	mov	w1, w19
	mov	x0, x20
	add	w19, w19, 1
	fcvtzs	w3, s31
	fcvtzu	w4, s31
	fcvtzu	x6, s31
	fcvtzs	x5, s31
	fmov	w2, s31
	ucvtf	s1, w4
	scvtf	s0, w3
	fcvt	d1, s1
	fcvt	d0, s0
	bl	printf
	cmp	w19, 24
	bne	.L20
	adrp	x20, .LANCHOR1
	add	x1, x25, 304
	add	x20, x20, :lo12:.LANCHOR1
	mov	x0, 0
	.p2align 5,,15
.L21:
	ldr	s31, [x1, w0, sxtw 2]
	str	s31, [x20, x0, lsl 2]
	add	x0, x0, 1
	cmp	x0, 8
	bne	.L21
	ldp	q29, q31, [x20]
	adrp	x21, .LC3
	add	x23, x20, 32
	add	x22, x20, 64
	add	x21, x21, :lo12:.LC3
	mov	x19, 0
	fcvtzs	v28.4s, v29.4s
	fcvtzs	v30.4s, v31.4s
	fcvtzu	v29.4s, v29.4s
	fcvtzu	v31.4s, v31.4s
	stp	q28, q30, [x20, 32]
	stp	q29, q31, [x20, 64]
	.p2align 5,,15
.L22:
	ldr	w4, [x22, x19, lsl 2]
	ldr	w3, [x23, x19, lsl 2]
	mov	w1, w19
	ldr	w2, [x20, x19, lsl 2]
	mov	x0, x21
	add	x19, x19, 1
	bl	printf
	cmp	x19, 8
	bne	.L22
	mov	w0, 1132462080
	adrp	x21, .LC4
	fmov	s13, w0
	add	x21, x21, :lo12:.LC4
	mov	x0, 4751297606875873280
	add	x20, x25, 336
	fmov	d14, x0
	mov	w19, 0
	mov	x0, 4679240012837945344
	fmov	d15, x0
	.p2align 5,,15
.L23:
	ldr	d30, [x20, w19, sxtw 3]
	mov	w1, w19
	ldr	d29, [x20, w19, sxtw 3]
	mov	x0, x21
	ldr	d31, [x20, w19, sxtw 3]
	add	w19, w19, 1
	fmul	d30, d30, d15
	fmul	d29, d29, d14
	fcvt	s31, d31
	fcvtzs	w2, d30
	fcvtzs	x3, d29
	fmul	s31, s31, s13
	fcvtzu	w4, s31
	bl	printf
	cmp	w19, 8
	bne	.L23
	adrp	x26, .LANCHOR2
	add	x26, x26, :lo12:.LANCHOR2
	adrp	x28, .LC5
	adrp	x23, .LC6
	adrp	x22, .LC8
	add	x28, x28, :lo12:.LC5
	add	x23, x23, :lo12:.LC6
	add	x22, x22, :lo12:.LC8
	add	x25, x25, 400
	add	x21, x26, 192
	adrp	x27, .LC7
	mov	w24, 0
	add	x0, x27, :lo12:.LC7
	str	x0, [sp, 136]
	.p2align 5,,15
.L26:
	ldr	d15, [x25, w24, sxtw 3]
	mov	x19, x26
	mov	x20, x26
	mov	w1, w24
	mov	x0, x28
	bl	printf
	.p2align 5,,15
.L24:
	ldp	x27, x0, [x20], 24
	fmov	d0, d15
	blr	x0
	mov	w2, w0
	mov	x1, x27
	mov	x0, x23
	bl	printf
	cmp	x20, x21
	bne	.L24
	ldr	x0, [sp, 136]
	bl	printf
	.p2align 5,,15
.L25:
	ldr	x0, [x19, 16]
	fmov	d0, d15
	ldr	x20, [x19]
	add	x19, x19, 24
	blr	x0
	mov	x2, x0
	mov	x1, x20
	mov	x0, x22
	bl	printf
	cmp	x19, x21
	bne	.L25
	mov	w0, 10
	add	w24, w24, 1
	bl	putchar
	cmp	w24, 11
	bne	.L26
	ldr	d15, [sp, 112]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	d13, d14, [sp, 96]
	ldp	x29, x30, [sp], 144
	ret
	.section .rodata
	.align	3
.LC9:
	.string	"ns"
	.align	3
.LC10:
	.string	"as"
	.align	3
.LC11:
	.string	"ms"
	.align	3
.LC12:
	.string	"ps"
	.align	3
.LC13:
	.string	"nu"
	.align	3
.LC14:
	.string	"au"
	.align	3
.LC15:
	.string	"mu"
	.align	3
.LC16:
	.string	"pu"
	.section .rodata
	.align	3
	.LANCHOR2:
modes:
	.xword	.LC9
	.xword	fcvtns_w
	.xword	fcvtns_x
	.xword	.LC10
	.xword	fcvtas_w
	.xword	fcvtas_x
	.xword	.LC11
	.xword	fcvtms_w
	.xword	fcvtms_x
	.xword	.LC12
	.xword	fcvtps_w
	.xword	fcvtps_x
	.xword	.LC13
	.xword	fcvtnu_w
	.xword	fcvtnu_x
	.xword	.LC14
	.xword	fcvtau_w
	.xword	fcvtau_x
	.xword	.LC15
	.xword	fcvtmu_w
	.xword	fcvtmu_x
	.xword	.LC16
	.xword	fcvtpu_w
	.xword	fcvtpu_x
	.data
	.align	4
	.LANCHOR0:
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
	.LANCHOR1:
lanes:
	.zero	32
lane_i:
	.zero	32
lane_u:
	.zero	32

