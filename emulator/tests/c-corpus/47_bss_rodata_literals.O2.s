	.text
	.section .rodata
	.align	3
.LC0:
	.string	"same"
	.align	3
.LC1:
	.string	"%d %ld %d %s %s %d\n"
	.align	3
.LC2:
	.string	"%d %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	adrp	x0, .LANCHOR0
	mov	w3, 7
	mov	x29, sp
	mov	x2, 0
	str	x19, [sp, 16]
	adrp	x19, .LANCHOR2
	add	x19, x19, :lo12:.LANCHOR2
	adrp	x5, .LANCHOR1
	ldr	x4, [x0, :lo12:.LANCHOR0]
	adrp	x0, .LC0
	ldr	w1, [x19, 36]
	add	x0, x0, :lo12:.LC0
	cmp	x4, x0
	add	x5, x5, :lo12:.LANCHOR1
	cset	w6, eq
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w2, [x19, 16]
	mov	w1, 4
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	str	w1, [x19, 12]
	bl	printf
	ldr	x19, [sp, 16]
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret
	.global	lit
	.global	rc
	.global	zeroed
	.section .rodata
	.align	3
	.LANCHOR1:
arr:
	.string	"rodata"
	.zero	1
rc:
	.word	7
	.data
	.align	3
	.LANCHOR0:
lit:
	.quad	.LC0
	.bss
	.align	3
	.LANCHOR2:
zeroed:
	.zero	40

