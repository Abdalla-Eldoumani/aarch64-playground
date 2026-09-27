	.text
	.align	2
	.align 5
cmp_u8:
	ldrb	w2, [x0]
	ldrb	w0, [x1]
	sub	w0, w2, w0
	ret
	.align	2
	.align 5
cmp_s16_desc:
	ldrsh	w1, [x1]
	ldrsh	w0, [x0]
	sub	w0, w1, w0
	ret
	.align	2
	.align 5
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
	.align 2
.L8:
	and	w0, w2, w0
	and	w2, w2, w1
	cmp	w0, w2
	mov	w0, -1
	csinc	w0, w0, wzr, cc
	ret
	.align	2
	.align 5
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
	.align 5
cmp_s12_tag:
	ldrb	w2, [x0]
	ldrb	w0, [x1]
	sub	w0, w2, w0
	ret
	.align	2
	.align 5
msort_rec:
	cmp	x2, 1
	bls	.L11
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
	.align 5
.L17:
	cmp	x24, x20
	beq	.L22
	madd	x1, x19, x20, x25
	cmp	x23, x21
	bls	.L15
	mul	x28, x19, x21
	str	x1, [sp, 96]
	mov	x2, x27
	add	x0, x25, x28
	blr	x26
	ldr	x1, [sp, 96]
	tbnz	w0, #31, .L16
.L15:
	add	x20, x20, 1
.L14:
	mov	x0, x22
	mov	x2, x19
	bl	memcpy
	add	x22, x22, x19
	cmp	x20, x24
	ccmp	x21, x23, 0, cs
	bcc	.L17
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
	.align 2
.L22:
	mul	x28, x19, x21
.L16:
	add	x1, x25, x28
	add	x21, x21, 1
	b	.L14
	.align 2
.L11:
	ret
	.section .rodata
	.align	3
.LC9:
	.string	"%s: n=%d size=%d agree=%d\n"
	.text
	.align	2
	.align 5
sort_both:
	stp	x29, x30, [sp, -128]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x20, x0
	umull	x0, w1, w2
	mov	x19, x2
	stp	x21, x22, [sp, 32]
	mov	x21, x3
	mov	x22, x4
	stp	x23, x24, [sp, 48]
	mov	x23, x0
	stp	x25, x26, [sp, 64]
	mov	x26, x1
	stp	x27, x28, [sp, 80]
	stp	x0, x5, [sp, 104]
	bl	malloc
	mov	x25, x0
	mov	x0, x23
	bl	malloc
	mov	x2, x23
	mov	x24, x0
	mov	x1, x20
	mov	x0, x25
	str	x24, [sp, 120]
	bl	memcpy
	mov	x2, x23
	mov	x1, x20
	mov	x0, x24
	bl	memcpy
	mov	x0, x19
	mov	x23, x19
	bl	malloc
	mov	x24, 1
	mov	x20, x0
	sub	x0, x25, x19
	str	x0, [sp, 96]
	.align 5
.L27:
	mov	x2, x19
	add	x1, x25, x23
	mov	x0, x20
	bl	memcpy
	ldr	x0, [sp, 96]
	mov	x27, x24
	add	x28, x0, x23
	.align 5
.L24:
	mov	x2, x22
	mov	x1, x20
	mov	x0, x28
	blr	x21
	cmp	w0, 0
	ble	.L31
	sub	x28, x28, x19
	subs	x27, x27, #1
	bne	.L24
	mov	x2, x23
	mov	x28, x25
	mov	x0, x19
.L25:
	mov	x1, x28
	add	x0, x25, x0
	bl	memmove
	add	x24, x24, 1
	mov	x2, x19
	mov	x1, x20
	mov	x0, x28
	bl	memcpy
	add	x23, x23, x19
	cmp	x26, x24
	bne	.L27
	mov	x0, x20
	bl	free
	ldr	x23, [sp, 104]
	mov	x0, x23
	bl	malloc
	mov	x4, x21
	mov	x5, x22
	ldr	x21, [sp, 120]
	mov	x3, x19
	mov	x2, x26
	mov	x1, x0
	mov	x20, x0
	mov	x0, x21
	bl	msort_rec
	mov	x0, x20
	bl	free
	mov	x2, x23
	mov	x1, x21
	mov	x0, x25
	bl	memcmp
	ldr	x1, [sp, 112]
	cmp	w0, 0
	mov	w3, w19
	mov	w2, w26
	cset	w4, eq
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	mov	x0, x21
	bl	free
	mov	x0, x25
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 128
	ret
	.align 2
