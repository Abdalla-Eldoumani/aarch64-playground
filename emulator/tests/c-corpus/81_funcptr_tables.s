	.text
	.align	2
add:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w1, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w1, w0
	add	sp, sp, 16
	ret
	.align	2
sub:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w1, [sp, 12]
	ldr	w0, [sp, 8]
	sub	w0, w1, w0
	add	sp, sp, 16
	ret
	.align	2
mul:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w1, [sp, 12]
	ldr	w0, [sp, 8]
	mul	w0, w1, w0
	add	sp, sp, 16
	ret
	.align	2
bxor:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w1, [sp, 12]
	ldr	w0, [sp, 8]
	eor	w0, w1, w0
	add	sp, sp, 16
	ret
	.align	2
band:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w1, [sp, 12]
	ldr	w0, [sp, 8]
	and	w0, w1, w0
	add	sp, sp, 16
	ret
	.align	2
bor:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w1, [sp, 12]
	ldr	w0, [sp, 8]
	orr	w0, w1, w0
	add	sp, sp, 16
	ret
	.align	2
mn:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 12]
	ldr	w2, [sp, 8]
	ldr	w1, [sp, 8]
	cmp	w2, w0
	csel	w0, w1, w0, le
	add	sp, sp, 16
	ret
	.align	2
mx:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 12]
	ldr	w2, [sp, 8]
	ldr	w1, [sp, 8]
	cmp	w2, w0
	csel	w0, w1, w0, ge
	add	sp, sp, 16
	ret
	.align	2
quo:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 8]
	cmp	w0, 0
	beq	.L18
	ldr	w1, [sp, 12]
	ldr	w0, [sp, 8]
	sdiv	w0, w1, w0
	b	.L20
.L18:
	mov	w0, 0
.L20:
	add	sp, sp, 16
	ret
	.align	2
rem_:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 8]
	cmp	w0, 0
	beq	.L22
	ldr	w0, [sp, 12]
	ldr	w1, [sp, 8]
	sdiv	w2, w0, w1
	ldr	w1, [sp, 8]
	mul	w1, w2, w1
	sub	w0, w0, w1
	b	.L24
.L22:
	mov	w0, 0
.L24:
	add	sp, sp, 16
	ret
	.section .rodata
	.align	3
.LC23:
	.string	"add"
	.align	3
.LC24:
	.string	"sub"
	.align	3
.LC25:
	.string	"mul"
	.align	3
.LC26:
	.string	"quo"
	.align	3
.LC27:
	.string	"rem"
	.align	3
.LC28:
	.string	"and"
	.align	3
.LC29:
	.string	"or"
	.align	3
.LC30:
	.string	"xor"
	.align	3
.LC31:
	.string	"min"
	.align	3
.LC32:
	.string	"max"
	.align	3
optab:
	.byte	43
	.zero	7
	.xword	.LC23
	.xword	add
	.byte	45
	.zero	7
	.xword	.LC24
	.xword	sub
	.byte	42
	.zero	7
	.xword	.LC25
	.xword	mul
	.byte	47
	.zero	7
	.xword	.LC26
	.xword	quo
	.byte	37
	.zero	7
	.xword	.LC27
	.xword	rem_
	.byte	38
	.zero	7
	.xword	.LC28
	.xword	band
	.byte	124
	.zero	7
	.xword	.LC29
	.xword	bor
	.byte	94
	.zero	7
	.xword	.LC30
	.xword	bxor
	.byte	60
	.zero	7
	.xword	.LC31
	.xword	mn
	.byte	62
	.zero	7
	.xword	.LC32
	.xword	mx
	.data
	.align	3
slots:
	.xword	add
	.xword	sub
	.xword	mul
	.xword	bxor
	.text
	.align	2
pick:
	sub	sp, sp, #32
	strb	w0, [sp, 15]
	str	wzr, [sp, 28]
	b	.L26
.L29:
	adrp	x0, optab
	add	x2, x0, :lo12:optab
	ldrsw	x1, [sp, 28]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldrb	w0, [x0]
	ldrb	w1, [sp, 15]
	cmp	w1, w0
	bne	.L27
	adrp	x0, optab
	add	x2, x0, :lo12:optab
	ldrsw	x1, [sp, 28]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	x0, [x0, 16]
	b	.L28
.L27:
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L26:
	ldr	w0, [sp, 28]
	cmp	w0, 9
	ble	.L29
	mov	x0, 0
.L28:
	add	sp, sp, 32
	ret
	.align	2
rpn:
	stp	x29, x30, [sp, -128]!
	mov	x29, sp
	str	x19, [sp, 16]
	str	x0, [sp, 40]
	str	x1, [sp, 32]
	str	wzr, [sp, 124]
	b	.L31
.L36:
	ldr	x0, [sp, 40]
	ldrb	w0, [x0]
	bl	pick
	str	x0, [sp, 112]
	ldr	x0, [sp, 40]
	ldrb	w0, [x0]
	cmp	w0, 47
	bls	.L32
	ldr	x0, [sp, 40]
	ldrb	w0, [x0]
	cmp	w0, 57
	bhi	.L32
	ldr	w0, [sp, 124]
	cmp	w0, 15
	bgt	.L32
	ldr	x0, [sp, 40]
	ldrb	w0, [x0]
	mov	w1, w0
	ldr	w0, [sp, 124]
	add	w2, w0, 1
	str	w2, [sp, 124]
	sub	w2, w1, #48
	sxtw	x0, w0
	lsl	x0, x0, 2
	add	x1, sp, 48
	str	w2, [x1, x0]
	b	.L33
.L32:
	ldr	x0, [sp, 112]
	cmp	x0, 0
	beq	.L34
	ldr	w0, [sp, 124]
	cmp	w0, 1
	ble	.L34
	ldr	w0, [sp, 124]
	sub	w0, w0, #1
	str	w0, [sp, 124]
	ldr	w0, [sp, 124]
	sub	w0, w0, #1
	sxtw	x0, w0
	lsl	x0, x0, 2
	add	x1, sp, 48
	ldr	w3, [x1, x0]
	ldrsw	x0, [sp, 124]
	lsl	x0, x0, 2
	add	x1, sp, 48
	ldr	w1, [x1, x0]
	ldr	w0, [sp, 124]
	sub	w19, w0, #1
	ldr	x2, [sp, 112]
	mov	w0, w3
	blr	x2
	mov	w2, w0
	sxtw	x0, w19
	lsl	x0, x0, 2
	add	x1, sp, 48
	str	w2, [x1, x0]
	b	.L33
.L34:
	ldr	x0, [sp, 40]
	ldrb	w0, [x0]
	cmp	w0, 32
	bne	.L42
.L33:
	ldr	x0, [sp, 40]
	add	x0, x0, 1
	str	x0, [sp, 40]
.L31:
	ldr	x0, [sp, 40]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L36
	b	.L35
.L42:
	nop
.L35:
	ldr	x0, [sp, 40]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L37
	ldr	w0, [sp, 124]
	cmp	w0, 1
	bne	.L37
	mov	w1, 1
	b	.L38
.L37:
	mov	w1, 0
.L38:
	ldr	x0, [sp, 32]
	str	w1, [x0]
	ldr	w0, [sp, 124]
	cmp	w0, 0
	beq	.L39
	ldr	w0, [sp, 124]
	sub	w0, w0, #1
	sxtw	x0, w0
	lsl	x0, x0, 2
	add	x1, sp, 48
	ldr	w0, [x1, x0]
	b	.L41
.L39:
	mov	w0, 0
.L41:
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 128
	ret
	.align	2
apply:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	w1, [sp, 20]
	str	w2, [sp, 16]
	ldr	x2, [sp, 24]
	ldr	w1, [sp, 16]
	ldr	w0, [sp, 20]
	blr	x2
	ldp	x29, x30, [sp], 32
	ret
	.align	2
repeat:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	w1, [sp, 20]
	str	w2, [sp, 16]
	ldr	w0, [sp, 16]
	cmp	w0, 0
	beq	.L46
	ldr	x2, [sp, 24]
	ldr	w1, [sp, 16]
	ldr	w0, [sp, 20]
	blr	x2
	mov	w1, w0
	ldr	w0, [sp, 16]
	sub	w0, w0, #1
	mov	w2, w0
	ldr	x0, [sp, 24]
	bl	repeat
	b	.L48
