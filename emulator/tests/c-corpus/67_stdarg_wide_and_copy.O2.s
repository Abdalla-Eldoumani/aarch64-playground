	.text
	.align	2
	.align 5
take3:
	ldr	w4, [x0, 24]
	ldr	x1, [x0]
	tbnz	w4, #31, .L15
.L2:
	add	x2, x1, 11
	ldr	w3, [x1]
	and	x2, x2, -8
.L4:
	add	x1, x2, 11
	and	x1, x1, -8
.L6:
	ldr	w2, [x2]
.L13:
	add	w2, w2, w2, lsl 2
	add	x4, x1, 11
	and	x4, x4, -8
	str	x4, [x0]
	lsl	w2, w2, 1
	mov	w0, 100
	ldr	w1, [x1]
	madd	w0, w3, w0, w2
	add	w0, w0, w1
	ret
	.align 2
.L15:
	add	w2, w4, 8
	str	w2, [x0, 24]
	cmp	w2, 0
	bgt	.L2
	ldr	x5, [x0, 8]
	ldr	w3, [x5, w4, sxtw]
	beq	.L16
	add	w6, w4, 16
	str	w6, [x0, 24]
	cmp	w6, 0
	ble	.L7
	add	x4, x1, 11
	mov	x2, x1
	and	x1, x4, -8
	b	.L6
	.align 2
.L7:
	ldr	w2, [x5, w2, sxtw]
	beq	.L13
	add	w4, w4, 24
	str	w4, [x0, 24]
	cmp	w4, 0
	bgt	.L13
	add	w2, w2, w2, lsl 2
	add	x1, x5, w6, sxtw
	mov	w0, 100
	lsl	w2, w2, 1
	ldr	w1, [x1]
	madd	w0, w3, w0, w2
	add	w0, w0, w1
	ret
.L16:
	mov	x2, x1
	b	.L4
	.section .rodata
	.align	3
.LC0:
	.string	" %s:%016lx%016lx"
	.text
	.align	2
	.align 5
show128:
	stp	x29, x30, [sp, -48]!
	mov	x2, 16
	mov	x29, sp
	str	x19, [sp, 16]
	mov	x19, x0
	add	x0, sp, 32
	bl	memcpy
	ldp	x3, x2, [sp, 32]
	mov	x1, x19
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldp	x1, x0, [sp, 32]
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 48
	eor	x0, x1, x0
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"%-18s"
	.align	3
.LC2:
	.string	"q"
	.align	3
.LC3:
	.string	"L"
	.align	3
.LC4:
	.string	" i:%d"
	.align	3
.LC5:
	.string	" c:%d"
	.align	3
.LC6:
	.string	" d:%.17g"
	.align	3
.LC7:
	.string	" T:%d"
	.align	3
.LC8:
	.string	"\n  sum=%lx check=%016lx\n"
	.text
	.align	2
	.align 5
wide:
	stp	x29, x30, [sp, -384]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x20, x0
	add	x0, sp, 384
	stp	x0, x0, [sp, 128]
	add	x0, sp, 320
	str	x0, [sp, 144]
	mov	w0, -56
	str	w0, [sp, 152]
	mov	w0, -128
	str	w0, [sp, 156]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	stp	x21, x22, [sp, 32]
	ldp	q31, q30, [sp, 128]
	stp	q0, q1, [sp, 192]
	stp	q2, q3, [sp, 224]
	stp	q31, q30, [sp, 160]
	stp	q4, q5, [sp, 256]
	stp	q6, q7, [sp, 288]
	stp	x1, x2, [sp, 328]
	mov	x1, x20
	stp	x3, x4, [sp, 344]
	stp	x5, x6, [sp, 360]
	str	x7, [sp, 376]
	bl	printf
	ldrb	w1, [x20]
	cbz	w1, .L63
	adrp	x22, .LC6
	mov	x0, 4652218415073722368
	mov	x21, x20
	add	x22, x22, :lo12:.LC6
	mov	x19, 0
	stp	x23, x24, [sp, 48]
	adrp	x23, .LC4
	str	d15, [sp, 64]
	fmov	d15, x0
	b	.L44
	.align 2
.L72:
	cmp	w1, 84
	beq	.L23
	cmp	w1, 99
	beq	.L24
	cmp	w1, 76
	bne	.L26
	ldr	w1, [sp, 156]
	ldr	x0, [sp, 128]
	tbnz	w1, #31, .L70
.L32:
	add	x0, x0, 15
	and	x0, x0, -16
	add	x1, x0, 16
	str	x1, [sp, 128]
.L34:
	ldr	q30, [x0]
	add	x1, sp, 112
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	str	q30, [sp, 112]
	bl	show128
	add	x19, x19, x0
	.align 5
.L26:
	ldrb	w1, [x21, 1]!
	cbz	w1, .L71
.L44:
	cmp	w1, 100
	beq	.L21
	bls	.L72
	cmp	w1, 105
	beq	.L27
	cmp	w1, 113
	bne	.L26
	ldr	w1, [sp, 152]
	ldr	x0, [sp, 128]
	tbnz	w1, #31, .L73
.L29:
	add	x0, x0, 15
	and	x0, x0, -16
	add	x1, x0, 16
	str	x1, [sp, 128]
.L31:
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp, 112]
	add	x1, sp, 112
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	show128
	add	x19, x19, x0
	ldrb	w1, [x21, 1]!
	cbnz	w1, .L44
	.align 5
.L71:
	ldrb	w1, [x20]
	mov	x21, 0
	cbz	w1, .L64
	movi	v31.4s, 0
	.align 5
.L62:
	str	q31, [sp, 96]
	cmp	w1, 113
	beq	.L74
	cmp	w1, 76
	beq	.L75
	cmp	w1, 100
	beq	.L76
	cmp	w1, 84
	beq	.L77
	ldr	w1, [sp, 184]
	ldr	x0, [sp, 160]
	tbnz	w1, #31, .L78
.L59:
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 160]
.L61:
	ldr	w1, [x0]
.L49:
	eor	x21, x1, x21, ror 57
	ldrb	w1, [x20, 1]!
	cbnz	w1, .L62
.L64:
	ldp	x23, x24, [sp, 48]
	ldr	d15, [sp, 64]
.L20:
	mov	x2, x21
	mov	x1, x19
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 384
	ret
	.align 2
.L24:
	ldr	w1, [sp, 152]
	ldr	x0, [sp, 128]
	tbnz	w1, #31, .L79
.L38:
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 128]
.L40:
	ldr	w24, [x0]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	sxtb	w1, w24
	add	x19, x19, w24, uxtb
	bl	printf
	b	.L26
	.align 2
.L21:
	ldr	w1, [sp, 156]
	ldr	x0, [sp, 128]
	tbnz	w1, #31, .L80
.L41:
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 128]
.L43:
	ldr	d0, [x0]
	mov	x0, x22
	str	d0, [sp, 88]
	bl	printf
	ldr	d0, [sp, 88]
	fmul	d0, d0, d15
	fcvtzs	x0, d0
	add	x19, x19, x0
	b	.L26
	.align 2
.L23:
	add	x0, sp, 128
	bl	take3
	mov	w1, w0
	add	x19, x19, w0, uxtw
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	b	.L26
	.align 2
.L27:
	ldr	w1, [sp, 152]
	ldr	x0, [sp, 128]
	tbnz	w1, #31, .L81
.L35:
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 128]
.L37:
	ldr	w24, [x0]
	add	x0, x23, :lo12:.LC4
	mov	w1, w24
	bl	printf
	add	x19, x19, w24, uxtw
	b	.L26
	.align 2
.L74:
	ldr	w1, [sp, 184]
	ldr	x0, [sp, 160]
	tbnz	w1, #31, .L82
.L46:
	add	x0, x0, 15
	and	x0, x0, -16
	add	x1, x0, 16
	str	x1, [sp, 160]
.L48:
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp, 112]
.L68:
	mov	x2, 16
.L69:
	add	x1, sp, 112
	add	x0, sp, 96
	bl	memcpy
	ldp	x0, x1, [sp, 96]
	movi	v31.4s, 0
	add	x1, x1, x1, lsl 1
	eor	x1, x1, x0
	b	.L49
	.align 2
.L78:
	add	w2, w1, 8
	str	w2, [sp, 184]
	cmp	w2, 0
	bgt	.L59
	ldr	x0, [sp, 168]
	add	x0, x0, w1, sxtw
	b	.L61
	.align 2
