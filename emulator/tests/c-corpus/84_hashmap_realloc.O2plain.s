	.text
	.align	2
	.align 5
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
	cbz	w3, .L9
	mov	x24, x1
	mov	x21, 0
	stp	x25, x26, [sp, 64]
	mov	x25, x2
	mov	x26, x0
	b	.L3
	.align 2
.L4:
	ldr	x3, [x20]
	cmp	x3, x25
	beq	.L14
.L5:
	add	x19, x19, 1
	and	x19, x22, x19
	add	x20, x19, x19, lsl 1
	add	x20, x23, x20, lsl 3
	ldr	w3, [x20, 20]
	cbz	w3, .L15
.L3:
	cmp	w3, 2
	bne	.L4
	add	x19, x19, 1
	cmp	x21, 0
	and	x19, x22, x19
	csel	x21, x21, x20, ne
	add	x20, x19, x19, lsl 1
	add	x20, x23, x20, lsl 3
	ldr	w3, [x20, 20]
	cbnz	w3, .L3
.L15:
	ldp	x25, x26, [sp, 64]
	cmp	x21, 0
	csel	x21, x21, x20, ne
.L1:
	mov	x0, x21
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 80
	ret
	.align 2
.L14:
	ldr	x2, [x26, 32]
	mov	x1, x24
	ldr	x0, [x20, 8]
	add	x0, x2, x0
	bl	strcmp
	cbnz	w0, .L5
	mov	x21, x20
	mov	x0, x21
	ldp	x25, x26, [sp, 64]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 80
	ret
.L9:
	mov	x21, x20
	b	.L1
	.align	2
	.align 5
bump:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x0
	stp	x21, x22, [sp, 32]
	mov	x22, x1
	mov	w21, w2
	stp	x23, x24, [sp, 48]
	ldr	x24, [x0, 8]
	ldr	x0, [x0, 24]
	lsl	x20, x24, 1
	add	x0, x0, 1
	add	x0, x0, x0, lsl 1
	cmp	x0, x20
	bls	.L17
	ldr	x0, [x19, 16]
	mov	x1, 24
	ldr	x9, [x19]
	add	x0, x0, 1
	str	x9, [sp, 72]
	add	x0, x0, x0, lsl 1
	cmp	x24, x0
	csel	x23, x20, x24, cc
	mov	x0, x23
	bl	calloc
	stp	x0, x23, [x19]
	str	xzr, [x19, 24]
	ldr	x9, [sp, 72]
	cbz	x24, .L19
	add	x5, x20, x24
	mov	x3, x9
	sub	x8, x23, #1
	add	x5, x9, x5, lsl 3
	b	.L23
	.align 2
.L20:
	add	x3, x3, 24
	cmp	x5, x3
	beq	.L19
.L23:
	ldr	w1, [x3, 20]
	cmp	w1, 1
	bne	.L20
	ldr	x1, [x3]
	b	.L45
	.align 2
.L46:
	add	x1, x1, 1
.L45:
	and	x1, x8, x1
	add	x2, x1, x1, lsl 1
	add	x2, x0, x2, lsl 3
	ldr	w4, [x2, 20]
	cbnz	w4, .L46
	ldr	x1, [x3, 16]
	add	x3, x3, 24
	ldp	x6, x7, [x3, -24]
	str	x1, [x2, 16]
	ldr	x1, [x19, 24]
	stp	x6, x7, [x2]
	add	x1, x1, 1
	str	x1, [x19, 24]
	cmp	x5, x3
	bne	.L23
	.align 5
.L19:
	mov	x0, x9
	bl	free
.L17:
	ldrb	w1, [x22]
	cbz	w1, .L32
	mov	x20, 8997
	mov	x2, 435
	movk	x20, 0x8422, lsl 16
	mov	x0, x22
	movk	x20, 0x9ce4, lsl 32
	movk	x2, 0x100, lsl 32
	movk	x20, 0xcbf2, lsl 48
	.align 5
.L25:
	eor	x20, x1, x20
	ldrb	w1, [x0, 1]!
	mul	x20, x20, x2
	cbnz	w1, .L25
.L24:
	mov	x2, x20
	mov	x1, x22
	mov	x0, x19
	bl	find
	mov	x23, x0
	ldr	w0, [x0, 20]
	cmp	w0, 1
	bne	.L26
	ldr	w0, [x23, 16]
	add	w21, w21, w0
	str	w21, [x23, 16]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 80
	ret
	.align 2
.L26:
	cmp	w0, 0
	ldr	x0, [x19, 24]
	cinc	x0, x0, eq
	str	x0, [x19, 24]
	mov	w0, 1
	str	x20, [x23]
	str	w0, [x23, 20]
	mov	x0, x22
	bl	strlen
	add	x20, x0, 1
	ldp	x0, x3, [x19, 32]
	ldr	x2, [x19, 48]
	add	x1, x3, x20
	cmp	x1, x2
	bls	.L28
	mov	x24, 16
	.align 5
.L30:
	lsl	x1, x2, 1
	cmp	x2, 0
	csel	x1, x1, x24, ne
	str	x1, [x19, 48]
	bl	realloc
	str	x0, [x19, 32]
	ldp	x3, x2, [x19, 40]
	ldr	w1, [x19, 56]
	add	w1, w1, 1
	str	w1, [x19, 56]
	add	x1, x20, x3
	cmp	x2, x1
	bcc	.L30
.L28:
	mov	x2, x20
	mov	x1, x22
	add	x0, x0, x3
	bl	memcpy
	ldr	x0, [x19, 40]
	add	x20, x20, x0
	str	x20, [x19, 40]
	str	x0, [x23, 8]
	ldr	x0, [x19, 16]
	add	x0, x0, 1
	str	x0, [x19, 16]
	str	w21, [x23, 16]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 80
	ret
	.align 2
.L32:
	mov	x20, 8997
	movk	x20, 0x8422, lsl 16
	movk	x20, 0x9ce4, lsl 32
	movk	x20, 0xcbf2, lsl 48
	b	.L24
	.section .rodata
	.align	3
.LC1:
	.string	"kite"
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
.LC17:
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
	.align 5
	.global	main
main:
	sub	sp, sp, #560
	mov	x1, 24
	mov	x0, 8
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	bl	calloc
	mov	x3, 8997
	movk	x3, 0x8422, lsl 16
	adrp	x1, .LC1
	movk	x3, 0x9ce4, lsl 32
	adrp	x2, .LC1+4
	mov	x4, 435
	add	x1, x1, :lo12:.LC1
	add	x2, x2, :lo12:.LC1+4
	mov	x22, x0
	movk	x3, 0xcbf2, lsl 48
	mov	x0, 107
	movk	x4, 0x100, lsl 32
	str	xzr, [sp, 224]
	.align 5
.L48:
	eor	x3, x0, x3
	ldrb	w0, [x1, 1]!
	mul	x3, x3, x4
	cmp	x1, x2
	bne	.L48
	mov	x2, 60556
	mov	x1, 8997
	movk	x2, 0x8601, lsl 16
	movk	x1, 0x8422, lsl 16
	lsr	x3, x3, 1
	movk	x2, 0xdc4c, lsl 32
	movk	x1, 0x9ce4, lsl 32
	movk	x2, 0xaf63, lsl 48
	movk	x1, 0xcbf2, lsl 48
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	mov	x0, 265
	bl	malloc
	mov	x2, 265
	mov	x24, x0
	adrp	x1, .LC18
	adrp	x23, .LC19
	add	x1, x1, :lo12:.LC18
	add	x25, x23, :lo12:.LC19
	bl	memcpy
	mov	x1, x25
	mov	x0, x24
	bl	strtok
	mov	x1, x0
	cbz	x0, .L82
	add	x0, sp, 176
	mov	w23, 0
	mov	x19, 0
	mov	x21, 0
	mov	x28, 0
	mov	x27, 0
	mov	x26, 8
	mov	w20, 0
	str	x0, [sp, 104]
	.align 5
.L50:
	ldr	x0, [sp, 104]
	mov	w2, 1
	stp	x22, x26, [sp, 176]
	add	w20, w20, 1
	stp	x27, x28, [sp, 192]
	stp	x21, x19, [sp, 208]
	str	w23, [sp, 232]
	bl	bump
	mov	x1, x25
	ldr	w23, [sp, 232]
	ldp	x22, x26, [sp, 176]
	mov	x0, 0
	ldp	x27, x28, [sp, 192]
	ldp	x21, x19, [sp, 208]
	bl	strtok
	mov	x1, x0
	cbnz	x0, .L50
.L49:
	mov	x0, x24
	bl	free
	mov	w1, w20
	mov	w6, w23
	mov	w5, w19
	mov	w4, w28
	mov	w3, w26
	mov	w2, w27
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	printf
	adrp	x24, .LANCHOR0
	add	x0, x24, :lo12:.LANCHOR0
	mov	x24, 435
	adrp	x20, .LC23
	add	x25, sp, 240
	add	x20, x20, :lo12:.LC23
	movk	x24, 0x100, lsl 32
	ldp	q27, q29, [x0]
	str	x0, [sp, 120]
	ldp	q30, q31, [x0, 32]
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	stp	q27, q29, [sp, 240]
	stp	q30, q31, [sp, 272]
	bl	printf
	.align 5
