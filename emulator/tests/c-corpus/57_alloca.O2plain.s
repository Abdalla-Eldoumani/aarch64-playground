	.text
	.align	2
	.align 5
once:
	ubfx	x1, x0, 4, 8
	add	w0, w1, w0, uxtb
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"alloca(%d): mod16=%d len=%d first=%c\n"
	.text
	.align	2
	.align 5
odd:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	stp	x21, x22, [sp, 32]
	adrp	x22, .LC0
	add	x22, x22, :lo12:.LC0
	str	x23, [sp, 48]
	adrp	x23, .LANCHOR0
	add	x23, x23, :lo12:.LANCHOR0
	stp	x19, x20, [sp, 16]
	mov	w20, 0
	.align 5
.L5:
	ldr	w21, [x23, w20, sxtw 2]
	add	w1, w20, 97
	add	w20, w20, 1
	sxtw	x19, w21
	add	x0, x19, 15
	mov	x2, x19
	and	x0, x0, -16
	sub	sp, sp, x0
	add	x19, sp, x19
	mov	x0, sp
	bl	memset
	mov	x0, sp
	strb	wzr, [x19, -1]
	bl	strlen
	mov	w3, w0
	cmp	w21, 1
	ldrb	w4, [sp]
	mov	w0, 45
	mov	w1, w21
	csel	w4, w4, w0, gt
	mov	w2, 0
	mov	x0, x22
	bl	printf
	cmp	w20, 6
	bne	.L5
	mov	sp, x29
	ldr	x23, [sp, 48]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"block %d of %d"
	.align	3
.LC2:
	.string	"pile: %s | %s | total=%d\n"
	.text
	.align	2
	.align 5
pile:
	stp	x29, x30, [sp, -368]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LC1
	add	x20, x20, :lo12:.LC1
	str	x21, [sp, 32]
	add	x21, x29, 48
	mov	x19, 24
	.align 5
.L10:
	add	x1, x21, x19, lsl 3
	add	x0, x19, 15
	and	x0, x0, -16
	sub	w2, w19, #24
	sub	sp, sp, x0
	add	x19, x19, 1
	mov	x0, sp
	mov	w3, 40
	str	x0, [x1, -192]
	mov	x1, x20
	bl	sprintf
	cmp	x19, 64
	bne	.L10
	mov	x19, 1
	mov	w20, 0
	.align 5
.L11:
	add	x0, x21, x19, lsl 3
	ldr	x0, [x0, -8]
	bl	strlen
	madd	w20, w0, w19, w20
	add	x19, x19, 1
	cmp	x19, 41
	bne	.L11
	ldr	x1, [x29, 48]
	mov	w3, w20
	ldr	x2, [x29, 360]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	sp, x29
	ldr	x21, [sp, 32]
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 368
	ret
	.align	2
	.align 5
big__constprop__0:
	stp	x29, x30, [sp, -16]!
	mov	x0, -4464
	movk	x0, 0xfffe, lsl 16
	mov	x29, sp
	mov	x2, 4464
	add	sp, sp, x0
	movk	x2, 0x1, lsl 16
	mov	w1, 17
	mov	x0, sp
	bl	memset
	mov	x3, x0
	mov	x1, 8246
	mov	x0, 0
	mov	x2, 4099
	movk	x1, 0x1, lsl 16
	.align 5
.L16:
	strb	w0, [x3, x0]
	add	x0, x0, x2
	cmp	x0, x1
	bne	.L16
	add	x4, x3, 69632
	mov	x1, x3
	add	x4, x4, 1155
	mov	w0, 0
	.align 5
.L17:
	ldrb	w2, [x1]
	add	w0, w0, w0, lsl 2
	add	x1, x1, 997
	add	w0, w2, w0
	cmp	x1, x4
	bne	.L17
	add	x3, x3, 69632
	ldrb	w1, [x3, 367]
	mov	sp, x29
	add	w0, w1, w0
	ldp	x29, x30, [sp], 16
	ret
	.align	2
	.align 5
