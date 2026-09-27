	.text
	.section .rodata
	.align	3
.LC0:
	.string	"w=%2d"
	.align	3
.LC3:
	.string	" [%*.*f][%*.*d][%*.*s][%*.*e][%*.*x]"
	.align	3
.LC4:
	.string	"string"
	.align	3
.LC5:
	.string	" r=%d\n"
	.align	3
.LC8:
	.string	"p=%d [%.*g][%#.*g][%-+*.*g][%0*.*f]\n"
	.align	3
.LC14:
	.string	"str"
	.align	3
.LC16:
	.string	"%d %f %*d %.*f %s %c %ld %e %u %g %x %.2f %d %f %d %f %*s| %d %.3e %c %d %g %lu %f %-*.*s| %hhd %hd %5.1f %i %o\n"
	.align	3
.LC17:
	.string	"leftcut"
	.align	3
.LC19:
	.string	"right"
	.align	3
.LC20:
	.string	"printf r=%d\n"
	.align	3
.LC21:
	.string	"fprintf r=%d\n"
	.align	3
.LC22:
	.string	"sprintf=%d snprintf=%d same=%d len=%zu\n"
	.align	3
.LC23:
	.string	"%d %d %d %d %d %d %d [%*d][%-*d][%.*d][%*.*s]\n"
	.align	3
.LC24:
	.string	"abcdef"
	.align	3
.LC25:
	.string	"r=%d\n"
	.align	3
.LC26:
	.string	"%f %f %f %f %f %f %f %f [%*.*f][%*.*e][%-*.*g]\n"
	.align	3
.LC27:
	.string	"%*d"
	.align	3
.LC28:
	.string	"n=%d head=[%s]\n"
	.align	3
.LC29:
	.string	"%-*d|"
	.align	3
.LC30:
	.string	"%.*d"
	.align	3
.LC31:
	.string	"%.*f"
	.align	3
.LC32:
	.string	"x"
	.align	3
.LC33:
	.string	"%5000s|%4097c"
	.align	3
.LC34:
	.string	"%*d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #352
	adrp	x0, .LC1
	stp	x29, x30, [sp, 176]
	add	x29, sp, 176
	stp	d14, d15, [sp, 288]
	ldr	d15, [x0, :lo12:.LC1]
	adrp	x0, .LC2
	stp	x21, x22, [sp, 208]
	adrp	x22, .LC4
	ldr	d14, [x0, :lo12:.LC2]
	add	x22, x22, :lo12:.LC4
	stp	x23, x24, [sp, 224]
	adrp	x23, .LC3
	add	x23, x23, :lo12:.LC3
	stp	x25, x26, [sp, 240]
	adrp	x26, .LC0
	adrp	x25, .LC5
	add	x26, x26, :lo12:.LC0
	add	x25, x25, :lo12:.LC5
	mov	w24, 48879
	stp	x19, x20, [sp, 192]
	mov	w20, -9
	stp	x27, x28, [sp, 256]
	stp	d12, d13, [sp, 272]
	.align 5
.L3:
	mov	w19, -2
	mov	w21, 0
	mov	w1, w20
	mov	x0, x26
	bl	printf
.L2:
	fmov	d1, d15
	fmov	d0, d14
	str	x22, [sp]
	mov	w7, w19
	str	w20, [sp, 8]
	mov	w4, w19
	str	w19, [sp, 16]
	mov	w2, w19
	str	w20, [sp, 24]
	mov	w6, w20
	str	w19, [sp, 32]
	mov	w3, w20
	str	w24, [sp, 40]
	mov	w1, w20
	mov	x0, x23
	mov	w5, -42
	add	w19, w19, 2
	bl	printf
	add	w21, w21, w0
	cmp	w19, 8
	bne	.L2
	mov	w1, w21
	mov	x0, x25
	add	w20, w20, 3
	bl	printf
	cmp	w20, 12
	bne	.L3
	adrp	x0, .LC6
	adrp	x21, .LC8
	add	x21, x21, :lo12:.LC8
	mov	w19, -1
	ldr	d13, [x0, :lo12:.LC6]
	adrp	x0, .LC7
	adrp	x20, .LANCHOR0
	ldr	d12, [x0, :lo12:.LC7]
	.align 5
