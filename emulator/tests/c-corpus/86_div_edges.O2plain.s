	.text
	.section .rodata
	.align	3
.LC0:
	.string	"w: a b | sdiv srem x-view udiv | C a/b a%%b\n"
	.align	3
.LC1:
	.string	"%d %d | %d %d %lx %u |"
	.align	3
.LC2:
	.string	" %d %d %u\n"
	.align	3
.LC3:
	.string	" hardware only"
	.align	3
.LC4:
	.string	"x: a b | sdiv srem udiv | C a/b a%%b\n"
	.align	3
.LC5:
	.string	"%ld %ld | %ld %ld %lu |"
	.align	3
.LC6:
	.string	" %ld %ld\n"
	.align	3
.LC7:
	.string	"divisor sweep %ld\n"
	.align	3
.LC8:
	.string	"%d: d3 %d d7 %d d10 %d dm5 %d r10 %d rm3 %d u10 %u ur7 %u l %ld %ld %lu\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #128
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	stp	x29, x30, [sp, 48]
	add	x29, sp, 48
	stp	x19, x20, [sp, 64]
	stp	x21, x22, [sp, 80]
	adrp	x21, .LANCHOR0
	mov	w22, 0
	add	x21, x21, :lo12:.LANCHOR0
	stp	x23, x24, [sp, 96]
	adrp	x23, .LC1
	adrp	x24, .LC3
	add	x23, x23, :lo12:.LC1
	add	x24, x24, :lo12:.LC3
	stp	x25, x26, [sp, 112]
	adrp	x26, .LC2
	mov	w25, -2147483648
	add	x26, x26, :lo12:.LC2
	bl	printf
	b	.L4
	.p2align 2,,3
.L2:
	mov	x0, x24
	add	w22, w22, 1
	bl	puts
	cmp	w22, 16
	beq	.L28
.L4:
	sbfiz	x0, x22, 3, 32
	add	x1, x21, x0
	ldr	w20, [x21, x0]
	ldr	w19, [x1, 4]
	mov	w1, w20
// 40 "programs/86_div_edges.c" 1
	sdiv w0, w20, w19
	msub w4, w0, w19, w20
// 0 "" 2
	mov	w2, w19
	mov	x0, x23
// 11 "programs/86_div_edges.c" 1
	sdiv w3, w20, w19
// 0 "" 2
// 60 "programs/86_div_edges.c" 1
	mov x5, -1
	sdiv w5, w20, w19
// 0 "" 2
// 18 "programs/86_div_edges.c" 1
	udiv w6, w20, w19
// 0 "" 2
	bl	printf
	cbz	w19, .L2
	cmp	w20, w25
	ccmn	w19, #1, 0, eq
	beq	.L2
	sdiv	w1, w20, w19
	mov	x0, x26
	add	w22, w22, 1
	udiv	w3, w20, w19
	msub	w2, w1, w19, w20
	msub	w3, w3, w19, w20
	bl	printf
	cmp	w22, 16
	bne	.L4
.L28:
	adrp	x0, .LC4
	adrp	x24, .LC5
	add	x0, x0, :lo12:.LC4
	adrp	x25, .LC3
	adrp	x26, .LC6
	add	x24, x24, :lo12:.LC5
	add	x23, x21, 128
	add	x25, x25, :lo12:.LC3
	add	x26, x26, :lo12:.LC6
	mov	w22, 0
	bl	printf
	b	.L7
	.p2align 2,,3
.L5:
	mov	x0, x25
	add	w22, w22, 1
	bl	puts
	cmp	w22, 8
	beq	.L29
.L7:
	sbfiz	x0, x22, 4, 32
	add	x1, x23, x0
	ldr	x20, [x23, x0]
	ldr	x19, [x1, 8]
	mov	x1, x20
// 49 "programs/86_div_edges.c" 1
	sdiv x0, x20, x19
	msub x4, x0, x19, x20
// 0 "" 2
	mov	x2, x19
	mov	x0, x24
// 25 "programs/86_div_edges.c" 1
	sdiv x3, x20, x19
// 0 "" 2
// 32 "programs/86_div_edges.c" 1
	udiv x5, x20, x19
// 0 "" 2
	bl	printf
	cbz	x19, .L5
	mov	x0, -9223372036854775808
	cmp	x20, x0
	ccmn	x19, #1, 0, eq
	beq	.L5
	sdiv	x1, x20, x19
	mov	x0, x26
	add	w22, w22, 1
	msub	x2, x1, x19, x20
	bl	printf
	cmp	w22, 8
	bne	.L7
