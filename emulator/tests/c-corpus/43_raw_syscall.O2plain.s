	.text
	.align	2
	.p2align 5,,15
	.global	sys3
sys3:
	mov	x8, x0
	mov	x0, x1
	mov	x1, x2
	mov	x2, x3
// 2 "programs/43_raw_syscall.c" 1
	svc 0
// 0 "" 2
	ret
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	sub	sp, sp, #32
	mov	x8, 64
	mov	x2, 10
	ldr	x1, [x0]
	str	x1, [sp, 16]
	ldr	w0, [x0, 7]
	add	x1, sp, 16
	str	w0, [sp, 23]
	mov	x0, 1
// 2 "programs/43_raw_syscall.c" 1
	svc 0
// 0 "" 2
	add	w0, w0, 48
	add	x1, sp, 8
	strb	w0, [sp, 8]
	mov	x0, 1
	strb	w2, [sp, 9]
	mov	x2, 2
// 2 "programs/43_raw_syscall.c" 1
	svc 0
// 0 "" 2
	mov	x8, 93
	mov	x0, 7
	mov	x1, 0
	mov	x2, 0
// 2 "programs/43_raw_syscall.c" 1
	svc 0
// 0 "" 2
	mov	w0, 1
	add	sp, sp, 32
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"raw write\n"
	.text

