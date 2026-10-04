	.text
	.align	2
isort:
	stp	x29, x30, [sp, -96]!
	mov	x29, sp
	str	x0, [sp, 56]
	str	x1, [sp, 48]
	str	x2, [sp, 40]
	str	x3, [sp, 32]
	str	x4, [sp, 24]
	ldr	x0, [sp, 56]
	str	x0, [sp, 72]
	ldr	x0, [sp, 40]
	bl	malloc
	str	x0, [sp, 64]
	mov	x0, 1
	str	x0, [sp, 88]
	b	.L2
.L6:
	ldr	x0, [sp, 88]
	str	x0, [sp, 80]
	ldr	x1, [sp, 88]
	ldr	x0, [sp, 40]
	mul	x0, x1, x0
	ldr	x1, [sp, 72]
	add	x0, x1, x0
	ldr	x2, [sp, 40]
	mov	x1, x0
	ldr	x0, [sp, 64]
	bl	memcpy
	b	.L3
.L5:
	ldr	x0, [sp, 80]
	sub	x0, x0, #1
	str	x0, [sp, 80]
.L3:
	ldr	x0, [sp, 80]
	cmp	x0, 0
	beq	.L4
	ldr	x0, [sp, 80]
	sub	x1, x0, #1
	ldr	x0, [sp, 40]
	mul	x0, x1, x0
	ldr	x1, [sp, 72]
	add	x0, x1, x0
	ldr	x3, [sp, 32]
	ldr	x2, [sp, 24]
	ldr	x1, [sp, 64]
	blr	x3
	cmp	w0, 0
	bgt	.L5
.L4:
	ldr	x0, [sp, 80]
	add	x1, x0, 1
	ldr	x0, [sp, 40]
	mul	x0, x1, x0
	ldr	x1, [sp, 72]
	add	x3, x1, x0
	ldr	x1, [sp, 80]
	ldr	x0, [sp, 40]
	mul	x0, x1, x0
	ldr	x1, [sp, 72]
	add	x4, x1, x0
	ldr	x1, [sp, 88]
	ldr	x0, [sp, 80]
	sub	x1, x1, x0
	ldr	x0, [sp, 40]
	mul	x0, x1, x0
	mov	x2, x0
	mov	x1, x4
	mov	x0, x3
	bl	memmove
	ldr	x1, [sp, 80]
	ldr	x0, [sp, 40]
	mul	x0, x1, x0
	ldr	x1, [sp, 72]
	add	x0, x1, x0
	ldr	x2, [sp, 40]
	ldr	x1, [sp, 64]
	bl	memcpy
	ldr	x0, [sp, 88]
	add	x0, x0, 1
	str	x0, [sp, 88]
.L2:
	ldr	x1, [sp, 88]
	ldr	x0, [sp, 48]
	cmp	x1, x0
	bcc	.L6
	ldr	x0, [sp, 64]
	bl	free
	nop
	ldp	x29, x30, [sp], 96
	ret
	.align	2
msort_rec:
	stp	x29, x30, [sp, -112]!
	mov	x29, sp
	str	x0, [sp, 56]
	str	x1, [sp, 48]
	str	x2, [sp, 40]
	str	x3, [sp, 32]
	str	x4, [sp, 24]
	str	x5, [sp, 16]
	ldr	x0, [sp, 40]
	cmp	x0, 1
	bls	.L17
	ldr	x0, [sp, 40]
	lsr	x0, x0, 1
	str	x0, [sp, 80]
	str	xzr, [sp, 104]
	ldr	x0, [sp, 80]
	str	x0, [sp, 96]
	str	xzr, [sp, 88]
	ldr	x5, [sp, 16]
	ldr	x4, [sp, 24]
	ldr	x3, [sp, 32]
	ldr	x2, [sp, 80]
	ldr	x1, [sp, 48]
	ldr	x0, [sp, 56]
	bl	msort_rec
	ldr	x1, [sp, 80]
	ldr	x0, [sp, 32]
	mul	x0, x1, x0
	ldr	x1, [sp, 56]
	add	x6, x1, x0
	ldr	x1, [sp, 40]
	ldr	x0, [sp, 80]
	sub	x0, x1, x0
	ldr	x5, [sp, 16]
	ldr	x4, [sp, 24]
	ldr	x3, [sp, 32]
	mov	x2, x0
	ldr	x1, [sp, 48]
	mov	x0, x6
	bl	msort_rec
	b	.L10
