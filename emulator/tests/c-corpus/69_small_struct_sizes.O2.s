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
	mov	w1, 240
	mov	w7, 127
	mov	w6, -91
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	stp	x19, x20, [sp, 48]
	mov	w19, 0
	ldr	w20, [x0, :lo12:.LANCHOR1]
	mov	w0, -128
	strb	w0, [sp, 136]
	mov	w0, 511
	strh	w0, [sp, 144]
	mov	w0, 513
	strh	w0, [sp, 152]
	mov	w0, 3
	strb	w0, [sp, 154]
	mov	w0, 57840
	stp	x21, x22, [sp, 64]
	movk	w0, 0xc3d2, lsl 16
	stp	x23, x24, [sp, 80]
	add	x22, sp, 272
	add	x24, sp, 208
	str	x25, [sp, 96]
	add	x23, sp, 224
	str	w0, [sp, 176]
	mov	w0, -76
	strb	w0, [sp, 180]
	add	x21, sp, 304
	add	x25, sp, 192
	mov	w2, w19
	mov	x0, 1
	cmp	w19, 6
	ble	.L67
.L51:
	cmp	w19, 8
	bgt	.L53
.L52:
	add	x3, x24, x0
	eor	w4, w1, w6
	strb	w4, [x3, -1]
.L54:
	add	x3, x23, x0
	sub	w4, w7, w1
	strb	w4, [x3, -1]
.L55:
	add	x5, x0, 1
	add	x4, x22, x0
	add	x0, x21, x0
	mul	w2, w2, w2
	sub	w3, w1, #17
	add	w19, w19, 1
	and	w3, w3, 255
	strb	w1, [x4, -1]
	strb	w2, [x0, -1]
	mov	w1, w3
	mov	x0, x5
	mov	w2, w19
	cmp	w19, 6
	bgt	.L51
.L67:
	add	x3, x25, x0
	mvn	w4, w1
	strb	w4, [x3, -1]
	b	.L52
	.p2align 2,,3
