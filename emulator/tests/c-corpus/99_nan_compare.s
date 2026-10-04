	.text
	.align	2
dbits:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	str	d31, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.data
	.align	3
vals:
	.word	0
	.word	-1048576
	.word	0
	.word	-1074266112
	.word	1
	.word	-2147483648
	.word	0
	.word	-2147483648
	.word	0
	.word	0
	.word	1
	.word	0
	.word	0
	.word	1073217536
	.word	0
	.word	2146435072
	.word	0
	.word	2146959360
	.word	0
	.word	-524288
	.text
	.align	2
differ:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	str	d1, [sp]
	ldr	d30, [sp, 8]
	ldr	d31, [sp]
	fcmp	d30, d31
	cset	w0, ne
	and	w0, w0, 255
	add	sp, sp, 16
	ret
	.align	2
relations:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	str	x19, [sp, 16]
	str	d0, [sp, 56]
	str	d1, [sp, 48]
	str	x0, [sp, 40]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 48]
	fcmpe	d30, d31
	bmi	.L32
	b	.L38
.L32:
	mov	w1, 49
	b	.L8
.L38:
	mov	w1, 48
.L8:
	ldr	x0, [sp, 40]
	strb	w1, [x0]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 48]
	fcmpe	d30, d31
	bls	.L33
	b	.L39
.L33:
	mov	w1, 49
	b	.L11
.L39:
	mov	w1, 48
.L11:
	ldr	x0, [sp, 40]
	add	x0, x0, 1
	strb	w1, [x0]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 48]
	fcmpe	d30, d31
	bgt	.L34
	b	.L40
.L34:
	mov	w1, 49
	b	.L14
.L40:
	mov	w1, 48
.L14:
	ldr	x0, [sp, 40]
	add	x0, x0, 2
	strb	w1, [x0]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 48]
	fcmpe	d30, d31
	bge	.L35
	b	.L41
.L35:
	mov	w1, 49
	b	.L17
.L41:
	mov	w1, 48
.L17:
	ldr	x0, [sp, 40]
	add	x0, x0, 3
	strb	w1, [x0]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 48]
	fcmp	d30, d31
	bne	.L18
	mov	w1, 49
	b	.L19
.L18:
	mov	w1, 48
.L19:
	ldr	x0, [sp, 40]
	add	x0, x0, 4
	strb	w1, [x0]
	ldr	d1, [sp, 48]
	ldr	d0, [sp, 56]
	bl	differ
	and	w1, w0, 255
	ldr	x0, [sp, 40]
	add	x0, x0, 5
	add	w1, w1, 48
	and	w1, w1, 255
	strb	w1, [x0]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 48]
	fcmp	d30, d31
	cset	w0, pl
	and	w0, w0, 255
	eor	w0, w0, 1
	and	w0, w0, 255
	and	w1, w0, 255
	ldr	x0, [sp, 40]
	add	x0, x0, 6
	add	w1, w1, 48
	and	w1, w1, 255
	strb	w1, [x0]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 48]
	fcmp	d30, d31
	cset	w0, hi
	and	w0, w0, 255
	eor	w0, w0, 1
	and	w0, w0, 255
	and	w1, w0, 255
	ldr	x0, [sp, 40]
	add	x0, x0, 7
	add	w1, w1, 48
	and	w1, w1, 255
	strb	w1, [x0]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 48]
	fcmp	d30, d31
	cset	w0, le
	and	w0, w0, 255
	eor	w0, w0, 1
	and	w0, w0, 255
	and	w1, w0, 255
	ldr	x0, [sp, 40]
	add	x0, x0, 8
	add	w1, w1, 48
	and	w1, w1, 255
	strb	w1, [x0]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 48]
	fcmp	d30, d31
	cset	w0, lt
	and	w0, w0, 255
	eor	w0, w0, 1
	and	w0, w0, 255
	and	w1, w0, 255
	ldr	x0, [sp, 40]
	add	x0, x0, 9
	add	w1, w1, 48
	and	w1, w1, 255
	strb	w1, [x0]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 48]
	fcmp	d30, d31
	cset	w0, vs
	mov	w1, w0
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 48]
	mov	w0, 1
	fcmp	d30, d31
	csel	w0, w1, w0, ne
	and	w0, w0, 255
	eor	w0, w0, 1
	and	w0, w0, 255
	and	w1, w0, 255
	ldr	x0, [sp, 40]
	add	x0, x0, 10
	add	w1, w1, 48
	and	w1, w1, 255
	strb	w1, [x0]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 48]
	fcmp	d30, d31
	bvc	.L20
	mov	w1, 49
	b	.L21
