	.text
	.align	2
	.align 5
L:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	add	sp, sp, 16
	ret
	.align	2
	.align 5
sgn:
	cmp	w0, 0
	cset	w1, gt
	sub	w0, w1, w0, lsr 31
	ret
	.section .rodata
	.align	3
.LC15:
	.string	"cut"
	.align	3
.LC16:
	.string	"%s ["
	.align	3
.LC17:
	.string	"]\n"
	.text
	.align	2
	.align 5
show_cut.constprop.0:
	stp	x29, x30, [sp, -48]!
	adrp	x1, .LC15
	add	x1, x1, :lo12:.LC15
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x0
	mov	w20, 124
	str	x21, [sp, 32]
	add	x21, x19, 26
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	.align 5
.L7:
	ldrb	w0, [x19], 1
	cmp	w0, 0
	csel	w0, w0, w20, ne
	bl	putchar
	cmp	x19, x21
	bne	.L7
	ldr	x21, [sp, 32]
	adrp	x0, .LC17
	ldp	x19, x20, [sp, 16]
	add	x0, x0, :lo12:.LC17
	ldp	x29, x30, [sp], 48
	b	printf
	.section .rodata
	.align	3
.LC18:
	.string	"%s"
	.align	3
.LC19:
	.string	" %02x"
	.align	3
.LC20:
	.string	"\n"
	.text
	.align	2
	.align 5
hex.constprop.0:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x1
	adrp	x20, .LC19
	add	x20, x20, :lo12:.LC19
	str	x21, [sp, 32]
	add	x21, x19, 8
	mov	x1, x0
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	printf
	.align 5
.L11:
	ldrb	w1, [x19], 1
	mov	x0, x20
	bl	printf
	cmp	x19, x21
	bne	.L11
	ldr	x21, [sp, 32]
	adrp	x0, .LC20
	ldp	x19, x20, [sp, 16]
	add	x0, x0, :lo12:.LC20
	ldp	x29, x30, [sp], 48
	b	printf
	.section .rodata
	.align	3
.LC21:
	.string	""
	.align	3
.LC22:
	.string	"a"
	.align	3
.LC24:
	.string	"strlen: %d %d %d %d\n"
	.align	3
.LC25:
	.string	"abc"
	.align	3
.LC26:
	.string	"abd"
	.align	3
.LC27:
	.string	"ab"
	.align	3
.LC28:
	.string	"\200"
	.align	3
.LC29:
	.string	"\177"
	.align	3
.LC30:
	.string	"\377"
	.align	3
.LC31:
	.string	"\001"
	.align	3
.LC32:
	.byte 97, 233, 0
	.align	3
.LC33:
	.string	"cmp: %d %d %d %d %d %d\n"
	.align	3
.LC34:
	.string	"abcX"
	.align	3
.LC35:
	.string	"abcY"
	.align	3
.LC36:
	.string	"x"
	.align	3
.LC37:
	.string	"y"
	.align	3
.LC39:
	.string	"ncmp: %d %d %d %d\n"
	.align	3
.LC42:
	.string	"\220"
	.align	3
.LC43:
	.string	"\020"
	.align	3
.LC44:
	.string	"same"
	.align	3
.LC45:
	.string	"memcmp: %d %d %d\n"
	.align	3
.LC46:
	.string	"strncpy pad:"
	.align	3
.LC47:
	.string	"abcdefgh"
	.align	3
.LC48:
	.string	"strncpy cut:"
	.align	3
.LC49:
	.string	"one"
	.align	3
.LC50:
	.string	","
	.align	3
.LC51:
	.string	"two"
	.align	3
.LC52:
	.string	",three"
	.align	3
.LC53:
	.string	"strcat: [%s] %d %d\n"
	.align	3
.LC54:
	.string	"hello, caf\351!"
	.align	3
.LC55:
	.string	"strchr: %d %d %d %d %d %d\n"
	.align	3
.LC56:
	.string	"abcabcabd"
	.align	3
