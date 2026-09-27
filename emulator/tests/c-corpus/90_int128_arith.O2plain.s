	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%u"
	.align	3
.LC1:
	.string	"%09u"
	.text
	.align	2
	.align 5
print_u128:
	fmov	d31, x1
	extr	x2, x1, x0, 32
	fmov	d30, x1
	stp	x29, x30, [sp, -96]!
	ushr	d31, d31, 32
	ins	v30.s[1], w0
	mov	x29, sp
	mov	x5, 23123
	stp	x19, x20, [sp, 16]
	movk	x5, 0xa09b, lsl 16
	ins	v31.s[1], w2
	add	x19, sp, 72
	movk	x5, 0xb82f, lsl 32
	mov	x4, 51712
	mov	x7, x19
	add	x6, sp, 64
	mov	w20, 0
	movk	x5, 0x44, lsl 48
	zip1	v31.4s, v31.4s, v30.4s
	movk	x4, 0x3b9a, lsl 16
	stp	x21, x22, [sp, 32]
	str	q31, [sp, 48]
.L3:
	add	x2, sp, 48
	mov	w3, 0
	mov	x1, 0
.L2:
	ldr	w0, [x2]
	orr	x1, x0, x1, lsl 32
	lsr	x0, x1, 9
	umulh	x0, x0, x5
	lsr	x0, x0, 11
	str	w0, [x2], 4
	cmp	w0, 0
	msub	x1, x0, x4, x1
	cset	w0, ne
	orr	w3, w3, w0
	cmp	x6, x2
	bne	.L2
	str	w1, [x7], 4
	add	w21, w20, 1
	cbz	w3, .L14
	mov	w20, w21
	b	.L3
	.align 2
.L14:
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	cbz	w20, .L1
	adrp	x22, .LC1
	add	x22, x22, :lo12:.LC1
.L5:
	sub	w21, w21, #2
	mov	x0, x22
	ldr	w1, [x19, w21, sxtw 2]
	mov	w21, w20
	bl	printf
	subs	w20, w20, #1
	bne	.L5
.L1:
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 96
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"%d! = "
	.align	3
.LC3:
	.string	"35! hex"
	.align	3
.LC4:
	.string	"%s %016lx%016lx\n"
	.align	3
.LC5:
	.string	"fib(%d) = "
	.align	3
.LC6:
	.string	"fib(187) wrapped"
	.align	3
.LC7:
	.string	"umax*umax"
	.align	3
.LC8:
	.string	"%ld * %ld = "
	.align	3
.LC9:
	.string	" high %ld\n"
	.align	3
.LC10:
	.string	"x*y"
	.align	3
.LC11:
	.string	"x+y"
	.align	3
.LC12:
	.string	"x-y"
	.align	3
.LC13:
	.string	"y-x"
	.align	3
.LC14:
	.string	"-x"
	.align	3
.LC15:
	.string	"~x"
	.align	3
.LC16:
	.string	"x<<1"
	.align	3
.LC17:
	.string	"x<<63"
	.align	3
.LC18:
	.string	"x<<64"
	.align	3
.LC19:
	.string	"x<<65"
	.align	3
.LC20:
	.string	"x<<127"
	.align	3
.LC21:
	.string	"x>>1"
	.align	3
.LC22:
	.string	"x>>64"
	.align	3
.LC23:
	.string	"x>>127"
	.align	3
.LC24:
	.string	"neg>>1"
	.align	3
.LC25:
	.string	"neg>>100"
	.align	3
.LC27:
	.string	"orders %08x %08x\n"
	.align	3
.LC28:
	.string	"from int -5"
	.align	3
.LC29:
	.string	"from long -5"
	.align	3
.LC30:
	.string	"from ulong"
	.align	3
.LC31:
	.string	"truncate %ld %d\n"
	.align	3