.L46:
	ldr	w0, [sp, 20]
.L48:
	ldp	x29, x30, [sp], 32
	ret
	.align	2
ten:
	sub	sp, sp, #48
	str	x0, [sp, 40]
	str	w1, [sp, 36]
	strh	w2, [sp, 34]
	strb	w3, [sp, 33]
	str	x4, [sp, 24]
	str	w5, [sp, 20]
	str	x6, [sp, 8]
	str	w7, [sp, 16]
	ldrsw	x0, [sp, 36]
	lsl	x1, x0, 1
	ldr	x0, [sp, 40]
	add	x2, x1, x0
	ldrsh	x1, [sp, 34]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	add	x1, x2, x0
	ldrb	w0, [sp, 33]
	lsl	x0, x0, 2
	add	x2, x1, x0
	ldr	x1, [sp, 24]
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	add	x2, x2, x0
	ldrsw	x1, [sp, 20]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 1
	add	x2, x2, x0
	ldr	x1, [sp, 8]
	mov	x0, x1
	lsl	x0, x0, 3
	sub	x0, x0, x1
	add	x1, x2, x0
	ldrsw	x0, [sp, 16]
	lsl	x0, x0, 3
	add	x2, x1, x0
	ldr	x1, [sp, 48]
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	add	x2, x2, x0
	ldrsh	x1, [sp, 56]
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	lsl	x0, x0, 1
	add	x0, x2, x0
	add	sp, sp, 48
	ret
	.data
	.align	3
tenp:
	.xword	ten
	.text
	.align	2
one:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	mov	x0, 1
	add	sp, sp, 16
	ret
	.section .rodata
	.align	3
fact_step:
	.xword	one
	.xword	fact
	.text
	.align	2
fact:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x19, [sp, 16]
	str	w0, [sp, 44]
	ldrsw	x19, [sp, 44]
	ldr	w0, [sp, 44]
	cmp	w0, 1
	cset	w0, gt
	and	w0, w0, 255
	mov	w1, w0
	adrp	x0, fact_step
	add	x0, x0, :lo12:fact_step
	sxtw	x1, w1
	ldr	x1, [x0, x1, lsl 3]
	ldr	w0, [sp, 44]
	sub	w0, w0, #1
	blr	x1
	mul	x0, x19, x0
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.align	2
rect_area2:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	ldr	w0, [x0, 8]
	sxtw	x1, w0
	ldr	x0, [sp, 8]
	ldr	w0, [x0, 12]
	sxtw	x0, w0
	mul	x0, x1, x0
	lsl	x0, x0, 1
	add	sp, sp, 16
	ret
	.align	2
rect_perim:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	ldr	w1, [x0, 8]
	ldr	x0, [sp, 8]
	ldr	w0, [x0, 12]
	add	w0, w1, w0
	sxtw	x0, w0
	lsl	x0, x0, 1
	add	sp, sp, 16
	ret
	.align	2
rect_grow:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	str	w1, [sp, 4]
	ldr	x0, [sp, 8]
	ldr	w1, [x0, 8]
	ldr	w0, [sp, 4]
	add	w1, w1, w0
	ldr	x0, [sp, 8]
	str	w1, [x0, 8]
	ldr	x0, [sp, 8]
	ldr	w1, [x0, 12]
	ldr	w0, [sp, 4]
	add	w1, w1, w0
	ldr	x0, [sp, 8]
	str	w1, [x0, 12]
	nop
	add	sp, sp, 16
	ret
	.align	2
tri_area2:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	ldr	w0, [x0, 8]
	sxtw	x1, w0
	ldr	x0, [sp, 8]
	ldr	w0, [x0, 12]
	sxtw	x0, w0
	mul	x0, x1, x0
	add	sp, sp, 16
	ret
	.align	2
tri_perim:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	ldr	w0, [x0, 8]
	sxtw	x1, w0
	ldr	x0, [sp, 8]
	ldr	w0, [x0, 12]
	sxtw	x0, w0
	add	x1, x1, x0
	ldr	x0, [sp, 8]
	ldr	w0, [x0, 16]
	sxtw	x0, w0
	add	x0, x1, x0
	add	sp, sp, 16
	ret
	.align	2
