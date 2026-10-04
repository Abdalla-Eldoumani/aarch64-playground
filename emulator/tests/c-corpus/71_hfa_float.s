	.text
	.align	2
	.global	cmul
cmul:
	sub	sp, sp, #32
	fmov	s30, s0
	fmov	s31, s1
	fmov	x0, d30
	fmov	w1, s31
	bfi	x0, x1, 32, 32
	str	x0, [sp, 8]
	fmov	s30, s2
	fmov	s31, s3
	fmov	x0, d30
	fmov	w1, s31
	bfi	x0, x1, 32, 32
	str	x0, [sp]
	ldr	s30, [sp, 8]
	ldr	s31, [sp]
	fmul	s30, s30, s31
	ldr	s29, [sp, 12]
	ldr	s31, [sp, 4]
	fmul	s31, s29, s31
	fsub	s31, s30, s31
	str	s31, [sp, 24]
	ldr	s30, [sp, 8]
	ldr	s31, [sp, 4]
	fmul	s30, s30, s31
	ldr	s29, [sp, 12]
	ldr	s31, [sp]
	fmul	s31, s29, s31
	fadd	s31, s30, s31
	str	s31, [sp, 28]
	ldr	x0, [sp, 24]
	lsr	w1, w0, 0
	lsr	x0, x0, 32
	fmov	s30, w1
	fmov	s31, w0
	fmov	s0, s30
	fmov	s1, s31
	add	sp, sp, 32
	ret
	.align	2
	.global	cross
cross:
	sub	sp, sp, #80
	fmov	s26, s0
	fmov	s27, s1
	fmov	s28, s2
	fmov	s29, s3
	fmov	s30, s4
	fmov	s31, s5
	str	s26, [sp, 32]
	str	s27, [sp, 36]
	str	s28, [sp, 40]
	str	s29, [sp, 16]
	str	s30, [sp, 20]
	str	s31, [sp, 24]
	ldr	s30, [sp, 36]
	ldr	s31, [sp, 24]
	fmul	s30, s30, s31
	ldr	s29, [sp, 40]
	ldr	s31, [sp, 20]
	fmul	s31, s29, s31
	fsub	s31, s30, s31
	str	s31, [sp, 48]
	ldr	s30, [sp, 40]
	ldr	s31, [sp, 16]
	fmul	s30, s30, s31
	ldr	s29, [sp, 32]
	ldr	s31, [sp, 24]
	fmul	s31, s29, s31
	fsub	s31, s30, s31
	str	s31, [sp, 52]
	ldr	s30, [sp, 32]
	ldr	s31, [sp, 20]
	fmul	s30, s30, s31
	ldr	s29, [sp, 36]
	ldr	s31, [sp, 16]
	fmul	s31, s29, s31
	fsub	s31, s30, s31
	str	s31, [sp, 56]
	add	x0, sp, 64
	add	x1, sp, 48
	ldr	x2, [x1]
	ldr	w1, [x1, 8]
	str	x2, [x0]
	str	w1, [x0, 8]
	ldr	s29, [sp, 64]
	ldr	s30, [sp, 68]
	ldr	s31, [sp, 72]
	fmov	s0, s29
	fmov	s1, s30
	fmov	s2, s31
	add	sp, sp, 80
	ret
	.align	2
	.global	axpy
axpy:
	sub	sp, sp, #64
	fmov	s28, s0
	fmov	s29, s1
	fmov	s30, s2
	fmov	s31, s3
	mov	x0, 0
	mov	x1, 0
	fmov	w2, s28
	bfi	x0, x2, 0, 32
	fmov	w2, s29
	bfi	x0, x2, 32, 32
	fmov	w2, s30
	bfi	x1, x2, 0, 32
	fmov	w2, s31
	bfi	x1, x2, 32, 32
	stp	x0, x1, [sp, 16]
	fmov	s28, s4
	fmov	s29, s5
	fmov	s30, s6
	fmov	s31, s7
	mov	x0, 0
	mov	x1, 0
	fmov	w2, s28
	bfi	x0, x2, 0, 32
	fmov	w2, s29
	bfi	x0, x2, 32, 32
	fmov	w2, s30
	bfi	x1, x2, 0, 32
	fmov	w2, s31
	bfi	x1, x2, 32, 32
	stp	x0, x1, [sp]
	str	wzr, [sp, 60]
	b	.L6
.L7:
	ldrsw	x0, [sp, 60]
	lsl	x0, x0, 2
	add	x1, sp, 16
	ldr	s30, [x1, x0]
	ldr	s31, [sp, 64]
	fmul	s30, s30, s31
	ldrsw	x0, [sp, 60]
	lsl	x0, x0, 2
	mov	x1, sp
	ldr	s31, [x1, x0]
	fadd	s31, s30, s31
	ldrsw	x0, [sp, 60]
	lsl	x0, x0, 2
	add	x1, sp, 40
	str	s31, [x1, x0]
	ldr	w0, [sp, 60]
	add	w0, w0, 1
	str	w0, [sp, 60]
.L6:
	ldr	w0, [sp, 60]
	cmp	w0, 3
	ble	.L7
	ldp	x0, x1, [sp, 40]
	lsr	w3, w0, 0
	lsr	x2, x0, 32
	mov	w4, w2
	lsr	w2, w1, 0
	lsr	x0, x1, 32
	fmov	s28, w3
	fmov	s29, w4
	fmov	s30, w2
	fmov	s31, w0
	fmov	s0, s28
	fmov	s1, s29
	fmov	s2, s30
	fmov	s3, s31
	add	sp, sp, 64
	ret
	.align	2
	.global	crowd
crowd:
	sub	sp, sp, #32
	fmov	s26, s0
	fmov	s27, s1
	fmov	s28, s2
	fmov	s29, s3
	fmov	s30, s4
	fmov	s31, s5
	str	s26, [sp, 16]
	str	s27, [sp, 20]
	str	s28, [sp, 24]
	str	s29, [sp]
	str	s30, [sp, 4]
	str	s31, [sp, 8]
	ldr	s30, [sp, 16]
	ldr	s31, [sp, 20]
	fsub	s30, s30, s31
	ldr	s31, [sp, 24]
	fadd	s30, s30, s31
	ldr	s29, [sp]
	ldr	s31, [sp, 4]
	fsub	s29, s29, s31
	ldr	s31, [sp, 8]
	fadd	s31, s29, s31
	fadd	s31, s31, s31
	fadd	s30, s30, s31
	ldr	s29, [sp, 32]
	ldr	s31, [sp, 36]
	fsub	s29, s29, s31
	ldr	s31, [sp, 40]
	fadd	s29, s29, s31
	fmov	s31, 4.0e+0
	fmul	s31, s29, s31
	fadd	s30, s30, s31
	ldr	s29, [sp, 48]
	fmov	s31, 8.0e+0
	fmul	s31, s29, s31
	fadd	s31, s30, s31
	fmov	s0, s31
	add	sp, sp, 32
	ret
	.align	2
	.global	crowd2
crowd2:
	sub	sp, sp, #32
	fmov	s30, s0
	fmov	s31, s1
	fmov	x0, d30
	fmov	w1, s31
	bfi	x0, x1, 32, 32
	str	x0, [sp, 24]
	fmov	s28, s2
	fmov	s29, s3
	fmov	s30, s4
	fmov	s31, s5
	mov	x0, 0
	mov	x1, 0
	fmov	w2, s28
	bfi	x0, x2, 0, 32
	fmov	w2, s29
	bfi	x0, x2, 32, 32
	fmov	w2, s30
	bfi	x1, x2, 0, 32
	fmov	w2, s31
	bfi	x1, x2, 32, 32
	stp	x0, x1, [sp, 8]
	fmov	s30, s6
	fmov	s31, s7
	fmov	x0, d30
	fmov	w1, s31
	bfi	x0, x1, 32, 32
	str	x0, [sp]
	ldr	s30, [sp, 24]
	ldr	s31, [sp, 28]
	fadd	s31, s31, s31
	fadd	s30, s30, s31
	ldr	s29, [sp, 8]
	ldr	s31, [sp, 20]
	fsub	s29, s29, s31
	fmov	s31, 4.0e+0
	fmul	s31, s29, s31
	fadd	s30, s30, s31
	ldr	s29, [sp]
	ldr	s31, [sp, 4]
	fsub	s29, s29, s31
	fmov	s31, 8.0e+0
	fmul	s31, s29, s31
	fadd	s30, s30, s31
	ldr	s29, [sp, 32]
	fmov	s31, 1.6e+1
	fmul	s31, s29, s31
	fadd	s30, s30, s31
	ldr	s29, [sp, 40]
	ldr	s31, [sp, 44]
	fadd	s29, s29, s31
	movi	v31.2s, 0x42, lsl 24
	fmul	s31, s29, s31
	fadd	s31, s30, s31
	fmov	s0, s31
	add	sp, sp, 32
	ret
	.align	2
	.global	blend
blend:
	sub	sp, sp, #80
	str	w0, [sp, 44]
	fmov	s28, s0
	fmov	s29, s1
	fmov	s30, s2
	fmov	s31, s3
	mov	x2, 0
	mov	x3, 0
	fmov	w0, s28
	bfi	x2, x0, 0, 32
	fmov	w0, s29
	bfi	x2, x0, 32, 32
	fmov	w0, s30
	bfi	x3, x0, 0, 32
	fmov	w0, s31
	bfi	x3, x0, 32, 32
	stp	x2, x3, [sp, 24]
	str	d4, [sp, 16]
	fmov	s30, s5
	fmov	s31, s6
	fmov	x0, d30
	fmov	w2, s31
	bfi	x0, x2, 32, 32
	str	x0, [sp, 8]
	str	x1, [sp]
	str	wzr, [sp, 76]
	b	.L14
.L17:
	ldrsw	x0, [sp, 76]
	lsl	x0, x0, 2
	add	x1, sp, 24
	ldr	s30, [x1, x0]
	ldr	d31, [sp, 16]
	fcvt	s31, d31
	fmul	s30, s30, s31
	ldr	w0, [sp, 76]
	and	w0, w0, 1
	cmp	w0, 0
	beq	.L15
	ldr	s31, [sp, 12]
	b	.L16
.L15:
	ldr	s31, [sp, 8]
.L16:
	ldrsw	x1, [sp, 44]
	ldr	x0, [sp]
	sub	x0, x1, x0
	scvtf	s29, x0
	fmul	s31, s31, s29
	fadd	s31, s30, s31
	ldrsw	x0, [sp, 76]
	lsl	x0, x0, 2
	add	x1, sp, 56
	str	s31, [x1, x0]
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L14:
	ldr	w0, [sp, 76]
	cmp	w0, 3
	ble	.L17
	ldp	x0, x1, [sp, 56]
	lsr	w3, w0, 0
	lsr	x2, x0, 32
	mov	w4, w2
	lsr	w2, w1, 0
	lsr	x0, x1, 32
	fmov	s28, w3
	fmov	s29, w4
	fmov	s30, w2
	fmov	s31, w0
	fmov	s0, s28
	fmov	s1, s29
	fmov	s2, s30
	fmov	s3, s31
	add	sp, sp, 80
	ret
	.align	2
	.global	shift
shift:
	sub	sp, sp, #64
	fmov	s29, s0
	fmov	s30, s1
	fmov	s31, s2
	str	s3, [sp, 28]
	str	s29, [sp, 32]
	str	s30, [sp, 36]
	str	s31, [sp, 40]
	ldr	s30, [sp, 32]
	ldr	s31, [sp, 28]
	fadd	s31, s30, s31
	str	s31, [sp, 32]
	ldr	s30, [sp, 36]
	ldr	s31, [sp, 28]
	fsub	s31, s30, s31
	str	s31, [sp, 36]
	ldr	s30, [sp, 40]
	ldr	s31, [sp, 28]
	fneg	s31, s31
	fmul	s31, s30, s31
	str	s31, [sp, 40]
	add	x0, sp, 48
	add	x1, sp, 32
	ldr	x2, [x1]
	ldr	w1, [x1, 8]
	str	x2, [x0]
	str	w1, [x0, 8]
	ldr	s29, [sp, 48]
	ldr	s30, [sp, 52]
	ldr	s31, [sp, 56]
	fmov	s0, s29
	fmov	s1, s30
	fmov	s2, s31
	add	sp, sp, 64
	ret
	.align	2
	.global	twist
