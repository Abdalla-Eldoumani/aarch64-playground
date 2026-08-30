	.text
	.section .rodata
	.align	3
.LC0:
	.string	"argc=%d\n"
	.align	3
.LC1:
	.string	"argv0_nonempty=%d\n"
	.align	3
.LC2:
	.string	"arg%d=%s len=%d\n"
	.align	3
.LC3:
	.string	"total=%d\n"
	.align	3
.LC4:
	.string	"argv_end_null=%d\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x19, [sp, 16]
	str	w0, [sp, 44]
	str	x1, [sp, 32]
	ldr	w1, [sp, 44]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	x0, [sp, 32]
	ldr	x0, [x0]
	bl	strlen
	cmp	x0, 0
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	str	wzr, [sp, 60]
	mov	w0, 1
	str	w0, [sp, 56]
	b	.L2
.L3:
	ldrsw	x0, [sp, 56]
	lsl	x0, x0, 3
	ldr	x1, [sp, 32]
	add	x0, x1, x0
	ldr	x19, [x0]
	ldrsw	x0, [sp, 56]
	lsl	x0, x0, 3
	ldr	x1, [sp, 32]
	add	x0, x1, x0
	ldr	x0, [x0]
	bl	strlen
	mov	w3, w0
	mov	x2, x19
	ldr	w1, [sp, 56]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldrsw	x0, [sp, 56]
	lsl	x0, x0, 3
	ldr	x1, [sp, 32]
	add	x0, x1, x0
	ldr	x0, [x0]
	bl	atoi
	mov	w1, w0
	ldr	w0, [sp, 60]
	add	w0, w0, w1
	str	w0, [sp, 60]
	ldr	w0, [sp, 56]
	add	w0, w0, 1
	str	w0, [sp, 56]
.L2:
	ldr	w1, [sp, 56]
	ldr	w0, [sp, 44]
	cmp	w1, w0
	blt	.L3
	ldr	w1, [sp, 60]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldrsw	x0, [sp, 44]
	lsl	x0, x0, 3
	ldr	x1, [sp, 32]
	add	x0, x1, x0
	ldr	x0, [x0]
	cmp	x0, 0
	cset	w0, eq
	and	w0, w0, 255
	mov	w1, w0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w0, [sp, 60]
	negs	w1, w0
	and	w0, w0, 255
	and	w1, w1, 255
	csneg	w0, w0, w1, mi
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 64
	ret

