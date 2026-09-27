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
	.string	"%ld %c\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -80]!
	mov	w2, 3
	mov	w1, 9
	mov	x29, sp
	str	x21, [sp, 32]
	adrp	x21, .LC2
	add	x21, x21, :lo12:.LC2
	stp	x19, x20, [sp, 16]
	mov	x0, x21
	bl	printf
	adrp	x20, .LC4
	mov	w4, 40
	mov	x3, 4
	mov	w2, 60
	mov	w1, 20
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	add	x19, sp, 56
	adrp	x0, add
	add	x0, x0, :lo12:add
	add	x20, x20, :lo12:.LC4
	str	x0, [sp, 56]
	adrp	x0, sub
	add	x0, x0, :lo12:sub
	str	x0, [sp, 64]
	adrp	x0, mul
	add	x0, x0, :lo12:mul
	str	x0, [sp, 72]
.L9:
	ldr	x2, [x19], 8
	mov	w1, 4
	mov	w0, 7
	blr	x2
	mov	w1, w0
	mov	x0, x20
	bl	printf
	add	x0, sp, 80
	cmp	x19, x0
	bne	.L9
	mov	w0, 10
	bl	putchar
	mov	w1, 30
	mov	x0, x21
	mov	w2, 1
	bl	printf
	mov	x0, 28528
	add	x1, sp, 48
	movk	x0, 0x6e69, lsl 16
	movk	x0, 0x6574, lsl 32
	movk	x0, 0x72, lsl 48
	str	x0, [sp, 48]
	mov	x0, x1
	.align 5
.L10:
	ldrb	w2, [x0, 1]!
	cbnz	w2, .L10
	ldrb	w2, [x0, -1]
	sub	x1, x0, x1
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	x21, [sp, 32]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 80
	ret

