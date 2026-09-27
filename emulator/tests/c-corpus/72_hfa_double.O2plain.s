	.text
	.align	2
	.align 5
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
	.align 5
	.global	qconj
qconj:
	sub	sp, sp, #96
	fneg	d1, d1
	fneg	d2, d2
	fneg	d3, d3
	add	sp, sp, 96
	ret
	.align	2
	.align 5
	.global	sq_add
sq_add:
	fmul	d30, d1, d1
	fadd	d31, d0, d0
	fnmsub	d30, d0, d0, d30
	fmadd	d1, d31, d1, d3
	fadd	d0, d30, d2
	ret
	.align	2
	.align 5
	.global	escape
escape:
	mov	w1, w0
	cmp	w0, 0
	ble	.L11
	movi	d31, #0
	mov	w0, 0
	fmov	d28, 4.0e+0
	fmov	d30, d31
	fmov	d29, d31
	.align 5
.L10:
	fmov	d2, d31
	fnmsub	d31, d31, d31, d29
	fadd	d2, d2, d2
	fmadd	d30, d2, d30, d1
	fadd	d31, d31, d0
	fmul	d29, d30, d30
	fmadd	d27, d31, d31, d29
	fcmpe	d27, d28
	bgt	.L7
	add	w0, w0, 1
	cmp	w1, w0
	bne	.L10
.L11:
	mov	w0, w1
.L7:
	ret
	.align	2
	.align 5
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
	.align 5
	.global	dot3
dot3:
	fmul	d1, d1, d4
	sub	sp, sp, #48
	fmadd	d0, d0, d3, d1
	add	sp, sp, 48
	fmadd	d0, d2, d5, d0
	ret
	.align	2
	.align 5
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
	.align 5
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
	.align 5
	.global	dlmake
dlmake:
	scvtf	d31, x0
	fcvtzs	x2, d0, #2
	fmul	d31, d31, d0
	add	x1, x2, x0
	fmov	x0, d31
	ret
	.align	2
	.align 5
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
	.align 5
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
	.align 5
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
.LC7:
	.string	"q"
	.align	3
.LC8:
	.string	"norm"
	.align	3
.LC9:
	.string	"set %s\n"
	.align	3
.LC10:
	.string	"advance %.4f %.4f %.4f\n"
	.align	3
.LC11:
	.string	"dot3 %.6f %.6f\n"
	.align	3
.LC12:
	.string	"dmix %.4f %.4f\n"
	.align	3
.LC15:
	.string	"d5 %.4f %.4f %.4f %.4f %.4f\n"
	.align	3
.LC16:
	.string	"dl %.4f %ld\n"
	.align	3
.LC17:
	.string	"overflow %.4f\n"
	.align	3
.LC18:
	.string	"third %.17g %.17g\n"
	.align	3
.LC19:
	.string	"sizes %d %d %d %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -272]!
	adrp	x0, .LANCHOR1
	mov	x29, sp
	ldr	d31, [x0, :lo12:.LANCHOR1]
	stp	d10, d11, [sp, 64]
	fmov	d10, -3.0e+0
	fmov	d11, d31
	stp	x19, x20, [sp, 16]
	adrp	x20, .LC6
	fmov	v31.2d, 5.0e-1
	add	x20, x20, :lo12:.LC6
	stp	x21, x22, [sp, 32]
	adrp	x21, .LC7
	add	x21, x21, :lo12:.LC7
	mov	w19, 7
	stp	d8, d9, [sp, 48]
	fmov	d8, 1.0e+0
	fmov	d9, 2.0e+0
	stp	d12, d13, [sp, 80]
	stp	d14, d15, [sp, 96]
	str	d11, [sp, 120]
	stp	q31, q31, [sp, 144]
	.align 5
.L26:
	fmov	d0, d8
	fmov	d1, d9
	fmov	d2, d10
	fmov	d3, d11
	mov	x1, x21
	ldp	d4, d5, [sp, 144]
	mov	x0, x20
	ldp	d6, d7, [sp, 160]
	bl	qmul
	fmov	d15, d0
	fmov	d12, d1
	fmov	d13, d2
	fmov	d14, d3
	fmov	d8, d0
	fmov	d9, d1
	fmov	d10, d2
	fmov	d11, d3
	stp	d0, d1, [sp, 176]
	stp	d2, d3, [sp, 192]
	bl	printf
	subs	w19, w19, #1
	bne	.L26
	fmov	d4, d15
	fneg	d5, d12
	fneg	d6, d13
	fneg	d7, d14
	ldp	d0, d1, [sp, 176]
	mov	x0, x20
	ldp	d2, d3, [sp, 192]
	mov	w20, 60495
	adrp	x1, .LC8
	adrp	x21, .LC9
	add	x1, x1, :lo12:.LC8
	add	x21, x21, :lo12:.LC9
	mov	w22, 0
	movk	w20, 0x4ec4, lsl 16
	mov	w19, 26
	bl	qmul
	bl	printf
.L27:
	scvtf	d30, w22
	fmov	d31, 5.0e-1
	fmov	d26, 1.0e+0
	add	x3, sp, 128
	mov	w2, 0
	fmov	d23, 2.5e-1
	fmov	d24, -2.0e+0
	fmov	d25, 4.0e+0
	fmsub	d26, d30, d31, d26
	.align 5
