	.text
	.align	2
	.align 5
v2_add:
	fmov	w0, s1
	ins	v0.s[1], w0
	fmov	w0, s3
	ins	v2.s[1], w0
	fadd	v0.2s, v0.2s, v2.2s
	fmov	x0, d0
	lsr	x0, x0, 32
	fmov	s1, w0
	ret
	.align	2
	.align 5
v3_cross:
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
f5_rev:
	adrp	x1, .LANCHOR0
	ldr	s31, [x0]
	ldr	q0, [x0, 4]
	sub	sp, sp, #32
	ldr	q30, [x1, :lo12:.LANCHOR0]
	fadd	s31, s31, s31
	tbl	v30.16b, {v0.16b}, v30.16b
	str	s31, [sp, 16]
	ldr	w0, [sp, 16]
	str	w0, [x8, 16]
	fadd	v30.4s, v30.4s, v30.4s
	str	q30, [x8]
	add	sp, sp, 32
	ret
	.align	2
	.align 5
nv_norm:
	fmul	s31, s1, s1
	sub	sp, sp, #48
	fmadd	s31, s0, s0, s31
	add	sp, sp, 48
	fmadd	s31, s2, s2, s31
	fdiv	s0, s0, s31
	fdiv	s1, s1, s31
	fdiv	s2, s2, s31
	ret
	.align	2
	.align 5
step__constprop__0:
	fmov	w2, s0
	mov	x0, 0
	mov	x1, 0
	bfi	x0, x2, 0, 32
	fmov	w2, s1
	bfi	x0, x2, 32, 32
	fmov	w2, s2
	bfi	x1, x2, 0, 32
	fmov	w2, s3
	bfi	x1, x2, 32, 32
	lsr	x2, x0, 32
	sbfx	x0, x0, 0, 32
	fmov	d31, x0
	mov	w0, 52429
	fmov	s29, w2
	movk	w0, 0x3d4c, lsl 16
	sbfx	x2, x1, 0, 32
	fmov	s28, w0
	fmov	d27, x2
	lsr	x1, x1, 32
	fmov	s30, w1
	fmadd	s31, s27, s28, s31
	mov	w0, 57672
	fmadd	s29, s30, s28, s29
	movk	w0, 0x3efa, lsl 16
	fmov	s28, w0
	fsub	s30, s30, s28
	uzp1	v31.2s, v31.2s, v27.2s
	uzp1	v30.2s, v29.2s, v30.2s
	zip1	v31.4s, v31.4s, v30.4s
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
bf_sum__constprop__0:
	movi	v0.2s, #0
	add	x2, x0, 48
	.align 5
.L13:
	ldrb	w1, [x0, 8]
	ldr	s31, [x0, 4]
	fneg	s30, s31
	tbz	x1, 0, .L12
	ldr	w1, [x0]
	and	w1, w1, 7
	ucvtf	s29, w1
	fmul	s30, s29, s31
.L12:
	add	x0, x0, 12
	fadd	s0, s0, s30
	cmp	x0, x2
	bne	.L13
	ret
	.align	2
	.align 5
range__constprop__0:
	mov	x1, x0
	add	x0, x0, 56
	ldr	d31, [x1], 8
	fmov	d30, d31
	.align 5
.L17:
	ldr	d29, [x1], 8
	fcmpe	d29, d31
	fcsel	d31, d29, d31, mi
	fcmpe	d29, d30
	fcsel	d30, d29, d30, gt
	cmp	x1, x0
	bne	.L17
	mov	x0, 7
	stp	d31, d30, [x8]
	str	x0, [x8, 16]
	ret
	.align	2
	.align 5
no_backfill__constprop__0:
	mov	x0, 140737488355328
	fmov	d31, 6.0e+0
	movk	x0, 0x404b, lsl 48
	fmov	d30, x0
	fmadd	d31, d0, d31, d30
	fmov	d30, 7.0e+0
	fmov	d0, 1.0e+1
	sub	sp, sp, #32
	add	sp, sp, 32
	fmadd	d31, d1, d30, d31
	fmov	d30, 8.0e+0
	fmadd	d31, d2, d30, d31
	fmov	d30, 9.0e+0
	fmadd	d31, d3, d30, d31
	fmadd	d0, d4, d0, d31
	ret
	.align	2
	.align 5
fi_mix__constprop__0:
	sxtw	x0, w0
	fmov	d31, x0
	mov	x0, 0
	fmul	s31, s31, s0
	fmov	x1, d31
	bfi	x0, x1, 0, 32
	fcvtzs	w1, s0
	sub	w1, w1, #7
	bfi	x0, x1, 32, 32
	ret
	.align	2
	.align 5
d4_scale__constprop__0:
	sub	sp, sp, #96
	adrp	x0, .LC1
	ldr	q30, [x0, :lo12:.LC1]
	stp	d0, d1, [sp, 32]
	stp	d2, d3, [sp, 48]
	ldp	q29, q31, [sp, 32]
	fmul	v31.2d, v31.2d, v30.2d
	fmul	v29.2d, v29.2d, v30.2d
	stp	q29, q31, [sp, 64]
	ldp	d0, d1, [sp, 64]
	ldp	d2, d3, [sp, 80]
	add	sp, sp, 96
	ret
	.align	2
	.align 5
fd_swap__constprop__0__isra__0:
	fcvt	d0, s0
	mov	x0, 18725
	movk	x0, 0x3e12, lsl 16
	fmov	x1, d0
	ret
	.align	2
	.align 5
spill__constprop__0__isra__0:
	fmov	w1, s3
	fmov	x0, d2
	bfi	x0, x1, 32, 32
	fmov	d30, x0
	ushr	d30, d30, 32
	sbfx	x1, x0, 0, 32
	fmov	d31, x1
	fmul	s31, s31, s30
	fmov	d30, 2.0e+0
	fmadd	d0, d1, d30, d0
	fcvt	d31, s31
	fadd	d31, d31, d0
	fmov	d0, 5.0e-1
	fadd	d0, d31, d0
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"v2 %.9g %.9g\n"
	.align	3
.LC3:
	.string	"v3 %.9g %.9g %.9g\n"
	.align	3
.LC4:
	.string	"d4 %.17g %.17g %.17g %.17g\n"
	.align	3
