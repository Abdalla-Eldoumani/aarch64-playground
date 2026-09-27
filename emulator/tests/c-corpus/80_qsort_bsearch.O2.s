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
	.align	2
	.p2align 5,,15
cmp_key_id:
	ldr	w2, [x0]
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
	.align	3
.LC22:
	.string	"\n"
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
	cbz	w20, .L9
	add	x20, x19, w20, uxtw 2
	str	x21, [sp, 32]
	adrp	x21, .LC21
	add	x21, x21, :lo12:.LC21
	.p2align 5,,15
.L10:
	ldr	w1, [x19], 4
	mov	x0, x21
	bl	printf
	cmp	x19, x20
	bne	.L10
	ldr	x21, [sp, 32]
.L9:
	adrp	x0, .LC22
	ldp	x19, x20, [sp, 16]
	add	x0, x0, :lo12:.LC22
	ldp	x29, x30, [sp], 48
	b	printf
	.align	2
	.p2align 5,,15
cmp_rec:
	ldrsh	w2, [x0, 10]
	ldrsh	w5, [x1, 10]
	cmp	w2, w5
	beq	.L17
	sub	w0, w2, w5
	ret
	.p2align 2,,3
.L17:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x20, x1
	mov	x19, x0
	bl	strcmp
	cbnz	w0, .L16
	ldr	w0, [x20, 12]
	ldr	w1, [x19, 12]
	cmp	w1, w0
	cset	w0, hi
	sbc	w0, w0, wzr
.L16:
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
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
	.section .rodata
	.align	3
.LC23:
	.string	"-"
	.align	3
.LC24:
	.string	"asc"
	.align	3
.LC25:
	.string	"uniq"
	.align	3
.LC26:
	.string	"find:"
	.align	3
.LC27:
	.string	" %d\n"
	.align	3
.LC28:
	.string	"first after n=1 and n=0: %d\n"
	.align	3
.LC29:
	.string	"ulong:"
	.align	3
.LC30:
	.string	" %lx"
	.align	3
.LC32:
	.string	"str:"
	.align	3
.LC33:
	.string	" [%s]"
	.align	3
.LC35:
	.string	"\nstr find:"
	.align	3
.LC36:
	.string	"\nrev: %s %s [%s]\n"
	.align	3
.LC38:
	.string	"bytes: [%s]\n"
	.align	3
.LC39:
	.string	"tri:"
	.align	3
.LC40:
	.string	"rec:"
	.align	3
.LC41:
	.string	" %s/%d/%u"
	.align	3
.LC42:
	.string	"\nby id:"
	.align	3
.LC43:
	.string	" %u=%s"
	.align	3
.LC44:
	.string	"\nsizeof rec %d\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #688
	mov	x2, 4
	add	x0, sp, 288
	mov	x1, 16
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x21, x22, [sp, 32]
	adrp	x21, .LANCHOR0
	add	x21, x21, :lo12:.LANCHOR0
	adrp	x22, cmp_int
	add	x22, x22, :lo12:cmp_int
	mov	x3, x22
	stp	x19, x20, [sp, 16]
	add	x19, sp, 352
	ldp	q29, q28, [x21]
	stp	x23, x24, [sp, 48]
	ldp	q31, q30, [x21, 32]
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	stp	q29, q28, [sp, 288]
	stp	q31, q30, [sp, 320]
	bl	qsort
	add	x1, sp, 288
	mov	w2, 16
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	show_ints
	mov	w0, 0
	add	w24, w0, 1
	sbfiz	x0, x0, 2, 32
	ldr	w3, [sp, 288]
	add	x1, sp, 288
	add	x1, x1, 4
	str	w3, [x19, x0]
	cmp	x1, x19
	beq	.L27
.L50:
	ldr	w3, [x1]
	ldr	w2, [x19, x0]
	cmp	w2, w3
	beq	.L26
	mov	w0, w24
	add	x1, x1, 4
	add	w24, w0, 1
	sbfiz	x0, x0, 2, 32
	str	w3, [x19, x0]
	cmp	x1, x19
	bne	.L50
.L27:
	mov	w2, w24
	mov	x1, x19
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	show_ints
	adrp	x23, .LC21
	ldp	q30, q29, [x21, 64]
	add	x0, sp, 268
	ldr	q31, [x21, 92]
	sxtw	x24, w24
	stp	q30, q29, [sp, 240]
	add	x20, sp, 240
	add	x25, sp, 284
	add	x23, x23, :lo12:.LC21
	str	q31, [x0]
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	printf
	.p2align 5,,15
.L30:
	mov	x1, x19
	mov	x4, x22
	mov	x2, x24
	mov	x0, x20
	mov	x3, 4
	bl	bsearch
	cmp	x0, 0
	sub	x1, x0, x19
	add	x20, x20, 4
	mov	x0, x23
	asr	x1, x1, 2
	csinv	w1, w1, wzr, ne
	bl	printf
	cmp	x20, x25
	bne	.L30
	mov	x4, x22
	mov	x1, x19
	mov	x3, 4
	mov	x2, 0
	add	x0, sp, 240
	bl	bsearch
	cmp	x0, 0
	adrp	x0, .LC27
	cset	w1, eq
	add	x0, x0, :lo12:.LC27
	add	x19, sp, 416
	add	x20, sp, 480
	bl	printf
	mov	x3, x22
	add	x0, sp, 288
	mov	x2, 4
	mov	x1, 1
	bl	qsort
	mov	x3, x22
	mov	x2, 4
	add	x0, sp, 288
	mov	x1, 0
	bl	qsort
	adrp	x22, .LC30
	ldr	w1, [sp, 288]
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	add	x22, x22, :lo12:.LC30
	bl	printf
	ldp	q29, q28, [x21, 112]
	mov	x2, 8
	ldp	q31, q30, [x21, 144]
	mov	x1, x2
	adrp	x3, cmp_ulong
	add	x3, x3, :lo12:cmp_ulong
	add	x0, sp, 416
	stp	q29, q28, [sp, 416]
	stp	q31, q30, [sp, 448]
	bl	qsort
	adrp	x0, .LC29
	add	x0, x0, :lo12:.LC29
	bl	printf
	.p2align 5,,15
.L31:
	ldr	x1, [x19], 8
	mov	x0, x22
	bl	printf
	cmp	x19, x20
	bne	.L31
	adrp	x26, .LC22
	add	x26, x26, :lo12:.LC22
	mov	x0, x26
	bl	printf
	ldr	q31, [x21, 240]
	adrp	x27, cmp_str
	ldp	q28, q27, [x21, 176]
	add	x27, x27, :lo12:cmp_str
	ldp	q30, q29, [x21, 208]
	mov	x3, x27
	mov	x2, 8
	mov	x1, 10
	mov	x0, x20
	stp	q28, q27, [x20]
	adrp	x24, .LC33
	stp	q30, q29, [x20, 32]
	mov	x19, x20
	add	x22, sp, 560
	str	q31, [x20, 64]
	bl	qsort
	adrp	x0, .LC32
	add	x24, x24, :lo12:.LC33
	add	x0, x0, :lo12:.LC32
	bl	printf
	.p2align 5,,15
.L32:
	ldr	x1, [x19], 8
	mov	x0, x24
	bl	printf
	cmp	x19, x22
	bne	.L32
	ldp	q31, q30, [x21, 256]
	add	x25, sp, 152
	ldr	x0, [x21, 288]
	mov	x19, x25
	add	x28, sp, 192
	stp	q31, q30, [x25]
	str	x0, [x25, 32]
	adrp	x0, .LC35
	add	x0, x0, :lo12:.LC35
	bl	printf
