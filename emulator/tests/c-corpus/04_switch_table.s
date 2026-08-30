	.text
	.section .rodata
	.align	3
.LC1:
	.string	"zero"
	.align	3
.LC2:
	.string	"one"
	.align	3
.LC3:
	.string	"two"
	.align	3
.LC4:
	.string	"three"
	.align	3
.LC5:
	.string	"four"
	.align	3
.LC6:
	.string	"five"
	.align	3
.LC7:
	.string	"six"
	.align	3
.LC8:
	.string	"seven"
	.align	3
.LC9:
	.string	"many"
	.text
	.align	2
	.global	dense
dense:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	cmp	w0, 7
	beq	.L2
	ldr	w0, [sp, 12]
	cmp	w0, 7
	bgt	.L3
	ldr	w0, [sp, 12]
	cmp	w0, 6
	beq	.L4
	ldr	w0, [sp, 12]
	cmp	w0, 6
	bgt	.L3
	ldr	w0, [sp, 12]
	cmp	w0, 5
	beq	.L5
	ldr	w0, [sp, 12]
	cmp	w0, 5
	bgt	.L3
	ldr	w0, [sp, 12]
	cmp	w0, 4
	beq	.L6
	ldr	w0, [sp, 12]
	cmp	w0, 4
	bgt	.L3
	ldr	w0, [sp, 12]
	cmp	w0, 3
	beq	.L7
	ldr	w0, [sp, 12]
	cmp	w0, 3
	bgt	.L3
	ldr	w0, [sp, 12]
	cmp	w0, 2
	beq	.L8
	ldr	w0, [sp, 12]
	cmp	w0, 2
	bgt	.L3
	ldr	w0, [sp, 12]
	cmp	w0, 0
	beq	.L9
	ldr	w0, [sp, 12]
	cmp	w0, 1
	beq	.L10
	b	.L3
.L9:
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	b	.L11
.L10:
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	b	.L11
.L8:
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	b	.L11
.L7:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	b	.L11
.L6:
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	b	.L11
.L5:
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	b	.L11
.L4:
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	b	.L11
.L2:
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	b	.L11
.L3:
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
.L11:
	add	sp, sp, 16
	ret
	.align	2
	.global	sparse
sparse:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w1, [sp, 12]
	mov	w0, 5000
	cmp	w1, w0
	beq	.L13
	ldr	w1, [sp, 12]
	mov	w0, 5000
	cmp	w1, w0
	bgt	.L14
	ldr	w0, [sp, 12]
	cmp	w0, 1000
	beq	.L15
	ldr	w0, [sp, 12]
	cmp	w0, 1000
	bgt	.L14
	ldr	w0, [sp, 12]
	cmp	w0, 1
	beq	.L16
	ldr	w0, [sp, 12]
	cmp	w0, 100
	beq	.L17
	b	.L14
.L16:
	mov	w0, 10
	b	.L18
.L17:
	mov	w0, 20
	b	.L18
.L15:
	mov	w0, 30
	b	.L18
.L13:
	mov	w0, 40
	b	.L18
.L14:
	mov	w0, -1
.L18:
	add	sp, sp, 16
	ret
	.align	2
	.global	fall
fall:
	sub	sp, sp, #32
	str	w0, [sp, 12]
	str	wzr, [sp, 28]
	ldr	w0, [sp, 12]
	cmp	w0, 100
	beq	.L20
	ldr	w0, [sp, 12]
	cmp	w0, 100
	bgt	.L21
	ldr	w0, [sp, 12]
	cmp	w0, 99
	beq	.L22
	ldr	w0, [sp, 12]
	cmp	w0, 99
	bgt	.L21
	ldr	w0, [sp, 12]
	cmp	w0, 97
	beq	.L23
	ldr	w0, [sp, 12]
	cmp	w0, 98
	beq	.L24
	b	.L21
.L23:
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L24:
	ldr	w0, [sp, 28]
	add	w0, w0, 10
	str	w0, [sp, 28]
.L22:
	ldr	w0, [sp, 28]
	add	w0, w0, 100
	str	w0, [sp, 28]
	b	.L25
.L20:
	mov	w0, 7
	str	w0, [sp, 28]
	b	.L25
.L21:
	mov	w0, -1
	str	w0, [sp, 28]
.L25:
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.section .rodata
	.align	3
.LC10:
	.string	"%s "
	.align	3
.LC11:
	.string	"\n"
	.align	3
.LC12:
	.string	"%d "
	.align	3
.LC13:
	.string	"%d %d %d %d %d\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	mov	w0, -1
	str	w0, [sp, 76]
	b	.L28
.L29:
	ldr	w0, [sp, 76]
	bl	dense
	mov	x1, x0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L28:
	ldr	w0, [sp, 76]
	cmp	w0, 8
	ble	.L29
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 48
	ldp	x2, x3, [x1]
	ldr	w1, [x1, 16]
	stp	x2, x3, [x0]
	str	w1, [x0, 16]
	str	wzr, [sp, 72]
	b	.L30
.L31:
	ldrsw	x0, [sp, 72]
	lsl	x0, x0, 2
	add	x1, sp, 48
	ldr	w0, [x1, x0]
	bl	sparse
	mov	w1, w0
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	ldr	w0, [sp, 72]
	add	w0, w0, 1
	str	w0, [sp, 72]
.L30:
	ldr	w0, [sp, 72]
	cmp	w0, 4
	ble	.L31
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	mov	w0, 97
	bl	fall
	mov	w19, w0
	mov	w0, 98
	bl	fall
	mov	w20, w0
	mov	w0, 99
	bl	fall
	mov	w21, w0
	mov	w0, 100
	bl	fall
	mov	w22, w0
	mov	w0, 122
	bl	fall
	mov	w5, w0
	mov	w4, w22
	mov	w3, w21
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 80
	ret
	.section .rodata
	.align	3
.LC0:
	.word	1
	.word	100
	.word	1000
	.word	5000
	.word	3
	.text