.LC5:
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
	stp	x29, x30, [sp, -480]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LANCHOR1
	add	x19, x20, :lo12:.LANCHOR1
	ldr	w0, [x20, :lo12:.LANCHOR1]
	stp	x21, x22, [sp, 32]
	mov	x21, 0
	bfi	x21, x0, 0, 32
	stp	d13, d14, [sp, 48]
	ldr	w0, [x19, 4]
	ldr	w1, [x19, 8]
	bfi	x21, x0, 32, 32
	mov	x0, 0
	bfi	x0, x1, 0, 32
	ldr	w1, [x19, 12]
	lsr	x2, x21, 32
	fmov	s13, w2
	str	d15, [sp, 64]
	bfi	x0, x1, 32, 32
	fmov	s1, s13
	lsr	w1, w0, 0
	lsr	x0, x0, 32
	fmov	s3, w0
	lsr	w0, w21, 0
	fmov	s2, w1
	fmov	s0, w0
	lsr	w21, w21, 0
	bl	v2_add
	fmov	w1, s1
	fmov	x0, d0
	bfi	x0, x1, 32, 32
	fmov	d31, x0
	ushr	d1, d31, 32
	sbfx	x0, x0, 0, 32
	fmov	d0, x0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	fcvt	d0, s0
	fcvt	d1, s1
	bl	printf
	ldr	s0, [x20, :lo12:.LANCHOR1]
	adrp	x0, .LC3
	ldr	s1, [x19, 4]
	add	x0, x0, :lo12:.LC3
	ldr	s2, [x19, 8]
	ldr	s3, [x19, 12]
	ldr	s4, [x19, 16]
	ldr	s5, [x19, 20]
	stp	s0, s1, [sp, 112]
	str	s2, [sp, 120]
	stp	s3, s4, [sp, 128]
	str	s5, [sp, 136]
	bl	v3_cross
	stp	s0, s1, [sp, 144]
	fcvt	d1, s1
	fcvt	d0, s0
	str	s2, [sp, 152]
	fcvt	d2, s2
	bl	printf
	ldr	s15, [x20, :lo12:.LANCHOR1]
	ldr	s1, [x19, 4]
	ldr	s2, [x19, 8]
	fcvt	d15, s15
	ldr	s3, [x19, 16]
	fcvt	d1, s1
	fcvt	d2, s2
	fcvt	d3, s3
	fmov	d0, d15
	stp	d15, d1, [sp, 264]
	stp	d2, d3, [sp, 280]
	bl	d4_scale__constprop__0
	fmov	d14, d3
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	stp	d0, d1, [sp, 296]
	stp	d2, d3, [sp, 312]
	bl	printf
	ldr	s31, [x20, :lo12:.LANCHOR1]
	add	x8, sp, 216
	str	s31, [sp, 192]
	ldr	s31, [x19, 4]
	str	s31, [sp, 196]
	ldr	s31, [x19, 8]
	str	s31, [sp, 200]
	ldr	s31, [x19, 12]
	str	s31, [sp, 204]
	ldp	x0, x1, [sp, 192]
	ldr	s31, [x19, 16]
	stp	x0, x1, [sp, 80]
	str	s31, [sp, 208]
	ldr	w0, [sp, 208]
	str	w0, [sp, 96]
	add	x0, sp, 80
	bl	f5_rev
	ldr	s4, [sp, 232]
	ldp	s0, s1, [sp, 216]
	adrp	x0, .LC5
	ldp	s2, s3, [sp, 224]
	fcvt	d4, s4
	fcvt	d1, s1
	fcvt	d0, s0
	add	x0, x0, :lo12:.LC5
	fcvt	d3, s3
	fcvt	d2, s2
	bl	printf
	ldr	w1, [x19, 8]
	mov	x0, 0
	ldr	s0, [x19, 4]
	bfi	x0, x1, 0, 32
	mov	x1, -7
	bfi	x0, x1, 32, 32
	bl	fi_mix__constprop__0
	ldr	s0, [x19, 16]
	mov	x2, x0
	bl	fd_swap__constprop__0__isra__0
	sxtw	x0, w0
	fmov	d1, x0
	sbfx	x0, x2, 0, 32
	fmov	d0, x0
	fmov	d2, x1
	fcvt	d1, s1
	lsr	x1, x2, 32
	fcvt	d0, s0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	s0, [x19, 4]
	adrp	x0, .LC7
	ldr	s1, [x19, 8]
	add	x0, x0, :lo12:.LC7
	ldr	s2, [x20, :lo12:.LANCHOR1]
	stp	s0, s1, [sp, 176]
	str	s2, [sp, 184]
	bl	nv_norm
	stp	s0, s1, [sp, 160]
	fcvt	d1, s1
	fcvt	d0, s0
	str	s2, [sp, 168]
	fcvt	d2, s2
	bl	printf
	fmov	s3, s13
	fmov	d1, d14
	fmov	d0, d15
	fmov	s2, w21
	bl	spill__constprop__0__isra__0
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldr	s4, [x19, 12]
	ldp	d0, d1, [sp, 264]
	fcvt	d4, s4
	ldp	d2, d3, [sp, 280]
	bl	no_backfill__constprop__0
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	mov	w3, 43691
	add	x2, sp, 424
	mov	w1, 0
	movk	w3, 0xaaaa, lsl 16
	fmov	d31, 1.0e+0
	.align 5
