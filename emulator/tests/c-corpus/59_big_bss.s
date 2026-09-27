	.text
	.global	wide
	.bss
	.align	3
wide:
	.zero	480000
	.global	grid
	.align	3
grid:
	.zero	360000
	.global	marker
	.data
	.align	3
marker:
	.word	286331153
	.word	572662306
	.word	858993459
	.word	1145324612
	.align	2
limit:
	.word	8000
	.text
	.align	2
nonzero:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	x1, [sp]
	str	wzr, [sp, 20]
	str	xzr, [sp, 24]
	b	.L2
.L3:
	ldr	x0, [sp, 24]
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	ldrb	w0, [x0]
	cmp	w0, 0
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 20]
	add	w0, w0, w1
	str	w0, [sp, 20]
	ldr	x0, [sp, 24]
	add	x0, x0, 4096
	str	x0, [sp, 24]
.L2:
	ldr	x1, [sp, 24]
	ldr	x0, [sp]
	cmp	x1, x0
	blt	.L3
	ldr	x0, [sp]
	sub	x0, x0, #1
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	ldrb	w0, [x0]
	cmp	w0, 0
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 20]
	add	w0, w1, w0
	add	sp, sp, 32
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"gaps: twins=%u gap6=%u commonest=%d widest=%d (x%u)\n"
	.text
	.align	2
gap_stats:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	w1, [sp, 24]
	str	wzr, [sp, 40]
	ldr	w0, [sp, 24]
	cmp	w0, 0
	bne	.L6
	adrp	x0, counts__0
	add	x0, x0, :lo12:counts__0
	ldrsw	x1, [sp, 28]
	ldrh	w0, [x0, x1, lsl 1]
	add	w0, w0, 1
	and	w2, w0, 65535
	adrp	x0, counts__0
	add	x0, x0, :lo12:counts__0
	ldrsw	x1, [sp, 28]
	strh	w2, [x0, x1, lsl 1]
	mov	w0, 0
	b	.L7
.L6:
	mov	w0, 1
	str	w0, [sp, 44]
	b	.L8
.L10:
	adrp	x0, counts__0
	add	x0, x0, :lo12:counts__0
	ldrsw	x1, [sp, 44]
	ldrh	w1, [x0, x1, lsl 1]
	adrp	x0, counts__0
	add	x0, x0, :lo12:counts__0
	ldrsw	x2, [sp, 40]
	ldrh	w0, [x0, x2, lsl 1]
	cmp	w1, w0
	bls	.L9
	ldr	w0, [sp, 44]
	str	w0, [sp, 40]
.L9:
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L8:
	ldr	w0, [sp, 44]
	cmp	w0, 999
	ble	.L10
	mov	w0, 999
	str	w0, [sp, 44]
	b	.L11
.L13:
	ldr	w0, [sp, 44]
	sub	w0, w0, #1
	str	w0, [sp, 44]
.L11:
	ldr	w0, [sp, 44]
	cmp	w0, 0
	ble	.L12
	adrp	x0, counts__0
	add	x0, x0, :lo12:counts__0
	ldrsw	x1, [sp, 44]
	ldrh	w0, [x0, x1, lsl 1]
	cmp	w0, 0
	beq	.L13
.L12:
	adrp	x0, counts__0
	add	x0, x0, :lo12:counts__0
	ldrh	w0, [x0, 4]
	mov	w6, w0
	adrp	x0, counts__0
	add	x0, x0, :lo12:counts__0
	ldrh	w0, [x0, 12]
	mov	w2, w0
	adrp	x0, counts__0
	add	x0, x0, :lo12:counts__0
	ldrsw	x1, [sp, 44]
	ldrh	w0, [x0, x1, lsl 1]
	mov	w5, w0
	ldr	w4, [sp, 44]
	ldr	w3, [sp, 40]
	mov	w1, w6
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w0, [sp, 44]
.L7:
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"zero: sieve=%d wide=%d grid=%d\n"
	.align	3
.LC2:
	.string	"edges: wide[0]=%lld grid[0][0].c=%d marker[3]=%x\n"
	.align	3