.L16:
	ldr	x1, [sp, 104]
	ldr	x0, [sp, 80]
	cmp	x1, x0
	beq	.L11
	ldr	x1, [sp, 96]
	ldr	x0, [sp, 40]
	cmp	x1, x0
	bcs	.L12
	ldr	x1, [sp, 96]
	ldr	x0, [sp, 32]
	mul	x0, x1, x0
	ldr	x1, [sp, 56]
	add	x4, x1, x0
	ldr	x1, [sp, 104]
	ldr	x0, [sp, 32]
	mul	x0, x1, x0
	ldr	x1, [sp, 56]
	add	x0, x1, x0
	ldr	x3, [sp, 24]
	ldr	x2, [sp, 16]
	mov	x1, x0
	mov	x0, x4
	blr	x3
	cmp	w0, 0
	bge	.L12
.L11:
	mov	w0, 1
	b	.L13
.L12:
	mov	w0, 0
.L13:
	str	w0, [sp, 76]
	ldr	x0, [sp, 88]
	add	x1, x0, 1
	str	x1, [sp, 88]
	ldr	x1, [sp, 32]
	mul	x0, x0, x1
	ldr	x1, [sp, 48]
	add	x3, x1, x0
	ldr	w0, [sp, 76]
	cmp	w0, 0
	beq	.L14
	ldr	x0, [sp, 96]
	add	x1, x0, 1
	str	x1, [sp, 96]
	b	.L15
.L14:
	ldr	x0, [sp, 104]
	add	x1, x0, 1
	str	x1, [sp, 104]
.L15:
	ldr	x1, [sp, 32]
	mul	x0, x0, x1
	ldr	x1, [sp, 56]
	add	x0, x1, x0
	ldr	x2, [sp, 32]
	mov	x1, x0
	mov	x0, x3
	bl	memcpy
.L10:
	ldr	x1, [sp, 104]
	ldr	x0, [sp, 80]
	cmp	x1, x0
	bcc	.L16
	ldr	x1, [sp, 96]
	ldr	x0, [sp, 40]
	cmp	x1, x0
	bcc	.L16
	ldr	x1, [sp, 40]
	ldr	x0, [sp, 32]
	mul	x0, x1, x0
	mov	x2, x0
	ldr	x1, [sp, 48]
	ldr	x0, [sp, 56]
	bl	memcpy
	b	.L7
.L17:
	nop
.L7:
	ldp	x29, x30, [sp], 112
	ret
	.align	2
msort:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	str	x0, [sp, 56]
	str	x1, [sp, 48]
	str	x2, [sp, 40]
	str	x3, [sp, 32]
	str	x4, [sp, 24]
	ldr	x1, [sp, 48]
	ldr	x0, [sp, 40]
	mul	x0, x1, x0
	bl	malloc
	str	x0, [sp, 72]
	ldr	x5, [sp, 24]
	ldr	x4, [sp, 32]
	ldr	x3, [sp, 40]
	ldr	x2, [sp, 48]
	ldr	x1, [sp, 72]
	ldr	x0, [sp, 56]
	bl	msort_rec
	ldr	x0, [sp, 72]
	bl	free
	nop
	ldp	x29, x30, [sp], 80
	ret
	.align	2
lower_bound:
	stp	x29, x30, [sp, -96]!
	mov	x29, sp
	str	x0, [sp, 56]
	str	x1, [sp, 48]
	str	x2, [sp, 40]
	str	x3, [sp, 32]
	str	x4, [sp, 24]
	str	x5, [sp, 16]
	str	xzr, [sp, 88]
	ldr	x0, [sp, 40]
	str	x0, [sp, 80]
	b	.L20
.L23:
	ldr	x1, [sp, 80]
	ldr	x0, [sp, 88]
	sub	x0, x1, x0
	lsr	x0, x0, 1
	ldr	x1, [sp, 88]
	add	x0, x1, x0
	str	x0, [sp, 72]
	ldr	x1, [sp, 72]
	ldr	x0, [sp, 32]
	mul	x0, x1, x0
	ldr	x1, [sp, 48]
	add	x0, x1, x0
	ldr	x3, [sp, 24]
	ldr	x2, [sp, 16]
	ldr	x1, [sp, 56]
	blr	x3
	cmp	w0, 0
	bge	.L21
	ldr	x0, [sp, 72]
	add	x0, x0, 1
	str	x0, [sp, 88]
	b	.L20