.L30:
	scvtf	d27, w2
	movi	d29, #0
	mov	w0, 0
	fmadd	d27, d27, d23, d24
	fmov	d28, d29
	fmov	d30, d29
	.align 5
.L29:
	fmov	d31, d28
	fnmsub	d30, d28, d28, d30
	fadd	d31, d31, d31
	fmadd	d29, d31, d29, d26
	fadd	d28, d30, d27
	fmul	d30, d29, d29
	fmadd	d31, d28, d28, d30
	fcmpe	d31, d25
	bgt	.L28
	add	w0, w0, 1
	cmp	w0, 30
	bne	.L29
	mov	w0, 35
.L33:
	add	w2, w2, 1
	strb	w0, [x3], 1
	cmp	w2, 12
	bne	.L30
	add	x1, sp, 128
	mov	x0, x21
	add	w22, w22, 1
	strb	wzr, [sp, 140]
	bl	printf
	cmp	w22, 3
	bne	.L27
	movi	d9, #0
	adrp	x20, .LC10
	add	x20, x20, :lo12:.LC10
	mov	w19, 0
	fmov	d10, 3.0e+0
	fmov	d11, -1.5e+0
	fmov	d0, d9
	fmov	d8, d9
.L31:
	add	w19, w19, 1
	ldr	d30, [sp, 120]
	mov	x0, x20
	scvtf	d31, w19
	fmul	d31, d31, d30
	fmadd	d9, d31, d11, d9
	fmadd	d0, d31, d10, d0
	fadd	d8, d8, d31
	fmov	d2, d8
	fmov	d1, d9
	str	d0, [sp, 112]
	bl	printf
	ldr	d0, [sp, 112]
	cmp	w19, 4
	bne	.L31
	mov	x0, 17592186044416
	fmov	d0, 4.0e+0
	movk	x0, 0x4054, lsl 48
	fmov	d1, x0
	adrp	x20, .LC12
	adrp	x0, .LC11
	add	x20, x20, :lo12:.LC12
	add	x0, x0, :lo12:.LC11
	bl	printf
	mov	w19, 3
	fmov	d9, 1.25e+0
	fmov	d10, -5.0e-1
	fmov	d11, 2.0e+0
.L32:
	fmov	d31, d9
	fmadd	d9, d9, d11, d10
	mov	x0, x20
	fsub	d31, d31, d10
	fcvt	s31, d31
	fmov	d0, d9
	fcvt	d10, s31
	fmov	d1, d10
	bl	printf
	subs	w19, w19, #1
	bne	.L32
	adrp	x1, .LANCHOR0
	add	x0, x1, :lo12:.LANCHOR0
	ldr	d11, [sp, 120]
	fmov	d4, 4.0e+0
	ldr	q0, [x1, :lo12:.LANCHOR0]
	ldp	q2, q31, [x0, 16]
	mov	v30.16b, v0.16b
	ldr	q29, [x0, 48]
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	fmla	v30.2d, v31.2d, v11.d[0]
	fmov	v31.2d, -2.0e+0
	fmla	v0.2d, v30.2d, v31.2d
	mov	v30.16b, v2.16b
	dup	d1, v0.d[1]
	fmla	v30.2d, v29.2d, v11.d[0]
	fmla	v2.2d, v30.2d, v31.2d
	fmov	d30, -2.5e-1
	fmadd	d30, d11, d30, d4
	dup	d3, v2.d[1]
	fmadd	d4, d30, d31, d4
	bl	printf
	mov	x0, 140737488355328
	mov	x1, -5
	movk	x0, 0xc030, lsl 48
	fmov	d0, x0
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	fadd	d31, d15, d12
	mov	x0, 4636737291354636288
	fmov	d30, x0
	fmov	d0, 1.7e+1
	mov	x0, 70368744177664
	movk	x0, 0x408f, lsl 48
	fadd	d31, d31, d13
	fadd	d31, d31, d14
	fmadd	d0, d31, d30, d0
	fmov	d31, x0
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	fmsub	d0, d11, d31, d0
	bl	printf
	fneg	d1, d11
	fmov	d31, 7.0e+0
	fmov	d0, 3.0e+0
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	fdiv	d0, d11, d0
	fdiv	d1, d1, d31
	bl	printf
	mov	w4, 16
	mov	w3, 40
	mov	w2, w4
	mov	w1, 24
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	printf
	ldp	d8, d9, [sp, 48]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	d10, d11, [sp, 64]
	ldp	d12, d13, [sp, 80]
	ldp	d14, d15, [sp, 96]
	ldp	x29, x30, [sp], 272
	ret
	.align 2
.L28:
	umull	x1, w0, w20
	lsr	x1, x1, 35
	msub	w0, w1, w19, w0
	add	w0, w0, 97
	b	.L33
	.global	knob
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
.LC13:
	.word	0
	.word	1072693248
	.word	0
	.word	-1074790400
.LC14:
	.word	0
	.word	1071644672
	.word	0
	.word	1075838976
	.data
	.align	3
	.LANCHOR1:
knob:
	.word	0
	.word	1070596096