.L29:
	mov	x0, -8
	mov	x1, 0
	mov	w5, -2147483648
	mov	w3, 2147483647
	mov	x4, -9223372036854775808
	.p2align 5,,15
.L8:
// 11 "programs/86_div_edges.c" 1
	sdiv w2, w5, w0
// 0 "" 2
	add	x1, x1, w2, sxtw
// 40 "programs/86_div_edges.c" 1
	sdiv w6, w3, w0
	msub w2, w6, w0, w3
// 0 "" 2
	add	x2, x1, w2, sxtw
// 25 "programs/86_div_edges.c" 1
	sdiv x1, x4, x0
// 0 "" 2
	add	x0, x0, 1
	add	x1, x2, x1, asr 32
	cmp	x0, 9
	bne	.L8
	mov	x26, 36837
	adrp	x19, .LC8
	movk	x26, 0x12a2, lsl 16
	mov	w24, 16963
	mov	w23, 21846
	mov	w22, 26215
	mov	w20, 9363
	movk	x26, 0x5f31, lsl 32
	add	x19, x19, :lo12:.LC8
	mov	w25, 0
	movk	w24, 0xf, lsl 16
	movk	w23, 0x5555, lsl 16
	movk	w22, 0x6666, lsl 16
	movk	w20, 0x9249, lsl 16
	movk	x26, 0x8970, lsl 48
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	.p2align 5,,15
.L9:
	add	x0, x21, 256
	mov	x10, 51719
	movk	x10, 0x3b9a, lsl 16
	mov	w4, 10
	ldr	w1, [x0, w25, sxtw 2]
	add	w25, w25, 1
	asr	w9, w1, 31
	smull	x0, w1, w20
	sdiv	w4, w1, w4
	smull	x8, w1, w24
	smull	x2, w1, w23
	lsr	x0, x0, 32
	smull	x5, w1, w22
	add	w0, w1, w0
	lsr	x2, x2, 32
	add	w6, w4, w4, lsl 2
	asr	w3, w0, 2
	umulh	x0, x8, x26
	sub	w2, w2, w9
	asr	x5, x5, 33
	sub	w6, w1, w6, lsl 1
	sub	w5, w9, w5
	lsr	x0, x0, 29
	str	x0, [sp, 32]
	smulh	x0, x8, x26
	add	w7, w2, w2, lsl 1
	sub	w7, w1, w7
	sub	w3, w3, w9
	add	x0, x0, x8
	asr	x0, x0, 29
	sub	x0, x0, x8, asr 63
	msub	x8, x0, x10, x8
	stp	x0, x8, [sp, 16]
	mov	w8, 7
	udiv	w8, w1, w8
	lsl	w0, w8, 3
	sub	w0, w0, w8
	sub	w0, w1, w0
	str	w0, [sp, 8]
	mov	w0, 52429
	movk	w0, 0xcccc, lsl 16
	umull	x0, w1, w0
	lsr	x0, x0, 35
	str	w0, [sp]
	mov	x0, x19
	bl	printf
	cmp	w25, 13
	bne	.L9
	ldp	x29, x30, [sp, 48]
	mov	w0, 0
	ldp	x19, x20, [sp, 64]
	ldp	x21, x22, [sp, 80]
	ldp	x23, x24, [sp, 96]
	ldp	x25, x26, [sp, 112]
	add	sp, sp, 128
	ret
	.data
	.align	4
	.LANCHOR0:
w_pairs:
	.word	-2147483648
	.word	-1
	.word	-2147483648
	.word	1
	.word	-2147483648
	.word	2
	.word	-2147483648
	.word	-2147483648
	.word	2147483647
	.word	-1
	.word	2147483647
	.word	-2147483648
	.word	-1
	.word	-2147483648
	.word	-7
	.word	2
	.word	7
	.word	-2
	.word	-7
	.word	-2
	.word	5
	.word	0
	.word	-5
	.word	0
	.word	0
	.word	0
	.word	-2147483648
	.word	0
	.word	100
	.word	7
	.word	-100
	.word	7
x_pairs:
	.xword	-9223372036854775808
	.xword	-1
	.xword	-9223372036854775808
	.xword	0
	.xword	-9223372036854775808
	.xword	3
	.xword	9223372036854775807
	.xword	-9223372036854775808
	.xword	-9
	.xword	4
	.xword	9
	.xword	-4
	.xword	-1
	.xword	2
	.xword	81985529216486895
	.xword	4096
dividends:
	.word	-2147483648
	.word	-2147483647
	.word	-1000000007
	.word	-10
	.word	-9
	.word	-1
	.word	0
	.word	1
	.word	9
	.word	10
	.word	1000000007
	.word	2147483646
	.word	2147483647

