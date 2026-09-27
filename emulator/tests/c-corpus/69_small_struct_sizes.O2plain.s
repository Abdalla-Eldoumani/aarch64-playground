	.text
	.align	2
	.p2align 5,,15
	.global	mix1
mix1:
	ubfiz	w1, w0, 3, 5
	sub	w0, w1, w0
	add	w0, w0, 1
	ret
	.align	2
	.p2align 5,,15
	.global	mix2
mix2:
	ubfx	x3, x0, 8, 8
	ubfiz	w2, w3, 3, 5
	sub	w2, w2, w3
	add	w2, w2, 2
	add	w1, w2, w1
	ubfiz	w2, w0, 3, 5
	sub	w2, w2, w0
	mov	w0, 0
	add	w2, w2, 2
	bfi	w0, w2, 0, 8
	bfi	w0, w1, 8, 8
	ret
	.align	2
	.p2align 5,,15
	.global	mix3
mix3:
	sub	sp, sp, #32
	mov	w3, 0
	add	x2, sp, 8
	add	x5, sp, 11
	str	x0, [sp, 8]
.L5:
	ldrb	w4, [x2]
	ubfiz	w0, w4, 3, 5
	sub	w0, w0, w4
	add	w4, w3, 3
	add	w0, w0, w4
	strb	w0, [x2], 1
	add	w3, w1, w3
	cmp	x2, x5
	bne	.L5
	ldrh	w1, [sp, 8]
	mov	x0, 0
	bfi	x0, x1, 0, 16
	ldrb	w1, [sp, 10]
	add	sp, sp, 32
	bfi	x0, x1, 16, 8
	ret
	.align	2
	.p2align 5,,15
	.global	mix5
mix5:
	sub	sp, sp, #32
	mov	w3, 0
	add	x2, sp, 8
	add	x5, sp, 13
	str	x0, [sp, 8]
.L9:
	ldrb	w4, [x2]
	ubfiz	w0, w4, 3, 5
	sub	w0, w0, w4
	add	w4, w3, 5
	add	w0, w0, w4
	strb	w0, [x2], 1
	add	w3, w1, w3
	cmp	x2, x5
	bne	.L9
	ldr	w1, [sp, 8]
	mov	x0, 0
	bfi	x0, x1, 0, 32
	ldrb	w1, [sp, 12]
	add	sp, sp, 32
	bfi	x0, x1, 32, 8
	ret
	.align	2
	.p2align 5,,15
	.global	mix7
mix7:
	sub	sp, sp, #32
	mov	w4, 0
	add	x2, sp, 8
	add	x5, sp, 15
	str	x0, [sp, 8]
	.p2align 5,,15
.L13:
	ldrb	w0, [x2]
	add	w0, w0, 1
	add	w3, w4, w0, lsl 3
	add	w4, w1, w4
	sub	w0, w3, w0
	strb	w0, [x2], 1
	cmp	x2, x5
	bne	.L13
	ldr	w0, [sp, 8]
	str	w0, [sp, 24]
	ldr	w0, [sp, 11]
	str	w0, [sp, 27]
	mov	x0, 0
	ldr	w1, [sp, 24]
	bfi	x0, x1, 0, 32
	ldrh	w1, [sp, 28]
	bfi	x0, x1, 32, 16
	ldrb	w1, [sp, 30]
	add	sp, sp, 32
	bfi	x0, x1, 48, 8
	ret
	.align	2
	.p2align 5,,15
	.global	mix9
mix9:
	fmov	d1, x0
	movi	v29.8b, 0x9
	adrp	x0, .LANCHOR0
	dup	v31.8b, w2
	shl	v0.8b, v1.8b, 3
	sub	sp, sp, #32
	ldr	d30, [x0, :lo12:.LANCHOR0]
	lsl	w0, w1, 3
	sub	w0, w0, w1
	add	sp, sp, 32
	add	w0, w0, 9
	sub	v0.8b, v0.8b, v1.8b
	add	w1, w0, w2, lsl 3
	and	x1, x1, 255
	add	v29.8b, v0.8b, v29.8b
	mla	v29.8b, v31.8b, v30.8b
	umov	x0, v29.d[0]
	ret
	.align	2
	.p2align 5,,15
	.global	mix12