twist:
	str	x19, [sp, -48]!
	mov	x2, x8
	mov	x19, x0
	str	wzr, [sp, 44]
	b	.L22
.L23:
	mov	w1, 4
	ldr	w0, [sp, 44]
	sub	w0, w1, w0
	sxtw	x0, w0
	ldr	s30, [x19, x0, lsl 2]
	ldrsw	x0, [sp, 44]
	ldr	s29, [x19, x0, lsl 2]
	fmov	s31, 5.0e-1
	fmul	s31, s29, s31
	fsub	s31, s30, s31
	ldrsw	x0, [sp, 44]
	lsl	x0, x0, 2
	add	x1, sp, 24
	str	s31, [x1, x0]
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L22:
	ldr	w0, [sp, 44]
	cmp	w0, 4
	ble	.L23
	mov	x3, x2
	add	x2, sp, 24
	ldp	x0, x1, [x2]
	ldr	w2, [x2, 16]
	stp	x0, x1, [x3]
	str	w2, [x3, 16]
	ldr	x19, [sp], 48
	ret
	.align	2
	.global	fimix
fimix:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	ldr	s30, [sp, 8]
	ldr	s31, [sp, 12]
	scvtf	s31, s31
	fmul	s31, s30, s31
	str	s31, [sp, 24]
	ldr	w0, [sp, 12]
	ldr	s31, [sp, 8]
	fcvtzs	w1, s31
	sub	w0, w0, w1
	str	w0, [sp, 28]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.section .rodata
	.align	3
.LC4:
	.string	"%s"
	.align	3
.LC5:
	.string	" %.4f"
	.align	3
.LC6:
	.string	"\n"
	.text
	.align	2
	.global	pf
pf:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x0, [sp, 40]
	str	x1, [sp, 32]
	str	w2, [sp, 28]
	ldr	x1, [sp, 40]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	str	wzr, [sp, 60]
	b	.L28
.L29:
	ldrsw	x0, [sp, 60]
	lsl	x0, x0, 2
	ldr	x1, [sp, 32]
	add	x0, x1, x0
	ldr	s31, [x0]
	fcvt	d31, s31
	fmov	d0, d31
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [sp, 60]
	add	w0, w0, 1
	str	w0, [sp, 60]
.L28:
	ldr	w1, [sp, 60]
	ldr	w0, [sp, 28]
	cmp	w1, w0
	blt	.L29
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	nop
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	3
.LC7:
	.string	"%s %.4f %.4f %.4f\n"
	.text
	.align	2
	.global	pf3
pf3:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 40]
	fmov	s29, s0
	fmov	s30, s1
	fmov	s31, s2
	str	s29, [sp, 24]
	str	s30, [sp, 28]
	str	s31, [sp, 32]
	ldr	s31, [sp, 24]
	fcvt	d30, s31
	ldr	s31, [sp, 28]
	fcvt	d29, s31
	ldr	s31, [sp, 32]
	fcvt	d31, s31
	fmov	d2, d31
	fmov	d1, d29
	fmov	d0, d30
	ldr	x1, [sp, 40]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	nop
	ldp	x29, x30, [sp], 48
	ret
	.global	knob
	.data
	.align	2
knob:
	.word	1056964608
	.section .rodata
	.align	3
.LC8:
	.string	"cmul %d: %.6f %.6f\n"
	.align	3
.LC9:
	.string	"signed zeros %.1f %.1f\n"
	.align	3
.LC10:
	.string	"ties %.4f %.2f\n"
	.align	3
.LC11:
	.string	"cross"
	.align	3
.LC12:
	.string	"cross2"
	.align	3