.L4:
	fmov	d2, d13
	fmov	d0, d12
	mov	w7, w19
	mov	w5, w19
	mov	w3, w19
	mov	w2, w19
	fmov	d3, -2.5e+0
	fmov	d1, 5.0e-1
	mov	w6, 12
	mov	w4, -12
	mov	w1, w19
	mov	x0, x21
	bl	printf
	add	w19, w19, 1
	mov	w1, w0
	mov	x0, x25
	bl	printf
	cmp	w19, 8
	bne	.L4
	adrp	x0, .LC14
	add	x1, x0, :lo12:.LC14
	adrp	x0, .LC16
	add	x8, x0, :lo12:.LC16
	mov	x0, 70368744177664
	add	x20, x20, :lo12:.LANCHOR0
	movk	x0, 0x4030, lsl 48
	fmov	d15, x0
	adrp	x0, .LC9
	mov	x12, 59391
	ldr	d14, [x20, 80]
	movk	x12, 0x4876, lsl 16
	ldr	d7, [x0, :lo12:.LC9]
	adrp	x0, .LC10
	mov	w28, 10240
	mov	x7, -6676
	ldr	d5, [x0, :lo12:.LC10]
	adrp	x0, .LC11
	fmov	d13, -7.75e+0
	mov	w21, 3
	ldr	d4, [x0, :lo12:.LC11]
	adrp	x0, .LC12
	mov	w25, 12
	mov	w27, -11
	ldr	d3, [x0, :lo12:.LC12]
	adrp	x0, .LC13
	mov	w26, 57005
	movk	w28, 0xee6b, lsl 16
	ldr	d2, [x0, :lo12:.LC13]
	adrp	x0, .LC15
	mov	w4, w21
	mov	x5, x1
	ldr	d1, [x0, :lo12:.LC15]
	mov	w18, 17
	mov	w15, 40000
	mov	w14, -200
	mov	w13, -8
	movk	x12, 0x17, lsl 32
	mov	w11, 14
	mov	w10, 122
	mov	w9, 13
	fmov	d6, -5.0e-1
	fmov	d0, 1.5e+0
	movk	x7, 0x4166, lsl 16
	str	w28, [sp]
	movk	x7, 0xffe3, lsl 32
	str	w26, [sp, 8]
	mov	w6, 81
	str	w27, [sp, 16]
	mov	w3, 22
	str	w25, [sp, 24]
	mov	w2, 6
	mov	w22, 7
	mov	x20, x1
	mov	x0, x8
	mov	w1, -1
	adrp	x24, .LC17
	adrp	x23, .LC19
	add	x24, x24, :lo12:.LC17
	add	x23, x23, :lo12:.LC19
	str	w22, [sp, 32]
	str	x23, [sp, 40]
	str	w9, [sp, 48]
	str	w10, [sp, 56]
	str	w11, [sp, 64]
	str	d14, [sp, 72]
	str	x12, [sp, 80]
	str	d15, [sp, 88]
	str	w13, [sp, 96]
	str	w21, [sp, 104]
	str	x24, [sp, 112]
	str	w14, [sp, 120]
	str	w15, [sp, 128]
	str	d13, [sp, 136]
	str	w18, [sp, 144]
	str	w19, [sp, 152]
	str	x8, [sp, 312]
	bl	printf
	mov	w1, w0
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	printf
	mov	x1, -6676
	adrp	x8, stdout
	movk	x1, 0x4166, lsl 16
	mov	x12, 59391
	movk	x1, 0xffe3, lsl 32
	str	x1, [sp]
	adrp	x1, .LC9
	movk	x12, 0x4876, lsl 16
	ldr	x0, [x8, :lo12:stdout]
	mov	x6, x20
	ldr	d7, [x1, :lo12:.LC9]
	adrp	x1, .LC10
	mov	w5, w21
	mov	w18, 17
	ldr	d5, [x1, :lo12:.LC10]
	adrp	x1, .LC11
	mov	w15, 40000
	mov	w14, -200
	ldr	d4, [x1, :lo12:.LC11]
	adrp	x1, .LC12
	mov	w13, -8
	movk	x12, 0x17, lsl 32
	ldr	d3, [x1, :lo12:.LC12]
	adrp	x1, .LC13
	mov	w11, 14
	mov	w10, 122
	ldr	d2, [x1, :lo12:.LC13]
	adrp	x1, .LC15
	mov	w9, 13
	fmov	d6, -5.0e-1
	ldr	d1, [x1, :lo12:.LC15]
	fmov	d0, 1.5e+0
	ldr	x1, [sp, 312]
	str	w28, [sp, 8]
	mov	w7, 81
	mov	w4, 22
	mov	w3, 6
	mov	w2, -1
	str	w26, [sp, 16]
	str	w27, [sp, 24]
	str	w25, [sp, 32]
	str	w22, [sp, 40]
	str	x23, [sp, 48]
	str	w9, [sp, 56]
	str	w10, [sp, 64]
	str	w11, [sp, 72]
	str	d14, [sp, 80]
	str	x12, [sp, 88]
	str	d15, [sp, 96]
	str	w13, [sp, 104]
	str	w21, [sp, 112]
	str	x24, [sp, 120]
	str	w14, [sp, 128]
	str	w15, [sp, 136]
	str	d13, [sp, 144]
	str	w18, [sp, 152]
	str	w19, [sp, 160]
	str	x20, [sp, 320]
	bl	fprintf
	mov	w1, w0
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	printf
	mov	x0, -6676
	mov	x12, 59391
	movk	x0, 0x4166, lsl 16
	movk	x12, 0x4876, lsl 16
	movk	x0, 0xffe3, lsl 32
	str	x0, [sp]
	adrp	x0, .LC9
	mov	w18, 17
	ldp	x1, x6, [sp, 312]
	mov	w15, 40000
	ldr	d7, [x0, :lo12:.LC9]
	adrp	x0, .LC10
	mov	w14, -200
	mov	w13, -8
	ldr	d5, [x0, :lo12:.LC10]
	adrp	x0, .LC11
	movk	x12, 0x17, lsl 32
	mov	w11, 14
	ldr	d4, [x0, :lo12:.LC11]
	adrp	x0, .LC12
	mov	w10, 122
	mov	w9, 13
	ldr	d3, [x0, :lo12:.LC12]
	adrp	x0, .LC13
	fmov	d6, -5.0e-1
	fmov	d0, 1.5e+0
	ldr	d2, [x0, :lo12:.LC13]
	adrp	x0, .LC15
	str	w28, [sp, 8]
	adrp	x20, .LANCHOR1
	ldr	d1, [x0, :lo12:.LC15]
	add	x20, x20, :lo12:.LANCHOR1
	str	w26, [sp, 16]
	mov	w5, w21
	mov	x0, x20
	mov	w7, 81
	mov	w4, 22
	mov	w3, 6
	mov	w2, -1
	str	w27, [sp, 24]
	str	w25, [sp, 32]
	str	w22, [sp, 40]
	str	x23, [sp, 48]
	str	w9, [sp, 56]
	str	w10, [sp, 64]
	str	w11, [sp, 72]
	str	d14, [sp, 80]
	str	x12, [sp, 88]
	str	d15, [sp, 96]
	str	w13, [sp, 104]
	str	w21, [sp, 112]
	str	x24, [sp, 120]
	str	w14, [sp, 128]
	str	w15, [sp, 136]
	str	d13, [sp, 144]
	str	w18, [sp, 152]
	str	w19, [sp, 160]
	bl	sprintf
	mov	x3, -6676
	mov	x12, 59391
	movk	x3, 0x4166, lsl 16
	movk	x12, 0x4876, lsl 16
	movk	x3, 0xffe3, lsl 32
	str	x3, [sp, 8]
	adrp	x3, .LC9
	mov	w18, 17
	ldp	x2, x7, [sp, 312]
	mov	w15, 40000
	ldr	d7, [x3, :lo12:.LC9]
	adrp	x3, .LC10
	mov	w14, -200
	mov	w13, -8
	ldr	d5, [x3, :lo12:.LC10]
	adrp	x3, .LC11
	movk	x12, 0x17, lsl 32
	mov	w11, 14
	ldr	d4, [x3, :lo12:.LC11]
	adrp	x3, .LC12
	mov	w10, 122
	mov	w9, 13
	ldr	d3, [x3, :lo12:.LC12]
	adrp	x3, .LC13
	fmov	d6, -5.0e-1
	fmov	d0, 1.5e+0
	ldr	d2, [x3, :lo12:.LC13]
	adrp	x3, .LC15
	str	w0, [sp, 332]
	mov	w0, 81
	ldr	d1, [x3, :lo12:.LC15]
	mov	w6, w21
	str	w0, [sp]
	mov	w5, 22
	mov	w4, 6
	mov	w3, -1
	add	x0, x20, 256
	mov	x1, 256
	str	w28, [sp, 16]
	str	w26, [sp, 24]
	mov	w26, 4
	str	w27, [sp, 32]
	mov	w27, 10
	str	w25, [sp, 40]
	str	w22, [sp, 48]
	str	x23, [sp, 56]
	str	w9, [sp, 64]
	str	w10, [sp, 72]
	str	w11, [sp, 80]
	str	d14, [sp, 88]
	str	x12, [sp, 96]
	str	d15, [sp, 104]
	str	w13, [sp, 112]
	str	w21, [sp, 120]
	str	x24, [sp, 128]
	str	w14, [sp, 136]
	str	w15, [sp, 144]
	str	d13, [sp, 152]
	str	w18, [sp, 160]
	str	w19, [sp, 168]
	bl	snprintf
	add	x1, x20, 256
	mov	w23, w0
	mov	x0, x20
	bl	strcmp
	mov	w24, w0
	mov	x0, x20
	bl	strlen
	mov	x4, x0
	ldr	w1, [sp, 332]
	cmp	w24, 0
	cset	w3, eq
	mov	w2, w23
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	mov	w24, 2
	adrp	x23, .LC25
	bl	printf
	adrp	x8, stdout
	add	x0, x20, 256
	ldr	x1, [x8, :lo12:stdout]
	bl	fputs
	str	w19, [sp, 8]
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	mov	w7, w22
	mov	w5, 5
	mov	w4, w26
	mov	w3, w21
	mov	w2, w24
	mov	w6, 6
	str	w5, [sp]
	mov	w1, 1
	str	w5, [sp, 16]
	adrp	x19, .LC28
	str	w26, [sp, 32]
	str	w27, [sp, 40]
	str	w6, [sp, 48]
	str	w24, [sp, 56]
	str	x0, [sp, 64]
	mov	w0, 9
	str	w0, [sp, 24]
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	bl	printf
	mov	w1, w0
	add	x0, x23, :lo12:.LC25
	bl	printf
	fmov	d31, 1.1e+1
	mov	w6, w26
	fmov	d30, 1.0e+1
	fmov	d7, 8.0e+0
	fmov	d6, 7.0e+0
	fmov	d5, 6.0e+0
	fmov	d4, 5.0e+0
	fmov	d3, 4.0e+0
	fmov	d2, 3.0e+0
	fmov	d1, 2.0e+0
	fmov	d0, 1.0e+0
	mov	w4, w24
	mov	w3, w25
	mov	w2, w21
	str	d31, [sp, 16]
	fmov	d31, 9.0e+0
	mov	w5, -9
	mov	w1, w27
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	stp	d31, d30, [sp]
	bl	printf
	mov	w1, w0
	add	x0, x23, :lo12:.LC25
	bl	printf
	mov	w0, 5000
	str	w0, [sp, 336]
	mov	w0, 4500
	str	w0, [sp, 340]
	mov	w4, w22
	mov	x0, x20
	ldr	w3, [sp, 336]
	mov	x1, 16
	adrp	x2, .LC27
	add	x2, x2, :lo12:.LC27
	bl	snprintf
	mov	w1, w0
	mov	x2, x20
	add	x0, x19, :lo12:.LC28
	bl	printf
	ldr	w3, [sp, 336]
	mov	w4, w22
	mov	x0, x20
	mov	x1, 16
	adrp	x2, .LC29
	add	x2, x2, :lo12:.LC29
	bl	snprintf
	mov	w1, w0
	mov	x2, x20
	add	x0, x19, :lo12:.LC28
	bl	printf
	ldr	w3, [sp, 340]
	mov	w4, w22
	mov	x0, x20
	mov	x1, 16
	adrp	x2, .LC30
	add	x2, x2, :lo12:.LC30
	bl	snprintf
	mov	w1, w0
	mov	x2, x20
	add	x0, x19, :lo12:.LC28
	bl	printf
	ldr	w3, [sp, 340]
	fmov	d0, 1.0e+0
	mov	x0, x20
	mov	x1, 16
	adrp	x2, .LC31
	add	x2, x2, :lo12:.LC31
	bl	snprintf
	mov	w1, w0
	mov	x2, x20
	add	x0, x19, :lo12:.LC28
	bl	printf
	mov	x0, 16
	str	x0, [sp, 344]
	adrp	x3, .LC32
	add	x3, x3, :lo12:.LC32
	ldr	x1, [sp, 344]
	mov	w4, 121
	mov	x0, x20
	adrp	x2, .LC33
	add	x2, x2, :lo12:.LC33
	bl	snprintf
	mov	w1, w0
	mov	x2, x20
	add	x0, x19, :lo12:.LC28
	bl	printf
	ldr	w1, [sp, 336]
	mov	w2, 42
	adrp	x0, .LC34
	add	x0, x0, :lo12:.LC34
	bl	printf
	mov	w1, w0
	add	x0, x23, :lo12:.LC25
	bl	printf
	ldp	x29, x30, [sp, 176]
	mov	w0, 0
	ldp	x19, x20, [sp, 192]
	ldp	x21, x22, [sp, 208]
	ldp	x23, x24, [sp, 224]
	ldp	x25, x26, [sp, 240]
	ldp	x27, x28, [sp, 256]
	ldp	d12, d13, [sp, 272]
	ldp	d14, d15, [sp, 288]
	add	sp, sp, 352
	ret
	.section .rodata
	.align	3
	.LANCHOR0:
.LC1:
	.word	-194063802
	.word	1059069745
.LC2:
	.word	-266631570
	.word	1074340345
.LC6:
	.word	-1998362383
	.word	1055193269
.LC7:
	.word	446676599
	.word	1079958831
.LC9:
	.word	-1155586721
	.word	1060410379
.LC10:
	.word	536870912
	.word	1107468383
.LC11:
	.word	1202590843
	.word	1076099809
.LC12:
	.word	-755914244
	.word	1062232653
.LC13:
	.word	279499617
	.word	1155522207
.LC15:
	.word	-1783957616
	.word	1074118409
.LC18:
	.word	-640172613
	.word	1037794527
	.bss
	.align	4
	.LANCHOR1:
buf:
	.zero	256
buf2:
	.zero	256

