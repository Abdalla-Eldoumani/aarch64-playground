	.text
	.align	2
fnv1a:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	mov	x0, 8997
	movk	x0, 0x8422, lsl 16
	movk	x0, 0x9ce4, lsl 32
	movk	x0, 0xcbf2, lsl 48
	str	x0, [sp, 24]
	b	.L2
.L3:
	ldr	x0, [sp, 8]
	ldrb	w0, [x0]
	and	x0, x0, 255
	ldr	x1, [sp, 24]
	eor	x0, x1, x0
	str	x0, [sp, 24]
	ldr	x1, [sp, 24]
	mov	x0, 435
	movk	x0, 0x100, lsl 32
	mul	x0, x1, x0
	str	x0, [sp, 24]
	ldr	x0, [sp, 8]
	add	x0, x0, 1
	str	x0, [sp, 8]
.L2:
	ldr	x0, [sp, 8]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L3
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
arena_put:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	ldr	x0, [sp, 16]
	bl	strlen
	add	x0, x0, 1
	str	x0, [sp, 40]
	b	.L6
.L9:
	ldr	x0, [sp, 24]
	ldr	x0, [x0, 48]
	cmp	x0, 0
	beq	.L7
	ldr	x0, [sp, 24]
	ldr	x0, [x0, 48]
	lsl	x0, x0, 1
	b	.L8
.L7:
	mov	x0, 16
.L8:
	ldr	x1, [sp, 24]
	str	x0, [x1, 48]
	ldr	x0, [sp, 24]
	ldr	x2, [x0, 32]
	ldr	x0, [sp, 24]
	ldr	x0, [x0, 48]
	mov	x1, x0
	mov	x0, x2
	bl	realloc
	mov	x1, x0
	ldr	x0, [sp, 24]
	str	x1, [x0, 32]
	ldr	x0, [sp, 24]
	ldr	w0, [x0, 56]
	add	w1, w0, 1
	ldr	x0, [sp, 24]
	str	w1, [x0, 56]
.L6:
	ldr	x0, [sp, 24]
	ldr	x1, [x0, 40]
	ldr	x0, [sp, 40]
	add	x1, x1, x0
	ldr	x0, [sp, 24]
	ldr	x0, [x0, 48]
	cmp	x1, x0
	bhi	.L9
	ldr	x0, [sp, 24]
	ldr	x1, [x0, 32]
	ldr	x0, [sp, 24]
	ldr	x0, [x0, 40]
	add	x0, x1, x0
	ldr	x2, [sp, 40]
	ldr	x1, [sp, 16]
	bl	memcpy
	ldr	x0, [sp, 24]
	ldr	x1, [x0, 40]
	ldr	x0, [sp, 40]
	add	x1, x1, x0
	ldr	x0, [sp, 24]
	str	x1, [x0, 40]
	ldr	x0, [sp, 24]
	ldr	x1, [x0, 40]
	ldr	x0, [sp, 40]
	sub	x0, x1, x0
	ldp	x29, x30, [sp], 48
	ret
	.align	2
find:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	str	x0, [sp, 40]
	str	x1, [sp, 32]
	str	x2, [sp, 24]
	str	xzr, [sp, 72]
	ldr	x0, [sp, 40]
	ldr	x0, [x0, 8]
	sub	x0, x0, #1
	ldr	x1, [sp, 24]
	and	x0, x1, x0
	str	x0, [sp, 64]
.L18:
	ldr	x0, [sp, 40]
	ldr	x2, [x0]
	ldr	x1, [sp, 64]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	str	x0, [sp, 56]
	ldr	x0, [sp, 56]
	ldr	w0, [x0, 20]
	cmp	w0, 0
	bne	.L12
	ldr	x0, [sp, 72]
	cmp	x0, 0
	beq	.L13
	ldr	x0, [sp, 72]
	b	.L15
.L13:
	ldr	x0, [sp, 56]
	b	.L15