.L34:
	mov	x1, x20
	mov	x4, x27
	mov	x0, x19
	mov	x3, 8
	mov	x2, 10
	bl	bsearch
	cmp	x0, 0
	sub	x1, x0, x20
	add	x19, x19, 8
	mov	x0, x23
	asr	x1, x1, 3
	csinv	w1, w1, wzr, ne
	bl	printf
	cmp	x19, x28
	bne	.L34
	mov	x0, x20
	mov	x2, 8
	mov	x1, 10
	adrp	x3, cmp_rev
	add	x3, x3, :lo12:cmp_rev
	bl	qsort
	ldp	x1, x2, [sp, 480]
	adrp	x0, .LC36
	ldr	x3, [sp, 552]
	add	x0, x0, :lo12:.LC36
	add	x20, sp, 128
	bl	printf
	adrp	x0, .LC37
	add	x0, x0, :lo12:.LC37
	ldp	q30, q29, [x0]
	ldr	q31, [x0, 26]
	mov	x0, x19
	stp	q30, q29, [x19]
	str	q31, [x19, 26]
	bl	strlen
	adrp	x3, cmp_uchar
	add	x3, x3, :lo12:cmp_uchar
	mov	x2, 1
	mov	x1, x0
	mov	x0, x19
	bl	qsort
	mov	x1, x19
	adrp	x0, .LC38
	add	x0, x0, :lo12:.LC38
	bl	printf
	add	x0, x21, 296
	mov	x1, 8
	add	x19, sp, 104
	ldp	x2, x3, [x0]
	stp	x2, x3, [sp, 104]
	ldr	x0, [x21, 312]
	adrp	x3, cmp3
	add	x3, x3, :lo12:cmp3
	mov	x2, 3
	str	x0, [sp, 120]
	add	x0, sp, 104
	bl	qsort
	adrp	x0, .LC39
	add	x0, x0, :lo12:.LC39
	bl	printf
	.p2align 5,,15
.L35:
	mov	x1, x19
	mov	x0, x24
	add	x19, x19, 3
	bl	printf
	cmp	x19, x20
	bne	.L35
	mov	x0, x26
	bl	printf
	ldp	q25, q24, [x21, 320]
	adrp	x3, cmp_rec
	ldp	q27, q26, [x21, 352]
	add	x3, x3, :lo12:cmp_rec
	ldp	q29, q28, [x21, 384]
	adrp	x23, .LC41
	ldp	q31, q30, [x21, 416]
	mov	x19, x22
	add	x23, x23, :lo12:.LC41
	mov	x2, 16
	mov	x1, 8
	mov	x0, x22
	stp	q25, q24, [x22]
	stp	q27, q26, [x22, 32]
	stp	q29, q28, [x22, 64]
	stp	q31, q30, [x22, 96]
	bl	qsort
	adrp	x0, .LC40
	add	x0, x0, :lo12:.LC40
	bl	printf
	.p2align 5,,15
.L36:
	ldrsh	w2, [x19, 10]
	mov	x1, x19
	ldr	w3, [x19, 12]
	mov	x0, x23
	add	x19, x19, 16
	bl	printf
	add	x0, sp, 688
	cmp	x19, x0
	bne	.L36
	mov	x0, x22
	mov	x2, 16
	mov	x1, 8
	adrp	x3, cmp_rec_id
	add	x3, x3, :lo12:cmp_rec_id
	bl	qsort
	ldp	x2, x3, [x21, 448]
	mov	x19, x20
	ldr	x0, [x21, 464]
	adrp	x23, cmp_key_id
	adrp	x21, .LC43
	add	x23, x23, :lo12:cmp_key_id
	add	x21, x21, :lo12:.LC43
	str	x0, [x20, 16]
	adrp	x20, .LC23
	add	x20, x20, :lo12:.LC23
	adrp	x0, .LC42
	add	x0, x0, :lo12:.LC42
	stp	x2, x3, [sp, 128]
	bl	printf
	.p2align 5,,15
.L38:
	mov	x1, x22
	mov	x0, x19
	mov	x2, 8
	mov	x4, x23
	mov	x3, 16
	bl	bsearch
	cmp	x0, 0
	ldr	w1, [x19], 4
	csel	x2, x20, x0, eq
	mov	x0, x21
	bl	printf
	cmp	x25, x19
	bne	.L38
	mov	w1, 16
	adrp	x0, .LC44
	add	x0, x0, :lo12:.LC44
	bl	printf
	ldp	x29, x30, [sp]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	add	sp, sp, 688
	ret
	.p2align 2,,3
.L26:
	add	x1, x1, 4
	cmp	x1, x19
	bne	.L50
	b	.L27
	.section .rodata
	.align	3
.LC37:
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
	.align	3
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
.LC31:
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
.LC34:
	.xword	.LC7
	.xword	.LC8
	.xword	.LC9
	.xword	.LC14
	.xword	.LC15
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
.LC19:
	.word	1
	.word	4
	.word	9
	.word	40
	.word	0
	.word	8

