	.text
	.align	2
	.align 5
	.global	cmul
cmul:
	fmov	w1, s1
	fmov	x0, d0
	fmov	w2, s3
	bfi	x0, x1, 32, 32
	fmov	x1, d2
	bfi	x1, x2, 32, 32
	sbfx	x2, x0, 0, 32
	lsr	x0, x0, 32
	fmov	s31, w0
	sbfx	x0, x1, 0, 32
	lsr	x1, x1, 32
	fmov	s30, w1
	fmov	d27, x0
	fmov	d28, x2
	mov	x0, 0
	fmul	s29, s31, s30
	fmul	s31, s31, s27
	fnmsub	s29, s28, s27, s29
	fmadd	s31, s28, s30, s31
	fmov	x1, d29
	bfi	x0, x1, 0, 32
	fmov	x1, d31
	bfi	x0, x1, 32, 32
	lsr	w1, w0, 0
	lsr	x0, x0, 32
	fmov	s0, w1
	fmov	s1, w0
	ret
	.align	2
	.align 5
	.global	cross
cross:
	fmov	s31, s0
	fmul	s30, s1, s3
	fmul	s0, s2, s4
	sub	sp, sp, #64
	fnmsub	s0, s1, s5, s0
	add	sp, sp, 64
	fmul	s29, s31, s5
	fnmsub	s1, s2, s3, s29
	fnmsub	s2, s31, s4, s30
	ret
	.align	2
	.align 5
	.global	axpy
axpy:
	fmov	w2, s0
	mov	x1, 0
	mov	x0, 0
	sub	sp, sp, #32
	bfi	x1, x2, 0, 32
	fmov	w2, s1
	bfi	x1, x2, 32, 32
	fmov	w2, s2
	bfi	x0, x2, 0, 32
	fmov	w2, s3
	bfi	x0, x2, 32, 32
	fmov	w2, s4
	stp	x1, x0, [sp]
	mov	x1, 0
	mov	x0, 0
	bfi	x1, x2, 0, 32
	fmov	w2, s5
	bfi	x1, x2, 32, 32
	fmov	w2, s6
	bfi	x0, x2, 0, 32
	fmov	w2, s7
	bfi	x0, x2, 32, 32
	stp	x1, x0, [sp, 16]
	add	x0, sp, 32
	ldp	q29, q30, [sp]
	ld1r	{v31.4s}, [x0]
	add	sp, sp, 32
	fmla	v30.4s, v31.4s, v29.4s
	umov	x0, v30.d[0]
	umov	x1, v30.d[1]
	fmov	s0, s30
	lsr	x3, x0, 32
	fmov	s2, w1
	lsr	x0, x1, 32
	fmov	s1, w3
	fmov	s3, w0
	ret
	.align	2
	.align 5
	.global	crowd
crowd:
	sub	sp, sp, #32
	fsub	s3, s3, s4
	fsub	s0, s0, s1
	ldp	s31, s30, [sp, 32]
	fadd	s3, s3, s5
	fadd	s0, s0, s2
	fsub	s31, s31, s30
	ldr	s30, [sp, 40]
	fadd	s31, s31, s30
	fmov	s30, 2.0e+0
	fmadd	s2, s3, s30, s0
	fmov	s30, 4.0e+0
	ldr	s0, [sp, 48]
	add	sp, sp, 32
	fmadd	s2, s31, s30, s2
	fmov	s31, 8.0e+0
	fmadd	s0, s0, s31, s2
	ret
	.align	2
	.align 5
	.global	crowd2