mix12:
	fmov	d1, x0
	movi	v29.8b, 0xc
	adrp	x0, .LANCHOR0
	dup	v31.8b, w2
	shl	v0.8b, v1.8b, 3
	sub	sp, sp, #32
	ldr	d30, [x0, :lo12:.LANCHOR0]
	lsl	w3, w2, 3
	add	x5, sp, 4
	str	w1, [sp, 8]
	mov	x1, sp
	sub	v0.8b, v0.8b, v1.8b
	add	v29.8b, v0.8b, v29.8b
	mla	v29.8b, v31.8b, v30.8b
	str	d29, [sp]
	.p2align 5,,15
.L19:
	ldrb	w4, [x1, 8]
	add	x1, x1, 1
	ubfiz	w0, w4, 3, 5
	sub	w0, w0, w4
	add	w4, w3, 12
	add	w0, w0, w4
	strb	w0, [x1, 7]
	add	w3, w3, w2, uxtb
	cmp	x1, x5
	bne	.L19
	ldr	x0, [sp]
	ldr	w1, [sp, 8]
	add	sp, sp, 32
	ret
	.align	2
	.p2align 5,,15
	.global	mix15
mix15:
	sub	sp, sp, #32
	mov	w3, 0
	add	x5, sp, 15
	str	x0, [sp]
	ubfx	x0, x1, 32, 16
	str	w1, [sp, 8]
	ubfx	x1, x1, 48, 8
	strb	w1, [sp, 14]
	mov	x1, sp
	strh	w0, [sp, 12]
	.p2align 5,,15
.L23:
	ldrb	w4, [x1]
	ubfiz	w0, w4, 3, 5
	sub	w0, w0, w4
	add	w4, w3, 15
	add	w0, w0, w4
	strb	w0, [x1], 1
	add	w3, w2, w3
	cmp	x1, x5
	bne	.L23
	ldr	x0, [sp]
	str	x0, [sp, 16]
	ldr	x0, [sp, 7]
	str	x0, [sp, 23]
	mov	x1, 0
	ldr	w0, [sp, 24]
	bfi	x1, x0, 0, 32
	ldrh	w0, [sp, 28]
	bfi	x1, x0, 32, 16
	ldrb	w0, [sp, 30]
	bfi	x1, x0, 48, 8
	ldr	x0, [sp, 16]
	add	sp, sp, 32
	ret
	.align	2
	.p2align 5,,15
	.global	mix16
mix16:
	fmov	d1, x0
	adrp	x0, .LANCHOR0+16
	movi	v29.16b, 0x10
	fmov	v1.d[1], x1
	dup	v31.16b, w2
	ldr	q30, [x0, :lo12:.LANCHOR0+16]
	shl	v0.16b, v1.16b, 3
	sub	v0.16b, v0.16b, v1.16b
	add	v29.16b, v0.16b, v29.16b
	mla	v29.16b, v31.16b, v30.16b
	umov	x0, v29.d[0]
	umov	x1, v29.d[1]
	ret
	.align	2
	.p2align 5,,15
	.global	neg6
neg6:
	lsr	w2, w0, 16
	ubfx	x1, x0, 32, 8
	sub	sp, sp, #32
	neg	w0, w0
	ubfiz	w3, w2, 2, 14
	sub	w2, w2, w3
	ubfx	x3, x1, 7, 1
	add	w1, w3, w1, sxtb
	strb	w0, [sp, 24]
	strh	w2, [sp, 26]
	mov	x0, 0
	asr	w1, w1, 1
	sub	w1, w1, #50
	strb	w1, [sp, 28]
	ldr	w1, [sp, 24]
	bfi	x0, x1, 0, 32
	ldrh	w1, [sp, 28]
	add	sp, sp, 32
	bfi	x0, x1, 32, 16
	ret
	.align	2
	.p2align 5,,15
	.global	rot12
rot12:
	sub	sp, sp, #32
	lsr	x3, x0, 32
	ldr	w2, [sp, 8]
	bfi	w2, w1, 0, 32
	stp	w3, w2, [sp, 16]
	sub	w1, w0, w3
	ldr	x0, [sp, 16]
	sub	w1, w1, w2
	add	sp, sp, 32
	ret
	.align	2
	.p2align 5,,15
	.global	next16
