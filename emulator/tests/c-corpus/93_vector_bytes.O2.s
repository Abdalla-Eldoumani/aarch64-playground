	.text
	.align	2
	.align 5
fill:
	mov	x9, 58255
	adrp	x0, .LANCHOR0
	adrp	x3, .LANCHOR1
	movk	x9, 0x8e38, lsl 16
	add	x3, x3, :lo12:.LANCHOR1
	mov	w7, 26125
	mov	w6, 62303
	adrp	x8, .LANCHOR2
	movk	x9, 0x38e3, lsl 32
	add	x8, x8, :lo12:.LANCHOR2
	add	x4, x3, 1024
	add	x5, x3, 512
	ldr	w1, [x0, :lo12:.LANCHOR0]
	movk	w7, 0x19, lsl 16
	mov	x0, 0
	movk	w6, 0x3c6e, lsl 16
	movk	x9, 0xe38e, lsl 48
	.align 5
.L5:
	madd	w1, w1, w7, w6
	tbz	x0, 5, .L2
	lsr	w2, w1, 24
	strb	w2, [x3, x0]
	lsr	w2, w1, 16
	strb	w2, [x0, x5]
	lsr	w2, w1, 8
	strb	w2, [x0, x4]
	add	x0, x0, 1
	cmp	x0, 512
	bne	.L5
	mov	w0, 255
	strh	w0, [x3, 1]
	mov	w0, -1
	strh	w0, [x5, 1]
	mov	w0, -128
	strb	w0, [x4, 3]
	ret
	.align 2
.L2:
	umulh	x2, x0, x9
	lsr	x2, x2, 6
	add	x2, x2, x2, lsl 3
	sub	x2, x0, x2, lsl 3
	ldrb	w2, [x8, x2]
	strb	w2, [x3, x0]
	lsr	w2, w1, 16
	strb	w2, [x0, x5]
	lsr	w2, w1, 8
	strb	w2, [x0, x4]
	add	x0, x0, 1
	b	.L5
	.align	2
	.align 5
hash:
	mov	x2, x0
	add	x1, x0, w1, sxtw
	mov	w4, 403
	mov	w0, 40389
	movk	w0, 0x811c, lsl 16
	movk	w4, 0x100, lsl 16
	.align 5
.L9:
	ldrb	w3, [x2], 1
	eor	w0, w3, w0
	mul	w0, w0, w4
	cmp	x1, x2
	bne	.L9
	ret
	.align	2
	.align 5
xor_key:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	movi	v31.16b, 0x5a
	add	x2, x1, 1536
	mov	x0, 0
	.align 5
.L12:
	ldr	q30, [x1, x0]
	eor	v30.16b, v30.16b, v31.16b
	str	q30, [x0, x2]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L12
	ret
	.align	2
	.align 5
to_upper:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	movi	v31.16b, 0xffffffffffffff9f
	add	x2, x1, 1536
	movi	v30.16b, 0x19
	mov	x0, 0
	movi	v29.16b, 0xffffffffffffffe0
	.align 5
.L15:
	ldr	q28, [x1, x0]
	add	v27.16b, v28.16b, v31.16b
	add	v26.16b, v28.16b, v29.16b
	cmhs	v27.16b, v30.16b, v27.16b
	bif	v26.16b, v28.16b, v27.16b
	str	q26, [x0, x2]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L15
	ret
	.align	2
	.align 5
rot13:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	movi	v31.16b, 0xffffffffffffff9f
	add	x2, x1, 1536
	movi	v30.16b, 0x19
	mov	x0, 0
	movi	v29.16b, 0x6d
	movi	v28.16b, 0xfffffffffffffff3
	movi	v27.16b, 0xd
	.align 5
.L18:
	ldr	q26, [x1, x0]
	cmhi	v24.16b, v26.16b, v29.16b
	add	v25.16b, v26.16b, v31.16b
	bsl	v24.16b, v28.16b, v27.16b
	cmhs	v25.16b, v30.16b, v25.16b
	add	v24.16b, v24.16b, v26.16b
	bif	v24.16b, v26.16b, v25.16b
	str	q24, [x0, x2]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L18
	ret
	.align	2
	.align 5
sat_add:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	movi	v31.8h, 0xff
	add	x3, x1, 512
	add	x2, x1, 1536
	mov	x0, 0
	.align 5
