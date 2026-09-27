	.text
	.align	2
	.align 5
to_upper:
	adrp	x1, .LANCHOR0
	add	x1, x1, :lo12:.LANCHOR0
	movi	v31.16b, 0xffffffffffffff9f
	add	x2, x1, 512
	movi	v30.16b, 0x19
	mov	x0, 0
	movi	v29.16b, 0xffffffffffffffe0
	.align 5
.L2:
	ldr	q28, [x1, x0]
	add	v27.16b, v28.16b, v31.16b
	add	v26.16b, v28.16b, v29.16b
	cmhs	v27.16b, v30.16b, v27.16b
	bif	v26.16b, v28.16b, v27.16b
	str	q26, [x0, x2]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L2
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%-9s %08x %02x %02x %02x %02x %02x\n"
	.text
	.align	2
	.align 5
report:
	adrp	x8, .LANCHOR0
	add	x8, x8, :lo12:.LANCHOR0
	mov	w2, 40389
	mov	w5, 403
	add	x3, x8, 512
	add	x6, x8, 1024
	movk	w2, 0x811c, lsl 16
	movk	w5, 0x100, lsl 16
	.align 5
.L6:
	ldrb	w4, [x3], 1
	eor	w2, w4, w2
	mul	w2, w2, w5
	cmp	x6, x3
	bne	.L6
	ldrb	w7, [x8, 1023]
	mov	x1, x0
	ldrb	w6, [x8, 515]
	adrp	x0, .LC0
	ldrb	w5, [x8, 514]
	add	x0, x0, :lo12:.LC0
	ldrb	w4, [x8, 513]
	ldrb	w3, [x8, 512]
	b	printf
	.section .rodata
	.align	3
.LC1:
	.string	"xor"
	.align	3
.LC2:
	.string	"upper"
	.align	3
.LC3:
	.string	"rot13"
	.align	3
.LC4:
	.string	"sat_add"
	.align	3
.LC5:
	.string	"sat_sub"
	.align	3
.LC6:
	.string	"avg"
	.align	3
.LC7:
	.string	"absdiff"
	.align	3
.LC8:
	.string	"max"
	.align	3
.LC9:
	.string	"rotl3"
	.align	3
.LC10:
	.string	"abs_s8"
	.align	3
.LC11:
	.string	"narrow"
	.align	3
.LC12:
	.string	"pairsum"
	.align	3
.LC13:
	.string	"interleave %08x %02x %02x %02x\n"
	.align	3
.LC14:
	.string	"wide %04x %04x %04x\n"
	.align	3
.LC15:
	.string	"spaces %d\n"
	.align	3
.LC16:
	.string	"bswap %08x %08x %08x\n"
	.align	3
.LC17:
	.string	"again"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -48]!
	mov	x8, 58255
	adrp	x0, .LANCHOR1
	mov	x29, sp
	movk	x8, 0x8e38, lsl 16
	stp	x19, x20, [sp, 16]
	adrp	x19, .LANCHOR0
	add	x19, x19, :lo12:.LANCHOR0
	mov	w6, 26125
	mov	w5, 62303
	adrp	x7, .LANCHOR2
	movk	x8, 0x38e3, lsl 32
	add	x7, x7, :lo12:.LANCHOR2
	add	x4, x19, 1024
	add	x3, x19, 1536
	ldr	w1, [x0, :lo12:.LANCHOR1]
	movk	w6, 0x19, lsl 16
	mov	x0, 0
	movk	w5, 0x3c6e, lsl 16
	movk	x8, 0xe38e, lsl 48
	stp	x21, x22, [sp, 32]
	.align 5
.L12:
	madd	w1, w1, w6, w5
	tbz	x0, 5, .L9
	lsr	w2, w1, 24
	strb	w2, [x19, x0]
	lsr	w2, w1, 16
	strb	w2, [x0, x4]
	lsr	w2, w1, 8
	strb	w2, [x0, x3]
	add	x0, x0, 1
	cmp	x0, 512
	bne	.L12
	mov	w0, 255
	strh	w0, [x19, 1]
	movi	v29.16b, 0x5a
	mov	w0, -1
	add	x1, x19, 512
	strh	w0, [x4, 1]
	mov	w0, -128
	strb	w0, [x3, 3]
	mov	x0, 0
	.align 5
