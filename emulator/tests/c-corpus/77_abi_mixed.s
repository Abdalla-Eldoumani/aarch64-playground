	.text
	.section .rodata
	.align	3
.LC3:
	.string	"k1 %d %g %g %ld %d %d %d %g\n"
	.align	3
.LC4:
	.string	"k2 %ld %ld %ld %ld %g %g %g %d\n"
	.align	3
.LC5:
	.string	"k3 %g %g %d %d %d %g\n"
	.align	3
.LC6:
	.string	"k4 %g %g %g %c %ld %ld %ld %ld\n"
	.text
	.align	2
	.global	kitchen
kitchen:
	stp	x29, x30, [sp, -208]!
	mov	x29, sp
	str	x19, [sp, 16]
	str	w0, [sp, 204]
	fmov	d30, d0
	fmov	d31, d1
	mov	x8, 0
	mov	x9, 0
	fmov	x8, d30
	fmov	x9, d31
	stp	x8, x9, [sp, 184]
	str	x1, [sp, 176]
	mov	x8, x2
	mov	x9, x3
	str	d2, [sp, 152]
	mov	x19, x4
	ldp	q30, q31, [x19]
	add	x0, sp, 120
	stp	q30, q31, [x0]
	fmov	s27, s3
	fmov	s28, s4
	fmov	s29, s5
	str	w5, [sp, 200]
	fmov	d30, d6
	fmov	d31, d7
	mov	x0, 0
	mov	x1, 0
	fmov	x0, d30
	fmov	x1, d31
	stp	x0, x1, [sp, 88]
	mov	x2, x6
	mov	x3, x7
	ldr	x19, [sp, 240]
	ldp	q30, q31, [x19]
	add	x0, sp, 40
	stp	q30, q31, [x0]
	str	x8, [sp, 160]
	ldr	w0, [sp, 168]
	mov	w1, w9
	bfi	w0, w1, 0, 32
	str	w0, [sp, 168]
	str	s27, [sp, 104]
	str	s28, [sp, 108]
	str	s29, [sp, 112]
	str	x2, [sp, 72]
	ldr	w0, [sp, 80]
	mov	w1, w3
	bfi	w0, w1, 0, 32
	str	w0, [sp, 80]
	ldr	d31, [sp, 184]
	ldr	d30, [sp, 192]
	ldr	w0, [sp, 160]
	ldr	w1, [sp, 164]
	ldr	w2, [sp, 168]
	ldr	d2, [sp, 152]
	mov	w5, w2
	mov	w4, w1
	mov	w3, w0
	ldr	x2, [sp, 176]
	fmov	d1, d30
	fmov	d0, d31
	ldr	w1, [sp, 204]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	x0, [sp, 120]
	ldr	x1, [sp, 128]
	ldr	x2, [sp, 136]
	ldr	x3, [sp, 144]
	ldr	s31, [sp, 104]
	fcvt	d30, s31
	ldr	s31, [sp, 108]
	fcvt	d29, s31
	ldr	s31, [sp, 112]
	fcvt	d31, s31
	ldr	w5, [sp, 200]
	fmov	d2, d31
	fmov	d1, d29
	fmov	d0, d30
	mov	x4, x3
	mov	x3, x2
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	d31, [sp, 88]
	ldr	d30, [sp, 96]
	ldr	w0, [sp, 72]
	ldr	w1, [sp, 76]
	ldr	w2, [sp, 80]
	ldr	d2, [sp, 208]
	mov	w3, w2
	mov	w2, w1
	mov	w1, w0
	fmov	d1, d30
	fmov	d0, d31
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	s31, [sp, 216]
	fcvt	d30, s31
	ldr	s31, [sp, 220]
	fcvt	d29, s31
	ldr	s31, [sp, 224]
	fcvt	d31, s31
	ldrb	w0, [sp, 232]
	ldr	x1, [sp, 40]
	ldr	x2, [sp, 48]
	ldr	x3, [sp, 56]
	ldr	x4, [sp, 64]
	mov	x5, x4
	mov	x4, x3
	mov	x3, x2
	mov	x2, x1
	mov	w1, w0
	fmov	d2, d31
	fmov	d1, d29
	fmov	d0, d30
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	w0, [sp, 204]
	scvtf	d30, w0
	ldr	d31, [sp, 184]
	fadd	d30, d30, d31
	ldr	d31, [sp, 176]
	scvtf	d31, d31
	fadd	d30, d30, d31
	ldr	w0, [sp, 168]
	scvtf	d31, w0
	fadd	d30, d30, d31
	ldr	d31, [sp, 152]
	fadd	d30, d30, d31
	ldr	d31, [sp, 144]
	scvtf	d31, d31
	fadd	d30, d30, d31
	ldr	s31, [sp, 112]
	fcvt	d31, s31
	fadd	d30, d30, d31
	ldr	w0, [sp, 200]
	scvtf	d31, w0
	fadd	d30, d30, d31
	ldr	d31, [sp, 96]
	fadd	d30, d30, d31
	ldr	w0, [sp, 72]
	scvtf	d31, w0
	fadd	d30, d30, d31
	ldr	d31, [sp, 208]
	fadd	d30, d30, d31
	ldr	s31, [sp, 220]
	fcvt	d31, s31
	fadd	d30, d30, d31
	ldrb	w0, [sp, 232]
	scvtf	d31, w0
	fadd	d30, d30, d31
	ldr	d31, [sp, 40]
	scvtf	d31, d31
	fadd	d31, d30, d31
	fmov	d0, d31
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 208
	ret
	.section .rodata
	.align	3