.LC13:
	.string	"axpy"
	.align	3
.LC14:
	.string	"crowd %.4f\n"
	.align	3
.LC15:
	.string	"crowd2 %.4f\n"
	.align	3
.LC16:
	.string	"blend"
	.align	3
.LC17:
	.string	"shift %.4f %.4f %.4f\n"
	.align	3
.LC18:
	.string	"twist"
	.align	3
.LC19:
	.string	"fimix %.4f %d\n"
	.align	3
.LC20:
	.string	"sizes %d %d %d %d\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #432
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	stp	x19, x20, [sp, 48]
	stp	x21, x22, [sp, 64]
	str	x23, [sp, 80]
	adrp	x0, knob
	add	x0, x0, :lo12:knob
	ldr	s31, [x0]
	str	s31, [sp, 412]
	fmov	s31, 1.5e+0
	str	s31, [sp, 368]
	fmov	s31, -2.5e-1
	str	s31, [sp, 372]
	ldr	s31, [sp, 412]
	str	s31, [sp, 360]
	fmov	s31, 2.0e+0
	str	s31, [sp, 364]
	str	wzr, [sp, 428]
	b	.L32
.L33:
	ldr	s28, [sp, 360]
	ldr	s29, [sp, 364]
	ldr	s30, [sp, 368]
	ldr	s31, [sp, 372]
	fmov	s2, s28
	fmov	s3, s29
	fmov	s0, s30
	fmov	s1, s31
	bl	cmul
	fmov	s30, s0
	fmov	s31, s1
	str	s30, [sp, 368]
	str	s31, [sp, 372]
	ldr	s31, [sp, 368]
	fcvt	d30, s31
	ldr	s31, [sp, 372]
	fcvt	d31, s31
	fmov	d1, d31
	fmov	d0, d30
	ldr	w1, [sp, 428]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldr	w0, [sp, 428]
	add	w0, w0, 1
	str	w0, [sp, 428]
.L32:
	ldr	w0, [sp, 428]
	cmp	w0, 3
	ble	.L33
	movi	v31.2s, 0x80, lsl 24
	fmov	x0, d31
	bfi	x21, x0, 0, 32
	movi	v31.2s, #0
	fmov	x0, d31
	bfi	x21, x0, 32, 32
	fmov	s31, 1.0e+0
	fmov	x0, d31
	bfi	x22, x0, 0, 32
	movi	v31.2s, #0
	fmov	x0, d31
	bfi	x22, x0, 32, 32
	lsr	w2, w22, 0
	lsr	x0, x22, 32
	fmov	s30, w0
	lsr	w1, w21, 0
	lsr	x0, x21, 32
	fmov	s31, w0
	fmov	s2, w2
	fmov	s3, s30
	fmov	s0, w1
	fmov	s1, s31
	bl	cmul
	fmov	s30, s0
	fmov	s31, s1
	str	s30, [sp, 352]
	str	s31, [sp, 356]
	ldr	s31, [sp, 352]
	fcvt	d30, s31
	ldr	s31, [sp, 356]
	fcvt	d31, s31
	fmov	d1, d31
	fmov	d0, d30
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	fmov	s31, 1.25e-1
	fmov	x0, d31
	bfi	x19, x0, 0, 32
	fmov	s31, 5.0e-1
	fmov	x0, d31
	bfi	x19, x0, 32, 32
	ldr	s30, [sp, 412]
	fmov	s31, 5.0e-1
	fmul	s31, s30, s31
	fmov	w0, s31
	bfi	x20, x0, 0, 32
	movi	v31.2s, #0
	fmov	x0, d31
	bfi	x20, x0, 32, 32
	lsr	w2, w20, 0
	lsr	x0, x20, 32
	fmov	s30, w0
	lsr	w1, w19, 0
	lsr	x0, x19, 32
	fmov	s31, w0
	fmov	s2, w2
	fmov	s3, s30
	fmov	s0, w1
	fmov	s1, s31
	bl	cmul
	fmov	s30, s0
	fmov	s31, s1
	str	s30, [sp, 344]
	str	s31, [sp, 348]
	ldr	s31, [sp, 344]
	fcvt	d30, s31
	ldr	s31, [sp, 348]
	fcvt	d31, s31
	fmov	d1, d31
	fmov	d0, d30
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 328
	ldr	x2, [x1]
	ldr	w1, [x1, 8]
	str	x2, [x0]
	str	w1, [x0, 8]
	fmov	s31, -2.0e+0
	str	s31, [sp, 312]
	ldr	s31, [sp, 412]
	str	s31, [sp, 316]
	fmov	s31, 4.0e+0
	str	s31, [sp, 320]
	ldr	s26, [sp, 312]
	ldr	s27, [sp, 316]
	ldr	s28, [sp, 320]
	ldr	s29, [sp, 328]
	ldr	s30, [sp, 332]
	ldr	s31, [sp, 336]
	fmov	s3, s26
	fmov	s4, s27
	fmov	s5, s28
	fmov	s0, s29
	fmov	s1, s30
	fmov	s2, s31
	bl	cross
	fmov	s29, s0
	fmov	s30, s1
	fmov	s31, s2
	str	s29, [sp, 296]
	str	s30, [sp, 300]
	str	s31, [sp, 304]
	ldr	s29, [sp, 296]
	ldr	s30, [sp, 300]
	ldr	s31, [sp, 304]
	fmov	s0, s29
	fmov	s1, s30
	fmov	s2, s31
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	pf3
	ldr	s26, [sp, 296]
	ldr	s27, [sp, 300]
	ldr	s28, [sp, 304]
	ldr	s29, [sp, 328]
	ldr	s30, [sp, 332]
	ldr	s31, [sp, 336]
	fmov	s3, s26
	fmov	s4, s27
	fmov	s5, s28
	fmov	s0, s29
	fmov	s1, s30
	fmov	s2, s31
	bl	cross
	fmov	s29, s0
	fmov	s30, s1
	fmov	s31, s2
	str	s29, [sp, 376]
	str	s30, [sp, 380]
	str	s31, [sp, 384]
	ldr	s26, [sp, 376]
	ldr	s27, [sp, 380]
	ldr	s28, [sp, 384]
	ldr	s29, [sp, 296]
	ldr	s30, [sp, 300]
	ldr	s31, [sp, 304]
	fmov	s3, s26
	fmov	s4, s27
	fmov	s5, s28
	fmov	s0, s29
	fmov	s1, s30
	fmov	s2, s31
	bl	cross
	fmov	s29, s0
	fmov	s30, s1
	fmov	s31, s2
	str	s29, [sp, 296]
	str	s30, [sp, 300]
	str	s31, [sp, 304]
	ldr	s29, [sp, 296]
	ldr	s30, [sp, 300]
	ldr	s31, [sp, 304]
	fmov	s0, s29
	fmov	s1, s30
	fmov	s2, s31
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	pf3
	str	wzr, [sp, 280]
	str	wzr, [sp, 284]
	str	wzr, [sp, 288]
	str	wzr, [sp, 292]
	adrp	x0, .LC1
	add	x1, x0, :lo12:.LC1
	add	x0, sp, 232
	ldr	q29, [x1]
	ldr	q30, [x1, 16]
	ldr	q31, [x1, 32]
	str	q29, [x0]
	str	q30, [x0, 16]
	str	q31, [x0, 32]
	str	wzr, [sp, 424]
	b	.L34
.L37:
	ldr	w1, [sp, 424]
	mov	w0, 21846
	movk	w0, 0x5555, lsl 16
	smull	x0, w1, w0
	lsr	x2, x0, 32
	asr	w0, w1, 31
	sub	w2, w2, w0
	mov	w0, w2
	lsl	w0, w0, 1
	add	w0, w0, w2
	sub	w2, w1, w0
	ldr	w0, [sp, 424]
	and	w0, w0, 1
	cmp	w0, 0
	bne	.L35
	ldr	s31, [sp, 412]
	fneg	s31, s31
	b	.L36
.L35:
	ldr	s31, [sp, 412]
.L36:
	sxtw	x0, w2
	lsl	x0, x0, 4
	add	x1, sp, 232
	add	x0, x1, x0
	ldr	s23, [x0]
	ldr	s24, [x0, 4]
	ldr	s25, [x0, 8]
	ldr	s26, [x0, 12]
	ldr	s27, [sp, 280]
	ldr	s28, [sp, 284]
	ldr	s29, [sp, 288]
	ldr	s30, [sp, 292]
	str	s31, [sp]
	fmov	s4, s23
	fmov	s5, s24
	fmov	s6, s25
	fmov	s7, s26
	fmov	s0, s27
	fmov	s1, s28
	fmov	s2, s29
	fmov	s3, s30
	bl	axpy
	fmov	s28, s0
	fmov	s29, s1
	fmov	s30, s2
	fmov	s31, s3
	str	s28, [sp, 280]
	str	s29, [sp, 284]
	str	s30, [sp, 288]
	str	s31, [sp, 292]
	add	x0, sp, 280
	mov	w2, 4
	mov	x1, x0
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	pf
	ldr	w0, [sp, 424]
	add	w0, w0, 1
	str	w0, [sp, 424]
.L34:
	ldr	w0, [sp, 424]
	cmp	w0, 5
	ble	.L37
	ldr	s26, [sp, 312]
	ldr	s27, [sp, 316]
	ldr	s28, [sp, 320]
	ldr	s29, [sp, 328]
	ldr	s30, [sp, 332]
	ldr	s31, [sp, 336]
	ldr	s25, [sp, 412]
	str	s25, [sp, 16]
	mov	x1, sp
	add	x0, sp, 296
	ldr	x2, [x0]
	ldr	w0, [x0, 8]
	str	x2, [x1]
	str	w0, [x1, 8]
	fmov	s3, s26
	fmov	s4, s27
	fmov	s5, s28
	fmov	s0, s29
	fmov	s1, s30
	fmov	s2, s31
	bl	crowd
	fmov	s31, s0
	fcvt	d31, s31
	fmov	d0, d31
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	printf
	ldr	s31, [sp, 412]
	fneg	s23, s31
	fmov	s31, 3.0e+0
	fmov	x0, d31
	bfi	x23, x0, 0, 32
	fmov	s31, 5.0e+0
	fmov	x0, d31
	bfi	x23, x0, 32, 32
	ldr	s24, [sp, 360]
	ldr	s25, [sp, 364]
	ldr	s26, [sp, 280]
	ldr	s27, [sp, 284]
	ldr	s28, [sp, 288]
	ldr	s29, [sp, 292]
	ldr	s30, [sp, 368]
	ldr	s31, [sp, 372]
	str	x23, [sp, 8]
	str	s23, [sp]
	fmov	s6, s24
	fmov	s7, s25
	fmov	s2, s26
	fmov	s3, s27
	fmov	s4, s28
	fmov	s5, s29
	fmov	s0, s30
	fmov	s1, s31
	bl	crowd2
	fmov	s31, s0
	fcvt	d31, s31
	fmov	d0, d31
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	ldr	s26, [sp, 360]
	ldr	s27, [sp, 364]
	ldr	s28, [sp, 248]
	ldr	s29, [sp, 252]
	ldr	s30, [sp, 256]
	ldr	s31, [sp, 260]
	mov	x1, -2
	fmov	s5, s26
	fmov	s6, s27
	fmov	d4, 1.5e+0
	fmov	s0, s28
	fmov	s1, s29
	fmov	s2, s30
	fmov	s3, s31
	mov	w0, 7
	bl	blend
	fmov	s28, s0
	fmov	s29, s1
	fmov	s30, s2
	fmov	s31, s3
	str	s28, [sp, 216]
	str	s29, [sp, 220]
	str	s30, [sp, 224]
	str	s31, [sp, 228]
	add	x0, sp, 216
	mov	w2, 4
	mov	x1, x0
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	pf
	adrp	x0, .LC2
	add	x1, x0, :lo12:.LC2
	add	x0, sp, 200
	ldr	x2, [x1]
	ldr	w1, [x1, 8]
	str	x2, [x0]
	str	w1, [x0, 8]
	str	wzr, [sp, 420]
	b	.L38