.L21:
	ldr	x0, [sp, 72]
	str	x0, [sp, 80]
.L20:
	ldr	x1, [sp, 88]
	ldr	x0, [sp, 80]
	cmp	x1, x0
	bcc	.L23
	ldr	x0, [sp, 88]
	ldp	x29, x30, [sp], 96
	ret
	.align	2
cmp_u8:
	sub	sp, sp, #32
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	str	x2, [sp, 8]
	ldr	x0, [sp, 24]
	ldrb	w0, [x0]
	mov	w1, w0
	ldr	x0, [sp, 16]
	ldrb	w0, [x0]
	sub	w0, w1, w0
	add	sp, sp, 32
	ret
	.align	2
cmp_s16_desc:
	sub	sp, sp, #32
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	str	x2, [sp, 8]
	ldr	x0, [sp, 16]
	ldrsh	w0, [x0]
	mov	w1, w0
	ldr	x0, [sp, 24]
	ldrsh	w0, [x0]
	sub	w0, w1, w0
	add	sp, sp, 32
	ret
	.align	2
cmp_u32_mask:
	sub	sp, sp, #48
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	str	x2, [sp, 8]
	ldr	x0, [sp, 8]
	ldr	w0, [x0]
	str	w0, [sp, 44]
	ldr	x0, [sp, 24]
	ldr	w0, [x0]
	str	w0, [sp, 40]
	ldr	x0, [sp, 16]
	ldr	w0, [x0]
	str	w0, [sp, 36]
	ldr	w1, [sp, 40]
	ldr	w0, [sp, 36]
	eor	w1, w1, w0
	ldr	w0, [sp, 44]
	and	w0, w1, w0
	cmp	w0, 0
	beq	.L30
	ldr	w1, [sp, 40]
	ldr	w0, [sp, 44]
	and	w1, w1, w0
	ldr	w2, [sp, 36]
	ldr	w0, [sp, 44]
	and	w0, w2, w0
	cmp	w1, w0
	bcs	.L31
	mov	w0, -1
	b	.L33
.L31:
	mov	w0, 1
	b	.L33
.L30:
	ldr	w1, [sp, 40]
	ldr	w0, [sp, 36]
	cmp	w1, w0
	cset	w0, hi
	and	w0, w0, 255
	mov	w2, w0
	ldr	w1, [sp, 40]
	ldr	w0, [sp, 36]
	cmp	w1, w0
	cset	w0, cc
	and	w0, w0, 255
	sub	w0, w2, w0
.L33:
	add	sp, sp, 48
	ret
	.align	2
cmp_s64_dir:
	sub	sp, sp, #48
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	str	x2, [sp, 8]
	ldr	x0, [sp, 24]
	ldr	x0, [x0]
	str	x0, [sp, 40]
	ldr	x0, [sp, 16]
	ldr	x0, [x0]
	str	x0, [sp, 32]
	ldr	x1, [sp, 40]
	ldr	x0, [sp, 32]
	cmp	x1, x0
	cset	w0, gt
	and	w0, w0, 255
	mov	w2, w0
	ldr	x1, [sp, 40]
	ldr	x0, [sp, 32]
	cmp	x1, x0
	cset	w0, lt
	and	w0, w0, 255
	sub	w1, w2, w0
	ldr	x0, [sp, 8]
	ldr	w0, [x0]
	mul	w0, w1, w0
	add	sp, sp, 48
	ret
	.align	2
cmp_s12_tag:
	sub	sp, sp, #32
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	str	x2, [sp, 8]
	ldr	x0, [sp, 24]
	ldrb	w0, [x0]
	mov	w1, w0
	ldr	x0, [sp, 16]
	ldrb	w0, [x0]
	sub	w0, w1, w0
	add	sp, sp, 32
	ret
	.align	2
