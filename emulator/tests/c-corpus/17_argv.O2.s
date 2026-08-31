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
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	stp	x21, x22, [sp, 32]
	mov	x22, x1
	mov	w1, w0
	str	x25, [sp, 64]
	mov	w25, w0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	x0, [x22]
	bl	strlen
	cmp	x0, 0
	cset	w1, ne
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	cmp	w25, 1
	ble	.L4
	stp	x23, x24, [sp, 48]
	adrp	x23, .LC2
	uxtw	x24, w25
	add	x23, x23, :lo12:.LC2
	mov	w21, 0
	stp	x19, x20, [sp, 16]
	mov	x19, 1
	.align 5
.L3:
	ldr	x20, [x22, x19, lsl 3]
	mov	x0, x20
	bl	strlen
	mov	w1, w19
	mov	w3, w0
	mov	x2, x20
	mov	x0, x23
	bl	printf
	ldr	x0, [x22, x19, lsl 3]
	add	x19, x19, 1
	bl	atoi
	add	w21, w21, w0
	cmp	x24, x19
	bne	.L3
	ldp	x19, x20, [sp, 16]
	ldp	x23, x24, [sp, 48]
.L2:
	mov	w1, w21
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	x0, [x22, w25, sxtw 3]
	cmp	x0, 0
	adrp	x0, .LC4
	cset	w1, eq
	add	x0, x0, :lo12:.LC4
	bl	printf
	negs	w0, w21
	and	w21, w21, 255
	and	w0, w0, 255
	ldr	x25, [sp, 64]
	csneg	w0, w21, w0, mi
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 80
	ret
.L4:
	mov	w21, 0
	b	.L2

