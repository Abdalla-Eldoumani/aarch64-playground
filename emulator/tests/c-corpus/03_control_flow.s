	.text
	.align	2
	.global	classify
classify:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	cmp	w0, 0
	bge	.L2
	mov	w0, -1
	b	.L3
.L2:
	ldr	w0, [sp, 12]
	cmp	w0, 0
	bne	.L4
	mov	w0, 0
	b	.L3
.L4:
	ldr	w0, [sp, 12]
	cmp	w0, 9
	bgt	.L5
	mov	w0, 1
	b	.L3
.L5:
	ldr	w0, [sp, 12]
	cmp	w0, 99
	bgt	.L6
	mov	w0, 2
	b	.L3
.L6:
	mov	w0, 3
.L3:
	add	sp, sp, 16
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"%d:%d "
	.align	3
.LC2:
	.string	"\n"
	.align	3
.LC3:
	.string	"%d %d\n"
	.align	3
.LC4:
	.string	"%d\n"
	.align	3
.LC5:
	.string	"%d %d %d\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -96]!
	mov	x29, sp
	str	x19, [sp, 16]
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 32
	ldp	x2, x3, [x1]
	ldr	w1, [x1, 16]
	stp	x2, x3, [x0]
	str	w1, [x0, 16]
	str	wzr, [sp, 92]
	b	.L8
.L9:
	ldrsw	x0, [sp, 92]
	lsl	x0, x0, 2
	add	x1, sp, 32
	ldr	w19, [x1, x0]
	ldrsw	x0, [sp, 92]
	lsl	x0, x0, 2
	add	x1, sp, 32
	ldr	w0, [x1, x0]
	bl	classify
	mov	w2, w0
	mov	w1, w19
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 92]
	add	w0, w0, 1
	str	w0, [sp, 92]
.L8:
	ldr	w0, [sp, 92]
	cmp	w0, 4
	ble	.L9
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	str	wzr, [sp, 88]
	str	wzr, [sp, 84]
	b	.L10
.L15:
	ldr	w0, [sp, 88]
	add	w0, w0, 1
	str	w0, [sp, 88]
	ldr	w1, [sp, 88]
	mov	w0, 21846
	movk	w0, 0x5555, lsl 16
	smull	x0, w1, w0
	lsr	x2, x0, 32
	asr	w0, w1, 31
	sub	w2, w2, w0
	mov	w0, w2
	lsl	w0, w0, 1
	add	w0, w0, w2
	sub	w2, w1, w0
	cmp	w2, 0
	beq	.L31
	ldr	w0, [sp, 88]
	cmp	w0, 15
	bgt	.L32
	ldr	w1, [sp, 84]
	ldr	w0, [sp, 88]
	add	w0, w1, w0
	str	w0, [sp, 84]
	b	.L10
.L31:
	nop
.L10:
	ldr	w0, [sp, 88]
	cmp	w0, 19
	ble	.L15
	b	.L14
.L32:
	nop
.L14:
	ldr	w2, [sp, 84]
	ldr	w1, [sp, 88]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w0, 10
	str	w0, [sp, 80]
.L16:
	ldr	w0, [sp, 80]
	sub	w0, w0, #3
	str	w0, [sp, 80]
	ldr	w0, [sp, 80]
	cmp	w0, 0
	bgt	.L16
	ldr	w1, [sp, 80]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	str	wzr, [sp, 76]
	str	wzr, [sp, 72]
	b	.L17
.L21:
	str	wzr, [sp, 68]
	b	.L18
.L20:
	ldr	w1, [sp, 72]
	ldr	w0, [sp, 68]
	add	w0, w1, w0
	and	w0, w0, 1
	cmp	w0, 0
	bne	.L19
	ldr	w1, [sp, 72]
	ldr	w0, [sp, 68]
	cmp	w1, w0
	beq	.L19
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L19:
	ldr	w0, [sp, 68]
	add	w0, w0, 1
	str	w0, [sp, 68]
.L18:
	ldr	w0, [sp, 68]
	cmp	w0, 5
	ble	.L20
	ldr	w0, [sp, 72]
	add	w0, w0, 1
	str	w0, [sp, 72]
.L17:
	ldr	w0, [sp, 72]
	cmp	w0, 5
	ble	.L21
	ldr	w1, [sp, 76]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	str	wzr, [sp, 64]
.L22:
	ldr	w0, [sp, 64]
	add	w0, w0, 1
	str	w0, [sp, 64]
	ldr	w0, [sp, 64]
	cmp	w0, 4
	bgt	.L23
	b	.L22
.L23:
	ldr	w1, [sp, 64]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w0, [sp, 64]
	cmp	w0, 3
	ble	.L24
	mov	w0, 100
	str	w0, [sp, 60]
	b	.L25
.L24:
	mov	w0, 200
	str	w0, [sp, 60]
.L25:
	ldr	w0, [sp, 64]
	cmp	w0, 3
	ble	.L26
	ldr	w0, [sp, 80]
	cmp	w0, 0
	blt	.L27
.L26:
	ldr	w0, [sp, 64]
	cmp	w0, 0
	bne	.L28
.L27:
	mov	w0, 1
	b	.L29
.L28:
	mov	w0, 0
.L29:
	str	w0, [sp, 56]
	ldr	w0, [sp, 56]
	cmp	w0, 0
	cset	w0, eq
	and	w0, w0, 255
	mov	w3, w0
	ldr	w2, [sp, 56]
	ldr	w1, [sp, 60]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w0, 0
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 96
	ret
	.section .rodata
	.align	3
.LC0:
	.word	-7
	.word	0
	.word	5
	.word	42
	.word	500
	.text