crowd2:
	fmov	w3, s7
	fmov	x2, d6
	fmov	w1, s1
	fmov	x0, d0
	fmov	s28, 2.0e+0
	movi	v0.2s, 0x42, lsl 24
	bfi	x2, x3, 32, 32
	ldr	x3, [sp, 8]
	fmov	d31, x3
	bfi	x0, x1, 32, 32
	fmov	w1, s2
	ushr	d31, d31, 32
	sbfx	x4, x3, 0, 32
	fmov	d30, x4
	sbfx	x3, x2, 0, 32
	fmov	d29, x3
	sxtw	x1, w1
	fadd	s30, s30, s31
	fmov	d31, x2
	ushr	d31, d31, 32
	fsub	s29, s29, s31
	fmov	d31, x1
	fsub	s5, s31, s5
	fmov	d31, x0
	sbfx	x0, x0, 0, 32
	ushr	d27, d31, 32
	fmov	d31, x0
	fmadd	s31, s27, s28, s31
	fmov	s28, 4.0e+0
	fmadd	s31, s5, s28, s31
	fmov	s28, 8.0e+0
	fmadd	s31, s29, s28, s31
	ldr	s28, [sp]
	fmov	s29, 1.6e+1
	fmadd	s31, s28, s29, s31
	fmadd	s0, s30, s0, s31
	ret
	.align	2
	.align 5
	.global	blend
blend:
	fmov	w4, s0
	mov	x3, 0
	mov	x2, 0
	sub	sp, sp, #16
	movi	v29.2d, 0xffffffff00000000
	sxtw	x0, w0
	fcvt	s4, d4
	sub	x0, x0, x1
	bfi	x3, x4, 0, 32
	fmov	w4, s1
	scvtf	s28, x0
	bfi	x3, x4, 32, 32
	fmov	w4, s2
	bfi	x2, x4, 0, 32
	fmov	w4, s3
	bfi	x2, x4, 32, 32
	stp	x3, x2, [sp]
	fmov	w3, s6
	fmov	x2, d5
	bfi	x2, x3, 32, 32
	sbfx	x3, x2, 0, 32
	lsr	x2, x2, 32
	dup	v30.4s, w3
	dup	v31.4s, w2
	bit	v30.16b, v31.16b, v29.16b
	ldr	q31, [sp]
	add	sp, sp, 16
	fmul	v31.4s, v31.4s, v4.s[0]
	fmla	v31.4s, v30.4s, v28.s[0]
	umov	x0, v31.d[0]
	umov	x1, v31.d[1]
	fmov	s0, s31
	lsr	x3, x0, 32
	fmov	s2, w1
	lsr	x0, x1, 32
	fmov	s1, w3
	fmov	s3, w0
	ret
	.align	2
	.align 5
	.global	shift
shift:
	sub	sp, sp, #48
	fadd	s0, s0, s3
	fsub	s1, s1, s3
	fnmul	s2, s3, s2
	add	sp, sp, 48
	ret
	.align	2
	.align 5
	.global	twist
twist:
	adrp	x1, .LANCHOR0
	ldr	s27, [x0, 16]
	fmov	v28.4s, 5.0e-1
	ldr	s31, [x0]
	ldr	q0, [x0, 4]
	sub	sp, sp, #32
	ldr	q29, [x1, :lo12:.LANCHOR0]
	fmsub	s31, s27, s28, s31
	ldr	q30, [x0]
	tbl	v29.16b, {v0.16b}, v29.16b
	fmls	v29.4s, v30.4s, v28.4s
	str	s31, [sp, 16]
	ldr	w0, [sp, 16]
	str	w0, [x8, 16]
	str	q29, [x8]
	add	sp, sp, 32
	ret
	.align	2
	.align 5
	.global	fimix
fimix:
	sbfx	x1, x0, 0, 32
	fmov	d31, x1
	asr	x1, x0, 32
	mov	x0, 0
	scvtf	s30, w1
	fmul	s30, s30, s31
	fmov	x2, d30
	bfi	x0, x2, 0, 32
	fcvtzs	w2, s31
	sub	w1, w1, w2
	bfi	x0, x1, 32, 32
	ret
	.section .rodata
	.align	3
.LC5:
	.string	"%s"
	.align	3
.LC6:
	.string	" %.4f"
	.align	3
.LC7:
	.string	"\n"
	.text
	.align	2
	.align 5
	.global	pf
pf:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x1
	mov	w20, w2
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	cmp	w20, 0
	ble	.L18
	add	x20, x19, w20, uxtw 2
	str	x21, [sp, 32]
	adrp	x21, .LC6
	add	x21, x21, :lo12:.LC6
	.align 5
.L19:
	ldr	s0, [x19], 4
	mov	x0, x21
	fcvt	d0, s0
	bl	printf
	cmp	x19, x20
	bne	.L19
	ldr	x21, [sp, 32]
.L18:
	adrp	x0, .LC7
	ldp	x19, x20, [sp, 16]
	add	x0, x0, :lo12:.LC7
	ldp	x29, x30, [sp], 48
	b	printf
	.section .rodata
	.align	3
.LC8:
	.string	"%s %.4f %.4f %.4f\n"
	.text
	.align	2
	.align 5
	.global	pf3
pf3:
	fcvt	d2, s2
	fcvt	d1, s1
	fcvt	d0, s0
	sub	sp, sp, #16
	mov	x1, x0
	add	sp, sp, 16
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	b	printf
	.section .rodata
	.align	3
.LC9:
	.string	"cmul %d: %.6f %.6f\n"
	.align	3
.LC10:
	.string	"signed zeros %.1f %.1f\n"
	.align	3
.LC11:
	.string	"ties %.4f %.2f\n"
	.align	3
.LC13:
	.string	"cross"
	.align	3
.LC14:
	.string	"cross2"
	.align	3
.LC15:
	.string	"axpy"
	.align	3
.LC16:
	.string	"crowd %.4f\n"
	.align	3
.LC17:
	.string	"crowd2 %.4f\n"
	.align	3
.LC18:
	.string	"blend"
	.align	3
.LC19:
	.string	"shift %.4f %.4f %.4f\n"
	.align	3
.LC20:
	.string	"twist"
	.align	3
.LC21:
	.string	"fimix %.4f %d\n"
	.align	3
.LC22:
	.string	"sizes %d %d %d %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #384
	adrp	x0, .LANCHOR1
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	stp	d12, d13, [sp, 112]
	ldr	s13, [x0, :lo12:.LANCHOR1]
	stp	x21, x22, [sp, 64]
	mov	x21, 0
	fmov	w0, s13
	stp	x19, x20, [sp, 48]
	adrp	x20, .LC9
	add	x20, x20, :lo12:.LC9
	stp	x23, x24, [sp, 80]
	mov	w19, 0
	bfi	x21, x0, 0, 32
	mov	x0, 1073741824
	stp	x25, x26, [sp, 96]
	bfi	x21, x0, 32, 32
	stp	d14, d15, [sp, 128]
	fmov	s14, 1.5e+0
	lsr	x23, x21, 32
	lsr	w22, w21, 0
	fmov	s15, -2.5e-1
.L25:
	fmov	w0, s14
	fmov	d2, x22
	fmov	s3, w23
	bfi	x24, x0, 0, 32
	fmov	w0, s15
	bfi	x24, x0, 32, 32
	lsr	w0, w24, 0
	lsr	x24, x24, 32
	fmov	s0, w0
	fmov	s1, w24
	bl	cmul
	fmov	w0, s1
	fmov	x24, d0
	mov	w1, w19
	add	w19, w19, 1
	bfi	x24, x0, 32, 32
	sbfx	x0, x24, 0, 32
	fmov	d14, x0
	lsr	x0, x24, 32
	fmov	s15, w0
	fcvt	d0, s14
	mov	x0, x20
	fcvt	d1, s15
	bl	printf
	cmp	w19, 4
	bne	.L25
	movi	v3.2s, #0
	mov	x0, 2147483648
	fmov	s2, 1.0e+0
	fmov	s0, w0
	adrp	x20, .LANCHOR0
	add	x20, x20, :lo12:.LANCHOR0
	add	x26, sp, 336
	adrp	x19, .LC15
	fmov	s1, s3
	mov	w22, 43691
	add	x19, x19, :lo12:.LC15
	mov	w25, 0
	movk	w22, 0xaaaa, lsl 16
	bl	cmul
	fmov	w1, s1
	fmov	x0, d0
	bfi	x0, x1, 32, 32
	fmov	d31, x0
	ushr	d1, d31, 32
	sbfx	x0, x0, 0, 32
	fmov	d0, x0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	fcvt	d0, s0
	fcvt	d1, s1
	bl	printf
	fmov	s1, 5.0e-1
	mov	x0, 0
	fmov	s0, 1.25e-1
	fmul	s31, s13, s1
	fmov	x1, d31
	bfi	x0, x1, 0, 32
	mov	x1, 0
	bfi	x0, x1, 32, 32
	lsr	w1, w0, 0
	lsr	x0, x0, 32
	fmov	s2, w1
	fmov	s3, w0
	bl	cmul
	fmov	w1, s1
	fmov	x0, d0
	bfi	x0, x1, 32, 32
	fmov	d31, x0
	ushr	d1, d31, 32
	sbfx	x0, x0, 0, 32
	fmov	d0, x0
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	fcvt	d0, s0
	fcvt	d1, s1
	bl	printf
	fmov	s4, s13
	ldr	d31, [x20, 16]
	fmov	s2, 3.0e+0
	fmov	s3, -2.0e+0
	fmov	s5, 4.0e+0
	fmov	s0, 1.0e+0
	fmov	s1, 2.0e+0
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	str	d31, [sp, 176]
	str	s2, [sp, 184]
	stp	s3, s13, [sp, 192]
	str	s5, [sp, 200]
	bl	cross
	stp	s0, s1, [sp, 208]
	str	s2, [sp, 216]
	bl	pf3
	ldp	s26, s27, [sp, 208]
	adrp	x0, .LC14
	ldr	s28, [sp, 216]
	add	x0, x0, :lo12:.LC14
	ldp	s0, s1, [sp, 176]
	fmov	s3, s26
	fmov	s4, s27
	fmov	s5, s28
	ldr	s2, [sp, 184]
	bl	cross
	fmov	s3, s0
	fmov	s4, s1
	fmov	s5, s2
	fmov	s0, s26
	fmov	s1, s27
	fmov	s2, s28
	stp	s3, s4, [sp, 240]
	str	s5, [sp, 248]
	bl	cross
	stp	s0, s1, [sp, 208]
	str	s2, [sp, 216]
	bl	pf3
	ldr	q30, [x20, 24]
	fneg	s15, s13
	ldr	q29, [x20, 40]
	stp	xzr, xzr, [sp, 256]
	ldr	q31, [x20, 56]
	stp	q30, q29, [x26]
	str	q31, [x26, 32]
	.align 5
.L28:
	umull	x0, w25, w22
	lsr	x0, x0, 33
	add	w0, w0, w0, lsl 1
	sub	w0, w25, w0
	sbfiz	x0, x0, 4, 32
	add	x1, x26, x0
	ldr	s4, [x26, x0]
	ldr	s7, [x1, 12]
	ldp	s5, s6, [x1, 4]
	tbz	x25, 0, .L26
	add	x7, sp, 264
	add	x8, sp, 264
	add	w25, w25, 1
	ldp	s0, s1, [x7, -8]
	ldp	s2, s3, [x7]
	str	s13, [sp]
	bl	axpy
	stp	s0, s1, [x8, -8]
	add	x1, sp, 256
	mov	x0, x19
	mov	w2, 4
	stp	s2, s3, [x8]
	bl	pf
	cmp	w25, 6
	bne	.L28
	ldr	x0, [sp, 208]
	str	x0, [sp]
	ldp	s3, s4, [sp, 192]
	str	s13, [sp, 16]
	ldp	s0, s1, [sp, 176]
	mov	w19, 0
	ldr	s2, [sp, 184]
	ldr	s5, [sp, 200]
	ldr	w0, [sp, 216]
	str	w0, [sp, 8]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	crowd
	fcvt	d0, s0
	bl	printf
	add	x4, sp, 264
	lsr	w1, w21, 0
	lsr	w0, w24, 0
	mov	x2, 1077936128
	movk	x2, 0x40a0, lsl 48
	fmov	s6, w1
	ldp	s4, s5, [x4]
	fmov	s7, w23
	ldp	s2, s3, [x4, -8]
	fmov	s0, w0
	lsr	x24, x24, 32
	fmov	s1, w24
	str	x2, [sp, 8]
	lsr	w21, w21, 0
	str	s15, [sp]
	bl	crowd2
	fcvt	d0, s0
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	add	x5, sp, 360
	add	x6, sp, 280
	fmov	s5, w21
	fmov	s6, w23
	fmov	d4, 1.5e+0
	mov	x1, -2
	ldp	s0, s1, [x5, -8]
	mov	w0, 7
	ldp	s2, s3, [x5]
	adrp	x21, .LC19
	add	x21, x21, :lo12:.LC19
	bl	blend
	stp	s0, s1, [x6, -8]
	add	x1, sp, 272
	mov	w2, 4
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	stp	s2, s3, [x6]
	bl	pf
	fmov	s12, 1.0e+0
	fmov	s14, 2.0e+0
	fmov	s15, 3.0e+0
