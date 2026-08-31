	.text
	.align	2
	.global	compute
compute:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	str	wzr, [sp, 8]
	b	.L2
.L3:
	ldr	w1, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w1, w0
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L2:
	ldr	w0, [sp, 8]
	cmp	w0, 9
	ble	.L3
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"start\n"
	.align	3
.LC1:
	.string	"v=%d\n"
	.align	3
.LC2:
	.string	"unreachable\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	x1, [sp, 16]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w0, [sp, 28]
	cmp	w0, 5
	ble	.L6
	mov	w0, 1
	b	.L7
.L6:
	bl	compute
	str	w0, [sp, 44]
	ldr	w1, [sp, 44]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 44]
	cmp	w0, 45
	bne	.L8
	mov	w0, -3
	bl	exit
.L8:
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 300
.L7:
	ldp	x29, x30, [sp], 48
	ret