.LC3:
	.string	"sieve: %ld primes below %d, last=%ld, sum of squares=%llu\n"
	.align	3
.LC4:
	.string	"wide: sum=%llu wide[59820]=%lld wide[59999]=%lld\n"
	.align	3
.LC5:
	.string	"grid: sum=%llu last.d=%x cell[294][99].b=%d\n"
	.align	3
.LC6:
	.string	"heap: sum=%llu, then sieve[last]=%x wide[59999]=%lld marker=%x,%x,%x,%x\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -128]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	str	xzr, [sp, 104]
	str	xzr, [sp, 96]
	mov	x0, 2
	str	x0, [sp, 88]
	str	xzr, [sp, 80]
	str	xzr, [sp, 72]
	str	xzr, [sp, 64]
	str	xzr, [sp, 56]
	mov	x1, 18929
	movk	x1, 0x2, lsl 16
	adrp	x0, sieve
	add	x0, x0, :lo12:sieve
	bl	nonzero
	mov	w19, w0
	mov	x1, 21248
	movk	x1, 0x7, lsl 16
	adrp	x0, wide
	add	x0, x0, :lo12:wide
	bl	nonzero
	mov	w20, w0
	mov	x1, 32320
	movk	x1, 0x5, lsl 16
	adrp	x0, grid
	add	x0, x0, :lo12:grid
	bl	nonzero
	mov	w3, w0
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	adrp	x0, sieve
	add	x0, x0, :lo12:sieve
	add	x0, x0, 147456
	mov	w1, -85
	strb	w1, [x0, 2544]
	adrp	x0, wide
	add	x0, x0, :lo12:wide
	add	x0, x0, 458752
	mov	x1, -1
	str	x1, [x0, 21240]
	adrp	x0, grid
	add	x0, x0, :lo12:grid
	add	x0, x0, 344064
	mov	w1, 48879
	movk	w1, 0x7ead, lsl 16
	str	w1, [x0, 15932]
	adrp	x0, wide
	add	x0, x0, :lo12:wide
	ldr	x1, [x0]
	adrp	x0, grid
	add	x0, x0, :lo12:grid
	ldr	w2, [x0]
	adrp	x0, marker
	add	x0, x0, :lo12:marker
	ldr	w0, [x0, 12]
	mov	w3, w0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	x0, 2
	str	x0, [sp, 120]
	b	.L15
.L19:
	adrp	x0, sieve
	add	x1, x0, :lo12:sieve
	ldr	x0, [sp, 120]
	add	x0, x1, x0
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L16
	ldr	x0, [sp, 120]
	mul	x0, x0, x0
	str	x0, [sp, 112]
	b	.L17
.L18:
	adrp	x0, sieve
	add	x1, x0, :lo12:sieve
	ldr	x0, [sp, 112]
	add	x0, x1, x0
	mov	w1, 1
	strb	w1, [x0]
	ldr	x1, [sp, 112]
	ldr	x0, [sp, 120]
	add	x0, x1, x0
	str	x0, [sp, 112]
.L17:
	adrp	x0, limit
	add	x0, x0, :lo12:limit
	ldr	w0, [x0]
	sxtw	x0, w0
	ldr	x1, [sp, 112]
	cmp	x1, x0
	blt	.L18
.L16:
	ldr	x0, [sp, 120]
	add	x0, x0, 1
	str	x0, [sp, 120]
.L15:
	ldr	x0, [sp, 120]
	mul	x1, x0, x0
	adrp	x0, limit
	add	x0, x0, :lo12:limit
	ldr	w0, [x0]
	sxtw	x0, w0
	cmp	x1, x0
	blt	.L19
	mov	x0, 2
	str	x0, [sp, 120]
	b	.L20