tri_grow:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	str	w1, [sp, 4]
	ldr	x0, [sp, 8]
	ldr	w1, [x0, 8]
	ldr	w0, [sp, 4]
	mul	w1, w1, w0
	ldr	x0, [sp, 8]
	str	w1, [x0, 8]
	ldr	x0, [sp, 8]
	ldr	w1, [x0, 12]
	ldr	w0, [sp, 4]
	mul	w1, w1, w0
	ldr	x0, [sp, 8]
	str	w1, [x0, 12]
	ldr	x0, [sp, 8]
	ldr	w1, [x0, 16]
	ldr	w0, [sp, 4]
	mul	w1, w1, w0
	ldr	x0, [sp, 8]
	str	w1, [x0, 16]
	nop
	add	sp, sp, 16
	ret
	.section .rodata
	.align	3
.LC33:
	.string	"rect"
	.align	3
rect_vt:
	.xword	.LC33
	.xword	rect_area2
	.xword	rect_perim
	.xword	rect_grow
	.align	3
.LC34:
	.string	"tri"
	.align	3
tri_vt:
	.xword	.LC34
	.xword	tri_area2
	.xword	tri_perim
	.xword	tri_grow
	.align	3
.LC35:
	.string	"square"
	.align	3
square_vt:
	.xword	.LC35
	.xword	rect_area2
	.xword	rect_perim
	.xword	rect_grow
	.text
	.align	2
st_err:
	sub	sp, sp, #32
	str	w0, [sp, 12]
	str	x1, [sp]
	adrp	x0, st_err
	add	x0, x0, :lo12:st_err
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
st_need:
	sub	sp, sp, #32
	str	w0, [sp, 12]
	str	x1, [sp]
	adrp	x0, st_err
	add	x0, x0, :lo12:st_err
	str	x0, [sp, 24]
	ldr	w0, [sp, 12]
	cmp	w0, 47
	ble	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 57
	bgt	.L68
	ldr	x0, [sp]
	ldr	x1, [x0]
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	lsl	x0, x0, 1
	mov	x1, x0
	ldr	w0, [sp, 12]
	sub	w0, w0, #48
	sxtw	x0, w0
	add	x1, x1, x0
	ldr	x0, [sp]
	str	x1, [x0]
	adrp	x0, st_digit
	add	x0, x0, :lo12:st_digit
	str	x0, [sp, 24]
.L68:
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
st_digit:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	x1, [sp, 16]
	str	xzr, [sp, 40]
	ldr	w0, [sp, 28]
	cmp	w0, 95
	bne	.L71
	adrp	x0, st_need
	add	x0, x0, :lo12:st_need
	str	x0, [sp, 40]
	b	.L72
.L71:
	ldr	w0, [sp, 28]
	cmp	w0, 0
	beq	.L72
	ldr	x1, [sp, 16]
	ldr	w0, [sp, 28]
	bl	st_need
	str	x0, [sp, 40]
.L72:
	ldr	x0, [sp, 40]
	ldp	x29, x30, [sp], 48
	ret
	.align	2
st_start:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	x1, [sp, 16]
	adrp	x0, st_need
	add	x0, x0, :lo12:st_need
	str	x0, [sp, 40]
	ldr	w0, [sp, 28]
	cmp	w0, 45
	bne	.L75
	ldr	x0, [sp, 16]
	add	x0, x0, 8
	mov	x1, -1
	str	x1, [x0]
	b	.L76
.L75:
	ldr	w0, [sp, 28]
	cmp	w0, 43
	beq	.L76
	ldr	x1, [sp, 16]
	ldr	w0, [sp, 28]
	bl	st_need
	str	x0, [sp, 40]
.L76:
	ldr	x0, [sp, 40]
	ldp	x29, x30, [sp], 48
	ret
	.align	2
parse:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	str	xzr, [sp, 48]
	mov	x0, 1
	str	x0, [sp, 56]
	adrp	x0, st_start
	add	x0, x0, :lo12:st_start
	str	x0, [sp, 40]
	b	.L79