.LC32:
	.string	"mix = "
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -224]!
	mov	x2, 0
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, 1
	mov	x3, x19
	mov	x20, 0
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	.align 5
.L21:
	umulh	x0, x19, x3
	madd	x0, x20, x3, x0
	madd	x2, x19, x2, x0
	sub	w0, w19, #20
	mul	x3, x19, x3
	cmp	w0, 14
	bls	.L45
	adds	x19, x19, 1
	cinc	x20, x20, cs
	cmp	x19, 36
	bne	.L21
	cbnz	x20, .L21
	adrp	x24, .LC4
	add	x24, x24, :lo12:.LC4
	mov	x0, x24
	adrp	x1, .LC3
	add	x1, x1, :lo12:.LC3
	bl	printf
	adrp	x23, .LC5
	mov	w19, 1
	add	x23, x23, :lo12:.LC5
	mov	x21, 1
	mov	x22, 0
	mov	x0, 0
	mov	x1, 0
	b	.L24
	.align 2
.L47:
	sub	w0, w19, #185
	cmp	w0, 1
	bls	.L22
	add	w19, w19, 1
	mov	x0, x20
	mov	x1, x25
	cmp	w19, 188
	beq	.L46
.L24:
	mov	x20, x21
	adds	x21, x0, x21
	mov	x25, x22
	sub	w0, w19, #93
	adc	x22, x1, x22
	cmp	w19, 150
	ccmp	w0, 1, 0, ne
	bhi	.L47
.L22:
	mov	w1, w19
	mov	x0, x23
	bl	printf
	add	w19, w19, 1
	mov	x1, x25
	mov	x0, x20
	bl	print_u128
	mov	w0, 10
	bl	putchar
	mov	x0, x20
	mov	x1, x25
	cmp	w19, 188
	bne	.L24
.L46:
	mov	x2, x25
	adrp	x19, .LANCHOR0
	adrp	x26, .LC8
	adrp	x25, .LC9
	add	x19, x19, :lo12:.LANCHOR0
	add	x26, x26, :lo12:.LC8
	add	x25, x25, :lo12:.LC9
	mov	w27, 0
	mov	x3, x20
	mov	x0, x24
	adrp	x1, .LC6
	add	x1, x1, :lo12:.LC6
	bl	printf
	mov	x0, x24
	mov	x3, 1
	mov	x2, -2
	adrp	x1, .LC7
	add	x1, x1, :lo12:.LC7
	bl	printf
.L25:
	mov	w21, w27
	sxtw	x23, w27
.L29:
	ldr	x20, [x19, x23, lsl 3]
	ldr	x0, [x19, w21, sxtw 3]
	ldr	x1, [x19, x23, lsl 3]
	ldr	x2, [x19, w21, sxtw 3]
	mul	x22, x20, x0
	smulh	x20, x20, x0
	mov	x0, x26
	bl	printf
	tbnz	x20, #63, .L48
	mov	x0, x22
	mov	x1, x20
	bl	print_u128
