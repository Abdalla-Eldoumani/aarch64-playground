	.text
	.align	2
	.p2align 5,,15
fbits:
	fmov	w0, s0
	ret
	.align	2
	.p2align 5,,15
dbits:
	fmov	x0, d0
	ret
	.align	2
	.p2align 5,,15
f_of:
	fmov	s0, w0
	ret
	.align	2
	.p2align 5,,15
d_of:
	fmov	d0, x0
	ret
	.align	2
	.p2align 5,,15
q16f:
	scvtf	s0, x0
	mov	w0, 931135488
	fmov	s31, w0
	fmul	s0, s0, s31
	ret
	.align	2
	.p2align 5,,15
q32d:
	scvtf	d0, x0
	mov	x0, 4463067230724161536
	fmov	d31, x0
	fmul	d0, d0, d31
	ret
	.align	2
	.p2align 5,,15
uq16f:
	ucvtf	s0, x0
	mov	w0, 931135488
	fmov	s31, w0
	fmul	s0, s0, s31
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"s%02d %ld f=%08x %.1f d=%016lx q=%08x %016lx\n"
	.align	3
.LC1:
	.string	"u%02d %lu f=%08x %.1f d=%016lx q=%08x\n"
	.align	3
.LC2:
	.string	"i%d %d f=%08x d=%016lx\n"
	.align	3
.LC3:
	.string	"w%d %u f=%08x d=%016lx\n"
	.align	3
.LC4:
	.string	"n%02d %016lx -> %08x %.9g\n"
	.align	3
.LC5:
	.string	"x%d %08x -> %016lx %.17g\n"
	.align	3
.LC6:
	.string	"dn%d %016lx -> %08x\n"
	.align	3
.LC7:
	.string	"fn%d %08x -> %016lx\n"
	.align	3
.LC8:
	.string	"exact %ld\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LANCHOR0
	add	x20, x20, :lo12:.LANCHOR0
	stp	x21, x22, [sp, 32]
	adrp	x21, .LC0
	add	x21, x21, :lo12:.LC0
	mov	w19, 0
	.p2align 5,,15
.L10:
	ldr	x2, [x20, w19, sxtw 3]
	mov	w1, w19
	add	w19, w19, 1
	scvtf	s0, x2
	bl	fbits
	fcvt	d30, s0
	scvtf	d0, x2
	mov	w3, w0
	bl	dbits
	mov	x4, x0
	mov	x0, x2
	bl	q16f
	bl	fbits
	mov	w5, w0
	mov	x0, x2
	bl	q32d
	bl	dbits
	fmov	d0, d30
	mov	x6, x0
	mov	x0, x21
	bl	printf
	cmp	w19, 18
	bne	.L10
	adrp	x21, .LC1
	add	x22, x20, 144
	add	x21, x21, :lo12:.LC1
	mov	w19, 0
	.p2align 5,,15
.L11:
	ldr	x2, [x22, w19, sxtw 3]
	mov	w1, w19
	add	w19, w19, 1
	ucvtf	s0, x2
	bl	fbits
	fcvt	d30, s0
	ucvtf	d0, x2
	mov	w3, w0
	bl	dbits
	mov	x4, x0
	mov	x0, x2
	bl	uq16f
	bl	fbits
	fmov	d0, d30
	mov	w5, w0
	mov	x0, x21
	bl	printf
	cmp	w19, 6
	bne	.L11
	adrp	x22, .LC2
	add	x21, x20, 192
	add	x22, x22, :lo12:.LC2
	mov	w19, 0
.L12:
	ldr	w2, [x21, w19, sxtw 2]
	mov	w1, w19
	ldr	s0, [x21, w19, sxtw 2]
	scvtf	s0, s0
	bl	fbits
	mov	w3, w0
	ldr	w0, [x21, w19, sxtw 2]
	add	w19, w19, 1
	scvtf	d0, w0
	bl	dbits
	mov	x4, x0
	mov	x0, x22
	bl	printf
	cmp	w19, 5
	bne	.L12
	adrp	x21, .LC3
	add	x21, x21, :lo12:.LC3
	mov	w19, 0
.L13:
	add	x1, x20, w19, sxtw 2
	ldr	w2, [x1, 224]
	ldr	s0, [x1, 224]
	ucvtf	s0, s0
	bl	fbits
	mov	w3, w0
	ldr	w0, [x1, 224]
	mov	w1, w19
	add	w19, w19, 1
	ucvtf	d0, w0
	bl	dbits
	mov	x4, x0
	mov	x0, x21
	bl	printf
	cmp	w19, 4
	bne	.L13
	adrp	x21, .LC4
	add	x22, x20, 240
	add	x21, x21, :lo12:.LC4
	mov	w19, 0
	.p2align 5,,15
