	.text
	.section .rodata
	.align	3
.LC5:
	.string	"%-10s"
	.align	3
.LC6:
	.string	" i:%d"
	.align	3
.LC7:
	.string	" d:%g"
	.align	3
.LC8:
	.string	" p:%d,%d"
	.align	3
.LC9:
	.string	" t:%hd,%d,%c"
	.align	3
.LC10:
	.string	" w:%lx,%ld"
	.align	3
.LC11:
	.string	" b:%ld,%ld,%ld"
	.align	3
.LC12:
	.string	" h:%g,%g,%g"
	.align	3
.LC13:
	.string	" f:%g,%g,%g,%g"
	.align	3
.LC14:
	.string	" m:%g,%ld"
	.text
	.align	2
	.align 5
walk:
	stp	x29, x30, [sp, -384]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x0
	add	x0, sp, 384
	stp	x0, x0, [sp, 160]
	add	x0, sp, 320
	str	x0, [sp, 176]
	mov	w0, -56
	str	w0, [sp, 184]
	mov	w0, -128
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	mov	x23, x8
	str	w0, [sp, 188]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	stp	q0, q1, [sp, 192]
	stp	q2, q3, [sp, 224]
	stp	q4, q5, [sp, 256]
	stp	q6, q7, [sp, 288]
	stp	x1, x2, [sp, 328]
	mov	x1, x19
	stp	x3, x4, [sp, 344]
	stp	x5, x6, [sp, 360]
	str	x7, [sp, 376]
	bl	printf
	ldrb	w1, [x19]
	cbz	w1, .L45
	mov	x22, 0
	mov	x21, 0
	mov	x24, 0
	.align 5
.L44:
	cmp	w1, 105
	beq	.L3
	bhi	.L4
	cmp	w1, 102
	beq	.L5
	bhi	.L6
	cmp	w1, 98
	beq	.L7
	cmp	w1, 100
	bne	.L11
	ldr	w1, [sp, 188]
	ldr	x0, [sp, 160]
	tbnz	w1, #31, .L49
.L20:
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 160]
.L22:
	ldr	d0, [x0]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	str	d0, [sp, 64]
	bl	printf
	ldr	d0, [sp, 64]
	fcvtzs	x0, d0, #3
	add	x22, x22, x0
	.align 5
.L11:
	ldrb	w1, [x19, 1]!
	cbnz	w1, .L44
	stp	x24, x21, [sp, 64]
.L2:
	adrp	x0, stdout
	ldr	x1, [x0, :lo12:stdout]
	mov	w0, 10
	bl	putc
	str	x22, [x23, 16]
	ldr	q31, [sp, 64]
	str	q31, [x23]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 384
	ret
	.align 2
.L4:
	cmp	w1, 116
	beq	.L12
	bhi	.L13
	cmp	w1, 109
	beq	.L14
	cmp	w1, 112
	bne	.L11
	ldr	w1, [sp, 184]
	ldr	x0, [sp, 160]
	tbnz	w1, #31, .L50
.L23:
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 160]
.L25:
	ldp	w1, w20, [x0]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	str	w1, [sp, 64]
	mov	w2, w20
	bl	printf
	ldr	w1, [sp, 64]
	mul	w20, w20, w1
	add	x24, x24, w20, sxtw
	b	.L11
	.align 2
.L13:
	cmp	w1, 119
	bne	.L11
	ldr	w1, [sp, 184]
	ldr	x0, [sp, 160]
	tbnz	w1, #31, .L51
.L29:
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 160]
.L31:
	ldp	x1, x20, [x0]
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	str	x1, [sp, 64]
	mov	x2, x20
	bl	printf
	ldr	x1, [sp, 64]
	add	x20, x20, x1
	eor	x21, x21, x20
	b	.L11
	.align 2
.L6:
	cmp	w1, 104
	bne	.L11
	ldr	w1, [sp, 188]
	ldr	x0, [sp, 160]
	tbnz	w1, #31, .L52
.L35:
	add	x1, x0, 31
	and	x1, x1, -8
	str	x1, [sp, 160]
