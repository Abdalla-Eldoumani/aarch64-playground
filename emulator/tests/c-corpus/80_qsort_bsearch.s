	.text
	.align	2
cmp_int:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldr	w0, [x0]
	str	w0, [sp, 28]
	ldr	x0, [sp]
	ldr	w0, [x0]
	str	w0, [sp, 24]
	ldr	w1, [sp, 28]
	ldr	w0, [sp, 24]
	cmp	w1, w0
	cset	w0, gt
	and	w0, w0, 255
	mov	w2, w0
	ldr	w1, [sp, 28]
	ldr	w0, [sp, 24]
	cmp	w1, w0
	cset	w0, lt
	and	w0, w0, 255
	sub	w0, w2, w0
	add	sp, sp, 32
	ret
	.align	2
cmp_ulong:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldr	x0, [x0]
	str	x0, [sp, 24]
	ldr	x0, [sp]
	ldr	x0, [x0]
	str	x0, [sp, 16]
	ldr	x1, [sp, 24]
	ldr	x0, [sp, 16]
	cmp	x1, x0
	cset	w0, hi
	and	w0, w0, 255
	mov	w2, w0
	ldr	x1, [sp, 24]
	ldr	x0, [sp, 16]
	cmp	x1, x0
	cset	w0, cc
	and	w0, w0, 255
	sub	w0, w2, w0
	add	sp, sp, 32
	ret
	.align	2
cmp_str:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	ldr	x0, [sp, 24]
	ldr	x2, [x0]
	ldr	x0, [sp, 16]
	ldr	x0, [x0]
	mov	x1, x0
	mov	x0, x2
	bl	strcmp
	ldp	x29, x30, [sp], 32
	ret
	.data
	.align	3
inner:
	.quad	cmp_str
	.text
	.align	2
cmp_rev:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	adrp	x0, inner
	add	x0, x0, :lo12:inner
	ldr	x2, [x0]
	ldr	x1, [sp, 24]
	ldr	x0, [sp, 16]
	blr	x2
	ldp	x29, x30, [sp], 32
	ret
	.align	2
cmp_uchar:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldrb	w0, [x0]
	mov	w1, w0
	ldr	x0, [sp]
	ldrb	w0, [x0]
	sub	w0, w1, w0
	add	sp, sp, 16
	ret
	.align	2
cmp3:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	mov	x2, 3
	ldr	x1, [sp, 16]
	ldr	x0, [sp, 24]
	bl	memcmp
	ldp	x29, x30, [sp], 32
	ret
	.align	2
cmp_rec:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	ldr	x0, [sp, 24]
	str	x0, [sp, 56]
	ldr	x0, [sp, 16]
	str	x0, [sp, 48]
	ldr	x0, [sp, 56]
	ldrsh	w1, [x0, 10]
	ldr	x0, [sp, 48]
	ldrsh	w0, [x0, 10]
	cmp	w1, w0
	beq	.L14
	ldr	x0, [sp, 56]
	ldrsh	w0, [x0, 10]
	mov	w1, w0
	ldr	x0, [sp, 48]
	ldrsh	w0, [x0, 10]
	sub	w0, w1, w0
	b	.L15
.L14:
	ldr	x0, [sp, 56]
	ldr	x1, [sp, 48]
	bl	strcmp
	str	w0, [sp, 44]
	ldr	w0, [sp, 44]
	cmp	w0, 0
	bne	.L16
	ldr	x0, [sp, 56]
	ldr	w1, [x0, 12]
	ldr	x0, [sp, 48]
	ldr	w0, [x0, 12]
	cmp	w1, w0
	cset	w0, hi
	and	w0, w0, 255
	mov	w2, w0
	ldr	x0, [sp, 56]
	ldr	w1, [x0, 12]
	ldr	x0, [sp, 48]
	ldr	w0, [x0, 12]
	cmp	w1, w0
	cset	w0, cc
	and	w0, w0, 255
	sub	w0, w2, w0
	b	.L15
.L16:
	ldr	w0, [sp, 44]
.L15:
	ldp	x29, x30, [sp], 64
	ret
	.align	2
