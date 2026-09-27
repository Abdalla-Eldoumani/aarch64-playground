	.text
	.align	2
	.align 5
field:
	eor	w6, w4, 1
	cmp	w2, 0
	mov	x8, x0
	cset	w7, ne
	and	w0, w5, w6
	and	w0, w0, w7
	cmp	w3, w2
	ble	.L2
	and	w4, w4, 1
	sub	w3, w3, w2
	cbnz	w0, .L26
	mov	w9, 0
	tbz	x6, 0, .L9
.L8:
	mov	w9, 0
.L5:
	tst	x5, 1
	mov	w0, 32
	mov	w6, 48
	csel	w6, w6, w0, ne
	add	x0, x8, w9, sxtw
	mov	x5, 0
	.align 5
.L10:
	strb	w6, [x0, x5]
	add	x5, x5, 1
	cmp	w3, w5
	bgt	.L10
	add	w0, w9, w3
.L9:
	cmp	w9, w2
	bge	.L11
.L6:
	sxtw	x5, w9
	add	x7, x8, w0, sxtw
	sub	x7, x7, x5
	.align 5
.L12:
	ldrb	w6, [x1, x5]
	strb	w6, [x7, x5]
	add	x5, x5, 1
	cmp	w2, w5
	bgt	.L12
	sub	w1, w2, #1
	cmp	w9, w2
	sub	w1, w1, w9
	add	w0, w0, 1
	csel	w1, w1, wzr, lt
	add	w0, w1, w0
.L11:
	cbz	w4, .L1
	add	x4, x8, w0, sxtw
	mov	x1, 0
	mov	w2, 32
	.align 5
.L14:
	strb	w2, [x4, x1]
	add	x1, x1, 1
	cmp	w3, w1
	bgt	.L14
	cmp	w3, 0
	add	w0, w0, 1
	cset	w1, ne
	sub	w3, w3, w1
	add	w0, w3, w0
.L1:
	ret
	.align 2
.L2:
	cbz	w0, .L27
	ldrb	w0, [x1]
	cmp	w0, 45
	beq	.L16
	mov	w4, 0
	mov	w3, 0
	mov	w0, 0
	mov	w9, 0
	b	.L6
	.align 2
.L16:
	strb	w0, [x8]
	cmp	w2, 1
	beq	.L7
	mov	w0, 1
	mov	w4, 0
	mov	w9, w0
	mov	w3, 0
	b	.L6
.L27:
	cbz	w2, .L7
	mov	w4, w0
	mov	w3, 0
	mov	w0, 0
	mov	w9, 0
	b	.L6
.L7:
	mov	w0, w2
	ret
.L26:
	ldrb	w0, [x1]
	cmp	w0, 45
	bne	.L8
	mov	w9, 1
	strb	w0, [x8]
	b	.L5
	.section .rodata
	.align	3
.LC0:
	.string	"0123456789ABCDEF"
	.align	3
.LC1:
	.string	"0123456789abcdef"
	.text
	.align	2
	.align 5
digits:
	sub	sp, sp, #32
	cbz	w4, .L35
	adrp	x9, .LC0
	add	x9, x9, :lo12:.LC0
.L29:
	uxtw	x3, w3
	add	x6, sp, 8
	mov	x4, 1
	.align 5
.L30:
	udiv	x5, x1, x3
	add	x7, x6, x4
	cmp	x3, x1
	msub	x8, x5, x3, x1
	mov	x1, x5
	mov	x5, x4
	add	x4, x4, 1
	ldrb	w8, [x9, x8]
	strb	w8, [x7, -1]
	bls	.L30
	mov	w4, w5
	cbz	w2, .L31
	mov	w1, 45
	strb	w1, [x0]
.L31:
	cmp	w5, 15
	ble	.L36
	sub	x1, sp, #8
	ldr	q31, [x1, w5, sxtw]
	adrp	x1, .LANCHOR0
	ldr	q30, [x1, :lo12:.LANCHOR0]
	tbl	v30.16b, {v31.16b}, v30.16b
	str	q30, [x0, w2, sxtw]
	cmp	w5, 16
	beq	.L33
	sub	w4, w5, #16
	add	w7, w2, 16
.L34:
	sub	w4, w4, #1
	sxtw	x7, w7
	add	x1, x6, x4
	add	x6, x0, 1
	add	x4, x4, x7
	add	x3, x0, x7
	add	x6, x6, x4
	.align 5
.L32:
	ldrb	w4, [x1], -1
	strb	w4, [x3], 1
	cmp	x3, x6
	bne	.L32
.L33:
	add	w0, w2, w5
	add	sp, sp, 32
	ret
	.align 2
.L35:
	adrp	x9, .LC1
	add	x9, x9, :lo12:.LC1
	b	.L29
	.align 2
.L36:
	mov	w7, w2
	b	.L34
	.align	2
	.align 5
fixed:
	fcmpe	d0, #0.0
	stp	x29, x30, [sp, -16]!
	mov	x13, x0
	mov	x29, sp
	bmi	.L52
	mov	w11, 0
	cbz	w1, .L46
.L57:
	mov	w2, 0
	mov	x10, 1
	.align 5
.L47:
	add	x10, x10, x10, lsl 2
	add	w2, w2, 1
	lsl	x10, x10, 1
	cmp	w1, w2
	bne	.L47
	ucvtf	d31, x10
	mov	w2, 0
	mov	w4, 0
	mov	w3, 10
	fmul	d31, d31, d0
	fcvtzu	x12, d31
	udiv	x1, x12, x10
	bl	digits
	add	w2, w11, w0
	mov	w0, 46
	strb	w0, [x13, w2, sxtw]
	cmp	x10, 9
	bls	.L48
	mov	x4, -3689348814741910324
	add	w1, w2, 2
	movk	x4, 0xcccd, lsl 0
	add	x2, x13, w2, sxtw
	sub	x2, x2, x1
	umulh	x10, x10, x4
	add	x2, x2, 1
	lsr	x10, x10, 3
	.align 5
.L49:
	udiv	x3, x12, x10
	umulh	x0, x3, x4
	lsr	x0, x0, 3
	add	x0, x0, x0, lsl 2
	sub	x0, x3, x0, lsl 1
	mov	x3, x10
	umulh	x10, x10, x4
	add	w0, w0, 48
	strb	w0, [x2, x1]
	mov	x0, x1
	add	x1, x1, 1
	lsr	x10, x10, 3
	cmp	x3, 9
	bhi	.L49
	ldp	x29, x30, [sp], 16
	ret
	.align 2
.L48:
	add	w0, w2, 1
	ldp	x29, x30, [sp], 16
	ret
	.align 2
.L52:
	mov	w2, 45
	strb	w2, [x0], 1
	fneg	d0, d0
	mov	w11, 1
	cbnz	w1, .L57
.L46:
	fcvtzu	x1, d0
	mov	w4, 0
	mov	w3, 10
	mov	w2, 0
	bl	digits
	add	w0, w11, w0
	ldp	x29, x30, [sp], 16
	ret
	.align	2
	.align 5
mini__constprop__0:
	sub	sp, sp, #704
	add	x8, sp, 656
	add	x0, sp, 528
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x21, x22, [sp, 32]
	stp	x2, x3, [x8]
	stp	x4, x5, [x8, 16]
	str	x6, [sp, 688]
	str	x7, [sp, 696]
	str	q0, [x0]
	add	x0, sp, 544
	str	q1, [x0]
	add	x0, sp, 560
	str	q2, [x0]
	add	x0, sp, 576
	str	q3, [x0]
	add	x0, sp, 592
	str	q4, [x0]
	add	x0, sp, 608
	str	q5, [x0]
	add	x0, sp, 624
	str	q6, [x0]
	add	x0, sp, 640
	str	q7, [x0]
	add	x0, sp, 704
	stp	x0, x0, [sp, 96]
	add	x0, sp, 656
	str	x0, [sp, 112]
	mov	w0, -48
	str	w0, [sp, 120]
	mov	w0, -128
	str	w0, [sp, 124]
	ldrb	w0, [x1]
	cbz	w0, .L124
	adrp	x22, .LANCHOR1
	mov	w18, 0
	add	x22, x22, :lo12:.LANCHOR1
	mov	w21, 122
	stp	x19, x20, [sp, 16]
	mov	w20, 45
	mov	w19, 108
	stp	x23, x24, [sp, 48]
	str	x25, [sp, 64]
	b	.L114
	.align 2
.L206:
	add	w18, w18, 1
	mov	x14, x1
	strb	w0, [x22, x2]
.L61:
	ldrb	w0, [x14, 1]
	add	x1, x14, 1
	cbz	w0, .L205
.L114:
	sxtw	x2, w18
	add	x23, x22, x2
	cmp	w0, 37
	bne	.L206
	ldrb	w0, [x1, 1]
	add	x14, x1, 1
	mov	w5, 0
	mov	w24, 0
	cmp	w0, 48
	ccmp	w0, w20, 4, ne
	beq	.L64
	b	.L62
	.align 2
.L126:
	ldrb	w0, [x14, 1]!
	mov	w5, 1
	cmp	w0, 48
	ccmp	w0, w20, 4, ne
	bne	.L62
.L64:
	cmp	w0, 45
	bne	.L126
	ldrb	w0, [x14, 1]!
	mov	w24, 1
	cmp	w0, 48
	ccmp	w0, w20, 4, ne
	beq	.L64
.L62:
	mov	w15, 0
	cmp	w0, 42
	beq	.L207
.L65:
	ldrb	w2, [x14]
	sub	w0, w2, #48
	and	w1, w0, 255
	cmp	w1, 9
	bhi	.L71
	.align 5
.L70:
	ldrb	w2, [x14, 1]!
	add	w15, w15, w15, lsl 2
	add	w15, w0, w15, lsl 1
	sub	w0, w2, #48
	and	w1, w0, 255
	cmp	w1, 9
	bls	.L70
.L71:
	mov	x1, 4294967295
	cmp	w2, 46
	beq	.L208
.L72:
	ldrb	w0, [x14]
	cmp	w0, 122
	ccmp	w0, w19, 4, ne
	bne	.L209
	.align 5
.L74:
	ldrb	w0, [x14, 1]!
	cmp	w0, 108
	ccmp	w0, w21, 4, ne
	beq	.L74
	cmp	w0, 102
	beq	.L77
	bls	.L210
	cmp	w0, 115
	beq	.L83
	bhi	.L84
	cmp	w0, 105
	bne	.L211
.L80:
	ldr	w1, [sp, 120]
	ldr	x0, [sp, 96]
	tbnz	w1, #31, .L212
.L202:
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 96]
.L86:
	ldr	x1, [x0]
.L89:
	cmp	x1, 0
	add	x25, sp, 128
	lsr	x2, x1, 63
	mov	x0, x25
	csneg	x1, x1, x1, ge
	mov	w4, 0
	mov	w3, 10
	str	w5, [sp, 92]
	bl	digits
	ldr	w5, [sp, 92]
	mov	w2, w0
	b	.L93
	.align 2
.L205:
	ldp	x19, x20, [sp, 16]
	ldp	x23, x24, [sp, 48]
	ldr	x25, [sp, 64]
.L59:
	strb	wzr, [x22, w18, sxtw]
	mov	w0, w18
	ldp	x29, x30, [sp]
	ldp	x21, x22, [sp, 32]
	add	sp, sp, 704
	ret
	.align 2
.L207:
	ldr	w0, [sp, 120]
	ldr	x1, [sp, 96]
	tbnz	w0, #31, .L213
.L66:
	add	x0, x1, 11
	and	x0, x0, -8
	str	x0, [sp, 96]
.L68:
	ldr	w15, [x1]
	add	x14, x14, 1
	cmp	w15, 0
	csneg	w15, w15, w15, ge
	csinc	w24, w24, wzr, ge
	b	.L65
	.align 2
.L210:
	cmp	w0, 99
	beq	.L79
	cmp	w0, 100
	beq	.L80
	cmp	w0, 88
	beq	.L81
.L82:
	add	x25, sp, 128
	mov	w2, 1
	strb	w0, [sp, 128]
	b	.L93
.L79:
	ldr	w1, [sp, 120]
	ldr	x0, [sp, 96]
	tbnz	w1, #31, .L214
.L102:
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 96]
.L104:
	ldr	w0, [x0]
	add	x25, sp, 128
	mov	w2, 1
	mov	w5, 0
	strb	w0, [sp, 128]
	.align 5
.L93:
	mov	w4, w24
	mov	w3, w15
	mov	x1, x25
	mov	x0, x23
	bl	field
	add	w18, w18, w0
	b	.L61
.L213:
	add	w2, w0, 8
	str	w2, [sp, 120]
	cmp	w2, 0
	bgt	.L66
	ldr	x1, [sp, 104]
	add	x1, x1, w0, sxtw
	b	.L68
.L84:
	cmp	w0, 117
	beq	.L81
	cmp	w0, 120
	bne	.L82
.L81:
	ldr	w2, [sp, 120]
	ldr	x1, [sp, 96]
	tbnz	w2, #31, .L215
.L94:
	add	x2, x1, 15
	and	x2, x2, -8
	str	x2, [sp, 96]
.L96:
	ldr	x1, [x1]
.L97:
	cmp	w0, 111
	beq	.L130
	cmp	w0, 117
	mov	w3, 16
	mov	w2, 10
	csel	w3, w3, w2, ne
.L101:
	cmp	w0, 88
	add	x25, sp, 128
	mov	w2, 0
	cset	w4, eq
	mov	x0, x25
	str	w5, [sp, 92]
	bl	digits
	mov	w2, w0
	ldr	w5, [sp, 92]
	b	.L93
.L83:
	ldr	w2, [sp, 120]
	ldr	x0, [sp, 96]
	tbnz	w2, #31, .L216
.L105:
	add	x2, x0, 15
	and	x2, x2, -8
	str	x2, [sp, 96]
.L107:
	ldr	x3, [x0]
	ldrb	w0, [x3]
	cbz	w0, .L132
	add	x4, x1, 1
	add	x25, sp, 128
	sub	x3, x3, #1
	mov	x2, 1
	b	.L108
	.align 2
.L109:
	add	x1, x25, x2
	strb	w0, [x1, -1]
	add	x1, x2, 1
	ldrb	w0, [x3, x1]
	cbz	w0, .L204
	mov	x2, x1
.L108:
	cmp	x4, x2
	bne	.L109
	sub	w2, w4, #1
.L204:
	mov	w5, 0
	b	.L93
.L77:
	ldr	w2, [sp, 124]
	ldr	x0, [sp, 96]
	tbnz	w2, #31, .L217
.L110:
	add	x2, x0, 15
	and	x2, x2, -8
	str	x2, [sp, 96]
.L112:
	ldr	d0, [x0]
	cmp	w1, 0
	mov	w2, 6
	add	x25, sp, 128
	csel	w1, w1, w2, ge
	mov	x0, x25
	str	w5, [sp, 92]
	bl	fixed
	ldr	w5, [sp, 92]
	mov	w2, w0
	b	.L93
.L208:
	ldrb	w0, [x14, 1]
	add	x14, x14, 1
	sub	w0, w0, #48
	and	w1, w0, 255
	cmp	w1, 9
	bhi	.L129
	mov	w1, 0
	.align 5
.L73:
	add	w1, w1, w1, lsl 2
	add	w1, w0, w1, lsl 1
	ldrb	w0, [x14, 1]!
	sub	w0, w0, #48
	and	w2, w0, 255
	cmp	w2, 9
	bls	.L73
	b	.L72
.L209:
	cmp	w0, 102
	beq	.L77
	bls	.L218
	cmp	w0, 115
	beq	.L83
	bhi	.L119
	cmp	w0, 105
	beq	.L116
	cmp	w0, 111
	bne	.L82
.L117:
	ldr	w2, [sp, 120]
	ldr	x1, [sp, 96]
	tbnz	w2, #31, .L219
.L98:
	add	x2, x1, 11
	ldr	w1, [x1]
	and	x2, x2, -8
	str	x2, [sp, 96]
	b	.L97
.L211:
	cmp	w0, 111
	bne	.L82
	b	.L81
.L218:
	cmp	w0, 99
	beq	.L79
	cmp	w0, 100
	beq	.L116
	cmp	w0, 88
	bne	.L82
	b	.L117
.L116:
	ldr	w1, [sp, 120]
	ldr	x0, [sp, 96]
	tbnz	w1, #31, .L220
.L203:
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 96]
	ldrsw	x1, [x0]
	b	.L89
.L217:
	add	w3, w2, 16
	str	w3, [sp, 124]
	cmp	w3, 0
	bgt	.L110
	ldr	x0, [sp, 112]
	add	x0, x0, w2, sxtw
	b	.L112
.L216:
	add	w3, w2, 8
	str	w3, [sp, 120]
	cmp	w3, 0
	bgt	.L105
	ldr	x0, [sp, 104]
	add	x0, x0, w2, sxtw
	b	.L107
