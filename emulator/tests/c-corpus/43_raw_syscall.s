	.text
	.align	2
	.global	sys3
sys3:
	sub	sp, sp, #32
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	str	x2, [sp, 8]
	str	x3, [sp]
	ldr	x8, [sp, 24]
	ldr	x0, [sp, 16]
	ldr	x1, [sp, 8]
	ldr	x2, [sp]
// 1 "programs/43_raw_syscall.c" 1
	svc 0
// 0 "" 2
	add	sp, sp, 32
	ret
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 24
	ldr	x2, [x1]
	ldr	w1, [x1, 7]
	str	x2, [x0]
	str	w1, [x0, 7]
	add	x0, sp, 24
	mov	x3, 10
	mov	x2, x0
	mov	x1, 1
	mov	x0, 64
	bl	sys3
	str	x0, [sp, 40]
	ldr	x0, [sp, 40]
	and	w0, w0, 255
	add	w0, w0, 48
	and	w0, w0, 255
	strb	w0, [sp, 16]
	mov	w0, 10
	strb	w0, [sp, 17]
	add	x0, sp, 16
	mov	x3, 2
	mov	x2, x0
	mov	x1, 1
	mov	x0, 64
	bl	sys3
	mov	x3, 0
	mov	x2, 0
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