cmp_s24:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	str	x0, [sp, 40]
	str	x1, [sp, 32]
	str	x2, [sp, 24]
	ldr	x0, [sp, 40]
	str	x0, [sp, 72]
	ldr	x0, [sp, 32]
	str	x0, [sp, 64]
	ldr	x0, [sp, 72]
	add	x3, x0, 8
	ldr	x0, [sp, 64]
	add	x0, x0, 8
	mov	x2, 8
	mov	x1, x0
	mov	x0, x3
	bl	strncmp
	str	w0, [sp, 60]
	ldr	w0, [sp, 60]
	cmp	w0, 0
	bne	.L39
	ldr	x0, [sp, 72]
	ldr	x1, [x0]
	ldr	x0, [sp, 64]
	ldr	x0, [x0]
	cmp	x1, x0
	cset	w0, gt
	and	w0, w0, 255
	mov	w2, w0
	ldr	x0, [sp, 72]
	ldr	x1, [x0]
	ldr	x0, [sp, 64]
	ldr	x0, [x0]
	cmp	x1, x0
	cset	w0, lt
	and	w0, w0, 255
	sub	w0, w2, w0
	b	.L41
.L39:
	ldr	w0, [sp, 60]
.L41:
	ldp	x29, x30, [sp], 80
	ret
	.section .rodata
	.align	3
.LC9:
	.string	"%s: n=%d size=%d agree=%d\n"
	.text
	.align	2
sort_both:
	stp	x29, x30, [sp, -96]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	str	x0, [sp, 72]
	str	x1, [sp, 64]
	str	x2, [sp, 56]
	str	x3, [sp, 48]
	str	x4, [sp, 40]
	str	x5, [sp, 32]
	ldr	x1, [sp, 64]
	ldr	x0, [sp, 56]
	mul	x0, x1, x0
	bl	malloc
	str	x0, [sp, 88]
	ldr	x1, [sp, 64]
	ldr	x0, [sp, 56]
	mul	x0, x1, x0
	bl	malloc
	str	x0, [sp, 80]
	ldr	x1, [sp, 64]
	ldr	x0, [sp, 56]
	mul	x0, x1, x0
	mov	x2, x0
	ldr	x1, [sp, 72]
	ldr	x0, [sp, 88]
	bl	memcpy
	ldr	x1, [sp, 64]
	ldr	x0, [sp, 56]
	mul	x0, x1, x0
	mov	x2, x0
	ldr	x1, [sp, 72]
	ldr	x0, [sp, 80]
	bl	memcpy
	ldr	x4, [sp, 40]
	ldr	x3, [sp, 48]
	ldr	x2, [sp, 56]
	ldr	x1, [sp, 64]
	ldr	x0, [sp, 88]
	bl	isort
	ldr	x4, [sp, 40]
	ldr	x3, [sp, 48]
	ldr	x2, [sp, 56]
	ldr	x1, [sp, 64]
	ldr	x0, [sp, 80]
	bl	msort
	ldr	x0, [sp, 64]
	mov	w19, w0
	ldr	x0, [sp, 56]
	mov	w20, w0
	ldr	x1, [sp, 64]
	ldr	x0, [sp, 56]
	mul	x0, x1, x0
	mov	x2, x0
	ldr	x1, [sp, 80]
	ldr	x0, [sp, 88]
	bl	memcmp
	cmp	w0, 0
	cset	w0, eq
	and	w0, w0, 255
	mov	w4, w0
	mov	w3, w20
	mov	w2, w19
	ldr	x1, [sp, 32]
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	ldr	x0, [sp, 80]
	bl	free
	ldr	x0, [sp, 88]
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 96
	ret
	.align	2
filter:
	stp	x29, x30, [sp, -96]!
	mov	x29, sp
	str	x0, [sp, 56]
	str	x1, [sp, 48]
	str	x2, [sp, 40]
	str	x3, [sp, 32]
	str	x4, [sp, 24]
	ldr	x0, [sp, 56]
	str	x0, [sp, 72]
	str	xzr, [sp, 88]
	str	xzr, [sp, 80]
	b	.L45
.L47:
	ldr	x1, [sp, 80]
	ldr	x0, [sp, 40]
	mul	x0, x1, x0
	ldr	x1, [sp, 72]
	add	x0, x1, x0
	ldr	x2, [sp, 32]
	ldr	x1, [sp, 24]
	blr	x2
	cmp	w0, 0
	beq	.L46
	ldr	x0, [sp, 88]
	add	x1, x0, 1
	str	x1, [sp, 88]
	ldr	x1, [sp, 40]
	mul	x0, x0, x1
	ldr	x1, [sp, 72]
	add	x3, x1, x0
	ldr	x1, [sp, 80]
	ldr	x0, [sp, 40]
	mul	x0, x1, x0
	ldr	x1, [sp, 72]
	add	x0, x1, x0
	ldr	x2, [sp, 40]
	mov	x1, x0
	mov	x0, x3
	bl	memmove
.L46:
	ldr	x0, [sp, 80]
	add	x0, x0, 1
	str	x0, [sp, 80]
.L45:
	ldr	x1, [sp, 80]
	ldr	x0, [sp, 48]
	cmp	x1, x0
	bcc	.L47
	ldr	x0, [sp, 88]
	ldp	x29, x30, [sp], 96
	ret
	.align	2
divisible:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldr	x0, [x0]
	ldr	x1, [sp]
	ldr	x1, [x1]
	sdiv	x2, x0, x1
	mul	x1, x2, x1
	sub	x0, x0, x1
	cmp	x0, 0
	cset	w0, eq
	and	w0, w0, 255
	add	sp, sp, 16
	ret
	.section .rodata
	.align	3
.LC10:
	.string	"u8"
	.align	3
.LC11:
	.string	"%02x"
	.align	3
.LC12:
	.string	"\nlower_bound(0x80)=%d\n"
	.align	3
.LC13:
	.string	"s16 desc"
	.align	3
.LC14:
	.string	" %d"
	.align	3
.LC15:
	.string	"\nu32 mask"
	.align	3
.LC16:
	.string	" %08x"
	.align	3
.LC17:
	.string	"\ns64 desc"
	.align	3
.LC18:
	.string	" %ld"
	.align	3
.LC19:
	.string	"\n"
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
.LC26:
	.string	"\nfind echo at %d\n"
	.align	3
.LC27:
	.string	"div6 (%d):"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #1008
	stp	x29, x30, [sp]
	mov	x29, sp
	mov	w0, 2024
	str	w0, [sp, 1004]
	str	xzr, [sp, 992]
	b	.L52
.L53:
	ldr	w1, [sp, 1004]
	mov	w0, 26125
	movk	w0, 0x19, lsl 16
	mul	w1, w1, w0
	mov	w0, 62303
	movk	w0, 0x3c6e, lsl 16
	add	w0, w1, w0
	str	w0, [sp, 1004]
	ldr	w0, [sp, 1004]
	lsr	w0, w0, 24
	and	w2, w0, 255
	ldr	x0, [sp, 992]
	add	x1, sp, 896
	strb	w2, [x1, x0]
	ldr	x0, [sp, 992]
	add	x0, x0, 1
	str	x0, [sp, 992]
.L52:
	ldr	x0, [sp, 992]
	cmp	x0, 39
	bls	.L53
	str	xzr, [sp, 992]
	b	.L54
.L55:
	ldr	w1, [sp, 1004]
	mov	w0, 26125
	movk	w0, 0x19, lsl 16
	mul	w1, w1, w0
	mov	w0, 62303
	movk	w0, 0x3c6e, lsl 16
	add	w0, w1, w0
	str	w0, [sp, 1004]
	ldr	w0, [sp, 1004]
	lsr	w0, w0, 16
	sxth	w2, w0
	ldr	x0, [sp, 992]
	lsl	x0, x0, 1
	add	x1, sp, 848
	strh	w2, [x1, x0]
	ldr	x0, [sp, 992]
	add	x0, x0, 1
	str	x0, [sp, 992]
.L54:
	ldr	x0, [sp, 992]
	cmp	x0, 22
	bls	.L55
	str	xzr, [sp, 992]
	b	.L56
.L57:
	ldr	w1, [sp, 1004]
	mov	w0, 26125
	movk	w0, 0x19, lsl 16
	mul	w1, w1, w0
	mov	w0, 62303
	movk	w0, 0x3c6e, lsl 16
	add	w0, w1, w0
	str	w0, [sp, 1004]
	ldr	x0, [sp, 992]
	lsl	x0, x0, 2
	add	x1, sp, 776
	ldr	w2, [sp, 1004]
	str	w2, [x1, x0]
	ldr	x0, [sp, 992]
	add	x0, x0, 1
	str	x0, [sp, 992]
