	.text
	.align	2
	.p2align 5,,15
lsort:
	cbz	x0, .L27
	ldr	x2, [x0, 8]
	mov	x4, x0
	mov	x3, x2
	cbz	x2, .L31
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	b	.L3
	.p2align 2,,3
.L33:
	mov	x3, x19
.L3:
	ldr	x2, [x2, 8]
	cbz	x2, .L32
	ldr	x2, [x2, 8]
	mov	x4, x3
	ldr	x19, [x3, 8]
	cbnz	x2, .L33
.L5:
	str	xzr, [x3, 8]
	mov	x22, x1
	bl	lsort
	mov	x20, x0
	mov	x1, x22
	mov	x0, x19
	bl	lsort
	mov	x19, x0
	cmp	x20, 0
	ccmp	x0, 0, 4, ne
	beq	.L13
	add	x21, sp, 48
	.p2align 5,,15
.L10:
	mov	x1, x20
	mov	x0, x19
	blr	x22
	cbz	w0, .L8
.L35:
	str	x19, [x21, 8]
	ldr	x1, [x19, 8]
	cbz	x1, .L34
	mov	x21, x19
	mov	x19, x1
	mov	x0, x19
	mov	x1, x20
	blr	x22
	cbnz	w0, .L35
.L8:
	str	x20, [x21, 8]
	ldr	x0, [x20, 8]
	cbz	x0, .L15
	mov	x21, x20
	mov	x20, x0
	b	.L10
	.p2align 2,,3
.L32:
	mov	x19, x3
	mov	x3, x4
	b	.L5
	.p2align 2,,3
.L15:
	mov	x1, x19
	mov	x19, x20
.L16:
	mov	x0, x1
	str	x0, [x19, 8]
	ldr	x0, [sp, 56]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.p2align 2,,3
.L34:
	mov	x0, x20
	cbz	x20, .L16
.L30:
	str	x0, [x19, 8]
	ldr	x0, [sp, 56]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.p2align 2,,3
.L27:
	ret
	.p2align 2,,3
.L31:
	ret
	.p2align 2,,3
.L13:
	mov	x1, x0
	add	x19, sp, 48
	mov	x0, x20
	cbnz	x20, .L30
	b	.L16
	.align	2
	.p2align 5,,15
asc:
	ldr	w2, [x0]
	ldr	w0, [x1]
	cmp	w2, w0
	cset	w0, lt
	ret
	.align	2
	.p2align 5,,15
odd_first:
	ldr	w2, [x0]
	ldr	w0, [x1]
	and	w2, w2, 1
	and	w0, w0, 1
	cmp	w2, w0
	cset	w0, gt
	ret
	.section .rodata
	.align	3
.LC9:
	.string	" CORRUPT"
	.align	3
.LC3:
	.string	""
	.align	3
.LC10:
	.string	"%s:"
	.align	3
.LC11:
	.string	" %d"
	.align	3
.LC12:
	.string	" (len %d%s)\n"
	.text
	.align	2
	.p2align 5,,15
show:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x1
	mov	x1, x0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	cbz	x19, .L41
	stp	x21, x22, [sp, 32]
	adrp	x22, .LC11
	add	x22, x22, :lo12:.LC11
	mov	w21, 0
	mov	w20, 0
	.p2align 5,,15
.L40:
	ldr	w1, [x19]
	mov	x0, x22
	add	w20, w20, 1
	bl	printf
	ldp	w0, w1, [x19]
	ldr	x19, [x19, 8]
	mvn	w0, w0
	cmp	w0, w1
	cinc	w21, w21, ne
	cbnz	x19, .L40
	cmp	w21, 0
	adrp	x0, .LC3
	ldp	x21, x22, [sp, 32]
	add	x0, x0, :lo12:.LC3
	adrp	x2, .LC9
	add	x2, x2, :lo12:.LC9
	csel	x2, x2, x0, ne
