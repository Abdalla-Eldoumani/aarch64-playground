	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%-6s len=%2d:"
	.align	3
.LC1:
	.string	" %02x"
	.text
	.align	2
	.p2align 5,,15
dump:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x1
	mov	w20, w2
	mov	x1, x0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	cmp	w20, 0
	ble	.L2
	add	x20, x19, w20, sxtw
	str	x21, [sp, 32]
	adrp	x21, .LC1
	add	x21, x21, :lo12:.LC1
	.p2align 5,,15
.L3:
	ldrb	w1, [x19], 1
	mov	x0, x21
	bl	printf
	cmp	x19, x20
	bne	.L3
	ldr	x21, [sp, 32]
.L2:
	mov	w0, 10
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 48
	b	putchar
	.section .rodata
	.align	3
.LC2:
	.string	""
	.align	3
.LC3:
	.string	"abc"
	.align	3
.LC4:
	.string	"abcdef"
	.align	3
.LC5:
	.string	"[%s][%8s][%-8s][%.2s][%8.3s][%-8.0s][%s][%.10s]\n"
	.align	3
.LC6:
	.string	"short"
	.align	3
.LC7:
	.string	"n=%d\n"
	.align	3
.LC8:
	.string	"[%c][%3c][%-3c][%c%c%c][%*c][%-*c]\n"
	.align	3
.LC9:
	.string	"p"
	.align	3
.LC10:
	.string	"[%%][%5.1f%%][%%%d%%][%-4s%%]\n"
	.align	3
.LC11:
	.string	"cut"
	.align	3
.LC12:
	.string	"lt"
	.align	3
.LC13:
	.string	"rt"
	.align	3
.LC14:
	.string	"[%*s][%-*s][%.*s][%.*s][%*.*s]\n"
	.align	3
.LC15:
	.string	"left"
	.align	3
.LC16:
	.string	"whole"
	.align	3
.LC17:
	.string	"a%cb%cc%-3cd%c"
	.align	3
.LC18:
	.string	"chars"
	.align	3
.LC19:
	.string	"[%s][%6s][%.1s][%-4.3s]"
	.align	3
.LC20:
	.string	"bytes"
	.align	3
.LC21:
	.string	"\303"
	.align	3
.LC22:
	.byte 255, 37, 100, 254, 37, 115, 128, 0
	.align	3
.LC23:
	.string	"fmt"
	.align	3
.LC24:
	.string	"%s|%.1s|%10s|%-9s|\n"
	.align	3
.LC25:
	.string	"[%p][%p][%20p][%-20p][%p][%-8p][%8p]\n"
	.align	3
.LC26:
	.string	"[%.5s][%-7.3s][%.*s][%.10s]\n"
	.align	3
.LC27:
	.string	"%s"
	.align	3
.LC28:
	.string	"n=%d buf=%s strlen=%zu\n"
	.align	3
