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
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -144]!
	mov	x0, 5
	movk	x0, 0x3, lsl 32
	mov	x29, sp
	str	x0, [sp, 112]
	mov	x0, 9
	movk	x0, 0x1, lsl 32
	str	x0, [sp, 120]
	mov	x0, 7
	stp	x25, x26, [sp, 64]
	movk	x0, 0x2, lsl 32
	str	x0, [sp, 128]
	mov	x0, 8
	movk	x0, 0x6, lsl 32
	adrp	x26, .LC1
	add	x26, x26, :lo12:.LC1
	stp	x27, x28, [sp, 80]
	add	x27, sp, 96
	add	x28, sp, 112
	str	x0, [sp, 136]
	adrp	x0, asc
	add	x0, x0, :lo12:asc
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	str	x0, [sp, 96]
	adrp	x0, desc
	add	x0, x0, :lo12:desc
	str	x0, [sp, 104]
.L26:
	ldr	x24, [x27]
	mov	x25, x28
	add	x20, sp, 116
	mov	x23, 7
	.align 5
.L20:
	mov	x19, 0
	.align 5
.L23:
	ldr	w22, [x20, x19, lsl 2]
	ldr	w21, [x20, -4]
	mov	w1, w22
	mov	w0, w21
	blr	x24
	cmp	w0, 0
	ble	.L22
	str	w22, [x20, -4]
	str	w21, [x20, x19, lsl 2]
.L22:
	add	x19, x19, 1
	cmp	x19, x23
	bne	.L23
	add	x20, x20, 4
	subs	x23, x23, #1
	bne	.L20
	.align 5
.L25:
	ldr	w1, [x25], 4
	mov	x0, x26
	bl	printf
	add	x0, sp, 144
	cmp	x0, x25
	bne	.L25
	mov	w0, 10
	add	x27, x27, 8
	bl	putchar
	cmp	x27, x28
	bne	.L26
	ldp	x19, x20, [sp, 16]
	mov	w0, 0
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 144
	ret

