	.text
	.section .rodata
	.align	3
.LC0:
	.string	"\\x%02x"
	.align	3
.LC1:
	.string	"\""
	.text
	.align	2
show:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	w1, [sp, 20]
	mov	w0, 34
	bl	putchar
	str	wzr, [sp, 44]
	b	.L2
.L5:
	ldrsw	x0, [sp, 44]
	ldr	x1, [sp, 24]
	add	x0, x1, x0
	ldrb	w0, [x0]
	strb	w0, [sp, 43]
	ldrb	w0, [sp, 43]
	cmp	w0, 31
	bls	.L3
	ldrb	w0, [sp, 43]
	cmp	w0, 126
	bhi	.L3
	ldrb	w0, [sp, 43]
	cmp	w0, 92
	beq	.L3
	ldrb	w0, [sp, 43]
	bl	putchar
	b	.L4
.L3:
	ldrb	w0, [sp, 43]
	mov	w1, w0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
.L4:
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L2:
	ldr	w1, [sp, 44]
	ldr	w0, [sp, 20]
	cmp	w1, w0
	blt	.L5
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	puts
	nop
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"tail"
	.align	3
.LC3:
	.string	"%-5d|%+.2f|%s|%#x"
	.align	3
.LC5:
	.string	"size=%2zu n=%d "
	.align	3
.LC6:
	.string	"pad"
	.align	3
.LC7:
	.string	"%10.3e|%-8s|"
	.align	3
.LC9:
	.string	"ef"
	.align	3
.LC10:
	.string	"ab%ccd%s"
	.align	3
.LC11:
	.string	"n=%d strlen=%zu "
	.align	3
.LC12:
	.string	","
	.align	3
.LC13:
	.string	""
	.align	3
.LC14:
	.string	"%s%03d:%x:%-3c"
	.align	3
.LC15:
	.string	"pos=%d strlen=%zu [%s]\n"
	.align	3
.LC16:
	.string	"<%d:%.1f>"
	.align	3
.LC17:
	.string	"i=%d want=%d pos=%d\n"
	.align	3
.LC18:
	.string	"final pos=%d strlen=%zu [%s]\n"
	.align	3
.LC19:
	.string	"s"
	.align	3
.LC20:
	.string	"fp:%d,%ld,%s,%c,%5.2f,%x,%u,%d,%d,%d|"
	.align	3
.LC21:
	.string	" n=%d m=%d\n"
	.align	3
.LC22:
	.string	"ok"
	.align	3
.LC23:
	.string	"%08.3f|%-6d|%+i|%5s|%%|%o"
	.align	3
.LC24:
	.string	"%s\n"
	.align	3
.LC25:
	.string	"n=%d p=%d same=%d\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #400
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	str	xzr, [sp, 392]
	b	.L7
.L10:
	add	x0, sp, 312
	mov	x2, 48
	mov	w1, 35
	bl	memset
	ldr	x0, [sp, 392]
	cmp	x0, 0
	beq	.L8
	add	x0, sp, 312
	b	.L9
.L8:
	mov	x0, 0
.L9:
	mov	w5, 31
	adrp	x1, .LC2
	add	x4, x1, :lo12:.LC2
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	ldr	d0, [x1]
	mov	w3, 42
	adrp	x1, .LC3
	add	x2, x1, :lo12:.LC3
	ldr	x1, [sp, 392]
	bl	snprintf
	str	w0, [sp, 376]
	ldr	w2, [sp, 376]
	ldr	x1, [sp, 392]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	add	x0, sp, 312
	mov	w1, 24
	bl	show
	ldr	x0, [sp, 392]
	add	x0, x0, 1
	str	x0, [sp, 392]
.L7:
	ldr	x0, [sp, 392]
	cmp	x0, 23
	bls	.L10
	mov	x0, 1
	str	x0, [sp, 48]
	b	.L11
.L12:
	add	x0, sp, 312
	mov	x2, 48
	mov	w1, 35
	bl	memset
	ldr	x1, [sp, 48]
	add	x4, sp, 312
	adrp	x0, .LC6
	add	x3, x0, :lo12:.LC6
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	ldr	d0, [x0]
	adrp	x0, .LC7
	add	x2, x0, :lo12:.LC7
	mov	x0, x4
	bl	snprintf
	str	w0, [sp, 376]
	ldr	x0, [sp, 48]
	ldr	w2, [sp, 376]
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	add	x0, sp, 312
	mov	w1, 16
	bl	show
	ldr	x0, [sp, 48]
	add	x0, x0, 3
	str	x0, [sp, 48]
.L11:
	ldr	x0, [sp, 48]
	cmp	x0, 13
	bls	.L12
	add	x0, sp, 312
	mov	x2, 48
	mov	w1, 35
	bl	memset
	add	x4, sp, 312
	adrp	x0, .LC9
	add	x3, x0, :lo12:.LC9
	mov	w2, 0
	adrp	x0, .LC10
	add	x1, x0, :lo12:.LC10
	mov	x0, x4
	bl	sprintf
	str	w0, [sp, 376]
	add	x0, sp, 312
	bl	strlen
	mov	x2, x0
	ldr	w1, [sp, 376]
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	ldr	w0, [sp, 376]
	add	w1, w0, 2
	add	x0, sp, 312
	bl	show
	str	wzr, [sp, 388]
	str	wzr, [sp, 384]
	b	.L13