.LC57:
	.string	"aaab"
	.align	3
.LC58:
	.string	"aab"
	.align	3
.LC59:
	.string	"abcabd"
	.align	3
.LC60:
	.string	"cab"
	.align	3
.LC61:
	.string	"strstr: %d %d %d %d %d\n"
	.align	3
.LC63:
	.string	"memmove up: %s"
	.align	3
.LC64:
	.string	" down: %s"
	.align	3
.LC65:
	.string	" set: %s\n"
	.align	3
.LC67:
	.string	"strtok:"
	.align	3
.LC68:
	.string	" ,;"
	.align	3
.LC69:
	.string	" %d:%s@%d"
	.align	3
.LC71:
	.string	"="
	.align	3
.LC72:
	.string	"&"
	.align	3
.LC73:
	.string	"=&"
	.align	3
.LC74:
	.string	"pairs: %s %s %s %s %s %d\n"
	.align	3
.LC76:
	.string	"strtol[%s,%d] = %ld end %d\n"
	.align	3
.LC77:
	.string	"  -123xyz"
	.align	3
.LC78:
	.string	"+0042"
	.align	3
.LC79:
	.string	"atoi: %d %d %d\n"
	.align	3
.LC80:
	.string	"%s-%d"
	.align	3
.LC81:
	.string	"abcdef"
	.align	3
.LC82:
	.string	"snprintf: %d [%s] %c\n"
	.align	3
.LC83:
	.string	"%d"
	.align	3
.LC84:
	.string	"size0: %d %c; "
	.align	3
.LC85:
	.string	"xyz"
	.align	3
.LC86:
	.string	"size1: %d %d; "
	.align	3
.LC87:
	.string	"%x|%5s|%-3d|"
	.align	3
.LC88:
	.string	"sprintf: %d [%s]\n"
	.align	3
.LC89:
	.string	"ctype: %d %d %d %d %d\n"
	.align	3
.LC91:
	.string	"upper:"
	.align	3
.LC92:
	.string	"%.21s\n"
	.align	3
