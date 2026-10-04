	.text
	.section .rodata
	.align	3
.LC0:
	.string	"0123456789ABCDEF"
	.align	3
.LC1:
	.string	"0123456789abcdef"
	.text
	.align	2
	.p2align 5,,15
mini.constprop.0:
	sub	sp, sp, #752
	add	x8, sp, 704
	add	x0, sp, 576
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	stp	x2, x3, [x8]
	stp	x4, x5, [x8, 16]
	str	x6, [sp, 736]
	str	x7, [sp, 744]
	str	q0, [x0]
	add	x0, sp, 592
	str	q1, [x0]
	add	x0, sp, 608
	str	q2, [x0]
	add	x0, sp, 624
	str	q3, [x0]
	add	x0, sp, 640
	str	q4, [x0]
	add	x0, sp, 656
	str	q5, [x0]
	add	x0, sp, 672
	str	q6, [x0]
	add	x0, sp, 688
	str	q7, [x0]
	add	x0, sp, 752
	stp	x0, x0, [sp, 144]
	add	x0, sp, 704
	str	x0, [sp, 160]
	mov	w0, -48
	str	w0, [sp, 168]
	mov	w0, -128
	str	w0, [sp, 172]
	ldrb	w0, [x1]
	cbz	w0, .L111
	adrp	x25, .LANCHOR0
	mov	w24, 0
	add	x25, x25, :lo12:.LANCHOR0
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	mov	w22, 48
	stp	x27, x28, [sp, 80]
	b	.L95
	.p2align 2,,3
.L236:
	add	w24, w24, 1
	mov	x19, x1
	strb	w0, [x25, x2]
.L4:
	ldrb	w0, [x19, 1]
	add	x1, x19, 1
	cbz	w0, .L235
.L95:
	sxtw	x2, w24
	add	x26, x25, x2
	cmp	w0, 37
	bne	.L236
	add	x19, x1, 1
	ldrb	w1, [x1, 1]
	mov	w4, 0
	mov	w28, 0
	cmp	w1, 45
	ccmp	w1, w22, 4, ne
	bne	.L5
	mov	w0, 45
	b	.L7
	.p2align 2,,3
.L113:
	ldrb	w1, [x19, 1]!
	mov	w4, 1
	cmp	w1, 48
	ccmp	w1, w0, 4, ne
	bne	.L5
.L7:
	cmp	w1, 45
	bne	.L113
	ldrb	w1, [x19, 1]!
	mov	w28, 1
	cmp	w1, 48
	ccmp	w1, w0, 4, ne
	beq	.L7
.L5:
	mov	w0, 0
	cmp	w1, 42
	beq	.L237
.L8:
	ldrb	w2, [x19]
	sub	w1, w2, #48
	and	w3, w1, 255
	cmp	w3, 9
	bhi	.L14
	.p2align 5,,15
.L13:
	ldrb	w2, [x19, 1]!
	add	w0, w0, w0, lsl 2
	add	w0, w1, w0, lsl 1
	sub	w1, w2, #48
	and	w3, w1, 255
	cmp	w3, 9
	bls	.L13
.L14:
	mov	w21, -1
	cmp	w2, 46
	beq	.L238
.L15:
	ldrb	w1, [x19]
	mov	w2, 108
	cmp	w1, 122
	ccmp	w1, w2, 4, ne
	mov	w2, 122
	bne	.L239
	.p2align 5,,15
.L17:
	ldrb	w1, [x19, 1]!
	cmp	w1, 108
	ccmp	w1, w2, 4, ne
	beq	.L17
	cmp	w1, 102
	beq	.L20
	bls	.L240
	cmp	w1, 115
	beq	.L26
	bhi	.L27
	cmp	w1, 105
	beq	.L23
	cmp	w1, 111
	bne	.L25
.L24:
	ldr	w3, [sp, 168]
	ldr	x2, [sp, 144]
	tbnz	w3, #31, .L241
.L43:
	add	x3, x2, 15
	and	x3, x3, -8
	str	x3, [sp, 144]
.L45:
	ldr	x2, [x2]
.L46:
	cmp	w1, 111
	beq	.L119
	cmp	w1, 117
	beq	.L120
	cmp	w1, 88
	mov	x1, 16
	bne	.L121
	adrp	x9, .LC0
	add	x9, x9, :lo12:.LC0
.L50:
	add	x3, sp, 120
	mov	x5, 1
	.p2align 5,,15
.L51:
	udiv	x6, x2, x1
	add	x7, x3, x5
	cmp	x1, x2
	msub	x8, x6, x1, x2
	mov	x2, x6
	mov	x6, x5
	add	x5, x5, 1
	ldrb	w8, [x9, x8]
	strb	w8, [x7, -1]
	bls	.L51
	mov	w20, w6
	cmp	w6, 15
	ble	.L122
	add	x1, sp, 104
	ldr	q25, [x1, w6, sxtw]
	adrp	x1, .LC2
	ldr	q24, [x1, :lo12:.LC2]
	tbl	v24.16b, {v25.16b}, v24.16b
	str	q24, [sp, 176]
	cmp	w6, 16
	beq	.L53
	sub	w5, w6, #16
	mov	w7, 16
.L52:
	uxtw	x8, w5
	add	x1, sp, 176
	sub	w5, w5, #1
	add	x7, x1, w7, uxtw
	add	x3, x3, x5
	mov	x2, 0
	.p2align 5,,15