.L24:
	adrp	x0, sieve
	add	x1, x0, :lo12:sieve
	ldr	x0, [sp, 120]
	add	x0, x1, x0
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L41
	ldr	x0, [sp, 104]
	add	x0, x0, 1
	str	x0, [sp, 104]
	ldr	x1, [sp, 120]
	ldr	x0, [sp, 120]
	mul	x0, x1, x0
	ldr	x1, [sp, 80]
	add	x0, x1, x0
	str	x0, [sp, 80]
	ldr	x0, [sp, 120]
	cmp	x0, 2
	ble	.L23
	ldr	x0, [sp, 120]
	mov	w1, w0
	ldr	x0, [sp, 88]
	sub	w0, w1, w0
	mov	w1, 0
	bl	gap_stats
.L23:
	ldr	x0, [sp, 120]
	str	x0, [sp, 88]
	ldr	x0, [sp, 120]
	str	x0, [sp, 96]
	b	.L22
.L41:
	nop
.L22:
	ldr	x0, [sp, 120]
	add	x0, x0, 1
	str	x0, [sp, 120]
.L20:
	adrp	x0, limit
	add	x0, x0, :lo12:limit
	ldr	w0, [x0]
	sxtw	x0, w0
	ldr	x1, [sp, 120]
	cmp	x1, x0
	blt	.L24
	adrp	x0, limit
	add	x0, x0, :lo12:limit
	ldr	w0, [x0]
	ldr	x4, [sp, 80]
	ldr	x3, [sp, 96]
	mov	w2, w0
	ldr	x1, [sp, 104]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w1, 1
	mov	w0, 0
	bl	gap_stats
	str	xzr, [sp, 120]
	b	.L25
.L26:
	ldr	x0, [sp, 120]
	mul	x1, x0, x0
	ldr	x0, [sp, 120]
	mul	x1, x1, x0
	ldr	x0, [sp, 120]
	sub	x2, x1, x0
	adrp	x0, wide
	add	x0, x0, :lo12:wide
	ldr	x1, [sp, 120]
	str	x2, [x0, x1, lsl 3]
	ldr	x0, [sp, 120]
	add	x0, x0, 997
	str	x0, [sp, 120]
.L25:
	ldr	x1, [sp, 120]
	mov	x0, 59999
	cmp	x1, x0
	ble	.L26
	str	xzr, [sp, 120]
	b	.L27
.L28:
	ldr	x1, [sp, 72]
	mov	x0, x1
	lsl	x0, x0, 3
	sub	x0, x0, x1
	adrp	x1, wide
	add	x1, x1, :lo12:wide
	ldr	x2, [sp, 120]
	ldr	x1, [x1, x2, lsl 3]
	add	x0, x0, x1
	str	x0, [sp, 72]
	ldr	x0, [sp, 120]
	add	x0, x0, 997
	str	x0, [sp, 120]
.L27:
	ldr	x1, [sp, 120]
	mov	x0, 59999
	cmp	x1, x0
	ble	.L28
	adrp	x0, wide
	add	x0, x0, :lo12:wide
	add	x0, x0, 458752
	ldr	x0, [x0, 21240]
	mov	x1, x0
	adrp	x0, wide
	add	x0, x0, :lo12:wide
	add	x0, x0, 229376
	ldr	x0, [x0, 10624]
	add	x0, x1, x0
	ldr	x1, [sp, 72]
	add	x0, x1, x0
	str	x0, [sp, 72]
	adrp	x0, wide
	add	x0, x0, :lo12:wide
	add	x0, x0, 458752
	ldr	x1, [x0, 19808]
	adrp	x0, wide
	add	x0, x0, :lo12:wide
	add	x0, x0, 458752
	ldr	x0, [x0, 21240]
	mov	x3, x0
	mov	x2, x1
	ldr	x1, [sp, 72]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	str	wzr, [sp, 52]
	b	.L29
.L32:
	str	wzr, [sp, 48]
	b	.L30
