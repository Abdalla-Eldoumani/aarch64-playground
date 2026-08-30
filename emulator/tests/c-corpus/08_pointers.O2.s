	.text
	.align	2
	.align 5
	.global	add
add:
	add	w0, w0, w1
	ret
	.align	2
	.align 5
	.global	sub
sub:
	sub	w0, w0, w1
	ret
	.align	2
	.align 5
	.global	mul
mul:
	mul	w0, w0, w1
	ret
	.align	2
	.align 5
	.global	swap
swap:
	ldr	w3, [x1]
	ldr	w2, [x0]
	str	w3, [x0]
	str	w2, [x1]
	ret
	.align	2
	.align 5
	.global	apply
apply:
	mov	x16, x0
	mov	w0, w1
	mov	w1, w2
	br	x16
	.align	2
	.align 5
	.global	set
set:
	str	x1, [x0]
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"%d %d\n"
	.align	3
.LC3:
	.string	"%d %d %ld %d\n"
	.align	3
.LC4:
	.string	"%d "
	.align	3
.LC5:
	.string	"\n"
	.align	3
.LC6:
	.string	"%ld %c\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -128]!
	mov	w0, 3
	mov	x29, sp
	add	x1, sp, 60
	str	w0, [sp, 56]
	mov	w0, 9
	stp	x19, x20, [sp, 16]
	adrp	x20, .LC4
	add	x19, sp, 104
	str	x21, [sp, 32]
	adrp	x21, .LC2
	str	w0, [sp, 60]
	add	x0, sp, 56
	bl	swap
	add	x21, x21, :lo12:.LC2
	ldp	w1, w2, [sp, 56]
	mov	x0, x21
	add	x20, x20, :lo12:.LC4
	bl	printf
	mov	x0, 10
	mov	w4, 40
	movk	x0, 0x14, lsl 32
	str	x0, [sp, 80]
	mov	x0, 30
	mov	x3, 4
	movk	x0, 0x28, lsl 32
	str	x0, [sp, 88]
	mov	x0, 50
	mov	w2, 60
	movk	x0, 0x3c, lsl 32
	mov	w1, 20
	str	x0, [sp, 96]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	adrp	x0, add
	add	x0, x0, :lo12:add
	str	x0, [sp, 104]
	adrp	x0, sub
	add	x0, x0, :lo12:sub
	str	x0, [sp, 112]
	adrp	x0, mul
	add	x0, x0, :lo12:mul
	str	x0, [sp, 120]
.L9:
	ldr	x0, [x19], 8
	mov	w2, 4
	mov	w1, 7
	bl	apply
	mov	w1, w0
	mov	x0, x20
	bl	printf
	add	x0, sp, 128
	cmp	x0, x19
	bne	.L9
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	add	x0, sp, 64
	add	x1, sp, 88
	bl	set
	ldr	x0, [sp, 64]
	cmp	x0, x1
	ldr	w1, [x0]
	cset	w2, eq
	mov	x0, x21
	bl	printf
	mov	x0, 28528
	add	x1, sp, 72
	movk	x0, 0x6e69, lsl 16
	movk	x0, 0x6574, lsl 32
	movk	x0, 0x72, lsl 48
	str	x0, [sp, 72]
	mov	x0, x1
	.align 5
.L10:
	ldrb	w2, [x0, 1]!
	cbnz	w2, .L10
	ldrb	w2, [x0, -1]
	sub	x1, x0, x1
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	x21, [sp, 32]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 128
	ret

