	.text
	.section .rodata
	.align	3
.LC0:
	.string	"overflow"
	.align	3
.LC1:
	.string	"expected ')'"
	.align	3
.LC2:
	.string	"expected a number"
	.align	3
.LC3:
	.string	"number too big"
	.align	3
.LC4:
	.string	"negative exponent"
	.text
	.align	2
	.p2align 5,,15
unary:
	stp	x29, x30, [sp, -32]!
	adrp	x6, .LANCHOR0
	mov	x29, sp
	ldr	x2, [x6, :lo12:.LANCHOR0]
	ldrb	w0, [x2]
	cmp	w0, 32
	bne	.L2
	add	x1, x2, 1
	.p2align 5,,15
.L3:
	mov	x2, x1
	ldrb	w0, [x1], 1
	cmp	w0, 32
	beq	.L3
	str	x2, [x6, :lo12:.LANCHOR0]
.L2:
	cmp	w0, 45
	beq	.L65
	cmp	w0, 40
	beq	.L66
	add	x10, x6, :lo12:.LANCHOR0
	sub	w0, w0, #48
	and	w0, w0, 255
	ldr	x3, [x6, :lo12:.LANCHOR0]
	ldr	x9, [x10, 8]
	cmp	w0, 9
	bhi	.L18
	mov	x4, x3
	mov	x7, -3689348814741910324
	mov	x1, 0
	mov	x8, 9223372036854775807
	movk	x7, 0xcccd, lsl 0
	ldrb	w2, [x4], 1
	sub	w0, w2, #48
	and	w5, w0, 255
	cmp	w5, 9
	bls	.L23
	b	.L17
	.p2align 2,,3
.L21:
	ldrb	w2, [x4]
	add	x1, x1, x1, lsl 2
	add	x4, x4, 1
	add	x1, x0, x1, lsl 1
	sub	w0, w2, #48
	and	w5, w0, 255
	cmp	w5, 9
	bhi	.L67
.L23:
	sxtw	x0, w0
	mov	x3, x4
	sub	x2, x8, x0
	umulh	x2, x2, x7
	cmp	x1, x2, lsr 3
	ble	.L21
	str	x4, [x6, :lo12:.LANCHOR0]
	cbz	x9, .L68
.L16:
	ldrb	w0, [x3]
	mov	x1, 0
	cmp	w0, 32
	bne	.L10
.L38:
	add	x0, x3, 1
	.p2align 5,,15
.L25:
	mov	x3, x0
	ldrb	w2, [x0], 1
	cmp	w2, 32
	beq	.L25
	ldr	x9, [x10, 8]
	str	x3, [x6, :lo12:.LANCHOR0]
.L24:
	cmp	w2, 94
	ccmp	x9, 0, 0, eq
	beq	.L69
.L1:
	mov	x0, x1
	ldp	x29, x30, [sp], 32
	ret
	.p2align 2,,3
.L18:
	cbnz	x9, .L16
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	str	x0, [x10, 8]
	ldr	x0, [x10, 24]
	sub	x2, x2, x0
	str	w2, [x10, 16]
	b	.L16
	.p2align 2,,3
.L69:
	add	x3, x3, 1
	str	x3, [x6, :lo12:.LANCHOR0]
	stp	x1, x10, [sp, 16]
	bl	unary
	ldr	x10, [sp, 24]
	adrp	x6, .LANCHOR0
	ldr	x2, [x10, 8]
	cbz	x2, .L70
.L10:
	mov	x1, 0
.L71:
	mov	x0, x1
	ldp	x29, x30, [sp], 32
	ret
	.p2align 2,,3
.L67:
	str	x3, [x6, :lo12:.LANCHOR0]
.L17:
	cmp	w2, 32
	beq	.L38
	b	.L24
	.p2align 2,,3
.L65:
	add	x2, x2, 1
	str	x2, [x6, :lo12:.LANCHOR0]
	bl	unary
	negs	x1, x0
	adrp	x6, .LANCHOR0
	bvc	.L1
	add	x0, x6, :lo12:.LANCHOR0
	ldr	x1, [x0, 8]
	cbnz	x1, .L10
	adrp	x1, .LC0
	add	x1, x1, :lo12:.LC0
	ldr	x2, [x0, 24]
	str	x1, [x0, 8]
	ldr	x1, [x6, :lo12:.LANCHOR0]
	sub	x1, x1, x2
	str	w1, [x0, 16]
	mov	x1, 0
	b	.L71
.L68:
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	str	x0, [x10, 8]
	ldr	x0, [x10, 24]
	sub	x0, x4, x0
	str	w0, [x10, 16]
	b	.L16
	.p2align 2,,3
.L66:
	add	x2, x2, 1
	str	x2, [x6, :lo12:.LANCHOR0]
	bl	cond
	mov	x1, x0
	adrp	x6, .LANCHOR0
	ldr	x0, [x6, :lo12:.LANCHOR0]
	ldrb	w2, [x0]
	cmp	w2, 32
	bne	.L12
	add	x0, x0, 1
	.p2align 5,,15
.L13:
	mov	x3, x0
	ldrb	w2, [x0], 1
	cmp	w2, 32
	beq	.L13
	mov	x0, x3
	str	x3, [x6, :lo12:.LANCHOR0]
.L12:
	add	x10, x6, :lo12:.LANCHOR0
	ldr	x9, [x10, 8]
	cbz	x9, .L72
	ldr	x3, [x6, :lo12:.LANCHOR0]
	b	.L16
.L72:
	cmp	w2, 41
	bne	.L73
	add	x3, x0, 1
	ldrb	w2, [x0, 1]
	str	x3, [x6, :lo12:.LANCHOR0]
	b	.L17
.L73:
	adrp	x1, .LC1
	add	x1, x1, :lo12:.LC1
	str	x1, [x10, 8]
	ldr	x1, [x10, 24]
	ldr	x3, [x6, :lo12:.LANCHOR0]
	sub	x0, x0, x1
	str	w0, [x10, 16]
	b	.L16
.L70:
	tbnz	x0, #63, .L26
	ldr	x2, [sp, 16]
	mov	x1, 1
	cbz	x0, .L1
	.p2align 5,,15
.L27:
	tbz	x0, 0, .L28
	mul	x3, x2, x1
	smulh	x1, x2, x1
	cmp	x1, x3, asr 63
	bne	.L34
	mov	x1, x3
	cmp	x0, 1
	beq	.L1
.L28:
	mul	x3, x2, x2
	smulh	x2, x2, x2
	cmp	x2, x3, asr 63
	bne	.L34
	mov	x2, x3
	asr	x0, x0, 1
	b	.L27
.L34:
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
.L61:
	ldr	x1, [x10, 24]
	str	x0, [x10, 8]
	ldr	x0, [x6, :lo12:.LANCHOR0]
	sub	x0, x0, x1
	mov	x1, 0
	str	w0, [x10, 16]
	b	.L71
.L26:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	b	.L61
	.section .rodata
	.align	3
.LC5:
	.string	"divide by zero"
	.text
	.align	2
	.p2align 5,,15
product:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	stp	x21, x22, [sp, 32]
	adrp	x22, .LANCHOR0
	stp	x19, x20, [sp, 16]
	stp	x23, x24, [sp, 48]
	bl	unary
	mov	x24, x0
	ldr	x0, [x22, :lo12:.LANCHOR0]
	ldrb	w1, [x0]
	cmp	w1, 32
	bne	.L75
	add	x0, x0, 1
	.p2align 5,,15
.L76:
	mov	x2, x0
	ldrb	w1, [x0], 1
	cmp	w1, 32
	beq	.L76
	str	x2, [x22, :lo12:.LANCHOR0]
.L75:
	add	x19, x22, :lo12:.LANCHOR0
	ldr	x0, [x19, 8]
	cbnz	x0, .L74
	mov	x20, 145272973819904
	mov	x21, -9223372036854775808
.L77:
	ldr	x1, [x19]
	ldrb	w23, [x1]
	cmp	w23, 47
	bhi	.L74
	.p2align 5,,15
.L110:
	lsr	x0, x20, x23
	tbz	x0, 0, .L74
	add	x1, x1, 1
	str	x1, [x19]
	bl	unary
	ldr	x1, [x19, 8]
	cbnz	x1, .L105
	cmp	w23, 42
	beq	.L107
	cbz	x0, .L108
	cmp	x24, x21
	ccmn	x0, #1, 0, eq
	beq	.L104
	cmp	w23, 47
	beq	.L109
	sdiv	x1, x24, x0
	msub	x24, x1, x0, x24
.L84:
	ldr	x1, [x19]
	ldrb	w0, [x1]
	cmp	w0, 32
	bne	.L77
	add	x1, x1, 1
	.p2align 5,,15
.L90:
	mov	x3, x1
	ldrb	w2, [x1], 1
	cmp	w2, 32
	beq	.L90
	str	x3, [x19]
	ldr	x1, [x19]
	ldrb	w23, [x1]
	cmp	w23, 47
	bls	.L110
.L74:
	mov	x0, x24
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 64
	ret
	.p2align 2,,3
