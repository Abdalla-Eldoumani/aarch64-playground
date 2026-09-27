	.text
	.align	2
field:
	sub	sp, sp, #64
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	str	w2, [sp, 12]
	str	w3, [sp, 8]
	str	w4, [sp, 4]
	str	w5, [sp]
	str	wzr, [sp, 60]
	ldr	w1, [sp, 8]
	ldr	w0, [sp, 12]
	cmp	w1, w0
	ble	.L2
	ldr	w1, [sp, 8]
	ldr	w0, [sp, 12]
	sub	w0, w1, w0
	str	w0, [sp, 56]
	b	.L3
.L2:
	str	wzr, [sp, 56]
.L3:
	str	wzr, [sp, 52]
	ldr	w0, [sp]
	cmp	w0, 0
	beq	.L4
	ldr	w0, [sp, 4]
	cmp	w0, 0
	bne	.L4
	ldr	w0, [sp, 12]
	cmp	w0, 0
	ble	.L4
	ldr	x0, [sp, 16]
	ldrb	w0, [x0]
	cmp	w0, 45
	bne	.L4
	ldr	w0, [sp, 52]
	add	w1, w0, 1
	str	w1, [sp, 52]
	sxtw	x0, w0
	ldr	x1, [sp, 16]
	add	x1, x1, x0
	ldr	w0, [sp, 60]
	add	w2, w0, 1
	str	w2, [sp, 60]
	sxtw	x0, w0
	ldr	x2, [sp, 24]
	add	x0, x2, x0
	ldrb	w1, [x1]
	strb	w1, [x0]
.L4:
	str	wzr, [sp, 48]
	b	.L5
.L9:
	ldr	w0, [sp]
	cmp	w0, 0
	beq	.L6
	mov	w2, 48
	b	.L7
.L6:
	mov	w2, 32
.L7:
	ldr	w0, [sp, 60]
	add	w1, w0, 1
	str	w1, [sp, 60]
	sxtw	x0, w0
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	mov	w1, w2
	strb	w1, [x0]
	ldr	w0, [sp, 48]
	add	w0, w0, 1
	str	w0, [sp, 48]
.L5:
	ldr	w0, [sp, 4]
	cmp	w0, 0
	bne	.L8
	ldr	w1, [sp, 48]
	ldr	w0, [sp, 56]
	cmp	w1, w0
	blt	.L9
.L8:
	ldr	w0, [sp, 52]
	str	w0, [sp, 44]
	b	.L10
.L11:
	ldrsw	x0, [sp, 44]
	ldr	x1, [sp, 16]
	add	x1, x1, x0
	ldr	w0, [sp, 60]
	add	w2, w0, 1
	str	w2, [sp, 60]
	sxtw	x0, w0
	ldr	x2, [sp, 24]
	add	x0, x2, x0
	ldrb	w1, [x1]
	strb	w1, [x0]
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L10:
	ldr	w1, [sp, 44]
	ldr	w0, [sp, 12]
	cmp	w1, w0
	blt	.L11
	str	wzr, [sp, 40]
	b	.L12
.L14:
	ldr	w0, [sp, 60]
	add	w1, w0, 1
	str	w1, [sp, 60]
	sxtw	x0, w0
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	mov	w1, 32
	strb	w1, [x0]
	ldr	w0, [sp, 40]
	add	w0, w0, 1
	str	w0, [sp, 40]
.L12:
	ldr	w0, [sp, 4]
	cmp	w0, 0
	beq	.L13
	ldr	w1, [sp, 40]
	ldr	w0, [sp, 56]
	cmp	w1, w0
	blt	.L14
.L13:
	ldr	w0, [sp, 60]
	add	sp, sp, 64
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"0123456789ABCDEF"
	.align	3
.LC1:
	.string	"0123456789abcdef"
	.text
	.align	2
digits:
	sub	sp, sp, #80
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	str	w2, [sp, 12]
	str	w3, [sp, 8]
	str	w4, [sp, 4]
	ldr	w0, [sp, 4]
	cmp	w0, 0
	beq	.L17
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	str	x0, [sp, 72]
	b	.L18
.L17:
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	str	x0, [sp, 72]
.L18:
	str	wzr, [sp, 68]
	str	wzr, [sp, 64]
.L19:
	ldr	w1, [sp, 8]
	ldr	x0, [sp, 16]
	udiv	x2, x0, x1
	mul	x1, x2, x1
	sub	x0, x0, x1
	ldr	x1, [sp, 72]
	add	x1, x1, x0
	ldr	w0, [sp, 68]
	add	w2, w0, 1
	str	w2, [sp, 68]
	ldrb	w2, [x1]
	sxtw	x0, w0
	add	x1, sp, 40
	strb	w2, [x1, x0]
	ldr	w0, [sp, 8]
	ldr	x1, [sp, 16]
	udiv	x0, x1, x0
	str	x0, [sp, 16]
	ldr	x0, [sp, 16]
	cmp	x0, 0
	bne	.L19
	ldr	w0, [sp, 12]
	cmp	w0, 0
	beq	.L21
	ldr	w0, [sp, 64]
	add	w1, w0, 1
	str	w1, [sp, 64]
	sxtw	x0, w0
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	mov	w1, 45
	strb	w1, [x0]
	b	.L21
.L22:
	ldr	w0, [sp, 68]
	sub	w0, w0, #1
	str	w0, [sp, 68]
	ldr	w0, [sp, 64]
	add	w1, w0, 1
	str	w1, [sp, 64]
	sxtw	x0, w0
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	ldrsw	x1, [sp, 68]
	add	x2, sp, 40
	ldrb	w1, [x2, x1]
	strb	w1, [x0]
