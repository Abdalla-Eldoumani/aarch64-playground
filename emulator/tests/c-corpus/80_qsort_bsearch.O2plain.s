	.text
	.align	2
	.p2align 5,,15
cmp_int:
	ldr	w2, [x0]
	ldr	w0, [x1]
	cmp	w2, w0
	cset	w1, gt
	cset	w0, lt
	sub	w0, w1, w0
	ret
	.align	2
	.p2align 5,,15
cmp_ulong:
	ldr	x2, [x0]
	ldr	x0, [x1]
	cmp	x2, x0
	cset	w0, hi
	sbc	w0, w0, wzr
	ret
	.align	2
	.p2align 5,,15
cmp_rev:
	mov	x2, x0
	mov	x0, x1
	mov	x1, x2
	b	cmp_str
	.align	2
	.p2align 5,,15
cmp_uchar:
	ldrb	w2, [x0]
	ldrb	w0, [x1]
	sub	w0, w2, w0
	ret
	.align	2
	.p2align 5,,15
cmp_rec_id:
	ldr	w2, [x0, 12]
	ldr	w0, [x1, 12]
	cmp	w2, w0
	cset	w0, hi
	sbc	w0, w0, wzr
	ret
	.section .rodata
	.align	3
.LC20:
	.string	"%s:"
	.align	3
.LC21:
	.string	" %d"
	.text
	.align	2
	.p2align 5,,15
show_ints:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x1
	mov	w20, w2
	mov	x1, x0
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	printf
	cbz	w20, .L8
	add	x20, x19, w20, uxtw 2
	str	x21, [sp, 32]
	adrp	x21, .LC21
	add	x21, x21, :lo12:.LC21
	.p2align 5,,15
.L9:
	ldr	w1, [x19], 4
	mov	x0, x21
	bl	printf
	cmp	x19, x20
	bne	.L9
	ldr	x21, [sp, 32]
.L8:
	mov	w0, 10
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 48
	b	putchar
	.align	2
	.p2align 5,,15
cmp_str:
	ldr	x0, [x0]
	ldr	x1, [x1]
	b	strcmp
	.align	2
	.p2align 5,,15
cmp3:
	mov	x2, 3
	b	memcmp
	.align	2
	.p2align 5,,15
cmp_rec:
	ldrsh	w2, [x0, 10]
	ldrsh	w5, [x1, 10]
	cmp	w2, w5
	beq	.L18
	sub	w0, w2, w5
	ret
	.p2align 2,,3
.L18:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x20, x1
	mov	x19, x0
	bl	strcmp
	cbnz	w0, .L17
	ldr	w0, [x20, 12]
	ldr	w1, [x19, 12]
	cmp	w1, w0
	cset	w0, hi
	sbc	w0, w0, wzr
.L17:
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
	.section .rodata
	.align	3
.LC22:
	.string	"-"
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
.LC40:
	.string	"tri:"
	.align	3
.LC41:
	.string	"rec:"
	.align	3
.LC42:
	.string	" %s/%d/%u"
	.align	3
.LC45:
	.string	"\nby id:"
	.align	3
.LC46:
	.string	" %u=%s"
	.align	3
.LC47:
	.string	"\nsizeof rec %d\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #704
	adrp	x0, .LANCHOR0
	mov	x2, 4
	mov	x1, 16
	stp	x29, x30, [sp]
	mov	x29, sp
	ldr	q29, [x0, :lo12:.LANCHOR0]
	stp	x19, x20, [sp, 16]
	add	x19, x0, :lo12:.LANCHOR0
	stp	x21, x22, [sp, 32]
	adrp	x22, cmp_int
	add	x22, x22, :lo12:cmp_int
	ldr	q30, [x19, 48]
	mov	x3, x22
	ldp	q28, q31, [x19, 16]
	add	x0, sp, 304
	stp	x23, x24, [sp, 48]
	add	x23, sp, 368
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	stp	q29, q28, [sp, 304]
	stp	q31, q30, [sp, 336]
	bl	qsort
	add	x1, sp, 304
	mov	w2, 16
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	bl	show_ints
	mov	w0, 0
	add	w25, w0, 1
	sbfiz	x0, x0, 2, 32
	ldr	w3, [sp, 304]
	add	x1, sp, 304
	add	x1, x1, 4
	str	w3, [x23, x0]
	cmp	x1, x23
	beq	.L26
