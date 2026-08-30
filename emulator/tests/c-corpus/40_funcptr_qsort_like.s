	.text
	.align	2
	.global	asc
asc:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w1, [sp, 12]
	ldr	w0, [sp, 8]
	sub	w0, w1, w0
	add	sp, sp, 16
	ret
	.align	2
	.global	desc
desc:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w1, [sp, 8]
	ldr	w0, [sp, 12]
	sub	w0, w1, w0
	add	sp, sp, 16
	ret
	.align	2
	.global	sort
sort:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x0, [sp, 40]
	str	w1, [sp, 36]
	str	x2, [sp, 24]
	str	wzr, [sp, 60]
	b	.L6
.L10:
	ldr	w0, [sp, 60]
	add	w0, w0, 1
	str	w0, [sp, 56]
	b	.L7
.L9:
	ldrsw	x0, [sp, 60]
	lsl	x0, x0, 2
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	ldr	w3, [x0]
	ldrsw	x0, [sp, 56]
	lsl	x0, x0, 2
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	ldr	w0, [x0]
	ldr	x2, [sp, 24]
	mov	w1, w0
	mov	w0, w3
	blr	x2
	cmp	w0, 0
	ble	.L8
	ldrsw	x0, [sp, 60]
	lsl	x0, x0, 2
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	ldr	w0, [x0]
	str	w0, [sp, 52]
	ldrsw	x0, [sp, 56]
	lsl	x0, x0, 2
	ldr	x1, [sp, 40]
	add	x1, x1, x0
	ldrsw	x0, [sp, 60]
	lsl	x0, x0, 2
	ldr	x2, [sp, 40]
	add	x0, x2, x0
	ldr	w1, [x1]
	str	w1, [x0]
	ldrsw	x0, [sp, 56]
	lsl	x0, x0, 2
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	ldr	w1, [sp, 52]
	str	w1, [x0]
.L8:
	ldr	w0, [sp, 56]
	add	w0, w0, 1
	str	w0, [sp, 56]
.L7:
	ldr	w1, [sp, 56]
	ldr	w0, [sp, 36]
	cmp	w1, w0
	blt	.L9
	ldr	w0, [sp, 60]
	add	w0, w0, 1
	str	w0, [sp, 60]
.L6:
	ldr	w1, [sp, 60]
	ldr	w0, [sp, 36]
	cmp	w1, w0
	blt	.L10
	nop
	nop
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"%d "
	.align	3
.LC2:
	.string	"\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 40
	ldp	x4, x5, [x1]
	ldp	x2, x3, [x1, 16]
	stp	x4, x5, [x0]
	stp	x2, x3, [x0, 16]
	adrp	x0, asc
	add	x0, x0, :lo12:asc
	str	x0, [sp, 24]
	adrp	x0, desc
	add	x0, x0, :lo12:desc
	str	x0, [sp, 32]
	str	wzr, [sp, 76]
	b	.L12
.L15:
	ldrsw	x0, [sp, 76]
	lsl	x0, x0, 3
	add	x1, sp, 24
	ldr	x1, [x1, x0]
	add	x0, sp, 40
	mov	x2, x1
	mov	w1, 8
	bl	sort
	str	wzr, [sp, 72]
	b	.L13
.L14:
	ldrsw	x0, [sp, 72]
	lsl	x0, x0, 2
	add	x1, sp, 40
	ldr	w0, [x1, x0]
	mov	w1, w0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 72]
	add	w0, w0, 1
	str	w0, [sp, 72]
.L13:
	ldr	w0, [sp, 72]
	cmp	w0, 7
	ble	.L14
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L12:
	ldr	w0, [sp, 76]
	cmp	w0, 1
	ble	.L15
	mov	w0, 0
	ldp	x29, x30, [sp], 80
	ret
	.section .rodata
	.align	3
.LC0:
	.word	5
	.word	3
	.word	9
	.word	1
	.word	7
	.word	2
	.word	8
	.word	6
	.text

