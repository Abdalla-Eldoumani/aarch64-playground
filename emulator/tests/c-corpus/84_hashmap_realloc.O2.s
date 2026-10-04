	.text
	.align	2
	.p2align 5,,15
fnv1a:
	ldrb	w1, [x0]
	mov	x2, x0
	mov	x0, 8997
	movk	x0, 0x8422, lsl 16
	movk	x0, 0x9ce4, lsl 32
	movk	x0, 0xcbf2, lsl 48
	cbz	w1, .L1
	mov	x3, 435
	movk	x3, 0x100, lsl 32
	.p2align 5,,15
.L3:
	eor	x0, x1, x0
	ldrb	w1, [x2, 1]!
	mul	x0, x0, x3
	cbnz	w1, .L3
.L1:
	ret
	.align	2
	.p2align 5,,15
rehash:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x1
	mov	x1, 24
	stp	x21, x22, [sp, 32]
	mov	x21, x0
	ldp	x22, x20, [x0]
	mov	x0, x19
	bl	calloc
	stp	x0, x19, [x21]
	str	xzr, [x21, 24]
	cbz	x20, .L8
	add	x20, x20, x20, lsl 1
	mov	x3, x22
	sub	x5, x19, #1
	add	x6, x22, x20, lsl 3
	b	.L12
	.p2align 2,,3
.L9:
	add	x3, x3, 24
	cmp	x6, x3
	beq	.L8
.L12:
	ldr	w1, [x3, 20]
	cmp	w1, 1
	bne	.L9
	ldr	x1, [x3]
	b	.L22
	.p2align 2,,3
.L23:
	add	x1, x1, 1
.L22:
	and	x1, x5, x1
	add	x2, x1, x1, lsl 1
	add	x2, x0, x2, lsl 3
	ldr	w4, [x2, 20]
	cbnz	w4, .L23
	ldr	x1, [x3, 16]
	add	x3, x3, 24
	ldp	x8, x9, [x3, -24]
	str	x1, [x2, 16]
	ldr	x1, [x21, 24]
	stp	x8, x9, [x2]
	add	x1, x1, 1
	str	x1, [x21, 24]
	cmp	x6, x3
	bne	.L12
.L8:
	ldp	x19, x20, [sp, 16]
	mov	x0, x22
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 48
	b	free
	.align	2
	.p2align 5,,15
find:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	ldp	x23, x22, [x0]
	sub	x22, x22, #1
	and	x19, x22, x2
	add	x20, x19, x19, lsl 1
	add	x20, x23, x20, lsl 3
	ldr	w3, [x20, 20]
	cbz	w3, .L32
	mov	x24, x1
	mov	x21, 0
	stp	x25, x26, [sp, 64]
	mov	x25, x2
	mov	x26, x0
	b	.L26
	.p2align 2,,3
.L27:
	ldr	x3, [x20]
	cmp	x3, x25
	beq	.L36
.L28:
	add	x19, x19, 1
	and	x19, x22, x19
	add	x20, x19, x19, lsl 1
	add	x20, x23, x20, lsl 3
	ldr	w3, [x20, 20]
	cbz	w3, .L37
.L26:
	cmp	w3, 2
	bne	.L27
	add	x19, x19, 1
	cmp	x21, 0
	and	x19, x22, x19
	csel	x21, x21, x20, ne
	add	x20, x19, x19, lsl 1
	add	x20, x23, x20, lsl 3
	ldr	w3, [x20, 20]
	cbnz	w3, .L26
.L37:
	ldp	x25, x26, [sp, 64]
	cmp	x21, 0
	csel	x21, x21, x20, ne
.L24:
	mov	x0, x21
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 80
	ret
	.p2align 2,,3
.L36:
	ldr	x2, [x26, 32]
	mov	x1, x24
	ldr	x0, [x20, 8]
	add	x0, x2, x0
	bl	strcmp
	cbnz	w0, .L28
	mov	x21, x20
	mov	x0, x21
	ldp	x25, x26, [sp, 64]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 80
	ret
.L32:
	mov	x21, x20
	b	.L24
	.align	2
	.p2align 5,,15
del:
	stp	x29, x30, [sp, -32]!
	mov	x4, x1
	mov	x29, sp
	str	x19, [sp, 16]
	mov	x19, x0
	mov	x0, x1
	bl	fnv1a
	mov	x1, x4
	mov	x2, x0
	mov	x0, x19
	bl	find
	mov	x1, x0
	ldr	w0, [x0, 20]
	cmp	w0, 1
	bne	.L40
	mov	w2, 2
	str	w2, [x1, 20]
	ldr	x1, [x19, 16]
	sub	x1, x1, #1
	str	x1, [x19, 16]
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
	.p2align 2,,3
.L40:
	ldr	x19, [sp, 16]
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret
	.align	2
	.p2align 5,,15
get:
	stp	x29, x30, [sp, -16]!
	mov	x5, x0
	mov	x4, x1
	mov	x29, sp
	mov	x0, x1
	bl	fnv1a
	mov	x2, x0
	mov	x1, x4
	mov	x0, x5
	bl	find
	ldr	w1, [x0, 20]
	cmp	w1, 1
	bne	.L44
	ldr	w0, [x0, 16]
.L42:
	ldp	x29, x30, [sp], 16
	ret
	.p2align 2,,3
.L44:
	mov	w0, -1
	b	.L42
	.align	2
	.p2align 5,,15
arena_put:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x0
	mov	x0, x1
	stp	x21, x22, [sp, 32]
	mov	x22, x1
	bl	strlen
	add	x20, x0, 1
	ldp	x0, x3, [x19, 32]
	ldr	x2, [x19, 48]
	add	x1, x20, x3
	cmp	x1, x2
	bls	.L47
	mov	x21, 16
	.p2align 5,,15
.L49:
	lsl	x1, x2, 1
	cmp	x2, 0
	csel	x1, x1, x21, ne
	str	x1, [x19, 48]
	bl	realloc
	str	x0, [x19, 32]
	ldp	x3, x2, [x19, 40]
	ldr	w1, [x19, 56]
	add	w1, w1, 1
	str	w1, [x19, 56]
	add	x1, x3, x20
	cmp	x1, x2
	bhi	.L49
.L47:
	mov	x2, x20
	mov	x1, x22
	add	x0, x0, x3
	bl	memcpy
	ldr	x0, [x19, 40]
	add	x20, x0, x20
	str	x20, [x19, 40]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 48
	ret
	.align	2
	.p2align 5,,15
bump:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x0
	stp	x21, x22, [sp, 32]
	mov	w21, w2
	ldr	x3, [x0, 24]
	str	x23, [sp, 48]
	mov	x23, x1
	ldr	x1, [x0, 8]
	add	x3, x3, 1
	add	x3, x3, x3, lsl 1
	lsl	x4, x1, 1
	cmp	x3, x4
	bls	.L54
	ldr	x2, [x0, 16]
	add	x2, x2, 1
	add	x2, x2, x2, lsl 1
	cmp	x1, x2
	csel	x1, x1, x4, cs
	bl	rehash
.L54:
	mov	x0, x23
	bl	fnv1a
	mov	x1, x23
	mov	x2, x0
	mov	x22, x0
	mov	x0, x19
	bl	find
	mov	x20, x0
	ldr	w0, [x0, 20]
	cmp	w0, 1
	bne	.L56
	ldr	w0, [x20, 16]
	ldr	x23, [sp, 48]
	add	w21, w21, w0
	str	w21, [x20, 16]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.p2align 2,,3
.L56:
	cmp	w0, 0
	mov	x1, x23
	ldr	x0, [x19, 24]
	cinc	x0, x0, eq
	str	x0, [x19, 24]
	mov	w0, 1
	str	x22, [x20]
	str	w0, [x20, 20]
	mov	x0, x19
	bl	arena_put
	str	x0, [x20, 8]
	ldr	x0, [x19, 16]
	ldr	x23, [sp, 48]
	add	x0, x0, 1
	str	x0, [x19, 16]
	str	w21, [x20, 16]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"the"
	.align	3
.LC11:
	.string	"saw"
	.align	3
.LC14:
	.string	"slots "
	.align	3
.LC15:
	.string	" "
	.align	3
.LC16:
	.string	"\n  "
	.align	3
.LC5:
	.string	""
	.align	3
.LC17:
	.string	"a"
	.align	3
.LC1:
	.string	"kite"
	.align	3
.LC18:
	.string	"fnv: %016zx %016zx %zx\n"
	.align	3
.LC19:
	.string	" ,.;"
	.align	3
.LC20:
	.string	"words %d distinct %d cap %d used %d arena %d moves %d\n"
	.align	3
.LC22:
	.string	"get:"
	.align	3
.LC23:
	.string	" %s=%d"
	.align	3
.LC25:
	.string	"\ndel:"
	.align	3
.LC26:
	.string	" %d"
	.align	3
