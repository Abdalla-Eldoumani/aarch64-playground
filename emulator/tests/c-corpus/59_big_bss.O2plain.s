	.text
	.section .rodata
	.align	3
.LC0:
	.string	"zero: sieve=%d wide=%d grid=%d\n"
	.align	3
.LC1:
	.string	"edges: wide[0]=%lld grid[0][0].c=%d marker[3]=%x\n"
	.align	3
.LC2:
	.string	"sieve: %ld primes below %d, last=%ld, sum of squares=%llu\n"
	.align	3
.LC4:
	.string	"gaps: twins=%u gap6=%u commonest=%d widest=%d (x%u)\n"
	.align	3
.LC5:
	.string	"wide: sum=%llu wide[59820]=%lld wide[59999]=%lld\n"
	.align	3
.LC6:
	.string	"grid: sum=%llu last.d=%x cell[294][99].b=%d\n"
	.align	3
.LC7:
	.string	"heap: sum=%llu, then sieve[last]=%x wide[59999]=%lld marker=%x,%x,%x,%x\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -96]!
	mov	w1, 0
	mov	x29, sp
	stp	x27, x28, [sp, 80]
	adrp	x27, sieve
	add	x27, x27, :lo12:sieve
	mov	x0, x27
	add	x3, x27, 151552
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
.L2:
	ldrb	w2, [x0]
	add	x0, x0, 4096
	cmp	w2, 0
	cinc	w1, w1, ne
	cmp	x0, x3
	bne	.L2
	add	x20, x27, 147456
	adrp	x25, wide
	add	x26, x25, :lo12:wide
	mov	w2, 0
	mov	x24, x26
	add	x4, x26, 483328
	ldrb	w0, [x20, 2544]
	cmp	w0, 0
	mov	x0, x26
	cinc	w1, w1, ne
.L3:
	ldrb	w3, [x0]
	add	x0, x0, 4096
	cmp	w3, 0
	cinc	w2, w2, ne
	cmp	x0, x4
	bne	.L3
	add	x0, x26, 479232
	adrp	x28, grid
	add	x23, x28, :lo12:grid
	mov	w3, 0
	add	x5, x23, 360448
	ldrb	w0, [x0, 767]
	cmp	w0, 0
	mov	x0, x23
	cinc	w2, w2, ne
.L4:
	ldrb	w4, [x0]
	add	x0, x0, 4096
	cmp	w4, 0
	cinc	w3, w3, ne
	cmp	x0, x5
	bne	.L4
	add	x0, x23, 356352
	adrp	x22, .LANCHOR0
	add	x22, x22, :lo12:.LANCHOR0
	add	x19, x26, 458752
	add	x21, x23, 344064
	ldrb	w0, [x0, 3647]
	cmp	w0, 0
	adrp	x0, .LC0
	cinc	w3, w3, ne
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, -85
	ldr	w2, [x28, :lo12:grid]
	ldr	x1, [x25, :lo12:wide]
	strb	w0, [x20, 2544]
	ldr	w3, [x22, 12]
	mov	x0, -1
	str	x0, [x19, 21240]
	mov	w0, 48879
	movk	w0, 0x7ead, lsl 16
	str	w0, [x21, 15932]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [x22, 16]
	cmp	w0, 4
	ble	.L5
	mov	x1, 2
	mov	x0, 4
	mov	w3, 1
	b	.L8
.L54:
	add	x1, x1, 1
	ldrsw	x2, [x22, 16]
	smull	x0, w1, w1
	cmp	x0, x2
	bge	.L5
.L8:
	ldrb	w2, [x27, x1]
	cbz	w2, .L51
	add	x1, x1, 1
	ldrsw	x2, [x22, 16]
	smull	x0, w1, w1
	cmp	x0, x2
	blt	.L8
