	.text
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
	stp	x29, x30, [sp, -96]!
	adrp	x0, .LANCHOR0
	mov	w17, 1883
	mov	x29, sp
	ldr	w0, [x0, :lo12:.LANCHOR0]
	movi	v27.4s, 0
	stp	x19, x20, [sp, 16]
	adrp	x20, .LANCHOR1
	add	x20, x20, :lo12:.LANCHOR1
	stp	x21, x22, [sp, 32]
	adrp	x21, .LANCHOR2
	add	x21, x21, :lo12:.LANCHOR2
	mov	w16, 3395
	mov	w15, 31071
	mov	w13, 31153
	add	x19, x20, 1024
	add	x5, x20, 2048
	add	x14, x20, 3072
	sub	x4, x21, #256
	add	x12, x21, 256
	add	x11, x21, 1024
	add	x10, x21, 768
	add	x3, x21, 1280
	add	x9, x21, 1536
	mov	x2, 0
	mov	w6, -67108864
	movk	w17, 0xa7c5, lsl 16
	movk	w16, 0x3, lsl 16
	movk	w15, 0xfffe, lsl 16
	movk	w13, 0x9e37, lsl 16
	mov	w8, 3
	mov	x7, -4294967296
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	.p2align 5,,15
.L2:
	eor	w0, w0, w0, lsl 13
	eor	w0, w0, w0, lsr 17
	eor	w0, w0, w0, lsl 5
	str	w0, [x5, x2, lsl 2]
	add	w1, w6, w0, lsr 5
	str	w1, [x20, x2, lsl 2]
	umull	x1, w0, w17
	lsr	x1, x1, 49
	msub	w1, w1, w16, w0
	add	w1, w1, w15
	str	w1, [x19, x2, lsl 2]
	mul	w1, w0, w13
	str	w1, [x14, x2, lsl 2]
	ubfx	x1, x0, 16, 11
	sub	w1, w1, #1024
	strh	w1, [x4, x2, lsl 1]
	and	w1, w0, 2047
	sub	w1, w1, #1024
	strh	w1, [x12, x2, lsl 1]
	lsr	w1, w0, 8
	strb	w1, [x2, x10]
	lsr	w1, w0, 20
	strb	w1, [x2, x11]
	lsr	w1, w0, 24
	strb	w1, [x2, x3]
	umaddl	x1, w0, w8, x7
	str	x1, [x9, x2, lsl 3]
	add	x2, x2, 1
	cmp	x2, 256
	bne	.L2
	mov	w0, 67108863
	str	w0, [x20, 20]
	mov	w0, -1
	str	w0, [x5, 28]
	movi	v31.4s, 0
	strb	w0, [x21, 768]
	mov	w0, 32640
	strh	w0, [x3, 1]
	mov	x0, x20
	mov	w1, -1024
	strh	w1, [x4, 6]
	str	w6, [x20, 1020]
	strb	wzr, [x21, 1024]
	.p2align 5,,15
.L3:
	ldr	q30, [x0], 16
	saddw	v31.2d, v31.2d, v30.2s
	saddw2	v31.2d, v31.2d, v30.4s
	cmp	x0, x19
	bne	.L3
	add	x23, x20, 2048
	add	x24, x20, 3072
	addp	d31, v31.2d
	mov	x0, x23
	movi	v30.4s, 0
	.p2align 5,,15
.L4:
	ldr	q29, [x0], 16
	add	v30.4s, v30.4s, v29.4s
	cmp	x24, x0
	bne	.L4
	addv	s28, v30.4s
	sub	x27, x21, #256
	movi	v30.4s, 0
	add	x28, x21, 256
	mov	x0, x27
	.p2align 5,,15
.L5:
	ldr	q29, [x0], 16
	saddw	v30.4s, v30.4s, v29.4h
	saddw2	v30.4s, v30.4s, v29.8h
	cmp	x0, x28
	bne	.L5
	addv	s26, v30.4s
	add	x22, x21, 1024
	movi	v24.4s, 0
	add	x0, x21, 768