.L21:
	ldr	q30, [x1, x0]
	ldr	q29, [x0, x3]
	uaddl	v28.8h, v30.8b, v29.8b
	uaddl2	v29.8h, v30.16b, v29.16b
	umin	v28.8h, v28.8h, v31.8h
	umin	v29.8h, v29.8h, v31.8h
	uzp1	v29.16b, v28.16b, v29.16b
	str	q29, [x0, x2]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L21
	ret
	.align	2
	.align 5
sat_sub:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	movi	v31.4s, 0
	add	x3, x1, 512
	add	x2, x1, 1536
	mov	x0, 0
	.align 5
.L24:
	ldr	q30, [x1, x0]
	ldr	q29, [x0, x3]
	usubl	v28.8h, v30.8b, v29.8b
	usubl2	v29.8h, v30.16b, v29.16b
	smax	v28.8h, v28.8h, v31.8h
	smax	v29.8h, v29.8h, v31.8h
	uzp1	v29.16b, v28.16b, v29.16b
	str	q29, [x0, x2]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L24
	ret
	.align	2
	.align 5
avg_round:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	add	x3, x1, 1536
	add	x2, x1, 512
	mov	x0, 0
	.align 5
.L27:
	ldr	q31, [x1, x0]
	ldr	q30, [x0, x2]
	urhadd	v30.16b, v31.16b, v30.16b
	str	q30, [x0, x3]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L27
	ret
	.align	2
	.align 5
abs_diff:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	add	x3, x1, 512
	add	x2, x1, 1536
	mov	x0, 0
	.align 5
.L30:
	ldr	q31, [x1, x0]
	ldr	q30, [x0, x3]
	cmhi	v29.16b, v31.16b, v30.16b
	sub	v28.16b, v31.16b, v30.16b
	sub	v30.16b, v30.16b, v31.16b
	bit	v30.16b, v28.16b, v29.16b
	str	q30, [x0, x2]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L30
	ret
	.align	2
	.align 5
max_u8:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	add	x3, x1, 1536
	add	x2, x1, 512
	mov	x0, 0
	.align 5
.L33:
	ldr	q31, [x0, x2]
	ldr	q30, [x1, x0]
	umax	v30.16b, v31.16b, v30.16b
	str	q30, [x0, x3]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L33
	ret
	.align	2
	.align 5
rotl3:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	add	x2, x1, 1536
	mov	x0, 0
	.align 5
.L36:
	ldr	q31, [x1, x0]
	shl	v30.16b, v31.16b, 3
	usra	v30.16b, v31.16b, 5
	str	q30, [x0, x2]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L36
	ret
	.align	2
	.align 5
abs_s8:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	add	x2, x1, 1024
	add	x1, x1, 1536
	mov	x0, 0
	.align 5
.L39:
	ldr	q31, [x0, x2]
	cmlt	v30.16b, v31.16b, #0
	neg	v29.16b, v31.16b
	bif	v29.16b, v31.16b, v30.16b
	str	q29, [x0, x1]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L39
	ret
	.align	2
	.align 5
widen_mul:
	adrp	x4, .LC0
	adrp	x2, .LANCHOR1
	movi	v31.4s, 0
	add	x2, x2, :lo12:.LANCHOR1
	ldr	q30, [x4, :lo12:.LC0]
	add	x1, x2, 2048
	add	x3, x2, 512
	mov	x0, 0
	.align 5
.L42:
	ldr	q29, [x2, x0]
	ldr	q28, [x0, x3]
	add	x0, x0, 16
	zip1	v27.16b, v29.16b, v31.16b
	zip2	v29.16b, v29.16b, v31.16b
	zip1	v26.16b, v28.16b, v31.16b
	zip2	v28.16b, v28.16b, v31.16b
	mla	v26.8h, v27.8h, v30.8h
	mla	v28.8h, v29.8h, v30.8h
	stp	q26, q28, [x1], 32
	cmp	x0, 512
	bne	.L42
	ret
	.align	2
	.align 5
narrow_hi:
	adrp	x2, .LANCHOR1
	add	x2, x2, :lo12:.LANCHOR1
	add	x0, x2, 2048
	add	x1, x2, 1536
	add	x2, x2, 3072
	.align 5
.L45:
	ldp	q31, q30, [x0], 32
	uzp2	v30.16b, v31.16b, v30.16b
	str	q30, [x1], 16
	cmp	x0, x2
	bne	.L45
	ret
	.align	2
	.align 5
pair_sum:
	adrp	x0, .LANCHOR1
	add	x0, x0, :lo12:.LANCHOR1
	add	x2, x0, 1536
	add	x3, x0, 512
	mov	x1, x2
	.align 5
