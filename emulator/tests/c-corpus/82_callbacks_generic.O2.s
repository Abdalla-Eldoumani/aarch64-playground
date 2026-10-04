	.text
	.align	2
	.p2align 5,,15
cmp_u8:
	ldrb	w2, [x0]
	ldrb	w0, [x1]
	sub	w0, w2, w0
	ret
	.align	2
	.p2align 5,,15
cmp_s16_desc:
	ldrsh	w1, [x1]
	ldrsh	w0, [x0]
	sub	w0, w1, w0
	ret
	.align	2
	.p2align 5,,15
cmp_u32_mask:
	ldr	w0, [x0]
	ldr	w1, [x1]
	ldr	w2, [x2]
	eor	w3, w0, w1
	tst	w3, w2
	bne	.L8
	cmp	w0, w1
	cset	w0, hi
	sbc	w0, w0, wzr
	ret
	.p2align 2,,3
.L8:
	and	w0, w2, w0
	and	w2, w2, w1
	cmp	w0, w2
	mov	w0, -1
	csinc	w0, w0, wzr, cc
	ret
	.align	2
	.p2align 5,,15
cmp_s64_dir:
	ldr	x3, [x0]
	ldr	x0, [x1]
	cmp	x3, x0
	cset	w1, lt
	cset	w0, gt
	sub	w0, w0, w1
	ldr	w1, [x2]
	mul	w0, w0, w1
	ret
	.align	2
	.p2align 5,,15
cmp_s12_tag:
	ldrb	w2, [x0]
	ldrb	w0, [x1]
	sub	w0, w2, w0
	ret
	.align	2
	.p2align 5,,15
divisible:
	ldr	x2, [x0]
	ldr	x1, [x1]
	sdiv	x0, x2, x1
	msub	x0, x0, x1, x2
	cmp	x0, 0
	cset	w0, eq
	ret
	.align	2
	.p2align 5,,15
cmp_s24:
	stp	x29, x30, [sp, -32]!
	mov	x2, 8
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x20, x0
	mov	x19, x1
	add	x0, x0, x2
	add	x1, x1, x2
	bl	strncmp
	cbnz	w0, .L12
	ldr	x0, [x19]
	ldr	x1, [x20]
	cmp	x1, x0
	cset	w0, gt
	cset	w1, lt
	sub	w0, w0, w1
.L12:
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
	.align	2
	.p2align 5,,15
msort_rec:
	cmp	x2, 1
	bls	.L15
	stp	x29, x30, [sp, -112]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x3
	mov	x20, 0
	stp	x23, x24, [sp, 48]
	lsr	x24, x2, 1
	mov	x23, x2
	stp	x25, x26, [sp, 64]
	mov	x25, x0
	mov	x26, x4
	mov	x2, x24
	stp	x21, x22, [sp, 32]
	mov	x22, x1
	stp	x27, x28, [sp, 80]
	mov	x27, x5
	mov	x21, x24
	str	x1, [sp, 104]
	bl	msort_rec
	madd	x0, x24, x19, x25
	mov	x5, x27
	mov	x4, x26
	mov	x3, x19
	sub	x2, x23, x24
	mov	x1, x22
	bl	msort_rec
	.p2align 5,,15
.L21:
	cmp	x24, x20
	beq	.L26
	madd	x1, x19, x20, x25
	cmp	x23, x21
	bls	.L19
	mul	x28, x19, x21
	str	x1, [sp, 96]
	mov	x2, x27
	add	x0, x25, x28
	blr	x26
	ldr	x1, [sp, 96]
	tbnz	w0, #31, .L20
.L19:
	add	x20, x20, 1
.L18:
	mov	x0, x22
	mov	x2, x19
	bl	memcpy
	add	x22, x22, x19
	cmp	x20, x24
	ccmp	x21, x23, 0, cs
	bcc	.L21
	ldr	x1, [sp, 104]
	mul	x2, x23, x19
	ldp	x21, x22, [sp, 32]
	mov	x0, x25
	ldp	x19, x20, [sp, 16]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 112
	b	memcpy
	.p2align 2,,3
