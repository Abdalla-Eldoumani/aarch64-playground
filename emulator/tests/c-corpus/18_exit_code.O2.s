	.text
	.align	2
	.align 5
	.global	compute
compute:
	mov	w0, 45
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"start\n"
	.align	3
.LC1:
	.string	"v=%d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x19, [sp, 16]
	mov	w19, w0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	cmp	w19, 5
	ble	.L6
	ldr	x19, [sp, 16]
	mov	w0, 1
	ldp	x29, x30, [sp], 32
	ret
.L6:
	mov	w1, 45
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, -3
	bl	exit