.L39:
	mov	w1, w20
	adrp	x0, .LC12
	ldp	x19, x20, [sp, 16]
	add	x0, x0, :lo12:.LC12
	ldp	x29, x30, [sp], 48
	b	printf
.L41:
	adrp	x2, .LC3
	mov	w20, 0
	add	x2, x2, :lo12:.LC3
	b	.L39
	.align	2
	.p2align 5,,15
insert_sorted:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	w20, w1
	mov	x19, x0
	str	x21, [sp, 32]
	add	x21, sp, 56
	str	x0, [sp, 56]
	cbnz	x0, .L46
	b	.L47
	.p2align 2,,3
.L48:
	add	x21, x19, 8
	ldr	x19, [x19, 8]
	cbz	x19, .L47
.L46:
	ldr	w0, [x19]
	cmp	w0, w20
	blt	.L48
.L47:
	mov	x0, 16
	bl	malloc
	mvn	w1, w20
	stp	w20, w1, [x0]
	str	x19, [x0, 8]
	str	x0, [x21]
	ldr	x21, [sp, 32]
	ldr	x0, [sp, 56]
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	3
.LC13:
	.string	"built"
	.align	3
.LC14:
	.string	"reversed"
	.align	3
.LC15:
	.string	"sorted"
	.align	3
.LC16:
	.string	"inserted"
	.align	3
.LC17:
	.string	"freed %d\n"
	.align	3
.LC18:
	.string	"odd first, stable, appended"
	.align	3
.LC19:
	.string	"round %d: kept %d sum %ld ok %d\n"
	.align	3
.LC20:
	.string	"dlist fwd:"
	.align	3
.LC21:
	.string	" | back:"
	.align	3
.LC23:
	.string	"josephus:"
	.align	3
.LC24:
	.string	" ... survivor %d\n"
	.align	3
.LC26:
	.string	"words:"
	.align	3
.LC27:
	.string	" %s/%d"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #560
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x21, x22, [sp, 32]
	adrp	x21, .LANCHOR0
	mov	w22, 100
	stp	x23, x24, [sp, 48]
	mov	w23, 34079
	mov	w24, 12345
	stp	x25, x26, [sp, 64]
	mov	w25, 20077
	mov	w26, 12
	stp	x27, x28, [sp, 80]
	movk	w25, 0x41c6, lsl 16
	ldr	w27, [x21, :lo12:.LANCHOR0]
	add	x21, x21, :lo12:.LANCHOR0
	movk	w23, 0x51eb, lsl 16
	stp	x19, x20, [sp, 16]
	mov	x20, 0
	.p2align 5,,15
.L56:
	madd	w27, w27, w25, w24
	mov	x28, x20
	str	w27, [x21]
	lsr	w0, w27, 16
	umull	x19, w0, w23
	lsr	x19, x19, 37
	msub	w19, w19, w22, w0
	mov	x0, 16
	bl	malloc
	mov	x20, x0
	sub	w19, w19, #30
	subs	w26, w26, #1
	mvn	w0, w19
	stp	w19, w0, [x20]
	str	x28, [x20, 8]
	bne	.L56
	mov	x1, x20
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	show
	mov	x1, 0
	b	.L57
	.p2align 2,,3
.L104:
	mov	x20, x0
.L57:
	ldr	x0, [x20, 8]
	str	x1, [x20, 8]
	mov	x1, x20
	cbnz	x0, .L104
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	show
	mov	w25, 0
	mov	x0, x20
	adrp	x1, asc
	add	x1, x1, :lo12:asc
	bl	lsort
	mov	x19, x0
	mov	x1, x0
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	show
	mov	x0, x19
	mov	w1, -1000
	bl	insert_sorted
	mov	w1, 1000
	bl	insert_sorted
	ldr	x1, [x0, 8]
	ldr	w1, [x1]
	bl	insert_sorted
	mov	x19, x0
	mov	x1, x0
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	show
	add	x0, sp, 160
	str	x0, [sp, 96]
	str	x19, [sp, 160]
	cbz	x19, .L58
	mov	w24, 43691
	mov	w22, 43690
	mov	x20, x0
	movk	w24, 0xaaaa, lsl 16
	movk	w22, 0x2aaa, lsl 16
	mov	w21, 1431655765
	b	.L61
	.p2align 2,,3