.L107:
	mul	x1, x0, x24
	smulh	x0, x0, x24
	cmp	x0, x1, asr 63
	bne	.L104
	mov	x24, x1
	b	.L84
	.p2align 2,,3
.L109:
	sdiv	x24, x24, x0
	b	.L84
.L108:
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
.L106:
	ldr	x1, [x19, 24]
	str	x0, [x19, 8]
	ldr	x0, [x22, :lo12:.LANCHOR0]
	sub	x0, x0, x1
	str	w0, [x19, 16]
.L105:
	mov	x24, 0
	mov	x0, x24
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 64
	ret
.L104:
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	b	.L106
	.section .rodata
	.align	3
.LC6:
	.string	"expected ':'"
	.text
	.align	2
	.p2align 5,,15
cond:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LANCHOR0
	stp	x21, x22, [sp, 32]
	add	x21, x20, :lo12:.LANCHOR0
	ldp	w0, w1, [x21, 32]
	add	w0, w0, 1
	str	w0, [x21, 32]
	cmp	w0, w1
	ble	.L112
	str	w0, [x21, 36]
.L112:
	bl	product
	mov	x22, x0
	ldr	x2, [x20, :lo12:.LANCHOR0]
	mov	x0, x2
	ldrb	w19, [x0], 1
	cmp	w19, 32
	bne	.L161
	.p2align 5,,15
.L116:
	mov	x2, x0
	ldrb	w19, [x0], 1
	cmp	w19, 32
	beq	.L116
	str	x2, [x20, :lo12:.LANCHOR0]
.L161:
	ldr	x0, [x21, 8]
	cbnz	x0, .L115
	.p2align 5,,15
.L118:
	sub	w0, w19, #43
	mov	w1, 253
	tst	w0, w1
	bne	.L162
	add	x2, x2, 1
	str	x2, [x21]
	bl	product
	cmp	w19, 43
	beq	.L163
	ldr	x2, [x21]
	subs	x0, x22, x0
	cset	x1, vs
	ldrb	w19, [x2]
	cbnz	x1, .L125
.L165:
	mov	x22, x0
	add	x1, x2, 1
	cmp	w19, 32
	bne	.L127
	.p2align 5,,15
.L129:
	mov	x2, x1
	ldrb	w19, [x1], 1
	cmp	w19, 32
	beq	.L129
	str	x2, [x21]
.L127:
	ldr	x0, [x21, 8]
	cbz	x0, .L118
.L130:
	cmp	w19, 63
	ccmp	x0, 0, 0, eq
	beq	.L164
.L115:
	ldr	w0, [x21, 32]
	sub	w0, w0, #1
	str	w0, [x21, 32]
	mov	x0, x22
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 48
	ret
	.p2align 2,,3
.L163:
	ldr	x2, [x21]
	adds	x0, x0, x22
	cset	x1, vs
	ldrb	w19, [x2]
	cbz	x1, .L165
.L125:
	ldr	x0, [x21, 8]
	cbz	x0, .L166
.L128:
	add	x0, x2, 1
	cmp	w19, 32
	bne	.L167
	.p2align 5,,15
.L132:
	mov	x2, x0
	ldrb	w19, [x0], 1
	cmp	w19, 32
	beq	.L132
	ldr	x0, [x21, 8]
	str	x2, [x20, :lo12:.LANCHOR0]
	mov	x22, 0
	b	.L130
.L162:
	ldr	x0, [x21, 8]
	b	.L130
.L166:
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	str	x0, [x21, 8]
	ldr	x0, [x21, 24]
	sub	x0, x2, x0
	str	w0, [x21, 16]
	b	.L128
.L164:
	add	x2, x2, 1
	str	x2, [x20, :lo12:.LANCHOR0]
	bl	cond
	mov	x19, x0
	ldr	x0, [x20, :lo12:.LANCHOR0]
	ldrb	w2, [x0]
	cmp	w2, 32
	bne	.L134
	add	x0, x0, 1
.L135:
	mov	x1, x0
	ldrb	w2, [x0], 1
	cmp	w2, 32
	beq	.L135
	mov	x0, x1
	str	x1, [x20, :lo12:.LANCHOR0]
.L134:
	ldr	x1, [x21, 8]
	cbnz	x1, .L115
	cmp	w2, 58
	beq	.L136
	adrp	x1, .LC6
	add	x1, x1, :lo12:.LC6
	str	x1, [x21, 8]
	ldr	x1, [x21, 24]
	sub	x0, x0, x1
	str	w0, [x21, 16]
	b	.L115
