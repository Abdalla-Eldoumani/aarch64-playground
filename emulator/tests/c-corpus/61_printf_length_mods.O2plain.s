	.text
	.section .rodata
	.align	3
.LC0:
	.string	"hh %hhd %hhu %hhx %hho | h %hd %hu %hX %ho\n int %d %u %x %o | long %ld %lu %lx\n ll %lld %llX | z %zu %zx %zd | j %jd %ju %jx | t %td %ti\n"
	.align	3
.LC1:
	.string	" r=%d\n"
	.text
	.align	2
	.align 5
show:
	sub	sp, sp, #160
	and	w7, w0, 65535
	and	w4, w0, 255
	sxth	w5, w0
	sxtb	w1, w0
	mov	w6, w7
	stp	x29, x30, [sp, 144]
	add	x29, sp, 144
	mov	w3, w4
	mov	w2, w4
	str	w7, [sp]
	str	w0, [sp, 8]
	str	w0, [sp, 16]
	str	w0, [sp, 24]
	str	w0, [sp, 32]
	stp	x0, x0, [sp, 40]
	stp	x0, x0, [sp, 56]
	stp	x0, x0, [sp, 72]
	stp	x0, x0, [sp, 88]
	stp	x0, x0, [sp, 104]
	stp	x0, x0, [sp, 120]
	str	x0, [sp, 136]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldp	x29, x30, [sp, 144]
	mov	w1, w0
	add	sp, sp, 160
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	b	printf
	.section .rodata
	.align	3
.LC2:
	.string	"v=%#018lx\n"
	.align	3
.LC3:
	.string	"h%d=%lx\n"
	.align	3
.LC4:
	.string	"narrow %d: %hhd %hhu %hhx %hd %hu %hx\n"
	.align	3
.LC5:
	.string	"%zu %zx %zX %zo %zd %zi\n"
	.align	3
.LC6:
	.string	"r=%d\n"
	.align	3
.LC7:
	.string	"%jd %ju %td %lld %llu\n"
	.align	3
.LC8:
	.string	"[%-+22zd][%#24zx][%026jd][%.20tu][% hhd][%+hd]\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LANCHOR0
	stp	x21, x22, [sp, 32]
	add	x22, x20, :lo12:.LANCHOR0
	adrp	x21, .LC2
	mov	x19, x22
	add	x21, x21, :lo12:.LC2
	stp	x23, x24, [sp, 48]
	add	x23, x22, 64
	.align 5
.L5:
	mov	x0, x21
	ldr	x20, [x19], 8
	mov	x1, x20
	bl	printf
	mov	x0, x20
	bl	show
	cmp	x23, x19
	bne	.L5
	mov	x19, 8997
	adrp	x23, .LC3
	movk	x19, 0x8422, lsl 16
	mov	x24, 435
	movk	x19, 0x9ce4, lsl 32
	add	x23, x23, :lo12:.LC3
	mov	x21, 7
	mov	w20, 0
	movk	x19, 0xcbf2, lsl 48
	movk	x24, 0x100, lsl 32
	.align 5
.L6:
	eor	x19, x19, x21
	mov	w1, w20
	mov	x0, x23
	add	w20, w20, 1
	add	x21, x21, 131
	mul	x19, x19, x24
	mov	x2, x19
	bl	printf
	mov	x0, x19
	bl	show
	cmp	w20, 6
	bne	.L6
	add	x19, x22, 64
	add	x20, x22, 104
	adrp	x21, .LC1
	adrp	x22, .LC4
	add	x21, x21, :lo12:.LC1
	add	x22, x22, :lo12:.LC4
	.align 5
.L7:
	ldr	w7, [x19], 4
	mov	x0, x22
	mov	w6, w7
	mov	w5, w7
	mov	w4, w7
	mov	w3, w7
	mov	w2, w7
	mov	w1, w7
	bl	printf
	mov	w1, w0
	mov	x0, x21
	bl	printf
	cmp	x20, x19
	bne	.L7
	mov	w0, 40
	str	w0, [sp, 76]
	mov	x20, 1
	mov	x22, -5
	ldr	w0, [sp, 76]
	adrp	x21, .LC6
	lsl	x20, x20, x0
	sub	x6, x22, x20
	sub	x5, x22, x20
	mov	x4, x20
	mov	x3, x20
	mov	x2, x20
	mov	x1, x20
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w1, w0
	add	x0, x21, :lo12:.LC6
	bl	printf
	sub	x5, x22, x20
	sub	x4, x22, x20
	sub	x3, x22, x20
	sub	x2, x22, x20
	sub	x1, x22, x20
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	mov	w1, w0
	add	x0, x21, :lo12:.LC6
	bl	printf
	sub	x3, x22, x20
	mov	w5, w22
	mov	x4, x20
	mov	x2, x20
	mov	w6, 1234
	mov	x1, x3
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	mov	w1, w0
	add	x0, x21, :lo12:.LC6
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 80
	ret
	.section .rodata
	.align	4
	.LANCHOR0:
vals__1:
	.quad	-9114578090645354616
	.quad	9187201950435737471
	.quad	4294967296
	.quad	-1
	.quad	4294967295
	.quad	-9223372036854775808
	.quad	71777214294589695
	.quad	1099511627904
nv__0:
	.word	127
	.word	128
	.word	255
	.word	256
	.word	-129
	.word	32767
	.word	32768
	.word	65535
	.word	65536
	.word	-40000

