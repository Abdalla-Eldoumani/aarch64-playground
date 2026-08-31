	.text
	.align	2
	.align 5
	.global	next_id
next_id:
	adrp	x1, .LANCHOR0
	ldr	w0, [x1, :lo12:.LANCHOR0]
	add	w2, w0, 1
	str	w2, [x1, :lo12:.LANCHOR0]
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%d %ld %d %d\n"
	.align	3
.LC1:
	.string	"%s %s\n"
	.align	3
.LC2:
	.string	"%s %d %d %d %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	adrp	x3, .LANCHOR1
	add	x3, x3, :lo12:.LANCHOR1
	mov	x29, sp
	mov	x0, 0
	stp	x19, x20, [sp, 16]
	.align 5
.L7:
	tbnz	x0, 0, .L4
.L11:
	str	w0, [x3, x0, lsl 2]
	add	x0, x0, 1
	tbz	x0, 0, .L11
.L4:
	str	wzr, [x3, x0, lsl 2]
	add	x0, x0, 1
	cmp	x0, 16
	bne	.L7
	ldr	x2, [x3, 64]
	mov	x0, x3
	add	x4, x3, 64
	.align 5
.L8:
	ldrsw	x1, [x0], 4
	add	x2, x2, x1
	cmp	x4, x0
	bne	.L8
	adrp	x19, .LANCHOR0
	add	x19, x19, :lo12:.LANCHOR0
	mov	w4, 10
	str	x2, [x3, 64]
	mov	w3, 49
	adrp	x0, .LC0
	ldr	w1, [x19, 4]
	add	x0, x0, :lo12:.LC0
	bl	printf
	add	x2, x19, 8
	adrp	x1, .LANCHOR2
	adrp	x0, .LC1
	add	x1, x1, :lo12:.LANCHOR2
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w6, [x19, 4]
	mov	w0, 120
	strb	w0, [x19, 8]
	add	w6, w6, w6, lsl 1
	str	w6, [x19, 4]
	bl	next_id
	mov	w3, w0
	bl	next_id
	mov	w4, w0
	bl	next_id
	mov	w5, w0
	add	x1, x19, 8
	mov	w2, w6
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
	.global	name
	.global	greeting
	.global	zeros
	.global	counter
	.section .rodata
	.align	3
	.LANCHOR2:
greeting:
	.string	"hi from rodata"
	.data
	.align	3
	.LANCHOR0:
id__0:
	.word	100
counter:
	.word	5
name:
	.string	"abc"
	.zero	4
	.bss
	.align	3
	.LANCHOR1:
zeros:
	.zero	64
acc:
	.zero	8