.LC29:
	.string	"%.3s%s\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #144
	adrp	x6, .LC3
	add	x6, x6, :lo12:.LC3
	adrp	x0, .LC6
	mov	x4, x6
	mov	x3, x6
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	mov	x2, x6
	add	x0, x0, :lo12:.LC6
	adrp	x7, .LC2
	adrp	x5, .LC4
	add	x7, x7, :lo12:.LC2
	add	x5, x5, :lo12:.LC4
	str	x0, [sp]
	mov	x1, x6
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	stp	x19, x20, [sp, 48]
	adrp	x19, .LC7
	stp	x21, x22, [sp, 64]
	bl	printf
	mov	w1, w0
	add	x0, x19, :lo12:.LC7
	bl	printf
	mov	w0, 108
	str	w0, [sp, 16]
	mov	w0, -4
	str	w0, [sp, 8]
	mov	w0, 114
	str	w0, [sp]
	mov	w7, 4
	mov	w6, -190
	mov	w5, 377
	mov	w4, 120
	mov	w3, 67
	mov	w2, 66
	mov	w1, 65
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	mov	w1, w0
	add	x0, x19, :lo12:.LC7
	bl	printf
	adrp	x20, .LANCHOR0
	mov	x0, 246290604621824
	adrp	x2, .LC9
	movk	x0, 0x4058, lsl 48
	add	x2, x2, :lo12:.LC9
	fmov	d0, x0
	mov	w1, 7
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	mov	w1, w0
	add	x0, x19, :lo12:.LC7
	bl	printf
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	str	x0, [sp, 24]
	mov	w0, 3
	str	w0, [sp, 16]
	mov	w0, -7
	adrp	x6, .LC11
	adrp	x4, .LC12
	add	x6, x6, :lo12:.LC11
	add	x4, x4, :lo12:.LC12
	adrp	x2, .LC13
	add	x2, x2, :lo12:.LC13
	str	w0, [sp, 8]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	str	x0, [sp]
	mov	w7, -1
	mov	w3, 6
	mov	w5, 2
	mov	w1, w3
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	printf
	mov	w1, w0
	add	x0, x19, :lo12:.LC7
	bl	printf
	add	x0, sp, 80
	mov	x2, 64
	mov	w1, 85
	bl	memset
	mov	w6, 233
	mov	w5, 128
	mov	w4, 255
	mov	w3, 0
	add	x0, sp, 80
	mov	x1, 64
	adrp	x2, .LC17
	add	x2, x2, :lo12:.LC17
	bl	snprintf
	add	w2, w0, 2
	add	x1, sp, 80
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	dump
	add	x20, x20, :lo12:.LANCHOR0
	add	x0, sp, 80
	mov	x2, 64
	mov	w1, 85
	bl	memset
	adrp	x21, plain+69990
	mov	x6, x20
	mov	x5, x20
	mov	x4, x20
	add	x3, x20, 8
	add	x0, sp, 80
	mov	x1, 64
	adrp	x2, .LC19
	add	x2, x2, :lo12:.LC19
	bl	snprintf
	add	w2, w0, 1
	add	x1, sp, 80
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	dump
	add	x0, sp, 80
	mov	x2, 64
	mov	w1, 85
	bl	memset
	adrp	x4, .LC21
	add	x4, x4, :lo12:.LC21
	mov	w3, 5
	add	x0, sp, 80
	mov	x1, 64
	adrp	x2, .LC22
	add	x2, x2, :lo12:.LC22
	bl	snprintf
	add	x1, sp, 80
	add	w2, w0, 1
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	bl	dump
	add	x3, x20, 8
	mov	x4, x20
	mov	x2, x20
	mov	x1, x3
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	printf
	mov	w1, w0
	add	x0, x19, :lo12:.LC7
	bl	printf
	mov	x3, 48879
	mov	x7, 0
	mov	x6, 0
	mov	x5, -1
	mov	x4, 16
	movk	x3, 0xdead, lsl 16
	mov	x2, 4660
	mov	x1, 0
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	printf
	mov	w1, w0
	add	x0, x19, :lo12:.LC7
	bl	printf
	adrp	x20, plain
	mov	x2, 4464
	add	x20, x20, :lo12:plain
	movk	x2, 0x1, lsl 16
	mov	x0, x20
	mov	w1, 113
	bl	memset
	mov	x5, x20
	add	x2, x21, :lo12:plain+69990
	adrp	x4, plain+100
	add	x4, x4, :lo12:plain+100
	mov	w3, 4
	mov	w0, 90
	mov	x1, x20
	strb	w0, [x20, 9]
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	printf
	mov	w1, w0
	add	x0, x19, :lo12:.LC7
	bl	printf
	add	x0, x20, 69632
	mov	x3, x20
	adrp	x2, .LC27
	add	x2, x2, :lo12:.LC27
	mov	x1, 8
	strb	wzr, [x0, 367]
	add	x0, sp, 80
	bl	snprintf
	mov	w22, w0
	mov	x0, x20
	bl	strlen
	add	x2, sp, 80
	mov	x3, x0
	mov	w1, w22
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	bl	printf
	add	x2, x21, :lo12:plain+69990
	adrp	x1, plain+69000
	adrp	x0, .LC29
	add	x1, x1, :lo12:plain+69000
	add	x0, x0, :lo12:.LC29
	bl	printf
	mov	w1, w0
	add	x0, x19, :lo12:.LC7
	bl	printf
	ldp	x29, x30, [sp, 32]
	mov	w0, 0
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	add	sp, sp, 144
	ret
	.section .rodata
	.align	3
	.LANCHOR0:
utf8.0:
	.byte 195, 169, 116, 195, 169, 0
	.zero	2
latin.1:
	.byte 99, 97, 102, 233, 32, 255, 254, 0
	.bss
	.align	4
plain:
	.zero	70000

