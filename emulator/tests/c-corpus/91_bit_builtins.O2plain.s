	.text
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
	.string	"popcount total %ld\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #176
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x19, x20, [sp, 32]
	adrp	x20, .LANCHOR1
	add	x20, x20, :lo12:.LANCHOR1
	stp	x21, x22, [sp, 48]
	stp	x23, x24, [sp, 64]
	adrp	x24, .LC4
	adrp	x23, .LC5
	add	x24, x24, :lo12:.LC4
	add	x23, x23, :lo12:.LC5
	str	x25, [sp, 80]
	mov	w25, 0
	stp	d14, d15, [sp, 96]
	b	.L5
.L3:
	rbit	w21, w19
	clz	w21, w21
	rbit	x22, x19
	clz	x22, x22
	clz	x5, x19
	mov	w6, w21
	mov	w7, w22
.L4:
	fmov	w2, s31
	fmov	w3, s30
	cls	w0, w19
	cls	x1, x19
	str	w0, [sp]
	mov	x0, x24
	str	w1, [sp, 8]
	mov	x1, x19
	add	w25, w25, 1
	bl	printf
	cnt	v15.8b, v15.8b
	cmp	w19, 0
	rev16	w5, w19
	csinc	w1, wzr, w21, eq
	cmp	x19, 0
	csinc	x2, xzr, x22, eq
	rev	x7, x19
	addv	b31, v15.8b
	rev	w6, w19
	and	w5, w5, 65535
	mov	x0, x23
	fmov	w3, s31
	addv	b31, v14.8b
	fmov	x4, d31
	and	w3, w3, 1
	and	w4, w4, 1
	bl	printf
	cmp	w25, 17
	beq	.L49
.L5:
	ldr	x19, [x20, w25, sxtw 3]
	fmov	d30, x19
	fmov	s15, w19
	cnt	v14.8b, v30.8b
	clz	w4, w19
	cnt	v31.8b, v15.8b
	addv	b30, v14.8b
	addv	b31, v31.8b
	cbnz	w19, .L3
	cbz	x19, .L25
	mov	w4, 32
	b	.L3
.L25:
	mov	w4, 32
	mov	w5, 64
	mov	w6, w4
	mov	w7, w5
	mov	w21, w4
	mov	x22, 64
	b	.L4
.L49:
	mov	x9, 31765
	mov	x11, 32557
	mov	x10, 33103
	movk	x9, 0x7f4a, lsl 16
	movk	x11, 0x4c95, lsl 16
	movk	x10, 0xf767, lsl 16
	movi	v26.4s, 0x4
	movk	x9, 0x79b9, lsl 32
	movi	v25.4s, 0x1
	adrp	x21, .LANCHOR0
	movk	x11, 0xf42d, lsl 32
	movk	x10, 0x7b7e, lsl 32
	mov	w15, 50495
	add	x21, x21, :lo12:.LANCHOR0
	mov	w8, 0
	mov	w4, 0
	mov	x3, 0
	mov	x2, 0
	mov	x1, 0
	movk	x9, 0x9e37, lsl 48
	movk	x11, 0x5851, lsl 48
	movk	x10, 0x1405, lsl 48
	movk	w15, 0x4325, lsl 16
	mov	w14, 61
	mov	x13, -9223372036854775808
	mov	x12, 1
	.align 5
.L18:
	madd	x9, x9, x11, x10
	lsr	x6, x9, x9
	tbz	x8, 0, .L6
	umull	x0, w8, w15
	lsr	x0, x0, 36
	msub	w0, w0, w14, w8
	lsl	x0, x9, x0
	and	x6, x6, x0
.L6:
	fmov	d31, x6
	cnt	v31.8b, v31.8b
	addv	b31, v31.8b
	fmov	x17, d31
	cbz	x6, .L26
	clz	x5, x6
	rbit	x0, x6
	clz	x0, x0
	mov	w18, w5
	mov	w16, w0
	sxtw	x5, w5
	sxtw	x0, w0
.L7:
	add	x1, x1, x17
	add	x3, x3, x0
	add	x2, x2, x5
	mov	w7, 0
	mov	w5, 0
	.align 5
.L8:
	lsr	x0, x6, x5
	and	x0, x0, 15
	add	x0, x21, x0
	add	w5, w5, 4
	ldrb	w0, [x0, 48]
	add	w7, w7, w0
	cmp	w5, 64
	bne	.L8
	cmp	w17, w7
	dup	v30.2d, x6
	ldp	q29, q27, [x21]
	cinc	w5, w4, ne
	mov	w0, 0
	b	.L9
	.align 2
.L12:
	ushr	v29.2d, v29.2d, 4
	add	w0, w0, 4
	cmp	w0, 64
	beq	.L50
	add	v27.4s, v27.4s, v26.4s
.L9:
	ushr	v31.2d, v29.2d, 2
	cmtst	v28.2d, v30.2d, v29.2d
	cmtst	v31.2d, v31.2d, v30.2d
	addhn	v31.2s, v31.2d, v28.2d
	fmov	x4, d31
	cbz	x4, .L12
	lsr	x4, x13, x0
	b	.L11
	.align 2
.L51:
	add	w0, w0, 1
	lsr	x4, x4, 1
	cmp	w0, 64
	beq	.L10
.L11:
	tst	x6, x4
	beq	.L51
