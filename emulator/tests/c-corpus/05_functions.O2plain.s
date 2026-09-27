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
	ble	.L67
	stp	x29, x30, [sp, -192]!
	sub	w1, w0, #1
	and	w2, w1, -2
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x23, x24, [sp, 48]
	sub	w23, w0, w2
	mov	w24, 0
	cmp	w0, w23
	beq	.L9
.L73:
	sub	w19, w0, #2
	stp	x21, x22, [sp, 32]
	and	w0, w19, -2
	sub	w22, w1, w0
	stp	x27, x28, [sp, 80]
	mov	w27, w19
	stp	x25, x26, [sp, 64]
	mov	w25, 0
.L38:
	sub	w0, w1, #1
	cmp	w22, w1
	beq	.L10
	sub	w1, w1, #2
	mov	w4, w27
	and	w2, w1, -2
	mov	w28, 0
	sub	w27, w0, w2
	str	w23, [sp, 144]
.L35:
	sub	w2, w0, #1
	cmp	w27, w0
	beq	.L11
	sub	w0, w0, #2
	mov	w21, 0
	and	w5, w0, -2
	stp	w27, w25, [sp, 148]
	sub	w20, w2, w5
	stp	w22, w28, [sp, 156]
.L32:
	sub	w19, w2, #1
	cmp	w20, w2
	beq	.L12
	sub	w23, w2, #2
	mov	w22, 0
	and	w27, w23, -2
	stp	w24, w21, [sp, 164]
	sub	w3, w19, w27
	stp	w20, w1, [sp, 172]
	stp	w0, w23, [sp, 180]
	str	w4, [sp, 188]
.L29:
	sub	w7, w19, #1
	cmp	w3, w19
	beq	.L13
	sub	w1, w19, #4
	sub	w19, w19, #2
	and	w21, w19, -2
	mov	w2, 0
	sub	w21, w7, w21
	stp	w21, w22, [sp, 128]
	stp	w3, w19, [sp, 136]
.L26:
	ldr	w0, [sp, 128]
	cmp	w7, w0
	beq	.L14
	sub	w0, w7, #2
	sub	w28, w7, #3
	and	w3, w0, -2
	sub	w7, w7, #5
	sub	w28, w28, w3
	and	w3, w1, -2
	sub	w3, w7, w3
	stp	w28, w3, [sp, 108]
	str	w0, [sp, 124]
	mov	w25, w1
	ldr	w0, [sp, 108]
	add	w24, w25, 1
	stp	w2, w1, [sp, 116]
	mov	w22, 0
	cmp	w0, w25
	beq	.L15
.L71:
	sub	w26, w25, #2
	mov	w27, w25
	mov	w20, w26
	mov	w19, 0
.L20:
	cmp	w27, 1
	beq	.L59
	sub	w21, w24, #2
	and	w0, w20, -2
	sub	w24, w24, #4
	mov	w23, w21
	sub	w24, w24, w0
	mov	w28, 0
.L17:
	mov	w0, w23
	sub	w23, w23, #2
	bl	fib
	add	w28, w28, w0
	cmp	w24, w23
	bne	.L17
	neg	w0, w20, lsr 1
	sub	w27, w27, #2
	mov	w24, w21
	sub	w20, w20, #2
	add	w0, w27, w0, lsl 1
	add	w0, w0, w28
	add	w19, w19, w0
	cmp	w21, 1
	bne	.L20
	.align 5
.L59:
	ldr	w0, [sp, 112]
	add	w3, w19, 1
	add	w22, w22, w3
	cmp	w0, w26
	beq	.L70
	ldr	w0, [sp, 108]
	mov	w25, w26
	add	w24, w25, 1
	cmp	w0, w25
	bne	.L71
.L15:
	ldp	w2, w1, [sp, 116]
	add	w4, w24, w22
	ldr	w0, [sp, 124]