.L14:
	ldr	d0, [x22, w19, sxtw 3]
	mov	w1, w19
	add	w19, w19, 1
	fcvt	s31, d0
	bl	dbits
	mov	x2, x0
	fmov	s0, s31
	bl	fbits
	fcvt	d0, s31
	mov	w3, w0
	mov	x0, x21
	bl	printf
	cmp	w19, 18
	bne	.L14
	adrp	x21, .LC5
	add	x22, x20, 384
	add	x21, x21, :lo12:.LC5
	mov	w19, 0
	.p2align 5,,15
.L15:
	ldr	s0, [x22, w19, sxtw 2]
	mov	w1, w19
	add	w19, w19, 1
	bl	fbits
	fcvt	d0, s0
	mov	w2, w0
	bl	dbits
	mov	x3, x0
	mov	x0, x21
	bl	printf
	cmp	w19, 6
	bne	.L15
	adrp	x22, .LC6
	add	x21, x20, 416
	add	x22, x22, :lo12:.LC6
	mov	w19, 0
	.p2align 5,,15
.L16:
	ldr	x2, [x21, w19, sxtw 3]
	mov	w1, w19
	ldr	x0, [x21, w19, sxtw 3]
	add	w19, w19, 1
	bl	d_of
	fcvt	s0, d0
	bl	fbits
	mov	w3, w0
	mov	x0, x22
	bl	printf
	cmp	w19, 6
	bne	.L16
	adrp	x21, .LC7
	add	x20, x20, 464
	add	x21, x21, :lo12:.LC7
	mov	w19, 0
.L17:
	ldr	w2, [x20, w19, sxtw 2]
	mov	w1, w19
	ldr	w0, [x20, w19, sxtw 2]
	add	w19, w19, 1
	bl	f_of
	fcvt	d0, s0
	bl	dbits
	mov	x3, x0
	mov	x0, x21
	bl	printf
	cmp	w19, 5
	bne	.L17
	mov	x2, 1
	mov	x5, 256186209271808
	movk	x2, 0x100, lsl 32
	sub	x0, x2, #1
	mov	x3, x0
	mov	x1, 0
	movk	x5, 0x3, lsl 48
	.p2align 5,,15
.L18:
	scvtf	s30, x0
	scvtf	d31, x2
	fcvtzs	x4, s30
	cmp	x4, x0
	fcvtzs	x4, d31
	cinc	x1, x1, eq
	add	x0, x0, x3
	cmp	x4, x2
	add	x2, x2, x3
	cinc	x1, x1, eq
	cmp	x0, x5
	bne	.L18
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 48
	ret
	.data
	.align	4
	.LANCHOR0:
sv:
	.xword	0
	.xword	-1
	.xword	16777217
	.xword	16777219
	.xword	-16777217
	.xword	2147483647
	.xword	-2147483648
	.xword	9007199254740993
	.xword	9007199254740995
	.xword	-9007199254740993
	.xword	1152921573326323713
	.xword	-1152921573326323713
	.xword	4611686293305294849
	.xword	1152921710765277183
	.xword	-1152921710765277183
	.xword	9223371487098961921
	.xword	9223372036854775807
	.xword	-9223372036854775808
uv:
	.xword	-1
	.xword	-9223371487098961919
	.xword	-549755813889
	.xword	-9223372036854774783
	.xword	-9223372036854774784
	.xword	4294967295
si:
	.word	16777217
	.word	-16777219
	.word	2147483647
	.word	-2147483648
	.word	33554435
	.zero	12
ui:
	.word	-2147483520
	.word	-2147483519
	.word	-129
	.word	-1
nv:
	.word	268435456
	.word	1072693248
	.word	268435457
	.word	1072693248
	.word	805306368
	.word	1072693248
	.word	-1717986918
	.word	1069128089
	.word	0
	.word	-2147483648
	.word	-268435457
	.word	1206910975
	.word	-268435456
	.word	1206910975
	.word	-191084003
	.word	1208451719
	.word	-191084003
	.word	-939031929
	.word	0
	.word	916455424
	.word	0
	.word	915406848
	.word	1
	.word	915406848
	.word	0
	.word	-1232076800
	.word	0
	.word	916979712
	.word	-1073741824
	.word	940572671
	.word	-536870912
	.word	940572671
	.word	1255454751
	.word	898494074
	.word	1
	.word	0
wv:
	.word	1
	.word	8388607
	.word	2139095039
	.word	-2139095040
	.word	1036831949
	.word	-2147483648
	.zero	8
dnan:
	.xword	9221120237041090560
	.xword	-2251799813685247
	.xword	9218868437227405317
	.xword	-3377699720527872
	.xword	9218868437764276224
	.xword	9223372036854775807
fnan:
	.word	2143289344
	.word	-4194303
	.word	2139095041
	.word	-6291456
	.word	2143289343

