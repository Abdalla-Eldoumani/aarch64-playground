	.text
	.align	2
	.align 5
	.global	score
score:
	sub	w1, w0, #97
	and	w1, w1, 255
	cmp	w1, 25
	bhi	.L3
	mov	x0, 1
	mov	x2, 16657
	lsl	x1, x0, x1
	movk	x2, 0x10, lsl 16
	tst	x1, x2
	bne	.L1
	mov	x0, 42008576
	tst	x1, x0
	mov	w0, 2
	mov	w1, 10
	csel	w0, w0, w1, eq
.L1:
	ret
	.align 2
.L3:
	mov	w0, 2
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"quiz box"
	.align	3
.LC1:
	.string	"mississippi"
	.align	3
.LC3:
	.string	"%s\n"
	.align	3
.LC5:
	.string	"%c%c"
	.align	3
.LC6:
	.string	"\n"
	.align	3
.LC7:
	.string	"%d\n"
	.align	3
.LC8:
	.string	"%c%d "
	.text
	.align	2
	.align 5
	.global	main
main:
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	stp	x29, x30, [sp, -176]!
	mov	w4, 60495
	movk	w4, 0x4ec4, lsl 16
	mov	x29, sp
	add	x2, sp, 56
	ldr	x1, [x0]
	str	x1, [sp, 56]
	ldr	x0, [x0, 7]
	mov	w3, 26
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	str	x0, [sp, 63]
	mov	w0, 97
	.align 5
.L9:
	sub	w1, w0, #97
	and	w1, w1, 255
	cmp	w1, 25
	bhi	.L8
	sub	w0, w0, #84
	umull	x1, w0, w4
	lsr	x1, x1, 35
	msub	w0, w1, w3, w0
	add	w0, w0, 97
	strb	w0, [x2]
.L8:
	ldrb	w0, [x2, 1]!
	cbnz	w0, .L9
	add	x1, sp, 56
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	adrp	x0, .LANCHOR0
	add	x20, x0, :lo12:.LANCHOR0
	adrp	x21, .LC5
	add	x19, sp, 48
	ldr	w1, [x0, :lo12:.LANCHOR0]
	add	x22, sp, 54
	ldrh	w0, [x20, 4]
	add	x21, x21, :lo12:.LC5
	add	x20, x20, 8
	mov	w2, 101
	str	w1, [sp, 48]
	mov	w1, 100
	strh	w0, [sp, 52]
	b	.L11
	.align 2
.L24:
	ldrb	w0, [x19]
	lsr	w1, w0, 4
	and	w0, w0, 15
	ldrb	w1, [x20, w1, sxtw]
	ldrb	w2, [x20, w0, sxtw]
.L11:
	mov	x0, x21
	add	x19, x19, 1
	bl	printf
	cmp	x22, x19
	bne	.L24
	adrp	x21, .LC6
	add	x21, x21, :lo12:.LC6
	mov	x0, x21
	bl	printf
	adrp	x3, .LC0
	adrp	x5, .LC0+8
	add	x3, x3, :lo12:.LC0
	add	x5, x5, :lo12:.LC0+8
	mov	w4, 0
	mov	w0, 113
	.align 5
.L12:
	bl	score
	add	w4, w4, w0
	ldrb	w0, [x3, 1]!
	cmp	x3, x5
	bne	.L12
	mov	w1, w4
	add	x20, sp, 72
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	mov	x2, 104
	mov	x0, x20
	mov	w1, 0
	bl	memset
	adrp	x2, .LC1
	adrp	x3, .LC1+11
	add	x2, x2, :lo12:.LC1
	add	x3, x3, :lo12:.LC1+11
	mov	w0, 109
	.align 5
.L13:
	sub	w0, w0, #97
	sbfiz	x0, x0, 2, 32
	ldr	w1, [x20, x0]
	add	w1, w1, 1
	str	w1, [x20, x0]
	ldrb	w0, [x2, 1]!
	cmp	x2, x3
	bne	.L13
	adrp	x22, .LC8
	mov	x19, 1
	add	x22, x22, :lo12:.LC8
	b	.L15
	.align 2
.L14:
	add	x19, x19, 1
	cmp	x19, 27
	beq	.L25
.L15:
	add	x0, x20, x19, lsl 2
	ldr	w2, [x0, -4]
	cbz	w2, .L14
	add	w1, w19, 96
	mov	x0, x22
	add	x19, x19, 1
	bl	printf
	cmp	x19, 27
	bne	.L15
.L25:
	mov	x0, x21
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 176
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"attack at dawn"
	.text
	.section .rodata
	.align	3
	.LANCHOR0:
.LC4:
	.byte 222, 173, 190, 239, 0, 127
	.zero	2
hexd:
	.string	"0123456789abcdef"