.L28:
	mov	x1, x20
	mov	x0, x25
	add	w21, w21, 1
	bl	printf
	cmp	w21, 5
	bne	.L29
	add	w27, w27, 1
	cmp	w27, 5
	bne	.L25
	ldr	x21, [x19, 48]
	mov	x0, x24
	ldr	x25, [x19, 56]
	adrp	x1, .LC10
	ldr	x22, [x19, 64]
	add	x1, x1, :lo12:.LC10
	ldr	x20, [x19, 72]
	extr	x28, x21, x25, 1
	umulh	x2, x25, x20
	madd	x2, x21, x20, x2
	madd	x2, x25, x22, x2
	mul	x23, x25, x20
	mov	x3, x23
	bl	printf
	adds	x3, x25, x20
	mov	x0, x24
	adc	x2, x21, x22
	adrp	x1, .LC11
	add	x1, x1, :lo12:.LC11
	bl	printf
	subs	x3, x25, x20
	mov	x0, x24
	sbc	x2, x21, x22
	adrp	x1, .LC12
	add	x1, x1, :lo12:.LC12
	bl	printf
	subs	x3, x20, x25
	mov	x0, x24
	sbc	x2, x22, x21
	adrp	x1, .LC13
	add	x1, x1, :lo12:.LC13
	bl	printf
	negs	x27, x25
	mov	x0, x24
	sbc	x26, xzr, x21
	mov	x3, x27
	mov	x2, x26
	adrp	x1, .LC14
	add	x1, x1, :lo12:.LC14
	bl	printf
	mvn	x3, x25
	mvn	x2, x21
	mov	x0, x24
	adrp	x1, .LC15
	add	x1, x1, :lo12:.LC15
	bl	printf
	lsl	x5, x25, 1
	extr	x2, x21, x25, 63
	mov	x3, x5
	mov	x0, x24
	adrp	x1, .LC16
	add	x1, x1, :lo12:.LC16
	str	x5, [sp, 112]
	bl	printf
	lsl	x4, x25, 63
	mov	x2, x28
	mov	x3, x4
	mov	x0, x24
	adrp	x1, .LC17
	add	x1, x1, :lo12:.LC17
	str	x4, [sp, 104]
	bl	printf
	mov	x2, x25
	mov	x3, 0
	mov	x0, x24
	adrp	x1, .LC18
	add	x1, x1, :lo12:.LC18
	bl	printf
	ldr	x2, [sp, 112]
	mov	x3, 0
	mov	x0, x24
	adrp	x1, .LC19
	add	x1, x1, :lo12:.LC19
	bl	printf
	ldr	x2, [sp, 104]
	mov	x3, 0
	mov	x0, x24
	adrp	x1, .LC20
	add	x1, x1, :lo12:.LC20
	bl	printf
	mov	x3, x28
	lsr	x2, x21, 1
	mov	x0, x24
	adrp	x1, .LC21
	add	x1, x1, :lo12:.LC21
	bl	printf
	mov	x3, x21
	mov	x2, 0
	mov	x0, x24
	adrp	x1, .LC22
	add	x1, x1, :lo12:.LC22
	bl	printf
	lsr	x3, x21, 63
	mov	x2, 0
	mov	x0, x24
	adrp	x1, .LC23
	add	x1, x1, :lo12:.LC23
	bl	printf
	asr	x2, x26, 1
	extr	x3, x26, x27, 1
	mov	x0, x24
	adrp	x1, .LC24
	add	x1, x1, :lo12:.LC24
	bl	printf
	asr	x2, x26, 63
	asr	x3, x26, 36
	mov	x0, x24
	adrp	x1, .LC25
	add	x1, x1, :lo12:.LC25
	bl	printf
	mov	x0, -1
	mov	x1, -1
	stp	x0, x1, [sp, 176]
	mov	x0, -9223372036854775808
	mov	x1, -1
	stp	x0, x1, [sp, 192]
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	add	x9, sp, 128
	mov	w2, 0
	stp	x25, x21, [sp, 128]
	ldp	x0, x1, [x0]
	stp	x27, x26, [sp, 144]
	stp	xzr, xzr, [sp, 160]
	stp	x0, x1, [sp, 208]
	mov	w1, 0
	.align 5
.L31:
	add	x0, sp, 128
	ldp	x8, x5, [x9]
	.align 5
.L36:
	add	w1, w1, w1, lsl 1
	ldp	x7, x3, [x0]
	eor	x6, x5, x3
	eor	x4, x8, x7
	orr	x4, x4, x6
	mov	w6, 1
	cmp	x4, 0
	cset	w4, eq
	cmp	x3, x5
	bgt	.L32
	beq	.L49
.L33:
	mov	w6, 0
.L32:
	add	w4, w6, w4, lsl 1
	add	w2, w2, w2, lsl 1
	add	w1, w4, w1
	mov	w4, 1
	cmp	x3, x5
	bhi	.L34
	beq	.L50