.L26:
	mul	x28, x19, x21
.L20:
	add	x1, x25, x28
	add	x21, x21, 1
	b	.L18
	.p2align 2,,3
.L15:
	ret
	.align	2
	.p2align 5,,15
msort:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	str	x21, [sp, 32]
	mov	x21, x0
	umull	x0, w1, w2
	stp	x19, x20, [sp, 16]
	mov	x20, x1
	stp	x2, x4, [sp, 56]
	str	x3, [sp, 72]
	bl	malloc
	ldp	x3, x5, [sp, 56]
	mov	x19, x0
	ldr	x4, [sp, 72]
	mov	x2, x20
	mov	x1, x0
	mov	x0, x21
	bl	msort_rec
	ldr	x21, [sp, 32]
	mov	x0, x19
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 80
	b	free
	.align	2
	.p2align 5,,15
isort:
	stp	x29, x30, [sp, -112]!
	mov	x29, sp
	stp	x25, x26, [sp, 64]
	mov	x26, x0
	mov	x0, x2
	stp	x19, x20, [sp, 16]
	mov	x20, x2
	mov	x25, 1
	stp	x21, x22, [sp, 32]
	mov	x22, x4
	stp	x23, x24, [sp, 48]
	mov	x23, x3
	mov	x24, x2
	stp	x27, x28, [sp, 80]
	sub	x27, x26, x2
	str	x1, [sp, 104]
	bl	malloc
	mov	x21, x0
	.p2align 5,,15
.L33:
	add	x28, x27, x24
	mov	x19, x25
	mov	x2, x20
	add	x1, x26, x24
	mov	x0, x21
	bl	memcpy
	.p2align 5,,15
.L30:
	mov	x2, x22
	mov	x1, x21
	mov	x0, x28
	blr	x23
	cmp	w0, 0
	ble	.L37
	sub	x28, x28, x20
	subs	x19, x19, #1
	bne	.L30
	mov	x2, x24
	mov	x28, x26
	mov	x0, x20
.L31:
	mov	x1, x28
	add	x0, x26, x0
	bl	memmove
	add	x25, x25, 1
	mov	x2, x20
	mov	x1, x21
	mov	x0, x28
	bl	memcpy
	ldr	x0, [sp, 104]
	add	x24, x24, x20
	cmp	x0, x25
	bne	.L33
	ldp	x19, x20, [sp, 16]
	mov	x0, x21
	ldp	x23, x24, [sp, 48]
	ldp	x21, x22, [sp, 32]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 112
	b	free
	.p2align 2,,3
.L37:
	add	x0, x19, 1
	sub	x2, x25, x19
	umull	x0, w0, w20
	mul	x2, x2, x20
	sub	x3, x0, x20
	add	x28, x26, x3
	b	.L31
	.section .rodata
	.align	3
.LC9:
	.string	"%s: n=%d size=%d agree=%d\n"
	.text
	.align	2
	.p2align 5,,15
