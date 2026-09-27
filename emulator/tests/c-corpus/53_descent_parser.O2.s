	.text
	.align	2
	.align 5
skip:
	adrp	x3, .LANCHOR0
	ldr	x0, [x3, :lo12:.LANCHOR0]
	ldrb	w1, [x0]
	cmp	w1, 32
	bne	.L1
	add	x0, x0, 1
	.align 5
.L3:
	mov	x2, x0
	ldrb	w1, [x0], 1
	cmp	w1, 32
	beq	.L3
	str	x2, [x3, :lo12:.LANCHOR0]
.L1:
	ret
	.align	2
	.align 5
oops__isra__0:
	adrp	x2, .LANCHOR0
	add	x1, x2, :lo12:.LANCHOR0
	ldr	x3, [x1, 8]
	cbz	x3, .L9
	ret
	.align 2
.L9:
	str	x0, [x1, 8]
	ldr	x0, [x2, :lo12:.LANCHOR0]
	ldr	x2, [x1, 24]
	sub	x0, x0, x2
	str	w0, [x1, 16]
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"negative exponent"
	.align	3
.LC1:
	.string	"overflow"
	.text
	.align	2
	.align 5
ipow:
	stp	x29, x30, [sp, -16]!
	mov	x29, sp
	tbnz	x1, #63, .L11
	mov	x2, x0
	mov	x0, 1
	cbz	x1, .L10
	.align 5
.L12:
	tbz	x1, 0, .L15
	mul	x3, x2, x0
	smulh	x0, x2, x0
	cmp	x0, x3, asr 63
	bne	.L21
	mov	x0, x3
	cmp	x1, 1
	bne	.L15
.L10:
	ldp	x29, x30, [sp], 16
	ret
	.align 2
.L15:
	mul	x3, x2, x2
	smulh	x2, x2, x2
	cmp	x2, x3, asr 63
	bne	.L21
	mov	x2, x3
	asr	x1, x1, 1
	b	.L12
.L21:
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	oops__isra__0
	mov	x0, 0
.L39:
	ldp	x29, x30, [sp], 16
	ret
	.align 2
.L11:
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	oops__isra__0
	mov	x0, 0
	b	.L39
	.align	2
	.align 5
unary:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LANCHOR0
	bl	skip
	ldr	x0, [x20, :lo12:.LANCHOR0]
	ldrb	w1, [x0]
	cmp	w1, 45
	beq	.L53
	str	x21, [sp, 32]
	add	x21, x20, :lo12:.LANCHOR0
	bl	atom
	mov	x19, x0
	bl	skip
	ldr	x0, [x21, 8]
	cbz	x0, .L54
.L51:
	ldr	x21, [sp, 32]
.L40:
	mov	x0, x19
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.align 2
.L54:
	ldr	x0, [x20, :lo12:.LANCHOR0]
	ldrb	w1, [x0]
	cmp	w1, 94
	bne	.L51
	add	x0, x0, 1
	str	x0, [x20, :lo12:.LANCHOR0]
	bl	unary
	ldr	x2, [x21, 8]
	cbz	x2, .L55
	ldr	x21, [sp, 32]
	mov	x19, 0
.L56:
	mov	x0, x19
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.align 2
.L53:
	add	x0, x0, 1
	str	x0, [x20, :lo12:.LANCHOR0]
	bl	unary
	negs	x19, x0
	bvc	.L40
	adrp	x0, .LC1
	mov	x19, 0
	add	x0, x0, :lo12:.LC1
	bl	oops__isra__0
	b	.L56
	.align 2
.L55:
	ldr	x21, [sp, 32]
	mov	x1, x0
	mov	x0, x19
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 48
	b	ipow
	.section .rodata
	.align	3
.LC2:
	.string	"divide by zero"
	.text
	.align	2
	.align 5
product:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	stp	x21, x22, [sp, 32]
	adrp	x21, .LANCHOR0
	add	x21, x21, :lo12:.LANCHOR0
	stp	x19, x20, [sp, 16]
	bl	unary
	mov	x19, x0
	bl	skip
	ldr	x0, [x21, 8]
	cbnz	x0, .L57
	ldr	x1, [x21]
	str	x23, [sp, 48]
	mov	x22, 145272973819904
	mov	x23, -9223372036854775808
	ldrb	w20, [x1]
	cmp	w20, 47
	bhi	.L76
	.align 5
.L80:
	lsr	x0, x22, x20
	tbz	x0, 0, .L76
	add	x1, x1, 1
	str	x1, [x21]
	bl	unary
	ldr	x1, [x21, 8]
	cbnz	x1, .L60
	cmp	w20, 42
	beq	.L77
	cbz	x0, .L78
	cmp	x19, x23
	ccmn	x0, #1, 0, eq
	beq	.L64
	cmp	w20, 47
	beq	.L79
	sdiv	x1, x19, x0
	msub	x19, x1, x0, x19
	bl	skip
