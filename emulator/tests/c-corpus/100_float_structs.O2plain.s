	.text
	.section .rodata
	.align	3
.LC0:
	.string	"v2 %.9g %.9g\n"
	.align	3
.LC1:
	.string	"v3 %.9g %.9g %.9g\n"
	.align	3
.LC2:
	.string	"d4 %.17g %.17g %.17g %.17g\n"
	.align	3
.LC4:
	.string	"f5 %.9g %.9g %.9g %.9g %.9g\n"
	.align	3
.LC6:
	.string	"fi %.9g %d fd %.9g %.17g\n"
	.align	3
.LC7:
	.string	"nv %.9g %.9g %.9g\n"
	.align	3
.LC8:
	.string	"spill %.17g\n"
	.align	3
.LC9:
	.string	"backfill %.17g\n"
	.align	3
.LC10:
	.string	"range %.17g %.17g %ld\n"
	.align	3
.LC11:
	.string	"bf %.9g size %zu %zu %zu %zu off %zu %zu\n"
	.align	3
.LC12:
	.string	"p%d %.9g %.9g %.9g %.9g\n"
	.align	3
.LC13:
	.string	"fu %08x %02x %02x %02x %02x\n"
	.align	3
.LC14:
	.string	"fu %.9g\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -272]!
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	add	x20, sp, 208
	stp	x21, x22, [sp, 32]
	adrp	x21, .LANCHOR0
	add	x19, x21, :lo12:.LANCHOR0
	stp	d9, d10, [sp, 48]
	stp	d11, d12, [sp, 64]
	stp	d13, d14, [sp, 80]
	str	d15, [sp, 96]
	ldr	s15, [x21, :lo12:.LANCHOR0]
	ldr	s9, [x19, 4]
	ldr	s0, [x19, 8]
	ldr	s1, [x19, 12]
	fadd	s0, s15, s0
	fadd	s1, s9, s1
	fcvt	d0, s0
	fcvt	d1, s1
	bl	printf
	ldr	s28, [x21, :lo12:.LANCHOR0]
	adrp	x0, .LC1
	ldr	s30, [x19, 4]
	add	x0, x0, :lo12:.LC1
	ldr	s26, [x19, 8]
	ldr	s27, [x19, 12]
	ldr	s29, [x19, 16]
	ldr	s31, [x19, 20]
	fmul	s0, s26, s29
	fnmsub	s0, s30, s31, s0
	fmul	s30, s30, s27
	fmul	s31, s28, s31
	fnmsub	s2, s28, s29, s30
	fnmsub	s1, s26, s27, s31
	fcvt	d0, s0
	fcvt	d2, s2
	fcvt	d1, s1
	bl	printf
	ldr	s14, [x21, :lo12:.LANCHOR0]
	mov	x0, 6148914691236517205
	ldr	s11, [x19, 4]
	movk	x0, 0x3fd5, lsl 48
	ldr	s12, [x19, 8]
	fmov	d0, x0
	ldr	s13, [x19, 16]
	fcvt	d14, s14
	fcvt	d11, s11
	adrp	x0, .LC2
	fcvt	d12, s12
	add	x0, x0, :lo12:.LC2
	fcvt	d13, s13
	fmul	d1, d11, d0
	fmul	d2, d12, d0
	fmul	d10, d13, d0
	fmul	d0, d14, d0
	fmov	d3, d10
	bl	printf
	ldr	s4, [x21, :lo12:.LANCHOR0]
	adrp	x0, .LANCHOR1
	ldr	s28, [x19, 4]
	ldr	s29, [x19, 8]
	ldr	s30, [x19, 12]
	fadd	s4, s4, s4
	ldr	s31, [x19, 16]
	stp	s28, s29, [sp, 212]
	stp	s30, s31, [sp, 220]
	fcvt	d4, s4
	ldr	q0, [sp, 212]
	ldr	q31, [x0, :lo12:.LANCHOR1]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	tbl	v0.16b, {v0.16b}, v31.16b
	fadd	v0.4s, v0.4s, v0.4s
	dup	s3, v0.s[3]
	dup	s2, v0.s[2]
	dup	s1, v0.s[1]
	fcvt	d0, s0
	fcvt	d3, s3
	fcvt	d2, s2
	fcvt	d1, s1
	bl	printf
	ldr	s0, [x19, 8]
	adrp	x0, .LC5
	ldr	s31, [x19, 4]
	ldr	s2, [x19, 16]
	ldr	d1, [x0, :lo12:.LC5]
	adrp	x0, .LC6
	fmul	s0, s0, s31
	fcvtzs	w1, s31
	fcvt	d2, s2
	add	x0, x0, :lo12:.LC6
	fcvt	d0, s0
	sub	w1, w1, #7
	bl	printf
	ldr	s0, [x19, 4]
	adrp	x0, .LC7
	ldr	s1, [x19, 8]
	add	x0, x0, :lo12:.LC7
	ldr	s2, [x21, :lo12:.LANCHOR0]
	fmul	s31, s1, s1
	fmadd	s31, s0, s0, s31
	fmadd	s31, s2, s2, s31
	fdiv	s2, s2, s31
	fdiv	s1, s1, s31
	fdiv	s0, s0, s31
	fcvt	d2, s2
	fcvt	d1, s1
	fcvt	d0, s0
	bl	printf
	fmul	s31, s15, s9
	fmov	d30, 2.0e+0
	fmov	d0, 5.0e-1
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	fmadd	d10, d10, d30, d14
	fcvt	d31, s31
	fadd	d31, d31, d10
	fadd	d0, d31, d0
	bl	printf
	mov	x0, 140737488355328
	fmov	d31, 6.0e+0
	movk	x0, 0x404b, lsl 48
	fmov	d29, x0
	fmadd	d31, d14, d31, d29
	fmov	d29, 7.0e+0
	ldr	s30, [x19, 12]
	fmov	d0, 1.0e+1
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	fmadd	d31, d11, d29, d31
	fmov	d29, 8.0e+0
	fcvt	d30, s30
	fmadd	d31, d12, d29, d31
	fmov	d29, 9.0e+0
	fmadd	d31, d13, d29, d31
	fmadd	d0, d30, d0, d31
	bl	printf
	mov	w4, 43691
	mov	x2, x20
	mov	x3, x20
	mov	w1, 0
	movk	w4, 0xaaaa, lsl 16
	fmov	d31, 1.0e+0
	.align 5
.L2:
	umull	x0, w1, w4
	lsr	x0, x0, 34
	add	w0, w0, w0, lsl 1
	sub	w0, w1, w0, lsl 1
	add	w1, w1, 1
	scvtf	s29, w1
	ldr	s30, [x19, w0, sxtw 2]
	fmul	s29, s29, s30
	fcvt	d29, s29
	fsub	d29, d29, d31
	str	d29, [x3], 8
	cmp	w1, 7
	bne	.L2
	ldr	d0, [sp, 208]
	add	x0, x20, 48
	fmov	d1, d0
	.align 5
.L3:
	ldr	d31, [x2, 8]!
	fcmpe	d31, d0
	fcsel	d0, d31, d0, mi
	fcmpe	d31, d1
	fcsel	d1, d31, d1, gt
	cmp	x0, x2
	bne	.L3
	mov	x1, 7
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldrb	w0, [sp, 112]
	mov	w1, 5
	ldr	s31, [x21, :lo12:.LANCHOR0]
	movi	v0.2s, #0
	add	x22, sp, 160
	bfi	w0, w1, 0, 3
	strb	w0, [sp, 112]
	ldrb	w0, [sp, 120]
	mov	w1, 3
	str	s31, [sp, 116]
	orr	w0, w0, 1
	strb	w0, [sp, 120]
	ldrb	w0, [sp, 124]
	ldr	s31, [x19, 8]
	bfi	w0, w1, 0, 3
	strb	w0, [sp, 124]
	ldrb	w0, [sp, 132]
	mov	w1, 1
	str	s31, [sp, 128]
	and	w0, w0, -2
	strb	w0, [sp, 132]
	ldrb	w0, [sp, 136]
	ldr	s31, [x19, 12]
	orr	w0, w0, 7
	strb	w0, [sp, 136]
	ldrb	w0, [sp, 144]
	str	s31, [sp, 140]
	orr	w0, w0, 1
	strb	w0, [sp, 144]
	ldrb	w0, [sp, 148]
	ldr	s31, [x19, 4]
	bfi	w0, w1, 0, 3
	strb	w0, [sp, 148]
	ldrb	w0, [sp, 156]
	str	s31, [sp, 152]
	orr	w0, w0, w1
	add	x1, sp, 112
	strb	w0, [sp, 156]
	b	.L6
	.align 2
.L19:
	ldr	w0, [x1]
	add	x1, x1, 12
	ldr	s30, [x1, -8]
	and	w0, w0, 7
	ucvtf	s31, w0
	fmul	s31, s31, s30
	fadd	s0, s0, s31
	cmp	x1, x22
	beq	.L18
.L6:
	ldrb	w0, [x1, 8]
	tbnz	x0, 0, .L19
	ldr	s31, [x1, 4]
	add	x1, x1, 12
	fneg	s31, s31
	fadd	s0, s0, s31
	cmp	x1, x22
	bne	.L6
.L18:
	fcvt	d0, s0
	mov	x6, 8
	mov	x1, 12
	mov	x5, x6
	mov	x4, 20
	mov	x3, 24
	mov	x2, 16
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	ldr	s31, [x19, 8]
	mov	x0, 1065353216
	movk	x0, 0x4000, lsl 48
	str	x0, [sp, 176]
	mov	x0, 4728779608739020800
	str	x0, [sp, 200]
	str	s31, [sp, 168]
	adrp	x0, .LC19
	ldr	s31, [x19, 8]
	mov	w1, 10
	ldr	d28, [x0, :lo12:.LC19]
	mov	w0, 57672
	movk	w0, 0x3efa, lsl 16
	fmov	s29, w0
	str	s31, [sp, 172]
	ldr	s31, [x21, :lo12:.LANCHOR0]
	str	xzr, [sp, 160]
	str	wzr, [sp, 188]
	fneg	s31, s31
	str	wzr, [sp, 196]
	str	s31, [sp, 184]
	ldr	s31, [x19, 16]
	str	s31, [sp, 192]
	.align 5
.L7:
	mov	x21, x22
	mov	x0, x22
.L8:
	ldp	d30, d31, [x0]
	add	x0, x0, 16
	fmla	v30.2s, v31.2s, v28.2s
	dup	s31, v31.s[1]
	fsub	s31, s31, s29
	str	d30, [x0, -16]
	str	s31, [x0, -4]
	cmp	x20, x0
	bne	.L8
	subs	w1, w1, #1
	bne	.L7
	adrp	x22, .LC12
	add	x22, x22, :lo12:.LC12
	mov	w20, 0
.L9:
	ldp	s2, s3, [x21, 8]
	mov	w1, w20
	ldp	s0, s1, [x21], 16
	mov	x0, x22
	fcvt	d3, s3
	fcvt	d2, s2
	add	w20, w20, 1
	fcvt	d1, s1
	fcvt	d0, s0
	bl	printf
	cmp	w20, 3
	bne	.L9
	ldr	s31, [x19, 4]
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	fmov	w19, s31
	lsr	w5, w19, 24
	ubfx	x4, x19, 16, 8
	ubfx	x3, x19, 8, 8
	and	w2, w19, 255
	mov	w1, w19
	bl	printf
	eor	w0, w19, -2147483648
	fmov	s0, w0
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	fcvt	d0, s0
	bl	printf
	ldr	d15, [sp, 96]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	d9, d10, [sp, 48]
	ldp	d11, d12, [sp, 64]
	ldp	d13, d14, [sp, 80]
	ldp	x29, x30, [sp], 272
	ret
	.section .rodata
	.align	4
	.LANCHOR1:
.LC3:
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
.LC5:
	.word	-1610612736
	.word	1069697316
.LC19:
	.word	1028443341
	.word	1028443341
	.data
	.align	4
	.LANCHOR0:
seed:
	.word	1036831949
	.word	-1071644672
	.word	1081081856
	.word	981668463
	.word	1178658486
	.word	-2147483648