next16:
	add	w0, w0, 1
	mvn	x1, x1, lsl 1
	and	x0, x0, 255
	ret
	.align	2
	.p2align 5,,15
	.global	spill
spill:
	sub	sp, sp, #64
	and	x8, x0, 255
	mov	w7, w0
	stp	x2, x1, [sp, 40]
	mov	w2, 131
	ldr	w1, [sp, 80]
	str	x0, [sp, 56]
	ubfx	x0, x0, 8, 8
	str	x3, [sp, 24]
	add	x3, sp, 53
	stp	x5, x6, [sp, 8]
	smaddl	x1, w1, w2, x8
	strb	w4, [sp, 32]
	add	x2, x1, x1, lsl 6
	add	x1, x1, x2, lsl 1
	add	x0, x0, x1
	add	x1, x0, x0, lsl 6
	add	x1, x0, x1, lsl 1
	ubfx	x0, x7, 16, 8
	add	x0, x0, x1
	add	x1, sp, 48
.L33:
	add	x2, x0, x0, lsl 6
	add	x0, x0, x2, lsl 1
	ldrb	w2, [x1], 1
	add	x0, x2, x0
	cmp	x3, x1
	bne	.L33
	add	x1, sp, 40
	add	x3, sp, 47
	.p2align 5,,15
.L34:
	add	x2, x0, x0, lsl 6
	add	x0, x0, x2, lsl 1
	ldrb	w2, [x1], 1
	add	x0, x2, x0
	cmp	x3, x1
	bne	.L34
	add	x3, sp, 24
	add	x4, sp, 33
	mov	x1, x3
	.p2align 5,,15
.L35:
	add	x2, x0, x0, lsl 6
	add	x0, x0, x2, lsl 1
	ldrb	w2, [x1], 1
	add	x0, x2, x0
	cmp	x4, x1
	bne	.L35
	add	x1, sp, 8
	.p2align 5,,15
.L36:
	add	x2, x0, x0, lsl 6
	add	x0, x0, x2, lsl 1
	ldrb	w2, [x1], 1
	add	x0, x2, x0
	cmp	x3, x1
	bne	.L36
	add	x1, sp, 64
	add	x3, sp, 79
	.p2align 5,,15
.L37:
	add	x2, x0, x0, lsl 6
	add	x0, x0, x2, lsl 1
	ldrb	w2, [x1], 1
	add	x0, x2, x0
	cmp	x3, x1
	bne	.L37
	add	sp, sp, 64
	ret
	.section .rodata
	.align	3
.LC5:
	.string	"%-4s"
	.align	3
.LC6:
	.string	" %02x"
	.align	3
.LC7:
	.string	" | %u\n"
	.text
	.align	2
	.p2align 5,,15
	.global	show
show:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x20, x1
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	stp	x21, x22, [sp, 32]
	mov	w21, w2
	bl	printf
	cmp	w21, 0
	ble	.L47
	adrp	x22, .LC6
	add	x21, x20, w21, sxtw
	add	x22, x22, :lo12:.LC6
	mov	w19, 0
	.p2align 5,,15
.L46:
	ldrb	w1, [x20]
	mov	x0, x22
	bl	printf
	lsl	w0, w19, 5
	sub	w19, w0, w19
	ldrb	w0, [x20], 1
	add	w19, w0, w19
	cmp	x20, x21
	bne	.L46
	ldp	x21, x22, [sp, 32]
	mov	w1, w19
	ldp	x19, x20, [sp, 16]
	adrp	x0, .LC7
	ldp	x29, x30, [sp], 48
	add	x0, x0, :lo12:.LC7
	b	printf
	.p2align 2,,3
.L47:
	mov	w19, 0
	mov	w1, w19
	ldp	x21, x22, [sp, 32]
	adrp	x0, .LC7
	ldp	x19, x20, [sp, 16]
	add	x0, x0, :lo12:.LC7
	ldp	x29, x30, [sp], 48
	b	printf
	.section .rodata
	.align	3
.LC8:
	.string	"b1"
	.align	3
.LC9:
	.string	"b2"
	.align	3
.LC10:
	.string	"b3"
	.align	3
.LC11:
	.string	"b5"
	.align	3
.LC12:
	.string	"b7"
	.align	3
.LC13:
	.string	"b9"
	.align	3
.LC14:
	.string	"b12"
	.align	3
.LC15:
	.string	"b15"
	.align	3
.LC16:
	.string	"b16"
	.align	3
.LC17:
	.string	"direct %u %u\n"
	.align	3
.LC18:
	.string	"spill %lu %016lx\n"
	.align	3
.LC19:
	.string	"s6 %d %d %d\n"
	.align	3
.LC20:
	.string	"s12 %d %d %d\n"
	.align	3
.LC21:
	.string	"s16 %c %ld\n"
	.align	3
.LC22:
	.string	"sizes %d %d %d %d\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #320
	adrp	x0, .LANCHOR1
	mov	w1, 0
	mov	w2, 240
	mov	w3, w1
	mov	w8, 127
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	mov	w7, -91
	ldr	w0, [x0, :lo12:.LANCHOR1]
	str	w0, [sp, 164]
	mov	w0, 513
	strh	w0, [sp, 184]
	mov	w0, 3
	strb	w0, [sp, 186]
	mov	w0, 57840
	stp	x19, x20, [sp, 48]
	movk	w0, 0xc3d2, lsl 16
	stp	x21, x22, [sp, 64]
	add	x20, sp, 224
	add	x21, sp, 304
	stp	x23, x24, [sp, 80]
	stp	x25, x26, [sp, 96]
	add	x26, sp, 256
	stp	x27, x28, [sp, 112]
	add	x27, sp, 240
	str	d15, [sp, 128]
	str	w0, [sp, 200]
	mov	w0, -76
	strb	w0, [sp, 204]
	mov	x0, 1
	cmp	w1, 6
	ble	.L97
.L51:
	cmp	w1, 8
	bgt	.L53
.L52:
	add	x4, x20, x0
	eor	w5, w2, w7
	strb	w5, [x4, -1]
.L54:
	add	x4, x27, x0
	sub	w5, w8, w2
	strb	w5, [x4, -1]
.L55:
	add	x6, x0, 1
	add	x5, x26, x0
	add	x0, x0, x21
	mul	w3, w3, w3
	sub	w4, w2, #17
	add	w1, w1, 1
	and	w4, w4, 255
	strb	w2, [x5, -1]
	strb	w3, [x0, -1]
	mov	w2, w4
	mov	x0, x6
	mov	w3, w1
	cmp	w1, 6
	bgt	.L51
.L97:
	add	x4, sp, x0
	mvn	w5, w2
	strb	w5, [x4, 207]
	b	.L52
	.p2align 2,,3
.L53:
	cmp	w1, 11
	ble	.L54
	cmp	w1, 15
	bne	.L55
	mov	w0, -31
	adrp	x24, .LC5
	add	x24, x24, :lo12:.LC5
	adrp	x1, .LC8
	adrp	x19, .LC6
	add	x1, x1, :lo12:.LC8
	add	x19, x19, :lo12:.LC6
	strb	w0, [sp, 319]
	mov	x0, x24
	bl	printf
	mov	w1, 129
	mov	x0, x19
	adrp	x23, .LC7
	bl	printf
	add	x23, x23, :lo12:.LC7
	mov	w1, 129
	mov	x0, x23
	str	x23, [sp, 168]
	bl	printf
	ldrb	w22, [sp, 164]
	mov	x0, x24
	adrp	x1, .LC9
	add	w25, w22, 9
	add	x1, x1, :lo12:.LC9
	bl	printf
	and	w25, w25, 255
	mov	w1, 251
	mov	x0, x19
	bl	printf
	mov	w1, w25
	mov	x0, x19
	bl	printf
	mov	w0, 7781
	add	w1, w25, w0
	mov	x0, x23
	add	x23, sp, 184
	bl	printf
	add	x25, sp, 272
	ldrh	w1, [sp, 184]
	add	x4, sp, 275
	ldrb	w0, [x23, 2]
	mov	w2, 0
	strh	w1, [sp, 272]
	mov	x1, x25
	strb	w0, [x25, 2]