.L37:
	ldp	d0, d1, [x0]
	ldr	d2, [x0, 16]
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	str	d0, [sp, 64]
	stp	d1, d2, [sp, 88]
	bl	printf
	mov	x0, 4636737291354636288
	ldp	d1, d2, [sp, 88]
	fmov	d31, x0
	ldr	d0, [sp, 64]
	mov	x0, 70368744177664
	movk	x0, 0x408f, lsl 48
	fmul	d1, d1, d31
	fmov	d31, x0
	fmadd	d1, d0, d31, d1
	fmov	d31, 1.0e+1
	fmadd	d1, d2, d31, d1
	fcvtzs	x0, d1
	add	x22, x22, x0
	b	.L11
	.align 2
.L5:
	ldr	w1, [sp, 188]
	ldr	x0, [sp, 160]
	tbnz	w1, #31, .L53
.L38:
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 160]
.L40:
	ldp	s28, s31, [x0]
	ldp	s29, s30, [x0, 8]
	adrp	x0, .LC13
	fcvt	d1, s31
	fcvt	d0, s28
	add	x0, x0, :lo12:.LC13
	str	s28, [sp, 64]
	fcvt	d3, s30
	fcvt	d2, s29
	str	s31, [sp, 88]
	str	s29, [sp, 96]
	str	s30, [sp, 108]
	bl	printf
	ldr	s31, [sp, 88]
	fmov	s27, 4.0e+0
	ldr	s28, [sp, 64]
	ldr	s29, [sp, 96]
	fmul	s31, s31, s27
	fmov	s27, 8.0e+0
	ldr	s30, [sp, 108]
	fmadd	s31, s28, s27, s31
	fmov	s28, 2.0e+0
	fmadd	s31, s29, s28, s31
	fadd	s31, s31, s30
	fcvtzs	x0, s31
	add	x22, x22, x0
	b	.L11
	.align 2
.L14:
	ldr	w1, [sp, 184]
	ldr	x0, [sp, 160]
	tbnz	w1, #31, .L54
.L41:
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 160]
.L43:
	ldr	d0, [x0]
	ldr	x20, [x0, 8]
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	str	d0, [sp, 64]
	mov	x1, x20
	bl	printf
	ldr	d0, [sp, 64]
	fcvtzs	x0, d0
	madd	x21, x0, x20, x21
	b	.L11
	.align 2
.L12:
	ldr	w1, [sp, 184]
	ldr	x0, [sp, 160]
	tbnz	w1, #31, .L55
.L26:
	add	x1, x0, 19
	and	x1, x1, -8
	str	x1, [sp, 160]
.L28:
	ldrb	w3, [x0, 8]
	ldr	w2, [x0, 4]
	ldrsh	w20, [x0]
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	str	w2, [sp, 64]
	mov	w1, w20
	str	w3, [sp, 88]
	bl	printf
	ldr	w2, [sp, 64]
	ldr	w3, [sp, 88]
	add	w20, w20, w2
	add	w20, w20, w3
	add	x21, x21, w20, sxtw
	b	.L11
	.align 2
.L7:
	ldr	w1, [sp, 184]
	ldr	x0, [sp, 160]
	tbnz	w1, #31, .L56
.L32:
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 160]
.L34:
	ldr	x0, [x0]
	ldp	x20, x2, [x0]
	str	x2, [sp, 64]
	ldr	x3, [x0, 16]
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	str	x3, [sp, 88]
	mov	x1, x20
	bl	printf
	ldr	x2, [sp, 64]
	add	x20, x20, x20, lsl 2
	ldr	x3, [sp, 88]
	add	x20, x20, x20, lsl 2
	add	x2, x2, x2, lsl 2
	lsl	x2, x2, 1
	add	x20, x2, x20, lsl 2
	add	x20, x20, x3
	add	x22, x22, x20
	b	.L11
	.align 2
.L3:
	ldr	w1, [sp, 184]
	ldr	x0, [sp, 160]
	tbnz	w1, #31, .L57
.L17:
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 160]
.L19:
	ldr	w20, [x0]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	mov	w1, w20
	bl	printf
	add	x24, x24, w20, sxtw
	b	.L11
.L57:
	add	w2, w1, 8
	str	w2, [sp, 184]
	cmp	w2, 0
	bgt	.L17
	ldr	x0, [sp, 168]
	add	x0, x0, w1, sxtw
	b	.L19
