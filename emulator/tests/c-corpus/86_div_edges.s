	.text
	.align	2
sdiv_w:
	sub	sp, sp, #32
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 12]
	ldr	w1, [sp, 8]
// 11 "programs/86_div_edges.c" 1
	sdiv w0, w0, w1
// 0 "" 2
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
udiv_w:
	sub	sp, sp, #32
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 12]
	ldr	w1, [sp, 8]
// 18 "programs/86_div_edges.c" 1
	udiv w0, w0, w1
// 0 "" 2
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
sdiv_x:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldr	x1, [sp]
// 25 "programs/86_div_edges.c" 1
	sdiv x0, x0, x1
// 0 "" 2
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
udiv_x:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldr	x1, [sp]
// 32 "programs/86_div_edges.c" 1
	udiv x0, x0, x1
// 0 "" 2
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
srem_w:
	sub	sp, sp, #32
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 12]
	ldr	w1, [sp, 8]
// 40 "programs/86_div_edges.c" 1
	sdiv w2, w0, w1
	msub w0, w2, w1, w0
// 0 "" 2
	str	w2, [sp, 28]
	str	w0, [sp, 24]
	ldr	w0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
srem_x:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldr	x1, [sp]
// 49 "programs/86_div_edges.c" 1
	sdiv x2, x0, x1
	msub x0, x2, x1, x0
// 0 "" 2
	str	x2, [sp, 24]
	str	x0, [sp, 16]
	ldr	x0, [sp, 16]
	add	sp, sp, 32
	ret
	.align	2
sdiv_w_seen_as_x:
	sub	sp, sp, #32
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 12]
	ldr	w1, [sp, 8]
// 60 "programs/86_div_edges.c" 1
	mov x2, -1
	sdiv w2, w0, w1
// 0 "" 2
	str	x2, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.data
	.align	3
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
	.align	3
x_pairs:
	.quad	-9223372036854775808
	.quad	-1
	.quad	-9223372036854775808
	.quad	0
	.quad	-9223372036854775808
	.quad	3
	.quad	9223372036854775807
	.quad	-9223372036854775808
	.quad	-9
	.quad	4
	.quad	9
	.quad	-4
	.quad	-1
	.quad	2
	.quad	81985529216486895
	.quad	4096
	.align	3
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
	.string	" hardware only\n"
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
	.global	main
main:
	sub	sp, sp, #176
	stp	x29, x30, [sp, 48]
	add	x29, sp, 48
	stp	x19, x20, [sp, 64]
	str	x21, [sp, 80]
	mov	w0, 16
	str	w0, [sp, 148]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	str	wzr, [sp, 172]
	b	.L16
.L20:
	adrp	x0, w_pairs
	add	x1, x0, :lo12:w_pairs
	ldrsw	x0, [sp, 172]
	lsl	x0, x0, 3
	add	x0, x1, x0
	ldr	w0, [x0]
	str	w0, [sp, 108]
	adrp	x0, w_pairs
	add	x1, x0, :lo12:w_pairs
	ldrsw	x0, [sp, 172]
	lsl	x0, x0, 3
	add	x0, x1, x0
	ldr	w0, [x0, 4]
	str	w0, [sp, 104]
	ldr	w1, [sp, 104]
	ldr	w0, [sp, 108]
	bl	sdiv_w
	mov	w19, w0
	ldr	w1, [sp, 104]
	ldr	w0, [sp, 108]
	bl	srem_w
	mov	w20, w0
	ldr	w1, [sp, 104]
	ldr	w0, [sp, 108]
	bl	sdiv_w_seen_as_x
	mov	x21, x0
	ldr	w0, [sp, 108]
	ldr	w1, [sp, 104]
	bl	udiv_w
	mov	w6, w0
	mov	x5, x21
	mov	w4, w20
	mov	w3, w19
	ldr	w2, [sp, 104]
	ldr	w1, [sp, 108]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 104]
	cmp	w0, 0
	beq	.L17
	ldr	w1, [sp, 108]
	mov	w0, -2147483648
	cmp	w1, w0
	bne	.L18
	ldr	w0, [sp, 104]
	cmn	w0, #1
	beq	.L17