.L29:
	add	w19, w19, 1
	fmov	s0, s12
	fmov	s1, s14
	fmov	s2, s15
	scvtf	s3, w19
	mov	x0, x21
	fmul	s3, s3, s13
	bl	shift
	fmov	s12, s0
	fmov	s14, s1
	fmov	s15, s2
	fcvt	d1, s1
	fcvt	d2, s2
	fcvt	d0, s0
	bl	printf
	cmp	w19, 3
	bne	.L29
	add	x8, sp, 312
	ldr	w0, [x20, 88]
	ldp	x2, x3, [x20, 72]
	stp	x2, x3, [sp, 144]
	adrp	x21, .LC21
	str	w0, [sp, 160]
	add	x0, sp, 144
	bl	twist
	add	x21, x21, :lo12:.LC21
	ldp	x2, x3, [x8]
	mov	w20, w19
	ldr	w0, [x8, 16]
	add	x8, sp, 288
	stp	x2, x3, [sp, 144]
	mov	w2, 5
	str	w0, [sp, 160]
	add	x0, sp, 144
	bl	twist
	mov	x1, x8
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	pf
	fmov	s15, 2.5e+0
.L30:
	fmov	w0, s15
	orr	x0, x0, x19, lsl 32
	bl	fimix
	sbfx	x1, x0, 0, 32
	fmov	d15, x1
	asr	x1, x0, 32
	mov	x0, x21
	fcvt	d0, s15
	mov	w19, w1
	bl	printf
	subs	w20, w20, #1
	bne	.L30
	mov	w2, 12
	mov	w4, 8
	mov	w1, w2
	mov	w3, 20
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	printf
	ldp	x29, x30, [sp, 32]
	mov	w0, 0
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	ldp	x23, x24, [sp, 80]
	ldp	x25, x26, [sp, 96]
	ldp	d12, d13, [sp, 112]
	ldp	d14, d15, [sp, 128]
	add	sp, sp, 384
	ret
	.align 2
.L26:
	add	x0, sp, 264
	add	w25, w25, 1
	ldp	s0, s1, [x0, -8]
	ldp	s2, s3, [x0]
	str	s15, [sp]
	bl	axpy
	add	x3, sp, 264
	add	x1, sp, 256
	mov	x0, x19
	mov	w2, 4
	stp	s0, s1, [x3, -8]
	stp	s2, s3, [x3]
	bl	pf
	b	.L28
	.global	knob
	.section .rodata
	.align	4
	.LANCHOR0:
.LC4:
	.byte	12
	.byte	13
	.byte	14
	.byte	15
	.byte	8
	.byte	9
	.byte	10
	.byte	11
	.byte	4
	.byte	5
	.byte	6
	.byte	7
	.byte	0
	.byte	1
	.byte	2
	.byte	3
.LC12:
	.word	1065353216
	.word	1073741824
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
.LC3:
	.word	1065353216
	.word	1073741824
	.word	1082130432
	.word	1090519040
	.word	1098907648
	.data
	.align	2
	.LANCHOR1:
knob:
	.word	1056964608