.L214:
	add	w2, w1, 8
	str	w2, [sp, 120]
	cmp	w2, 0
	bgt	.L102
	ldr	x0, [sp, 104]
	add	x0, x0, w1, sxtw
	b	.L104
.L130:
	mov	w3, 8
	b	.L101
.L124:
	adrp	x22, .LANCHOR1
	mov	w18, 0
	add	x22, x22, :lo12:.LANCHOR1
	b	.L59
.L212:
	add	w2, w1, 8
	str	w2, [sp, 120]
	cmp	w2, 0
	bgt	.L202
	ldr	x0, [sp, 104]
	add	x0, x0, w1, sxtw
	b	.L86
.L220:
	add	w2, w1, 8
	str	w2, [sp, 120]
	cmp	w2, 0
	bgt	.L203
	ldr	x0, [sp, 104]
	add	x0, x0, w1, sxtw
	ldrsw	x1, [x0]
	b	.L89
.L215:
	add	w3, w2, 8
	str	w3, [sp, 120]
	cmp	w3, 0
	bgt	.L94
	ldr	x1, [sp, 104]
	add	x1, x1, w2, sxtw
	b	.L96
.L119:
	cmp	w0, 117
	beq	.L117
	cmp	w0, 120
	bne	.L82
	b	.L117
.L219:
	add	w3, w2, 8
	str	w3, [sp, 120]
	cmp	w3, 0
	bgt	.L98
	ldr	x1, [sp, 104]
	add	x1, x1, w2, sxtw
	ldr	w1, [x1]
	b	.L97
.L129:
	mov	x1, 0
	b	.L72
.L132:
	add	x25, sp, 128
	mov	w2, 0
	mov	w5, 0
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
	.align 5
	.global	main