sort_both:
	stp	x29, x30, [sp, -96]!
	mov	x29, sp
	stp	x21, x22, [sp, 32]
	umull	x21, w1, w2
	stp	x19, x20, [sp, 16]
	mov	x19, x1
	mov	x20, x2
	stp	x23, x24, [sp, 48]
	mov	x24, x3
	stp	x25, x26, [sp, 64]
	mov	x25, x4
	mov	x26, x0
	mov	x0, x21
	str	x5, [sp, 88]
	bl	malloc
	mov	x22, x0
	mov	x0, x21
	bl	malloc
	mov	x2, x21
	mov	x23, x0
	mov	x1, x26
	mov	x0, x22
	bl	memcpy
	mov	x2, x21
	mov	x1, x26
	mov	x0, x23
	bl	memcpy
	mov	x4, x25
	mov	x3, x24
	mov	x2, x20
	mov	x1, x19
	mov	x0, x22
	bl	isort
	mov	x4, x25
	mov	x3, x24
	mov	x2, x20
	mov	x1, x19
	mov	x0, x23
	bl	msort
	mov	x2, x21
	mov	x1, x23
	mov	x0, x22
	bl	memcmp
	ldr	x1, [sp, 88]
	cmp	w0, 0
	mov	w3, w20
	mov	w2, w19
	cset	w4, eq
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	mov	x0, x23
	bl	free
	mov	x0, x22
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x29, x30, [sp], 96
	ret
	.align	2
	.p2align 5,,15
filter.constprop.0:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x0
	mov	x20, 0
	stp	x21, x22, [sp, 32]
	mov	x22, x1
	add	x21, x0, 160
	str	x23, [sp, 48]
	mov	x23, x0
	b	.L42
	.p2align 2,,3
.L41:
	add	x19, x19, 8
	cmp	x19, x21
	beq	.L48
.L42:
	mov	x1, x22
	mov	x0, x19
	bl	divisible
	cbz	w0, .L41
	mov	x1, x19
	add	x0, x23, x20, lsl 3
	mov	x2, 8
	add	x19, x19, 8
	bl	memmove
	add	x20, x20, 1
	cmp	x19, x21
	bne	.L42
.L48:
	ldr	x23, [sp, 48]
	mov	x0, x20
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.align	2
	.p2align 5,,15
lower_bound.constprop.0:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x20, 0
	stp	x21, x22, [sp, 32]
	mov	x21, x2
	mov	x22, x4
	stp	x23, x24, [sp, 48]
	mov	x24, x1
	mov	x23, x3
	str	x25, [sp, 64]
	mov	x25, x0
	b	.L51
	.p2align 2,,3
.L52:
	mov	x21, x19
	cmp	x21, x20
	bls	.L55
.L51:
	sub	x19, x21, x20
	mov	x1, x25
	mov	x2, 0
	add	x19, x20, x19, lsr 1
	madd	x0, x19, x23, x24
	blr	x22
	tbz	w0, #31, .L52
	add	x20, x19, 1
	cmp	x21, x20
	bhi	.L51
.L55:
	ldr	x25, [sp, 64]
	mov	x0, x20
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 80
	ret
	.section .rodata
	.align	3
.LC11:
	.string	"u8"
	.align	3
.LC12:
	.string	"%02x"
	.align	3
.LC13:
	.string	"\nlower_bound(0x80)=%d\n"
	.align	3
.LC14:
	.string	"s16 desc"
	.align	3
.LC15:
	.string	" %d"
	.align	3
.LC16:
	.string	"\nu32 mask"
	.align	3
.LC17:
	.string	" %08x"
	.align	3
.LC18:
	.string	"\ns64 desc"
	.align	3
.LC19:
	.string	" %ld"
	.align	3
.LC20:
	.string	"\n"
	.align	3
.LC21:
	.string	"dbcadbbcadcaab"
	.align	3
.LC22:
	.string	"s12 stable"
	.align	3
.LC23:
	.string	" %c%d"
	.align	3
.LC25:
	.string	"s24"
	.align	3
.LC26:
	.string	" %.8s/%ld/%u"
	.align	3
.LC28:
	.string	"\nfind echo at %d\n"
	.align	3
