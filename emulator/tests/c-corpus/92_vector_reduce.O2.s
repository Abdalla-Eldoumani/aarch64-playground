	.text
	.align	2
	.p2align 5,,15
fill:
	stp	x29, x30, [sp, -32]!
	adrp	x0, .LANCHOR0
	adrp	x3, .LANCHOR1
	mov	x29, sp
	add	x3, x3, :lo12:.LANCHOR1
	ldr	w0, [x0, :lo12:.LANCHOR0]
	mov	w18, 1883
	str	x19, [sp, 16]
	adrp	x19, .LANCHOR2
	add	x19, x19, :lo12:.LANCHOR2
	mov	w17, 3395
	mov	w16, 31071
	mov	w14, 31153
	add	x30, x3, 1024
	add	x6, x3, 2048
	add	x15, x3, 3072
	sub	x5, x19, #256
	add	x13, x19, 256
	add	x12, x19, 1024
	add	x11, x19, 768
	add	x4, x19, 1280
	add	x10, x19, 1536
	mov	x2, 0
	mov	w7, -67108864
	movk	w18, 0xa7c5, lsl 16
	movk	w17, 0x3, lsl 16
	movk	w16, 0xfffe, lsl 16
	movk	w14, 0x9e37, lsl 16
	mov	w9, 3
	mov	x8, -4294967296
	.p2align 5,,15
.L2:
	eor	w0, w0, w0, lsl 13
	eor	w0, w0, w0, lsr 17
	eor	w0, w0, w0, lsl 5
	str	w0, [x6, x2, lsl 2]
	add	w1, w7, w0, lsr 5
	str	w1, [x3, x2, lsl 2]
	umull	x1, w0, w18
	lsr	x1, x1, 49
	msub	w1, w1, w17, w0
	add	w1, w1, w16
	str	w1, [x30, x2, lsl 2]
	mul	w1, w0, w14
	str	w1, [x15, x2, lsl 2]
	ubfx	x1, x0, 16, 11
	sub	w1, w1, #1024
	strh	w1, [x5, x2, lsl 1]
	and	w1, w0, 2047
	sub	w1, w1, #1024
	strh	w1, [x13, x2, lsl 1]
	lsr	w1, w0, 8
	strb	w1, [x2, x11]
	lsr	w1, w0, 20
	strb	w1, [x2, x12]
	lsr	w1, w0, 24
	strb	w1, [x2, x4]
	umaddl	x1, w0, w9, x8
	str	x1, [x10, x2, lsl 3]
	add	x2, x2, 1
	cmp	x2, 256
	bne	.L2
	mov	w0, 67108863
	str	w0, [x3, 20]
	mov	w0, -1
	str	w0, [x6, 28]
	strb	w0, [x19, 768]
	mov	w0, 32640
	strh	w0, [x4, 1]
	mov	w1, -1024
	strb	wzr, [x19, 1024]
	strh	w1, [x5, 6]
	ldr	x19, [sp, 16]
	str	w7, [x3, 1020]
	ldp	x29, x30, [sp], 32
	ret
	.align	2
	.p2align 5,,15
sum_i32:
	movi	v31.4s, 0
	adrp	x0, .LANCHOR1
	add	x0, x0, :lo12:.LANCHOR1
	add	x1, x0, 1024
	.p2align 5,,15
.L7:
	ldr	q30, [x0], 16
	saddw	v31.2d, v31.2d, v30.2s
	saddw2	v31.2d, v31.2d, v30.4s
	cmp	x1, x0
	bne	.L7
	addp	d31, v31.2d
	fmov	x0, d31
	ret
	.align	2
	.p2align 5,,15
sum_u32:
	movi	v31.4s, 0
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	add	x0, x1, 2048
	add	x1, x1, 3072
	.p2align 5,,15
.L10:
	ldr	q30, [x0], 16
	add	v31.4s, v31.4s, v30.4s
	cmp	x1, x0
	bne	.L10
	addv	s31, v31.4s
	fmov	w0, s31
	ret
	.align	2
	.p2align 5,,15
sum_i16:
	movi	v31.4s, 0
	adrp	x1, .LANCHOR2
	add	x1, x1, :lo12:.LANCHOR2
	sub	x0, x1, #256
	add	x1, x1, 256
	.p2align 5,,15
.L13:
	ldr	q30, [x0], 16
	saddw	v31.4s, v31.4s, v30.4h
	saddw2	v31.4s, v31.4s, v30.8h
	cmp	x1, x0
	bne	.L13
	addv	s31, v31.4s
	fmov	w0, s31
	ret
	.align	2
	.p2align 5,,15
sum_u8:
	movi	v31.4s, 0
	adrp	x1, .LANCHOR2
	add	x1, x1, :lo12:.LANCHOR2
	add	x0, x1, 768
	add	x1, x1, 1024
	mov	v30.16b, v31.16b
	.p2align 5,,15
.L16:
	ldr	q0, [x0], 16
	zip1	v28.16b, v0.16b, v31.16b
	zip2	v0.16b, v0.16b, v31.16b
	zip2	v29.8h, v28.8h, v31.8h
	zip2	v27.8h, v0.8h, v31.8h
	uaddw	v29.4s, v29.4s, v28.4h
	uaddw	v27.4s, v27.4s, v0.4h
	add	v29.4s, v27.4s, v29.4s
	add	v30.4s, v30.4s, v29.4s
	cmp	x1, x0
	bne	.L16
	addv	s31, v30.4s
	fmov	w0, s31
	ret
	.align	2
	.p2align 5,,15
sum_s8:
	movi	v31.4s, 0
	adrp	x1, .LANCHOR2
	add	x1, x1, :lo12:.LANCHOR2
	add	x0, x1, 1280
	add	x1, x1, 1536
	.p2align 5,,15
.L19:
	ldr	q30, [x0], 16
	sxtl	v29.8h, v30.8b
	sxtl2	v30.8h, v30.16b
	saddw	v31.4s, v31.4s, v29.4h
	saddw2	v31.4s, v31.4s, v29.8h
	saddw	v31.4s, v31.4s, v30.4h
	saddw2	v31.4s, v31.4s, v30.8h
	cmp	x1, x0
	bne	.L19
	addv	s31, v31.4s
	fmov	w0, s31
	ret
	.align	2
	.p2align 5,,15
sum_i64:
	adrp	x3, .LANCHOR2
	add	x3, x3, :lo12:.LANCHOR2
	add	x1, x3, 1536
	add	x3, x3, 3584
	mov	x0, 0
	.p2align 5,,15
.L22:
	ldr	x2, [x1], 8
	add	x0, x0, x2
	cmp	x1, x3
	bne	.L22
	ret
	.align	2
	.p2align 5,,15
dot_i16:
	adrp	x1, .LANCHOR2
	add	x1, x1, :lo12:.LANCHOR2
	movi	v31.4s, 0
	sub	x2, x1, #256
	add	x1, x1, 256
	mov	x0, 0
	.p2align 5,,15
.L25:
	ldr	q30, [x0, x2]
	ldr	q29, [x0, x1]
	add	x0, x0, 16
	smlal	v31.4s, v29.4h, v30.4h
	smlal2	v31.4s, v29.8h, v30.8h
	cmp	x0, 512
	bne	.L25
	addv	s31, v31.4s
	fmov	w0, s31
	ret
	.align	2
	.p2align 5,,15
dot_i32:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	movi	v31.4s, 0
	add	x2, x1, 1024
	mov	x0, 0
	.p2align 5,,15
.L28:
	ldr	q30, [x1, x0]
	ldr	q29, [x0, x2]
	add	x0, x0, 16
	smlal	v31.2d, v29.2s, v30.2s
	smlal2	v31.2d, v29.4s, v30.4s
	cmp	x0, 1024
	bne	.L28
	addp	d31, v31.2d
	fmov	x0, d31
	ret
	.align	2
	.p2align 5,,15
dot_u32:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	movi	v31.4s, 0
	add	x2, x1, 2048
	add	x1, x1, 3072
	mov	x0, 0
	.p2align 5,,15
.L31:
	ldr	q30, [x0, x2]
	ldr	q29, [x0, x1]
	add	x0, x0, 16
	mla	v31.4s, v30.4s, v29.4s
	cmp	x0, 1024
	bne	.L31
	addv	s31, v31.4s
	fmov	w0, s31
	ret
	.align	2
	.p2align 5,,15