.L54:
	ldr	x1, [x25]
	ldrb	w3, [x1]
	cbz	w3, .L83
	mov	x2, 8997
	mov	x0, x1
	movk	x2, 0x8422, lsl 16
	movk	x2, 0x9ce4, lsl 32
	movk	x2, 0xcbf2, lsl 48
	.align 5
.L52:
	eor	x2, x3, x2
	ldrb	w3, [x0, 1]!
	mul	x2, x2, x24
	cbnz	w3, .L52
.L51:
	ldr	x0, [sp, 104]
	str	x1, [sp, 112]
	stp	x22, x26, [sp, 176]
	stp	x27, x28, [sp, 192]
	stp	x21, x19, [sp, 208]
	str	w23, [sp, 232]
	bl	find
	ldr	w2, [x0, 20]
	ldr	x1, [sp, 112]
	cmp	w2, 1
	bne	.L84
	ldr	w2, [x0, 16]
.L53:
	mov	x0, x20
	bl	printf
	add	x25, x25, 8
	add	x0, sp, 304
	cmp	x0, x25
	bne	.L54
	ldr	x0, [sp, 120]
	mov	x25, 435
	adrp	x20, .LC26
	add	x24, sp, 128
	add	x20, x20, :lo12:.LC26
	movk	x25, 0x100, lsl 32
	ldr	q31, [x0, 96]
	ldp	q29, q30, [x0, 64]
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	str	q31, [sp, 160]
	stp	q29, q30, [sp, 128]
	bl	printf
	.align 5
.L58:
	ldr	x1, [x24]
	ldrb	w0, [x1]
	cbz	w0, .L85
	mov	x2, 8997
	mov	x3, x1
	movk	x2, 0x8422, lsl 16
	movk	x2, 0x9ce4, lsl 32
	movk	x2, 0xcbf2, lsl 48
	.align 5
.L56:
	eor	x2, x0, x2
	ldrb	w0, [x3, 1]!
	mul	x2, x2, x25
	cbnz	w0, .L56
.L55:
	ldr	x0, [sp, 104]
	stp	x22, x26, [sp, 176]
	stp	x27, x28, [sp, 192]
	stp	x21, x19, [sp, 208]
	str	w23, [sp, 232]
	bl	find
	ldr	w1, [x0, 20]
	cmp	w1, 1
	bne	.L86
	sub	x27, x27, #1
	mov	w2, 2
	str	w2, [x0, 20]
.L57:
	mov	x0, x20
	bl	printf
	ldr	x0, [sp, 104]
	add	x24, x24, 8
	cmp	x0, x24
	bne	.L58
	adrp	x24, .LC0
	adrp	x20, .LC11
	add	x24, x24, :lo12:.LC0
	add	x20, x20, :lo12:.LC11
	mov	w25, 0
	.align 5
.L60:
	ldr	x0, [sp, 104]
	tst	x25, 1
	csel	x1, x20, x24, eq
	mov	w2, 2
	add	w25, w25, 1
	stp	x22, x26, [sp, 176]
	stp	x27, x28, [sp, 192]
	stp	x21, x19, [sp, 208]
	str	w23, [sp, 232]
	bl	bump
	ldp	x22, x26, [sp, 176]
	ldp	x27, x28, [sp, 192]
	ldp	x21, x19, [sp, 208]
	ldr	w23, [sp, 232]
	cmp	w25, 40
	bne	.L60
	ldr	x0, [sp, 104]
	mov	x2, 54652
	movk	x2, 0x4461, lsl 16
	mov	x1, x24
	movk	x2, 0xc919, lsl 32
	movk	x2, 0x56f5, lsl 48
	bl	find
	ldr	w1, [x0, 20]
	cmp	w1, 1
	bne	.L88
	ldr	w25, [x0, 16]
.L61:
	ldr	x0, [sp, 104]
	mov	x2, 60842
	movk	x2, 0x5cd5, lsl 16
	mov	x1, x20
	movk	x2, 0x9819, lsl 32
	movk	x2, 0x822d, lsl 48
	bl	find
	ldr	w1, [x0, 20]
	cmp	w1, 1
	bne	.L89
	ldr	w20, [x0, 16]
.L62:
	ldr	x0, [sp, 104]
	mov	x2, 62086
	movk	x2, 0x51f, lsl 16
	adrp	x1, .LC9
	movk	x2, 0x9719, lsl 32
	add	x1, x1, :lo12:.LC9
	movk	x2, 0xe6f7, lsl 48
	bl	find
	ldr	w1, [x0, 20]
	cmp	w1, 1
	bne	.L90
	ldr	w24, [x0, 16]
