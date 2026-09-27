	.text
	.data
	.align	2
cycle_len:
	.word	3000
	.align	2
fm_top:
	.word	24
	.align	2
tak_x:
	.word	12
	.align	2
tak_y:
	.word	7
	.align	2
tak_z:
	.word	3
	.section .rodata
	.align	3
.LC0:
	.string	"ping n=%d a=%d acc=%llu\n"
	.text
	.align	2
ping:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	strb	w0, [sp, 31]
	str	x1, [sp, 16]
	str	w2, [sp, 24]
	ldr	w0, [sp, 24]
	mov	w1, 1500
	sdiv	w2, w0, w1
	mov	w1, 1500
	mul	w1, w2, w1
	sub	w0, w0, w1
	cmp	w0, 0
	bne	.L2
	ldrsb	w0, [sp, 31]
	ldr	x3, [sp, 16]
	mov	w2, w0
	ldr	w1, [sp, 24]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
.L2:
	ldr	w0, [sp, 24]
	cmp	w0, 0
	bne	.L3
	ldr	x0, [sp, 16]
	b	.L4
.L3:
	ldrsb	w0, [sp, 31]
	and	w1, w0, 65535
	mov	w0, 300
	mul	w0, w1, w0
	and	w3, w0, 65535
	ldr	x1, [sp, 16]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x1, x0, x1
	ldrsb	x0, [sp, 31]
	add	x1, x1, x0
	ldr	w0, [sp, 24]
	sub	w0, w0, #1
	mov	w2, w0
	mov	w0, w3
	bl	pong
.L4:
	ldp	x29, x30, [sp], 32
	ret
	.align	2
pong:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	strh	w0, [sp, 30]
	str	x1, [sp, 16]
	str	w2, [sp, 24]
	ldr	w0, [sp, 24]
	cmp	w0, 0
	bne	.L6
	ldrh	w1, [sp, 30]
	ldr	x0, [sp, 16]
	eor	x0, x1, x0
	b	.L7
.L6:
	ldrh	w1, [sp, 30]
	mov	w0, -40000
	add	w3, w1, w0
	ldrh	w1, [sp, 30]
	ldr	x0, [sp, 16]
	add	x1, x1, x0
	ldr	w0, [sp, 24]
	sub	w0, w0, #1
	mov	w2, w0
	mov	w0, w3
	bl	pang
.L7:
	ldp	x29, x30, [sp], 32
	ret
	.align	2
pang:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	x1, [sp, 16]
	str	w2, [sp, 24]
	ldr	w0, [sp, 24]
	cmp	w0, 0
	bne	.L9
	ldrsw	x0, [sp, 28]
	ldr	x1, [sp, 16]
	sub	x0, x1, x0
	b	.L10
.L9:
	ldr	w0, [sp, 28]
	sxtb	w1, w0
	ldr	w0, [sp, 24]
	sxtb	w0, w0
	eor	w0, w1, w0
	sxtb	w3, w0
	ldrsw	x0, [sp, 28]
	ldr	x1, [sp, 16]
	sub	x1, x1, x0
	ldr	w0, [sp, 24]
	sub	w0, w0, #1
	mov	w2, w0
	mov	w0, w3
	bl	ping
.L10:
	ldp	x29, x30, [sp], 32
	ret
	.align	2
hof_f:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	cmp	w0, 0
	beq	.L12
	ldr	w0, [sp, 28]
	sub	w0, w0, #1
	bl	hof_f
	bl	hof_m
	mov	w1, w0
	ldr	w0, [sp, 28]
	sub	w0, w0, w1
	b	.L14
.L12:
	mov	w0, 1
.L14:
	ldp	x29, x30, [sp], 32
	ret
	.align	2
hof_m:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	cmp	w0, 0
	beq	.L16
	ldr	w0, [sp, 28]
	sub	w0, w0, #1
	bl	hof_m
	bl	hof_f
	mov	w1, w0
	ldr	w0, [sp, 28]
	sub	w0, w0, w1
	b	.L18
.L16:
	mov	w0, 0
.L18:
	ldp	x29, x30, [sp], 32
	ret
	.align	2