.LC93:
	.string	"plain char: %d %d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #720
	mov	x2, 299
	mov	w1, 120
	add	x0, sp, 416
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LC22
	adrp	x19, .LANCHOR0
	stp	x21, x22, [sp, 32]
	adrp	x22, .LC21
	add	x22, x22, :lo12:.LC21
	stp	x23, x24, [sp, 48]
	add	x19, x19, :lo12:.LANCHOR0
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	bl	memset
	mov	x0, x22
	strb	wzr, [sp, 715]
	bl	L
	bl	strlen
	mov	x21, x0
	add	x0, x20, :lo12:.LC22
	bl	L
	bl	strlen
	mov	x23, x0
	add	x0, sp, 416
	bl	strlen
	mov	x24, x0
	mov	x0, x19
	bl	L
	bl	strlen
	mov	w4, w0
	mov	w3, w24
	mov	w2, w23
	mov	w1, w21
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	printf
	adrp	x21, .LC25
	add	x0, x21, :lo12:.LC25
	bl	L
	mov	x2, x0
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	L
	mov	x1, x0
	mov	x0, x2
	bl	strcmp
	adrp	x23, .LC27
	add	x23, x23, :lo12:.LC27
	bl	sgn
	mov	w24, w0
	add	x0, x21, :lo12:.LC25
	bl	L
	mov	x2, x0
	mov	x0, x23
	bl	L
	mov	x1, x0
	mov	x0, x2
	bl	strcmp
	bl	sgn
	mov	w25, w0
	mov	x0, x22
	bl	L
	mov	x2, x0
	mov	x0, x22
	bl	L
	mov	x1, x0
	mov	x0, x2
	bl	strcmp
	bl	sgn
	mov	w26, w0
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	bl	L
	mov	x2, x0
	adrp	x0, .LC29
	add	x0, x0, :lo12:.LC29
	bl	L
	mov	x1, x0
	mov	x0, x2
	bl	strcmp
	bl	sgn
	mov	w27, w0
	adrp	x0, .LC30
	add	x0, x0, :lo12:.LC30
	bl	L
	mov	x2, x0
	adrp	x0, .LC31
	add	x0, x0, :lo12:.LC31
	bl	L
	mov	x1, x0
	mov	x0, x2
	bl	strcmp
	bl	sgn
	mov	w28, w0
	add	x0, x20, :lo12:.LC22
	bl	L
	mov	x2, x0
	adrp	x0, .LC32
	add	x0, x0, :lo12:.LC32
	bl	L
	mov	x1, x0
	mov	x0, x2
	bl	strcmp
	adrp	x20, .LC35
	mov	w5, w28
	mov	w4, w27
	bl	sgn
	mov	w3, w26
	mov	w6, w0
	mov	w2, w25
	mov	w1, w24
	adrp	x0, .LC33
	add	x0, x0, :lo12:.LC33
	bl	printf
	adrp	x24, .LC34
	add	x0, x24, :lo12:.LC34
	bl	L
	mov	x3, x0
	add	x0, x20, :lo12:.LC35
	bl	L
	mov	x1, x0
	mov	x2, 3
	mov	x0, x3
	bl	strncmp
	mov	x2, 4
	bl	sgn
	mov	w25, w0
	add	x0, x24, :lo12:.LC34
	bl	L
	mov	x3, x0
	add	x0, x20, :lo12:.LC35
	bl	L
	mov	x1, x0
	mov	x0, x3
	bl	strncmp
	bl	sgn
	mov	w20, w0
	adrp	x0, .LC36
	add	x0, x0, :lo12:.LC36
	bl	L
	mov	x3, x0
	adrp	x0, .LC37
	add	x0, x0, :lo12:.LC37
	bl	L
	mov	x1, x0
	mov	x2, 0
	mov	x0, x3
	bl	strncmp
	bl	sgn
	mov	w24, w0
	mov	x0, x23
	bl	L
	mov	x3, x0
	add	x0, x19, 8
	bl	L
	mov	x1, x0
	mov	x2, 5
	mov	x0, x3
	bl	strncmp
	bl	sgn
	mov	w3, w24
	mov	w4, w0
	mov	w2, w20
	mov	w1, w25
	adrp	x0, .LC39
	add	x0, x0, :lo12:.LC39
	bl	printf
	add	x0, x19, 16
	bl	L
	mov	x3, x0
	add	x0, x19, 24
	bl	L
	mov	x1, x0
	mov	x2, 3
	mov	x0, x3
	bl	memcmp
	bl	sgn
	mov	w20, w0
	adrp	x0, .LC42
	add	x0, x0, :lo12:.LC42
	bl	L
	mov	x3, x0
	adrp	x0, .LC43
	add	x0, x0, :lo12:.LC43
	bl	L
	mov	x1, x0
	mov	x2, 1
	mov	x0, x3
	bl	memcmp
	bl	sgn
	mov	w24, w0
	adrp	x1, .LC44
	add	x0, x1, :lo12:.LC44
	bl	L
	mov	x3, x0
	add	x0, x1, :lo12:.LC44
	bl	L
	mov	x1, x0
	mov	x2, 4
	mov	x0, x3
	bl	memcmp
	mov	w2, w24
	bl	sgn
	mov	w3, w0
	mov	w1, w20
	adrp	x0, .LC45
	add	x0, x0, :lo12:.LC45
	bl	printf
	mov	x2, 8
	mov	w1, 35
	add	x0, sp, 104
	bl	memset
	mov	x2, 6
	mov	x0, x23
	bl	L
	mov	x1, x0
	add	x0, sp, 104
	bl	strncpy
	add	x1, sp, 104
	adrp	x0, .LC46
	add	x0, x0, :lo12:.LC46
	bl	hex.constprop.0
	mov	x2, 8
	mov	w1, 35
	add	x0, sp, 104
	bl	memset
	mov	x2, 4
	adrp	x0, .LC47
	add	x0, x0, :lo12:.LC47
	bl	L
	mov	x1, x0
	add	x0, sp, 104
	bl	strncpy
	add	x20, sp, 216
	add	x1, sp, 104
	adrp	x0, .LC48
	add	x0, x0, :lo12:.LC48
	bl	hex.constprop.0
	adrp	x0, .LC49
	add	x0, x0, :lo12:.LC49
	stp	xzr, xzr, [sp, 216]
	stp	xzr, xzr, [sp, 232]
	str	xzr, [sp, 248]
	bl	L
	mov	x1, x0
	mov	x0, x20
	bl	strcat
	mov	x25, x0
	adrp	x0, .LC50
	add	x0, x0, :lo12:.LC50
	bl	L
	mov	x1, x0
	mov	x0, x20
	bl	strcat
	mov	x2, x0
	adrp	x0, .LC51
	add	x0, x0, :lo12:.LC51
	bl	L
	mov	x1, x0
	mov	x0, x2
	bl	strcat
	mov	x0, x22
	bl	L
	mov	x1, x0
	mov	x0, x20
	bl	strcat
	adrp	x0, .LC52
	add	x0, x0, :lo12:.LC52
	bl	L
	mov	x1, x0
	mov	x0, x20
	bl	strcat
	mov	x24, x0
	mov	x0, x20
	bl	strlen
	mov	w3, w0
	cmp	x25, x20
	mov	x1, x24
	cset	w2, eq
	adrp	x0, .LC53
	add	x0, x0, :lo12:.LC53
	bl	printf
	mov	w1, 108
	adrp	x0, .LC54
	add	x0, x0, :lo12:.LC54
	bl	L
	mov	x20, x0
	bl	strchr
	mov	w1, 0
	mov	x24, x0
	mov	x0, x20
	bl	strchr
	mov	w1, 122
	mov	x25, x0
	mov	x0, x20
	bl	strchr
	mov	w1, 364
	mov	x28, x0
	mov	x0, x20
	bl	strchr
	mov	w1, 233
	mov	x26, x0
	mov	x0, x20
	bl	strchr
	mov	w1, -23
	mov	x27, x0
	mov	x0, x20
	bl	strchr
	cmp	x28, 0
	sub	w6, w0, w20
	cset	w3, eq
	sub	w5, w27, w20
	sub	w4, w26, w20
	sub	w2, w25, w20
	sub	w1, w24, w20
	adrp	x0, .LC55
	add	x0, x0, :lo12:.LC55
	bl	printf
	adrp	x0, .LC56
	add	x0, x0, :lo12:.LC56
	bl	L
	mov	x20, x0
	adrp	x0, .LC57
	add	x0, x0, :lo12:.LC57
	bl	L
	mov	x24, x0
	adrp	x0, .LC58
	add	x0, x0, :lo12:.LC58
	bl	L
	mov	x1, x0
	mov	x0, x24
	bl	strstr
	mov	x25, x0
	adrp	x0, .LC59
	add	x0, x0, :lo12:.LC59
	bl	L
	mov	x1, x0
	mov	x0, x20
	bl	strstr
	mov	x26, x0
	mov	x0, x22
	bl	L
	mov	x1, x0
	mov	x0, x20
	bl	strstr
	mov	x27, x0
	mov	x0, x23
	bl	L
	mov	x2, x0
	add	x0, x21, :lo12:.LC25
	bl	L
	mov	x1, x0
	mov	x0, x2
	bl	strstr
	mov	x21, x0
	adrp	x0, .LC60
	add	x0, x0, :lo12:.LC60
	bl	L
	mov	x1, x0
	mov	x0, x20
	bl	strstr
	cmp	x21, 0
	sub	w5, w0, w20
	cset	w4, eq
	cmp	x27, x20
	cset	w3, eq
	sub	w2, w26, w20
	sub	w1, w25, w24
	adrp	x0, .LC61
	add	x0, x0, :lo12:.LC61
	bl	printf
	adrp	x0, .LC62
	add	x0, x0, :lo12:.LC62
	mov	x2, 6
	add	x20, sp, 184
	adrp	x21, .LC68
	add	x21, x21, :lo12:.LC68
	ldr	x1, [x0]
	str	x1, [sp, 112]
	ldr	w0, [x0, 7]
	add	x1, sp, 112
	str	w0, [sp, 119]
	add	x0, sp, 114
	bl	memmove
	add	x1, sp, 112
	adrp	x0, .LC63
	add	x0, x0, :lo12:.LC63
	bl	printf
	mov	x2, 5
	add	x1, sp, 115
	add	x0, sp, 112
	bl	memmove
	add	x1, sp, 112
	adrp	x0, .LC64
	add	x0, x0, :lo12:.LC64
	bl	printf
	add	x1, sp, 113
	mov	x2, 0
	mov	x0, x1
	bl	memmove
	mov	x2, 2
	mov	w1, 321
	add	x0, sp, 119
	bl	memset
	add	x1, sp, 112
	adrp	x0, .LC65
	add	x0, x0, :lo12:.LC65
	bl	printf
	adrp	x0, .LC66
	add	x0, x0, :lo12:.LC66
	ldr	q30, [x0]
	ldr	q31, [x0, 11]
	adrp	x0, .LC67
	str	q30, [sp, 184]
	add	x0, x0, :lo12:.LC67
	str	q31, [x20, 11]
	bl	printf
	mov	x0, x21
	bl	L
	mov	x1, x0
	mov	x0, x20
	bl	strtok
	cbz	x0, .L15
	adrp	x24, .LC69
	mov	x2, x0
	add	x24, x24, :lo12:.LC69
	mov	w25, 0
	.align 5
.L16:
	sub	w3, w2, w20
	mov	w1, w25
	mov	x0, x24
	bl	printf
	mov	x0, x21
	bl	L
	add	w25, w25, 1
	mov	x1, x0
	mov	x0, 0
	bl	strtok
	mov	x2, x0
	cbnz	x0, .L16
.L15:
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	printf
	adrp	x21, .LC71
	mov	x0, x20
	bl	show_cut.constprop.0
	adrp	x0, .LC70
	add	x0, x0, :lo12:.LC70
	adrp	x20, .LC72
	ldr	x1, [x0]
	str	x1, [sp, 128]
	ldr	w0, [x0, 8]
	str	w0, [sp, 136]
	add	x0, x21, :lo12:.LC71
	bl	L
	mov	x1, x0
	add	x0, sp, 128
	bl	strtok
	mov	x24, x0
	add	x0, x20, :lo12:.LC72
	bl	L
	mov	x1, x0
	mov	x0, 0
	bl	strtok
	mov	x25, x0
	add	x0, x21, :lo12:.LC71
	bl	L
	mov	x1, x0
	mov	x0, 0
	bl	strtok
	mov	x21, x0
	add	x0, x20, :lo12:.LC72
	bl	L
	mov	x1, x0
	mov	x0, 0
	bl	strtok
	mov	x26, x0
	adrp	x0, .LC73
	add	x0, x0, :lo12:.LC73
	bl	L
	mov	x1, x0
	mov	x0, 0
	bl	strtok
	mov	x27, x0
	add	x0, x20, :lo12:.LC72
	bl	L
	mov	x1, x0
	mov	x0, 0
	bl	strtok
	cmp	x0, 0
	mov	x2, x25
	mov	x1, x24
	mov	x4, x26
	cset	w6, eq
	mov	x5, x27
	mov	x3, x21
	adrp	x0, .LC74
	add	x0, x0, :lo12:.LC74
	bl	printf
	add	x24, sp, 312
	ldp	q31, q30, [x19, 96]
	add	x25, sp, 256
	ldp	q29, q28, [x19, 64]
	adrp	x26, .LC76
	ldp	q27, q26, [x19, 32]
	stp	q31, q30, [x24, 64]
	add	x26, x26, :lo12:.LC76
	ldr	x0, [x19, 128]
	stp	q29, q28, [x24, 32]
	ldr	q30, [x19, 136]
	stp	q27, q26, [x24]
	ldr	q29, [x19, 152]
	str	x0, [x24, 96]
	ldr	q31, [x19, 168]
	ldr	w0, [x19, 184]
	mov	x19, 1
	str	w0, [x25, 48]
	stp	q30, q29, [x25]
	str	q31, [x25, 32]
	.align 5