.L6:
	ldr	q29, [x0], 16
	zip1	v25.16b, v29.16b, v27.16b
	zip2	v29.16b, v29.16b, v27.16b
	zip2	v30.8h, v29.8h, v27.8h
	uaddw	v30.4s, v30.4s, v29.4h
	zip2	v29.8h, v25.8h, v27.8h
	uaddw	v29.4s, v29.4s, v25.4h
	add	v30.4s, v30.4s, v29.4s
	add	v24.4s, v24.4s, v30.4s
	cmp	x22, x0
	bne	.L6
	add	x25, x21, 1280
	add	x26, x21, 1536
	addv	s24, v24.4s
	mov	x0, x25
	movi	v30.4s, 0
.L7:
	ldr	q29, [x0], 16
	sxtl	v25.8h, v29.8b
	sxtl2	v29.8h, v29.16b
	saddw	v30.4s, v30.4s, v25.4h
	saddw2	v30.4s, v30.4s, v25.8h
	saddw	v30.4s, v30.4s, v29.4h
	saddw2	v30.4s, v30.4s, v29.8h
	cmp	x0, x26
	bne	.L7
	addv	s25, v30.4s
	add	x0, x21, 1536
	add	x2, x21, 3584
	mov	x6, 0
	.p2align 5,,15
.L8:
	ldr	x1, [x0], 8
	add	x6, x6, x1
	cmp	x2, x0
	bne	.L8
	movi	v30.4s, 0
	mov	x0, x23
	.p2align 5,,15
.L9:
	ldr	q29, [x0], 16
	uaddw	v30.2d, v30.2d, v29.2s
	uaddw2	v30.2d, v30.2d, v29.4s
	cmp	x24, x0
	bne	.L9
	addp	d30, v30.2d
	adrp	x0, .LC0
	fmov	x1, d31
	fmov	w2, s28
	fmov	w5, s25
	fmov	w4, s24
	fmov	w3, s26
	add	x0, x0, :lo12:.LC0
	fmov	x7, d30
	bl	printf
	movi	v31.4s, 0
	sub	x2, x21, #256
	add	x1, x21, 256
	mov	x0, 0
	mov	v27.16b, v31.16b
	.p2align 5,,15
.L10:
	ldr	q29, [x0, x2]
	ldr	q30, [x0, x1]
	add	x0, x0, 16
	smlal	v31.4s, v29.4h, v30.4h
	smlal2	v31.4s, v29.8h, v30.8h
	cmp	x0, 512
	bne	.L10
	addv	s24, v31.4s
	add	x1, x20, 1024
	movi	v31.4s, 0
	mov	x0, 0
	.p2align 5,,15
.L11:
	ldr	q29, [x20, x0]
	ldr	q30, [x0, x1]
	add	x0, x0, 16
	smlal	v31.2d, v29.2s, v30.2s
	smlal2	v31.2d, v29.4s, v30.4s
	cmp	x0, 1024
	bne	.L11
	addp	d31, v31.2d
	add	x2, x20, 2048
	movi	v30.4s, 0
	add	x1, x20, 3072
	mov	x0, 0
	.p2align 5,,15
.L12:
	ldr	q28, [x0, x2]
	ldr	q29, [x0, x1]
	add	x0, x0, 16
	mla	v30.4s, v28.4s, v29.4s
	cmp	x0, 1024
	bne	.L12
	addv	s25, v30.4s
	add	x2, x21, 1024
	movi	v30.4s, 0
	add	x1, x21, 768
	mov	x0, 0
.L13:
	ldr	q29, [x0, x1]
	ldr	q28, [x0, x2]
	add	x0, x0, 16
	umull	v26.8h, v29.8b, v28.8b
	umull2	v29.8h, v29.16b, v28.16b
	uaddw	v30.4s, v30.4s, v26.4h
	uaddw2	v30.4s, v30.4s, v26.8h
	uaddw	v30.4s, v30.4s, v29.4h
	uaddw2	v30.4s, v30.4s, v29.8h
	cmp	x0, 256
	bne	.L13
	addv	s26, v30.4s
	add	x2, x21, 1024
	movi	v30.4s, 0
	add	x1, x21, 1280
	mov	x0, 0
