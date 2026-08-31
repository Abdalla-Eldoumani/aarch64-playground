	.text
	.align	2
	.align 5
	.global	depth
depth:
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"%ld %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #2192
	mov	w0, 0
	sub	sp, sp, #77824
	mov	w3, 20000
	add	x2, sp, 16
	mov	x1, x2
	stp	x29, x30, [sp]
	mov	x29, sp
	.align 5
.L4:
	str	w0, [x1], 4
	add	w0, w0, 1
	cmp	w0, w3
	bne	.L4
	add	x3, x2, 77824
	mov	x1, 0
	add	x3, x3, 2176
	.align 5
.L5:
	ldrsw	x0, [x2], 4
	add	x1, x1, x0
	cmp	x2, x3
	bne	.L5
	adrp	x0, .LC0+8
	adrp	x6, g__0
	add	x6, x6, :lo12:g__0
	mov	x2, 4294967296
	add	x7, x6, 397312
	mov	x3, x6
	ldr	x0, [x0, :lo12:.LC0+8]
	add	x7, x7, 2688
	.align 5
.L6:
	and	x5, x0, 30064771079
	add	w8, w2, 4
	and	x4, x2, 30064771079
	asr	x2, x2, 32
	stp	x4, x5, [x3], 16
	mov	x5, 0
	add	w2, w2, 4
	bfi	x5, x8, 0, 32
	mov	x4, 0
	bfi	x5, x2, 32, 32
	add	w2, w0, 4
	asr	x0, x0, 32
	bfi	x4, x2, 0, 32
	add	w0, w0, 4
	mov	x2, x5
	bfi	x4, x0, 32, 32
	mov	x0, x4
	cmp	x3, x7
	bne	.L6
	.align 5
.L7:
	ldrsw	x0, [x6], 4
	add	x1, x1, x0
	cmp	x6, x7
	bne	.L7
	mov	w0, 3000
	bl	depth
	mov	w2, w0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldp	x29, x30, [sp]
	add	sp, sp, 2192
	mov	w0, 0
	add	sp, sp, 77824
	ret
	.section .rodata
	.align	4
.LC0:
	.quad	4294967296
	.quad	12884901890
	.bss
	.align	4
g__0:
	.zero	400000