.L22:
	mov	w7, w0
	add	w2, w2, w4
	sub	w1, w1, #2
	cmp	w0, 1
	bne	.L26
	ldp	w22, w3, [sp, 132]
	add	w2, w2, 1
	ldr	w19, [sp, 140]
	b	.L25
	.align 2
.L14:
	sub	w7, w7, #1
	ldr	w19, [sp, 140]
	ldp	w22, w3, [sp, 132]
	add	w2, w7, w2
.L25:
	add	w22, w22, w2
	cmp	w19, 1
	bne	.L29
	ldp	w24, w21, [sp, 164]
	add	w25, w22, 1
	ldp	w20, w1, [sp, 172]
	ldp	w0, w23, [sp, 180]
	ldr	w4, [sp, 188]
.L28:
	mov	w2, w23
	add	w21, w21, w25
	cmp	w23, 1
	bne	.L32
	ldp	w27, w25, [sp, 148]
	add	w21, w21, 1
	ldp	w22, w28, [sp, 156]
	b	.L31
	.align 2
.L13:
	ldp	w24, w21, [sp, 164]
	add	w25, w7, w22
	ldp	w20, w1, [sp, 172]
	ldp	w0, w23, [sp, 180]
	ldr	w4, [sp, 188]
	b	.L28
.L12:
	ldp	w27, w25, [sp, 148]
	add	w21, w19, w21
	ldp	w22, w28, [sp, 156]
.L31:
	add	w28, w28, w21
	cmp	w0, 1
	bne	.L35
	ldr	w23, [sp, 144]
	mov	w27, w4
	add	w28, w28, 1
	b	.L34
	.align 2
.L11:
	ldr	w23, [sp, 144]
	mov	w27, w4
	add	w28, w2, w28
.L34:
	add	w25, w25, w28
	cmp	w1, 1
	bne	.L38
	mov	w19, w27
	add	w25, w25, 1
	mov	w0, w19
	add	w24, w24, w25
	cmp	w19, 1
	bne	.L72
.L58:
	ldp	x21, x22, [sp, 32]
	add	w0, w24, 1
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x19, x20, [sp, 16]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 192
	ret
	.align 2
.L10:
	add	w25, w0, w25
	mov	w19, w27
	mov	w0, w19
	add	w24, w24, w25
	cmp	w19, 1
	beq	.L58
.L72:
	ldp	x21, x22, [sp, 32]
	sub	w1, w19, #1
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	cmp	w0, w23
	bne	.L73
.L9:
	ldp	x19, x20, [sp, 16]
	add	w0, w1, w24
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 192
	ret
.L67:
	ret
.L70:
	ldp	w2, w1, [sp, 116]
	add	w4, w25, w22
	ldr	w0, [sp, 124]
	b	.L22
	.align	2
	.align 5
	.global	ack
ack:
	cbz	w0, .L120
	stp	x29, x30, [sp, -96]!
	mov	x29, sp
	str	x27, [sp, 80]
	mov	w27, w0
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
.L76:
	mov	w26, w27
	sub	w27, w27, #1
	cbnz	w1, .L121
	mov	w1, 1
	cbnz	w27, .L76
.L75:
	ldr	x27, [sp, 80]
	add	w0, w1, 1
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x29, x30, [sp], 96
	ret
	.align 2
.L121:
	sub	w1, w1, #1
.L78:
	mov	w25, w26
	sub	w26, w26, #1
	cbnz	w1, .L122
	mov	w1, 1
	cbnz	w26, .L78
.L124:
	add	w1, w1, 1
	cbnz	w27, .L76
	b	.L75
	.align 2
.L122:
	sub	w1, w1, #1
.L80:
	mov	w24, w25
	sub	w25, w25, #1
	cbnz	w1, .L123
	mov	w1, 1
	cbnz	w25, .L80
.L126:
	add	w1, w1, 1
	cbnz	w26, .L78
	b	.L124
	.align 2
.L123:
	sub	w1, w1, #1
