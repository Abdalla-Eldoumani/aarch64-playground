	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%08x %016lx %04x\n"
	.align	3
.LC1:
	.string	"%02x %02x %02x %02x %02x\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	wzr, [sp, 60]
	b	.L2
.L3:
	ldr	w0, [sp, 60]
	and	w0, w0, 255
	add	w0, w0, 1
	and	w2, w0, 255
	ldrsw	x0, [sp, 60]
	add	x1, sp, 16
	strb	w2, [x1, x0]
	ldr	w0, [sp, 60]
	add	w0, w0, 1
	str	w0, [sp, 60]
.L2:
	ldr	w0, [sp, 60]
	cmp	w0, 15
	ble	.L3
	add	x0, sp, 16
	add	x0, x0, 1
	str	x0, [sp, 48]
	add	x0, sp, 16
	add	x0, x0, 3
	str	x0, [sp, 40]
	add	x0, sp, 16
	add	x0, x0, 5
	str	x0, [sp, 32]
	ldr	x0, [sp, 48]
	ldr	w1, [x0]
	ldr	x0, [sp, 40]
	ldr	x2, [x0]
	ldr	x0, [sp, 32]
	ldrsh	w0, [x0]
	and	w0, w0, 65535
	mov	w3, w0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	x0, [sp, 48]
	mov	w1, 13124
	movk	w1, 0x1122, lsl 16
	str	w1, [x0]
	ldrb	w0, [sp, 16]
	ldrb	w1, [sp, 17]
	ldrb	w2, [sp, 18]
	ldrb	w3, [sp, 19]
	ldrb	w4, [sp, 20]
	mov	w5, w4
	mov	w4, w3
	mov	w3, w2
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 64
	ret