.L14:
	ldr	q29, [x0, x1]
	ldr	q28, [x0, x2]
	add	x0, x0, 16
	sxtl	v23.8h, v29.8b
	sxtl2	v29.8h, v29.16b
	zip1	v22.16b, v28.16b, v27.16b
	zip2	v28.16b, v28.16b, v27.16b
	mul	v23.8h, v23.8h, v22.8h
	mul	v29.8h, v29.8h, v28.8h
	saddw	v30.4s, v30.4s, v23.4h
	saddw2	v30.4s, v30.4s, v23.8h
	saddw	v30.4s, v30.4s, v29.4h
	saddw2	v30.4s, v30.4s, v29.8h
	cmp	x0, 256
	bne	.L14
	addv	s28, v30.4s
	movi	v30.4s, 0
	.p2align 5,,15
.L15:
	ldr	q29, [x27], 16
	smull	v23.4s, v29.4h, v29.4h
	smull2	v29.4s, v29.8h, v29.8h
	saddw	v30.2d, v30.2d, v23.2s
	saddw2	v30.2d, v30.2d, v23.4s
	saddw	v30.2d, v30.2d, v29.2s
	saddw2	v30.2d, v30.2d, v29.4s
	cmp	x28, x27
	bne	.L15
	addp	d30, v30.2d
	adrp	x0, .LC1
	fmov	x2, d31
	fmov	w5, s28
	fmov	w4, s26
	fmov	w3, s25
	fmov	w1, s24
	add	x0, x0, :lo12:.LC1
	fmov	x6, d30
	bl	printf
	movi	v31.4s, 0x80, lsl 24
	mov	x0, x20
	.p2align 5,,15
.L16:
	ldr	q30, [x0], 16
	smax	v31.4s, v31.4s, v30.4s
	cmp	x0, x19
	bne	.L16
	smaxv	s31, v31.4s
	mov	x0, x20
	fmov	w1, s31
	mvni	v31.4s, 0x80, lsl 24
	.p2align 5,,15
.L17:
	ldr	q30, [x0], 16
	smin	v31.4s, v31.4s, v30.4s
	cmp	x0, x19
	bne	.L17
	sminv	s31, v31.4s
	add	x0, x20, 3072
	add	x3, x20, 4096
	fmov	w2, s31
	movi	v31.4s, 0
	.p2align 5,,15
.L18:
	ldr	q30, [x0], 16
	umax	v31.4s, v31.4s, v30.4s
	cmp	x3, x0
	bne	.L18
	umaxv	s31, v31.4s
	add	x0, x21, 1025
	add	x6, x21, 1280
	mov	w4, 255
	fmov	w3, s31
	.p2align 5,,15
.L19:
	ldrb	w5, [x0], 1
	cmp	w5, w4
	csel	w4, w5, w4, ls
	and	w4, w4, 255
	cmp	x6, x0
	bne	.L19
	movi	v31.16b, 0xffffffffffffff80
.L20:
	ldr	q30, [x25], 16
	smax	v31.16b, v31.16b, v30.16b
	cmp	x25, x26
	bne	.L20
	smaxv	b31, v31.16b
	add	x0, x21, 256
	add	x6, x21, 768
	smov	w5, v31.b[0]
	mvni	v31.8h, 0x80, lsl 8
	.p2align 5,,15
.L21:
	ldr	q30, [x0], 16
	smin	v31.8h, v31.8h, v30.8h
	cmp	x6, x0
	bne	.L21
	sminv	h31, v31.8h
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	smov	w6, v31.h[0]
	bl	printf
	movi	v28.4s, 0
	add	x2, x21, 1024
	add	x1, x21, 768
	mov	x0, 0
