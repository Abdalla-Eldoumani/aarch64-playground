	.text
	.section .rodata
	.align	3
.LC8:
	.string	"v%-2d %016lx\n"
	.align	3
.LC9:
	.string	"%-8s"
	.align	3
.LC10:
	.string	" n=%d\n"
	.align	3
.LC11:
	.string	"%.0f %.0f %.0f %.0f %.0f %.1f %.1f %.2f %.2f %.0e %.1e %.1g\n"
	.align	3
.LC12:
	.string	"r=%d\n"
	.align	3
.LC16:
	.string	"%.12f|%g|%.9e|%lf|%le|%lg\n"
	.align	3
.LC17:
	.string	"%.0f\n%.3e %g %40.10g|\n"
	.align	3
.LC19:
	.string	"%.1074f\n%.40e\n%.25g\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #320
	fmov	d30, 1.0e+0
	adrp	x0, .LANCHOR0
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	str	xzr, [sp, 136]
	stp	x25, x26, [sp, 96]
	add	x25, x0, :lo12:.LANCHOR0
	ldr	d0, [sp, 136]
	ldr	d29, [sp, 136]
	ldr	d31, [sp, 136]
	fdiv	d30, d30, d0
	stp	x19, x20, [sp, 48]
	add	x20, sp, 144
	fdiv	d31, d29, d31
	stp	x21, x22, [sp, 64]
	adrp	x21, .LC8
	ldr	q29, [x0, :lo12:.LANCHOR0]
	add	x21, x21, :lo12:.LC8
	mov	x0, 4503599627370496
	mov	w19, 0
	stp	x23, x24, [sp, 80]
	str	q29, [sp, 144]
	ldp	q28, q29, [x25, 16]
	str	x27, [sp, 112]
	str	x0, [sp, 272]
	stp	q28, q29, [sp, 160]
	ldp	q28, q29, [x25, 48]
	stp	q28, q29, [sp, 192]
	ldp	q28, q29, [x25, 80]
	stp	q28, q29, [sp, 224]
	str	d30, [sp, 280]
	fneg	d30, d30
	ldr	q29, [x25, 112]
	stp	d30, d31, [sp, 288]
	fneg	d31, d31
	str	q29, [sp, 256]
	str	d31, [sp, 304]
	.p2align 5,,15
.L2:
	ldr	x2, [x20], 8
	mov	w1, w19
	mov	x0, x21
	add	w19, w19, 1
	bl	printf
	cmp	w19, 21
	bne	.L2
	add	x24, x25, 128
	adrp	x27, .LC9
	adrp	x21, stdout
	adrp	x26, .LC10
	add	x25, x25, 424
	add	x27, x27, :lo12:.LC9
	add	x23, sp, 312
	add	x21, x21, :lo12:stdout
	add	x26, x26, :lo12:.LC10
	.p2align 5,,15
.L4:
	ldr	x22, [x24]
	mov	x0, x27
	add	x19, sp, 144
	mov	w20, 0
	mov	x1, x22
	bl	printf
	.p2align 5,,15
.L3:
	ldr	x1, [x21]
	mov	w0, 91
	bl	putc
	ldr	d0, [x19], 8
	mov	x0, x22
	bl	printf
	add	w20, w20, w0
	ldr	x1, [x21]
	mov	w0, 93
	bl	putc
	cmp	x23, x19
	bne	.L3
	mov	w1, w20
	mov	x0, x26
	add	x24, x24, 8
	bl	printf
	cmp	x25, x24
	bne	.L4
	fmov	d2, 2.5e+0
	mov	x0, 7378697629483820646
	mov	x1, 7378697629483820646
	fmov	d31, 1.25e+0
	fmov	x2, d2
	fmov	d7, 1.125e+0
	fmov	d5, 2.5e-1
	movk	x1, 0x4005, lsl 48
	fmov	d4, -5.0e-1
	fmov	d3, 3.5e+0
	fmov	d1, 1.5e+0
	fmov	d0, 5.0e-1
	movk	x0, 0x3fd6, lsl 48
	fmov	d6, x0
	stp	x1, x2, [sp]
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	stp	d31, d5, [sp, 16]
	bl	printf
	adrp	x19, .LC12
	mov	w1, w0
	add	x0, x19, :lo12:.LC12
	bl	printf
	mov	x0, 20684562497536
	movk	x0, 0x4163, lsl 48
	fmov	d5, x0
	adrp	x0, .LC13
	ldr	d4, [x0, :lo12:.LC13]
	adrp	x0, .LC14
	ldr	d3, [x0, :lo12:.LC14]
	adrp	x0, .LC15
	ldr	d2, [x0, :lo12:.LC15]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	fmov	d1, d2
	fmov	d0, d2
	bl	printf
	mov	w1, w0
	add	x0, x19, :lo12:.LC12
	bl	printf
	mov	x0, 9218868437227405311
	fmov	d2, x0
	mov	x1, -4503599627370497
	fmov	d3, x1
	fmov	d1, d2
	fmov	d0, d2
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	mov	w1, w0
	add	x0, x19, :lo12:.LC12
	bl	printf
	mov	x1, 6148914691236517205
	mov	x0, 1
	movk	x1, 0x3fd5, lsl 48
	fmov	d2, x1
	adrp	x1, .LC18
	fmov	d0, x0
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	ldr	d1, [x1, :lo12:.LC18]
	bl	printf
	mov	w1, w0
	add	x0, x19, :lo12:.LC12
	bl	printf
	ldr	x27, [sp, 112]
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	ldp	x23, x24, [sp, 80]
	ldp	x25, x26, [sp, 96]
	add	sp, sp, 320
	ret
	.section .rodata
	.align	3
