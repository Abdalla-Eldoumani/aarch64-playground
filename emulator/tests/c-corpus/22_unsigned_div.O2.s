	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%u %u\n"
	.align	3
.LC1:
	.string	"%d %d %d\n"
	.align	3
.LC2:
	.string	"%d %d\n"
	.align	3
.LC3:
	.string	"%ld %ld\n"
	.align	3
.LC4:
	.string	"%lu %lu\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	w1, 31524
	mov	w2, 4
	mov	x29, sp
	movk	w1, 0x198b, lsl 16
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	str	x19, [sp, 16]
	bl	printf
	mov	w3, 54198
	mov	w1, 11338
	movk	w3, 0x883, lsl 16
	mov	w2, -6
	movk	w1, 0xf77c, lsl 16
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	adrp	x19, .LC2
	mov	w2, 1
	add	x0, x19, :lo12:.LC2
	mov	w1, 0
	bl	printf
	add	x0, x19, :lo12:.LC2
	mov	w2, -126
	mov	w1, 4
	bl	printf
	mov	x1, -21568
	mov	x2, 0
	movk	x1, 0xff76, lsl 16
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	x1, 13416
	mov	x2, 8287
	movk	x1, 0xd7ec, lsl 16
	adrp	x0, .LC4
	movk	x1, 0xe8, lsl 32
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	x19, [sp, 16]
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret

