	.text
	.section .rodata
	.align	3
.LC0:
	.string	"w=%2d"
	.align	3
.LC1:
	.string	" [%*.*f][%*.*d][%*.*s][%*.*e][%*.*x]"
	.align	3
.LC2:
	.string	"string"
	.align	3
.LC5:
	.string	" r=%d\n"
	.align	3
.LC6:
	.string	"p=%d [%.*g][%#.*g][%-+*.*g][%0*.*f]\n"
	.align	3
.LC9:
	.string	"str"
	.align	3
.LC10:
	.string	"%d %f %*d %.*f %s %c %ld %e %u %g %x %.2f %d %f %d %f %*s| %d %.3e %c %d %g %lu %f %-*.*s| %hhd %hd %5.1f %i %o\n"
	.align	3
.LC11:
	.string	"leftcut"
	.align	3
.LC13:
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
	.global	main
main:
	sub	sp, sp, #256
	stp	x29, x30, [sp, 176]
	add	x29, sp, 176
	str	x19, [sp, 192]
	mov	w0, -9
	str	w0, [sp, 248]
	b	.L2
.L5:
	str	wzr, [sp, 252]
	ldr	w1, [sp, 248]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, -2
	str	w0, [sp, 244]
	b	.L3
.L4:
	mov	w0, 48879
	str	w0, [sp, 40]
	ldr	w0, [sp, 244]
	str	w0, [sp, 32]
	ldr	w0, [sp, 248]
	str	w0, [sp, 24]
	ldr	w0, [sp, 244]
	str	w0, [sp, 16]
	ldr	w0, [sp, 248]
	str	w0, [sp, 8]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	str	x0, [sp]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	ldr	d1, [x0]
	ldr	w7, [sp, 244]
	ldr	w6, [sp, 248]
	mov	w5, -42
	ldr	w4, [sp, 244]
	ldr	w3, [sp, 248]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	ldr	d0, [x0]
	ldr	w2, [sp, 244]
	ldr	w1, [sp, 248]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w1, w0
	ldr	w0, [sp, 252]
	add	w0, w0, w1
	str	w0, [sp, 252]
	ldr	w0, [sp, 244]
	add	w0, w0, 2
	str	w0, [sp, 244]
.L3:
	ldr	w0, [sp, 244]
	cmp	w0, 6
	ble	.L4
	ldr	w1, [sp, 252]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [sp, 248]
	add	w0, w0, 3
	str	w0, [sp, 248]
.L2:
	ldr	w0, [sp, 248]
	cmp	w0, 9
	ble	.L5
	mov	w0, -1
	str	w0, [sp, 240]
	b	.L6
.L7:
	fmov	d3, -2.5e+0
	ldr	w7, [sp, 240]
	mov	w6, 12
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	ldr	d2, [x0]
	ldr	w5, [sp, 240]
	mov	w4, -12
	fmov	d1, 5.0e-1
	ldr	w3, [sp, 240]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	ldr	d0, [x0]
	ldr	w2, [sp, 240]
	ldr	w1, [sp, 240]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	str	w0, [sp, 252]
	ldr	w1, [sp, 252]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [sp, 240]
	add	w0, w0, 1
	str	w0, [sp, 240]
