	.text
	.section .rodata
	.align	3
.LC0:
	.string	"nonnull"
	.align	3
.LC1:
	.string	"null"
	.align	3
.LC2:
	.string	"m0 %s\n"
	.align	3
.LC3:
	.string	"big %ld\n"
	.align	3
.LC4:
	.string	"c15=%d\n"
	.align	3
.LC5:
	.string	"nine char"
	.align	3
.LC6:
	.string	"%s %d\n"
	.align	3
.LC7:
	.string	"ok=%d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #848
	mov	x0, 0
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	str	x21, [sp, 32]
	bl	malloc
	cbz	x0, .L8
	adrp	x1, .LC0
	add	x1, x1, :lo12:.LC0
.L2:
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
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
	.align 5
.L3:
	ldrb	w2, [x0]
	add	x0, x0, 4096
	add	x1, x1, x2
	cmp	x0, x3
	bne	.L3
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	x0, 64
	bl	malloc
	mov	x19, x0
	mov	x1, 0
	.align 5
.L4:
	mul	w2, w1, w1
	str	w2, [x19, x1, lsl 2]
	add	x1, x1, 1
	cmp	x1, 16
	bne	.L4
	mov	x0, x20
	bl	free
	mov	x0, 64
	bl	malloc
	mov	x20, x0
	mov	x1, x0
	add	x0, x0, 64
	.align 5
.L5:
	str	wzr, [x1], 4
	cmp	x1, x0
	bne	.L5
	ldr	w1, [x19, 60]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	x0, x19
	bl	free
	mov	x0, x20
	bl	free
	mov	x0, 0
	bl	free
	mov	x0, 10
	bl	malloc
	adrp	x1, .LC5
	add	x1, x1, :lo12:.LC5
	mov	x19, x0
	bl	strcpy
	mov	x0, x19
	sub	x20, sp, #752
	bl	strlen
	mov	w2, w0
	mov	x1, x19
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	x0, x19
	mov	x19, 100
	bl	free
	.align 5
.L6:
	mov	x0, x19
	bl	malloc
	mov	x2, x19
	sub	w1, w19, #100
	str	x0, [x20, x19, lsl 3]
	add	x19, x19, 1
	bl	memset
	cmp	x19, 200
	bne	.L6
	add	x21, sp, 48
	mov	w19, 0
	mov	w20, 1
	.align 5
.L7:
	ldr	x0, [x21], 8
	ldrb	w1, [x0, 99]
	cmp	w1, w19
	add	w19, w19, 1
	cset	w1, eq
	and	w20, w20, w1
	bl	free
	cmp	w19, 100
	bne	.L7
	mov	w1, w20
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	x21, [sp, 32]
	mov	w0, 0
	ldp	x29, x30, [sp]
	ldp	x19, x20, [sp, 16]
	add	sp, sp, 848
	ret
.L8:
	adrp	x1, .LC1
	add	x1, x1, :lo12:.LC1
	b	.L2

