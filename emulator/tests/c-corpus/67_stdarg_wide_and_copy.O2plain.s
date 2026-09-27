	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%-18s"
	.align	3
.LC1:
	.string	"q"
	.align	3
.LC2:
	.string	" %s:%016lx%016lx"
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
	stp	x29, x30, [sp, -352]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x0
	add	x0, sp, 352
	stp	x0, x0, [sp, 96]
	add	x0, sp, 288
	ldr	q31, [sp, 96]
	str	x0, [sp, 112]
	mov	w0, -56
	str	w0, [sp, 120]
	mov	w0, -128
	str	w0, [sp, 124]
	str	q31, [sp, 128]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	ldr	q31, [sp, 112]
	stp	x21, x22, [sp, 32]
	stp	q0, q1, [sp, 160]
	str	q31, [sp, 144]
	stp	q2, q3, [sp, 192]
	stp	q4, q5, [sp, 224]
	stp	q6, q7, [sp, 256]
	stp	x1, x2, [sp, 296]
	mov	x1, x19
	stp	x3, x4, [sp, 312]
	stp	x5, x6, [sp, 328]
	str	x7, [sp, 344]
	bl	printf
	ldrb	w1, [x19]
	cbz	w1, .L66
	adrp	x22, .LC6
	mov	x0, 4652218415073722368
	mov	x20, x19
	add	x22, x22, :lo12:.LC6
	mov	x21, 0
	stp	x23, x24, [sp, 48]
	adrp	x23, .LC4
	str	x25, [sp, 64]
	str	d15, [sp, 72]
	fmov	d15, x0
	b	.L35
	.align 2
.L84:
	cmp	w1, 84
	beq	.L5
	cmp	w1, 99
	beq	.L6
	cmp	w1, 76
	bne	.L8
	ldr	w1, [sp, 124]
	ldr	x0, [sp, 96]
	tbnz	w1, #31, .L82
.L14:
	add	x0, x0, 15
	and	x0, x0, -16
	add	x1, x0, 16
	str	x1, [sp, 96]
.L16:
	ldp	x0, x1, [x0]
	eor	x25, x1, x0
	mov	x3, x0
	add	x21, x21, x25
	mov	x2, x1
	adrp	x0, .LC2
	adrp	x1, .LC3
	add	x0, x0, :lo12:.LC2
	add	x1, x1, :lo12:.LC3
	bl	printf
	.align 5
.L8:
	ldrb	w1, [x20, 1]!
	cbz	w1, .L83
.L35:
	cmp	w1, 100
	beq	.L3
	bls	.L84
	cmp	w1, 105
	beq	.L9
	cmp	w1, 113
	bne	.L8
	ldr	w1, [sp, 120]
	ldr	x0, [sp, 96]
	tbnz	w1, #31, .L85
.L11:
	add	x0, x0, 15
	and	x0, x0, -16
	add	x1, x0, 16
	str	x1, [sp, 96]
.L13:
	ldp	x25, x24, [x0]
	adrp	x1, .LC1
	adrp	x0, .LC2
	add	x1, x1, :lo12:.LC1
	add	x0, x0, :lo12:.LC2
	mov	x2, x24
	mov	x3, x25
	bl	printf
	eor	x24, x24, x25
	ldrb	w1, [x20, 1]!
	add	x21, x21, x24
	cbnz	w1, .L35
	.align 5
.L83:
	ldrb	w1, [x19]
	cbz	w1, .L67
	ldr	x0, [sp, 128]
	mov	x2, 0
	.align 5
.L62:
	cmp	w1, 113
	beq	.L86
	cmp	w1, 76
	beq	.L87
	cmp	w1, 100
	beq	.L88
	ldr	w3, [sp, 152]
	cmp	w1, 84
	beq	.L89
	tbnz	w3, #31, .L59
.L77:
	add	x1, x0, 11
	mov	x3, x0
	and	x0, x1, -8
.L60:
	ldr	w1, [x3]
	.align 5
.L40:
	eor	x2, x1, x2, ror 57
	ldrb	w1, [x19, 1]!
	cbnz	w1, .L62
.L78:
	ldp	x23, x24, [sp, 48]
	ldr	x25, [sp, 64]
	ldr	d15, [sp, 72]
.L2:
	mov	x1, x21
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 352
	ret
	.align 2
.L6:
	ldr	w1, [sp, 120]
	ldr	x0, [sp, 96]
	tbnz	w1, #31, .L90
.L20:
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 96]
.L22:
	ldr	w24, [x0]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	sxtb	w1, w24
	add	x21, x21, w24, uxtb
	bl	printf
	b	.L8
	.align 2
.L3:
	ldr	w1, [sp, 124]
	ldr	x0, [sp, 96]
	tbnz	w1, #31, .L91