.L82:
	ldr	x2, [sp, 40]
	ldr	x0, [sp, 24]
	ldrb	w0, [x0]
	mov	w3, w0
	add	x0, sp, 48
	mov	x1, x0
	mov	w0, w3
	blr	x2
	str	x0, [sp, 40]
	ldr	x0, [sp, 24]
	ldrb	w0, [x0]
	cmp	w0, 0
	beq	.L84
	ldr	x0, [sp, 24]
	add	x0, x0, 1
	str	x0, [sp, 24]
.L79:
	ldr	x0, [sp, 40]
	cmp	x0, 0
	beq	.L81
	ldr	x1, [sp, 40]
	adrp	x0, st_err
	add	x0, x0, :lo12:st_err
	cmp	x1, x0
	bne	.L82
	b	.L81
.L84:
	nop
.L81:
	ldr	x1, [sp, 48]
	ldr	x0, [sp, 56]
	mul	x1, x1, x0
	ldr	x0, [sp, 16]
	str	x1, [x0]
	ldr	x0, [sp, 40]
	cmp	x0, 0
	cset	w0, eq
	and	w0, w0, 255
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	3
.LC20:
	.string	""
	.align	3
.LC37:
	.string	" (bad)"
	.align	3
.LC38:
	.string	"rpn [%s] = %d%s\n"
	.align	3
.LC39:
	.string	" "
	.align	3
.LC40:
	.string	"ops: "
	.align	3
.LC41:
	.string	"%s%s(-17,5)=%d"
	.align	3
.LC42:
	.string	"\nsame: %d %d %d %d\n"
	.align	3
.LC43:
	.string	"round %d: %d repeat=%d\n"
	.align	3
.LC44:
	.string	"ten: %ld\n"
	.align	3
.LC45:
	.string	"fact:"
	.align	3
.LC46:
	.string	" %ld"
	.align	3
.LC47:
	.string	" %ld\n"
	.align	3
.LC48:
	.string	"%s area2=%ld perim=%ld\n"
	.align	3
.LC50:
	.string	"ok"
	.align	3
.LC51:
	.string	"no"
	.align	3
.LC52:
	.string	"parse [%s] %s %ld\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #304
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x19, x20, [sp, 32]
	stp	x21, x22, [sp, 48]
	adrp	x0, .LC36
	add	x1, x0, :lo12:.LC36
	add	x0, sp, 184
	ldr	q27, [x1]
	ldr	q28, [x1, 16]
	ldr	q29, [x1, 32]
	ldr	q30, [x1, 48]
	ldr	q31, [x1, 64]
	str	q27, [x0]
	str	q28, [x0, 16]
	str	q29, [x0, 32]
	str	q30, [x0, 48]
	str	q31, [x0, 64]
	str	wzr, [sp, 300]
	b	.L86
.L89:
	ldrsw	x0, [sp, 300]
	lsl	x0, x0, 3
	add	x1, sp, 184
	ldr	x0, [x1, x0]
	add	x1, sp, 264
	bl	rpn
	str	w0, [sp, 268]
	ldrsw	x0, [sp, 300]
	lsl	x0, x0, 3
	add	x1, sp, 184
	ldr	x1, [x1, x0]
	ldr	w0, [sp, 264]
	cmp	w0, 0
	beq	.L87
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	b	.L88
.L87:
	adrp	x0, .LC37
	add	x0, x0, :lo12:.LC37
.L88:
	mov	x3, x0
	ldr	w2, [sp, 268]
	adrp	x0, .LC38
	add	x0, x0, :lo12:.LC38
	bl	printf
	ldr	w0, [sp, 300]
	add	w0, w0, 1
	str	w0, [sp, 300]
.L86:
	ldr	w0, [sp, 300]
	cmp	w0, 9
	ble	.L89
	str	wzr, [sp, 300]
	b	.L90
.L93:
	ldr	w0, [sp, 300]
	cmp	w0, 0
	beq	.L91
	adrp	x0, .LC39
	add	x19, x0, :lo12:.LC39
	b	.L92
.L91:
	adrp	x0, .LC40
	add	x19, x0, :lo12:.LC40
