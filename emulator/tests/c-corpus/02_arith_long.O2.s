	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%ld %ld %ld %ld %ld\n"
	.align	3
.LC1:
	.string	"%lu %lx %lu\n"
	.align	3
.LC2:
	.string	"%ld\n"
	.align	3
.LC3:
	.string	"%ld %lu %lx\n"
	.align	3
.LC4:
	.string	"%ld %ld\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -16]!
	mov	x5, 25688
	mov	x3, 46732
	mov	x2, 33477
	mov	x1, 45411
	movk	x5, 0x3ade, lsl 16
	mov	x4, -124
	movk	x3, 0x362f, lsl 16
	movk	x2, 0xf977, lsl 16
	movk	x1, 0x83ba, lsl 16
	mov	x29, sp
	movk	x3, 0xc9, lsl 32
	movk	x2, 0x1c, lsl 32
	movk	x1, 0x1c, lsl 32
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	x2, -1
	mov	x3, 6148914691236517205
	mov	x1, x2
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, 40
	mov	x1, 1
	.align 5
.L2:
	add	x1, x1, x1, lsl 1
	subs	w0, w0, #1
	bne	.L2
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	x3, -3
	mov	x2, 4294967280
	mov	x1, x3
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	x2, 6148914691236517205
	mov	x1, 1099511627776
	movk	x2, 0x1555, lsl 48
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 16
	ret