dot_u8:
	adrp	x1, .LANCHOR2
	add	x1, x1, :lo12:.LANCHOR2
	movi	v31.4s, 0
	add	x2, x1, 1024
	add	x1, x1, 768
	mov	x0, 0
	.p2align 5,,15
.L34:
	ldr	q30, [x0, x1]
	ldr	q29, [x0, x2]
	add	x0, x0, 16
	umull	v28.8h, v30.8b, v29.8b
	umull2	v29.8h, v30.16b, v29.16b
	uaddw	v31.4s, v31.4s, v28.4h
	uaddw2	v31.4s, v31.4s, v28.8h
	uaddw	v31.4s, v31.4s, v29.4h
	uaddw2	v31.4s, v31.4s, v29.8h
	cmp	x0, 256
	bne	.L34
	addv	s31, v31.4s
	fmov	w0, s31
	ret
	.align	2
	.p2align 5,,15
dot_s8u8:
	movi	v31.4s, 0
	adrp	x1, .LANCHOR2
	add	x1, x1, :lo12:.LANCHOR2
	mov	x0, 0
	add	x2, x1, 1024
	add	x1, x1, 1280
	mov	v30.16b, v31.16b
	.p2align 5,,15
.L37:
	ldr	q29, [x0, x1]
	ldr	q28, [x0, x2]
	add	x0, x0, 16
	sxtl	v27.8h, v29.8b
	sxtl2	v29.8h, v29.16b
	zip1	v26.16b, v28.16b, v31.16b
	zip2	v28.16b, v28.16b, v31.16b
	mul	v26.8h, v27.8h, v26.8h
	mul	v28.8h, v29.8h, v28.8h
	saddw	v30.4s, v30.4s, v26.4h
	saddw2	v30.4s, v30.4s, v26.8h
	saddw	v30.4s, v30.4s, v28.4h
	saddw2	v30.4s, v30.4s, v28.8h
	cmp	x0, 256
	bne	.L37
	addv	s31, v30.4s
	fmov	w0, s31
	ret
	.align	2
	.p2align 5,,15
sq_i16:
	movi	v31.4s, 0
	adrp	x1, .LANCHOR2
	add	x1, x1, :lo12:.LANCHOR2
	sub	x0, x1, #256
	add	x1, x1, 256
	.p2align 5,,15
.L40:
	ldr	q30, [x0], 16
	smull	v29.4s, v30.4h, v30.4h
	smull2	v30.4s, v30.8h, v30.8h
	saddw	v31.2d, v31.2d, v29.2s
	saddw2	v31.2d, v31.2d, v29.4s
	saddw	v31.2d, v31.2d, v30.2s
	saddw2	v31.2d, v31.2d, v30.4s
	cmp	x1, x0
	bne	.L40
	addp	d31, v31.2d
	fmov	x0, d31
	ret
	.align	2
	.p2align 5,,15
max_i32:
	movi	v31.4s, 0x80, lsl 24
	adrp	x0, .LANCHOR1
	add	x0, x0, :lo12:.LANCHOR1
	add	x1, x0, 1024
	.p2align 5,,15
.L43:
	ldr	q30, [x0], 16
	smax	v31.4s, v31.4s, v30.4s
	cmp	x1, x0
	bne	.L43
	smaxv	s31, v31.4s
	fmov	w0, s31
	ret
	.align	2
	.p2align 5,,15
min_i32:
	mvni	v31.4s, 0x80, lsl 24
	adrp	x0, .LANCHOR1
	add	x0, x0, :lo12:.LANCHOR1
	add	x1, x0, 1024
	.p2align 5,,15
.L46:
	ldr	q30, [x0], 16
	smin	v31.4s, v31.4s, v30.4s
	cmp	x1, x0
	bne	.L46
	sminv	s31, v31.4s
	fmov	w0, s31
	ret
	.align	2
	.p2align 5,,15
max_u32:
	movi	v31.4s, 0
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	add	x0, x1, 3072
	add	x1, x1, 4096
	.p2align 5,,15
.L49:
	ldr	q30, [x0], 16
	umax	v31.4s, v31.4s, v30.4s
	cmp	x1, x0
	bne	.L49
	umaxv	s31, v31.4s
	fmov	w0, s31
	ret
	.align	2
	.p2align 5,,15
