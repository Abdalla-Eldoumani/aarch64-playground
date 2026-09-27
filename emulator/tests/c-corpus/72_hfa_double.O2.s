	.text
	.align	2
	.p2align 5,,15
	.global	qmul
qmul:
	fmul	d28, d1, d5
	fmul	d29, d1, d4
	fmul	d30, d1, d7
	fmul	d31, d1, d6
	fnmsub	d28, d0, d4, d28
	fmadd	d29, d0, d5, d29
	fnmsub	d30, d0, d6, d30
	fmadd	d31, d0, d7, d31
	sub	sp, sp, #128
	add	sp, sp, 128
	fmsub	d28, d2, d6, d28
	fmadd	d29, d2, d7, d29
	fmsub	d31, d2, d5, d31
	fmadd	d30, d2, d4, d30
	fmsub	d0, d3, d7, d28
	fmsub	d1, d3, d6, d29
	fmadd	d2, d3, d5, d30
	fmadd	d3, d3, d4, d31
	ret
	.align	2
	.p2align 5,,15
	.global	qconj
qconj:
	sub	sp, sp, #96
	fneg	d1, d1
	fneg	d2, d2
	fneg	d3, d3
	add	sp, sp, 96
	ret
	.align	2
	.p2align 5,,15
	.global	sq_add
sq_add:
	fmul	d30, d1, d1
	fadd	d31, d0, d0
	fnmsub	d30, d0, d0, d30
	fmadd	d1, d31, d1, d3
	fadd	d0, d30, d2
	ret
	.align	2
	.p2align 5,,15
	.global	escape
escape:
	mov	w1, w0
	cmp	w0, 0
	ble	.L18
	movi	d27, #0
	fmov	d29, d0
	fmov	d28, d1
	stp	x29, x30, [sp, -16]!
	mov	w0, 0
	fmov	d25, 4.0e+0
	mov	x29, sp
	fmov	d26, d27
	.p2align 5,,15
.L8:
	fmov	d0, d27
	fmov	d1, d26
	fmov	d2, d29
	fmov	d3, d28
	bl	sq_add
	fmov	d26, d1
	fmul	d1, d1, d1
	fmov	d27, d0
	fmadd	d1, d0, d0, d1
	fcmpe	d1, d25
	bgt	.L7
	add	w0, w0, 1
	cmp	w1, w0
	bne	.L8
	mov	w0, w1
.L7:
	ldp	x29, x30, [sp], 16
	ret
.L18:
	ret
	.align	2
	.p2align 5,,15
	.global	advance
advance:
	fmov	x1, d3
	fmov	x0, d4
	sub	sp, sp, #112
	fadd	d2, d5, d2
	stp	x1, x0, [sp]
	ldr	q30, [sp]
	stp	d0, d1, [sp, 56]
	ldr	q31, [sp, 56]
	fmla	v31.2d, v30.2d, v5.d[0]
	str	q31, [sp, 80]
	ldp	d0, d1, [sp, 80]
	add	sp, sp, 112
	ret
	.align	2
	.p2align 5,,15
	.global	dot3
dot3:
	fmul	d1, d1, d4
	sub	sp, sp, #48
	fmadd	d0, d0, d3, d1
	add	sp, sp, 48
	fmadd	d0, d2, d5, d0
	ret
	.align	2
	.p2align 5,,15
	.global	dmix
dmix:
	fmov	d31, x0
	sxtw	x0, w1
	fmov	d30, x0
	fmov	d29, 2.0e+0
	fcvt	d30, s30
	fmadd	d29, d31, d29, d30
	fsub	d31, d31, d30
	fcvt	s31, d31
	fmov	x0, d29
	fmov	w1, s31
	ret
	.align	2
	.p2align 5,,15
	.global	d5scale
d5scale:
	ldr	d31, [x0, 32]
	adrp	x1, .LANCHOR0
	add	x2, x1, :lo12:.LANCHOR0
	fmov	d30, 4.0e+0
	ldp	q1, q2, [x0]
	fmadd	d30, d0, d31, d30
	ldr	q28, [x2, 16]
	ldr	q29, [x1, :lo12:.LANCHOR0]
	fmla	v28.2d, v2.2d, v0.d[0]
	fmla	v29.2d, v1.2d, v0.d[0]
	str	d30, [x0, 32]
	stp	q29, q28, [x0]
	ldr	x0, [x0, 32]
	stp	q29, q28, [x8]
	str	x0, [x8, 32]
	ret
	.align	2
	.p2align 5,,15
	.global	dlmake
dlmake:
	scvtf	d31, x0
	fcvtzs	x2, d0, #2
	fmul	d31, d31, d0
	add	x1, x2, x0
	fmov	x0, d31
	ret
	.align	2
	.p2align 5,,15
	.global	overflow