.L56:
	ldr	x0, [sp, 992]
	cmp	x0, 16
	bls	.L57
	mov	w0, -32768
	strh	w0, [sp, 854]
	mov	w0, 32767
	strh	w0, [sp, 866]
	mov	w0, -1
	str	w0, [sp, 784]
	mov	w0, -2147483648
	str	w0, [sp, 796]
	str	wzr, [sp, 800]
	add	x6, sp, 896
	adrp	x0, .LC10
	add	x5, x0, :lo12:.LC10
	mov	x4, 0
	adrp	x0, cmp_u8
	add	x3, x0, :lo12:cmp_u8
	mov	x2, 1
	mov	x1, 40
	mov	x0, x6
	bl	sort_both
	str	x0, [sp, 984]
	str	xzr, [sp, 992]
	b	.L58
.L59:
	ldr	x1, [sp, 984]
	ldr	x0, [sp, 992]
	add	x0, x1, x0
	ldrb	w0, [x0]
	mov	w1, w0
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	ldr	x0, [sp, 992]
	add	x0, x0, 1
	str	x0, [sp, 992]
.L58:
	ldr	x0, [sp, 992]
	cmp	x0, 39
	bls	.L59
	mov	w0, -128
	strb	w0, [sp, 775]
	add	x6, sp, 775
	mov	x5, 0
	adrp	x0, cmp_u8
	add	x4, x0, :lo12:cmp_u8
	mov	x3, 1
	mov	x2, 40
	ldr	x1, [sp, 984]
	mov	x0, x6
	bl	lower_bound
	mov	w1, w0
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	add	x6, sp, 848
	adrp	x0, .LC13
	add	x5, x0, :lo12:.LC13
	mov	x4, 0
	adrp	x0, cmp_s16_desc
	add	x3, x0, :lo12:cmp_s16_desc
	mov	x2, 2
	mov	x1, 23
	mov	x0, x6
	bl	sort_both
	str	x0, [sp, 976]
	str	xzr, [sp, 992]
	b	.L60
.L61:
	ldr	x0, [sp, 992]
	lsl	x0, x0, 1
	ldr	x1, [sp, 976]
	add	x0, x1, x0
	ldrsh	w0, [x0]
	mov	w1, w0
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	printf
	ldr	x0, [sp, 992]
	add	x0, x0, 1
	str	x0, [sp, 992]
.L60:
	ldr	x0, [sp, 992]
	cmp	x0, 22
	bls	.L61
	mov	w0, 15
	movk	w0, 0xf00, lsl 16
	str	w0, [sp, 768]
	add	x1, sp, 768
	add	x6, sp, 776
	adrp	x0, .LC15
	add	x5, x0, :lo12:.LC15
	mov	x4, x1
	adrp	x0, cmp_u32_mask
	add	x3, x0, :lo12:cmp_u32_mask
	mov	x2, 4
	mov	x1, 17
	mov	x0, x6
	bl	sort_both
	str	x0, [sp, 968]
	str	xzr, [sp, 992]
	b	.L62
.L63:
	ldr	x0, [sp, 992]
	lsl	x0, x0, 2
	ldr	x1, [sp, 968]
	add	x0, x1, x0
	ldr	w0, [x0]
	mov	w1, w0
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	ldr	x0, [sp, 992]
	add	x0, x0, 1
	str	x0, [sp, 992]
.L62:
	ldr	x0, [sp, 992]
	cmp	x0, 16
	bls	.L63
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 680
	ldr	q27, [x1]
	ldr	q28, [x1, 16]
	ldr	q29, [x1, 32]
	ldr	q30, [x1, 48]
	ldr	q31, [x1, 64]
	ldr	x1, [x1, 80]
	str	q27, [x0]
	str	q28, [x0, 16]
	str	q29, [x0, 32]
	str	q30, [x0, 48]
	str	q31, [x0, 64]
	str	x1, [x0, 80]
	mov	w0, -1
	str	w0, [sp, 676]
	add	x1, sp, 676
	add	x6, sp, 680
	adrp	x0, .LC17
	add	x5, x0, :lo12:.LC17
	mov	x4, x1
	adrp	x0, cmp_s64_dir
	add	x3, x0, :lo12:cmp_s64_dir
	mov	x2, 8
	mov	x1, 11
	mov	x0, x6
	bl	sort_both
	str	x0, [sp, 960]
	str	xzr, [sp, 992]
	b	.L64
.L65:
	ldr	x0, [sp, 992]
	lsl	x0, x0, 3
	ldr	x1, [sp, 960]
	add	x0, x1, x0
	ldr	x0, [x0]
	mov	x1, x0
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	printf
	ldr	x0, [sp, 992]
	add	x0, x0, 1
	str	x0, [sp, 992]