.LC7:
	.string	"vmix %s:"
	.align	3
.LC8:
	.string	" %d"
	.align	3
.LC9:
	.string	" %g"
	.align	3
.LC10:
	.string	" (%g,%g)"
	.align	3
.LC11:
	.string	" <%g,%g,%g>"
	.align	3
.LC12:
	.string	" [%d,%d,%d]"
	.align	3
.LC13:
	.string	" {%ld..%ld}"
	.align	3
.LC14:
	.string	" = %.1f\n"
	.text
	.align	2
	.global	vmix
vmix:
	stp	x29, x30, [sp, -400]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 344]
	str	x2, [sp, 352]
	str	x3, [sp, 360]
	str	x4, [sp, 368]
	str	x5, [sp, 376]
	str	x6, [sp, 384]
	str	x7, [sp, 392]
	str	q0, [sp, 208]
	str	q1, [sp, 224]
	str	q2, [sp, 240]
	str	q3, [sp, 256]
	str	q4, [sp, 272]
	str	q5, [sp, 288]
	str	q6, [sp, 304]
	str	q7, [sp, 320]
	add	x0, sp, 400
	str	x0, [sp, 112]
	add	x0, sp, 400
	str	x0, [sp, 120]
	add	x0, sp, 336
	str	x0, [sp, 128]
	mov	w0, -56
	str	w0, [sp, 136]
	mov	w0, -128
	str	w0, [sp, 140]
	str	xzr, [sp, 200]
	ldr	x1, [sp, 24]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	x0, [sp, 24]
	str	x0, [sp, 192]
	b	.L4
.L30:
	ldr	x0, [sp, 192]
	ldrb	w0, [x0]
	cmp	w0, 115
	beq	.L5
	cmp	w0, 115
	bgt	.L6
	cmp	w0, 105
	beq	.L7
	cmp	w0, 105
	bgt	.L6
	cmp	w0, 104
	beq	.L8
	cmp	w0, 104
	bgt	.L6
	cmp	w0, 102
	beq	.L9
	cmp	w0, 102
	bgt	.L6
	cmp	w0, 98
	beq	.L10
	cmp	w0, 100
	beq	.L11
	b	.L6
