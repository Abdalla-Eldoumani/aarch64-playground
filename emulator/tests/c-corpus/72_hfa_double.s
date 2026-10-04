	.text
	.align	2
	.global	qmul
qmul:
	sub	sp, sp, #160
	fmov	d24, d0
	fmov	d25, d1
	fmov	d26, d2
	fmov	d27, d3
	fmov	d28, d4
	fmov	d29, d5
	fmov	d30, d6
	fmov	d31, d7
	str	d24, [sp, 64]
	str	d25, [sp, 72]
	str	d26, [sp, 80]
	str	d27, [sp, 88]
	str	d28, [sp, 32]
	str	d29, [sp, 40]
	str	d30, [sp, 48]
	str	d31, [sp, 56]
	ldr	d30, [sp, 64]
	ldr	d31, [sp, 32]
	fmul	d30, d30, d31
	ldr	d29, [sp, 72]
	ldr	d31, [sp, 40]
	fmul	d31, d29, d31
	fsub	d30, d30, d31
	ldr	d29, [sp, 80]
	ldr	d31, [sp, 48]
	fmul	d31, d29, d31
	fsub	d30, d30, d31
	ldr	d29, [sp, 88]
	ldr	d31, [sp, 56]
	fmul	d31, d29, d31
	fsub	d31, d30, d31
	str	d31, [sp, 96]
	ldr	d30, [sp, 64]
	ldr	d31, [sp, 40]
	fmul	d30, d30, d31
	ldr	d29, [sp, 72]
	ldr	d31, [sp, 32]
	fmul	d31, d29, d31
	fadd	d30, d30, d31
	ldr	d29, [sp, 80]
	ldr	d31, [sp, 56]
	fmul	d31, d29, d31
	fadd	d30, d30, d31
	ldr	d29, [sp, 88]
	ldr	d31, [sp, 48]
	fmul	d31, d29, d31
	fsub	d31, d30, d31
	str	d31, [sp, 104]
	ldr	d30, [sp, 64]
	ldr	d31, [sp, 48]
	fmul	d30, d30, d31
	ldr	d29, [sp, 72]
	ldr	d31, [sp, 56]
	fmul	d31, d29, d31
	fsub	d30, d30, d31
	ldr	d29, [sp, 80]
	ldr	d31, [sp, 32]
	fmul	d31, d29, d31
	fadd	d30, d30, d31
	ldr	d29, [sp, 88]
	ldr	d31, [sp, 40]
	fmul	d31, d29, d31
	fadd	d31, d30, d31
	str	d31, [sp, 112]
	ldr	d30, [sp, 64]
	ldr	d31, [sp, 56]
	fmul	d30, d30, d31
	ldr	d29, [sp, 72]
	ldr	d31, [sp, 48]
	fmul	d31, d29, d31
	fadd	d30, d30, d31
	ldr	d29, [sp, 80]
	ldr	d31, [sp, 40]
	fmul	d31, d29, d31
	fsub	d30, d30, d31
	ldr	d29, [sp, 88]
	ldr	d31, [sp, 32]
	fmul	d31, d29, d31
	fadd	d31, d30, d31
	str	d31, [sp, 120]
	add	x0, sp, 128
	add	x1, sp, 96
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	str	q30, [x0]
	str	q31, [x0, 16]
	ldr	d28, [sp, 128]
	ldr	d29, [sp, 136]
	ldr	d30, [sp, 144]
	ldr	d31, [sp, 152]
	fmov	d0, d28
	fmov	d1, d29
	fmov	d2, d30
	fmov	d3, d31
	add	sp, sp, 160
	ret
	.align	2
	.global	qconj