.L64:
	ldr	x0, [sp, 992]
	cmp	x0, 10
	bls	.L65
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	printf
	add	x0, sp, 504
	mov	x2, 168
	mov	w1, 0
	bl	memset
	add	x0, sp, 288
	mov	x2, 216
	mov	w1, 0
	bl	memset
	str	xzr, [sp, 992]
	b	.L66
.L67:
	adrp	x0, .LC20
	add	x1, x0, :lo12:.LC20
	ldr	x0, [sp, 992]
	add	x0, x1, x0
	ldrb	w2, [x0]
	ldr	x1, [sp, 992]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x1, sp, 504
	strb	w2, [x1, x0]
	ldr	x0, [sp, 992]
	mov	w2, w0
	ldr	x1, [sp, 992]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x1, sp, 508
	str	w2, [x1, x0]
	ldr	x0, [sp, 992]
	and	w1, w0, 65535
	mov	w0, 1000
	mul	w0, w1, w0
	and	w0, w0, 65535
	sxth	w2, w0
	ldr	x1, [sp, 992]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x1, sp, 512
	strh	w2, [x1, x0]
	ldr	x0, [sp, 992]
	add	x0, x0, 1
	str	x0, [sp, 992]
.L66:
	ldr	x0, [sp, 992]
	cmp	x0, 13
	bls	.L67
	add	x6, sp, 504
	adrp	x0, .LC21
	add	x5, x0, :lo12:.LC21
	mov	x4, 0
	adrp	x0, cmp_s12_tag
	add	x3, x0, :lo12:cmp_s12_tag
	mov	x2, 12
	mov	x1, 14
	mov	x0, x6
	bl	sort_both
	str	x0, [sp, 952]
	str	xzr, [sp, 992]
	b	.L68
.L69:
	ldr	x1, [sp, 992]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x0
	ldr	x0, [sp, 952]
	add	x0, x0, x1
	ldrb	w0, [x0]
	mov	w3, w0
	ldr	x1, [sp, 992]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x0
	ldr	x0, [sp, 952]
	add	x0, x0, x1
	ldr	w0, [x0, 4]
	mov	w2, w0
	mov	w1, w3
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	printf
	ldr	x0, [sp, 992]
	add	x0, x0, 1
	str	x0, [sp, 992]
.L68:
	ldr	x0, [sp, 992]
	cmp	x0, 13
	bls	.L69
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	printf
	adrp	x0, .LC23
	add	x1, x0, :lo12:.LC23
	add	x0, sp, 216
	ldr	q28, [x1]
	ldr	q29, [x1, 16]
	ldr	q30, [x1, 32]
	ldr	q31, [x1, 48]
	ldr	x1, [x1, 64]
	str	q28, [x0]
	str	q29, [x0, 16]
	str	q30, [x0, 32]
	str	q31, [x0, 48]
	str	x1, [x0, 64]
	str	xzr, [sp, 992]
	b	.L70
.L71:
	add	x2, sp, 288
	ldr	x1, [sp, 992]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	add	x3, x0, 8
	ldr	x0, [sp, 992]
	lsl	x0, x0, 3
	add	x1, sp, 216
	ldr	x0, [x1, x0]
	mov	x2, 8
	mov	x1, x0
	mov	x0, x3
	bl	strncpy
	ldr	x1, [sp, 992]
	mov	x0, x1
	lsl	x0, x0, 3
	sub	x2, x0, x1
	mov	x0, -3689348814741910324
	movk	x0, 0xcccd, lsl 0
	umulh	x0, x2, x0
	lsr	x1, x0, 2
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	sub	x1, x2, x0
	mov	x0, x1
	sub	x2, x0, #2
	ldr	x1, [sp, 992]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x1, sp, 288
	str	x2, [x1, x0]
	ldr	x0, [sp, 992]
	mov	w2, w0
	ldr	x1, [sp, 992]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x1, sp, 304
	str	w2, [x1, x0]
	ldr	x0, [sp, 992]
	add	x0, x0, 1
	str	x0, [sp, 992]
