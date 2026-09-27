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
walk:
	stp	x29, x30, [sp, -480]!
	mov	x29, sp
	str	x19, [sp, 16]
	mov	x19, x8
	str	x0, [sp, 40]
	str	x1, [sp, 424]
	str	x2, [sp, 432]
	str	x3, [sp, 440]
	str	x4, [sp, 448]
	str	x5, [sp, 456]
	str	x6, [sp, 464]
	str	x7, [sp, 472]
	str	q0, [sp, 288]
	str	q1, [sp, 304]
	str	q2, [sp, 320]
	str	q3, [sp, 336]
	str	q4, [sp, 352]
	str	q5, [sp, 368]
	str	q6, [sp, 384]
	str	q7, [sp, 400]
	str	xzr, [sp, 200]
	str	xzr, [sp, 208]
	str	xzr, [sp, 216]
	add	x0, sp, 480
	str	x0, [sp, 168]
	add	x0, sp, 480
	str	x0, [sp, 176]
	add	x0, sp, 416
	str	x0, [sp, 184]
	mov	w0, -56
	str	w0, [sp, 192]
	mov	w0, -128
	str	w0, [sp, 196]
	ldr	x1, [sp, 40]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	x0, [sp, 40]
	str	x0, [sp, 280]
	b	.L2
.L40:
	ldr	x0, [sp, 280]
	ldrb	w0, [x0]
	cmp	w0, 119
	beq	.L3
	cmp	w0, 119
	bgt	.L4
	cmp	w0, 116
	beq	.L5
	cmp	w0, 116
	bgt	.L4
	cmp	w0, 112
	beq	.L6
	cmp	w0, 112
	bgt	.L4
	cmp	w0, 109
	beq	.L7
	cmp	w0, 109
	bgt	.L4
	cmp	w0, 105
	beq	.L8
	cmp	w0, 105
	bgt	.L4
	cmp	w0, 104
	beq	.L9
	cmp	w0, 104
	bgt	.L4
	cmp	w0, 102
	beq	.L10
	cmp	w0, 102
	bgt	.L4
	cmp	w0, 98
	beq	.L11
	cmp	w0, 100
	beq	.L12
	b	.L4
.L8:
	ldr	w1, [sp, 192]
	ldr	x0, [sp, 168]
	cmp	w1, 0
	blt	.L13
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L14
.L13:
	add	w2, w1, 8
	str	w2, [sp, 192]
	ldr	w2, [sp, 192]
	cmp	w2, 0
	ble	.L15
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L14
.L15:
	ldr	x2, [sp, 176]
	sxtw	x0, w1
	add	x0, x2, x0
.L14:
	ldr	w0, [x0]
	str	w0, [sp, 276]
	ldr	w1, [sp, 276]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	x1, [sp, 200]
	ldrsw	x0, [sp, 276]
	add	x0, x1, x0
	str	x0, [sp, 200]
	b	.L4
.L12:
	ldr	w1, [sp, 196]
	ldr	x0, [sp, 168]
	cmp	w1, 0
	blt	.L16
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L17
.L16:
	add	w2, w1, 16
	str	w2, [sp, 196]
	ldr	w2, [sp, 196]
	cmp	w2, 0
	ble	.L18
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L17
.L18:
	ldr	x2, [sp, 184]
	sxtw	x0, w1
	add	x0, x2, x0
.L17:
	ldr	d31, [x0]
	str	d31, [sp, 264]
	ldr	d0, [sp, 264]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	x0, [sp, 216]
	ldr	d30, [sp, 264]
	fmov	d31, 8.0e+0
	fmul	d31, d30, d31
	fcvtzs	d31, d31
	fmov	x1, d31
	add	x0, x0, x1
	str	x0, [sp, 216]
	b	.L4
.L6:
	ldr	w1, [sp, 192]
	ldr	x0, [sp, 168]
	cmp	w1, 0
	blt	.L19
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L20
.L19:
	add	w2, w1, 8
	str	w2, [sp, 192]
	ldr	w2, [sp, 192]
	cmp	w2, 0
	ble	.L21
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L20
.L21:
	ldr	x2, [sp, 176]
	sxtw	x0, w1
	add	x0, x2, x0
.L20:
	ldr	x0, [x0]
	str	x0, [sp, 160]
	ldr	w0, [sp, 160]
	ldr	w1, [sp, 164]
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldr	x1, [sp, 200]
	ldr	w2, [sp, 160]
	ldr	w0, [sp, 164]
	mul	w0, w2, w0
	sxtw	x0, w0
	add	x0, x1, x0
	str	x0, [sp, 200]
	b	.L4
