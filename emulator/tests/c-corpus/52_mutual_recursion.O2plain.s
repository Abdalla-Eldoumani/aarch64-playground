	.text
	.align	2
	.align 5
tak:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	stp	x23, x24, [sp, 48]
	adrp	x23, .LANCHOR0
	stp	x21, x22, [sp, 32]
	mov	w21, w0
	ldr	x0, [x23, :lo12:.LANCHOR0]
	stp	x19, x20, [sp, 16]
	mov	w19, w2
	add	x0, x0, 1
	str	x0, [x23, :lo12:.LANCHOR0]
	cmp	w21, w1
	ble	.L2
	mov	w20, w1
	add	x23, x23, :lo12:.LANCHOR0
.L3:
	mov	w22, w21
	mov	w2, w19
	mov	w1, w20
	sub	w0, w21, #1
	bl	tak
	mov	w21, w0
	mov	w1, w19
	mov	w2, w22
	sub	w0, w20, #1
	bl	tak
	mov	w2, w20
	mov	w1, w22
	mov	w20, w0
	sub	w0, w19, #1
	bl	tak
	mov	w19, w0
	ldr	x0, [x23]
	add	x0, x0, 1
	str	x0, [x23]
	cmp	w21, w20
	bgt	.L3
.L2:
	mov	w0, w19
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 64
	ret
	.align	2
	.align 5
big_side:
	stp	x29, x30, [sp, -288]!
	add	w5, w0, 50
	mov	w2, w0
	add	x1, sp, 32
	and	w5, w5, 255
	mov	x4, x1
	mov	x29, sp
	.align 5
.L8:
	add	w3, w2, 51
	strb	w2, [x4], 51
	and	w2, w3, 255
	cmp	w5, w3, uxtb
	bne	.L8
	mov	w2, 0
	cmp	w0, 1
	bne	.L16
.L9:
	add	x3, x1, 306
	.align 5
.L10:
	ldrb	w0, [x1], 51
	add	w2, w2, w0
	cmp	x1, x3
	bne	.L10
	mov	w0, w2
	ldp	x29, x30, [sp], 288
	ret
	.align 2
.L16:
	sub	w0, w0, #2
	str	x1, [sp, 24]
	bl	big_side
	add	w2, w0, 1
	ldr	x1, [sp, 24]
	b	.L9
	.section .rodata
	.align	3
.LC0:
	.string	"ping n=%d a=%d acc=%llu\n"
	.text
	.align	2
	.align 5
ping:
	mov	x3, x1
	mov	w7, 10311
	mov	w6, 24988
	mov	w5, 45262
	sxtb	w4, w0
	mov	w1, w2
	movk	w7, 0xb7a3, lsl 16
	movk	w6, 0x57, lsl 16
	movk	w5, 0x2b, lsl 16
.L29:
	madd	w0, w1, w7, w6
	ror	w0, w0, 2
	cmp	w0, w5
	bls	.L37
	cbnz	w1, .L40
.L32:
	mov	x0, x3
	ret
	.align 2
.L40:
	mov	w0, 300
	add	x3, x3, x3, lsl 1
	mul	w0, w4, w0
	add	x4, x3, w4, sxtw
	and	w2, w0, 65535
	and	x0, x0, 65532
	cmp	w1, 1
	bne	.L35
	eor	x3, x4, x0
	mov	x0, x3
	ret
	.align 2
.L37:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
.L30:
	mov	w2, w4
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	stp	w1, w4, [sp, 16]
	str	x3, [sp, 24]
	bl	printf
	ldp	w1, w4, [sp, 16]
	mov	w5, 45262
	mov	w6, 24988
	mov	w7, 10311
	ldr	x3, [sp, 24]
	movk	w5, 0x2b, lsl 16
	movk	w6, 0x57, lsl 16
	movk	w7, 0xb7a3, lsl 16
	cbnz	w1, .L41
.L19:
	mov	x0, x3
	ldp	x29, x30, [sp], 32
	ret
	.align 2
.L41:
	mov	w0, 300
	add	x3, x3, x3, lsl 1
	mul	w0, w4, w0
	add	x4, x3, w4, sxtw
	and	w2, w0, 65535
	and	x0, x0, 65532
	cmp	w1, 1
	bne	.L20
	eor	x3, x4, x0
	b	.L19
	.align 2
