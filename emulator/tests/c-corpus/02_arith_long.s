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
	.global	main
main:
	stp	x29, x30, [sp, -96]!
	mov	x29, sp
	mov	x0, 6676
	movk	x0, 0xbe99, lsl 16
	movk	x0, 0x1c, lsl 32
	str	x0, [sp, 72]
	mov	x0, -26801
	movk	x0, 0xc521, lsl 16
	str	x0, [sp, 64]
	ldr	x1, [sp, 72]
	ldr	x0, [sp, 64]
	add	x6, x1, x0
	ldr	x1, [sp, 72]
	ldr	x0, [sp, 64]
	sub	x7, x1, x0
	ldr	x1, [sp, 72]
	mov	x0, x1
	lsl	x0, x0, 3
	sub	x3, x0, x1
	ldr	x1, [sp, 72]
	ldr	x0, [sp, 64]
	sdiv	x4, x1, x0
	ldr	x0, [sp, 72]
	ldr	x1, [sp, 64]
	sdiv	x2, x0, x1
	ldr	x1, [sp, 64]
	mul	x1, x2, x1
	sub	x0, x0, x1
	mov	x5, x0
	mov	x2, x7
	mov	x1, x6
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	x0, -1
	str	x0, [sp, 56]
	ldr	x1, [sp, 56]
	mov	x0, -6148914691236517206
	movk	x0, 0xaaab, lsl 0
	umulh	x0, x1, x0
	lsr	x0, x0, 1
	mov	x3, x0
	ldr	x2, [sp, 56]
	ldr	x1, [sp, 56]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	x0, 1
	str	x0, [sp, 88]
	str	wzr, [sp, 84]
	b	.L2
.L3:
	ldr	x1, [sp, 88]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	str	x0, [sp, 88]
	ldr	w0, [sp, 84]
	add	w0, w0, 1
	str	w0, [sp, 84]
.L2:
	ldr	w0, [sp, 84]
	cmp	w0, 39
	ble	.L3
	ldr	x1, [sp, 88]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, -3
	str	w0, [sp, 52]
	ldrsw	x0, [sp, 52]
	str	x0, [sp, 40]
	mov	w0, -16
	str	w0, [sp, 36]
	ldr	w0, [sp, 36]
	str	x0, [sp, 24]
	ldrsw	x0, [sp, 52]
	mov	x3, x0
	ldr	x2, [sp, 24]
	ldr	x1, [sp, 40]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	x2, 6148914691236517205
	movk	x2, 0x1555, lsl 48
	mov	x1, 1099511627776
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 96
	ret