.L7:
	ldr	w1, [sp, 136]
	ldr	x0, [sp, 112]
	cmp	w1, 0
	blt	.L12
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 112]
	b	.L13
.L12:
	add	w2, w1, 8
	str	w2, [sp, 136]
	ldr	w2, [sp, 136]
	cmp	w2, 0
	ble	.L14
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 112]
	b	.L13
.L14:
	ldr	x2, [sp, 120]
	sxtw	x0, w1
	add	x0, x2, x0
.L13:
	ldr	w0, [x0]
	str	w0, [sp, 188]
	ldr	d30, [sp, 200]
	fmov	d31, 3.0e+0
	fmul	d30, d30, d31
	ldr	w0, [sp, 188]
	scvtf	d31, w0
	fadd	d31, d30, d31
	str	d31, [sp, 200]
	ldr	w1, [sp, 188]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	b	.L6
.L11:
	ldr	w1, [sp, 140]
	ldr	x0, [sp, 112]
	cmp	w1, 0
	blt	.L15
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 112]
	b	.L16
.L15:
	add	w2, w1, 16
	str	w2, [sp, 140]
	ldr	w2, [sp, 140]
	cmp	w2, 0
	ble	.L17
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 112]
	b	.L16
.L17:
	ldr	x2, [sp, 128]
	sxtw	x0, w1
	add	x0, x2, x0
.L16:
	ldr	d31, [x0]
	str	d31, [sp, 176]
	ldr	d30, [sp, 200]
	fmov	d31, 3.0e+0
	fmul	d31, d30, d31
	ldr	d30, [sp, 176]
	fadd	d31, d30, d31
	str	d31, [sp, 200]
	ldr	d0, [sp, 176]
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	b	.L6
.L8:
	ldr	w1, [sp, 140]
	ldr	x0, [sp, 112]
	cmp	w1, 0
	blt	.L18
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 112]
	b	.L19
.L18:
	add	w2, w1, 32
	str	w2, [sp, 140]
	ldr	w2, [sp, 140]
	cmp	w2, 0
	ble	.L20
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 112]
	b	.L19
.L20:
	ldr	x2, [sp, 128]
	sxtw	x0, w1
	add	x2, x2, x0
	add	x0, sp, 144
	ldr	d31, [x2]
	str	d31, [x0]
	ldr	x2, [sp, 128]
	sxtw	x0, w1
	add	x0, x0, 16
	add	x0, x2, x0
	ldr	d31, [x0]
	str	d31, [sp, 152]
	add	x0, sp, 144
.L19:
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp, 96]
	ldr	d30, [sp, 200]
	fmov	d31, 3.0e+0
	fmul	d30, d30, d31
	ldr	d31, [sp, 96]
	fadd	d30, d30, d31
	ldr	d31, [sp, 104]
	fsub	d31, d30, d31
	str	d31, [sp, 200]
	ldr	d31, [sp, 96]
	ldr	d30, [sp, 104]
	fmov	d1, d30
	fmov	d0, d31
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	b	.L6
.L9:
	ldr	w1, [sp, 140]
	ldr	x0, [sp, 112]
	cmp	w1, 0
	blt	.L21
	add	x1, x0, 19
	and	x1, x1, -8
	str	x1, [sp, 112]
	b	.L22
.L21:
	add	w2, w1, 48
	str	w2, [sp, 140]
	ldr	w2, [sp, 140]
	cmp	w2, 0
	ble	.L23
	add	x1, x0, 19
	and	x1, x1, -8
	str	x1, [sp, 112]
	b	.L22
.L23:
	ldr	x2, [sp, 128]
	sxtw	x0, w1
	add	x2, x2, x0
	add	x0, sp, 160
	ldr	s31, [x2]
	str	s31, [x0]
	ldr	x2, [sp, 128]
	sxtw	x0, w1
	add	x0, x0, 16
	add	x0, x2, x0
	ldr	s31, [x0]
	str	s31, [sp, 164]
	ldr	x2, [sp, 128]
	sxtw	x0, w1
	add	x0, x0, 32
	add	x0, x2, x0
	ldr	s31, [x0]
	str	s31, [sp, 168]
	add	x0, sp, 160
