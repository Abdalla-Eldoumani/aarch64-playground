	.text
	.align	2
	.align 5
	.global	fact
fact:
	cmp	w0, 1
	ble	.L4
	sxtw	x1, w0
	mov	x0, 1
	.align 5
.L3:
	mul	x0, x0, x1
	sub	x1, x1, #1
	cmp	w1, 1
	bgt	.L3
	ret
	.align 2
.L4:
	mov	x0, 1
	ret
	.align	2
	.align 5
	.global	fib
fib:
	cmp	w0, 1
	ble	.L13
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x23, [sp, 48]
	sub	w23, w0, #2
	stp	x19, x20, [sp, 16]
	mov	w20, w0
	sub	w19, w0, #1
	stp	x21, x22, [sp, 32]
	sub	w22, w0, #3
	and	w0, w23, -2
	sub	w22, w22, w0
	mov	w21, 0
.L9:
	mov	w0, w19
	sub	w19, w19, #2
	bl	fib
	add	w21, w21, w0
	cmp	w19, w22
	bne	.L9
	lsr	w0, w20, 1
	sub	w0, w0, #1
	ldp	x19, x20, [sp, 16]
	sub	w0, w23, w0, lsl 1
	ldr	x23, [sp, 48]
	add	w0, w0, w21
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.align 2
.L13:
	ret
	.align	2
	.align 5
	.global	ack
ack:
	cbz	w0, .L30
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x19, [sp, 16]
	mov	w19, w0
.L18:
	mov	w0, w19
	sub	w19, w19, #1
	cbnz	w1, .L31
	mov	w1, 1
	cbnz	w19, .L18
.L17:
	ldr	x19, [sp, 16]
	add	w0, w1, 1
	ldp	x29, x30, [sp], 32
	ret
	.align 2
.L31:
	sub	w1, w1, #1
	bl	ack
	mov	w1, w0
	cbnz	w19, .L18
	b	.L17
	.align 2
.L30:
	add	w0, w1, 1
	ret
	.align	2
	.align 5
	.global	sum10
sum10:
	sxtw	x1, w1
	add	x0, x1, w0, sxtw
	add	x2, x0, w2, sxtw
	ldrsw	x0, [sp]
	add	x3, x2, w3, sxtw
	add	x4, x3, w4, sxtw
	add	x5, x4, w5, sxtw
	add	x6, x5, w6, sxtw
	add	x7, x6, w7, sxtw
	add	x7, x7, x0
	ldrsw	x0, [sp, 8]
	add	x0, x7, x0
	ret
	.align	2
	.align 5
	.global	mix
mix:
	add	w0, w0, w1
	ldr	w1, [sp]
	add	w0, w0, w2, uxtb
	add	w0, w0, w3, sxth
	add	w0, w0, w4
	add	w0, w0, w5
	add	w0, w0, w6
	add	w0, w0, w7
	add	w0, w0, w1
	ldr	x1, [sp, 8]
	add	w0, w0, w1
	ldr	w1, [sp, 16]
	add	w0, w0, w1
	ret
	.align	2
	.align 5
	.global	pressure
pressure:
	add	w1, w0, 1
	add	w2, w0, 2
	add	w5, w0, 3
	add	w7, w0, 4
	add	w4, w0, 5
	add	w6, w0, 6
	add	w3, w0, 7
	mov	w8, 10
	.align 5
.L35:
	add	w0, w0, w1
	subs	w8, w8, #1
	add	w1, w1, w2
	add	w2, w2, w5
	add	w5, w5, w7
	add	w7, w7, w4
	add	w4, w4, w6
	add	w6, w6, w3
	add	w3, w3, w0
	bne	.L35
	eor	w1, w0, w1
	eor	w0, w2, w5
	eor	w1, w1, w7
	eor	w0, w0, w4
	eor	w1, w1, w6
	eor	w0, w0, w3
	eor	w0, w1, w0
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%ld %ld\n"
	.align	3
.LC1:
	.string	"%d %d\n"
	.align	3
.LC2:
	.string	"%ld\n"
	.align	3
.LC3:
	.string	"%d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #64
	mov	w0, 10
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	str	x19, [sp, 48]
	bl	fact
	mov	x3, x0
	mov	w0, 20
	bl	fact
	mov	x2, x0
	mov	x1, x3
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, 20
	bl	fib
	mov	w3, w0
	mov	w1, 3
	mov	w0, 2
	bl	ack
	mov	w1, w3
	mov	w2, w0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w19, 9
	mov	w0, 10
	str	w19, [sp]
	str	w0, [sp, 8]
	mov	w7, 8
	mov	w6, 7
	mov	w5, 6
	mov	w4, 5
	mov	w3, 4
	mov	w2, 3
	mov	w1, 2
	mov	w0, 1
	bl	sum10
	mov	x1, x0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 11
	str	w19, [sp]
	str	w0, [sp, 16]
	mov	x0, 10
	str	x0, [sp, 8]
	mov	x1, 2
	mov	w7, 8
	mov	w6, 7
	mov	x5, 6
	mov	w4, 5
	mov	w3, 4
	mov	w2, 3
	mov	w0, 1
	bl	mix
	mov	w1, w0
	adrp	x19, .LC3
	add	x0, x19, :lo12:.LC3
	bl	printf
	mov	w0, 3
	bl	pressure
	mov	w1, w0
	add	x0, x19, :lo12:.LC3
	bl	printf
	ldr	x19, [sp, 48]
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	add	sp, sp, 64
	ret

