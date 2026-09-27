	.text
	.align	2
	.align 5
	.global	mkbig
mkbig:
	mul	x1, x0, x0
	neg	x2, x0
	stp	x0, x1, [x8]
	mov	x1, 100
	sub	x0, x1, x0
	stp	x2, x0, [x8, 16]
	ret
	.align	2
	.align 5
	.global	mkbig2
mkbig2:
	adrp	x1, .LANCHOR0
	dup	v31.2d, x0
	add	x0, x0, x0, lsl 1
	ldr	q30, [x1, :lo12:.LANCHOR0]
	mov	x1, 7
	stp	x0, x1, [x8, 16]
	add	v30.2d, v31.2d, v30.2d
	str	q30, [x8]
	ret
	.align	2
	.align 5
	.global	rot90
rot90:
	fmov	d31, d0
	fneg	d0, d1
	fmov	d1, d31
	ret
	.align	2
	.align 5
	.global	conj2
conj2:
	fneg	d1, d1
	ret
	.section .rodata
	.align	3
.LC4:
	.string	"k1 %d %g %g %ld %d %d %d %g\n"
	.align	3
.LC5:
	.string	"k2 %ld %ld %ld %ld %g %g %g %d\n"
	.align	3
.LC6:
	.string	"k3 %g %g %d %d %d %g\n"
	.align	3
.LC7:
	.string	"k4 %g %g %g %c %ld %ld %ld %ld\n"
	.text
	.align	2
	.align 5
	.global	kitchen
kitchen:
	stp	x29, x30, [sp, -240]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	mov	w22, w6
	ldrb	w21, [sp, 264]
	stp	x23, x24, [sp, 48]
	mov	w23, w5
	ldr	w24, [sp, 232]
	stp	x25, x26, [sp, 64]
	mov	x25, x1
	mov	w26, w0
	stp	x27, x28, [sp, 80]
	mov	w1, w0
	bfi	w24, w3, 0, 32
	stp	d11, d12, [sp, 96]
	fmov	d12, d0
	fmov	d11, d2
	stp	d13, d14, [sp, 112]
	fmov	s13, s5
	ldr	s14, [sp, 252]
	str	d15, [sp, 128]
	fmov	d15, d7
	ldp	x0, x27, [x4]
	str	x0, [sp, 152]
	ldr	x0, [sp, 272]
	mov	w3, w2
	ldp	x28, x20, [x4, 16]
	str	d6, [sp, 184]
	ldp	x19, x4, [x0]
	str	x4, [sp, 160]
	ldp	x8, x5, [x0, 16]
	lsr	x4, x2, 32
	adrp	x0, .LC4
	mov	x2, x25
	add	x0, x0, :lo12:.LC4
	stp	x8, x5, [sp, 168]
	mov	w5, w24
	str	x6, [sp, 192]
	str	w7, [sp, 200]
	stp	s3, s4, [sp, 208]
	bl	printf
	fcvt	d13, s13
	ldp	s0, s1, [sp, 208]
	mov	w5, w23
	ldr	x1, [sp, 152]
	fmov	d2, d13
	fcvt	d1, s1
	fcvt	d0, s0
	mov	x4, x20
	mov	x3, x28
	mov	x2, x27
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	fmov	d1, d15
	ldp	w2, w3, [sp, 196]
	mov	w1, w22
	ldr	d0, [sp, 184]
	adrp	x0, .LC6
	ldr	d2, [sp, 240]
	add	x0, x0, :lo12:.LC6
	bl	printf
	fcvt	d14, s14
	ldr	s0, [sp, 248]
	mov	x2, x19
	ldr	s2, [sp, 256]
	mov	w1, w21
	ldp	x3, x4, [sp, 160]
	fmov	d1, d14
	ldr	x5, [sp, 176]
	fcvt	d2, s2
	fcvt	d0, s0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	scvtf	d2, w26
	scvtf	d31, x25
	scvtf	d0, x19
	ldp	x25, x26, [sp, 64]
	fadd	d2, d2, d12
	ldp	x27, x28, [sp, 80]
	fadd	d2, d2, d31
	scvtf	d31, w24
	fadd	d2, d2, d31
	scvtf	d31, x20
	ldp	x19, x20, [sp, 16]
	fadd	d2, d2, d11
	ldp	d11, d12, [sp, 96]
	fadd	d2, d2, d31
	scvtf	d31, w23
	ldp	x23, x24, [sp, 48]
	fadd	d2, d2, d13
	fadd	d2, d2, d31
	scvtf	d31, w22
	fadd	d2, d2, d15
	ldr	d15, [sp, 128]
	fadd	d2, d2, d31
	ldr	d31, [sp, 240]
	fadd	d2, d2, d31
	scvtf	d31, w21
	ldp	x21, x22, [sp, 32]
	fadd	d2, d2, d14
	ldp	d13, d14, [sp, 112]
	ldp	x29, x30, [sp], 240
	fadd	d2, d2, d31
	fadd	d0, d2, d0
	ret
	.section .rodata
	.align	3
.LC8:
	.string	"vmix %s:"
	.align	3
.LC9:
	.string	" %d"
	.align	3
.LC10:
	.string	" %g"
	.align	3
.LC11:
	.string	" (%g,%g)"
	.align	3
.LC12:
	.string	" <%g,%g,%g>"
	.align	3
.LC13:
	.string	" [%d,%d,%d]"
	.align	3
.LC14:
	.string	" {%ld..%ld}"
	.align	3
.LC15:
	.string	" = %.1f\n"
	.text
	.align	2
	.align 5
	.global	vmix
vmix:
	stp	x29, x30, [sp, -288]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x0
	add	x0, sp, 288
	stp	x0, x0, [sp, 64]
	add	x0, sp, 224
	str	x0, [sp, 80]
	mov	w0, -56
	str	w0, [sp, 88]
	mov	w0, -128
	stp	d14, d15, [sp, 48]
	str	w0, [sp, 92]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	stp	q0, q1, [sp, 96]
	stp	q2, q3, [sp, 128]
	stp	q4, q5, [sp, 160]
	stp	q6, q7, [sp, 192]
	stp	x1, x2, [sp, 232]
	mov	x1, x19
	stp	x3, x4, [sp, 248]
	stp	x5, x6, [sp, 264]
	str	x7, [sp, 280]
	bl	printf
	ldrb	w1, [x19]
	cbz	w1, .L38
	adrp	x20, .LC9
	movi	d15, #0
	add	x20, x20, :lo12:.LC9
	fmov	d14, 3.0e+0
	str	x21, [sp, 32]
	adrp	x21, .LC11
	add	x21, x21, :lo12:.LC11
	b	.L37
	.align 2
.L45:
	cmp	w1, 100
	beq	.L12
	cmp	w1, 102
	beq	.L13
	cmp	w1, 98
	bne	.L15
	ldr	w1, [sp, 88]
	ldr	x0, [sp, 64]
	tbnz	w1, #31, .L43
.L34:
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 64]
.L36:
	ldr	x0, [x0]
	ldr	x1, [x0]
	ldr	x2, [x0, 24]
	scvtf	d3, x1
	fmadd	d15, d15, d14, d3
	adrp	x0, .LC14
	scvtf	d2, x2
	add	x0, x0, :lo12:.LC14
	fadd	d15, d2, d15
	bl	printf
	.align 5
.L15:
	ldrb	w1, [x19, 1]!
	cbz	w1, .L44
.L37:
	cmp	w1, 104
	beq	.L10
	bls	.L45
	cmp	w1, 105
	beq	.L16
	cmp	w1, 115
	bne	.L15
	ldr	w1, [sp, 88]
	ldr	x0, [sp, 64]
	tbnz	w1, #31, .L46
.L31:
	add	x1, x0, 19
	and	x1, x1, -8
	str	x1, [sp, 64]
.L33:
	ldp	w1, w2, [x0]
	ldr	w3, [x0, 8]
	adrp	x0, .LC13
	scvtf	d7, w1
	add	x0, x0, :lo12:.LC13
	fmadd	d15, d15, d14, d7
	scvtf	d6, w3
	fsub	d15, d15, d6
	bl	printf
	ldrb	w1, [x19, 1]!
	cbnz	w1, .L37
	.align 5
.L44:
	ldr	x21, [sp, 32]
.L9:
	fmov	d0, d15
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	fmov	d0, d15
	ldp	x19, x20, [sp, 16]
	ldp	d14, d15, [sp, 48]
	ldp	x29, x30, [sp], 288
	ret
	.align 2
.L13:
	ldr	w1, [sp, 92]
	ldr	x0, [sp, 64]
	tbnz	w1, #31, .L28
.L42:
	add	x1, x0, 19
	ldr	s4, [x0, 8]
	and	x1, x1, -8
	str	x1, [sp, 64]
	ldp	s0, s1, [x0]
.L29:
	fcvt	d0, s0
	fmadd	d15, d15, d14, d0
	fcvt	d1, s1
	fcvt	d4, s4
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	fmov	d2, d4
	fadd	d15, d15, d1
	fadd	d15, d15, d4
	bl	printf
	b	.L15
	.align 2
.L10:
	ldr	w1, [sp, 92]
	ldr	x0, [sp, 64]
	tbnz	w1, #31, .L25
.L41:
	add	x1, x0, 23
	and	x1, x1, -8
	str	x1, [sp, 64]
	ldp	d18, d17, [x0]
.L26:
	fmadd	d15, d15, d14, d18
	fmov	d1, d17
	fmov	d0, d18
	mov	x0, x21
	fsub	d15, d15, d17
	bl	printf
	b	.L15
	.align 2
.L12:
	ldr	w1, [sp, 92]
	ldr	x0, [sp, 64]
	tbnz	w1, #31, .L47
.L22:
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 64]
.L24:
	ldr	d5, [x0]
	adrp	x0, .LC10
	fmadd	d15, d15, d14, d5
	add	x0, x0, :lo12:.LC10
	fmov	d0, d5
	bl	printf
	b	.L15
	.align 2
.L16:
	ldr	w1, [sp, 88]
	ldr	x0, [sp, 64]
	tbnz	w1, #31, .L48
.L19:
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 64]
.L21:
	ldr	w1, [x0]
	mov	x0, x20
	scvtf	d16, w1
	fmadd	d15, d15, d14, d16
	bl	printf
	b	.L15
	.align 2
.L43:
	add	w2, w1, 8
	str	w2, [sp, 88]
	cmp	w2, 0
	bgt	.L34
	ldr	x0, [sp, 72]
	add	x0, x0, w1, sxtw
	b	.L36
	.align 2
.L48:
	add	w2, w1, 8
	str	w2, [sp, 88]
	cmp	w2, 0
	bgt	.L19
	ldr	x0, [sp, 72]
	add	x0, x0, w1, sxtw
	b	.L21
	.align 2
.L47:
	add	w2, w1, 16
	str	w2, [sp, 92]
	cmp	w2, 0
	bgt	.L22
	ldr	x0, [sp, 80]
	add	x0, x0, w1, sxtw
	b	.L24
	.align 2
.L25:
	add	w2, w1, 32
	str	w2, [sp, 92]
	cmp	w2, 0
	bgt	.L41
	ldr	x0, [sp, 80]
	ldr	d18, [x0, w1, sxtw]
	add	x1, x0, w1, sxtw
	ldr	d17, [x1, 16]
	b	.L26
	.align 2
.L28:
	add	w2, w1, 48
	str	w2, [sp, 92]
	cmp	w2, 0
	bgt	.L42
	ldr	x0, [sp, 80]
	ldr	s0, [x0, w1, sxtw]
	add	x1, x0, w1, sxtw
	ldr	s1, [x1, 16]
	ldr	s4, [x1, 32]
	b	.L29
	.align 2
.L46:
	add	w2, w1, 16
	str	w2, [sp, 88]
	cmp	w2, 0
	bgt	.L31
	ldr	x0, [sp, 72]
	add	x0, x0, w1, sxtw
	b	.L33
	.align 2
.L38:
	movi	d15, #0
	b	.L9
	.align	2
	.align 5
	.global	cpowi
cpowi:
	cbnz	w0, .L59
	fmov	d31, 1.0e+0
	movi	d1, #0
	fmov	d0, d31
	ret
	.align 2
.L59:
	stp	x29, x30, [sp, -48]!
	mov	w1, w0
	add	w0, w0, w0, lsr 31
	mov	x29, sp
	stp	d14, d15, [sp, 16]
	fmov	d14, d1
	fmov	d15, d0
	asr	w0, w0, 1
	str	w1, [sp, 44]
	bl	cpowi
	fadd	d2, d0, d0
	ldr	w1, [sp, 44]
	fmul	d31, d1, d1
	fnmsub	d31, d0, d0, d31
	fmul	d1, d2, d1
	tbz	x1, 0, .L50
	fmul	d0, d1, d14
	fmul	d1, d1, d15
	fmadd	d1, d31, d14, d1
	fnmsub	d31, d31, d15, d0
