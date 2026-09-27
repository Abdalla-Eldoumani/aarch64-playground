	.text
	.section .rodata
	.align	3
.LC0:
	.string	" %s:%016lx%016lx"
	.text
	.align	2
show128:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	add	x0, sp, 32
	mov	x2, 16
	ldr	x1, [sp, 16]
	bl	memcpy
	ldr	x0, [sp, 40]
	ldr	x1, [sp, 32]
	mov	x3, x1
	mov	x2, x0
	ldr	x1, [sp, 24]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	x1, [sp, 32]
	ldr	x0, [sp, 40]
	eor	x0, x1, x0
	ldp	x29, x30, [sp], 48
	ret
	.align	2
take3:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	ldr	w1, [x0, 24]
	ldr	x0, [sp, 8]
	ldr	x0, [x0]
	cmp	w1, 0
	blt	.L4
	add	x1, x0, 11
	and	x2, x1, -8
	ldr	x1, [sp, 8]
	str	x2, [x1]
	b	.L5
.L4:
	add	w3, w1, 8
	ldr	x2, [sp, 8]
	str	w3, [x2, 24]
	ldr	x2, [sp, 8]
	ldr	w2, [x2, 24]
	cmp	w2, 0
	ble	.L6
	add	x1, x0, 11
	and	x2, x1, -8
	ldr	x1, [sp, 8]
	str	x2, [x1]
	b	.L5
.L6:
	ldr	x0, [sp, 8]
	ldr	x2, [x0, 8]
	sxtw	x0, w1
	add	x0, x2, x0
.L5:
	ldr	w0, [x0]
	str	w0, [sp, 28]
	ldr	x0, [sp, 8]
	ldr	w1, [x0, 24]
	ldr	x0, [sp, 8]
	ldr	x0, [x0]
	cmp	w1, 0
	blt	.L7
	add	x1, x0, 11
	and	x2, x1, -8
	ldr	x1, [sp, 8]
	str	x2, [x1]
	b	.L8
.L7:
	add	w3, w1, 8
	ldr	x2, [sp, 8]
	str	w3, [x2, 24]
	ldr	x2, [sp, 8]
	ldr	w2, [x2, 24]
	cmp	w2, 0
	ble	.L9
	add	x1, x0, 11
	and	x2, x1, -8
	ldr	x1, [sp, 8]
	str	x2, [x1]
	b	.L8
.L9:
	ldr	x0, [sp, 8]
	ldr	x2, [x0, 8]
	sxtw	x0, w1
	add	x0, x2, x0
.L8:
	ldr	w0, [x0]
	str	w0, [sp, 24]
	ldr	x0, [sp, 8]
	ldr	w1, [x0, 24]
	ldr	x0, [sp, 8]
	ldr	x0, [x0]
	cmp	w1, 0
	blt	.L10
	add	x1, x0, 11
	and	x2, x1, -8
	ldr	x1, [sp, 8]
	str	x2, [x1]
	b	.L11
.L10:
	add	w3, w1, 8
	ldr	x2, [sp, 8]
	str	w3, [x2, 24]
	ldr	x2, [sp, 8]
	ldr	w2, [x2, 24]
	cmp	w2, 0
	ble	.L12
	add	x1, x0, 11
	and	x2, x1, -8
	ldr	x1, [sp, 8]
	str	x2, [x1]
	b	.L11
.L12:
	ldr	x0, [sp, 8]
	ldr	x2, [x0, 8]
	sxtw	x0, w1
	add	x0, x2, x0
.L11:
	ldr	w0, [x0]
	str	w0, [sp, 20]
	ldr	w1, [sp, 28]
	mov	w0, 100
	mul	w2, w1, w0
	ldr	w1, [sp, 24]
	mov	w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	lsl	w0, w0, 1
	add	w1, w2, w0
	ldr	w0, [sp, 20]
	add	w0, w1, w0
	add	sp, sp, 32
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"%-18s"
	.align	3