.L92:
	adrp	x0, optab
	add	x2, x0, :lo12:optab
	ldrsw	x1, [sp, 300]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	x20, [x0, 8]
	adrp	x0, optab
	add	x2, x0, :lo12:optab
	ldrsw	x1, [sp, 300]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	x0, [x0, 16]
	mov	w2, 5
	mov	w1, -17
	bl	apply
	mov	w3, w0
	mov	x2, x20
	mov	x1, x19
	adrp	x0, .LC41
	add	x0, x0, :lo12:.LC41
	bl	printf
	ldr	w0, [sp, 300]
	add	w0, w0, 1
	str	w0, [sp, 300]
.L90:
	ldr	w0, [sp, 300]
	cmp	w0, 9
	ble	.L93
	mov	w0, 43
	bl	pick
	mov	x1, x0
	adrp	x0, add
	add	x0, x0, :lo12:add
	cmp	x1, x0
	cset	w0, eq
	and	w0, w0, 255
	mov	w20, w0
	mov	w0, 63
	bl	pick
	cmp	x0, 0
	cset	w0, eq
	and	w0, w0, 255
	mov	w21, w0
	adrp	x0, quo
	add	x1, x0, :lo12:quo
	adrp	x0, quo
	add	x0, x0, :lo12:quo
	cmp	x1, x0
	cset	w0, eq
	and	w0, w0, 255
	mov	w22, w0
	mov	w0, 60
	bl	pick
	mov	x19, x0
	mov	w0, 62
	bl	pick
	cmp	x19, x0
	cset	w0, eq
	and	w0, w0, 255
	mov	w4, w0
	mov	w3, w22
	mov	w2, w21
	mov	w1, w20
	adrp	x0, .LC42
	add	x0, x0, :lo12:.LC42
	bl	printf
	str	wzr, [sp, 296]
	b	.L94
.L97:
	mov	w0, 1000
	str	w0, [sp, 292]
	str	wzr, [sp, 300]
	b	.L95
.L96:
	adrp	x0, slots
	add	x0, x0, :lo12:slots
	ldrsw	x1, [sp, 300]
	ldr	x2, [x0, x1, lsl 3]
	ldr	w0, [sp, 296]
	add	w0, w0, 7
	mov	w1, w0
	ldr	w0, [sp, 292]
	blr	x2
	str	w0, [sp, 292]
	ldr	w0, [sp, 300]
	add	w0, w0, 1
	str	w0, [sp, 300]
.L95:
	ldr	w0, [sp, 300]
	cmp	w0, 3
	ble	.L96
	adrp	x0, slots
	add	x0, x0, :lo12:slots
	ldr	x0, [x0]
	str	x0, [sp, 272]
	adrp	x0, slots
	add	x0, x0, :lo12:slots
	ldr	x1, [x0, 8]
	adrp	x0, slots
	add	x0, x0, :lo12:slots
	str	x1, [x0]
	adrp	x0, slots
	add	x0, x0, :lo12:slots
	ldr	x1, [x0, 16]
	adrp	x0, slots
	add	x0, x0, :lo12:slots
	str	x1, [x0, 8]
	adrp	x0, slots
	add	x0, x0, :lo12:slots
	ldr	x1, [x0, 24]
	adrp	x0, slots
	add	x0, x0, :lo12:slots
	str	x1, [x0, 16]
	adrp	x0, slots
	add	x0, x0, :lo12:slots
	ldr	x1, [sp, 272]
	str	x1, [x0, 24]
	adrp	x0, slots
	add	x0, x0, :lo12:slots
	ldrsw	x1, [sp, 296]
	ldr	x0, [x0, x1, lsl 3]
	mov	w2, 6
	mov	w1, 1
	bl	repeat
	mov	w3, w0
	ldr	w2, [sp, 292]
	ldr	w1, [sp, 296]
	adrp	x0, .LC43
	add	x0, x0, :lo12:.LC43
	bl	printf
	ldr	w0, [sp, 296]
	add	w0, w0, 1
	str	w0, [sp, 296]
.L94:
	ldr	w0, [sp, 296]
	cmp	w0, 3
	ble	.L97
	adrp	x0, tenp
	add	x0, x0, :lo12:tenp
	ldr	x8, [x0]
	mov	w0, -10
	strh	w0, [sp, 8]
	mov	x0, -34359738368
	str	x0, [sp]
	mov	w7, 8
	mov	x6, -7
	mov	w5, -6
	mov	x4, 1099511627776
	mov	w3, -56
	mov	w2, -3
	mov	w1, -2
	mov	x0, -1
	blr	x8
	mov	x1, x0
	adrp	x0, .LC44
	add	x0, x0, :lo12:.LC44
	bl	printf
	adrp	x0, .LC45
	add	x0, x0, :lo12:.LC45
	bl	printf
	mov	w0, 1
	str	w0, [sp, 300]
	b	.L98
.L99:
	ldr	w0, [sp, 300]
	bl	fact
	mov	x1, x0
	adrp	x0, .LC46
	add	x0, x0, :lo12:.LC46
	bl	printf
	ldr	w0, [sp, 300]
	add	w0, w0, 3
	str	w0, [sp, 300]
.L98:
	ldr	w0, [sp, 300]
	cmp	w0, 20
	ble	.L99
	mov	w0, 20
	bl	fact
	mov	x1, x0
	adrp	x0, .LC47
	add	x0, x0, :lo12:.LC47
	bl	printf
	mov	x0, 96
	bl	malloc
	str	x0, [sp, 280]
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	ldp	q30, q31, [x0]
	add	x0, sp, 152
	stp	q30, q31, [x0]
	str	wzr, [sp, 300]
	b	.L100
.L103:
	ldrsw	x1, [sp, 300]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 280]
	add	x0, x0, x1
	ldrsw	x1, [sp, 300]
	lsl	x1, x1, 3
	add	x2, sp, 152
	ldr	x1, [x2, x1]
	str	x1, [x0]
	ldrsw	x1, [sp, 300]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 280]
	add	x0, x0, x1
	ldr	w1, [sp, 300]
	add	w1, w1, 3
	str	w1, [x0, 8]
	ldr	w0, [sp, 300]
	cmp	w0, 2
	bne	.L101
	ldr	w0, [sp, 300]
	add	w1, w0, 3
	b	.L102
.L101:
	ldr	w0, [sp, 300]
	add	w0, w0, 2
	lsl	w1, w0, 1
.L102:
	ldrsw	x2, [sp, 300]
	mov	x0, x2
	lsl	x0, x0, 1
	add	x0, x0, x2
	lsl	x0, x0, 3
	mov	x2, x0
	ldr	x0, [sp, 280]
	add	x0, x0, x2
	str	w1, [x0, 12]
	ldr	w1, [sp, 300]
	mov	w0, w1
	lsl	w0, w0, 1
	add	w2, w0, w1
	ldrsw	x1, [sp, 300]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 280]
	add	x0, x0, x1
	add	w1, w2, 5
	str	w1, [x0, 16]
	ldr	w0, [sp, 300]
	add	w0, w0, 1
	str	w0, [sp, 300]
.L100:
	ldr	w0, [sp, 300]
	cmp	w0, 3
	ble	.L103
	str	wzr, [sp, 288]
	b	.L104
.L107:
	str	wzr, [sp, 300]
	b	.L105
.L106:
	ldrsw	x1, [sp, 300]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 280]
	add	x0, x0, x1
	ldr	x0, [x0]
	ldr	x19, [x0]
	ldrsw	x1, [sp, 300]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 280]
	add	x0, x0, x1
	ldr	x0, [x0]
	ldr	x2, [x0, 8]
	ldrsw	x1, [sp, 300]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 280]
	add	x0, x0, x1
	blr	x2
	mov	x20, x0
	ldrsw	x1, [sp, 300]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 280]
	add	x0, x0, x1
	ldr	x0, [x0]
	ldr	x2, [x0, 16]
	ldrsw	x1, [sp, 300]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 280]
	add	x0, x0, x1
	blr	x2
	mov	x3, x0
	mov	x2, x20
	mov	x1, x19
	adrp	x0, .LC48
	add	x0, x0, :lo12:.LC48
	bl	printf
	ldrsw	x1, [sp, 300]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 280]
	add	x0, x0, x1
	ldr	x0, [x0]
	ldr	x2, [x0, 24]
	ldrsw	x1, [sp, 300]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 280]
	add	x0, x0, x1
	mov	w1, 2
	blr	x2
	ldr	w0, [sp, 300]
	add	w0, w0, 1
	str	w0, [sp, 300]
