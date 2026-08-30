	.text
	.section .rodata
	.align	3
.LC0:
	.string	"bye\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	x1, [sp, 16]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w0, [sp, 28]
	cmp	w0, 5
	ble	.L2
	mov	w0, 0
	b	.L4
.L2:
	mov	w0, 300
	bl	exit
.L4:
	ldp	x29, x30, [sp], 32
	ret