.L12:
	ldr	x0, [sp, 56]
	ldr	w0, [x0, 20]
	cmp	w0, 2
	bne	.L16
	ldr	x0, [sp, 72]
	cmp	x0, 0
	bne	.L17
	ldr	x0, [sp, 56]
	str	x0, [sp, 72]
	b	.L17
.L16:
	ldr	x0, [sp, 56]
	ldr	x0, [x0]
	ldr	x1, [sp, 24]
	cmp	x1, x0
	bne	.L17
	ldr	x0, [sp, 40]
	ldr	x1, [x0, 32]
	ldr	x0, [sp, 56]
	ldr	x0, [x0, 8]
	add	x0, x1, x0
	ldr	x1, [sp, 32]
	bl	strcmp
	cmp	w0, 0
	bne	.L17
	ldr	x0, [sp, 56]
	b	.L15
.L17:
	ldr	x0, [sp, 64]
	add	x1, x0, 1
	ldr	x0, [sp, 40]
	ldr	x0, [x0, 8]
	sub	x0, x0, #1
	and	x0, x1, x0
	str	x0, [sp, 64]
	b	.L18
.L15:
	ldp	x29, x30, [sp], 80
	ret
	.align	2
rehash:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	ldr	x0, [sp, 24]
	ldr	x0, [x0]
	str	x0, [sp, 40]
	ldr	x0, [sp, 24]
	ldr	x0, [x0, 8]
	str	x0, [sp, 32]
	mov	x1, 24
	ldr	x0, [sp, 16]
	bl	calloc
	mov	x1, x0
	ldr	x0, [sp, 24]
	str	x1, [x0]
	ldr	x0, [sp, 24]
	ldr	x1, [sp, 16]
	str	x1, [x0, 8]
	ldr	x0, [sp, 24]
	str	xzr, [x0, 24]
	str	xzr, [sp, 56]
	b	.L20
.L24:
	ldr	x1, [sp, 56]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 40]
	add	x0, x0, x1
	ldr	w0, [x0, 20]
	cmp	w0, 1
	bne	.L21
	ldr	x1, [sp, 56]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 40]
	add	x0, x0, x1
	ldr	x1, [x0]
	ldr	x0, [sp, 16]
	sub	x0, x0, #1
	and	x0, x1, x0
	str	x0, [sp, 48]
	b	.L22
.L23:
	ldr	x0, [sp, 48]
	add	x1, x0, 1
	ldr	x0, [sp, 16]
	sub	x0, x0, #1
	and	x0, x1, x0
	str	x0, [sp, 48]
.L22:
	ldr	x0, [sp, 24]
	ldr	x2, [x0]
	ldr	x1, [sp, 48]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	w0, [x0, 20]
	cmp	w0, 0
	bne	.L23
	ldr	x1, [sp, 56]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 40]
	add	x3, x0, x1
	ldr	x0, [sp, 24]
	ldr	x2, [x0]
	ldr	x1, [sp, 48]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	mov	x2, x0
	ldp	x0, x1, [x3]
	ldr	x3, [x3, 16]
	stp	x0, x1, [x2]
	str	x3, [x2, 16]
	ldr	x0, [sp, 24]
	ldr	x0, [x0, 24]
	add	x1, x0, 1
	ldr	x0, [sp, 24]
	str	x1, [x0, 24]
.L21:
	ldr	x0, [sp, 56]
	add	x0, x0, 1
	str	x0, [sp, 56]
.L20:
	ldr	x1, [sp, 56]
	ldr	x0, [sp, 32]
	cmp	x1, x0
	bcc	.L24
	ldr	x0, [sp, 40]
	bl	free
	nop
	ldp	x29, x30, [sp], 64
	ret
	.align	2
bump:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x0, [sp, 40]
	str	x1, [sp, 32]
	str	w2, [sp, 28]
	ldr	x0, [sp, 40]
	ldr	x0, [x0, 24]
	add	x1, x0, 1
	mov	x0, x1
	lsl	x0, x0, 1
	add	x1, x0, x1
	ldr	x0, [sp, 40]
	ldr	x0, [x0, 8]
	lsl	x0, x0, 1
	cmp	x1, x0
	bls	.L26
	ldr	x0, [sp, 40]
	ldr	x0, [x0, 16]
	add	x1, x0, 1
	mov	x0, x1
	lsl	x0, x0, 1
	add	x1, x0, x1
	ldr	x0, [sp, 40]
	ldr	x0, [x0, 8]
	cmp	x1, x0
	bls	.L27
	ldr	x0, [sp, 40]
	ldr	x0, [x0, 8]
	lsl	x0, x0, 1
	b	.L28
.L27:
	ldr	x0, [sp, 40]
	ldr	x0, [x0, 8]
.L28:
	mov	x1, x0
	ldr	x0, [sp, 40]
	bl	rehash
.L26:
	ldr	x0, [sp, 32]
	bl	fnv1a
	str	x0, [sp, 56]
	ldr	x2, [sp, 56]
	ldr	x1, [sp, 32]
	ldr	x0, [sp, 40]
	bl	find
	str	x0, [sp, 48]
	ldr	x0, [sp, 48]
	ldr	w0, [x0, 20]
	cmp	w0, 1
	beq	.L29
	ldr	x0, [sp, 40]
	ldr	x1, [x0, 24]
	ldr	x0, [sp, 48]
	ldr	w0, [x0, 20]
	cmp	w0, 0
	cset	w0, eq
	and	w0, w0, 255
	and	x0, x0, 255
	add	x1, x1, x0
	ldr	x0, [sp, 40]
	str	x1, [x0, 24]
	ldr	x0, [sp, 48]
	mov	w1, 1
	str	w1, [x0, 20]
	ldr	x0, [sp, 48]
	ldr	x1, [sp, 56]
	str	x1, [x0]
	ldr	x1, [sp, 32]
	ldr	x0, [sp, 40]
	bl	arena_put
	mov	x1, x0
	ldr	x0, [sp, 48]
	str	x1, [x0, 8]
	ldr	x0, [sp, 48]
	str	wzr, [x0, 16]
	ldr	x0, [sp, 40]
	ldr	x0, [x0, 16]
	add	x1, x0, 1
	ldr	x0, [sp, 40]
	str	x1, [x0, 16]
.L29:
	ldr	x0, [sp, 48]
	ldr	w1, [x0, 16]
	ldr	w0, [sp, 28]
	add	w1, w1, w0
	ldr	x0, [sp, 48]
	str	w1, [x0, 16]
	nop
	ldp	x29, x30, [sp], 64
	ret
	.align	2
get:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	ldr	x0, [sp, 16]
	bl	fnv1a
	mov	x2, x0
	ldr	x1, [sp, 16]
	ldr	x0, [sp, 24]
	bl	find
	str	x0, [sp, 40]
	ldr	x0, [sp, 40]
	ldr	w0, [x0, 20]
	cmp	w0, 1
	bne	.L31
	ldr	x0, [sp, 40]
	ldr	w0, [x0, 16]
	b	.L33
.L31:
	mov	w0, -1
.L33:
	ldp	x29, x30, [sp], 48
	ret
	.align	2
del:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	ldr	x0, [sp, 16]
	bl	fnv1a
	mov	x2, x0
	ldr	x1, [sp, 16]
	ldr	x0, [sp, 24]
	bl	find
	str	x0, [sp, 40]
	ldr	x0, [sp, 40]
	ldr	w0, [x0, 20]
	cmp	w0, 1
	beq	.L35
	mov	w0, 0
	b	.L36
.L35:
	ldr	x0, [sp, 40]
	mov	w1, 2
	str	w1, [x0, 20]
	ldr	x0, [sp, 24]
	ldr	x0, [x0, 16]
	sub	x1, x0, #1
	ldr	x0, [sp, 24]
	str	x1, [x0, 16]
	mov	w0, 1
.L36:
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
text:
	.ascii	"the red "
	.string	"kite rode the warm air over the hill and the small birds below it hid in the hedge, while the kite turned and turned again; a farmer on the hill saw the kite, saw the hedge shake, and went back to the barn where the old red tractor sat waiting in the dark."
	.align	3