.L53:
	cmp	w19, 11
	ble	.L54
	cmp	w19, 15
	bne	.L55
	mov	w0, -31
	strb	w0, [sp, 319]
	ldrb	w0, [sp, 136]
	mov	w1, w20
	mov	w2, 1
	bl	mix1
	strb	w0, [sp, 136]
	add	x1, sp, 136
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	show
	ldrh	w0, [sp, 144]
	mov	w1, w20
	bl	mix2
	strh	w0, [sp, 144]
	mov	w2, 2
	add	x1, sp, 144
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	show
	ldr	x0, [sp, 152]
	mov	w1, w20
	bl	mix3
	sxtw	x0, w0
	strb	w0, [sp, 152]
	mov	w2, 3
	ubfx	x1, x0, 8, 8
	ubfx	x0, x0, 16, 8
	strb	w1, [sp, 153]
	add	x1, sp, 152
	strb	w0, [sp, 154]
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	show
	ldr	x0, [sp, 176]
	mov	w1, w20
	bl	mix5
	ubfx	x1, x0, 8, 8
	strb	w1, [sp, 177]
	ubfx	x1, x0, 16, 8
	strb	w0, [sp, 176]
	mov	w2, 5
	strb	w1, [sp, 178]
	lsr	w1, w0, 24
	ubfx	x0, x0, 32, 8
	strb	w1, [sp, 179]
	add	x1, sp, 176
	strb	w0, [sp, 180]
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	show
	ldr	x0, [sp, 192]
	mov	w1, w20
	bl	mix7
	ubfx	x1, x0, 8, 8
	strb	w1, [sp, 193]
	ubfx	x1, x0, 16, 8
	strb	w1, [sp, 194]
	lsr	w1, w0, 24
	strb	w1, [sp, 195]
	ubfx	x1, x0, 32, 8
	strb	w0, [sp, 192]
	mov	w2, 7
	strb	w1, [sp, 196]
	ubfx	x1, x0, 40, 8
	ubfx	x0, x0, 48, 8
	strb	w1, [sp, 197]
	mov	x1, x25
	strb	w0, [sp, 198]
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	show
	ldr	x0, [sp, 208]
	mov	w2, w20
	ldrb	w1, [sp, 216]
	bl	mix9
	ubfx	x2, x0, 8, 8
	strb	w2, [sp, 209]
	ubfx	x2, x0, 16, 8
	strb	w2, [sp, 210]
	lsr	w2, w0, 24
	strb	w2, [sp, 211]
	ubfx	x2, x0, 32, 8
	strb	w2, [sp, 212]
	ubfx	x2, x0, 40, 8
	strb	w0, [sp, 208]
	strb	w2, [sp, 213]
	ubfx	x2, x0, 48, 8
	lsr	x0, x0, 56
	strb	w2, [sp, 214]
	mov	w2, 9
	strb	w0, [sp, 215]
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	strb	w1, [sp, 216]
	mov	x1, x24
	bl	show
	ldr	x0, [sp, 224]
	mov	w2, w20
	ldr	w1, [sp, 232]
	bl	mix12
	ubfx	x2, x0, 8, 8
	strb	w2, [sp, 225]
	ubfx	x2, x0, 16, 8
	strb	w2, [sp, 226]
	lsr	w2, w0, 24
	strb	w2, [sp, 227]
	ubfx	x2, x0, 32, 8
	strb	w2, [sp, 228]
	ubfx	x2, x0, 40, 8
	strb	w0, [sp, 224]
	strb	w2, [sp, 229]
	ubfx	x2, x0, 48, 8
	lsr	x0, x0, 56
	strb	w0, [sp, 231]
	ubfx	x0, x1, 8, 8
	strb	w1, [sp, 232]
	strb	w0, [sp, 233]
	ubfx	x0, x1, 16, 8
	lsr	w1, w1, 24
	strb	w2, [sp, 230]
	mov	w2, 12
	strb	w0, [sp, 234]
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	strb	w1, [sp, 235]
	mov	x1, x23
	bl	show
	mov	w23, 3
	ldp	x0, x1, [sp, 272]
	mov	w2, w20
	and	x1, x1, 72057594037927935
	bl	mix15
	ubfx	x2, x0, 8, 8
	strb	w2, [sp, 273]
	ubfx	x2, x0, 16, 8
	strb	w2, [sp, 274]
	lsr	w2, w0, 24
	strb	w2, [sp, 275]
	ubfx	x2, x0, 32, 8
	strb	w2, [sp, 276]
	ubfx	x2, x0, 40, 8
	strb	w0, [sp, 272]
	strb	w2, [sp, 277]
	ubfx	x2, x0, 48, 8
	lsr	x0, x0, 56
	strb	w0, [sp, 279]
	ubfx	x0, x1, 8, 8
	strb	w0, [sp, 281]
	ubfx	x0, x1, 16, 8
	strb	w0, [sp, 282]
	lsr	w0, w1, 24
	strb	w0, [sp, 283]
	ubfx	x0, x1, 32, 8
	strb	w1, [sp, 280]
	strb	w0, [sp, 284]
	ubfx	x0, x1, 40, 8
	ubfx	x1, x1, 48, 8
	strb	w2, [sp, 278]
	mov	w2, w19
	strb	w0, [sp, 285]
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	strb	w1, [sp, 286]
	mov	x1, x22
	bl	show
	mov	w22, 1000
	ldp	x0, x1, [sp, 304]
	mov	w2, w20
	mov	w19, -100
	bl	mix16
	add	w2, w20, 1
	bl	mix16
	mov	w2, 16
	stp	x0, x1, [sp, 304]
	mov	x1, x21
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	show
	ldr	x0, [sp, 152]
	mov	w1, 5
	mov	w21, 20
	bl	mix3
	ubfx	x6, x0, 16, 8
	ldr	x0, [sp, 224]
	neg	w2, w20
	ldr	w1, [sp, 232]
	bl	mix12
	lsr	w2, w1, 24
	adrp	x0, .LC17
	mov	w1, w6
	add	x0, x0, :lo12:.LC17
	bl	printf
	ldr	x0, [sp, 152]
	mov	w1, 1
	bl	mix3
	sxtw	x0, w0
	strb	w0, [sp, 168]
	ubfx	x1, x0, 8, 8
	ubfx	x0, x0, 16, 8
	strb	w0, [sp, 170]
	ldr	x0, [sp, 192]
	strb	w1, [sp, 169]
	mov	w1, 2
	bl	mix7
	ubfx	x1, x0, 8, 8
	strb	w1, [sp, 201]
	ubfx	x1, x0, 16, 8
	strb	w1, [sp, 202]
	lsr	w1, w0, 24
	strb	w1, [sp, 203]
	ubfx	x1, x0, 32, 8
	strb	w0, [sp, 200]
	mov	w2, 3
	strb	w1, [sp, 204]
	ubfx	x1, x0, 40, 8
	ubfx	x0, x0, 48, 8
	strb	w1, [sp, 205]
	strb	w0, [sp, 206]
	ldp	x0, x1, [sp, 272]
	and	x1, x1, 72057594037927935
	bl	mix15
	ubfx	x2, x0, 8, 8
	strb	w2, [sp, 289]
	ubfx	x2, x0, 16, 8
	strb	w2, [sp, 290]
	lsr	w2, w0, 24
	strb	w2, [sp, 291]
	ubfx	x2, x0, 32, 8
	strb	w2, [sp, 292]
	ubfx	x2, x0, 40, 8
	strb	w0, [sp, 288]
	strb	w2, [sp, 293]
	ubfx	x2, x0, 48, 8
	lsr	x0, x0, 56
	strb	w0, [sp, 295]
	ubfx	x0, x1, 8, 8
	strb	w0, [sp, 297]
	ubfx	x0, x1, 16, 8
	strb	w0, [sp, 298]
	lsr	w0, w1, 24
	strb	w0, [sp, 299]
	ubfx	x0, x1, 32, 8
	strb	w0, [sp, 300]
	ubfx	x0, x1, 40, 8
	strb	w0, [sp, 301]
	mov	w0, -1000
	strb	w2, [sp, 294]
	strb	w1, [sp, 296]
	ubfx	x1, x1, 48, 8
	mul	w0, w20, w0
	strb	w1, [sp, 302]
	str	w0, [sp, 16]
	ldr	x0, [sp, 288]
	str	x0, [sp]
	add	x0, sp, 295
	ldrb	w4, [sp, 216]
	ldp	x5, x6, [sp, 304]
	ldp	x2, x3, [sp, 200]
	ldr	x0, [x0]
	str	x0, [sp, 7]
	ldr	x1, [sp, 176]
	ldr	x0, [sp, 168]
	bl	spill
	mov	x1, x0
	mov	x2, x0
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	printf
	adrp	x0, .LANCHOR0
	add	x0, x0, :lo12:.LANCHOR0
	ldr	w1, [x0, 32]
	ldrh	w0, [x0, 36]
	str	w1, [sp, 184]
	strh	w0, [sp, 188]
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	str	x0, [sp, 120]
.L56:
	strb	w19, [sp, 184]
	strh	w22, [sp, 186]
	strb	w21, [sp, 188]
	ldr	x0, [sp, 184]
	bl	neg6
	ubfx	x21, x0, 32, 16
	lsr	w22, w0, 16
	sxtb	w19, w0
	strh	w0, [sp, 184]
	mov	w1, w19
	ldr	x0, [sp, 120]
	sxth	w22, w22
	strh	w21, [sp, 188]
	sxtb	w21, w21
	mov	w3, w21
	mov	w2, w22
	bl	printf
	subs	w23, w23, #1
	bne	.L56
	mov	w22, 34464
	adrp	x23, .LC20
	add	x23, x23, :lo12:.LC20
	mov	w19, 4
	movk	w22, 0x1, lsl 16
	mov	w21, -7
.L58:
	stp	w20, w21, [sp, 240]
	uxtw	x1, w22
	ldr	x0, [sp, 240]
	bl	rot12
	lsr	x2, x0, 32
	mov	x3, x1
	mov	w20, w0
	mov	w21, w2
	mov	w22, w1
	mov	w1, w0
	mov	x0, x23
	bl	printf
	subs	w19, w19, #1
	bne	.L58
	adrp	x23, .LC21
	add	x23, x23, :lo12:.LC21
	mov	x19, 0
	mov	w22, 3
	mov	x20, 1000
	mov	w21, 97
.L59:
	bfi	x19, x21, 0, 8
	mov	x1, x20
	mov	x0, x19
	bl	next16
	and	w21, w0, 255
	mov	x2, x1
	mov	x19, x0
	mov	x20, x1
	mov	x0, x23
	mov	w1, w21
	bl	printf
	subs	w22, w22, #1
	bne	.L59
	mov	w4, 16
	mov	w3, 12
	mov	w2, 6
	mov	w1, 15
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	printf
	ldr	x25, [sp, 96]
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	ldp	x23, x24, [sp, 80]
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
.LC2:
	.byte	-100
	.zero	1
	.hword	1000
	.byte	20
	.zero	1
	.data
	.align	2
	.LANCHOR1:
knob:
	.word	3

