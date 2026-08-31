	.text
	.align	2
	.align 5
	.global	asc
asc:
	sub	w0, w0, w1
	ret
	.align	2
	.align 5
	.global	desc
desc:
	sub	w0, w1, w0
	ret
	.align	2
	.align 5
	.global	sort
sort:
	cmp	w1, 0
	ble	.L16
	cmp	w1, 1
	beq	.L16
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	str	x25, [sp, 64]
	uxtw	x25, w1
	stp	x21, x22, [sp, 32]
	mov	x21, x0
	sub	x22, x0, #4
	stp	x23, x24, [sp, 48]
	mov	x24, x2
	mov	x23, x25
	stp	x19, x20, [sp, 16]
	mov	x20, 1
	.align 5
.L6:
	mov	x19, x20
	.align 5
.L8:
	ldr	w1, [x21, x19, lsl 2]
	ldr	w0, [x22, x20, lsl 2]
	blr	x24
	cmp	w0, 0
	ble	.L7
	ldr	w3, [x21, x19, lsl 2]
	ldr	w0, [x22, x20, lsl 2]
	str	w3, [x22, x20, lsl 2]
	str	w0, [x21, x19, lsl 2]
.L7:
	add	x19, x19, 1
	cmp	w23, w19
	bgt	.L8
	add	x20, x20, 1
	cmp	x20, x25
	bne	.L6
	ldr	x25, [sp, 64]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 80
	ret
.L16:
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
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -112]!
	mov	x0, 5
	movk	x0, 0x3, lsl 32
	mov	x29, sp
	str	x0, [sp, 80]
	mov	x0, 9
	movk	x0, 0x1, lsl 32
	str	x0, [sp, 88]
	mov	x0, 7
	stp	x19, x20, [sp, 16]
	movk	x0, 0x2, lsl 32
	str	x0, [sp, 96]
	mov	x0, 8
	movk	x0, 0x6, lsl 32
	adrp	x20, .LC1
	add	x20, x20, :lo12:.LC1
	stp	x21, x22, [sp, 32]
	add	x21, sp, 64
	add	x22, sp, 80
	str	x23, [sp, 48]
	adrp	x23, .LC2
	add	x23, x23, :lo12:.LC2
	str	x0, [sp, 104]
	adrp	x0, asc
	add	x0, x0, :lo12:asc
	str	x0, [sp, 64]
	adrp	x0, desc
	add	x0, x0, :lo12:desc
	str	x0, [sp, 72]
.L21:
	ldr	x2, [x21]
	mov	x0, x22
	mov	x19, x22
	mov	w1, 8
	bl	sort
	.align 5
.L20:
	ldr	w1, [x19], 4
	mov	x0, x20
	bl	printf
	add	x0, sp, 112
	cmp	x0, x19
	bne	.L20
	mov	x0, x23
	add	x21, x21, 8
	bl	printf
	cmp	x21, x22
	bne	.L21
	ldr	x23, [sp, 48]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 112
	ret