.L81:
	ldr	x1, [x21]
	ldrb	w20, [x1]
	cmp	w20, 47
	bls	.L80
.L76:
	ldr	x23, [sp, 48]
.L57:
	mov	x0, x19
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.align 2
.L77:
	mul	x1, x19, x0
	smulh	x19, x19, x0
	cmp	x19, x1, asr 63
	bne	.L64
	mov	x19, x1
	bl	skip
	b	.L81
	.align 2
.L79:
	sdiv	x19, x19, x0
	bl	skip
	b	.L81
.L64:
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	oops__isra__0
.L60:
	mov	x19, 0
	mov	x0, x19
	ldr	x23, [sp, 48]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.align 2
.L78:
	mov	x19, 0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	oops__isra__0
	ldr	x23, [sp, 48]
	mov	x0, x19
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.align	2
	.align 5
sum:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LANCHOR0
	add	x20, x20, :lo12:.LANCHOR0
	bl	product
	mov	x19, x0
	bl	skip
	ldr	x0, [x20, 8]
	cbnz	x0, .L82
	str	x21, [sp, 32]
	.align 5
.L83:
	ldr	x1, [x20]
	mov	w0, 253
	ldrb	w21, [x1]
	sub	w2, w21, #43
	tst	w2, w0
	bne	.L98
	add	x1, x1, 1
	str	x1, [x20]
	bl	product
	cmp	w21, 43
	beq	.L99
	subs	x0, x19, x0
	cset	x1, vs
	cbnz	x1, .L100
.L91:
	mov	x19, x0
	bl	skip
	ldr	x0, [x20, 8]
	cbz	x0, .L83
.L98:
	ldr	x21, [sp, 32]
.L82:
	mov	x0, x19
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.align 2
.L99:
	adds	x0, x0, x19
	cset	x1, vs
	cbz	x1, .L91
.L100:
	mov	x19, 0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	oops__isra__0
	ldr	x21, [sp, 32]
	mov	x0, x19
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC3:
	.string	"expected ':'"
	.text
	.align	2
	.align 5
cond:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	adrp	x21, .LANCHOR0
	add	x19, x21, :lo12:.LANCHOR0
	ldp	w0, w1, [x19, 32]
	add	w0, w0, 1
	str	w0, [x19, 32]
	cmp	w0, w1
	ble	.L102
	str	w0, [x19, 36]
.L102:
	bl	sum
	mov	x20, x0
	bl	skip
	ldr	x0, [x19, 8]
	cbz	x0, .L108
.L105:
	ldr	w0, [x19, 32]
	sub	w0, w0, #1
	str	w0, [x19, 32]
	mov	x0, x20
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 48
	ret
	.align 2
.L108:
	ldr	x0, [x21, :lo12:.LANCHOR0]
	ldrb	w1, [x0]
	cmp	w1, 63
	bne	.L105
	add	x0, x0, 1
	str	x0, [x21, :lo12:.LANCHOR0]
	bl	cond
	mov	x22, x0
	bl	skip
	ldr	x0, [x19, 8]
	cbnz	x0, .L105
	ldr	x0, [x21, :lo12:.LANCHOR0]
	ldrb	w1, [x0]
	cmp	w1, 58
	beq	.L104
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	oops__isra__0
	b	.L105
.L104:
	add	x0, x0, 1
	str	x0, [x21, :lo12:.LANCHOR0]
	bl	cond
	cmp	x20, 0
	csel	x20, x0, x22, eq
	b	.L105
	.section .rodata
	.align	3
.LC4:
	.string	"expected ')'"
	.align	3
.LC5:
	.string	"expected a number"
	.align	3
.LC6:
	.string	"number too big"
	.text
	.align	2
	.align 5
atom:
	stp	x29, x30, [sp, -32]!
	adrp	x7, .LANCHOR0
	mov	x29, sp
	bl	skip
	ldr	x3, [x7, :lo12:.LANCHOR0]
	ldrb	w1, [x3]
	cmp	w1, 40
	beq	.L121
	sub	w1, w1, #48
	add	x3, x3, 1
	and	w2, w1, 255
	mov	x0, 0
	cmp	w2, 9
	bhi	.L119
	mov	x4, -3689348814741910324
	mov	x5, 9223372036854775807
	movk	x4, 0xcccd, lsl 0
	b	.L116
	.align 2
.L115:
	add	x0, x0, x0, lsl 2
	add	x0, x1, x0, lsl 1
	ldrb	w1, [x3], 1
	sub	w1, w1, #48
	and	w2, w1, 255
	cmp	w2, 9
	bhi	.L122