.L5:
	ldr	w1, [sp, 192]
	ldr	x0, [sp, 168]
	cmp	w1, 0
	blt	.L22
	add	x1, x0, 19
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L23
.L22:
	add	w2, w1, 16
	str	w2, [sp, 192]
	ldr	w2, [sp, 192]
	cmp	w2, 0
	ble	.L24
	add	x1, x0, 19
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L23
.L24:
	ldr	x2, [sp, 176]
	sxtw	x0, w1
	add	x0, x2, x0
.L23:
	add	x1, sp, 144
	ldr	x2, [x0]
	ldr	w0, [x0, 8]
	str	x2, [x1]
	str	w0, [x1, 8]
	ldrsh	w0, [sp, 144]
	mov	w1, w0
	ldr	w0, [sp, 148]
	ldrb	w2, [sp, 152]
	mov	w3, w2
	mov	w2, w0
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	ldr	x1, [sp, 208]
	ldrsh	w0, [sp, 144]
	mov	w2, w0
	ldr	w0, [sp, 148]
	add	w0, w2, w0
	ldrb	w2, [sp, 152]
	add	w0, w0, w2
	sxtw	x0, w0
	add	x0, x1, x0
	str	x0, [sp, 208]
	b	.L4
.L3:
	ldr	w1, [sp, 192]
	ldr	x0, [sp, 168]
	cmp	w1, 0
	blt	.L25
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L26
.L25:
	add	w2, w1, 16
	str	w2, [sp, 192]
	ldr	w2, [sp, 192]
	cmp	w2, 0
	ble	.L27
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L26
.L27:
	ldr	x2, [sp, 176]
	sxtw	x0, w1
	add	x0, x2, x0
.L26:
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp, 128]
	ldr	x0, [sp, 128]
	ldr	x1, [sp, 136]
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldr	x1, [sp, 208]
	ldr	x2, [sp, 128]
	ldr	x0, [sp, 136]
	add	x0, x2, x0
	eor	x0, x1, x0
	str	x0, [sp, 208]
	b	.L4
.L11:
	ldr	w1, [sp, 192]
	ldr	x0, [sp, 168]
	cmp	w1, 0
	blt	.L28
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L29
.L28:
	add	w2, w1, 8
	str	w2, [sp, 192]
	ldr	w2, [sp, 192]
	cmp	w2, 0
	ble	.L30
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L29
.L30:
	ldr	x2, [sp, 176]
	sxtw	x0, w1
	add	x0, x2, x0
.L29:
	ldr	x1, [x0]
	add	x0, sp, 104
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	ldr	x0, [sp, 104]
	ldr	x1, [sp, 112]
	ldr	x2, [sp, 120]
	mov	x3, x2
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	ldr	x2, [sp, 216]
	ldr	x1, [sp, 104]
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	lsl	x1, x0, 2
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x3, x0
	ldr	x1, [sp, 112]
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	lsl	x0, x0, 1
	add	x1, x3, x0
	ldr	x0, [sp, 120]
	add	x0, x1, x0
	add	x0, x2, x0
	str	x0, [sp, 216]
	b	.L4
.L9:
	ldr	w1, [sp, 196]
	ldr	x0, [sp, 168]
	cmp	w1, 0
	blt	.L31
	add	x1, x0, 31
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L32
.L31:
	add	w2, w1, 48
	str	w2, [sp, 196]
	ldr	w2, [sp, 196]
	cmp	w2, 0
	ble	.L33
	add	x1, x0, 31
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L32
.L33:
	ldr	x2, [sp, 184]
	sxtw	x0, w1
	add	x2, x2, x0
	add	x0, sp, 224
	ldr	d31, [x2]
	str	d31, [x0]
	ldr	x2, [sp, 184]
	sxtw	x0, w1
	add	x0, x0, 16
	add	x0, x2, x0
	ldr	d31, [x0]
	str	d31, [sp, 232]
	ldr	x2, [sp, 184]
	sxtw	x0, w1
	add	x0, x0, 32
	add	x0, x2, x0
	ldr	d31, [x0]
	str	d31, [sp, 240]
	add	x0, sp, 224