.L31:
	ldr	w1, [sp, 52]
	ldr	w0, [sp, 48]
	mul	w4, w1, w0
	adrp	x0, grid
	add	x3, x0, :lo12:grid
	ldrsw	x1, [sp, 48]
	ldrsw	x2, [sp, 52]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x2
	lsl	x1, x1, 2
	add	x1, x1, x2
	lsl	x2, x1, 4
	sub	x2, x2, x1
	lsl	x1, x2, 4
	mov	x2, x1
	add	x0, x0, x2
	add	x0, x3, x0
	str	w4, [x0]
	ldr	w0, [sp, 52]
	and	w1, w0, 65535
	ldr	w0, [sp, 48]
	and	w0, w0, 65535
	sub	w0, w1, w0
	and	w0, w0, 65535
	sxth	w4, w0
	adrp	x0, grid
	add	x3, x0, :lo12:grid
	ldrsw	x1, [sp, 48]
	ldrsw	x2, [sp, 52]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x2
	lsl	x1, x1, 2
	add	x1, x1, x2
	lsl	x2, x1, 4
	sub	x2, x2, x1
	lsl	x1, x2, 4
	mov	x2, x1
	add	x0, x0, x2
	add	x0, x3, x0
	mov	w1, w4
	strh	w1, [x0, 4]
	ldr	w1, [sp, 52]
	mov	w0, w1
	lsl	w0, w0, 1
	add	w1, w0, w1
	ldr	w0, [sp, 48]
	add	w0, w1, w0
	mov	w1, 200
	sdiv	w2, w0, w1
	mov	w1, 200
	mul	w1, w2, w1
	sub	w0, w0, w1
	and	w0, w0, 255
	sub	w0, w0, #100
	and	w0, w0, 255
	sxtb	w4, w0
	adrp	x0, grid
	add	x3, x0, :lo12:grid
	ldrsw	x1, [sp, 48]
	ldrsw	x2, [sp, 52]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x2
	lsl	x1, x1, 2
	add	x1, x1, x2
	lsl	x2, x1, 4
	sub	x2, x2, x1
	lsl	x1, x2, 4
	mov	x2, x1
	add	x0, x0, x2
	add	x0, x3, x0
	mov	w1, w4
	strb	w1, [x0, 6]
	ldr	w0, [sp, 52]
	neg	w4, w0
	adrp	x0, grid
	add	x3, x0, :lo12:grid
	ldrsw	x1, [sp, 48]
	ldrsw	x2, [sp, 52]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x2
	lsl	x1, x1, 2
	add	x1, x1, x2
	lsl	x2, x1, 4
	sub	x2, x2, x1
	lsl	x1, x2, 4
	mov	x2, x1
	add	x0, x0, x2
	add	x0, x3, x0
	str	w4, [x0, 8]
	ldr	w0, [sp, 48]
	add	w0, w0, 3
	str	w0, [sp, 48]
.L30:
	ldr	w0, [sp, 48]
	cmp	w0, 99
	ble	.L31
	ldr	w0, [sp, 52]
	add	w0, w0, 7
	str	w0, [sp, 52]
.L29:
	ldr	w0, [sp, 52]
	cmp	w0, 299
	ble	.L32
	str	wzr, [sp, 52]
	b	.L33
.L36:
	str	wzr, [sp, 48]
	b	.L34