.L20:
	mov	w1, 48
.L21:
	ldr	x0, [sp, 40]
	add	x0, x0, 11
	strb	w1, [x0]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 48]
	fcmpe	d30, d31
	cset	w0, mi
	and	w0, w0, 255
	eor	w0, w0, 1
	and	w0, w0, 255
	and	w1, w0, 255
	ldr	x0, [sp, 40]
	add	x0, x0, 12
	add	w1, w1, 48
	and	w1, w1, 255
	strb	w1, [x0]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 48]
	fcmpe	d30, d31
	cset	w0, ge
	and	w0, w0, 255
	eor	w0, w0, 1
	and	w0, w0, 255
	and	w1, w0, 255
	ldr	x0, [sp, 40]
	add	x0, x0, 13
	add	w1, w1, 48
	and	w1, w1, 255
	strb	w1, [x0]
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 48]
	fcmpe	d30, d31
	bmi	.L36
	b	.L42
.L36:
	ldr	d31, [sp, 56]
	str	d31, [sp, 72]
	b	.L24
.L42:
	ldr	d31, [sp, 48]
	str	d31, [sp, 72]
.L24:
	ldr	d30, [sp, 56]
	ldr	d31, [sp, 48]
	fcmpe	d30, d31
	bge	.L37
	b	.L43
.L37:
	ldr	d31, [sp, 56]
	str	d31, [sp, 64]
	b	.L27
.L43:
	ldr	d31, [sp, 48]
	str	d31, [sp, 64]
.L27:
	ldr	d0, [sp, 72]
	bl	dbits
	mov	x19, x0
	ldr	d0, [sp, 56]
	bl	dbits
	cmp	x19, x0
	bne	.L28
	mov	w1, 97
	b	.L29
.L28:
	mov	w1, 98
.L29:
	ldr	x0, [sp, 40]
	add	x0, x0, 14
	strb	w1, [x0]
	ldr	d0, [sp, 64]
	bl	dbits
	mov	x19, x0
	ldr	d0, [sp, 56]
	bl	dbits
	cmp	x19, x0
	bne	.L30
	mov	w1, 97
	b	.L31
.L30:
	mov	w1, 98
.L31:
	ldr	x0, [sp, 40]
	add	x0, x0, 15
	strb	w1, [x0]
	ldr	x0, [sp, 40]
	add	x0, x0, 16
	strb	wzr, [x0]
	nop
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 80
	ret
	.align	2
cmp3:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	str	d1, [sp]
	ldr	d30, [sp, 8]
	ldr	d31, [sp]
	fcmpe	d30, d31
	bmi	.L51
	b	.L53
.L51:
	mov	w0, 60
	b	.L47
.L53:
	ldr	d30, [sp, 8]
	ldr	d31, [sp]
	fcmpe	d30, d31
	bgt	.L52
	b	.L54
.L52:
	mov	w0, 62
	b	.L47
.L54:
	ldr	d30, [sp, 8]
	ldr	d31, [sp]
	fcmp	d30, d31
	bne	.L50
	mov	w0, 61
	b	.L47
.L50:
	mov	w0, 63
.L47:
	add	sp, sp, 16
	ret
	.align	2
inside:
	sub	sp, sp, #32
	str	d0, [sp, 24]
	str	d1, [sp, 16]
	str	d2, [sp, 8]
	ldr	d30, [sp, 24]
	ldr	d31, [sp, 16]
	fcmpe	d30, d31
	bge	.L61
	b	.L56
.L61:
	ldr	d30, [sp, 24]
	ldr	d31, [sp, 8]
	fcmpe	d30, d31
	bls	.L62
	b	.L56
.L62:
	mov	w0, 1
	b	.L59
.L56:
	mov	w0, 0
.L59:
	add	sp, sp, 32
	ret
	.align	2
outside:
	sub	sp, sp, #32
	str	d0, [sp, 24]
	str	d1, [sp, 16]
	str	d2, [sp, 8]
	ldr	d30, [sp, 24]
	ldr	d31, [sp, 16]
	fcmpe	d30, d31
	bmi	.L64
	ldr	d30, [sp, 24]
	ldr	d31, [sp, 8]
	fcmpe	d30, d31
	bgt	.L64
	b	.L69