.L39:
	ldr	w0, [sp, 420]
	add	w0, w0, 1
	scvtf	s30, w0
	ldr	s31, [sp, 412]
	fmul	s28, s30, s31
	ldr	s29, [sp, 200]
	ldr	s30, [sp, 204]
	ldr	s31, [sp, 208]
	fmov	s3, s28
	fmov	s0, s29
	fmov	s1, s30
	fmov	s2, s31
	bl	shift
	fmov	s29, s0
	fmov	s30, s1
	fmov	s31, s2
	str	s29, [sp, 200]
	str	s30, [sp, 204]
	str	s31, [sp, 208]
	ldr	s31, [sp, 200]
	fcvt	d30, s31
	ldr	s31, [sp, 204]
	fcvt	d29, s31
	ldr	s31, [sp, 208]
	fcvt	d31, s31
	fmov	d2, d31
	fmov	d1, d29
	fmov	d0, d30
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	ldr	w0, [sp, 420]
	add	w0, w0, 1
	str	w0, [sp, 420]
.L38:
	ldr	w0, [sp, 420]
	cmp	w0, 2
	ble	.L39
	adrp	x0, .LC3
	add	x1, x0, :lo12:.LC3
	add	x0, sp, 176
	ldp	x2, x3, [x1]
	ldr	w1, [x1, 16]
	stp	x2, x3, [x0]
	str	w1, [x0, 16]
	add	x0, sp, 128
	add	x1, sp, 176
	ldp	x2, x3, [x1]
	ldr	w1, [x1, 16]
	stp	x2, x3, [x0]
	str	w1, [x0, 16]
	add	x0, sp, 128
	add	x1, sp, 392
	mov	x8, x1
	bl	twist
	add	x0, sp, 96
	add	x1, sp, 392
	ldp	x2, x3, [x1]
	ldr	w1, [x1, 16]
	stp	x2, x3, [x0]
	str	w1, [x0, 16]
	add	x0, sp, 96
	add	x1, sp, 128
	mov	x8, x1
	bl	twist
	add	x0, sp, 176
	add	x1, sp, 128
	ldp	x2, x3, [x1]
	ldr	w1, [x1, 16]
	stp	x2, x3, [x0]
	str	w1, [x0, 16]
	add	x0, sp, 176
	mov	w2, 5
	mov	x1, x0
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	pf
	fmov	s31, 2.5e+0
	str	s31, [sp, 168]
	mov	w0, 3
	str	w0, [sp, 172]
	str	wzr, [sp, 416]
	b	.L40
.L41:
	ldr	x0, [sp, 168]
	bl	fimix
	str	x0, [sp, 168]
	ldr	s31, [sp, 168]
	fcvt	d31, s31
	ldr	w0, [sp, 172]
	mov	w1, w0
	fmov	d0, d31
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	printf
	ldr	w0, [sp, 416]
	add	w0, w0, 1
	str	w0, [sp, 416]
.L40:
	ldr	w0, [sp, 416]
	cmp	w0, 2
	ble	.L41
	mov	w4, 8
	mov	w3, 20
	mov	w2, 12
	mov	w1, 12
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	ldr	x23, [sp, 80]
	add	sp, sp, 432
	ret
	.section .rodata
	.align	3
.LC0:
	.word	1065353216
	.word	1073741824
	.word	1077936128
	.align	3
.LC1:
	.word	1065353216
	.word	1073741824
	.word	1077936128
	.word	1082130432
	.word	-1098907648
	.word	1061158912
	.word	1090519040
	.word	-1048576000
	.word	1120403456
	.word	1040187392
	.word	-1069547520
	.word	1084227584
	.align	3
.LC2:
	.word	1065353216
	.word	1073741824
	.word	1077936128
	.align	3
.LC3:
	.word	1065353216
	.word	1073741824
	.word	1082130432
	.word	1090519040
	.word	1098907648
	.text