.L54:
	neg	x1, x2
	ldrb	w1, [x3, x1]
	strb	w1, [x7, x2]
	add	x2, x2, 1
	cmp	x8, x2
	bne	.L54
.L53:
	eor	w3, w28, 1
	and	w2, w4, w3
	and	w2, w2, 1
	cmp	w6, w0
	blt	.L41
	cbnz	w2, .L88
	b	.L134
	.p2align 2,,3
.L235:
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x27, x28, [sp, 80]
.L2:
	strb	wzr, [x25, w24, sxtw]
	mov	w0, w24
	ldp	x29, x30, [sp]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	add	sp, sp, 752
	ret
	.p2align 2,,3
.L237:
	ldr	w0, [sp, 168]
	ldr	x1, [sp, 144]
	tbnz	w0, #31, .L242
.L9:
	add	x0, x1, 11
	and	x0, x0, -8
	str	x0, [sp, 144]
.L11:
	ldr	w0, [x1]
	add	x19, x19, 1
	cmp	w0, 0
	csneg	w0, w0, w0, ge
	csinc	w28, w28, wzr, ge
	b	.L8
	.p2align 2,,3
.L240:
	cmp	w1, 99
	beq	.L22
	cmp	w1, 100
	beq	.L23
	cmp	w1, 88
	beq	.L24
.L25:
	strb	w1, [sp, 176]
	eor	w1, w28, 1
	and	w27, w1, w4
	cmp	w0, 1
	ble	.L243
	sub	w21, w0, #1
	cbz	w27, .L244
	mov	w20, w27
.L89:
	ldrb	w0, [sp, 176]
	cmp	w0, 45
	beq	.L101
	mov	w27, 0
	mov	w4, 1
.L60:
	tst	x4, 1
	add	w23, w27, w21
	uxtw	x2, w21
	add	x0, x26, w27, sxtw
	mov	w1, 32
	csel	w1, w22, w1, ne
	bl	memset
.L94:
	cmp	w20, w27
	bgt	.L229
	mov	w20, w23
	b	.L93
.L22:
	ldr	w2, [sp, 168]
	ldr	x1, [sp, 144]
	tbnz	w2, #31, .L245
.L56:
	add	x2, x1, 11
	and	x2, x2, -8
	str	x2, [sp, 144]
.L58:
	ldr	w1, [x1]
	strb	w1, [sp, 176]
	cmp	w0, 1
	ble	.L123
	sub	w21, w0, #1
	cmp	w28, 1
	beq	.L246
	mov	w27, w28
	mov	w4, w28
	mov	w20, 1
	b	.L60
.L242:
	add	w2, w0, 8
	str	w2, [sp, 168]
	cmp	w2, 0
	bgt	.L9
	ldr	x1, [sp, 152]
	add	x1, x1, w0, sxtw
	b	.L11
.L27:
	cmp	w1, 117
	beq	.L24
	cmp	w1, 120
	bne	.L25
	b	.L24
.L26:
	ldr	w2, [sp, 168]
	ldr	x1, [sp, 144]
	tbnz	w2, #31, .L247
.L61:
	add	x2, x1, 15
	and	x2, x2, -8
	str	x2, [sp, 144]
.L63:
	ldr	x3, [x1]
	ldrb	w1, [x3]
	cbz	w1, .L64
	uxtw	x4, w21
	add	x5, sp, 176
	add	x4, x4, 1
	sub	x3, x3, #1
	mov	x20, 1
	b	.L65
	.p2align 2,,3
.L69:
	add	x2, x5, x20
	strb	w1, [x2, -1]
	add	x2, x20, 1
	ldrb	w1, [x3, x2]
	cbz	w1, .L70
	mov	x20, x2
.L65:
	cmp	x4, x20
	bne	.L69
	sub	w20, w4, #1
.L70:
	cmp	w0, w20
	bgt	.L248
.L104:
	cbnz	w20, .L134
.L67:
	add	w24, w24, w20
	b	.L4
.L20:
	ldr	w2, [sp, 172]
	ldr	x1, [sp, 144]
	tbnz	w2, #31, .L249
.L71:
	add	x2, x1, 15
	and	x2, x2, -8
	str	x2, [sp, 144]
.L73:
	ldr	d31, [x1]
	fcmpe	d31, #0.0
	tbnz	w21, #31, .L74
	bmi	.L109
	mov	w11, 0
.L75:
	cbz	w21, .L126
.L110:
	mov	w1, 0
	mov	x2, 1
	.p2align 5,,15
.L78:
	add	x2, x2, x2, lsl 2
	add	w1, w1, 1
	lsl	x2, x2, 1
	cmp	w1, w21
	bne	.L78
.L77:
	ucvtf	d30, x2
	adrp	x8, .LC1
	mov	x13, -3689348814741910324
	sxtw	x12, w11
	add	x3, sp, 120
	add	x8, x8, :lo12:.LC1
	mov	x7, 1
	movk	x13, 0xcccd, lsl 0
	fmul	d30, d30, d31
	fcvtzu	x9, d30
	udiv	x5, x9, x2
	.p2align 5,,15
.L79:
	umulh	x1, x5, x13
	add	x10, x3, x7
	cmp	x5, 9
	mov	x20, x7
	add	x7, x7, 1
	lsr	x1, x1, 3
	add	x6, x1, x1, lsl 2
	sub	x6, x5, x6, lsl 1
	mov	x5, x1
	ldrb	w6, [x8, x6]
	strb	w6, [x10, -1]
	bhi	.L79
	cmp	w20, 15
	ble	.L127
	add	x1, sp, 104
	ldr	q29, [x1, w20, sxtw]
	adrp	x1, .LC2
	ldr	q28, [x1, :lo12:.LC2]
	add	x1, sp, 176
	tbl	v28.16b, {v29.16b}, v28.16b
	str	q28, [x1, x12]
	cmp	w20, 16
	beq	.L81
	sub	w6, w20, #16
	mov	w7, 16
