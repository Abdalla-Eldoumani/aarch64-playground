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
show:
	sub	sp, sp, #192
	stp	x29, x30, [sp, 144]
	add	x29, sp, 144
	str	x0, [sp, 168]
	ldr	x0, [sp, 168]
	sxtb	w0, w0
	mov	w8, w0
	ldr	x0, [sp, 168]
	and	w0, w0, 255
	mov	w9, w0
	ldr	x0, [sp, 168]
	and	w0, w0, 255
	mov	w10, w0
	ldr	x0, [sp, 168]
	and	w0, w0, 255
	mov	w11, w0
	ldr	x0, [sp, 168]
	sxth	w0, w0
	mov	w12, w0
	ldr	x0, [sp, 168]
	and	w0, w0, 65535
	mov	w6, w0
	ldr	x0, [sp, 168]
	and	w0, w0, 65535
	mov	w7, w0
	ldr	x0, [sp, 168]
	and	w0, w0, 65535
	mov	w13, w0
	ldr	x0, [sp, 168]
	mov	w14, w0
	ldr	x0, [sp, 168]
	mov	w15, w0
	ldr	x0, [sp, 168]
	mov	w16, w0
	ldr	x0, [sp, 168]
	mov	w17, w0
	ldr	x0, [sp, 168]
	ldr	x1, [sp, 168]
	ldr	x2, [sp, 168]
	ldr	x3, [sp, 168]
	ldr	x4, [sp, 168]
	ldr	x5, [sp, 168]
	str	x5, [sp, 136]
	str	x4, [sp, 128]
	ldr	x4, [sp, 168]
	str	x4, [sp, 120]
	ldr	x4, [sp, 168]
	str	x4, [sp, 112]
	str	x3, [sp, 104]
	str	x2, [sp, 96]
	ldr	x2, [sp, 168]
	str	x2, [sp, 88]
	ldr	x2, [sp, 168]
	str	x2, [sp, 80]
	ldr	x2, [sp, 168]
	str	x2, [sp, 72]
	str	x1, [sp, 64]
	ldr	x1, [sp, 168]
	str	x1, [sp, 56]
	ldr	x1, [sp, 168]
	str	x1, [sp, 48]
	str	x0, [sp, 40]
	str	w17, [sp, 32]
	str	w16, [sp, 24]
	str	w15, [sp, 16]
	str	w14, [sp, 8]
	str	w13, [sp]
	mov	w5, w12
	mov	w4, w11
	mov	w3, w10
	mov	w2, w9
	mov	w1, w8
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	str	w0, [sp, 188]
	ldr	w1, [sp, 188]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	nop
	ldp	x29, x30, [sp, 144]
	add	sp, sp, 192
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"narrow %d: %hhd %hhu %hhx %hd %hu %hx\n"
	.text
	.align	2
narrow:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	ldr	w1, [sp, 28]
	ldr	w2, [sp, 28]
	ldr	w3, [sp, 28]
	mov	w7, w3
	mov	w6, w2
	ldr	w5, [sp, 28]
	mov	w4, w1
	mov	w3, w0
	ldr	w2, [sp, 28]
	ldr	w1, [sp, 28]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	str	w0, [sp, 44]
	ldr	w1, [sp, 44]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	nop
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC3:
	.string	"v=%#018lx\n"
	.align	3
.LC4:
	.string	"h%d=%lx\n"
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
	.global	main
main:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	wzr, [sp, 60]
	b	.L4
.L5:
	adrp	x0, vals__1
	add	x0, x0, :lo12:vals__1
	ldr	w1, [sp, 60]
	ldr	x0, [x0, x1, lsl 3]
	mov	x1, x0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	adrp	x0, vals__1
	add	x0, x0, :lo12:vals__1
	ldr	w1, [sp, 60]
	ldr	x0, [x0, x1, lsl 3]
	bl	show
	ldr	w0, [sp, 60]
	add	w0, w0, 1
	str	w0, [sp, 60]
.L4:
	ldr	w0, [sp, 60]
	cmp	w0, 7
	bls	.L5
	mov	x0, 8997
	movk	x0, 0x8422, lsl 16
	movk	x0, 0x9ce4, lsl 32
	movk	x0, 0xcbf2, lsl 48
	str	x0, [sp, 48]
	str	wzr, [sp, 44]
	b	.L6
.L7:
	ldr	w1, [sp, 44]
	mov	w0, 131
	mul	w0, w1, w0
	add	w0, w0, 7
	sxtw	x1, w0
	ldr	x0, [sp, 48]
	eor	x1, x1, x0
	mov	x0, 435
	movk	x0, 0x100, lsl 32
	mul	x0, x1, x0
	str	x0, [sp, 48]
	ldr	x2, [sp, 48]
	ldr	w1, [sp, 44]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	x0, [sp, 48]
	bl	show
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L6:
	ldr	w0, [sp, 44]
	cmp	w0, 5
	ble	.L7
	str	wzr, [sp, 40]
	b	.L8
.L9:
	adrp	x0, nv__0
	add	x0, x0, :lo12:nv__0
	ldr	w1, [sp, 40]
	ldr	w0, [x0, x1, lsl 2]
	bl	narrow
	ldr	w0, [sp, 40]
	add	w0, w0, 1
	str	w0, [sp, 40]
.L8:
	ldr	w0, [sp, 40]
	cmp	w0, 9
	bls	.L9
	mov	w0, 40
	str	w0, [sp, 16]
	ldr	w0, [sp, 16]
	mov	x1, 1
	lsl	x0, x1, x0
	str	x0, [sp, 32]
	ldr	x0, [sp, 32]
	mov	x1, -5
	sub	x0, x1, x0
	str	x0, [sp, 24]
	ldr	x6, [sp, 24]
	ldr	x5, [sp, 24]
	ldr	x4, [sp, 32]
	ldr	x3, [sp, 32]
	ldr	x2, [sp, 32]
	ldr	x1, [sp, 32]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	str	w0, [sp, 20]
	ldr	w1, [sp, 20]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	x0, [sp, 24]
	ldr	x1, [sp, 24]
	mov	x5, x1
	ldr	x4, [sp, 24]
	ldr	x3, [sp, 24]
	mov	x2, x0
	ldr	x1, [sp, 24]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	str	w0, [sp, 20]
	ldr	w1, [sp, 20]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	w6, 1234
	mov	w5, -5
	ldr	x4, [sp, 32]
	ldr	x3, [sp, 24]
	ldr	x2, [sp, 32]
	ldr	x1, [sp, 24]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	str	w0, [sp, 20]
	ldr	w1, [sp, 20]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	3
vals__1:
	.quad	-9114578090645354616
	.quad	9187201950435737471
	.quad	4294967296
	.quad	-1
	.quad	4294967295
	.quad	-9223372036854775808
	.quad	71777214294589695
	.quad	1099511627904
	.align	3
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

