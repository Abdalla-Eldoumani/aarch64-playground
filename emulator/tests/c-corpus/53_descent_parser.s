	.text
	.align	2
oops:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	adrp	x0, fail
	add	x0, x0, :lo12:fail
	ldr	x0, [x0]
	cmp	x0, 0
	bne	.L2
	adrp	x0, fail
	add	x0, x0, :lo12:fail
	ldr	x1, [sp, 8]
	str	x1, [x0]
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x1, [x0]
	adrp	x0, start
	add	x0, x0, :lo12:start
	ldr	x0, [x0]
	sub	x0, x1, x0
	mov	w1, w0
	adrp	x0, where
	add	x0, x0, :lo12:where
	str	w1, [x0]
.L2:
	mov	x0, 0
	add	sp, sp, 16
	ret
	.align	2
skip:
	b	.L5
.L6:
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	add	x1, x0, 1
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	str	x1, [x0]
.L5:
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 32
	beq	.L6
	nop
	nop
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"expected ')'"
	.align	3
.LC1:
	.string	"expected a number"
	.align	3
.LC2:
	.string	"number too big"
	.text
	.align	2
atom:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	xzr, [sp, 24]
	bl	skip
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 40
	bne	.L8
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	add	x1, x0, 1
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	str	x1, [x0]
	bl	cond
	str	x0, [sp, 24]
	bl	skip
	adrp	x0, fail
	add	x0, x0, :lo12:fail
	ldr	x0, [x0]
	cmp	x0, 0
	beq	.L9
	mov	x0, 0
	b	.L10
.L9:
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 41
	beq	.L11
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	oops
	b	.L10
.L11:
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	add	x1, x0, 1
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	str	x1, [x0]
	ldr	x0, [sp, 24]
	b	.L10
.L8:
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 47
	bls	.L12
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 57
	bls	.L14
.L12:
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	oops
	b	.L10
.L17:
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	add	x2, x0, 1
	adrp	x1, pos
	add	x1, x1, :lo12:pos
	str	x2, [x1]
	ldrb	w0, [x0]
	sub	w0, w0, #48
	str	w0, [sp, 20]
	ldrsw	x0, [sp, 20]
	mov	x1, 9223372036854775807
	sub	x0, x1, x0
	mov	x1, 7378697629483820646
	movk	x1, 0x6667, lsl 0
	smulh	x1, x0, x1
	asr	x1, x1, 2
	asr	x0, x0, 63
	sub	x0, x1, x0
	ldr	x1, [sp, 24]
	cmp	x1, x0
	ble	.L15
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	oops
	b	.L10
.L15:
	ldr	x1, [sp, 24]
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	lsl	x0, x0, 1
	mov	x1, x0
	ldrsw	x0, [sp, 20]
	add	x0, x1, x0
	str	x0, [sp, 24]
.L14:
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 47
	bls	.L16
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 57
	bls	.L17
.L16:
	ldr	x0, [sp, 24]
.L10:
	ldp	x29, x30, [sp], 32
	ret
	.section .rodata
	.align	3
.LC3:
	.string	"negative exponent"
	.align	3
.LC4:
	.string	"overflow"
	.text
	.align	2
ipow:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	mov	x0, 1
	str	x0, [sp, 40]
	ldr	x0, [sp, 16]
	cmp	x0, 0
	bge	.L21
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	oops
	b	.L29
.L28:
	ldr	x0, [sp, 16]
	and	x0, x0, 1
	cmp	x0, 0
	beq	.L22
	ldr	x1, [sp, 40]
	ldr	x0, [sp, 24]
	mov	x10, 0
	mul	x11, x1, x0
	smulh	x0, x1, x0
	mov	x2, x11
	mov	x3, x0
	mov	x6, x3
	asr	x7, x3, 63
	mov	x0, x2
	asr	x1, x0, 63
	cmp	x1, x6
	beq	.L23
	mov	x10, 1