.L56:
	add	w2, w1, 8
	str	w2, [sp, 184]
	cmp	w2, 0
	bgt	.L32
	ldr	x0, [sp, 168]
	add	x0, x0, w1, sxtw
	b	.L34
.L55:
	add	w2, w1, 16
	str	w2, [sp, 184]
	cmp	w2, 0
	bgt	.L26
	ldr	x0, [sp, 168]
	add	x0, x0, w1, sxtw
	b	.L28
.L54:
	add	w2, w1, 16
	str	w2, [sp, 184]
	cmp	w2, 0
	bgt	.L41
	ldr	x0, [sp, 168]
	add	x0, x0, w1, sxtw
	b	.L43
.L53:
	add	w2, w1, 64
	str	w2, [sp, 188]
	cmp	w2, 0
	bgt	.L38
	ldr	x0, [sp, 176]
	ldr	s31, [x0, w1, sxtw]
	add	x1, x0, w1, sxtw
	add	x0, sp, 120
	str	s31, [sp, 120]
	ldr	s31, [x1, 16]
	str	s31, [sp, 124]
	ldr	s31, [x1, 32]
	str	s31, [sp, 128]
	ldr	s31, [x1, 48]
	str	s31, [sp, 132]
	b	.L40
.L52:
	add	w2, w1, 48
	str	w2, [sp, 188]
	cmp	w2, 0
	bgt	.L35
	ldr	x0, [sp, 176]
	ldr	d31, [x0, w1, sxtw]
	add	x1, x0, w1, sxtw
	add	x0, sp, 136
	str	d31, [sp, 136]
	ldr	d31, [x1, 16]
	str	d31, [sp, 144]
	ldr	d31, [x1, 32]
	str	d31, [sp, 152]
	b	.L37
.L51:
	add	w2, w1, 16
	str	w2, [sp, 184]
	cmp	w2, 0
	bgt	.L29
	ldr	x0, [sp, 168]
	add	x0, x0, w1, sxtw
	b	.L31
.L50:
	add	w2, w1, 8
	str	w2, [sp, 184]
	cmp	w2, 0
	bgt	.L23
	ldr	x0, [sp, 168]
	add	x0, x0, w1, sxtw
	b	.L25
.L49:
	add	w2, w1, 16
	str	w2, [sp, 188]
	cmp	w2, 0
	bgt	.L20
	ldr	x0, [sp, 176]
	add	x0, x0, w1, sxtw
	b	.L22
.L45:
	mov	x22, 0
	stp	xzr, xzr, [sp, 64]
	b	.L2
	.section .rodata
	.align	3
.LC21:
	.string	"pt"
	.align	3
.LC22:
	.string	"  -> %ld %ld %ld\n"
	.align	3
.LC23:
	.string	"iiiiiiwi"
	.align	3
.LC24:
	.string	"iiiiiwi"
	.align	3
.LC25:
	.string	"bbbbbbbbi"
	.align	3
.LC26:
	.string	"hfhd"
	.align	3
.LC27:
	.string	"fdfdd"
	.align	3
.LC28:
	.string	"dddddddhd"
	.align	3
.LC29:
	.string	"mdmi"
	.align	3
.LC30:
	.string	"iiiiiimi"
	.align	3