.L22:
	add	x1, sp, 80
	ldr	x2, [x0]
	ldr	w0, [x0, 8]
	str	x2, [x1]
	str	w0, [x1, 8]
	ldr	d30, [sp, 200]
	fmov	d31, 3.0e+0
	fmul	d30, d30, d31
	ldr	s31, [sp, 80]
	fcvt	d31, s31
	fadd	d30, d30, d31
	ldr	s31, [sp, 84]
	fcvt	d31, s31
	fadd	d30, d30, d31
	ldr	s31, [sp, 88]
	fcvt	d31, s31
	fadd	d31, d30, d31
	str	d31, [sp, 200]
	ldr	s31, [sp, 80]
	fcvt	d30, s31
	ldr	s31, [sp, 84]
	fcvt	d29, s31
	ldr	s31, [sp, 88]
	fcvt	d31, s31
	fmov	d2, d31
	fmov	d1, d29
	fmov	d0, d30
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	b	.L6
.L5:
	ldr	w1, [sp, 136]
	ldr	x0, [sp, 112]
	cmp	w1, 0
	blt	.L24
	add	x1, x0, 19
	and	x1, x1, -8
	str	x1, [sp, 112]
	b	.L25
.L24:
	add	w2, w1, 16
	str	w2, [sp, 136]
	ldr	w2, [sp, 136]
	cmp	w2, 0
	ble	.L26
	add	x1, x0, 19
	and	x1, x1, -8
	str	x1, [sp, 112]
	b	.L25
.L26:
	ldr	x2, [sp, 120]
	sxtw	x0, w1
	add	x0, x2, x0
.L25:
	add	x1, sp, 64
	ldr	x2, [x0]
	ldr	w0, [x0, 8]
	str	x2, [x1]
	str	w0, [x1, 8]
	ldr	d30, [sp, 200]
	fmov	d31, 3.0e+0
	fmul	d30, d30, d31
	ldr	w0, [sp, 64]
	scvtf	d31, w0
	fadd	d30, d30, d31
	ldr	w0, [sp, 72]
	scvtf	d31, w0
	fsub	d31, d30, d31
	str	d31, [sp, 200]
	ldr	w0, [sp, 64]
	ldr	w1, [sp, 68]
	ldr	w2, [sp, 72]
	mov	w3, w2
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	b	.L6
.L10:
	ldr	w1, [sp, 136]
	ldr	x0, [sp, 112]
	cmp	w1, 0
	blt	.L27
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 112]
	b	.L28
.L27:
	add	w2, w1, 8
	str	w2, [sp, 136]
	ldr	w2, [sp, 136]
	cmp	w2, 0
	ble	.L29
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 112]
	b	.L28
.L29:
	ldr	x2, [sp, 120]
	sxtw	x0, w1
	add	x0, x2, x0
.L28:
	ldr	x0, [x0]
	ldp	q30, q31, [x0]
	stp	q30, q31, [sp, 32]
	ldr	d30, [sp, 200]
	fmov	d31, 3.0e+0
	fmul	d30, d30, d31
	ldr	d31, [sp, 32]
	scvtf	d31, d31
	fadd	d30, d30, d31
	ldr	d31, [sp, 56]
	scvtf	d31, d31
	fadd	d31, d30, d31
	str	d31, [sp, 200]
	ldr	x0, [sp, 32]
	ldr	x1, [sp, 56]
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	nop
.L6:
	ldr	x0, [sp, 192]
	add	x0, x0, 1
	str	x0, [sp, 192]
.L4:
	ldr	x0, [sp, 192]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L30
	ldr	d0, [sp, 200]
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	printf
	ldr	d31, [sp, 200]
	fmov	d0, d31
	ldp	x29, x30, [sp], 400
	ret
	.align	2
	.global	mkbig
mkbig:
	sub	sp, sp, #48
	mov	x2, x8
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	str	x0, [sp, 16]
	ldr	x0, [sp, 8]
	mul	x0, x0, x0
	str	x0, [sp, 24]
	ldr	x0, [sp, 8]
	neg	x0, x0
	str	x0, [sp, 32]
	mov	x1, 100
	ldr	x0, [sp, 8]
	sub	x0, x1, x0
	str	x0, [sp, 40]
	ldp	q30, q31, [sp, 16]
	stp	q30, q31, [x2]
	add	sp, sp, 48
	ret
	.align	2
	.global	mkbig2
mkbig2:
	sub	sp, sp, #48
	mov	x2, x8
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	add	x0, x0, 1
	str	x0, [sp, 16]
	ldr	x0, [sp, 8]
	sub	x0, x0, #1
	str	x0, [sp, 24]
	ldr	x1, [sp, 8]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	str	x0, [sp, 32]
	mov	x0, 7
	str	x0, [sp, 40]
	ldp	q30, q31, [sp, 16]
	stp	q30, q31, [x2]
	add	sp, sp, 48
	ret
	.align	2
	.global	rot90
rot90:
	sub	sp, sp, #32
	fmov	d30, d0
	fmov	d31, d1
	mov	x0, 0
	mov	x1, 0
	fmov	x0, d30
	fmov	x1, d31
	stp	x0, x1, [sp]
	ldr	d31, [sp, 8]
	fneg	d31, d31
	str	d31, [sp, 16]
	ldr	d31, [sp]
	str	d31, [sp, 24]
	ldp	x0, x1, [sp, 16]
	fmov	d30, x0
	fmov	d31, x1
	fmov	d0, d30
	fmov	d1, d31
	add	sp, sp, 32
	ret
	.align	2
	.global	conj2
conj2:
	sub	sp, sp, #32
	fmov	d30, d0
	fmov	d31, d1
	mov	x0, 0
	mov	x1, 0
	fmov	x0, d30
	fmov	x1, d31
	stp	x0, x1, [sp]
	ldr	d31, [sp]
	str	d31, [sp, 16]
	ldr	d31, [sp, 8]
	fneg	d31, d31
	str	d31, [sp, 24]
	ldp	x0, x1, [sp, 16]
	fmov	d30, x0
	fmov	d31, x1
	fmov	d0, d30
	fmov	d1, d31
	add	sp, sp, 32
	ret
	.global	makers
	.data
	.align	3
makers:
	.xword	mkbig
	.xword	mkbig2
	.global	turns
	.align	3
turns:
	.xword	rot90
	.xword	conj2
	.text
	.align	2
	.global	cpowi
cpowi:
	stp	x29, x30, [sp, -96]!
	mov	x29, sp
	fmov	d30, d0
	fmov	d31, d1
	mov	x2, 0
	mov	x3, 0
	fmov	x2, d30
	fmov	x3, d31
	stp	x2, x3, [sp, 32]
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	cmp	w0, 0
	bne	.L41
	fmov	d31, 1.0e+0
	fmov	x4, d31
	movi	d31, #0
	fmov	x5, d31
	b	.L44
