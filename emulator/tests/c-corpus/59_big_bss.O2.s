	.text
	.align	2
	.p2align 5,,15
nonzero:
	mov	w3, 0
	mov	x2, 0
	.p2align 5,,15
.L2:
	ldrb	w4, [x0, x2]
	add	x2, x2, 4096
	cmp	w4, 0
	cinc	w3, w3, ne
	cmp	x1, x2
	bgt	.L2
	add	x0, x0, x1
	ldrb	w0, [x0, -1]
	cmp	w0, 0
	cinc	w0, w3, ne
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"gaps: twins=%u gap6=%u commonest=%d widest=%d (x%u)\n"
	.text
	.align	2
	.p2align 5,,15
gap_stats.isra.0:
	cbz	w1, .L22
	adrp	x6, .LANCHOR0
	add	x1, x6, :lo12:.LANCHOR0
	mov	x0, 1
	mov	w3, 0
	.p2align 5,,15
.L6:
	ldrh	w4, [x1, x0, lsl 1]
	ldrh	w2, [x1, w3, sxtw 1]
	cmp	w4, w2
	csel	w3, w3, w0, ls
	add	x0, x0, 1
	cmp	x0, 1000
	bne	.L6
	adrp	x4, .LANCHOR1
	add	x2, x1, 1984
	mov	w0, 0
	ldr	q30, [x4, :lo12:.LANCHOR1]
	b	.L10
	.p2align 2,,3
.L14:
	add	w0, w0, 8
	sub	x2, x2, #16
	cmp	w0, 992
	beq	.L23
.L10:
	ldr	q31, [x2]
	tbl	v31.16b, {v31.16b}, v30.16b
	cmtst	v31.8h, v31.8h, v31.8h
	umaxp	v31.4s, v31.4s, v31.4s
	fmov	x4, d31
	cbz	x4, .L14
	mov	w4, 999
	sub	w4, w4, w0
	mov	w2, w4
.L15:
	sxtw	x4, w4
	sub	w2, w2, #1
	sub	x0, x4, #1
	sub	x0, x0, x2
	b	.L12
	.p2align 2,,3
.L25:
	sub	x4, x4, #1
	cmp	x4, x0
	beq	.L24
.L12:
	ldrh	w5, [x1, x4, lsl 1]
	cbz	w5, .L25
	ldrh	w2, [x1, 12]
	adrp	x0, .LC1
	ldrh	w1, [x1, 4]
	add	x0, x0, :lo12:.LC1
	b	printf
.L22:
	adrp	x1, .LANCHOR0
	add	x1, x1, :lo12:.LANCHOR0
	ldrh	w2, [x1, w0, sxtw 1]
	add	w2, w2, 1
	strh	w2, [x1, w0, sxtw 1]
	ret
.L24:
	ldrh	w2, [x1, 12]
	mov	w4, 0
	ldrh	w5, [x6, :lo12:.LANCHOR0]
	adrp	x0, .LC1
	ldrh	w1, [x1, 4]
	add	x0, x0, :lo12:.LC1
	b	printf
.L23:
	mov	w2, 7
	mov	w4, w2
	b	.L15
	.section .rodata
	.align	3
.LC2:
	.string	"zero: sieve=%d wide=%d grid=%d\n"
	.align	3
.LC3:
	.string	"edges: wide[0]=%lld grid[0][0].c=%d marker[3]=%x\n"
	.align	3
.LC4:
	.string	"sieve: %ld primes below %d, last=%ld, sum of squares=%llu\n"
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
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -96]!
	mov	x1, 18929
	movk	x1, 0x2, lsl 16
	mov	x29, sp
	stp	x25, x26, [sp, 64]
	adrp	x26, sieve
	add	x26, x26, :lo12:sieve
	adrp	x25, wide
	mov	x0, x26
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	add	x21, x26, 147456
	stp	x23, x24, [sp, 48]
	add	x24, x25, :lo12:wide
	adrp	x23, .LANCHOR2
	stp	x27, x28, [sp, 80]
	bl	nonzero
	mov	x1, 21248
	mov	w5, w0
	movk	x1, 0x7, lsl 16
	mov	x0, x24
	bl	nonzero
	mov	w6, w0
	add	x23, x23, :lo12:.LANCHOR2
	adrp	x27, grid
	mov	x1, 32320
	add	x19, x27, :lo12:grid
	movk	x1, 0x5, lsl 16
	mov	x0, x19
	bl	nonzero
	mov	w2, w6
	mov	w3, w0
	mov	w1, w5
	add	x20, x24, 458752
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	add	x22, x19, 344064
	mov	w0, -85
	ldr	w2, [x27, :lo12:grid]
	ldr	x1, [x25, :lo12:wide]
	strb	w0, [x21, 2544]
	ldr	w3, [x23, 12]
	mov	x0, -1
	str	x0, [x20, 21240]
	mov	w0, 48879
	movk	w0, 0x7ead, lsl 16
	str	w0, [x22, 15932]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w0, [x23, 16]
	cmp	w0, 4
	ble	.L27
	mov	x1, 2
	mov	x0, 4
	mov	w3, 1
	b	.L30
.L59:
	add	x1, x1, 1
	ldrsw	x2, [x23, 16]
	smull	x0, w1, w1
	cmp	x0, x2
	bge	.L27
.L30:
	ldrb	w2, [x26, x1]
	cbz	w2, .L57
	add	x1, x1, 1
	ldrsw	x2, [x23, 16]
	smull	x0, w1, w1
	cmp	x0, x2
	blt	.L30
.L27:
	ldr	w0, [x23, 16]
	cmp	w0, 2
	ble	.L44
	ldrb	w0, [x26, 2]
	cbnz	w0, .L45
	mov	x28, 4
	mov	x3, 2
	mov	x27, 1
	mov	x0, 2
.L34:
	mov	x25, x0
.L33:
	ldrsw	x1, [x23, 16]
	add	x25, x25, 1
	cmp	x1, x25
	ble	.L31
	ldrb	w1, [x26, x25]
	cbnz	w1, .L33
	sub	w0, w25, w0
	bl	gap_stats.isra.0
	umaddl	x28, w25, w25, x28
	add	x27, x27, 1
	mov	x0, x25
	mov	x3, x25
	b	.L34
.L29:
	strb	w3, [x26, x0]
	add	x0, x0, x1
.L57:
	ldrsw	x2, [x23, 16]
	cmp	x2, x0
	bgt	.L29
	b	.L59
.L44:
	mov	x28, 0
	mov	x3, 0
	mov	x27, 0
.L31:
	ldr	w2, [x23, 16]
	mov	x4, x28
	mov	x1, x27
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, 0
	mov	w1, 1
	bl	gap_stats.isra.0
	mov	x0, 0
	mov	x3, -1
	mov	x2, 60817
	.p2align 5,,15
.L35:
	smaddl	x1, w0, w0, x3
	mul	x1, x1, x0
	str	x1, [x24, x0, lsl 3]
	add	x0, x0, 997
	cmp	x0, x2
	bne	.L35
	add	x4, x24, 483328
	mov	x1, x24
	add	x4, x4, 3208
	mov	x0, 0
	mov	x3, 7976
	.p2align 5,,15
.L36:
	lsl	x2, x0, 3
	sub	x0, x2, x0
	ldr	x2, [x1]
	add	x1, x1, x3
	add	x0, x0, x2
	cmp	x1, x4
	bne	.L36
	add	x24, x24, 229376
	ldr	x2, [x20, 19808]
	ldr	x1, [x24, 10624]
	ldr	x3, [x20, 21240]
	add	x1, x3, x1
	add	x1, x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w9, 34079
	mov	x11, x19
	mov	w6, 102
	mov	w5, 0
	mov	w4, 0
	mov	w10, 0
	movk	w9, 0x51eb, lsl 16
	mov	w8, 200
	mov	x12, 8400
	.p2align 5,,15
.L37:
	neg	w7, w10
	mov	w2, w4
	mov	x1, x11
	mov	w3, 0
	.p2align 5,,15
.L38:
	sub	w0, w5, w2
	strh	w0, [x1, 4]
	umull	x0, w2, w9
	str	w3, [x1]
	str	w7, [x1, 8]
	add	w3, w3, w4
	add	x1, x1, 36
	lsr	x0, x0, 38
	msub	w0, w0, w8, w2
	add	w2, w2, 3
	sub	w0, w0, #100
	strb	w0, [x1, -30]
	cmp	w6, w2
	bne	.L38
	add	w10, w10, 7
	add	x11, x11, x12
	add	w4, w4, 21
	add	w5, w5, 28
	add	w6, w6, 21
	cmp	w10, 301
	bne	.L37
	add	x6, x19, 360448
	add	x4, x19, 1224
	add	x6, x6, 776
	mov	x1, 0
	mov	x5, 6000
	.p2align 5,,15
.L39:
	sub	x2, x4, #1224
	.p2align 5,,15
.L40:
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
	cmp	x2, x4
	bne	.L40
	add	x4, x2, x5
	cmp	x6, x4
	bne	.L39
	add	x19, x19, 352256
	ldr	w2, [x22, 15932]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	ldrsb	w3, [x19, 1738]
	bl	printf
	mov	x0, 3392
	movk	x0, 0x3, lsl 16
	bl	malloc
	mov	x22, x0
	cbz	x0, .L46
	mov	x2, 3392
	mov	w1, 92
	movk	x2, 0x3, lsl 16
	bl	memset
	mov	x1, 3392
	mov	x19, 0
	mov	x0, 0
	movk	x1, 0x3, lsl 16
	.p2align 5,,15
.L43:
	ldrb	w2, [x22, x0]
	add	x2, x2, x0
	add	x0, x0, 1000
	add	x19, x19, x2
	cmp	x0, x1
	bne	.L43
	mov	x0, x22
	bl	free
	ldr	x3, [x20, 21240]
	mov	x1, x19
	ldp	w6, w7, [x23, 8]
	adrp	x0, .LC7
	ldp	w4, w5, [x23]
	add	x0, x0, :lo12:.LC7
	ldrb	w2, [x21, 2544]
	bl	printf
	mov	w0, 0
.L26:
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 96
	ret
.L45:
	mov	x28, 0
	mov	x3, 0
	mov	x27, 0
	mov	x0, 2
	b	.L34
.L46:
	mov	w0, 1
	b	.L26
	.global	marker
	.global	grid
	.global	wide
	.section .rodata
	.align	4
	.LANCHOR1:
.LC0:
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
	.LANCHOR2:
marker:
	.word	286331153
	.word	572662306
	.word	858993459
	.word	1145324612
limit:
	.word	8000
	.bss
	.align	4
	.LANCHOR0:
counts.0:
	.zero	2000
grid:
	.zero	360000
wide:
	.zero	480000
sieve:
	.zero	150001

