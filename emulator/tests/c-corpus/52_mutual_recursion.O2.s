	.text
	.align	2
	.align 5
hof_m:
	mov	w1, w0
	cbnz	w0, .L11
	ret
	.align 2
.L11:
	stp	x29, x30, [sp, -32]!
	sub	w0, w0, #1
	mov	x29, sp
	str	w1, [sp, 28]
	bl	hof_m
	bl	hof_f
	ldr	w1, [sp, 28]
	ldp	x29, x30, [sp], 32
	sub	w1, w1, w0
	mov	w0, w1
	ret
	.align	2
	.align 5
hof_f:
	cbnz	w0, .L19
	mov	w0, 1
	ret
	.align 2
.L19:
	stp	x29, x30, [sp, -32]!
	mov	w1, w0
	sub	w0, w0, #1
	mov	x29, sp
	str	w1, [sp, 28]
	bl	hof_f
	bl	hof_m
	ldr	w1, [sp, 28]
	ldp	x29, x30, [sp], 32
	sub	w0, w1, w0
	ret
	.align	2
	.align 5
tak:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	stp	x23, x24, [sp, 48]
	adrp	x23, .LANCHOR0
	stp	x21, x22, [sp, 32]
	mov	w21, w0
	ldr	x0, [x23, :lo12:.LANCHOR0]
	stp	x19, x20, [sp, 16]
	mov	w19, w2
	add	x0, x0, 1
	str	x0, [x23, :lo12:.LANCHOR0]
	cmp	w21, w1
	ble	.L21
	mov	w20, w1
	add	x23, x23, :lo12:.LANCHOR0
.L22:
	mov	w22, w21
	mov	w2, w19
	mov	w1, w20
	sub	w0, w21, #1
	bl	tak
	mov	w21, w0
	mov	w1, w19
	mov	w2, w22
	sub	w0, w20, #1
	bl	tak
	mov	w2, w20
	mov	w1, w22
	mov	w20, w0
	sub	w0, w19, #1
	bl	tak
	mov	w19, w0
	ldr	x0, [x23]
	add	x0, x0, 1
	str	x0, [x23]
	cmp	w21, w20
	bgt	.L22
.L21:
	mov	w0, w19
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 64
	ret
	.align	2
	.align 5
small_side:
	cbnz	w0, .L34
	ret
	.align 2
.L34:
	stp	x29, x30, [sp, -16]!
	sub	w0, w0, #1
	mov	x29, sp
	bl	big_side
	ldp	x29, x30, [sp], 16
	add	w0, w0, 1
	ret
	.align	2
	.align 5
big_side:
	stp	x29, x30, [sp, -288]!
	add	w4, w0, 50
	mov	w1, w0
	mov	x29, sp
	and	w4, w4, 255
	str	x19, [sp, 16]
	add	x19, sp, 32
	mov	x3, x19
	.align 5
.L36:
	add	w2, w1, 51
	strb	w1, [x3], 51
	and	w1, w2, 255
	cmp	w4, w2, uxtb
	bne	.L36
	sub	w0, w0, #1
	bl	small_side
	add	x2, x19, 306
	.align 5
.L37:
	ldrb	w1, [x19], 51
	add	w0, w0, w1
	cmp	x19, x2
	bne	.L37
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 288
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"ping n=%d a=%d acc=%llu\n"
	.text
	.align	2
	.align 5
ping:
	sxtb	w4, w0
	mov	x3, x1
	mov	w0, 24988
	mov	w1, w2
	mov	w2, 10311
	movk	w0, 0x57, lsl 16
	movk	w2, 0xb7a3, lsl 16
	madd	w2, w1, w2, w0
	mov	w0, 45262
	movk	w0, 0x2b, lsl 16
	ror	w2, w2, 2
	cmp	w2, w0
	bls	.L50
	cbnz	w1, .L51
	mov	x0, x3
	ret
	.align 2