.L41:
	ldr	w0, [sp, 28]
	lsr	w1, w0, 31
	add	w0, w1, w0
	asr	w0, w0, 1
	ldr	d30, [sp, 32]
	ldr	d31, [sp, 40]
	fmov	d0, d30
	fmov	d1, d31
	bl	cpowi
	fmov	d30, d0
	fmov	d31, d1
	str	d30, [sp, 80]
	str	d31, [sp, 88]
	ldr	d30, [sp, 80]
	ldr	d31, [sp, 80]
	fmul	d30, d30, d31
	ldr	d29, [sp, 88]
	ldr	d31, [sp, 88]
	fmul	d31, d29, d31
	fsub	d31, d30, d31
	str	d31, [sp, 64]
	ldr	d31, [sp, 80]
	fadd	d30, d31, d31
	ldr	d31, [sp, 88]
	fmul	d31, d30, d31
	str	d31, [sp, 72]
	ldr	w0, [sp, 28]
	and	w0, w0, 1
	cmp	w0, 0
	beq	.L43
	ldr	d30, [sp, 64]
	ldr	d31, [sp, 32]
	fmul	d30, d30, d31
	ldr	d29, [sp, 72]
	ldr	d31, [sp, 40]
	fmul	d31, d29, d31
	fsub	d31, d30, d31
	str	d31, [sp, 48]
	ldr	d30, [sp, 64]
	ldr	d31, [sp, 40]
	fmul	d30, d30, d31
	ldr	d29, [sp, 72]
	ldr	d31, [sp, 32]
	fmul	d31, d29, d31
	fadd	d31, d30, d31
	str	d31, [sp, 56]
	ldp	x0, x1, [sp, 48]
	stp	x0, x1, [sp, 64]
.L43:
	ldp	x4, x5, [sp, 64]
.L44:
	fmov	d30, x4
	fmov	d31, x5
	fmov	d0, d30
	fmov	d1, d31
	ldp	x29, x30, [sp], 96
	ret
	.global	knob
	.data
	.align	2
knob:
	.word	2
	.section .rodata
	.align	3
.LC15:
	.string	"kitchen %.4f\n"
	.align	3
.LC16:
	.string	"ihdfsb"
	.align	3
.LC17:
	.string	"hhhfddsssib"
	.align	3
.LC18:
	.string	"dddddddddfh"
	.align	3
.LC19:
	.string	"fp %d: %ld %ld %ld %ld | %g %g\n"
	.align	3
