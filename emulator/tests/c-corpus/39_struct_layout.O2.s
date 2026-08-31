	.text
	.align	2
	.align 5
	.global	mk
mk:
	add	x1, x0, 1
	add	x2, x0, 3
	stp	x0, x1, [x8]
	add	x1, x0, 2
	add	w0, w0, 4
	stp	x1, x2, [x8, 16]
	str	w0, [x8, 32]
	ret
	.align	2
	.align 5
	.global	tot
tot:
	ldp	x1, x2, [x0]
	add	x1, x1, x2
	ldp	x3, x2, [x0, 16]
	ldrsw	x0, [x0, 32]
	add	x1, x1, x3
	add	x1, x1, x2
	add	x0, x1, x0
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
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -144]!
	mov	x4, 4
	mov	x5, 40
	mov	x29, sp
	mov	x3, x4
	mov	x2, 16
	mov	x1, 32
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w3, 300
	mov	w2, 17
	mov	w1, 5
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w1, 1
	mov	w2, 511
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	add	x8, sp, 64
	mov	x0, 10
	bl	mk
	ldp	x4, x5, [sp, 64]
	ldp	x2, x3, [x8, 16]
	ldr	x0, [x8, 32]
	add	x8, sp, 104
	stp	x4, x5, [sp, 16]
	stp	x2, x3, [sp, 32]
	str	x0, [sp, 48]
	add	x0, sp, 16
	bl	tot
	mov	x4, x0
	mov	x0, -3
	bl	mk
	ldp	x2, x3, [x8, 16]
	ldp	x6, x7, [sp, 104]
	ldr	x0, [x8, 32]
	stp	x6, x7, [sp, 16]
	stp	x2, x3, [sp, 32]
	str	x0, [sp, 48]
	add	x0, sp, 16
	bl	tot
	mov	x2, x0
	mov	x1, x4
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 144
	ret

