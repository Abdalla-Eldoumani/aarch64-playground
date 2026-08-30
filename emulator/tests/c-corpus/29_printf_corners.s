	.text
	.section .rodata
	.align	3
.LC0:
	.string	"[%d][%5d][%-5d][%05d][%+d][% d]\n"
	.align	3
.LC1:
	.string	"[%u][%x][%X][%o][%#x][%#o]\n"
	.align	3
.LC2:
	.string	"[%ld][%lu][%lx][%lld][%llu]\n"
	.align	3
.LC3:
	.string	"[%c][%c][%%][%3c][%-3c]\n"
	.align	3
.LC4:
	.string	"abc"
	.align	3
.LC5:
	.string	"gone"
	.align	3
.LC6:
	.string	"truncate"
	.align	3
.LC7:
	.string	"hi"
	.align	3
.LC8:
	.string	"hello"
	.align	3
.LC9:
	.string	"[%s][%10s][%-10s][%.3s][%.0s][%5.2s]\n"
	.align	3
.LC10:
	.string	"[%hhd][%hd][%hhu][%hu]\n"
	.align	3
.LC11:
	.string	"[%*d][%-*d][%.*d]\n"
	.align	3
.LC12:
	.string	"count me\n"
	.align	3
.LC13:
	.string	"returned %d\n"
	.align	3
.LC14:
	.string	"%d %d %d %d %d %d %d %d %d %d %d %d\n"
	.align	3
.LC15:
	.string	"no newline at end"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #96
	stp	x29, x30, [sp, 48]
	add	x29, sp, 48
	mov	w0, -42
	str	w0, [sp, 92]
	mov	w0, 24064
	movk	w0, 0xb2d0, lsl 16
	str	w0, [sp, 88]
	mov	x0, -1227
	movk	x0, 0x8e04, lsl 16
	movk	x0, 0xfee0, lsl 32
	str	x0, [sp, 80]
	mov	x0, -1
	str	x0, [sp, 72]
	ldr	w6, [sp, 92]
	ldr	w5, [sp, 92]
	ldr	w4, [sp, 92]
	ldr	w3, [sp, 92]
	ldr	w2, [sp, 92]
	ldr	w1, [sp, 92]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w6, [sp, 88]
	ldr	w5, [sp, 88]
	ldr	w4, [sp, 88]
	ldr	w3, [sp, 88]
	ldr	w2, [sp, 88]
	ldr	w1, [sp, 88]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	x5, [sp, 72]
	ldr	x4, [sp, 80]
	ldr	x3, [sp, 72]
	ldr	x2, [sp, 72]
	ldr	x1, [sp, 80]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w4, 121
	mov	w3, 122
	mov	w2, 97
	mov	w1, 65
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	adrp	x0, .LC4
	add	x6, x0, :lo12:.LC4
	adrp	x0, .LC5
	add	x5, x0, :lo12:.LC5
	adrp	x0, .LC6
	add	x4, x0, :lo12:.LC6
	adrp	x0, .LC7
	add	x3, x0, :lo12:.LC7
	adrp	x0, .LC7
	add	x2, x0, :lo12:.LC7
	adrp	x0, .LC8
	add	x1, x0, :lo12:.LC8
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	mov	w4, 4464
	mov	w3, 200
	mov	w2, 4464
	mov	w1, 200
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	mov	w6, 7
	mov	w5, 4
	mov	w4, 7
	mov	w3, 6
	mov	w2, 7
	mov	w1, 6
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	str	w0, [sp, 68]
	ldr	w1, [sp, 68]
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
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
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	printf
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 48]
	add	sp, sp, 96
	ret

