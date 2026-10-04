	.text
	.align	2
	.p2align 5,,15
digits:
	sub	sp, sp, #160
	movi	d31, #0
	add	x1, sp, 160
	mov	w3, -128
	mov	x2, x1
	fmov	d30, 1.0e+1
	stp	x1, x1, [sp]
	str	x1, [sp, 16]
	mov	w1, 0
	stp	wzr, w3, [sp, 24]
	stp	q0, q1, [sp, 32]
	stp	q2, q3, [sp, 64]
	stp	q4, q5, [sp, 96]
	stp	q6, q7, [sp, 128]
.L7:
	fmul	d29, d31, d30
	tbz	w3, #31, .L2
	add	w4, w3, 16
	cmp	w4, 0
	ble	.L6
	ldr	d0, [x2]
	add	w1, w1, 1
	fadd	d31, d29, d0
	cmp	w0, w1
	beq	.L1
	fmul	d29, d31, d30
	add	x2, x2, 8
.L2:
	fmov	d28, 1.0e+1
	b	.L5
	.p2align 2,,3
.L12:
	fmul	d29, d31, d28
	add	x2, x2, 8
.L5:
	ldr	d1, [x2]
	add	w1, w1, 1
	fadd	d31, d29, d1
	cmp	w0, w1
	bne	.L12
.L1:
	fmov	d0, d31
	add	sp, sp, 160
	ret
	.p2align 2,,3
.L6:
	ldr	d27, [x2, w3, sxtw]
	add	w1, w1, 1
	fadd	d31, d29, d27
	cmp	w0, w1
	beq	.L1
	mov	w3, w4
	b	.L7
	.section .rodata
	.align	3
.LC0:
	.string	"dldidldidldiddlidddl"
	.text
	.align	2
	.p2align 5,,15
mixed.constprop.0:
	sub	sp, sp, #224
	fmov	d31, 3.0e+0
	add	x0, sp, 224
	fmov	d30, 7.0e+0
	stp	x0, x0, [sp]
	add	x0, sp, 160
	str	x0, [sp, 16]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	stp	q0, q1, [sp, 32]
	movi	d0, #0
	stp	q2, q3, [sp, 64]
	stp	q4, q5, [sp, 96]
	stp	q6, q7, [sp, 128]
	stp	x1, x2, [sp, 168]
	add	x2, sp, 224
	mov	w1, 100
	stp	x3, x4, [sp, 184]
	mov	w3, -56
	adrp	x4, .LC0+20
	add	x4, x4, :lo12:.LC0+20
	stp	x5, x6, [sp, 200]
	mov	w5, -128
	stp	w3, w5, [sp, 24]
	str	x7, [sp, 216]
	b	.L26
	.p2align 2,,3
.L14:
	cmp	w1, 105
	beq	.L32
	tbnz	w3, #31, .L23
.L31:
	mov	x1, x2
	add	x2, x2, 8
.L24:
	ldr	d28, [x1]
	scvtf	d28, d28
	fdiv	d28, d28, d30
	fadd	d0, d28, d29
.L18:
	ldrb	w1, [x0, 1]!
	cmp	x0, x4
	beq	.L33
.L26:
	fmul	d29, d0, d31
	cmp	w1, 100
	bne	.L14
	tbnz	w5, #31, .L15
.L29:
	mov	x1, x2
	add	x2, x2, 8
.L16:
	ldr	d2, [x1]
	ldrb	w1, [x0, 1]!
	fadd	d0, d29, d2
	cmp	x0, x4
	bne	.L26
.L33:
	add	sp, sp, 224
	ret
	.p2align 2,,3
.L32:
	tbnz	w3, #31, .L20
.L30:
	mov	x1, x2
	add	x2, x2, 8
.L21:
	ldr	w1, [x1]
	scvtf	d1, w1
	fsub	d0, d29, d1
	b	.L18
	.p2align 2,,3
.L23:
	add	w6, w3, 8
	cmp	w6, 0
	ble	.L25
	mov	w3, w6
	b	.L31
	.p2align 2,,3