.L51:
	mov	w0, 300
	add	x3, x3, x3, lsl 1
	sub	w2, w1, #1
	add	x1, x3, w4, sxtw
	mul	w0, w4, w0
	b	pong
	.align 2
.L50:
	stp	x29, x30, [sp, -32]!
	mov	w2, w4
	adrp	x0, .LC0
	mov	x29, sp
	add	x0, x0, :lo12:.LC0
	stp	w1, w4, [sp, 16]
	str	x3, [sp, 24]
	bl	printf
	ldp	w1, w4, [sp, 16]
	ldr	x3, [sp, 24]
	cbnz	w1, .L52
	mov	x0, x3
	ldp	x29, x30, [sp], 32
	ret
	.align 2
.L52:
	mov	w0, 300
	add	x3, x3, x3, lsl 1
	ldp	x29, x30, [sp], 32
	mul	w0, w4, w0
	sub	w2, w1, #1
	add	x1, x3, w4, sxtw
	b	pong
	.align	2
	.align 5
pang:
	mov	w3, w2
	sub	x1, x1, w0, sxtw
	cbnz	w2, .L55
	mov	x0, x1
	ret
	.align 2
.L55:
	sub	w2, w2, #1
	eor	w0, w0, w3
	b	ping
	.align	2
	.align 5
pong:
	and	w3, w0, 65535
	and	x0, x0, 65535
	cbnz	w2, .L61
	eor	x0, x1, x0
	ret
	.align 2
.L61:
	add	x1, x1, x0
	sub	w2, w2, #1
	mov	w0, -40000
	add	w0, w3, w0
	b	pang
	.section .rodata
	.align	3
.LC1:
	.string	"cycle=%llu\n"
	.align	3
.LC2:
	.string	"F:"
	.align	3
.LC3:
	.string	" %d"
	.align	3
.LC4:
	.string	"\nM:"
	.align	3
.LC5:
	.string	"\n"
	.align	3
.LC6:
	.string	"tak=%d calls=%ld\n"
	.align	3
.LC7:
	.string	"big/small=%d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -48]!
	adrp	x0, .LANCHOR1
	mov	x1, 1
	mov	x29, sp
	ldr	w2, [x0, :lo12:.LANCHOR1]
	stp	x19, x20, [sp, 16]
	add	x20, x0, :lo12:.LANCHOR1
	mov	w0, -77
	str	x21, [sp, 32]
	bl	ping
	mov	x1, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	w0, [x20, 4]
	tbnz	w0, #31, .L63
	adrp	x21, .LC3
	add	x21, x21, :lo12:.LC3
	mov	w19, 0
	.align 5
.L64:
	mov	w0, w19
	bl	hof_f
	mov	w1, w0
	mov	x0, x21
	bl	printf
	add	w19, w19, 1
	ldr	w0, [x20, 4]
	cmp	w0, w19
	bge	.L64
.L63:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w0, [x20, 4]
	tbnz	w0, #31, .L65
	adrp	x21, .LC3
	add	x21, x21, :lo12:.LC3
	mov	w19, 0
	.align 5
.L66:
	mov	w0, w19
	bl	hof_m
	mov	w1, w0
	mov	x0, x21
	bl	printf
	add	w19, w19, 1
	ldr	w0, [x20, 4]
	cmp	w0, w19
	bge	.L66
.L65:
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [x20, 8]
	ldr	w1, [x20, 12]
	ldr	w2, [x20, 16]
	bl	tak
	adrp	x1, .LANCHOR0
	ldr	x2, [x1, :lo12:.LANCHOR0]
	mov	w1, w0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	w0, 601
	bl	big_side
	mov	w1, w0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	x21, [sp, 32]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.data
	.align	2
	.LANCHOR1:
cycle_len:
	.word	3000
fm_top:
	.word	24
tak_x:
	.word	12
tak_y:
	.word	7
tak_z:
	.word	3
	.bss
	.align	3
	.LANCHOR0:
tak_calls:
	.zero	8