.LC9:
	.string	"and"
	.align	3
.LC12:
	.string	"red"
	.align	3
.LC27:
	.string	"\nafter: the=%d saw=%d and=%d red=%d live %d used %d cap %d\n"
	.align	3
.LC28:
	.string	"%s%d:%s=%d"
	.align	3
.LC29:
	.string	"\nhash ok %d of %d\n"
	.align	3
.LC30:
	.string	"vector grows %d bad %ld last cap %d head %d %d %d\n"
	.align	3
.LC31:
	.string	"dirty %d %d\n"
	.align	3
.LC32:
	.string	"calloc nonzero %d\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #544
	mov	x1, 24
	mov	x0, 8
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	adrp	x23, .LC19
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	bl	calloc
	mov	x25, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	str	xzr, [sp, 208]
	bl	fnv1a
	mov	x4, x0
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	fnv1a
	mov	x5, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	fnv1a
	mov	x1, x4
	lsr	x3, x0, 1
	mov	x2, x5
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	printf
	adrp	x27, .LANCHOR0
	mov	x0, 265
	add	x27, x27, :lo12:.LANCHOR0
	bl	malloc
	mov	x1, x27
	mov	x19, x0
	add	x28, x23, :lo12:.LC19
	str	x0, [sp, 104]
	bl	strcpy
	mov	x1, x28
	mov	x0, x19
	bl	strtok
	cbz	x0, .L81
	mov	x1, x0
	add	x24, sp, 160
	mov	w6, 0
	mov	x23, 0
	mov	x26, 0
	mov	x22, 0
	mov	x21, 0
	mov	x20, 8
	mov	w19, 0
	.p2align 5,,15
.L61:
	mov	x0, x24
	mov	w2, 1
	stp	x25, x20, [sp, 160]
	add	w19, w19, 1
	stp	x21, x22, [sp, 176]
	stp	x26, x23, [sp, 192]
	str	w6, [sp, 216]
	bl	bump
	ldr	w6, [sp, 216]
	mov	x1, x28
	ldp	x25, x20, [sp, 160]
	mov	x0, 0
	ldp	x21, x22, [sp, 176]
	str	w6, [sp, 96]
	ldp	x26, x23, [sp, 192]
	bl	strtok
	ldr	w6, [sp, 96]
	mov	x1, x0
	cbnz	x0, .L61
.L60:
	ldr	x0, [sp, 104]
	str	w6, [sp, 96]
	add	x28, sp, 224
	bl	free
	ldr	w6, [sp, 96]
	mov	w1, w19
	mov	w5, w23
	mov	w4, w22
	mov	w3, w20
	mov	w2, w21
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	str	w6, [sp, 96]
	bl	printf
	ldp	q27, q29, [x27, 272]
	adrp	x0, .LC22
	ldp	q30, q31, [x27, 304]
	add	x0, x0, :lo12:.LC22
	stp	q27, q29, [sp, 224]
	adrp	x19, .LC23
	add	x19, x19, :lo12:.LC23
	stp	q30, q31, [sp, 256]
	bl	printf
	ldr	w6, [sp, 96]
	.p2align 5,,15
.L62:
	ldr	x1, [x28], 8
	mov	x0, x24
	str	x1, [sp, 96]
	str	w6, [sp, 104]
	stp	x25, x20, [sp, 160]
	stp	x21, x22, [sp, 176]
	stp	x26, x23, [sp, 192]
	str	w6, [sp, 216]
	bl	get
	ldr	x1, [sp, 96]
	mov	w2, w0
	mov	x0, x19
	bl	printf
	add	x0, sp, 288
	ldr	w6, [sp, 104]
	cmp	x28, x0
	bne	.L62
	ldr	q31, [x27, 368]
	adrp	x0, .LC25
	ldp	q29, q30, [x27, 336]
	add	x0, x0, :lo12:.LC25
	str	w6, [sp, 96]
	adrp	x19, .LC26
	str	q31, [sp, 144]
	add	x19, x19, :lo12:.LC26
	add	x27, sp, 112
	stp	q29, q30, [sp, 112]
	bl	printf
	ldr	w6, [sp, 96]
	.p2align 5,,15