tak:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	str	w0, [sp, 44]
	str	w1, [sp, 40]
	str	w2, [sp, 36]
	adrp	x0, tak_calls
	add	x0, x0, :lo12:tak_calls
	ldr	x0, [x0]
	add	x1, x0, 1
	adrp	x0, tak_calls
	add	x0, x0, :lo12:tak_calls
	str	x1, [x0]
	ldr	w1, [sp, 40]
	ldr	w0, [sp, 44]
	cmp	w1, w0
	bge	.L20
	ldr	w0, [sp, 44]
	sub	w0, w0, #1
	ldr	w2, [sp, 36]
	ldr	w1, [sp, 40]
	bl	tak
	mov	w19, w0
	ldr	w0, [sp, 40]
	sub	w0, w0, #1
	ldr	w2, [sp, 44]
	ldr	w1, [sp, 36]
	bl	tak
	mov	w20, w0
	ldr	w0, [sp, 36]
	sub	w0, w0, #1
	ldr	w2, [sp, 40]
	ldr	w1, [sp, 44]
	bl	tak
	mov	w2, w0
	mov	w1, w20
	mov	w0, w19
	bl	tak
	b	.L21
.L20:
	ldr	w0, [sp, 36]
.L21:
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.align	2
big_side:
	stp	x29, x30, [sp, -304]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	wzr, [sp, 296]
	str	wzr, [sp, 300]
	b	.L23
.L24:
	ldr	w0, [sp, 28]
	and	w1, w0, 255
	ldr	w0, [sp, 300]
	and	w0, w0, 255
	add	w0, w1, w0
	and	w2, w0, 255
	ldrsw	x0, [sp, 300]
	add	x1, sp, 40
	strb	w2, [x1, x0]
	ldr	w0, [sp, 300]
	add	w0, w0, 51
	str	w0, [sp, 300]
.L23:
	ldr	w0, [sp, 300]
	cmp	w0, 255
	ble	.L24
	ldr	w0, [sp, 28]
	cmp	w0, 0
	ble	.L25
	ldr	w0, [sp, 28]
	sub	w0, w0, #1
	bl	small_side
	str	w0, [sp, 296]
.L25:
	str	wzr, [sp, 300]
	b	.L26
.L27:
	ldrsw	x0, [sp, 300]
	add	x1, sp, 40
	ldrb	w0, [x1, x0]
	mov	w1, w0
	ldr	w0, [sp, 296]
	add	w0, w0, w1
	str	w0, [sp, 296]
	ldr	w0, [sp, 300]
	add	w0, w0, 51
	str	w0, [sp, 300]
.L26:
	ldr	w0, [sp, 300]
	cmp	w0, 255
	ble	.L27
	ldr	w0, [sp, 296]
	ldp	x29, x30, [sp], 304
	ret
	.align	2
small_side:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	cmp	w0, 0
	ble	.L30
	ldr	w0, [sp, 28]
	sub	w0, w0, #1
	bl	big_side
	add	w0, w0, 1
	b	.L32
.L30:
	mov	w0, 0
.L32:
	ldp	x29, x30, [sp], 32
	ret
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
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	adrp	x0, cycle_len
	add	x0, x0, :lo12:cycle_len
	ldr	w0, [x0]
	mov	w2, w0
	mov	x1, 1
	mov	w0, -77
	bl	ping
	mov	x1, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	str	wzr, [sp, 28]
	b	.L34
.L35:
	ldr	w0, [sp, 28]
	bl	hof_f
	mov	w1, w0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L34:
	adrp	x0, fm_top
	add	x0, x0, :lo12:fm_top
	ldr	w0, [x0]
	ldr	w1, [sp, 28]
	cmp	w1, w0
	ble	.L35
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	str	wzr, [sp, 28]
	b	.L36
.L37:
	ldr	w0, [sp, 28]
	bl	hof_m
	mov	w1, w0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L36:
	adrp	x0, fm_top
	add	x0, x0, :lo12:fm_top
	ldr	w0, [x0]
	ldr	w1, [sp, 28]
	cmp	w1, w0
	ble	.L37
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, tak_x
	add	x0, x0, :lo12:tak_x
	ldr	w3, [x0]
	adrp	x0, tak_y
	add	x0, x0, :lo12:tak_y
	ldr	w1, [x0]
	adrp	x0, tak_z
	add	x0, x0, :lo12:tak_z
	ldr	w0, [x0]
	mov	w2, w0
	mov	w0, w3
	bl	tak
	str	w0, [sp, 24]
	adrp	x0, tak_calls
	add	x0, x0, :lo12:tak_calls
	ldr	x0, [x0]
	mov	x2, x0
	ldr	w1, [sp, 24]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	w0, 601
	bl	big_side
	mov	w1, w0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret


	.bss
	.balign 8
tak_calls:
	.skip 8
