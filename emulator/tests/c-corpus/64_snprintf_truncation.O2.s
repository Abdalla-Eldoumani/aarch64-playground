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
	.align 5
show:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x0
	mov	w20, w1
	mov	w0, 34
	bl	putchar
	cmp	w20, 0
	ble	.L2
	add	x20, x19, w20, sxtw
	stp	x21, x22, [sp, 32]
	adrp	x22, .LC0
	mov	w21, 92
	add	x22, x22, :lo12:.LC0
	b	.L5
	.align 2
.L10:
	add	x19, x19, 1
	bl	putchar
	cmp	x20, x19
	beq	.L9
.L5:
	ldrb	w0, [x19]
	sub	w2, w0, #32
	and	w2, w2, 255
	cmp	w2, 94
	ccmp	w0, w21, 4, ls
	bne	.L10
	mov	w1, w0
	add	x19, x19, 1
	mov	x0, x22
	bl	printf
	cmp	x20, x19
	bne	.L5
.L9:
	ldp	x21, x22, [sp, 32]
.L2:
	adrp	x0, .LC1
	ldp	x19, x20, [sp, 16]
	add	x0, x0, :lo12:.LC1
	ldp	x29, x30, [sp], 48
	b	puts
	.section .rodata
	.align	3
.LC2:
	.string	","
	.align	3
.LC3:
	.string	""
	.align	3
.LC4:
	.string	"tail"
	.align	3
.LC6:
	.string	"%-5d|%+.2f|%s|%#x"
	.align	3
.LC7:
	.string	"size=%2zu n=%d "
	.align	3
.LC8:
	.string	"pad"
	.align	3
.LC10:
	.string	"%10.3e|%-8s|"
	.align	3
.LC11:
	.string	"ef"
	.align	3
.LC12:
	.string	"ab%ccd%s"
	.align	3
.LC13:
	.string	"n=%d strlen=%zu "
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
	.align 5
	.global	main
main:
	sub	sp, sp, #448
	mov	w1, 35
	mov	x2, 48
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	stp	x19, x20, [sp, 48]
	add	x20, sp, 144
	mov	x0, x20
	stp	x21, x22, [sp, 64]
	mov	x19, 0
	adrp	x22, .LC6
	stp	x23, x24, [sp, 80]
	adrp	x21, .LC7
	adrp	x23, .LC4
	stp	x25, x26, [sp, 96]
	add	x23, x23, :lo12:.LC4
	add	x22, x22, :lo12:.LC6
	stp	d14, d15, [sp, 112]
	bl	memset
	adrp	x1, .LC5
	add	x21, x21, :lo12:.LC7
	mov	x0, 0
	ldr	d15, [x1, :lo12:.LC5]
	b	.L13
	.align 2
.L24:
	mov	x0, x20
	mov	x2, 48
	mov	w1, 35
	bl	memset
	mov	x0, x20
.L13:
	fmov	d0, d15
	mov	x4, x23
	mov	x2, x22
	mov	x1, x19
	mov	w5, 31
	mov	w3, 42
	bl	snprintf
	mov	w2, w0
	mov	x1, x19
	mov	x0, x21
	bl	printf
	add	x19, x19, 1
	mov	x0, x20
	mov	w1, 24
	bl	show
	cmp	x19, 24
	bne	.L24
	mov	x0, 1
	str	x0, [sp, 136]
	ldr	x0, [sp, 136]
	cmp	x0, 13
	bhi	.L14
	adrp	x0, .LC9
	adrp	x22, .LC8
	adrp	x19, .LC10
	add	x22, x22, :lo12:.LC8
	add	x19, x19, :lo12:.LC10
	ldr	d14, [x0, :lo12:.LC9]
	.align 5
.L15:
	mov	x2, 48
	mov	w1, 35
	mov	x0, x20
	bl	memset
	ldr	x1, [sp, 136]
	fmov	d0, d14
	mov	x3, x22
	mov	x2, x19
	mov	x0, x20
	bl	snprintf
	mov	w2, w0
	ldr	x1, [sp, 136]
	mov	x0, x21
	bl	printf
	mov	x0, x20
	mov	w1, 16
	bl	show
	ldr	x0, [sp, 136]
	add	x0, x0, 3
	str	x0, [sp, 136]
	ldr	x0, [sp, 136]
	cmp	x0, 13
	bls	.L15
.L14:
	mov	x2, 48
	mov	w1, 35
	mov	x0, x20
	bl	memset
	adrp	x3, .LC11
	adrp	x1, .LC12
	add	x3, x3, :lo12:.LC11
	add	x1, x1, :lo12:.LC12
	mov	w2, 0
	mov	x0, x20
	bl	sprintf
	mov	w19, w0
	mov	x0, x20
	bl	strlen
	mov	x2, x0
	mov	w1, w19
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	add	x23, sp, 192
	add	w1, w19, 2
	mov	x0, x20
	bl	show
	adrp	x25, .LC14
	adrp	x2, .LC3
	mov	x0, x23
	add	x2, x2, :lo12:.LC3
	add	x25, x25, :lo12:.LC14
	mov	w19, 0
	mov	w21, 0
	mov	w24, -100
	mov	w22, 0
	adrp	x26, .LC2
	b	.L17
	.align 2
.L25:
	add	w24, w24, 37
	add	w22, w22, 255
	add	x0, x23, w21, sxtw
	add	x2, x26, :lo12:.LC2
.L17:
	add	w5, w19, 97
	mov	w4, w22
	mov	w3, w24
	mov	x1, x25
	add	w19, w19, 1
	bl	sprintf
	add	w21, w21, w0
	cmp	w19, 8
	bne	.L25
	mov	x0, x23
	bl	strlen
	mov	w1, w21
	mov	x2, x0
	mov	x3, x23
	adrp	x0, .LC15
	adrp	x26, .LC16
	add	x0, x0, :lo12:.LC15
	adrp	x25, .LC17
	bl	printf
	add	x26, x26, :lo12:.LC16
	add	x25, x25, :lo12:.LC17
	mov	w19, 0
	mov	w21, 0
	fmov	d15, 5.0e-1
	mov	x24, 48
	.align 5
.L19:
	scvtf	d0, w19
	sxtw	x0, w21
	sub	x1, x24, x0
	mov	w3, w19
	mov	x2, x26
	add	x0, x20, x0
	fmul	d0, d0, d15
	bl	snprintf
	mov	w2, w0
	mov	w22, w0
	mov	w3, w21
	mov	w1, w19
	mov	x0, x25
	bl	printf
	sub	w0, w24, w21
	cmp	w0, w22
	ble	.L20
	add	w19, w19, 1
	add	w21, w21, w22
	cmp	w19, 12
	bne	.L19
.L18:
	mov	x0, x20
	bl	strlen
	mov	x3, x20
	mov	x2, x0
	mov	w1, w21
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	printf
	mov	w0, 10
	str	w0, [sp, 16]
	mov	w0, 9
	str	w0, [sp, 8]
	adrp	x0, stdout
	fmov	d0, 2.25e+0
	mov	w19, 8
	adrp	x4, .LC19
	ldr	x0, [x0, :lo12:stdout]
	add	x4, x4, :lo12:.LC19
	adrp	x1, .LC20
	add	x1, x1, :lo12:.LC20
	str	w19, [sp]
	mov	w7, 7
	mov	w6, 2748
	mov	w5, 99
	mov	x3, 1099511627776
	mov	w2, -1
	bl	fprintf
	mov	w20, w0
	mov	w0, 33
	bl	putchar
	mov	w1, w20
	mov	w2, w0
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	printf
	mov	w6, w19
	fmov	d0, -2.5e+0
	adrp	x5, .LC22
	adrp	x2, .LC23
	add	x5, x5, :lo12:.LC22
	add	x2, x2, :lo12:.LC23
	mov	w4, 3
	mov	w3, -17
	mov	x0, x23
	mov	x1, 256
	bl	snprintf
	mov	w19, w0
	mov	x1, x23
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	printf
	add	w1, w19, 1
	mov	w2, w0
	cmp	w1, w0
	mov	w1, w19
	cset	w3, eq
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	printf
	ldp	x29, x30, [sp, 32]
	mov	w0, 0
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	ldp	x23, x24, [sp, 80]
	ldp	x25, x26, [sp, 96]
	ldp	d14, d15, [sp, 112]
	add	sp, sp, 448
	ret
.L20:
	mov	w21, 47
	b	.L18
	.section .rodata
	.align	3
	.LANCHOR0:
.LC5:
	.word	-266631570
	.word	-1073143303
.LC9:
	.word	1834810029
	.word	1083394629