qconj:
	sub	sp, sp, #128
	fmov	d28, d0
	fmov	d29, d1
	fmov	d30, d2
	fmov	d31, d3
	str	d28, [sp, 32]
	str	d29, [sp, 40]
	str	d30, [sp, 48]
	str	d31, [sp, 56]
	ldr	d31, [sp, 32]
	str	d31, [sp, 64]
	ldr	d31, [sp, 40]
	fneg	d31, d31
	str	d31, [sp, 72]
	ldr	d31, [sp, 48]
	fneg	d31, d31
	str	d31, [sp, 80]
	ldr	d31, [sp, 56]
	fneg	d31, d31
	str	d31, [sp, 88]
	add	x0, sp, 96
	add	x1, sp, 64
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	str	q30, [x0]
	str	q31, [x0, 16]
	ldr	d28, [sp, 96]
	ldr	d29, [sp, 104]
	ldr	d30, [sp, 112]
	ldr	d31, [sp, 120]
	fmov	d0, d28
	fmov	d1, d29
	fmov	d2, d30
	fmov	d3, d31
	add	sp, sp, 128
	ret
	.align	2
	.global	sq_add
sq_add:
	sub	sp, sp, #48
	fmov	d30, d0
	fmov	d31, d1
	mov	x0, 0
	mov	x1, 0
	fmov	x0, d30
	fmov	x1, d31
	stp	x0, x1, [sp, 16]
	fmov	d30, d2
	fmov	d31, d3
	mov	x0, 0
	mov	x1, 0
	fmov	x0, d30
	fmov	x1, d31
	stp	x0, x1, [sp]
	ldr	d30, [sp, 16]
	ldr	d31, [sp, 16]
	fmul	d30, d30, d31
	ldr	d29, [sp, 24]
	ldr	d31, [sp, 24]
	fmul	d31, d29, d31
	fsub	d30, d30, d31
	ldr	d31, [sp]
	fadd	d31, d30, d31
	str	d31, [sp, 32]
	ldr	d31, [sp, 16]
	fadd	d30, d31, d31
	ldr	d31, [sp, 24]
	fmul	d30, d30, d31
	ldr	d31, [sp, 8]
	fadd	d31, d30, d31
	str	d31, [sp, 40]
	ldp	x0, x1, [sp, 32]
	fmov	d30, x0
	fmov	d31, x1
	fmov	d0, d30
	fmov	d1, d31
	add	sp, sp, 48
	ret
	.align	2
	.global	escape
escape:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	fmov	d30, d0
	fmov	d31, d1
	mov	x2, 0
	mov	x3, 0
	fmov	x2, d30
	fmov	x3, d31
	stp	x2, x3, [sp, 32]
	str	w0, [sp, 28]
	str	xzr, [sp, 56]
	str	xzr, [sp, 64]
	str	wzr, [sp, 76]
	b	.L8
.L12:
	ldr	d28, [sp, 32]
	ldr	d29, [sp, 40]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 64]
	fmov	d2, d28
	fmov	d3, d29
	fmov	d0, d30
	fmov	d1, d31
	bl	sq_add
	fmov	d30, d0
	fmov	d31, d1
	str	d30, [sp, 56]
	str	d31, [sp, 64]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 56]
	fmul	d30, d30, d31
	ldr	d29, [sp, 64]
	ldr	d31, [sp, 64]
	fmul	d31, d29, d31
	fadd	d30, d30, d31
	fmov	d31, 4.0e+0
	fcmpe	d30, d31
	bgt	.L14
	b	.L15
.L14:
	ldr	w0, [sp, 76]
	b	.L13
.L15:
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L8:
	ldr	w1, [sp, 76]
	ldr	w0, [sp, 28]
	cmp	w1, w0
	blt	.L12
	ldr	w0, [sp, 28]
.L13:
	ldp	x29, x30, [sp], 80
	ret
	.align	2
	.global	advance