.L80:
	uxtw	x8, w6
	add	x12, x1, x12
	sub	w6, w6, #1
	add	x7, x12, w7, uxtw
	add	x3, x3, x6
	mov	x5, 0
	.p2align 5,,15
.L82:
	neg	x6, x5
	ldrb	w6, [x3, x6]
	strb	w6, [x7, x5]
	add	x5, x5, 1
	cmp	x5, x8
	bne	.L82
.L81:
	add	w20, w11, w20
	cbnz	w21, .L83
	eor	w2, w28, 1
	and	w27, w2, w4
	cmp	w20, w0
	blt	.L84
	cbz	w27, .L228
	ldrb	w0, [sp, 176]
	cmp	w0, 45
	bne	.L250
.L101:
	mov	w0, 45
	strb	w0, [x26]
	mov	w0, 1
	mov	w4, w0
	mov	w27, w0
	b	.L102
.L238:
	ldrb	w1, [x19, 1]
	mov	w21, 0
	add	x19, x19, 1
	sub	w1, w1, #48
	and	w2, w1, 255
	cmp	w2, 9
	bhi	.L15
	.p2align 5,,15
.L16:
	add	w21, w21, w21, lsl 2
	add	w21, w1, w21, lsl 1
	ldrb	w1, [x19, 1]!
	sub	w1, w1, #48
	and	w2, w1, 255
	cmp	w2, 9
	bls	.L16
	b	.L15
.L239:
	cmp	w1, 102
	beq	.L20
	bls	.L251
	cmp	w1, 115
	beq	.L26
	bhi	.L100
	cmp	w1, 105
	beq	.L97
	cmp	w1, 111
	bne	.L25
.L98:
	ldr	w3, [sp, 168]
	ldr	x2, [sp, 144]
	tbnz	w3, #31, .L252
.L47:
	add	x3, x2, 11
	ldr	w2, [x2]
	and	x3, x3, -8
	str	x3, [sp, 144]
	b	.L46
.L243:
	cbz	w27, .L253
	mov	w20, w27
.L88:
	ldrb	w0, [sp, 176]
	cmp	w0, 45
	beq	.L254
.L134:
	mov	w23, 0
	mov	w27, 0
	mov	w21, 0
.L229:
	add	x1, sp, 176
.L59:
	sub	w0, w20, #1
	cmp	w20, w27
	sub	w4, w0, w27
	sub	w0, w0, w27
	add	x2, x0, 1
	add	x1, x1, w27, sxtw
	csinc	x2, x2, xzr, gt
	add	x0, x26, w23, sxtw
	str	w4, [sp, 108]
	bl	memcpy
	ldr	w4, [sp, 108]
	cmp	w20, w27
	add	w3, w23, 1
	csel	w4, w4, wzr, gt
	add	w20, w4, w3
.L93:
	cmp	w21, 0
	cset	w0, ne
	tst	w28, w0
	beq	.L67
	add	x0, x26, w20, sxtw
	add	w20, w20, w21
	uxtw	x2, w21
	mov	w1, 32
	add	w24, w24, w20
	bl	memset
	b	.L4
.L123:
	add	x1, sp, 176
	mov	w23, 0
	mov	w27, 0
	mov	w20, 1
	mov	w21, 0
	b	.L59
.L248:
	sub	w21, w0, w20
	eor	w0, w28, 1
	and	w0, w0, 1
	mov	w4, 0
	mov	w27, 0
.L102:
	cmp	w21, 0
	ccmp	w0, 0, 4, ne
	bne	.L60
	mov	w23, w27
	b	.L94
.L23:
	ldr	w2, [sp, 168]
	ldr	x1, [sp, 144]
	tbnz	w2, #31, .L255
.L226:
	add	x2, x1, 15
	and	x2, x2, -8
	str	x2, [sp, 144]
.L29:
	ldr	x10, [x1]
.L32:
	cmp	x10, 0
	adrp	x8, .LC1
	mov	x9, -3689348814741910324
	csneg	x2, x10, x10, ge
	add	x3, sp, 120
	add	x8, x8, :lo12:.LC1
	mov	x6, 1
	movk	x9, 0xcccd, lsl 0
	.p2align 5,,15
.L36:
	umulh	x1, x2, x9
	add	x7, x3, x6
	cmp	x2, 9
	lsr	x1, x1, 3
	add	x5, x1, x1, lsl 2
	sub	x5, x2, x5, lsl 1
	mov	x2, x1
	ldrb	w5, [x8, x5]
	strb	w5, [x7, -1]
	mov	x5, x6
	add	x6, x6, 1
	bhi	.L36
	mov	w6, w5
	tbz	x10, #63, .L117
	mov	w1, 45
	mov	w20, 1
	strb	w1, [sp, 176]
.L37:
	cmp	w5, 15
	ble	.L118
	add	x1, sp, 104
	sxtw	x2, w20
	ldr	q27, [x1, w5, sxtw]
	adrp	x1, .LC2
	ldr	q26, [x1, :lo12:.LC2]
	add	x1, sp, 176
	tbl	v26.16b, {v27.16b}, v26.16b
	str	q26, [x1, x2]
	cmp	w5, 16
	beq	.L39
	sub	w6, w5, #16
	add	w7, w20, 16
