	.text
	.align	2
	.align 5
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
	.align 5
.L3:
	mov	x1, x0
	.align 5
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
	.string	"\n"
	.align	3
.LC7:
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
.LC8:
	.string	"%s "
	.align	3
.LC9:
	.string	"%ld\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #960
	adrp	x0, .LANCHOR0
	add	x0, x0, :lo12:.LANCHOR0
	mov	w1, 10
	stp	x29, x30, [sp]
	mov	x29, sp
	ldp	x4, x5, [x0]
	stp	x19, x20, [sp, 16]
	add	x19, sp, 160
	ldp	x2, x3, [x0, 16]
	stp	x21, x22, [sp, 32]
	adrp	x21, .LC5
	ldr	x0, [x0, 32]
	str	x0, [sp, 152]
	add	x0, sp, 120
	add	x21, x21, :lo12:.LC5
	mov	x20, x0
	str	x23, [sp, 48]
	stp	x4, x5, [sp, 120]
	stp	x2, x3, [sp, 136]
	bl	bubble
	.align 5
.L9:
	ldr	w1, [x20], 4
	mov	x0, x21
	bl	printf
	cmp	x19, x20
	bne	.L9
	adrp	x23, .LC6
	add	x23, x23, :lo12:.LC6
	mov	x0, x23
	bl	printf
	mov	w3, 33
	mov	w2, 10
	mov	w1, 23
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	mov	x0, 36
	add	x20, sp, 88
	movk	x0, 0x19, lsl 32
	str	x0, [sp, 88]
	mov	x0, 16
	add	x22, sp, 116
	movk	x0, 0x9, lsl 32
	str	x0, [sp, 96]
	mov	x0, 4
	str	wzr, [sp, 112]
	movk	x0, 0x1, lsl 32
	str	x0, [sp, 104]
	.align 5
.L10:
	ldr	w1, [x20], 4
	mov	x0, x21
	bl	printf
	cmp	x20, x22
	bne	.L10
	mov	x0, x23
	bl	printf
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	adrp	x21, .LC8
	add	x20, sp, 64
	add	x22, sp, 40
	add	x21, x21, :lo12:.LC8
	str	x0, [sp, 64]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	str	x0, [sp, 72]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	str	x0, [sp, 80]
.L11:
	ldr	x1, [x20, 16]
	mov	x0, x21
	sub	x20, x20, #8
	bl	printf
	cmp	x20, x22
	bne	.L11
	mov	x0, x23
	bl	printf
	mov	x0, 1
	.align 5
.L12:
	sub	x2, x0, #1
	add	x3, x19, x0, lsl 3
	add	x0, x0, 1
	smull	x1, w2, w2
	smull	x1, w1, w2
	str	x1, [x3, -8]
	cmp	x0, 101
	bne	.L12
	add	x2, sp, 1000
	mov	x1, 0
	.align 5
.L13:
	ldr	x0, [x19], 56
	add	x1, x1, x0
	cmp	x2, x19
	bne	.L13
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	ldr	x23, [sp, 48]
	mov	w0, 0
	ldp	x29, x30, [sp]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	add	sp, sp, 960
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