.L64:
	mov	w0, 1
	b	.L67
.L69:
	mov	w0, 0
.L67:
	add	sp, sp, 32
	ret
	.align	2
both_less:
	sub	sp, sp, #32
	str	d0, [sp, 24]
	str	d1, [sp, 16]
	str	d2, [sp, 8]
	str	d3, [sp]
	ldr	d30, [sp, 24]
	ldr	d31, [sp, 16]
	fcmpe	d30, d31
	bmi	.L76
	b	.L71
.L76:
	ldr	d30, [sp, 8]
	ldr	d31, [sp]
	fcmpe	d30, d31
	bmi	.L77
	b	.L71
.L77:
	mov	w0, 1
	b	.L74
.L71:
	mov	w0, 0
.L74:
	add	sp, sp, 32
	ret
	.align	2
either_eq:
	sub	sp, sp, #16
	str	s0, [sp, 12]
	str	s1, [sp, 8]
	str	s2, [sp, 4]
	ldr	s30, [sp, 12]
	ldr	s31, [sp, 8]
	fcmp	s30, s31
	beq	.L79
	ldr	s30, [sp, 12]
	ldr	s31, [sp, 4]
	fcmp	s30, s31
	bne	.L80
.L79:
	mov	w0, 1
	b	.L81
.L80:
	mov	w0, 0
.L81:
	add	sp, sp, 16
	ret
	.align	2
before:
	sub	sp, sp, #16
	str	d0, [sp, 8]
	str	d1, [sp]
	ldr	d30, [sp]
	ldr	d31, [sp]
	fcmp	d30, d31
	beq	.L84
	ldr	d30, [sp, 8]
	ldr	d31, [sp, 8]
	fcmp	d30, d31
	cset	w0, eq
	and	w0, w0, 255
	b	.L85
.L84:
	ldr	d30, [sp, 8]
	ldr	d31, [sp, 8]
	fcmp	d30, d31
	beq	.L86
	mov	w0, 0
	b	.L85
.L86:
	ldr	d30, [sp, 8]
	ldr	d31, [sp]
	fcmpe	d30, d31
	bmi	.L91
	b	.L92
.L91:
	mov	w0, 1
	b	.L85
.L92:
	ldr	d30, [sp, 8]
	ldr	d31, [sp]
	fcmp	d30, d31
	bne	.L89
	ldr	x0, [sp, 8]
	lsr	x0, x0, 63
	and	w0, w0, 1
	cmp	w0, 0
	beq	.L89
	ldr	x0, [sp]
	lsr	x0, x0, 63
	and	w0, w0, 1
	cmp	w0, 0
	bne	.L89
	mov	w0, 1
	b	.L85
.L89:
	mov	w0, 0
.L85:
	add	sp, sp, 16
	ret
	.align	2
sort:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	w1, [sp, 20]
	mov	w0, 1
	str	w0, [sp, 44]
	b	.L94
.L98:
	ldrsw	x0, [sp, 44]
	lsl	x0, x0, 3
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	ldr	d31, [x0]
	str	d31, [sp, 32]
	ldr	w0, [sp, 44]
	str	w0, [sp, 40]
	b	.L95
.L97:
	ldrsw	x0, [sp, 40]
	lsl	x0, x0, 3
	sub	x0, x0, #8
	ldr	x1, [sp, 24]
	add	x1, x1, x0
	ldrsw	x0, [sp, 40]
	lsl	x0, x0, 3
	ldr	x2, [sp, 24]
	add	x0, x2, x0
	ldr	d31, [x1]
	str	d31, [x0]
	ldr	w0, [sp, 40]
	sub	w0, w0, #1
	str	w0, [sp, 40]
.L95:
	ldr	w0, [sp, 40]
	cmp	w0, 0
	ble	.L96
	ldrsw	x0, [sp, 40]
	lsl	x0, x0, 3
	sub	x0, x0, #8
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	ldr	d31, [x0]
	fmov	d1, d31
	ldr	d0, [sp, 32]
	bl	before
	cmp	w0, 0
	bne	.L97
.L96:
	ldrsw	x0, [sp, 40]
	lsl	x0, x0, 3
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	ldr	d31, [sp, 32]
	str	d31, [x0]
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L94:
	ldr	w1, [sp, 44]
	ldr	w0, [sp, 20]
	cmp	w1, w0
	blt	.L98
	nop
	nop
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"ij < <= > >= == != isless isle isgt isge islg isun !< !>= min max"
	.align	3
.LC1:
	.string	"%d%d %s\n"
	.align	3
.LC2:
	.string	"cmp%d "
	.align	3
.LC3:
	.string	"range%d %d%d %d%d %d %d%d\n"
	.align	3
.LC5:
	.string	"float %d%d%d %d%d%d %d%d%d%d\n"
	.align	3
.LC6:
	.string	"sorted"
	.align	3
.LC7:
	.string	" nan:%016lx"
	.align	3
.LC8:
	.string	" %g"
	.align	3
.LC9:
	.string	"\n"
	.align	3
.LC10:
	.string	"best %g above %d below %d unordered %d\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #352
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	stp	x19, x20, [sp, 48]
	stp	x21, x22, [sp, 64]
	stp	x23, x24, [sp, 80]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	puts
	str	wzr, [sp, 348]
	b	.L100
.L103:
	str	wzr, [sp, 344]
	b	.L101
.L102:
	adrp	x0, vals
	add	x0, x0, :lo12:vals
	ldrsw	x1, [sp, 348]
	ldr	d31, [x0, x1, lsl 3]
	adrp	x0, vals
	add	x0, x0, :lo12:vals
	ldrsw	x1, [sp, 344]
	ldr	d30, [x0, x1, lsl 3]
	add	x0, sp, 256
	fmov	d1, d30
	fmov	d0, d31
	bl	relations
	add	x0, sp, 256
	mov	x3, x0
	ldr	w2, [sp, 344]
	ldr	w1, [sp, 348]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 344]
	add	w0, w0, 1
	str	w0, [sp, 344]
.L101:
	ldr	w0, [sp, 344]
	cmp	w0, 9
	ble	.L102
	ldr	w0, [sp, 348]
	add	w0, w0, 1
	str	w0, [sp, 348]
.L100:
	ldr	w0, [sp, 348]
	cmp	w0, 9
	ble	.L103
	str	wzr, [sp, 340]
	b	.L104
.L107:
	ldr	w1, [sp, 340]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	str	wzr, [sp, 336]
	b	.L105
.L106:
	adrp	x0, vals
	add	x0, x0, :lo12:vals
	ldrsw	x1, [sp, 340]
	ldr	d31, [x0, x1, lsl 3]
	adrp	x0, vals
	add	x0, x0, :lo12:vals
	ldrsw	x1, [sp, 336]
	ldr	d30, [x0, x1, lsl 3]
	fmov	d1, d30
	fmov	d0, d31
	bl	cmp3
	bl	putchar
	ldr	w0, [sp, 336]
	add	w0, w0, 1
	str	w0, [sp, 336]
.L105:
	ldr	w0, [sp, 336]
	cmp	w0, 9
	ble	.L106
	mov	w0, 10
	bl	putchar
	ldr	w0, [sp, 340]
	add	w0, w0, 1
	str	w0, [sp, 340]
.L104:
	ldr	w0, [sp, 340]
	cmp	w0, 9
	ble	.L107
	str	wzr, [sp, 332]
	b	.L108
.L109:
	adrp	x0, vals
	add	x0, x0, :lo12:vals
	ldrsw	x1, [sp, 332]
	ldr	d31, [x0, x1, lsl 3]
	str	d31, [sp, 280]
	fmov	d2, 1.5e+0
	fmov	d1, -1.5e+0
	ldr	d0, [sp, 280]
	bl	inside
	mov	w19, w0
	fmov	d2, 1.5e+0
	fmov	d1, -1.5e+0
	ldr	d0, [sp, 280]
	bl	outside
	mov	w20, w0
	movi	d2, #0
	movi	v31.4s, 0
	fneg	v31.2d, v31.2d
	fmov	d1, d31
	ldr	d0, [sp, 280]
	bl	inside
	mov	w21, w0
	movi	d2, #0
	movi	v31.4s, 0
	fneg	v31.2d, v31.2d
	fmov	d1, d31
	ldr	d0, [sp, 280]
	bl	outside
	mov	w22, w0
	ldr	d2, [sp, 280]
	ldr	d1, [sp, 280]
	ldr	d0, [sp, 280]
	bl	inside
	mov	w23, w0
	ldr	d3, [sp, 280]
	fmov	d2, -1.0e+0
	fmov	d1, 1.0e+0
	ldr	d0, [sp, 280]
	bl	both_less
	mov	w24, w0
	ldr	d31, [sp, 280]
	fneg	d31, d31
	fmov	d3, 2.0e+0
	ldr	d2, [sp, 280]
	ldr	d1, [sp, 280]
	fmov	d0, d31
	bl	both_less
	str	w0, [sp]
	mov	w7, w24
	mov	w6, w23
	mov	w5, w22
	mov	w4, w21
	mov	w3, w20
	mov	w2, w19
	ldr	w1, [sp, 332]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w0, [sp, 332]
	add	w0, w0, 1
	str	w0, [sp, 332]
