	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%d"
	.align	3
.LC1:
	.string	"%i"
	.align	3
.LC2:
	.string	"%6d"
	.align	3
.LC3:
	.string	"%-6d"
	.align	3
.LC4:
	.string	"%06d"
	.align	3
.LC5:
	.string	"%+d"
	.align	3
.LC6:
	.string	"% d"
	.align	3
.LC7:
	.string	"%+ d"
	.align	3
.LC8:
	.string	"%-+7d"
	.align	3
.LC9:
	.string	"% 07d"
	.align	3
.LC10:
	.string	"%-07d"
	.align	3
.LC11:
	.string	"%.0d"
	.align	3
.LC12:
	.string	"%4.0d"
	.align	3
.LC13:
	.string	"%+.0d"
	.align	3
.LC14:
	.string	"% .0d"
	.align	3
.LC15:
	.string	"%.4d"
	.align	3
.LC16:
	.string	"%09.4d"
	.align	3
.LC17:
	.string	"%-9.4i"
	.align	3
.LC18:
	.string	"%+.12d"
	.align	3
.LC19:
	.string	"%+012d"
	.align	3
sfmt:
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
	.align	3
.LC20:
	.string	"%u"
	.align	3
.LC21:
	.string	"%+u"
	.align	3
.LC22:
	.string	"% u"
	.align	3
.LC23:
	.string	"%.0u"
	.align	3
.LC24:
	.string	"%011u"
	.align	3
.LC25:
	.string	"%-11.7u"
	.align	3
.LC26:
	.string	"%5.0u"
	.align	3
.LC27:
	.string	"%x"
	.align	3
.LC28:
	.string	"%X"
	.align	3
.LC29:
	.string	"%#x"
	.align	3
.LC30:
	.string	"%#X"
	.align	3
.LC31:
	.string	"%#012x"
	.align	3
.LC32:
	.string	"%-#12x"
	.align	3
.LC33:
	.string	"%#.9x"
	.align	3
.LC34:
	.string	"%.0x"
	.align	3
.LC35:
	.string	"%#.0x"
	.align	3
.LC36:
	.string	"%08.3x"
	.align	3
.LC37:
	.string	"%#8.0X"
	.align	3
.LC38:
	.string	"%o"
	.align	3
.LC39:
	.string	"%#o"
	.align	3
.LC40:
	.string	"%.0o"
	.align	3
.LC41:
	.string	"%#.0o"
	.align	3
.LC42:
	.string	"%#6o"
	.align	3
.LC43:
	.string	"%#.5o"
	.align	3
.LC44:
	.string	"%07o"
	.align	3
.LC45:
	.string	"%-#9o"
	.align	3
.LC46:
	.string	"%#012o"
	.align	3
ufmt:
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
	.align	3
svals:
	.word	0
	.word	7
	.word	-7
	.word	42
	.word	100000
	.word	2147483647
	.word	-2147483648
	.align	3
uvals:
	.word	0
	.word	7
	.word	255
	.word	-2147483648
	.word	-1
	.word	342391
	.align	3
.LC47:
	.string	"%-8s"
	.align	3
.LC48:
	.string	" n=%d\n"
	.align	3
.LC49:
	.string	"total=%d\n"
	.align	3
.LC50:
	.string	"[%-+*.*d][%0*d][%#-*.*x][%*.*o]\n"
	.align	3
.LC51:
	.string	"r=%d\n"
	.align	3
.LC52:
	.string	"[%+.0d][% .0i][%#.0o][%#.0X][%.0u]\n"
	.align	3
.LC53:
	.string	"%d %i %u %x %o %X\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #96
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	str	wzr, [sp, 92]
	str	wzr, [sp, 88]
	b	.L2
.L5:
	str	wzr, [sp, 84]
	adrp	x0, sfmt
	add	x0, x0, :lo12:sfmt
	ldr	w1, [sp, 88]
	ldr	x0, [x0, x1, lsl 3]
	mov	x1, x0
	adrp	x0, .LC47
	add	x0, x0, :lo12:.LC47
	bl	printf
	str	wzr, [sp, 80]
	b	.L3
.L4:
	mov	w0, 91
	bl	putchar
	adrp	x0, sfmt
	add	x0, x0, :lo12:sfmt
	ldr	w1, [sp, 88]
	ldr	x2, [x0, x1, lsl 3]
	adrp	x0, svals
	add	x0, x0, :lo12:svals
	ldr	w1, [sp, 80]
	ldr	w0, [x0, x1, lsl 2]
	mov	w1, w0
	mov	x0, x2
	bl	printf
	mov	w1, w0
	ldr	w0, [sp, 84]
	add	w0, w0, w1
	str	w0, [sp, 84]
	mov	w0, 93
	bl	putchar
	ldr	w0, [sp, 80]
	add	w0, w0, 1
	str	w0, [sp, 80]
.L3:
	ldr	w0, [sp, 80]
	cmp	w0, 6
	bls	.L4
	ldr	w1, [sp, 84]
	adrp	x0, .LC48
	add	x0, x0, :lo12:.LC48
	bl	printf
	ldr	w1, [sp, 92]
	ldr	w0, [sp, 84]
	add	w0, w1, w0
	str	w0, [sp, 92]
	ldr	w0, [sp, 88]
	add	w0, w0, 1
	str	w0, [sp, 88]
.L2:
	ldr	w0, [sp, 88]
	cmp	w0, 19
	bls	.L5
	str	wzr, [sp, 76]
	b	.L6
.L9:
	str	wzr, [sp, 72]
	adrp	x0, ufmt
	add	x0, x0, :lo12:ufmt
	ldr	w1, [sp, 76]
	ldr	x0, [x0, x1, lsl 3]
	mov	x1, x0
	adrp	x0, .LC47
	add	x0, x0, :lo12:.LC47
	bl	printf
	str	wzr, [sp, 68]
	b	.L7
.L8:
	mov	w0, 91
	bl	putchar
	adrp	x0, ufmt
	add	x0, x0, :lo12:ufmt
	ldr	w1, [sp, 76]
	ldr	x2, [x0, x1, lsl 3]
	adrp	x0, uvals
	add	x0, x0, :lo12:uvals
	ldr	w1, [sp, 68]
	ldr	w0, [x0, x1, lsl 2]
	mov	w1, w0
	mov	x0, x2
	bl	printf
	mov	w1, w0
	ldr	w0, [sp, 72]
	add	w0, w0, w1
	str	w0, [sp, 72]
	mov	w0, 93
	bl	putchar
	ldr	w0, [sp, 68]
	add	w0, w0, 1
	str	w0, [sp, 68]
.L7:
	ldr	w0, [sp, 68]
	cmp	w0, 5
	bls	.L8
	ldr	w1, [sp, 72]
	adrp	x0, .LC48
	add	x0, x0, :lo12:.LC48
	bl	printf
	ldr	w1, [sp, 92]
	ldr	w0, [sp, 72]
	add	w0, w1, w0
	str	w0, [sp, 92]
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L6:
	ldr	w0, [sp, 76]
	cmp	w0, 26
	bls	.L9
	ldr	w1, [sp, 92]
	adrp	x0, .LC49
	add	x0, x0, :lo12:.LC49
	bl	printf
	str	wzr, [sp, 24]
	str	wzr, [sp, 16]
	mov	w0, -6
	str	w0, [sp, 8]
	mov	w0, 2748
	str	w0, [sp]
	mov	w7, 5
	mov	w6, 12
	mov	w5, -3
	mov	w4, 7
	mov	w3, -12
	mov	w2, 4
	mov	w1, 9
	adrp	x0, .LC50
	add	x0, x0, :lo12:.LC50
	bl	printf
	str	w0, [sp, 64]
	ldr	w1, [sp, 64]
	adrp	x0, .LC51
	add	x0, x0, :lo12:.LC51
	bl	printf
	mov	w5, 0
	mov	w4, 0
	mov	w3, 0
	mov	w2, 0
	mov	w1, 0
	adrp	x0, .LC52
	add	x0, x0, :lo12:.LC52
	bl	printf
	str	w0, [sp, 64]
	ldr	w1, [sp, 64]
	adrp	x0, .LC51
	add	x0, x0, :lo12:.LC51
	bl	printf
	mov	x0, 5
	movk	x0, 0x8000, lsl 16
	movk	x0, 0x5678, lsl 32
	movk	x0, 0x1234, lsl 48
	str	x0, [sp, 48]
	ldr	x0, [sp, 48]
	str	w0, [sp, 60]
	ldr	w0, [sp, 60]
	ldr	w1, [sp, 60]
	ldr	w2, [sp, 60]
	ldr	w3, [sp, 60]
	mov	w6, w3
	mov	w5, w2
	mov	w4, w1
	mov	w3, w0
	ldr	w2, [sp, 60]
	ldr	w1, [sp, 60]
	adrp	x0, .LC53
	add	x0, x0, :lo12:.LC53
	bl	printf
	str	w0, [sp, 64]
	ldr	w1, [sp, 64]
	adrp	x0, .LC51
	add	x0, x0, :lo12:.LC51
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	add	sp, sp, 96
	ret

