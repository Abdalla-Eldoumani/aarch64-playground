	.text
	.data
	.align	2
seed:
	.word	12345
	.text
	.align	2
rnd:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	w1, [x0]
	mov	w0, 20077
	movk	w0, 0x41c6, lsl 16
	mul	w1, w1, w0
	mov	w0, 12345
	add	w1, w1, w0
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	str	w1, [x0]
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	w0, [x0]
	lsr	w0, w0, 16
	ldr	w1, [sp, 12]
	udiv	w2, w0, w1
	mul	w1, w2, w1
	sub	w0, w0, w1
	add	sp, sp, 16
	ret
	.align	2
mk:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	x1, [sp, 16]
	mov	x0, 16
	bl	malloc
	str	x0, [sp, 40]
	ldr	x0, [sp, 40]
	ldr	w1, [sp, 28]
	str	w1, [x0]
	ldr	w0, [sp, 28]
	mvn	w1, w0
	ldr	x0, [sp, 40]
	str	w1, [x0, 4]
	ldr	x0, [sp, 40]
	ldr	x1, [sp, 16]
	str	x1, [x0, 8]
	ldr	x0, [sp, 40]
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC9:
	.string	"%s:"
	.align	3
.LC10:
	.string	" %d"
	.align	3
.LC11:
	.string	" CORRUPT"
	.align	3
.LC3:
	.string	""
	.align	3
.LC12:
	.string	" (len %d%s)\n"
	.text
	.align	2
show:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	str	wzr, [sp, 44]
	str	wzr, [sp, 40]
	ldr	x1, [sp, 24]
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	b	.L6
.L7:
	ldr	x0, [sp, 16]
	ldr	w0, [x0]
	mov	w1, w0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldr	x0, [sp, 16]
	ldr	w1, [x0, 4]
	ldr	x0, [sp, 16]
	ldr	w0, [x0]
	mvn	w0, w0
	cmp	w1, w0
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 40]
	add	w0, w0, w1
	str	w0, [sp, 40]
	ldr	x0, [sp, 16]
	ldr	x0, [x0, 8]
	str	x0, [sp, 16]
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L6:
	ldr	x0, [sp, 16]
	cmp	x0, 0
	bne	.L7
	ldr	w0, [sp, 40]
	cmp	w0, 0
	beq	.L8
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	b	.L9
.L8:
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
.L9:
	mov	x2, x0
	ldr	w1, [sp, 44]
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	nop
	ldp	x29, x30, [sp], 48
	ret
	.align	2
reverse:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	xzr, [sp, 24]
	b	.L11
.L12:
	ldr	x0, [sp, 8]
	ldr	x0, [x0, 8]
	str	x0, [sp, 16]
	ldr	x0, [sp, 8]
	ldr	x1, [sp, 24]
	str	x1, [x0, 8]
	ldr	x0, [sp, 8]
	str	x0, [sp, 24]
	ldr	x0, [sp, 16]
	str	x0, [sp, 8]
.L11:
	ldr	x0, [sp, 8]
	cmp	x0, 0
	bne	.L12
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
lsort:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	ldr	x0, [sp, 24]
	cmp	x0, 0
	beq	.L15
	ldr	x0, [sp, 24]
	ldr	x0, [x0, 8]
	cmp	x0, 0
	bne	.L16
.L15:
	ldr	x0, [sp, 24]
	b	.L28
.L16:
	ldr	x0, [sp, 24]
	str	x0, [sp, 72]
	ldr	x0, [sp, 24]
	ldr	x0, [x0, 8]
	str	x0, [sp, 64]
	b	.L18
.L20:
	ldr	x0, [sp, 72]
	ldr	x0, [x0, 8]
	str	x0, [sp, 72]
	ldr	x0, [sp, 64]
	ldr	x0, [x0, 8]
	ldr	x0, [x0, 8]
	str	x0, [sp, 64]
.L18:
	ldr	x0, [sp, 64]
	cmp	x0, 0
	beq	.L19
	ldr	x0, [sp, 64]
	ldr	x0, [x0, 8]
	cmp	x0, 0
	bne	.L20
