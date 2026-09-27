	.text
	.align	2
fbits:
	sub	sp, sp, #32
	str	s0, [sp, 12]
	ldr	s31, [sp, 12]
	str	s31, [sp, 24]
	ldr	w0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
dbits:
	sub	sp, sp, #32
	str	d0, [sp, 8]
	ldr	d31, [sp, 8]
	str	d31, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
f_of:
	sub	sp, sp, #32
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	str	w0, [sp, 24]
	ldr	s31, [sp, 24]
	fmov	s0, s31
	add	sp, sp, 32
	ret
	.align	2
d_of:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	str	x0, [sp, 24]
	ldr	d31, [sp, 24]
	fmov	d0, d31
	add	sp, sp, 32
	ret
	.data
	.align	3
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
	.align	3
uv:
	.xword	-1
	.xword	-9223371487098961919
	.xword	-549755813889
	.xword	-9223372036854774783
	.xword	-9223372036854774784
	.xword	4294967295
	.align	3
si:
	.word	16777217
	.word	-16777219
	.word	2147483647
	.word	-2147483648
	.word	33554435
	.align	3
ui:
	.word	-2147483520
	.word	-2147483519
	.word	-129
	.word	-1
	.text
	.align	2
q16f:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	scvtf	s31, x0
	mov	w0, 1199570944
	fmov	s30, w0
	fdiv	s31, s31, s30
	fmov	s0, s31
	add	sp, sp, 16
	ret
	.align	2
q32d:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	ldr	d31, [sp, 8]
	scvtf	d31, d31
	mov	x0, 4751297606875873280
	fmov	d30, x0
	fdiv	d31, d31, d30
	fmov	d0, d31
	add	sp, sp, 16
	ret
	.align	2
uq16f:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	ucvtf	s31, x0
	mov	w0, 1199570944
	fmov	s30, w0
	fdiv	s31, s31, s30
	fmov	s0, s31
	add	sp, sp, 16
	ret
	.data
	.align	3
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
	.align	3
wv:
	.word	1
	.word	8388607
	.word	2139095039
	.word	-2139095040
	.word	1036831949
	.word	-2147483648
	.align	3
dnan:
	.xword	9221120237041090560
	.xword	-2251799813685247
	.xword	9218868437227405317
	.xword	-3377699720527872
	.xword	9218868437764276224
	.xword	9223372036854775807
	.align	3
fnan:
	.word	2143289344
	.word	-4194303
	.word	2139095041
	.word	-6291456
	.word	2143289343
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
	.global	main
main:
	stp	x29, x30, [sp, -176]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	str	x21, [sp, 32]
	str	d15, [sp, 40]
	mov	w0, 18
	str	w0, [sp, 124]
	str	wzr, [sp, 172]
	b	.L16
.L17:
	adrp	x0, sv
	add	x0, x0, :lo12:sv
	ldrsw	x1, [sp, 172]
	ldr	x0, [x0, x1, lsl 3]
	str	x0, [sp, 64]
	ldr	x0, [sp, 64]
	scvtf	s31, x0
	str	s31, [sp, 60]
	ldr	s0, [sp, 60]
	bl	fbits
	mov	w19, w0
	ldr	s31, [sp, 60]
	fcvt	d15, s31
	ldr	d31, [sp, 64]
	scvtf	d31, d31
	fmov	d0, d31
	bl	dbits
	mov	x20, x0
	ldr	x0, [sp, 64]
	bl	q16f
	fmov	s31, s0
	fmov	s0, s31
	bl	fbits
	mov	w21, w0
	ldr	x0, [sp, 64]
	bl	q32d
	fmov	d31, d0
	fmov	d0, d31
	bl	dbits
	mov	x6, x0
	mov	w5, w21
	mov	x4, x20
	fmov	d0, d15
	mov	w3, w19
	ldr	x2, [sp, 64]
	ldr	w1, [sp, 172]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w0, [sp, 172]
	add	w0, w0, 1
	str	w0, [sp, 172]
.L16:
	ldr	w1, [sp, 172]
	ldr	w0, [sp, 124]
	cmp	w1, w0
	blt	.L17
	mov	w0, 6
	str	w0, [sp, 124]
	str	wzr, [sp, 168]
	b	.L18