advance:
	sub	sp, sp, #112
	fmov	d29, d0
	fmov	d30, d1
	fmov	d31, d2
	fmov	d27, d3
	fmov	d28, d4
	mov	x0, 0
	mov	x1, 0
	fmov	x0, d27
	fmov	x1, d28
	stp	x0, x1, [sp, 40]
	str	d5, [sp, 32]
	str	d29, [sp, 56]
	str	d30, [sp, 64]
	str	d31, [sp, 72]
	ldr	d30, [sp, 56]
	ldr	d29, [sp, 40]
	ldr	d31, [sp, 32]
	fmul	d31, d29, d31
	fadd	d31, d30, d31
	str	d31, [sp, 56]
	ldr	d30, [sp, 64]
	ldr	d29, [sp, 48]
	ldr	d31, [sp, 32]
	fmul	d31, d29, d31
	fadd	d31, d30, d31
	str	d31, [sp, 64]
	ldr	d30, [sp, 72]
	ldr	d31, [sp, 32]
	fadd	d31, d30, d31
	str	d31, [sp, 72]
	add	x0, sp, 88
	add	x1, sp, 56
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	ldr	d29, [sp, 88]
	ldr	d30, [sp, 96]
	ldr	d31, [sp, 104]
	fmov	d0, d29
	fmov	d1, d30
	fmov	d2, d31
	add	sp, sp, 112
	ret
	.align	2
	.global	dot3
dot3:
	sub	sp, sp, #48
	fmov	d26, d0
	fmov	d27, d1
	fmov	d28, d2
	fmov	d29, d3
	fmov	d30, d4
	fmov	d31, d5
	str	d26, [sp, 24]
	str	d27, [sp, 32]
	str	d28, [sp, 40]
	str	d29, [sp]
	str	d30, [sp, 8]
	str	d31, [sp, 16]
	ldr	d30, [sp, 24]
	ldr	d31, [sp]
	fmul	d30, d30, d31
	ldr	d29, [sp, 32]
	ldr	d31, [sp, 8]
	fmul	d31, d29, d31
	fadd	d30, d30, d31
	ldr	d29, [sp, 40]
	ldr	d31, [sp, 16]
	fmul	d31, d29, d31
	fadd	d31, d30, d31
	fmov	d0, d31
	add	sp, sp, 48
	ret
	.align	2
	.global	dmix
dmix:
	sub	sp, sp, #32
	stp	x0, x1, [sp]
	ldr	d31, [sp]
	fadd	d30, d31, d31
	ldr	s31, [sp, 8]
	fcvt	d31, s31
	fadd	d31, d30, d31
	str	d31, [sp, 16]
	ldr	d30, [sp]
	ldr	s31, [sp, 8]
	fcvt	d31, s31
	fsub	d31, d30, d31
	fcvt	s31, d31
	str	s31, [sp, 24]
	ldp	x0, x1, [sp, 16]
	add	sp, sp, 32
	ret
	.align	2
	.global	d5scale
d5scale:
	str	x19, [sp, -48]!
	mov	x1, x8
	mov	x19, x0
	str	d0, [sp, 24]
	str	wzr, [sp, 44]
	b	.L23
.L24:
	ldrsw	x0, [sp, 44]
	ldr	d30, [x19, x0, lsl 3]
	ldr	d31, [sp, 24]
	fmul	d30, d30, d31
	ldr	w0, [sp, 44]
	scvtf	d31, w0
	fadd	d31, d30, d31
	ldrsw	x0, [sp, 44]
	str	d31, [x19, x0, lsl 3]
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L23:
	ldr	w0, [sp, 44]
	cmp	w0, 4
	ble	.L24
	mov	x0, x1
	mov	x1, x19
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	ldr	x1, [x1, 32]
	str	q30, [x0]
	str	q31, [x0, 16]
	str	x1, [x0, 32]
	ldr	x19, [sp], 48
	ret
	.align	2
	.global	dlmake
dlmake:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	str	x0, [sp]
	ldr	d31, [sp]
	scvtf	d30, d31
	ldr	d31, [sp, 8]
	fmul	d31, d30, d31
	str	d31, [sp, 16]
	ldr	d30, [sp, 8]
	fmov	d31, 4.0e+0
	fmul	d31, d30, d31
	fcvtzs	d31, d31
	ldr	x0, [sp]
	fmov	x1, d31
	add	x0, x1, x0
	str	x0, [sp, 24]
	ldp	x0, x1, [sp, 16]
	add	sp, sp, 32
	ret
	.align	2
	.global	overflow
overflow:
	sub	sp, sp, #48
	fmov	d28, d0
	fmov	d29, d1
	fmov	d30, d2
	fmov	d31, d3
	fmov	d26, d4
	fmov	d27, d5
	mov	x0, 0
	mov	x1, 0
	fmov	x0, d26
	fmov	x1, d27
	stp	x0, x1, [sp]
	str	d28, [sp, 16]
	str	d29, [sp, 24]
	str	d30, [sp, 32]
	str	d31, [sp, 40]
	ldr	d30, [sp, 16]
	ldr	d31, [sp, 24]
	fadd	d30, d30, d31
	ldr	d31, [sp, 32]
	fadd	d30, d30, d31
	ldr	d31, [sp, 40]
	fadd	d30, d30, d31
	ldr	d29, [sp]
	ldr	d31, [sp, 8]
	fadd	d29, d29, d31
	fmov	d31, 1.0e+1
	fmul	d31, d29, d31
	fadd	d30, d30, d31
	ldr	d29, [sp, 48]
	ldr	d31, [sp, 56]
	fadd	d29, d29, d31
	ldr	d31, [sp, 64]
	fadd	d29, d29, d31
	ldr	d31, [sp, 72]
	fadd	d31, d29, d31
	mov	x0, 4636737291354636288
	fmov	d29, x0
	fmul	d31, d31, d29
	fadd	d30, d30, d31
	ldr	d31, [sp, 80]
	mov	x0, 70368744177664
	movk	x0, 0x408f, lsl 48
	fmov	d29, x0
	fmul	d31, d31, d29
	fadd	d31, d30, d31
	fmov	d0, d31
	add	sp, sp, 48
	ret
	.align	2
	.global	third
third:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	fmov	d31, 3.0e+0
	ldr	d30, [sp, 8]
	fdiv	d31, d30, d31
	str	d31, [sp, 16]
	ldr	d31, [sp, 8]
	fneg	d30, d31
	fmov	d31, 7.0e+0
	fdiv	d31, d30, d31
	str	d31, [sp, 24]
	ldp	x0, x1, [sp, 16]
	fmov	d30, x0
	fmov	d31, x1
	fmov	d0, d30
	fmov	d1, d31
	add	sp, sp, 32
	ret
	.section .rodata
	.align	3
.LC4:
	.string	"%s %.4f %.4f %.4f %.4f\n"
	.text
	.align	2
	.global	pq
pq:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x0, [sp, 56]
	fmov	d28, d0
	fmov	d29, d1
	fmov	d30, d2
	fmov	d31, d3
	str	d28, [sp, 24]
	str	d29, [sp, 32]
	str	d30, [sp, 40]
	str	d31, [sp, 48]
	ldr	d31, [sp, 24]
	ldr	d30, [sp, 32]
	ldr	d29, [sp, 40]
	ldr	d28, [sp, 48]
	fmov	d3, d28
	fmov	d2, d29
	fmov	d1, d30
	fmov	d0, d31
	ldr	x1, [sp, 56]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	nop
	ldp	x29, x30, [sp], 64
	ret
	.global	knob
	.data
	.align	3
knob:
	.word	0
	.word	1070596096
	.section .rodata
	.align	3
.LC5:
	.string	"q"
	.align	3
.LC6:
	.string	"norm"
	.align	3
.LC7:
	.string	"set %s\n"
	.align	3
.LC8:
	.string	"advance %.4f %.4f %.4f\n"
	.align	3
.LC9:
	.string	"dot3 %.6f %.6f\n"
	.align	3
.LC10:
	.string	"dmix %.4f %.4f\n"
	.align	3
.LC11:
	.string	"d5 %.4f %.4f %.4f %.4f %.4f\n"
	.align	3
.LC12:
	.string	"dl %.4f %ld\n"
	.align	3
.LC13:
	.string	"overflow %.4f\n"
	.align	3
.LC14:
	.string	"third %.17g %.17g\n"
	.align	3
.LC15:
	.string	"sizes %d %d %d %d\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #544
	stp	x29, x30, [sp, 48]
	add	x29, sp, 48
	str	d15, [sp, 64]
	adrp	x0, knob
	add	x0, x0, :lo12:knob
	ldr	d31, [x0]
	str	d31, [sp, 512]
	fmov	d31, 1.0e+0
	str	d31, [sp, 400]
	fmov	d31, 2.0e+0
	str	d31, [sp, 408]
	fmov	d31, -3.0e+0
	str	d31, [sp, 416]
	ldr	d31, [sp, 512]
	str	d31, [sp, 424]
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 368
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	str	q30, [x0]
	str	q31, [x0, 16]
	str	wzr, [sp, 540]
	b	.L34
.L35:
	ldr	d24, [sp, 368]
	ldr	d25, [sp, 376]
	ldr	d26, [sp, 384]
	ldr	d27, [sp, 392]
	ldr	d28, [sp, 400]
	ldr	d29, [sp, 408]
	ldr	d30, [sp, 416]
	ldr	d31, [sp, 424]
	fmov	d4, d24
	fmov	d5, d25
	fmov	d6, d26
	fmov	d7, d27
	fmov	d0, d28
	fmov	d1, d29
	fmov	d2, d30
	fmov	d3, d31
	bl	qmul
	fmov	d28, d0
	fmov	d29, d1
	fmov	d30, d2
	fmov	d31, d3
	str	d28, [sp, 400]
	str	d29, [sp, 408]
	str	d30, [sp, 416]
	str	d31, [sp, 424]
	ldr	d28, [sp, 400]
	ldr	d29, [sp, 408]
	ldr	d30, [sp, 416]
	ldr	d31, [sp, 424]
	fmov	d0, d28
	fmov	d1, d29
	fmov	d2, d30
	fmov	d3, d31
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	pq
	ldr	w0, [sp, 540]
	add	w0, w0, 1
	str	w0, [sp, 540]
.L34:
	ldr	w0, [sp, 540]
	cmp	w0, 6
	ble	.L35
	ldr	d28, [sp, 400]
	ldr	d29, [sp, 408]
	ldr	d30, [sp, 416]
	ldr	d31, [sp, 424]
	fmov	d0, d28
	fmov	d1, d29
	fmov	d2, d30
	fmov	d3, d31
	bl	qconj
	fmov	d28, d0
	fmov	d29, d1
	fmov	d30, d2
	fmov	d31, d3
	str	d28, [sp, 432]
	str	d29, [sp, 440]
	str	d30, [sp, 448]
	str	d31, [sp, 456]
	ldr	d24, [sp, 432]
	ldr	d25, [sp, 440]
	ldr	d26, [sp, 448]
	ldr	d27, [sp, 456]
	ldr	d28, [sp, 400]
	ldr	d29, [sp, 408]
	ldr	d30, [sp, 416]
	ldr	d31, [sp, 424]
	fmov	d4, d24
	fmov	d5, d25
	fmov	d6, d26
	fmov	d7, d27
	fmov	d0, d28
	fmov	d1, d29
	fmov	d2, d30
	fmov	d3, d31
	bl	qmul
	fmov	d28, d0
	fmov	d29, d1
	fmov	d30, d2
	fmov	d31, d3
	str	d28, [sp, 336]
	str	d29, [sp, 344]
	str	d30, [sp, 352]
	str	d31, [sp, 360]
	ldr	d28, [sp, 336]
	ldr	d29, [sp, 344]
	ldr	d30, [sp, 352]
	ldr	d31, [sp, 360]
	fmov	d0, d28
	fmov	d1, d29
	fmov	d2, d30
	fmov	d3, d31
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	pq
	str	wzr, [sp, 536]
	b	.L36
.L41:
	str	wzr, [sp, 532]
	b	.L37