.L59:
	add	x20, x19, 8
	ldr	x19, [x20]
	cbz	x19, .L58
.L61:
	ldr	w0, [x19]
	madd	w0, w0, w24, w22
	cmp	w0, w21
	bcs	.L59
	ldr	x0, [x19, 8]
	str	x0, [x20]
	mov	x0, x19
	add	w25, w25, 1
	bl	free
	ldr	x19, [x20]
	cbnz	x19, .L61
.L58:
	ldr	x19, [sp, 160]
	mov	w1, w25
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	mov	x0, x19
	adrp	x1, odd_first
	add	x1, x1, :lo12:odd_first
	bl	lsort
	str	x0, [sp, 120]
	cbz	x0, .L106
	.p2align 5,,15
.L63:
	mov	x1, x0
	ldr	x0, [x0, 8]
	cbnz	x0, .L63
	add	x19, x1, 8
.L64:
	mov	x0, 16
	bl	malloc
	mvn	w1, w26
	stp	w26, w1, [x0]
	str	xzr, [x0, 8]
	add	w26, w26, 111
	str	x0, [x19]
	add	x19, x0, 8
	cmp	w26, 333
	bne	.L64
	ldr	x19, [sp, 120]
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	mov	x1, x19
	bl	show
	cbz	x19, .L65
	.p2align 5,,15
.L66:
	mov	x0, x19
	ldr	x19, [x19, 8]
	bl	free
	cbnz	x19, .L66
.L65:
	adrp	x25, .LC19
	mov	w21, 3500
	add	x0, x25, :lo12:.LC19
	mov	w22, 0
	str	x0, [sp, 104]
.L67:
	mov	w19, w22
	mov	x0, 0
	.p2align 5,,15
.L68:
	mov	x20, x0
	mov	x0, 16
	bl	malloc
	str	x20, [x0, 8]
	mvn	w1, w19
	stp	w19, w1, [x0]
	add	w19, w19, 7
	cmp	w21, w19
	bne	.L68
	add	w1, w22, 3493
	mov	w2, 5
	mov	x26, 0
	sdiv	w2, w1, w2
	add	w2, w2, w2, lsl 2
	sub	w1, w1, w2
	cmp	w1, w22
	bne	.L69
	.p2align 5,,15
.L141:
	str	x26, [x0, 8]
	mov	x26, x0
	cbz	x20, .L71
.L142:
	ldr	w1, [x20]
	mov	w2, 5
	mov	x0, x20
	ldr	x20, [x20, 8]
	sdiv	w2, w1, w2
	add	w2, w2, w2, lsl 2
	sub	w1, w1, w2
	cmp	w1, w22
	beq	.L141
.L69:
	bl	free
	cbnz	x20, .L142
.L71:
	ldr	x28, [sp, 96]
	mov	x23, 8
	mov	w27, 0
	mov	x19, x28
	.p2align 5,,15
.L73:
	mov	x0, x23
	bl	malloc
	str	x0, [x28], 8
	mov	x2, x23
	mov	w1, w27
	add	w27, w27, 1
	bl	memset
	add	x23, x23, 13
	cmp	w27, 50
	bne	.L73
	cbz	x26, .L107
	mov	x0, x26
	mov	w27, 0
	mov	w25, 1
	mov	x28, 0
	.p2align 5,,15
.L75:
	ldp	w1, w2, [x0]
	add	w27, w27, 1
	ldr	x0, [x0, 8]
	add	x28, x28, w1, sxtw
	mvn	w1, w1
	cmp	w2, w1
	cset	w1, eq
	and	w25, w25, w1
	cbnz	x0, .L75
.L74:
	mov	x24, 7
	mov	w23, 0
	.p2align 5,,15