cmp_rec_id:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldr	w0, [x0, 12]
	str	w0, [sp, 28]
	ldr	x0, [sp]
	ldr	w0, [x0, 12]
	str	w0, [sp, 24]
	ldr	w1, [sp, 28]
	ldr	w0, [sp, 24]
	cmp	w1, w0
	cset	w0, hi
	and	w0, w0, 255
	mov	w2, w0
	ldr	w1, [sp, 28]
	ldr	w0, [sp, 24]
	cmp	w1, w0
	cset	w0, cc
	and	w0, w0, 255
	sub	w0, w2, w0
	add	sp, sp, 32
	ret
	.align	2
cmp_key_id:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldr	w0, [x0]
	str	w0, [sp, 28]
	ldr	x0, [sp]
	ldr	w0, [x0, 12]
	str	w0, [sp, 24]
	ldr	w1, [sp, 28]
	ldr	w0, [sp, 24]
	cmp	w1, w0
	cset	w0, hi
	and	w0, w0, 255
	mov	w2, w0
	ldr	w1, [sp, 28]
	ldr	w0, [sp, 24]
	cmp	w1, w0
	cset	w0, cc
	and	w0, w0, 255
	sub	w0, w2, w0
	add	sp, sp, 32
	ret
	.section .rodata
	.align	3
.LC20:
	.string	"%s:"
	.align	3
.LC21:
	.string	" %d"
	.align	3
.LC22:
	.string	"\n"
	.text
	.align	2
show_ints:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x0, [sp, 40]
	str	x1, [sp, 32]
	str	w2, [sp, 28]
	ldr	x1, [sp, 40]
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	printf
	str	wzr, [sp, 60]
	b	.L23
.L24:
	ldrsw	x0, [sp, 60]
	lsl	x0, x0, 2
	ldr	x1, [sp, 32]
	add	x0, x1, x0
	ldr	w0, [x0]
	mov	w1, w0
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	printf
	ldr	w0, [sp, 60]
	add	w0, w0, 1
	str	w0, [sp, 60]
.L23:
	ldr	w1, [sp, 60]
	ldr	w0, [sp, 28]
	cmp	w1, w0
	blt	.L24
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	printf
	nop
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	3
.LC23:
	.string	"asc"
	.align	3
.LC24:
	.string	"uniq"
	.align	3
.LC25:
	.string	"find:"
	.align	3
.LC26:
	.string	" %d\n"
	.align	3
.LC27:
	.string	"first after n=1 and n=0: %d\n"
	.align	3
.LC28:
	.string	"ulong:"
	.align	3
.LC29:
	.string	" %lx"
	.align	3
.LC31:
	.string	"str:"
	.align	3
.LC32:
	.string	" [%s]"
	.align	3
.LC34:
	.string	"\nstr find:"
	.align	3
.LC35:
	.string	"\nrev: %s %s [%s]\n"
	.align	3
.LC37:
	.string	"bytes: [%s]\n"
	.align	3
.LC38:
	.string	"tri:"
	.align	3
.LC39:
	.string	"rec:"
	.align	3
.LC40:
	.string	" %s/%d/%u"
	.align	3
.LC41:
	.string	"\nby id:"
	.align	3
.LC42:
	.string	"-"
	.align	3
.LC43:
	.string	" %u=%s"
	.align	3
.LC44:
	.string	"\nsizeof rec %d\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #640
	stp	x29, x30, [sp]
	mov	x29, sp
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 536
	ldr	q28, [x1]
	ldr	q29, [x1, 16]
	ldr	q30, [x1, 32]
	ldr	q31, [x1, 48]
	str	q28, [x0]
	str	q29, [x0, 16]
	str	q30, [x0, 32]
	str	q31, [x0, 48]
	mov	w0, 16
	str	w0, [sp, 628]
	ldrsw	x1, [sp, 628]
	add	x4, sp, 536
	adrp	x0, cmp_int
	add	x3, x0, :lo12:cmp_int
	mov	x2, 4
	mov	x0, x4
	bl	qsort
	add	x0, sp, 536
	ldr	w2, [sp, 628]
	mov	x1, x0
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	bl	show_ints
	str	wzr, [sp, 632]
	ldr	w0, [sp, 632]
	str	w0, [sp, 636]
	b	.L26
.L29:
	ldr	w0, [sp, 632]
	cmp	w0, 0
	beq	.L27
	ldr	w0, [sp, 632]
	sub	w0, w0, #1
	sxtw	x0, w0
	lsl	x0, x0, 2
	add	x1, sp, 472
	ldr	w1, [x1, x0]
	ldrsw	x0, [sp, 636]
	lsl	x0, x0, 2
	add	x2, sp, 536
	ldr	w0, [x2, x0]
	cmp	w1, w0
	beq	.L28
.L27:
	ldr	w0, [sp, 632]
	add	w1, w0, 1
	str	w1, [sp, 632]
	ldrsw	x1, [sp, 636]
	lsl	x1, x1, 2
	add	x2, sp, 536
	ldr	w2, [x2, x1]
	sxtw	x0, w0
	lsl	x0, x0, 2
	add	x1, sp, 472
	str	w2, [x1, x0]
.L28:
	ldr	w0, [sp, 636]
	add	w0, w0, 1
	str	w0, [sp, 636]
.L26:
	ldr	w1, [sp, 636]
	ldr	w0, [sp, 628]
	cmp	w1, w0
	blt	.L29
	add	x0, sp, 472
	ldr	w2, [sp, 632]
	mov	x1, x0
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	show_ints
	adrp	x0, .LC1
	add	x1, x0, :lo12:.LC1
	add	x0, sp, 424
	ldr	q29, [x1]
	ldr	q30, [x1, 16]
	ldr	q31, [x1, 28]
	str	q29, [x0]
	str	q30, [x0, 16]
	str	q31, [x0, 28]
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	printf
	str	wzr, [sp, 636]
	b	.L30
.L33:
	add	x1, sp, 424
	ldrsw	x0, [sp, 636]
	lsl	x0, x0, 2
	add	x5, x1, x0
	ldrsw	x2, [sp, 632]
	add	x1, sp, 472
	adrp	x0, cmp_int
	add	x4, x0, :lo12:cmp_int
	mov	x3, 4
	mov	x0, x5
	bl	bsearch
	str	x0, [sp, 600]
	ldr	x0, [sp, 600]
	cmp	x0, 0
	beq	.L31
	add	x0, sp, 472
	ldr	x1, [sp, 600]
	sub	x0, x1, x0
	asr	x0, x0, 2
	b	.L32
.L31:
	mov	w0, -1
.L32:
	mov	w1, w0
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	printf
	ldr	w0, [sp, 636]
	add	w0, w0, 1
	str	w0, [sp, 636]
.L30:
	ldr	w0, [sp, 636]
	cmp	w0, 10
	ble	.L33
	add	x1, sp, 472
	add	x5, sp, 424
	adrp	x0, cmp_int
	add	x4, x0, :lo12:cmp_int
	mov	x3, 4
	mov	x2, 0
	mov	x0, x5
	bl	bsearch
	cmp	x0, 0
	cset	w0, eq
	and	w0, w0, 255
	mov	w1, w0
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	printf
	add	x4, sp, 536
	adrp	x0, cmp_int
	add	x3, x0, :lo12:cmp_int
	mov	x2, 4
	mov	x1, 1
	mov	x0, x4
	bl	qsort
	add	x4, sp, 536
	adrp	x0, cmp_int
	add	x3, x0, :lo12:cmp_int
	mov	x2, 4
	mov	x1, 0
	mov	x0, x4
	bl	qsort
	ldr	w0, [sp, 536]
	mov	w1, w0
	adrp	x0, .LC27
	add	x0, x0, :lo12:.LC27
	bl	printf
	adrp	x0, .LC2
	add	x1, x0, :lo12:.LC2
	add	x0, sp, 360
	ldr	q28, [x1]
	ldr	q29, [x1, 16]
	ldr	q30, [x1, 32]
	ldr	q31, [x1, 48]
	str	q28, [x0]
	str	q29, [x0, 16]
	str	q30, [x0, 32]
	str	q31, [x0, 48]
	add	x4, sp, 360
	adrp	x0, cmp_ulong
	add	x3, x0, :lo12:cmp_ulong
	mov	x2, 8
	mov	x1, 8
	mov	x0, x4
	bl	qsort
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	bl	printf
	str	wzr, [sp, 636]
	b	.L34
.L35:
	ldrsw	x0, [sp, 636]
	lsl	x0, x0, 3
	add	x1, sp, 360
	ldr	x0, [x1, x0]
	mov	x1, x0
	adrp	x0, .LC29
	add	x0, x0, :lo12:.LC29
	bl	printf
	ldr	w0, [sp, 636]
	add	w0, w0, 1
	str	w0, [sp, 636]
.L34:
	ldr	w0, [sp, 636]
	cmp	w0, 7
	ble	.L35
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	printf
	adrp	x0, .LC30
	add	x1, x0, :lo12:.LC30
	add	x0, sp, 280
	ldr	q27, [x1]
	ldr	q28, [x1, 16]
	ldr	q29, [x1, 32]
	ldr	q30, [x1, 48]
	ldr	q31, [x1, 64]
	str	q27, [x0]
	str	q28, [x0, 16]
	str	q29, [x0, 32]
	str	q30, [x0, 48]
	str	q31, [x0, 64]
	add	x4, sp, 280
	adrp	x0, cmp_str
	add	x3, x0, :lo12:cmp_str
	mov	x2, 8
	mov	x1, 10
	mov	x0, x4
	bl	qsort
	adrp	x0, .LC31
	add	x0, x0, :lo12:.LC31
	bl	printf
	str	wzr, [sp, 636]
	b	.L36
.L37:
	ldrsw	x0, [sp, 636]
	lsl	x0, x0, 3
	add	x1, sp, 280
	ldr	x0, [x1, x0]
	mov	x1, x0
	adrp	x0, .LC32
	add	x0, x0, :lo12:.LC32
	bl	printf
	ldr	w0, [sp, 636]
	add	w0, w0, 1
	str	w0, [sp, 636]
.L36:
	ldr	w0, [sp, 636]
	cmp	w0, 9
	ble	.L37
	adrp	x0, .LC33
	add	x1, x0, :lo12:.LC33
	add	x0, sp, 240
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	ldr	x1, [x1, 32]
	str	q30, [x0]
	str	q31, [x0, 16]
	str	x1, [x0, 32]
	adrp	x0, .LC34
	add	x0, x0, :lo12:.LC34
	bl	printf
	str	wzr, [sp, 636]
	b	.L38
.L41:
	add	x1, sp, 240
	ldrsw	x0, [sp, 636]
	lsl	x0, x0, 3
	add	x5, x1, x0
	add	x1, sp, 280
	adrp	x0, cmp_str
	add	x4, x0, :lo12:cmp_str
	mov	x3, 8
	mov	x2, 10
	mov	x0, x5
	bl	bsearch
	str	x0, [sp, 608]
	ldr	x0, [sp, 608]
	cmp	x0, 0
	beq	.L39
	add	x0, sp, 280
	ldr	x1, [sp, 608]
	sub	x0, x1, x0
	asr	x0, x0, 3
	b	.L40
.L39:
	mov	w0, -1
.L40:
	mov	w1, w0
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	printf
	ldr	w0, [sp, 636]
	add	w0, w0, 1
	str	w0, [sp, 636]
.L38:
	ldr	w0, [sp, 636]
	cmp	w0, 4
	ble	.L41
	add	x4, sp, 280
	adrp	x0, cmp_rev
	add	x3, x0, :lo12:cmp_rev
	mov	x2, 8
	mov	x1, 10
	mov	x0, x4
	bl	qsort
	ldr	x0, [sp, 280]
	ldr	x1, [sp, 288]
	ldr	x2, [sp, 352]
	mov	x3, x2
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC35
	add	x0, x0, :lo12:.LC35
	bl	printf
	adrp	x0, .LC36
	add	x1, x0, :lo12:.LC36
	add	x0, sp, 192
	ldr	q29, [x1]
	ldr	q30, [x1, 16]
	ldr	q31, [x1, 26]
	str	q29, [x0]
	str	q30, [x0, 16]
	str	q31, [x0, 26]
	add	x0, sp, 192
	bl	strlen
	mov	x1, x0
	add	x4, sp, 192
	adrp	x0, cmp_uchar
	add	x3, x0, :lo12:cmp_uchar
	mov	x2, 1
	mov	x0, x4
	bl	qsort
	add	x0, sp, 192
	mov	x1, x0
	adrp	x0, .LC37
	add	x0, x0, :lo12:.LC37
	bl	printf
	adrp	x0, .LC17
	add	x1, x0, :lo12:.LC17
	add	x0, sp, 168
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	add	x4, sp, 168
	adrp	x0, cmp3
	add	x3, x0, :lo12:cmp3
	mov	x2, 3
	mov	x1, 8
	mov	x0, x4
	bl	qsort
	adrp	x0, .LC38
	add	x0, x0, :lo12:.LC38
	bl	printf
	str	wzr, [sp, 636]
	b	.L42
.L43:
	add	x2, sp, 168
	ldrsw	x1, [sp, 636]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	add	x0, x2, x0
	mov	x1, x0
	adrp	x0, .LC32
	add	x0, x0, :lo12:.LC32
	bl	printf
	ldr	w0, [sp, 636]
	add	w0, w0, 1
	str	w0, [sp, 636]
.L42:
	ldr	w0, [sp, 636]
	cmp	w0, 7
	ble	.L43
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	printf
	adrp	x0, .LC18
	add	x1, x0, :lo12:.LC18
	add	x0, sp, 40
	ldr	q24, [x1]
	ldr	q25, [x1, 16]
	ldr	q26, [x1, 32]
	ldr	q27, [x1, 48]
	ldr	q28, [x1, 64]
	ldr	q29, [x1, 80]
	ldr	q30, [x1, 96]
	ldr	q31, [x1, 112]
	str	q24, [x0]
	str	q25, [x0, 16]
	str	q26, [x0, 32]
	str	q27, [x0, 48]
	str	q28, [x0, 64]
	str	q29, [x0, 80]
	str	q30, [x0, 96]
	str	q31, [x0, 112]
	add	x4, sp, 40
	adrp	x0, cmp_rec
	add	x3, x0, :lo12:cmp_rec
	mov	x2, 16
	mov	x1, 8
	mov	x0, x4
	bl	qsort
	adrp	x0, .LC39
	add	x0, x0, :lo12:.LC39
	bl	printf
	str	wzr, [sp, 636]
	b	.L44
.L45:
	add	x1, sp, 40
	ldrsw	x0, [sp, 636]
	lsl	x0, x0, 4
	add	x4, x1, x0
	ldrsw	x0, [sp, 636]
	lsl	x0, x0, 4
	add	x1, sp, 50
	ldrsh	w0, [x1, x0]
	mov	w2, w0
	ldrsw	x0, [sp, 636]
	lsl	x0, x0, 4
	add	x1, sp, 52
	ldr	w0, [x1, x0]
	mov	w3, w0
	mov	x1, x4
	adrp	x0, .LC40
	add	x0, x0, :lo12:.LC40
	bl	printf
	ldr	w0, [sp, 636]
	add	w0, w0, 1
	str	w0, [sp, 636]
.L44:
	ldr	w0, [sp, 636]
	cmp	w0, 7
	ble	.L45
	add	x4, sp, 40
	adrp	x0, cmp_rec_id
	add	x3, x0, :lo12:cmp_rec_id
	mov	x2, 16
	mov	x1, 8
	mov	x0, x4
	bl	qsort
	adrp	x0, .LC19
	add	x1, x0, :lo12:.LC19
	add	x0, sp, 16
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	adrp	x0, .LC41
	add	x0, x0, :lo12:.LC41
	bl	printf
	str	wzr, [sp, 636]
	b	.L46
.L49:
	add	x1, sp, 16
	ldrsw	x0, [sp, 636]
	lsl	x0, x0, 2
	add	x5, x1, x0
	add	x1, sp, 40
	adrp	x0, cmp_key_id
	add	x4, x0, :lo12:cmp_key_id
	mov	x3, 16
	mov	x2, 8
	mov	x0, x5
	bl	bsearch
	str	x0, [sp, 616]
	ldrsw	x0, [sp, 636]
	lsl	x0, x0, 2
	add	x1, sp, 16
	ldr	w1, [x1, x0]
	ldr	x0, [sp, 616]
	cmp	x0, 0
	beq	.L47
	ldr	x0, [sp, 616]
	b	.L48
.L47:
	adrp	x0, .LC42
	add	x0, x0, :lo12:.LC42
.L48:
	mov	x2, x0
	adrp	x0, .LC43
	add	x0, x0, :lo12:.LC43
	bl	printf
	ldr	w0, [sp, 636]
	add	w0, w0, 1
	str	w0, [sp, 636]
.L46:
	ldr	w0, [sp, 636]
	cmp	w0, 5
	ble	.L49
	mov	w1, 16
	adrp	x0, .LC44
	add	x0, x0, :lo12:.LC44
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp]
	add	sp, sp, 640
	ret
	.section .rodata
	.align	3
.LC0:
	.word	42
	.word	-7
	.word	2147483647
	.word	0
	.word	13
	.word	-2147483648
	.word	42
	.word	-7
	.word	99
	.word	1
	.word	-1000000
	.word	13
	.word	5
	.word	8
	.word	0
	.word	77
	.align	3
.LC1:
	.word	-2147483648
	.word	-1000000
	.word	-8
	.word	0
	.word	7
	.word	8
	.word	42
	.word	98
	.word	99
	.word	2147483647
	.word	12345
	.align	3
.LC2:
	.quad	-9223372036854775808
	.quad	1
	.quad	-1
	.quad	4294967296
	.quad	0
	.quad	4294967295
	.quad	9223372036854775807
	.quad	3735928559
	.align	3
.LC3:
	.string	"pear"
	.align	3
.LC4:
	.string	"apple"
	.align	3
.LC5:
	.string	"fig"
	.align	3
.LC6:
	.string	"banana"
	.align	3
.LC7:
	.string	"kiwi"
	.align	3
.LC8:
	.string	"Apple"
	.align	3
.LC9:
	.string	""
	.align	3
.LC10:
	.string	"apricot"
	.align	3
.LC11:
	.string	"fig2"
	.align	3
.LC12:
	.string	"cherry"
	.align	3
.LC30:
	.quad	.LC3
	.quad	.LC4
	.quad	.LC5
	.quad	.LC6
	.quad	.LC7
	.quad	.LC8
	.quad	.LC9
	.quad	.LC10
	.quad	.LC11
	.quad	.LC12
	.align	3
.LC14:
	.string	"zucchini"
	.align	3
.LC15:
	.string	"fi"
	.align	3
.LC33:
	.quad	.LC7
	.quad	.LC8
	.quad	.LC9
	.quad	.LC14
	.quad	.LC15
	.align	3
.LC36:
	.string	"the quick brown fox jumps over a lazy dog"
	.align	3
.LC17:
	.string	"zb"
	.string	"ab"
	.string	"mq"
	.string	"a"
	.zero	1
	.string	"zz"
	.string	""
	.zero	2
	.string	"ma"
	.string	"b"
	.zero	1
	.align	3
.LC18:
	.string	"ola"
	.zero	6
	.hword	30
	.word	7
	.string	"ben"
	.zero	6
	.hword	25
	.word	3
	.string	"ada"
	.zero	6
	.hword	30
	.word	9
	.string	"ben"
	.zero	6
	.hword	25
	.word	1
	.string	"cy"
	.zero	7
	.hword	-2
	.word	40
	.string	"zed"
	.zero	6
	.hword	30
	.word	2
	.string	"ada"
	.zero	6
	.hword	30
	.word	5
	.string	"eve"
	.zero	6
	.hword	101
	.word	8
	.align	3
.LC19:
	.word	1
	.word	4
	.word	9
	.word	40
	.word	0
	.word	8
	.text