.L16:
	ldrsw	x0, [sp, 388]
	add	x1, sp, 56
	add	x6, x1, x0
	ldr	w0, [sp, 384]
	cmp	w0, 0
	beq	.L14
	adrp	x0, .LC12
	add	x2, x0, :lo12:.LC12
	b	.L15
.L14:
	adrp	x0, .LC13
	add	x2, x0, :lo12:.LC13
.L15:
	ldr	w1, [sp, 384]
	mov	w0, w1
	lsl	w0, w0, 3
	add	w0, w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	sub	w3, w0, #100
	ldr	w1, [sp, 384]
	mov	w0, w1
	lsl	w0, w0, 8
	sub	w1, w0, w1
	ldr	w0, [sp, 384]
	add	w0, w0, 97
	mov	w5, w0
	mov	w4, w1
	adrp	x0, .LC14
	add	x1, x0, :lo12:.LC14
	mov	x0, x6
	bl	sprintf
	mov	w1, w0
	ldr	w0, [sp, 388]
	add	w0, w0, w1
	str	w0, [sp, 388]
	ldr	w0, [sp, 384]
	add	w0, w0, 1
	str	w0, [sp, 384]
.L13:
	ldr	w0, [sp, 384]
	cmp	w0, 7
	ble	.L16
	add	x0, sp, 56
	bl	strlen
	mov	x1, x0
	add	x0, sp, 56
	mov	x3, x0
	mov	x2, x1
	ldr	w1, [sp, 388]
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	str	wzr, [sp, 388]
	str	wzr, [sp, 380]
	b	.L17
.L20:
	ldrsw	x0, [sp, 388]
	add	x1, sp, 312
	add	x4, x1, x0
	ldrsw	x0, [sp, 388]
	mov	x1, 48
	sub	x1, x1, x0
	ldr	w0, [sp, 380]
	scvtf	d30, w0
	fmov	d31, 5.0e-1
	fmul	d31, d30, d31
	fmov	d0, d31
	ldr	w3, [sp, 380]
	adrp	x0, .LC16
	add	x2, x0, :lo12:.LC16
	mov	x0, x4
	bl	snprintf
	str	w0, [sp, 372]
	ldr	w3, [sp, 388]
	ldr	w2, [sp, 372]
	ldr	w1, [sp, 380]
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	ldr	w0, [sp, 388]
	mov	w1, 48
	sub	w0, w1, w0
	mov	w1, w0
	ldr	w0, [sp, 372]
	cmp	w0, w1
	blt	.L18
	mov	w0, 47
	str	w0, [sp, 388]
	b	.L19
.L18:
	ldr	w1, [sp, 388]
	ldr	w0, [sp, 372]
	add	w0, w1, w0
	str	w0, [sp, 388]
	ldr	w0, [sp, 380]
	add	w0, w0, 1
	str	w0, [sp, 380]
.L17:
	ldr	w0, [sp, 380]
	cmp	w0, 11
	ble	.L20
.L19:
	add	x0, sp, 312
	bl	strlen
	mov	x1, x0
	add	x0, sp, 312
	mov	x3, x0
	mov	x2, x1
	ldr	w1, [sp, 388]
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	printf
	adrp	x0, stdout
	add	x0, x0, :lo12:stdout
	ldr	x8, [x0]
	mov	w0, 10
	str	w0, [sp, 16]
	mov	w0, 9
	str	w0, [sp, 8]
	mov	w0, 8
	str	w0, [sp]
	mov	w7, 7
	mov	w6, 2748
	fmov	d0, 2.25e+0
	mov	w5, 99
	adrp	x0, .LC19
	add	x4, x0, :lo12:.LC19
	mov	x3, 1099511627776
	mov	w2, -1
	adrp	x0, .LC20
	add	x1, x0, :lo12:.LC20
	mov	x0, x8
	bl	fprintf
	str	w0, [sp, 376]
	mov	w0, 33
	bl	putchar
	str	w0, [sp, 368]
	ldr	w2, [sp, 368]
	ldr	w1, [sp, 376]
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	printf
	add	x7, sp, 56
	mov	w6, 8
	adrp	x0, .LC22
	add	x5, x0, :lo12:.LC22
	mov	w4, 3
	mov	w3, -17
	fmov	d0, -2.5e+0
	adrp	x0, .LC23
	add	x2, x0, :lo12:.LC23
	mov	x1, 256
	mov	x0, x7
	bl	snprintf
	str	w0, [sp, 376]
	add	x0, sp, 56
	mov	x1, x0
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	printf
	str	w0, [sp, 364]
	ldr	w0, [sp, 376]
	add	w0, w0, 1
	ldr	w1, [sp, 364]
	cmp	w1, w0
	cset	w0, eq
	and	w0, w0, 255
	mov	w3, w0
	ldr	w2, [sp, 364]
	ldr	w1, [sp, 376]
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	add	sp, sp, 400
	ret
	.section .rodata
	.align	3
.LC4:
	.word	-266631570
	.word	-1073143303
	.align	3
.LC8:
	.word	1834810029
	.word	1083394629