.L48:
	ld2	{v30.16b - v31.16b}, [x0], 32
	add	v30.16b, v30.16b, v31.16b
	str	q30, [x1], 16
	cmp	x0, x3
	bne	.L48
	movi	v31.4s, 0
	add	x0, x2, 256
	add	x1, x2, 512
	.align 5
.L49:
	str	q31, [x0], 16
	cmp	x1, x0
	bne	.L49
	ret
	.align	2
	.align 5
interleave:
	adrp	x2, .LANCHOR1
	add	x2, x2, :lo12:.LANCHOR1
	add	x1, x2, 3072
	add	x3, x2, 512
	mov	x0, 0
	.align 5
.L53:
	ldr	q30, [x2, x0]
	ldr	q31, [x3, x0]
	add	x0, x0, 16
	st2	{v30.16b - v31.16b}, [x1], 32
	cmp	x0, 512
	bne	.L53
	ret
	.align	2
	.align 5
count_space:
	movi	v31.4s, 0
	adrp	x0, .LANCHOR1
	movi	v29.16b, 0x20
	add	x0, x0, :lo12:.LANCHOR1
	movi	v28.16b, 0x1
	add	x1, x0, 512
	mov	v30.16b, v31.16b
	.align 5
.L56:
	ldr	q27, [x0], 16
	cmeq	v27.16b, v27.16b, v29.16b
	and	v27.16b, v27.16b, v28.16b
	zip1	v26.16b, v27.16b, v31.16b
	zip2	v27.16b, v27.16b, v31.16b
	uaddw	v30.4s, v30.4s, v26.4h
	uaddw2	v30.4s, v30.4s, v26.8h
	uaddw	v30.4s, v30.4s, v27.4h
	uaddw2	v30.4s, v30.4s, v27.8h
	cmp	x1, x0
	bne	.L56
	addv	s31, v30.4s
	fmov	w0, s31
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"%-9s %08x %02x %02x %02x %02x %02x\n"
	.text
	.align	2
	.align 5
report:
	stp	x29, x30, [sp, -16]!
	adrp	x9, .LANCHOR1
	add	x9, x9, :lo12:.LANCHOR1
	mov	x29, sp
	mov	x10, x0
	add	x0, x9, 1536
	mov	w1, 512
	bl	hash
	ldrb	w7, [x9, 2047]
	ldp	x29, x30, [sp], 16
	mov	w2, w0
	ldrb	w6, [x9, 1539]
	mov	x1, x10
	ldrb	w5, [x9, 1538]
	adrp	x0, .LC1
	ldrb	w4, [x9, 1537]
	add	x0, x0, :lo12:.LC1
	ldrb	w3, [x9, 1536]
	b	printf
	.section .rodata
	.align	3
.LC2:
	.string	"xor"
	.align	3
.LC3:
	.string	"upper"
	.align	3
.LC4:
	.string	"rot13"
	.align	3
.LC5:
	.string	"sat_add"
	.align	3
.LC6:
	.string	"sat_sub"
	.align	3
.LC7:
	.string	"avg"
	.align	3
.LC8:
	.string	"absdiff"
	.align	3
.LC9:
	.string	"max"
	.align	3
.LC10:
	.string	"rotl3"
	.align	3
.LC11:
	.string	"abs_s8"
	.align	3
.LC12:
	.string	"narrow"
	.align	3
.LC13:
	.string	"pairsum"
	.align	3
.LC14:
	.string	"interleave %08x %02x %02x %02x\n"
	.align	3
.LC15:
	.string	"wide %04x %04x %04x\n"
	.align	3
.LC16:
	.string	"spaces %d\n"
	.align	3
.LC17:
	.string	"bswap %08x %08x %08x\n"
	.align	3
.LC18:
	.string	"again"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x19, [sp, 16]
	bl	fill
	bl	xor_key
	adrp	x19, .LANCHOR1
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	report
	add	x19, x19, :lo12:.LANCHOR1
	bl	to_upper
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	report
	bl	rot13
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	report
	bl	sat_add
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	report
	bl	sat_sub
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	report
	bl	avg_round
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	report
	bl	abs_diff
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	report
	bl	max_u8
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	report
	bl	rotl3
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	report
	bl	abs_s8
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	report
	bl	widen_mul
	bl	narrow_hi
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	report
	bl	pair_sum
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	report
	bl	interleave
	mov	w1, 1024
	add	x0, x19, 3072
	bl	hash
	mov	w1, w0
	ldrb	w4, [x19, 4095]
	adrp	x0, .LC14
	ldrb	w3, [x19, 3073]
	add	x0, x0, :lo12:.LC14
	ldrb	w2, [x19, 3072]
	bl	printf
	ldrh	w3, [x19, 3070]
	adrp	x0, .LC15
	ldrh	w2, [x19, 2050]
	add	x0, x0, :lo12:.LC15
	ldrh	w1, [x19, 2048]
	bl	printf
	bl	count_space
	mov	w1, w0
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	adrp	x4, .LANCHOR3
	add	x4, x4, :lo12:.LANCHOR3
	sub	x0, x4, #256
	mov	x2, x19
	movi	v31.4s, 0
	add	x3, x19, 512
	mov	x1, x0
	.align 5
.L61:
	ld4	{v20.16b - v23.16b}, [x2], 64
	add	x1, x1, 64
	zip1	v28.16b, v20.16b, v31.16b
	zip1	v25.16b, v23.16b, v31.16b
	shll	v26.8h, v21.8b, 8
	zip1	v27.16b, v22.16b, v31.16b
	zip2	v30.16b, v20.16b, v31.16b
	shll2	v29.8h, v21.16b, 8
	orr	v26.16b, v26.16b, v28.16b
	zip2	v28.16b, v23.16b, v31.16b
	zip1	v23.8h, v25.8h, v31.8h
	zip2	v25.8h, v25.8h, v31.8h
	shll	v24.4s, v27.4h, 16
	shll2	v27.4s, v27.8h, 16
	shl	v23.4s, v23.4s, 24
	shl	v25.4s, v25.4s, 24
	orr	v29.16b, v29.16b, v30.16b
	zip2	v30.16b, v22.16b, v31.16b
	orr	v24.16b, v24.16b, v23.16b
	orr	v27.16b, v27.16b, v25.16b
	zip1	v23.8h, v26.8h, v31.8h
	zip2	v26.8h, v26.8h, v31.8h
	orr	v24.16b, v24.16b, v23.16b
	orr	v27.16b, v27.16b, v26.16b
	zip1	v26.8h, v28.8h, v31.8h
	zip2	v28.8h, v28.8h, v31.8h
	stp	q24, q27, [x1, -64]
	shl	v26.4s, v26.4s, 24
	shll	v27.4s, v30.4h, 16
	shl	v28.4s, v28.4s, 24
	shll2	v30.4s, v30.8h, 16
	orr	v27.16b, v27.16b, v26.16b
	zip1	v26.8h, v29.8h, v31.8h
	orr	v30.16b, v30.16b, v28.16b
	zip2	v29.8h, v29.8h, v31.8h
	orr	v27.16b, v27.16b, v26.16b
	orr	v30.16b, v30.16b, v29.16b
	stp	q27, q30, [x1, -32]
	cmp	x2, x3
	bne	.L61
	add	x3, x0, 512
	mov	x1, x0
	.align 5
.L62:
	ldr	q31, [x1]
	rev32	v31.16b, v31.16b
	str	q31, [x1], 16
	cmp	x1, x3
	bne	.L62
	mov	w1, 0
	.align 5
.L63:
	lsl	w2, w1, 5
	sub	w1, w2, w1
	ldr	w2, [x0], 4
	add	w1, w1, w2
	cmp	x0, x3
	bne	.L63
	ldr	w2, [x4, -256]
	adrp	x0, .LC17
	ldr	w3, [x4, 252]
	add	x0, x0, :lo12:.LC17
	bl	printf
	add	x1, x19, 1536
	mov	x0, 0
	.align 5
.L64:
	ldr	q31, [x0, x1]
	str	q31, [x19, x0]
	add	x0, x0, 16
	cmp	x0, 512
	bne	.L64
	bl	to_upper
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	report
	ldr	x19, [sp, 16]
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret
	.section .rodata
	.align	4
	.LANCHOR2:
text:
	.string	"Hello, World! the quick brown fox jumps over the lazy dog 0123456789 ~{}"
	.zero	7
.LC0:
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
	.LANCHOR0:
seed:
	.word	88172645
	.bss
	.align	4
	.LANCHOR1:
	.LANCHOR3 = . + 4352
src:
	.zero	512
src2:
	.zero	512
sgn:
	.zero	512
dst:
	.zero	512
w16:
	.zero	1024
pair:
	.zero	1024
w32:
	.zero	512

