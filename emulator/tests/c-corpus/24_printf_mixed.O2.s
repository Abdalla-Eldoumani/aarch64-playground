	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%d %f %d %f %d %f %d %f %d %f %d %f\n"
	.align	3
.LC1:
	.string	"%d %d %d %d %d %d %d %d %d %d %d %d\n"
	.align	3
.LC6:
	.string	"%f %f %f %f %f %f %f %f %f %f\n"
	.align	3
.LC8:
	.string	"str"
	.align	3
.LC9:
	.string	"%s %c %d %ld %x %u %%\n"
	.align	3
.LC10:
	.string	"%5d|%-5d|%05d|%+d|% d\n"
	.align	3
.LC11:
	.string	"%p\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #64
	fmov	d5, 6.5e+0
	fmov	d4, 5.5e+0
	fmov	d3, 4.5e+0
	fmov	d2, 3.5e+0
	fmov	d1, 2.5e+0
	fmov	d0, 1.5e+0
	stp	x29, x30, [sp, 48]
	mov	w6, 6
	add	x29, sp, 48
	mov	w5, 5
	mov	w4, 4
	mov	w3, 3
	mov	w2, 2
	mov	w1, 1
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w0, 12
	str	w0, [sp, 32]
	mov	w0, 11
	str	w0, [sp, 24]
	mov	w0, 10
	str	w0, [sp, 16]
	mov	w0, 9
	str	w0, [sp, 8]
	mov	w0, 8
	str	w0, [sp]
	mov	w7, 7
	mov	w6, 6
	mov	w5, 5
	mov	w4, 4
	mov	w3, 3
	mov	w2, 2
	mov	w1, 1
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	adrp	x1, .LANCHOR0
	add	x0, x1, :lo12:.LANCHOR0
	mov	x4, 7378697629483820646
	mov	x3, 3689348814741910323
	ldr	d7, [x1, :lo12:.LANCHOR0]
	mov	x2, 3689348814741910323
	ldp	d0, d31, [x0, 24]
	fmov	d30, 1.0e+0
	ldp	d3, d1, [x0, 8]
	fmov	d4, 5.0e-1
	movk	x4, 0x3fe6, lsl 48
	movk	x3, 0x3fe3, lsl 48
	fmov	d6, x4
	fmov	d5, x3
	movk	x2, 0x3fd3, lsl 48
	fmov	d2, x2
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	stp	d31, d30, [sp]
	bl	printf
	mov	x4, 58367
	movk	x4, 0x540b, lsl 16
	mov	w6, -1
	mov	w5, 255
	movk	x4, 0x2, lsl 32
	mov	w3, -42
	mov	w2, 99
	adrp	x1, .LC8
	adrp	x0, .LC9
	add	x1, x1, :lo12:.LC8
	add	x0, x0, :lo12:.LC9
	bl	printf
	mov	w5, 42
	mov	w4, w5
	mov	w3, w5
	mov	w2, w5
	mov	w1, w5
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	mov	x1, 0
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	ldp	x29, x30, [sp, 48]
	mov	w0, 0
	add	sp, sp, 64
	ret
	.section .rodata
	.align	3
	.LANCHOR0:
.LC2:
	.word	-1717986918
	.word	1072273817
.LC3:
	.word	-1717986918
	.word	1071225241
.LC4:
	.word	-1717986918
	.word	1070176665
.LC5:
	.word	-1717986918
	.word	1069128089
.LC7:
	.word	-858993459
	.word	1072483532