.L63:
	ldr	x0, [sp, 104]
	mov	x2, 49692
	movk	x2, 0x60f4, lsl 16
	adrp	x1, .LC12
	movk	x2, 0xbe19, lsl 32
	add	x1, x1, :lo12:.LC12
	movk	x2, 0x89e9, lsl 48
	bl	find
	ldr	w1, [x0, 20]
	cmp	w1, 1
	bne	.L91
	ldr	w4, [x0, 16]
.L64:
	adrp	x0, .LC27
	mov	w23, w27
	mov	w7, w26
	mov	w6, w28
	mov	w5, w27
	mov	w3, w24
	mov	w2, w20
	mov	w1, w25
	add	x0, x0, :lo12:.LC27
	bl	printf
	cbz	x26, .L92
	mov	w25, 43691
	adrp	x19, .LC28
	mov	x28, x22
	add	x19, x19, :lo12:.LC28
	mov	x20, 0
	mov	w24, 0
	mov	w27, 0
	movk	w25, 0xaaaa, lsl 16
	b	.L70
	.align 2
.L66:
	add	x20, x20, 1
	add	x28, x28, 24
	cmp	x20, x26
	beq	.L65
.L70:
	ldr	w0, [x28, 20]
	cmp	w0, 1
	bne	.L66
	ldr	x0, [x28, 8]
	add	x3, x21, x0
	ldrb	w0, [x21, x0]
	cbz	w0, .L93
	mov	x1, 8997
	mov	x4, 435
	movk	x1, 0x8422, lsl 16
	mov	x2, x3
	movk	x1, 0x9ce4, lsl 32
	movk	x4, 0x100, lsl 32
	movk	x1, 0xcbf2, lsl 48
	.align 5
.L68:
	eor	x1, x0, x1
	ldrb	w0, [x2, 1]!
	mul	x1, x1, x4
	cbnz	w0, .L68
.L67:
	ldr	x0, [x28]
	cmp	x0, x1
	mul	w0, w27, w25
	mov	w1, 43690
	cinc	w24, w24, eq
	movk	w1, 0x2aaa, lsl 16
	ror	w0, w0, 1
	cmp	w0, w1
	bhi	.L94
	cbz	w27, .L95
	adrp	x1, .LC16
	add	x1, x1, :lo12:.LC16
.L69:
	ldr	w4, [x28, 16]
	mov	w2, w20
	mov	x0, x19
	add	x20, x20, 1
	add	w27, w27, 1
	add	x28, x28, 24
	bl	printf
	cmp	x20, x26
	bne	.L70
.L65:
	mov	w1, w24
	mov	w2, w23
	adrp	x0, .LC29
	mov	w20, -1000
	add	x0, x0, :lo12:.LC29
	mov	x19, 0
	mov	x25, 0
	mov	x27, 0
	mov	x26, 0
	mov	x24, 0
	bl	printf
	b	.L78
	.align 2
.L71:
	str	w20, [x24, x19, lsl 2]
	add	x19, x19, 1
	cmp	x19, 400
	beq	.L77
.L114:
	add	w20, w20, 7
.L78:
	cmp	x26, x19
	bne	.L71
.L75:
	add	x0, x26, 1
	add	x26, x0, x26, lsr 1
	mov	x0, x24
	ubfiz	x1, x26, 2, 32
	bl	realloc
	mov	x24, x0
	cmp	x27, 31
	bls	.L113
	add	x27, x27, 1
	cbz	x19, .L73
.L115:
	mov	w4, -1000
	mov	x1, 0
	.align 5
.L74:
	ldr	w0, [x24, x1, lsl 2]
	add	x1, x1, 1
	cmp	w0, w4
	add	w4, w4, 7
	cinc	x25, x25, ne
	cmp	x1, x19
	bne	.L74
	str	w20, [x24, x19, lsl 2]
	add	x19, x19, 1
	cmp	x19, 400
	bne	.L114
.L77:
	mov	x1, 40
	mov	x0, x24
	bl	realloc
	mov	x19, x0
	ldp	w4, w5, [x0]
	mov	w3, w26
	ldr	w6, [x19, 36]
	mov	x2, x25
	mov	w1, w27
	adrp	x0, .LC30
	add	x0, x0, :lo12:.LC30
	bl	printf
	mov	x0, x19
	bl	free
	cbz	x27, .L79
	mov	x19, 1
	.align 5