.L136:
	add	x0, x0, 1
	str	x0, [x20, :lo12:.LANCHOR0]
	bl	cond
	cmp	x22, 0
	csel	x22, x0, x19, eq
	b	.L115
.L167:
	mov	x22, 0
	b	.L115
	.section .rodata
	.align	3
.LC7:
	.string	"unexpected character"
	.align	3
.LC8:
	.string	"%-26.26s -> error at %d: %s\n"
	.align	3
.LC9:
	.string	"%-26.26s -> %lld (depth %d)\n"
	.text
	.align	2
	.p2align 5,,15
run:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x20, x1
	stp	x21, x22, [sp, 32]
	adrp	x21, .LANCHOR0
	add	x19, x21, :lo12:.LANCHOR0
	str	x1, [x21, :lo12:.LANCHOR0]
	mov	x22, x0
	stp	wzr, wzr, [x19, 32]
	str	xzr, [x19, 8]
	str	x1, [x19, 24]
	bl	cond
	ldr	x5, [x21, :lo12:.LANCHOR0]
	ldrb	w4, [x5]
	cmp	w4, 32
	bne	.L169
	add	x3, x5, 1
	.p2align 5,,15
.L170:
	mov	x5, x3
	ldrb	w4, [x3], 1
	cmp	w4, 32
	beq	.L170
	str	x5, [x21, :lo12:.LANCHOR0]
.L169:
	ldr	x3, [x19, 8]
	cmp	x3, 0
	ccmp	w4, 0, 4, eq
	bne	.L177
	cbz	x3, .L173
	ldr	w2, [x19, 16]
.L172:
	ldp	x19, x20, [sp, 16]
	mov	x1, x22
	ldp	x21, x22, [sp, 32]
	adrp	x0, .LC8
	ldp	x29, x30, [sp], 48
	add	x0, x0, :lo12:.LC8
	b	printf
	.p2align 2,,3
.L173:
	ldr	w3, [x19, 36]
	mov	x1, x22
	ldp	x19, x20, [sp, 16]
	mov	x2, x0
	ldp	x21, x22, [sp, 32]
	adrp	x0, .LC9
	ldp	x29, x30, [sp], 48
	add	x0, x0, :lo12:.LC9
	b	printf
	.p2align 2,,3
.L177:
	sub	x5, x5, x20
	adrp	x3, .LC7
	mov	w2, w5
	add	x3, x3, :lo12:.LC7
	str	x3, [x19, 8]
	str	w5, [x19, 16]
	b	.L172
	.section .rodata
	.align	3
.LC10:
	.string	"600 parens"
	.align	3
.LC11:
	.string	"600 parens, one short"
	.align	3
.LC12:
	.string	"201 minus levels"
	.align	3
.LC13:
	.string	"%d"
	.align	3
.LC14:
	.string	"+%d"
	.align	3
.LC15:
	.string	"sum 1..300"
	.align	3
.LC16:
	.string	"^1"
	.align	3
.LC17:
	.string	"400 carets"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x19, .LANCHOR1
	add	x19, x19, :lo12:.LANCHOR1
	add	x20, x19, 264
	stp	x21, x22, [sp, 32]
	str	x23, [sp, 48]
	.p2align 5,,15
.L179:
	ldr	x1, [x19], 8
	mov	x0, x1
	bl	run
	cmp	x20, x19
	bne	.L179
	adrp	x23, buf
	add	x21, x23, :lo12:buf
	mov	x2, 600
	mov	w1, 40
	mov	x0, x21
	bl	memset
	mov	x2, 600
	mov	w0, 55
	mov	w1, 41
	strb	w0, [x21, 600]
	adrp	x0, buf+601
	add	x0, x0, :lo12:buf+601
	bl	memset
	strb	wzr, [x21, 1201]
	mov	x1, x21
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	run
	mov	x1, x21
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	strb	wzr, [x21, 1200]
	bl	run
	adrp	x1, buf+402
	mov	x0, x21
	add	x1, x1, :lo12:buf+402
	mov	w2, 10285
	.p2align 5,,15
.L180:
	strh	w2, [x0], 2
	cmp	x0, x1
	bne	.L180
	movi	v31.16b, 0x29
	mov	w0, 53
	strb	w0, [x21, 402]
	adrp	x0, buf+403
	add	x0, x0, :lo12:buf+403
	mov	x1, x21
	adrp	x20, buf+1
	adrp	x22, .LC14
	add	x20, x20, :lo12:buf+1
	add	x22, x22, :lo12:.LC14
	stp	q31, q31, [x0, 160]
	mov	w19, 2
	stp	q31, q31, [x0]
	stp	q31, q31, [x0, 32]
	stp	q31, q31, [x0, 64]
	stp	q31, q31, [x0, 96]
	stp	q31, q31, [x0, 128]
	str	q31, [x0, 185]
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	strb	wzr, [x21, 604]
	bl	run
	adrp	x1, .LC13
	mov	x0, x21
	add	x1, x1, :lo12:.LC13
	mov	w2, 1
	bl	sprintf
	.p2align 5,,15