.L23:
	str	x0, [sp, 40]
	mov	x0, x10
	and	w0, w0, 1
	and	w0, w0, 255
	and	w0, w0, 1
	cmp	w0, 0
	beq	.L22
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	oops
	b	.L29
.L22:
	ldr	x0, [sp, 16]
	cmp	x0, 1
	ble	.L25
	ldr	x1, [sp, 24]
	ldr	x0, [sp, 24]
	mov	x10, 0
	mul	x11, x1, x0
	smulh	x0, x1, x0
	mov	x4, x11
	mov	x5, x0
	mov	x8, x5
	asr	x9, x5, 63
	mov	x0, x4
	asr	x1, x0, 63
	cmp	x1, x8
	beq	.L26
	mov	x10, 1
.L26:
	str	x0, [sp, 24]
	mov	x0, x10
	and	w0, w0, 1
	and	w0, w0, 255
	and	w0, w0, 1
	cmp	w0, 0
	beq	.L25
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	oops
	b	.L29
.L25:
	ldr	x0, [sp, 16]
	asr	x0, x0, 1
	str	x0, [sp, 16]
.L21:
	ldr	x0, [sp, 16]
	cmp	x0, 0
	bgt	.L28
	ldr	x0, [sp, 40]
.L29:
	ldp	x29, x30, [sp], 48
	ret
	.align	2
unary:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	bl	skip
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 45
	bne	.L31
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	add	x1, x0, 1
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	str	x1, [x0]
	bl	unary
	str	x0, [sp, 24]
	mov	x1, 0
	ldr	x0, [sp, 24]
	negs	x0, x0
	bvc	.L32
	mov	x1, 1
.L32:
	str	x0, [sp, 16]
	mov	x0, x1
	and	w0, w0, 1
	and	w0, w0, 255
	and	w0, w0, 1
	cmp	w0, 0
	beq	.L34
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	oops
	b	.L41
.L34:
	ldr	x0, [sp, 16]
	b	.L41
.L31:
	bl	atom
	str	x0, [sp, 24]
	bl	skip
	adrp	x0, fail
	add	x0, x0, :lo12:fail
	ldr	x0, [x0]
	cmp	x0, 0
	bne	.L37
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 94
	beq	.L38
.L37:
	ldr	x0, [sp, 24]
	b	.L41
.L38:
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	add	x1, x0, 1
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	str	x1, [x0]
	bl	unary
	str	x0, [sp, 16]
	adrp	x0, fail
	add	x0, x0, :lo12:fail
	ldr	x0, [x0]
	cmp	x0, 0
	bne	.L39
	ldr	x0, [sp, 16]
	mov	x1, x0
	ldr	x0, [sp, 24]
	bl	ipow
	b	.L41
.L39:
	mov	x0, 0
.L41:
	ldp	x29, x30, [sp], 32
	ret
	.section .rodata
	.align	3
.LC5:
	.string	"divide by zero"
	.text
	.align	2
product:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	stp	x20, x21, [sp, 16]
	stp	x22, x23, [sp, 32]
	bl	unary
	str	x0, [sp, 56]
	bl	skip
	b	.L43
.L55:
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	add	x2, x0, 1
	adrp	x1, pos
	add	x1, x1, :lo12:pos
	str	x2, [x1]
	ldrb	w0, [x0]
	strb	w0, [sp, 79]
	bl	unary
	str	x0, [sp, 64]
	adrp	x0, fail
	add	x0, x0, :lo12:fail
	ldr	x0, [x0]
	cmp	x0, 0
	beq	.L44
	mov	x0, 0
	b	.L56
.L44:
	ldrb	w0, [sp, 79]
	cmp	w0, 42
	bne	.L46
	ldr	x1, [sp, 56]
	mov	x2, 0
	ldr	x0, [sp, 64]
	mul	x3, x1, x0
	smulh	x0, x1, x0
	mov	x20, x3
	mov	x21, x0
	mov	x22, x21
	asr	x23, x21, 63
	mov	x0, x20
	asr	x1, x0, 63
	cmp	x1, x22
	beq	.L47
	mov	x2, 1