.L76:
	ldr	x0, [x19], 8
	ldrb	w3, [x0, x24]
	add	x24, x24, 13
	cmp	w3, w23
	add	w23, w23, 1
	cset	w3, eq
	and	w25, w25, w3
	bl	free
	cmp	w23, 50
	bne	.L76
	ldr	x0, [sp, 104]
	mov	w4, w25
	mov	x3, x28
	mov	w2, w27
	mov	w1, w22
	bl	printf
	cbz	x26, .L77
	.p2align 5,,15
.L78:
	mov	x0, x26
	ldr	x26, [x26, 8]
	bl	free
	cbnz	x26, .L78
.L77:
	add	w21, w21, 1
	cmp	w22, 1
	beq	.L79
	mov	w22, 1
	b	.L67
.L79:
	add	x19, sp, 136
	stp	x19, x19, [sp, 136]
	str	wzr, [sp, 152]
	.p2align 5,,15
.L82:
	tbnz	x22, 0, .L80
	ldr	x21, [sp, 136]
	mov	x0, 24
	bl	malloc
	str	x21, [x0]
	mul	w1, w22, w22
	add	w22, w22, 1
	str	w1, [x0, 16]
	ldr	x1, [x21, 8]
	str	x1, [x0, 8]
	str	x0, [x1]
	str	x0, [x21, 8]
	cmp	w22, 11
	bne	.L82
	ldr	x21, [sp, 144]
	cmp	x21, x19
	beq	.L83
	mov	w22, 21846
	movk	w22, 0x5555, lsl 16
	b	.L85
	.p2align 2,,3
.L84:
	cmp	x21, x19
	beq	.L83
.L85:
	ldr	w2, [x21, 16]
	mov	x0, x21
	ldr	x21, [x21, 8]
	smull	x1, w2, w22
	lsr	x1, x1, 32
	sub	w1, w1, w2, asr 31
	add	w1, w1, w1, lsl 1
	sub	w2, w2, w1
	cmp	w2, 1
	bne	.L84
	ldr	x1, [x0]
	str	x21, [x1, 8]
	str	x1, [x21]
	bl	free
	cmp	x21, x19
	bne	.L85
.L83:
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	printf
	ldr	x21, [sp, 144]
	cmp	x21, x19
	beq	.L86
	adrp	x22, .LC11
	add	x22, x22, :lo12:.LC11
	.p2align 5,,15
.L87:
	ldr	w1, [x21, 16]
	mov	x0, x22
	bl	printf
	ldr	x21, [x21, 8]
	cmp	x21, x19
	bne	.L87
.L86:
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	printf
	ldr	x21, [sp, 136]
	cmp	x21, x19
	beq	.L88
	adrp	x22, .LC11
	add	x22, x22, :lo12:.LC11
	.p2align 5,,15
.L89:
	ldr	w1, [x21, 16]
	mov	x0, x22
	bl	printf
	ldr	x21, [x21]
	cmp	x21, x19
	bne	.L89
.L88:
	mov	w0, 10
	bl	putchar
	ldr	x0, [sp, 144]
	cmp	x0, x19
	beq	.L90
	.p2align 5,,15
.L91:
	ldr	x1, [x0, 8]
	str	x1, [sp, 144]
	bl	free
	ldr	x0, [sp, 144]
	cmp	x0, x19
	bne	.L91
.L90:
	adrp	x24, .LANCHOR1
	mov	x0, 16
	bl	malloc
	mov	x25, x0
	ldr	d31, [x24, :lo12:.LANCHOR1]
	mov	x19, x0
	mov	w21, 2
	str	xzr, [x0, 8]
	str	d31, [x0]
	.p2align 5,,15
.L92:
	mov	x22, x19
	mov	x0, 16
	bl	malloc
	str	xzr, [x0, 8]
	mvn	w1, w21
	stp	w21, w1, [x0]
	add	w21, w21, 1
	str	x0, [x22, 8]
	mov	x19, x0
	cmp	w21, 42
	bne	.L92
	str	x25, [x19, 8]
	adrp	x25, .LC11
	add	x25, x25, :lo12:.LC11
	mov	w21, 41
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	bl	printf
	.p2align 5,,15