.L21:
	ldr	w0, [sp, 68]
	cmp	w0, 0
	bne	.L22
	ldr	w0, [sp, 64]
	add	sp, sp, 80
	ret
	.align	2
fixed:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	str	x0, [sp, 40]
	str	d0, [sp, 32]
	str	w1, [sp, 28]
	mov	x0, 1
	str	x0, [sp, 72]
	str	wzr, [sp, 68]
	ldr	d31, [sp, 32]
	fcmpe	d31, #0.0
	bmi	.L33
	b	.L25
.L33:
	ldr	w0, [sp, 68]
	add	w1, w0, 1
	str	w1, [sp, 68]
	sxtw	x0, w0
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	mov	w1, 45
	strb	w1, [x0]
	ldr	d31, [sp, 32]
	fneg	d31, d31
	str	d31, [sp, 32]
.L25:
	str	wzr, [sp, 64]
	b	.L27
.L28:
	ldr	x1, [sp, 72]
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	lsl	x0, x0, 1
	str	x0, [sp, 72]
	ldr	w0, [sp, 64]
	add	w0, w0, 1
	str	w0, [sp, 64]
.L27:
	ldr	w1, [sp, 64]
	ldr	w0, [sp, 28]
	cmp	w1, w0
	blt	.L28
	ldr	d31, [sp, 72]
	ucvtf	d30, d31
	ldr	d31, [sp, 32]
	fmul	d31, d30, d31
	fcvtzu	d31, d31
	str	d31, [sp, 48]
	ldrsw	x0, [sp, 68]
	ldr	x1, [sp, 40]
	add	x5, x1, x0
	ldr	x1, [sp, 48]
	ldr	x0, [sp, 72]
	udiv	x0, x1, x0
	mov	w4, 0
	mov	w3, 10
	mov	w2, 0
	mov	x1, x0
	mov	x0, x5
	bl	digits
	mov	w1, w0
	ldr	w0, [sp, 68]
	add	w0, w0, w1
	str	w0, [sp, 68]
	ldr	w0, [sp, 28]
	cmp	w0, 0
	beq	.L29
	ldr	w0, [sp, 68]
	add	w1, w0, 1
	str	w1, [sp, 68]
	sxtw	x0, w0
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	mov	w1, 46
	strb	w1, [x0]
	ldr	x1, [sp, 72]
	mov	x0, -3689348814741910324
	movk	x0, 0xcccd, lsl 0
	umulh	x0, x1, x0
	lsr	x0, x0, 3
	str	x0, [sp, 56]
	b	.L30
.L31:
	ldr	x1, [sp, 48]
	ldr	x0, [sp, 56]
	udiv	x2, x1, x0
	mov	x0, -3689348814741910324
	movk	x0, 0xcccd, lsl 0
	umulh	x0, x2, x0
	lsr	x1, x0, 3
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	lsl	x0, x0, 1
	sub	x1, x2, x0
	and	w1, w1, 255
	ldr	w0, [sp, 68]
	add	w2, w0, 1
	str	w2, [sp, 68]
	sxtw	x0, w0
	ldr	x2, [sp, 40]
	add	x0, x2, x0
	add	w1, w1, 48
	and	w1, w1, 255
	strb	w1, [x0]
	ldr	x1, [sp, 56]
	mov	x0, -3689348814741910324
	movk	x0, 0xcccd, lsl 0
	umulh	x0, x1, x0
	lsr	x0, x0, 3
	str	x0, [sp, 56]
.L30:
	ldr	x0, [sp, 56]
	cmp	x0, 0
	bne	.L31
.L29:
	ldr	w0, [sp, 68]
	ldp	x29, x30, [sp], 80
	ret
	.align	2
mini:
	sub	sp, sp, #704
	stp	x29, x30, [sp]
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	str	x2, [sp, 656]
	str	x3, [sp, 664]
	str	x4, [sp, 672]
	str	x5, [sp, 680]
	str	x6, [sp, 688]
	str	x7, [sp, 696]
	add	x0, sp, 528
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
	str	wzr, [sp, 524]
	add	x0, sp, 704
	str	x0, [sp, 432]
	add	x0, sp, 704
	str	x0, [sp, 440]
	add	x0, sp, 656
	str	x0, [sp, 448]
	mov	w0, -48
	str	w0, [sp, 456]
	mov	w0, -128
	str	w0, [sp, 460]
	ldr	x0, [sp, 16]
	str	x0, [sp, 512]
	b	.L35
.L98:
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	cmp	w0, 37
	beq	.L36
	ldr	w0, [sp, 524]
	add	w1, w0, 1
	str	w1, [sp, 524]
	sxtw	x0, w0
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	ldr	x1, [sp, 512]
	ldrb	w1, [x1]
	strb	w1, [x0]
	b	.L97
.L36:
	str	wzr, [sp, 508]
	str	wzr, [sp, 504]
	str	wzr, [sp, 500]
	mov	w0, -1
	str	w0, [sp, 496]
	str	wzr, [sp, 492]
	str	wzr, [sp, 488]
	ldr	x0, [sp, 512]
	add	x0, x0, 1
	str	x0, [sp, 512]
	b	.L38
.L41:
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	cmp	w0, 45
	bne	.L39
	mov	w0, 1
	str	w0, [sp, 508]
	b	.L40
.L39:
	mov	w0, 1
	str	w0, [sp, 504]
.L40:
	ldr	x0, [sp, 512]
	add	x0, x0, 1
	str	x0, [sp, 512]
.L38:
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	cmp	w0, 45
	beq	.L41
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	cmp	w0, 48
	beq	.L41
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	cmp	w0, 42
	bne	.L47
	ldr	w1, [sp, 456]
	ldr	x0, [sp, 432]
	cmp	w1, 0
	blt	.L43
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 432]
	b	.L44
.L43:
	add	w2, w1, 8
	str	w2, [sp, 456]
	ldr	w2, [sp, 456]
	cmp	w2, 0
	ble	.L45
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 432]
	b	.L44
.L45:
	ldr	x2, [sp, 440]
	sxtw	x0, w1
	add	x0, x2, x0
.L44:
	ldr	w0, [x0]
	str	w0, [sp, 500]
	ldr	w0, [sp, 500]
	cmp	w0, 0
	bge	.L46
	mov	w0, 1
	str	w0, [sp, 508]
	ldr	w0, [sp, 500]
	neg	w0, w0
	str	w0, [sp, 500]
.L46:
	ldr	x0, [sp, 512]
	add	x0, x0, 1
	str	x0, [sp, 512]
	b	.L47
.L49:
	ldr	w1, [sp, 500]
	mov	w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	lsl	w0, w0, 1
	mov	w1, w0
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	sub	w0, w0, #48
	add	w0, w1, w0
	str	w0, [sp, 500]
	ldr	x0, [sp, 512]
	add	x0, x0, 1
	str	x0, [sp, 512]
.L47:
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	cmp	w0, 47
	bls	.L48
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	cmp	w0, 57
	bls	.L49
.L48:
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	cmp	w0, 46
	bne	.L53
	str	wzr, [sp, 496]
	ldr	x0, [sp, 512]
	add	x0, x0, 1
	str	x0, [sp, 512]
	b	.L51
.L52:
	ldr	w1, [sp, 496]
	mov	w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	lsl	w0, w0, 1
	mov	w1, w0
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	sub	w0, w0, #48
	add	w0, w1, w0
	str	w0, [sp, 496]
	ldr	x0, [sp, 512]
	add	x0, x0, 1
	str	x0, [sp, 512]
.L51:
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	cmp	w0, 47
	bls	.L53
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	cmp	w0, 57
	bls	.L52
	b	.L53
.L54:
	mov	w0, 1
	str	w0, [sp, 492]
	ldr	x0, [sp, 512]
	add	x0, x0, 1
	str	x0, [sp, 512]
.L53:
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	cmp	w0, 108
	beq	.L54
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	cmp	w0, 122
	beq	.L54
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	cmp	w0, 120
	beq	.L55
	cmp	w0, 120
	bgt	.L56
	cmp	w0, 117
	beq	.L55
	cmp	w0, 117
	bgt	.L56
	cmp	w0, 115
	beq	.L57
	cmp	w0, 115
	bgt	.L56
	cmp	w0, 111
	beq	.L55
	cmp	w0, 111
	bgt	.L56
	cmp	w0, 105
	beq	.L58
	cmp	w0, 105
	bgt	.L56
	cmp	w0, 102
	beq	.L59
	cmp	w0, 102
	bgt	.L56
	cmp	w0, 100
	beq	.L58
	cmp	w0, 100
	bgt	.L56
	cmp	w0, 88
	beq	.L55
	cmp	w0, 99
	beq	.L60
	b	.L56
.L58:
	ldr	w0, [sp, 492]
	cmp	w0, 0
	beq	.L61
	ldr	w1, [sp, 456]
	ldr	x0, [sp, 432]
	cmp	w1, 0
	blt	.L62
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 432]
	b	.L63
.L62:
	add	w2, w1, 8
	str	w2, [sp, 456]
	ldr	w2, [sp, 456]
	cmp	w2, 0
	ble	.L64
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 432]
	b	.L63
.L64:
	ldr	x2, [sp, 440]
	sxtw	x0, w1
	add	x0, x2, x0
.L63:
	ldr	x0, [x0]
	str	x0, [sp, 480]
	b	.L65
.L61:
	ldr	w1, [sp, 456]
	ldr	x0, [sp, 432]
	cmp	w1, 0
	blt	.L66
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 432]
	b	.L67
.L66:
	add	w2, w1, 8
	str	w2, [sp, 456]
	ldr	w2, [sp, 456]
	cmp	w2, 0
	ble	.L68
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 432]
	b	.L67
.L68:
	ldr	x2, [sp, 440]
	sxtw	x0, w1
	add	x0, x2, x0
.L67:
	ldr	w0, [x0]
	sxtw	x0, w0
	str	x0, [sp, 480]
.L65:
	ldr	x0, [sp, 480]
	cmp	x0, 0
	bge	.L69
	ldr	x0, [sp, 480]
	neg	x0, x0
	b	.L70
.L69:
	ldr	x0, [sp, 480]
.L70:
	ldr	x1, [sp, 480]
	lsr	x1, x1, 63
	and	w1, w1, 255
	add	x5, sp, 32
	mov	w4, 0
	mov	w3, 10
	mov	w2, w1
	mov	x1, x0
	mov	x0, x5
	bl	digits
	str	w0, [sp, 488]
	b	.L71
.L55:
	ldr	w0, [sp, 492]
	cmp	w0, 0
	beq	.L72
	ldr	w1, [sp, 456]
	ldr	x0, [sp, 432]
	cmp	w1, 0
	blt	.L73
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 432]
	b	.L74
