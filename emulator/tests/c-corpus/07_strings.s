	.text
	.align	2
	.global	rev
rev:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	bl	strlen
	str	w0, [sp, 36]
	str	wzr, [sp, 44]
	ldr	w0, [sp, 36]
	sub	w0, w0, #1
	str	w0, [sp, 40]
	b	.L2
.L3:
	ldrsw	x0, [sp, 44]
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	ldrb	w0, [x0]
	strb	w0, [sp, 35]
	ldrsw	x0, [sp, 40]
	ldr	x1, [sp, 24]
	add	x1, x1, x0
	ldrsw	x0, [sp, 44]
	ldr	x2, [sp, 24]
	add	x0, x2, x0
	ldrb	w1, [x1]
	strb	w1, [x0]
	ldrsw	x0, [sp, 40]
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	ldrb	w1, [sp, 35]
	strb	w1, [x0]
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
	ldr	w0, [sp, 40]
	sub	w0, w0, #1
	str	w0, [sp, 40]
.L2:
	ldr	w1, [sp, 44]
	ldr	w0, [sp, 40]
	cmp	w1, w0
	blt	.L3
	nop
	nop
	ldp	x29, x30, [sp], 48
	ret
	.align	2
	.global	pal
pal:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	bl	strlen
	str	w0, [sp, 40]
	str	wzr, [sp, 44]
	b	.L5
.L8:
	ldrsw	x0, [sp, 44]
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	ldrb	w1, [x0]
	ldr	w0, [sp, 40]
	sub	w2, w0, #1
	ldr	w0, [sp, 44]
	sub	w0, w2, w0
	sxtw	x0, w0
	ldr	x2, [sp, 24]
	add	x0, x2, x0
	ldrb	w0, [x0]
	cmp	w1, w0
	beq	.L6
	mov	w0, 0
	b	.L7
.L6:
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L5:
	ldr	w0, [sp, 40]
	lsr	w1, w0, 31
	add	w0, w1, w0
	asr	w0, w0, 1
	mov	w1, w0
	ldr	w0, [sp, 44]
	cmp	w0, w1
	blt	.L8
	mov	w0, 1
.L7:
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"playground"
	.align	3
.LC1:
	.string	"%s %d\n"
	.align	3
.LC2:
	.string	"%s\n"
	.align	3
.LC3:
	.string	"racecar"
	.align	3
.LC4:
	.string	"arm64"
	.align	3
.LC5:
	.string	""
	.align	3
.LC6:
	.string	"%d %d %d\n"
	.align	3
.LC7:
	.string	"abd"
	.align	3
.LC8:
	.string	"abc"
	.align	3
.LC9:
	.string	"a"
	.align	3
.LC10:
	.string	"b"
	.align	3
.LC11:
	.string	"Hello, World"
	.align	3
.LC12:
	.string	"the quick brown fox"
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
	.global	main
main:
	stp	x29, x30, [sp, -112]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	add	x2, sp, 64
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	mov	x0, x2
	bl	strcpy
	add	x0, sp, 64
	bl	strlen
	mov	w1, w0
	add	x0, sp, 64
	mov	w2, w1
	mov	x1, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	add	x0, sp, 64
	bl	rev
	add	x0, sp, 64
	mov	x1, x0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	pal
	mov	w19, w0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	pal
	mov	w20, w0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	pal
	mov	w3, w0
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	adrp	x0, .LC7
	add	x1, x0, :lo12:.LC7
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	strcmp
	lsr	w0, w0, 31
	and	w0, w0, 255
	mov	w19, w0
	adrp	x0, .LC8
	add	x1, x0, :lo12:.LC8
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	strcmp
	mov	w20, w0
	adrp	x0, .LC9
	add	x1, x0, :lo12:.LC9
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	strcmp
	cmp	w0, 0
	cset	w0, gt
	and	w0, w0, 255
	mov	w3, w0
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	add	x2, sp, 32
	adrp	x0, .LC11
	add	x1, x0, :lo12:.LC11
	mov	x0, x2
	bl	strcpy
	str	wzr, [sp, 108]
	b	.L10
.L12:
	ldrsw	x0, [sp, 108]
	add	x1, sp, 32
	ldrb	w0, [x1, x0]
	cmp	w0, 96
	bls	.L11
	ldrsw	x0, [sp, 108]
	add	x1, sp, 32
	ldrb	w0, [x1, x0]
	cmp	w0, 122
	bhi	.L11
	ldrsw	x0, [sp, 108]
	add	x1, sp, 32
	ldrb	w0, [x1, x0]
	sub	w0, w0, #32
	and	w2, w0, 255
	ldrsw	x0, [sp, 108]
	add	x1, sp, 32
	strb	w2, [x1, x0]
.L11:
	ldr	w0, [sp, 108]
	add	w0, w0, 1
	str	w0, [sp, 108]
.L10:
	ldrsw	x0, [sp, 108]
	add	x1, sp, 32
	ldrb	w0, [x1, x0]
	cmp	w0, 0
	bne	.L12
	add	x0, sp, 32
	mov	x1, x0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	str	wzr, [sp, 104]
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	str	x0, [sp, 96]
	b	.L13
.L16:
	ldr	x0, [sp, 96]
	ldrb	w0, [x0]
	cmp	w0, 97
	beq	.L14
	ldr	x0, [sp, 96]
	ldrb	w0, [x0]
	cmp	w0, 101
	beq	.L14
	ldr	x0, [sp, 96]
	ldrb	w0, [x0]
	cmp	w0, 105
	beq	.L14
	ldr	x0, [sp, 96]
	ldrb	w0, [x0]
	cmp	w0, 111
	beq	.L14
	ldr	x0, [sp, 96]
	ldrb	w0, [x0]
	cmp	w0, 117
	bne	.L15
.L14:
	ldr	w0, [sp, 104]
	add	w0, w0, 1
	str	w0, [sp, 104]
.L15:
	ldr	x0, [sp, 96]
	add	x0, x0, 1
	str	x0, [sp, 96]
.L13:
	ldr	x0, [sp, 96]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L16
	ldr	w1, [sp, 104]
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	mov	w4, 107
	mov	w3, 111
	adrp	x0, .LC14
	add	x2, x0, :lo12:.LC14
	adrp	x0, .LC15
	add	x1, x0, :lo12:.LC15
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 112
	ret

