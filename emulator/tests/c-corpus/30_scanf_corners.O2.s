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
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -96]!
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	mov	x29, sp
	add	x2, sp, 48
	add	x1, sp, 44
	stp	x19, x20, [sp, 16]
	bl scanf
	ldp	w2, w3, [sp, 44]
	mov	w1, w0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	adrp	x20, .LC5
	adrp	x19, .LC12
	bl	printf
	add	x1, sp, 43
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl scanf
	ldrb	w2, [sp, 43]
	mov	w1, w0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	add	x1, sp, 64
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl scanf
	add	x2, sp, 64
	mov	w1, w0
	add	x0, x20, :lo12:.LC5
	bl	printf
	add	x1, sp, 52
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl scanf
	ldr	w2, [sp, 52]
	mov	w1, w0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	add	x1, sp, 56
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl scanf
	ldr	x2, [sp, 56]
	mov	w1, w0
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	add	x1, sp, 44
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl scanf
	ldr	w2, [sp, 44]
	mov	w1, w0
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	add	x1, sp, 44
	add	x0, x19, :lo12:.LC12
	bl scanf
	mov	w1, w0
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	add	x1, sp, 64
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl scanf
	add	x2, sp, 64
	mov	w1, w0
	add	x0, x20, :lo12:.LC5
	bl	printf
	add	x1, sp, 44
	add	x0, x19, :lo12:.LC12
	bl scanf
	mov	w1, w0
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 96
	ret