.L18:
	ldr	w1, [sp, 108]
	ldr	w0, [sp, 104]
	sdiv	w4, w1, w0
	ldr	w0, [sp, 108]
	ldr	w1, [sp, 104]
	sdiv	w2, w0, w1
	ldr	w1, [sp, 104]
	mul	w1, w2, w1
	sub	w5, w0, w1
	ldr	w0, [sp, 108]
	ldr	w1, [sp, 104]
	udiv	w2, w0, w1
	mul	w1, w2, w1
	sub	w0, w0, w1
	mov	w3, w0
	mov	w2, w5
	mov	w1, w4
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	b	.L19
.L17:
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
.L19:
	ldr	w0, [sp, 172]
	add	w0, w0, 1
	str	w0, [sp, 172]
.L16:
	ldr	w1, [sp, 172]
	ldr	w0, [sp, 148]
	cmp	w1, w0
	blt	.L20
	mov	w0, 8
	str	w0, [sp, 148]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	str	wzr, [sp, 168]
	b	.L21
.L25:
	adrp	x0, x_pairs
	add	x1, x0, :lo12:x_pairs
	ldrsw	x0, [sp, 168]
	lsl	x0, x0, 4
	add	x0, x1, x0
	ldr	x0, [x0]
	str	x0, [sp, 120]
	adrp	x0, x_pairs
	add	x1, x0, :lo12:x_pairs
	ldrsw	x0, [sp, 168]
	lsl	x0, x0, 4
	add	x0, x1, x0
	ldr	x0, [x0, 8]
	str	x0, [sp, 112]
	ldr	x1, [sp, 112]
	ldr	x0, [sp, 120]
	bl	sdiv_x
	mov	x19, x0
	ldr	x1, [sp, 112]
	ldr	x0, [sp, 120]
	bl	srem_x
	mov	x20, x0
	ldr	x0, [sp, 120]
	ldr	x1, [sp, 112]
	bl	udiv_x
	mov	x5, x0
	mov	x4, x20
	mov	x3, x19
	ldr	x2, [sp, 112]
	ldr	x1, [sp, 120]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	x0, [sp, 112]
	cmp	x0, 0
	beq	.L22
	ldr	x1, [sp, 120]
	mov	x0, -9223372036854775808
	cmp	x1, x0
	bne	.L23
	ldr	x0, [sp, 112]
	cmn	x0, #1
	beq	.L22
.L23:
	ldr	x1, [sp, 120]
	ldr	x0, [sp, 112]
	sdiv	x3, x1, x0
	ldr	x0, [sp, 120]
	ldr	x1, [sp, 112]
	sdiv	x2, x0, x1
	ldr	x1, [sp, 112]
	mul	x1, x2, x1
	sub	x0, x0, x1
	mov	x2, x0
	mov	x1, x3
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	b	.L24
.L22:
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
.L24:
	ldr	w0, [sp, 168]
	add	w0, w0, 1
	str	w0, [sp, 168]
.L21:
	ldr	w1, [sp, 168]
	ldr	w0, [sp, 148]
	cmp	w1, w0
	blt	.L25
	str	xzr, [sp, 160]
	mov	w0, -8
	str	w0, [sp, 156]
	b	.L26
.L27:
	ldr	w1, [sp, 156]
	mov	w0, -2147483648
	bl	sdiv_w
	sxtw	x0, w0
	ldr	x1, [sp, 160]
	add	x0, x1, x0
	str	x0, [sp, 160]
	ldr	w1, [sp, 156]
	mov	w0, 2147483647
	bl	srem_w
	sxtw	x0, w0
	ldr	x1, [sp, 160]
	add	x0, x1, x0
	str	x0, [sp, 160]
	ldrsw	x0, [sp, 156]
	mov	x1, x0
	mov	x0, -9223372036854775808
	bl	sdiv_x
	asr	x0, x0, 32
	ldr	x1, [sp, 160]
	add	x0, x1, x0
	str	x0, [sp, 160]
	ldr	w0, [sp, 156]
	add	w0, w0, 1
	str	w0, [sp, 156]
.L26:
	ldr	w0, [sp, 156]
	cmp	w0, 8
	ble	.L27
	ldr	x1, [sp, 160]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	mov	w0, 13
	str	w0, [sp, 148]
	str	wzr, [sp, 152]
	b	.L28
