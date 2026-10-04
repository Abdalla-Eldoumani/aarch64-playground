	.text
	.align	2
	.p2align 5,,15
pop_ref:
	adrp	x3, .LANCHOR0
	add	x3, x3, :lo12:.LANCHOR0
	mov	x4, x0
	mov	w1, 0
	mov	w0, 0
	.p2align 5,,15
.L2:
	lsr	x2, x4, x1
	and	x2, x2, 15
	add	w1, w1, 4
	ldrb	w2, [x3, x2]
	add	w0, w0, w2
	cmp	w1, 64
	bne	.L2
	ret
	.align	2
	.p2align 5,,15
clz_ref:
	adrp	x2, .LANCHOR0
	add	x2, x2, :lo12:.LANCHOR0
	dup	v29.2d, x0
	mov	w1, 0
	movi	v26.4s, 0x4
	ldp	q30, q27, [x2, 16]
	b	.L6
	.p2align 2,,3
.L9:
	ushr	v30.2d, v30.2d, 4
	add	w1, w1, 4
	cmp	w1, 64
	beq	.L12
	add	v27.4s, v27.4s, v26.4s
.L6:
	ushr	v31.2d, v30.2d, 2
	cmtst	v28.2d, v29.2d, v30.2d
	cmtst	v31.2d, v31.2d, v29.2d
	addhn	v31.2s, v31.2d, v28.2d
	fmov	x2, d31
	cbz	x2, .L9
	mov	x2, -9223372036854775808
	lsr	x2, x2, x1
	b	.L8
	.p2align 2,,3
.L13:
	add	w1, w1, 1
	lsr	x2, x2, 1
	cmp	w1, 64
	beq	.L5
.L8:
	tst	x0, x2
	beq	.L13
.L5:
	mov	w0, w1
	ret
	.p2align 2,,3
.L12:
	movi	v31.4s, 0x1
	add	v27.4s, v27.4s, v31.4s
	umov	w1, v27.s[3]
	mov	w0, w1
	ret
	.align	2
	.p2align 5,,15
ctz_ref:
	adrp	x2, .LANCHOR0
	add	x2, x2, :lo12:.LANCHOR0
	dup	v29.2d, x0
	mov	w1, 0
	movi	v26.4s, 0x4
	ldp	q27, q30, [x2, 32]
	b	.L15
	.p2align 2,,3
.L18:
	shl	v30.2d, v30.2d, 4
	add	w1, w1, 4
	cmp	w1, 64
	beq	.L21
	add	v27.4s, v27.4s, v26.4s
.L15:
	shl	v31.2d, v30.2d, 2
	cmtst	v28.2d, v29.2d, v30.2d
	cmtst	v31.2d, v31.2d, v29.2d
	addhn	v31.2s, v31.2d, v28.2d
	fmov	x2, d31
	cbz	x2, .L18
	mov	x2, 1
	lsl	x2, x2, x1
	b	.L17
	.p2align 2,,3
.L22:
	add	w1, w1, 1
	lsl	x2, x2, 1
	cmp	w1, 64
	beq	.L14
.L17:
	tst	x0, x2
	beq	.L22
.L14:
	mov	w0, w1
	ret
	.p2align 2,,3
.L21:
	movi	v31.4s, 0x1
	add	v27.4s, v27.4s, v31.4s
	umov	w1, v27.s[3]
	mov	w0, w1
	ret
	.align	2
	.p2align 5,,15
clz32:
	clz	w0, w0
	ret
	.align	2
	.p2align 5,,15
ctz32:
	rbit	w0, w0
	clz	w0, w0
	ret
	.align	2
	.p2align 5,,15
clz64:
	clz	x0, x0
	ret
	.align	2
	.p2align 5,,15
ctz64:
	rbit	x0, x0
	clz	x0, x0
	ret
	.section .rodata
	.align	3
.LC4:
	.string	"%016lx pop %d %d clz %d %d ctz %d %d cls %d %d\n"
	.align	3
.LC5:
	.string	"  ffs %d %d parity %d %d bswap %04x %08x %016lx\n"
	.align	3
.LC6:
	.string	"sums pop %ld clz %ld ctz %ld mismatches %d\n"
	.align	3
.LC7:
	.string	"log2(%lu) = %d, next pow2 %lu\n"
	.align	3
.LC8:
	.string	"set bits of %lx:"
	.align	3
.LC9:
	.string	" %d"
	.align	3
.LC10:
	.string	"\n"
	.align	3
.LC11:
	.string	"popcount total %ld\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #160
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x19, x20, [sp, 32]
	adrp	x19, .LANCHOR1
	add	x19, x19, :lo12:.LANCHOR1
	stp	x23, x24, [sp, 64]
	adrp	x24, .LC5
	add	x24, x24, :lo12:.LC5
	stp	x25, x26, [sp, 80]
	adrp	x25, .LC4
	add	x25, x25, :lo12:.LC4
	mov	w23, 0
	stp	x21, x22, [sp, 48]
	.p2align 5,,15
.L28:
	ldr	x20, [x19, w23, sxtw 3]
	fmov	s31, w20
	add	w23, w23, 1
	cnt	v31.8b, v31.8b
	mov	w0, w20
	bl	clz32
	mov	w4, w0
	mov	x0, x20
	bl	clz64
	mov	w5, w0
	mov	w0, w20
	addv	b31, v31.8b
	bl	ctz32
	cls	w1, w20
	mov	w6, w0
	cls	x2, x20
	mov	x0, x20
	bl	ctz64
	str	w1, [sp]
	fmov	w21, s31
	fmov	d31, x20
	str	w2, [sp, 8]
	mov	w7, w0
	cnt	v31.8b, v31.8b
	mov	x1, x20
	mov	x0, x25
	mov	w2, w21
	addv	b31, v31.8b
	fmov	x22, d31
	mov	w3, w22
	bl	printf
	cmp	w20, 0
	rbit	w1, w20
	clz	w1, w1
	csinc	w1, wzr, w1, eq
	cmp	x20, 0
	rbit	x2, x20
	clz	x2, x2
	rev16	w5, w20
	csinc	x2, xzr, x2, eq
	rev	x7, x20
	rev	w6, w20
	and	w5, w5, 65535
	and	w4, w22, 1
	and	w3, w21, 1
	mov	x0, x24
	bl	printf
	cmp	w23, 17
	bne	.L28
	mov	x9, 31765
	mov	x15, 32557
	mov	x14, 33103
	movk	x9, 0x7f4a, lsl 16
	movk	x15, 0x4c95, lsl 16
	movk	x14, 0xf767, lsl 16
	movk	x9, 0x79b9, lsl 32
	movk	x15, 0xf42d, lsl 32
	movk	x14, 0x7b7e, lsl 32
	mov	w20, 50495
	mov	w8, 0
	mov	w6, 0
	mov	x13, 0
	mov	x12, 0
	mov	x11, 0
	movk	x9, 0x9e37, lsl 48
	movk	x15, 0x5851, lsl 48
	movk	x14, 0x1405, lsl 48
	movk	w20, 0x4325, lsl 16
	mov	w18, 61
	.p2align 5,,15
.L30:
	madd	x9, x9, x15, x14
	lsr	x5, x9, x9
	tbz	x8, 0, .L29
	umull	x0, w8, w20
	lsr	x0, x0, 36
	msub	w0, w0, w18, w8
	lsl	x0, x9, x0
	and	x5, x5, x0