.L23:
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 96]
.L25:
	ldr	d0, [x0]
	mov	x0, x22
	str	d0, [sp, 88]
	bl	printf
	ldr	d0, [sp, 88]
	fmul	d0, d0, d15
	fcvtzs	x0, d0
	add	x21, x21, x0
	b	.L8
	.align 2
.L5:
	ldr	w2, [sp, 120]
	ldr	x0, [sp, 96]
	tbnz	w2, #31, .L92
.L26:
	add	x1, x0, 11
	ldr	w24, [x0]
	and	x1, x1, -8
.L28:
	add	x0, x1, 11
	and	x0, x0, -8
.L30:
	ldr	w1, [x1]
.L72:
	add	x2, x0, 11
	and	x2, x2, -8
	str	x2, [sp, 96]
.L33:
	add	w1, w1, w1, lsl 2
	mov	w2, 100
	ldr	w0, [x0]
	lsl	w1, w1, 1
	madd	w24, w24, w2, w1
	add	w24, w24, w0
	adrp	x0, .LC7
	mov	w1, w24
	add	x0, x0, :lo12:.LC7
	add	x21, x21, w24, uxtw
	bl	printf
	b	.L8
	.align 2
.L9:
	ldr	w1, [sp, 120]
	ldr	x0, [sp, 96]
	tbnz	w1, #31, .L93
.L17:
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 96]
.L19:
	ldr	w24, [x0]
	add	x0, x23, :lo12:.LC4
	mov	w1, w24
	bl	printf
	add	x21, x21, w24, uxtw
	b	.L8
	.align 2
.L86:
	ldr	w1, [sp, 152]
	tbnz	w1, #31, .L37
.L73:
	add	x1, x0, 15
	and	x1, x1, -16
	add	x0, x1, 16
.L38:
	ldp	x3, x1, [x1]
	add	x1, x1, x1, lsl 1
	eor	x1, x1, x3
	b	.L40
	.align 2
.L87:
	ldr	w1, [sp, 156]
	tbnz	w1, #31, .L42
.L74:
	add	x1, x0, 15
	and	x1, x1, -16
	add	x0, x1, 16
.L43:
	ldp	x4, x5, [x1]
	add	x1, x5, x5, lsl 1
	eor	x1, x1, x4
	b	.L40
	.align 2
.L88:
	ldr	w1, [sp, 156]
	tbnz	w1, #31, .L46
.L75:
	mov	x1, x0
	add	x3, x0, 15
	and	x0, x3, -8
	ldr	x1, [x1]
	b	.L40
	.align 2
.L37:
	add	w1, w1, 15
	and	w1, w1, -16
	add	w3, w1, 16
	str	w3, [sp, 152]
	cmp	w3, 0
	bgt	.L73
	ldr	x3, [sp, 136]
	add	x1, x3, w1, sxtw
	b	.L38
	.align 2
.L89:
	tbnz	w3, #31, .L50
.L80:
	add	x3, x0, 11
	ldr	w1, [x0]
	and	x3, x3, -8
	mov	x0, x3
.L79:
	add	x3, x0, 11
	ldr	w4, [x0]
	and	x3, x3, -8
	mov	x0, x3
.L76:
	add	x5, x0, 11
	mov	x3, x0
	and	x0, x5, -8
.L57:
	add	w4, w4, w4, lsl 2
	mov	w5, 100
	ldr	w3, [x3]
	lsl	w4, w4, 1
	madd	w1, w1, w5, w4
	add	w1, w1, w3
	b	.L40
	.align 2
.L42:
	add	w3, w1, 16
	str	w3, [sp, 156]
	cmp	w3, 0
	bgt	.L74
	ldr	x3, [sp, 144]
	add	x1, x3, w1, sxtw
	b	.L43
.L59:
	add	w1, w3, 8
	str	w1, [sp, 152]
	cmp	w1, 0
	bgt	.L77
	ldr	x1, [sp, 136]
	add	x3, x1, w3, sxtw
	b	.L60
.L50:
	add	w4, w3, 8
	str	w4, [sp, 152]
	cmp	w4, 0
	bgt	.L80
	ldr	x6, [sp, 136]
	ldr	w1, [x6, w3, sxtw]
	beq	.L79
	add	w5, w3, 16
	str	w5, [sp, 152]
	cmp	w5, 0
	bgt	.L79
	ldr	w4, [x6, w4, sxtw]
	beq	.L76
	add	w3, w3, 24
	str	w3, [sp, 152]
	cmp	w3, 0
	bgt	.L76
	add	x3, x6, w5, sxtw
	b	.L57
.L46:
	add	w3, w1, 16
	str	w3, [sp, 156]
	cmp	w3, 0
	bgt	.L75
	ldr	x3, [sp, 144]
	add	x1, x3, w1, sxtw
	ldr	x1, [x1]
	b	.L40
.L93:
	add	w2, w1, 8
	str	w2, [sp, 120]
	cmp	w2, 0
	bgt	.L17
	ldr	x0, [sp, 104]
	add	x0, x0, w1, sxtw
	b	.L19
.L92:
	add	w1, w2, 8
	str	w1, [sp, 120]
	cmp	w1, 0
	bgt	.L26
	ldr	x3, [sp, 104]
	ldr	w24, [x3, w2, sxtw]
	beq	.L94
	add	w4, w2, 16
	str	w4, [sp, 120]
	cmp	w4, 0
	ble	.L31
	add	x2, x0, 11
	mov	x1, x0
	and	x0, x2, -8
	b	.L30
.L91:
	add	w2, w1, 16
	str	w2, [sp, 124]
	cmp	w2, 0
	bgt	.L23
	ldr	x0, [sp, 112]
	add	x0, x0, w1, sxtw
	b	.L25
.L85:
	add	w1, w1, 15
	and	w1, w1, -16
	add	w2, w1, 16
	str	w2, [sp, 120]
	cmp	w2, 0
	bgt	.L11
	ldr	x0, [sp, 104]
	add	x0, x0, w1, sxtw
	b	.L13
.L82:
	add	w2, w1, 16
	str	w2, [sp, 124]
	cmp	w2, 0
	bgt	.L14
	ldr	x0, [sp, 112]
	add	x0, x0, w1, sxtw
	b	.L16
.L90:
	add	w2, w1, 8
	str	w2, [sp, 120]
	cmp	w2, 0
	bgt	.L20
	ldr	x0, [sp, 104]
	add	x0, x0, w1, sxtw
	b	.L22
.L31:
	ldr	w1, [x3, w1, sxtw]
	beq	.L72
	add	w2, w2, 24
	str	w2, [sp, 120]
	cmp	w2, 0
	bgt	.L72
	add	x0, x3, w4, sxtw
	b	.L33
.L66:
	mov	x21, 0
	mov	x2, 0
	b	.L2
.L94:
	mov	x1, x0
	b	.L28
.L67:
	mov	x2, 0
	b	.L78
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
	b	.L102
	.align 2
.L96:
	add	x0, x1, 11
	ldr	w22, [x1]
	ldr	w1, [sp, 92]
	and	x0, x0, -8
	str	x0, [sp, 64]
	tbnz	w1, #31, .L105
.L99:
	add	x2, x0, 15
	and	x2, x2, -8
	str	x2, [sp, 64]
.L101:
	ldr	d14, [x0]
	mov	w1, w22
	mov	x0, x20
	add	w19, w19, 1
	fmov	d0, d14
	bl	printf
	scvtf	d7, w22
	fmadd	d15, d7, d14, d15
	cmp	w21, w19
	beq	.L106
.L102:
	ldr	w2, [sp, 88]
	ldr	x1, [sp, 64]
	tbz	w2, #31, .L96
	add	w0, w2, 8
	str	w0, [sp, 88]
	cmp	w0, 0
	bgt	.L96
	mov	x0, x1
	ldr	x1, [sp, 72]
	add	x1, x1, w2, sxtw
	ldr	w22, [x1]
	ldr	w1, [sp, 92]
	tbz	w1, #31, .L99
	.align 5
.L105:
	add	w2, w1, 16
	str	w2, [sp, 92]
	cmp	w2, 0
	bgt	.L99
	ldr	x0, [sp, 80]
	add	x0, x0, w1, sxtw
	b	.L101
	.align 2
.L106:
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
	b	.L114
	.align 2
.L108:
	ldr	x22, [x1]
	add	x0, x1, 15
	ldr	w1, [sp, 92]
	and	x0, x0, -8
	str	x0, [sp, 64]
	tbnz	w1, #31, .L117
.L111:
	add	x2, x0, 15
	and	x2, x2, -8
	str	x2, [sp, 64]
.L113:
	ldr	d15, [x0]
	mov	x1, x22
	mov	x0, x20
	add	w19, w19, 1
	fmov	d0, d15
	bl	printf
	fcvtzs	x0, d15, #2
	madd	x23, x0, x22, x23
	cmp	w21, w19
	beq	.L118
.L114:
	ldr	w2, [sp, 88]
	ldr	x1, [sp, 64]
	tbz	w2, #31, .L108
	add	w0, w2, 8
	str	w0, [sp, 88]
	cmp	w0, 0
	bgt	.L108
	mov	x0, x1
	ldr	x1, [sp, 72]
	add	x1, x1, w2, sxtw
	ldr	x22, [x1]
	ldr	w1, [sp, 92]
	tbz	w1, #31, .L111
	.align 5
.L117:
	add	w2, w1, 16
	str	w2, [sp, 92]
	cmp	w2, 0
	bgt	.L111
	ldr	x0, [sp, 80]
	add	x0, x0, w1, sxtw
	b	.L113
	.align 2
.L118:
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