.L19:
	adrp	x0, uv
	add	x0, x0, :lo12:uv
	ldrsw	x1, [sp, 168]
	ldr	x0, [x0, x1, lsl 3]
	str	x0, [sp, 80]
	ldr	x0, [sp, 80]
	ucvtf	s31, x0
	str	s31, [sp, 76]
	ldr	s0, [sp, 76]
	bl	fbits
	mov	w19, w0
	ldr	s31, [sp, 76]
	fcvt	d15, s31
	ldr	d31, [sp, 80]
	ucvtf	d31, d31
	fmov	d0, d31
	bl	dbits
	mov	x20, x0
	ldr	x0, [sp, 80]
	bl	uq16f
	fmov	s31, s0
	fmov	s0, s31
	bl	fbits
	mov	w5, w0
	mov	x4, x20
	fmov	d0, d15
	mov	w3, w19
	ldr	x2, [sp, 80]
	ldr	w1, [sp, 168]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 168]
	add	w0, w0, 1
	str	w0, [sp, 168]
.L18:
	ldr	w1, [sp, 168]
	ldr	w0, [sp, 124]
	cmp	w1, w0
	blt	.L19
	mov	w0, 5
	str	w0, [sp, 124]
	str	wzr, [sp, 164]
	b	.L20
.L21:
	adrp	x0, si
	add	x0, x0, :lo12:si
	ldrsw	x1, [sp, 164]
	ldr	w19, [x0, x1, lsl 2]
	adrp	x0, si
	add	x0, x0, :lo12:si
	ldrsw	x1, [sp, 164]
	ldr	s31, [x0, x1, lsl 2]
	scvtf	s31, s31
	fmov	s0, s31
	bl	fbits
	mov	w20, w0
	adrp	x0, si
	add	x0, x0, :lo12:si
	ldrsw	x1, [sp, 164]
	ldr	w0, [x0, x1, lsl 2]
	scvtf	d31, w0
	fmov	d0, d31
	bl	dbits
	mov	x4, x0
	mov	w3, w20
	mov	w2, w19
	ldr	w1, [sp, 164]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	w0, [sp, 164]
	add	w0, w0, 1
	str	w0, [sp, 164]
.L20:
	ldr	w1, [sp, 164]
	ldr	w0, [sp, 124]
	cmp	w1, w0
	blt	.L21
	mov	w0, 4
	str	w0, [sp, 124]
	str	wzr, [sp, 160]
	b	.L22
.L23:
	adrp	x0, ui
	add	x0, x0, :lo12:ui
	ldrsw	x1, [sp, 160]
	ldr	w19, [x0, x1, lsl 2]
	adrp	x0, ui
	add	x0, x0, :lo12:ui
	ldrsw	x1, [sp, 160]
	ldr	s31, [x0, x1, lsl 2]
	ucvtf	s31, s31
	fmov	s0, s31
	bl	fbits
	mov	w20, w0
	adrp	x0, ui
	add	x0, x0, :lo12:ui
	ldrsw	x1, [sp, 160]
	ldr	w0, [x0, x1, lsl 2]
	ucvtf	d31, w0
	fmov	d0, d31
	bl	dbits
	mov	x4, x0
	mov	w3, w20
	mov	w2, w19
	ldr	w1, [sp, 160]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w0, [sp, 160]
	add	w0, w0, 1
	str	w0, [sp, 160]
.L22:
	ldr	w1, [sp, 160]
	ldr	w0, [sp, 124]
	cmp	w1, w0
	blt	.L23
	mov	w0, 18
	str	w0, [sp, 124]
	str	wzr, [sp, 156]
	b	.L24
.L25:
	adrp	x0, nv
	add	x0, x0, :lo12:nv
	ldrsw	x1, [sp, 156]
	ldr	d31, [x0, x1, lsl 3]
	str	d31, [sp, 96]
	ldr	d31, [sp, 96]
	fcvt	s31, d31
	str	s31, [sp, 92]
	ldr	d0, [sp, 96]
	bl	dbits
	mov	x19, x0
	ldr	s0, [sp, 92]
	bl	fbits
	ldr	s31, [sp, 92]
	fcvt	d31, s31
	fmov	d0, d31
	mov	w3, w0
	mov	x2, x19
	ldr	w1, [sp, 156]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w0, [sp, 156]
	add	w0, w0, 1
	str	w0, [sp, 156]