.L108:
	ldr	w0, [sp, 332]
	cmp	w0, 9
	ble	.L109
	movi	v31.2s, 0x80, lsl 24
	str	s31, [sp, 252]
	mov	w0, 2143289344
	fmov	s31, w0
	str	s31, [sp, 248]
	mov	w0, 52429
	movk	w0, 0x3dcc, lsl 16
	fmov	s31, w0
	str	s31, [sp, 244]
	mov	w0, 1266679808
	fmov	s31, w0
	str	s31, [sp, 240]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	ldr	d31, [x0]
	str	d31, [sp, 232]
	mov	x0, 268435456
	movk	x0, 0x4170, lsl 48
	fmov	d31, x0
	str	d31, [sp, 224]
	ldr	s31, [sp, 252]
	ldr	s30, [sp, 248]
	fmov	s2, s30
	movi	v1.2s, #0
	fmov	s0, s31
	bl	either_eq
	mov	w19, w0
	ldr	s31, [sp, 248]
	ldr	s30, [sp, 248]
	ldr	s29, [sp, 248]
	fmov	s2, s29
	fmov	s1, s30
	fmov	s0, s31
	bl	either_eq
	mov	w20, w0
	ldr	s31, [sp, 244]
	ldr	s30, [sp, 248]
	mov	w0, 52429
	movk	w0, 0x3dcc, lsl 16
	fmov	s2, w0
	fmov	s1, s30
	fmov	s0, s31
	bl	either_eq
	ldr	s31, [sp, 244]
	fcvt	d30, s31
	ldr	d31, [sp, 232]
	fcmp	d30, d31
	cset	w1, eq
	and	w1, w1, 255
	ldr	s31, [sp, 244]
	fcvt	d30, s31
	ldr	d31, [sp, 232]
	fcmpe	d30, d31
	cset	w2, gt
	and	w2, w2, 255
	ldr	s31, [sp, 244]
	fcvt	d30, s31
	ldr	d31, [sp, 232]
	fcmpe	d30, d31
	cset	w3, mi
	and	w3, w3, 255
	ldr	s31, [sp, 240]
	fcvt	d30, s31
	ldr	d31, [sp, 224]
	fcmp	d30, d31
	cset	w4, eq
	and	w4, w4, 255
	ldr	s31, [sp, 240]
	fcvt	d30, s31
	ldr	d31, [sp, 224]
	fcmpe	d30, d31
	cset	w5, mi
	and	w5, w5, 255
	ldr	d31, [sp, 224]
	fcvt	s30, d31
	ldr	s31, [sp, 240]
	fcmp	s30, s31
	cset	w6, eq
	and	w6, w6, 255
	ldr	s31, [sp, 252]
	fcmp	s31, #0.0
	cset	w7, eq
	and	w7, w7, 255
	str	w7, [sp, 16]
	str	w6, [sp, 8]
	str	w5, [sp]
	mov	w7, w4
	mov	w6, w3
	mov	w5, w2
	mov	w4, w1
	mov	w3, w0
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	str	wzr, [sp, 328]
	b	.L110
.L111:
	mov	w1, 9
	ldr	w0, [sp, 328]
	sub	w1, w1, w0
	adrp	x0, vals
	add	x0, x0, :lo12:vals
	sxtw	x1, w1
	ldr	d31, [x0, x1, lsl 3]
	ldrsw	x0, [sp, 328]
	lsl	x0, x0, 3
	add	x1, sp, 96
	str	d31, [x1, x0]
	ldr	w0, [sp, 328]
	add	w0, w0, 1
	str	w0, [sp, 328]