.L27:
	umull	x0, w1, w3
	lsr	x0, x0, 34
	add	w0, w0, w0, lsl 1
	sub	w0, w1, w0, lsl 1
	add	w1, w1, 1
	scvtf	s29, w1
	ldr	s30, [x19, w0, sxtw 2]
	fmul	s29, s29, s30
	fcvt	d29, s29
	fsub	d29, d29, d31
	str	d29, [x2], 8
	cmp	w1, 7
	bne	.L27
	add	x8, sp, 240
	add	x0, sp, 424
	bl	range__constprop__0
	ldr	x1, [sp, 256]
	adrp	x0, .LC10
	ldp	d0, d1, [sp, 240]
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldrb	w0, [sp, 328]
	mov	w1, 5
	ldr	s31, [x20, :lo12:.LANCHOR1]
	mov	x6, 8
	mov	x4, 20
	mov	x5, x6
	bfi	w0, w1, 0, 3
	strb	w0, [sp, 328]
	ldrb	w0, [sp, 336]
	mov	w1, 3
	str	s31, [sp, 332]
	mov	x3, 24
	orr	w0, w0, 1
	strb	w0, [sp, 336]
	ldrb	w0, [sp, 340]
	ldr	s31, [x19, 8]
	bfi	w0, w1, 0, 3
	strb	w0, [sp, 340]
	ldrb	w0, [sp, 348]
	mov	w1, 1
	str	s31, [sp, 344]
	and	w0, w0, -2
	strb	w0, [sp, 348]
	ldrb	w0, [sp, 352]
	ldr	s31, [x19, 12]
	orr	w0, w0, 7
	strb	w0, [sp, 352]
	ldrb	w0, [sp, 360]
	str	s31, [sp, 356]
	orr	w0, w0, 1
	strb	w0, [sp, 360]
	ldrb	w0, [sp, 364]
	ldr	s31, [x19, 4]
	bfi	w0, w1, 0, 3
	strb	w0, [sp, 364]
	ldrb	w0, [sp, 372]
	str	s31, [sp, 368]
	orr	w0, w0, w1
	strb	w0, [sp, 372]
	add	x0, sp, 328
	bl	bf_sum__constprop__0
	fcvt	d0, s0
	mov	x2, 16
	mov	x1, 12
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	str	xzr, [sp, 376]
	movi	v23.2s, #0
	ldr	s26, [x19, 8]
	ldr	s25, [x19, 8]
	mov	x0, 1065353216
	ldr	s24, [x20, :lo12:.LANCHOR1]
	movk	x0, 0x4000, lsl 48
	str	x0, [sp, 392]
	mov	w4, 10
	fmov	s19, s23
	fmov	s17, s23
	fneg	s24, s24
	fmov	s16, s23
	ldr	s18, [x19, 16]
	fmov	s7, 2.0e+1
	ldr	s22, [sp, 380]
	ldr	s21, [sp, 392]
	ldr	s20, [sp, 396]
	str	wzr, [sp, 404]
	str	s26, [sp, 384]
	str	s25, [sp, 388]
	str	s24, [sp, 400]
	.align 5
.L28:
	fmov	s0, s23
	fmov	s1, s22
	fmov	s2, s26
	fmov	s3, s25
	bl	step__constprop__0
	fmov	s23, s0
	fmov	s22, s1
	fmov	s0, s21
	fmov	s1, s20
	fmov	s26, s2
	fmov	s25, s3
	fmov	s2, s24
	fmov	s3, s19
	add	x0, sp, 384
	stp	s23, s22, [x0, -8]
	stp	s26, s25, [x0]
	bl	step__constprop__0
	fmov	s21, s0
	fmov	s20, s1
	fmov	s0, s18
	fmov	s1, s17
	fmov	s24, s2
	fmov	s19, s3
	fmov	s2, s16
	fmov	s3, s7
	add	x1, sp, 400
	stp	s21, s20, [x1, -8]
	stp	s24, s19, [x1]
	bl	step__constprop__0
	add	x2, sp, 416
	fmov	s18, s0
	fmov	s17, s1
	fmov	s16, s2
	fmov	s7, s3
	stp	s0, s1, [x2, -8]
	subs	w4, w4, #1
	stp	s2, s3, [x2]
	bne	.L28
	adrp	x22, .LC12
	add	x20, sp, 376
	add	x22, x22, :lo12:.LC12
	mov	w21, 0
.L29:
	ldp	s2, s3, [x20, 8]
	mov	w1, w21
	ldp	s0, s1, [x20], 16
	mov	x0, x22
	fcvt	d3, s3
	fcvt	d2, s2
	add	w21, w21, 1
	fcvt	d1, s1
	fcvt	d0, s0
	bl	printf
	cmp	w21, 3
	bne	.L29
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
	ldr	d15, [sp, 64]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	d13, d14, [sp, 48]
	ldp	x29, x30, [sp], 480
	ret
	.section .rodata
	.align	4
	.LANCHOR0:
.LC0:
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
	.word	1431655765
	.word	1070945621
	.word	1431655765
	.word	1070945621
	.data
	.align	4
	.LANCHOR1:
seed:
	.word	1036831949
	.word	-1071644672
	.word	1081081856
	.word	981668463
	.word	1178658486
	.word	-2147483648