.L6:
	ldr	w0, [sp, 240]
	cmp	w0, 7
	ble	.L7
	mov	w0, 8
	str	w0, [sp, 152]
	mov	w0, 17
	str	w0, [sp, 144]
	fmov	d31, -7.75e+0
	str	d31, [sp, 136]
	mov	w0, 40000
	str	w0, [sp, 128]
	mov	w0, -200
	str	w0, [sp, 120]
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	str	x0, [sp, 112]
	mov	w0, 3
	str	w0, [sp, 104]
	mov	w0, -8
	str	w0, [sp, 96]
	mov	x0, 70368744177664
	movk	x0, 0x4030, lsl 48
	fmov	d31, x0
	str	d31, [sp, 88]
	mov	x0, 59391
	movk	x0, 0x4876, lsl 16
	movk	x0, 0x17, lsl 32
	str	x0, [sp, 80]
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	ldr	d31, [x0]
	str	d31, [sp, 72]
	mov	w0, 14
	str	w0, [sp, 64]
	mov	w0, 122
	str	w0, [sp, 56]
	mov	w0, 13
	str	w0, [sp, 48]
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	str	x0, [sp, 40]
	mov	w0, 7
	str	w0, [sp, 32]
	mov	w0, 12
	str	w0, [sp, 24]
	mov	w0, -11
	str	w0, [sp, 16]
	mov	w0, 57005
	str	w0, [sp, 8]
	mov	w0, 10240
	movk	w0, 0xee6b, lsl 16
	str	w0, [sp]
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	ldr	d7, [x0]
	fmov	d6, -5.0e-1
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	ldr	d5, [x0]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	ldr	d4, [x0]
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	ldr	d3, [x0]
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	ldr	d2, [x0]
	mov	x7, -6676
	movk	x7, 0x4166, lsl 16
	movk	x7, 0xffe3, lsl 32
	mov	w6, 81
	adrp	x0, .LC9
	add	x5, x0, :lo12:.LC9
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	ldr	d1, [x0]
	mov	w4, 3
	mov	w3, 22
	mov	w2, 6
	fmov	d0, 1.5e+0
	mov	w1, -1
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	str	w0, [sp, 252]
	ldr	w1, [sp, 252]
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	printf
	adrp	x0, stdout
	add	x0, x0, :lo12:stdout
	ldr	x8, [x0]
	mov	w0, 8
	str	w0, [sp, 160]
	mov	w0, 17
	str	w0, [sp, 152]
	fmov	d31, -7.75e+0
	str	d31, [sp, 144]
	mov	w0, 40000
	str	w0, [sp, 136]
	mov	w0, -200
	str	w0, [sp, 128]
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	str	x0, [sp, 120]
	mov	w0, 3
	str	w0, [sp, 112]
	mov	w0, -8
	str	w0, [sp, 104]
	mov	x0, 70368744177664
	movk	x0, 0x4030, lsl 48
	fmov	d31, x0
	str	d31, [sp, 96]
	mov	x0, 59391
	movk	x0, 0x4876, lsl 16
	movk	x0, 0x17, lsl 32
	str	x0, [sp, 88]
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	ldr	d31, [x0]
	str	d31, [sp, 80]
	mov	w0, 14
	str	w0, [sp, 72]
	mov	w0, 122
	str	w0, [sp, 64]
	mov	w0, 13
	str	w0, [sp, 56]
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	str	x0, [sp, 48]
	mov	w0, 7
	str	w0, [sp, 40]
	mov	w0, 12
	str	w0, [sp, 32]
	mov	w0, -11
	str	w0, [sp, 24]
	mov	w0, 57005
	str	w0, [sp, 16]
	mov	w0, 10240
	movk	w0, 0xee6b, lsl 16
	str	w0, [sp, 8]
	mov	x0, -6676
	movk	x0, 0x4166, lsl 16
	movk	x0, 0xffe3, lsl 32
	str	x0, [sp]
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	ldr	d7, [x0]
	fmov	d6, -5.0e-1
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	ldr	d5, [x0]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	ldr	d4, [x0]
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	ldr	d3, [x0]
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	ldr	d2, [x0]
	mov	w7, 81
	adrp	x0, .LC9
	add	x6, x0, :lo12:.LC9
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	ldr	d1, [x0]
	mov	w5, 3
	mov	w4, 22
	mov	w3, 6
	fmov	d0, 1.5e+0
	mov	w2, -1
	adrp	x0, .LC10
	add	x1, x0, :lo12:.LC10
	mov	x0, x8
	bl	fprintf
	str	w0, [sp, 252]
	ldr	w1, [sp, 252]
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	printf
	mov	w0, 8
	str	w0, [sp, 160]
	mov	w0, 17
	str	w0, [sp, 152]
	fmov	d31, -7.75e+0
	str	d31, [sp, 144]
	mov	w0, 40000
	str	w0, [sp, 136]
	mov	w0, -200
	str	w0, [sp, 128]
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	str	x0, [sp, 120]
	mov	w0, 3
	str	w0, [sp, 112]
	mov	w0, -8
	str	w0, [sp, 104]
	mov	x0, 70368744177664
	movk	x0, 0x4030, lsl 48
	fmov	d31, x0
	str	d31, [sp, 96]
	mov	x0, 59391
	movk	x0, 0x4876, lsl 16
	movk	x0, 0x17, lsl 32
	str	x0, [sp, 88]
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	ldr	d31, [x0]
	str	d31, [sp, 80]
	mov	w0, 14
	str	w0, [sp, 72]
	mov	w0, 122
	str	w0, [sp, 64]
	mov	w0, 13
	str	w0, [sp, 56]
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	str	x0, [sp, 48]
	mov	w0, 7
	str	w0, [sp, 40]
	mov	w0, 12
	str	w0, [sp, 32]
	mov	w0, -11
	str	w0, [sp, 24]
	mov	w0, 57005
	str	w0, [sp, 16]
	mov	w0, 10240
	movk	w0, 0xee6b, lsl 16
	str	w0, [sp, 8]
	mov	x0, -6676
	movk	x0, 0x4166, lsl 16
	movk	x0, 0xffe3, lsl 32
	str	x0, [sp]
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	ldr	d7, [x0]
	fmov	d6, -5.0e-1
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	ldr	d5, [x0]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	ldr	d4, [x0]
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	ldr	d3, [x0]
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	ldr	d2, [x0]
	mov	w7, 81
	adrp	x0, .LC9
	add	x6, x0, :lo12:.LC9
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	ldr	d1, [x0]
	mov	w5, 3
	mov	w4, 22
	mov	w3, 6
	fmov	d0, 1.5e+0
	mov	w2, -1
	adrp	x0, .LC10
	add	x1, x0, :lo12:.LC10
	adrp	x0, buf
	add	x0, x0, :lo12:buf
	bl	sprintf
	str	w0, [sp, 236]
	mov	w0, 8
	str	w0, [sp, 168]
	mov	w0, 17
	str	w0, [sp, 160]
	fmov	d31, -7.75e+0
	str	d31, [sp, 152]
	mov	w0, 40000
	str	w0, [sp, 144]
	mov	w0, -200
	str	w0, [sp, 136]
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	str	x0, [sp, 128]
	mov	w0, 3
	str	w0, [sp, 120]
	mov	w0, -8
	str	w0, [sp, 112]
	mov	x0, 70368744177664
	movk	x0, 0x4030, lsl 48
	fmov	d31, x0
	str	d31, [sp, 104]
	mov	x0, 59391
	movk	x0, 0x4876, lsl 16
	movk	x0, 0x17, lsl 32
	str	x0, [sp, 96]
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	ldr	d31, [x0]
	str	d31, [sp, 88]
	mov	w0, 14
	str	w0, [sp, 80]
	mov	w0, 122
	str	w0, [sp, 72]
	mov	w0, 13
	str	w0, [sp, 64]
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	str	x0, [sp, 56]
	mov	w0, 7
	str	w0, [sp, 48]
	mov	w0, 12
	str	w0, [sp, 40]
	mov	w0, -11
	str	w0, [sp, 32]
	mov	w0, 57005
	str	w0, [sp, 24]
	mov	w0, 10240
	movk	w0, 0xee6b, lsl 16
	str	w0, [sp, 16]
	mov	x0, -6676
	movk	x0, 0x4166, lsl 16
	movk	x0, 0xffe3, lsl 32
	str	x0, [sp, 8]
	mov	w0, 81
	str	w0, [sp]
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	ldr	d7, [x0]
	fmov	d6, -5.0e-1
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	ldr	d5, [x0]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	ldr	d4, [x0]
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	ldr	d3, [x0]
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	ldr	d2, [x0]
	adrp	x0, .LC9
	add	x7, x0, :lo12:.LC9
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	ldr	d1, [x0]
	mov	w6, 3
	mov	w5, 22
	mov	w4, 6
	fmov	d0, 1.5e+0
	mov	w3, -1
	adrp	x0, .LC10
	add	x2, x0, :lo12:.LC10
	mov	x1, 256
	adrp	x0, buf2
	add	x0, x0, :lo12:buf2
	bl	snprintf
	str	w0, [sp, 232]
	adrp	x0, buf2
	add	x1, x0, :lo12:buf2
	adrp	x0, buf
	add	x0, x0, :lo12:buf
	bl	strcmp
	cmp	w0, 0
	cset	w0, eq
	and	w0, w0, 255
	mov	w19, w0
	adrp	x0, buf
	add	x0, x0, :lo12:buf
	bl	strlen
	mov	x4, x0
	mov	w3, w19
	ldr	w2, [sp, 232]
	ldr	w1, [sp, 236]
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	printf
	adrp	x0, stdout
	add	x0, x0, :lo12:stdout
	ldr	x0, [x0]
	mov	x1, x0
	adrp	x0, buf2
	add	x0, x0, :lo12:buf2
	bl	fputs
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	str	x0, [sp, 64]
	mov	w0, 2
	str	w0, [sp, 56]
	mov	w0, 6
	str	w0, [sp, 48]
	mov	w0, 10
	str	w0, [sp, 40]
	mov	w0, 4
	str	w0, [sp, 32]
	mov	w0, 9
	str	w0, [sp, 24]
	mov	w0, 5
	str	w0, [sp, 16]
	mov	w0, 8
	str	w0, [sp, 8]
	mov	w0, 5
	str	w0, [sp]
	mov	w7, 7
	mov	w6, 6
	mov	w5, 5
	mov	w4, 4
	mov	w3, 3
	mov	w2, 2
	mov	w1, 1
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	bl	printf
	str	w0, [sp, 252]
	ldr	w1, [sp, 252]
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	printf
	fmov	d31, 1.1e+1
	str	d31, [sp, 16]
	fmov	d31, 1.0e+1
	str	d31, [sp, 8]
	fmov	d31, 9.0e+0
	str	d31, [sp]
	mov	w6, 4
	mov	w5, -9
	mov	w4, 2
	mov	w3, 12
	mov	w2, 3
	mov	w1, 10
	fmov	d7, 8.0e+0
	fmov	d6, 7.0e+0
	fmov	d5, 6.0e+0
	fmov	d4, 5.0e+0
	fmov	d3, 4.0e+0
	fmov	d2, 3.0e+0
	fmov	d1, 2.0e+0
	fmov	d0, 1.0e+0
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	printf
	str	w0, [sp, 252]
	ldr	w1, [sp, 252]
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	printf
	mov	w0, 5000
	str	w0, [sp, 228]
	mov	w0, 4500
	str	w0, [sp, 224]
	ldr	w0, [sp, 228]
	mov	w4, 7
	mov	w3, w0
	adrp	x0, .LC27
	add	x2, x0, :lo12:.LC27
	mov	x1, 16
	adrp	x0, buf
	add	x0, x0, :lo12:buf
	bl	snprintf
	str	w0, [sp, 232]
	adrp	x0, buf
	add	x2, x0, :lo12:buf
	ldr	w1, [sp, 232]
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	bl	printf
	ldr	w0, [sp, 228]
	mov	w4, 7
	mov	w3, w0
	adrp	x0, .LC29
	add	x2, x0, :lo12:.LC29
	mov	x1, 16
	adrp	x0, buf
	add	x0, x0, :lo12:buf
	bl	snprintf
	str	w0, [sp, 232]
	adrp	x0, buf
	add	x2, x0, :lo12:buf
	ldr	w1, [sp, 232]
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	bl	printf
	ldr	w0, [sp, 224]
	mov	w4, 7
	mov	w3, w0
	adrp	x0, .LC30
	add	x2, x0, :lo12:.LC30
	mov	x1, 16
	adrp	x0, buf
	add	x0, x0, :lo12:buf
	bl	snprintf
	str	w0, [sp, 232]
	adrp	x0, buf
	add	x2, x0, :lo12:buf
	ldr	w1, [sp, 232]
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	bl	printf
	ldr	w0, [sp, 224]
	fmov	d0, 1.0e+0
	mov	w3, w0
	adrp	x0, .LC31
	add	x2, x0, :lo12:.LC31
	mov	x1, 16
	adrp	x0, buf
	add	x0, x0, :lo12:buf
	bl	snprintf
	str	w0, [sp, 232]
	adrp	x0, buf
	add	x2, x0, :lo12:buf
	ldr	w1, [sp, 232]
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	bl	printf
	mov	x0, 16
	str	x0, [sp, 216]
	ldr	x1, [sp, 216]
	mov	w4, 121
	adrp	x0, .LC32
	add	x3, x0, :lo12:.LC32
	adrp	x0, .LC33
	add	x2, x0, :lo12:.LC33
	adrp	x0, buf
	add	x0, x0, :lo12:buf
	bl	snprintf
	str	w0, [sp, 232]
	adrp	x0, buf
	add	x2, x0, :lo12:buf
	ldr	w1, [sp, 232]
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	bl	printf
	ldr	w0, [sp, 228]
	mov	w2, 42
	mov	w1, w0
	adrp	x0, .LC34
	add	x0, x0, :lo12:.LC34
	bl	printf
	str	w0, [sp, 252]
	ldr	w1, [sp, 252]
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 176]
	ldr	x19, [sp, 192]
	add	sp, sp, 256
	ret
	.section .rodata
	.align	3
.LC3:
	.word	-194063802
	.word	1059069745
	.align	3
.LC4:
	.word	-266631570
	.word	1074340345
	.align	3
.LC7:
	.word	-1998362383
	.word	1055193269
	.align	3
.LC8:
	.word	446676599
	.word	1079958831
	.align	3
.LC12:
	.word	-640172613
	.word	1037794527
	.align	3
.LC14:
	.word	-1155586721
	.word	1060410379
	.align	3
.LC15:
	.word	536870912
	.word	1107468383
	.align	3
.LC16:
	.word	1202590843
	.word	1076099809
	.align	3
.LC17:
	.word	-755914244
	.word	1062232653
	.align	3
.LC18:
	.word	279499617
	.word	1155522207
	.align	3
.LC19:
	.word	-1783957616
	.word	1074118409


	.bss
	.balign 8
buf:
	.skip 256
	.balign 8
buf2:
	.skip 256