.L29:
	fmov	d31, x5
	mov	x0, x5
	bl	clz64
	mov	w21, w0
	cnt	v31.8b, v31.8b
	mov	x0, x5
	bl	ctz64
	mov	w10, w0
	add	x13, x13, w0, sxtw
	mov	x0, x5
	bl	pop_ref
	add	w8, w8, 1
	addv	b31, v31.8b
	add	x12, x12, w21, sxtw
	fmov	x7, d31
	cmp	w0, w7
	mov	x0, x5
	cinc	w6, w6, ne
	add	x11, x11, x7
	bl	clz_ref
	cmp	w0, w21
	cinc	w6, w6, ne
	mov	x0, x5
	bl	ctz_ref
	cmp	w0, w10
	fmov	s31, w5
	cinc	w6, w6, ne
	uxtw	x0, w5
	cnt	v31.8b, v31.8b
	bl	pop_ref
	addv	b31, v31.8b
	fmov	w7, s31
	cmp	w0, w7
	cinc	w6, w6, ne
	cmp	w8, 256
	bne	.L30
	mov	w4, w6
	mov	x3, x13
	mov	x2, x12
	mov	x1, x11
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	add	x20, sp, 104
	adrp	x0, .LANCHOR0
	add	x0, x0, :lo12:.LANCHOR0
	adrp	x21, .LC7
	add	x21, x21, :lo12:.LC7
	mov	w26, 0
	mov	w22, 63
	ldp	q29, q30, [x0, 64]
	mov	x25, 1
	ldr	q31, [x0, 96]
	mov	x23, -9223372036854775808
	str	q29, [sp, 104]
	mov	w24, 64
	str	q30, [x20, 16]
	ldr	x0, [x0, 112]
	str	q31, [x20, 32]
	str	x0, [x20, 48]
	.p2align 5,,15
.L32:
	ldr	x1, [x20, w26, sxtw 3]
	mov	x3, 1
	mov	x0, x1
	bl	clz64
	sub	w2, w22, w0
	cmp	x1, x3
	beq	.L31
	mov	x3, 0
	cmp	x1, x23
	bhi	.L31
	sub	x0, x1, #1
	bl	clz64
	sub	w3, w24, w0
	lsl	x3, x25, x3
.L31:
	mov	x0, x21
	add	w26, w26, 1
	bl	printf
	cmp	w26, 7
	bne	.L32
	ldr	x19, [x19, 88]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	mov	x1, x19
	bl	printf
	cbz	x19, .L33
	adrp	x20, .LC9
	add	x20, x20, :lo12:.LC9
	.p2align 5,,15
.L34:
	mov	x0, x19
	bl	ctz64
	mov	w1, w0
	mov	x0, x20
	bl	printf
	sub	x0, x19, #1
	ands	x19, x19, x0
	bne	.L34
.L33:
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	mov	w2, 1
	mov	x1, 0
	.p2align 5,,15
.L35:
	fmov	s31, w2
	add	w2, w2, 1
	cnt	v31.8b, v31.8b
	addv	b31, v31.8b
	fmov	x0, d31
	add	x1, x1, x0
	cmp	w2, 4096
	bne	.L35
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	ldp	x29, x30, [sp, 16]
	mov	w0, 0
	ldp	x19, x20, [sp, 32]
	ldp	x21, x22, [sp, 48]
	ldp	x23, x24, [sp, 64]
	ldp	x25, x26, [sp, 80]
	add	sp, sp, 160
	ret
	.section .rodata
	.align	4
	.LANCHOR0:
nibble_bits:
	.byte 0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4
.LC1:
	.xword	-9223372036854775808
	.xword	4611686018427387904
.LC2:
	.word	0
	.word	1
	.word	2
	.word	3
.LC3:
	.xword	1
	.xword	2
.LC0:
	.xword	1
	.xword	2
	.xword	3
	.xword	1000
	.xword	4096
	.xword	4097
	.xword	-9223372036854775808
	.data
	.align	4
	.LANCHOR1:
vals:
	.xword	0
	.xword	1
	.xword	2
	.xword	3
	.xword	128
	.xword	255
	.xword	-9223372036854775808
	.xword	-1
	.xword	9223372036854775807
	.xword	4294967295
	.xword	-4294967296
	.xword	81985529216486895
	.xword	-81985529216486896
	.xword	-9223372036854775807
	.xword	4294967296
	.xword	-6148914691236517206
	.xword	2147483648

