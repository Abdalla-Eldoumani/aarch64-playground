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
	.align 5
	.global	main
main:
	sub	sp, sp, #64
	mov	w6, -42
	adrp	x0, .LC0
	mov	w5, w6
	mov	w4, w6
	mov	w3, w6
	stp	x29, x30, [sp, 48]
	mov	w2, w6
	add	x29, sp, 48
	mov	w1, w6
	add	x0, x0, :lo12:.LC0
	bl	printf
	mov	w6, 24064
	adrp	x0, .LC1
	movk	w6, 0xb2d0, lsl 16
	add	x0, x0, :lo12:.LC1
	mov	w5, w6
	mov	w4, w6
	mov	w3, w6
	mov	w2, w6
	mov	w1, w6
	bl	printf
	mov	x4, -1227
	mov	x5, -1
	movk	x4, 0x8e04, lsl 16
	mov	x3, x5
	mov	x2, x5
	movk	x4, 0xfee0, lsl 32
	adrp	x0, .LC2
	mov	x1, x4
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w4, 121
	mov	w3, 122
	mov	w2, 97
	mov	w1, 65
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	adrp	x6, .LC4
	adrp	x5, .LC5
	add	x6, x6, :lo12:.LC4
	add	x5, x5, :lo12:.LC5
	adrp	x3, .LC7
	add	x3, x3, :lo12:.LC7
	mov	x2, x3
	adrp	x4, .LC6
	adrp	x1, .LC8
	add	x4, x4, :lo12:.LC6
	add	x1, x1, :lo12:.LC8
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	mov	w4, 4464
	mov	w3, 200
	mov	w2, w4
	mov	w1, w3
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	mov	w6, 7
	mov	w3, 6
	mov	w4, w6
	mov	w2, w6
	mov	w1, w3
	mov	w5, 4
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	mov	w1, w0
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
	ldp	x29, x30, [sp, 48]
	mov	w0, 0
	add	sp, sp, 64
	ret