.LC29:
	.string	"div6 (%d):"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #1040
	mov	w4, 26125
	mov	w3, 62303
	add	x1, sp, 176
	mov	w0, 2024
	movk	w4, 0x19, lsl 16
	stp	x29, x30, [sp]
	mov	x29, sp
	movk	w3, 0x3c6e, lsl 16
	stp	x21, x22, [sp, 32]
	add	x21, sp, 216
	stp	x19, x20, [sp, 16]
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	.p2align 5,,15
.L57:
	madd	w0, w0, w4, w3
	lsr	w2, w0, 24
	strb	w2, [x1], 1
	cmp	x1, x21
	bne	.L57
	mov	w4, 26125
	mov	w3, 62303
	mov	x1, x21
	add	x5, sp, 262
	movk	w4, 0x19, lsl 16
	movk	w3, 0x3c6e, lsl 16
	.p2align 5,,15
.L58:
	madd	w0, w0, w4, w3
	lsr	w2, w0, 16
	strh	w2, [x1], 2
	cmp	x1, x5
	bne	.L58
	mov	w3, 26125
	mov	w2, 62303
	add	x1, sp, 264
	add	x4, sp, 332
	movk	w3, 0x19, lsl 16
	movk	w2, 0x3c6e, lsl 16
	.p2align 5,,15
.L59:
	madd	w0, w0, w3, w2
	str	w0, [x1], 4
	cmp	x1, x4
	bne	.L59
	mov	w0, -32768
	adrp	x22, .LANCHOR0
	strh	w0, [sp, 222]
	mov	w0, 32767
	strh	w0, [sp, 234]
	mov	w0, -1
	ldr	d31, [x22, :lo12:.LANCHOR0]
	adrp	x24, cmp_u8
	str	w0, [sp, 272]
	add	x0, sp, 284
	add	x24, x24, :lo12:cmp_u8
	adrp	x5, .LC11
	mov	x3, x24
	add	x5, x5, :lo12:.LC11
	mov	x4, 0
	mov	x2, 1
	mov	x1, 40
	adrp	x23, .LC12
	add	x23, x23, :lo12:.LC12
	str	d31, [x0]
	add	x0, sp, 176
	bl	sort_both
	mov	x19, x0
	mov	x20, 0
	.p2align 5,,15
.L60:
	ldrb	w1, [x19, x20]
	mov	x0, x23
	add	x20, x20, 1
	bl	printf
	cmp	x20, 40
	bne	.L60
	mov	x2, x20
	mov	x4, x24
	mov	x3, 1
	mov	w0, -128
	mov	x1, x19
	strb	w0, [sp, 135]
	add	x0, sp, 135
	bl	lower_bound.constprop.0
	mov	w1, w0
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	mov	x0, x21
	adrp	x5, .LC14
	mov	x4, 0
	add	x5, x5, :lo12:.LC14
	adrp	x3, cmp_s16_desc
	mov	x2, 2
	add	x3, x3, :lo12:cmp_s16_desc
	mov	x1, 23
	adrp	x21, .LC15
	bl	sort_both
	add	x21, x21, :lo12:.LC15
	mov	x20, x0
	add	x23, x0, 46
	str	x0, [sp, 112]
	.p2align 5,,15
.L61:
	ldrsh	w1, [x20], 2
	mov	x0, x21
	bl	printf
	cmp	x20, x23
	bne	.L61
	mov	w0, 15
	add	x4, sp, 136
	movk	w0, 0xf00, lsl 16
	adrp	x5, .LC16
	adrp	x3, cmp_u32_mask
	add	x5, x5, :lo12:.LC16
	add	x3, x3, :lo12:cmp_u32_mask
	mov	x2, 4
	mov	x1, 17
	adrp	x23, .LC17
	add	x23, x23, :lo12:.LC17
	str	w0, [sp, 136]
	add	x0, sp, 264
	bl	sort_both
	mov	x21, x0
	mov	x20, 0
	.p2align 5,,15
