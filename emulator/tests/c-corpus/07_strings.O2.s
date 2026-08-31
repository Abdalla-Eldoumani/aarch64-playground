	.text
	.align	2
	.align 5
	.global	rev
rev:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x19, [sp, 16]
	mov	x19, x0
	bl	strlen
	cmp	w0, 1
	ble	.L1
	sub	w1, w0, #1
	add	x3, x19, w0, sxtw
	mov	x2, 0
	sxtw	x1, w1
	sub	x3, x3, x1
	sub	x3, x3, #1
	.align 5
.L3:
	ldrb	w4, [x3, x1]
	ldrb	w0, [x19, x2]
	strb	w4, [x19, x2]
	add	x2, x2, 1
	strb	w0, [x3, x1]
	sub	x1, x1, #1
	cmp	w2, w1
	blt	.L3
.L1:
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
	.align	2
	.align 5
	.global	pal
pal:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x19, [sp, 16]
	mov	x19, x0
	bl	strlen
	add	x3, x19, w0, sxtw
	asr	w4, w0, 1
	sub	x3, x3, #1
	mov	x1, 0
	cmp	w0, 1
	bgt	.L10
	b	.L11
	.align 2
.L17:
	add	x1, x1, 1
	cmp	w4, w1
	ble	.L11
.L10:
	neg	x0, x1
	ldrb	w2, [x19, x1]
	ldrb	w0, [x3, x0]
	cmp	w2, w0
	beq	.L17
	ldr	x19, [sp, 16]
	mov	w0, 0
	ldp	x29, x30, [sp], 32
	ret
	.align 2
.L11:
	ldr	x19, [sp, 16]
	mov	w0, 1
	ldp	x29, x30, [sp], 32
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"the quick brown fox"
	.align	3
.LC1:
	.string	"playground"
	.align	3
.LC2:
	.string	"%s %d\n"
	.align	3
.LC3:
	.string	"%s\n"
	.align	3
.LC4:
	.string	"racecar"
	.align	3
.LC5:
	.string	"arm64"
	.align	3
.LC6:
	.string	""
	.align	3
.LC7:
	.string	"%d %d %d\n"
	.align	3
.LC8:
	.string	"abd"
	.align	3
.LC9:
	.string	"abc"
	.align	3
.LC10:
	.string	"a"
	.align	3
.LC11:
	.string	"b"
	.align	3
.LC12:
	.string	"Hello, World"
	.align	3
.LC13:
	.string	"%d\n"
	.align	3
.LC14:
	.string	"left"
	.align	3
.LC15:
	.string	"right"
	.align	3
.LC16:
	.string	"[%10s][%-10s][%c%c]\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -112]!
	adrp	x1, .LC1
	add	x1, x1, :lo12:.LC1
	mov	x29, sp
	add	x0, sp, 48
	stp	x19, x20, [sp, 16]
	adrp	x19, .LC3
	add	x19, x19, :lo12:.LC3
	stp	x21, x22, [sp, 32]
	bl	strcpy
	add	x0, sp, 48
	bl	strlen
	mov	w2, w0
	add	x1, sp, 48
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	add	x0, sp, 48
	adrp	x20, .LC7
	bl	rev
	add	x1, sp, 48
	mov	x0, x19
	bl	printf
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	pal
	mov	w21, w0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	pal
	mov	w22, w0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	pal
	mov	w3, w0
	mov	w2, w22
	mov	w1, w21
	add	x0, x20, :lo12:.LC7
	bl	printf
	adrp	x21, .LC9
	adrp	x1, .LC8
	add	x0, x21, :lo12:.LC9
	add	x1, x1, :lo12:.LC8
	bl	strcmp
	mov	w22, w0
	add	x1, x21, :lo12:.LC9
	mov	x0, x1
	bl	strcmp
	adrp	x1, .LC10
	mov	w21, w0
	add	x1, x1, :lo12:.LC10
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	strcmp
	cmp	w0, 0
	mov	w2, w21
	cset	w3, gt
	lsr	w1, w22, 31
	add	x0, x20, :lo12:.LC7
	bl	printf
	add	x0, sp, 80
	adrp	x1, .LC12
	add	x1, x1, :lo12:.LC12
	bl	strcpy
	ldrb	w0, [sp, 80]
	cbz	w0, .L19
	add	x2, sp, 80
	.align 5
.L21:
	sub	w1, w0, #97
	and	w1, w1, 255
	cmp	w1, 25
	bhi	.L20
	sub	w0, w0, #32
	strb	w0, [x2]
.L20:
	ldrb	w0, [x2, 1]!
	cbnz	w0, .L21
.L19:
	add	x1, sp, 80
	mov	x0, x19
	bl	printf
	adrp	x2, .LC0
	adrp	x3, .LC0+19
	mov	x4, 16657
	add	x2, x2, :lo12:.LC0
	add	x3, x3, :lo12:.LC0+19
	mov	w1, 0
	mov	w0, 116
	movk	x4, 0x10, lsl 16
	.align 5
.L23:
	sub	w0, w0, #97
	and	w0, w0, 255
	cmp	w0, 20
	lsr	x0, x4, x0
	and	w0, w0, 1
	add	w0, w1, w0
	csel	w1, w1, w0, hi
	ldrb	w0, [x2, 1]!
	cmp	x2, x3
	bne	.L23
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	mov	w4, 107
	mov	w3, 111
	adrp	x2, .LC14
	adrp	x1, .LC15
	add	x2, x2, :lo12:.LC14
	add	x1, x1, :lo12:.LC15
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 112
	ret

