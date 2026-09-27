	.text
	.align	2
	.p2align 5,,15
	.global	bubble
bubble:
	cmp	w1, 1
	ble	.L1
	ubfiz	x2, x1, 2, 32
	sub	w1, w1, #2
	sub	x4, x0, #4
	add	x4, x4, x2
	sub	x2, x2, w1, uxtw 2
	sub	x1, x0, #8
	add	x5, x2, x1
	.p2align 5,,15
.L3:
	mov	x1, x0
	.p2align 5,,15
.L5:
	ldp	w3, w2, [x1]
	cmp	w3, w2
	ble	.L4
	stp	w2, w3, [x1]
.L4:
	add	x1, x1, 4
	cmp	x1, x4
	bne	.L5
	sub	x4, x4, #4
	cmp	x4, x5
	bne	.L3
.L1:
	ret
	.section .rodata
	.align	3
.LC5:
	.string	"%d "
	.align	3
.LC6:
	.string	"%d %d %d\n"
	.align	3
.LC1:
	.string	"alpha"
	.align	3
.LC2:
	.string	"beta"
	.align	3
.LC3:
	.string	"gamma"
	.align	3
.LC7:
	.string	"%s "
	.align	3
.LC8:
	.string	"%ld\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #944
	adrp	x0, .LANCHOR0
	add	x0, x0, :lo12:.LANCHOR0
	add	x4, sp, 104
	stp	x29, x30, [sp]
	mov	x29, sp
	ldp	x2, x3, [x0, 16]
	stp	x19, x20, [sp, 16]
	mov	x20, x4
	str	x21, [sp, 32]
	ldp	x6, x7, [x0]
	stp	x2, x3, [x4, 16]
	add	x3, sp, 140
	ldr	x0, [x0, 32]
	str	x0, [x4, 32]
	stp	x6, x7, [sp, 104]
	.p2align 5,,15
.L9:
	mov	x0, x4
	.p2align 5,,15
.L11:
	ldp	w2, w1, [x0]
	cmp	w2, w1
	ble	.L10
	stp	w1, w2, [x0]
.L10:
	add	x0, x0, 4
	cmp	x3, x0
	bne	.L11
	sub	x3, x3, #4
	cmp	x3, x4
	bne	.L9
	adrp	x21, .LC5
	add	x19, x3, 40
	add	x21, x21, :lo12:.LC5
	.p2align 5,,15
.L13:
	ldr	w1, [x20], 4
	mov	x0, x21
	bl	printf
	cmp	x19, x20
	bne	.L13
	mov	w0, 10
	bl	putchar
	mov	w3, 33
	mov	w2, 10
	mov	w1, 23
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	x0, 36
	add	x19, sp, 72
	movk	x0, 0x19, lsl 32
	str	x0, [sp, 72]
	mov	x0, 16
	add	x20, sp, 100
	movk	x0, 0x9, lsl 32
	str	x0, [sp, 80]
	mov	x0, 4
	str	wzr, [sp, 96]
	movk	x0, 0x1, lsl 32
	str	x0, [sp, 88]
	.p2align 5,,15
.L14:
	ldr	w1, [x19], 4
	mov	x0, x21
	bl	printf
	cmp	x20, x19
	bne	.L14
	mov	w0, 10
	bl	putchar
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	adrp	x20, .LC7
	add	x19, sp, 48
	add	x21, sp, 24
	add	x20, x20, :lo12:.LC7
	str	x0, [sp, 48]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	str	x0, [sp, 56]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	str	x0, [sp, 64]
.L15:
	ldr	x1, [x19, 16]
	mov	x0, x20
	sub	x19, x19, #8
	bl	printf
	cmp	x19, x21
	bne	.L15
	mov	w0, 10
	bl	putchar
	add	x4, sp, 144
	mov	x0, 1
	.p2align 5,,15
.L16:
	sub	x2, x0, #1
	add	x3, x4, x0, lsl 3
	add	x0, x0, 1
	smull	x1, w2, w2
	smull	x1, w1, w2
	str	x1, [x3, -8]
	cmp	x0, 101
	bne	.L16
	add	x2, sp, 984
	mov	x1, 0
	.p2align 5,,15
.L17:
	ldr	x0, [x4], 56
	add	x1, x1, x0
	cmp	x2, x4
	bne	.L17
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldr	x21, [sp, 32]
	mov	w0, 0
	ldp	x29, x30, [sp]
	ldp	x19, x20, [sp, 16]
	add	sp, sp, 944
	ret
	.section .rodata
	.align	3
	.LANCHOR0:
.LC0:
	.word	9
	.word	3
	.word	7
	.word	1
	.word	8
	.word	2
	.word	6
	.word	5
	.word	4
	.word	0