.L17:
	add	x0, x24, x19, lsl 3
	add	x1, x25, x19, lsl 2
	add	x19, x19, 1
	ldr	x20, [x0, -8]
	mov	x0, x20
	bl	L
	ldr	w21, [x1, -4]
	add	x1, sp, 160
	mov	w2, w21
	bl strtol
	ldr	x4, [sp, 160]
	mov	x3, x0
	mov	w2, w21
	mov	x1, x20
	mov	x0, x26
	sub	w4, w4, w20
	bl	printf
	cmp	x19, 14
	bne	.L17
	adrp	x0, .LC77
	add	x0, x0, :lo12:.LC77
	bl	L
	mov	w21, 0
	bl	atoi
	mov	w19, w0
	mov	x0, x22
	bl	L
	bl	atoi
	mov	w20, w0
	adrp	x0, .LC78
	add	x0, x0, :lo12:.LC78
	bl	L
	mov	w22, 0
	bl	atoi
	mov	w3, w0
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC79
	add	x0, x0, :lo12:.LC79
	bl	printf
	mov	x19, 0
	mov	x2, 16
	mov	w1, 42
	add	x0, sp, 144
	bl	memset
	adrp	x0, .LC80
	add	x0, x0, :lo12:.LC80
	bl	L
	mov	x2, x0
	adrp	x0, .LC81
	add	x0, x0, :lo12:.LC81
	bl	L
	mov	w4, 12345
	mov	x3, x0
	mov	x1, 8
	add	x0, sp, 144
	bl	snprintf
	ldrb	w3, [sp, 152]
	mov	w1, w0
	add	x2, sp, 144
	adrp	x0, .LC82
	add	x0, x0, :lo12:.LC82
	mov	w20, 0
	bl	printf
	mov	x2, 16
	mov	w1, 42
	add	x0, sp, 144
	bl	memset
	adrp	x0, .LC83
	mov	w3, 57920
	add	x0, x0, :lo12:.LC83
	bl	L
	movk	w3, 0x1, lsl 16
	mov	x2, x0
	mov	x1, 0
	add	x0, sp, 144
	bl	snprintf
	mov	w1, w0
	ldrb	w2, [sp, 144]
	adrp	x0, .LC84
	add	x0, x0, :lo12:.LC84
	bl	printf
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	L
	mov	x2, x0
	adrp	x0, .LC85
	add	x0, x0, :lo12:.LC85
	bl	L
	mov	x1, 1
	mov	x3, x0
	add	x0, sp, 144
	bl	snprintf
	mov	w1, w0
	ldrb	w2, [sp, 144]
	adrp	x0, .LC86
	add	x0, x0, :lo12:.LC86
	bl	printf
	adrp	x0, .LC87
	add	x0, x0, :lo12:.LC87
	bl	L
	mov	x1, x0
	mov	x0, x23
	bl	L
	mov	w4, 7
	mov	x3, x0
	mov	w2, 48879
	add	x0, sp, 144
	bl	sprintf
	mov	w1, w0
	add	x2, sp, 144
	adrp	x0, .LC88
	add	x0, x0, :lo12:.LC88
	bl	printf
	mov	w23, 0
	bl	__ctype_b_loc
	mov	x24, x0
	.align 5
.L18:
	ldr	x0, [x24]
	ldrh	w0, [x0, w19, uxtw 1]
	ubfx	x1, x0, 11, 1
	add	w20, w20, w1
	ubfx	x1, x0, 10, 1
	ubfx	x0, x0, 13, 1
	add	w21, w21, w1
	add	w22, w22, w0
	mov	w0, w19
	bl	toupper
	cmp	w0, w19
	add	x19, x19, 1
	cinc	w23, w23, ne
	cmp	x19, 256
	bne	.L18
	ldr	x0, [x24]
	mov	w1, w20
	mov	w4, w23
	mov	w3, w22
	mov	w2, w21
	ldrh	w5, [x0, -2]
	adrp	x0, .LC89
	add	x0, x0, :lo12:.LC89
	ubfx	x5, x5, 13, 1
	bl	printf
	adrp	x0, .LC90
	add	x0, x0, :lo12:.LC90
	ldp	x2, x3, [x0]
	stp	x2, x3, [sp, 160]
	ldr	x0, [x0, 15]
	str	x0, [sp, 175]
	bl	__ctype_toupper_loc
	add	x1, sp, 160
	ldr	x2, [x0]
	mov	w0, 72
	.align 5
.L19:
	ubfiz	x0, x0, 2, 8
	ldr	w0, [x2, x0]
	strb	w0, [x1]
	ldrb	w0, [x1, 1]!
	cbnz	w0, .L19
	add	x1, sp, 174
	adrp	x0, .LC91
	add	x0, x0, :lo12:.LC91
	bl	hex.constprop.0
	add	x1, sp, 160
	adrp	x0, .LC92
	add	x0, x0, :lo12:.LC92
	bl	printf
	mov	w2, 1
	mov	w1, 233
	adrp	x0, .LC93
	add	x0, x0, :lo12:.LC93
	bl	printf
	ldp	x29, x30, [sp]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	add	sp, sp, 720
	ret
	.section .rodata
	.align	3
.LC62:
	.string	"0123456789"
	.align	3
.LC66:
	.string	"  ,,alpha, beta;;gamma ,  "
	.align	3
.LC70:
	.string	"a=1&b=22&&c"
	.align	3
.LC90:
	.string	"Hello, World! 123 caf\351"
	.text
	.section .rodata
	.align	3
.LC0:
	.string	"  -0x1f"
	.align	3
.LC1:
	.string	"0777"
	.align	3
.LC2:
	.string	"z"
	.align	3
.LC3:
	.string	"12abc"
	.align	3
.LC4:
	.string	"  +"
	.align	3
.LC5:
	.string	"0x"
	.align	3
.LC6:
	.string	"9223372036854775807"
	.align	3
.LC7:
	.string	"9223372036854775808"
	.align	3
.LC8:
	.string	"-9223372036854775809"
	.align	3
.LC9:
	.string	"  42  "
	.align	3
.LC10:
	.string	"101102"
	.align	3
.LC11:
	.string	"Zz"
	.align	3
.LC12:
	.string	"-0"
	.section .rodata
	.align	3
	.LANCHOR0:
.LC23:
	.string	"ab"
	.string	"cd"
	.zero	2
.LC38:
	.string	"ab"
	.string	"zz"
	.zero	2
.LC40:
	.string	"a"
	.string	"b"
	.zero	4
.LC41:
	.string	"a"
	.string	"c"
	.zero	4
.LC75:
	.quad	.LC0
	.quad	.LC1
	.quad	.LC2
	.quad	.LC3
	.quad	.LC4
	.quad	.LC5
	.quad	.LC6
	.quad	.LC7
	.quad	.LC8
	.quad	.LC9
	.quad	.LC10
	.quad	.LC11
	.quad	.LC12
.LC14:
	.word	0
	.word	0
	.word	36
	.word	10
	.word	10
	.word	16
	.word	10
	.word	10
	.word	10
	.word	10
	.word	2
	.word	36
	.word	0

