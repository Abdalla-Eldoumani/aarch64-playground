	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%d%d"
	.align	3
.LC1:
	.string	"r=%d a=%d b=%d\n"
	.align	3
.LC2:
	.string	" %c"
	.align	3
.LC3:
	.string	"r=%d c=%c\n"
	.align	3
.LC4:
	.string	"%31s"
	.align	3
.LC5:
	.string	"r=%d w=%s\n"
	.align	3
.LC6:
	.string	"%x"
	.align	3
.LC7:
	.string	"r=%d x=%u\n"
	.align	3
.LC8:
	.string	"%ld"
	.align	3
.LC9:
	.string	"r=%d L=%ld\n"
	.align	3
.LC10:
	.string	"%3d"
	.align	3
.LC11:
	.string	"r=%d a=%d\n"
	.align	3
.LC12:
	.string	"%d"
	.align	3
.LC13:
	.string	"r=%d (expect 0, junk)\n"
	.align	3
.LC14:
	.string	"%s"
	.align	3
.LC15:
	.string	"r=%d (expect -1 EOF)\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	add	x1, sp, 68
	add	x0, sp, 72
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl scanf
	str	w0, [sp, 76]
	ldr	w0, [sp, 72]
	ldr	w1, [sp, 68]
	mov	w3, w1
	mov	w2, w0
	ldr	w1, [sp, 76]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	add	x0, sp, 67
	mov	x1, x0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl scanf
	str	w0, [sp, 76]
	ldrb	w0, [sp, 67]
	mov	w2, w0
	ldr	w1, [sp, 76]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	add	x0, sp, 32
	mov	x1, x0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl scanf
	str	w0, [sp, 76]
	add	x0, sp, 32
	mov	x2, x0
	ldr	w1, [sp, 76]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	add	x0, sp, 28
	mov	x1, x0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl scanf
	str	w0, [sp, 76]
	ldr	w0, [sp, 28]
	mov	w2, w0
	ldr	w1, [sp, 76]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	add	x0, sp, 16
	mov	x1, x0
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl scanf
	str	w0, [sp, 76]
	ldr	x0, [sp, 16]
	mov	x2, x0
	ldr	w1, [sp, 76]
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	add	x0, sp, 72
	mov	x1, x0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl scanf
	str	w0, [sp, 76]
	ldr	w0, [sp, 72]
	mov	w2, w0
	ldr	w1, [sp, 76]
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	add	x0, sp, 72
	mov	x1, x0
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl scanf
	str	w0, [sp, 76]
	ldr	w1, [sp, 76]
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	add	x0, sp, 32
	mov	x1, x0
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl scanf
	str	w0, [sp, 76]
	add	x0, sp, 32
	mov	x2, x0
	ldr	w1, [sp, 76]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	add	x0, sp, 72
	mov	x1, x0
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl scanf
	str	w0, [sp, 76]
	ldr	w1, [sp, 76]
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 80
	ret