.L35:
	mov	w4, 0
.L34:
	add	x0, x0, 16
	add	x3, sp, 224
	add	w2, w4, w2
	cmp	x0, x3
	bne	.L36
	add	x9, x9, 16
	cmp	x9, x0
	bne	.L31
	adrp	x0, .LC27
	add	x0, x0, :lo12:.LC27
	bl	printf
	ldr	x2, [x19, 32]
	mov	x0, x24
	adrp	x1, .LC28
	add	x1, x1, :lo12:.LC28
	sxtw	x3, w2
	sbfx	x2, x2, 31, 1
	bl	printf
	ldr	x3, [x19, 32]
	mov	x0, x24
	adrp	x1, .LC29
	add	x1, x1, :lo12:.LC29
	asr	x2, x3, 63
	bl	printf
	ldr	x3, [x19, 32]
	mov	x2, 0
	mov	x0, x24
	adrp	x1, .LC30
	add	x1, x1, :lo12:.LC30
	bl	printf
	mul	w2, w25, w20
	mov	x1, x23
	adrp	x0, .LC31
	add	x0, x0, :lo12:.LC31
	bl	printf
	ldr	x3, [x19, 24]
	negs	x20, x20
	ldr	x2, [x19, 32]
	sbc	x22, xzr, x22
	asr	x5, x3, 63
	asr	x4, x2, 63
	umulh	x0, x20, x2
	mul	x1, x20, x2
	madd	x0, x22, x2, x0
	umulh	x2, x3, x25
	madd	x0, x20, x4, x0
	madd	x2, x5, x25, x2
	mul	x4, x3, x25
	madd	x2, x3, x21, x2
	adds	x1, x1, x4
	adc	x0, x0, x2
	adds	x20, x1, 24
	mov	x1, -67108864
	adc	x19, x0, x1
	adrp	x0, .LC32
	add	x0, x0, :lo12:.LC32
	bl	printf
	tbnz	x19, #63, .L51
	mov	x0, x20
	mov	x1, x19
	bl	print_u128
.L40:
	mov	w0, 10
	bl	putchar
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 224
	ret
	.align 2
.L50:
	cmp	x7, x8
	bhi	.L34
	b	.L35
	.align 2
.L49:
	cmp	x7, x8
	bhi	.L32
	b	.L33
	.align 2
.L48:
	mov	w0, 45
	bl	putchar
	negs	x0, x22
	sbc	x1, xzr, x20
	bl	print_u128
	b	.L28
.L51:
	mov	w0, 45
	bl	putchar
	negs	x0, x20
	sbc	x1, xzr, x19
	bl	print_u128
	b	.L40
.L45:
	mov	w0, 5
	cmp	w19, 32
	udiv	w0, w19, w0
	add	w0, w0, w0, lsl 2
	sub	w0, w19, w0
	ccmp	w0, 0, 4, le
	beq	.L17
	adds	x19, x19, 1
	cinc	x20, x20, cs
	b	.L21
.L17:
	mov	w1, w19
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	str	x3, [sp, 104]
	str	x2, [sp, 120]
	bl	printf
	ldr	x2, [sp, 120]
	ldr	x3, [sp, 104]
	mov	x1, x2
	stp	x2, x3, [sp, 104]
	mov	x0, x3
	bl	print_u128
	mov	w0, 10
	bl	putchar
	adds	x19, x19, 1
	ldp	x2, x3, [sp, 104]
	cinc	x20, x20, cs
	b	.L21
	.section .rodata
	.align	4
.LC26:
	.quad	0
	.quad	68719476736
	.data
	.align	4
	.LANCHOR0:
sv:
	.quad	-9223372036854775808
	.quad	9223372036854775807
	.quad	-1
	.quad	3
	.quad	-5
	.zero	8
hv:
	.quad	81985529216486895
	.quad	-81985529216486896
	.quad	1229782938247303441
	.quad	2459565876494606882