.L19:
	ldr	x0, [sp, 72]
	ldr	x0, [x0, 8]
	str	x0, [sp, 56]
	add	x0, sp, 32
	str	x0, [sp, 48]
	ldr	x0, [sp, 72]
	str	xzr, [x0, 8]
	ldr	x1, [sp, 16]
	ldr	x0, [sp, 24]
	bl	lsort
	str	x0, [sp, 24]
	ldr	x1, [sp, 16]
	ldr	x0, [sp, 56]
	bl	lsort
	str	x0, [sp, 56]
	b	.L21
.L25:
	ldr	x2, [sp, 16]
	ldr	x1, [sp, 24]
	ldr	x0, [sp, 56]
	blr	x2
	cmp	w0, 0
	beq	.L22
	ldr	x0, [sp, 48]
	ldr	x1, [sp, 56]
	str	x1, [x0, 8]
	ldr	x0, [sp, 56]
	ldr	x0, [x0, 8]
	str	x0, [sp, 56]
	b	.L23
.L22:
	ldr	x0, [sp, 48]
	ldr	x1, [sp, 24]
	str	x1, [x0, 8]
	ldr	x0, [sp, 24]
	ldr	x0, [x0, 8]
	str	x0, [sp, 24]
.L23:
	ldr	x0, [sp, 48]
	ldr	x0, [x0, 8]
	str	x0, [sp, 48]
.L21:
	ldr	x0, [sp, 24]
	cmp	x0, 0
	beq	.L24
	ldr	x0, [sp, 56]
	cmp	x0, 0
	bne	.L25
.L24:
	ldr	x0, [sp, 24]
	cmp	x0, 0
	beq	.L26
	ldr	x0, [sp, 24]
	b	.L27
.L26:
	ldr	x0, [sp, 56]
.L27:
	ldr	x1, [sp, 48]
	str	x0, [x1, 8]
	ldr	x0, [sp, 40]
.L28:
	ldp	x29, x30, [sp], 80
	ret
	.align	2
asc:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldr	w1, [x0]
	ldr	x0, [sp]
	ldr	w0, [x0]
	cmp	w1, w0
	cset	w0, lt
	and	w0, w0, 255
	add	sp, sp, 16
	ret
	.align	2
odd_first:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldr	w0, [x0]
	and	w1, w0, 1
	ldr	x0, [sp]
	ldr	w0, [x0]
	and	w0, w0, 1
	cmp	w1, w0
	cset	w0, gt
	and	w0, w0, 255
	add	sp, sp, 16
	ret
	.align	2
insert_sorted:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	w1, [sp, 20]
	add	x0, sp, 24
	str	x0, [sp, 40]
	b	.L34
.L36:
	ldr	x0, [sp, 40]
	ldr	x0, [x0]
	add	x0, x0, 8
	str	x0, [sp, 40]
.L34:
	ldr	x0, [sp, 40]
	ldr	x0, [x0]
	cmp	x0, 0
	beq	.L35
	ldr	x0, [sp, 40]
	ldr	x0, [x0]
	ldr	w0, [x0]
	ldr	w1, [sp, 20]
	cmp	w1, w0
	bgt	.L36
.L35:
	ldr	x0, [sp, 40]
	ldr	x0, [x0]
	mov	x1, x0
	ldr	w0, [sp, 20]
	bl	mk
	mov	x1, x0
	ldr	x0, [sp, 40]
	str	x1, [x0]
	ldr	x0, [sp, 24]
	ldp	x29, x30, [sp], 48
	ret
	.align	2
remove_if:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x0, [sp, 40]
	str	x1, [sp, 32]
	str	x2, [sp, 24]
	add	x0, sp, 40
	str	x0, [sp, 56]
	b	.L39
.L42:
	ldr	x0, [sp, 56]
	ldr	x0, [x0]
	ldr	w0, [x0]
	ldr	x1, [sp, 32]
	blr	x1
	cmp	w0, 0
	beq	.L40
	ldr	x0, [sp, 56]
	ldr	x0, [x0]
	str	x0, [sp, 48]
	ldr	x0, [sp, 48]
	ldr	x1, [x0, 8]
	ldr	x0, [sp, 56]
	str	x1, [x0]
	ldr	x0, [sp, 48]
	bl	free
	ldr	x0, [sp, 24]
	ldr	w0, [x0]
	add	w1, w0, 1
	ldr	x0, [sp, 24]
	str	w1, [x0]
	b	.L39
.L40:
	ldr	x0, [sp, 56]
	ldr	x0, [x0]
	add	x0, x0, 8
	str	x0, [sp, 56]
.L39:
	ldr	x0, [sp, 56]
	ldr	x0, [x0]
	cmp	x0, 0
	bne	.L42
	ldr	x0, [sp, 40]
	ldp	x29, x30, [sp], 64
	ret
	.align	2
is_mult3:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w1, [sp, 12]
	mov	w0, 21846
	movk	w0, 0x5555, lsl 16
	smull	x0, w1, w0
	lsr	x2, x0, 32
	asr	w0, w1, 31
	sub	w2, w2, w0
	mov	w0, w2
	lsl	w0, w0, 1
	add	w0, w0, w2
	sub	w2, w1, w0
	cmp	w2, 0
	cset	w0, eq
	and	w0, w0, 255
	add	sp, sp, 16
	ret
	.align	2
free_list:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 24]
	b	.L47
.L48:
	ldr	x0, [sp, 24]
	ldr	x0, [x0, 8]
	str	x0, [sp, 40]
	ldr	x0, [sp, 24]
	bl	free
	ldr	x0, [sp, 40]
	str	x0, [sp, 24]
.L47:
	ldr	x0, [sp, 24]
	cmp	x0, 0
	bne	.L48
	nop
	nop
	ldp	x29, x30, [sp], 48
	ret
	.align	2
d_insert_after:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	w1, [sp, 20]
	mov	x0, 24
	bl	malloc
	str	x0, [sp, 40]
	ldr	x0, [sp, 40]
	ldr	w1, [sp, 20]
	str	w1, [x0, 16]
	ldr	x0, [sp, 40]
	ldr	x1, [sp, 24]
	str	x1, [x0]
	ldr	x0, [sp, 24]
	ldr	x1, [x0, 8]
	ldr	x0, [sp, 40]
	str	x1, [x0, 8]
	ldr	x0, [sp, 24]
	ldr	x0, [x0, 8]
	ldr	x1, [sp, 40]
	str	x1, [x0]
	ldr	x0, [sp, 24]
	ldr	x1, [sp, 40]
	str	x1, [x0, 8]
	nop
	ldp	x29, x30, [sp], 48
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
	.global	main
main:
	sub	sp, sp, #704
	stp	x29, x30, [sp]
	mov	x29, sp
	str	xzr, [sp, 528]
	add	x0, sp, 528
	str	x0, [sp, 696]
	str	wzr, [sp, 524]
	str	wzr, [sp, 692]
	b	.L51
.L52:
	mov	w0, 100
	bl	rnd
	sub	w0, w0, #30
	ldr	x1, [sp, 528]
	bl	mk
	str	x0, [sp, 528]
	ldr	w0, [sp, 692]
	add	w0, w0, 1
	str	w0, [sp, 692]
.L51:
	ldr	w0, [sp, 692]
	cmp	w0, 11
	ble	.L52
	ldr	x0, [sp, 528]
	mov	x1, x0
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	show
	ldr	x0, [sp, 528]
	bl	reverse
	str	x0, [sp, 528]
	ldr	x0, [sp, 528]
	mov	x1, x0
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	show
	ldr	x2, [sp, 528]
	adrp	x0, asc
	add	x1, x0, :lo12:asc
	mov	x0, x2
	bl	lsort
	str	x0, [sp, 528]
	ldr	x0, [sp, 528]
	mov	x1, x0
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	show
	ldr	x0, [sp, 528]
	mov	w1, -1000
	bl	insert_sorted
	str	x0, [sp, 528]
	ldr	x0, [sp, 528]
	mov	w1, 1000
	bl	insert_sorted
	str	x0, [sp, 528]
	ldr	x2, [sp, 528]
	ldr	x0, [sp, 528]
	ldr	x0, [x0, 8]
	ldr	w0, [x0]
	mov	w1, w0
	mov	x0, x2
	bl	insert_sorted
	str	x0, [sp, 528]
	ldr	x0, [sp, 528]
	mov	x1, x0
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	show
	ldr	x3, [sp, 528]
	add	x0, sp, 524
	mov	x2, x0
	adrp	x0, is_mult3
	add	x1, x0, :lo12:is_mult3
	mov	x0, x3
	bl	remove_if
	str	x0, [sp, 528]
	ldr	w0, [sp, 524]
	mov	w1, w0
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	ldr	x2, [sp, 528]
	adrp	x0, odd_first
	add	x1, x0, :lo12:odd_first
	mov	x0, x2
	bl	lsort
	str	x0, [sp, 528]
	b	.L53
.L54:
	ldr	x0, [sp, 696]
	ldr	x0, [x0]
	add	x0, x0, 8
	str	x0, [sp, 696]
.L53:
	ldr	x0, [sp, 696]
	ldr	x0, [x0]
	cmp	x0, 0
	bne	.L54
	str	wzr, [sp, 692]
	b	.L55
.L56:
	ldr	w1, [sp, 692]
	mov	w0, 111
	mul	w0, w1, w0
	mov	x1, 0
	bl	mk
	mov	x1, x0
	ldr	x0, [sp, 696]
	str	x1, [x0]
	ldr	x0, [sp, 696]
	ldr	x0, [x0]
	add	x0, x0, 8
	str	x0, [sp, 696]
	ldr	w0, [sp, 692]
	add	w0, w0, 1
	str	w0, [sp, 692]
.L55:
	ldr	w0, [sp, 692]
	cmp	w0, 2
	ble	.L56
	ldr	x0, [sp, 528]
	mov	x1, x0
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	show
	ldr	x0, [sp, 528]
	bl	free_list
	str	wzr, [sp, 688]
	b	.L57
.L70:
	str	xzr, [sp, 680]
	str	xzr, [sp, 672]
	str	wzr, [sp, 692]
	b	.L58
.L59:
	ldr	w1, [sp, 692]
	mov	w0, w1
	lsl	w0, w0, 3
	sub	w1, w0, w1
	ldr	w0, [sp, 688]
	add	w0, w1, w0
	ldr	x1, [sp, 680]
	bl	mk
	str	x0, [sp, 680]
	ldr	w0, [sp, 692]
	add	w0, w0, 1
	str	w0, [sp, 692]
.L58:
	ldr	w0, [sp, 692]
	cmp	w0, 499
	ble	.L59
	str	xzr, [sp, 664]
	ldr	x0, [sp, 680]
	str	x0, [sp, 656]
	b	.L60
.L63:
	ldr	x0, [sp, 656]
	ldr	x0, [x0, 8]
	str	x0, [sp, 536]
	ldr	x0, [sp, 656]
	ldr	w1, [x0]
	mov	w0, 5
	sdiv	w2, w1, w0
	mov	w0, w2
	lsl	w0, w0, 2
	add	w0, w0, w2
	sub	w0, w1, w0
	ldr	w1, [sp, 688]
	cmp	w1, w0
	bne	.L61
	ldr	x0, [sp, 656]
	ldr	x1, [sp, 664]
	str	x1, [x0, 8]
	ldr	x0, [sp, 656]
	str	x0, [sp, 664]
	b	.L62
.L61:
	ldr	x0, [sp, 656]
	bl	free
.L62:
	ldr	x0, [sp, 536]
	str	x0, [sp, 656]
.L60:
	ldr	x0, [sp, 656]
	cmp	x0, 0
	bne	.L63
	str	wzr, [sp, 692]
	b	.L64
.L65:
	ldr	w1, [sp, 692]
	mov	w0, w1
	lsl	w0, w0, 1
	add	w0, w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	add	w0, w0, 8
	sxtw	x0, w0
	bl	malloc
	mov	x2, x0
	ldrsw	x0, [sp, 692]
	lsl	x0, x0, 3
	add	x1, sp, 24
	str	x2, [x1, x0]
	ldrsw	x0, [sp, 692]
	lsl	x0, x0, 3
	add	x1, sp, 24
	ldr	x3, [x1, x0]
	ldr	w1, [sp, 692]
	mov	w0, w1
	lsl	w0, w0, 1
	add	w0, w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	add	w0, w0, 8
	sxtw	x0, w0
	mov	x2, x0
	ldr	w1, [sp, 692]
	mov	x0, x3
	bl	memset
	ldr	w0, [sp, 692]
	add	w0, w0, 1
	str	w0, [sp, 692]
.L64:
	ldr	w0, [sp, 692]
	cmp	w0, 49
	ble	.L65
	mov	w0, 1
	str	w0, [sp, 652]
	str	wzr, [sp, 648]
	ldr	x0, [sp, 664]
	str	x0, [sp, 656]
	b	.L66
.L67:
	ldr	x0, [sp, 656]
	ldr	w0, [x0]
	sxtw	x0, w0
	ldr	x1, [sp, 672]
	add	x0, x1, x0
	str	x0, [sp, 672]
	ldr	x0, [sp, 656]
	ldr	w1, [x0, 4]
	ldr	x0, [sp, 656]
	ldr	w0, [x0]
	mvn	w0, w0
	cmp	w1, w0
	cset	w0, eq
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 652]
	and	w0, w0, w1
	str	w0, [sp, 652]
	ldr	x0, [sp, 656]
	ldr	x0, [x0, 8]
	str	x0, [sp, 656]
	ldr	w0, [sp, 648]
	add	w0, w0, 1
	str	w0, [sp, 648]
.L66:
	ldr	x0, [sp, 656]
	cmp	x0, 0
	bne	.L67
	str	wzr, [sp, 692]
	b	.L68
.L69:
	ldrsw	x0, [sp, 692]
	lsl	x0, x0, 3
	add	x1, sp, 24
	ldr	x2, [x1, x0]
	ldr	w1, [sp, 692]
	mov	w0, w1
	lsl	w0, w0, 1
	add	w0, w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	add	w0, w0, 7
	sxtw	x0, w0
	add	x0, x2, x0
	ldrb	w0, [x0]
	mov	w1, w0
	ldr	w0, [sp, 692]
	cmp	w0, w1
	cset	w0, eq
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 652]
	and	w0, w0, w1
	str	w0, [sp, 652]
	ldrsw	x0, [sp, 692]
	lsl	x0, x0, 3
	add	x1, sp, 24
	ldr	x0, [x1, x0]
	bl	free
	ldr	w0, [sp, 692]
	add	w0, w0, 1
	str	w0, [sp, 692]
.L68:
	ldr	w0, [sp, 692]
	cmp	w0, 49
	ble	.L69
	ldr	w4, [sp, 652]
	ldr	x3, [sp, 672]
	ldr	w2, [sp, 648]
	ldr	w1, [sp, 688]
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	printf
	ldr	x0, [sp, 664]
	bl	free_list
	ldr	w0, [sp, 688]
	add	w0, w0, 1
	str	w0, [sp, 688]
.L57:
	ldr	w0, [sp, 688]
	cmp	w0, 1
	ble	.L70
	add	x0, sp, 496
	str	x0, [sp, 496]
	add	x0, sp, 496
	str	x0, [sp, 504]
	str	wzr, [sp, 512]
	mov	w0, 1
	str	w0, [sp, 692]
	b	.L71
.L74:
	ldr	w0, [sp, 692]
	and	w0, w0, 1
	cmp	w0, 0
	bne	.L72
	ldr	x2, [sp, 496]
	b	.L73
.L72:
	add	x2, sp, 496
.L73:
	ldr	w0, [sp, 692]
	mul	w0, w0, w0
	mov	w1, w0
	mov	x0, x2
	bl	d_insert_after
	ldr	w0, [sp, 692]
	add	w0, w0, 1
	str	w0, [sp, 692]
.L71:
	ldr	w0, [sp, 692]
	cmp	w0, 10
	ble	.L74
	ldr	x0, [sp, 504]
	str	x0, [sp, 640]
	b	.L75
.L77:
	ldr	x0, [sp, 640]
	ldr	x0, [x0, 8]
	str	x0, [sp, 544]
	ldr	x0, [sp, 640]
	ldr	w1, [x0, 16]
	mov	w0, 21846
	movk	w0, 0x5555, lsl 16
	smull	x0, w1, w0
	lsr	x2, x0, 32
	asr	w0, w1, 31
	sub	w2, w2, w0
	mov	w0, w2
	lsl	w0, w0, 1
	add	w0, w0, w2
	sub	w2, w1, w0
	cmp	w2, 1
	bne	.L76
	ldr	x0, [sp, 640]
	ldr	x0, [x0]
	ldr	x1, [sp, 640]
	ldr	x1, [x1, 8]
	str	x1, [x0, 8]
	ldr	x0, [sp, 640]
	ldr	x0, [x0, 8]
	ldr	x1, [sp, 640]
	ldr	x1, [x1]
	str	x1, [x0]
	ldr	x0, [sp, 640]
	bl	free
.L76:
	ldr	x0, [sp, 544]
	str	x0, [sp, 640]
.L75:
	add	x0, sp, 496
	ldr	x1, [sp, 640]
	cmp	x1, x0
	bne	.L77
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	printf
	ldr	x0, [sp, 504]
	str	x0, [sp, 632]
	b	.L78
.L79:
	ldr	x0, [sp, 632]
	ldr	w0, [x0, 16]
	mov	w1, w0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldr	x0, [sp, 632]
	ldr	x0, [x0, 8]
	str	x0, [sp, 632]
.L78:
	add	x0, sp, 496
	ldr	x1, [sp, 632]
	cmp	x1, x0
	bne	.L79
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	printf
	ldr	x0, [sp, 496]
	str	x0, [sp, 624]
	b	.L80
.L81:
	ldr	x0, [sp, 624]
	ldr	w0, [x0, 16]
	mov	w1, w0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldr	x0, [sp, 624]
	ldr	x0, [x0]
	str	x0, [sp, 624]
.L80:
	add	x0, sp, 496
	ldr	x1, [sp, 624]
	cmp	x1, x0
	bne	.L81
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	printf
	b	.L82
.L83:
	ldr	x0, [sp, 504]
	str	x0, [sp, 552]
	ldr	x0, [sp, 552]
	ldr	x0, [x0, 8]
	str	x0, [sp, 504]
	ldr	x0, [sp, 552]
	bl	free
.L82:
	ldr	x1, [sp, 504]
	add	x0, sp, 496
	cmp	x1, x0
	bne	.L83
	mov	x1, 0
	mov	w0, 1
	bl	mk
	str	x0, [sp, 592]
	ldr	x0, [sp, 592]
	str	x0, [sp, 616]
	mov	w0, 2
	str	w0, [sp, 692]
	b	.L84
.L85:
	mov	x1, 0
	ldr	w0, [sp, 692]
	bl	mk
	mov	x1, x0
	ldr	x0, [sp, 616]
	str	x1, [x0, 8]
	ldr	x0, [sp, 616]
	ldr	x0, [x0, 8]
	str	x0, [sp, 616]
	ldr	w0, [sp, 692]
	add	w0, w0, 1
	str	w0, [sp, 692]
.L84:
	ldr	w0, [sp, 692]
	cmp	w0, 41
	ble	.L85
	ldr	x0, [sp, 616]
	ldr	x1, [sp, 592]
	str	x1, [x0, 8]
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	bl	printf
	mov	w0, 41
	str	w0, [sp, 612]
	b	.L86
.L88:
	ldr	x0, [sp, 616]
	ldr	x0, [x0, 8]
	ldr	x0, [x0, 8]
	str	x0, [sp, 616]
	ldr	x0, [sp, 616]
	ldr	x0, [x0, 8]
	str	x0, [sp, 560]
	ldr	x0, [sp, 560]
	ldr	x1, [x0, 8]
	ldr	x0, [sp, 616]
	str	x1, [x0, 8]
	ldr	w0, [sp, 612]
	cmp	w0, 31
	ble	.L87
	ldr	x0, [sp, 560]
	ldr	w0, [x0]
	mov	w1, w0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
.L87:
	ldr	x0, [sp, 560]
	bl	free
	ldr	w0, [sp, 612]
	sub	w0, w0, #1
	str	w0, [sp, 612]
.L86:
	ldr	w0, [sp, 612]
	cmp	w0, 1
	bgt	.L88
	ldr	x0, [sp, 616]
	ldr	w0, [x0]
	mov	w1, w0
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	printf
	ldr	x0, [sp, 616]
	bl	free
	adrp	x0, .LC25
	add	x1, x0, :lo12:.LC25
	add	x0, sp, 432
	ldr	q28, [x1]
	ldr	q29, [x1, 16]
	ldr	q30, [x1, 32]
	ldr	q31, [x1, 48]
	str	q28, [x0]
	str	q29, [x0, 16]
	str	q30, [x0, 32]
	str	q31, [x0, 48]
	str	xzr, [sp, 424]
	str	wzr, [sp, 692]
	b	.L89
.L93:
	ldrsw	x0, [sp, 692]
	lsl	x0, x0, 3
	add	x1, sp, 432
	ldr	x0, [x1, x0]
	bl	strlen
	str	x0, [sp, 576]
	ldr	x0, [sp, 576]
	add	x0, x0, 17
	bl	malloc
	str	x0, [sp, 568]
	add	x0, sp, 424
	str	x0, [sp, 600]
	ldr	x0, [sp, 568]
	ldr	x1, [sp, 576]
	str	x1, [x0, 8]
	ldr	x0, [sp, 568]
	add	x2, x0, 16
	ldrsw	x0, [sp, 692]
	lsl	x0, x0, 3
	add	x1, sp, 432
	ldr	x0, [x1, x0]
	mov	x1, x0
	mov	x0, x2
	bl	strcpy
	b	.L90
.L92:
	ldr	x0, [sp, 600]
	ldr	x0, [x0]
	str	x0, [sp, 600]
.L90:
	ldr	x0, [sp, 600]
	ldr	x0, [x0]
	cmp	x0, 0
	beq	.L91
	ldr	x0, [sp, 600]
	ldr	x0, [x0]
	add	x2, x0, 16
	ldr	x0, [sp, 568]
	add	x0, x0, 16
	mov	x1, x0
	mov	x0, x2
	bl	strcmp
	cmp	w0, 0
	blt	.L92
.L91:
	ldr	x0, [sp, 600]
	ldr	x1, [x0]
	ldr	x0, [sp, 568]
	str	x1, [x0]
	ldr	x0, [sp, 600]
	ldr	x1, [sp, 568]
	str	x1, [x0]
	ldr	w0, [sp, 692]
	add	w0, w0, 1
	str	w0, [sp, 692]
.L89:
	ldr	w0, [sp, 692]
	cmp	w0, 7
	ble	.L93
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	printf
	b	.L94
.L95:
	ldr	x0, [sp, 424]
	ldr	x0, [x0]
	str	x0, [sp, 584]
	ldr	x0, [sp, 424]
	add	x1, x0, 16
	ldr	x0, [sp, 424]
	ldr	x0, [x0, 8]
	mov	w2, w0
	adrp	x0, .LC27
	add	x0, x0, :lo12:.LC27
	bl	printf
	ldr	x0, [sp, 424]
	bl	free
	ldr	x0, [sp, 584]
	str	x0, [sp, 424]
.L94:
	ldr	x0, [sp, 424]
	cmp	x0, 0
	bne	.L95
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp]
	add	sp, sp, 704
	ret
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
	.align	3
.LC25:
	.xword	.LC0
	.xword	.LC1
	.xword	.LC2
	.xword	.LC3
	.xword	.LC4
	.xword	.LC5
	.xword	.LC6
	.xword	.LC7
	.text