.L40:
	ldr	w0, [sp, 532]
	scvtf	d30, w0
	fmov	d31, 2.5e-1
	fmul	d30, d30, d31
	fmov	d31, 2.0e+0
	fsub	d31, d30, d31
	str	d31, [sp, 128]
	ldr	w0, [sp, 536]
	scvtf	d30, w0
	fmov	d31, 5.0e-1
	fmul	d31, d30, d31
	fmov	d30, 1.0e+0
	fsub	d31, d30, d31
	str	d31, [sp, 136]
	ldr	d30, [sp, 128]
	ldr	d31, [sp, 136]
	mov	w0, 30
	fmov	d0, d30
	fmov	d1, d31
	bl	escape
	str	w0, [sp, 508]
	ldr	w0, [sp, 508]
	cmp	w0, 29
	bgt	.L38
	ldr	w0, [sp, 508]
	mov	w1, 26
	sdiv	w2, w0, w1
	mov	w1, 26
	mul	w1, w2, w1
	sub	w0, w0, w1
	and	w0, w0, 255
	add	w0, w0, 97
	and	w2, w0, 255
	b	.L39
.L38:
	mov	w2, 35
.L39:
	ldrsw	x0, [sp, 532]
	add	x1, sp, 144
	strb	w2, [x1, x0]
	ldr	w0, [sp, 532]
	add	w0, w0, 1
	str	w0, [sp, 532]
.L37:
	ldr	w0, [sp, 532]
	cmp	w0, 11
	ble	.L40
	strb	wzr, [sp, 156]
	add	x0, sp, 144
	mov	x1, x0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	w0, [sp, 536]
	add	w0, w0, 1
	str	w0, [sp, 536]
.L36:
	ldr	w0, [sp, 536]
	cmp	w0, 2
	ble	.L41
	str	xzr, [sp, 312]
	str	xzr, [sp, 320]
	str	xzr, [sp, 328]
	fmov	d31, 3.0e+0
	str	d31, [sp, 296]
	fmov	d31, -1.5e+0
	str	d31, [sp, 304]
	str	wzr, [sp, 528]
	b	.L42
.L43:
	ldr	w0, [sp, 528]
	add	w0, w0, 1
	scvtf	d30, w0
	ldr	d31, [sp, 512]
	fmul	d26, d30, d31
	ldr	d27, [sp, 296]
	ldr	d28, [sp, 304]
	ldr	d29, [sp, 312]
	ldr	d30, [sp, 320]
	ldr	d31, [sp, 328]
	fmov	d5, d26
	fmov	d3, d27
	fmov	d4, d28
	fmov	d0, d29
	fmov	d1, d30
	fmov	d2, d31
	bl	advance
	fmov	d29, d0
	fmov	d30, d1
	fmov	d31, d2
	str	d29, [sp, 312]
	str	d30, [sp, 320]
	str	d31, [sp, 328]
	ldr	d31, [sp, 312]
	ldr	d30, [sp, 320]
	ldr	d29, [sp, 328]
	fmov	d2, d29
	fmov	d1, d30
	fmov	d0, d31
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldr	w0, [sp, 528]
	add	w0, w0, 1
	str	w0, [sp, 528]
.L42:
	ldr	w0, [sp, 528]
	cmp	w0, 3
	ble	.L43
	adrp	x0, .LC1
	add	x1, x0, :lo12:.LC1
	add	x0, sp, 272
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	adrp	x0, .LC2
	add	x1, x0, :lo12:.LC2
	add	x0, sp, 248
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	ldr	d26, [sp, 248]
	ldr	d27, [sp, 256]
	ldr	d28, [sp, 264]
	ldr	d29, [sp, 272]
	ldr	d30, [sp, 280]
	ldr	d31, [sp, 288]
	fmov	d3, d26
	fmov	d4, d27
	fmov	d5, d28
	fmov	d0, d29
	fmov	d1, d30
	fmov	d2, d31
	bl	dot3
	fmov	d15, d0
	ldr	d26, [sp, 248]
	ldr	d27, [sp, 256]
	ldr	d28, [sp, 264]
	ldr	d29, [sp, 248]
	ldr	d30, [sp, 256]
	ldr	d31, [sp, 264]
	fmov	d3, d26
	fmov	d4, d27
	fmov	d5, d28
	fmov	d0, d29
	fmov	d1, d30
	fmov	d2, d31
	bl	dot3
	fmov	d31, d0
	fmov	d1, d31
	fmov	d0, d15
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	fmov	d31, 1.25e+0
	str	d31, [sp, 232]
	fmov	s31, -5.0e-1
	str	s31, [sp, 240]
	str	wzr, [sp, 524]
	b	.L44
