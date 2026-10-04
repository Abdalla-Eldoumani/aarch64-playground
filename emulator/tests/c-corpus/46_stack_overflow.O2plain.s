	.text
	.align	2
	.p2align 5,,15
	.global	rec
rec:
	mov	x12, 9232
	sub	sp, sp, x12
	mov	w1, 1
	mov	x2, 4112
	add	x2, sp, x2
	mov	x3, 5136
	stp	x29, x30, [sp]
	mov	x29, sp
	mov	x4, 6160
	mov	x5, 7184
	mov	x6, 8208
	strb	w1, [sp, 16]
	add	x0, x0, 9
	strb	w1, [sp, 1040]
	strb	w1, [sp, 2064]
	strb	w1, [sp, 3088]
	strb	w1, [x2]
	add	x2, sp, x3
	strb	w1, [x2]
	add	x2, sp, x4
	strb	w1, [x2]
	add	x2, sp, x5
	strb	w1, [x2]
	add	x2, sp, x6
	strb	w1, [x2]
	bl	rec
	mov	x7, 8208
	add	x1, sp, x7
	mov	x9, 7184
	mov	x10, 6160
	mov	x11, 5136
	mov	x12, 4112
	ldrb	w8, [x1]
	add	x1, sp, x9
	ldp	x29, x30, [sp]
	ldrb	w7, [x1]
	add	x1, sp, x10
	add	x8, x0, w8, uxtw
	ldrb	w6, [x1]
	add	x1, sp, x11
	add	x7, x8, w7, uxtw
	ldrb	w5, [x1]
	add	x1, sp, x12
	add	x6, x7, w6, uxtw
	mov	x12, 9232
	ldrb	w4, [x1]
	add	x5, x6, w5, uxtw
	ldrb	w3, [sp, 3088]
	ldrb	w2, [sp, 2064]
	add	x4, x5, w4, uxtw
	ldrb	w1, [sp, 1040]
	add	x3, x4, w3, uxtw
	ldrb	w0, [sp, 16]
	add	x2, x3, w2, uxtw
	add	sp, sp, x12
	add	x1, x2, w1, uxtw
	add	x0, x1, x0
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"start"
	.align	3
.LC1:
	.string	"%ld\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -16]!
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	mov	x29, sp
	bl	puts
	mov	x0, 0
	bl	rec
	mov	x1, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 16
	ret