overflow:
	sub	sp, sp, #32
	fadd	d0, d0, d1
	fadd	d4, d4, d5
	mov	x0, 4636737291354636288
	ldp	d31, d30, [sp, 32]
	fadd	d0, d0, d2
	fadd	d31, d31, d30
	ldr	d30, [sp, 48]
	fadd	d0, d0, d3
	fadd	d31, d31, d30
	ldr	d30, [sp, 56]
	fadd	d31, d31, d30
	fmov	d30, 1.0e+1
	fmadd	d0, d4, d30, d0
	fmov	d30, x0
	mov	x0, 70368744177664
	movk	x0, 0x408f, lsl 48
	fmadd	d0, d31, d30, d0
	ldr	d31, [sp, 64]
	fmov	d30, x0
	add	sp, sp, 32
	fmadd	d0, d31, d30, d0
	ret
	.align	2
	.p2align 5,,15
	.global	third
third:
	fneg	d1, d0
	fmov	d31, 3.0e+0
	fdiv	d0, d0, d31
	fmov	d31, 7.0e+0
	fdiv	d1, d1, d31
	ret
	.section .rodata
	.align	3
.LC6:
	.string	"%s %.4f %.4f %.4f %.4f\n"
	.text
	.align	2
	.p2align 5,,15
	.global	pq
pq:
	sub	sp, sp, #32
	mov	x1, x0
	adrp	x0, .LC6
	add	sp, sp, 32
	add	x0, x0, :lo12:.LC6
	b	printf
	.section .rodata
	.align	3
.LC8:
	.string	"q"
	.align	3
.LC9:
	.string	"norm"
	.align	3
.LC10:
	.string	"set %s\n"
	.align	3
.LC12:
	.string	"advance %.4f %.4f %.4f\n"
	.align	3
.LC14:
	.string	"dot3 %.6f %.6f\n"
	.align	3
.LC15:
	.string	"dmix %.4f %.4f\n"
	.align	3
.LC16:
	.string	"d5 %.4f %.4f %.4f %.4f %.4f\n"
	.align	3
.LC17:
	.string	"dl %.4f %ld\n"
	.align	3
.LC18:
	.string	"overflow %.4f\n"
	.align	3
.LC19:
	.string	"third %.17g %.17g\n"
	.align	3
.LC20:
	.string	"sizes %d %d %d %d\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #448
	adrp	x0, .LANCHOR1
	stp	x29, x30, [sp, 48]
	add	x29, sp, 48
	stp	x19, x20, [sp, 64]
	adrp	x20, .LANCHOR0
	add	x20, x20, :lo12:.LANCHOR0
	str	d15, [sp, 104]
	mov	w19, 7
	ldr	d15, [x0, :lo12:.LANCHOR1]
	ldr	q31, [x20, 32]
	stp	x21, x22, [sp, 80]
	adrp	x21, .LC8
	add	x21, x21, :lo12:.LC8
	str	x23, [sp, 96]
	str	q31, [sp, 240]
	fmov	d31, -3.0e+0
	stp	d31, d15, [sp, 256]
	fmov	v31.2d, 5.0e-1
	stp	d11, d12, [sp, 112]
	stp	d13, d14, [sp, 128]
	stp	q31, q31, [sp, 272]
	.p2align 5,,15
.L32:
	mov	x0, x21
	ldp	d0, d1, [sp, 240]
	ldp	d2, d3, [sp, 256]
	ldp	d4, d5, [sp, 272]
	ldp	d6, d7, [sp, 288]
	bl	qmul
	stp	d0, d1, [sp, 240]
	stp	d2, d3, [sp, 256]
	bl	pq
	subs	w19, w19, #1
	bne	.L32
	ldp	d28, d29, [sp, 240]
	adrp	x0, .LC9
	ldp	d30, d31, [sp, 256]
	add	x0, x0, :lo12:.LC9
	fmov	d0, d28
	fmov	d1, d29
	adrp	x22, .LC10
	add	x22, x22, :lo12:.LC10
	fmov	d2, d30
	fmov	d3, d31
	mov	w21, 0
	mov	w19, 26
	bl	qconj
	fmov	d4, d0
	fmov	d5, d1
	fmov	d6, d2
	fmov	d7, d3
	fmov	d0, d28
	fmov	d1, d29
	fmov	d2, d30
	fmov	d3, d31
	bl	qmul
	bl	pq
	fmov	d13, 5.0e-1
	fmov	d14, 1.0e+0
.L35:
	scvtf	d24, w21
	add	x3, sp, 408
	mov	w2, 0
	fmov	d22, 2.5e-1
	fmov	d23, -2.0e+0
	fmsub	d24, d24, d13, d14
	.p2align 5,,15
.L34:
	scvtf	d0, w2
	fmov	d1, d24
	mov	w0, 30
	fmadd	d0, d0, d22, d23
	bl	escape
	mov	w1, 35
	cmp	w0, 29
	bgt	.L33
	sdiv	w1, w0, w19
	msub	w1, w1, w19, w0
	add	w1, w1, 97
.L33:
	add	w2, w2, 1
	strb	w1, [x3], 1
	cmp	w2, 12
	bne	.L34
	add	x1, sp, 408
	mov	x0, x22
	add	w21, w21, 1
	strb	wzr, [sp, 420]
	bl	printf
	cmp	w21, 3
	bne	.L35
	movi	d14, #0
	adrp	x0, .LC11+8
	adrp	x21, .LC12
	add	x21, x21, :lo12:.LC12
	ldr	x22, [x0, :lo12:.LC11+8]
	mov	w19, 0
	fmov	d12, d14
	fmov	d13, d14
	fmov	d11, x22
.L36:
	add	w19, w19, 1
	fmov	d0, d14
	fmov	d1, d12
	fmov	d2, d13
	scvtf	d5, w19
	fmov	d4, d11
	fmov	d3, 3.0e+0
	fmul	d5, d5, d15
	bl	advance
	fmov	d14, d0
	fmov	d12, d1
	fmov	d13, d2
	mov	x0, x21
	bl	printf
	cmp	w19, 4
	bne	.L36
	ldp	d3, d4, [x20, 64]
	fmov	d1, -2.0e+0
	ldr	d5, [x20, 80]
	fmov	d2, 1.25e-1
	fmov	d0, 1.5e+0
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	mov	x19, 0
	bl	dot3
	fmov	d2, d5
	fmov	d31, d0
	fmov	d1, d4
	fmov	d0, d3
	adrp	x23, .LC15
	add	x23, x23, :lo12:.LC15
	mov	w21, 3
	bl	dot3
	fmov	d1, d0
	fmov	d0, d31
	bl	printf
	mov	x0, 0
	fmov	d14, 1.25e+0
	bfi	x19, x0, 32, 32
	fmov	s13, -5.0e-1
.L37:
	fmov	w1, s13
	fmov	x0, d14
	bfi	x19, x1, 0, 32
	mov	x1, x19
	bl	dmix
	fmov	d14, x0
	sbfx	x0, x1, 0, 32
	fmov	d13, x0
	mov	x19, x1
	fmov	d0, d14
	mov	x0, x23
	fcvt	d1, s13
	bl	printf
	subs	w21, w21, #1
	bne	.L37
	ldr	q30, [x20, 88]
	fmov	d0, d15
	ldr	q31, [x20, 104]
	add	x8, sp, 408
	ldr	x0, [x20, 120]
	str	x0, [sp, 176]
	add	x0, sp, 144
	stp	q30, q31, [sp, 144]
	bl	d5scale
	ldp	q30, q31, [x8]
	fmov	d0, -2.0e+0
	ldr	x0, [x8, 32]
	add	x8, sp, 368
	stp	q30, q31, [sp, 144]
	str	x0, [sp, 176]
	add	x0, sp, 144
	bl	d5scale
	ldr	d4, [sp, 400]
	ldp	d0, d1, [sp, 368]
	adrp	x0, .LC16
	ldp	d2, d3, [sp, 384]
	add	x0, x0, :lo12:.LC16
	bl	printf
	fmov	d0, -2.75e+0
	mov	x0, 6
	bl	dlmake
	fmov	d0, x0
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	fneg	d31, d15
	ldp	d0, d1, [sp, 272]
	fmov	d5, x22
	ldp	d2, d3, [sp, 288]
	str	d31, [sp, 32]
	ldp	q31, q30, [sp, 240]
	fmov	d4, 3.0e+0
	stp	q31, q30, [sp]
	bl	overflow
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	printf
	fmov	d0, d15
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	third
	bl	printf
	mov	w4, 16
	mov	w3, 40
	mov	w2, w4
	mov	w1, 24
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	printf
	ldr	x23, [sp, 96]
	mov	w0, 0
	ldr	d15, [sp, 104]
	ldp	x29, x30, [sp, 48]
	ldp	x19, x20, [sp, 64]
	ldp	x21, x22, [sp, 80]
	ldp	d11, d12, [sp, 112]
	ldp	d13, d14, [sp, 128]
	add	sp, sp, 448
	ret
	.global	knob
	.section .rodata
	.align	4
.LC11:
	.xword	4613937818241073152
	.xword	-4613937818241073152
	.section .rodata
	.align	4
	.LANCHOR0:
.LC4:
	.word	0
	.word	0
	.word	0
	.word	1072693248
.LC5:
	.word	0
	.word	1073741824
	.word	0
	.word	1074266112
.LC7:
	.word	0
	.word	1072693248
	.word	0
	.word	1073741824
.LC13:
	.word	0
	.word	1073217536
	.word	0
	.word	-1073741824
.LC2:
	.word	0
	.word	1074790400
	.word	0
	.word	1071644672
	.word	0
	.word	-1071644672
.LC3:
	.word	0
	.word	1072693248
	.word	0
	.word	-1074790400
	.word	0
	.word	1071644672
	.word	0
	.word	1075838976
	.word	0
	.word	-1076887552
	.data
	.align	3
	.LANCHOR1:
knob:
	.word	0
	.word	1070596096