.L75:
	ldr	w1, [sp, 188]
	ldr	x0, [sp, 160]
	tbnz	w1, #31, .L83
.L51:
	add	x0, x0, 15
	and	x0, x0, -16
	add	x1, x0, 16
	str	x1, [sp, 160]
.L53:
	ldr	q30, [x0]
	str	q30, [sp, 112]
	b	.L68
	.align 2
.L76:
	ldr	w1, [sp, 188]
	ldr	x0, [sp, 160]
	tbnz	w1, #31, .L84
.L55:
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 160]
.L57:
	ldr	d30, [x0]
	mov	x2, 8
	str	d30, [sp, 112]
	b	.L69
	.align 2
.L77:
	add	x0, sp, 160
	bl	take3
	uxtw	x1, w0
	b	.L49
	.align 2
.L82:
	add	w1, w1, 15
	and	w1, w1, -16
	add	w2, w1, 16
	str	w2, [sp, 184]
	cmp	w2, 0
	bgt	.L46
	ldr	x0, [sp, 168]
	add	x0, x0, w1, sxtw
	b	.L48
.L83:
	add	w2, w1, 16
	str	w2, [sp, 188]
	cmp	w2, 0
	bgt	.L51
	ldr	x0, [sp, 176]
	add	x0, x0, w1, sxtw
	b	.L53
.L73:
	add	w1, w1, 15
	and	w1, w1, -16
	add	w2, w1, 16
	str	w2, [sp, 152]
	cmp	w2, 0
	bgt	.L29
	ldr	x0, [sp, 136]
	add	x0, x0, w1, sxtw
	b	.L31
.L70:
	add	w2, w1, 16
	str	w2, [sp, 156]
	cmp	w2, 0
	bgt	.L32
	ldr	x0, [sp, 144]
	add	x0, x0, w1, sxtw
	b	.L34
.L81:
	add	w2, w1, 8
	str	w2, [sp, 152]
	cmp	w2, 0
	bgt	.L35
	ldr	x0, [sp, 136]
	add	x0, x0, w1, sxtw
	b	.L37
.L80:
	add	w2, w1, 16
	str	w2, [sp, 156]
	cmp	w2, 0
	bgt	.L41
	ldr	x0, [sp, 144]
	add	x0, x0, w1, sxtw
	b	.L43
.L79:
	add	w2, w1, 8
	str	w2, [sp, 152]
	cmp	w2, 0
	bgt	.L38
	ldr	x0, [sp, 136]
	add	x0, x0, w1, sxtw
	b	.L40
.L84:
	add	w2, w1, 16
	str	w2, [sp, 188]
	cmp	w2, 0
	bgt	.L55
	ldr	x0, [sp, 176]
	add	x0, x0, w1, sxtw
	b	.L57
.L63:
	mov	x19, 0
	mov	x21, 0
	b	.L20
	.section .rodata
	.align	3
.LC9:
	.string	" %d:%g"
	.align	3
.LC10:
	.string	"\n  fp_full=%g\n"
	.text
	.align	2
	.align 5
fp_full:
	stp	x29, x30, [sp, -160]!
	mov	x29, sp
	stp	d14, d15, [sp, 48]
	fadd	d15, d0, d1
	stp	x21, x22, [sp, 32]
	mov	w21, w0
	add	x0, sp, 160
	fadd	d15, d15, d2
	stp	x0, x0, [sp, 64]
	add	x0, sp, 96
	stp	x19, x20, [sp, 16]
	adrp	x20, .LC9
	mov	w19, 0
	fadd	d15, d15, d3
	add	x20, x20, :lo12:.LC9
	str	x0, [sp, 80]
	mov	w0, -56
	str	w0, [sp, 88]
	str	wzr, [sp, 92]
	fadd	d15, d15, d4
	stp	x1, x2, [sp, 104]
	stp	x3, x4, [sp, 120]
	fadd	d15, d15, d5
	stp	x5, x6, [sp, 136]
	str	x7, [sp, 152]
	fadd	d15, d15, d6
	fadd	d15, d15, d7
	b	.L92
	.align 2
.L86:
	add	x0, x1, 11
	ldr	w22, [x1]
	ldr	w1, [sp, 92]
	and	x0, x0, -8
	str	x0, [sp, 64]
	tbnz	w1, #31, .L95
.L89:
	add	x2, x0, 15
	and	x2, x2, -8
	str	x2, [sp, 64]
.L91:
	ldr	d14, [x0]
	mov	w1, w22
	mov	x0, x20
	add	w19, w19, 1
	fmov	d0, d14
	bl	printf
	scvtf	d7, w22
	fmadd	d15, d7, d14, d15
	cmp	w21, w19
	beq	.L96
.L92:
	ldr	w2, [sp, 88]
	ldr	x1, [sp, 64]
	tbz	w2, #31, .L86
	add	w0, w2, 8
	str	w0, [sp, 88]
	cmp	w0, 0
	bgt	.L86
	mov	x0, x1
	ldr	x1, [sp, 72]
	add	x1, x1, w2, sxtw
	ldr	w22, [x1]
	ldr	w1, [sp, 92]
	tbz	w1, #31, .L89
	.align 5
.L95:
	add	w2, w1, 16
	str	w2, [sp, 92]
	cmp	w2, 0
	bgt	.L89
	ldr	x0, [sp, 80]
	add	x0, x0, w1, sxtw
	b	.L91
	.align 2
.L96:
	fmov	d0, d15
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	fmov	d0, d15
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	d14, d15, [sp, 48]
	ldp	x29, x30, [sp], 160
	ret
	.section .rodata
	.align	3
.LC11:
	.string	" %ld:%g"
	.align	3
.LC12:
	.string	"\n  gp_full=%ld\n"
	.text
	.align	2
	.align 5
gp_full:
	add	x1, x0, x1, lsl 1
	add	x2, x2, x2, lsl 1
	add	x1, x1, x2
	add	x4, x4, x4, lsl 2
	add	x3, x1, x3, lsl 2
	add	x5, x5, x5, lsl 1
	add	x3, x3, x4
	stp	x29, x30, [sp, -224]!
	add	x0, x3, x5, lsl 1
	add	x0, x0, x6, lsl 3
	mov	x29, sp
	sub	x0, x0, x6
	str	x23, [sp, 48]
	add	x23, x0, x7, lsl 3
	add	x0, sp, 232
	str	x0, [sp, 64]
	add	x0, sp, 224
	stp	x19, x20, [sp, 16]
	adrp	x20, .LC11
	mov	w19, 0
	add	x20, x20, :lo12:.LC11
	stp	x21, x22, [sp, 32]
	ldr	w21, [sp, 224]
	str	d15, [sp, 56]
	stp	x0, x0, [sp, 72]
	mov	w0, -128
	stp	wzr, w0, [sp, 88]
	stp	q0, q1, [sp, 96]
	stp	q2, q3, [sp, 128]
	stp	q4, q5, [sp, 160]
	stp	q6, q7, [sp, 192]
	b	.L104
	.align 2
.L98:
	ldr	x22, [x1]
	add	x0, x1, 15
	ldr	w1, [sp, 92]
	and	x0, x0, -8
	str	x0, [sp, 64]
	tbnz	w1, #31, .L107
.L101:
	add	x2, x0, 15
	and	x2, x2, -8
	str	x2, [sp, 64]
.L103:
	ldr	d15, [x0]
	mov	x1, x22
	mov	x0, x20
	add	w19, w19, 1
	fmov	d0, d15
	bl	printf
	fcvtzs	x0, d15, #2
	madd	x23, x0, x22, x23
	cmp	w21, w19
	beq	.L108
.L104:
	ldr	w2, [sp, 88]
	ldr	x1, [sp, 64]
	tbz	w2, #31, .L98
	add	w0, w2, 8
	str	w0, [sp, 88]
	cmp	w0, 0
	bgt	.L98
	mov	x0, x1
	ldr	x1, [sp, 72]
	add	x1, x1, w2, sxtw
	ldr	x22, [x1]
	ldr	w1, [sp, 92]
	tbz	w1, #31, .L101
	.align 5
.L107:
	add	w2, w1, 16
	str	w2, [sp, 92]
	cmp	w2, 0
	bgt	.L101
	ldr	x0, [sp, 80]
	add	x0, x0, w1, sxtw
	b	.L103
	.align 2
.L108:
	mov	x1, x23
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	ldr	d15, [sp, 56]
	mov	x0, x23
	ldr	x23, [sp, 48]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 224
	ret
	.section .rodata
	.align	3