.L35:
	mov	w3, -40000
	add	w2, w2, w3
	add	x4, x4, x0
	sub	x3, x4, w2, sxtw
	cmp	w1, 2
	beq	.L32
	sub	w4, w1, #2
	sub	w1, w1, #3
	eor	w4, w4, w2
	sxtb	w4, w4
	b	.L29
	.align 2
.L20:
	mov	w8, -40000
	add	w2, w2, w8
	add	x4, x4, x0
	sub	x3, x4, w2, sxtw
	cmp	w1, 2
	beq	.L19
	sub	w4, w1, #2
	sub	w1, w1, #3
	eor	w4, w4, w2
	madd	w0, w1, w7, w6
	sxtb	w4, w4
	ror	w0, w0, 2
	cmp	w0, w5
	bls	.L30
	cbz	w1, .L19
	b	.L41
	.align	2
	.align 5
hof_f__part__0:
	stp	x29, x30, [sp, -32]!
	mov	w1, w0
	subs	w2, w0, #1
	mov	x29, sp
	bne	.L61
	mov	w2, 1
.L43:
	mov	w0, w2
	str	w1, [sp, 20]
	bl	hof_m__part__0
	ldr	w1, [sp, 20]
	ldp	x29, x30, [sp], 32
	sub	w0, w1, w0
	ret
	.align 2
.L61:
	subs	w3, w0, #2
	bne	.L62
	mov	w3, 1
.L44:
	mov	w0, w3
	stp	w2, w1, [sp, 20]
	bl	hof_m__part__0
	mov	w3, w0
	ldp	w2, w1, [sp, 20]
	mov	w0, w1
	subs	w2, w2, w3
	bne	.L43
	ldp	x29, x30, [sp], 32
	ret
	.align 2
.L62:
	subs	w4, w1, #3
	mov	w0, 1
	bne	.L63
.L45:
	stp	w2, w3, [sp, 20]
	str	w1, [sp, 28]
	bl	hof_m__part__0
	ldp	w2, w3, [sp, 20]
	ldr	w1, [sp, 28]
	subs	w3, w3, w0
	beq	.L43
	b	.L44
	.align 2
.L63:
	mov	w0, w4
	stp	w2, w3, [sp, 20]
	str	w1, [sp, 28]
	bl	hof_f__part__0
	ldp	w2, w3, [sp, 20]
	ldr	w1, [sp, 28]
	cbz	w0, .L44
	b	.L45
	.align	2
	.align 5
hof_m__part__0:
	mov	w1, w0
	subs	w0, w0, #1
	bne	.L85
	ret
	.align 2
.L85:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x19, [sp, 16]
	mov	w19, 0
.L71:
	str	w1, [sp, 32]
	bl	hof_m__part__0
	ldr	w1, [sp, 32]
	mov	w2, w0
	cbz	w0, .L84
	subs	w3, w0, #1
	bne	.L67
.L84:
	sub	w1, w1, #1
	add	w0, w1, w19
.L64:
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.align 2
.L67:
	subs	w4, w2, #2
	mov	w0, 1
	bne	.L86
.L68:
	stp	w3, w1, [sp, 32]
	str	w2, [sp, 40]
	bl	hof_m__part__0
	ldp	w3, w1, [sp, 32]
	ldr	w2, [sp, 40]
	subs	w3, w3, w0
	sub	w1, w1, w2
	add	w0, w1, w19
	beq	.L64
	subs	w4, w3, #1
	beq	.L64
.L69:
	mov	w19, w0
	mov	w1, w3
	mov	w0, w4
	b	.L71
	.align 2
.L86:
	mov	w0, w4
	stp	w3, w1, [sp, 32]
	stp	w2, w4, [sp, 40]
	bl	hof_f__part__0
	ldp	w3, w1, [sp, 32]
	ldr	w2, [sp, 40]
	cbnz	w0, .L68
	sub	w1, w1, w2
	ldr	w4, [sp, 44]
	add	w0, w1, w19
	b	.L69
	.section .rodata
	.align	3
.LC1:
	.string	"cycle=%llu\n"
	.align	3
.LC2:
	.string	"F:"
	.align	3
.LC3:
	.string	" %d"
	.align	3
.LC4:
	.string	"\nM:"
	.align	3
.LC5:
	.string	"tak=%d calls=%ld\n"
	.align	3
.LC6:
	.string	"big/small=%d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -96]!
	adrp	x0, .LANCHOR1
	mov	x1, 1
	mov	x29, sp
	ldr	w2, [x0, :lo12:.LANCHOR1]
	stp	x19, x20, [sp, 16]
	add	x20, x0, :lo12:.LANCHOR1
	mov	w0, -77
	stp	x21, x22, [sp, 32]
	bl	ping
	mov	x1, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	w0, [x20, 4]
	tbnz	w0, #31, .L89
	adrp	x21, .LC3
	add	x21, x21, :lo12:.LC3
	mov	x0, x21
	mov	w1, 1
	stp	x23, x24, [sp, 48]
	mov	w19, 0
	add	w19, w19, 1
	str	x25, [sp, 64]
	bl	printf
	ldr	w0, [x20, 4]
	mov	w22, -1
	mov	w23, -2
	mov	w24, -3
	mov	w25, -4
	cmp	w0, w19
	blt	.L120
.L95:
	mov	w1, 1
	add	w23, w23, 1
	add	w24, w24, 1
	add	w25, w25, 1
	adds	w22, w22, w1
	bne	.L121
.L90:
	mov	w0, w1
	bl	hof_m__part__0
	mov	w1, w0
	sub	w1, w19, w1
.L123:
	mov	x0, x21
	bl	printf
	ldr	w0, [x20, 4]
	add	w19, w19, 1
	cmp	w0, w19
	bge	.L95
.L120:
	ldp	x23, x24, [sp, 48]
	ldr	x25, [sp, 64]
.L89:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w0, [x20, 4]
	tbnz	w0, #31, .L97
	adrp	x21, .LC3
	add	x21, x21, :lo12:.LC3
	mov	x0, x21
	mov	w1, 0
	bl	printf
	mov	w19, 0
	ldr	w0, [x20, 4]
	add	w19, w19, 1
	cmp	w0, w19
	blt	.L97
.L98:
	mov	w0, w19
	bl	hof_m__part__0
	mov	w1, w0
	mov	x0, x21
	bl	printf
	add	w19, w19, 1
	ldr	w0, [x20, 4]
	cmp	w0, w19
	bge	.L98
.L97:
	mov	w0, 10
	bl	putchar
	ldr	w0, [x20, 8]
	ldr	w1, [x20, 12]
	ldr	w2, [x20, 16]
	bl	tak
	adrp	x1, .LANCHOR0
	ldr	x2, [x1, :lo12:.LANCHOR0]
	mov	w1, w0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w0, 601
	bl	big_side
	mov	w1, w0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 96
	ret
	.align 2
.L121:
	mov	w1, w22
	mov	w2, w23
	cbnz	w23, .L122
	mov	w2, 1
.L91:
	mov	w0, w2
	bl	hof_m__part__0
	subs	w1, w22, w0
	bne	.L90
	sub	w1, w19, w1
	b	.L123
.L122:
	cbnz	w24, .L124
	mov	w3, 1
.L92:
	mov	w0, w3
	str	w1, [sp, 84]
	bl	hof_m__part__0
	subs	w2, w23, w0
	ldr	w1, [sp, 84]
	beq	.L90
	b	.L91
.L124:
	cbnz	w25, .L125
	mov	w0, 1
.L93:
	stp	w2, w1, [sp, 84]
	bl	hof_m__part__0
	ldp	w2, w1, [sp, 84]
	subs	w3, w24, w0
	beq	.L91
	b	.L92
.L125:
	mov	w0, w25
	stp	w24, w23, [sp, 84]
	str	w22, [sp, 92]
	bl	hof_f__part__0
	ldp	w3, w2, [sp, 84]
	ldr	w1, [sp, 92]
	cbz	w0, .L92
	b	.L93
	.data
	.align	2
	.LANCHOR1:
cycle_len:
	.word	3000
fm_top:
	.word	24
tak_x:
	.word	12
tak_y:
	.word	7
tak_z:
	.word	3
	.bss
	.align	3
	.LANCHOR0:
tak_calls:
	.zero	8

