	.text
	.section .rodata
	.align	3
.LC0:
	.string	"many"
	.text
	.align	2
	.p2align 5,,15
	.global	name
name:
	cmp	w0, 11
	bhi	.L3
	adrp	x1, .LANCHOR0
	add	x1, x1, :lo12:.LANCHOR0
	ldr	x0, [x1, w0, uxtw 3]
	ret
	.p2align 2,,3
.L3:
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"%d=%s "
	.align	3
.LC2:
	.string	"\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LC1
	add	x20, x20, :lo12:.LC1
	mov	w19, -1
	.p2align 5,,15
.L6:
	mov	w0, w19
	bl	name
	mov	w1, w19
	mov	x2, x0
	add	w19, w19, 1
	mov	x0, x20
	bl	printf
	cmp	w19, 14
	bne	.L6
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
	.section .rodata
	.align	3
.LC3:
	.string	"zero"
	.align	3
.LC4:
	.string	"one"
	.align	3
.LC5:
	.string	"two"
	.align	3
.LC6:
	.string	"three"
	.align	3
.LC7:
	.string	"four"
	.align	3
.LC8:
	.string	"five"
	.align	3
.LC9:
	.string	"six"
	.align	3
.LC10:
	.string	"seven"
	.align	3
.LC11:
	.string	"eight"
	.align	3
.LC12:
	.string	"nine"
	.align	3
.LC13:
	.string	"ten"
	.align	3
.LC14:
	.string	"eleven"
	.section .rodata
	.align	3
	.LANCHOR0:
CSWTCH.1:
	.xword	.LC3
	.xword	.LC4
	.xword	.LC5
	.xword	.LC6
	.xword	.LC7
	.xword	.LC8
	.xword	.LC9
	.xword	.LC10
	.xword	.LC11
	.xword	.LC12
	.xword	.LC13
	.xword	.LC14