.L56:
	ldrb	w3, [x1]
	ubfiz	w0, w3, 3, 5
	sub	w0, w0, w3
	add	w3, w2, 3
	add	w0, w0, w3
	strb	w0, [x1], 1
	add	w2, w22, w2
	cmp	x1, x4
	bne	.L56
	add	x28, sp, 288
	ldrh	w1, [sp, 272]
	ldrb	w0, [x25, 2]
	strh	w1, [sp, 288]
	strb	w0, [x28, 2]
	strb	w0, [x23, 2]
	mov	x0, x24
	strh	w1, [sp, 184]
	adrp	x1, .LC10
	add	x1, x1, :lo12:.LC10
	bl	printf
	mov	x3, x23
	mov	w2, 0
	.p2align 5,,15
.L58:
	ldrb	w1, [x3]
	mov	x0, x19
	str	x3, [sp, 152]
	str	w2, [sp, 160]
	bl	printf
	ldr	x3, [sp, 152]
	ldr	w2, [sp, 160]
	lsl	w0, w2, 5
	sub	w2, w0, w2
	ldrb	w0, [x3], 1
	add	w2, w0, w2
	add	x0, sp, 187
	cmp	x3, x0
	bne	.L58
	ldr	x0, [sp, 168]
	mov	w1, w2
	bl	printf
	ldrb	w0, [sp, 204]
	ldr	w1, [sp, 200]
	add	x3, sp, 200
	add	x5, sp, 277
	str	w1, [sp, 272]
	mov	x1, x25
	mov	w2, 0
	strb	w0, [x25, 4]
.L59:
	ldrb	w4, [x1]
	ubfiz	w0, w4, 3, 5
	sub	w0, w0, w4
	add	w4, w2, 5
	add	w0, w0, w4
	strb	w0, [x1], 1
	add	w2, w22, w2
	cmp	x5, x1
	bne	.L59
	ldr	w1, [sp, 272]
	ldrb	w0, [x25, 4]
	str	w1, [sp, 288]
	strb	w0, [x28, 4]
	strb	w0, [x3, 4]
	mov	x0, x24
	str	w1, [sp, 200]
	adrp	x1, .LC11
	add	x1, x1, :lo12:.LC11
	bl	printf
	add	x3, sp, 200
	mov	w2, 0
	.p2align 5,,15
.L60:
	ldrb	w1, [x3]
	mov	x0, x19
	str	x3, [sp, 152]
	str	w2, [sp, 160]
	bl	printf
	ldr	x3, [sp, 152]
	ldr	w2, [sp, 160]
	lsl	w0, w2, 5
	sub	w2, w0, w2
	ldrb	w0, [x3], 1
	add	w2, w0, w2
	add	x0, sp, 205
	cmp	x0, x3
	bne	.L60
	ldr	x0, [sp, 168]
	mov	w1, w2
	bl	printf
	ldr	w1, [sp, 208]
	add	x4, sp, 279
	ldr	w0, [sp, 211]
	mov	w3, 0
	str	w1, [sp, 272]
	mov	x1, x25
	str	w0, [x25, 3]
	.p2align 5,,15
.L61:
	ldrb	w0, [x1]
	add	w0, w0, 1
	add	w2, w3, w0, lsl 3
	add	w3, w22, w3
	sub	w0, w2, w0
	strb	w0, [x1], 1
	cmp	x1, x4
	bne	.L61
	ldr	w1, [sp, 272]
	ldr	w0, [x25, 3]
	str	w1, [sp, 288]
	str	w0, [x28, 3]
	ldr	w1, [sp, 288]
	str	w1, [sp, 208]
	adrp	x1, .LC12
	add	x1, x1, :lo12:.LC12
	str	w0, [sp, 211]
	mov	x0, x24
	bl	printf
	add	x3, sp, 208
	mov	w2, 0
	.p2align 5,,15
