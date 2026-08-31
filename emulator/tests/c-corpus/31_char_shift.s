	.text
	.section .rodata
	.align	3
.LC0:
	.string	"char=%d signed=%d unsigned=%d\n"
	.align	3
.LC1:
	.string	"%u %u %d %d\n"
	.align	3
.LC2:
	.string	"%u\n"
	.align	3
.LC3:
	.string	"%ld %lu\n"
	.align	3
.LC4:
	.string	"wrap=%d\n"
	.align	3
.LC5:
	.string	"uwrap=%u\n"
	.align	3
.LC6:
	.string	"%d %d %d %d\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	x1, [sp, 16]
	mov	w0, -56
	strb	w0, [sp, 79]
	mov	w0, -56
	strb	w0, [sp, 78]
	mov	w0, -56
	strb	w0, [sp, 77]
	ldrb	w0, [sp, 79]
	ldrsb	w1, [sp, 78]
	ldrb	w2, [sp, 77]
	mov	w3, w2
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w0, [sp, 28]
	add	w0, w0, 30
	str	w0, [sp, 72]
	ldr	w0, [sp, 28]
	add	w0, w0, 32
	str	w0, [sp, 68]
	mov	w0, -2147483648
	str	w0, [sp, 64]
	mov	w0, -8
	str	w0, [sp, 60]
	ldr	w0, [sp, 72]
	ldr	w1, [sp, 64]
	lsr	w5, w1, w0
	ldr	w0, [sp, 72]
	mov	w1, 1
	lsl	w2, w1, w0
	ldr	w0, [sp, 28]
	ldr	w1, [sp, 60]
	asr	w1, w1, w0
	ldr	w0, [sp, 60]
	asr	w0, w0, 3
	mov	w4, w0
	mov	w3, w1
	mov	w1, w5
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 68]
	and	w0, w0, 31
	ldr	w1, [sp, 64]
	lsr	w0, w1, w0
	mov	w1, w0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	x0, -1
	str	x0, [sp, 48]
	ldr	x0, [sp, 48]
	asr	x1, x0, 63
	ldr	x0, [sp, 48]
	lsr	x0, x0, 63
	mov	x2, x0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w0, 2147483647
	str	w0, [sp, 44]
	ldr	w1, [sp, 44]
	ldr	w0, [sp, 28]
	add	w0, w1, w0
	str	w0, [sp, 44]
	ldr	w1, [sp, 44]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	str	wzr, [sp, 40]
	ldr	w0, [sp, 28]
	ldr	w1, [sp, 40]
	sub	w0, w1, w0
	str	w0, [sp, 40]
	ldr	w1, [sp, 40]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w0, -7
	str	w0, [sp, 36]
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 32]
	ldr	w1, [sp, 36]
	ldr	w0, [sp, 32]
	sdiv	w5, w1, w0
	ldr	w0, [sp, 36]
	ldr	w1, [sp, 32]
	sdiv	w2, w0, w1
	ldr	w1, [sp, 32]
	mul	w1, w2, w1
	sub	w6, w0, w1
	ldr	w0, [sp, 36]
	neg	w1, w0
	ldr	w0, [sp, 32]
	sdiv	w3, w1, w0
	ldr	w0, [sp, 36]
	neg	w0, w0
	ldr	w1, [sp, 32]
	sdiv	w2, w0, w1
	ldr	w1, [sp, 32]
	mul	w1, w2, w1
	sub	w0, w0, w1
	mov	w4, w0
	mov	w2, w6
	mov	w1, w5
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 80
	ret