.L50:
	ldp	d14, d15, [sp, 16]
	fmov	d0, d31
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC20:
	.string	"kitchen %.4f\n"
	.align	3
.LC21:
	.string	"ihdfsb"
	.align	3
.LC22:
	.string	"hhhfddsssib"
	.align	3
.LC23:
	.string	"dddddddddfh"
	.align	3
.LC24:
	.string	"fp %d: %ld %ld %ld %ld | %g %g\n"
	.align	3
.LC27:
	.string	"(1+i)^%d = %g %g\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #384
	adrp	x0, .LC16+8
	fmov	d6, 2.5e-1
	fmov	d2, -7.5e+0
	fmov	d0, 1.5e+0
	stp	x29, x30, [sp, 48]
	add	x29, sp, 48
	stp	x25, x26, [sp, 112]
	adrp	x26, .LANCHOR0
	add	x26, x26, :lo12:.LANCHOR0
	stp	x21, x22, [sp, 80]
	adrp	x21, .LANCHOR1
	add	x22, sp, 272
	ldp	d30, d31, [x26, 16]
	stp	x19, x20, [sp, 64]
	ldr	w19, [x21, :lo12:.LANCHOR1]
	stp	x23, x24, [sp, 96]
	mov	x8, x22
	neg	w5, w19
	str	d31, [sp, 320]
	fmov	s31, 5.0e-1
	ldr	x24, [x0, :lo12:.LC16+8]
	str	s31, [sp, 336]
	scvtf	s31, w19
	mov	w0, 3
	sxtw	x20, w19
	str	w0, [sp, 312]
	mov	w0, -300
	stp	x27, x28, [sp, 128]
	fmov	d7, x24
	str	s31, [sp, 340]
	fmov	s31, -4.0e+0
	stp	d13, d14, [sp, 144]
	mov	x4, x22
	adrp	x27, .LC24
	str	s31, [sp, 344]
	add	x21, x21, :lo12:.LANCHOR1
	ldr	d31, [x26, 32]
	add	x27, x27, :lo12:.LC24
	str	d15, [sp, 160]
	scvtf	d15, w5
	str	d30, [sp, 304]
	str	d31, [sp, 352]
	fmov	s31, 2.0e+0
	str	w0, [sp, 328]
	mov	x0, x20
	str	s31, [sp, 360]
	bl	mkbig
	ldp	q30, q31, [sp, 272]
	sxtw	x0, w5
	fmov	d1, d15
	mov	v28.16b, v30.16b
	mov	v29.16b, v31.16b
	bl	mkbig2
	add	x0, sp, 240
	str	x0, [sp, 32]
	mov	w0, 90
	strb	w0, [sp, 24]
	ldr	x0, [sp, 352]
	str	x0, [sp, 8]
	ldr	w0, [sp, 360]
	mov	x1, 1099511627776
	ldp	q30, q31, [sp, 272]
	str	w0, [sp, 16]
	ldr	x2, [sp, 304]
	mov	x0, 140737488355328
	ldr	x6, [sp, 320]
	movk	x0, 0x4023, lsl 48
	ldr	w7, [sp, 328]
	ldr	w3, [sp, 312]
	ldr	s3, [sp, 336]
	ldr	s4, [sp, 340]
	ldr	s5, [sp, 344]
	str	x0, [sp]
	mov	w0, w19
	stp	q28, q29, [sp, 176]
	stp	q30, q31, [sp, 208]
	stp	q30, q31, [sp, 240]
	stp	q28, q29, [sp, 272]
	bl	kitchen
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	printf
	ldp	q28, q29, [sp, 176]
	fmov	d1, d15
	ldr	x2, [sp, 304]
	fmov	d2, 2.5e+0
	ldr	w3, [sp, 312]
	fmov	d0, 1.5e+0
	ldr	s3, [sp, 336]
	mov	w1, w19
	ldr	s4, [sp, 340]
	mov	x4, x22
	ldr	s5, [sp, 344]
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	stp	q28, q29, [sp, 272]
	mov	w19, 0
	bl	vmix
	fmov	d5, d15
	ldp	q30, q31, [sp, 208]
	fmov	d4, 1.5e+0
	ldr	x5, [sp, 304]
	fmov	d1, d15
	ldr	x3, [sp, 320]
	fmov	d0, d4
	ldr	x0, [sp, 352]
	str	x0, [sp]
	ldr	w6, [sp, 312]
	fmov	d2, 2.5e-1
	ldr	w4, [sp, 328]
	fmov	d3, x24
	ldr	w0, [sp, 360]
	mov	x2, x6
	str	w0, [sp, 8]
	mov	x1, x5
	str	x22, [sp, 32]
	mov	w7, 42
	stp	q30, q31, [sp, 272]
	fmov	d30, -3.0e+0
	fmov	d31, 1.25e+0
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	stp	d31, d30, [sp, 16]
	bl	vmix
	mov	x0, 4598175219545276416
	stp	x0, x24, [sp, 24]
	fmov	d31, 9.0e+0
	fmov	d7, 8.0e+0
	ldr	x0, [sp, 336]
	str	x0, [sp, 8]
	ldr	w0, [sp, 344]
	fmov	d6, 7.0e+0
	fmov	d5, 6.0e+0
	fmov	d4, 5.0e+0
	fmov	d3, 4.0e+0
	fmov	d2, 3.0e+0
	fmov	d1, 2.0e+0
	fmov	d0, 1.0e+0
	str	w0, [sp, 16]
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	str	d31, [sp]
	bl	vmix
	fmov	d15, 3.0e+0
	fmov	d14, 4.0e+0
