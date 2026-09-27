	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%-8s"
	.align	3
.LC1:
	.string	" n=%d\n"
	.align	3
.LC2:
	.string	"total=%d\n"
	.align	3
.LC3:
	.string	"[%-+*.*d][%0*d][%#-*.*x][%*.*o]\n"
	.align	3
.LC4:
	.string	"r=%d\n"
	.align	3
.LC5:
	.string	"[%+.0d][% .0i][%#.0o][%#.0X][%.0u]\n"
	.align	3
.LC6:
	.string	"%d %i %u %x %o %X\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #144
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	stp	x23, x24, [sp, 80]
	adrp	x24, .LANCHOR0
	add	x24, x24, :lo12:.LANCHOR0
	stp	x21, x22, [sp, 64]
	add	x22, x24, 188
	mov	w23, 0
	stp	x25, x26, [sp, 96]
	adrp	x25, .LC0
	adrp	x26, .LC1
	add	x25, x25, :lo12:.LC0
	add	x26, x26, :lo12:.LC1
	stp	x27, x28, [sp, 112]
	mov	x27, x24
	add	x28, x24, 160
	stp	x19, x20, [sp, 48]
	.p2align 5,,15
.L3:
	mov	x0, x25
	ldr	x21, [x27]
	add	x19, x24, 160
	mov	w20, 0
	mov	x1, x21
	bl	printf
	.p2align 5,,15
.L2:
	mov	w0, 91
	bl	putchar
	ldr	w1, [x19], 4
	mov	x0, x21
	bl	printf
	add	w20, w20, w0
	mov	w0, 93
	bl	putchar
	cmp	x19, x22
	bne	.L2
	mov	w1, w20
	mov	x0, x26
	add	x27, x27, 8
	bl	printf
	add	w23, w23, w20
	cmp	x27, x28
	bne	.L3
	add	x27, x24, 192
	add	x28, x24, 408
	add	x22, x24, 440
	.p2align 5,,15
.L5:
	ldr	x21, [x27]
	mov	x0, x25
	add	x19, x24, 416
	mov	w20, 0
	mov	x1, x21
	bl	printf
	.p2align 5,,15
.L4:
	mov	w0, 91
	bl	putchar
	ldr	w1, [x19], 4
	mov	x0, x21
	bl	printf
	add	w20, w20, w0
	mov	w0, 93
	bl	putchar
	cmp	x19, x22
	bne	.L4
	mov	w1, w20
	mov	x0, x26
	add	x27, x27, 8
	bl	printf
	add	w23, w23, w20
	cmp	x28, x27
	bne	.L5
	mov	w1, w23
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, -6
	str	w0, [sp, 8]
	mov	w0, 2748
	str	w0, [sp]
	str	wzr, [sp, 16]
	mov	w7, 5
	str	wzr, [sp, 24]
	mov	w6, 12
	mov	w5, -3
	mov	w4, 7
	mov	w3, -12
	mov	w2, 4
	mov	w1, 9
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	adrp	x19, .LC4
	mov	w1, w0
	add	x0, x19, :lo12:.LC4
	bl	printf
	mov	w5, 0
	mov	w4, 0
	mov	w3, 0
	mov	w2, 0
	mov	w1, 0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w1, w0
	add	x0, x19, :lo12:.LC4
	bl	printf
	mov	x0, 5
	movk	x0, 0x8000, lsl 16
	movk	x0, 0x5678, lsl 32
	movk	x0, 0x1234, lsl 48
	str	x0, [sp, 136]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	ldr	x1, [sp, 136]
	mov	w6, w1
	mov	w5, w1
	mov	w4, w1
	mov	w3, w1
	mov	w2, w1
	bl	printf
	mov	w1, w0
	add	x0, x19, :lo12:.LC4
	bl	printf
	ldp	x29, x30, [sp, 32]
	mov	w0, 0
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	ldp	x23, x24, [sp, 80]
	ldp	x25, x26, [sp, 96]
	ldp	x27, x28, [sp, 112]
	add	sp, sp, 144
	ret
	.section .rodata
	.align	3
.LC7:
	.string	"%u"
	.align	3
.LC8:
	.string	"%+u"
	.align	3
.LC9:
	.string	"% u"
	.align	3
.LC10:
	.string	"%.0u"
	.align	3
.LC11:
	.string	"%011u"
	.align	3
.LC12:
	.string	"%-11.7u"
	.align	3
.LC13:
	.string	"%5.0u"
	.align	3
.LC14:
	.string	"%x"
	.align	3
.LC15:
	.string	"%X"
	.align	3
.LC16:
	.string	"%#x"
	.align	3
.LC17:
	.string	"%#X"
	.align	3
.LC18:
	.string	"%#012x"
	.align	3
.LC19:
	.string	"%-#12x"
	.align	3
.LC20:
	.string	"%#.9x"
	.align	3
.LC21:
	.string	"%.0x"
	.align	3
.LC22:
	.string	"%#.0x"
	.align	3
.LC23:
	.string	"%08.3x"
	.align	3
.LC24:
	.string	"%#8.0X"
	.align	3
.LC25:
	.string	"%o"
	.align	3
.LC26:
	.string	"%#o"
	.align	3
.LC27:
	.string	"%.0o"
	.align	3
.LC28:
	.string	"%#.0o"
	.align	3
.LC29:
	.string	"%#6o"
	.align	3
.LC30:
	.string	"%#.5o"
	.align	3
.LC31:
	.string	"%07o"
	.align	3
.LC32:
	.string	"%-#9o"
	.align	3
.LC33:
	.string	"%#012o"
	.align	3
.LC34:
	.string	"%d"
	.align	3
.LC35:
	.string	"%i"
	.align	3
.LC36:
	.string	"%6d"
	.align	3
.LC37:
	.string	"%-6d"
	.align	3
.LC38:
	.string	"%06d"
	.align	3
.LC39:
	.string	"%+d"
	.align	3
.LC40:
	.string	"% d"
	.align	3
.LC41:
	.string	"%+ d"
	.align	3
.LC42:
	.string	"%-+7d"
	.align	3
.LC43:
	.string	"% 07d"
	.align	3
.LC44:
	.string	"%-07d"
	.align	3
.LC45:
	.string	"%.0d"
	.align	3
.LC46:
	.string	"%4.0d"
	.align	3
.LC47:
	.string	"%+.0d"
	.align	3
.LC48:
	.string	"% .0d"
	.align	3
.LC49:
	.string	"%.4d"
	.align	3
.LC50:
	.string	"%09.4d"
	.align	3
.LC51:
	.string	"%-9.4i"
	.align	3
.LC52:
	.string	"%+.12d"
	.align	3
.LC53:
	.string	"%+012d"
	.section .rodata
	.align	4
	.LANCHOR0:
sfmt:
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
svals:
	.word	0
	.word	7
	.word	-7
	.word	42
	.word	100000
	.word	2147483647
	.word	-2147483648
	.zero	4
ufmt:
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
	.zero	8
uvals:
	.word	0
	.word	7
	.word	255
	.word	-2147483648
	.word	-1
	.word	342391

