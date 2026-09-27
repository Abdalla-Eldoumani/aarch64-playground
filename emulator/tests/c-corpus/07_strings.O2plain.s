	.text
	.align	2
	.align 5
	.global	rev
rev:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x19, [sp, 16]
	mov	x19, x0
	bl	strlen
	cmp	w0, 1
	ble	.L1
	sub	w1, w0, #1
	add	x3, x19, w0, sxtw
	mov	x2, 0
	sxtw	x1, w1
	sub	x3, x3, x1
	sub	x3, x3, #1
	.align 5
.L3:
	ldrb	w4, [x3, x1]
	ldrb	w0, [x19, x2]
	strb	w4, [x19, x2]
	add	x2, x2, 1
	strb	w0, [x3, x1]
	sub	x1, x1, #1
	cmp	w2, w1
	blt	.L3
.L1:
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
	.align	2
	.align 5
	.global	pal
pal:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x19, [sp, 16]
	mov	x19, x0
	bl	strlen
	add	x3, x19, w0, sxtw
	asr	w4, w0, 1
	sub	x3, x3, #1
	mov	x1, 0
	cmp	w0, 1
	bgt	.L10
	b	.L11
	.align 2
.L17:
	add	x1, x1, 1
	cmp	w4, w1
	ble	.L11
.L10:
	neg	x0, x1
	ldrb	w2, [x19, x1]
	ldrb	w0, [x3, x0]
	cmp	w2, w0
	beq	.L17
	ldr	x19, [sp, 16]
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret
	.align 2
.L11:
	ldr	x19, [sp, 16]
	mov	w0, 1
	ldp	x29, x30, [sp], 32
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"the quick brown fox"
	.align	3
.LC1:
	.string	"playground"
	.align	3
.LC2:
	.string	"%s %d\n"
	.align	3
.LC3:
	.string	"%d %d %d\n"
	.align	3
.LC4:
	.string	"Hello, World"
	.align	3
.LC5:
	.string	"%d\n"
	.align	3
.LC6:
	.string	"left"
	.align	3
.LC7:
	.string	"right"
	.align	3
.LC8:
	.string	"[%10s][%-10s][%c%c]\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	stp	x29, x30, [sp, -96]!
	mov	w2, 10
	mov	x29, sp
	ldr	x1, [x0]
	str	x1, [sp, 32]
	ldr	w0, [x0, 7]
	add	x1, sp, 32
	str	x19, [sp, 16]
	str	w0, [sp, 39]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	add	x0, sp, 32
	bl	strlen
	cmp	w0, 1
	ble	.L19
	add	x2, sp, 32
	sub	w1, w0, #1
	sub	w5, w0, #1
	add	x0, x2, x0
	sub	x0, x0, x1
	sub	x0, x0, #1
	.align 5
.L20:
	ldrb	w4, [x0, x1]
	ldrb	w3, [x2]
	strb	w4, [x2], 1
	strb	w3, [x0, x1]
	sub	x1, x1, #1
	sub	w3, w5, w1
	cmp	w3, w1
	blt	.L20
.L19:
	add	x0, sp, 32
	bl	puts
	mov	w3, 1
	adrp	x19, .LC3
	mov	w1, w3
	mov	w2, 0
	add	x0, x19, :lo12:.LC3
	bl	printf
	mov	w3, 1
	mov	w2, 0
	mov	w1, w3
	add	x0, x19, :lo12:.LC3
	bl	printf
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	add	x2, sp, 64
	ldr	x1, [x0]
	str	x1, [sp, 64]
	ldr	x0, [x0, 5]
	str	x0, [sp, 69]
	mov	w0, 72
	.align 5
.L22:
	sub	w1, w0, #97
	and	w1, w1, 255
	cmp	w1, 25
	bhi	.L21
	sub	w0, w0, #32
	strb	w0, [x2]
.L21:
	ldrb	w0, [x2, 1]!
	cbnz	w0, .L22
	add	x0, sp, 64
	bl	puts
	adrp	x2, .LC0
	adrp	x3, .LC0+19
	mov	x4, 16657
	add	x2, x2, :lo12:.LC0
	add	x3, x3, :lo12:.LC0+19
	mov	w1, 0
	mov	w0, 116
	movk	x4, 0x10, lsl 16
	.align 5
.L24:
	sub	w0, w0, #97
	and	w0, w0, 255
	cmp	w0, 20
	lsr	x0, x4, x0
	and	w0, w0, 1
	add	w0, w1, w0
	csel	w1, w1, w0, hi
	ldrb	w0, [x2, 1]!
	cmp	x2, x3
	bne	.L24
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w4, 107
	mov	w3, 111
	adrp	x2, .LC6
	adrp	x1, .LC7
	add	x2, x2, :lo12:.LC6
	add	x1, x1, :lo12:.LC7
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldr	x19, [sp, 16]
	mov	w0, 0
	ldp	x29, x30, [sp], 96
	ret