.LC2:
	.string	"q"
	.align	3
.LC3:
	.string	"L"
	.align	3
.LC4:
	.string	" i:%d"
	.align	3
.LC5:
	.string	" c:%d"
	.align	3
.LC6:
	.string	" d:%.17g"
	.align	3
.LC7:
	.string	" T:%d"
	.align	3
.LC8:
	.string	"\n  sum=%lx check=%016lx\n"
	.text
	.align	2
wide:
	stp	x29, x30, [sp, -448]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 392]
	str	x2, [sp, 400]
	str	x3, [sp, 408]
	str	x4, [sp, 416]
	str	x5, [sp, 424]
	str	x6, [sp, 432]
	str	x7, [sp, 440]
	str	q0, [sp, 256]
	str	q1, [sp, 272]
	str	q2, [sp, 288]
	str	q3, [sp, 304]
	str	q4, [sp, 320]
	str	q5, [sp, 336]
	str	q6, [sp, 352]
	str	q7, [sp, 368]
	str	xzr, [sp, 248]
	str	xzr, [sp, 240]
	add	x0, sp, 448
	str	x0, [sp, 168]
	add	x0, sp, 448
	str	x0, [sp, 176]
	add	x0, sp, 384
	str	x0, [sp, 184]
	mov	w0, -56
	str	w0, [sp, 192]
	mov	w0, -128
	str	w0, [sp, 196]
	add	x0, sp, 136
	add	x1, sp, 168
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	str	q30, [x0]
	str	q31, [x0, 16]
	ldr	x1, [sp, 24]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	x0, [sp, 24]
	str	x0, [sp, 232]
	b	.L15
.L38:
	ldr	x0, [sp, 232]
	ldrb	w0, [x0]
	cmp	w0, 113
	beq	.L16
	cmp	w0, 113
	bgt	.L17
	cmp	w0, 105
	beq	.L18
	cmp	w0, 105
	bgt	.L17
	cmp	w0, 100
	beq	.L19
	cmp	w0, 100
	bgt	.L17
	cmp	w0, 99
	beq	.L20
	cmp	w0, 99
	bgt	.L17
	cmp	w0, 76
	beq	.L21
	cmp	w0, 84
	beq	.L22
	b	.L17
.L16:
	ldr	w1, [sp, 192]
	ldr	x0, [sp, 168]
	cmp	w1, 0
	blt	.L23
	add	x0, x0, 15
	and	x0, x0, -16
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L24
.L23:
	add	w1, w1, 15
	and	w1, w1, -16
	add	w2, w1, 16
	str	w2, [sp, 192]
	ldr	w2, [sp, 192]
	cmp	w2, 0
	ble	.L25
	add	x0, x0, 15
	and	x0, x0, -16
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L24
.L25:
	ldr	x2, [sp, 176]
	sxtw	x0, w1
	add	x0, x2, x0
.L24:
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp, 112]
	add	x0, sp, 112
	mov	x1, x0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	show128
	mov	x1, x0
	ldr	x0, [sp, 248]
	add	x0, x0, x1
	str	x0, [sp, 248]
	b	.L17
.L21:
	ldr	w0, [sp, 196]
	ldr	x1, [sp, 168]
	cmp	w0, 0
	blt	.L26
	add	x0, x1, 15
	and	x0, x0, -16
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L27
.L26:
	add	w2, w0, 16
	str	w2, [sp, 196]
	ldr	w2, [sp, 196]
	cmp	w2, 0
	ble	.L28
	add	x0, x1, 15
	and	x0, x0, -16
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L27
.L28:
	ldr	x1, [sp, 184]
	sxtw	x0, w0
	add	x0, x1, x0
.L27:
	ldr	q30, [x0]
	str	q30, [sp, 96]
	add	x0, sp, 96
	mov	x1, x0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	show128
	mov	x1, x0
	ldr	x0, [sp, 248]
	add	x0, x0, x1
	str	x0, [sp, 248]
	b	.L17