.L181:
	mov	w2, w19
	mov	x0, x20
	mov	x1, x22
	add	w19, w19, 1
	bl	sprintf
	add	x20, x20, w0, sxtw
	cmp	w19, 301
	bne	.L181
	mov	x1, x21
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	run
	adrp	x2, .LC16
	add	x2, x2, :lo12:.LC16
	mov	w0, 24114
	mov	w1, 1
	movk	w0, 0x31, lsl 16
	str	w0, [x23, :lo12:buf]
	ldrh	w3, [x2]
	adrp	x0, buf+3
	ldrb	w2, [x2, 2]
	add	x0, x0, :lo12:buf+3
.L182:
	strh	w3, [x0]
	add	w1, w1, 1
	strb	w2, [x0, 2]!
	cmp	w1, 400
	bne	.L182
	mov	x1, x21
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	run
	ldr	x23, [sp, 48]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	3
.LC18:
	.string	"1+2*3"
	.align	3
.LC19:
	.string	"(1+2)*3"
	.align	3
.LC20:
	.string	"100-10-1"
	.align	3
.LC21:
	.string	"2^3^2"
	.align	3
.LC22:
	.string	"-2^2"
	.align	3
.LC23:
	.string	"(-2)^3"
	.align	3
.LC24:
	.string	"-7/2"
	.align	3
.LC25:
	.string	"-7%3"
	.align	3
.LC26:
	.string	"7%-3"
	.align	3
.LC27:
	.string	"-(-(-5))"
	.align	3
.LC28:
	.string	"2*(3+4)*(5-(6-7))"
	.align	3
.LC29:
	.string	" 12 * ( 3 + 4 ) "
	.align	3
.LC30:
	.string	"2-2?10:20"
	.align	3
.LC31:
	.string	"0?1:1?7:8"
	.align	3
.LC32:
	.string	"9223372036854775807+0"
	.align	3
.LC33:
	.string	"-9223372036854775807-1"
	.align	3
.LC34:
	.string	"-9223372036854775807-2"
	.align	3
.LC35:
	.string	"9223372036854775808"
	.align	3
.LC36:
	.string	"3037000499*3037000499"
	.align	3
.LC37:
	.string	"3037000500*3037000500"
	.align	3
.LC38:
	.string	"-3037000500*3037000500"
	.align	3
.LC39:
	.string	"2^62"
	.align	3
.LC40:
	.string	"2^63"
	.align	3
.LC41:
	.string	"(-2)^63"
	.align	3
.LC42:
	.string	"(0-9223372036854775807-1)/-1"
	.align	3
.LC43:
	.string	"(0-9223372036854775807-1)%-1"
	.align	3
.LC44:
	.string	"4/0"
	.align	3
.LC45:
	.string	"1+"
	.align	3
.LC46:
	.string	"(1+2"
	.align	3
.LC47:
	.string	"2^-1"
	.align	3
.LC48:
	.string	"1 2"
	.align	3
.LC49:
	.string	"1?2"
	.align	3
.LC50:
	.string	""
	.section .rodata
	.align	4
	.LANCHOR1:
cases:
	.xword	.LC18
	.xword	.LC19
	.xword	.LC20
	.xword	.LC21
	.xword	.LC22
	.xword	.LC23
	.xword	.LC24
	.xword	.LC25
	.xword	.LC26
	.xword	.LC27
	.xword	.LC28
	.xword	.LC29
	.xword	.LC30
	.xword	.LC31
	.xword	.LC32
	.xword	.LC33
	.xword	.LC34
	.xword	.LC35
	.xword	.LC36
	.xword	.LC37
	.xword	.LC38
	.xword	.LC39
	.xword	.LC40
	.xword	.LC41
	.xword	.LC42
	.xword	.LC43
	.xword	.LC44
	.xword	.LC45
	.xword	.LC46
	.xword	.LC47
	.xword	.LC48
	.xword	.LC49
	.xword	.LC50
	.bss
	.align	4
	.LANCHOR0:
pos:
	.zero	8
fail:
	.zero	8
where:
	.zero	4
	.zero	4
start:
	.zero	8
depth:
	.zero	4
max_depth:
	.zero	4
	.zero	8
buf:
	.zero	16384

