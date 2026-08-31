	.text
	.align	2
	.global	fact
fact:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x19, [sp, 16]
	str	w0, [sp, 44]
	ldr	w0, [sp, 44]
	cmp	w0, 1
	ble	.L2
	ldrsw	x19, [sp, 44]
	ldr	w0, [sp, 44]
	sub	w0, w0, #1
	bl	fact
	mul	x0, x19, x0
	b	.L4
.L2:
	mov	x0, 1
.L4:
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.align	2
	.global	fib
fib:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x19, [sp, 16]
	str	w0, [sp, 44]
	ldr	w0, [sp, 44]
	cmp	w0, 1
	ble	.L6
	ldr	w0, [sp, 44]
	sub	w0, w0, #1
	bl	fib
	mov	w19, w0
	ldr	w0, [sp, 44]
	sub	w0, w0, #2
	bl	fib
	add	w0, w19, w0
	b	.L8
.L6:
	ldr	w0, [sp, 44]
.L8:
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.align	2
	.global	ack
ack:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x19, [sp, 16]
	str	w0, [sp, 44]
	str	w1, [sp, 40]
	ldr	w0, [sp, 44]
	cmp	w0, 0
	bne	.L10
	ldr	w0, [sp, 40]
	add	w0, w0, 1
	b	.L11
.L10:
	ldr	w0, [sp, 40]
	cmp	w0, 0
	bne	.L12
	ldr	w0, [sp, 44]
	sub	w0, w0, #1
	mov	w1, 1
	bl	ack
	b	.L11
.L12:
	ldr	w0, [sp, 44]
	sub	w19, w0, #1
	ldr	w0, [sp, 40]
	sub	w0, w0, #1
	mov	w1, w0
	ldr	w0, [sp, 44]
	bl	ack
	mov	w1, w0
	mov	w0, w19
	bl	ack
.L11:
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.align	2
	.global	sum10
sum10:
	sub	sp, sp, #32
	str	w0, [sp, 28]
	str	w1, [sp, 24]
	str	w2, [sp, 20]
	str	w3, [sp, 16]
	str	w4, [sp, 12]
	str	w5, [sp, 8]
	str	w6, [sp, 4]
	str	w7, [sp]
	ldrsw	x1, [sp, 28]
	ldrsw	x0, [sp, 24]
	add	x1, x1, x0
	ldrsw	x0, [sp, 20]
	add	x1, x1, x0
	ldrsw	x0, [sp, 16]
	add	x1, x1, x0
	ldrsw	x0, [sp, 12]
	add	x1, x1, x0
	ldrsw	x0, [sp, 8]
	add	x1, x1, x0
	ldrsw	x0, [sp, 4]
	add	x1, x1, x0
	ldrsw	x0, [sp]
	add	x1, x1, x0
	ldrsw	x0, [sp, 32]
	add	x1, x1, x0
	ldrsw	x0, [sp, 40]
	add	x0, x1, x0
	add	sp, sp, 32
	ret
	.align	2
	.global	mix
mix:
	sub	sp, sp, #48
	str	w0, [sp, 44]
	str	x1, [sp, 32]
	strb	w2, [sp, 43]
	strh	w3, [sp, 40]
	str	w4, [sp, 28]
	str	x5, [sp, 16]
	str	w6, [sp, 24]
	str	w7, [sp, 12]
	ldr	x0, [sp, 32]
	mov	w1, w0
	ldr	w0, [sp, 44]
	add	w1, w1, w0
	ldrb	w0, [sp, 43]
	add	w1, w1, w0
	ldrsh	w0, [sp, 40]
	add	w1, w1, w0
	ldr	w0, [sp, 28]
	add	w0, w1, w0
	ldr	x1, [sp, 16]
	add	w1, w0, w1
	ldr	w0, [sp, 24]
	add	w1, w1, w0
	ldr	w0, [sp, 12]
	add	w1, w1, w0
	ldr	w0, [sp, 48]
	add	w0, w1, w0
	ldr	x1, [sp, 56]
	add	w1, w0, w1
	ldr	w0, [sp, 64]
	add	w0, w1, w0
	add	sp, sp, 48
	ret
	.align	2
	.global	pressure
pressure:
	sub	sp, sp, #64
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	str	w0, [sp, 60]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 56]
	ldr	w0, [sp, 12]
	add	w0, w0, 2
	str	w0, [sp, 52]
	ldr	w0, [sp, 12]
	add	w0, w0, 3
	str	w0, [sp, 48]
	ldr	w0, [sp, 12]
	add	w0, w0, 4
	str	w0, [sp, 44]
	ldr	w0, [sp, 12]
	add	w0, w0, 5
	str	w0, [sp, 40]
	ldr	w0, [sp, 12]
	add	w0, w0, 6
	str	w0, [sp, 36]
	ldr	w0, [sp, 12]
	add	w0, w0, 7
	str	w0, [sp, 32]
	str	wzr, [sp, 28]
	b	.L18
.L19:
	ldr	w1, [sp, 60]
	ldr	w0, [sp, 56]
	add	w0, w1, w0
	str	w0, [sp, 60]
	ldr	w1, [sp, 56]
	ldr	w0, [sp, 52]
	add	w0, w1, w0
	str	w0, [sp, 56]
	ldr	w1, [sp, 52]
	ldr	w0, [sp, 48]
	add	w0, w1, w0
	str	w0, [sp, 52]
	ldr	w1, [sp, 48]
	ldr	w0, [sp, 44]
	add	w0, w1, w0
	str	w0, [sp, 48]
	ldr	w1, [sp, 44]
	ldr	w0, [sp, 40]
	add	w0, w1, w0
	str	w0, [sp, 44]
	ldr	w1, [sp, 40]
	ldr	w0, [sp, 36]
	add	w0, w1, w0
	str	w0, [sp, 40]
	ldr	w1, [sp, 36]
	ldr	w0, [sp, 32]
	add	w0, w1, w0
	str	w0, [sp, 36]
	ldr	w1, [sp, 32]
	ldr	w0, [sp, 60]
	add	w0, w1, w0
	str	w0, [sp, 32]
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L18:
	ldr	w0, [sp, 28]
	cmp	w0, 9
	ble	.L19
	ldr	w1, [sp, 60]
	ldr	w0, [sp, 56]
	eor	w1, w1, w0
	ldr	w0, [sp, 52]
	eor	w1, w1, w0
	ldr	w0, [sp, 48]
	eor	w1, w1, w0
	ldr	w0, [sp, 44]
	eor	w1, w1, w0
	ldr	w0, [sp, 40]
	eor	w1, w1, w0
	ldr	w0, [sp, 36]
	eor	w1, w1, w0
	ldr	w0, [sp, 32]
	eor	w0, w1, w0
	add	sp, sp, 64
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
	.global	main
main:
	sub	sp, sp, #64
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	str	x19, [sp, 48]
	mov	w0, 10
	bl	fact
	mov	x19, x0
	mov	w0, 20
	bl	fact
	mov	x2, x0
	mov	x1, x19
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, 20
	bl	fib
	mov	w19, w0
	mov	w1, 3
	mov	w0, 2
	bl	ack
	mov	w2, w0
	mov	w1, w19
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, 10
	str	w0, [sp, 8]
	mov	w0, 9
	str	w0, [sp]
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
	str	w0, [sp, 16]
	mov	x0, 10
	str	x0, [sp, 8]
	mov	w0, 9
	str	w0, [sp]
	mov	w7, 8
	mov	w6, 7
	mov	x5, 6
	mov	w4, 5
	mov	w3, 4
	mov	w2, 3
	mov	x1, 2
	mov	w0, 1
	bl	mix
	mov	w1, w0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w0, 3
	bl	pressure
	mov	w1, w0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	ldr	x19, [sp, 48]
	add	sp, sp, 64
	ret