.L62:
	ldrb	w1, [x3]
	mov	x0, x19
	str	x3, [sp, 152]
	str	w2, [sp, 160]
	bl	printf
	ldr	x3, [sp, 152]
	ldr	w2, [sp, 160]
	lsl	w0, w2, 5
	sub	w2, w0, w2
	ldrb	w0, [x3], 1
	add	w2, w0, w2
	add	x0, sp, 215
	cmp	x0, x3
	bne	.L62
	ldr	x0, [sp, 168]
	mov	w1, w2
	bl	printf
	ldr	d31, [sp, 224]
	adrp	x0, .LANCHOR0
	dup	v3.8b, w22
	movi	v1.8b, 0x9
	ldr	d15, [x0, :lo12:.LANCHOR0]
	ubfiz	w2, w22, 3, 5
	shl	v2.8b, v31.8b, 3
	ldrb	w1, [x20, 8]
	str	w2, [sp, 160]
	mul	v15.8b, v3.8b, v15.8b
	ubfiz	w0, w1, 3, 5
	sub	v2.8b, v2.8b, v31.8b
	sub	w0, w0, w1
	add	w0, w0, 9
	adrp	x1, .LC13
	add	w0, w2, w0
	add	x1, x1, :lo12:.LC13
	strb	w0, [x20, 8]
	add	v1.8b, v2.8b, v1.8b
	strb	w0, [sp, 280]
	add	v1.8b, v1.8b, v15.8b
	str	d1, [sp, 288]
	strb	w0, [x28, 8]
	mov	x0, x24
	str	d1, [sp, 224]
	str	d1, [sp, 272]
	bl	printf
	mov	x2, x20
	mov	w20, 0
	.p2align 5,,15
.L63:
	ldrb	w1, [x2]
	mov	x0, x19
	str	x2, [sp, 152]
	bl	printf
	ldr	x2, [sp, 152]
	lsl	w0, w20, 5
	sub	w3, w0, w20
	ldrb	w0, [x2], 1
	add	w20, w0, w3
	add	x0, sp, 233
	cmp	x2, x0
	bne	.L63
	ldr	x0, [sp, 168]
	mov	w1, w20
	bl	printf
	ldr	d0, [sp, 240]
	movi	v29.8b, 0xc
	ldr	w2, [sp, 160]
	mov	x1, x25
	ldr	w0, [x27, 8]
	add	x4, sp, 276
	shl	v30.8b, v0.8b, 3
	str	w0, [x25, 8]
	sub	v30.8b, v30.8b, v0.8b
	add	v29.8b, v30.8b, v29.8b
	add	v29.8b, v29.8b, v15.8b
	str	d29, [sp, 272]
	.p2align 5,,15
.L64:
	ldrb	w3, [x1, 8]
	add	x1, x1, 1
	ubfiz	w0, w3, 3, 5
	sub	w0, w0, w3
	add	w3, w2, 12
	add	w0, w0, w3
	strb	w0, [x1, 7]
	add	w2, w2, w22
	cmp	x1, x4
	bne	.L64
	ldr	x1, [sp, 272]
	str	x1, [sp, 288]
	ldr	w0, [x25, 8]
	mov	w20, 0
	str	w0, [x28, 8]
	str	w0, [x27, 8]
	mov	x0, x24
	str	x1, [sp, 240]
	adrp	x1, .LC14
	add	x1, x1, :lo12:.LC14
	bl	printf
	mov	x3, x27
	.p2align 5,,15
.L65:
	ldrb	w1, [x3]
	mov	x0, x19
	str	x3, [sp, 152]
	bl	printf
	ldr	x3, [sp, 152]
	lsl	w0, w20, 5
	sub	w2, w0, w20
	ldrb	w0, [x3], 1
	add	w20, w0, w2
	add	x0, sp, 252
	cmp	x0, x3
	bne	.L65
	ldr	x0, [sp, 168]
	mov	w1, w20
	bl	printf
	ldr	x1, [sp, 256]
	add	x4, sp, 287
	ldr	x0, [x26, 7]
	str	x1, [sp, 272]
	mov	x1, x25
	mov	w2, 0
	str	x0, [x25, 7]
	.p2align 5,,15
.L66:
	ldrb	w3, [x1]
	ubfiz	w0, w3, 3, 5
	sub	w0, w0, w3
	add	w3, w2, 15
	add	w0, w0, w3
	strb	w0, [x1], 1
	add	w2, w22, w2
	cmp	x1, x4
	bne	.L66
	ldr	x1, [sp, 272]
	str	x1, [sp, 288]
	ldr	x0, [x25, 7]
	str	x0, [x28, 7]
	mov	w20, 0
	ldr	x1, [sp, 288]
	str	x1, [sp, 256]
	adrp	x1, .LC15
	add	x1, x1, :lo12:.LC15
	str	x0, [x26, 7]
	mov	x0, x24
	bl	printf
	mov	x3, x26
	.p2align 5,,15
