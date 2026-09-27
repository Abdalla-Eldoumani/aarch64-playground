	.text
	.align	2
	.align 5
around:
	add	w2, w0, 4
	cmp	w2, 11
	bls	.L18
	mov	w1, 7
	sdiv	w1, w0, w1
	lsl	w2, w1, 3
	sub	w1, w2, w1
	sub	w0, w0, w1
	add	w0, w0, 1000
	ret
	.align 2
.L18:
	adrp	x0, .L4
	add	x0, x0, :lo12:.L4
	ldrb	w0, [x0,w2,uxtw]
	adr	x2, .Lrtx4
	add	x0, x2, w0, sxtb #2
	br	x0
.Lrtx4:
	.section .rodata
	.align	0
	.align	2
.L4:
	.byte	(.L15 - .Lrtx4) / 4
	.byte	(.L14 - .Lrtx4) / 4
	.byte	(.L13 - .Lrtx4) / 4
	.byte	(.L12 - .Lrtx4) / 4
	.byte	(.L16 - .Lrtx4) / 4
	.byte	(.L10 - .Lrtx4) / 4
	.byte	(.L9 - .Lrtx4) / 4
	.byte	(.L8 - .Lrtx4) / 4
	.byte	(.L7 - .Lrtx4) / 4
	.byte	(.L6 - .Lrtx4) / 4
	.byte	(.L5 - .Lrtx4) / 4
	.byte	(.L3 - .Lrtx4) / 4
	.text
	.align 2
.L16:
	mov	w0, w1
	ret
	.align 2
.L10:
	asr	w0, w1, 1
	ret
	.align 2
.L9:
	mov	w0, 7
	udiv	w0, w1, w0
	lsl	w2, w0, 3
	sub	w0, w2, w0
	sub	w0, w1, w0
	ret
	.align 2
.L8:
	mul	w0, w1, w1
	ret
	.align 2
.L7:
	sub	w0, w1, #1000
	ret
	.align 2
.L6:
	mov	w0, 257
	orr	w0, w1, w0
	ret
	.align 2
.L5:
	and	w0, w1, 240
	ret
	.align 2
.L3:
	neg	w0, w1
	ret
	.align 2
.L15:
	lsl	w0, w1, 1
	ret
	.align 2
.L14:
	add	w0, w1, 30
	ret
	.align 2
.L13:
	sub	w0, w1, #20
	ret
	.align 2
.L12:
	eor	w0, w1, 1
	ret
	.section .rodata
	.align	3
.LC2:
	.string	" "
	.align	3
.LC3:
	.string	"\nbig: "
	.align	3
.LC4:
	.string	"big: "
	.align	3
.LC5:
	.string	"?"
	.align	3
.LC7:
	.string	"around:"
	.align	3
.LC8:
	.string	" %d"
	.align	3
.LC9:
	.string	" %d %d\n"
	.align	3
.LC10:
	.string	"%s%08x"
	.align	3
.LC11:
	.string	"month:"
	.align	3
.LC12:
	.string	" %s"
	.align	3
.LC13:
	.string	"wide:"
	.align	3
.LC14:
	.string	" %ld"
	.align	3
.LC15:
	.string	"cls: "
	.align	3
.LC16:
	.string	"Hello, World! 42 apples; 7 oranges?\t\200\377. Quiet x9 zone"
	.align	3
.LC17:
	.string	"\ncounts: %d %d %d %d %d %d\n"
	.align	3
.LC18:
	.string	"duff:"
	.align	3
.LC19:
	.string	" %d%c"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #576
	adrp	x0, .LANCHOR1
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	w20, 44
	ldr	w19, [x0, :lo12:.LANCHOR1]
	stp	x21, x22, [sp, 32]
	adrp	x21, .LC8
	sub	w22, w19, #50
	add	x21, x21, :lo12:.LC8
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	bl	printf
	.align 5
.L20:
	mov	w1, w20
	add	w0, w22, w20
	bl	around
	add	w20, w20, 1
	mov	w1, w0
	mov	x0, x21
	bl	printf
	cmp	w20, 60
	bne	.L20
	mov	w1, 5
	mov	w0, -2147483648
	add	w0, w19, w0
	bl	around
	mov	w3, w0
	mov	w1, 5
	mov	w0, 2147483647
	add	w0, w19, w0
	bl	around
	sub	w25, w19, #1
	mov	w2, w0
	mov	w1, w3
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	cmp	w25, 47
	bls	.L229
	mov	w21, 0
	mov	w2, -1
	adrp	x1, .LC4
	adrp	x0, .LC10
	add	x1, x1, :lo12:.LC4
	add	x0, x0, :lo12:.LC10
	bl	printf
	.align 5
.L110:
	mov	w0, 52429
	add	w20, w21, 1
	movk	w0, 0xcccc, lsl 16
	mov	w1, 858993459
	madd	w0, w21, w0, w0
	cmp	w0, w1
	bhi	.L160
	mov	w0, 4660
	add	w2, w21, w0
	add	w0, w20, w19
	adrp	x1, .LC3
	sub	w0, w0, #1
	add	x1, x1, :lo12:.LC3
	cmp	w0, 47
	bls	.L230
.L159:
	adrp	x0, .LC10
	mov	w21, w20
	add	x0, x0, :lo12:.LC10
	mov	w2, -1
	bl	printf
	cmp	w20, 49
	bne	.L110
	.align 5
.L73:
	mov	w0, 10
	bl	putchar
	adrp	x0, .LANCHOR0
	add	x22, x0, :lo12:.LANCHOR0
	adrp	x20, .LC12
	adrp	x0, .LC11
	add	x26, sp, 176
	add	x0, x0, :lo12:.LC11
	ldp	q29, q30, [x22, 16]
	add	x23, sp, 220
	ldr	q31, [x22, 44]
	add	x20, x20, :lo12:.LC12
	stp	q29, q30, [sp, 176]
	add	x24, x22, 64
	adrp	x21, .LC5
	str	q31, [sp, 204]
	bl	printf
	.align 5
.L76:
	ldr	w0, [x26]
	add	x1, x21, :lo12:.LC5
	add	w0, w19, w0
	sub	w0, w0, #1
	cmp	w0, 11
	bhi	.L75
	ldr	x1, [x24, w0, uxtw 3]
.L75:
	mov	x0, x20
	add	x26, x26, 4
	bl	printf
	cmp	x23, x26
	bne	.L76
	mov	w0, 10
	bl	putchar
	ldp	q31, q30, [x22, 224]
	add	x28, sp, 424
	ldp	q29, q28, [x22, 192]
	sxtw	x20, w19
	ldp	q27, q26, [x22, 160]
	stp	q31, q30, [x28, 64]
	adrp	x21, .LC14
	ldr	q31, [x22, 288]
	stp	q29, q28, [x28, 32]
	add	x21, x21, :lo12:.LC14
	ldp	q30, q29, [x22, 256]
	stp	q27, q26, [x28]
	adrp	x26, .L79
	ldr	x0, [x22, 304]
	stp	q30, q29, [x28, 96]
	str	q31, [x28, 128]
	str	x0, [x28, 144]
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	mov	x1, 26505
	mov	x0, 62983
	movk	x1, 0x2345, lsl 16
	movk	x0, 0xa98e, lsl 16
	movk	x1, 0x1, lsl 32
	movk	x0, 0xbd81, lsl 32
	add	x24, x20, x1
	movk	x0, 0x6a63, lsl 48
	lsr	x23, x24, 3
	lsl	x27, x24, 3
	umulh	x0, x24, x0
	lsr	x0, x0, 5
	add	x2, x0, x0, lsl 3
	add	x2, x0, x2, lsl 1
	add	x0, x0, x2, lsl 2
	sub	x0, x24, x0
	str	x0, [sp, 112]
	mov	x0, 63439
	movk	x0, 0xe353, lsl 16
	movk	x0, 0x9ba5, lsl 32
	movk	x0, 0x20c4, lsl 48
	umulh	x23, x23, x0
	mov	x0, 58255
	movk	x0, 0x8e38, lsl 16
	movk	x0, 0x38e3, lsl 32
	lsr	x23, x23, 4
	movk	x0, 0xe38e, lsl 48
	add	x23, x23, x23, lsl 2
	umulh	x0, x24, x0
	str	x0, [sp, 120]
	sub	x0, x27, x24
	add	x23, x23, x23, lsl 2
	str	x0, [sp, 104]
	sub	x0, x1, #100
	add	x23, x23, x23, lsl 2
	add	x1, x20, x0
	add	x0, x0, 200
	sub	x23, x24, x23, lsl 3
	add	x0, x20, x0
	stp	x1, x0, [sp, 128]
	.align 5
.L91:
	ldr	x0, [x28]
	add	x0, x20, x0
	cmp	x0, 11
	bhi	.L77
	cmp	w0, 11
	bls	.L231
.L77:
	mov	x1, -1
	b	.L88
	.align 2
.L231:
	add	x1, x26, :lo12:.L79
	ldrb	w1, [x1,w0,uxtw]
	adr	x0, .Lrtx79
	add	x1, x0, w1, sxtb #2
	br	x1
.Lrtx79:
	.section .rodata
	.align	0
	.align	2
.L79:
	.byte	(.L90 - .Lrtx79) / 4
	.byte	(.L89 - .Lrtx79) / 4
	.byte	(.L162 - .Lrtx79) / 4
	.byte	(.L87 - .Lrtx79) / 4
	.byte	(.L86 - .Lrtx79) / 4
	.byte	(.L85 - .Lrtx79) / 4
	.byte	(.L84 - .Lrtx79) / 4
	.byte	(.L83 - .Lrtx79) / 4
	.byte	(.L82 - .Lrtx79) / 4
	.byte	(.L81 - .Lrtx79) / 4
	.byte	(.L80 - .Lrtx79) / 4
	.byte	(.L78 - .Lrtx79) / 4
	.text
	.align 2
.L162:
	ldr	x1, [sp, 104]
	.align 5
.L88:
	mov	x0, x21
	bl	printf
	add	x28, x28, 8
	add	x0, sp, 576
	cmp	x0, x28
	bne	.L91
	mov	w0, 10
	bl	putchar
	adrp	x0, .LC15
	adrp	x20, .LC16
	add	x0, x0, :lo12:.LC15
	add	x20, x20, :lo12:.LC16
	stp	xzr, xzr, [sp, 152]
	add	x24, x20, 1
	adrp	x21, stdout
	str	xzr, [sp, 168]
	bl	printf
	add	x20, x20, 54
	add	x26, sp, 152
	add	x21, x21, :lo12:stdout
	add	x23, x22, 312
	mov	w0, 72
	b	.L93
	.align 2
.L233:
	ldrsb	w1, [x23, w0, uxtw]
	add	w0, w1, 48
.L92:
	sbfiz	x1, x1, 2, 32
	ldr	w2, [x26, x1]
	add	w2, w2, 1
	str	w2, [x26, x1]
	ldr	x1, [x21]
	bl	putc
	ldrb	w0, [x24], 1
	cmp	x20, x24
	beq	.L232
.L93:
	add	w0, w0, w19
	cmp	w0, 117
	bls	.L233
	mov	w0, 52
	mov	w1, 4
	b	.L92
	.align 2
.L89:
	ldr	x1, [sp, 128]
	b	.L88
	.align 2
.L90:
	ldr	x1, [sp, 136]
	b	.L88
	.align 2
.L78:
	ldr	x0, [sp, 112]
	add	x1, x0, 1
	b	.L88
	.align 2
.L80:
	sub	x1, x24, x24, asr 5
	b	.L88
	.align 2
.L81:
	and	x1, x24, 65535
	b	.L88
	.align 2
.L82:
	mvn	x1, x24
	b	.L88
	.align 2
.L83:
	mov	x1, x23
	b	.L88
	.align 2
.L84:
	ldr	x0, [sp, 120]
	lsr	x1, x0, 3
	b	.L88
	.align 2
.L85:
	asr	x1, x24, 2
	b	.L88
	.align 2
.L86:
	mov	x1, x27
	b	.L88
	.align 2
.L87:
	eor	x1, x24, 127
	b	.L88
	.align 2
.L160:
	mov	w0, 4660
	add	w2, w21, w0
	add	w0, w20, w19
	adrp	x1, .LC2
	sub	w0, w0, #1
	add	x1, x1, :lo12:.LC2
	cmp	w0, 47
	bhi	.L159
