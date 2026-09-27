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
dump:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x0, [sp, 40]
	str	x1, [sp, 32]
	str	w2, [sp, 28]
	ldr	w2, [sp, 28]
	ldr	x1, [sp, 40]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	str	wzr, [sp, 60]
	b	.L2
.L3:
	ldrsw	x0, [sp, 60]
	ldr	x1, [sp, 32]
	add	x0, x1, x0
	ldrb	w0, [x0]
	mov	w1, w0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 60]
	add	w0, w0, 1
	str	w0, [sp, 60]
.L2:
	ldr	w1, [sp, 60]
	ldr	w0, [sp, 28]
	cmp	w1, w0
	blt	.L3
	mov	w0, 10
	bl	putchar
	nop
	ldp	x29, x30, [sp], 64
	ret
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
	.global	main
main:
	sub	sp, sp, #128
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	str	x0, [sp]
	adrp	x0, .LC2
	add	x7, x0, :lo12:.LC2
	adrp	x0, .LC3
	add	x6, x0, :lo12:.LC3
	adrp	x0, .LC4
	add	x5, x0, :lo12:.LC4
	adrp	x0, .LC3
	add	x4, x0, :lo12:.LC3
	adrp	x0, .LC3
	add	x3, x0, :lo12:.LC3
	adrp	x0, .LC3
	add	x2, x0, :lo12:.LC3
	adrp	x0, .LC3
	add	x1, x0, :lo12:.LC3
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	str	w0, [sp, 124]
	ldr	w1, [sp, 124]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
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
	str	w0, [sp, 124]
	ldr	w1, [sp, 124]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	adrp	x0, .LC9
	add	x2, x0, :lo12:.LC9
	mov	w1, 7
	mov	x0, 246290604621824
	movk	x0, 0x4058, lsl 48
	fmov	d0, x0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	str	w0, [sp, 124]
	ldr	w1, [sp, 124]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	str	x0, [sp, 24]
	mov	w0, 3
	str	w0, [sp, 16]
	mov	w0, -7
	str	w0, [sp, 8]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	str	x0, [sp]
	mov	w7, -1
	adrp	x0, .LC11
	add	x6, x0, :lo12:.LC11
	mov	w5, 2
	adrp	x0, .LC12
	add	x4, x0, :lo12:.LC12
	mov	w3, 6
	adrp	x0, .LC13
	add	x2, x0, :lo12:.LC13
	mov	w1, 6
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	printf
	str	w0, [sp, 124]
	ldr	w1, [sp, 124]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	add	x0, sp, 56
	mov	x2, 64
	mov	w1, 85
	bl	memset
	add	x7, sp, 56
	mov	w6, 233
	mov	w5, 128
	mov	w4, 255
	mov	w3, 0
	adrp	x0, .LC17
	add	x2, x0, :lo12:.LC17
	mov	x1, 64
	mov	x0, x7
	bl	snprintf
	str	w0, [sp, 124]
	ldr	w0, [sp, 124]
	add	w1, w0, 2
	add	x0, sp, 56
	mov	w2, w1
	mov	x1, x0
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	dump
	add	x0, sp, 56
	mov	x2, 64
	mov	w1, 85
	bl	memset
	add	x7, sp, 56
	adrp	x0, utf8.0
	add	x6, x0, :lo12:utf8.0
	adrp	x0, utf8.0
	add	x5, x0, :lo12:utf8.0
	adrp	x0, utf8.0
	add	x4, x0, :lo12:utf8.0
	adrp	x0, latin.1
	add	x3, x0, :lo12:latin.1
	adrp	x0, .LC19
	add	x2, x0, :lo12:.LC19
	mov	x1, 64
	mov	x0, x7
	bl	snprintf
	str	w0, [sp, 124]
	ldr	w0, [sp, 124]
	add	w1, w0, 1
	add	x0, sp, 56
	mov	w2, w1
	mov	x1, x0
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	dump
	add	x0, sp, 56
	mov	x2, 64
	mov	w1, 85
	bl	memset
	add	x5, sp, 56
	adrp	x0, .LC21
	add	x4, x0, :lo12:.LC21
	mov	w3, 5
	adrp	x0, .LC22
	add	x2, x0, :lo12:.LC22
	mov	x1, 64
	mov	x0, x5
	bl	snprintf
	str	w0, [sp, 124]
	ldr	w0, [sp, 124]
	add	w1, w0, 1
	add	x0, sp, 56
	mov	w2, w1
	mov	x1, x0
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	bl	dump
	adrp	x0, utf8.0
	add	x4, x0, :lo12:utf8.0
	adrp	x0, latin.1
	add	x3, x0, :lo12:latin.1
	adrp	x0, utf8.0
	add	x2, x0, :lo12:utf8.0
	adrp	x0, latin.1
	add	x1, x0, :lo12:latin.1
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	printf
	str	w0, [sp, 124]
	ldr	w1, [sp, 124]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	mov	x7, 0
	mov	x6, 0
	mov	x5, -1
	mov	x4, 16
	mov	x3, 48879
	movk	x3, 0xdead, lsl 16
	mov	x2, 4660
	mov	x1, 0
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	printf
	str	w0, [sp, 124]
	ldr	w1, [sp, 124]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	mov	x2, 4464
	movk	x2, 0x1, lsl 16
	mov	w1, 113
	adrp	x0, plain
	add	x0, x0, :lo12:plain
	bl	memset
	adrp	x0, plain
	add	x0, x0, :lo12:plain
	mov	w1, 90
	strb	w1, [x0, 9]
	adrp	x0, plain+69990
	add	x1, x0, :lo12:plain+69990
	adrp	x0, plain+100
	add	x2, x0, :lo12:plain+100
	adrp	x0, plain
	add	x5, x0, :lo12:plain
	mov	x4, x2
	mov	w3, 4
	mov	x2, x1
	adrp	x0, plain
	add	x1, x0, :lo12:plain
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	printf
	str	w0, [sp, 124]
	ldr	w1, [sp, 124]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	adrp	x0, plain
	add	x0, x0, :lo12:plain
	add	x0, x0, 69632
	strb	wzr, [x0, 367]
	add	x4, sp, 56
	adrp	x0, plain
	add	x3, x0, :lo12:plain
	adrp	x0, .LC27
	add	x2, x0, :lo12:.LC27
	mov	x1, 8
	mov	x0, x4
	bl	snprintf
	str	w0, [sp, 124]
	adrp	x0, plain
	add	x0, x0, :lo12:plain
	bl	strlen
	mov	x1, x0
	add	x0, sp, 56
	mov	x3, x1
	mov	x2, x0
	ldr	w1, [sp, 124]
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	bl	printf
	adrp	x0, plain+69000
	add	x1, x0, :lo12:plain+69000
	adrp	x0, plain+69990
	add	x0, x0, :lo12:plain+69990
	mov	x2, x0
	adrp	x0, .LC29
	add	x0, x0, :lo12:.LC29
	bl	printf
	str	w0, [sp, 124]
	ldr	w1, [sp, 124]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	add	sp, sp, 128
	ret
	.section .rodata
	.align	3
latin.1:
	.byte 99, 97, 102, 233, 32, 255, 254, 0
	.align	3
utf8.0:
	.byte 195, 169, 116, 195, 169, 0


	.bss
	.balign 8
plain:
	.skip 70000