.L62:
	ldr	w3, [x1]
	ldr	w2, [x23, x0]
	cmp	w2, w3
	beq	.L25
	mov	w0, w25
	add	x1, x1, 4
	add	w25, w0, 1
	sbfiz	x0, x0, 2, 32
	str	w3, [x23, x0]
	cmp	x1, x23
	bne	.L62
.L26:
	mov	w2, w25
	mov	x1, x23
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	show_ints
	add	x24, sp, 256
	ldp	q29, q30, [x19, 64]
	add	x0, sp, 284
	ldr	q31, [x19, 92]
	add	x21, sp, 300
	stp	q29, q30, [sp, 256]
	adrp	x20, .LC21
	str	q31, [x0]
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	printf
	add	x0, x20, :lo12:.LC21
	str	x0, [sp, 104]
	.p2align 5,,15
.L31:
	ldr	w7, [x24]
	sxtw	x1, w25
	mov	x5, x23
	.p2align 5,,15
.L30:
	lsr	x3, x1, 1
	add	x6, x5, x3, lsl 2
	ldr	w0, [x5, x3, lsl 2]
	cmp	w7, w0
	cset	w0, gt
	cset	w4, lt
	subs	w0, w0, w4
	beq	.L28
	cmp	w0, 1
	bne	.L49
	sub	x1, x1, #1
	add	x5, x6, 4
	lsr	x1, x1, 1
	cbnz	x1, .L30
.L63:
	mov	w1, -1
.L48:
	ldr	x0, [sp, 104]
	add	x24, x24, 4
	bl	printf
	cmp	x24, x21
	bne	.L31
	mov	w1, 1
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	printf
	mov	x3, x22
	add	x0, sp, 304
	mov	x2, 4
	mov	x1, 1
	bl	qsort
	add	x21, sp, 432
	mov	x3, x22
	mov	x2, 4
	add	x0, sp, 304
	mov	x1, 0
	bl	qsort
	adrp	x22, .LC29
	ldr	w1, [sp, 304]
	adrp	x0, .LC27
	add	x0, x0, :lo12:.LC27
	add	x25, sp, 496
	add	x22, x22, :lo12:.LC29
	bl	printf
	ldp	q29, q28, [x19, 112]
	mov	x2, 8
	ldp	q31, q30, [x19, 144]
	mov	x1, x2
	adrp	x3, cmp_ulong
	add	x3, x3, :lo12:cmp_ulong
	add	x0, sp, 432
	stp	q29, q28, [sp, 432]
	stp	q31, q30, [sp, 464]
	bl	qsort
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	bl	printf
	.p2align 5,,15
.L32:
	ldr	x1, [x21], 8
	mov	x0, x22
	bl	printf
	cmp	x25, x21
	bne	.L32
	mov	w0, 10
	bl	putchar
	ldr	q31, [x19, 240]
	adrp	x3, cmp_str
	ldp	q28, q27, [x19, 176]
	add	x3, x3, :lo12:cmp_str
	ldp	q30, q29, [x19, 208]
	mov	x2, 8
	mov	x1, 10
	mov	x0, x25
	stp	q28, q27, [x25]
	adrp	x26, .LC32
	mov	x21, x25
	stp	q30, q29, [x25, 32]
	add	x23, sp, 576
	add	x26, x26, :lo12:.LC32
	str	q31, [x25, 64]
	bl	qsort
	adrp	x0, .LC31
	add	x0, x0, :lo12:.LC31
	bl	printf
	.p2align 5,,15
.L33:
	ldr	x1, [x21], 8
	mov	x0, x26
	bl	printf
	cmp	x23, x21
	bne	.L33
	ldp	q31, q30, [x19, 256]
	add	x1, sp, 168
	ldr	x0, [x19, 288]
	add	x27, sp, 168
	stp	q31, q30, [x1]
	str	x0, [sp, 200]
	adrp	x0, .LC34
	add	x0, x0, :lo12:.LC34
	bl	printf
.L34:
	ldr	x22, [x27]
	mov	x24, x25
	mov	x28, 10
	.p2align 5,,15
.L37:
	lsr	x20, x28, 1
	mov	x0, x22
	add	x21, x24, x20, lsl 3
	ldr	x1, [x24, x20, lsl 3]
	bl	strcmp
	cmp	w0, 0
	cbz	w0, .L35
	ble	.L50
	sub	x2, x28, #1
	add	x24, x21, 8
	lsr	x28, x2, 1
	cbnz	x28, .L37
.L65:
	mov	w1, -1
.L47:
	ldr	x0, [sp, 104]
	add	x27, x27, 8
	bl	printf
	add	x0, sp, 208
	cmp	x0, x27
	bne	.L34
	mov	x0, x25
	mov	x2, 8
	mov	x1, 10
	adrp	x3, cmp_rev
	add	x3, x3, :lo12:cmp_rev
	bl	qsort
	ldp	x1, x2, [sp, 496]
	adrp	x0, .LC35
	ldr	x3, [sp, 568]
	add	x0, x0, :lo12:.LC35
	add	x20, sp, 112
	add	x21, sp, 136
	bl	printf
	adrp	x0, .LC36
	add	x0, x0, :lo12:.LC36
	adrp	x3, cmp_uchar
	add	x3, x3, :lo12:cmp_uchar
	mov	x2, 1
	mov	x1, 41
	ldp	q30, q29, [x0]
	ldr	q31, [x0, 26]
	add	x0, sp, 208
	stp	q30, q29, [sp, 208]
	str	q31, [sp, 234]
	bl	qsort
	add	x1, sp, 208
	adrp	x0, .LC37
	add	x0, x0, :lo12:.LC37
	bl	printf
	ldr	q31, [x19, 304]
	adrp	x3, cmp3
	add	x3, x3, :lo12:cmp3
	mov	x2, 3
	mov	x1, 8
	add	x0, sp, 112
	str	q31, [sp, 112]
	ldr	d31, [x19, 320]
	str	d31, [sp, 128]
	bl	qsort
	adrp	x0, .LC40
	add	x0, x0, :lo12:.LC40
	bl	printf
	.p2align 5,,15
.L39:
	mov	x1, x20
	mov	x0, x26
	add	x20, x20, 3
	bl	printf
	cmp	x21, x20
	bne	.L39
	mov	w0, 10
	bl	putchar
	add	x0, x19, 328
	adrp	x3, cmp_rec
	adrp	x21, .LC42
	add	x3, x3, :lo12:cmp_rec
	mov	x20, x23
	add	x21, x21, :lo12:.LC42
	ldp	q25, q24, [x0]
	mov	x2, 16
	ldp	q27, q26, [x0, 32]
	mov	x1, 8
	ldp	q29, q28, [x0, 64]
	stp	q25, q24, [x23]
	ldp	q31, q30, [x0, 96]
	mov	x0, x23
	stp	q27, q26, [x23, 32]
	stp	q29, q28, [x23, 64]
	stp	q31, q30, [x23, 96]
	bl	qsort
	adrp	x0, .LC41
	add	x0, x0, :lo12:.LC41
	bl	printf
	.p2align 5,,15