.L62:
	ldr	w1, [x21, x20, lsl 2]
	mov	x0, x23
	add	x20, x20, 1
	bl	printf
	cmp	x20, 17
	bne	.L62
	add	x22, x22, :lo12:.LANCHOR0
	add	x1, sp, 408
	add	x4, sp, 140
	adrp	x5, .LC18
	adrp	x3, cmp_s64_dir
	add	x5, x5, :lo12:.LC18
	ldr	q28, [x22, 8]
	add	x3, x3, :lo12:cmp_s64_dir
	ldr	q27, [x22, 24]
	mov	x2, 8
	ldr	q30, [x22, 40]
	adrp	x20, .LC19
	ldr	q29, [x22, 56]
	stp	q28, q27, [x1]
	add	x1, sp, 440
	ldr	q31, [x22, 72]
	add	x20, x20, :lo12:.LC19
	ldr	x0, [x22, 88]
	stp	q30, q29, [x1]
	add	x1, sp, 472
	str	x0, [sp, 488]
	mov	w0, -1
	str	w0, [sp, 140]
	add	x0, sp, 408
	str	q31, [x1]
	mov	x1, 11
	bl	sort_both
	mov	x23, x0
	mov	x24, 0
	.p2align 5,,15
.L63:
	ldr	x1, [x23, x24, lsl 3]
	mov	x0, x20
	add	x24, x24, 1
	bl	printf
	cmp	x24, 11
	bne	.L63
	adrp	x26, .LC20
	add	x0, x26, :lo12:.LC20
	str	x0, [sp, 104]
	bl	printf
	mov	x2, 168
	mov	w1, 0
	add	x0, sp, 656
	bl	memset
	mov	x2, 216
	mov	w1, 0
	add	x0, sp, 824
	bl	memset
	mov	w0, 100
	adrp	x4, .LC21
	add	x4, x4, :lo12:.LC21
	strb	w0, [sp, 656]
	add	x0, sp, 656
	mov	w2, 1000
	mov	x1, 1
	str	wzr, [sp, 660]
	strh	wzr, [sp, 664]
	.p2align 5,,15
.L64:
	ldrb	w3, [x4, x1]
	add	x0, x0, 12
	strb	w3, [x0]
	str	w1, [x0, 4]
	add	x1, x1, 1
	strh	w2, [x0, 8]
	add	w2, w2, 1000
	cmp	x1, 14
	bne	.L64
	add	x0, sp, 656
	adrp	x5, .LC22
	mov	x4, 0
	add	x5, x5, :lo12:.LC22
	adrp	x3, cmp_s12_tag
	mov	x2, 12
	add	x3, x3, :lo12:cmp_s12_tag
	adrp	x24, .LC23
	bl	sort_both
	add	x24, x24, :lo12:.LC23
	mov	x27, x0
	add	x25, x0, 168
	str	x0, [sp, 120]
	.p2align 5,,15
.L65:
	ldr	w2, [x27, 4]
	mov	x0, x24
	ldrb	w1, [x27], 12
	bl	printf
	cmp	x27, x25
	bne	.L65
	ldr	x0, [sp, 104]
	mov	x24, -3689348814741910324
	add	x26, sp, 336
	add	x25, sp, 832
	mov	x28, 0
	mov	x27, 0
	bl	printf
	movk	x24, 0xcccd, lsl 0
	ldp	q29, q28, [x22, 96]
	ldp	q31, q30, [x22, 128]
	ldr	x0, [x22, 160]
	str	x0, [sp, 400]
	stp	q29, q28, [sp, 336]
	stp	q31, q30, [sp, 368]
	.p2align 5,,15
.L66:
	mov	x0, x25
	ldr	x1, [x26], 8
	mov	x2, 8
	add	x25, x25, 24
	bl	strncpy
	str	w27, [x25, -16]
	umulh	x0, x28, x24
	add	x27, x27, 1
	and	x1, x0, -4
	add	x0, x1, x0, lsr 2
	sub	x0, x28, x0
	add	x28, x28, 7
	sub	x0, x0, #2
	str	x0, [x25, -32]
	cmp	x27, 9
	bne	.L66
	adrp	x0, cmp_s24
	mov	x1, x27
	add	x3, x0, :lo12:cmp_s24
	add	x26, x0, :lo12:cmp_s24
	adrp	x5, .LC25
	add	x0, sp, 824
	add	x5, x5, :lo12:.LC25
	mov	x4, 0
	mov	x2, 24
	adrp	x24, .LC26
	bl	sort_both
	add	x24, x24, :lo12:.LC26
	mov	x27, x0
	add	x28, x0, 8
	add	x25, x0, 224
	.p2align 5,,15
