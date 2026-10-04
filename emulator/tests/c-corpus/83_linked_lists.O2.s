	.text
	.align	2
	.p2align 5,,15
reverse:
	cbz	x0, .L2
	mov	x2, 0
	b	.L3
	.p2align 2,,3
.L4:
	mov	x0, x1
.L3:
	ldr	x1, [x0, 8]
	str	x2, [x0, 8]
	mov	x2, x0
	cbnz	x1, .L4
.L2:
	ret
	.align	2
	.p2align 5,,15
lsort:
	cbz	x0, .L35
	ldr	x2, [x0, 8]
	mov	x4, x0
	mov	x3, x2
	cbz	x2, .L38
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	b	.L11
	.p2align 2,,3
.L40:
	mov	x3, x19
.L11:
	ldr	x2, [x2, 8]
	cbz	x2, .L39
	ldr	x2, [x2, 8]
	mov	x4, x3
	ldr	x19, [x3, 8]
	cbnz	x2, .L40
.L13:
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
	beq	.L21
	add	x21, sp, 48
	.p2align 5,,15
.L18:
	mov	x1, x20
	mov	x0, x19
	blr	x22
	cbz	w0, .L16
.L42:
	str	x19, [x21, 8]
	ldr	x1, [x19, 8]
	cbz	x1, .L41
	mov	x21, x19
	mov	x19, x1
	mov	x0, x19
	mov	x1, x20
	blr	x22
	cbnz	w0, .L42
.L16:
	str	x20, [x21, 8]
	ldr	x0, [x20, 8]
	cbz	x0, .L23
	mov	x21, x20
	mov	x20, x0
	b	.L18
	.p2align 2,,3
.L39:
	mov	x19, x3
	mov	x3, x4
	b	.L13
	.p2align 2,,3
.L23:
	mov	x1, x19
	mov	x19, x20
.L24:
	mov	x0, x1
	str	x0, [x19, 8]
	ldr	x0, [sp, 56]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.p2align 2,,3
.L41:
	mov	x0, x20
	cbz	x20, .L24
.L37:
	str	x0, [x19, 8]
	ldr	x0, [sp, 56]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.p2align 2,,3
.L35:
	ret
	.p2align 2,,3
.L38:
	ret
	.p2align 2,,3
.L21:
	mov	x1, x0
	add	x19, sp, 48
	mov	x0, x20
	cbnz	x20, .L37
	b	.L24
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
	.align	2
	.p2align 5,,15
is_mult3:
	mov	w2, 43691
	mov	w1, 43690
	movk	w2, 0xaaaa, lsl 16
	movk	w1, 0x2aaa, lsl 16
	madd	w0, w0, w2, w1
	mov	w1, 1431655765
	cmp	w0, w1
	cset	w0, cc
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
	cbz	x19, .L49
	stp	x21, x22, [sp, 32]
	adrp	x22, .LC11
	add	x22, x22, :lo12:.LC11
	mov	w21, 0
	mov	w20, 0
	.p2align 5,,15
.L48:
	ldr	w1, [x19]
	mov	x0, x22
	add	w20, w20, 1
	bl	printf
	ldp	w0, w1, [x19]
	ldr	x19, [x19, 8]
	mvn	w0, w0
	cmp	w0, w1
	cinc	w21, w21, ne
	cbnz	x19, .L48
	cmp	w21, 0
	adrp	x0, .LC3
	ldp	x21, x22, [sp, 32]
	add	x0, x0, :lo12:.LC3
	adrp	x2, .LC9
	add	x2, x2, :lo12:.LC9
	csel	x2, x2, x0, ne
.L47:
	mov	w1, w20
	adrp	x0, .LC12
	ldp	x19, x20, [sp, 16]
	add	x0, x0, :lo12:.LC12
	ldp	x29, x30, [sp], 48
	b	printf
.L49:
	adrp	x2, .LC3
	mov	w20, 0
	add	x2, x2, :lo12:.LC3
	b	.L47
	.align	2
	.p2align 5,,15
free_list:
	cbz	x0, .L61
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x19, [sp, 16]
	mov	x19, x0
	.p2align 5,,15
.L55:
	mov	x0, x19
	ldr	x19, [x19, 8]
	bl	free
	cbnz	x19, .L55
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
	.p2align 2,,3