.L15:
	add	w6, w5, 16
	cmp	w6, 0
	ble	.L17
	mov	w5, w6
	b	.L29
	.p2align 2,,3
.L20:
	add	w6, w3, 8
	cmp	w6, 0
	ble	.L22
	mov	w3, w6
	b	.L30
.L25:
	ldr	x1, [sp, 8]
	add	x1, x1, w3, sxtw
	mov	w3, w6
	b	.L24
.L22:
	ldr	x1, [sp, 8]
	add	x1, x1, w3, sxtw
	mov	w3, w6
	b	.L21
.L17:
	ldr	x1, [sp, 16]
	add	x1, x1, w5, sxtw
	mov	w5, w6
	b	.L16
	.section .rodata
	.align	3
.LC1:
	.string	"[%f] [%e] [%g] [%F] [%E] [%G]\n"
	.align	3
.LC2:
	.string	"[%8f] [%-8f] [%08f] [%+f] [% f] [%+08.3e] [%#g] [%-+9G]\n"
	.align	3
.LC3:
	.string	"[%f] [%e] [%g] [%+.0f] [% .1e] [%#.0f] [%#g] [%05.1f]\n"
	.align	3
.LC5:
	.string	"[%#.0f] [%#.0e] [%#g] [%#.3g] [%#G] [%#.0E]\n"
	.align	3
.LC7:
	.string	"[%#g] [%#.1g] [%#.10g] [%#.0f]\n"
	.align	3
.LC8:
	.string	"[%012.3e] [%012g] [%-12.3e] [%+012.2E] [%012G] [%012.4f]\n"
	.align	3
.LC10:
	.string	"[%+012.3e] [% 012g] [%012.3g] [%015e]\n"
	.align	3
.LC11:
	.string	"%.0f %.0f %.0f %.0f %.0f %.0f %.1f %.1f %.2f %.2f %.0e %.0e %.1e %.1g %.3g %.2f\n"
	.align	3
.LC16:
	.string	"%g %g %g %g %g %g %g %g %g\n"
	.align	3
.LC21:
	.string	"%.3f|%.20f|%.0f|%e|%.15e|%.30e\n"
	.align	3
.LC24:
	.string	"[%.*f] [%*.*e] [%-*g] [%.*f] [%*g]\n"
	.align	3
.LC25:
	.string	"%.10f %g %e %.9g\n"
	.align	3
.LC26:
	.string	"%d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %ld %.2f\n"
	.align	3
.LC27:
	.string	"digits %.17g %.17g\n"
	.align	3
.LC29:
	.string	"mixed %.17g\n"
	.align	3
.LC30:
	.string	"%.6f"
	.align	3
.LC31:
	.string	"snprintf %d [%s]\n"
	.align	3
.LC33:
	.string	"%10.3e|%-10.2f|%+.4g"
	.align	3
.LC34:
	.string	"sprintf %d [%s]\n"
	.align	3
.LC37:
	.string	"[%'.2f] [%'g] [%'012.1f]\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #336
	adrp	x1, .LANCHOR0
	add	x0, x1, :lo12:.LANCHOR0
	stp	x29, x30, [sp, 64]
	add	x29, sp, 64
	ldr	d30, [x1, :lo12:.LANCHOR0]
	stp	x19, x20, [sp, 80]
	adrp	x20, .LC2
	add	x19, sp, 240
	stp	x21, x22, [sp, 96]
	add	x20, x20, :lo12:.LC2
	adrp	x21, .LC1
	str	d30, [sp, 240]
	fneg	d30, d30
	stp	d8, d9, [sp, 128]
	add	x22, sp, 272
	add	x21, x21, :lo12:.LC1
	stp	d10, d11, [sp, 144]
	stp	d12, d13, [sp, 160]
	stp	d14, d15, [sp, 176]
	ldr	d31, [x0, 8]
	str	x23, [sp, 112]
	adrp	x23, .LANCHOR1
	stp	d30, d31, [sp, 248]
	fneg	d31, d31
	ldr	d13, [x23, :lo12:.LANCHOR1]
	ldr	d14, [x0, 16]
	str	d31, [sp, 264]