.L10:
	cmp	w18, w0
	mov	w0, 0
	ldp	q27, q29, [x21, 16]
	cinc	w5, w5, ne
	b	.L13
	.align 2
.L16:
	shl	v29.2d, v29.2d, 4
	add	w0, w0, 4
	cmp	w0, 64
	beq	.L52
	add	v27.4s, v27.4s, v26.4s
.L13:
	shl	v31.2d, v29.2d, 2
	cmtst	v28.2d, v29.2d, v30.2d
	cmtst	v31.2d, v31.2d, v30.2d
	addhn	v31.2s, v31.2d, v28.2d
	fmov	x4, d31
	cbz	x4, .L16
	lsl	x4, x12, x0
	b	.L15
	.align 2
.L53:
	add	w0, w0, 1
	lsl	x4, x4, 1
	cmp	w0, 64
	beq	.L14
.L15:
	tst	x6, x4
	beq	.L53
.L14:
	fmov	s31, w6
	cmp	w16, w0
	cinc	w5, w5, ne
	and	x6, x6, 4294967295
	cnt	v31.8b, v31.8b
	mov	w19, 0
	mov	w4, 0
	addv	b31, v31.8b
	fmov	w7, s31
	.align 5
.L17:
	lsr	x0, x6, x19
	and	x0, x0, 15
	add	x0, x21, x0
	add	w19, w19, 4
	ldrb	w0, [x0, 48]
	add	w4, w4, w0
	cmp	w19, 64
	bne	.L17
	cmp	w7, w4
	add	w8, w8, 1
	cinc	w4, w5, ne
	cmp	w8, 256
	bne	.L18
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	add	x25, sp, 120
	ldp	q29, q30, [x21, 64]
	adrp	x22, .LC7
	ldr	q31, [x21, 96]
	add	x22, x22, :lo12:.LC7
	str	q29, [sp, 120]
	mov	x24, 1
	mov	x23, -9223372036854775808
	str	q30, [x25, 16]
	ldr	x0, [x21, 112]
	str	q31, [x25, 32]
	mov	w21, 0
	str	x0, [x25, 48]
	b	.L21
.L56:
	cmp	x1, 1
	beq	.L30
	mov	w2, 63
	mov	x3, 0
	cmp	x1, x23
	bls	.L54
.L20:
	mov	x0, x22
	add	w21, w21, 1
	bl	printf
	cmp	w21, 7
	beq	.L55
.L21:
	ldr	x1, [x25, w21, sxtw 3]
	cbnz	x1, .L56
	mov	w2, -1
.L19:
	sub	x3, x1, #1
	mov	x0, x22
	clz	x3, x3
	add	w21, w21, 1
	sub	w3, w19, w3
	lsl	x3, x24, x3
	bl	printf
	cmp	w21, 7
	bne	.L21
.L55:
	ldr	x19, [x20, 88]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	mov	x1, x19
	bl	printf
	cbz	x19, .L22
	adrp	x20, .LC9
	add	x20, x20, :lo12:.LC9
.L23:
	rbit	x1, x19
	clz	x1, x1
	mov	x0, x20
	bl	printf
	sub	x0, x19, #1
	ands	x19, x19, x0
	bne	.L23
.L22:
	mov	w0, 10
	bl	putchar
	mov	w2, 1
	mov	x1, 0
	.align 5
.L24:
	fmov	s31, w2
	add	w2, w2, 1
	cnt	v31.8b, v31.8b
	addv	b31, v31.8b
	fmov	x0, d31
	add	x1, x1, x0
	cmp	w2, 4096
	bne	.L24
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldr	x25, [sp, 80]
	mov	w0, 0
	ldp	x29, x30, [sp, 16]
	ldp	x19, x20, [sp, 32]
	ldp	x21, x22, [sp, 48]
	ldp	x23, x24, [sp, 64]
	ldp	d14, d15, [sp, 96]
	add	sp, sp, 176
	ret
	.align 2
.L26:
	mov	x0, 64
	mov	x5, x0
	mov	w18, w0
	mov	w16, w0
	b	.L7
	.align 2
.L52:
	add	v27.4s, v27.4s, v25.4s
	umov	w0, v27.s[3]
	b	.L14
	.align 2
.L50:
	add	v27.4s, v27.4s, v25.4s
	umov	w0, v27.s[3]
	b	.L10
.L30:
	mov	x3, x1
	mov	w2, 0
	b	.L20
.L54:
	clz	x0, x1
	sub	w2, w2, w0
	b	.L19
	.section .rodata
	.align	4
	.LANCHOR0:
.LC1:
	.quad	-9223372036854775808
	.quad	4611686018427387904
.LC2:
	.word	0
	.word	1
	.word	2
	.word	3
.LC3:
	.quad	1
	.quad	2
nibble_bits:
	.byte 0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4
.LC0:
	.quad	1
	.quad	2
	.quad	3
	.quad	1000
	.quad	4096
	.quad	4097
	.quad	-9223372036854775808
	.data
	.align	4
	.LANCHOR1:
vals:
	.quad	0
	.quad	1
	.quad	2
	.quad	3
	.quad	128
	.quad	255
	.quad	-9223372036854775808
	.quad	-1
	.quad	9223372036854775807
	.quad	4294967295
	.quad	-4294967296
	.quad	81985529216486895
	.quad	-81985529216486896
	.quad	-9223372036854775807
	.quad	4294967296
	.quad	-6148914691236517206
	.quad	2147483648