.LC20:
	.string	"(1+i)^%d = %g %g\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #416
	stp	x29, x30, [sp, 48]
	add	x29, sp, 48
	adrp	x0, knob
	add	x0, x0, :lo12:knob
	ldr	w0, [x0]
	str	w0, [sp, 404]
	fmov	d31, 1.5e+0
	str	d31, [sp, 376]
	ldr	w0, [sp, 404]
	neg	w0, w0
	scvtf	d31, w0
	str	d31, [sp, 384]
	fmov	d31, 2.5e-1
	str	d31, [sp, 360]
	fmov	d31, 8.0e+0
	str	d31, [sp, 368]
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 344
	ldr	x2, [x1]
	ldr	w1, [x1, 8]
	str	x2, [x0]
	str	w1, [x0, 8]
	adrp	x0, .LC1
	add	x1, x0, :lo12:.LC1
	add	x0, sp, 328
	ldr	x2, [x1]
	ldr	w1, [x1, 8]
	str	x2, [x0]
	str	w1, [x0, 8]
	fmov	s31, 5.0e-1
	str	s31, [sp, 312]
	ldr	s31, [sp, 404]
	scvtf	s31, s31
	str	s31, [sp, 316]
	fmov	s31, -4.0e+0
	str	s31, [sp, 320]
	adrp	x0, .LC2
	add	x1, x0, :lo12:.LC2
	add	x0, sp, 296
	ldr	x2, [x1]
	ldr	w1, [x1, 8]
	str	x2, [x0]
	str	w1, [x0, 8]
	ldrsw	x0, [sp, 404]
	add	x1, sp, 264
	mov	x8, x1
	bl	mkbig
	ldr	w0, [sp, 404]
	neg	w0, w0
	sxtw	x0, w0
	add	x1, sp, 232
	mov	x8, x1
	bl	mkbig2
	ldr	w0, [sp, 404]
	neg	w5, w0
	add	x0, sp, 264
	ldp	q30, q31, [x0]
	stp	q30, q31, [sp, 96]
	add	x0, sp, 232
	ldp	q30, q31, [x0]
	stp	q30, q31, [sp, 64]
	ldr	x6, [sp, 328]
	ldr	w7, [sp, 336]
	ldr	d25, [sp, 360]
	ldr	d26, [sp, 368]
	ldr	s27, [sp, 312]
	ldr	s28, [sp, 316]
	ldr	s29, [sp, 320]
	add	x4, sp, 96
	ldr	x2, [sp, 344]
	ldr	w3, [sp, 352]
	ldr	d30, [sp, 376]
	ldr	d31, [sp, 384]
	add	x0, sp, 64
	str	x0, [sp, 32]
	mov	w0, 90
	strb	w0, [sp, 24]
	add	x0, sp, 8
	add	x1, sp, 296
	ldr	x8, [x1]
	ldr	w1, [x1, 8]
	str	x8, [x0]
	str	w1, [x0, 8]
	mov	x0, 140737488355328
	movk	x0, 0x4023, lsl 48
	fmov	d24, x0
	str	d24, [sp]
	fmov	d6, d25
	fmov	d7, d26
	fmov	s3, s27
	fmov	s4, s28
	fmov	s5, s29
	fmov	d2, -7.5e+0
	mov	x1, 1099511627776
	fmov	d0, d30
	fmov	d1, d31
	ldr	w0, [sp, 404]
	bl	kitchen
	str	d0, [sp, 392]
	ldr	d0, [sp, 392]
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	add	x0, sp, 264
	ldp	q30, q31, [x0]
	stp	q30, q31, [sp, 96]
	add	x2, sp, 96
	ldr	x1, [sp, 344]
	ldr	w0, [sp, 352]
	ldr	s27, [sp, 312]
	ldr	s28, [sp, 316]
	ldr	s29, [sp, 320]
	ldr	d30, [sp, 376]
	ldr	d31, [sp, 384]
	mov	x4, x2
	mov	x2, x1
	mov	x3, x0
	fmov	s3, s27
	fmov	s4, s28
	fmov	s5, s29
	fmov	d2, 2.5e+0
	fmov	d0, d30
	fmov	d1, d31
	ldr	w1, [sp, 404]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	vmix
	add	x0, sp, 232
	ldp	q30, q31, [x0]
	stp	q30, q31, [sp, 96]
	ldr	x5, [sp, 344]
	ldr	w6, [sp, 352]
	ldr	x3, [sp, 328]
	ldr	w4, [sp, 336]
	ldr	x8, [sp, 344]
	ldr	w2, [sp, 352]
	ldr	d26, [sp, 376]
	ldr	d27, [sp, 384]
	ldr	d28, [sp, 360]
	ldr	d29, [sp, 368]
	ldr	d30, [sp, 376]
	ldr	d31, [sp, 384]
	add	x0, sp, 96
	str	x0, [sp, 32]
	fmov	d25, -3.0e+0
	str	d25, [sp, 24]
	fmov	d25, 1.25e+0
	str	d25, [sp, 16]
	mov	x1, sp
	add	x0, sp, 296
	ldr	x7, [x0]
	ldr	w0, [x0, 8]
	str	x7, [x1]
	str	w0, [x1, 8]
	mov	w7, 42
	mov	x1, x8
	fmov	d4, d26
	fmov	d5, d27
	fmov	d2, d28
	fmov	d3, d29
	fmov	d0, d30
	fmov	d1, d31
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	vmix
	add	x0, sp, 360
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp, 24]
	add	x0, sp, 8
	add	x1, sp, 312
	ldr	x2, [x1]
	ldr	w1, [x1, 8]
	str	x2, [x0]
	str	w1, [x0, 8]
	fmov	d31, 9.0e+0
	str	d31, [sp]
	fmov	d7, 8.0e+0
	fmov	d6, 7.0e+0
	fmov	d5, 6.0e+0
	fmov	d4, 5.0e+0
	fmov	d3, 4.0e+0
	fmov	d2, 3.0e+0
	fmov	d1, 2.0e+0
	fmov	d0, 1.0e+0
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	vmix
	fmov	d31, 3.0e+0
	str	d31, [sp, 216]
	fmov	d31, 4.0e+0
	str	d31, [sp, 224]
	str	wzr, [sp, 412]
	b	.L46
