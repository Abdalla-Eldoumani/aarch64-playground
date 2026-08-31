	.text
	.align	2
	.align 5
	.global	fsum
fsum:
	cmp	w1, 0
	ble	.L4
	movi	v0.2s, #0
	add	x1, x0, w1, uxtw 2
	.align 5
.L3:
	ldr	s31, [x0], 4
	fadd	s0, s0, s31
	cmp	x0, x1
	bne	.L3
	ret
	.align 2
.L4:
	movi	v0.2s, #0
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"%f %.8f\n"
	.align	3
.LC4:
	.string	"%.10f %.10f\n"
	.align	3
.LC5:
	.string	"%.1f %.1f\n"
	.align	3
.LC7:
	.string	"%d %.1f\n"
	.align	3
.LC8:
	.string	"%.2f %.2f %.2f %.2f %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -64]!
	adrp	x0, .LANCHOR0
	mov	w1, 5
	mov	x29, sp
	ldr	q31, [x0, :lo12:.LANCHOR0]
	str	x19, [sp, 16]
	add	x19, x0, :lo12:.LANCHOR0
	mov	w0, 14269
	movk	w0, 0x3586, lsl 16
	str	w0, [sp, 48]
	add	x0, sp, 32
	str	q31, [sp, 32]
	bl	fsum
	fcvt	d1, s0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	fmov	d0, d1
	bl	printf
	ldr	d0, [x19, 16]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	fmov	d1, d0
	bl	printf
	mov	x1, 536870912
	mov	x0, 4715268809856909312
	movk	x1, 0x4170, lsl 48
	fmov	d0, x0
	fmov	d1, x1
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	d0, [x19, 24]
	mov	w1, 7
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	fmov	d3, 2.75e+0
	fmov	d2, 1.1e+1
	fmov	d1, 3.5e+0
	fmov	d0, 7.5e+0
	mov	w1, 1
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldr	x19, [sp, 16]
	mov	w0, 0
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	4
	.LANCHOR0:
.LC1:
	.word	1036831949
	.word	1045220557
	.word	1050253722
	.word	1232348160
.LC3:
	.word	1610612736
	.word	1070945621
.LC6:
	.word	-1073741824
	.word	1097305129