.LC14:
	.string	"iqiq"
	.align	3
.LC15:
	.string	"qqqqi"
	.align	3
.LC17:
	.string	"LdL"
	.align	3
.LC18:
	.string	"iiiiiiiiLLLLLLLLLd"
	.align	3
.LC20:
	.string	"cidd"
	.align	3
.LC21:
	.string	"iTiTd"
	.align	3
.LC22:
	.string	"TTTi"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #224
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	mov	w1, 1
	mov	x6, -5
	mov	x7, -1
	stp	x29, x30, [sp, 112]
	add	x29, sp, 112
	mov	w4, 2
	stp	x19, x20, [sp, 128]
	mov	w19, 3
	stp	x21, x22, [sp, 144]
	mov	w22, 6
	ldp	x20, x21, [x0]
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	stp	d11, d12, [sp, 160]
	stp	d13, d14, [sp, 176]
	mov	x2, x20
	mov	x3, x21
	str	d15, [sp, 192]
	bl	wide
	mov	x4, -5
	mov	x5, -1
	stp	x4, x5, [sp]
	mov	x6, x20
	mov	x7, x21
	str	w19, [sp, 16]
	mov	x2, x20
	mov	x3, x21
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	wide
	adrp	x21, .LANCHOR0
	adrp	x0, .LC34
	add	x21, x21, :lo12:.LANCHOR0
	add	x0, x0, :lo12:.LC34
	fmov	d1, 2.0e+0
	mov	w20, 8
	ldr	q2, [x21]
	ldr	q0, [x0]
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	wide
	str	w20, [sp]
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	fmov	d15, 5.0e-1
	mov	w3, w19
	mov	w7, 7
	mov	w6, 6
	ldr	q30, [x0]
	adrp	x0, .LC35
	add	x0, x0, :lo12:.LC35
	mov	w5, 5
	mov	w4, 4
	mov	w2, 2
	mov	w1, 1
	str	q30, [sp, 16]
	ldr	q7, [x0]
	adrp	x0, .LC36
	add	x0, x0, :lo12:.LC36
	str	d15, [sp, 32]
	ldr	q6, [x0]
	adrp	x0, .LC37
	add	x0, x0, :lo12:.LC37
	ldr	q5, [x0]
	adrp	x0, .LC38
	add	x0, x0, :lo12:.LC38
	ldr	q4, [x0]
	adrp	x0, .LC39
	add	x0, x0, :lo12:.LC39
	ldr	q3, [x0]
	adrp	x0, .LC40
	add	x0, x0, :lo12:.LC40
	ldr	q2, [x0]
	adrp	x0, .LC41
	add	x0, x0, :lo12:.LC41
	ldr	q1, [x0]
	adrp	x0, .LC42
	add	x0, x0, :lo12:.LC42
	ldr	q0, [x0]
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	wide
	ldr	d31, [x21, 16]
	mov	w2, -30000
	mov	w1, -100
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	mov	w21, 9
	fmov	d1, d31
	fmov	d0, d31
	str	d31, [sp, 216]
	bl	wide
	str	w22, [sp]
	fmov	d0, 2.5e-1
	mov	w5, w20
	mov	w4, w19
	mov	w7, 5
	mov	w6, 4
	mov	w3, 2
	mov	w2, 1
	mov	w1, 9
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	wide
	str	w20, [sp]
	mov	w0, 10
	str	w21, [sp, 8]
	str	w0, [sp, 16]
	mov	w6, w22
	mov	w3, w19
	mov	w7, 7
	mov	w5, 5
	mov	w4, 4
	mov	w2, 2
	mov	w1, 1
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	wide
	fmov	d11, 1.5e+0
	fmov	d13, 2.5e-1
	fmov	d31, -2.0e+0
	fmov	d7, 8.0e+0
	fmov	d6, 7.0e+0
	fmov	d5, 6.0e+0
	fmov	d4, 5.0e+0
	fmov	d3, 4.0e+0
	fmov	d2, 3.0e+0
	fmov	d1, 2.0e+0
	fmov	d0, 1.0e+0
	mov	w3, w19
	mov	w4, 4
	mov	w2, 2
	mov	w0, w4
	mov	w1, 1
	stp	d15, d13, [sp]
	stp	d11, d31, [sp, 16]
	bl	fp_full
	fmov	d31, 9.0e+0
	movi	d6, #0
	fmov	d7, d15
	str	d31, [sp, 80]
	fmov	d31, 8.0e+0
	fmov	d0, d15
	fmov	d30, 6.0e+0
	str	d31, [sp, 64]
	fmov	d31, 7.0e+0
	fmov	d5, d6
	fmov	d4, d6
	fmov	d3, d6
	fmov	d2, d6
	fmov	d1, d6
	str	d31, [sp, 48]
	fmov	d31, 5.0e+0
	fmov	d14, 2.0e+0
	fmov	d12, 1.0e+0
	str	w20, [sp, 56]
	stp	d31, d30, [sp, 32]
	fmov	d30, 4.0e+0
	fmov	d31, 3.0e+0
	str	w21, [sp, 72]
	mov	w6, w22
	mov	w3, w19
	mov	w0, w21
	mov	w7, 7
	mov	w5, 5
	mov	w4, 4
	mov	w2, 2
	mov	w1, 1
	stp	d12, d14, [sp]
	mov	x20, 10
	stp	d31, d30, [sp, 16]
	bl	fp_full
	fmov	d2, d14
	fmov	d0, d15
	mov	x0, 30
	fmov	d1, 1.25e+0
	str	w19, [sp]
	str	x0, [sp, 24]
	mov	x0, -20
	stp	x20, x0, [sp, 8]
	mov	x7, 8
	mov	x6, 7
	mov	x5, 6
	mov	x4, 5
	mov	x3, 4
	mov	x2, 3
	mov	x1, 2
	mov	x0, 1
	bl	gp_full
	fmov	d7, d14
	mov	x0, 9
	mov	x1, 8
	str	x0, [sp, 72]
	mov	x0, 7
	fmov	d5, d11
	fmov	d3, d12
	fmov	d1, d15
	fmov	d0, d13
	fmov	d31, 2.5e+0
	stp	x0, x1, [sp, 56]
	mov	x1, 6
	mov	x0, 5
	stp	x0, x1, [sp, 40]
	mov	x1, 4
	mov	x0, 3
	fmov	d6, 1.75e+0
	fmov	d4, 1.25e+0
	fmov	d2, 7.5e-1
	str	w20, [sp]
	mov	x7, -8
	stp	x0, x1, [sp, 24]
	mov	x1, 2
	mov	x0, 1
	stp	x0, x1, [sp, 8]
	mov	x6, -7
	mov	x5, -6
	str	x20, [sp, 88]
	mov	x4, -5
	str	d31, [sp, 96]
	fmov	d31, 2.25e+0
	mov	x3, -4
	mov	x2, -3
	mov	x1, -2
	mov	x0, -1
	str	d31, [sp, 80]
	bl	gp_full
	ldr	d15, [sp, 192]
	mov	w0, 0
	ldp	x29, x30, [sp, 112]
	ldp	x19, x20, [sp, 128]
	ldp	x21, x22, [sp, 144]
	ldp	d11, d12, [sp, 160]
	ldp	d13, d14, [sp, 176]
	add	sp, sp, 224
	ret
	.section .rodata
	.align	4
.LC13:
	.quad	-81985529216486896
	.quad	81985529216486895
	.section .rodata
	.align	4
	.LANCHOR0:
.LC16:
	.word	-1717986918
	.word	-1717986919
	.word	-1717986919
	.word	-1074030183
.LC19:
	.word	-1610612736
	.word	1069128089
	.zero	8
.LC23:
	.word	0
	.word	0
	.word	0
	.word	1073881088
.LC34:
	.word	0
	.word	0
	.word	0
	.word	1073709056
.LC35:
	.word	0
	.word	0
	.word	0
	.word	1073872896
.LC36:
	.word	0
	.word	0
	.word	0
	.word	1073856512
.LC37:
	.word	0
	.word	0
	.word	0
	.word	1073840128
.LC38:
	.word	0
	.word	0
	.word	0
	.word	1073823744
.LC39:
	.word	0
	.word	0
	.word	0
	.word	1073807360
.LC40:
	.word	0
	.word	0
	.word	0
	.word	1073774592
.LC41:
	.word	0
	.word	0
	.word	0
	.word	1073741824
.LC42:
	.word	0
	.word	0
	.word	0
	.word	1073676288