.L22:
	ldr	q29, [x0, x1]
	ldr	q30, [x0, x2]
	add	x0, x0, 16
	uabdl2	v31.8h, v29.16b, v30.16b
	uabal	v31.8h, v29.8b, v30.8b
	uadalp	v28.4s, v31.8h
	cmp	x0, 256
	bne	.L22
	addv	s28, v28.4s
	mov	x0, x20
	movi	v30.4s, 0
	.p2align 5,,15
.L23:
	ldr	q31, [x0], 16
	cmgt	v31.4s, v31.4s, #0
	sub	v30.4s, v30.4s, v31.4s
	cmp	x0, x19
	bne	.L23
	addv	s30, v30.4s
	mov	w3, 0
	.p2align 5,,15
.L24:
	ldr	w0, [x23], 4
	eor	w3, w3, w0
	cmp	x24, x23
	bne	.L24
	movi	v29.4s, 0
	add	x0, x21, 768
	movi	v26.16b, 0xffffffffffffff81
.L25:
	ldr	q31, [x0], 16
	and	v31.16b, v31.16b, v26.16b
	orr	v29.16b, v29.16b, v31.16b
	cmp	x0, x22
	bne	.L25
	movi	v31.4s, 0
	adrp	x0, .LC3
	fmov	w1, s28
	fmov	w2, s30
	add	x0, x0, :lo12:.LC3
	ext	v26.16b, v29.16b, v31.16b, #8
	orr	v29.16b, v26.16b, v29.16b
	ext	v26.16b, v29.16b, v31.16b, #4
	orr	v26.16b, v26.16b, v29.16b
	ext	v29.16b, v26.16b, v31.16b, #2
	orr	v29.16b, v29.16b, v26.16b
	ext	v31.16b, v29.16b, v31.16b, #1
	orr	v31.16b, v31.16b, v29.16b
	umov	w4, v31.b[0]
	bl	printf
	movi	v27.4s, 0
	mov	x8, 16963
	add	x7, x21, 768
	sub	x4, x21, #256
	add	x3, x21, 256
	mov	w6, 1000
	mov	x5, 0
	mov	x1, 0
	mov	w9, 90
	movk	x8, 0xf, lsl 16
.L29:
	ldr	w0, [x20, x5, lsl 2]
	mul	x1, x1, x8
	movi	v31.4s, 0
	add	w0, w0, w6
	str	w0, [x20, x5, lsl 2]
	ldrb	w0, [x5, x7]
	eor	w0, w0, w9
	strb	w0, [x5, x7]
	mov	x0, x20
	.p2align 5,,15
.L26:
	ldr	q30, [x0], 16
	saddw	v31.2d, v31.2d, v30.2s
	saddw2	v31.2d, v31.2d, v30.4s
	cmp	x0, x19
	bne	.L26
	addp	d31, v31.2d
	movi	v28.4s, 0
	fmov	x0, d31
	add	x0, x0, x1
	add	x1, x21, 768
	.p2align 5,,15
.L27:
	ldr	q30, [x1], 16
	zip1	v29.16b, v30.16b, v27.16b
	zip2	v30.16b, v30.16b, v27.16b
	zip1	v31.8h, v30.8h, v27.8h
	uaddw2	v31.4s, v31.4s, v30.8h
	zip1	v30.8h, v29.8h, v27.8h
	uaddw2	v30.4s, v30.4s, v29.8h
	add	v31.4s, v31.4s, v30.4s
	add	v28.4s, v28.4s, v31.4s
	cmp	x1, x22
	bne	.L27
	addv	s28, v28.4s
	mov	x1, 0
	movi	v31.4s, 0
	fmov	w2, s28
	.p2align 5,,15
.L28:
	ldr	q30, [x1, x4]
	ldr	q29, [x1, x3]
	add	x1, x1, 16
	smlal	v31.4s, v29.4h, v30.4h
	smlal2	v31.4s, v29.8h, v30.8h
	cmp	x1, 512
	bne	.L28
	addv	s31, v31.4s
	add	x5, x5, 1
	add	w6, w6, 1000
	fmov	w1, s31
	add	x1, x2, w1, uxtw
	add	x1, x1, x0
	cmp	x5, 16
	bne	.L29
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 96
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