.L70:
	ldr	x0, [sp, 992]
	cmp	x0, 8
	bls	.L71
	add	x6, sp, 288
	adrp	x0, .LC24
	add	x5, x0, :lo12:.LC24
	mov	x4, 0
	adrp	x0, cmp_s24
	add	x3, x0, :lo12:cmp_s24
	mov	x2, 24
	mov	x1, 9
	mov	x0, x6
	bl	sort_both
	str	x0, [sp, 944]
	str	xzr, [sp, 992]
	b	.L72
.L73:
	ldr	x1, [sp, 992]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 944]
	add	x0, x0, x1
	add	x4, x0, 8
	ldr	x1, [sp, 992]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 944]
	add	x0, x0, x1
	ldr	x2, [x0]
	ldr	x1, [sp, 992]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 944]
	add	x0, x0, x1
	ldr	w0, [x0, 16]
	mov	w3, w0
	mov	x1, x4
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	printf
	ldr	x0, [sp, 992]
	add	x0, x0, 1
	str	x0, [sp, 992]
.L72:
	ldr	x0, [sp, 992]
	cmp	x0, 8
	bls	.L73
	adrp	x0, .LC8
	add	x1, x0, :lo12:.LC8
	add	x0, sp, 192
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x6, sp, 192
	mov	x5, 0
	adrp	x0, cmp_s24
	add	x4, x0, :lo12:cmp_s24
	mov	x3, 24
	mov	x2, 9
	ldr	x1, [sp, 944]
	mov	x0, x6
	bl	lower_bound
	mov	w1, w0
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	printf
	mov	x0, 6
	str	x0, [sp, 24]
	str	xzr, [sp, 992]
	b	.L74
.L77:
	ldr	x0, [sp, 992]
	mul	x3, x0, x0
	ldr	x2, [sp, 992]
	mov	x0, -6148914691236517206
	movk	x0, 0xaaab, lsl 0
	umulh	x0, x2, x0
	lsr	x1, x0, 1
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	sub	x1, x2, x0
	cmp	x1, 0
	beq	.L75
	mov	x0, 1
	b	.L76
.L75:
	mov	x0, -1
.L76:
	mul	x1, x0, x3
	mov	x0, 16963
	movk	x0, 0xf, lsl 16
	mul	x0, x1, x0
	mov	x2, x0
	ldr	x0, [sp, 992]
	lsl	x0, x0, 3
	add	x1, sp, 32
	str	x2, [x1, x0]
	ldr	x0, [sp, 992]
	add	x0, x0, 1
	str	x0, [sp, 992]
.L74:
	ldr	x0, [sp, 992]
	cmp	x0, 19
	bls	.L77
	add	x0, sp, 24
	add	x5, sp, 32
	mov	x4, x0
	adrp	x0, divisible
	add	x3, x0, :lo12:divisible
	mov	x2, 8
	mov	x1, 20
	mov	x0, x5
	bl	filter
	str	x0, [sp, 936]
	ldr	x0, [sp, 936]
	mov	w1, w0
	adrp	x0, .LC27
	add	x0, x0, :lo12:.LC27
	bl	printf
	str	xzr, [sp, 992]
	b	.L78
.L79:
	ldr	x0, [sp, 992]
	lsl	x0, x0, 3
	add	x1, sp, 32
	ldr	x0, [x1, x0]
	mov	x1, x0
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	printf
	ldr	x0, [sp, 992]
	add	x0, x0, 1
	str	x0, [sp, 992]
.L78:
	ldr	x1, [sp, 992]
	ldr	x0, [sp, 936]
	cmp	x1, x0
	bcc	.L79
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	printf
	ldr	x0, [sp, 984]
	bl	free
	ldr	x0, [sp, 976]
	bl	free
	ldr	x0, [sp, 968]
	bl	free
	ldr	x0, [sp, 960]
	bl	free
	ldr	x0, [sp, 952]
	bl	free
	ldr	x0, [sp, 944]
	bl	free
	mov	w0, 0
	ldp	x29, x30, [sp]
	add	sp, sp, 1008
	ret
	.section .rodata
	.align	3
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
	.align	3
.LC20:
	.string	"dbcadbbcadcaab"
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
	.align	3
.LC23:
	.xword	.LC1
	.xword	.LC2
	.xword	.LC1
	.xword	.LC3
	.xword	.LC4
	.xword	.LC5
	.xword	.LC2
	.xword	.LC6
	.xword	.LC3
	.align	3
.LC8:
	.xword	0
	.string	"echo"
	.zero	3
	.word	0
	.zero	4
	.text