.LC29:
	.string	"%f"
	.align	3
.LC30:
	.string	"%.0f"
	.align	3
.LC31:
	.string	"%#.0f"
	.align	3
.LC32:
	.string	"%.1f"
	.align	3
.LC33:
	.string	"%.2f"
	.align	3
.LC34:
	.string	"%12.4f"
	.align	3
.LC35:
	.string	"%-12.4f"
	.align	3
.LC36:
	.string	"%+f"
	.align	3
.LC37:
	.string	"% f"
	.align	3
.LC38:
	.string	"%012.3f"
	.align	3
.LC39:
	.string	"%+012.3f"
	.align	3
.LC40:
	.string	"%-+12.1f"
	.align	3
.LC41:
	.string	"%.20f"
	.align	3
.LC42:
	.string	"%F"
	.align	3
.LC43:
	.string	"%10.2F"
	.align	3
.LC44:
	.string	"%e"
	.align	3
.LC45:
	.string	"%.0e"
	.align	3
.LC46:
	.string	"%#.0e"
	.align	3
.LC47:
	.string	"%.2e"
	.align	3
.LC48:
	.string	"%E"
	.align	3
.LC49:
	.string	"%+.3e"
	.align	3
.LC50:
	.string	"%012.3e"
	.align	3
.LC51:
	.string	"%-14.2E"
	.align	3
.LC52:
	.string	"% .1e"
	.align	3
.LC53:
	.string	"%g"
	.align	3
.LC54:
	.string	"%.0g"
	.align	3
.LC55:
	.string	"%.1g"
	.align	3
.LC56:
	.string	"%.3g"
	.align	3
.LC57:
	.string	"%#g"
	.align	3
.LC58:
	.string	"%#.3g"
	.align	3
.LC59:
	.string	"%G"
	.align	3
.LC60:
	.string	"%.10g"
	.align	3
.LC61:
	.string	"%+g"
	.align	3
.LC62:
	.string	"%012g"
	.align	3
.LC63:
	.string	"%-12g"
	.align	3
.LC64:
	.string	"%.17g"
	.align	3
.LC65:
	.string	"%#.0g"
	.section .rodata
	.align	4
	.LANCHOR0:
.LC0:
	.word	0
	.word	0
	.word	0
	.word	-2147483648
.LC1:
	.word	0
	.word	1072693248
	.word	0
	.word	-1074266112
.LC2:
	.word	0
	.word	1069547520
	.word	0
	.word	1074003968
.LC3:
	.word	-1717986918
	.word	1069128089
	.word	1992864825
	.word	1076101054
.LC4:
	.word	0
	.word	1083128832
	.word	-1614907703
	.word	1090397196
.LC5:
	.word	-1998362383
	.word	1055193269
	.word	-350469331
	.word	1058682594
.LC6:
	.word	640942080
	.word	1124887541
	.word	-900217577
	.word	1155522949
.LC7:
	.word	-1023872167
	.word	27618847
	.word	1
	.word	0
fmts:
	.xword	.LC29
	.xword	.LC30
	.xword	.LC31
	.xword	.LC32
	.xword	.LC33
	.xword	.LC34
	.xword	.LC35
	.xword	.LC36
	.xword	.LC37
	.xword	.LC38
	.xword	.LC39
	.xword	.LC40
	.xword	.LC41
	.xword	.LC42
	.xword	.LC43
	.xword	.LC44
	.xword	.LC45
	.xword	.LC46
	.xword	.LC47
	.xword	.LC48
	.xword	.LC49
	.xword	.LC50
	.xword	.LC51
	.xword	.LC52
	.xword	.LC53
	.xword	.LC54
	.xword	.LC55
	.xword	.LC56
	.xword	.LC57
	.xword	.LC58
	.xword	.LC59
	.xword	.LC60
	.xword	.LC61
	.xword	.LC62
	.xword	.LC63
	.xword	.LC64
	.xword	.LC65
.LC13:
	.word	-1698910392
	.word	1048238066
.LC14:
	.word	939524096
	.word	1070805811
.LC15:
	.word	-1610612736
	.word	1069128089
.LC18:
	.word	-1717986918
	.word	1069128089