.L96:
	ldr	x0, [x19, 8]
	ldr	x19, [x0, 8]
	ldr	x22, [x19, 8]
	ldr	x0, [x22, 8]
	str	x0, [x19, 8]
	cmp	w21, 31
	bgt	.L143
	mov	x0, x22
	sub	w21, w21, #1
	bl	free
	cmp	w21, 1
	bne	.L96
	ldr	w1, [x19]
	add	x24, x24, :lo12:.LANCHOR1
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	printf
	mov	x0, x19
	bl	free
	ldr	q28, [x24, 8]
	ldr	q30, [x24, 24]
	ldr	q29, [x24, 40]
	str	q28, [sp, 160]
	ldr	x0, [sp, 96]
	ldr	q31, [x24, 56]
	mov	x23, x0
	add	x24, sp, 224
	stp	q30, q29, [x0, 16]
	str	xzr, [sp, 128]
	str	q31, [x0, 48]
	.p2align 5,,15
.L100:
	ldr	x21, [x23]
	mov	x0, x21
	bl	strlen
	mov	x19, x0
	add	x0, x0, 17
	bl	malloc
	str	x19, [x0, 8]
	add	x19, x0, 16
	mov	x22, x0
	mov	x1, x21
	mov	x0, x19
	add	x21, sp, 128
	bl	strcpy
	cbnz	x20, .L97
	b	.L98
	.p2align 2,,3
.L99:
	mov	x21, x20
	ldr	x20, [x20]
	cbz	x20, .L98
.L97:
	mov	x1, x19
	add	x0, x20, 16
	bl	strcmp
	tbnz	w0, #31, .L99
.L98:
	str	x20, [x22]
	add	x23, x23, 8
	str	x22, [x21]
	ldr	x20, [sp, 128]
	cmp	x23, x24
	bne	.L100
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	printf
	cbz	x20, .L101
	adrp	x21, .LC27
	add	x21, x21, :lo12:.LC27
	.p2align 5,,15
.L102:
	ldr	w2, [x20, 8]
	mov	x19, x20
	add	x1, x20, 16
	mov	x0, x21
	ldr	x20, [x20]
	bl	printf
	mov	x0, x19
	bl	free
	cbnz	x20, .L102
.L101:
	mov	w0, 10
	bl	putchar
	ldp	x29, x30, [sp]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	add	sp, sp, 560
	ret
	.p2align 2,,3
.L80:
	mov	x0, 24
	bl	malloc
	mul	w1, w22, w22
	add	w22, w22, 1
	str	w1, [x0, 16]
	ldr	x1, [sp, 144]
	stp	x19, x1, [x0]
	str	x0, [x1]
	str	x0, [sp, 144]
	b	.L82
	.p2align 2,,3
.L143:
	ldr	w1, [x22]
	mov	x0, x25
	sub	w21, w21, #1
	bl	printf
	mov	x0, x22
	bl	free
	b	.L96
.L107:
	mov	w27, 0
	mov	w25, 1
	mov	x28, 0
	b	.L74
.L106:
	add	x19, sp, 120
	b	.L64
	.section .rodata
	.align	3
.LC0:
	.string	"delta"
	.align	3
.LC1:
	.string	"alpha"
	.align	3
.LC2:
	.string	"echo"
	.align	3
.LC4:
	.string	"charlie"
	.align	3
.LC5:
	.string	"bravo"
	.align	3
.LC6:
	.string	"alphabet"
	.align	3
.LC7:
	.string	"alp"
	.section .rodata
	.align	3
	.LANCHOR1:
.LC22:
	.word	1
	.word	-2
.LC25:
	.xword	.LC0
	.xword	.LC1
	.xword	.LC2
	.xword	.LC3
	.xword	.LC4
	.xword	.LC5
	.xword	.LC6
	.xword	.LC7
	.data
	.align	2
	.LANCHOR0:
seed:
	.word	12345