.L67:
	ldrb	w1, [x3]
	mov	x0, x19
	str	x3, [sp, 152]
	bl	printf
	ldr	x3, [sp, 152]
	lsl	w0, w20, 5
	sub	w2, w0, w20
	ldrb	w0, [x3], 1
	add	w20, w0, w2
	add	x0, sp, 271
	cmp	x0, x3
	bne	.L67
	ldr	x0, [sp, 168]
	mov	w1, w20
	mov	w20, 0
	bl	printf
	ldr	q6, [sp, 304]
	adrp	x0, .LANCHOR0
	movi	v26.16b, 0x10
	add	x0, x0, :lo12:.LANCHOR0
	dup	v5.16b, w22
	adrp	x1, .LC16
	add	x1, x1, :lo12:.LC16
	ldr	q28, [x0, 16]
	shl	v27.16b, v6.16b, 3
	ldr	w0, [sp, 164]
	add	w0, w0, 1
	sub	v27.16b, v27.16b, v6.16b
	dup	v4.16b, w0
	mov	x0, x24
	add	v27.16b, v27.16b, v26.16b
	mla	v26.16b, v4.16b, v28.16b
	mla	v27.16b, v5.16b, v28.16b
	shl	v25.16b, v27.16b, 3
	sub	v25.16b, v25.16b, v27.16b
	add	v25.16b, v26.16b, v25.16b
	str	q25, [sp, 304]
	bl	printf
	.p2align 5,,15
.L68:
	ldrb	w1, [x21]
	mov	x0, x19
	bl	printf
	lsl	w0, w20, 5
	sub	w20, w0, w20
	ldrb	w0, [x21], 1
	add	w20, w0, w20
	add	x0, sp, 320
	cmp	x0, x21
	bne	.L68
	ldr	x0, [sp, 168]
	mov	w1, w20
	bl	printf
	ldr	d16, [sp, 240]
	movi	v22.8b, 0xc
	ldrb	w0, [x23, 2]
	mov	x2, x28
	add	x6, sp, 292
	shl	v7.8b, v16.8b, 3
	ubfiz	w1, w0, 3, 5
	sub	w1, w1, w0
	ldr	w0, [x27, 8]
	str	w0, [x28, 8]
	add	w1, w1, 13
	ldr	w0, [sp, 164]
	sub	v7.8b, v7.8b, v16.8b
	and	w1, w1, 255
	neg	w5, w0
	adrp	x0, .LANCHOR0
	add	v22.8b, v7.8b, v22.8b
	dup	v24.8b, w5
	ldr	d23, [x0, :lo12:.LANCHOR0]
	ldr	w0, [sp, 160]
	mla	v22.8b, v24.8b, v23.8b
	neg	w3, w0
	str	d22, [sp, 288]
	.p2align 5,,15
.L69:
	ldrb	w4, [x2, 8]
	add	x2, x2, 1
	ubfiz	w0, w4, 3, 5
	sub	w0, w0, w4
	add	w4, w3, 12
	add	w0, w0, w4
	strb	w0, [x2, 7]
	add	w3, w3, w5, uxtb
	cmp	x6, x2
	bne	.L69
	ldrb	w2, [sp, 299]
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	ldrh	w1, [sp, 184]
	ldrb	w2, [x23, 2]
	ubfiz	w0, w1, 3, 13
	ubfx	x3, x1, 8, 8
	sub	w0, w0, w1
	add	w0, w0, 3
	strb	w0, [sp, 288]
	ubfiz	w0, w3, 3, 5
	sub	w0, w0, w3
	mov	x3, x28
	add	w0, w0, 4
	strb	w0, [sp, 289]
	ubfiz	w0, w2, 3, 5
	sub	w0, w0, w2
	ldrh	w1, [sp, 288]
	add	w0, w0, 5
	strh	w1, [sp, 192]
	ldr	w1, [sp, 208]
	strb	w0, [sp, 194]
	ldr	w0, [sp, 211]
	str	w1, [sp, 288]
	str	w0, [x28, 3]
	mov	w0, 0
	.p2align 5,,15