.L67:
	ldr	x2, [x28, -8]
	mov	x1, x28
	ldr	w3, [x28, 8]
	mov	x0, x24
	add	x28, x28, 24
	bl	printf
	cmp	x25, x28
	bne	.L67
	ldr	d31, [x22, 168]
	mov	x4, x26
	mov	x3, 24
	mov	x2, 9
	mov	x1, x27
	add	x0, sp, 152
	str	xzr, [sp, 152]
	add	x22, sp, 496
	str	d31, [sp, 160]
	str	wzr, [sp, 168]
	bl	lower_bound.constprop.0
	mov	w1, w0
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	bl	printf
	mov	x0, 6
	mov	x7, -6148914691236517206
	mov	x5, 16963
	mov	x3, x22
	movk	x7, 0xaaab, lsl 0
	mov	x6, 6148914691236517205
	mov	x2, 1
	movk	x5, 0xf, lsl 16
	str	x0, [sp, 144]
	mov	x0, 0
	.p2align 5,,15
.L69:
	mul	x1, x0, x7
	umull	x4, w0, w0
	add	x0, x0, 1
	cmp	x1, x6
	csneg	x1, x2, x2, hi
	mul	x1, x1, x4
	mul	x1, x1, x5
	str	x1, [x3], 8
	cmp	x0, 20
	bne	.L69
	add	x1, sp, 144
	mov	x0, x22
	bl	filter.constprop.0
	mov	x24, x0
	mov	w1, w0
	adrp	x0, .LC29
	add	x0, x0, :lo12:.LC29
	bl	printf
	cbz	x24, .L70
	mov	x25, 1
	add	x24, x24, x25
	.p2align 5,,15
.L71:
	add	x0, x22, x25, lsl 3
	add	x25, x25, 1
	ldr	x1, [x0, -8]
	mov	x0, x20
	bl	printf
	cmp	x25, x24
	bne	.L71
.L70:
	ldr	x0, [sp, 104]
	bl	printf
	mov	x0, x19
	bl	free
	ldr	x0, [sp, 112]
	bl	free
	mov	x0, x21
	bl	free
	mov	x0, x23
	bl	free
	ldr	x0, [sp, 120]
	bl	free
	mov	x0, x27
	bl	free
	ldp	x29, x30, [sp]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	add	sp, sp, 1040
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"kilo"
	.align	3
.LC2:
	.string	"alpha"
	.align	3
.LC3:
	.string	"echo"
	.align	3
.LC4:
	.string	"alphabet"
	.align	3
.LC5:
	.string	""
	.align	3
.LC6:
	.string	"zulu"
	.section .rodata
	.align	3
	.LANCHOR0:
.LC10:
	.word	-2147483648
	.word	0
.LC0:
	.xword	5
	.xword	-9223372036854775808
	.xword	-1
	.xword	9223372036854775807
	.xword	0
	.xword	1099511627776
	.xword	-1099511627776
	.xword	77
	.xword	-77
	.xword	1
	.xword	-9223372036854775807
.LC24:
	.xword	.LC1
	.xword	.LC2
	.xword	.LC1
	.xword	.LC3
	.xword	.LC4
	.xword	.LC5
	.xword	.LC2
	.xword	.LC6
	.xword	.LC3
.LC27:
	.byte	101
	.byte	99
	.byte	104
	.byte	111
	.byte	0
	.byte	0
	.byte	0
	.byte	0