.L13:
	ldr	q31, [x19, x0]
	eor	v31.16b, v31.16b, v29.16b
	str	q31, [x0, x1]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L13
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	report
	bl	to_upper
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	report
	movi	v23.16b, 0xffffffffffffff9f
	add	x1, x19, 512
	movi	v24.16b, 0x19
	mov	x0, 0
	movi	v25.16b, 0x6d
	movi	v26.16b, 0xfffffffffffffff3
	movi	v27.16b, 0xd
	.align 5
.L14:
	ldr	q29, [x19, x0]
	cmhi	v28.16b, v29.16b, v25.16b
	add	v31.16b, v29.16b, v23.16b
	bsl	v28.16b, v26.16b, v27.16b
	cmhs	v31.16b, v24.16b, v31.16b
	add	v28.16b, v28.16b, v29.16b
	bsl	v31.16b, v28.16b, v29.16b
	str	q31, [x0, x1]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L14
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	report
	movi	v27.8h, 0xff
	add	x2, x19, 1024
	add	x1, x19, 512
	mov	x0, 0
	.align 5
.L15:
	ldr	q31, [x19, x0]
	ldr	q28, [x0, x2]
	uaddl	v29.8h, v31.8b, v28.8b
	uaddl2	v31.8h, v31.16b, v28.16b
	umin	v29.8h, v29.8h, v27.8h
	umin	v31.8h, v31.8h, v27.8h
	uzp1	v31.16b, v29.16b, v31.16b
	str	q31, [x0, x1]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L15
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	report
	movi	v27.4s, 0
	add	x2, x19, 1024
	add	x1, x19, 512
	mov	x0, 0
	.align 5
.L16:
	ldr	q31, [x19, x0]
	ldr	q28, [x0, x2]
	usubl	v29.8h, v31.8b, v28.8b
	usubl2	v31.8h, v31.16b, v28.16b
	smax	v29.8h, v29.8h, v27.8h
	smax	v31.8h, v31.8h, v27.8h
	uzp1	v31.16b, v29.16b, v31.16b
	str	q31, [x0, x1]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L16
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	report
	add	x2, x19, 1024
	add	x1, x19, 512
	mov	x0, 0
	.align 5
.L17:
	ldr	q31, [x19, x0]
	ldr	q29, [x0, x2]
	urhadd	v31.16b, v31.16b, v29.16b
	str	q31, [x0, x1]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L17
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	report
	add	x2, x19, 1024
	add	x1, x19, 512
	mov	x0, 0
	.align 5
.L18:
	ldr	q28, [x19, x0]
	ldr	q31, [x0, x2]
	cmhi	v29.16b, v28.16b, v31.16b
	sub	v27.16b, v28.16b, v31.16b
	sub	v31.16b, v31.16b, v28.16b
	bit	v31.16b, v27.16b, v29.16b
	str	q31, [x0, x1]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L18
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	report
	add	x2, x19, 1024
	add	x1, x19, 512
	mov	x0, 0
	.align 5
.L19:
	ldr	q31, [x0, x2]
	ldr	q29, [x19, x0]
	umax	v31.16b, v31.16b, v29.16b
	str	q31, [x0, x1]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L19
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	report
	add	x1, x19, 512
	mov	x0, 0
	.align 5
.L20:
	ldr	q29, [x19, x0]
	shl	v31.16b, v29.16b, 3
	usra	v31.16b, v29.16b, 5
	str	q31, [x0, x1]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L20
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	report
	add	x2, x19, 1536
	add	x1, x19, 512
	mov	x0, 0
	.align 5
.L21:
	ldr	q31, [x0, x2]
	cmlt	v29.16b, v31.16b, #0
	neg	v28.16b, v31.16b
	bit	v31.16b, v28.16b, v29.16b
	str	q31, [x0, x1]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L21
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	report
	adrp	x4, .LC18
	add	x0, x19, 2048
	movi	v30.4s, 0
	mov	x2, x0
	ldr	q27, [x4, :lo12:.LC18]
	add	x3, x19, 1024
	mov	x1, 0
	.align 5
