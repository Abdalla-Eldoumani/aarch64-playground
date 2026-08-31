	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%d %f %d %f %d %f %d %f %d %f %d %f\n"
	.align	3
.LC1:
	.string	"%d %d %d %d %d %d %d %d %d %d %d %d\n"
	.align	3
.LC2:
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
	.global	main
main:
	sub	sp, sp, #64
	stp	x29, x30, [sp, 48]
	add	x29, sp, 48
	fmov	d5, 6.5e+0
	mov	w6, 6
	fmov	d4, 5.5e+0
	mov	w5, 5
	fmov	d3, 4.5e+0
	mov	w4, 4
	fmov	d2, 3.5e+0
	mov	w3, 3
	fmov	d1, 2.5e+0
	mov	w2, 2
	fmov	d0, 1.5e+0
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
	fmov	d31, 1.0e+0
	str	d31, [sp, 8]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	ldr	d31, [x0]
	str	d31, [sp]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	ldr	d7, [x0]
	mov	x0, 7378697629483820646
	movk	x0, 0x3fe6, lsl 48
	fmov	d6, x0
	mov	x0, 3689348814741910323
	movk	x0, 0x3fe3, lsl 48
	fmov	d5, x0
	fmov	d4, 5.0e-1
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	ldr	d3, [x0]
	mov	x0, 3689348814741910323
	movk	x0, 0x3fd3, lsl 48
	fmov	d2, x0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	ldr	d1, [x0]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	ldr	d0, [x0]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w6, -1
	mov	w5, 255
	mov	x4, 58367
	movk	x4, 0x540b, lsl 16
	movk	x4, 0x2, lsl 32
	mov	w3, -42
	mov	w2, 99
	adrp	x0, .LC8
	add	x1, x0, :lo12:.LC8
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	mov	w5, 42
	mov	w4, 42
	mov	w3, 42
	mov	w2, 42
	mov	w1, 42
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	mov	x1, 0
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 48]
	add	sp, sp, 64
	ret
	.section .rodata
	.align	3
.LC3:
	.word	-858993459
	.word	1072483532
	.align	3
.LC4:
	.word	-1717986918
	.word	1072273817
	.align	3
.LC5:
	.word	-1717986918
	.word	1071225241
	.align	3
.LC6:
	.word	-1717986918
	.word	1070176665
	.align	3
.LC7:
	.word	-1717986918
	.word	1069128089

