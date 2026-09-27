	.text
	.section .rodata
	.align	3
.LC0:
	.string	"before"
	.align	3
.LC1:
	.string	"during"
	.align	3
.LC2:
	.string	"after"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -16]!
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	mov	x29, sp
	bl	puts
// 3 "programs/45_misaligned_sp.c" 1
	sub sp, sp, #8
// 0 "" 2
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	puts
// 3 "programs/45_misaligned_sp.c" 1
	add sp, sp, #8
// 0 "" 2
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	puts
	mov	w0, 0
	ldp	x29, x30, [sp], 16
	ret