.L73:
	add	w2, w1, 8
	str	w2, [sp, 456]
	ldr	w2, [sp, 456]
	cmp	w2, 0
	ble	.L75
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 432]
	b	.L74
.L75:
	ldr	x2, [sp, 440]
	sxtw	x0, w1
	add	x0, x2, x0
.L74:
	ldr	x0, [x0]
	str	x0, [sp, 472]
	b	.L76
.L72:
	ldr	w1, [sp, 456]
	ldr	x0, [sp, 432]
	cmp	w1, 0
	blt	.L77
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 432]
	b	.L78
.L77:
	add	w2, w1, 8
	str	w2, [sp, 456]
	ldr	w2, [sp, 456]
	cmp	w2, 0
	ble	.L79
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 432]
	b	.L78
.L79:
	ldr	x2, [sp, 440]
	sxtw	x0, w1
	add	x0, x2, x0
.L78:
	ldr	w0, [x0]
	uxtw	x0, w0
	str	x0, [sp, 472]
.L76:
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	cmp	w0, 111
	beq	.L80
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	cmp	w0, 117
	bne	.L81
	mov	w0, 10
	b	.L82
.L81:
	mov	w0, 16
	b	.L82
.L80:
	mov	w0, 8
.L82:
	ldr	x1, [sp, 512]
	ldrb	w1, [x1]
	cmp	w1, 88
	cset	w1, eq
	and	w1, w1, 255
	add	x5, sp, 32
	mov	w4, w1
	mov	w3, w0
	mov	w2, 0
	ldr	x1, [sp, 472]
	mov	x0, x5
	bl	digits
	str	w0, [sp, 488]
	b	.L71
.L60:
	ldr	w1, [sp, 456]
	ldr	x0, [sp, 432]
	cmp	w1, 0
	blt	.L83
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 432]
	b	.L84
.L83:
	add	w2, w1, 8
	str	w2, [sp, 456]
	ldr	w2, [sp, 456]
	cmp	w2, 0
	ble	.L85
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 432]
	b	.L84
.L85:
	ldr	x2, [sp, 440]
	sxtw	x0, w1
	add	x0, x2, x0
.L84:
	ldr	w2, [x0]
	ldr	w0, [sp, 488]
	add	w1, w0, 1
	str	w1, [sp, 488]
	and	w2, w2, 255
	sxtw	x0, w0
	add	x1, sp, 32
	strb	w2, [x1, x0]
	str	wzr, [sp, 504]
	b	.L71
.L57:
	ldr	w1, [sp, 456]
	ldr	x0, [sp, 432]
	cmp	w1, 0
	blt	.L86
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 432]
	b	.L87
.L86:
	add	w2, w1, 8
	str	w2, [sp, 456]
	ldr	w2, [sp, 456]
	cmp	w2, 0
	ble	.L88
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 432]
	b	.L87
.L88:
	ldr	x2, [sp, 440]
	sxtw	x0, w1
	add	x0, x2, x0
.L87:
	ldr	x0, [x0]
	str	x0, [sp, 464]
	b	.L89
.L91:
	ldrsw	x0, [sp, 488]
	ldr	x1, [sp, 464]
	add	x0, x1, x0
	ldrb	w2, [x0]
	ldrsw	x0, [sp, 488]
	add	x1, sp, 32
	strb	w2, [x1, x0]
	ldr	w0, [sp, 488]
	add	w0, w0, 1
	str	w0, [sp, 488]
.L89:
	ldrsw	x0, [sp, 488]
	ldr	x1, [sp, 464]
	add	x0, x1, x0
	ldrb	w0, [x0]
	cmp	w0, 0
	beq	.L90
	ldr	w0, [sp, 496]
	cmp	w0, 0
	blt	.L91
	ldr	w1, [sp, 488]
	ldr	w0, [sp, 496]
	cmp	w1, w0
	blt	.L91
.L90:
	str	wzr, [sp, 504]
	b	.L71
.L59:
	ldr	w1, [sp, 460]
	ldr	x0, [sp, 432]
	cmp	w1, 0
	blt	.L92
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 432]
	b	.L93
.L92:
	add	w2, w1, 16
	str	w2, [sp, 460]
	ldr	w2, [sp, 460]
	cmp	w2, 0
	ble	.L94
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 432]
	b	.L93
.L94:
	ldr	x2, [sp, 448]
	sxtw	x0, w1
	add	x0, x2, x0
.L93:
	ldr	d31, [x0]
	ldr	w0, [sp, 496]
	cmp	w0, 0
	blt	.L95
	ldr	w0, [sp, 496]
	b	.L96
.L95:
	mov	w0, 6
.L96:
	add	x2, sp, 32
	mov	w1, w0
	fmov	d0, d31
	mov	x0, x2
	bl	fixed
	str	w0, [sp, 488]
	b	.L71
.L56:
	ldr	w0, [sp, 488]
	add	w1, w0, 1
	str	w1, [sp, 488]
	ldr	x1, [sp, 512]
	ldrb	w2, [x1]
	sxtw	x0, w0
	add	x1, sp, 32
	strb	w2, [x1, x0]
	nop
.L71:
	ldrsw	x0, [sp, 524]
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	add	x1, sp, 32
	ldr	w5, [sp, 504]
	ldr	w4, [sp, 508]
	ldr	w3, [sp, 500]
	ldr	w2, [sp, 488]
	bl	field
	mov	w1, w0
	ldr	w0, [sp, 524]
	add	w0, w0, w1
	str	w0, [sp, 524]
.L97:
	ldr	x0, [sp, 512]
	add	x0, x0, 1
	str	x0, [sp, 512]