.L230:
	adrp	x3, .L72
	add	x3, x3, :lo12:.L72
	ldrh	w3, [x3,w0,uxtw #1]
	adr	x0, .Lrtx72
	add	x3, x0, w3, sxth #2
	br	x3
.Lrtx72:
	.section .rodata
	.align	0
	.align	2
.L72:
	.hword	(.L70 - .Lrtx72) / 4
	.hword	(.L69 - .Lrtx72) / 4
	.hword	(.L68 - .Lrtx72) / 4
	.hword	(.L67 - .Lrtx72) / 4
	.hword	(.L66 - .Lrtx72) / 4
	.hword	(.L65 - .Lrtx72) / 4
	.hword	(.L64 - .Lrtx72) / 4
	.hword	(.L63 - .Lrtx72) / 4
	.hword	(.L62 - .Lrtx72) / 4
	.hword	(.L61 - .Lrtx72) / 4
	.hword	(.L60 - .Lrtx72) / 4
	.hword	(.L59 - .Lrtx72) / 4
	.hword	(.L58 - .Lrtx72) / 4
	.hword	(.L57 - .Lrtx72) / 4
	.hword	(.L56 - .Lrtx72) / 4
	.hword	(.L55 - .Lrtx72) / 4
	.hword	(.L54 - .Lrtx72) / 4
	.hword	(.L53 - .Lrtx72) / 4
	.hword	(.L52 - .Lrtx72) / 4
	.hword	(.L51 - .Lrtx72) / 4
	.hword	(.L50 - .Lrtx72) / 4
	.hword	(.L49 - .Lrtx72) / 4
	.hword	(.L48 - .Lrtx72) / 4
	.hword	(.L47 - .Lrtx72) / 4
	.hword	(.L46 - .Lrtx72) / 4
	.hword	(.L45 - .Lrtx72) / 4
	.hword	(.L44 - .Lrtx72) / 4
	.hword	(.L43 - .Lrtx72) / 4
	.hword	(.L42 - .Lrtx72) / 4
	.hword	(.L41 - .Lrtx72) / 4
	.hword	(.L40 - .Lrtx72) / 4
	.hword	(.L39 - .Lrtx72) / 4
	.hword	(.L38 - .Lrtx72) / 4
	.hword	(.L37 - .Lrtx72) / 4
	.hword	(.L36 - .Lrtx72) / 4
	.hword	(.L35 - .Lrtx72) / 4
	.hword	(.L34 - .Lrtx72) / 4
	.hword	(.L33 - .Lrtx72) / 4
	.hword	(.L32 - .Lrtx72) / 4
	.hword	(.L31 - .Lrtx72) / 4
	.hword	(.L30 - .Lrtx72) / 4
	.hword	(.L29 - .Lrtx72) / 4
	.hword	(.L28 - .Lrtx72) / 4
	.hword	(.L27 - .Lrtx72) / 4
	.hword	(.L26 - .Lrtx72) / 4
	.hword	(.L25 - .Lrtx72) / 4
	.hword	(.L24 - .Lrtx72) / 4
	.hword	(.L22 - .Lrtx72) / 4
	.text
.L157:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L24:
	mov	w0, 22775
	mov	w3, 403
	movk	w0, 0xc2f, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 58437
	movk	w2, 0xabc5, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L156:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L25:
	mov	w0, 57150
	mov	w3, 403
	movk	w0, 0x6df7, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 59206
	movk	w2, 0xa8c6, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L155:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L26:
	mov	w0, 25989
	mov	w3, 403
	movk	w0, 0xcfc0, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 58951
	movk	w2, 0xa9c7, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L154:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L27:
	mov	w0, 60364
	mov	w3, 403
	movk	w0, 0x3188, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 57664
	movk	w2, 0xaec0, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L153:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L28:
	mov	w0, 29203
	mov	w3, 403
	movk	w0, 0x9351, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 57409
	movk	w2, 0xafc1, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L152:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L29:
	mov	w0, 63578
	mov	w3, 403
	movk	w0, 0xf519, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 58178
	movk	w2, 0xacc2, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L151:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L30:
	mov	w0, 32417
	mov	w3, 403
	movk	w0, 0x56e2, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 57923
	movk	w2, 0xadc3, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L150:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L31:
	mov	w0, 1256
	mov	w3, 403
	movk	w0, 0xb8ab, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 60748
	movk	w2, 0xa2cc, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L149:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L32:
	mov	w0, 35631
	mov	w3, 403
	movk	w0, 0x1a73, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 60493
	movk	w2, 0xa3cd, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L148:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L33:
	mov	w0, 4470
	mov	w3, 403
	movk	w0, 0x7c3c, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 61262
	movk	w2, 0xa0ce, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L147:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L34:
	mov	w0, 38845
	mov	w3, 403
	movk	w0, 0xde04, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 61007
	movk	w2, 0xa1cf, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L146:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L35:
	mov	w0, 7684
	mov	w3, 403
	movk	w0, 0x3fcd, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 59720
	movk	w2, 0xa6c8, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L145:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L36:
	mov	w0, 42059
	mov	w3, 403
	movk	w0, 0xa195, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 59465
	movk	w2, 0xa7c9, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L144:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L37:
	mov	w0, 10898
	mov	w3, 403
	movk	w0, 0x35e, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 60234
	movk	w2, 0xa4ca, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L143:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L38:
	mov	w0, 45273
	mov	w3, 403
	movk	w0, 0x6526, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 59979
	movk	w2, 0xa5cb, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L142:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L39:
	mov	w0, 14112
	mov	w3, 403
	movk	w0, 0xc6ef, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 54644
	movk	w2, 0x9af4, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L141:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L40:
	mov	w0, 48487
	mov	w3, 403
	movk	w0, 0x28b7, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 54389
	movk	w2, 0x9bf5, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L140:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L41:
	mov	w0, 17326
	mov	w3, 403
	movk	w0, 0x8a80, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 55158
	movk	w2, 0x98f6, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L139:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L42:
	mov	w0, 51701
	mov	w3, 403
	movk	w0, 0xec48, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 54903
	movk	w2, 0x99f7, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L138:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L43:
	mov	w0, 20540
	mov	w3, 403
	movk	w0, 0x4e11, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 53616
	movk	w2, 0x9ef0, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L137:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L44:
	mov	w0, 54915
	mov	w3, 403
	movk	w0, 0xafd9, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 53361
	movk	w2, 0x9ff1, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L136:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L45:
	mov	w0, 23754
	mov	w3, 403
	movk	w0, 0x11a2, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 54130
	movk	w2, 0x9cf2, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L135:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L46:
	mov	w0, 58129
	mov	w3, 403
	movk	w0, 0x736a, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 53875
	movk	w2, 0x9df3, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L134:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L47:
	mov	w0, 26968
	mov	w3, 403
	movk	w0, 0xd533, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 56700
	movk	w2, 0x92fc, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L133:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L48:
	mov	w0, 61343
	mov	w3, 403
	movk	w0, 0x36fb, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 56445
	movk	w2, 0x93fd, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L132:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L49:
	mov	w0, 30182
	mov	w3, 403
	movk	w0, 0x98c4, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 57214
	movk	w2, 0x90fe, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L131:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L50:
	mov	w0, 64557
	mov	w3, 403
	movk	w0, 0xfa8c, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 56959
	movk	w2, 0x91ff, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L130:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L51:
	mov	w0, 33396
	mov	w3, 403
	movk	w0, 0x5c55, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 55672
	movk	w2, 0x96f8, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L129:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L52:
	mov	w0, 2235
	mov	w3, 403
	movk	w0, 0xbe1e, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 55417
	movk	w2, 0x97f9, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L128:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L53:
	mov	w0, 36610
	mov	w3, 403
	movk	w0, 0x1fe6, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 56186
	movk	w2, 0x94fa, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L127:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L54:
	mov	w0, 5449
	mov	w3, 403
	movk	w0, 0x81af, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 55931
	movk	w2, 0x95fb, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L126:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L55:
	mov	w0, 39824
	mov	w3, 403
	movk	w0, 0xe377, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 50532
	movk	w2, 0x8ae4, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L125:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L56:
	mov	w0, 8663
	mov	w3, 403
	movk	w0, 0x4540, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 50277
	movk	w2, 0x8be5, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L124:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L57:
	mov	w0, 43038
	mov	w3, 403
	movk	w0, 0xa708, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 51046
	movk	w2, 0x88e6, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L123:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L58:
	mov	w0, 11877
	mov	w3, 403
	movk	w0, 0x8d1, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 50791
	movk	w2, 0x89e7, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L122:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L59:
	mov	w0, 46252
	mov	w3, 403
	movk	w0, 0x6a99, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 49504
	movk	w2, 0x8ee0, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L121:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L60:
	mov	w0, 15091
	mov	w3, 403
	movk	w0, 0xcc62, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 49249
	movk	w2, 0x8fe1, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L120:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L61:
	mov	w0, 49466
	mov	w3, 403
	movk	w0, 0x2e2a, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 50018
	movk	w2, 0x8ce2, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L119:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L62:
	mov	w0, 18305
	mov	w3, 403
	movk	w0, 0x8ff3, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 49763
	movk	w2, 0x8de3, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L118:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L63:
	mov	w0, 52680
	mov	w3, 403
	movk	w0, 0xf1bb, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 52588
	movk	w2, 0x82ec, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L117:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L64:
	mov	w0, 21519
	mov	w3, 403
	movk	w0, 0x5384, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 52333
	movk	w2, 0x83ed, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L116:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L65:
	mov	w0, 55894
	mov	w3, 403
	movk	w0, 0xb54c, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 53102
	movk	w2, 0x80ee, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L115:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L66:
	mov	w0, 24733
	mov	w3, 403
	movk	w0, 0x1715, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 52847
	movk	w2, 0x81ef, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L114:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L67:
	mov	w0, 59108
	mov	w3, 403
	movk	w0, 0x78dd, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 51560
	movk	w2, 0x86e8, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L113:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L68:
	mov	w0, 27947
	mov	w3, 403
	movk	w0, 0xdaa6, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 51305
	movk	w2, 0x87e9, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L112:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L69:
	mov	w0, 62322
	mov	w3, 403
	movk	w0, 0x3c6e, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 52074
	movk	w2, 0x84ea, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L111:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L70:
	mov	w0, 31161
	mov	w3, 403
	movk	w0, 0x9e37, lsl 16
	eor	w0, w2, w0
	movk	w3, 0x100, lsl 16
	mov	w2, 51819
	movk	w2, 0x85eb, lsl 16
	mov	w21, w20
	mul	w0, w0, w3
	eor	w0, w0, w0, lsr 13
	eor	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	mul	w2, w2, w3
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
.L158:
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	mov	w2, 4659
.L22:
	mov	w0, 53936
	mov	w3, 58692
	movk	w0, 0xaa66, lsl 16
	eor	w0, w2, w0
	mov	w2, 403
	movk	w3, 0xaac4, lsl 16
	movk	w2, 0x100, lsl 16
	mov	w21, w20
	mul	w0, w0, w2
	eor	w0, w0, w0, lsr 13
	eor	w0, w0, w3
	mul	w2, w0, w2
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	eor	w2, w2, w2, lsr 13
	bl	printf
	cmp	w20, 49
	bne	.L110
	b	.L73
	.align 2
.L229:
	adrp	x0, .L23
	mov	w20, 0
	add	x0, x0, :lo12:.L23
	ldrh	w0, [x0,w25,uxtw #1]
	adr	x1, .Lrtx23
	add	x0, x1, w0, sxth #2
	br	x0
.Lrtx23:
	.section .rodata
	.align	0
	.align	2
.L23:
	.hword	(.L111 - .Lrtx23) / 4
	.hword	(.L112 - .Lrtx23) / 4
	.hword	(.L113 - .Lrtx23) / 4
	.hword	(.L114 - .Lrtx23) / 4
	.hword	(.L115 - .Lrtx23) / 4
	.hword	(.L116 - .Lrtx23) / 4
	.hword	(.L117 - .Lrtx23) / 4
	.hword	(.L118 - .Lrtx23) / 4
	.hword	(.L119 - .Lrtx23) / 4
	.hword	(.L120 - .Lrtx23) / 4
	.hword	(.L121 - .Lrtx23) / 4
	.hword	(.L122 - .Lrtx23) / 4
	.hword	(.L123 - .Lrtx23) / 4
	.hword	(.L124 - .Lrtx23) / 4
	.hword	(.L125 - .Lrtx23) / 4
	.hword	(.L126 - .Lrtx23) / 4
	.hword	(.L127 - .Lrtx23) / 4
	.hword	(.L128 - .Lrtx23) / 4
	.hword	(.L129 - .Lrtx23) / 4
	.hword	(.L130 - .Lrtx23) / 4
	.hword	(.L131 - .Lrtx23) / 4
	.hword	(.L132 - .Lrtx23) / 4
	.hword	(.L133 - .Lrtx23) / 4
	.hword	(.L134 - .Lrtx23) / 4
	.hword	(.L135 - .Lrtx23) / 4
	.hword	(.L136 - .Lrtx23) / 4
	.hword	(.L137 - .Lrtx23) / 4
	.hword	(.L138 - .Lrtx23) / 4
	.hword	(.L139 - .Lrtx23) / 4
	.hword	(.L140 - .Lrtx23) / 4
	.hword	(.L141 - .Lrtx23) / 4
	.hword	(.L142 - .Lrtx23) / 4
	.hword	(.L143 - .Lrtx23) / 4
	.hword	(.L144 - .Lrtx23) / 4
	.hword	(.L145 - .Lrtx23) / 4
	.hword	(.L146 - .Lrtx23) / 4
	.hword	(.L147 - .Lrtx23) / 4
	.hword	(.L148 - .Lrtx23) / 4
	.hword	(.L149 - .Lrtx23) / 4
	.hword	(.L150 - .Lrtx23) / 4
	.hword	(.L151 - .Lrtx23) / 4
	.hword	(.L152 - .Lrtx23) / 4
	.hword	(.L153 - .Lrtx23) / 4
	.hword	(.L154 - .Lrtx23) / 4
	.hword	(.L155 - .Lrtx23) / 4
	.hword	(.L156 - .Lrtx23) / 4
	.hword	(.L157 - .Lrtx23) / 4
	.hword	(.L158 - .Lrtx23) / 4
	.text
	.align 2
.L232:
	ldp	w1, w2, [sp, 152]
	mov	w6, 4
	ldp	w3, w4, [sp, 160]
	ldr	w5, [sp, 168]
	cmp	w19, 117
	bhi	.L94
	add	x22, x22, 312
	ldrsb	w6, [x22, w19, uxtw]
.L94:
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	add	x22, sp, 224
	adrp	x2, .LANCHOR0
	mov	x0, x22
	movi	v29.4s, 0x4
	add	x1, sp, 320
	ldr	q31, [x2, :lo12:.LANCHOR0]
	.align 5
.L95:
	movi	v28.4s, 0x1
	mla	v28.4s, v31.4s, v31.4s
	add	v31.4s, v31.4s, v29.4s
	str	q28, [x0], 16
	cmp	x1, x0
	bne	.L95
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	printf
	add	x20, sp, 328
	mvni	v31.4s, 0
	add	w19, w19, 6
	adrp	x0, .LC19
	mov	x21, 2
	add	x0, x0, :lo12:.LC19
	mov	w24, 33
	mov	w23, 43
	str	x0, [sp, 104]
.L96:
	adds	w1, w19, w21
	add	w0, w25, w21
	add	w2, w1, 7
	stp	q31, q31, [x20]
	csel	w2, w2, w1, mi
	negs	w1, w0
	and	w0, w0, 7
	and	w1, w1, 7
	stp	q31, q31, [x20, 32]
	csneg	w1, w0, w1, mi
	stp	q31, q31, [x20, 64]
	asr	w2, w2, 3
	cmp	w1, 4
	beq	.L166
	bgt	.L103
	cmp	w1, 2
	beq	.L167
	cmp	w1, 3
	beq	.L168
	cbz	w0, .L169
	cmp	w1, 1
	bne	.L97
	mov	x1, x22
	mov	x0, x20
	b	.L106
	.align 2
.L103:
	cmp	w1, 6
	beq	.L171
	cmp	w1, 7
	mov	x0, x20
	mov	x1, x22
	beq	.L108
.L109:
	ldr	w3, [x1], 4
	str	w3, [x0], 4
.L102:
	ldr	w3, [x1], 4
	str	w3, [x0], 4
.L105:
	ldr	w3, [x1], 4
	str	w3, [x0], 4
.L104:
	ldr	w3, [x1], 4
	str	w3, [x0], 4
.L106:
	ldr	w3, [x1]
	sub	w2, w2, #1
	str	w3, [x0]
	cmp	w2, 0
	ble	.L97
	add	x1, x1, 4
	add	x0, x0, 4
.L98:
	ldr	w3, [x1], 4
	str	w3, [x0], 4
.L108:
	ldr	w3, [x1], 4
	str	w3, [x0], 4
.L107:
	ldr	w3, [x1], 4
	str	w3, [x0], 4
	b	.L109
.L168:
	mov	x1, x22
	mov	x0, x20
	b	.L105
	.align 2
.L97:
	mov	x0, 1
	mov	w3, w0
	mov	w1, 0
	.align 5
.L99:
	add	x2, x20, x0, lsl 2
	add	x4, x22, x0, lsl 2
	add	x0, x0, 1
	ldr	w2, [x2, -4]
	ldr	w4, [x4, -4]
	add	w1, w1, w2
	cmp	w4, w2
	cset	w4, eq
	and	w3, w3, w4
	cmp	x21, x0
	bne	.L99
	add	x0, x20, x21, lsl 2
	add	x21, x21, 1
	ldr	w0, [x0, -4]
	cmn	w0, #1
	cset	w0, eq
	tst	w0, w3
	ldr	x0, [sp, 104]
	csel	w2, w24, w23, eq
	bl	printf
	mvni	v31.4s, 0
	cmp	x21, 22
	bne	.L96
	mov	w0, 10
	bl	putchar
	ldp	x29, x30, [sp]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	add	sp, sp, 576
	ret
.L171:
	mov	x1, x22
	mov	x0, x20
	b	.L107
.L169:
	mov	x1, x22
	mov	x0, x20
	b	.L98
.L166:
	mov	x1, x22
	mov	x0, x20
	b	.L102
.L167:
	mov	x1, x22
	mov	x0, x20
	b	.L104
	.section .rodata
	.align	3
.LC20:
	.string	"jan"
	.align	3
.LC21:
	.string	"feb"
	.align	3
.LC22:
	.string	"mar"
	.align	3
.LC23:
	.string	"apr"
	.align	3
.LC24:
	.string	"may"
	.align	3
.LC25:
	.string	"jun"
	.align	3
.LC26:
	.string	"jul"
	.align	3
.LC27:
	.string	"aug"
	.align	3
.LC28:
	.string	"sep"
	.align	3
.LC29:
	.string	"oct"
	.align	3
.LC30:
	.string	"nov"
	.align	3
.LC31:
	.string	"dec"
	.bss
	.align	2
	.LANCHOR1:
vzero:
	.zero	4
	.section .rodata
	.align	4
	.LANCHOR0:
.LC6:
	.word	0
	.word	1
	.word	2
	.word	3
.LC0:
	.word	-2147483648
	.word	-1
	.word	0
	.word	1
	.word	2
	.word	6
	.word	11
	.word	12
	.word	13
	.word	14
	.word	2147483647
	.zero	4
CSWTCH__24:
	.quad	.LC20
	.quad	.LC21
	.quad	.LC22
	.quad	.LC23
	.quad	.LC24
	.quad	.LC25
	.quad	.LC26
	.quad	.LC27
	.quad	.LC28
	.quad	.LC29
	.quad	.LC30
	.quad	.LC31
.LC1:
	.quad	0
	.quad	1
	.quad	2
	.quad	3
	.quad	4
	.quad	5
	.quad	6
	.quad	7
	.quad	8
	.quad	9
	.quad	10
	.quad	11
	.quad	12
	.quad	-1
	.quad	4294967299
	.quad	9223372032559808517
	.quad	-9223372036854775808
	.quad	9223372036854775807
	.quad	4294967295
CSWTCH__27:
	.byte	5
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	2
	.byte	2
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	2
	.byte	3
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	3
	.byte	4
	.byte	3
	.byte	4
	.byte	1
	.byte	1
	.byte	1
	.byte	1
	.byte	1
	.byte	1
	.byte	1
	.byte	1
	.byte	1
	.byte	1
	.byte	4
	.byte	3
	.byte	4
	.byte	4
	.byte	4
	.byte	3
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	0

