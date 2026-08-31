	.text
	.align	2
	.global	depth
depth:
	sub	sp, sp, #544
	stp	x29, x30, [sp]
	mov	x29, sp
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	and	w0, w0, 255
	strb	w0, [sp, 32]
	ldr	w0, [sp, 28]
	cmp	w0, 0
	bne	.L2
	ldrb	w0, [sp, 32]
	b	.L4
.L2:
	ldr	w0, [sp, 28]
	sub	w0, w0, #1
	bl	depth
	add	w0, w0, 1
.L4:
	ldp	x29, x30, [sp]
	add	sp, sp, 544
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%ld %d\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #2240
	sub	sp, sp, #77824
	stp	x29, x30, [sp]
	mov	x29, sp
	str	w0, [sp, 28]
	str	x1, [sp, 16]
	add	x0, sp, 77824
	add	x0, x0, 2232
	str	xzr, [x0]
	add	x0, sp, 77824
	add	x0, x0, 2228
	str	wzr, [x0]
	b	.L6
.L7:
	add	x0, sp, 77824
	add	x0, x0, 2228
	ldrsw	x0, [x0]
	lsl	x0, x0, 2
	add	x1, sp, 40
	add	x2, sp, 77824
	add	x2, x2, 2228
	ldr	w2, [x2]
	str	w2, [x1, x0]
	add	x0, sp, 77824
	add	x0, x0, 2228
	ldr	w0, [x0]
	add	w0, w0, 1
	add	x1, sp, 77824
	add	x1, x1, 2228
	str	w0, [x1]
.L6:
	add	x0, sp, 77824
	add	x0, x0, 2228
	ldr	w1, [x0]
	mov	w0, 19999
	cmp	w1, w0
	ble	.L7
	add	x0, sp, 77824
	add	x0, x0, 2224
	str	wzr, [x0]
	b	.L8
.L9:
	add	x0, sp, 77824
	add	x0, x0, 2224
	ldrsw	x0, [x0]
	lsl	x0, x0, 2
	add	x1, sp, 40
	ldr	w0, [x1, x0]
	sxtw	x0, w0
	add	x1, sp, 77824
	add	x1, x1, 2232
	ldr	x1, [x1]
	add	x0, x1, x0
	add	x1, sp, 77824
	add	x1, x1, 2232
	str	x0, [x1]
	add	x0, sp, 77824
	add	x0, x0, 2224
	ldr	w0, [x0]
	add	w0, w0, 1
	add	x1, sp, 77824
	add	x1, x1, 2224
	str	w0, [x1]
.L8:
	add	x0, sp, 77824
	add	x0, x0, 2224
	ldr	w1, [x0]
	mov	w0, 19999
	cmp	w1, w0
	ble	.L9
	add	x0, sp, 77824
	add	x0, x0, 2220
	str	wzr, [x0]
	b	.L10
.L11:
	add	x0, sp, 77824
	add	x0, x0, 2220
	ldr	w0, [x0]
	and	w2, w0, 7
	adrp	x0, g__0
	add	x0, x0, :lo12:g__0
	add	x1, sp, 77824
	add	x1, x1, 2220
	ldrsw	x1, [x1]
	str	w2, [x0, x1, lsl 2]
	add	x0, sp, 77824
	add	x0, x0, 2220
	ldr	w0, [x0]
	add	w0, w0, 1
	add	x1, sp, 77824
	add	x1, x1, 2220
	str	w0, [x1]
.L10:
	add	x0, sp, 77824
	add	x0, x0, 2220
	ldr	w1, [x0]
	mov	w0, 34463
	movk	w0, 0x1, lsl 16
	cmp	w1, w0
	ble	.L11
	add	x0, sp, 77824
	add	x0, x0, 2216
	str	wzr, [x0]
	b	.L12
.L13:
	adrp	x0, g__0
	add	x0, x0, :lo12:g__0
	add	x1, sp, 77824
	add	x1, x1, 2216
	ldrsw	x1, [x1]
	ldr	w0, [x0, x1, lsl 2]
	sxtw	x0, w0
	add	x1, sp, 77824
	add	x1, x1, 2232
	ldr	x1, [x1]
	add	x0, x1, x0
	add	x1, sp, 77824
	add	x1, x1, 2232
	str	x0, [x1]
	add	x0, sp, 77824
	add	x0, x0, 2216
	ldr	w0, [x0]
	add	w0, w0, 1
	add	x1, sp, 77824
	add	x1, x1, 2216
	str	w0, [x1]
.L12:
	add	x0, sp, 77824
	add	x0, x0, 2216
	ldr	w1, [x0]
	mov	w0, 34463
	movk	w0, 0x1, lsl 16
	cmp	w1, w0
	ble	.L13
	mov	w0, 3000
	bl	depth
	mov	w2, w0
	add	x0, sp, 77824
	add	x0, x0, 2232
	ldr	x1, [x0]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp]
	add	sp, sp, 2240
	add	sp, sp, 77824
	ret


	.bss
	.balign 8
g__0:
	.skip 400000