.L82:
	mov	w23, w24
	sub	w24, w24, #1
	cbnz	w1, .L125
	mov	w1, 1
	cbnz	w24, .L82
.L128:
	add	w1, w1, 1
	cbnz	w25, .L80
	b	.L126
	.align 2
.L125:
	sub	w1, w1, #1
.L84:
	mov	w22, w23
	sub	w23, w23, #1
	cbnz	w1, .L127
	mov	w1, 1
	cbnz	w23, .L84
.L130:
	add	w1, w1, 1
	cbnz	w24, .L82
	b	.L128
	.align 2
.L127:
	sub	w1, w1, #1
.L86:
	mov	w21, w22
	sub	w22, w22, #1
	cbnz	w1, .L129
	mov	w1, 1
	cbnz	w22, .L86
.L132:
	add	w1, w1, 1
	cbnz	w23, .L84
	b	.L130
	.align 2
.L129:
	sub	w1, w1, #1
.L88:
	mov	w20, w21
	sub	w21, w21, #1
	cbnz	w1, .L131
	mov	w1, 1
	cbnz	w21, .L88
.L134:
	add	w1, w1, 1
	cbnz	w22, .L86
	b	.L132
	.align 2
.L131:
	sub	w1, w1, #1
.L90:
	mov	w19, w20
	sub	w20, w20, #1
	cbnz	w1, .L133
	mov	w1, 1
	cbnz	w20, .L90
.L136:
	add	w1, w1, 1
	cbnz	w21, .L88
	b	.L134
	.align 2
.L133:
	sub	w1, w1, #1
.L92:
	mov	w0, w19
	sub	w19, w19, #1
	cbnz	w1, .L135
	mov	w1, 1
	cbnz	w19, .L92
.L137:
	add	w1, w1, 1
	cbnz	w20, .L90
	b	.L136
	.align 2
.L135:
	sub	w1, w1, #1
	bl	ack
	mov	w1, w0
	cbnz	w19, .L92
	b	.L137
	.align 2
.L120:
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
.L141:
	add	w0, w0, w1
	subs	w8, w8, #1
	add	w1, w1, w2
	add	w2, w2, w5
	add	w5, w5, w7
	add	w7, w7, w4
	add	w4, w4, w6
	add	w6, w6, w3
	add	w3, w3, w0
	bne	.L141
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
	stp	x29, x30, [sp, -32]!
	mov	x2, 10
	mov	x1, 1
	mov	x29, sp
	str	x19, [sp, 16]
	.align 5
.L144:
	mul	x1, x1, x2
	sub	x2, x2, #1
	cmp	x2, 1
	bne	.L144
	mov	x0, 20
	.align 5
.L145:
	mul	x2, x2, x0
	sub	x0, x0, #1
	cmp	x0, 1
	bne	.L145
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w6, 19
	mov	w8, 0
.L146:
	mov	w0, w6
	sub	w6, w6, #2
	bl	fib
	add	w8, w8, w0
	cmn	w6, #1
	bne	.L146
	mov	w2, 2
	mov	w1, 3
	mov	w0, w2
	cbnz	w1, .L157
.L150:
	mov	w1, 1
	mov	w0, 1
	cmp	w2, w0
	beq	.L155
.L158:
	mov	w2, w0
	cbz	w1, .L150
.L157:
	sub	w1, w1, #1
	bl	ack
	mov	w1, w0
	mov	w0, 1
	cmp	w2, w0
	bne	.L158
.L155:
	add	w2, w1, 1
	adrp	x0, .LC1
	mov	w1, w8
	add	x0, x0, :lo12:.LC1
	bl	printf
	adrp	x19, .LC3
	mov	x1, 55
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w1, 66
	add	x0, x19, :lo12:.LC3
	bl	printf
	mov	w0, 3
	bl	pressure
	mov	w1, w0
	add	x0, x19, :lo12:.LC3
	bl	printf
	ldr	x19, [sp, 16]
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret

