	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%f"
	.align	3
.LC1:
	.string	"%.0f"
	.align	3
.LC2:
	.string	"%#.0f"
	.align	3
.LC3:
	.string	"%.1f"
	.align	3
.LC4:
	.string	"%.2f"
	.align	3
.LC5:
	.string	"%12.4f"
	.align	3
.LC6:
	.string	"%-12.4f"
	.align	3
.LC7:
	.string	"%+f"
	.align	3
.LC8:
	.string	"% f"
	.align	3
.LC9:
	.string	"%012.3f"
	.align	3
.LC10:
	.string	"%+012.3f"
	.align	3
.LC11:
	.string	"%-+12.1f"
	.align	3
.LC12:
	.string	"%.20f"
	.align	3
.LC13:
	.string	"%F"
	.align	3
.LC14:
	.string	"%10.2F"
	.align	3
.LC15:
	.string	"%e"
	.align	3
.LC16:
	.string	"%.0e"
	.align	3
.LC17:
	.string	"%#.0e"
	.align	3
.LC18:
	.string	"%.2e"
	.align	3
.LC19:
	.string	"%E"
	.align	3
.LC20:
	.string	"%+.3e"
	.align	3
.LC21:
	.string	"%012.3e"
	.align	3
.LC22:
	.string	"%-14.2E"
	.align	3
.LC23:
	.string	"% .1e"
	.align	3
.LC24:
	.string	"%g"
	.align	3
.LC25:
	.string	"%.0g"
	.align	3
.LC26:
	.string	"%.1g"
	.align	3
.LC27:
	.string	"%.3g"
	.align	3
.LC28:
	.string	"%#g"
	.align	3
.LC29:
	.string	"%#.3g"
	.align	3
.LC30:
	.string	"%G"
	.align	3
.LC31:
	.string	"%.10g"
	.align	3
.LC32:
	.string	"%+g"
	.align	3
.LC33:
	.string	"%012g"
	.align	3
.LC34:
	.string	"%-12g"
	.align	3
.LC35:
	.string	"%.17g"
	.align	3
.LC36:
	.string	"%#.0g"
	.align	3
fmts:
	.xword	.LC0
	.xword	.LC1
	.xword	.LC2
	.xword	.LC3
	.xword	.LC4
	.xword	.LC5
	.xword	.LC6
	.xword	.LC7
	.xword	.LC8
	.xword	.LC9
	.xword	.LC10
	.xword	.LC11
	.xword	.LC12
	.xword	.LC13
	.xword	.LC14
	.xword	.LC15
	.xword	.LC16
	.xword	.LC17
	.xword	.LC18
	.xword	.LC19
	.xword	.LC20
	.xword	.LC21
	.xword	.LC22
	.xword	.LC23
	.xword	.LC24
	.xword	.LC25
	.xword	.LC26
	.xword	.LC27
	.xword	.LC28
	.xword	.LC29
	.xword	.LC30
	.xword	.LC31
	.xword	.LC32
	.xword	.LC33
	.xword	.LC34
	.xword	.LC35
	.xword	.LC36
	.text
	.align	2
bits:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	d0, [sp, 24]
	add	x1, sp, 24
	add	x0, sp, 40
	mov	x2, 8
	bl	memcpy
	ldr	x0, [sp, 40]
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC45:
	.string	"v%-2d %016lx\n"
	.align	3
.LC46:
	.string	"%-8s"
	.align	3
.LC47:
	.string	" n=%d\n"
	.align	3
.LC48:
	.string	"%.0f %.0f %.0f %.0f %.0f %.1f %.1f %.2f %.2f %.0e %.1e %.1g\n"
	.align	3
.LC49:
	.string	"r=%d\n"
	.align	3
.LC50:
	.string	"%.12f|%g|%.9e|%lf|%le|%lg\n"
	.align	3
.LC52:
	.string	"%.0f\n%.3e %g %40.10g|\n"
	.align	3
.LC53:
	.string	"%.1074f\n%.40e\n%.25g\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #272
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	str	xzr, [sp, 216]
	ldr	d31, [sp, 216]
	fmov	d30, 1.0e+0
	fdiv	d31, d30, d31
	str	d31, [sp, 248]
	ldr	d30, [sp, 216]
	ldr	d31, [sp, 216]
	fdiv	d31, d30, d31
	str	d31, [sp, 240]
	str	xzr, [sp, 48]
	mov	x0, -9223372036854775808
	fmov	d31, x0
	str	d31, [sp, 56]
	fmov	d31, 1.0e+0
	str	d31, [sp, 64]
	fmov	d31, -1.5e+0
	str	d31, [sp, 72]
	fmov	d31, 1.25e-1
	str	d31, [sp, 80]
	fmov	d31, 2.5e+0
	str	d31, [sp, 88]
	adrp	x0, .LC37
	add	x0, x0, :lo12:.LC37
	ldr	d31, [x0]
	str	d31, [sp, 96]
	adrp	x0, .LC38
	add	x0, x0, :lo12:.LC38
	ldr	d31, [x0]
	str	d31, [sp, 104]
	mov	x0, 65970697666560
	movk	x0, 0x408f, lsl 48
	fmov	d31, x0
	str	d31, [sp, 112]
	adrp	x0, .LC39
	add	x0, x0, :lo12:.LC39
	ldr	d31, [x0]
	str	d31, [sp, 120]
	adrp	x0, .LC40
	add	x0, x0, :lo12:.LC40
	ldr	d31, [x0]
	str	d31, [sp, 128]
	adrp	x0, .LC41
	add	x0, x0, :lo12:.LC41
	ldr	d31, [x0]
	str	d31, [sp, 136]
	adrp	x0, .LC42
	add	x0, x0, :lo12:.LC42
	ldr	d31, [x0]
	str	d31, [sp, 144]
	adrp	x0, .LC43
	add	x0, x0, :lo12:.LC43
	ldr	d31, [x0]
	str	d31, [sp, 152]
	adrp	x0, .LC44
	add	x0, x0, :lo12:.LC44
	ldr	d31, [x0]
	str	d31, [sp, 160]
	mov	x0, 1
	fmov	d31, x0
	str	d31, [sp, 168]
	mov	x0, 4503599627370496
	fmov	d31, x0
	str	d31, [sp, 176]
	ldr	d31, [sp, 248]
	str	d31, [sp, 184]
	ldr	d31, [sp, 248]
	fneg	d31, d31
	str	d31, [sp, 192]
	ldr	d31, [sp, 240]
	str	d31, [sp, 200]
	ldr	d31, [sp, 240]
	fneg	d31, d31
	str	d31, [sp, 208]
	mov	w0, 21
	str	w0, [sp, 236]
	str	wzr, [sp, 268]
	b	.L4
.L5:
	ldrsw	x0, [sp, 268]
	lsl	x0, x0, 3
	add	x1, sp, 48
	ldr	d31, [x1, x0]
	fmov	d0, d31
	bl	bits
	mov	x2, x0
	ldr	w1, [sp, 268]
	adrp	x0, .LC45
	add	x0, x0, :lo12:.LC45
	bl	printf
	ldr	w0, [sp, 268]
	add	w0, w0, 1
	str	w0, [sp, 268]
.L4:
	ldr	w1, [sp, 268]
	ldr	w0, [sp, 236]
	cmp	w1, w0
	blt	.L5
	str	wzr, [sp, 264]
	b	.L6
.L9:
	str	wzr, [sp, 260]
	adrp	x0, fmts
	add	x0, x0, :lo12:fmts
	ldr	w1, [sp, 264]
	ldr	x0, [x0, x1, lsl 3]
	mov	x1, x0
	adrp	x0, .LC46
	add	x0, x0, :lo12:.LC46
	bl	printf
	str	wzr, [sp, 256]
	b	.L7
.L8:
	mov	w0, 91
	bl	putchar
	adrp	x0, fmts
	add	x0, x0, :lo12:fmts
	ldr	w1, [sp, 264]
	ldr	x2, [x0, x1, lsl 3]
	ldrsw	x0, [sp, 256]
	lsl	x0, x0, 3
	add	x1, sp, 48
	ldr	d31, [x1, x0]
	fmov	d0, d31
	mov	x0, x2
	bl	printf
	mov	w1, w0
	ldr	w0, [sp, 260]
	add	w0, w0, w1
	str	w0, [sp, 260]
	mov	w0, 93
	bl	putchar
	ldr	w0, [sp, 256]
	add	w0, w0, 1
	str	w0, [sp, 256]
.L7:
	ldr	w1, [sp, 256]
	ldr	w0, [sp, 236]
	cmp	w1, w0
	blt	.L8
	ldr	w1, [sp, 260]
	adrp	x0, .LC47
	add	x0, x0, :lo12:.LC47
	bl	printf
	ldr	w0, [sp, 264]
	add	w0, w0, 1
	str	w0, [sp, 264]
.L6:
	ldr	w0, [sp, 264]
	cmp	w0, 36
	bls	.L9
	fmov	d31, 2.5e-1
	str	d31, [sp, 24]
	fmov	d31, 1.25e+0
	str	d31, [sp, 16]
	fmov	d31, 2.5e+0
	str	d31, [sp, 8]
	mov	x0, 7378697629483820646
	movk	x0, 0x4005, lsl 48
	fmov	d31, x0
	str	d31, [sp]
	fmov	d7, 1.125e+0
	mov	x0, 7378697629483820646
	movk	x0, 0x3fd6, lsl 48
	fmov	d6, x0
	fmov	d5, 2.5e-1
	fmov	d4, -5.0e-1
	fmov	d3, 3.5e+0
	fmov	d2, 2.5e+0
	fmov	d1, 1.5e+0
	fmov	d0, 5.0e-1
	adrp	x0, .LC48
	add	x0, x0, :lo12:.LC48
	bl	printf
	str	w0, [sp, 232]
	ldr	w1, [sp, 232]
	adrp	x0, .LC49
	add	x0, x0, :lo12:.LC49
	bl	printf
	mov	w0, 52429
	movk	w0, 0x3dcc, lsl 16
	fmov	s31, w0
	str	s31, [sp, 228]
	ldr	s31, [sp, 228]
	fcvt	d29, s31
	ldr	s31, [sp, 228]
	fcvt	d28, s31
	ldr	s31, [sp, 228]
	fcvt	d27, s31
	ldr	s31, [sp, 228]
	fcvt	d30, s31
	fmov	d31, 3.0e+0
	fmul	d31, d30, d31
	mov	x0, 20684562497536
	movk	x0, 0x4163, lsl 48
	fmov	d5, x0
	adrp	x0, .LC51
	add	x0, x0, :lo12:.LC51
	ldr	d4, [x0]
	fmov	d3, d31
	fmov	d2, d27
	fmov	d1, d28
	fmov	d0, d29
	adrp	x0, .LC50
	add	x0, x0, :lo12:.LC50
	bl	printf
	str	w0, [sp, 232]
	ldr	w1, [sp, 232]
	adrp	x0, .LC49
	add	x0, x0, :lo12:.LC49
	bl	printf
	mov	x0, -4503599627370497
	fmov	d3, x0
	mov	x0, 9218868437227405311
	fmov	d2, x0
	mov	x0, 9218868437227405311
	fmov	d1, x0
	mov	x0, 9218868437227405311
	fmov	d0, x0
	adrp	x0, .LC52
	add	x0, x0, :lo12:.LC52
	bl	printf
	str	w0, [sp, 232]
	ldr	w1, [sp, 232]
	adrp	x0, .LC49
	add	x0, x0, :lo12:.LC49
	bl	printf
	mov	x0, 6148914691236517205
	movk	x0, 0x3fd5, lsl 48
	fmov	d2, x0
	adrp	x0, .LC37
	add	x0, x0, :lo12:.LC37
	ldr	d1, [x0]
	mov	x0, 1
	fmov	d0, x0
	adrp	x0, .LC53
	add	x0, x0, :lo12:.LC53
	bl	printf
	str	w0, [sp, 232]
	ldr	w1, [sp, 232]
	adrp	x0, .LC49
	add	x0, x0, :lo12:.LC49
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	add	sp, sp, 272
	ret
	.section .rodata
	.align	3
.LC37:
	.word	-1717986918
	.word	1069128089
	.align	3
.LC38:
	.word	1992864825
	.word	1076101054
	.align	3
.LC39:
	.word	-1614907703
	.word	1090397196
	.align	3
.LC40:
	.word	-1998362383
	.word	1055193269
	.align	3
.LC41:
	.word	-350469331
	.word	1058682594
	.align	3
.LC42:
	.word	640942080
	.word	1124887541
	.align	3
.LC43:
	.word	-900217577
	.word	1155522949
	.align	3
.LC44:
	.word	-1023872167
	.word	27618847
	.align	3
.LC51:
	.word	-1698910392
	.word	1048238066