min_u8:
	adrp	x3, .LANCHOR2
	add	x3, x3, :lo12:.LANCHOR2
	add	x1, x3, 1025
	add	x3, x3, 1280
	mov	w0, 255
	.p2align 5,,15
.L52:
	ldrb	w2, [x1], 1
	cmp	w2, w0
	csel	w0, w2, w0, ls
	and	w0, w0, 255
	cmp	x1, x3
	bne	.L52
	ret
	.align	2
	.p2align 5,,15
max_s8:
	movi	v31.16b, 0xffffffffffffff80
	adrp	x1, .LANCHOR2
	add	x1, x1, :lo12:.LANCHOR2
	add	x0, x1, 1280
	add	x1, x1, 1536
	.p2align 5,,15
.L55:
	ldr	q30, [x0], 16
	smax	v31.16b, v31.16b, v30.16b
	cmp	x1, x0
	bne	.L55
	smaxv	b31, v31.16b
	smov	w0, v31.b[0]
	ret
	.align	2
	.p2align 5,,15
min_i16:
	mvni	v31.8h, 0x80, lsl 8
	adrp	x1, .LANCHOR2
	add	x1, x1, :lo12:.LANCHOR2
	add	x0, x1, 256
	add	x1, x1, 768
	.p2align 5,,15
.L58:
	ldr	q30, [x0], 16
	smin	v31.8h, v31.8h, v30.8h
	cmp	x1, x0
	bne	.L58
	sminv	h31, v31.8h
	umov	w0, v31.h[0]
	ret
	.align	2
	.p2align 5,,15
sad_u8:
	adrp	x1, .LANCHOR2
	add	x1, x1, :lo12:.LANCHOR2
	movi	v31.4s, 0
	add	x2, x1, 1024
	add	x1, x1, 768
	mov	x0, 0
	.p2align 5,,15
.L61:
	ldr	q30, [x0, x1]
	ldr	q29, [x0, x2]
	add	x0, x0, 16
	uabdl2	v28.8h, v30.16b, v29.16b
	uabal	v28.8h, v30.8b, v29.8b
	uadalp	v31.4s, v28.8h
	cmp	x0, 256
	bne	.L61
	addv	s31, v31.4s
	fmov	w0, s31
	ret
	.align	2
	.p2align 5,,15
count_pos:
	movi	v31.4s, 0
	adrp	x0, .LANCHOR1
	add	x0, x0, :lo12:.LANCHOR1
	add	x1, x0, 1024
	.p2align 5,,15
.L64:
	ldr	q30, [x0], 16
	cmgt	v30.4s, v30.4s, #0
	sub	v31.4s, v31.4s, v30.4s
	cmp	x1, x0
	bne	.L64
	addv	s31, v31.4s
	fmov	w0, s31
	ret
	.align	2
	.p2align 5,,15
xor_u32:
	adrp	x3, .LANCHOR1
	add	x3, x3, :lo12:.LANCHOR1
	add	x1, x3, 2048
	add	x3, x3, 3072
	mov	w0, 0
	.p2align 5,,15
.L67:
	ldr	w2, [x1], 4
	eor	w0, w0, w2
	cmp	x1, x3
	bne	.L67
	ret
	.align	2
	.p2align 5,,15
or_u8:
	movi	v31.4s, 0
	adrp	x1, .LANCHOR2
	movi	v2.16b, 0xffffffffffffff81
	add	x1, x1, :lo12:.LANCHOR2
	add	x0, x1, 768
	add	x1, x1, 1024
	.p2align 5,,15
.L70:
	ldr	q1, [x0], 16
	and	v1.16b, v1.16b, v2.16b
	orr	v31.16b, v31.16b, v1.16b
	cmp	x1, x0
	bne	.L70
	movi	v28.4s, 0
	ext	v0.16b, v31.16b, v28.16b, #8
	orr	v0.16b, v0.16b, v31.16b
	ext	v29.16b, v0.16b, v28.16b, #4
	orr	v29.16b, v29.16b, v0.16b
	ext	v30.16b, v29.16b, v28.16b, #2
	orr	v30.16b, v30.16b, v29.16b
	ext	v28.16b, v30.16b, v28.16b, #1
	orr	v28.16b, v28.16b, v30.16b
	umov	w0, v28.b[0]
	ret
	.align	2
	.p2align 5,,15
wsum_u32:
	movi	v31.4s, 0
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	add	x0, x1, 2048
	add	x1, x1, 3072
	.p2align 5,,15
.L73:
	ldr	q30, [x0], 16
	uaddw	v31.2d, v31.2d, v30.2s
	uaddw2	v31.2d, v31.2d, v30.4s
	cmp	x1, x0
	bne	.L73
	addp	d31, v31.2d
	fmov	x0, d31
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"sum i32 %ld u32 %u i16 %d u8 %u s8 %d i64 %ld wide u32 %ld\n"
	.align	3
.LC1:
	.string	"dot i16 %d i32 %ld u32 %u u8 %u s8u8 %d sq16 %ld\n"
	.align	3
.LC2:
	.string	"max i32 %d min i32 %d max u32 %u min u8 %d max s8 %d min i16 %d\n"
	.align	3
.LC3:
	.string	"sad %u positive %d xor %08x or %02x\n"
	.align	3
.LC4:
	.string	"lane check %016lx\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -16]!
	mov	x29, sp
	bl	fill
	bl	sum_i32
	mov	x8, x0
	bl	sum_u32
	mov	w9, w0
	bl	sum_i16
	mov	w10, w0
	bl	sum_u8
	mov	w4, w0
	bl	sum_s8
	mov	w5, w0
	bl	sum_i64
	mov	x6, x0
	bl	wsum_u32
	mov	w2, w9
	mov	x1, x8
	mov	w3, w10
	mov	x7, x0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	bl	dot_i16
	mov	w7, w0
	bl	dot_i32
	mov	x8, x0
	bl	dot_u32
	mov	w3, w0
	bl	dot_u8
	mov	w4, w0
	bl	dot_s8u8
	mov	w5, w0
	bl	sq_i16
	mov	x2, x8
	mov	w1, w7
	mov	x6, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	bl	max_i32
	mov	w7, w0
	bl	min_i32
	mov	w8, w0
	bl	max_u32
	mov	w9, w0
	bl	min_u8
	mov	w4, w0
	bl	max_s8
	mov	w5, w0
	bl	min_i16
	mov	w2, w8
	mov	w1, w7
	mov	w3, w9
	sxth	w6, w0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	bl	sad_u8
	mov	w5, w0
	bl	count_pos
	mov	w6, w0
	bl	xor_u32
	mov	w3, w0
	bl	or_u8
	mov	w2, w6
	mov	w4, w0
	mov	w1, w5
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	adrp	x7, .LANCHOR2
	add	x7, x7, :lo12:.LANCHOR2
	adrp	x8, .LANCHOR1
	mov	x9, 16963
	add	x8, x8, :lo12:.LANCHOR1
	add	x7, x7, 768
	mov	w6, 1000
	mov	x3, 0
	mov	x4, 0
	mov	w10, 90
	movk	x9, 0xf, lsl 16
	.p2align 5,,15
.L76:
	ldr	w0, [x8, x3, lsl 2]
	add	w0, w0, w6
	str	w0, [x8, x3, lsl 2]
	ldrb	w0, [x3, x7]
	add	w6, w6, 1000
	eor	w0, w0, w10
	strb	w0, [x3, x7]
	add	x3, x3, 1
	bl	sum_i32
	mov	x5, x0
	bl	sum_u8
	add	x5, x5, w0, uxtw
	bl	dot_i16
	uxtw	x0, w0
	madd	x4, x4, x9, x0
	add	x4, x5, x4
	cmp	x3, 16
	bne	.L76
	mov	x1, x4
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 16
	ret
	.data
	.align	2
	.LANCHOR0:
seed:
	.word	-1831433054
	.bss
	.align	4
	.LANCHOR1:
	.LANCHOR2 = . + 4352
a32:
	.zero	1024
b32:
	.zero	1024
u32a:
	.zero	1024
u32b:
	.zero	1024
a16:
	.zero	512
b16:
	.zero	512
u8a:
	.zero	256
u8b:
	.zero	256
s8a:
	.zero	256
a64:
	.zero	2048