.LC5:
	.string	""
	.align	3
.LC14:
	.string	"a"
	.align	3
.LC1:
	.string	"kite"
	.align	3
.LC15:
	.string	"fnv: %016zx %016zx %zx\n"
	.align	3
.LC16:
	.string	" ,.;"
	.align	3
.LC17:
	.string	"words %d distinct %d cap %d used %d arena %d moves %d\n"
	.align	3
.LC19:
	.string	"get:"
	.align	3
.LC20:
	.string	" %s=%d"
	.align	3
.LC22:
	.string	"\ndel:"
	.align	3
.LC23:
	.string	" %d"
	.align	3
.LC0:
	.string	"the"
	.align	3
.LC11:
	.string	"saw"
	.align	3
.LC9:
	.string	"and"
	.align	3
.LC12:
	.string	"red"
	.align	3
.LC24:
	.string	"\nafter: the=%d saw=%d and=%d red=%d live %d used %d cap %d\n"
	.align	3
.LC25:
	.string	"\n  "
	.align	3
.LC26:
	.string	"slots "
	.align	3
.LC27:
	.string	" "
	.align	3
.LC28:
	.string	"%s%d:%s=%d"
	.align	3
.LC29:
	.string	"\nhash ok %d of %d\n"
	.align	3
.LC30:
	.string	"vector grows %d bad %ld last cap %d head %d %d %d\n"
	.align	3
.LC31:
	.string	"dirty %d %d\n"
	.align	3
.LC32:
	.string	"calloc nonzero %d\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #640
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	str	x21, [sp, 32]
	mov	x1, 24
	mov	x0, 8
	bl	calloc
	str	x0, [sp, 424]
	mov	x0, 8
	str	x0, [sp, 432]
	str	xzr, [sp, 440]
	str	xzr, [sp, 448]
	str	xzr, [sp, 456]
	str	xzr, [sp, 464]
	str	xzr, [sp, 472]
	str	wzr, [sp, 480]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	fnv1a
	mov	x19, x0
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	fnv1a
	mov	x20, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	fnv1a
	lsr	x0, x0, 1
	mov	x3, x0
	mov	x2, x20
	mov	x1, x19
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	mov	x0, 265
	bl	malloc
	str	x0, [sp, 512]
	adrp	x0, text
	add	x1, x0, :lo12:text
	ldr	x0, [sp, 512]
	bl	strcpy
	str	wzr, [sp, 636]
	adrp	x0, .LC16
	add	x1, x0, :lo12:.LC16
	ldr	x0, [sp, 512]
	bl	strtok
	str	x0, [sp, 624]
	b	.L38
.L39:
	add	x0, sp, 424
	mov	w2, 1
	ldr	x1, [sp, 624]
	bl	bump
	ldr	w0, [sp, 636]
	add	w0, w0, 1
	str	w0, [sp, 636]
	adrp	x0, .LC16
	add	x1, x0, :lo12:.LC16
	mov	x0, 0
	bl	strtok
	str	x0, [sp, 624]
.L38:
	ldr	x0, [sp, 624]
	cmp	x0, 0
	bne	.L39
	ldr	x0, [sp, 512]
	bl	free
	ldr	x0, [sp, 440]
	mov	w1, w0
	ldr	x0, [sp, 432]
	mov	w2, w0
	ldr	x0, [sp, 448]
	mov	w3, w0
	ldr	x0, [sp, 464]
	mov	w4, w0
	ldr	w0, [sp, 480]
	mov	w6, w0
	mov	w5, w4
	mov	w4, w3
	mov	w3, w2
	mov	w2, w1
	ldr	w1, [sp, 636]
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	adrp	x0, .LC18
	add	x1, x0, :lo12:.LC18
	add	x0, sp, 360
	ldr	q28, [x1]
	ldr	q29, [x1, 16]
	ldr	q30, [x1, 32]
	ldr	q31, [x1, 48]
	str	q28, [x0]
	str	q29, [x0, 16]
	str	q30, [x0, 32]
	str	q31, [x0, 48]
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	printf
	str	wzr, [sp, 620]
	b	.L40