.L47:
	ldr	w0, [sp, 412]
	and	w1, w0, 1
	adrp	x0, makers
	add	x0, x0, :lo12:makers
	sxtw	x1, w1
	ldr	x1, [x0, x1, lsl 3]
	ldr	w2, [sp, 412]
	ldr	w0, [sp, 404]
	add	w0, w2, w0
	sxtw	x0, w0
	add	x2, sp, 136
	mov	x8, x2
	blr	x1
	ldr	w0, [sp, 412]
	asr	w0, w0, 1
	and	w1, w0, 1
	adrp	x0, turns
	add	x0, x0, :lo12:turns
	sxtw	x1, w1
	ldr	x0, [x0, x1, lsl 3]
	ldr	d30, [sp, 216]
	ldr	d31, [sp, 224]
	fmov	d0, d30
	fmov	d1, d31
	blr	x0
	fmov	d30, d0
	fmov	d31, d1
	str	d30, [sp, 216]
	str	d31, [sp, 224]
	ldr	x0, [sp, 136]
	ldr	x1, [sp, 144]
	ldr	x2, [sp, 152]
	ldr	x3, [sp, 160]
	ldr	d31, [sp, 216]
	ldr	d30, [sp, 224]
	fmov	d1, d30
	fmov	d0, d31
	mov	x5, x3
	mov	x4, x2
	mov	x3, x1
	mov	x2, x0
	ldr	w1, [sp, 412]
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	printf
	ldr	w0, [sp, 412]
	add	w0, w0, 1
	str	w0, [sp, 412]
.L46:
	ldr	w0, [sp, 412]
	cmp	w0, 3
	ble	.L47
	fmov	d31, 1.0e+0
	str	d31, [sp, 200]
	fmov	d31, 1.0e+0
	str	d31, [sp, 208]
	str	wzr, [sp, 184]
	mov	w0, 1
	str	w0, [sp, 188]
	mov	w0, 10
	str	w0, [sp, 192]
	mov	w0, 13
	str	w0, [sp, 196]
	str	wzr, [sp, 408]
	b	.L48
.L49:
	ldrsw	x0, [sp, 408]
	lsl	x0, x0, 2
	add	x1, sp, 184
	ldr	w0, [x1, x0]
	ldr	d30, [sp, 200]
	ldr	d31, [sp, 208]
	fmov	d0, d30
	fmov	d1, d31
	bl	cpowi
	fmov	d30, d0
	fmov	d31, d1
	str	d30, [sp, 168]
	str	d31, [sp, 176]
	ldrsw	x0, [sp, 408]
	lsl	x0, x0, 2
	add	x1, sp, 184
	ldr	w0, [x1, x0]
	ldr	d31, [sp, 168]
	ldr	d30, [sp, 176]
	fmov	d1, d30
	fmov	d0, d31
	mov	w1, w0
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	printf
	ldr	w0, [sp, 408]
	add	w0, w0, 1
	str	w0, [sp, 408]
.L48:
	ldr	w0, [sp, 408]
	cmp	w0, 3
	ble	.L49
	mov	w0, 0
	ldp	x29, x30, [sp, 48]
	add	sp, sp, 416
	ret
	.section .rodata
	.align	3
.LC0:
	.word	1
	.word	-2
	.word	3
	.align	3
.LC1:
	.word	100
	.word	200
	.word	-300
	.align	3
.LC2:
	.word	1098907648
	.word	-1107296256
	.word	1073741824
	.text