.L18:
	ldr	w1, [sp, 192]
	ldr	x0, [sp, 168]
	cmp	w1, 0
	blt	.L29
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L30
.L29:
	add	w2, w1, 8
	str	w2, [sp, 192]
	ldr	w2, [sp, 192]
	cmp	w2, 0
	ble	.L31
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L30
.L31:
	ldr	x2, [sp, 176]
	sxtw	x0, w1
	add	x0, x2, x0
.L30:
	ldr	w0, [x0]
	str	w0, [sp, 220]
	ldr	w1, [sp, 220]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w0, [sp, 220]
	uxtw	x0, w0
	ldr	x1, [sp, 248]
	add	x0, x1, x0
	str	x0, [sp, 248]
	b	.L17
.L20:
	ldr	w1, [sp, 192]
	ldr	x0, [sp, 168]
	cmp	w1, 0
	blt	.L32
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L33
.L32:
	add	w2, w1, 8
	str	w2, [sp, 192]
	ldr	w2, [sp, 192]
	cmp	w2, 0
	ble	.L34
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L33
.L34:
	ldr	x2, [sp, 176]
	sxtw	x0, w1
	add	x0, x2, x0
.L33:
	ldr	w0, [x0]
	strb	w0, [sp, 207]
	ldrsb	w0, [sp, 207]
	mov	w1, w0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldrb	w0, [sp, 207]
	and	x0, x0, 255
	ldr	x1, [sp, 248]
	add	x0, x1, x0
	str	x0, [sp, 248]
	b	.L17
.L19:
	ldr	w1, [sp, 196]
	ldr	x0, [sp, 168]
	cmp	w1, 0
	blt	.L35
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L36
.L35:
	add	w2, w1, 16
	str	w2, [sp, 196]
	ldr	w2, [sp, 196]
	cmp	w2, 0
	ble	.L37
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 168]
	b	.L36
.L37:
	ldr	x2, [sp, 184]
	sxtw	x0, w1
	add	x0, x2, x0
.L36:
	ldr	d31, [x0]
	str	d31, [sp, 208]
	ldr	d0, [sp, 208]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	d31, [sp, 208]
	mov	x0, 4652218415073722368
	fmov	d30, x0
	fmul	d31, d31, d30
	fcvtzs	d31, d31
	fmov	x1, d31
	ldr	x0, [sp, 248]
	add	x0, x0, x1
	str	x0, [sp, 248]
	b	.L17
.L22:
	add	x0, sp, 168
	bl	take3
	str	w0, [sp, 200]
	ldr	w1, [sp, 200]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	w0, [sp, 200]
	uxtw	x0, w0
	ldr	x1, [sp, 248]
	add	x0, x1, x0
	str	x0, [sp, 248]
	nop
.L17:
	ldr	x0, [sp, 232]
	add	x0, x0, 1
	str	x0, [sp, 232]
.L15:
	ldr	x0, [sp, 232]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L38
	ldr	x0, [sp, 24]
	str	x0, [sp, 224]
	b	.L39
.L57:
	str	xzr, [sp, 80]
	str	xzr, [sp, 88]
	ldr	x0, [sp, 224]
	ldrb	w0, [x0]
	cmp	w0, 113
	bne	.L40
	ldr	w1, [sp, 160]
	ldr	x0, [sp, 136]
	cmp	w1, 0
	blt	.L41
	add	x0, x0, 15
	and	x0, x0, -16
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 136]
	b	.L42
.L41:
	add	w1, w1, 15
	and	w1, w1, -16
	add	w2, w1, 16
	str	w2, [sp, 160]
	ldr	w2, [sp, 160]
	cmp	w2, 0
	ble	.L43
	add	x0, x0, 15
	and	x0, x0, -16
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 136]
	b	.L42
.L43:
	ldr	x2, [sp, 144]
	sxtw	x0, w1
	add	x0, x2, x0