.L70:
	ldrb	w1, [x3]
	add	w1, w1, 1
	add	w2, w0, w1, lsl 3
	add	w0, w0, 2
	sub	w1, w2, w1
	and	w0, w0, 255
	strb	w1, [x3], 1
	cmp	w0, 14
	bne	.L70
	ldr	w1, [sp, 288]
	add	x4, sp, 303
	ldr	w0, [x28, 3]
	mov	w2, 0
	str	w1, [sp, 216]
	ldr	x1, [sp, 256]
	str	w0, [sp, 219]
	ldr	x0, [x26, 7]
	str	x1, [sp, 288]
	mov	x1, x28
	str	x0, [x28, 7]
	.p2align 5,,15
.L71:
	ldrb	w3, [x1]
	ubfiz	w0, w3, 3, 5
	sub	w0, w0, w3
	add	w3, w2, 15
	add	w0, w0, w3
	strb	w0, [x1], 1
	add	w2, w2, 3
	cmp	x1, x4
	bne	.L71
	ldr	x0, [sp, 288]
	str	x0, [sp, 272]
	ldr	w2, [sp, 164]
	mov	w0, -1000
	ldr	x1, [x28, 7]
	str	x1, [x25, 7]
	ldp	x5, x6, [sp, 304]
	mul	w0, w2, w0
	str	w0, [sp, 16]
	adrp	x22, .LC19
	ldr	x0, [sp, 272]
	str	x0, [sp]
	str	x1, [sp, 7]
	add	x22, x22, :lo12:.LC19
	ldp	x0, x1, [sp, 192]
	mov	w23, 3
	ldr	x2, [sp, 216]
	mov	w21, -100
	ldr	x3, [sp, 224]
	mov	w20, 1000
	ldrb	w4, [sp, 232]
	mov	w19, 20
	bl	spill
	mov	x2, x0
	mov	x1, x0
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	printf
.L72:
	add	w19, w19, w19, lsr 31
	neg	w21, w21
	sub	w20, w20, w20, lsl 2
	mov	x0, x22
	asr	w19, w19, 1
	sxtb	w21, w21
	sub	w19, w19, #50
	sxth	w20, w20
	mov	w2, w20
	mov	w1, w21
	sxtb	w19, w19
	mov	w3, w19
	bl	printf
	subs	w23, w23, #1
	bne	.L72
	mov	w20, 34464
	adrp	x23, .LC20
	add	x23, x23, :lo12:.LC20
	mov	w21, 4
	movk	w20, 0x1, lsl 16
	mov	w19, -7
.L73:
	ldr	w0, [sp, 164]
	mov	w22, w20
	mov	w2, w20
	mov	w1, w19
	sub	w0, w0, w19
	sub	w20, w0, w20
	mov	x0, x23
	mov	w3, w20
	bl	printf
	str	w19, [sp, 164]
	subs	w21, w21, #1
	mov	w19, w22
	bne	.L73
	adrp	x21, .LC21
	add	x21, x21, :lo12:.LC21
	mov	w19, 98
	mov	x20, 1000
.L74:
	mvn	x20, x20, lsl 1
	mov	w1, w19
	mov	x2, x20
	mov	x0, x21
	add	w19, w19, 1
	bl	printf
	cmp	w19, 101
	bne	.L74
	mov	w4, 16
	mov	w3, 12
	mov	w2, 6
	mov	w1, 15
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	printf
	ldr	d15, [sp, 128]
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	ldp	x23, x24, [sp, 80]
	ldp	x25, x26, [sp, 96]
	ldp	x27, x28, [sp, 112]
	add	sp, sp, 320
	ret
	.global	knob
	.section .rodata
	.align	4
	.LANCHOR0:
.LC3:
	.byte	0
	.byte	1
	.byte	2
	.byte	3
	.byte	4
	.byte	5
	.byte	6
	.byte	7
	.zero	8
.LC4:
	.byte	0
	.byte	1
	.byte	2
	.byte	3
	.byte	4
	.byte	5
	.byte	6
	.byte	7
	.byte	8
	.byte	9
	.byte	10
	.byte	11
	.byte	12
	.byte	13
	.byte	14
	.byte	15
	.data
	.align	2
	.LANCHOR1:
knob:
	.word	3