.L61:
	ubfiz	x0, x19, 3, 1
	mov	x8, x22
	add	x0, x21, x0
	ldr	x1, [x0, 16]
	mov	x0, x20
	add	x20, x20, 1
	blr	x1
	fmov	d0, d15
	asr	w1, w19, 1
	fmov	d1, d14
	ldp	x23, x24, [sp, 272]
	add	x1, x21, w1, sxtw 3
	ldp	x25, x28, [sp, 288]
	ldr	x0, [x1, 32]
	blr	x0
	fmov	d15, d0
	fmov	d14, d1
	mov	w1, w19
	mov	x5, x28
	mov	x4, x25
	mov	x3, x24
	mov	x2, x23
	mov	x0, x27
	add	w19, w19, 1
	bl	printf
	cmp	w19, 4
	bne	.L61
	adrp	x0, .LC25+8
	adrp	x20, .LC27
	ldr	q31, [x26, 48]
	add	x19, sp, 368
	add	x20, x20, :lo12:.LC27
	ldr	d13, [x0, :lo12:.LC25+8]
	str	q31, [sp, 368]
.L62:
	fmov	d1, d13
	ldr	w2, [x19], 4
	fmov	d0, 1.0e+0
	mov	w0, w2
	bl	cpowi
	mov	w1, w2
	mov	x0, x20
	bl	printf
	add	x0, sp, 384
	cmp	x0, x19
	bne	.L62
	ldr	d15, [sp, 160]
	mov	w0, 0
	ldp	x29, x30, [sp, 48]
	ldp	x19, x20, [sp, 64]
	ldp	x21, x22, [sp, 80]
	ldp	x23, x24, [sp, 96]
	ldp	x25, x26, [sp, 112]
	ldp	x27, x28, [sp, 128]
	ldp	d13, d14, [sp, 144]
	add	sp, sp, 384
	ret
	.global	knob
	.global	turns
	.global	makers
	.section .rodata
	.align	4
.LC16:
	.quad	4598175219545276416
	.quad	4620693217682128896
	.align	4
.LC25:
	.quad	4607182418800017408
	.quad	4607182418800017408
	.section .rodata
	.align	4
	.LANCHOR0:
.LC3:
	.quad	1
	.quad	-1
.LC17:
	.word	1
	.word	-2
.LC18:
	.word	100
	.word	200
.LC19:
	.word	1098907648
	.word	-1107296256
	.zero	8
.LC26:
	.word	0
	.word	1
	.word	10
	.word	13
	.data
	.align	4
	.LANCHOR1:
knob:
	.word	2
	.zero	12
makers:
	.quad	mkbig
	.quad	mkbig2
turns:
	.quad	rot90
	.quad	conj2