.LC31:
	.string	"pptwpbhmfi"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #784
	mov	w0, -7
	adrp	x1, .LANCHOR0
	add	x8, sp, 544
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	ldr	q31, [x1, :lo12:.LANCHOR0]
	strh	w0, [sp, 400]
	mov	w0, 4464
	stp	x19, x20, [sp, 48]
	movk	w0, 0x1, lsl 16
	str	w0, [sp, 404]
	mov	w0, 122
	strb	w0, [sp, 408]
	add	x0, x1, :lo12:.LANCHOR0
	str	q31, [sp, 416]
	mov	x1, 300
	ldr	w3, [sp, 408]
	ldp	q30, q31, [x0, 16]
	str	x1, [sp, 432]
	ldr	x2, [sp, 400]
	mov	x1, -6
	str	q31, [sp, 480]
	fmov	d31, 2.5e-1
	adrp	x19, .LC22
	str	d31, [sp, 496]
	ldr	q31, [x0, 48]
	adrp	x0, .LC20+8
	stp	x21, x22, [sp, 64]
	mov	x22, 1229782938247303441
	mov	x21, 1065353216
	str	q31, [sp, 512]
	fmov	d31, -1.25e-1
	movk	x21, 0x4020, lsl 48
	str	d31, [sp, 528]
	fmov	d31, 6.5e+0
	ldr	x20, [x0, :lo12:.LC20+8]
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	stp	x23, x24, [sp, 80]
	mov	x23, -2
	stp	x25, x26, [sp, 96]
	fmov	x25, d31
	add	x26, sp, 368
	str	x27, [sp, 112]
	mov	w27, 8
	str	d15, [sp, 120]
	mov	x24, -99
	stp	d13, d14, [sp, 128]
	str	q30, [sp, 448]
	str	x1, [sp, 464]
	mov	x1, -17179869181
	bl	walk
	ldr	x1, [sp, 544]
	add	x0, x19, :lo12:.LC22
	ldr	x2, [sp, 552]
	ldr	x3, [sp, 560]
	bl	printf
	stp	x22, x23, [sp]
	add	x8, sp, 568
	str	w27, [sp, 16]
	mov	w6, 6
	mov	w5, 5
	mov	w4, 4
	mov	w3, 3
	mov	w2, 2
	mov	w1, 1
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	bl	walk
	ldr	x1, [sp, 568]
	add	x0, x19, :lo12:.LC22
	ldr	x2, [sp, 576]
	ldr	x3, [sp, 584]
	bl	printf
	mov	w0, 7
	str	w0, [sp]
	add	x8, sp, 592
	mov	x6, x22
	mov	x7, x23
	mov	w5, 5
	mov	w4, 4
	mov	w3, 3
	mov	w2, 2
	mov	w1, 1
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	walk
	ldr	x1, [sp, 592]
	add	x0, x19, :lo12:.LC22
	ldr	x2, [sp, 600]
	ldr	x3, [sp, 608]
	bl	printf
	ldr	x0, [sp, 464]
	str	x0, [sp, 160]
	ldp	x4, x5, [sp, 416]
	str	x0, [sp, 224]
	ldr	x1, [sp, 432]
	str	x1, [sp, 192]
	ldp	x2, x3, [sp, 448]
	str	x1, [sp, 256]
	str	x0, [sp, 288]
	add	x7, sp, 176
	str	x1, [sp, 320]
	add	x6, sp, 208
	str	x0, [sp, 352]
	mov	w0, 9
	str	w0, [sp, 8]
	add	x8, sp, 616
	str	x1, [sp, 384]
	add	x1, sp, 144
	str	x1, [sp]
	adrp	x0, .LC25
	mov	x1, x26
	add	x0, x0, :lo12:.LC25
	stp	x2, x3, [sp, 144]
	stp	x4, x5, [sp, 176]
	stp	x2, x3, [sp, 208]
	stp	x4, x5, [sp, 240]
	stp	x2, x3, [sp, 272]
	stp	x4, x5, [sp, 304]
	stp	x2, x3, [sp, 336]
	add	x3, sp, 304
	add	x2, sp, 336
	stp	x4, x5, [sp, 368]
	add	x5, sp, 240
	add	x4, sp, 272
	bl	walk
	ldr	x1, [sp, 616]
	add	x0, x19, :lo12:.LC22
	ldr	x2, [sp, 624]
	ldr	x3, [sp, 632]
	bl	printf
	lsr	x0, x20, 32
	fmov	s15, w0
	add	x0, sp, 512
	fmov	d31, 4.5e+0
	fmov	s6, s15
	ldr	d2, [sp, 496]
	str	d31, [sp, 24]
	lsr	w2, w21, 0
	ldp	x4, x5, [x0]
	lsr	w1, w20, 0
	ldp	d0, d1, [sp, 480]
	fmov	s5, w1
	ldr	x0, [sp, 528]
	fmov	s3, w2
	fmov	s4, 2.5e+0
	stp	x4, x5, [sp]
	add	x8, sp, 640
	str	x0, [sp, 16]
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	walk
	ldr	x1, [sp, 640]
	add	x0, x19, :lo12:.LC22
	ldr	x2, [sp, 648]
	ldr	x3, [sp, 656]
	bl	printf
	fmov	s3, s15
	lsr	w1, w21, 0
	fmov	d13, 2.0e+0
	fmov	d31, -1.25e+0
	fmov	s0, w1
	lsr	w0, w20, 0
	fmov	d4, 7.5e-1
	fmov	s2, w0
	fmov	s1, 2.5e+0
	stp	x21, x20, [sp]
	add	x8, sp, 664
	adrp	x0, .LC27
	add	x0, x0, :lo12:.LC27
	stp	d31, d13, [sp, 16]
	bl	walk
	ldr	x1, [sp, 664]
	add	x0, x19, :lo12:.LC22
	ldr	x2, [sp, 672]
	lsr	w21, w21, 0
	ldr	x3, [sp, 680]
	lsr	w20, w20, 0
	bl	printf
	fmov	d1, d13
	ldp	x0, x1, [sp, 480]
	stp	x0, x1, [sp]
	fmov	d31, 9.5e+0
	ldr	x0, [sp, 496]
	fmov	d6, 7.0e+0
	fmov	d5, 6.0e+0
	fmov	d4, 5.0e+0
	fmov	d3, 4.0e+0
	fmov	d2, 3.0e+0
	fmov	d0, 1.0e+0
	str	x0, [sp, 16]
	add	x8, sp, 688
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	str	d31, [sp, 24]
	bl	walk
	ldr	x1, [sp, 688]
	add	x0, x19, :lo12:.LC22
	ldr	x2, [sp, 696]
	ldr	x3, [sp, 704]
	bl	printf
	fmov	d0, d13
	add	x8, sp, 712
	mov	x4, x24
	mov	x3, x25
	mov	x1, x25
	mov	x2, x24
	mov	w5, 5
	adrp	x0, .LC29
	add	x0, x0, :lo12:.LC29
	bl	walk
	ldr	x1, [sp, 712]
	add	x0, x19, :lo12:.LC22
	ldr	x2, [sp, 720]
	ldr	x3, [sp, 728]
	bl	printf
	stp	x25, x24, [sp]
	add	x8, sp, 736
	str	w27, [sp, 16]
	mov	w6, 6
	mov	w5, 5
	mov	w4, 4
	mov	w3, 3
	mov	w2, 2
	mov	w1, 1
	adrp	x0, .LC30
	add	x0, x0, :lo12:.LC30
	bl	walk
	ldr	x1, [sp, 736]
	add	x0, x19, :lo12:.LC22
	ldr	x2, [sp, 744]
	ldr	x3, [sp, 752]
	bl	printf
	fmov	s6, s15
	ldp	x0, x1, [sp, 416]
	stp	x0, x1, [sp, 368]
	ldr	w4, [sp, 408]
	ldr	x3, [sp, 400]
	fmov	s3, w21
	ldr	x0, [sp, 432]
	fmov	s5, w20
	ldp	d0, d1, [sp, 480]
	fmov	s4, 2.5e+0
	ldr	d2, [sp, 496]
	mov	x7, -17179869181
	stp	x26, x25, [sp]
	add	x8, sp, 760
	mov	x5, x22
	str	x24, [sp, 16]
	mov	x6, x23
	str	x0, [sp, 384]
	mov	w0, 42
	str	w0, [sp, 24]
	mov	x2, x7
	mov	x1, x7
	adrp	x0, .LC31
	add	x0, x0, :lo12:.LC31
	bl	walk
	ldr	x1, [sp, 760]
	add	x0, x19, :lo12:.LC22
	ldr	x2, [sp, 768]
	ldr	x3, [sp, 776]
	bl	printf
	ldr	x27, [sp, 112]
	mov	w0, 0
	ldr	d15, [sp, 120]
	ldp	x29, x30, [sp, 32]
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	ldp	x23, x24, [sp, 80]
	ldp	x25, x26, [sp, 96]
	ldp	d13, d14, [sp, 128]
	add	sp, sp, 784
	ret
	.section .rodata
	.align	4
.LC20:
	.quad	4620693218747482112
	.quad	4467570833576951808
	.section .rodata
	.align	4
	.LANCHOR0:
.LC16:
	.quad	1
	.quad	-20
.LC17:
	.quad	-4
	.quad	5
.LC18:
	.word	0
	.word	1073217536
	.word	0
	.word	-1073741824
.LC19:
	.word	0
	.word	1075838976
	.word	0
	.word	1071644672