.L116:
	sxtw	x1, w1
	mov	x6, x3
	sub	x2, x5, x1
	umulh	x2, x2, x4
	cmp	x0, x2, lsr 3
	ble	.L115
	adrp	x0, .LC6
	str	x3, [x7, :lo12:.LANCHOR0]
	add	x0, x0, :lo12:.LC6
	bl	oops__isra__0
.L111:
	mov	x0, 0
.L109:
	ldp	x29, x30, [sp], 32
	ret
	.align 2
.L122:
	str	x6, [x7, :lo12:.LANCHOR0]
	ldp	x29, x30, [sp], 32
	ret
	.align 2
.L121:
	add	x3, x3, 1
	str	x3, [x7, :lo12:.LANCHOR0]
	bl	cond
	str	x0, [sp, 24]
	bl	skip
	adrp	x0, .LANCHOR0
	add	x2, x0, :lo12:.LANCHOR0
	ldr	x1, [x2, 8]
	cbnz	x1, .L111
	ldr	x1, [x0, :lo12:.LANCHOR0]
	mov	x7, x0
	ldr	x0, [sp, 24]
	ldrb	w2, [x1]
	cmp	w2, 41
	bne	.L123
	add	x1, x1, 1
	str	x1, [x7, :lo12:.LANCHOR0]
	b	.L109
	.align 2
.L119:
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	oops__isra__0
	b	.L111
.L123:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	oops__isra__0
	b	.L111
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
	.align 5
run:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LANCHOR0
	add	x19, x20, :lo12:.LANCHOR0
	str	x1, [x20, :lo12:.LANCHOR0]
	str	x21, [sp, 32]
	mov	x21, x0
	stp	wzr, wzr, [x19, 32]
	str	xzr, [x19, 8]
	str	x1, [x19, 24]
	bl	cond
	mov	x4, x0
	bl	skip
	ldr	x3, [x19, 8]
	cbz	x3, .L134
.L125:
	ldr	w2, [x19, 16]
	mov	x1, x21
	ldr	x21, [sp, 32]
	adrp	x0, .LC8
	ldp	x19, x20, [sp, 16]
	add	x0, x0, :lo12:.LC8
	ldp	x29, x30, [sp], 48
	b	printf
	.align 2
.L134:
	ldr	x0, [x20, :lo12:.LANCHOR0]
	ldrb	w0, [x0]
	cbnz	w0, .L135
.L126:
	ldr	w3, [x19, 36]
	mov	x1, x21
	ldr	x21, [sp, 32]
	mov	x2, x4
	ldp	x19, x20, [sp, 16]
	adrp	x0, .LC9
	ldp	x29, x30, [sp], 48
	add	x0, x0, :lo12:.LC9
	b	printf
	.align 2
.L135:
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	oops__isra__0
	ldr	x3, [x19, 8]
	cbz	x3, .L126
	b	.L125
	.section .rodata
	.align	3
.LC10:
	.string	"600 parens"
	.align	3
.LC11:
	.string	"600 parens, one short"
	.align	3
.LC12:
	.string	"-("
	.align	3
.LC13:
	.string	"201 minus levels"
	.align	3
.LC14:
	.string	"%d"
	.align	3
.LC15:
	.string	"+%d"
	.align	3
.LC16:
	.string	"sum 1..300"
	.align	3
.LC17:
	.string	"2^1"
	.align	3
.LC18:
	.string	"%s"
	.align	3
.LC19:
	.string	"^1"
	.align	3
.LC20:
	.string	"400 carets"
	.text
	.align	2
	.align 5
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
	.align 5
.L137:
	ldr	x1, [x19], 8
	mov	x0, x1
	bl	run
	cmp	x20, x19
	bne	.L137
	adrp	x22, buf
	add	x22, x22, :lo12:buf
	mov	x2, 600
	mov	w1, 40
	mov	x0, x22
	bl	memset
	mov	x2, 600
	mov	w0, 55
	adrp	x21, .LC12
	adrp	x20, buf+402
	mov	x19, x22
	add	x21, x21, :lo12:.LC12
	add	x20, x20, :lo12:buf+402
	mov	w1, 41
	strb	w0, [x22, 600]
	adrp	x0, buf+601
	add	x0, x0, :lo12:buf+601
	bl	memset
	mov	x1, x22
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	strb	wzr, [x22, 1201]
	bl	run
	strb	wzr, [x22, 1200]
	mov	x1, x22
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	run
	.align 5