.L32:
	add	x1, sp, 80
	ldp	x2, x3, [x0]
	ldr	x0, [x0, 16]
	stp	x2, x3, [x1]
	str	x0, [x1, 16]
	ldr	d31, [sp, 80]
	ldr	d30, [sp, 88]
	ldr	d29, [sp, 96]
	fmov	d2, d29
	fmov	d1, d30
	fmov	d0, d31
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	ldr	x0, [sp, 216]
	ldr	d31, [sp, 80]
	mov	x1, 70368744177664
	movk	x1, 0x408f, lsl 48
	fmov	d30, x1
	fmul	d30, d31, d30
	ldr	d31, [sp, 88]
	mov	x1, 4636737291354636288
	fmov	d29, x1
	fmul	d31, d31, d29
	fadd	d30, d30, d31
	ldr	d29, [sp, 96]
	fmov	d31, 1.0e+1
	fmul	d31, d29, d31
	fadd	d31, d30, d31
	fcvtzs	d31, d31
	fmov	x1, d31
	add	x0, x0, x1
	str	x0, [sp, 216]
	b	.L4
.L10:
	ldr	w1, [sp, 196]
	ldr	x0, [sp, 168]
	cmp	w1, 0
	blt	.L34
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L35
.L34:
	add	w2, w1, 64
	str	w2, [sp, 196]
	ldr	w2, [sp, 196]
	cmp	w2, 0
	ble	.L36
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L35
.L36:
	ldr	x2, [sp, 184]
	sxtw	x0, w1
	add	x2, x2, x0
	add	x0, sp, 248
	ldr	s31, [x2]
	str	s31, [x0]
	ldr	x2, [sp, 184]
	sxtw	x0, w1
	add	x0, x0, 16
	add	x0, x2, x0
	ldr	s31, [x0]
	str	s31, [sp, 252]
	ldr	x2, [sp, 184]
	sxtw	x0, w1
	add	x0, x0, 32
	add	x0, x2, x0
	ldr	s31, [x0]
	str	s31, [sp, 256]
	ldr	x2, [sp, 184]
	sxtw	x0, w1
	add	x0, x0, 48
	add	x0, x2, x0
	ldr	s31, [x0]
	str	s31, [sp, 260]
	add	x0, sp, 248
.L35:
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp, 64]
	ldr	s31, [sp, 64]
	fcvt	d30, s31
	ldr	s31, [sp, 68]
	fcvt	d29, s31
	ldr	s31, [sp, 72]
	fcvt	d28, s31
	ldr	s31, [sp, 76]
	fcvt	d31, s31
	fmov	d3, d31
	fmov	d2, d28
	fmov	d1, d29
	fmov	d0, d30
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	ldr	x1, [sp, 216]
	ldr	s30, [sp, 64]
	fmov	s31, 8.0e+0
	fmul	s30, s30, s31
	ldr	s29, [sp, 68]
	fmov	s31, 4.0e+0
	fmul	s31, s29, s31
	fadd	s30, s30, s31
	ldr	s31, [sp, 72]
	fadd	s31, s31, s31
	fadd	s30, s30, s31
	ldr	s31, [sp, 76]
	fadd	s31, s30, s31
	fcvtzs	x0, s31
	add	x0, x1, x0
	str	x0, [sp, 216]
	b	.L4
.L7:
	ldr	w1, [sp, 192]
	ldr	x0, [sp, 168]
	cmp	w1, 0
	blt	.L37
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L38
.L37:
	add	w2, w1, 16
	str	w2, [sp, 192]
	ldr	w2, [sp, 192]
	cmp	w2, 0
	ble	.L39
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L38
.L39:
	ldr	x2, [sp, 176]
	sxtw	x0, w1
	add	x0, x2, x0
.L38:
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp, 48]
	ldr	d31, [sp, 48]
	ldr	x0, [sp, 56]
	mov	x1, x0
	fmov	d0, d31
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	printf
	ldr	x1, [sp, 208]
	ldr	d31, [sp, 48]
	fcvtzs	x2, d31
	ldr	x0, [sp, 56]
	mul	x0, x2, x0
	add	x0, x1, x0
	str	x0, [sp, 208]
	nop
.L4:
	ldr	x0, [sp, 280]
	add	x0, x0, 1
	str	x0, [sp, 280]
.L2:
	ldr	x0, [sp, 280]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L40
	mov	w0, 10
	bl	putchar
	mov	x3, x19
	add	x2, sp, 200
	ldp	x0, x1, [x2]
	ldr	x2, [x2, 16]
	stp	x0, x1, [x3]
	str	x2, [x3, 16]
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 480
	ret
	.section .rodata
	.align	3
.LC15:
	.string	"  -> %ld %ld %ld\n"
	.text
	.align	2
report:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x19, [sp, 16]
	mov	x19, x0
	ldr	x0, [x19]
	ldr	x1, [x19, 8]
	ldr	x2, [x19, 16]
	mov	x3, x2
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	nop
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
	.section .rodata
	.align	3
.LC16:
	.string	"pt"
	.align	3
.LC17:
	.string	"iiiiiiwi"
	.align	3
.LC18:
	.string	"iiiiiwi"
	.align	3
.LC19:
	.string	"bbbbbbbbi"
	.align	3
.LC20:
	.string	"hfhd"
	.align	3
.LC21:
	.string	"fdfdd"
	.align	3
.LC22:
	.string	"dddddddhd"
	.align	3
.LC23:
	.string	"mdmi"
	.align	3
.LC24:
	.string	"iiiiiimi"
	.align	3
.LC25:
	.string	"pptwpbhmfi"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #720
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	mov	w0, 3
	str	w0, [sp, 472]
	mov	w0, -4
	str	w0, [sp, 476]
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 456
	ldr	x2, [x1]
	ldr	w1, [x1, 8]
	str	x2, [x0]
	str	w1, [x0, 8]
	mov	x0, 1229782938247303441
	str	x0, [sp, 440]
	mov	x0, -2
	str	x0, [sp, 448]
	adrp	x0, .LC1
	add	x1, x0, :lo12:.LC1
	add	x0, sp, 416
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	adrp	x0, .LC2
	add	x1, x0, :lo12:.LC2
	add	x0, sp, 392
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	adrp	x0, .LC3
	add	x1, x0, :lo12:.LC3
	add	x0, sp, 368
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	adrp	x0, .LC4
	add	x1, x0, :lo12:.LC4
	add	x0, sp, 344
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	fmov	s31, 1.0e+0
	str	s31, [sp, 328]
	fmov	s31, 2.5e+0
	str	s31, [sp, 332]
	fmov	s31, -3.0e+0
	str	s31, [sp, 336]
	fmov	s31, 1.25e-1
	str	s31, [sp, 340]
	fmov	d31, 6.5e+0
	str	d31, [sp, 312]
	mov	x0, -99
	str	x0, [sp, 320]
	ldr	x1, [sp, 456]
	ldr	w0, [sp, 464]
	add	x2, sp, 480
	mov	x8, x2
	mov	x2, x1
	mov	x3, x0
	ldr	x1, [sp, 472]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	walk
	add	x0, sp, 272
	add	x1, sp, 480
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 272
	bl	report
	mov	w0, 8
	str	w0, [sp, 16]
	add	x0, sp, 440
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp]
	add	x0, sp, 504
	mov	x8, x0
	mov	w6, 6
	mov	w5, 5
	mov	w4, 4
	mov	w3, 3
	mov	w2, 2
	mov	w1, 1
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	walk
	add	x0, sp, 272
	add	x1, sp, 504
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 272
	bl	report
	mov	w0, 7
	str	w0, [sp]
	add	x0, sp, 528
	mov	x8, x0
	add	x0, sp, 440
	ldp	x6, x7, [x0]
	mov	w5, 5
	mov	w4, 4
	mov	w3, 3
	mov	w2, 2
	mov	w1, 1
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	walk
	add	x0, sp, 272
	add	x1, sp, 528
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 272
	bl	report
	add	x0, sp, 272
	add	x1, sp, 416
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 240
	add	x1, sp, 392
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 208
	add	x1, sp, 416
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 176
	add	x1, sp, 392
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 144
	add	x1, sp, 416
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 112
	add	x1, sp, 392
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 80
	add	x1, sp, 416
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 48
	add	x1, sp, 392
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x6, sp, 80
	add	x5, sp, 112
	add	x4, sp, 144
	add	x3, sp, 176
	add	x2, sp, 208
	add	x1, sp, 240
	add	x0, sp, 272
	mov	w7, 9
	str	w7, [sp, 8]
	add	x7, sp, 48
	str	x7, [sp]
	add	x7, sp, 552
	mov	x8, x7
	mov	x7, x6
	mov	x6, x5
	mov	x5, x4
	mov	x4, x3
	mov	x3, x2
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	walk
	add	x0, sp, 48
	add	x1, sp, 552
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 48
	bl	report
	ldr	s25, [sp, 328]
	ldr	s26, [sp, 332]
	ldr	s27, [sp, 336]
	ldr	s28, [sp, 340]
	ldr	d29, [sp, 368]
	ldr	d30, [sp, 376]
	ldr	d31, [sp, 384]
	fmov	d24, 4.5e+0
	str	d24, [sp, 24]
	mov	x3, sp
	add	x2, sp, 344
	ldp	x0, x1, [x2]
	ldr	x2, [x2, 16]
	stp	x0, x1, [x3]
	str	x2, [x3, 16]
	add	x0, sp, 576
	mov	x8, x0
	fmov	s3, s25
	fmov	s4, s26
	fmov	s5, s27
	fmov	s6, s28
	fmov	d0, d29
	fmov	d1, d30
	fmov	d2, d31
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	walk
	add	x0, sp, 48
	add	x1, sp, 576
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 48
	bl	report
	ldr	s28, [sp, 328]
	ldr	s29, [sp, 332]
	ldr	s30, [sp, 336]
	ldr	s31, [sp, 340]
	fmov	d27, 2.0e+0
	str	d27, [sp, 24]
	fmov	d27, -1.25e+0
	str	d27, [sp, 16]
	add	x0, sp, 328
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp]
	add	x0, sp, 600
	mov	x8, x0
	fmov	d4, 7.5e-1
	fmov	s0, s28
	fmov	s1, s29
	fmov	s2, s30
	fmov	s3, s31
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	walk
	add	x0, sp, 48
	add	x1, sp, 600
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 48
	bl	report
	fmov	d31, 9.5e+0
	str	d31, [sp, 24]
	mov	x3, sp
	add	x2, sp, 368
	ldp	x0, x1, [x2]
	ldr	x2, [x2, 16]
	stp	x0, x1, [x3]
	str	x2, [x3, 16]
	add	x0, sp, 624
	mov	x8, x0
	fmov	d6, 7.0e+0
	fmov	d5, 6.0e+0
	fmov	d4, 5.0e+0
	fmov	d3, 4.0e+0
	fmov	d2, 3.0e+0
	fmov	d1, 2.0e+0
	fmov	d0, 1.0e+0
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	walk
	add	x0, sp, 48
	add	x1, sp, 624
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 48
	bl	report
	add	x0, sp, 648
	mov	x8, x0
	mov	w5, 5
	add	x0, sp, 312
	ldp	x3, x4, [x0]
	fmov	d0, 2.0e+0
	add	x0, sp, 312
	ldp	x1, x2, [x0]
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	bl	walk
	add	x0, sp, 48
	add	x1, sp, 648
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 48
	bl	report
	mov	w0, 8
	str	w0, [sp, 16]
	add	x0, sp, 312
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp]
	add	x0, sp, 672
	mov	x8, x0
	mov	w6, 6
	mov	w5, 5
	mov	w4, 4
	mov	w3, 3
	mov	w2, 2
	mov	w1, 1
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	walk
	add	x0, sp, 48
	add	x1, sp, 672
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 48
	bl	report
	add	x0, sp, 48
	add	x1, sp, 416
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	ldr	s25, [sp, 328]
	ldr	s26, [sp, 332]
	ldr	s27, [sp, 336]
	ldr	s28, [sp, 340]
	ldr	d29, [sp, 368]
	ldr	d30, [sp, 376]
	ldr	d31, [sp, 384]
	ldr	x3, [sp, 456]
	ldr	w2, [sp, 464]
	mov	w0, 42
	str	w0, [sp, 24]
	add	x0, sp, 312
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp, 8]
	add	x0, sp, 48
	str	x0, [sp]
	add	x0, sp, 696
	mov	x8, x0
	fmov	s3, s25
	fmov	s4, s26
	fmov	s5, s27
	fmov	s6, s28
	fmov	d0, d29
	fmov	d1, d30
	fmov	d2, d31
	ldr	x7, [sp, 472]
	add	x0, sp, 440
	ldp	x5, x6, [x0]
	mov	x4, x2
	ldr	x2, [sp, 472]
	ldr	x1, [sp, 472]
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	walk
	add	x0, sp, 48
	add	x1, sp, 696
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x0, sp, 48
	bl	report
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	add	sp, sp, 720
	ret
	.section .rodata
	.align	3
.LC0:
	.hword	-7
	.zero	2
	.word	70000
	.byte	122
	.zero	3
	.align	3
.LC1:
	.xword	1
	.xword	-20
	.xword	300
	.align	3
.LC2:
	.xword	-4
	.xword	5
	.xword	-6
	.align	3
.LC3:
	.word	0
	.word	1073217536
	.word	0
	.word	-1073741824
	.word	0
	.word	1070596096
	.align	3
.LC4:
	.word	0
	.word	1075838976
	.word	0
	.word	1071644672
	.word	0
	.word	-1077936128
	.text