.L35:
	ldr	d15, [x19], 8
	mov	x0, x21
	fmov	d5, d15
	fmov	d4, d15
	fmov	d3, d15
	fmov	d2, d15
	fmov	d1, d15
	fmov	d0, d15
	bl	printf
	fmov	d7, d15
	fmov	d6, d15
	fmov	d5, d15
	fmov	d4, d15
	fmov	d3, d15
	fmov	d2, d15
	fmov	d1, d15
	fmov	d0, d15
	mov	x0, x20
	bl	printf
	cmp	x19, x22
	bne	.L35
	ldr	d7, [x23, :lo12:.LANCHOR1]
	adrp	x20, .LC3
	add	x0, x20, :lo12:.LC3
	mov	x23, 1
	mov	w21, 8
	mov	x22, 11
	fmov	d6, d7
	fmov	d5, d7
	fmov	d4, d7
	fmov	d3, d7
	fmov	d2, d7
	fmov	d1, d7
	fmov	d0, d7
	bl	printf
	fneg	d7, d13
	add	x0, x20, :lo12:.LC3
	fmov	d6, d7
	fmov	d5, d7
	fmov	d4, d7
	fmov	d3, d7
	fmov	d2, d7
	fmov	d1, d7
	fmov	d0, d7
	bl	printf
	fmov	d11, 2.5e+0
	fmov	d12, 3.0e+0
	adrp	x0, .LANCHOR2
	add	x20, x0, :lo12:.LANCHOR2
	fmul	d2, d14, d12
	fmul	d26, d14, d11
	ldr	d31, [x0, :lo12:.LANCHOR2]
	mov	x0, 4636737291354636288
	fmov	d30, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	fmul	d4, d14, d31
	fmul	d3, d14, d30
	fmov	d5, d26
	fmov	d1, d2
	fmov	d0, d2
	str	d31, [sp, 192]
	str	d26, [sp, 216]
	bl	printf
	fdiv	d2, d14, d12
	fmov	d13, 5.0e-1
	ldp	d25, d8, [x20, 8]
	fmul	d9, d14, d13
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	fmul	d0, d14, d25
	str	d25, [sp, 208]
	fmov	d3, d9
	fmov	d1, d9
	bl	printf
	fmov	d28, -1.5e+0
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	fmul	d15, d14, d28
	fmov	d5, d15
	fmov	d4, d15
	fmov	d3, d15
	fmov	d2, d15
	fmov	d1, d15
	fmov	d0, d15
	bl	printf
	fmul	d3, d14, d8
	mov	x0, 235875308929024
	fneg	d1, d15
	movk	x0, 0x4132, lsl 48
	fmov	d30, x0
	fneg	d0, d15
	adrp	x0, .LC10
	fmul	d10, d14, d30
	add	x0, x0, :lo12:.LC10
	fmov	d2, d10
	bl	printf
	fmov	d2, d11
	ldp	d30, d31, [x20, 24]
	fmov	d8, 3.5e+0
	fmov	d0, d13
	mov	x0, 7378697629483820646
	fmov	d3, d8
	fmov	d29, 1.25e+0
	stp	d31, d30, [sp, 48]
	fmov	d31, 2.5e-1
	fmov	d27, 1.25e-1
	fmov	d6, d31
	fmov	d24, 3.75e-1
	movk	x0, 0x3fd6, lsl 48
	fmov	d5, -2.5e+0
	fmov	d7, x0
	fmov	d4, -5.0e-1
	fmov	d1, 1.5e+0
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	stp	d27, d24, [sp]
	stp	d11, d8, [sp, 16]
	stp	d29, d31, [sp, 32]
	str	d30, [sp, 200]
	bl	printf
	mov	x3, 9218868437227405311
	fmov	d7, x3
	adrp	x3, .LC14
	ldr	d4, [sp, 192]
	ldp	d24, d13, [x20, 56]
	mov	x2, 145680995713024
	ldr	d6, [x3, :lo12:.LC14]
	adrp	x3, .LC15
	ldr	d5, [sp, 208]
	mov	x1, 145685290680320
	ldr	d3, [x3, :lo12:.LC15]
	mov	x0, 116548232544256
	movk	x2, 0x412e, lsl 48
	movk	x1, 0x412e, lsl 48
	fmov	d2, x2
	fmov	d1, x1
	movk	x0, 0x40f8, lsl 48
	fmov	d0, x0
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	str	d24, [sp]
	bl	printf
	mov	x0, 2024
	fmov	d3, x0
	adrp	x0, .LC19
	fmov	d5, d13
	fmov	d1, d13
	fmov	d4, x23
	ldr	d2, [x0, :lo12:.LC19]
	adrp	x0, .LC20
	ldr	d0, [x0, :lo12:.LC20]
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	printf
	fmov	d3, d11
	adrp	x0, .LC22
	fmov	d4, 2.5e-1
	fmov	d2, 1.5e+0
	mov	w6, -8
	ldr	d1, [x0, :lo12:.LC22]
	adrp	x0, .LANCHOR2+96
	mov	w5, -1
	mov	w4, 10
	ldr	d0, [x0, :lo12:.LANCHOR2+96]
	mov	w3, 2
	mov	w2, 12
	mov	w1, 3
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	printf
	fmul	d3, d14, d13
	fmov	s31, 3.0e+0
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	fcvt	s3, d3
	fcvt	d2, s3
	fmul	s3, s3, s31
	fmov	d1, d2
	fmov	d0, d2
	fcvt	d3, s3
	bl	printf
	fmul	d2, d14, d8
	mov	x0, 140737488355328
	fmov	d13, 6.5e+0
	movk	x0, 0x4026, lsl 48
	fmov	d31, x0
	fmov	d7, 8.5e+0
	fmov	d6, 7.5e+0
	fmul	d31, d14, d31
	fmov	d4, 5.5e+0
	fmov	d3, 4.5e+0
	fmul	d5, d14, d13
	fmul	d7, d14, d7
	fmul	d6, d14, d6
	fmul	d4, d14, d4
	fmul	d3, d14, d3
	str	d31, [sp, 48]
	fmov	d31, 1.05e+1
	fneg	d0, d15
	ldr	d1, [sp, 216]
	fmul	d31, d14, d31
	mov	w0, 10
	str	w21, [sp]
	mov	w1, w23
	str	w0, [sp, 24]
	mov	w0, 9
	str	w0, [sp, 8]
	mov	w4, 4
	str	d31, [sp, 32]
	fmov	d31, 9.5e+0
	str	x22, [sp, 40]
	mov	w3, 3
	fmul	d31, d14, d31
	mov	w2, 2
	mov	w7, 7
	mov	w6, 6
	mov	w5, 5
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	str	d31, [sp, 16]
	bl	printf
	fmov	d4, 5.0e+0
	fmov	d2, d12
	fmov	d7, 8.0e+0
	fmov	d6, 7.0e+0
	fmul	d31, d14, d4
	fmov	d5, 6.0e+0
	fmov	d3, 4.0e+0
	fmov	d1, 2.0e+0
	fmov	d0, 1.0e+0
	str	xzr, [sp, 8]
	mov	w0, w22
	str	d31, [sp, 16]
	fmov	d31, 9.0e+0
	str	d31, [sp]
	bl	digits
	fmov	d26, d0
	fcvt	s0, d14
	fmov	s31, 5.0e-1
	fmov	d2, -3.0e+0
	fmov	d1, 2.25e+0
	mov	w0, 3
	fmul	s0, s0, s31
	fcvt	d0, s0
	bl	digits
	fmov	d1, d0
	fmov	d0, d26
	adrp	x0, .LC27
	add	x0, x0, :lo12:.LC27
	bl	printf
	fadd	d31, d14, d14
	mov	x0, 140737488355327
	str	x0, [sp, 32]
	adrp	x0, .LC28
	fmov	d7, d13
	fmov	d2, d11
	fmov	d0, d9
	ldr	d5, [x0, :lo12:.LC28]
	mov	x3, 15360
	fmov	d28, -1.5e+0
	fmov	d6, 1.25e-1
	fmov	d4, 4.0e+0
	fmov	d3, -7.5e-1
	fmov	d1, 1.25e+0
	movk	x3, 0x4c53, lsl 16
	str	w21, [sp]
	mov	x7, -21
	mov	w6, 100
	mov	x5, 14
	mov	w4, -9
	movk	x3, 0x10, lsl 32
	mov	w2, 3
	mov	x1, 7
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	stp	d12, d28, [sp, 8]
	str	d31, [sp, 24]
	bl	mixed.constprop.0
	adrp	x0, .LC29
	add	x0, x0, :lo12:.LC29
	bl	printf
	str	w21, [sp, 228]
	adrp	x0, .LANCHOR2+96
	adrp	x2, .LC30
	ldrsw	x1, [sp, 228]
	add	x2, x2, :lo12:.LC30
	ldr	d31, [x0, :lo12:.LANCHOR2+96]
	add	x0, sp, 232
	fmul	d0, d14, d31
	bl	snprintf
	mov	w1, w0
	add	x2, sp, 232
	adrp	x0, .LC31
	add	x0, x0, :lo12:.LC31
	bl	printf
	fmov	d2, 7.0e+0
	ldr	d1, [sp, 200]
	ldp	d0, d15, [x20, 112]
	mov	x0, x19
	fdiv	d2, d14, d2
	adrp	x1, .LC33
	add	x1, x1, :lo12:.LC33
	fmul	d0, d14, d0
	bl	sprintf
	mov	w1, w0
	mov	x2, x19
	adrp	x0, .LC34
	add	x0, x0, :lo12:.LC34
	bl	printf
	ldr	d0, [x20, 128]
	fmul	d2, d14, d15
	fmov	d1, d10
	adrp	x0, .LC37
	add	x0, x0, :lo12:.LC37
	fmul	d0, d14, d0
	bl	printf
	ldr	x23, [sp, 112]
	mov	w0, 0
	ldp	x29, x30, [sp, 64]
	ldp	x19, x20, [sp, 80]
	ldp	x21, x22, [sp, 96]
	ldp	d8, d9, [sp, 128]
	ldp	d10, d11, [sp, 144]
	ldp	d12, d13, [sp, 160]
	ldp	d14, d15, [sp, 176]
	add	sp, sp, 336
	ret
	.section .rodata
	.align	3
	.LANCHOR2:
.LC4:
	.word	-1998362383
	.word	1055193269
.LC6:
	.word	1409286144
	.word	1100836660
.LC9:
	.word	-900217577
	.word	1155522949
.LC12:
	.word	1202590843
	.word	1064598241
.LC13:
	.word	1236950581
	.word	1072693772
.LC14:
	.word	-1955535317
	.word	4712
.LC15:
	.word	-350469331
	.word	1058682594
.LC17:
	.word	-719404213
	.word	1058682594
.LC18:
	.word	-1717986918
	.word	1069128089
.LC19:
	.word	-941536522
	.word	1152724226
.LC20:
	.word	105764242
	.word	1149300943
.LC22:
	.word	279499617
	.word	1155522207
.LC23:
	.word	1405670641
	.word	1074340347
.LC28:
	.word	536870912
	.word	1107468383
.LC32:
	.word	-927712936
	.word	-1060627242
.LC35:
	.word	515396076
	.word	-1060943291
.LC36:
	.word	-468151435
	.word	1093850759
	.data
	.align	3
	.LANCHOR0:
vinf:
	.word	0
	.word	2146435072
vnan:
	.word	0
	.word	2146959360
vone:
	.word	0
	.word	1072693248
	.bss
	.align	3
	.LANCHOR1:
vzero:
	.zero	8