.L45:
	ldp	x0, x1, [sp, 232]
	bl	dmix
	stp	x0, x1, [sp, 232]
	ldr	d30, [sp, 232]
	ldr	s31, [sp, 240]
	fcvt	d31, s31
	fmov	d1, d31
	fmov	d0, d30
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldr	w0, [sp, 524]
	add	w0, w0, 1
	str	w0, [sp, 524]
.L44:
	ldr	w0, [sp, 524]
	cmp	w0, 2
	ble	.L45
	adrp	x0, .LC3
	add	x1, x0, :lo12:.LC3
	add	x0, sp, 192
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	ldr	x1, [x1, 32]
	str	q30, [x0]
	str	q31, [x0, 16]
	str	x1, [x0, 32]
	add	x0, sp, 80
	add	x1, sp, 192
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	ldr	x1, [x1, 32]
	str	q30, [x0]
	str	q31, [x0, 16]
	str	x1, [x0, 32]
	add	x0, sp, 80
	add	x1, sp, 464
	mov	x8, x1
	ldr	d0, [sp, 512]
	bl	d5scale
	add	x0, sp, 80
	add	x1, sp, 464
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	ldr	x1, [x1, 32]
	str	q30, [x0]
	str	q31, [x0, 16]
	str	x1, [x0, 32]
	add	x0, sp, 80
	add	x1, sp, 192
	mov	x8, x1
	fmov	d0, -2.0e+0
	bl	d5scale
	ldr	d31, [sp, 192]
	ldr	d30, [sp, 200]
	ldr	d29, [sp, 208]
	ldr	d28, [sp, 216]
	ldr	d27, [sp, 224]
	fmov	d4, d27
	fmov	d3, d28
	fmov	d2, d29
	fmov	d1, d30
	fmov	d0, d31
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	mov	x0, 6
	fmov	d0, -2.75e+0
	bl	dlmake
	stp	x0, x1, [sp, 176]
	ldr	d31, [sp, 176]
	ldr	x0, [sp, 184]
	mov	x1, x0
	fmov	d0, d31
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	ldr	d31, [sp, 512]
	fneg	d25, d31
	ldr	d26, [sp, 296]
	ldr	d27, [sp, 304]
	ldr	d28, [sp, 368]
	ldr	d29, [sp, 376]
	ldr	d30, [sp, 384]
	ldr	d31, [sp, 392]
	str	d25, [sp, 32]
	mov	x1, sp
	add	x0, sp, 400
	ldr	q24, [x0]
	ldr	q25, [x0, 16]
	str	q24, [x1]
	str	q25, [x1, 16]
	fmov	d4, d26
	fmov	d5, d27
	fmov	d0, d28
	fmov	d1, d29
	fmov	d2, d30
	fmov	d3, d31
	bl	overflow
	fmov	d31, d0
	fmov	d0, d31
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	ldr	d0, [sp, 512]
	bl	third
	fmov	d30, d0
	fmov	d31, d1
	str	d30, [sp, 160]
	str	d31, [sp, 168]
	ldr	d31, [sp, 160]
	ldr	d30, [sp, 168]
	fmov	d1, d30
	fmov	d0, d31
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	printf
	mov	w4, 16
	mov	w3, 40
	mov	w2, 16
	mov	w1, 24
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	mov	w0, 0
	ldr	d15, [sp, 64]
	ldp	x29, x30, [sp, 48]
	add	sp, sp, 544
	ret
	.section .rodata
	.align	3
.LC0:
	.word	0
	.word	1071644672
	.word	0
	.word	1071644672
	.word	0
	.word	1071644672
	.word	0
	.word	1071644672
	.align	3
.LC1:
	.word	0
	.word	1073217536
	.word	0
	.word	-1073741824
	.word	0
	.word	1069547520
	.align	3
.LC2:
	.word	0
	.word	1074790400
	.word	0
	.word	1071644672
	.word	0
	.word	-1071644672
	.align	3
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
	.text