.L40:
	ldrsh	w2, [x20, 10]
	mov	x1, x20
	ldr	w3, [x20, 12]
	mov	x0, x21
	add	x20, x20, 16
	bl	printf
	add	x0, sp, 704
	cmp	x20, x0
	bne	.L40
	mov	x0, x23
	adrp	x3, cmp_rec_id
	mov	x2, 16
	add	x3, x3, :lo12:cmp_rec_id
	mov	x1, 8
	bl	qsort
	ldr	q31, [x19, 464]
	adrp	x0, .LC45
	add	x21, sp, 144
	add	x0, x0, :lo12:.LC45
	adrp	x20, .LC22
	str	q31, [sp, 144]
	ldr	d31, [x19, 480]
	adrp	x19, .LC46
	add	x19, x19, :lo12:.LC46
	str	d31, [sp, 160]
	bl	printf
	.p2align 5,,15
.L41:
	ldr	w1, [x21]
	mov	x5, x23
	mov	x3, 8
	.p2align 5,,15
.L44:
	lsr	x4, x3, 1
	add	x2, x5, x4, lsl 4
	ldr	w0, [x2, 12]
	cmp	w1, w0
	cset	w0, hi
	sbc	w0, w0, wzr
	cbz	w0, .L46
	cmp	w0, 1
	bne	.L51
	sub	x3, x3, #1
	add	x5, x2, 16
	lsr	x3, x3, 1
	cbnz	x3, .L44
.L64:
	add	x2, x20, :lo12:.LC22
.L46:
	mov	x0, x19
	bl	printf
	add	x21, x21, 4
	add	x0, sp, 168
	cmp	x21, x0
	bne	.L41
	mov	w1, 16
	adrp	x0, .LC47
	add	x0, x0, :lo12:.LC47
	bl	printf
	ldp	x29, x30, [sp]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	add	sp, sp, 704
	ret
	.p2align 2,,3
.L49:
	mov	x1, x3
	cbnz	x1, .L30
	b	.L63
	.p2align 2,,3
.L51:
	mov	x3, x4
	cbnz	x3, .L44
	b	.L64
	.p2align 2,,3
.L50:
	mov	x28, x20
	cbnz	x28, .L37
	b	.L65
	.p2align 2,,3
.L28:
	sub	x1, x6, x23
	ubfx	x1, x1, 2, 32
	b	.L48
	.p2align 2,,3
.L35:
	sub	x1, x21, x25
	ubfx	x1, x1, 3, 32
	b	.L47
	.p2align 2,,3
.L25:
	add	x1, x1, 4
	cmp	x1, x23
	bne	.L62
	b	.L26
	.section .rodata
	.align	3
.LC36:
	.string	"the quick brown fox jumps over a lazy dog"
	.text
	.section .rodata
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
.LC14:
	.string	"zucchini"
	.align	3
.LC15:
	.string	"fi"
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
.LC10:
	.string	"apricot"
	.align	3
.LC11:
	.string	"fig2"
	.align	3
.LC12:
	.string	"cherry"
	.section .rodata
	.align	4
	.LANCHOR0:
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
	.zero	4
.LC2:
	.xword	-9223372036854775808
	.xword	1
	.xword	-1
	.xword	4294967296
	.xword	0
	.xword	4294967295
	.xword	9223372036854775807
	.xword	3735928559
.LC30:
	.xword	.LC3
	.xword	.LC4
	.xword	.LC5
	.xword	.LC6
	.xword	.LC7
	.xword	.LC8
	.xword	.LC9
	.xword	.LC10
	.xword	.LC11
	.xword	.LC12
.LC33:
	.xword	.LC7
	.xword	.LC8
	.xword	.LC9
	.xword	.LC14
	.xword	.LC15
	.zero	8
.LC38:
	.byte	122
	.byte	98
	.byte	0
	.byte	97
	.byte	98
	.byte	0
	.byte	109
	.byte	113
	.byte	0
	.byte	97
	.byte	0
	.byte	0
	.byte	122
	.byte	122
	.byte	0
	.byte	0
.LC39:
	.byte	0
	.byte	0
	.byte	109
	.byte	97
	.byte	0
	.byte	98
	.byte	0
	.byte	0
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
	.zero	8
.LC43:
	.word	1
	.word	4
	.word	9
	.word	40
.LC44:
	.word	0
	.word	8

