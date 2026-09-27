	.text
	.align	2
	.p2align 5,,15
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
	.p2align 5,,15
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
	.p2align 5,,15
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
	.p2align 5,,15
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
	.p2align 5,,15
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
	.p2align 5,,15
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
	.p2align 5,,15
	.global	shift
shift:
	sub	sp, sp, #48
	fadd	s0, s0, s3
	fsub	s1, s1, s3
	fnmul	s2, s3, s2
	add	sp, sp, 48
	ret
	.align	2
	.p2align 5,,15
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
	.p2align 5,,15
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
	.text
	.align	2
	.p2align 5,,15
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
	.p2align 5,,15
.L19:
	ldr	s0, [x19], 4
	mov	x0, x21
	fcvt	d0, s0
	bl	printf
	cmp	x19, x20
	bne	.L19
	ldr	x21, [sp, 32]
.L18:
	mov	w0, 10
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 48
	b	putchar
	.section .rodata
	.align	3
.LC7:
	.string	"%s %.4f %.4f %.4f\n"
	.text
	.align	2
	.p2align 5,,15
	.global	pf3
pf3:
	fcvt	d2, s2
	fcvt	d1, s1
	fcvt	d0, s0
	sub	sp, sp, #16
	mov	x1, x0
	add	sp, sp, 16
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	b	printf
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
.LC19:
	.string	"twist"
	.align	3
.LC20:
	.string	"fimix %.4f %d\n"
	.align	3
.LC21:
	.string	"sizes %d %d %d %d\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -256]!
	adrp	x0, .LANCHOR1
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LC8
	add	x20, x20, :lo12:.LC8
	stp	d13, d14, [sp, 128]
	mov	w19, 0
	ldr	s14, [x0, :lo12:.LANCHOR1]
	fmov	s13, 1.5e+0
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	str	x27, [sp, 80]
	str	d15, [sp, 88]
	fmov	s15, -2.5e-1
	stp	d11, d12, [sp, 112]
	fmov	s12, 2.0e+0
	stp	d9, d10, [sp, 96]
.L25:
	fmov	s31, s13
	fadd	s30, s15, s15
	fmul	s15, s14, s15
	fnmsub	s13, s14, s13, s30
	mov	w1, w19
	mov	x0, x20
	add	w19, w19, 1
	fmadd	s15, s31, s12, s15
	fcvt	d0, s13
	fcvt	d1, s15
	bl	printf
	cmp	w19, 4
	bne	.L25
	movi	d1, #0
	mov	x0, -9223372036854775808
	fmov	d0, x0
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	adrp	x19, .LC7
	adrp	x26, .LANCHOR0
	add	x26, x26, :lo12:.LANCHOR0
	bl	printf
	add	x25, sp, 208
	fmov	s31, 5.0e-1
	movi	v1.2s, #0
	fmov	s0, 1.25e-1
	adrp	x0, .LC10
	fmul	s30, s14, s31
	add	x0, x0, :lo12:.LC10
	adrp	x24, .LC13
	adrp	x23, .LC5
	adrp	x21, .LC6
	mov	w27, 43691
	add	x24, x24, :lo12:.LC13
	add	x23, x23, :lo12:.LC5
	fmadd	s1, s30, s31, s1
	fmul	s0, s30, s0
	add	x20, sp, 160
	add	x21, x21, :lo12:.LC6
	mov	w22, 0
	movk	w27, 0xaaaa, lsl 16
	fcvt	d0, s0
	fcvt	d1, s1
	bl	printf
	fmov	s10, 3.0e+0
	fmov	s9, 8.0e+0
	fmov	s11, 4.0e+0
	fmov	d1, -1.0e+1
	fmsub	s9, s14, s10, s9
	add	x0, x19, :lo12:.LC7
	fadd	s11, s14, s11
	adrp	x1, .LC11
	add	x1, x1, :lo12:.LC11
	fcvt	d2, s11
	fcvt	d0, s9
	bl	printf
	fnmsub	s30, s9, s10, s11
	fmov	s29, -1.0e+1
	fmov	s31, 3.0e+1
	fmadd	s31, s11, s12, s31
	fmsub	s12, s9, s12, s29
	add	x0, x19, :lo12:.LC7
	adrp	x1, .LC12
	add	x1, x1, :lo12:.LC12
	fmul	s10, s30, s11
	fnmsub	s10, s12, s29, s10
	fmul	s12, s12, s9
	fnmsub	s12, s31, s11, s12
	fmul	s11, s31, s29
	fnmsub	s11, s30, s9, s11
	fcvt	d0, s10
	fcvt	d1, s12
	fcvt	d2, s11
	bl	printf
	fneg	s9, s14
	ldr	q31, [x26, 48]
	stp	xzr, xzr, [sp, 144]
	ldp	q30, q29, [x26, 16]
	str	q31, [x25, 32]
	stp	q30, q29, [x25]
	.p2align 5,,15
.L28:
	umull	x0, w22, w27
	tst	x22, 1
	mov	x1, x24
	ldr	q28, [sp, 144]
	lsr	x0, x0, 33
	fcsel	s31, s9, s14, eq
	add	x19, sp, 144
	add	w0, w0, w0, lsl 1
	sub	w0, w22, w0
	add	x0, x25, w0, sxtw 4
	ldr	q30, [x0]
	mov	x0, x23
	fmla	v30.4s, v28.4s, v31.s[0]
	str	q30, [sp, 144]
	bl	printf
	.p2align 5,,15
.L27:
	ldr	s0, [x19], 4
	mov	x0, x21
	fcvt	d0, s0
	bl	printf
	cmp	x20, x19
	bne	.L27
	mov	w0, 10
	add	w22, w22, 1
	bl	putchar
	cmp	w22, 6
	bne	.L28
	fsub	s10, s10, s12
	fmov	s0, -2.0e+0
	fmov	s12, 2.0e+0
	adrp	x0, .LC14
	fsub	s0, s0, s14
	add	x0, x0, :lo12:.LC14
	add	x19, sp, 176
	fadd	s10, s10, s11
	fmov	s11, 4.0e+0
	fadd	s0, s0, s11
	fmadd	s0, s0, s12, s12
	fmadd	s0, s10, s11, s0
	fmov	s10, 8.0e+0
	fmadd	s0, s14, s10, s0
	fcvt	d0, s0
	bl	printf
	fmadd	s0, s15, s12, s13
	ldr	s31, [sp, 144]
	fsub	s30, s14, s12
	ldr	s29, [sp, 156]
	mov	w0, 1132462080
	fsub	s31, s31, s29
	fmadd	s0, s31, s11, s0
	fmov	s31, 1.6e+1
	fmadd	s0, s30, s10, s0
	fmsub	s0, s14, s31, s0
	fmov	s31, w0
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	fadd	s0, s0, s31
	fcvt	d0, s0
	bl	printf
	ldp	x0, x1, [sp, 224]
	fmov	s30, 1.5e+0
	fmov	s28, 1.8e+1
	fmov	s29, 9.0e+0
	stp	x0, x1, [sp, 176]
	mov	x0, 1
.L32:
	add	x1, x19, x0, lsl 2
	ldr	s31, [x1, -4]
	add	x1, x20, x0, lsl 2
	fmul	s31, s31, s30
	tbz	x0, 0, .L29
.L47:
	fmadd	s31, s14, s29, s31
	add	x0, x0, 1
	str	s31, [x1, -4]
	add	x1, x19, x0, lsl 2
	ldr	s31, [x1, -4]
	add	x1, x20, x0, lsl 2
	fmul	s31, s31, s30
	tbnz	x0, 0, .L47
.L29:
	fadd	s31, s31, s28
	str	s31, [x1, -4]
	cmp	x0, 4
	beq	.L31
	mov	x0, 3
	b	.L32
	.p2align 2,,3
.L31:
	adrp	x1, .LC16
	mov	x0, x23
	add	x1, x1, :lo12:.LC16
	bl	printf
	.p2align 5,,15
.L33:
	ldr	s0, [x20], 4
	mov	x0, x21
	fcvt	d0, s0
	bl	printf
	cmp	x19, x20
	bne	.L33
	mov	w0, 10
	adrp	x22, .LC17
	bl	putchar
	add	x22, x22, :lo12:.LC17
	fmov	s11, 1.0e+0
	fmov	s12, 2.0e+0
	fmov	s15, 3.0e+0
	mov	w20, 0
.L34:
	add	w20, w20, 1
	mov	x0, x22
	scvtf	s13, w20
	fmul	s31, s13, s14
	fadd	s11, s11, s31
	fsub	s12, s12, s31
	fnmul	s15, s31, s15
	fcvt	d1, s12
	fcvt	d0, s11
	fcvt	d2, s15
	bl	printf
	cmp	w20, 3
	bne	.L34
	ldr	q31, [x26, 64]
	adrp	x1, .LC19
	mov	x0, x23
	add	x1, x1, :lo12:.LC19
	add	x22, sp, 196
	str	q31, [sp, 176]
	fmov	s31, 1.9e+1
	str	s31, [sp, 192]
	bl	printf
	.p2align 5,,15
.L35:
	ldr	s0, [x19], 4
	mov	x0, x21
	fcvt	d0, s0
	bl	printf
	cmp	x19, x22
	bne	.L35
	mov	w0, 10
	adrp	x21, .LC20
	bl	putchar
	add	x21, x21, :lo12:.LC20
	mov	w19, 3
	fmov	s15, 2.5e+0
.L36:
	fmov	s31, s15
	fmul	s15, s15, s13
	fcvtzs	w0, s31
	fcvt	d0, s15
	sub	w20, w20, w0
	mov	x0, x21
	mov	w1, w20
	bl	printf
	subs	w19, w19, #1
	beq	.L45
	scvtf	s13, w20
	b	.L36
	.p2align 2,,3
.L45:
	mov	w2, 12
	mov	w4, 8
	mov	w1, w2
	mov	w3, 20
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	printf
	ldr	x27, [sp, 80]
	mov	w0, 0
	ldr	d15, [sp, 88]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	d9, d10, [sp, 96]
	ldp	d11, d12, [sp, 112]
	ldp	d13, d14, [sp, 128]
	ldp	x29, x30, [sp], 256
	ret
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
.LC18:
	.word	-1049886720
	.word	-1062207488
	.word	1065353216
	.word	1090519040
	.data
	.align	2
	.LANCHOR1:
knob:
	.word	1056964608

