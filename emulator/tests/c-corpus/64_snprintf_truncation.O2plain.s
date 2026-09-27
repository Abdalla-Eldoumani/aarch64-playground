	.text
	.section .rodata
	.align	3
.LC0:
	.string	","
	.align	3
.LC1:
	.string	""
	.align	3
.LC2:
	.string	"tail"
	.align	3
.LC4:
	.string	"%-5d|%+.2f|%s|%#x"
	.align	3
.LC5:
	.string	"size=%2zu n=%d "
	.align	3
.LC6:
	.string	"\\x%02x"
	.align	3
.LC7:
	.string	"\""
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
	sub	sp, sp, #480
	mov	x0, 0
	movi	v31.16b, 0x23
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	stp	x21, x22, [sp, 64]
	add	x22, sp, 176
	stp	x19, x20, [sp, 48]
	add	x20, sp, 200
	stp	x23, x24, [sp, 80]
	adrp	x24, .LC6
	add	x24, x24, :lo12:.LC6
	stp	x25, x26, [sp, 96]
	adrp	x26, .LC7
	add	x26, x26, :lo12:.LC7
	stp	x27, x28, [sp, 112]
	adrp	x28, .LC2
	add	x1, x28, :lo12:.LC2
	stp	d14, d15, [sp, 128]
	adrp	x27, .LC5
	add	x27, x27, :lo12:.LC5
	stp	q31, q31, [x22]
	mov	x23, 0
	str	x1, [sp, 144]
	adrp	x1, .LC4
	add	x1, x1, :lo12:.LC4
	str	x1, [sp, 152]
	adrp	x1, stdout
	add	x21, x1, :lo12:stdout
	adrp	x1, .LC3
	str	q31, [x22, 32]
	ldr	d15, [x1, :lo12:.LC3]
	.align 5
.L6:
	ldp	x4, x2, [sp, 144]
	fmov	d0, d15
	mov	w5, 31
	mov	w3, 42
	mov	x1, x23
	mov	x25, x22
	mov	x28, x22
	mov	w19, 92
	bl	snprintf
	mov	w2, w0
	mov	x1, x23
	mov	x0, x27
	bl	printf
	ldr	x1, [x21]
	mov	w0, 34
	bl	putc
	b	.L4
	.align 2
.L28:
	ldr	x1, [x21]
	add	x28, x28, 1
	bl	putc
	cmp	x28, x20
	beq	.L27
.L4:
	ldrb	w0, [x28]
	sub	w1, w0, #32
	and	w1, w1, 255
	cmp	w1, 94
	ccmp	w0, w19, 4, ls
	bne	.L28
	mov	w1, w0
	add	x28, x28, 1
	mov	x0, x24
	bl	printf
	cmp	x28, x20
	bne	.L4
.L27:
	mov	x0, x26
	add	x23, x23, 1
	bl	puts
	cmp	x23, 24
	beq	.L5
	movi	v31.16b, 0x23
	mov	x0, x22
	stp	q31, q31, [x22]
	str	q31, [x22, 32]
	b	.L6
.L5:
	mov	x0, 1
	str	x0, [sp, 168]
	ldr	x0, [sp, 168]
	cmp	x0, 13
	bhi	.L7
	adrp	x24, .LC10
	add	x0, x24, :lo12:.LC10
	str	x0, [sp, 144]
	adrp	x0, .LC9
	adrp	x28, .LC8
	adrp	x23, .LC6
	add	x28, x28, :lo12:.LC8
	add	x20, x22, 16
	add	x23, x23, :lo12:.LC6
	ldr	d14, [x0, :lo12:.LC9]
	.align 5
.L11:
	movi	v31.16b, 0x23
	mov	x3, x28
	fmov	d0, d14
	mov	x0, x22
	mov	x24, x22
	mov	w19, 92
	stp	q31, q31, [x22]
	ldr	x2, [sp, 144]
	str	q31, [x22, 32]
	ldr	x1, [sp, 168]
	bl	snprintf
	mov	w2, w0
	ldr	x1, [sp, 168]
	mov	x0, x27
	bl	printf
	ldr	x1, [x21]
	mov	w0, 34
	bl	putc
	b	.L10
	.align 2
.L30:
	ldr	x1, [x21]
	add	x24, x24, 1
	bl	putc
	cmp	x24, x20
	beq	.L29
.L10:
	ldrb	w0, [x24]
	sub	w1, w0, #32
	and	w1, w1, 255
	cmp	w1, 94
	ccmp	w0, w19, 4, ls
	bne	.L30
	mov	w1, w0
	add	x24, x24, 1
	mov	x0, x23
	bl	printf
	cmp	x24, x20
	bne	.L10
.L29:
	mov	x0, x26
	bl	puts
	ldr	x0, [sp, 168]
	add	x0, x0, 3
	str	x0, [sp, 168]
	ldr	x0, [sp, 168]
	cmp	x0, 13
	bls	.L11
.L7:
	movi	v31.16b, 0x23
	adrp	x3, .LC11
	adrp	x1, .LC12
	add	x3, x3, :lo12:.LC11
	add	x1, x1, :lo12:.LC12
	mov	w2, 0
	mov	x0, x22
	add	x20, sp, 185
	stp	q31, q31, [x22]
	mov	w19, 92
	adrp	x23, .LC6
	str	q31, [x22, 32]
	bl	sprintf
	mov	x0, x22
	bl	strlen
	mov	x2, x0
	mov	w1, 7
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	adrp	x0, stdout
	add	x23, x23, :lo12:.LC6
	ldr	x1, [x0, :lo12:stdout]
	mov	w0, 34
	bl	putc
	b	.L14
	.align 2
.L32:
	ldr	x1, [x21]
	add	x25, x25, 1
	bl	putc
	cmp	x20, x25
	beq	.L31
.L14:
	ldrb	w0, [x25]
	sub	w1, w0, #32
	and	w1, w1, 255
	cmp	w1, 94
	ccmp	w0, w19, 4, ls
	bne	.L32
	mov	w1, w0
	add	x25, x25, 1
	mov	x0, x23
	bl	printf
	cmp	x20, x25
	bne	.L14
.L31:
	mov	x0, x26
	add	x23, sp, 224
	bl	puts
	adrp	x25, .LC14
	adrp	x2, .LC1
	mov	x0, x23
	add	x2, x2, :lo12:.LC1
	add	x25, x25, :lo12:.LC14
	mov	w19, 0
	mov	w20, 0
	mov	w24, 0
	mov	w21, -100
	adrp	x26, .LC0
	b	.L16
	.align 2
.L33:
	add	w21, w21, 37
	add	w24, w24, 255
	add	x0, x23, w20, sxtw
	add	x2, x26, :lo12:.LC0
.L16:
	add	w5, w19, 97
	mov	w4, w24
	mov	w3, w21
	mov	x1, x25
	add	w19, w19, 1
	bl	sprintf
	add	w20, w20, w0
	cmp	w19, 8
	bne	.L33
	mov	x0, x23
	bl	strlen
	mov	w1, w20
	mov	x2, x0
	mov	x3, x23
	adrp	x0, .LC15
	adrp	x25, .LC16
	add	x0, x0, :lo12:.LC15
	adrp	x24, .LC17
	bl	printf
	add	x25, x25, :lo12:.LC16
	add	x24, x24, :lo12:.LC17
	mov	w19, 0
	mov	w20, 0
	fmov	d15, 5.0e-1
	mov	x26, 48
	.align 5
.L18:
	scvtf	d0, w19
	sxtw	x0, w20
	sub	x1, x26, x0
	mov	w3, w19
	mov	x2, x25
	add	x0, x22, x0
	fmul	d0, d0, d15
	bl	snprintf
	mov	w2, w0
	mov	w21, w0
	mov	w3, w20
	mov	w1, w19
	mov	x0, x24
	bl	printf
	sub	w0, w26, w20
	cmp	w0, w21
	ble	.L19
	add	w19, w19, 1
	add	w20, w20, w21
	cmp	w19, 12
	bne	.L18
.L17:
	mov	x0, x22
	bl	strlen
	mov	x3, x22
	mov	x2, x0
	mov	w1, w20
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
	str	w19, [sp]
	ldr	x0, [x0, :lo12:stdout]
	mov	w7, 7
	mov	w6, 2748
	mov	w5, 99
	mov	x3, 1099511627776
	mov	w2, -1
	adrp	x4, .LC19
	adrp	x1, .LC20
	add	x4, x4, :lo12:.LC19
	add	x1, x1, :lo12:.LC20
	bl	fprintf
	mov	w20, w0
	adrp	x0, stdout
	ldr	x1, [x0, :lo12:stdout]
	mov	w0, 33
	bl	putc
	mov	w2, w0
	mov	w1, w20
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
	ldp	x27, x28, [sp, 112]
	ldp	d14, d15, [sp, 128]
	add	sp, sp, 480
	ret
.L19:
	mov	w20, 47
	b	.L17
	.section .rodata
	.align	3
	.LANCHOR0:
.LC3:
	.word	-266631570
	.word	-1073143303
.LC9:
	.word	1834810029
	.word	1083394629