.L31:
	add	x0, x27, 1
	sub	x2, x24, x27
	umull	x0, w0, w19
	mul	x2, x2, x19
	sub	x4, x0, x19
	add	x28, x25, x4
	b	.L25
	.align	2
	.align 5
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
	cbnz	w0, .L32
	ldr	x0, [x19]
	ldr	x1, [x20]
	cmp	x1, x0
	cset	w0, gt
	cset	w1, lt
	sub	w0, w0, w1
.L32:
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 32
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
	.string	"dbcadbbcadcaab"
	.align	3
.LC21:
	.string	"s12 stable"
	.align	3
.LC22:
	.string	" %c%d"
	.align	3
.LC24:
	.string	"s24"
	.align	3
.LC25:
	.string	" %.8s/%ld/%u"
	.align	3
.LC27:
	.string	"\nfind echo at %d\n"
	.align	3
.LC28:
	.string	"div6 (%d):"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #1008
	mov	w4, 26125
	mov	w3, 62303
	add	x1, sp, 144
	mov	w0, 2024
	movk	w4, 0x19, lsl 16
	stp	x29, x30, [sp]
	mov	x29, sp
	movk	w3, 0x3c6e, lsl 16
	stp	x21, x22, [sp, 32]
	add	x21, sp, 184
	stp	x19, x20, [sp, 16]
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	.align 5
.L36:
	madd	w0, w0, w4, w3
	lsr	w2, w0, 24
	strb	w2, [x1], 1
	cmp	x1, x21
	bne	.L36
	mov	w4, 26125
	mov	w3, 62303
	mov	x1, x21
	add	x5, sp, 230
	movk	w4, 0x19, lsl 16
	movk	w3, 0x3c6e, lsl 16
	.align 5
.L37:
	madd	w0, w0, w4, w3
	lsr	w2, w0, 16
	strh	w2, [x1], 2
	cmp	x1, x5
	bne	.L37
	mov	w3, 26125
	mov	w2, 62303
	add	x1, sp, 232
	add	x4, sp, 300
	movk	w3, 0x19, lsl 16
	movk	w2, 0x3c6e, lsl 16
	.align 5
.L38:
	madd	w0, w0, w3, w2
	str	w0, [x1], 4
	cmp	x1, x4
	bne	.L38
	adrp	x26, .LANCHOR0
	mov	w0, -32768
	strh	w0, [sp, 190]
	mov	w0, 32767
	ldr	d31, [x26, :lo12:.LANCHOR0]
	adrp	x5, .LC11
	strh	w0, [sp, 202]
	mov	w0, -1
	add	x5, x5, :lo12:.LC11
	mov	x4, 0
	adrp	x3, cmp_u8
	mov	x2, 1
	add	x3, x3, :lo12:cmp_u8
	mov	x1, 40
	adrp	x22, .LC12
	add	x22, x22, :lo12:.LC12
	str	w0, [sp, 240]
	add	x0, sp, 144
	str	d31, [sp, 252]
	bl	sort_both
	mov	x20, x0
	mov	x19, 0
	.align 5
.L39:
	ldrb	w1, [x20, x19]
	mov	x0, x22
	add	x19, x19, 1
	bl	printf
	cmp	x19, 40
	bne	.L39
	mov	x1, 0
	b	.L41
	.align 2
.L57:
	mov	x19, x0
	cmp	x19, x1
	bls	.L80
.L41:
	sub	x0, x19, x1
	add	x0, x1, x0, lsr 1
	ldrsb	w2, [x20, x0]
	tbnz	w2, #31, .L57
	add	x1, x0, 1
	cmp	x19, x1
	bhi	.L41
.L80:
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
	mov	x19, x0
	add	x22, x0, 46
	str	x0, [sp, 96]
	.align 5
.L42:
	ldrsh	w1, [x19], 2
	mov	x0, x21
	bl	printf
	cmp	x19, x22
	bne	.L42
	mov	w0, 15
	add	x4, sp, 112
	movk	w0, 0xf00, lsl 16
	adrp	x5, .LC16
	adrp	x3, cmp_u32_mask
	add	x5, x5, :lo12:.LC16
	add	x3, x3, :lo12:cmp_u32_mask
	mov	x2, 4
	mov	x1, 17
	adrp	x22, .LC17
	add	x22, x22, :lo12:.LC17
	str	w0, [sp, 112]
	add	x0, sp, 232
	bl	sort_both
	mov	x21, x0
	mov	x19, 0
	.align 5