.L105:
	ldr	w0, [sp, 300]
	cmp	w0, 3
	ble	.L106
	ldr	w0, [sp, 288]
	add	w0, w0, 1
	str	w0, [sp, 288]
.L104:
	ldr	w0, [sp, 288]
	cmp	w0, 1
	ble	.L107
	ldr	x0, [sp, 280]
	bl	free
	adrp	x0, .LC49
	add	x1, x0, :lo12:.LC49
	add	x0, sp, 72
	ldr	q27, [x1]
	ldr	q28, [x1, 16]
	ldr	q29, [x1, 32]
	ldr	q30, [x1, 48]
	ldr	q31, [x1, 64]
	str	q27, [x0]
	str	q28, [x0, 16]
	str	q29, [x0, 32]
	str	q30, [x0, 48]
	str	q31, [x0, 64]
	str	wzr, [sp, 300]
	b	.L108
.L113:
	ldrsw	x0, [sp, 300]
	lsl	x0, x0, 3
	add	x1, sp, 72
	ldr	x0, [x1, x0]
	add	x1, sp, 64
	bl	parse
	str	w0, [sp, 264]
	ldrsw	x0, [sp, 300]
	lsl	x0, x0, 3
	add	x1, sp, 72
	ldr	x4, [x1, x0]
	ldr	w0, [sp, 264]
	cmp	w0, 0
	beq	.L109
	adrp	x0, .LC50
	add	x0, x0, :lo12:.LC50
	b	.L110
.L109:
	adrp	x0, .LC51
	add	x0, x0, :lo12:.LC51
.L110:
	ldr	w1, [sp, 264]
	cmp	w1, 0
	beq	.L111
	ldr	x1, [sp, 64]
	b	.L112
.L111:
	mov	x1, 0
.L112:
	mov	x3, x1
	mov	x2, x0
	mov	x1, x4
	adrp	x0, .LC52
	add	x0, x0, :lo12:.LC52
	bl	printf
	ldr	w0, [sp, 300]
	add	w0, w0, 1
	str	w0, [sp, 300]
.L108:
	ldr	w0, [sp, 300]
	cmp	w0, 9
	ble	.L113
	mov	w0, 0
	ldp	x29, x30, [sp, 16]
	ldp	x19, x20, [sp, 32]
	ldp	x21, x22, [sp, 48]
	add	sp, sp, 304
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"3 4 + 2 *"
	.align	3
.LC1:
	.string	"9 7 % 5 ^"
	.align	3
.LC2:
	.string	"8 5 < 9 >"
	.align	3
.LC3:
	.string	"1 2 3 4 + + +"
	.align	3
.LC4:
	.string	"5 0 /"
	.align	3
.LC5:
	.string	"2 +"
	.align	3
.LC6:
	.string	"9 6 & 6 |"
	.align	3
.LC7:
	.string	"7 3 - 4 - 1 2 * *"
	.align	3
.LC8:
	.string	"9 x"
	.align	3
.LC9:
	.string	"9 9 * 9 * 9 * 9 -"
	.align	3
.LC36:
	.xword	.LC0
	.xword	.LC1
	.xword	.LC2
	.xword	.LC3
	.xword	.LC4
	.xword	.LC5
	.xword	.LC6
	.xword	.LC7
	.xword	.LC8
	.xword	.LC9
	.align	3
.LC11:
	.xword	rect_vt
	.xword	tri_vt
	.xword	square_vt
	.xword	tri_vt
	.align	3
.LC12:
	.string	"-12_345"
	.align	3
.LC13:
	.string	"+7"
	.align	3
.LC14:
	.string	"1__2"
	.align	3
.LC15:
	.string	"-"
	.align	3
.LC16:
	.string	"12a"
	.align	3
.LC17:
	.string	"0"
	.align	3
.LC18:
	.string	"_5"
	.align	3
.LC19:
	.string	"9_"
	.align	3
.LC21:
	.string	"-0_0_1"
	.align	3
.LC49:
	.xword	.LC12
	.xword	.LC13
	.xword	.LC14
	.xword	.LC15
	.xword	.LC16
	.xword	.LC17
	.xword	.LC18
	.xword	.LC19
	.xword	.LC20
	.xword	.LC21
	.text

