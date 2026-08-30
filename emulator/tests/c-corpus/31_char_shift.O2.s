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
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	w3, 200
	mov	w2, -56
	mov	x29, sp
	mov	w1, w3
	stp	x19, x20, [sp, 16]
	mov	w19, w0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	add	w1, w19, 30
	mov	w3, -8
	mov	w2, 1
	asr	w3, w3, w19
	mov	w4, -1
	lsl	w2, w2, w1
	mov	w20, -2147483648
	adrp	x0, .LC1
	lsr	w1, w20, w1
	add	x0, x0, :lo12:.LC1
	bl	printf
	lsr	w1, w20, w19
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	x2, 1
	mov	x1, -1
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	w1, 2147483647
	adrp	x0, .LC4
	add	w1, w19, w1
	add	x0, x0, :lo12:.LC4
	bl	printf
	neg	w1, w19
	adrp	x0, .LC5
	add	w19, w19, 1
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w0, 7
	mov	w2, -7
	sdiv	w4, w0, w19
	sdiv	w1, w2, w19
	msub	w4, w4, w19, w0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	msub	w2, w1, w19, w2
	neg	w3, w1
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret

