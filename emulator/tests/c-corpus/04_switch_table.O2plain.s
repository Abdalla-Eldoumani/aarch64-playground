	.text
	.section .rodata
	.align	3
.LC1:
	.string	"many"
	.text
	.align	2
	.p2align 5,,15
	.global	dense
dense:
	cmp	w0, 7
	bhi	.L3
	adrp	x1, .LANCHOR0
	add	x1, x1, :lo12:.LANCHOR0
	ldr	x0, [x1, w0, uxtw 3]
	ret
	.p2align 2,,3
.L3:
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	ret
	.align	2
	.p2align 5,,15
	.global	sparse
sparse:
	mov	w1, w0
	cmp	w0, 1000
	beq	.L8
	bgt	.L7
	mov	w0, 10
	cmp	w1, 1
	beq	.L5
	cmp	w1, 100
	mov	w0, 20
	csinv	w0, w0, wzr, eq
.L5:
	ret
	.p2align 2,,3
.L7:
	mov	w0, 5000
	cmp	w1, w0
	mov	w0, 40
	csinv	w0, w0, wzr, eq
	ret
	.p2align 2,,3
.L8:
	mov	w0, 30
	ret
	.align	2
	.p2align 5,,15
	.global	fall
fall:
	mov	w1, w0
	cmp	w0, 99
	beq	.L16
	bgt	.L15
	mov	w0, 111
	cmp	w1, 97
	beq	.L13
	cmp	w1, 98
	mov	w0, 110
	csinv	w0, w0, wzr, eq
.L13:
	ret
	.p2align 2,,3
.L15:
	cmp	w0, 100
	mov	w0, 7
	csinv	w0, w0, wzr, eq
	ret
	.p2align 2,,3
.L16:
	mov	w0, 100
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"%s "
	.align	3
.LC3:
	.string	"%d "
	.align	3
.LC4:
	.string	"%d %d %d %d %d\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	stp	x21, x22, [sp, 32]
	adrp	x22, .LANCHOR0
	add	x22, x22, :lo12:.LANCHOR0
	stp	x19, x20, [sp, 16]
	mov	w19, 0
	adrp	x21, .LC1
	adrp	x20, .LC2
	add	x21, x21, :lo12:.LC1
	add	x20, x20, :lo12:.LC2
	mov	x1, x21
	mov	x0, x20
	bl	printf
	.p2align 5,,15
.L22:
	cmp	w19, 8
	bne	.L23
	mov	x1, x21
	mov	x0, x20
	bl	printf
	adrp	x20, .LC3
	mov	w0, 10
	add	x19, sp, 56
	bl	putchar
	add	x21, sp, 76
	mov	x0, 1
	add	x20, x20, :lo12:.LC3
	movk	x0, 0x64, lsl 32
	str	x0, [sp, 56]
	mov	x0, 1000
	movk	x0, 0x1388, lsl 32
	str	x0, [sp, 64]
	mov	w0, 3
	str	w0, [sp, 72]
.L26:
	ldr	w0, [x19]
	cmp	w0, 1000
	beq	.L27
	bgt	.L25
	mov	w1, 10
	cmp	w0, 1
	beq	.L24
	cmp	w0, 100
	mov	w1, 20
	csinv	w1, w1, wzr, eq
.L24:
	mov	x0, x20
	add	x19, x19, 4
	bl	printf
	cmp	x19, x21
	bne	.L26
	mov	w0, 10
	bl	putchar
	mov	w5, -1
	mov	w4, 7
	mov	w3, 100
	mov	w2, 110
	mov	w1, 111
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 80
	ret
	.p2align 2,,3
.L23:
	ldr	x1, [x22, w19, uxtw 3]
	mov	x0, x20
	add	w19, w19, 1
	bl	printf
	b	.L22
	.p2align 2,,3
.L25:
	mov	w1, 5000
	cmp	w0, w1
	mov	w1, 40
	csinv	w1, w1, wzr, eq
	b	.L24
	.p2align 2,,3
.L27:
	mov	w1, 30
	b	.L24
	.section .rodata
	.align	3
.LC5:
	.string	"zero"
	.align	3
.LC6:
	.string	"one"
	.align	3
.LC7:
	.string	"two"
	.align	3
.LC8:
	.string	"three"
	.align	3
.LC9:
	.string	"four"
	.align	3
.LC10:
	.string	"five"
	.align	3
.LC11:
	.string	"six"
	.align	3
.LC12:
	.string	"seven"
	.section .rodata
	.align	3
	.LANCHOR0:
CSWTCH.1:
	.xword	.LC5
	.xword	.LC6
	.xword	.LC7
	.xword	.LC8
	.xword	.LC9
	.xword	.LC10
	.xword	.LC11
	.xword	.LC12