.L47:
	str	x0, [sp, 56]
	mov	x0, x2
	and	w0, w0, 1
	and	w0, w0, 255
	and	w0, w0, 1
	cmp	w0, 0
	beq	.L46
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	oops
	b	.L56
.L46:
	ldrb	w0, [sp, 79]
	cmp	w0, 42
	beq	.L49
	ldr	x0, [sp, 64]
	cmp	x0, 0
	bne	.L49
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	oops
	b	.L56
.L49:
	ldrb	w0, [sp, 79]
	cmp	w0, 42
	beq	.L50
	ldr	x1, [sp, 56]
	mov	x0, -9223372036854775808
	cmp	x1, x0
	bne	.L50
	ldr	x0, [sp, 64]
	cmn	x0, #1
	bne	.L50
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	oops
	b	.L56
.L50:
	ldrb	w0, [sp, 79]
	cmp	w0, 42
	beq	.L51
	ldrb	w0, [sp, 79]
	cmp	w0, 47
	bne	.L52
	ldr	x1, [sp, 56]
	ldr	x0, [sp, 64]
	sdiv	x0, x1, x0
	b	.L53
.L52:
	ldr	x0, [sp, 56]
	ldr	x1, [sp, 64]
	sdiv	x2, x0, x1
	ldr	x1, [sp, 64]
	mul	x1, x2, x1
	sub	x0, x0, x1
.L53:
	str	x0, [sp, 56]
.L51:
	bl	skip
.L43:
	adrp	x0, fail
	add	x0, x0, :lo12:fail
	ldr	x0, [x0]
	cmp	x0, 0
	bne	.L54
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 42
	beq	.L55
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 47
	beq	.L55
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 37
	beq	.L55
.L54:
	ldr	x0, [sp, 56]
.L56:
	ldp	x20, x21, [sp, 16]
	ldp	x22, x23, [sp, 32]
	ldp	x29, x30, [sp], 80
	ret
	.align	2
sum:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	bl	product
	str	x0, [sp, 24]
	bl	skip
	b	.L58
.L68:
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	add	x2, x0, 1
	adrp	x1, pos
	add	x1, x1, :lo12:pos
	str	x2, [x1]
	ldrb	w0, [x0]
	strb	w0, [sp, 47]
	bl	product
	str	x0, [sp, 32]
	ldrb	w0, [sp, 47]
	cmp	w0, 43
	bne	.L59
	ldr	x0, [sp, 24]
	mov	x2, 0
	ldr	x1, [sp, 32]
	adds	x0, x1, x0
	bvc	.L60
	mov	x2, 1
.L60:
	str	x0, [sp, 24]
	mov	x0, x2
	and	w0, w0, 1
	and	w0, w0, 255
	b	.L62
.L59:
	ldr	x1, [sp, 24]
	mov	x2, 0
	ldr	x0, [sp, 32]
	subs	x0, x1, x0
	bvc	.L63
	mov	x2, 1
.L63:
	str	x0, [sp, 24]
	mov	x0, x2
	and	w0, w0, 1
	and	w0, w0, 255
.L62:
	and	w0, w0, 1
	cmp	w0, 0
	beq	.L65
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	oops
	b	.L69
.L65:
	bl	skip
.L58:
	adrp	x0, fail
	add	x0, x0, :lo12:fail
	ldr	x0, [x0]
	cmp	x0, 0
	bne	.L67
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 43
	beq	.L68
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 45
	beq	.L68
.L67:
	ldr	x0, [sp, 24]
.L69:
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC6:
	.string	"expected ':'"
	.text
	.align	2
cond:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	adrp	x0, depth
	add	x0, x0, :lo12:depth
	ldr	w0, [x0]
	add	w1, w0, 1
	adrp	x0, depth
	add	x0, x0, :lo12:depth
	str	w1, [x0]
	adrp	x0, depth
	add	x0, x0, :lo12:depth
	ldr	w1, [x0]
	adrp	x0, max_depth
	add	x0, x0, :lo12:max_depth
	ldr	w0, [x0]
	cmp	w1, w0
	ble	.L71
	adrp	x0, depth
	add	x0, x0, :lo12:depth
	ldr	w1, [x0]
	adrp	x0, max_depth
	add	x0, x0, :lo12:max_depth
	str	w1, [x0]
.L71:
	bl	sum
	str	x0, [sp, 40]
	bl	skip
	adrp	x0, fail
	add	x0, x0, :lo12:fail
	ldr	x0, [x0]
	cmp	x0, 0
	bne	.L72
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 63
	bne	.L72
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	add	x1, x0, 1
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	str	x1, [x0]
	bl	cond
	str	x0, [sp, 32]
	bl	skip
	adrp	x0, fail
	add	x0, x0, :lo12:fail
	ldr	x0, [x0]
	cmp	x0, 0
	bne	.L73
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 58
	beq	.L73
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	oops
	b	.L72
.L73:
	adrp	x0, fail
	add	x0, x0, :lo12:fail
	ldr	x0, [x0]
	cmp	x0, 0
	bne	.L72
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	add	x1, x0, 1
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	str	x1, [x0]
	bl	cond
	str	x0, [sp, 24]
	ldr	x0, [sp, 40]
	cmp	x0, 0
	beq	.L74
	ldr	x0, [sp, 32]
	str	x0, [sp, 40]
	b	.L72
.L74:
	ldr	x0, [sp, 24]
	str	x0, [sp, 40]
.L72:
	adrp	x0, depth
	add	x0, x0, :lo12:depth
	ldr	w0, [x0]
	sub	w1, w0, #1
	adrp	x0, depth
	add	x0, x0, :lo12:depth
	str	w1, [x0]
	ldr	x0, [sp, 40]
	ldp	x29, x30, [sp], 48
	ret
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
run:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x1, [sp, 16]
	str	x1, [x0]
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x1, [x0]
	adrp	x0, start
	add	x0, x0, :lo12:start
	str	x1, [x0]
	adrp	x0, fail
	add	x0, x0, :lo12:fail
	str	xzr, [x0]
	adrp	x0, max_depth
	add	x0, x0, :lo12:max_depth
	str	wzr, [x0]
	adrp	x0, max_depth
	add	x0, x0, :lo12:max_depth
	ldr	w1, [x0]
	adrp	x0, depth
	add	x0, x0, :lo12:depth
	str	w1, [x0]
	bl	cond
	str	x0, [sp, 40]
	bl	skip
	adrp	x0, fail
	add	x0, x0, :lo12:fail
	ldr	x0, [x0]
	cmp	x0, 0
	bne	.L77
	adrp	x0, pos
	add	x0, x0, :lo12:pos
	ldr	x0, [x0]
	ldrb	w0, [x0]
	cmp	w0, 0
	beq	.L77
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	oops
.L77:
	adrp	x0, fail
	add	x0, x0, :lo12:fail
	ldr	x0, [x0]
	cmp	x0, 0
	beq	.L78
	adrp	x0, where
	add	x0, x0, :lo12:where
	ldr	w1, [x0]
	adrp	x0, fail
	add	x0, x0, :lo12:fail
	ldr	x0, [x0]
	mov	x3, x0
	mov	w2, w1
	ldr	x1, [sp, 24]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	b	.L80
.L78:
	adrp	x0, max_depth
	add	x0, x0, :lo12:max_depth
	ldr	w0, [x0]
	mov	w3, w0
	ldr	x2, [sp, 40]
	ldr	x1, [sp, 24]
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
.L80:
	nop
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC10:
	.string	"1+2*3"
	.align	3
.LC11:
	.string	"(1+2)*3"
	.align	3
.LC12:
	.string	"100-10-1"
	.align	3
.LC13:
	.string	"2^3^2"
	.align	3