.L42:
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp, 64]
	add	x1, sp, 64
	add	x0, sp, 80
	mov	x2, 16
	bl	memcpy
	b	.L44
.L40:
	ldr	x0, [sp, 224]
	ldrb	w0, [x0]
	cmp	w0, 76
	bne	.L45
	ldr	w0, [sp, 164]
	ldr	x1, [sp, 136]
	cmp	w0, 0
	blt	.L46
	add	x0, x1, 15
	and	x0, x0, -16
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 136]
	b	.L47
.L46:
	add	w2, w0, 16
	str	w2, [sp, 164]
	ldr	w2, [sp, 164]
	cmp	w2, 0
	ble	.L48
	add	x0, x1, 15
	and	x0, x0, -16
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 136]
	b	.L47
.L48:
	ldr	x1, [sp, 152]
	sxtw	x0, w0
	add	x0, x1, x0
.L47:
	ldr	q30, [x0]
	str	q30, [sp, 48]
	add	x1, sp, 48
	add	x0, sp, 80
	mov	x2, 16
	bl	memcpy
	b	.L44
.L45:
	ldr	x0, [sp, 224]
	ldrb	w0, [x0]
	cmp	w0, 100
	bne	.L49
	ldr	w1, [sp, 164]
	ldr	x0, [sp, 136]
	cmp	w1, 0
	blt	.L50
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 136]
	b	.L51
.L50:
	add	w2, w1, 16
	str	w2, [sp, 164]
	ldr	w2, [sp, 164]
	cmp	w2, 0
	ble	.L52
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 136]
	b	.L51
.L52:
	ldr	x2, [sp, 152]
	sxtw	x0, w1
	add	x0, x2, x0
.L51:
	ldr	d31, [x0]
	str	d31, [sp, 40]
	add	x1, sp, 40
	add	x0, sp, 80
	mov	x2, 8
	bl	memcpy
	b	.L44
.L49:
	ldr	x0, [sp, 224]
	ldrb	w0, [x0]
	cmp	w0, 84
	bne	.L53
	add	x0, sp, 136
	bl	take3
	uxtw	x0, w0
	str	x0, [sp, 80]
	b	.L44
.L53:
	ldr	w1, [sp, 160]
	ldr	x0, [sp, 136]
	cmp	w1, 0
	blt	.L54
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 136]
	b	.L55
.L54:
	add	w2, w1, 8
	str	w2, [sp, 160]
	ldr	w2, [sp, 160]
	cmp	w2, 0
	ble	.L56
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 136]
	b	.L55
.L56:
	ldr	x2, [sp, 144]
	sxtw	x0, w1
	add	x0, x2, x0
.L55:
	ldr	w0, [x0]
	uxtw	x0, w0
	str	x0, [sp, 80]
.L44:
	ldr	x0, [sp, 240]
	ror	x1, x0, 57
	ldr	x0, [sp, 80]
	eor	x2, x1, x0
	ldr	x1, [sp, 88]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	eor	x0, x2, x0
	str	x0, [sp, 240]
	ldr	x0, [sp, 224]
	add	x0, x0, 1
	str	x0, [sp, 224]
.L39:
	ldr	x0, [sp, 224]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L57
	ldr	x2, [sp, 240]
	ldr	x1, [sp, 248]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	nop
	ldp	x29, x30, [sp], 448
	ret
	.section .rodata
	.align	3
.LC9:
	.string	" %d:%g"
	.align	3
.LC10:
	.string	"\n  fp_full=%g\n"
	.text
	.align	2
fp_full:
	stp	x29, x30, [sp, -224]!
	mov	x29, sp
	str	d0, [sp, 88]
	str	d1, [sp, 80]
	str	d2, [sp, 72]
	str	d3, [sp, 64]
	str	d4, [sp, 56]
	str	d5, [sp, 48]
	str	d6, [sp, 40]
	str	d7, [sp, 32]
	str	w0, [sp, 28]
	str	x1, [sp, 168]
	str	x2, [sp, 176]
	str	x3, [sp, 184]
	str	x4, [sp, 192]
	str	x5, [sp, 200]
	str	x6, [sp, 208]
	str	x7, [sp, 216]
	ldr	d30, [sp, 88]
	ldr	d31, [sp, 80]
	fadd	d30, d30, d31
	ldr	d31, [sp, 72]
	fadd	d30, d30, d31
	ldr	d31, [sp, 64]
	fadd	d30, d30, d31
	ldr	d31, [sp, 56]
	fadd	d30, d30, d31
	ldr	d31, [sp, 48]
	fadd	d30, d30, d31
	ldr	d31, [sp, 40]
	fadd	d31, d30, d31
	ldr	d30, [sp, 32]
	fadd	d31, d30, d31
	str	d31, [sp, 152]
	add	x0, sp, 224
	str	x0, [sp, 104]
	add	x0, sp, 224
	str	x0, [sp, 112]
	add	x0, sp, 160
	str	x0, [sp, 120]
	mov	w0, -56
	str	w0, [sp, 128]
	str	wzr, [sp, 132]
	str	wzr, [sp, 148]
	b	.L59
.L66:
	ldr	w1, [sp, 128]
	ldr	x0, [sp, 104]
	cmp	w1, 0
	blt	.L60
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 104]
	b	.L61
.L60:
	add	w2, w1, 8
	str	w2, [sp, 128]
	ldr	w2, [sp, 128]
	cmp	w2, 0
	ble	.L62
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 104]
	b	.L61
.L62:
	ldr	x2, [sp, 112]
	sxtw	x0, w1
	add	x0, x2, x0
.L61:
	ldr	w0, [x0]
	str	w0, [sp, 144]
	ldr	w1, [sp, 132]
	ldr	x0, [sp, 104]
	cmp	w1, 0
	blt	.L63
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 104]
	b	.L64
.L63:
	add	w2, w1, 16
	str	w2, [sp, 132]
	ldr	w2, [sp, 132]
	cmp	w2, 0
	ble	.L65
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 104]
	b	.L64
.L65:
	ldr	x2, [sp, 120]
	sxtw	x0, w1
	add	x0, x2, x0
.L64:
	ldr	d31, [x0]
	str	d31, [sp, 136]
	ldr	d0, [sp, 136]
	ldr	w1, [sp, 144]
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	ldr	w0, [sp, 144]
	scvtf	d30, w0
	ldr	d31, [sp, 136]
	fmul	d31, d30, d31
	ldr	d30, [sp, 152]
	fadd	d31, d30, d31
	str	d31, [sp, 152]
	ldr	w0, [sp, 148]
	add	w0, w0, 1
	str	w0, [sp, 148]
.L59:
	ldr	w1, [sp, 148]
	ldr	w0, [sp, 28]
	cmp	w1, w0
	blt	.L66
	ldr	d0, [sp, 152]
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldr	d31, [sp, 152]
	fmov	d0, d31
	ldp	x29, x30, [sp], 224
	ret
	.section .rodata
	.align	3
.LC11:
	.string	" %ld:%g"
	.align	3
.LC12:
	.string	"\n  gp_full=%ld\n"
	.text
	.align	2
