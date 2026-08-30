	.text
	.align	2
	.align 5
	.global	sys3
sys3:
	mov	x8, x0
	mov	x0, x1
	mov	x1, x2
	mov	x2, x3
// 1 "programs/43_raw_syscall.c" 1
	svc 0
// 0 "" 2
	ret
	.text
	.align	2
	.align 5
	.global	main
main:
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	stp	x29, x30, [sp, -48]!
	mov	x3, 10
	mov	x29, sp
	add	x2, sp, 32
	ldr	x1, [x0]
	str	x1, [sp, 32]
	ldr	w0, [x0, 7]
	mov	x1, 1
	str	w0, [sp, 39]
	mov	x0, 64
	bl	sys3
	add	w0, w0, 48
	add	x2, sp, 24
	mov	x1, 1
	strb	w0, [sp, 24]
	mov	x0, 64
	strb	w3, [sp, 25]
	mov	x3, 2
	bl	sys3
	mov	x2, 0
	mov	x3, 0
	mov	x1, 7
	mov	x0, 93
	bl	sys3
	mov	w0, 1
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"raw write\n"
	.text