.L24:
	ldr	w1, [sp, 156]
	ldr	w0, [sp, 124]
	cmp	w1, w0
	blt	.L25
	mov	w0, 6
	str	w0, [sp, 124]
	str	wzr, [sp, 152]
	b	.L26
.L27:
	adrp	x0, wv
	add	x0, x0, :lo12:wv
	ldrsw	x1, [sp, 152]
	ldr	s31, [x0, x1, lsl 2]
	str	s31, [sp, 108]
	ldr	s0, [sp, 108]
	bl	fbits
	mov	w19, w0
	ldr	s31, [sp, 108]
	fcvt	d31, s31
	fmov	d0, d31
	bl	dbits
	ldr	s31, [sp, 108]
	fcvt	d31, s31
	fmov	d0, d31
	mov	x3, x0
	mov	w2, w19
	ldr	w1, [sp, 152]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [sp, 152]
	add	w0, w0, 1
	str	w0, [sp, 152]
.L26:
	ldr	w1, [sp, 152]
	ldr	w0, [sp, 124]
	cmp	w1, w0
	blt	.L27
	mov	w0, 6
	str	w0, [sp, 124]
	str	wzr, [sp, 148]
	b	.L28
.L29:
	adrp	x0, dnan
	add	x0, x0, :lo12:dnan
	ldrsw	x1, [sp, 148]
	ldr	x19, [x0, x1, lsl 3]
	adrp	x0, dnan
	add	x0, x0, :lo12:dnan
	ldrsw	x1, [sp, 148]
	ldr	x0, [x0, x1, lsl 3]
	bl	d_of
	fmov	d31, d0
	fcvt	s31, d31
	fmov	s0, s31
	bl	fbits
	mov	w3, w0
	mov	x2, x19
	ldr	w1, [sp, 148]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	w0, [sp, 148]
	add	w0, w0, 1
	str	w0, [sp, 148]
.L28:
	ldr	w1, [sp, 148]
	ldr	w0, [sp, 124]
	cmp	w1, w0
	blt	.L29
	mov	w0, 5
	str	w0, [sp, 124]
	str	wzr, [sp, 144]
	b	.L30
.L31:
	adrp	x0, fnan
	add	x0, x0, :lo12:fnan
	ldrsw	x1, [sp, 144]
	ldr	w19, [x0, x1, lsl 2]
	adrp	x0, fnan
	add	x0, x0, :lo12:fnan
	ldrsw	x1, [sp, 144]
	ldr	w0, [x0, x1, lsl 2]
	bl	f_of
	fmov	s31, s0
	fcvt	d31, s31
	fmov	d0, d31
	bl	dbits
	mov	x3, x0
	mov	w2, w19
	ldr	w1, [sp, 144]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	w0, [sp, 144]
	add	w0, w0, 1
	str	w0, [sp, 144]
.L30:
	ldr	w1, [sp, 144]
	ldr	w0, [sp, 124]
	cmp	w1, w0
	blt	.L31
	str	xzr, [sp, 136]
	mov	x0, 1
	str	x0, [sp, 128]
	b	.L32
.L33:
	ldr	x0, [sp, 128]
	lsl	x0, x0, 40
	str	x0, [sp, 112]
	ldr	x0, [sp, 112]
	scvtf	s31, x0
	fcvtzs	x0, s31
	ldr	x1, [sp, 112]
	cmp	x1, x0
	cset	w0, eq
	and	w0, w0, 255
	and	x0, x0, 255
	ldr	x1, [sp, 136]
	add	x0, x1, x0
	str	x0, [sp, 136]
	ldr	x0, [sp, 112]
	add	x0, x0, 1
	scvtf	d31, x0
	fcvtzs	x1, d31
	ldr	x0, [sp, 112]
	add	x0, x0, 1
	cmp	x1, x0
	cset	w0, eq
	and	w0, w0, 255
	and	x0, x0, 255
	ldr	x1, [sp, 136]
	add	x0, x1, x0
	str	x0, [sp, 136]
	ldr	x0, [sp, 128]
	add	x0, x0, 1
	str	x0, [sp, 128]
.L32:
	ldr	x0, [sp, 128]
	cmp	x0, 1000
	ble	.L33
	ldr	x1, [sp, 136]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	mov	w0, 0
	ldr	d15, [sp, 40]
	ldp	x19, x20, [sp, 16]
	ldr	x21, [sp, 32]
	ldp	x29, x30, [sp], 176
	ret