.L35:
	ldr	x1, [sp, 64]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x3, x0, x1
	adrp	x0, grid
	add	x4, x0, :lo12:grid
	ldrsw	x1, [sp, 48]
	ldrsw	x2, [sp, 52]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x2
	lsl	x1, x1, 2
	add	x1, x1, x2
	lsl	x2, x1, 4
	sub	x2, x2, x1
	lsl	x1, x2, 4
	mov	x2, x1
	add	x0, x0, x2
	add	x0, x4, x0
	ldr	w4, [x0]
	adrp	x0, grid
	add	x5, x0, :lo12:grid
	ldrsw	x1, [sp, 48]
	ldrsw	x2, [sp, 52]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x2
	lsl	x1, x1, 2
	add	x1, x1, x2
	lsl	x2, x1, 4
	sub	x2, x2, x1
	lsl	x1, x2, 4
	mov	x2, x1
	add	x0, x0, x2
	add	x0, x5, x0
	ldrsh	w0, [x0, 4]
	add	w4, w4, w0
	adrp	x0, grid
	add	x5, x0, :lo12:grid
	ldrsw	x1, [sp, 48]
	ldrsw	x2, [sp, 52]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x2
	lsl	x1, x1, 2
	add	x1, x1, x2
	lsl	x2, x1, 4
	sub	x2, x2, x1
	lsl	x1, x2, 4
	mov	x2, x1
	add	x0, x0, x2
	add	x0, x5, x0
	ldrsb	w0, [x0, 6]
	add	w4, w4, w0
	adrp	x0, grid
	add	x5, x0, :lo12:grid
	ldrsw	x1, [sp, 48]
	ldrsw	x2, [sp, 52]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x2
	lsl	x1, x1, 2
	add	x1, x1, x2
	lsl	x2, x1, 4
	sub	x2, x2, x1
	lsl	x1, x2, 4
	mov	x2, x1
	add	x0, x0, x2
	add	x0, x5, x0
	ldr	w0, [x0, 8]
	add	w0, w4, w0
	uxtw	x0, w0
	add	x0, x3, x0
	str	x0, [sp, 64]
	ldr	w0, [sp, 48]
	add	w0, w0, 3
	str	w0, [sp, 48]
.L34:
	ldr	w0, [sp, 48]
	cmp	w0, 99
	ble	.L35
	ldr	w0, [sp, 52]
	add	w0, w0, 5
	str	w0, [sp, 52]
.L33:
	ldr	w0, [sp, 52]
	cmp	w0, 299
	ble	.L36
	adrp	x0, grid
	add	x0, x0, :lo12:grid
	add	x0, x0, 344064
	ldr	w1, [x0, 15932]
	adrp	x0, grid
	add	x0, x0, :lo12:grid
	add	x0, x0, 352256
	ldrsb	w0, [x0, 1738]
	mov	w3, w0
	mov	w2, w1
	ldr	x1, [sp, 64]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	x0, 3392
	movk	x0, 0x3, lsl 16
	bl	malloc
	str	x0, [sp, 40]
	ldr	x0, [sp, 40]
	cmp	x0, 0
	bne	.L37
	mov	w0, 1
	b	.L38
.L37:
	mov	x2, 3392
	movk	x2, 0x3, lsl 16
	mov	w1, 92
	ldr	x0, [sp, 40]
	bl	memset
	str	xzr, [sp, 120]
	b	.L39
.L40:
	ldr	x0, [sp, 120]
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	ldrb	w0, [x0]
	and	x1, x0, 255
	ldr	x0, [sp, 120]
	add	x0, x1, x0
	ldr	x1, [sp, 56]
	add	x0, x1, x0
	str	x0, [sp, 56]
	ldr	x0, [sp, 120]
	add	x0, x0, 1000
	str	x0, [sp, 120]
.L39:
	ldr	x1, [sp, 120]
	mov	x0, 3391
	movk	x0, 0x3, lsl 16
	cmp	x1, x0
	ble	.L40
	ldr	x0, [sp, 40]
	bl	free
	adrp	x0, sieve
	add	x0, x0, :lo12:sieve
	add	x0, x0, 147456
	ldrb	w0, [x0, 2544]
	mov	w8, w0
	adrp	x0, wide
	add	x0, x0, :lo12:wide
	add	x0, x0, 458752
	ldr	x1, [x0, 21240]
	adrp	x0, marker
	add	x0, x0, :lo12:marker
	ldr	w2, [x0]
	adrp	x0, marker
	add	x0, x0, :lo12:marker
	ldr	w3, [x0, 4]
	adrp	x0, marker
	add	x0, x0, :lo12:marker
	ldr	w4, [x0, 8]
	adrp	x0, marker
	add	x0, x0, :lo12:marker
	ldr	w0, [x0, 12]
	mov	w7, w0
	mov	w6, w4
	mov	w5, w3
	mov	w4, w2
	mov	x3, x1
	mov	w2, w8
	ldr	x1, [sp, 56]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	w0, 0
.L38:
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 128
	ret


	.bss
	.balign 8
sieve:
	.skip 150001
	.balign 8
counts__0:
	.skip 2000