.L138:
	mov	x0, x19
	mov	x1, x21
	mov	x2, 2
	add	x19, x19, 2
	bl	memcpy
	cmp	x19, x20
	bne	.L138
	mov	x2, 201
	mov	w0, 53
	mov	w1, 41
	strb	w0, [x22, 402]
	adrp	x0, buf+403
	add	x0, x0, :lo12:buf+403
	bl	memset
	strb	wzr, [x22, 604]
	mov	x1, x22
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	run
	mov	x0, x22
	mov	w2, 1
	adrp	x1, .LC14
	adrp	x21, .LC15
	add	x1, x1, :lo12:.LC14
	add	x21, x21, :lo12:.LC15
	bl	sprintf
	add	x20, x22, w0, sxtw
	mov	w19, 2
	.align 5
.L139:
	mov	w2, w19
	mov	x0, x20
	mov	x1, x21
	add	w19, w19, 1
	bl	sprintf
	add	x20, x20, w0, sxtw
	cmp	w19, 301
	bne	.L139
	mov	x1, x22
	adrp	x0, .LC16
	adrp	x21, .LC18
	add	x0, x0, :lo12:.LC16
	add	x21, x21, :lo12:.LC18
	bl	run
	mov	x1, x21
	mov	x0, x22
	adrp	x2, .LC17
	adrp	x23, .LC19
	add	x2, x2, :lo12:.LC17
	add	x23, x23, :lo12:.LC19
	bl	sprintf
	add	x19, x22, w0, sxtw
	mov	w20, 1
.L140:
	mov	x0, x19
	mov	x2, x23
	mov	x1, x21
	add	w20, w20, 1
	bl	sprintf
	add	x19, x19, w0, sxtw
	cmp	w20, 400
	bne	.L140
	mov	x1, x22
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	run
	ldr	x23, [sp, 48]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	3
.LC21:
	.string	"1+2*3"
	.align	3
.LC22:
	.string	"(1+2)*3"
	.align	3
.LC23:
	.string	"100-10-1"
	.align	3
.LC24:
	.string	"2^3^2"
	.align	3
.LC25:
	.string	"-2^2"
	.align	3
.LC26:
	.string	"(-2)^3"
	.align	3
.LC27:
	.string	"-7/2"
	.align	3
.LC28:
	.string	"-7%3"
	.align	3
.LC29:
	.string	"7%-3"
	.align	3
.LC30:
	.string	"-(-(-5))"
	.align	3
.LC31:
	.string	"2*(3+4)*(5-(6-7))"
	.align	3
.LC32:
	.string	" 12 * ( 3 + 4 ) "
	.align	3
.LC33:
	.string	"2-2?10:20"
	.align	3
.LC34:
	.string	"0?1:1?7:8"
	.align	3
.LC35:
	.string	"9223372036854775807+0"
	.align	3
.LC36:
	.string	"-9223372036854775807-1"
	.align	3
.LC37:
	.string	"-9223372036854775807-2"
	.align	3
.LC38:
	.string	"9223372036854775808"
	.align	3
.LC39:
	.string	"3037000499*3037000499"
	.align	3
.LC40:
	.string	"3037000500*3037000500"
	.align	3
.LC41:
	.string	"-3037000500*3037000500"
	.align	3
.LC42:
	.string	"2^62"
	.align	3
.LC43:
	.string	"2^63"
	.align	3
.LC44:
	.string	"(-2)^63"
	.align	3
.LC45:
	.string	"(0-9223372036854775807-1)/-1"
	.align	3
.LC46:
	.string	"(0-9223372036854775807-1)%-1"
	.align	3
.LC47:
	.string	"4/0"
	.align	3
.LC48:
	.string	"1+"
	.align	3
.LC49:
	.string	"(1+2"
	.align	3
.LC50:
	.string	"2^-1"
	.align	3
.LC51:
	.string	"1 2"
	.align	3
.LC52:
	.string	"1?2"
	.align	3
.LC53:
	.string	""
	.section .rodata
	.align	4
	.LANCHOR1:
cases:
	.quad	.LC21
	.quad	.LC22
	.quad	.LC23
	.quad	.LC24
	.quad	.LC25
	.quad	.LC26
	.quad	.LC27
	.quad	.LC28
	.quad	.LC29
	.quad	.LC30
	.quad	.LC31
	.quad	.LC32
	.quad	.LC33
	.quad	.LC34
	.quad	.LC35
	.quad	.LC36
	.quad	.LC37
	.quad	.LC38
	.quad	.LC39
	.quad	.LC40
	.quad	.LC41
	.quad	.LC42
	.quad	.LC43
	.quad	.LC44
	.quad	.LC45
	.quad	.LC46
	.quad	.LC47
	.quad	.LC48
	.quad	.LC49
	.quad	.LC50
	.quad	.LC51
	.quad	.LC52
	.quad	.LC53
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

