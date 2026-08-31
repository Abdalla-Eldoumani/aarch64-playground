	.text
	.section .rodata
	.align	3
hexd:
	.string	"0123456789abcdef"
	.text
	.align	2
	.global	score
score:
	sub	sp, sp, #16
	strb	w0, [sp, 15]
	ldrb	w0, [sp, 15]
	cmp	w0, 122
	beq	.L2
	cmp	w0, 122
	bgt	.L3
	cmp	w0, 120
	beq	.L2
	cmp	w0, 120
	bgt	.L3
	cmp	w0, 117
	beq	.L4
	cmp	w0, 117
	bgt	.L3
	cmp	w0, 113
	beq	.L2
	cmp	w0, 113
	bgt	.L3
	cmp	w0, 111
	beq	.L4
	cmp	w0, 111
	bgt	.L3
	cmp	w0, 105
	beq	.L4
	cmp	w0, 105
	bgt	.L3
	cmp	w0, 97
	beq	.L4
	cmp	w0, 101
	bne	.L3
.L4:
	mov	w0, 1
	b	.L5
.L2:
	mov	w0, 10
	b	.L5
.L3:
	mov	w0, 2
.L5:
	add	sp, sp, 16
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"%s\n"
	.align	3
.LC3:
	.string	"%c%c"
	.align	3
.LC4:
	.string	"\n"
	.align	3
.LC5:
	.string	"quiz box"
	.align	3
.LC6:
	.string	"%d\n"
	.align	3
.LC7:
	.string	"mississippi"
	.align	3
.LC8:
	.string	"%c%d "
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -192]!
	mov	x29, sp
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 136
	ldr	x2, [x1]
	ldr	x1, [x1, 7]
	str	x2, [x0]
	str	x1, [x0, 7]
	str	wzr, [sp, 188]
	b	.L7
.L9:
	ldrsw	x0, [sp, 188]
	add	x1, sp, 136
	ldrb	w0, [x1, x0]
	cmp	w0, 96
	bls	.L8
	ldrsw	x0, [sp, 188]
	add	x1, sp, 136
	ldrb	w0, [x1, x0]
	cmp	w0, 122
	bhi	.L8
	ldrsw	x0, [sp, 188]
	add	x1, sp, 136
	ldrb	w0, [x1, x0]
	sub	w0, w0, #84
	mov	w1, 26
	sdiv	w2, w0, w1
	mov	w1, 26
	mul	w1, w2, w1
	sub	w0, w0, w1
	and	w0, w0, 255
	add	w0, w0, 97
	and	w2, w0, 255
	ldrsw	x0, [sp, 188]
	add	x1, sp, 136
	strb	w2, [x1, x0]
.L8:
	ldr	w0, [sp, 188]
	add	w0, w0, 1
	str	w0, [sp, 188]
.L7:
	ldrsw	x0, [sp, 188]
	add	x1, sp, 136
	ldrb	w0, [x1, x0]
	cmp	w0, 0
	bne	.L9
	add	x0, sp, 136
	mov	x1, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	adrp	x0, .LC2
	add	x1, x0, :lo12:.LC2
	add	x0, sp, 128
	ldr	w2, [x1]
	ldrh	w1, [x1, 4]
	str	w2, [x0]
	strh	w1, [x0, 4]
	str	wzr, [sp, 184]
	b	.L10
.L11:
	ldrsw	x0, [sp, 184]
	add	x1, sp, 128
	ldrb	w0, [x1, x0]
	lsr	w0, w0, 4
	and	w0, w0, 255
	mov	w2, w0
	adrp	x0, hexd
	add	x1, x0, :lo12:hexd
	sxtw	x0, w2
	ldrb	w0, [x1, x0]
	mov	w3, w0
	ldrsw	x0, [sp, 184]
	add	x1, sp, 128
	ldrb	w0, [x1, x0]
	and	w2, w0, 15
	adrp	x0, hexd
	add	x1, x0, :lo12:hexd
	sxtw	x0, w2
	ldrb	w0, [x1, x0]
	mov	w2, w0
	mov	w1, w3
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w0, [sp, 184]
	add	w0, w0, 1
	str	w0, [sp, 184]
.L10:
	ldr	w0, [sp, 184]
	cmp	w0, 5
	ble	.L11
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	str	wzr, [sp, 180]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	str	x0, [sp, 168]
	b	.L12
.L13:
	ldr	x0, [sp, 168]
	ldrb	w0, [x0]
	bl	score
	mov	w1, w0
	ldr	w0, [sp, 180]
	add	w0, w0, w1
	str	w0, [sp, 180]
	ldr	x0, [sp, 168]
	add	x0, x0, 1
	str	x0, [sp, 168]
.L12:
	ldr	x0, [sp, 168]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L13
	ldr	w1, [sp, 180]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	add	x0, sp, 24
	mov	x2, 104
	mov	w1, 0
	bl	memset
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	str	x0, [sp, 160]
	b	.L14
.L15:
	ldr	x0, [sp, 160]
	ldrb	w0, [x0]
	sub	w3, w0, #97
	sxtw	x0, w3
	lsl	x0, x0, 2
	add	x1, sp, 24
	ldr	w0, [x1, x0]
	add	w2, w0, 1
	sxtw	x0, w3
	lsl	x0, x0, 2
	add	x1, sp, 24
	str	w2, [x1, x0]
	ldr	x0, [sp, 160]
	add	x0, x0, 1
	str	x0, [sp, 160]
.L14:
	ldr	x0, [sp, 160]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L15
	str	wzr, [sp, 156]
	b	.L16
.L18:
	ldrsw	x0, [sp, 156]
	lsl	x0, x0, 2
	add	x1, sp, 24
	ldr	w0, [x1, x0]
	cmp	w0, 0
	beq	.L17
	ldr	w0, [sp, 156]
	add	w3, w0, 97
	ldrsw	x0, [sp, 156]
	lsl	x0, x0, 2
	add	x1, sp, 24
	ldr	w0, [x1, x0]
	mov	w2, w0
	mov	w1, w3
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
.L17:
	ldr	w0, [sp, 156]
	add	w0, w0, 1
	str	w0, [sp, 156]
.L16:
	ldr	w0, [sp, 156]
	cmp	w0, 25
	ble	.L18
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 192
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"attack at dawn"
	.align	3
.LC2:
	.byte 222, 173, 190, 239, 0, 127
	.text