gp_full:
	stp	x29, x30, [sp, -272]!
	mov	x29, sp
	str	x0, [sp, 72]
	str	x1, [sp, 64]
	str	x2, [sp, 56]
	str	x3, [sp, 48]
	str	x4, [sp, 40]
	str	x5, [sp, 32]
	str	x6, [sp, 24]
	str	x7, [sp, 16]
	str	q0, [sp, 144]
	str	q1, [sp, 160]
	str	q2, [sp, 176]
	str	q3, [sp, 192]
	str	q4, [sp, 208]
	str	q5, [sp, 224]
	str	q6, [sp, 240]
	str	q7, [sp, 256]
	ldr	x0, [sp, 64]
	lsl	x1, x0, 1
	ldr	x0, [sp, 72]
	add	x2, x1, x0
	ldr	x1, [sp, 56]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	add	x1, x2, x0
	ldr	x0, [sp, 48]
	lsl	x0, x0, 2
	add	x2, x1, x0
	ldr	x1, [sp, 40]
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	add	x2, x2, x0
	ldr	x1, [sp, 32]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 1
	add	x2, x2, x0
	ldr	x1, [sp, 24]
	mov	x0, x1
	lsl	x0, x0, 3
	sub	x0, x0, x1
	add	x1, x2, x0
	ldr	x0, [sp, 16]
	lsl	x0, x0, 3
	add	x0, x1, x0
	str	x0, [sp, 136]
	add	x0, sp, 280
	str	x0, [sp, 80]
	add	x0, sp, 272
	str	x0, [sp, 88]
	add	x0, sp, 272
	str	x0, [sp, 96]
	str	wzr, [sp, 104]
	mov	w0, -128
	str	w0, [sp, 108]
	str	wzr, [sp, 132]
	b	.L69
.L76:
	ldr	w1, [sp, 104]
	ldr	x0, [sp, 80]
	cmp	w1, 0
	blt	.L70
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 80]
	b	.L71
.L70:
	add	w2, w1, 8
	str	w2, [sp, 104]
	ldr	w2, [sp, 104]
	cmp	w2, 0
	ble	.L72
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 80]
	b	.L71
.L72:
	ldr	x2, [sp, 88]
	sxtw	x0, w1
	add	x0, x2, x0
.L71:
	ldr	x0, [x0]
	str	x0, [sp, 120]
	ldr	w1, [sp, 108]
	ldr	x0, [sp, 80]
	cmp	w1, 0
	blt	.L73
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 80]
	b	.L74
.L73:
	add	w2, w1, 16
	str	w2, [sp, 108]
	ldr	w2, [sp, 108]
	cmp	w2, 0
	ble	.L75
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 80]
	b	.L74
.L75:
	ldr	x2, [sp, 96]
	sxtw	x0, w1
	add	x0, x2, x0
.L74:
	ldr	d31, [x0]
	str	d31, [sp, 112]
	ldr	d0, [sp, 112]
	ldr	x1, [sp, 120]
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	ldr	d30, [sp, 112]
	fmov	d31, 4.0e+0
	fmul	d31, d30, d31
	fcvtzs	x1, d31
	ldr	x0, [sp, 120]
	mul	x0, x1, x0
	ldr	x1, [sp, 136]
	add	x0, x1, x0
	str	x0, [sp, 136]
	ldr	w0, [sp, 132]
	add	w0, w0, 1
	str	w0, [sp, 132]
.L69:
	ldr	w1, [sp, 132]
	ldr	w0, [sp, 272]
	cmp	w1, w0
	blt	.L76
	ldr	x1, [sp, 136]
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	ldr	x0, [sp, 136]
	ldp	x29, x30, [sp], 272
	ret
	.section .rodata
	.align	3
.LC14:
	.string	"iqiq"
	.align	3
.LC15:
	.string	"qqqqi"
	.align	3
.LC16:
	.string	"LdL"
	.align	3
.LC18:
	.string	"iiiiiiiiLLLLLLLLLd"
	.align	3
.LC19:
	.string	"cidd"
	.align	3
.LC20:
	.string	"iTiTd"
	.align	3
