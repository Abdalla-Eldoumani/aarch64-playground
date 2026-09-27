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
	.string	"%s %016lx%016lx\n"
	.text
	.align	2
	.align 5
hex128:
	mov	x1, x3
	mov	x3, x2
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	b	printf
	.section .rodata
	.align	3
.LC3:
	.string	"-"
	.text
	.align	2
	.align 5
print_i128:
	tbnz	x1, #63, .L22
	b	print_u128
	.align 2
.L22:
	stp	x29, x30, [sp, -32]!
	mov	x2, x1
	mov	x1, x0
	mov	x29, sp
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	stp	x1, x2, [sp, 16]
	bl	printf
	ldp	x1, x2, [sp, 16]
	ldp	x29, x30, [sp], 32
	negs	x0, x1
	sbc	x1, xzr, x2
	b	print_u128
	.align	2
	.align 5
mix__constprop__0:
	asr	x8, x0, 63
	umulh	x1, x0, x2
	mul	x5, x0, x2
	madd	x1, x8, x2, x1
	madd	x1, x0, x3, x1
	asr	x3, x4, 63
	umulh	x0, x4, x6
	mul	x2, x4, x6
	madd	x0, x3, x6, x0
	madd	x0, x4, x7, x0
	adds	x5, x5, x2
	mov	x2, -67108864
	adc	x1, x1, x0
	adds	x0, x5, #24
	adc	x1, x1, x2
	ret
	.section .rodata
	.align	3
.LC4:
	.string	"%d! = "
	.align	3
.LC5:
	.string	"\n"
	.align	3
.LC6:
	.string	"35! hex"
	.align	3
.LC7:
	.string	"fib(%d) = "
	.align	3
.LC8:
	.string	"fib(187) wrapped"
	.align	3
.LC10:
	.string	"umax*umax"
	.align	3
.LC11:
	.string	"%ld * %ld = "
	.align	3
.LC12:
	.string	" high %ld\n"
	.align	3
.LC13:
	.string	"x*y"
	.align	3
.LC14:
	.string	"x+y"
	.align	3
.LC15:
	.string	"x-y"
	.align	3
.LC16:
	.string	"y-x"
	.align	3
.LC17:
	.string	"-x"
	.align	3
.LC18:
	.string	"~x"
	.align	3
.LC19:
	.string	"x<<1"
	.align	3
.LC20:
	.string	"x<<63"
	.align	3
.LC21:
	.string	"x<<64"
	.align	3
.LC22:
	.string	"x<<65"
	.align	3
.LC23:
	.string	"x<<127"
	.align	3
.LC24:
	.string	"x>>1"
	.align	3
.LC25:
	.string	"x>>64"
	.align	3
.LC26:
	.string	"x>>127"
	.align	3
.LC27:
	.string	"neg>>1"
	.align	3
.LC28:
	.string	"neg>>100"
	.align	3
.LC30:
	.string	"orders %08x %08x\n"
	.align	3
.LC31:
	.string	"from int -5"
	.align	3
.LC32:
	.string	"from long -5"
	.align	3
.LC33:
	.string	"from ulong"
	.align	3
.LC34:
	.string	"truncate %ld %d\n"
	.align	3
.LC35:
	.string	"mix = "
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -224]!
	mov	x3, 0
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, 1
	mov	x2, x19
	stp	x21, x22, [sp, 32]
	adrp	x22, .LC5
	add	x22, x22, :lo12:.LC5
	mov	x20, 0
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	.align 5
.L30:
	umulh	x0, x19, x2
	madd	x0, x20, x2, x0
	madd	x3, x19, x3, x0
	sub	w0, w19, #20
	mul	x2, x19, x2
	cmp	w0, 14
	bls	.L48
	adds	x19, x19, 1
	cinc	x20, x20, cs
	cmp	x19, 36
	bne	.L30
	cbnz	x20, .L30
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	hex128
	adrp	x24, .LC7
	mov	w19, 1
	add	x24, x24, :lo12:.LC7
	mov	x21, 1
	mov	x23, 0
	mov	x0, 0
	mov	x1, 0
	b	.L33
	.align 2
