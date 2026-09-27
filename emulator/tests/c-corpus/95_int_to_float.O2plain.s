	.text
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
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -64]!
	mov	x0, 4463067230724161536
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LANCHOR0
	add	x20, x20, :lo12:.LANCHOR0
	stp	x21, x22, [sp, 32]
	adrp	x21, .LC0
	add	x21, x21, :lo12:.LC0
	mov	w19, 0
	stp	d14, d15, [sp, 48]
	fmov	d14, x0
	mov	w0, 931135488
	fmov	s15, w0
	.align 5
.L2:
	ldr	x2, [x20, w19, sxtw 3]
	mov	w1, w19
	mov	x0, x21
	add	w19, w19, 1
	scvtf	d30, x2
	scvtf	s31, x2
	fmul	d29, d30, d14
	fmov	x4, d30
	fcvt	d0, s31
	fmov	w3, s31
	fmov	x6, d29
	fmul	s29, s31, s15
	fmov	w5, s29
	bl	printf
	cmp	w19, 18
	bne	.L2
	adrp	x21, .LC1
	add	x22, x20, 144
	add	x21, x21, :lo12:.LC1
	mov	w0, 931135488
	mov	w19, 0
	fmov	s15, w0
	.align 5
.L3:
	ldr	x2, [x22, w19, sxtw 3]
	mov	w1, w19
	mov	x0, x21
	add	w19, w19, 1
	ucvtf	s31, x2
	fmul	s30, s31, s15
	fcvt	d0, s31
	fmov	w3, s31
	fmov	w5, s30
	ucvtf	d30, x2
	fmov	x4, d30
	bl	printf
	cmp	w19, 6
	bne	.L3
	adrp	x22, .LC2
	add	x21, x20, 192
	add	x22, x22, :lo12:.LC2
	mov	w19, 0
.L4:
	ldr	w2, [x21, w19, sxtw 2]
	mov	w1, w19
	ldr	s31, [x21, w19, sxtw 2]
	ldr	w0, [x21, w19, sxtw 2]
	add	w19, w19, 1
	scvtf	s31, s31
	scvtf	d30, w0
	mov	x0, x22
	fmov	w3, s31
	fmov	x4, d30
	bl	printf
	cmp	w19, 5
	bne	.L4
	adrp	x21, .LC3
	add	x21, x21, :lo12:.LC3
	mov	w19, 0
.L5:
	add	x0, x20, w19, sxtw 2
	mov	w1, w19
	add	w19, w19, 1
	ldr	w2, [x0, 224]
	ldr	s31, [x0, 224]
	ldr	w0, [x0, 224]
	ucvtf	s31, s31
	ucvtf	d30, w0
	mov	x0, x21
	fmov	w3, s31
	fmov	x4, d30
	bl	printf
	cmp	w19, 4
	bne	.L5
	adrp	x21, .LC4
	add	x22, x20, 240
	add	x21, x21, :lo12:.LC4
	mov	w19, 0
	.align 5
.L6:
	ldr	d31, [x22, w19, sxtw 3]
	mov	w1, w19
	mov	x0, x21
	add	w19, w19, 1
	fcvt	s30, d31
	fmov	x2, d31
	fcvt	d0, s30
	fmov	w3, s30
	bl	printf
	cmp	w19, 18
	bne	.L6
	adrp	x21, .LC5
	add	x22, x20, 384
	add	x21, x21, :lo12:.LC5
	mov	w19, 0
	.align 5
.L7:
	ldr	s31, [x22, w19, sxtw 2]
	mov	w1, w19
	mov	x0, x21
	add	w19, w19, 1
	fcvt	d0, s31
	fmov	w2, s31
	fmov	x3, d0
	bl	printf
	cmp	w19, 6
	bne	.L7
	adrp	x22, .LC6
	add	x21, x20, 416
	add	x22, x22, :lo12:.LC6
	mov	w19, 0
	.align 5
.L8:
	ldr	x2, [x21, w19, sxtw 3]
	mov	w1, w19
	ldr	d31, [x21, w19, sxtw 3]
	mov	x0, x22
	add	w19, w19, 1
	fcvt	s31, d31
	fmov	w3, s31
	bl	printf
	cmp	w19, 6
	bne	.L8
	adrp	x21, .LC7
	add	x20, x20, 464
	add	x21, x21, :lo12:.LC7
	mov	w19, 0
.L9:
	ldr	w2, [x20, w19, sxtw 2]
	mov	w1, w19
	ldr	s31, [x20, w19, sxtw 2]
	mov	x0, x21
	add	w19, w19, 1
	fcvt	d31, s31
	fmov	x3, d31
	bl	printf
	cmp	w19, 5
	bne	.L9
	mov	x2, 1
	mov	x5, 256186209271808
	movk	x2, 0x100, lsl 32
	sub	x0, x2, #1
	mov	x3, x0
	mov	x1, 0
	movk	x5, 0x3, lsl 48
	.align 5
.L10:
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
	bne	.L10
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldp	d14, d15, [sp, 48]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.data
	.align	4
	.LANCHOR0:
sv:
	.quad	0
	.quad	-1
	.quad	16777217
	.quad	16777219
	.quad	-16777217
	.quad	2147483647
	.quad	-2147483648
	.quad	9007199254740993
	.quad	9007199254740995
	.quad	-9007199254740993
	.quad	1152921573326323713
	.quad	-1152921573326323713
	.quad	4611686293305294849
	.quad	1152921710765277183
	.quad	-1152921710765277183
	.quad	9223371487098961921
	.quad	9223372036854775807
	.quad	-9223372036854775808
uv:
	.quad	-1
	.quad	-9223371487098961919
	.quad	-549755813889
	.quad	-9223372036854774783
	.quad	-9223372036854774784
	.quad	4294967295
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
	.quad	9221120237041090560
	.quad	-2251799813685247
	.quad	9218868437227405317
	.quad	-3377699720527872
	.quad	9218868437764276224
	.quad	9223372036854775807
fnan:
	.word	2143289344
	.word	-4194303
	.word	2139095041
	.word	-6291456
	.word	2143289343

