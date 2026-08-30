	.text
	.section .rodata
	.align	3
.LC0:
	.string	"zero"
	.align	3
.LC1:
	.string	"one"
	.align	3
.LC2:
	.string	"two"
	.align	3
.LC3:
	.string	"three"
	.align	3
.LC4:
	.string	"four"
	.align	3
.LC5:
	.string	"five"
	.align	3
.LC6:
	.string	"six"
	.align	3
.LC7:
	.string	"seven"
	.align	3
.LC8:
	.string	"eight"
	.align	3
.LC9:
	.string	"nine"
	.align	3
.LC10:
	.string	"ten"
	.align	3
.LC11:
	.string	"eleven"
	.align	3
.LC12:
	.string	"many"
	.text
	.align	2
	.global	name
name:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	cmp	w0, 11
	beq	.L2
	ldr	w0, [sp, 12]
	cmp	w0, 11
	bgt	.L3
	ldr	w0, [sp, 12]
	cmp	w0, 10
	beq	.L4
	ldr	w0, [sp, 12]
	cmp	w0, 10
	bgt	.L3
	ldr	w0, [sp, 12]
	cmp	w0, 9
	beq	.L5
	ldr	w0, [sp, 12]
	cmp	w0, 9
	bgt	.L3
	ldr	w0, [sp, 12]
	cmp	w0, 8
	beq	.L6
	ldr	w0, [sp, 12]
	cmp	w0, 8
	bgt	.L3
	ldr	w0, [sp, 12]
	cmp	w0, 7
	beq	.L7
	ldr	w0, [sp, 12]
	cmp	w0, 7
	bgt	.L3
	ldr	w0, [sp, 12]
	cmp	w0, 6
	beq	.L8
	ldr	w0, [sp, 12]
	cmp	w0, 6
	bgt	.L3
	ldr	w0, [sp, 12]
	cmp	w0, 5
	beq	.L9
	ldr	w0, [sp, 12]
	cmp	w0, 5
	bgt	.L3
	ldr	w0, [sp, 12]
	cmp	w0, 4
	beq	.L10
	ldr	w0, [sp, 12]
	cmp	w0, 4
	bgt	.L3
	ldr	w0, [sp, 12]
	cmp	w0, 3
	beq	.L11
	ldr	w0, [sp, 12]
	cmp	w0, 3
	bgt	.L3
	ldr	w0, [sp, 12]
	cmp	w0, 2
	beq	.L12
	ldr	w0, [sp, 12]
	cmp	w0, 2
	bgt	.L3
	ldr	w0, [sp, 12]
	cmp	w0, 0
	beq	.L13
	ldr	w0, [sp, 12]
	cmp	w0, 1
	beq	.L14
	b	.L3
.L13:
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	b	.L15
.L14:
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	b	.L15
.L12:
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	b	.L15
.L11:
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	b	.L15
.L10:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	b	.L15
.L9:
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	b	.L15
.L8:
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	b	.L15
.L7:
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	b	.L15
.L6:
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	b	.L15
.L5:
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	b	.L15
.L4:
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	b	.L15
.L2:
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	b	.L15
.L3:
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
.L15:
	add	sp, sp, 16
	ret
	.section .rodata
	.align	3
.LC13:
	.string	"%d=%s "
	.align	3
.LC14:
	.string	"\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	mov	w0, -1
	str	w0, [sp, 28]
	b	.L17
.L18:
	ldr	w0, [sp, 28]
	bl	name
	mov	x2, x0
	ldr	w1, [sp, 28]
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L17:
	ldr	w0, [sp, 28]
	cmp	w0, 13
	ble	.L18
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret

