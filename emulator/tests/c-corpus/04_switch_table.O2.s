	.text
	.section .rodata
	.align	3
.LC1:
	.string	"many"
	.text
	.align	2
	.align 5
	.global	dense
dense:
	cmp	w0, 7
	bhi	.L3
	adrp	x1, .LANCHOR0
	add	x1, x1, :lo12:.LANCHOR0
	ldr	x0, [x1, w0, uxtw 3]
	ret
	.align 2
.L3:
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	ret
	.align	2
	.align 5
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
	.align 2
.L7:
	mov	w0, 5000
	cmp	w1, w0
	mov	w0, 40
	csinv	w0, w0, wzr, eq
	ret
	.align 2
.L8:
	mov	w0, 30
	ret
	.align	2
	.align 5
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
	.align 2
.L15:
	cmp	w0, 100
	mov	w0, 7
	csinv	w0, w0, wzr, eq
	ret
	.align 2
.L16:
	mov	w0, 100
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"%s "
	.align	3
.LC3:
	.string	"\n"
	.align	3
.LC4:
	.string	"%d "
	.align	3
.LC5:
	.string	"%d %d %d %d %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LC2
	add	x20, x20, :lo12:.LC2
	mov	w19, -1
	stp	x21, x22, [sp, 32]
	.align 5
.L22:
	mov	w0, w19
	bl	dense
	add	w19, w19, 1
	mov	x1, x0
	mov	x0, x20
	bl	printf
	cmp	w19, 9
	bne	.L22
	adrp	x22, .LC3
	add	x22, x22, :lo12:.LC3
	mov	x0, x22
	bl	printf
	mov	x0, 1
	adrp	x20, .LC4
	movk	x0, 0x64, lsl 32
	str	x0, [sp, 56]
	mov	x0, 1000
	add	x19, sp, 56
	movk	x0, 0x1388, lsl 32
	add	x21, sp, 76
	add	x20, x20, :lo12:.LC4
	str	x0, [sp, 64]
	mov	w0, 3
	str	w0, [sp, 72]
.L23:
	ldr	w0, [x19], 4
	bl	sparse
	mov	w1, w0
	mov	x0, x20
	bl	printf
	cmp	x19, x21
	bne	.L23
	mov	x0, x22
	bl	printf
	mov	w0, 97
	bl	fall
	mov	w6, w0
	mov	w0, 98
	bl	fall
	mov	w2, w0
	mov	w0, 99
	bl	fall
	mov	w3, w0
	mov	w0, 100
	bl	fall
	mov	w4, w0
	mov	w0, 122
	bl	fall
	mov	w1, w6
	mov	w5, w0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 80
	ret
	.section .rodata
	.align	3
.LC6:
	.string	"zero"
	.align	3
.LC7:
	.string	"one"
	.align	3
.LC8:
	.string	"two"
	.align	3
.LC9:
	.string	"three"
	.align	3
.LC10:
	.string	"four"
	.align	3
.LC11:
	.string	"five"
	.align	3
.LC12:
	.string	"six"
	.align	3
.LC13:
	.string	"seven"
	.section .rodata
	.align	3
	.LANCHOR0:
CSWTCH__1:
	.quad	.LC6
	.quad	.LC7
	.quad	.LC8
	.quad	.LC9
	.quad	.LC10
	.quad	.LC11
	.quad	.LC12
	.quad	.LC13

