	.text
	.align	2
	.global	matmul
matmul:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x0, [sp, 40]
	str	x1, [sp, 32]
	str	x2, [sp, 24]
	mov	x2, 64
	mov	w1, 0
	ldr	x0, [sp, 24]
	bl	memset
	str	wzr, [sp, 60]
	b	.L2
.L7:
	str	wzr, [sp, 56]
	b	.L3
.L6:
	str	wzr, [sp, 52]
	b	.L4
.L5:
	ldrsw	x0, [sp, 60]
	lsl	x0, x0, 4
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	ldrsw	x1, [sp, 56]
	ldr	w2, [x0, x1, lsl 2]
	ldrsw	x0, [sp, 60]
	lsl	x0, x0, 4
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	ldrsw	x1, [sp, 52]
	ldr	w1, [x0, x1, lsl 2]
	ldrsw	x0, [sp, 52]
	lsl	x0, x0, 4
	ldr	x3, [sp, 32]
	add	x0, x3, x0
	ldrsw	x3, [sp, 56]
	ldr	w0, [x0, x3, lsl 2]
	mul	w1, w1, w0
	ldrsw	x0, [sp, 60]
	lsl	x0, x0, 4
	ldr	x3, [sp, 24]
	add	x0, x3, x0
	add	w2, w2, w1
	ldrsw	x1, [sp, 56]
	str	w2, [x0, x1, lsl 2]
	ldr	w0, [sp, 52]
	add	w0, w0, 1
	str	w0, [sp, 52]
.L4:
	ldr	w0, [sp, 52]
	cmp	w0, 3
	ble	.L5
	ldr	w0, [sp, 56]
	add	w0, w0, 1
	str	w0, [sp, 56]
.L3:
	ldr	w0, [sp, 56]
	cmp	w0, 3
	ble	.L6
	ldr	w0, [sp, 60]
	add	w0, w0, 1
	str	w0, [sp, 60]
.L2:
	ldr	w0, [sp, 60]
	cmp	w0, 3
	ble	.L7
	nop
	nop
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%d "
	.align	3
.LC1:
	.string	"\n"
	.align	3
.LC2:
	.string	"%ld\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -304]!
	mov	x29, sp
	str	wzr, [sp, 300]
	b	.L9
.L14:
	str	wzr, [sp, 296]
	b	.L10
.L13:
	ldr	w1, [sp, 300]
	ldr	w0, [sp, 296]
	add	w2, w1, w0
	ldrsw	x0, [sp, 296]
	ldrsw	x1, [sp, 300]
	lsl	x1, x1, 2
	add	x0, x1, x0
	lsl	x0, x0, 2
	add	x1, sp, 208
	str	w2, [x1, x0]
	ldr	w1, [sp, 300]
	ldr	w0, [sp, 296]
	cmp	w1, w0
	bne	.L11
	mov	w2, 2
	b	.L12
.L11:
	mov	w2, 0
.L12:
	ldrsw	x0, [sp, 296]
	ldrsw	x1, [sp, 300]
	lsl	x1, x1, 2
	add	x0, x1, x0
	lsl	x0, x0, 2
	add	x1, sp, 144
	str	w2, [x1, x0]
	ldr	w0, [sp, 296]
	add	w0, w0, 1
	str	w0, [sp, 296]
.L10:
	ldr	w0, [sp, 296]
	cmp	w0, 3
	ble	.L13
	ldr	w0, [sp, 300]
	add	w0, w0, 1
	str	w0, [sp, 300]
.L9:
	ldr	w0, [sp, 300]
	cmp	w0, 3
	ble	.L14
	add	x2, sp, 80
	add	x1, sp, 144
	add	x0, sp, 208
	bl	matmul
	add	x1, sp, 80
	add	x0, sp, 16
	mov	x2, 64
	bl	memcpy
	str	wzr, [sp, 292]
	b	.L15
.L18:
	str	wzr, [sp, 288]
	b	.L16
.L17:
	ldrsw	x0, [sp, 288]
	ldrsw	x1, [sp, 292]
	lsl	x1, x1, 2
	add	x0, x1, x0
	lsl	x0, x0, 2
	add	x1, sp, 16
	ldr	w0, [x1, x0]
	mov	w1, w0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w0, [sp, 288]
	add	w0, w0, 1
	str	w0, [sp, 288]
.L16:
	ldr	w0, [sp, 288]
	cmp	w0, 3
	ble	.L17
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 292]
	add	w0, w0, 1
	str	w0, [sp, 292]
.L15:
	ldr	w0, [sp, 292]
	cmp	w0, 3
	ble	.L18
	str	xzr, [sp, 280]
	str	wzr, [sp, 276]
	b	.L19
.L20:
	ldrsw	x1, [sp, 276]
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x1, sp, 16
	ldr	w0, [x1, x0]
	sxtw	x0, w0
	ldr	x1, [sp, 280]
	add	x0, x1, x0
	str	x0, [sp, 280]
	ldr	w0, [sp, 276]
	add	w0, w0, 1
	str	w0, [sp, 276]
.L19:
	ldr	w0, [sp, 276]
	cmp	w0, 3
	ble	.L20
	ldr	x1, [sp, 280]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 304
	ret