.L110:
	ldr	w0, [sp, 328]
	cmp	w0, 9
	ble	.L111
	fmov	d31, 2.0e+0
	str	d31, [sp, 176]
	mov	x0, -9223372036854775808
	fmov	d31, x0
	str	d31, [sp, 184]
	adrp	x0, vals
	add	x0, x0, :lo12:vals
	ldr	d31, [x0, 64]
	str	d31, [sp, 192]
	fmov	d31, -2.0e+0
	str	d31, [sp, 200]
	str	xzr, [sp, 208]
	adrp	x0, vals
	add	x0, x0, :lo12:vals
	ldr	d30, [x0, 40]
	fmov	d31, 3.0e+0
	fmul	d31, d30, d31
	str	d31, [sp, 216]
	add	x0, sp, 96
	mov	w1, 16
	bl	sort
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	str	wzr, [sp, 324]
	b	.L112
.L115:
	ldrsw	x0, [sp, 324]
	lsl	x0, x0, 3
	add	x1, sp, 96
	ldr	d30, [x1, x0]
	ldrsw	x0, [sp, 324]
	lsl	x0, x0, 3
	add	x1, sp, 96
	ldr	d31, [x1, x0]
	fcmp	d30, d31
	beq	.L113
	ldrsw	x0, [sp, 324]
	lsl	x0, x0, 3
	add	x1, sp, 96
	ldr	d31, [x1, x0]
	fmov	d0, d31
	bl	dbits
	mov	x1, x0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L114
.L113:
	ldrsw	x0, [sp, 324]
	lsl	x0, x0, 3
	add	x1, sp, 96
	ldr	d31, [x1, x0]
	fmov	d0, d31
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
.L114:
	ldr	w0, [sp, 324]
	add	w0, w0, 1
	str	w0, [sp, 324]
.L112:
	ldr	w0, [sp, 324]
	cmp	w0, 15
	ble	.L115
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	mov	x0, -4503599627370496
	fmov	d31, x0
	str	d31, [sp, 312]
	str	wzr, [sp, 308]
	str	wzr, [sp, 304]
	str	wzr, [sp, 300]
	str	wzr, [sp, 296]
	b	.L116
.L121:
	ldrsw	x0, [sp, 296]
	lsl	x0, x0, 3
	add	x1, sp, 96
	ldr	d31, [x1, x0]
	str	d31, [sp, 288]
	ldr	d30, [sp, 288]
	ldr	d31, [sp, 312]
	fcmpe	d30, d31
	bgt	.L123
	b	.L117
.L123:
	ldr	d31, [sp, 288]
	str	d31, [sp, 312]
.L117:
	ldr	d31, [sp, 288]
	fcmpe	d31, #0.0
	cset	w0, gt
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 308]
	add	w0, w0, w1
	str	w0, [sp, 308]
	ldr	d31, [sp, 288]
	fcmpe	d31, #0.0
	cset	w0, mi
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 304]
	add	w0, w0, w1
	str	w0, [sp, 304]
	ldr	d31, [sp, 288]
	fcmpe	d31, #0.0
	cset	w0, ls
	and	w0, w0, 255
	eor	w0, w0, 1
	and	w0, w0, 255
	and	w0, w0, 1
	cmp	w0, 0
	beq	.L119
	ldr	d31, [sp, 288]
	fcmpe	d31, #0.0
	cset	w0, gt
	and	w0, w0, 255
	eor	w0, w0, 1
	and	w0, w0, 255
	and	w0, w0, 1
	cmp	w0, 0
	beq	.L119
	mov	w0, 1
	b	.L120
.L119:
	mov	w0, 0
.L120:
	ldr	w1, [sp, 300]
	add	w0, w1, w0
	str	w0, [sp, 300]
	ldr	w0, [sp, 296]
	add	w0, w0, 1
	str	w0, [sp, 296]
.L116:
	ldr	w0, [sp, 296]
	cmp	w0, 15
	ble	.L121
	ldr	w3, [sp, 300]
	ldr	w2, [sp, 304]
	ldr	w1, [sp, 308]
	ldr	d0, [sp, 312]
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	ldp	x23, x24, [sp, 80]
	add	sp, sp, 352
	ret
	.section .rodata
	.align	3
.LC4:
	.word	-1717986918
	.word	1069128089