.L22:
	ldr	q29, [x19, x1]
	ldr	q31, [x1, x3]
	add	x1, x1, 16
	zip1	v26.16b, v29.16b, v30.16b
	zip2	v29.16b, v29.16b, v30.16b
	zip1	v28.16b, v31.16b, v30.16b
	zip2	v31.16b, v31.16b, v30.16b
	mla	v28.8h, v26.8h, v27.8h
	mla	v31.8h, v29.8h, v27.8h
	stp	q28, q31, [x2], 32
	cmp	x1, 512
	bne	.L22
	add	x21, x19, 512
	add	x2, x19, 3072
	mov	x1, x21
	.align 5
.L23:
	ldp	q31, q29, [x0], 32
	uzp2	v31.16b, v31.16b, v29.16b
	str	q31, [x1], 16
	cmp	x2, x0
	bne	.L23
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	report
	mov	x22, x19
	add	x20, x19, 512
	mov	x0, x19
	.align 5
.L24:
	ld2	{v28.16b - v29.16b}, [x0], 32
	add	v28.16b, v28.16b, v29.16b
	str	q28, [x21], 16
	cmp	x0, x20
	bne	.L24
	movi	v31.4s, 0
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	stp	q31, q31, [x19, 768]
	stp	q31, q31, [x19, 800]
	stp	q31, q31, [x19, 832]
	stp	q31, q31, [x19, 864]
	stp	q31, q31, [x19, 896]
	stp	q31, q31, [x19, 928]
	stp	q31, q31, [x19, 960]
	stp	q31, q31, [x19, 992]
	bl	report
	add	x3, x19, 3072
	mov	x1, x3
	add	x2, x19, 1024
	mov	x0, 0
	.align 5
.L25:
	ldr	q28, [x19, x0]
	ldr	q29, [x2, x0]
	add	x0, x0, 16
	st2	{v28.16b - v29.16b}, [x1], 32
	cmp	x0, 512
	bne	.L25
	mov	w1, 40389
	mov	w2, 403
	add	x4, x3, 1024
	movk	w1, 0x811c, lsl 16
	movk	w2, 0x100, lsl 16
	.align 5
.L26:
	ldrb	w0, [x3], 1
	eor	w1, w0, w1
	mul	w1, w1, w2
	cmp	x3, x4
	bne	.L26
	ldrb	w4, [x19, 4095]
	adrp	x0, .LC13
	ldrb	w3, [x19, 3073]
	add	x0, x0, :lo12:.LC13
	ldrb	w2, [x19, 3072]
	bl	printf
	ldrh	w3, [x19, 3070]
	adrp	x0, .LC14
	ldrh	w2, [x19, 2050]
	add	x0, x0, :lo12:.LC14
	ldrh	w1, [x19, 2048]
	bl	printf
	movi	v29.4s, 0
	mov	x0, x19
	movi	v26.16b, 0x20
	movi	v27.16b, 0x1
	mov	v30.16b, v29.16b
	.align 5
.L27:
	ldr	q31, [x0], 16
	cmeq	v31.16b, v31.16b, v26.16b
	and	v31.16b, v31.16b, v27.16b
	zip1	v28.16b, v31.16b, v30.16b
	zip2	v31.16b, v31.16b, v30.16b
	uaddw	v29.4s, v29.4s, v28.4h
	uaddw2	v29.4s, v29.4s, v28.8h
	uaddw	v29.4s, v29.4s, v31.4h
	uaddw2	v29.4s, v29.4s, v31.8h
	cmp	x20, x0
	bne	.L27
	addv	s31, v29.4s
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	fmov	w1, s31
	bl	printf
	movi	v30.4s, 0
	adrp	x4, .LANCHOR3
	add	x4, x4, :lo12:.LANCHOR3
	sub	x0, x4, #256
	mov	x1, x0
	.align 5