.LC21:
	.string	"TTTi"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #176
	stp	x29, x30, [sp, 112]
	add	x29, sp, 112
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp, 160]
	mov	x0, -5
	mov	x1, -1
	stp	x0, x1, [sp, 144]
	mov	w0, -100
	strb	w0, [sp, 143]
	mov	w0, -30000
	strh	w0, [sp, 140]
	mov	w0, 52429
	movk	w0, 0x3dcc, lsl 16
	fmov	s31, w0
	str	s31, [sp, 136]
	ldp	x6, x7, [sp, 144]
	mov	w4, 2
	ldp	x2, x3, [sp, 160]
	mov	w1, 1
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	wide
	mov	w0, 3
	str	w0, [sp, 16]
	ldp	x0, x1, [sp, 144]
	stp	x0, x1, [sp]
	ldp	x6, x7, [sp, 160]
	ldp	x4, x5, [sp, 144]
	ldp	x2, x3, [sp, 160]
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	wide
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	ldr	q2, [x0]
	fmov	d1, 2.0e+0
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	ldr	q0, [x0]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	wide
	fmov	d31, 5.0e-1
	str	d31, [sp, 32]
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	ldr	q30, [x0]
	str	q30, [sp, 16]
	mov	w0, 8
	str	w0, [sp]
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	ldr	q7, [x0]
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	ldr	q6, [x0]
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	ldr	q5, [x0]
	adrp	x0, .LC27
	add	x0, x0, :lo12:.LC27
	ldr	q4, [x0]
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	ldr	q3, [x0]
	adrp	x0, .LC29
	add	x0, x0, :lo12:.LC29
	ldr	q2, [x0]
	adrp	x0, .LC30
	add	x0, x0, :lo12:.LC30
	ldr	q1, [x0]
	adrp	x0, .LC31
	add	x0, x0, :lo12:.LC31
	ldr	q0, [x0]
	mov	w7, 7
	mov	w6, 6
	mov	w5, 5
	mov	w4, 4
	mov	w3, 3
	mov	w2, 2
	mov	w1, 1
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	wide
	ldrsb	w0, [sp, 143]
	ldrsh	w1, [sp, 140]
	ldr	s31, [sp, 136]
	fcvt	d30, s31
	ldr	s31, [sp, 136]
	fcvt	d31, s31
	fmov	d1, d31
	fmov	d0, d30
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	wide
	mov	w0, 6
	str	w0, [sp]
	fmov	d0, 2.5e-1
	mov	w7, 5
	mov	w6, 4
	mov	w5, 8
	mov	w4, 3
	mov	w3, 2
	mov	w2, 1
	mov	w1, 9
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	wide
	mov	w0, 10
	str	w0, [sp, 16]
	mov	w0, 9
	str	w0, [sp, 8]
	mov	w0, 8
	str	w0, [sp]
	mov	w7, 7
	mov	w6, 6
	mov	w5, 5
	mov	w4, 4
	mov	w3, 3
	mov	w2, 2
	mov	w1, 1
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	wide
	fmov	d31, -2.0e+0
	str	d31, [sp, 24]
	fmov	d31, 1.5e+0
	str	d31, [sp, 16]
	fmov	d31, 2.5e-1
	str	d31, [sp, 8]
	fmov	d31, 5.0e-1
	str	d31, [sp]
	mov	w4, 4
	mov	w3, 3
	mov	w2, 2
	mov	w1, 1
	mov	w0, 4
	fmov	d7, 8.0e+0
	fmov	d6, 7.0e+0
	fmov	d5, 6.0e+0
	fmov	d4, 5.0e+0
	fmov	d3, 4.0e+0
	fmov	d2, 3.0e+0
	fmov	d1, 2.0e+0
	fmov	d0, 1.0e+0
	bl	fp_full
	fmov	d31, 9.0e+0
	str	d31, [sp, 80]
	mov	w0, 9
	str	w0, [sp, 72]
	fmov	d31, 8.0e+0
	str	d31, [sp, 64]
	mov	w0, 8
	str	w0, [sp, 56]
	fmov	d31, 7.0e+0
	str	d31, [sp, 48]
	fmov	d31, 6.0e+0
	str	d31, [sp, 40]
	fmov	d31, 5.0e+0
	str	d31, [sp, 32]
	fmov	d31, 4.0e+0
	str	d31, [sp, 24]
	fmov	d31, 3.0e+0
	str	d31, [sp, 16]
	fmov	d31, 2.0e+0
	str	d31, [sp, 8]
	fmov	d31, 1.0e+0
	str	d31, [sp]
	mov	w7, 7
	mov	w6, 6
	mov	w5, 5
	mov	w4, 4
	mov	w3, 3
	mov	w2, 2
	mov	w1, 1
	mov	w0, 9
	fmov	d7, 5.0e-1
	movi	d6, #0
	movi	d5, #0
	movi	d4, #0
	movi	d3, #0
	movi	d2, #0
	movi	d1, #0
	fmov	d0, 5.0e-1
	bl	fp_full
	mov	x0, 30
	str	x0, [sp, 24]
	mov	x0, -20
	str	x0, [sp, 16]
	mov	x0, 10
	str	x0, [sp, 8]
	mov	w0, 3
	str	w0, [sp]
	fmov	d2, 2.0e+0
	fmov	d1, 1.25e+0
	fmov	d0, 5.0e-1
	mov	x7, 8
	mov	x6, 7
	mov	x5, 6
	mov	x4, 5
	mov	x3, 4
	mov	x2, 3
	mov	x1, 2
	mov	x0, 1
	bl	gp_full
	fmov	d31, 2.5e+0
	str	d31, [sp, 96]
	mov	x0, 10
	str	x0, [sp, 88]
	fmov	d31, 2.25e+0
	str	d31, [sp, 80]
	mov	x0, 9
	str	x0, [sp, 72]
	mov	x0, 8
	str	x0, [sp, 64]
	mov	x0, 7
	str	x0, [sp, 56]
	mov	x0, 6
	str	x0, [sp, 48]
	mov	x0, 5
	str	x0, [sp, 40]
	mov	x0, 4
	str	x0, [sp, 32]
	mov	x0, 3
	str	x0, [sp, 24]
	mov	x0, 2
	str	x0, [sp, 16]
	mov	x0, 1
	str	x0, [sp, 8]
	mov	w0, 10
	str	w0, [sp]
	fmov	d7, 2.0e+0
	fmov	d6, 1.75e+0
	fmov	d5, 1.5e+0
	fmov	d4, 1.25e+0
	fmov	d3, 1.0e+0
	fmov	d2, 7.5e-1
	fmov	d1, 5.0e-1
	fmov	d0, 2.5e-1
	mov	x7, -8
	mov	x6, -7
	mov	x5, -6
	mov	x4, -5
	mov	x3, -4
	mov	x2, -3
	mov	x1, -2
	mov	x0, -1
	bl	gp_full
	mov	w0, 0
	ldp	x29, x30, [sp, 112]
	add	sp, sp, 176
	ret
	.section .rodata
	.align	4
.LC13:
	.xword	-81985529216486896
	.xword	81985529216486895
	.align	4
.LC17:
	.word	-1717986918
	.word	-1717986919
	.word	-1717986919
	.word	-1074030183
	.align	4
.LC22:
	.word	0
	.word	0
	.word	0
	.word	1073709056
	.align	4
.LC23:
	.word	0
	.word	0
	.word	0
	.word	1073881088
	.align	4
.LC24:
	.word	0
	.word	0
	.word	0
	.word	1073872896
	.align	4
.LC25:
	.word	0
	.word	0
	.word	0
	.word	1073856512
	.align	4
.LC26:
	.word	0
	.word	0
	.word	0
	.word	1073840128
	.align	4
.LC27:
	.word	0
	.word	0
	.word	0
	.word	1073823744
	.align	4
.LC28:
	.word	0
	.word	0
	.word	0
	.word	1073807360
	.align	4
.LC29:
	.word	0
	.word	0
	.word	0
	.word	1073774592
	.align	4
.LC30:
	.word	0
	.word	0
	.word	0
	.word	1073741824
	.align	4
.LC31:
	.word	0
	.word	0
	.word	0
	.word	1073676288