.L40:
	uxtw	x8, w6
	sub	w6, w6, #1
	add	x7, x1, w7, sxtw
	add	x6, x3, x6
	mov	x2, 0
	.p2align 5,,15
.L38:
	neg	x3, x2
	ldrb	w3, [x6, x3]
	strb	w3, [x7, x2]
	add	x2, x2, 1
	cmp	x2, x8
	bne	.L38
.L39:
	eor	w3, w28, 1
	add	w20, w20, w5
	and	w2, w4, w3
	and	w2, w2, 1
	cmp	w0, w20
	bgt	.L41
	cbnz	w2, .L88
	mov	w23, 0
	mov	w27, 0
	mov	w21, 0
	b	.L59
.L251:
	cmp	w1, 99
	beq	.L22
	cmp	w1, 100
	beq	.L97
	cmp	w1, 88
	bne	.L25
	b	.L98
.L137:
	mov	w21, 6
.L109:
	mov	w1, 45
	fneg	d31, d31
	mov	w11, 1
	strb	w1, [sp, 176]
	b	.L75
.L97:
	ldr	w2, [sp, 168]
	ldr	x1, [sp, 144]
	tbnz	w2, #31, .L256
.L227:
	add	x2, x1, 11
	ldrsw	x10, [x1]
	and	x2, x2, -8
	str	x2, [sp, 144]
	b	.L32
.L41:
	sub	w21, w0, w20
	cbnz	w2, .L89
	mov	w27, 0
	tbnz	x3, 0, .L60
.L230:
	add	x1, sp, 176
	mov	w23, 0
	b	.L59
.L83:
	sxtw	x3, w20
	mov	w5, 46
	strb	w5, [x1, x3]
	cmp	x2, 9
	bls	.L257
	mov	x5, 10
	add	w20, w20, 2
	add	x6, x1, x3
	udiv	x2, x2, x5
	sub	x6, x6, x20
	mov	x5, -3689348814741910324
	add	x6, x6, 1
	movk	x5, 0xcccd, lsl 0
	.p2align 5,,15
.L90:
	udiv	x3, x9, x2
	mov	x7, x20
	umulh	x1, x3, x5
	lsr	x1, x1, 3
	add	x1, x1, x1, lsl 2
	sub	x1, x3, x1, lsl 1
	add	w1, w1, 48
	strb	w1, [x6, x20]
	mov	x1, x2
	umulh	x2, x2, x5
	add	x20, x20, 1
	lsr	x2, x2, 3
	cmp	x1, 9
	bhi	.L90
	eor	w3, w28, 1
	mov	w20, w7
	and	w2, w4, w3
	and	w2, w2, 1
	cmp	w7, w0
	blt	.L41
	cbnz	w2, .L88
	b	.L104
.L117:
	mov	w20, 0
	b	.L37
.L247:
	add	w3, w2, 8
	str	w3, [sp, 168]
	cmp	w3, 0
	bgt	.L61
	ldr	x1, [sp, 152]
	add	x1, x1, w2, sxtw
	b	.L63
.L249:
	add	w3, w2, 16
	str	w3, [sp, 172]
	cmp	w3, 0
	bgt	.L71
	ldr	x1, [sp, 160]
	add	x1, x1, w2, sxtw
	b	.L73
.L74:
	bmi	.L137
	mov	w11, 0
	mov	w21, 6
	b	.L110
.L245:
	add	w3, w2, 8
	str	w3, [sp, 168]
	cmp	w3, 0
	bgt	.L56
	ldr	x1, [sp, 152]
	add	x1, x1, w2, sxtw
	b	.L58
.L119:
	adrp	x8, .LC1
	mov	x1, 8
	add	x9, x8, :lo12:.LC1
	b	.L50
.L111:
	adrp	x25, .LANCHOR0
	mov	w24, 0
	add	x25, x25, :lo12:.LANCHOR0
	b	.L2
.L84:
	sub	w21, w0, w20
	cbnz	w27, .L89
	tbnz	x2, 0, .L60
.L228:
	mov	w23, 0
	b	.L59
.L254:
	mov	w21, 0
	b	.L101
.L120:
	adrp	x8, .LC1
	mov	x1, 10
	add	x9, x8, :lo12:.LC1
	b	.L50
.L255:
	add	w3, w2, 8
	str	w3, [sp, 168]
	cmp	w3, 0
	bgt	.L226
	ldr	x1, [sp, 152]
	add	x1, x1, w2, sxtw
	b	.L29
.L241:
	add	w5, w3, 8
	str	w5, [sp, 168]
	cmp	w5, 0
	bgt	.L43
	ldr	x2, [sp, 152]
	add	x2, x2, w3, sxtw
	b	.L45
.L256:
	add	w3, w2, 8
	str	w3, [sp, 168]
	cmp	w3, 0
	bgt	.L227
	ldr	x1, [sp, 152]
	add	x1, x1, w2, sxtw
	ldrsw	x10, [x1]
	b	.L32
.L253:
	add	x1, sp, 176
	mov	w23, 0
	mov	w21, 0
	mov	w20, 1
	b	.L59
.L244:
	mov	w20, 1
	tbnz	x1, 0, .L60
	b	.L230
.L100:
	cmp	w1, 117
	beq	.L98
	cmp	w1, 120
	bne	.L25
	b	.L98
.L250:
	mov	w23, 0
	mov	w27, 0
	b	.L59