.L35:
	ldr	x0, [sp, 512]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L98
	ldrsw	x0, [sp, 524]
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	strb	wzr, [x0]
	ldr	w0, [sp, 524]
	ldp	x29, x30, [sp]
	add	sp, sp, 704
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"%d %i %u %x %X %o"
	.align	3
.LC3:
	.string	"same"
	.align	3
.LC4:
	.string	"DIFF"
	.align	3
.LC5:
	.string	"%s %d %d |%s|\n"
	.align	3
.LC6:
	.string	"     want |%s|\n"
	.align	3
.LC7:
	.string	"%ld %lu %lx %zu %c%c %s|%-6s|%6s"
	.align	3
.LC8:
	.string	"cd"
	.align	3
.LC9:
	.string	"ab"
	.align	3
.LC10:
	.string	"str"
	.align	3
.LC11:
	.string	"%d %d %d %d %d %d %d %d %d %d %d %d"
	.align	3
.LC12:
	.string	"%.1f %.2f %.3f %.4f %.1f %.2f %.3f %.4f %.1f %.2f %f"
	.align	3
.LC13:
	.string	"two"
	.align	3
.LC14:
	.string	"%d %.3f %s %ld %.2f %c %u %.1f %x %.4f %d %.2f %lu %.3f %d %.1f %d %.2f"
	.align	3
.LC15:
	.string	"%5d|%-5d|%05d|%*d|%-*u|%08x|%*s|%-*s|"
	.align	3
.LC16:
	.string	"y"
	.align	3
.LC17:
	.string	"z"
	.align	3
.LC18:
	.string	"truncate"
	.align	3
.LC19:
	.string	""
	.align	3
.LC20:
	.string	"%%|%c|%s|%d%%|%.3s|%010.2f|%-9.1f|"
	.align	3
.LC21:
	.string	"%lx %lo %lX %ld"
	.align	3
