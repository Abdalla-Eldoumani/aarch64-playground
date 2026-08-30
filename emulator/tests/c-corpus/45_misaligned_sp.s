	.text
	.section .rodata
	.align	3
.LC0:
	.string	"before\n"
	.align	3
.LC1:
	.string	"during\n"
	.align	3
.LC2:
	.string	"after\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -16]!
	mov	x29, sp
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
// 2 "programs/45_misaligned_sp.c" 1
	sub sp, sp, #8
// 0 "" 2
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
// 2 "programs/45_misaligned_sp.c" 1
	add sp, sp, #8
// 0 "" 2
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 16
	ret