.L43:
	ldr	w1, [x21, x19, lsl 2]
	mov	x0, x22
	add	x19, x19, 1
	bl	printf
	cmp	x19, 17
	bne	.L43
	add	x26, x26, :lo12:.LANCHOR0
	add	x1, sp, 376
	add	x4, sp, 116
	adrp	x5, .LC18
	adrp	x3, cmp_s64_dir
	add	x5, x5, :lo12:.LC18
	ldr	q28, [x26, 8]
	add	x3, x3, :lo12:cmp_s64_dir
	ldr	q27, [x26, 24]
	mov	x2, 8
	ldr	q30, [x26, 40]
	adrp	x19, .LC19
	ldr	q29, [x26, 56]
	stp	q28, q27, [x1]
	add	x1, sp, 408
	ldr	q31, [x26, 72]
	add	x19, x19, :lo12:.LC19
	ldr	x0, [x26, 88]
	stp	q30, q29, [x1]
	add	x1, sp, 440
	str	x0, [sp, 456]
	mov	w0, -1
	str	w0, [sp, 116]
	add	x0, sp, 376
	str	q31, [x1]
	mov	x1, 11
	bl	sort_both
	mov	x22, x0
	mov	x23, 0
	.align 5
.L44:
	ldr	x1, [x22, x23, lsl 3]
	mov	x0, x19
	add	x23, x23, 1
	bl	printf
	cmp	x23, 11
	bne	.L44
	mov	w0, 10
	bl	putchar
	movi	v31.4s, 0
	add	x0, sp, 792
	str	xzr, [sp, 784]
	adrp	x4, .LC20
	add	x4, x4, :lo12:.LC20
	mov	w2, 1000
	mov	x1, 1
	stp	q31, q31, [sp, 624]
	stp	q31, q31, [sp, 656]
	stp	q31, q31, [sp, 688]
	stp	q31, q31, [sp, 720]
	stp	q31, q31, [sp, 752]
	stp	q31, q31, [x0]
	add	x0, sp, 824
	stp	q31, q31, [x0]
	add	x0, sp, 856
	stp	q31, q31, [x0]
	add	x0, sp, 888
	stp	q31, q31, [x0]
	add	x0, sp, 920
	stp	q31, q31, [x0]
	add	x0, sp, 952
	stp	q31, q31, [x0]
	add	x0, sp, 984
	str	q31, [x0]
	mov	w0, 100
	strb	w0, [sp, 624]
	add	x0, sp, 624
	str	xzr, [sp, 1000]
	.align 5
.L45:
	ldrb	w3, [x4, x1]
	add	x0, x0, 12
	strb	w3, [x0]
	str	w1, [x0, 4]
	add	x1, x1, 1
	strh	w2, [x0, 8]
	add	w2, w2, 1000
	cmp	x1, 14
	bne	.L45
	add	x0, sp, 624
	adrp	x5, .LC21
	mov	x4, 0
	add	x5, x5, :lo12:.LC21
	adrp	x3, cmp_s12_tag
	mov	x2, 12
	add	x3, x3, :lo12:cmp_s12_tag
	adrp	x27, .LC22
	bl	sort_both
	add	x27, x27, :lo12:.LC22
	mov	x23, x0
	add	x28, x0, 168
	str	x0, [sp, 104]
	.align 5
.L46:
	ldr	w2, [x23, 4]
	mov	x0, x27
	ldrb	w1, [x23], 12
	bl	printf
	cmp	x23, x28
	bne	.L46
	add	x28, sp, 304
	mov	w0, 10
	bl	putchar
	mov	x23, -3689348814741910324
	ldp	q29, q28, [x26, 96]
	add	x3, sp, 800
	ldp	q31, q30, [x26, 128]
	mov	x27, 0
	ldr	x0, [x26, 160]
	mov	x24, 0
	movk	x23, 0xcccd, lsl 0
	str	x0, [x28, 64]
	stp	q29, q28, [x28]
	stp	q31, q30, [x28, 32]
	.align 5