.L29:
	adrp	x0, dividends
	add	x0, x0, :lo12:dividends
	ldrsw	x1, [sp, 152]
	ldr	w0, [x0, x1, lsl 2]
	str	w0, [sp, 144]
	ldr	w0, [sp, 144]
	str	w0, [sp, 140]
	ldrsw	x1, [sp, 144]
	mov	x0, 16963
	movk	x0, 0xf, lsl 16
	mul	x0, x1, x0
	str	x0, [sp, 128]
	ldr	w0, [sp, 144]
	mov	w1, 21846
	movk	w1, 0x5555, lsl 16
	smull	x1, w0, w1
	lsr	x1, x1, 32
	asr	w0, w0, 31
	sub	w8, w1, w0
	ldr	w0, [sp, 144]
	mov	w1, 9363
	movk	w1, 0x9249, lsl 16
	smull	x1, w0, w1
	lsr	x1, x1, 32
	add	w1, w0, w1
	asr	w1, w1, 2
	asr	w0, w0, 31
	sub	w9, w1, w0
	ldr	w0, [sp, 144]
	mov	w1, 26215
	movk	w1, 0x6666, lsl 16
	smull	x1, w0, w1
	lsr	x1, x1, 32
	asr	w1, w1, 2
	asr	w0, w0, 31
	sub	w4, w1, w0
	ldr	w0, [sp, 144]
	mov	w1, 26215
	movk	w1, 0x6666, lsl 16
	smull	x1, w0, w1
	lsr	x1, x1, 32
	asr	w1, w1, 1
	asr	w0, w0, 31
	sub	w5, w0, w1
	ldr	w1, [sp, 144]
	mov	w0, 10
	sdiv	w2, w1, w0
	mov	w0, w2
	lsl	w0, w0, 2
	add	w0, w0, w2
	lsl	w0, w0, 1
	sub	w6, w1, w0
	ldr	w1, [sp, 144]
	mov	w0, 21846
	movk	w0, 0x5555, lsl 16
	smull	x0, w1, w0
	lsr	x2, x0, 32
	asr	w0, w1, 31
	sub	w2, w2, w0
	mov	w0, w2
	lsl	w0, w0, 1
	add	w0, w0, w2
	sub	w2, w1, w0
	ldr	w1, [sp, 140]
	mov	w0, 52429
	movk	w0, 0xcccc, lsl 16
	umull	x0, w1, w0
	lsr	x0, x0, 32
	lsr	w7, w0, 3
	ldr	w1, [sp, 140]
	mov	w0, 7
	udiv	w3, w1, w0
	mov	w0, w3
	lsl	w0, w0, 3
	sub	w0, w0, w3
	sub	w10, w1, w0
	ldr	x0, [sp, 128]
	mov	x1, 36837
	movk	x1, 0x12a2, lsl 16
	movk	x1, 0x5f31, lsl 32
	movk	x1, 0x8970, lsl 48
	smulh	x1, x0, x1
	add	x1, x1, x0
	asr	x1, x1, 29
	asr	x0, x0, 63
	sub	x11, x1, x0
	ldr	x0, [sp, 128]
	mov	x1, 36837
	movk	x1, 0x12a2, lsl 16
	movk	x1, 0x5f31, lsl 32
	movk	x1, 0x8970, lsl 48
	smulh	x1, x0, x1
	add	x1, x1, x0
	asr	x3, x1, 29
	asr	x1, x0, 63
	sub	x1, x3, x1
	mov	x3, 51719
	movk	x3, 0x3b9a, lsl 16
	mul	x1, x1, x3
	sub	x1, x0, x1
	ldr	x3, [sp, 128]
	mov	x0, 36837
	movk	x0, 0x12a2, lsl 16
	movk	x0, 0x5f31, lsl 32
	movk	x0, 0x8970, lsl 48
	umulh	x0, x3, x0
	lsr	x0, x0, 29
	str	x0, [sp, 32]
	str	x1, [sp, 24]
	str	x11, [sp, 16]
	str	w10, [sp, 8]
	str	w7, [sp]
	mov	w7, w2
	mov	w3, w9
	mov	w2, w8
	ldr	w1, [sp, 144]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldr	w0, [sp, 152]
	add	w0, w0, 1
	str	w0, [sp, 152]
.L28:
	ldr	w1, [sp, 152]
	ldr	w0, [sp, 148]
	cmp	w1, w0
	blt	.L29
	mov	w0, 0
	ldp	x29, x30, [sp, 48]
	ldp	x19, x20, [sp, 64]
	ldr	x21, [sp, 80]
	add	sp, sp, 176
	ret