.L41:
	ldrsw	x0, [sp, 620]
	lsl	x0, x0, 3
	add	x1, sp, 360
	ldr	x19, [x1, x0]
	ldrsw	x0, [sp, 620]
	lsl	x0, x0, 3
	add	x1, sp, 360
	ldr	x1, [x1, x0]
	add	x0, sp, 424
	bl	get
	mov	w2, w0
	mov	x1, x19
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	printf
	ldr	w0, [sp, 620]
	add	w0, w0, 1
	str	w0, [sp, 620]
.L40:
	ldr	w0, [sp, 620]
	cmp	w0, 7
	ble	.L41
	adrp	x0, .LC21
	add	x1, x0, :lo12:.LC21
	add	x0, sp, 312
	ldr	q29, [x1]
	ldr	q30, [x1, 16]
	ldr	q31, [x1, 32]
	str	q29, [x0]
	str	q30, [x0, 16]
	str	q31, [x0, 32]
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	printf
	str	wzr, [sp, 616]
	b	.L42
.L43:
	ldrsw	x0, [sp, 616]
	lsl	x0, x0, 3
	add	x1, sp, 312
	ldr	x1, [x1, x0]
	add	x0, sp, 424
	bl	del
	mov	w1, w0
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	bl	printf
	ldr	w0, [sp, 616]
	add	w0, w0, 1
	str	w0, [sp, 616]
.L42:
	ldr	w0, [sp, 616]
	cmp	w0, 5
	ble	.L43
	str	wzr, [sp, 612]
	b	.L44
.L47:
	ldr	w0, [sp, 612]
	and	w0, w0, 1
	cmp	w0, 0
	beq	.L45
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	b	.L46
.L45:
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
.L46:
	add	x3, sp, 424
	mov	w2, 2
	mov	x1, x0
	mov	x0, x3
	bl	bump
	ldr	w0, [sp, 612]
	add	w0, w0, 1
	str	w0, [sp, 612]
.L44:
	ldr	w0, [sp, 612]
	cmp	w0, 39
	ble	.L47
	add	x2, sp, 424
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	mov	x0, x2
	bl	get
	mov	w19, w0
	add	x2, sp, 424
	adrp	x0, .LC11
	add	x1, x0, :lo12:.LC11
	mov	x0, x2
	bl	get
	mov	w20, w0
	add	x2, sp, 424
	adrp	x0, .LC9
	add	x1, x0, :lo12:.LC9
	mov	x0, x2
	bl	get
	mov	w21, w0
	add	x2, sp, 424
	adrp	x0, .LC12
	add	x1, x0, :lo12:.LC12
	mov	x0, x2
	bl	get
	ldr	x1, [sp, 440]
	ldr	x2, [sp, 448]
	ldr	x3, [sp, 432]
	mov	w7, w3
	mov	w6, w2
	mov	w5, w1
	mov	w4, w0
	mov	w3, w21
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	printf
	str	wzr, [sp, 608]
	str	wzr, [sp, 604]
	str	xzr, [sp, 592]
	b	.L48
.L54:
	ldr	x2, [sp, 424]
	ldr	x1, [sp, 592]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	str	x0, [sp, 488]
	ldr	x0, [sp, 488]
	ldr	w0, [x0, 20]
	cmp	w0, 1
	bne	.L67
	ldr	x1, [sp, 456]
	ldr	x0, [sp, 488]
	ldr	x0, [x0, 8]
	add	x0, x1, x0
	bl	fnv1a
	mov	x1, x0
	ldr	x0, [sp, 488]
	ldr	x0, [x0]
	cmp	x1, x0
	cset	w0, eq
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 604]
	add	w0, w0, w1
	str	w0, [sp, 604]
	ldr	w1, [sp, 608]
	mov	w0, 43691
	movk	w0, 0x2aaa, lsl 16
	smull	x0, w1, w0
	lsr	x2, x0, 32
	asr	w0, w1, 31
	sub	w2, w2, w0
	mov	w0, w2
	lsl	w0, w0, 1
	add	w0, w0, w2
	lsl	w0, w0, 1
	sub	w2, w1, w0
	cmp	w2, 0
	bne	.L51
	ldr	w0, [sp, 608]
	cmp	w0, 0
	beq	.L52
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	b	.L53
.L52:
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	b	.L53
.L51:
	adrp	x0, .LC27
	add	x0, x0, :lo12:.LC27
.L53:
	ldr	x1, [sp, 592]
	mov	w5, w1
	ldr	x2, [sp, 456]
	ldr	x1, [sp, 488]
	ldr	x1, [x1, 8]
	add	x2, x2, x1
	ldr	x1, [sp, 488]
	ldr	w1, [x1, 16]
	mov	w4, w1
	mov	x3, x2
	mov	w2, w5
	mov	x1, x0
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	bl	printf
	ldr	w0, [sp, 608]
	add	w0, w0, 1
	str	w0, [sp, 608]
	b	.L50
.L67:
	nop
.L50:
	ldr	x0, [sp, 592]
	add	x0, x0, 1
	str	x0, [sp, 592]
.L48:
	ldr	x0, [sp, 432]
	ldr	x1, [sp, 592]
	cmp	x1, x0
	bcc	.L54
	ldr	x0, [sp, 440]
	mov	w2, w0
	ldr	w1, [sp, 604]
	adrp	x0, .LC29
	add	x0, x0, :lo12:.LC29
	bl	printf
	str	xzr, [sp, 584]
	str	xzr, [sp, 576]
	str	xzr, [sp, 568]
	str	xzr, [sp, 560]
	str	xzr, [sp, 552]
	str	wzr, [sp, 548]
	b	.L55
.L60:
	ldr	x1, [sp, 576]
	ldr	x0, [sp, 568]
	cmp	x1, x0
	bne	.L56
	ldr	x0, [sp, 568]
	lsr	x1, x0, 1
	ldr	x0, [sp, 568]
	add	x0, x1, x0
	add	x0, x0, 1
	str	x0, [sp, 568]
	ldr	x0, [sp, 568]
	lsl	x0, x0, 2
	mov	x1, x0
	ldr	x0, [sp, 584]
	bl	realloc
	str	x0, [sp, 584]
	ldr	x0, [sp, 560]
	cmp	x0, 31
	bhi	.L57
	mov	x0, 24
	bl	malloc
	mov	x2, x0
	ldr	x0, [sp, 560]
	lsl	x0, x0, 3
	add	x1, sp, 56
	str	x2, [x1, x0]
.L57:
	ldr	x0, [sp, 560]
	add	x0, x0, 1
	str	x0, [sp, 560]
	str	xzr, [sp, 536]
	b	.L58
.L59:
	ldr	x0, [sp, 536]
	lsl	x0, x0, 2
	ldr	x1, [sp, 584]
	add	x0, x1, x0
	ldr	w1, [x0]
	ldr	x0, [sp, 536]
	mov	w2, w0
	mov	w0, w2
	lsl	w0, w0, 3
	sub	w0, w0, w2
	sub	w0, w0, #1000
	cmp	w1, w0
	cset	w0, ne
	and	w0, w0, 255
	and	x0, x0, 255
	ldr	x1, [sp, 552]
	add	x0, x1, x0
	str	x0, [sp, 552]
	ldr	x0, [sp, 536]
	add	x0, x0, 1
	str	x0, [sp, 536]
.L58:
	ldr	x1, [sp, 536]
	ldr	x0, [sp, 576]
	cmp	x1, x0
	bcc	.L59
.L56:
	ldr	w1, [sp, 548]
	mov	w0, w1
	lsl	w0, w0, 3
	sub	w1, w0, w1
	ldr	x0, [sp, 576]
	add	x2, x0, 1
	str	x2, [sp, 576]
	lsl	x0, x0, 2
	ldr	x2, [sp, 584]
	add	x0, x2, x0
	sub	w1, w1, #1000
	str	w1, [x0]
	ldr	w0, [sp, 548]
	add	w0, w0, 1
	str	w0, [sp, 548]