survive__constprop__0:
	adrp	x2, .LANCHOR1
	add	x0, x2, :lo12:.LANCHOR1
	stp	x29, x30, [sp, -16]!
	mov	x29, sp
	sub	sp, sp, #112
	ldp	q29, q30, [x0, 16]
	mov	x1, sp
	ldr	q31, [x2, :lo12:.LANCHOR1]
	add	x2, sp, 96
	stp	q31, q29, [sp]
	ldp	q29, q31, [x0, 48]
	stp	q30, q29, [sp, 32]
	ldr	q30, [x0, 80]
	mov	w0, 576
	str	w0, [sp, 96]
	mov	x0, sp
	stp	q31, q30, [sp, 64]
	movi	v31.4s, 0
	.align 5
.L22:
	ldr	q30, [x0], 16
	add	v31.4s, v30.4s, v31.4s
	cmp	x0, x2
	bne	.L22
	addv	s31, v31.4s
	ldr	w1, [x1, 96]
	mov	sp, x29
	fmov	w0, s31
	ldp	x29, x30, [sp], 16
	sub	w0, w0, #1
	add	w0, w0, w1
	ret
	.align	2
	.align 5
chain__constprop__0:
	stp	x29, x30, [sp, -16]!
	adrp	x2, .LANCHOR1+96
	mov	x1, 0
	mov	x29, sp
	ldr	q28, [x2, :lo12:.LANCHOR1+96]
	adrp	x2, .LC10
	ldr	q29, [x2, :lo12:.LC10]
	b	.L29
	.align 2
.L26:
	sub	w0, w0, #1
	mov	x1, sp
.L29:
	dup	v30.4s, w0
	sub	sp, sp, #48
	mov	v31.16b, v29.16b
	mov	v27.16b, v29.16b
	str	x1, [sp]
	smlal	v31.2d, v30.2s, v28.2s
	smlal2	v27.2d, v30.4s, v28.4s
	str	q31, [sp, 8]
	str	q27, [sp, 24]
	cmp	w0, 0
	bgt	.L26
	fmov	x0, d31
	mov	w3, 1
	cbz	x1, .L28
	.align 5
.L27:
	ubfiz	x4, x3, 3, 2
	add	x0, x0, x0, lsl 1
	add	x2, x1, x4
	add	w3, w3, 1
	ldr	x1, [x1]
	ldr	x2, [x2, 8]
	add	x0, x0, x2
	cbnz	x1, .L27
.L28:
	mov	sp, x29
	add	x0, x0, w3, sxtw
	ldp	x29, x30, [sp], 16
	ret
	.section .rodata
	.align	3
.LC11:
	.string	"once x%d: sum=%lld\n"
	.align	3
.LC12:
	.string	"chain=%llu\n"
	.align	3
.LC13:
	.string	"survive=%d\n"
	.align	3
.LC14:
	.string	"big=%u\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x19, [sp, 16]
	adrp	x19, .LANCHOR0
	add	x19, x19, :lo12:.LANCHOR0
	bl	odd
	bl	pile
	ldr	w0, [x19, 24]
	cmp	w0, 0
	ble	.L37
	mov	w3, 0
	mov	x2, 0
	.align 5
.L36:
	mov	w0, w3
	bl	once
	add	x2, x2, w0, sxtw
	ldr	w0, [x19, 24]
	add	w3, w3, 1
	cmp	w0, w3
	bgt	.L36
.L35:
	ldr	w1, [x19, 24]
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	ldr	w0, [x19, 28]
	bl	chain__constprop__0
	mov	x1, x0
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	bl	survive__constprop__0
	mov	w1, w0
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	bl	big__constprop__0
	mov	w1, w0
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	printf
	ldr	x19, [sp, 16]
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret
.L37:
	mov	x2, 0
	b	.L35
	.section .rodata
	.align	4
	.LANCHOR1:
.LC3:
	.word	0
	.word	1
	.word	4
	.word	9
.LC4:
	.word	16
	.word	25
	.word	36
	.word	49
.LC5:
	.word	64
	.word	81
	.word	100
	.word	121
.LC6:
	.word	144
	.word	169
	.word	196
	.word	225
.LC7:
	.word	256
	.word	289
	.word	324
	.word	361
.LC8:
	.word	400
	.word	441
	.word	484
	.word	529
.LC9:
	.word	1
	.word	2
	.word	3
	.word	4
.LC10:
	.quad	-200
	.quad	-200
	.data
	.align	4
	.LANCHOR0:
odd_sizes:
	.word	1
	.word	3
	.word	17
	.word	33
	.word	100
	.word	4097
calls:
	.word	3000
chain_depth:
	.word	120