.L47:
	mov	x0, x3
	ldr	x1, [x28], 8
	mov	x2, 8
	bl	strncpy
	mov	x3, x0
	umulh	x0, x27, x23
	add	x3, x3, 24
	and	x1, x0, -4
	str	w24, [x3, -16]
	add	x0, x1, x0, lsr 2
	add	x24, x24, 1
	sub	x0, x27, x0
	add	x27, x27, 7
	sub	x0, x0, #2
	str	x0, [x3, -32]
	cmp	x24, 9
	bne	.L47
	mov	x1, x24
	add	x0, sp, 792
	adrp	x5, .LC24
	mov	x4, 0
	add	x5, x5, :lo12:.LC24
	adrp	x3, cmp_s24
	mov	x2, 24
	add	x3, x3, :lo12:cmp_s24
	adrp	x27, .LC25
	bl	sort_both
	add	x27, x27, :lo12:.LC25
	mov	x23, x0
	add	x25, x0, 8
	add	x28, x0, 224
	.align 5
.L48:
	ldr	x2, [x25, -8]
	mov	x1, x25
	ldr	w3, [x25, 8]
	mov	x0, x27
	add	x25, x25, 24
	bl	printf
	cmp	x25, x28
	bne	.L48
	ldr	d31, [x26, 168]
	mov	x27, 0
	str	xzr, [sp, 120]
	str	d31, [sp, 128]
	b	.L50
	.align 2
.L58:
	mov	x24, x26
	cmp	x24, x27
	bls	.L81
.L50:
	sub	x26, x24, x27
	add	x1, sp, 120
	mov	x2, 0
	add	x26, x27, x26, lsr 1
	add	x0, x26, x26, lsl 1
	add	x0, x23, x0, lsl 3
	bl	cmp_s24
	tbz	w0, #31, .L58
	add	x27, x26, 1
	cmp	x24, x27
	bhi	.L50
.L81:
	add	x28, sp, 464
	mov	w1, w27
	adrp	x0, .LC27
	add	x0, x0, :lo12:.LC27
	bl	printf
	mov	x8, -6148914691236517206
	mov	x6, 16963
	mov	x5, x28
	mov	x3, x28
	mov	x0, 0
	movk	x8, 0xaaab, lsl 0
	mov	x7, 6148914691236517205
	mov	x2, 1
	movk	x6, 0xf, lsl 16
	.align 5
.L52:
	mul	x1, x0, x8
	umull	x4, w0, w0
	add	x0, x0, 1
	cmp	x1, x7
	csneg	x1, x2, x2, hi
	mul	x1, x1, x4
	mul	x1, x1, x6
	str	x1, [x3], 8
	cmp	x0, 20
	bne	.L52
	mov	x3, -6148914691236517206
	mov	x2, -6148914691236517206
	add	x4, x28, 160
	mov	x27, 0
	movk	x3, 0xaaab, lsl 0
	movk	x2, 0x2aaa, lsl 48
	b	.L54
	.align 2
.L53:
	add	x5, x5, 8
	cmp	x4, x5
	beq	.L82
.L54:
	ldr	x1, [x5]
	madd	x0, x1, x3, x2
	ror	x0, x0, 1
	cmp	x0, x2
	bhi	.L53
	add	x5, x5, 8
	str	x1, [x28, x27, lsl 3]
	add	x27, x27, 1
	cmp	x4, x5
	bne	.L54
.L82:
	adrp	x0, .LC28
	mov	w1, w27
	add	x0, x0, :lo12:.LC28
	bl	printf
	cbz	x27, .L55
	mov	x26, 1
	add	x27, x27, x26
	.align 5
.L56:
	add	x0, x28, x26, lsl 3
	add	x26, x26, 1
	ldr	x1, [x0, -8]
	mov	x0, x19
	bl	printf
	cmp	x27, x26
	bne	.L56
.L55:
	mov	w0, 10
	bl	putchar
	mov	x0, x20
	bl	free
	ldr	x0, [sp, 96]
	bl	free
	mov	x0, x21
	bl	free
	mov	x0, x22
	bl	free
	ldr	x0, [sp, 104]
	bl	free
	mov	x0, x23
	bl	free
	ldp	x29, x30, [sp]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	add	sp, sp, 1008
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
	.quad	5
	.quad	-9223372036854775808
	.quad	-1
	.quad	9223372036854775807
	.quad	0
	.quad	1099511627776
	.quad	-1099511627776
	.quad	77
	.quad	-77
	.quad	1
	.quad	-9223372036854775807
.LC23:
	.quad	.LC1
	.quad	.LC2
	.quad	.LC1
	.quad	.LC3
	.quad	.LC4
	.quad	.LC5
	.quad	.LC2
	.quad	.LC6
	.quad	.LC3
.LC26:
	.byte	101
	.byte	99
	.byte	104
	.byte	111
	.byte	0
	.byte	0
	.byte	0
	.byte	0