.LC22:
	.string	"%.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %.1f %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #320
	stp	x29, x30, [sp, 224]
	add	x29, sp, 224
	mov	w7, 8
	mov	w6, 48879
	mov	w5, 48879
	mov	w4, 10240
	movk	w4, 0xee6b, lsl 16
	mov	w3, 17
	mov	w2, -5
	adrp	x0, .LC2
	add	x1, x0, :lo12:.LC2
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	mini
	str	w0, [sp, 316]
	mov	w0, 8
	str	w0, [sp]
	mov	w7, 48879
	mov	w6, 48879
	mov	w5, 10240
	movk	w5, 0xee6b, lsl 16
	mov	w4, 17
	mov	w3, -5
	adrp	x0, .LC2
	add	x2, x0, :lo12:.LC2
	mov	x1, 512
	adrp	x0, B
	add	x0, x0, :lo12:B
	bl	snprintf
	str	w0, [sp, 312]
	ldr	w1, [sp, 316]
	ldr	w0, [sp, 312]
	cmp	w1, w0
	bne	.L101
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	bne	.L101
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	b	.L102
.L101:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
.L102:
	adrp	x1, A
	add	x4, x1, :lo12:A
	ldr	w3, [sp, 312]
	ldr	w2, [sp, 316]
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	beq	.L103
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
.L103:
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	str	x0, [sp, 16]
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	str	x0, [sp, 8]
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	str	x0, [sp]
	mov	w7, 107
	mov	w6, 111
	mov	x5, 34359738368
	mov	x4, 51966
	movk	x4, 0xface, lsl 16
	movk	x4, 0xfeed, lsl 32
	mov	x3, -1
	mov	x2, -1227
	movk	x2, 0x8e04, lsl 16
	movk	x2, 0xfee0, lsl 32
	adrp	x0, .LC7
	add	x1, x0, :lo12:.LC7
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	mini
	str	w0, [sp, 308]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	str	x0, [sp, 24]
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	str	x0, [sp, 16]
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	str	x0, [sp, 8]
	mov	w0, 107
	str	w0, [sp]
	mov	w7, 111
	mov	x6, 34359738368
	mov	x5, 51966
	movk	x5, 0xface, lsl 16
	movk	x5, 0xfeed, lsl 32
	mov	x4, -1
	mov	x3, -1227
	movk	x3, 0x8e04, lsl 16
	movk	x3, 0xfee0, lsl 32
	adrp	x0, .LC7
	add	x2, x0, :lo12:.LC7
	mov	x1, 512
	adrp	x0, B
	add	x0, x0, :lo12:B
	bl	snprintf
	str	w0, [sp, 304]
	ldr	w1, [sp, 308]
	ldr	w0, [sp, 304]
	cmp	w1, w0
	bne	.L104
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	bne	.L104
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	b	.L105
.L104:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
.L105:
	adrp	x1, A
	add	x4, x1, :lo12:A
	ldr	w3, [sp, 304]
	ldr	w2, [sp, 308]
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	beq	.L106
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
.L106:
	mov	w0, -12
	str	w0, [sp, 40]
	mov	w0, 11
	str	w0, [sp, 32]
	mov	w0, -10
	str	w0, [sp, 24]
	mov	w0, 9
	str	w0, [sp, 16]
	mov	w0, -8
	str	w0, [sp, 8]
	mov	w0, 7
	str	w0, [sp]
	mov	w7, -6
	mov	w6, 5
	mov	w5, -4
	mov	w4, 3
	mov	w3, -2
	mov	w2, 1
	adrp	x0, .LC11
	add	x1, x0, :lo12:.LC11
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	mini
	str	w0, [sp, 300]
	mov	w0, -12
	str	w0, [sp, 48]
	mov	w0, 11
	str	w0, [sp, 40]
	mov	w0, -10
	str	w0, [sp, 32]
	mov	w0, 9
	str	w0, [sp, 24]
	mov	w0, -8
	str	w0, [sp, 16]
	mov	w0, 7
	str	w0, [sp, 8]
	mov	w0, -6
	str	w0, [sp]
	mov	w7, 5
	mov	w6, -4
	mov	w5, 3
	mov	w4, -2
	mov	w3, 1
	adrp	x0, .LC11
	add	x2, x0, :lo12:.LC11
	mov	x1, 512
	adrp	x0, B
	add	x0, x0, :lo12:B
	bl	snprintf
	str	w0, [sp, 296]
	ldr	w1, [sp, 300]
	ldr	w0, [sp, 296]
	cmp	w1, w0
	bne	.L107
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	bne	.L107
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	b	.L108
.L107:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
.L108:
	adrp	x1, A
	add	x4, x1, :lo12:A
	ldr	w3, [sp, 296]
	ldr	w2, [sp, 300]
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	beq	.L109
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
.L109:
	fmov	d31, 1.5e+0
	str	d31, [sp, 16]
	fmov	d31, -2.5e-1
	str	d31, [sp, 8]
	mov	x0, 35184372088832
	movk	x0, 0x4059, lsl 48
	fmov	d31, x0
	str	d31, [sp]
	mov	x0, 140737488355328
	movk	x0, 0x4004, lsl 48
	fmov	d7, x0
	fmov	d6, -3.75e-1
	fmov	d5, 3.75e+0
	fmov	d4, -7.5e+0
	mov	x0, 274877906944
	movk	x0, 0x4090, lsl 48
	fmov	d3, x0
	fmov	d2, 1.25e-1
	fmov	d1, -1.25e+0
	fmov	d0, 5.0e-1
	adrp	x0, .LC12
	add	x1, x0, :lo12:.LC12
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	mini
	str	w0, [sp, 292]
	fmov	d31, 1.5e+0
	str	d31, [sp, 16]
	fmov	d31, -2.5e-1
	str	d31, [sp, 8]
	mov	x0, 35184372088832
	movk	x0, 0x4059, lsl 48
	fmov	d31, x0
	str	d31, [sp]
	mov	x0, 140737488355328
	movk	x0, 0x4004, lsl 48
	fmov	d7, x0
	fmov	d6, -3.75e-1
	fmov	d5, 3.75e+0
	fmov	d4, -7.5e+0
	mov	x0, 274877906944
	movk	x0, 0x4090, lsl 48
	fmov	d3, x0
	fmov	d2, 1.25e-1
	fmov	d1, -1.25e+0
	fmov	d0, 5.0e-1
	adrp	x0, .LC12
	add	x2, x0, :lo12:.LC12
	mov	x1, 512
	adrp	x0, B
	add	x0, x0, :lo12:B
	bl	snprintf
	str	w0, [sp, 288]
	ldr	w1, [sp, 292]
	ldr	w0, [sp, 288]
	cmp	w1, w0
	bne	.L110
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	bne	.L110
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	b	.L111
.L110:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
.L111:
	adrp	x1, A
	add	x4, x1, :lo12:A
	ldr	w3, [sp, 288]
	ldr	w2, [sp, 292]
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	beq	.L112
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
.L112:
	mov	w0, -16
	str	w0, [sp, 24]
	mov	w0, 14
	str	w0, [sp, 16]
	mov	x0, 12
	str	x0, [sp, 8]
	mov	w0, -10
	str	w0, [sp]
	mov	x0, 70368744177664
	movk	x0, 0x4031, lsl 48
	fmov	d7, x0
	fmov	d6, 1.55e+1
	mov	x0, 211106232532992
	movk	x0, 0xc02b, lsl 48
	fmov	d5, x0
	mov	x0, 140737488355328
	movk	x0, 0x4027, lsl 48
	fmov	d4, x0
	mov	x0, 35184372088832
	movk	x0, 0x4022, lsl 48
	fmov	d3, x0
	mov	w7, 8
	fmov	d2, 7.5e+0
	mov	w6, 6
	mov	w5, 53
	fmov	d1, 4.25e+0
	mov	x4, -3
	adrp	x0, .LC13
	add	x3, x0, :lo12:.LC13
	fmov	d0, 1.25e-1
	mov	w2, 1
	adrp	x0, .LC14
	add	x1, x0, :lo12:.LC14
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	mini
	str	w0, [sp, 284]
	mov	w0, -16
	str	w0, [sp, 32]
	mov	w0, 14
	str	w0, [sp, 24]
	mov	x0, 12
	str	x0, [sp, 16]
	mov	w0, -10
	str	w0, [sp, 8]
	mov	w0, 8
	str	w0, [sp]
	mov	x0, 70368744177664
	movk	x0, 0x4031, lsl 48
	fmov	d7, x0
	fmov	d6, 1.55e+1
	mov	x0, 211106232532992
	movk	x0, 0xc02b, lsl 48
	fmov	d5, x0
	mov	x0, 140737488355328
	movk	x0, 0x4027, lsl 48
	fmov	d4, x0
	mov	x0, 35184372088832
	movk	x0, 0x4022, lsl 48
	fmov	d3, x0
	fmov	d2, 7.5e+0
	mov	w7, 6
	mov	w6, 53
	fmov	d1, 4.25e+0
	mov	x5, -3
	adrp	x0, .LC13
	add	x4, x0, :lo12:.LC13
	fmov	d0, 1.25e-1
	mov	w3, 1
	adrp	x0, .LC14
	add	x2, x0, :lo12:.LC14
	mov	x1, 512
	adrp	x0, B
	add	x0, x0, :lo12:B
	bl	snprintf
	str	w0, [sp, 280]
	ldr	w1, [sp, 284]
	ldr	w0, [sp, 280]
	cmp	w1, w0
	bne	.L113
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	bne	.L113
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	b	.L114
.L113:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
.L114:
	adrp	x1, A
	add	x4, x1, :lo12:A
	ldr	w3, [sp, 280]
	ldr	w2, [sp, 284]
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	beq	.L115
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
.L115:
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	str	x0, [sp, 40]
	mov	w0, -3
	str	w0, [sp, 32]
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	str	x0, [sp, 24]
	mov	w0, 4
	str	w0, [sp, 16]
	mov	w0, 2748
	str	w0, [sp, 8]
	mov	w0, 5
	str	w0, [sp]
	mov	w7, -6
	mov	w6, 99
	mov	w5, 7
	mov	w4, -42
	mov	w3, 42
	mov	w2, 42
	adrp	x0, .LC15
	add	x1, x0, :lo12:.LC15
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	mini
	str	w0, [sp, 276]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	str	x0, [sp, 48]
	mov	w0, -3
	str	w0, [sp, 40]
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	str	x0, [sp, 32]
	mov	w0, 4
	str	w0, [sp, 24]
	mov	w0, 2748
	str	w0, [sp, 16]
	mov	w0, 5
	str	w0, [sp, 8]
	mov	w0, -6
	str	w0, [sp]
	mov	w7, 99
	mov	w6, 7
	mov	w5, -42
	mov	w4, 42
	mov	w3, 42
	adrp	x0, .LC15
	add	x2, x0, :lo12:.LC15
	mov	x1, 512
	adrp	x0, B
	add	x0, x0, :lo12:B
	bl	snprintf
	str	w0, [sp, 272]
	ldr	w1, [sp, 276]
	ldr	w0, [sp, 272]
	cmp	w1, w0
	bne	.L116
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	bne	.L116
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	b	.L117
.L116:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
.L117:
	adrp	x1, A
	add	x4, x1, :lo12:A
	ldr	w3, [sp, 272]
	ldr	w2, [sp, 276]
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	beq	.L118
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
.L118:
	fmov	d1, 5.0e-1
	fmov	d0, -3.5e+0
	adrp	x0, .LC18
	add	x5, x0, :lo12:.LC18
	mov	w4, 100
	adrp	x0, .LC19
	add	x3, x0, :lo12:.LC19
	mov	w2, 35
	adrp	x0, .LC20
	add	x1, x0, :lo12:.LC20
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	mini
	str	w0, [sp, 268]
	fmov	d1, 5.0e-1
	fmov	d0, -3.5e+0
	adrp	x0, .LC18
	add	x6, x0, :lo12:.LC18
	mov	w5, 100
	adrp	x0, .LC19
	add	x4, x0, :lo12:.LC19
	mov	w3, 35
	adrp	x0, .LC20
	add	x2, x0, :lo12:.LC20
	mov	x1, 512
	adrp	x0, B
	add	x0, x0, :lo12:B
	bl	snprintf
	str	w0, [sp, 264]
	ldr	w1, [sp, 268]
	ldr	w0, [sp, 264]
	cmp	w1, w0
	bne	.L119
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	bne	.L119
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	b	.L120
.L119:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
.L120:
	adrp	x1, A
	add	x4, x1, :lo12:A
	ldr	w3, [sp, 264]
	ldr	w2, [sp, 268]
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	beq	.L121
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
.L121:
	mov	x5, -9223372036854775808
	mov	x4, 52719
	movk	x4, 0x89ab, lsl 16
	movk	x4, 0x4567, lsl 32
	movk	x4, 0x123, lsl 48
	mov	x3, -9223372036854775808
	mov	x2, -1
	adrp	x0, .LC21
	add	x1, x0, :lo12:.LC21
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	mini
	str	w0, [sp, 260]
	mov	x6, -9223372036854775808
	mov	x5, 52719
	movk	x5, 0x89ab, lsl 16
	movk	x5, 0x4567, lsl 32
	movk	x5, 0x123, lsl 48
	mov	x4, -9223372036854775808
	mov	x3, -1
	adrp	x0, .LC21
	add	x2, x0, :lo12:.LC21
	mov	x1, 512
	adrp	x0, B
	add	x0, x0, :lo12:B
	bl	snprintf
	str	w0, [sp, 256]
	ldr	w1, [sp, 260]
	ldr	w0, [sp, 256]
	cmp	w1, w0
	bne	.L122
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	bne	.L122
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	b	.L123
.L122:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
.L123:
	adrp	x1, A
	add	x4, x1, :lo12:A
	ldr	w3, [sp, 256]
	ldr	w2, [sp, 260]
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	beq	.L124
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
.L124:
	mov	w0, 20
	str	w0, [sp, 200]
	mov	w0, 19
	str	w0, [sp, 192]
	mov	w0, 18
	str	w0, [sp, 184]
	mov	w0, 17
	str	w0, [sp, 176]
	mov	w0, 16
	str	w0, [sp, 168]
	mov	w0, 15
	str	w0, [sp, 160]
	mov	w0, 14
	str	w0, [sp, 152]
	mov	w0, 13
	str	w0, [sp, 144]
	mov	w0, 12
	str	w0, [sp, 136]
	mov	w0, 11
	str	w0, [sp, 128]
	mov	w0, 10
	str	w0, [sp, 120]
	mov	w0, 9
	str	w0, [sp, 112]
	mov	w0, 8
	str	w0, [sp, 104]
	mov	w0, 7
	str	w0, [sp, 96]
	mov	x0, 140737488355328
	movk	x0, 0x4033, lsl 48
	fmov	d31, x0
	str	d31, [sp, 88]
	mov	x0, 140737488355328
	movk	x0, 0x4032, lsl 48
	fmov	d31, x0
	str	d31, [sp, 80]
	mov	x0, 140737488355328
	movk	x0, 0x4031, lsl 48
	fmov	d31, x0
	str	d31, [sp, 72]
	mov	x0, 140737488355328
	movk	x0, 0x4030, lsl 48
	fmov	d31, x0
	str	d31, [sp, 64]
	fmov	d31, 1.55e+1
	str	d31, [sp, 56]
	fmov	d31, 1.45e+1
	str	d31, [sp, 48]
	fmov	d31, 1.35e+1
	str	d31, [sp, 40]
	fmov	d31, 1.25e+1
	str	d31, [sp, 32]
	fmov	d31, 1.15e+1
	str	d31, [sp, 24]
	fmov	d31, 1.05e+1
	str	d31, [sp, 16]
	fmov	d31, 9.5e+0
	str	d31, [sp, 8]
	fmov	d31, 8.5e+0
	str	d31, [sp]
	mov	w7, 6
	mov	w6, 5
	mov	w5, 4
	mov	w4, 3
	mov	w3, 2
	mov	w2, 1
	fmov	d7, 7.5e+0
	fmov	d6, 6.5e+0
	fmov	d5, 5.5e+0
	fmov	d4, 4.5e+0
	fmov	d3, 3.5e+0
	fmov	d2, 2.5e+0
	fmov	d1, 1.5e+0
	fmov	d0, 5.0e-1
	adrp	x0, .LC22
	add	x1, x0, :lo12:.LC22
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	mini
	str	w0, [sp, 252]
	mov	w0, 20
	str	w0, [sp, 208]
	mov	w0, 19
	str	w0, [sp, 200]
	mov	w0, 18
	str	w0, [sp, 192]
	mov	w0, 17
	str	w0, [sp, 184]
	mov	w0, 16
	str	w0, [sp, 176]
	mov	w0, 15
	str	w0, [sp, 168]
	mov	w0, 14
	str	w0, [sp, 160]
	mov	w0, 13
	str	w0, [sp, 152]
	mov	w0, 12
	str	w0, [sp, 144]
	mov	w0, 11
	str	w0, [sp, 136]
	mov	w0, 10
	str	w0, [sp, 128]
	mov	w0, 9
	str	w0, [sp, 120]
	mov	w0, 8
	str	w0, [sp, 112]
	mov	w0, 7
	str	w0, [sp, 104]
	mov	w0, 6
	str	w0, [sp, 96]
	mov	x0, 140737488355328
	movk	x0, 0x4033, lsl 48
	fmov	d31, x0
	str	d31, [sp, 88]
	mov	x0, 140737488355328
	movk	x0, 0x4032, lsl 48
	fmov	d31, x0
	str	d31, [sp, 80]
	mov	x0, 140737488355328
	movk	x0, 0x4031, lsl 48
	fmov	d31, x0
	str	d31, [sp, 72]
	mov	x0, 140737488355328
	movk	x0, 0x4030, lsl 48
	fmov	d31, x0
	str	d31, [sp, 64]
	fmov	d31, 1.55e+1
	str	d31, [sp, 56]
	fmov	d31, 1.45e+1
	str	d31, [sp, 48]
	fmov	d31, 1.35e+1
	str	d31, [sp, 40]
	fmov	d31, 1.25e+1
	str	d31, [sp, 32]
	fmov	d31, 1.15e+1
	str	d31, [sp, 24]
	fmov	d31, 1.05e+1
	str	d31, [sp, 16]
	fmov	d31, 9.5e+0
	str	d31, [sp, 8]
	fmov	d31, 8.5e+0
	str	d31, [sp]
	mov	w7, 5
	mov	w6, 4
	mov	w5, 3
	mov	w4, 2
	mov	w3, 1
	fmov	d7, 7.5e+0
	fmov	d6, 6.5e+0
	fmov	d5, 5.5e+0
	fmov	d4, 4.5e+0
	fmov	d3, 3.5e+0
	fmov	d2, 2.5e+0
	fmov	d1, 1.5e+0
	fmov	d0, 5.0e-1
	adrp	x0, .LC22
	add	x2, x0, :lo12:.LC22
	mov	x1, 512
	adrp	x0, B
	add	x0, x0, :lo12:B
	bl	snprintf
	str	w0, [sp, 248]
	ldr	w1, [sp, 252]
	ldr	w0, [sp, 248]
	cmp	w1, w0
	bne	.L125
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	bne	.L125
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	b	.L126
.L125:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
.L126:
	adrp	x1, A
	add	x4, x1, :lo12:A
	ldr	w3, [sp, 248]
	ldr	w2, [sp, 252]
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, A
	add	x0, x0, :lo12:A
	bl	strcmp
	cmp	w0, 0
	beq	.L127
	adrp	x0, B
	add	x1, x0, :lo12:B
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
.L127:
	mov	w0, 0
	ldp	x29, x30, [sp, 224]
	add	sp, sp, 320
	ret


	.bss
	.balign 8
A:
	.skip 512
	.balign 8
B:
	.skip 512