.L80:
	mov	x0, sp
	add	x0, x0, x19, lsl 3
	ldr	x0, [x0, 296]
	bl	free
	cmp	x19, 32
	ccmp	x27, x19, 0, ne
	add	x19, x19, 1
	bhi	.L80
.L79:
	mov	w2, 171
	adrp	x0, .LC31
	mov	w1, w2
	add	x0, x0, :lo12:.LC31
	bl	printf
	mov	x1, 4
	mov	x0, 1000
	bl	calloc
	mov	x19, x0
	movi	v30.4s, 0
	mov	x1, x0
	movi	v27.16b, 0x1
	add	x0, x0, 4000
	mov	v28.16b, v30.16b
	.align 5
.L81:
	ldr	q31, [x1], 16
	cmtst	v31.16b, v31.16b, v31.16b
	and	v31.16b, v31.16b, v27.16b
	zip1	v29.16b, v31.16b, v28.16b
	zip2	v31.16b, v31.16b, v28.16b
	uaddw	v30.4s, v30.4s, v29.4h
	uaddw2	v30.4s, v30.4s, v29.8h
	uaddw	v30.4s, v30.4s, v31.4h
	uaddw2	v30.4s, v30.4s, v31.8h
	cmp	x0, x1
	bne	.L81
	addv	s31, v30.4s
	adrp	x0, .LC32
	add	x0, x0, :lo12:.LC32
	fmov	w1, s31
	bl	printf
	mov	x0, x19
	bl	free
	mov	x0, x22
	bl	free
	mov	x0, x21
	bl	free
	ldp	x29, x30, [sp]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	add	sp, sp, 560
	ret
	.align 2
.L86:
	mov	w1, 0
	b	.L57
	.align 2
.L94:
	adrp	x1, .LC15
	add	x1, x1, :lo12:.LC15
	b	.L69
	.align 2
.L113:
	mov	x0, 24
	bl	malloc
	add	x1, sp, 304
	str	x0, [x1, x27, lsl 3]
	add	x27, x27, 1
	cbnz	x19, .L115
.L73:
	str	w20, [x24]
	add	w0, w20, 7
	cmp	x26, 1
	beq	.L96
	add	w20, w20, 14
	mov	x19, 2
	str	w0, [x24, 4]
	b	.L78
.L83:
	mov	x2, 8997
	movk	x2, 0x8422, lsl 16
	movk	x2, 0x9ce4, lsl 32
	movk	x2, 0xcbf2, lsl 48
	b	.L51
.L85:
	mov	x2, 8997
	movk	x2, 0x8422, lsl 16
	movk	x2, 0x9ce4, lsl 32
	movk	x2, 0xcbf2, lsl 48
	b	.L55
.L95:
	adrp	x1, .LC14
	add	x1, x1, :lo12:.LC14
	b	.L69
.L84:
	mov	w2, -1
	b	.L53
.L93:
	mov	x1, 8997
	movk	x1, 0x8422, lsl 16
	movk	x1, 0x9ce4, lsl 32
	movk	x1, 0xcbf2, lsl 48
	b	.L67
.L92:
	mov	w24, 0
	b	.L65
.L82:
	add	x0, sp, 176
	mov	x21, 0
	mov	w23, 0
	mov	x19, 0
	mov	x28, 0
	mov	x27, 0
	mov	x26, 8
	mov	w20, 0
	str	x0, [sp, 104]
	b	.L49
.L96:
	mov	x19, x26
	mov	w20, w0
	b	.L75
.L88:
	mov	w25, -1
	b	.L61
.L91:
	mov	w4, -1
	b	.L64
.L90:
	mov	w24, -1
	b	.L63
.L89:
	mov	w20, -1
	b	.L62
	.section .rodata
	.align	3
.LC18:
	.ascii	"the red "
	.string	"kite rode the warm air over the hill and the small birds below it hid in the hedge, while the kite turned and turned again; a farmer on the hill saw the kite, saw the hedge shake, and went back to the barn where the old red tractor sat waiting in the dark."
	.text
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
.LC5:
	.string	""
	.align	3
.LC6:
	.string	"Kite"
	.align	3
.LC7:
	.string	"hedge"
	.section .rodata
	.align	3
	.LANCHOR0:
.LC21:
	.quad	.LC0
	.quad	.LC1
	.quad	.LC2
	.quad	.LC3
	.quad	.LC4
	.quad	.LC5
	.quad	.LC6
	.quad	.LC7
.LC24:
	.quad	.LC0
	.quad	.LC9
	.quad	.LC10
	.quad	.LC9
	.quad	.LC11
	.quad	.LC12