.L63:
	ldr	x1, [x27], 8
	mov	x0, x24
	stp	x25, x20, [sp, 160]
	stp	x21, x22, [sp, 176]
	stp	x26, x23, [sp, 192]
	str	w6, [sp, 216]
	bl	del
	ldr	w6, [sp, 216]
	mov	w1, w0
	ldp	x25, x20, [sp, 160]
	mov	x0, x19
	ldp	x21, x22, [sp, 176]
	str	w6, [sp, 96]
	ldp	x26, x23, [sp, 192]
	bl	printf
	ldr	w6, [sp, 96]
	cmp	x27, x24
	bne	.L63
	adrp	x28, .LC0
	adrp	x27, .LC11
	add	x28, x28, :lo12:.LC0
	add	x27, x27, :lo12:.LC11
	mov	w19, 0
	.p2align 5,,15
.L65:
	tst	x19, 1
	mov	x0, x24
	csel	x1, x27, x28, eq
	mov	w2, 2
	add	w19, w19, 1
	stp	x25, x20, [sp, 160]
	stp	x21, x22, [sp, 176]
	stp	x26, x23, [sp, 192]
	str	w6, [sp, 216]
	bl	bump
	ldr	w6, [sp, 216]
	ldp	x25, x20, [sp, 160]
	ldp	x21, x22, [sp, 176]
	ldp	x26, x23, [sp, 192]
	cmp	w19, 40
	bne	.L65
	mov	x1, x28
	mov	x0, x24
	bl	get
	mov	w19, w0
	mov	x1, x27
	mov	x0, x24
	bl	get
	mov	w27, w0
	adrp	x1, .LC9
	mov	x0, x24
	add	x1, x1, :lo12:.LC9
	bl	get
	adrp	x1, .LC12
	mov	w28, w0
	add	x1, x1, :lo12:.LC12
	mov	x0, x24
	bl	get
	mov	w23, w21
	mov	w4, w0
	mov	w7, w20
	adrp	x0, .LC27
	mov	w6, w22
	mov	w5, w21
	mov	w3, w28
	mov	w2, w27
	mov	w1, w19
	add	x0, x0, :lo12:.LC27
	bl	printf
	cbz	x20, .L83
	mov	w28, 43691
	adrp	x21, .LC28
	mov	x27, x25
	add	x21, x21, :lo12:.LC28
	mov	x22, 0
	mov	w19, 0
	mov	w24, 0
	movk	w28, 0xaaaa, lsl 16
	b	.L69
	.p2align 2,,3
.L67:
	add	x22, x22, 1
	add	x27, x27, 24
	cmp	x22, x20
	beq	.L66
.L69:
	ldr	w0, [x27, 20]
	cmp	w0, 1
	bne	.L67
	ldp	x4, x7, [x27]
	add	x7, x26, x7
	mov	x0, x7
	bl	fnv1a
	cmp	x4, x0
	mul	w0, w24, w28
	mov	w2, 43690
	adrp	x1, .LC15
	cinc	w19, w19, eq
	add	x1, x1, :lo12:.LC15
	movk	w2, 0x2aaa, lsl 16
	ror	w0, w0, 1
	cmp	w0, w2
	bhi	.L68
	cbnz	w24, .L85
	adrp	x1, .LC14
	add	x1, x1, :lo12:.LC14
.L68:
	ldr	w4, [x27, 16]
	mov	w2, w22
	mov	x3, x7
	mov	x0, x21
	add	x22, x22, 1
	add	w24, w24, 1
	add	x27, x27, 24
	bl	printf
	cmp	x22, x20
	bne	.L69
.L66:
	mov	w1, w19
	mov	w2, w23
	adrp	x0, .LC29
	mov	w20, -1000
	add	x0, x0, :lo12:.LC29
	mov	x19, 0
	mov	x22, 0
	mov	x27, 0
	mov	x24, 0
	mov	x21, 0
	bl	printf
	b	.L77
	.p2align 2,,3
.L70:
	str	w20, [x21, x19, lsl 2]
	add	x19, x19, 1
	cmp	x19, 400
	beq	.L76
.L100:
	add	w20, w20, 7
.L77:
	cmp	x24, x19
	bne	.L70
.L74:
	add	x0, x24, 1
	add	x24, x0, x24, lsr 1
	mov	x0, x21
	ubfiz	x1, x24, 2, 32
	bl	realloc
	mov	x21, x0
	cmp	x27, 31
	bls	.L99
	add	x27, x27, 1
	cbz	x19, .L72
.L101:
	mov	w4, -1000
	mov	x1, 0
	.p2align 5,,15
.L73:
	ldr	w2, [x21, x1, lsl 2]
	add	x1, x1, 1
	cmp	w2, w4
	add	w4, w4, 7
	cinc	x22, x22, ne
	cmp	x19, x1
	bne	.L73
	str	w20, [x21, x19, lsl 2]
	add	x19, x19, 1
	cmp	x19, 400
	bne	.L100