main:
	sub	sp, sp, #336
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
	adrp	x19, .LANCHOR1
	add	x19, x19, :lo12:.LANCHOR1
	adrp	x20, .LC5
	mov	x0, x19
	add	x1, x20, :lo12:.LC5
	stp	x21, x22, [sp, 256]
	adrp	x21, .LC4
	stp	x23, x24, [sp, 272]
	add	x21, x21, :lo12:.LC4
	stp	x25, x26, [sp, 288]
	stp	x27, x28, [sp, 304]
	bl	mini__constprop__0
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
	mov	w23, w0
	cmp	w22, w0
	bne	.L222
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x21, x1, x21, eq
.L222:
	mov	x4, x19
	mov	w3, w23
	mov	w2, w22
	adrp	x20, .LC6
	add	x20, x20, :lo12:.LC6
	mov	x1, x21
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L286
.L223:
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
	bl	mini__constprop__0
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
	mov	w7, 111
	mov	x6, 34359738368
	movk	x5, 0xfeed, lsl 32
	mov	x4, -1
	movk	x3, 0xfee0, lsl 32
	mov	x1, 512
	adrp	x21, .LC4
	bl	snprintf
	add	x21, x21, :lo12:.LC4
	mov	w22, w0
	cmp	w25, w0
	bne	.L224
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x21, x1, x21, eq
.L224:
	mov	x4, x19
	mov	w3, w22
	mov	w2, w25
	mov	x1, x21
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L287
.L225:
	mov	w23, 7
	mov	w28, -12
	mov	w27, 11
	mov	w26, -10
	mov	w25, 9
	mov	w24, -8
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
	bl	mini__constprop__0
	add	x8, x19, 512
	mov	w22, w0
	mov	w0, -6
	str	w0, [sp]
	str	w23, [sp, 8]
	add	x2, x21, :lo12:.LC12
	str	w24, [sp, 16]
	mov	x0, x8
	str	w25, [sp, 24]
	mov	w7, 5
	str	w26, [sp, 32]
	mov	w6, -4
	str	w27, [sp, 40]
	mov	w5, 3
	str	w28, [sp, 48]
	mov	w4, -2
	mov	w3, 1
	mov	x1, 512
	adrp	x21, .LC4
	add	x21, x21, :lo12:.LC4
	str	x8, [sp, 328]
	bl	snprintf
	mov	w23, w0
	cmp	w22, w0
	bne	.L226
	ldr	x1, [sp, 328]
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x21, x1, x21, eq
.L226:
	mov	x4, x19
	mov	w3, w23
	mov	w2, w22
	mov	x1, x21
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L288
.L227:
	mov	x2, 140737488355328
	mov	x1, 274877906944
	mov	x0, 35184372088832
	movk	x2, 0x4004, lsl 48
	fmov	d27, 1.5e+0
	fmov	d28, -2.5e-1
	fmov	d7, x2
	movk	x1, 0x4090, lsl 48
	movk	x0, 0x4059, lsl 48
	fmov	d3, x1
	fmov	d29, x0
	fmov	d6, -3.75e-1
	fmov	d5, 3.75e+0
	fmov	d4, -7.5e+0
	fmov	d2, 1.25e-1
	fmov	d1, -1.25e+0
	fmov	d0, 5.0e-1
	adrp	x21, .LC13
	mov	x0, x19
	add	x1, x21, :lo12:.LC13
	stp	d29, d28, [sp]
	str	d27, [sp, 16]
	bl	mini__constprop__0
	fmov	d0, 5.0e-1
	mov	w22, w0
	add	x2, x21, :lo12:.LC13
	add	x0, x19, 512
	mov	x1, 512
	adrp	x21, .LC4
	add	x21, x21, :lo12:.LC4
	stp	d29, d28, [sp]
	str	d27, [sp, 16]
	bl	snprintf
	mov	w23, w0
	cmp	w22, w0
	bne	.L228
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x21, x1, x21, eq
.L228:
	mov	x4, x19
	mov	w3, w23
	mov	w2, w22
	mov	x1, x21
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L289
.L229:
	mov	x3, 70368744177664
	mov	x2, 211106232532992
	mov	x1, 140737488355328
	mov	x0, 35184372088832
	movk	x3, 0x4031, lsl 48
	movk	x2, 0xc02b, lsl 48
	fmov	d7, x3
	fmov	d5, x2
	movk	x1, 0x4027, lsl 48
	movk	x0, 0x4022, lsl 48
	fmov	d4, x1
	fmov	d3, x0
	mov	w27, -16
	mov	w26, 14
	mov	x25, 12
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
	bl	mini__constprop__0
	mov	w23, w0
	fmov	d0, 1.25e-1
	mov	w0, 8
	str	w0, [sp]
	add	x4, x22, :lo12:.LC14
	str	w24, [sp, 8]
	add	x2, x21, :lo12:.LC15
	str	x25, [sp, 16]
	add	x0, x19, 512
	str	w26, [sp, 24]
	mov	w7, 6
	str	w27, [sp, 32]
	mov	w6, 53
	mov	x5, -3
	mov	w3, 1
	mov	x1, 512
	adrp	x21, .LC4
	bl	snprintf
	add	x21, x21, :lo12:.LC4
	mov	w22, w0
	cmp	w23, w0
	bne	.L230
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x21, x1, x21, eq
.L230:
	mov	x4, x19
	mov	w3, w22
	mov	w2, w23
	mov	x1, x21
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L290
.L231:
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
	bl	mini__constprop__0
	add	x8, x19, 512
	mov	w24, w0
	mov	w0, -6
	str	w0, [sp]
	str	w25, [sp, 8]
	add	x2, x21, :lo12:.LC16
	str	w26, [sp, 16]
	mov	w4, 42
	str	w27, [sp, 24]
	mov	w3, w4
	str	x22, [sp, 32]
	mov	x0, x8
	str	w28, [sp, 40]
	mov	w7, 99
	str	x23, [sp, 48]
	mov	w6, 7
	mov	w5, -42
	mov	x1, 512
	adrp	x21, .LC4
	add	x21, x21, :lo12:.LC4
	str	x8, [sp, 328]
	bl	snprintf
	mov	w22, w0
	cmp	w24, w0
	bne	.L232
	ldr	x1, [sp, 328]
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x21, x1, x21, eq
.L232:
	mov	x4, x19
	mov	w3, w22
	mov	w2, w24
	mov	x1, x21
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L291
.L233:
	fmov	d1, 5.0e-1
	fmov	d0, -3.5e+0
	adrp	x22, .LC20
	adrp	x21, .LC21
	add	x3, x22, :lo12:.LC20
	add	x1, x21, :lo12:.LC21
	adrp	x23, .LC19
	mov	w4, 100
	add	x5, x23, :lo12:.LC19
	mov	w2, 35
	mov	x0, x19
	bl	mini__constprop__0
	fmov	d0, -3.5e+0
	mov	w24, w0
	add	x4, x22, :lo12:.LC20
	add	x2, x21, :lo12:.LC21
	add	x6, x23, :lo12:.LC19
	add	x0, x19, 512
	mov	w5, 100
	mov	w3, 35
	mov	x1, 512
	adrp	x21, .LC4
	bl	snprintf
	add	x21, x21, :lo12:.LC4
	mov	w22, w0
	cmp	w24, w0
	bne	.L234
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x21, x1, x21, eq
.L234:
	mov	x4, x19
	mov	w3, w22
	mov	w2, w24
	mov	x1, x21
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L292
.L235:
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
	bl	mini__constprop__0
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
	adrp	x21, .LC4
	bl	snprintf
	add	x21, x21, :lo12:.LC4
	mov	w23, w0
	cmp	w22, w0
	bne	.L236
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x21, x1, x21, eq
.L236:
	mov	x4, x19
	mov	w3, w23
	mov	w2, w22
	mov	x1, x21
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L293
.L237:
	mov	x0, 140737488355328
	mov	w14, 20
	movk	x0, 0x4033, lsl 48
	fmov	d26, x0
	mov	x0, 140737488355328
	mov	w13, 19
	movk	x0, 0x4032, lsl 48
	fmov	d27, x0
	mov	x0, 140737488355328
	mov	w12, 18
	movk	x0, 0x4031, lsl 48
	fmov	d28, x0
	mov	x0, 140737488355328
	mov	w11, 17
	mov	w10, 16
	mov	w9, 15
	mov	w8, 14
	fmov	d18, 1.55e+1
	fmov	d19, 1.45e+1
	fmov	d20, 1.35e+1
	fmov	d21, 1.25e+1
	fmov	d22, 1.15e+1
	fmov	d23, 1.05e+1
	fmov	d24, 9.5e+0
	fmov	d25, 8.5e+0
	movk	x0, 0x4030, lsl 48
	fmov	d7, 7.5e+0
	fmov	d29, x0
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
	stp	d25, d24, [sp]
	stp	d23, d22, [sp, 16]
	stp	d21, d20, [sp, 32]
	stp	d19, d18, [sp, 48]
	stp	d29, d28, [sp, 64]
	stp	d27, d26, [sp, 80]
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
	bl	mini__constprop__0
	add	x15, x19, 512
	mov	w14, 20
	mov	w13, 19
	mov	w12, 18
	mov	w11, 17
	mov	w10, 16
	mov	w9, 15
	mov	w8, 14
	mov	w21, w0
	fmov	d0, 5.0e-1
	mov	w0, 6
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
	stp	d25, d24, [sp]
	stp	d23, d22, [sp, 16]
	stp	d21, d20, [sp, 32]
	stp	d19, d18, [sp, 48]
	stp	d29, d28, [sp, 64]
	stp	d27, d26, [sp, 80]
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
	str	x15, [sp, 328]
	bl	snprintf
	mov	w23, w0
	cmp	w21, w0
	bne	.L238
	ldr	x1, [sp, 328]
	mov	x0, x19
	bl	strcmp
	cmp	w0, 0
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	csel	x22, x1, x22, eq
.L238:
	mov	x4, x19
	mov	w3, w23
	mov	w2, w21
	mov	x1, x22
	mov	x0, x20
	bl	printf
	add	x1, x19, 512
	mov	x0, x19
	bl	strcmp
	cbnz	w0, .L294
.L239:
	ldp	x29, x30, [sp, 224]
	mov	w0, 0
	ldp	x19, x20, [sp, 240]
	ldp	x21, x22, [sp, 256]
	ldp	x23, x24, [sp, 272]
	ldp	x25, x26, [sp, 288]
	ldp	x27, x28, [sp, 304]
	add	sp, sp, 336
	ret
.L293:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L237
.L289:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L229
.L288:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L227
.L287:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L225
.L286:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L223
.L291:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L233
.L290:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L231
.L292:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L235
.L294:
	add	x1, x19, 512
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L239
	.section .rodata
	.align	4
	.LANCHOR0:
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
	.LANCHOR1:
A:
	.zero	512
B:
	.zero	512