.L28:
	ld4	{v20.16b - v23.16b}, [x22], 64
	add	x1, x1, 64
	zip1	v28.16b, v20.16b, v30.16b
	zip1	v25.16b, v23.16b, v30.16b
	shll	v26.8h, v21.8b, 8
	zip1	v27.16b, v22.16b, v30.16b
	zip2	v31.16b, v20.16b, v30.16b
	shll2	v29.8h, v21.16b, 8
	orr	v26.16b, v26.16b, v28.16b
	zip2	v28.16b, v23.16b, v30.16b
	zip1	v23.8h, v25.8h, v30.8h
	zip2	v25.8h, v25.8h, v30.8h
	shll	v24.4s, v27.4h, 16
	shll2	v27.4s, v27.8h, 16
	shl	v23.4s, v23.4s, 24
	shl	v25.4s, v25.4s, 24
	orr	v29.16b, v29.16b, v31.16b
	zip2	v31.16b, v22.16b, v30.16b
	orr	v24.16b, v24.16b, v23.16b
	orr	v27.16b, v27.16b, v25.16b
	zip1	v23.8h, v26.8h, v30.8h
	zip2	v26.8h, v26.8h, v30.8h
	orr	v24.16b, v24.16b, v23.16b
	orr	v27.16b, v27.16b, v26.16b
	zip1	v26.8h, v28.8h, v30.8h
	zip2	v28.8h, v28.8h, v30.8h
	stp	q24, q27, [x1, -64]
	shl	v26.4s, v26.4s, 24
	shll	v27.4s, v31.4h, 16
	shl	v28.4s, v28.4s, 24
	shll2	v31.4s, v31.8h, 16
	orr	v27.16b, v27.16b, v26.16b
	zip1	v26.8h, v29.8h, v30.8h
	orr	v31.16b, v31.16b, v28.16b
	zip2	v29.8h, v29.8h, v30.8h
	orr	v27.16b, v27.16b, v26.16b
	orr	v31.16b, v31.16b, v29.16b
	stp	q27, q31, [x1, -32]
	cmp	x20, x22
	bne	.L28
	add	x3, x0, 512
	mov	x1, x0
	.align 5
.L29:
	ldr	q31, [x1]
	rev32	v31.16b, v31.16b
	str	q31, [x1], 16
	cmp	x3, x1
	bne	.L29
	mov	w1, 0
	.align 5
.L30:
	lsl	w2, w1, 5
	sub	w1, w2, w1
	ldr	w2, [x0], 4
	add	w1, w1, w2
	cmp	x3, x0
	bne	.L30
	ldr	w2, [x4, -256]
	adrp	x0, .LC16
	ldr	w3, [x4, 252]
	add	x0, x0, :lo12:.LC16
	bl	printf
	mov	x2, 512
	add	x1, x19, x2
	mov	x0, x19
	bl	memcpy
	bl	to_upper
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	report
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 48
	ret
	.align 2
.L9:
	umulh	x2, x0, x8
	lsr	x2, x2, 6
	add	x2, x2, x2, lsl 3
	sub	x2, x0, x2, lsl 3
	ldrb	w2, [x7, x2]
	strb	w2, [x19, x0]
	lsr	w2, w1, 16
	strb	w2, [x0, x4]
	lsr	w2, w1, 8
	strb	w2, [x0, x3]
	add	x0, x0, 1
	b	.L12
	.section .rodata
	.align	4
	.LANCHOR2:
text:
	.string	"Hello, World! the quick brown fox jumps over the lazy dog 0123456789 ~{}"
	.zero	7
.LC18:
	.hword	300
	.hword	300
	.hword	300
	.hword	300
	.hword	300
	.hword	300
	.hword	300
	.hword	300
	.data
	.align	2
	.LANCHOR1:
seed:
	.word	88172645
	.bss
	.align	4
	.LANCHOR0:
	.LANCHOR3 = . + 4352
src:
	.zero	512
dst:
	.zero	512
src2:
	.zero	512
sgn:
	.zero	512
w16:
	.zero	1024
pair:
	.zero	1024
w32:
	.zero	512