.L76:
	mov	x1, 40
	mov	x0, x21
	bl	realloc
	mov	x19, x0
	ldp	w4, w5, [x0]
	mov	w3, w24
	ldr	w6, [x19, 36]
	mov	x2, x22
	mov	w1, w27
	adrp	x0, .LC30
	add	x0, x0, :lo12:.LC30
	bl	printf
	mov	x0, x19
	bl	free
	cbz	x27, .L78
	mov	x19, 1
	.p2align 5,,15
.L79:
	mov	x0, sp
	add	x0, x0, x19, lsl 3
	ldr	x0, [x0, 280]
	bl	free
	cmp	x19, 32
	ccmp	x27, x19, 0, ne
	add	x19, x19, 1
	bhi	.L79
.L78:
	mov	x0, 4000
	bl	malloc
	mov	x19, x0
	mov	x2, 4000
	mov	w1, 171
	bl	memset
	adrp	x0, .LC31
	add	x0, x0, :lo12:.LC31
	ldrb	w2, [x19, 3999]
	ldrb	w1, [x19]
	bl	printf
	mov	x0, x19
	bl	free
	mov	x1, 4
	mov	x0, 1000
	bl	calloc
	mov	x19, x0
	movi	v30.4s, 0
	mov	x1, x0
	movi	v27.16b, 0x1
	add	x0, x0, 4000
	mov	v28.16b, v30.16b
	.p2align 5,,15
.L80:
	ldr	q31, [x1], 16
	cmtst	v31.16b, v31.16b, v31.16b
	and	v31.16b, v31.16b, v27.16b
	zip1	v29.16b, v31.16b, v28.16b
	zip2	v31.16b, v31.16b, v28.16b
	uaddw	v30.4s, v30.4s, v29.4h
	uaddw2	v30.4s, v30.4s, v29.8h
	uaddw	v30.4s, v30.4s, v31.4h
	uaddw2	v30.4s, v30.4s, v31.8h
	cmp	x1, x0
	bne	.L80
	addv	s31, v30.4s
	adrp	x0, .LC32
	add	x0, x0, :lo12:.LC32
	fmov	w1, s31
	bl	printf
	mov	x0, x19
	bl	free
	mov	x0, x25
	bl	free
	mov	x0, x26
	bl	free
	ldp	x29, x30, [sp]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	add	sp, sp, 544
	ret
	.p2align 2,,3
.L99:
	mov	x0, 24
	bl	malloc
	add	x1, sp, 288
	str	x0, [x1, x27, lsl 3]
	add	x27, x27, 1
	cbnz	x19, .L101
.L72:
	str	w20, [x21]
	add	w0, w20, 7
	cmp	x24, 1
	beq	.L86
	add	w20, w20, 14
	mov	x19, 2
	str	w0, [x21, 4]
	b	.L77
.L85:
	adrp	x1, .LC16
	add	x1, x1, :lo12:.LC16
	b	.L68
.L81:
	add	x24, sp, 160
	mov	x26, 0
	mov	w6, 0
	mov	x23, 0
	mov	x22, 0
	mov	x21, 0
	mov	x20, 8
	mov	w19, 0
	b	.L60
.L83:
	mov	w19, 0
	b	.L66
.L86:
	mov	x19, x24
	mov	w20, w0
	b	.L74
	.section .rodata
	.align	3
.LC10:
	.string	"zebra"
	.align	3
.LC2:
	.string	"hill"
	.align	3
.LC3:
	.string	"tractor"
	.align	3
.LC4:
	.string	"dragon"
	.align	3
.LC6:
	.string	"Kite"
	.align	3
.LC7:
	.string	"hedge"
	.section .rodata
	.align	4
	.LANCHOR0:
text:
	.ascii	"the red "
	.string	"kite rode the warm air over the hill and the small birds below it hid in the hedge, while the kite turned and turned again; a farmer on the hill saw the kite, saw the hedge shake, and went back to the barn where the old red tractor sat waiting in the dark."
	.zero	7
.LC21:
	.xword	.LC0
	.xword	.LC1
	.xword	.LC2
	.xword	.LC3
	.xword	.LC4
	.xword	.LC5
	.xword	.LC6
	.xword	.LC7
.LC24:
	.xword	.LC0
	.xword	.LC9
	.xword	.LC10
	.xword	.LC9
	.xword	.LC11
	.xword	.LC12

