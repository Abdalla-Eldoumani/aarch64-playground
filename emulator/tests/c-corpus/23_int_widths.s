	.text
	.section .rodata
	.align	3
.LC1:
	.string	"%d %d %d %d\n"
	.align	3
.LC2:
	.string	"%ld %ld %ld\n"
	.align	3
.LC3:
	.string	"%d %d %x\n"
	.align	3
.LC4:
	.string	"%ld %ld\n"
	.align	3
.LC5:
	.string	"%d %d\n"
	.align	3
.LC6:
	.string	"%ld %d\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -160]!
	mov	x29, sp
	mov	w0, -1
	strb	w0, [sp, 131]
	mov	w0, -1
	strb	w0, [sp, 130]
	mov	w0, -2
	strh	w0, [sp, 128]
	mov	w0, -1
	strh	w0, [sp, 126]
	ldrb	w0, [sp, 131]
	str	w0, [sp, 120]
	ldrb	w0, [sp, 130]
	str	w0, [sp, 116]
	ldrsh	w0, [sp, 128]
	str	w0, [sp, 112]
	ldrh	w0, [sp, 126]
	str	w0, [sp, 108]
	ldr	w4, [sp, 108]
	ldr	w3, [sp, 112]
	ldr	w2, [sp, 116]
	ldr	w1, [sp, 120]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldrb	w0, [sp, 131]
	str	x0, [sp, 96]
	ldrb	w0, [sp, 130]
	str	x0, [sp, 88]
	ldrsh	x0, [sp, 128]
	str	x0, [sp, 80]
	ldr	x3, [sp, 80]
	ldr	x2, [sp, 88]
	ldr	x1, [sp, 96]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 22136
	movk	w0, 0x1234, lsl 16
	str	w0, [sp, 76]
	ldr	w0, [sp, 76]
	strb	w0, [sp, 75]
	ldr	w0, [sp, 76]
	strh	w0, [sp, 72]
	ldrb	w0, [sp, 75]
	ldrsh	w1, [sp, 72]
	ldr	w2, [sp, 76]
	and	w2, w2, 255
	mov	w3, w2
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w0, -1
	str	w0, [sp, 68]
	ldr	w0, [sp, 68]
	str	x0, [sp, 56]
	ldr	w0, [sp, 68]
	sxtw	x0, w0
	str	x0, [sp, 48]
	ldr	x2, [sp, 48]
	ldr	x1, [sp, 56]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, 65025
	movk	w0, 0xfc03, lsl 16
	str	w0, [sp, 40]
	str	wzr, [sp, 156]
	str	wzr, [sp, 152]
	b	.L2
.L3:
	ldrsw	x0, [sp, 152]
	add	x1, sp, 40
	ldrb	w0, [x1, x0]
	mov	w1, w0
	ldr	w0, [sp, 156]
	add	w0, w0, w1
	str	w0, [sp, 156]
	ldr	w0, [sp, 152]
	add	w0, w0, 1
	str	w0, [sp, 152]
.L2:
	ldr	w0, [sp, 152]
	cmp	w0, 3
	ble	.L3
	mov	w0, 65025
	movk	w0, 0xfc03, lsl 16
	str	w0, [sp, 32]
	str	wzr, [sp, 148]
	str	wzr, [sp, 144]
	b	.L4
.L5:
	ldrsw	x0, [sp, 144]
	add	x1, sp, 32
	ldrb	w0, [x1, x0]
	mov	w1, w0
	ldr	w0, [sp, 148]
	add	w0, w0, w1
	str	w0, [sp, 148]
	ldr	w0, [sp, 144]
	add	w0, w0, 1
	str	w0, [sp, 144]
.L4:
	ldr	w0, [sp, 144]
	cmp	w0, 3
	ble	.L5
	ldr	w2, [sp, 148]
	ldr	w1, [sp, 156]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 24
	ldr	w2, [x1]
	ldrh	w1, [x1, 4]
	str	w2, [x0]
	strh	w1, [x0, 4]
	str	xzr, [sp, 136]
	str	wzr, [sp, 132]
	b	.L6
.L7:
	ldrsw	x0, [sp, 132]
	lsl	x0, x0, 1
	add	x1, sp, 24
	ldrsh	w0, [x1, x0]
	sxth	x0, w0
	ldr	x1, [sp, 136]
	add	x0, x1, x0
	str	x0, [sp, 136]
	ldr	w0, [sp, 132]
	add	w0, w0, 1
	str	w0, [sp, 132]
.L6:
	ldr	w0, [sp, 132]
	cmp	w0, 2
	ble	.L7
	mov	w2, 10
	ldr	x1, [sp, 136]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 160
	ret
	.section .rodata
	.align	3
.LC0:
	.hword	-100
	.hword	200
	.hword	-300
	.text