.L50:
	sub	w0, w19, #185
	cmp	w0, 1
	bls	.L31
	add	w19, w19, 1
	mov	x0, x20
	mov	x1, x25
	cmp	w19, 188
	beq	.L49
.L33:
	mov	x20, x21
	adds	x21, x0, x21
	mov	x25, x23
	sub	w0, w19, #93
	adc	x23, x1, x23
	cmp	w19, 150
	ccmp	w0, 1, 0, ne
	bhi	.L50
.L31:
	mov	w1, w19
	mov	x0, x24
	bl	printf
	add	w19, w19, 1
	mov	x1, x25
	mov	x0, x20
	bl	print_u128
	mov	x0, x22
	bl	printf
	mov	x0, x20
	mov	x1, x25
	cmp	w19, 188
	bne	.L33
.L49:
	mov	x3, x25
	adrp	x24, .LC11
	adrp	x25, .LANCHOR0
	adrp	x23, .LC12
	add	x25, x25, :lo12:.LANCHOR0
	add	x24, x24, :lo12:.LC11
	add	x23, x23, :lo12:.LC12
	mov	w26, 0
	mov	x2, x20
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	hex128
	mov	x2, 1
	mov	x3, -2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	hex128
.L34:
	mov	w20, w26
	sxtw	x27, w26
.L35:
	ldr	x19, [x25, x27, lsl 3]
	ldr	x0, [x25, w20, sxtw 3]
	ldr	x1, [x25, x27, lsl 3]
	ldr	x2, [x25, w20, sxtw 3]
	mul	x21, x19, x0
	smulh	x19, x19, x0
	mov	x0, x24
	add	w20, w20, 1
	bl	printf
	mov	x0, x21
	mov	x1, x19
	bl	print_i128
	mov	x1, x19
	mov	x0, x23
	bl	printf
	cmp	w20, 5
	bne	.L35
	add	w26, w26, 1
	cmp	w26, 5
	bne	.L34
	ldr	x21, [x25, 48]
	adrp	x0, .LC13
	ldr	x19, [x25, 56]
	add	x0, x0, :lo12:.LC13
	ldr	x23, [x25, 64]
	ldr	x20, [x25, 72]
	extr	x28, x21, x19, 1
	umulh	x3, x19, x20
	madd	x3, x21, x20, x3
	madd	x3, x19, x23, x3
	mul	x24, x19, x20
	mov	x2, x24
	bl	hex128
	adds	x2, x19, x20
	adrp	x0, .LC14
	adc	x3, x21, x23
	add	x0, x0, :lo12:.LC14
	bl	hex128
	subs	x2, x19, x20
	adrp	x0, .LC15
	sbc	x3, x21, x23
	add	x0, x0, :lo12:.LC15
	bl	hex128
	subs	x2, x20, x19
	adrp	x0, .LC16
	sbc	x3, x23, x21
	add	x0, x0, :lo12:.LC16
	bl	hex128
	negs	x27, x19
	adrp	x0, .LC17
	sbc	x26, xzr, x21
	mov	x2, x27
	mov	x3, x26
	add	x0, x0, :lo12:.LC17
	bl	hex128
	mvn	x2, x19
	mvn	x3, x21
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	hex128
	lsl	x4, x19, 1
	extr	x3, x21, x19, 63
	mov	x2, x4
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	str	x4, [sp, 112]
	bl	hex128
	lsl	x1, x19, 63
	mov	x3, x28
	mov	x2, x1
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	str	x1, [sp, 104]
	bl	hex128
	mov	x3, x19
	mov	x2, 0
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	hex128
	ldr	x3, [sp, 112]
	mov	x2, 0
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	hex128
	ldr	x3, [sp, 104]
	mov	x2, 0
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	bl	hex128
	mov	x2, x28
	lsr	x3, x21, 1
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	hex128
	mov	x2, x21
	mov	x3, 0
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	hex128
	lsr	x2, x21, 63
	mov	x3, 0
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	hex128
	asr	x3, x26, 1
	extr	x2, x26, x27, 1
	adrp	x0, .LC27
	add	x0, x0, :lo12:.LC27
	bl	hex128
	asr	x2, x26, 36
	asr	x3, x26, 63
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	bl	hex128
	stp	x19, x21, [sp, 128]
	mov	x0, -1
	mov	x1, -1
	stp	x0, x1, [sp, 176]
	mov	x0, -9223372036854775808
	mov	x1, -1
	stp	x0, x1, [sp, 192]
	adrp	x0, .LC29
	add	x0, x0, :lo12:.LC29
	add	x9, sp, 128
	mov	w2, 0
	stp	x27, x26, [sp, 144]
	ldp	x0, x1, [x0]
	stp	xzr, xzr, [sp, 160]
	stp	x0, x1, [sp, 208]
	mov	w1, 0
	.align 5
.L37:
	ldp	x8, x5, [x9]
	add	x0, sp, 128
	.align 5
.L42:
	ldp	x7, x3, [x0]
	add	w1, w1, w1, lsl 1
	eor	x6, x5, x3
	eor	x4, x8, x7
	orr	x4, x4, x6
	mov	w6, 1
	cmp	x4, 0
	cset	w4, eq
	cmp	x3, x5
	bgt	.L38
	beq	.L51
.L39:
	mov	w6, 0
.L38:
	add	w4, w6, w4, lsl 1
	add	w2, w2, w2, lsl 1
	add	w1, w4, w1
	mov	w4, 1
	cmp	x3, x5
	bhi	.L40
	beq	.L52
.L41:
	mov	w4, 0
.L40:
	add	x0, x0, 16
	add	x3, sp, 224
	add	w2, w4, w2
	cmp	x0, x3
	bne	.L42
	add	x9, x9, 16
	cmp	x9, x0
	bne	.L37
	adrp	x0, .LC30
	add	x0, x0, :lo12:.LC30
	bl	printf
	ldr	x3, [x25, 32]
	adrp	x0, .LC31
	add	x0, x0, :lo12:.LC31
	sxtw	x2, w3
	sbfx	x3, x3, 31, 1
	bl	hex128
	ldr	x2, [x25, 32]
	adrp	x0, .LC32
	add	x0, x0, :lo12:.LC32
	asr	x3, x2, 63
	bl	hex128
	ldr	x2, [x25, 32]
	mov	x3, 0
	adrp	x0, .LC33
	add	x0, x0, :lo12:.LC33
	bl	hex128
	mul	w2, w19, w20
	mov	x1, x24
	adrp	x0, .LC34
	add	x0, x0, :lo12:.LC34
	bl	printf
	ldr	x0, [x25, 24]
	negs	x6, x20
	ldr	x4, [x25, 32]
	sbc	x7, xzr, x23
	mov	x2, x19
	mov	x3, x21
	bl	mix__constprop__0
	mov	x20, x0
	mov	x21, x1
	adrp	x0, .LC35
	add	x0, x0, :lo12:.LC35
	bl	printf
	mov	x1, x21
	mov	x0, x20
	bl	print_i128
	mov	x0, x22
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 224
	ret
	.align 2
.L51:
	cmp	x7, x8
	bhi	.L38
	b	.L39
	.align 2
.L52:
	cmp	x7, x8
	bhi	.L40
	b	.L41
.L48:
	mov	w0, 5
	cmp	w19, 32
	udiv	w0, w19, w0
	add	w0, w0, w0, lsl 2
	sub	w0, w19, w0
	ccmp	w0, 0, 4, le
	beq	.L26
	adds	x19, x19, 1
	cinc	x20, x20, cs
	b	.L30
.L26:
	mov	w1, w19
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	str	x2, [sp, 104]
	str	x3, [sp, 120]
	bl	printf
	ldr	x3, [sp, 120]
	ldr	x2, [sp, 104]
	mov	x1, x3
	stp	x3, x2, [sp, 104]
	mov	x0, x2
	bl	print_u128
	mov	x0, x22
	bl	printf
	adds	x19, x19, 1
	ldp	x3, x2, [sp, 104]
	cinc	x20, x20, cs
	b	.L30
	.section .rodata
	.align	4
.LC29:
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