.L61:
	ret
	.align	2
	.p2align 5,,15
d_insert_after:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x0
	mov	w20, w1
	mov	x0, 24
	bl	malloc
	ldr	x1, [x19, 8]
	stp	x19, x1, [x0]
	str	w20, [x0, 16]
	str	x0, [x1]
	str	x0, [x19, 8]
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
	.align	2
	.p2align 5,,15
mk:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	w19, w0
	mov	x20, x1
	mov	x0, 16
	bl	malloc
	mvn	w1, w19
	stp	w19, w1, [x0]
	str	x20, [x0, 8]
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
	.align	2
	.p2align 5,,15
insert_sorted:
	stp	x29, x30, [sp, -48]!
	mov	w2, w1
	mov	x1, x0
	mov	x29, sp
	str	x19, [sp, 16]
	add	x19, sp, 40
	str	x0, [sp, 40]
	cbnz	x0, .L69
	b	.L70
	.p2align 2,,3
.L71:
	add	x19, x1, 8
	ldr	x1, [x1, 8]
	cbz	x1, .L70
.L69:
	ldr	w0, [x1]
	cmp	w0, w2
	blt	.L71
.L70:
	mov	w0, w2
	bl	mk
	str	x0, [x19]
	ldr	x19, [sp, 16]
	ldr	x0, [sp, 40]
	ldp	x29, x30, [sp], 48
	ret
	.align	2
	.p2align 5,,15
remove_if.constprop.0:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 40]
	cbz	x0, .L79
	mov	x3, x0
	stp	x19, x20, [sp, 16]
	mov	x20, x1
	add	x19, sp, 40
	b	.L82
	.p2align 2,,3
.L80:
	add	x19, x3, 8
	ldr	x3, [x19]
	cbz	x3, .L88
.L82:
	ldr	w0, [x3]
	bl	is_mult3
	cbz	w0, .L80
	ldr	x0, [x3, 8]
	str	x0, [x19]
	mov	x0, x3
	bl	free
	ldr	x3, [x19]
	ldr	w0, [x20]
	add	w0, w0, 1
	str	w0, [x20]
	cbnz	x3, .L82
.L88:
	ldp	x19, x20, [sp, 16]
.L79:
	ldr	x0, [sp, 40]
	ldp	x29, x30, [sp], 48
	ret
	.align	2
	.p2align 5,,15
rnd.constprop.0:
	adrp	x0, .LANCHOR0
	mov	w3, 20077
	movk	w3, 0x41c6, lsl 16
	mov	w2, 12345
	ldr	w1, [x0, :lo12:.LANCHOR0]
	madd	w1, w1, w3, w2
	mov	w2, 100
	str	w1, [x0, :lo12:.LANCHOR0]
	mov	w0, 34079
	movk	w0, 0x51eb, lsl 16
	lsr	w1, w1, 16
	umull	x0, w1, w0
	lsr	x0, x0, 37
	msub	w0, w0, w2, w1
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
.LC22:
	.string	"\n"
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
	stp	x19, x20, [sp, 16]
	mov	w20, 12
	mov	x19, 0
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	str	wzr, [sp, 116]
	.p2align 5,,15
.L91:
	bl	rnd.constprop.0
	sub	w0, w0, #30
	mov	x1, x19
	bl	mk
	subs	w20, w20, #1
	mov	x19, x0
	bne	.L91
	mov	x1, x0
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	show
	mov	x0, x19
	bl	reverse
	mov	x19, x0
	mov	x1, x0
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	show
	mov	x0, x19
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
	add	x1, sp, 116
	mov	x0, x19
	bl	remove_if.constprop.0
	mov	x19, x0
	ldr	w1, [sp, 116]
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	mov	x0, x19
	adrp	x1, odd_first
	add	x1, x1, :lo12:odd_first
	bl	lsort
	str	x0, [sp, 120]
	cbz	x0, .L129
	.p2align 5,,15
.L93:
	mov	x1, x0
	ldr	x0, [x0, 8]
	cbnz	x0, .L93
	add	x19, x1, 8
.L94:
	mov	w0, w20
	mov	x1, 0
	add	w20, w20, 111
	bl	mk
	str	x0, [x19]
	add	x19, x0, 8
	cmp	w20, 333
	bne	.L94
	ldr	x19, [sp, 120]
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	adrp	x25, .LC19
	mov	x1, x19
	bl	show
	mov	x0, x19
	mov	w22, 3500
	mov	w23, 0
	bl	free_list
	add	x0, x25, :lo12:.LC19
	str	x0, [sp, 104]
.L95:
	mov	w20, w23
	mov	x19, 0
	.p2align 5,,15
.L96:
	mov	x1, x19
	mov	w0, w20
	add	w20, w20, 7
	bl	mk
	mov	x19, x0
	cmp	w20, w22
	bne	.L96
	mov	x27, 0
	.p2align 5,,15
.L99:
	ldr	w1, [x19]
	mov	w2, 5
	mov	x0, x19
	ldr	x19, [x19, 8]
	sdiv	w2, w1, w2
	add	w2, w2, w2, lsl 2
	sub	w1, w1, w2
	cmp	w1, w23
	bne	.L97
	str	x27, [x0, 8]
	mov	x27, x0
	cbnz	x19, .L99
.L155:
	add	x26, sp, 160
	mov	x21, 8
	mov	x28, x26
	mov	w20, 0
	.p2align 5,,15
.L100:
	mov	x0, x21
	bl	malloc
	str	x0, [x28], 8
	mov	x2, x21
	mov	w1, w20
	add	w20, w20, 1
	bl	memset
	add	x21, x21, 13
	cmp	w20, 50
	bne	.L100
	cbz	x27, .L130
	mov	x0, x27
	mov	w21, 0
	mov	w25, 1
	mov	x28, 0
	.p2align 5,,15
.L102:
	ldp	w1, w2, [x0]
	add	w21, w21, 1
	ldr	x0, [x0, 8]
	add	x28, x28, w1, sxtw
	mvn	w1, w1
	cmp	w2, w1
	cset	w1, eq
	and	w25, w25, w1
	cbnz	x0, .L102
.L101:
	mov	x24, 7
	mov	w20, 0
	.p2align 5,,15
.L103:
	ldr	x0, [x26], 8
	ldrb	w2, [x0, x24]
	add	x24, x24, 13
	cmp	w2, w20
	add	w20, w20, 1
	cset	w2, eq
	and	w25, w25, w2
	bl	free
	cmp	w20, 50
	bne	.L103
	ldr	x0, [sp, 104]
	mov	w4, w25
	mov	x3, x28
	mov	w2, w21
	mov	w1, w23
	add	w22, w22, 1
	bl	printf
	mov	x0, x27
	bl	free_list
	cmp	w23, 1
	beq	.L104
	mov	w23, 1
	b	.L95
	.p2align 2,,3
.L97:
	bl	free
	cbnz	x19, .L99
	b	.L155
.L104:
	add	x20, sp, 136
	stp	x20, x20, [sp, 136]
	str	wzr, [sp, 152]
	.p2align 5,,15
.L108:
	mul	w1, w23, w23
	tbz	x23, 0, .L105
.L156:
	add	w23, w23, 1
	mov	x0, x20
	bl	d_insert_after
	mul	w1, w23, w23
	tbnz	x23, 0, .L156
.L105:
	ldr	x0, [sp, 136]
	add	w23, w23, 1
	bl	d_insert_after
	cmp	w23, 11
	bne	.L108
	ldr	x21, [sp, 144]
	cmp	x21, x20
	beq	.L109
	mov	w22, 21846
	movk	w22, 0x5555, lsl 16
	b	.L111
	.p2align 2,,3
.L110:
	cmp	x21, x20
	beq	.L109
.L111:
	ldr	w2, [x21, 16]
	mov	x0, x21
	ldr	x21, [x21, 8]
	smull	x1, w2, w22
	lsr	x1, x1, 32
	sub	w1, w1, w2, asr 31
	add	w1, w1, w1, lsl 1
	sub	w2, w2, w1
	cmp	w2, 1
	bne	.L110
	ldr	x1, [x0]
	str	x21, [x1, 8]
	str	x1, [x21]
	bl	free
	cmp	x21, x20
	bne	.L111
.L109:
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	printf
	ldr	x21, [sp, 144]
	cmp	x21, x20
	beq	.L112
	adrp	x22, .LC11
	add	x22, x22, :lo12:.LC11
	.p2align 5,,15
.L113:
	ldr	w1, [x21, 16]
	mov	x0, x22
	bl	printf
	ldr	x21, [x21, 8]
	cmp	x21, x20
	bne	.L113
.L112:
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	printf
	ldr	x21, [sp, 136]
	cmp	x21, x20
	beq	.L114
	adrp	x22, .LC11
	add	x22, x22, :lo12:.LC11
	.p2align 5,,15
.L115:
	ldr	w1, [x21, 16]
	mov	x0, x22
	bl	printf
	ldr	x21, [x21]
	cmp	x21, x20
	bne	.L115
.L114:
	adrp	x23, .LC22
	add	x23, x23, :lo12:.LC22
	mov	x0, x23
	bl	printf
	ldr	x0, [sp, 144]
	cmp	x0, x20
	beq	.L116
	.p2align 5,,15
.L117:
	ldr	x1, [x0, 8]
	str	x1, [sp, 144]
	bl	free
	ldr	x0, [sp, 144]
	cmp	x0, x20
	bne	.L117
.L116:
	mov	x1, 0
	mov	w0, 1
	bl	mk
	mov	x24, x0
	mov	x20, x0
	mov	w21, 2
	.p2align 5,,15
.L118:
	mov	x22, x20
	mov	w0, w21
	mov	x1, 0
	add	w21, w21, 1
	bl	mk
	mov	x20, x0
	str	x0, [x22, 8]
	cmp	w21, 42
	bne	.L118
	str	x24, [x20, 8]
	adrp	x24, .LC11
	add	x24, x24, :lo12:.LC11
	mov	w21, 41
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	bl	printf
	.p2align 5,,15
.L122:
	ldr	x0, [x20, 8]
	ldr	x20, [x0, 8]
	ldr	x22, [x20, 8]
	ldr	x0, [x22, 8]
	str	x0, [x20, 8]
	cmp	w21, 31
	bgt	.L157
	mov	x0, x22
	sub	w21, w21, #1
	bl	free
	cmp	w21, 1
	bne	.L122
	ldr	w1, [x20]
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	add	x24, sp, 160
	add	x25, sp, 224
	bl	printf
	mov	x0, x20
	bl	free
	adrp	x0, .LANCHOR1
	add	x0, x0, :lo12:.LANCHOR1
	str	xzr, [sp, 128]
	ldp	q28, q29, [x0]
	ldp	q30, q31, [x0, 32]
	stp	q28, q29, [sp, 160]
	stp	q30, q31, [sp, 192]
	.p2align 5,,15
.L126:
	ldr	x21, [x24]
	mov	x0, x21
	bl	strlen
	mov	x20, x0
	add	x0, x0, 17
	bl	malloc
	str	x20, [x0, 8]
	add	x20, x0, 16
	mov	x22, x0
	mov	x1, x21
	mov	x0, x20
	add	x21, sp, 128
	bl	strcpy
	cbnz	x19, .L123
	b	.L124
	.p2align 2,,3
.L125:
	mov	x21, x19
	ldr	x19, [x19]
	cbz	x19, .L124
.L123:
	mov	x1, x20
	add	x0, x19, 16
	bl	strcmp
	tbnz	w0, #31, .L125
.L124:
	str	x19, [x22]
	add	x24, x24, 8
	str	x22, [x21]
	ldr	x19, [sp, 128]
	cmp	x25, x24
	bne	.L126
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	printf
	cbz	x19, .L127
	adrp	x21, .LC27
	add	x21, x21, :lo12:.LC27
	.p2align 5,,15
.L128:
	ldr	w2, [x19, 8]
	mov	x20, x19
	add	x1, x19, 16
	mov	x0, x21
	ldr	x19, [x19]
	bl	printf
	mov	x0, x20
	bl	free
	cbnz	x19, .L128
.L127:
	mov	x0, x23
	bl	printf
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
.L157:
	ldr	w1, [x22]
	mov	x0, x24
	sub	w21, w21, #1
	bl	printf
	mov	x0, x22
	bl	free
	b	.L122
.L130:
	mov	w21, 0
	mov	w25, 1
	mov	x28, 0
	b	.L101
.L129:
	add	x19, sp, 120
	b	.L94
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