.L5:
	ldr	w0, [x22, 16]
	cmp	w0, 2
	ble	.L31
	ldrb	w0, [x27, 2]
	cbnz	w0, .L32
	mov	x4, 4
	mov	x3, 2
	mov	x1, 1
.L10:
	adrp	x28, .LANCHOR1
	add	x25, x28, :lo12:.LANCHOR1
	mov	x2, 2
.L12:
	mov	x0, x2
.L11:
	ldrsw	x5, [x22, 16]
	add	x0, x0, 1
	cmp	x5, x0
	ble	.L9
	ldrb	w5, [x27, x0]
	cbnz	w5, .L11
	sub	w2, w0, w2
	umaddl	x4, w0, w0, x4
	add	x1, x1, 1
	ldrh	w3, [x25, w2, sxtw 1]
	add	w3, w3, 1
	strh	w3, [x25, w2, sxtw 1]
	mov	x2, x0
	mov	x3, x0
	b	.L12
.L7:
	strb	w3, [x27, x0]
	add	x0, x0, x1
.L51:
	ldrsw	x2, [x22, 16]
	cmp	x2, x0
	bgt	.L7
	b	.L54
.L31:
	adrp	x28, .LANCHOR1
	add	x25, x28, :lo12:.LANCHOR1
	mov	x4, 0
	mov	x3, 0
	mov	x1, 0
.L9:
	ldr	w2, [x22, 16]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	x0, 1
	mov	w3, 0
	.align 5
.L14:
	ldrh	w2, [x25, w3, sxtw 1]
	ldrh	w1, [x25, x0, lsl 1]
	cmp	w2, w1
	csel	w3, w3, w0, cs
	add	x0, x0, 1
	cmp	x0, 1000
	bne	.L14
	adrp	x2, .LANCHOR2
	add	x0, x25, 1984
	mov	w1, 0
	ldr	q30, [x2, :lo12:.LANCHOR2]
	b	.L16
.L20:
	add	w1, w1, 8
	sub	x0, x0, #16
	cmp	w1, 992
	beq	.L55
.L16:
	ldr	q31, [x0]
	tbl	v31.16b, {v31.16b}, v30.16b
	cmtst	v31.8h, v31.8h, v31.8h
	umaxp	v31.4s, v31.4s, v31.4s
	fmov	x2, d31
	cbz	x2, .L20
	mov	w0, 999
	sub	w0, w0, w1
	mov	w1, w0
.L21:
	sxtw	x0, w0
	sub	w1, w1, #1
	sub	x2, x0, #1
	sub	x1, x2, x1
	b	.L18
.L57:
	sub	x0, x0, #1
	cmp	x0, x1
	beq	.L56
.L18:
	ldrh	w5, [x25, x0, lsl 1]
	cbz	w5, .L57
	mov	w4, w0
.L19:
	ldrh	w2, [x25, 12]
	adrp	x0, .LC4
	ldrh	w1, [x25, 4]
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	x0, 0
	mov	x3, -1
	mov	x2, 60817
	.align 5
.L22:
	smaddl	x1, w0, w0, x3
	mul	x1, x1, x0
	str	x1, [x26, x0, lsl 3]
	add	x0, x0, 997
	cmp	x0, x2
	bne	.L22
	add	x3, x26, 483328
	mov	x0, 0
	add	x3, x3, 3208
	mov	x2, 7976
	.align 5
.L23:
	lsl	x1, x0, 3
	sub	x0, x1, x0
	ldr	x1, [x24]
	add	x24, x24, x2
	add	x0, x0, x1
	cmp	x3, x24
	bne	.L23
	add	x26, x26, 229376
	ldr	x2, [x19, 19808]
	ldr	x1, [x26, 10624]
	ldr	x3, [x19, 21240]
	add	x1, x3, x1
	add	x1, x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w9, 34079
	mov	x11, x23
	mov	w6, 102
	mov	w5, 0
	mov	w4, 0
	mov	w10, 0
	movk	w9, 0x51eb, lsl 16
	mov	w8, 200
	mov	x12, 8400
	.align 5
.L24:
	neg	w7, w10
	mov	w1, w4
	mov	x2, x11
	mov	w3, 0
	.align 5
.L25:
	sub	w0, w5, w1
	strh	w0, [x2, 4]
	umull	x0, w1, w9
	str	w3, [x2]
	str	w7, [x2, 8]
	add	w3, w3, w4
	add	x2, x2, 36
	lsr	x0, x0, 38
	msub	w0, w0, w8, w1
	add	w1, w1, 3
	sub	w0, w0, #100
	strb	w0, [x2, -30]
	cmp	w1, w6
	bne	.L25
	add	w10, w10, 7
	add	x11, x11, x12
	add	w4, w4, 21
	add	w5, w5, 28
	add	w6, w1, 21
	cmp	w10, 301
	bne	.L24
	add	x6, x23, 360448
	add	x4, x23, 1224
	add	x6, x6, 776
	mov	x1, 0
	mov	x5, 6000
	.align 5
.L26:
	sub	x2, x4, #1224
	.align 5
.L27:
	ldr	w3, [x2]
	add	x1, x1, x1, lsl 1
	ldrsh	w0, [x2, 4]
	add	x2, x2, 36
	add	w0, w0, w3
	ldrsb	w3, [x2, -30]
	add	w0, w0, w3
	ldr	w3, [x2, -28]
	add	w0, w0, w3
	add	x1, x0, x1
	cmp	x4, x2
	bne	.L27
	add	x4, x4, x5
	cmp	x6, x4
	bne	.L26
	add	x23, x23, 352256
	ldr	w2, [x21, 15932]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	ldrsb	w3, [x23, 1738]
	bl	printf
	mov	x0, 3392
	movk	x0, 0x3, lsl 16
	bl	malloc
	mov	x23, x0
	cbz	x0, .L33
	mov	x2, 3392
	mov	w1, 92
	movk	x2, 0x3, lsl 16
	bl	memset
	mov	x1, 3392
	mov	x21, 0
	mov	x0, 0
	movk	x1, 0x3, lsl 16
	.align 5
.L30:
	ldrb	w2, [x23, x0]
	add	x2, x2, x0
	add	x0, x0, 1000
	add	x21, x21, x2
	cmp	x0, x1
	bne	.L30
	mov	x0, x23
	bl	free
	ldr	x3, [x19, 21240]
	mov	x1, x21
	ldp	w6, w7, [x22, 8]
	adrp	x0, .LC7
	ldp	w4, w5, [x22]
	add	x0, x0, :lo12:.LC7
	ldrb	w2, [x20, 2544]
	bl	printf
	mov	w0, 0
.L1:
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 96
	ret
.L32:
	mov	x4, 0
	mov	x3, 0
	mov	x1, 0
	b	.L10
.L55:
	mov	w1, 7
	mov	w0, w1
	b	.L21
.L56:
	ldrh	w5, [x28, :lo12:.LANCHOR1]
	mov	w4, 0
	b	.L19
.L33:
	mov	w0, 1
	b	.L1
	.global	marker
	.global	grid
	.global	wide
	.section .rodata
	.align	4
	.LANCHOR2:
.LC3:
	.byte	14
	.byte	15
	.byte	12
	.byte	13
	.byte	10
	.byte	11
	.byte	8
	.byte	9
	.byte	6
	.byte	7
	.byte	4
	.byte	5
	.byte	2
	.byte	3
	.byte	0
	.byte	1
	.data
	.align	4
	.LANCHOR0:
marker:
	.word	286331153
	.word	572662306
	.word	858993459
	.word	1145324612
limit:
	.word	8000
	.bss
	.align	4
	.LANCHOR1:
counts__0:
	.zero	2000
grid:
	.zero	360000
wide:
	.zero	480000
sieve:
	.zero	150001