.LC14:
	.string	"-2^2"
	.align	3
.LC15:
	.string	"(-2)^3"
	.align	3
.LC16:
	.string	"-7/2"
	.align	3
.LC17:
	.string	"-7%3"
	.align	3
.LC18:
	.string	"7%-3"
	.align	3
.LC19:
	.string	"-(-(-5))"
	.align	3
.LC20:
	.string	"2*(3+4)*(5-(6-7))"
	.align	3
.LC21:
	.string	" 12 * ( 3 + 4 ) "
	.align	3
.LC22:
	.string	"2-2?10:20"
	.align	3
.LC23:
	.string	"0?1:1?7:8"
	.align	3
.LC24:
	.string	"9223372036854775807+0"
	.align	3
.LC25:
	.string	"-9223372036854775807-1"
	.align	3
.LC26:
	.string	"-9223372036854775807-2"
	.align	3
.LC27:
	.string	"9223372036854775808"
	.align	3
.LC28:
	.string	"3037000499*3037000499"
	.align	3
.LC29:
	.string	"3037000500*3037000500"
	.align	3
.LC30:
	.string	"-3037000500*3037000500"
	.align	3
.LC31:
	.string	"2^62"
	.align	3
.LC32:
	.string	"2^63"
	.align	3
.LC33:
	.string	"(-2)^63"
	.align	3
.LC34:
	.string	"(0-9223372036854775807-1)/-1"
	.align	3
.LC35:
	.string	"(0-9223372036854775807-1)%-1"
	.align	3
.LC36:
	.string	"4/0"
	.align	3
.LC37:
	.string	"1+"
	.align	3
.LC38:
	.string	"(1+2"
	.align	3
.LC39:
	.string	"2^-1"
	.align	3
.LC40:
	.string	"1 2"
	.align	3
.LC41:
	.string	"1?2"
	.align	3
.LC42:
	.string	""
	.align	3
cases:
	.quad	.LC10
	.quad	.LC11
	.quad	.LC12
	.quad	.LC13
	.quad	.LC14
	.quad	.LC15
	.quad	.LC16
	.quad	.LC17
	.quad	.LC18
	.quad	.LC19
	.quad	.LC20
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
	.align	3
.LC43:
	.string	"600 parens"
	.align	3
.LC44:
	.string	"600 parens, one short"
	.align	3
.LC45:
	.string	"-("
	.align	3
.LC46:
	.string	"201 minus levels"
	.align	3
.LC47:
	.string	"%d"
	.align	3
.LC48:
	.string	"+%d"
	.align	3
.LC49:
	.string	"sum 1..300"
	.align	3
.LC50:
	.string	"^1"
	.align	3
.LC51:
	.string	"2^1"
	.align	3
.LC52:
	.string	"%s"
	.align	3
.LC53:
	.string	"400 carets"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	wzr, [sp, 28]
	b	.L82
.L83:
	adrp	x0, cases
	add	x0, x0, :lo12:cases
	ldrsw	x1, [sp, 28]
	ldr	x2, [x0, x1, lsl 3]
	adrp	x0, cases
	add	x0, x0, :lo12:cases
	ldrsw	x1, [sp, 28]
	ldr	x0, [x0, x1, lsl 3]
	mov	x1, x0
	mov	x0, x2
	bl	run
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L82:
	ldr	w0, [sp, 28]
	cmp	w0, 32
	ble	.L83
	mov	x2, 600
	mov	w1, 40
	adrp	x0, buf
	add	x0, x0, :lo12:buf
	bl	memset
	adrp	x0, buf
	add	x0, x0, :lo12:buf
	mov	w1, 55
	strb	w1, [x0, 600]
	adrp	x0, buf+601
	add	x0, x0, :lo12:buf+601
	mov	x2, 600
	mov	w1, 41
	bl	memset
	adrp	x0, buf
	add	x0, x0, :lo12:buf
	strb	wzr, [x0, 1201]
	adrp	x0, buf
	add	x1, x0, :lo12:buf
	adrp	x0, .LC43
	add	x0, x0, :lo12:.LC43
	bl	run
	adrp	x0, buf
	add	x0, x0, :lo12:buf
	strb	wzr, [x0, 1200]
	adrp	x0, buf
	add	x1, x0, :lo12:buf
	adrp	x0, .LC44
	add	x0, x0, :lo12:.LC44
	bl	run
	adrp	x0, buf
	add	x0, x0, :lo12:buf
	str	x0, [sp, 16]
	str	wzr, [sp, 28]
	b	.L84
.L85:
	mov	x2, 2
	adrp	x0, .LC45
	add	x1, x0, :lo12:.LC45
	ldr	x0, [sp, 16]
	bl	memcpy
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
	ldr	x0, [sp, 16]
	add	x0, x0, 2
	str	x0, [sp, 16]
.L84:
	ldr	w0, [sp, 28]
	cmp	w0, 200
	ble	.L85
	ldr	x0, [sp, 16]
	add	x1, x0, 1
	str	x1, [sp, 16]
	mov	w1, 53
	strb	w1, [x0]
	mov	x2, 201
	mov	w1, 41
	ldr	x0, [sp, 16]
	bl	memset
	ldr	x0, [sp, 16]
	add	x0, x0, 201
	strb	wzr, [x0]
	adrp	x0, buf
	add	x1, x0, :lo12:buf
	adrp	x0, .LC46
	add	x0, x0, :lo12:.LC46
	bl	run
	adrp	x0, buf
	add	x0, x0, :lo12:buf
	str	x0, [sp, 16]
	mov	w0, 1
	str	w0, [sp, 28]
	b	.L86
.L89:
	ldr	w0, [sp, 28]
	cmp	w0, 1
	bne	.L87
	adrp	x0, .LC47
	add	x0, x0, :lo12:.LC47
	b	.L88
.L87:
	adrp	x0, .LC48
	add	x0, x0, :lo12:.LC48
.L88:
	ldr	w2, [sp, 28]
	mov	x1, x0
	ldr	x0, [sp, 16]
	bl	sprintf
	sxtw	x0, w0
	ldr	x1, [sp, 16]
	add	x0, x1, x0
	str	x0, [sp, 16]
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L86:
	ldr	w0, [sp, 28]
	cmp	w0, 300
	ble	.L89
	adrp	x0, buf
	add	x1, x0, :lo12:buf
	adrp	x0, .LC49
	add	x0, x0, :lo12:.LC49
	bl	run
	adrp	x0, buf
	add	x0, x0, :lo12:buf
	str	x0, [sp, 16]
	str	wzr, [sp, 28]
	b	.L90
.L93:
	ldr	w0, [sp, 28]
	cmp	w0, 0
	beq	.L91
	adrp	x0, .LC50
	add	x0, x0, :lo12:.LC50
	b	.L92
.L91:
	adrp	x0, .LC51
	add	x0, x0, :lo12:.LC51
.L92:
	mov	x2, x0
	adrp	x0, .LC52
	add	x1, x0, :lo12:.LC52
	ldr	x0, [sp, 16]
	bl	sprintf
	sxtw	x0, w0
	ldr	x1, [sp, 16]
	add	x0, x1, x0
	str	x0, [sp, 16]
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L90:
	ldr	w0, [sp, 28]
	cmp	w0, 399
	ble	.L93
	adrp	x0, buf
	add	x1, x0, :lo12:buf
	adrp	x0, .LC53
	add	x0, x0, :lo12:.LC53
	bl	run
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret


	.bss
	.balign 8
pos:
	.skip 8
	.balign 8
start:
	.skip 8
	.balign 8
fail:
	.skip 8
	.balign 4
where:
	.skip 4
	.balign 4
depth:
	.skip 4
	.balign 4
max_depth:
	.skip 4
	.balign 8
buf:
	.skip 16384
