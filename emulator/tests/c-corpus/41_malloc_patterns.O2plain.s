	.text
	.section .rodata
	.align	3
.LC0:
	.string	"nonnull"
	.align	3
.LC1:
	.string	"m0 %s\n"
	.align	3
.LC2:
	.string	"big %ld\n"
	.align	3
.LC3:
	.string	"c15=%d\n"
	.align	3
.LC4:
	.string	"nine char"
	.align	3
.LC5:
	.string	"%s %d\n"
	.align	3
.LC6:
	.string	"ok=%d\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #848
	adrp	x1, .LC0
	add	x1, x1, :lo12:.LC0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	str	x21, [sp, 32]
	bl	printf
	mov	x0, 1048576
	bl	malloc
	mov	w1, 7
	mov	x20, x0
	mov	x2, 1048576
	bl	memset
	mov	x0, x20
	add	x3, x20, 1048576
	mov	x1, 0
	.p2align 5,,15
.L2:
	ldrb	w2, [x0]
	add	x0, x0, 4096
	add	x1, x1, x2
	cmp	x0, x3
	bne	.L2
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	x0, 64
	bl	malloc
	mov	x19, x0
	mov	x1, 0
	.p2align 5,,15
.L3:
	mul	w2, w1, w1
	str	w2, [x19, x1, lsl 2]
	add	x1, x1, 1
	cmp	x1, 16
	bne	.L3
	mov	x0, x20
	bl	free
	ldr	w1, [x19, 60]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	sub	x20, sp, #752
	bl	printf
	mov	x0, x19
	bl	free
	mov	x0, 10
	bl	malloc
	mov	x19, x0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	mov	w2, 9
	ldr	x1, [x0]
	str	x1, [x19]
	ldrh	w0, [x0, 8]
	mov	x1, x19
	strh	w0, [x19, 8]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	x0, x19
	mov	x19, 100
	bl	free
	.p2align 5,,15
.L4:
	mov	x0, x19
	bl	malloc
	mov	x2, x19
	sub	w1, w19, #100
	str	x0, [x20, x19, lsl 3]
	add	x19, x19, 1
	bl	memset
	cmp	x19, 200
	bne	.L4
	add	x21, sp, 48
	mov	w19, 0
	mov	w20, 1
	.p2align 5,,15
.L5:
	ldr	x0, [x21], 8
	ldrb	w1, [x0, 99]
	cmp	w1, w19
	add	w19, w19, 1
	cset	w1, eq
	and	w20, w20, w1
	bl	free
	cmp	w19, 100
	bne	.L5
	mov	w1, w20
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	x21, [sp, 32]
	mov	w0, 0
	ldp	x29, x30, [sp]
	ldp	x19, x20, [sp, 16]
	add	sp, sp, 848
	ret