.L55:
	ldr	w0, [sp, 548]
	cmp	w0, 399
	ble	.L60
	mov	x1, 40
	ldr	x0, [sp, 584]
	bl	realloc
	str	x0, [sp, 584]
	ldr	x0, [sp, 560]
	mov	w7, w0
	ldr	x0, [sp, 568]
	mov	w3, w0
	ldr	x0, [sp, 584]
	ldr	w1, [x0]
	ldr	x0, [sp, 584]
	add	x0, x0, 4
	ldr	w2, [x0]
	ldr	x0, [sp, 584]
	add	x0, x0, 36
	ldr	w0, [x0]
	mov	w6, w0
	mov	w5, w2
	mov	w4, w1
	ldr	x2, [sp, 552]
	mov	w1, w7
	adrp	x0, .LC30
	add	x0, x0, :lo12:.LC30
	bl	printf
	ldr	x0, [sp, 584]
	bl	free
	str	xzr, [sp, 528]
	b	.L61
.L63:
	ldr	x0, [sp, 528]
	lsl	x0, x0, 3
	add	x1, sp, 56
	ldr	x0, [x1, x0]
	bl	free
	ldr	x0, [sp, 528]
	add	x0, x0, 1
	str	x0, [sp, 528]
.L61:
	ldr	x1, [sp, 528]
	ldr	x0, [sp, 560]
	cmp	x1, x0
	bcs	.L62
	ldr	x0, [sp, 528]
	cmp	x0, 31
	bls	.L63
.L62:
	mov	x0, 4000
	bl	malloc
	str	x0, [sp, 504]
	mov	x2, 4000
	mov	w1, 171
	ldr	x0, [sp, 504]
	bl	memset
	ldr	x0, [sp, 504]
	ldrb	w0, [x0]
	mov	w1, w0
	ldr	x0, [sp, 504]
	add	x0, x0, 3999
	ldrb	w0, [x0]
	mov	w2, w0
	adrp	x0, .LC31
	add	x0, x0, :lo12:.LC31
	bl	printf
	ldr	x0, [sp, 504]
	bl	free
	mov	x1, 4
	mov	x0, 1000
	bl	calloc
	str	x0, [sp, 496]
	str	wzr, [sp, 524]
	str	wzr, [sp, 520]
	b	.L64
.L65:
	ldrsw	x0, [sp, 520]
	ldr	x1, [sp, 496]
	add	x0, x1, x0
	ldrb	w0, [x0]
	cmp	w0, 0
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 524]
	add	w0, w0, w1
	str	w0, [sp, 524]
	ldr	w0, [sp, 520]
	add	w0, w0, 1
	str	w0, [sp, 520]
.L64:
	ldr	w0, [sp, 520]
	cmp	w0, 3999
	ble	.L65
	ldr	w1, [sp, 524]
	adrp	x0, .LC32
	add	x0, x0, :lo12:.LC32
	bl	printf
	ldr	x0, [sp, 496]
	bl	free
	ldr	x0, [sp, 424]
	bl	free
	ldr	x0, [sp, 456]
	bl	free
	mov	w0, 0
	ldp	x29, x30, [sp]
	ldp	x19, x20, [sp, 16]
	ldr	x21, [sp, 32]
	add	sp, sp, 640
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"hill"
	.align	3
.LC3:
	.string	"tractor"
	.align	3
.LC4:
	.string	"dragon"
	.align	3
.LC6:
	.string	"Kite"
	.align	3
.LC7:
	.string	"hedge"
	.align	3
.LC18:
	.quad	.LC0
	.quad	.LC1
	.quad	.LC2
	.quad	.LC3
	.quad	.LC4
	.quad	.LC5
	.quad	.LC6
	.quad	.LC7
	.align	3
.LC10:
	.string	"zebra"
	.align	3
.LC21:
	.quad	.LC0
	.quad	.LC9
	.quad	.LC10
	.quad	.LC9
	.quad	.LC11
	.quad	.LC12
	.text

