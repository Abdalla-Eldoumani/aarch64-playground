	.text
	.global	zeroed
	.bss
	.align	3
zeroed:
	.zero	40
	.global	rc
	.section .rodata
	.align	2
rc:
	.word	7
	.global	lit
	.align	3
.LC0:
	.string	"same"
	.data
	.align	3
lit:
	.quad	.LC0
	.section .rodata
	.align	3
arr:
	.string	"rodata"
	.align	3
.LC1:
	.string	"%d %ld %d %s %s %d\n"
	.align	3
.LC2:
	.string	"%d %d\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	str	x0, [sp, 24]
	adrp	x0, zeroed
	add	x0, x0, :lo12:zeroed
	ldr	w7, [x0, 36]
	adrp	x0, szero
	add	x0, x0, :lo12:szero
	ldr	x2, [x0]
	mov	w3, 7
	adrp	x0, lit
	add	x0, x0, :lo12:lit
	ldr	x4, [x0]
	adrp	x0, lit
	add	x0, x0, :lo12:lit
	ldr	x0, [x0]
	ldr	x1, [sp, 24]
	cmp	x1, x0
	cset	w0, eq
	and	w0, w0, 255
	mov	w6, w0
	adrp	x0, arr
	add	x5, x0, :lo12:arr
	mov	w1, w7
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	adrp	x0, zeroed
	add	x0, x0, :lo12:zeroed
	mov	w1, 4
	str	w1, [x0, 12]
	adrp	x0, zeroed
	add	x0, x0, :lo12:zeroed
	ldr	w1, [x0, 12]
	adrp	x0, zeroed
	add	x0, x0, :lo12:zeroed
	ldr	w0, [x0, 16]
	mov	w2, w0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret


	.bss
	.balign 8
szero:
	.skip 8