.L252:
	add	w5, w3, 8
	str	w5, [sp, 168]
	cmp	w5, 0
	bgt	.L47
	ldr	x2, [sp, 152]
	add	x2, x2, w3, sxtw
	ldr	w2, [x2]
	b	.L46
.L126:
	mov	x2, 1
	b	.L77
.L127:
	mov	w6, w20
	add	x1, sp, 176
	mov	w7, 0
	b	.L80
.L122:
	mov	w5, w6
	mov	w7, 0
	b	.L52
.L118:
	mov	w7, w20
	add	x1, sp, 176
	b	.L40
.L64:
	cmp	w0, 0
	bgt	.L66
	mov	w20, 0
	add	w24, w24, w20
	b	.L4
.L257:
	eor	w2, w28, 1
	add	w20, w20, 1
	and	w27, w2, w4
	cmp	w20, w0
	blt	.L84
	cbnz	w27, .L88
	mov	w23, 0
	mov	w21, 0
	b	.L59
.L246:
	mov	w20, w28
	add	x1, sp, 176
	mov	w23, 0
	mov	w27, 0
	b	.L59
.L121:
	adrp	x8, .LC1
	add	x9, x8, :lo12:.LC1
	b	.L50
.L66:
	cmp	w28, 1
	beq	.L258
	mov	w27, w28
	mov	w4, w28
	mov	w20, w28
	mov	w21, w0
	b	.L60
.L258:
	mov	w21, w0
	mov	w20, 0
	b	.L93
	.section .rodata
	.align	3
.LC3:
	.string	"same"
	.align	3
.LC4:
	.string	"DIFF"
	.align	3
.LC5:
	.string	"%d %i %u %x %X %o"
	.align	3
.LC6:
	.string	"%s %d %d |%s|\n"
	.align	3
.LC7:
	.string	"     want |%s|\n"
	.align	3
.LC8:
	.string	"%ld %lu %lx %zu %c%c %s|%-6s|%6s"
	.align	3
.LC9:
	.string	"cd"
	.align	3
.LC10:
	.string	"ab"
	.align	3
.LC11:
	.string	"str"
	.align	3
.LC12:
	.string	"%d %d %d %d %d %d %d %d %d %d %d %d"
	.align	3
.LC13:
	.string	"%.1f %.2f %.3f %.4f %.1f %.2f %.3f %.4f %.1f %.2f %f"
	.align	3
.LC14:
	.string	"two"
	.align	3
.LC15:
	.string	"%d %.3f %s %ld %.2f %c %u %.1f %x %.4f %d %.2f %lu %.3f %d %.1f %d %.2f"
	.align	3
.LC16:
	.string	"%5d|%-5d|%05d|%*d|%-*u|%08x|%*s|%-*s|"
	.align	3
.LC17:
	.string	"y"
	.align	3
.LC18:
	.string	"z"
	.align	3
.LC19:
	.string	"truncate"
	.align	3
.LC20:
	.string	""
	.align	3
.LC21:
	.string	"%%|%c|%s|%d%%|%.3s|%010.2f|%-9.1f|"
	.align	3
.LC22:
	.string	"%lx %lo %lX %ld"
	.align	3
