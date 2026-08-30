	.text
	.align	2
	.global	mk
mk:
	sub	sp, sp, #64
	mov	x1, x8
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	str	x0, [sp, 24]
	ldr	x0, [sp, 8]
	add	x0, x0, 1
	str	x0, [sp, 32]
	ldr	x0, [sp, 8]
	add	x0, x0, 2
	str	x0, [sp, 40]
	ldr	x0, [sp, 8]
	add	x0, x0, 3
	str	x0, [sp, 48]
	ldr	x0, [sp, 8]
	add	w0, w0, 4
	str	w0, [sp, 56]
	add	x0, sp, 24
	ldp	x4, x5, [x0]
	ldp	x2, x3, [x0, 16]
	ldr	x0, [x0, 32]
	stp	x4, x5, [x1]
	stp	x2, x3, [x1, 16]
	str	x0, [x1, 32]
	add	sp, sp, 64
	ret
	.align	2
	.global	tot
tot:
	str	x19, [sp, -16]!
	mov	x19, x0
	ldr	x1, [x19]
	ldr	x0, [x19, 8]
	add	x1, x1, x0
	ldr	x0, [x19, 16]
	add	x1, x1, x0
	ldr	x0, [x19, 24]
	add	x1, x1, x0
	ldr	w0, [x19, 32]
	sxtw	x0, w0
	add	x0, x1, x0
	ldr	x19, [sp], 16
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%zu %zu %zu %zu %zu\n"
	.align	3
.LC1:
	.string	"%u %u %u\n"
	.align	3
.LC2:
	.string	"%u %u\n"
	.align	3
.LC3:
	.string	"%ld %ld\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -176]!
	mov	x29, sp
	str	x19, [sp, 16]
	ldr	w0, [sp, 128]
	mov	w1, 5
	bfi	w0, w1, 0, 3
	str	w0, [sp, 128]
	ldr	w0, [sp, 128]
	mov	w1, 17
	bfi	w0, w1, 3, 5
	str	w0, [sp, 128]
	ldr	w0, [sp, 128]
	mov	w1, 300
	bfi	w0, w1, 8, 9
	str	w0, [sp, 128]
	mov	x5, 40
	mov	x4, 4
	mov	x3, 4
	mov	x2, 16
	mov	x1, 32
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	x0, [sp, 128]
	ubfx	x0, x0, 0, 3
	and	w0, w0, 255
	mov	w1, w0
	ldr	x0, [sp, 128]
	ubfx	x0, x0, 3, 5
	and	w0, w0, 255
	mov	w2, w0
	ldr	x0, [sp, 128]
	ubfx	x0, x0, 8, 9
	and	w0, w0, 65535
	mov	w3, w0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 128]
	orr	w0, w0, 130816
	str	w0, [sp, 128]
	ldr	w0, [sp, 128]
	mov	w1, 1
	bfi	w0, w1, 0, 3
	str	w0, [sp, 128]
	ldr	x0, [sp, 128]
	ubfx	x0, x0, 0, 3
	and	w0, w0, 255
	mov	w1, w0
	ldr	x0, [sp, 128]
	ubfx	x0, x0, 8, 9
	and	w0, w0, 65535
	mov	w2, w0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	add	x0, sp, 88
	mov	x8, x0
	mov	x0, 10
	bl	mk
	add	x0, sp, 32
	add	x1, sp, 88
	ldp	x4, x5, [x1]
	ldp	x2, x3, [x1, 16]
	ldr	x1, [x1, 32]
	stp	x4, x5, [x0]
	stp	x2, x3, [x0, 16]
	str	x1, [x0, 32]
	add	x0, sp, 32
	bl	tot
	mov	x19, x0
	add	x0, sp, 136
	mov	x8, x0
	mov	x0, -3
	bl	mk
	add	x0, sp, 32
	add	x1, sp, 136
	ldp	x4, x5, [x1]
	ldp	x2, x3, [x1, 16]
	ldr	x1, [x1, 32]
	stp	x4, x5, [x0]
	stp	x2, x3, [x0, 16]
	str	x1, [x0, 32]
	add	x0, sp, 32
	bl	tot
	mov	x2, x0
	mov	x1, x19
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w0, 0
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 176
	ret