.LC23:
	.string	"%.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #400
	mov	w4, 10240
	mov	w6, 48879
	mov	w7, 8
	mov	w5, w6
	movk	w4, 0xee6b, lsl 16
	stp	x29, x30, [sp, 224]
	add	x29, sp, 224
	mov	w3, 17
	mov	w2, -5
	stp	x19, x20, [sp, 240]
	adrp	x19, .LANCHOR0
	add	x19, x19, :lo12:.LANCHOR0
	adrp	x20, .LC5
	mov	x0, x19
	add	x1, x20, :lo12:.LC5
	stp	x21, x22, [sp, 256]
	adrp	x21, .LC4
	stp	x23, x24, [sp, 272]
	add	x21, x21, :lo12:.LC4
	stp	x25, x26, [sp, 288]
	stp	x27, x28, [sp, 304]
	stp	d8, d9, [sp, 320]
	stp	d10, d11, [sp, 336]
	stp	d12, d13, [sp, 352]
	stp	d14, d15, [sp, 368]
	bl	mini.constprop.0
	mov	w22, w0
	mov	w0, 8
	str	w0, [sp]
	mov	w5, 10240
	mov	w7, 48879
	add	x2, x20, :lo12:.LC5
	mov	w6, w7
	add	x0, x19, 512
	movk	w5, 0xee6b, lsl 16
	mov	w4, 17
	mov	w3, -5
	mov	x1, 512
	bl	snprintf
	cmp	w22, 29
	bne	.L260
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x21, x1, x21, eq
.L260:
	mov	x4, x19
	mov	w2, w22
	adrp	x20, .LC6
	mov	w3, 29
	add	x20, x20, :lo12:.LC6
	mov	x1, x21
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L324
.L261:
	adrp	x24, .LC9
	adrp	x23, .LC10
	add	x24, x24, :lo12:.LC9
	add	x23, x23, :lo12:.LC10
	adrp	x22, .LC11
	mov	x4, 51966
	add	x22, x22, :lo12:.LC11
	mov	x2, -1227
	stp	x22, x23, [sp]
	movk	x4, 0xface, lsl 16
	movk	x2, 0x8e04, lsl 16
	str	x24, [sp, 16]
	adrp	x21, .LC8
	mov	w7, 107
	add	x1, x21, :lo12:.LC8
	mov	w6, 111
	mov	x5, 34359738368
	movk	x4, 0xfeed, lsl 32
	mov	x3, -1
	movk	x2, 0xfee0, lsl 32
	mov	x0, x19
	bl	mini.constprop.0
	mov	w25, w0
	mov	x5, 51966
	mov	w0, 107
	mov	x3, -1227
	str	w0, [sp]
	stp	x22, x23, [sp, 8]
	movk	x5, 0xface, lsl 16
	movk	x3, 0x8e04, lsl 16
	str	x24, [sp, 24]
	add	x2, x21, :lo12:.LC8
	add	x0, x19, 512
	adrp	x21, .LC4
	mov	w7, 111
	add	x21, x21, :lo12:.LC4
	mov	x6, 34359738368
	movk	x5, 0xfeed, lsl 32
	mov	x4, -1
	movk	x3, 0xfee0, lsl 32
	mov	x1, 512
	bl	snprintf
	cmp	w25, 81
	bne	.L262
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x21, x1, x21, eq
.L262:
	mov	x4, x19
	mov	w2, w25
	mov	w3, 81
	mov	x1, x21
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L325
.L263:
	mov	w28, -12
	mov	w27, 11
	mov	w26, -10
	mov	w25, 9
	mov	w24, -8
	mov	w23, 7
	str	w23, [sp]
	adrp	x21, .LC12
	str	w24, [sp, 8]
	add	x1, x21, :lo12:.LC12
	str	w25, [sp, 16]
	mov	w7, -6
	str	w26, [sp, 24]
	mov	w6, 5
	str	w27, [sp, 32]
	mov	w5, -4
	str	w28, [sp, 40]
	mov	w4, 3
	mov	w3, -2
	mov	w2, 1
	mov	x0, x19
	bl	mini.constprop.0
	add	x8, x19, 512
	mov	w22, w0
	mov	w0, -6
	str	w0, [sp]
	str	w23, [sp, 8]
	add	x2, x21, :lo12:.LC12
	str	w24, [sp, 16]
	adrp	x21, .LC4
	str	w25, [sp, 24]
	add	x21, x21, :lo12:.LC4
	str	w26, [sp, 32]
	mov	x0, x8
	str	w27, [sp, 40]
	mov	w7, 5
	str	w28, [sp, 48]
	mov	w6, -4
	mov	w5, 3
	mov	w4, -2
	mov	w3, 1
	mov	x1, 512
	str	x8, [sp, 392]
	bl	snprintf
	cmp	w22, 32
	bne	.L264
	ldr	x1, [sp, 392]
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x21, x1, x21, eq
.L264:
	mov	x4, x19
	mov	w2, w22
	mov	w3, 32
	mov	x1, x21
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L326
.L265:
	mov	x0, 140737488355328
	fmov	d11, 1.5e+0
	movk	x0, 0x4004, lsl 48
	fmov	d14, x0
	mov	x0, 274877906944
	fmov	d12, -2.5e-1
	movk	x0, 0x4090, lsl 48
	fmov	d15, x0
	fmov	d7, d14
	mov	x0, 35184372088832
	fmov	d3, d15
	movk	x0, 0x4059, lsl 48
	fmov	d6, -3.75e-1
	fmov	d13, x0
	fmov	d5, 3.75e+0
	fmov	d4, -7.5e+0
	fmov	d2, 1.25e-1
	fmov	d1, -1.25e+0
	fmov	d0, 5.0e-1
	adrp	x21, .LC13
	mov	x0, x19
	add	x1, x21, :lo12:.LC13
	stp	d13, d12, [sp]
	str	d11, [sp, 16]
	bl	mini.constprop.0
	fmov	d7, d14
	fmov	d3, d15
	fmov	d6, -3.75e-1
	fmov	d5, 3.75e+0
	fmov	d4, -7.5e+0
	fmov	d2, 1.25e-1
	fmov	d1, -1.25e+0
	fmov	d0, 5.0e-1
	mov	w22, w0
	add	x2, x21, :lo12:.LC13
	add	x0, x19, 512
	mov	x1, 512
	adrp	x21, .LC4
	add	x21, x21, :lo12:.LC4
	stp	d13, d12, [sp]
	str	d11, [sp, 16]
	bl	snprintf
	mov	w23, w0
	cmp	w22, w0
	bne	.L266
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x21, x1, x21, eq
.L266:
	mov	x4, x19
	mov	w3, w23
	mov	w2, w22
	mov	x1, x21
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L327
.L267:
	mov	x0, 70368744177664
	mov	w27, -16
	movk	x0, 0x4031, lsl 48
	fmov	d12, x0
	mov	x0, 211106232532992
	mov	w26, 14
	movk	x0, 0xc02b, lsl 48
	fmov	d13, x0
	mov	x0, 140737488355328
	fmov	d7, d12
	movk	x0, 0x4027, lsl 48
	fmov	d14, x0
	mov	x0, 35184372088832
	fmov	d5, d13
	movk	x0, 0x4022, lsl 48
	fmov	d15, x0
	fmov	d4, d14
	mov	x25, 12
	fmov	d3, d15
	mov	w24, -10
	fmov	d6, 1.55e+1
	fmov	d2, 7.5e+0
	fmov	d1, 4.25e+0
	fmov	d0, 1.25e-1
	str	w24, [sp]
	adrp	x22, .LC14
	str	x25, [sp, 8]
	add	x3, x22, :lo12:.LC14
	str	w26, [sp, 16]
	adrp	x21, .LC15
	str	w27, [sp, 24]
	add	x1, x21, :lo12:.LC15
	mov	w7, 8
	mov	w6, 6
	mov	w5, 53
	mov	x4, -3
	mov	w2, 1
	mov	x0, x19
	bl	mini.constprop.0
	fmov	d7, d12
	fmov	d5, d13
	fmov	d4, d14
	fmov	d3, d15
	mov	w23, w0
	fmov	d6, 1.55e+1
	mov	w0, 8
	fmov	d2, 7.5e+0
	fmov	d1, 4.25e+0
	fmov	d0, 1.25e-1
	str	w0, [sp]
	str	w24, [sp, 8]
	add	x4, x22, :lo12:.LC14
	str	x25, [sp, 16]
	add	x2, x21, :lo12:.LC15
	str	w26, [sp, 24]
	add	x0, x19, 512
	str	w27, [sp, 32]
	mov	w7, 6
	mov	w6, 53
	mov	x5, -3
	mov	w3, 1
	mov	x1, 512
	adrp	x21, .LC4
	bl	snprintf
	add	x21, x21, :lo12:.LC4
	mov	w22, w0
	cmp	w23, w0
	bne	.L268
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x21, x1, x21, eq
.L268:
	mov	x4, x19
	mov	w3, w22
	mov	w2, w23
	mov	x1, x21
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L328
.L269:
	mov	w28, -3
	mov	w27, 4
	mov	w26, 2748
	mov	w25, 5
	adrp	x23, .LC17
	adrp	x22, .LC18
	add	x23, x23, :lo12:.LC17
	add	x22, x22, :lo12:.LC18
	str	w25, [sp]
	adrp	x21, .LC16
	str	w26, [sp, 8]
	add	x1, x21, :lo12:.LC16
	str	w27, [sp, 16]
	mov	w3, 42
	str	x22, [sp, 24]
	mov	w2, w3
	str	w28, [sp, 32]
	mov	w7, -6
	str	x23, [sp, 40]
	mov	w6, 99
	mov	w5, 7
	mov	w4, -42
	mov	x0, x19
	bl	mini.constprop.0
	add	x8, x19, 512
	mov	w24, w0
	mov	w0, -6
	str	w0, [sp]
	str	w25, [sp, 8]
	add	x2, x21, :lo12:.LC16
	str	w26, [sp, 16]
	mov	w4, 42
	str	w27, [sp, 24]
	adrp	x21, .LC4
	str	x22, [sp, 32]
	mov	w3, w4
	str	w28, [sp, 40]
	add	x21, x21, :lo12:.LC4
	str	x23, [sp, 48]
	mov	x0, x8
	mov	w7, 99
	mov	w6, 7
	mov	w5, -42
	mov	x1, 512
	str	x8, [sp, 392]
	bl	snprintf
	cmp	w24, 51
	bne	.L270
	ldr	x1, [sp, 392]
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x21, x1, x21, eq
.L270:
	mov	x4, x19
	mov	w2, w24
	mov	w3, 51
	mov	x1, x21
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L329
.L271:
	fmov	d1, 5.0e-1
	fmov	d0, -3.5e+0
	adrp	x21, .LC21
	adrp	x23, .LC19
	add	x1, x21, :lo12:.LC21
	add	x5, x23, :lo12:.LC19
	adrp	x22, .LC20
	mov	w4, 100
	add	x3, x22, :lo12:.LC20
	mov	w2, 35
	mov	x0, x19
	bl	mini.constprop.0
	fmov	d1, 5.0e-1
	fmov	d0, -3.5e+0
	add	x2, x21, :lo12:.LC21
	mov	w24, w0
	add	x6, x23, :lo12:.LC19
	add	x4, x22, :lo12:.LC20
	add	x0, x19, 512
	mov	w5, 100
	mov	w3, 35
	mov	x1, 512
	bl	snprintf
	adrp	x21, .LC4
	add	x21, x21, :lo12:.LC4
	cmp	w24, 35
	bne	.L272
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x21, x1, x21, eq
.L272:
	mov	x4, x19
	mov	w2, w24
	mov	w3, 35
	mov	x1, x21
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L330
.L273:
	mov	x4, 52719
	adrp	x21, .LC22
	movk	x4, 0x89ab, lsl 16
	add	x1, x21, :lo12:.LC22
	movk	x4, 0x4567, lsl 32
	mov	x5, -9223372036854775808
	movk	x4, 0x123, lsl 48
	mov	x3, x5
	mov	x2, -1
	mov	x0, x19
	bl	mini.constprop.0
	mov	w22, w0
	mov	x5, 52719
	add	x2, x21, :lo12:.LC22
	movk	x5, 0x89ab, lsl 16
	mov	x6, -9223372036854775808
	movk	x5, 0x4567, lsl 32
	mov	x4, x6
	add	x0, x19, 512
	movk	x5, 0x123, lsl 48
	mov	x3, -1
	mov	x1, 512
	bl	snprintf
	adrp	x21, .LC4
	add	x21, x21, :lo12:.LC4
	cmp	w22, 76
	bne	.L274
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x21, x1, x21, eq
.L274:
	mov	x4, x19
	mov	w2, w22
	mov	w3, 76
	mov	x1, x21
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L331
.L275:
	mov	x0, 140737488355328
	fmov	d8, 1.15e+1
	movk	x0, 0x4033, lsl 48
	fmov	d12, x0
	mov	x0, 140737488355328
	fmov	d9, 1.05e+1
	movk	x0, 0x4032, lsl 48
	fmov	d13, x0
	mov	x0, 140737488355328
	fmov	d10, 9.5e+0
	movk	x0, 0x4031, lsl 48
	fmov	d14, x0
	mov	x0, 140737488355328
	fmov	d11, 8.5e+0
	mov	w14, 20
	mov	w13, 19
	mov	w12, 18
	mov	w11, 17
	mov	w10, 16
	mov	w9, 15
	mov	w8, 14
	fmov	d28, 1.55e+1
	fmov	d29, 1.45e+1
	fmov	d30, 1.35e+1
	fmov	d31, 1.25e+1
	movk	x0, 0x4030, lsl 48
	fmov	d7, 7.5e+0
	fmov	d15, x0
	fmov	d6, 6.5e+0
	fmov	d5, 5.5e+0
	fmov	d4, 4.5e+0
	fmov	d3, 3.5e+0
	fmov	d2, 2.5e+0
	fmov	d1, 1.5e+0
	fmov	d0, 5.0e-1
	mov	w23, 8
	mov	w22, 7
	mov	w28, 13
	mov	w27, 12
	mov	w26, 11
	mov	w25, 10
	mov	w24, 9
	mov	w7, 6
	mov	w6, 5
	mov	w5, 4
	mov	w4, 3
	mov	w3, 2
	mov	w2, 1
	mov	x0, x19
	adrp	x1, .LC23
	add	x1, x1, :lo12:.LC23
	stp	d11, d10, [sp]
	stp	d9, d8, [sp, 16]
	stp	d31, d30, [sp, 32]
	stp	d29, d28, [sp, 48]
	stp	d15, d14, [sp, 64]
	stp	d13, d12, [sp, 80]
	str	w22, [sp, 96]
	str	w23, [sp, 104]
	str	w24, [sp, 112]
	str	w25, [sp, 120]
	str	w26, [sp, 128]
	str	w27, [sp, 136]
	str	w28, [sp, 144]
	str	w8, [sp, 152]
	str	w9, [sp, 160]
	str	w10, [sp, 168]
	str	w11, [sp, 176]
	str	w12, [sp, 184]
	str	w13, [sp, 192]
	str	w14, [sp, 200]
	bl	mini.constprop.0
	add	x15, x19, 512
	mov	w14, 20
	mov	w13, 19
	mov	w12, 18
	mov	w11, 17
	mov	w10, 16
	mov	w9, 15
	mov	w8, 14
	fmov	d29, 1.45e+1
	fmov	d28, 1.55e+1
	fmov	d31, 1.25e+1
	fmov	d30, 1.35e+1
	mov	w21, w0
	fmov	d7, 7.5e+0
	mov	w0, 6
	fmov	d6, 6.5e+0
	fmov	d5, 5.5e+0
	fmov	d4, 4.5e+0
	fmov	d3, 3.5e+0
	fmov	d2, 2.5e+0
	fmov	d1, 1.5e+0
	fmov	d0, 5.0e-1
	str	w0, [sp, 96]
	adrp	x0, .LC23
	mov	w7, 5
	add	x2, x0, :lo12:.LC23
	mov	w6, 4
	mov	x0, x15
	mov	w5, 3
	mov	w4, 2
	mov	w3, 1
	mov	x1, 512
	stp	d11, d10, [sp]
	stp	d9, d8, [sp, 16]
	stp	d31, d30, [sp, 32]
	stp	d29, d28, [sp, 48]
	stp	d15, d14, [sp, 64]
	stp	d13, d12, [sp, 80]
	str	w22, [sp, 104]
	adrp	x22, .LC4
	add	x22, x22, :lo12:.LC4
	str	w23, [sp, 112]
	str	w24, [sp, 120]
	str	w25, [sp, 128]
	str	w26, [sp, 136]
	str	w27, [sp, 144]
	str	w28, [sp, 152]
	str	w8, [sp, 160]
	str	w9, [sp, 168]
	str	w10, [sp, 176]
	str	w11, [sp, 184]
	str	w12, [sp, 192]
	str	w13, [sp, 200]
	str	w14, [sp, 208]
	str	x15, [sp, 392]
	bl	snprintf
	mov	w23, w0
	cmp	w21, w0
	bne	.L276
	ldr	x1, [sp, 392]
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x22, x1, x22, eq
.L276:
	mov	x4, x19
	mov	w3, w23
	mov	w2, w21
	mov	x1, x22
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L332
.L277:
	ldp	x29, x30, [sp, 224]
	mov	w0, 0
	ldp	x19, x20, [sp, 240]
	ldp	x21, x22, [sp, 256]
	ldp	x23, x24, [sp, 272]
	ldp	x25, x26, [sp, 288]
	ldp	x27, x28, [sp, 304]
	ldp	d8, d9, [sp, 320]
	ldp	d10, d11, [sp, 336]
	ldp	d12, d13, [sp, 352]
	ldp	d14, d15, [sp, 368]
	add	sp, sp, 400
	ret
.L331:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L275
.L327:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L267
.L326:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L265
.L325:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L263
.L324:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L261
.L329:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L271
.L328:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L269
.L330:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L273
.L332:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L277
	.section .rodata
	.align	4
	.LANCHOR1:
.LC2:
	.byte	15
	.byte	14
	.byte	13
	.byte	12
	.byte	11
	.byte	10
	.byte	9
	.byte	8
	.byte	7
	.byte	6
	.byte	5
	.byte	4
	.byte	3
	.byte	2
	.byte	1
	.byte	0
	.bss
	.align	4
	.LANCHOR0:
A:
	.zero	512
B:
	.zero	512

