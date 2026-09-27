	.text
	.align	2
L:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
sgn:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	cmp	w0, 0
	cset	w0, gt
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 12]
	lsr	w0, w0, 31
	and	w0, w0, 255
	sub	w0, w1, w0
	add	sp, sp, 16
	ret
	.section .rodata
	.align	3
.LC15:
	.string	"%s"
	.align	3
.LC16:
	.string	" %02x"
	.align	3
.LC17:
	.string	"\n"
	.text
	.align	2
hex:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x0, [sp, 40]
	str	x1, [sp, 32]
	str	w2, [sp, 28]
	ldr	x1, [sp, 40]
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	str	wzr, [sp, 60]
	b	.L6
.L7:
	ldrsw	x0, [sp, 60]
	ldr	x1, [sp, 32]
	add	x0, x1, x0
	ldrb	w0, [x0]
	mov	w1, w0
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	ldr	w0, [sp, 60]
	add	w0, w0, 1
	str	w0, [sp, 60]
.L6:
	ldr	w1, [sp, 60]
	ldr	w0, [sp, 28]
	cmp	w1, w0
	blt	.L7
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	nop
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	3
.LC18:
	.string	"%s ["
	.align	3
.LC19:
	.string	"]\n"
	.text
	.align	2
show_cut:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x0, [sp, 40]
	str	x1, [sp, 32]
	str	w2, [sp, 28]
	ldr	x1, [sp, 40]
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	printf
	str	wzr, [sp, 60]
	b	.L9
.L12:
	ldrsw	x0, [sp, 60]
	ldr	x1, [sp, 32]
	add	x0, x1, x0
	ldrb	w0, [x0]
	cmp	w0, 0
	beq	.L10
	ldrsw	x0, [sp, 60]
	ldr	x1, [sp, 32]
	add	x0, x1, x0
	ldrb	w0, [x0]
	b	.L11
.L10:
	mov	w0, 124
.L11:
	bl	putchar
	ldr	w0, [sp, 60]
	add	w0, w0, 1
	str	w0, [sp, 60]
.L9:
	ldr	w1, [sp, 60]
	ldr	w0, [sp, 28]
	cmp	w1, w0
	blt	.L12
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	printf
	nop
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	3
.LC20:
	.string	""
	.align	3
.LC21:
	.string	"a"
	.align	3
.LC22:
	.string	"ab"
	.string	"cd"
	.align	3
.LC23:
	.string	"strlen: %d %d %d %d\n"
	.align	3
.LC24:
	.string	"abc"
	.align	3
.LC25:
	.string	"abd"
	.align	3
.LC26:
	.string	"ab"
	.align	3
.LC27:
	.string	"\200"
	.align	3
.LC28:
	.string	"\177"
	.align	3
.LC29:
	.string	"\377"
	.align	3
.LC30:
	.string	"\001"
	.align	3
.LC31:
	.byte 97, 233, 0
	.align	3
.LC32:
	.string	"cmp: %d %d %d %d %d %d\n"
	.align	3
.LC33:
	.string	"abcX"
	.align	3
.LC34:
	.string	"abcY"
	.align	3
.LC35:
	.string	"x"
	.align	3
.LC36:
	.string	"y"
	.align	3
.LC37:
	.string	"ab"
	.string	"zz"
	.align	3
.LC38:
	.string	"ncmp: %d %d %d %d\n"
	.align	3
.LC39:
	.string	"a"
	.string	"b"
	.align	3
.LC40:
	.string	"a"
	.string	"c"
	.align	3
.LC41:
	.string	"\220"
	.align	3
.LC42:
	.string	"\020"
	.align	3
.LC43:
	.string	"same"
	.align	3
.LC44:
	.string	"memcmp: %d %d %d\n"
	.align	3
.LC45:
	.string	"strncpy pad:"
	.align	3
.LC46:
	.string	"abcdefgh"
	.align	3
.LC47:
	.string	"strncpy cut:"
	.align	3
.LC48:
	.string	"one"
	.align	3
.LC49:
	.string	","
	.align	3
.LC50:
	.string	"two"
	.align	3
.LC51:
	.string	",three"
	.align	3
.LC52:
	.string	"strcat: [%s] %d %d\n"
	.align	3
.LC53:
	.string	"hello, caf\351!"
	.align	3
.LC54:
	.string	"strchr: %d %d %d %d %d %d\n"
	.align	3
.LC55:
	.string	"abcabcabd"
	.align	3
.LC56:
	.string	"aaab"
	.align	3
.LC57:
	.string	"aab"
	.align	3
.LC58:
	.string	"abcabd"
	.align	3
.LC59:
	.string	"cab"
	.align	3
.LC60:
	.string	"strstr: %d %d %d %d %d\n"
	.align	3
.LC62:
	.string	"memmove up: %s"
	.align	3
.LC63:
	.string	" down: %s"
	.align	3
.LC64:
	.string	" set: %s\n"
	.align	3
.LC66:
	.string	"strtok:"
	.align	3
.LC67:
	.string	" ,;"
	.align	3
.LC68:
	.string	" %d:%s@%d"
	.align	3
.LC69:
	.string	"cut"
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
	.global	main
main:
	sub	sp, sp, #848
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	add	x0, sp, 392
	mov	x2, 299
	mov	w1, 120
	bl	memset
	strb	wzr, [sp, 691]
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	L
	bl	strlen
	mov	w19, w0
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	L
	bl	strlen
	mov	w20, w0
	add	x0, sp, 392
	bl	strlen
	mov	w21, w0
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	L
	bl	strlen
	mov	w4, w0
	mov	w3, w21
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	bl	printf
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	L
	mov	x19, x0
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	L
	mov	x1, x0
	mov	x0, x19
	bl	strcmp
	bl	sgn
	mov	w19, w0
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	L
	mov	x20, x0
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	L
	mov	x1, x0
	mov	x0, x20
	bl	strcmp
	bl	sgn
	mov	w20, w0
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	L
	mov	x21, x0
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	L
	mov	x1, x0
	mov	x0, x21
	bl	strcmp
	bl	sgn
	mov	w21, w0
	adrp	x0, .LC27
	add	x0, x0, :lo12:.LC27
	bl	L
	mov	x22, x0
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	bl	L
	mov	x1, x0
	mov	x0, x22
	bl	strcmp
	bl	sgn
	mov	w22, w0
	adrp	x0, .LC29
	add	x0, x0, :lo12:.LC29
	bl	L
	mov	x23, x0
	adrp	x0, .LC30
	add	x0, x0, :lo12:.LC30
	bl	L
	mov	x1, x0
	mov	x0, x23
	bl	strcmp
	bl	sgn
	mov	w23, w0
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	L
	mov	x24, x0
	adrp	x0, .LC31
	add	x0, x0, :lo12:.LC31
	bl	L
	mov	x1, x0
	mov	x0, x24
	bl	strcmp
	bl	sgn
	mov	w6, w0
	mov	w5, w23
	mov	w4, w22
	mov	w3, w21
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC32
	add	x0, x0, :lo12:.LC32
	bl	printf
	adrp	x0, .LC33
	add	x0, x0, :lo12:.LC33
	bl	L
	mov	x19, x0
	adrp	x0, .LC34
	add	x0, x0, :lo12:.LC34
	bl	L
	mov	x2, 3
	mov	x1, x0
	mov	x0, x19
	bl	strncmp
	bl	sgn
	mov	w19, w0
	adrp	x0, .LC33
	add	x0, x0, :lo12:.LC33
	bl	L
	mov	x20, x0
	adrp	x0, .LC34
	add	x0, x0, :lo12:.LC34
	bl	L
	mov	x2, 4
	mov	x1, x0
	mov	x0, x20
	bl	strncmp
	bl	sgn
	mov	w20, w0
	adrp	x0, .LC35
	add	x0, x0, :lo12:.LC35
	bl	L
	mov	x21, x0
	adrp	x0, .LC36
	add	x0, x0, :lo12:.LC36
	bl	L
	mov	x2, 0
	mov	x1, x0
	mov	x0, x21
	bl	strncmp
	bl	sgn
	mov	w21, w0
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	L
	mov	x22, x0
	adrp	x0, .LC37
	add	x0, x0, :lo12:.LC37
	bl	L
	mov	x2, 5
	mov	x1, x0
	mov	x0, x22
	bl	strncmp
	bl	sgn
	mov	w4, w0
	mov	w3, w21
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC38
	add	x0, x0, :lo12:.LC38
	bl	printf
	adrp	x0, .LC39
	add	x0, x0, :lo12:.LC39
	bl	L
	mov	x19, x0
	adrp	x0, .LC40
	add	x0, x0, :lo12:.LC40
	bl	L
	mov	x2, 3
	mov	x1, x0
	mov	x0, x19
	bl	memcmp
	bl	sgn
	mov	w19, w0
	adrp	x0, .LC41
	add	x0, x0, :lo12:.LC41
	bl	L
	mov	x20, x0
	adrp	x0, .LC42
	add	x0, x0, :lo12:.LC42
	bl	L
	mov	x2, 1
	mov	x1, x0
	mov	x0, x20
	bl	memcmp
	bl	sgn
	mov	w20, w0
	adrp	x0, .LC43
	add	x0, x0, :lo12:.LC43
	bl	L
	mov	x21, x0
	adrp	x0, .LC43
	add	x0, x0, :lo12:.LC43
	bl	L
	mov	x2, 4
	mov	x1, x0
	mov	x0, x21
	bl	memcmp
	bl	sgn
	mov	w3, w0
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC44
	add	x0, x0, :lo12:.LC44
	bl	printf
	add	x0, sp, 384
	mov	x2, 8
	mov	w1, 35
	bl	memset
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	L
	mov	x1, x0
	add	x0, sp, 384
	mov	x2, 6
	bl	strncpy
	add	x0, sp, 384
	mov	w2, 8
	mov	x1, x0
	adrp	x0, .LC45
	add	x0, x0, :lo12:.LC45
	bl	hex
	add	x0, sp, 384
	mov	x2, 8
	mov	w1, 35
	bl	memset
	adrp	x0, .LC46
	add	x0, x0, :lo12:.LC46
	bl	L
	mov	x1, x0
	add	x0, sp, 384
	mov	x2, 4
	bl	strncpy
	add	x0, sp, 384
	mov	w2, 8
	mov	x1, x0
	adrp	x0, .LC47
	add	x0, x0, :lo12:.LC47
	bl	hex
	add	x0, sp, 344
	stp	xzr, xzr, [x0]
	add	x0, sp, 360
	stp	xzr, xzr, [x0]
	str	xzr, [sp, 376]
	adrp	x0, .LC48
	add	x0, x0, :lo12:.LC48
	bl	L
	mov	x1, x0
	add	x0, sp, 344
	bl	strcat
	str	x0, [sp, 792]
	adrp	x0, .LC49
	add	x0, x0, :lo12:.LC49
	bl	L
	mov	x1, x0
	add	x0, sp, 344
	bl	strcat
	mov	x19, x0
	adrp	x0, .LC50
	add	x0, x0, :lo12:.LC50
	bl	L
	mov	x1, x0
	mov	x0, x19
	bl	strcat
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	L
	mov	x1, x0
	add	x0, sp, 344
	bl	strcat
	adrp	x0, .LC51
	add	x0, x0, :lo12:.LC51
	bl	L
	mov	x1, x0
	add	x0, sp, 344
	bl	strcat
	str	x0, [sp, 784]
	add	x0, sp, 344
	ldr	x1, [sp, 792]
	cmp	x1, x0
	cset	w0, eq
	and	w0, w0, 255
	mov	w19, w0
	add	x0, sp, 344
	bl	strlen
	mov	w3, w0
	mov	w2, w19
	ldr	x1, [sp, 784]
	adrp	x0, .LC52
	add	x0, x0, :lo12:.LC52
	bl	printf
	adrp	x0, .LC53
	add	x0, x0, :lo12:.LC53
	bl	L
	str	x0, [sp, 776]
	mov	w1, 108
	ldr	x0, [sp, 776]
	bl	strchr
	mov	x1, x0
	ldr	x0, [sp, 776]
	sub	x0, x1, x0
	mov	w19, w0
	mov	w1, 0
	ldr	x0, [sp, 776]
	bl	strchr
	mov	x1, x0
	ldr	x0, [sp, 776]
	sub	x0, x1, x0
	mov	w20, w0
	mov	w1, 122
	ldr	x0, [sp, 776]
	bl	strchr
	cmp	x0, 0
	cset	w0, eq
	and	w0, w0, 255
	mov	w21, w0
	mov	w1, 364
	ldr	x0, [sp, 776]
	bl	strchr
	mov	x1, x0
	ldr	x0, [sp, 776]
	sub	x0, x1, x0
	mov	w22, w0
	mov	w1, 233
	ldr	x0, [sp, 776]
	bl	strchr
	mov	x1, x0
	ldr	x0, [sp, 776]
	sub	x0, x1, x0
	mov	w23, w0
	mov	w1, -23
	ldr	x0, [sp, 776]
	bl	strchr
	mov	x1, x0
	ldr	x0, [sp, 776]
	sub	x0, x1, x0
	mov	w6, w0
	mov	w5, w23
	mov	w4, w22
	mov	w3, w21
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC54
	add	x0, x0, :lo12:.LC54
	bl	printf
	adrp	x0, .LC55
	add	x0, x0, :lo12:.LC55
	bl	L
	str	x0, [sp, 768]
	adrp	x0, .LC56
	add	x0, x0, :lo12:.LC56
	bl	L
	str	x0, [sp, 760]
	adrp	x0, .LC57
	add	x0, x0, :lo12:.LC57
	bl	L
	mov	x1, x0
	ldr	x0, [sp, 760]
	bl	strstr
	mov	x1, x0
	ldr	x0, [sp, 760]
	sub	x0, x1, x0
	mov	w19, w0
	adrp	x0, .LC58
	add	x0, x0, :lo12:.LC58
	bl	L
	mov	x1, x0
	ldr	x0, [sp, 768]
	bl	strstr
	mov	x1, x0
	ldr	x0, [sp, 768]
	sub	x0, x1, x0
	mov	w20, w0
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	L
	mov	x1, x0
	ldr	x0, [sp, 768]
	bl	strstr
	mov	x1, x0
	ldr	x0, [sp, 768]
	cmp	x0, x1
	cset	w0, eq
	and	w0, w0, 255
	mov	w21, w0
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	L
	mov	x22, x0
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	L
	mov	x1, x0
	mov	x0, x22
	bl	strstr
	cmp	x0, 0
	cset	w0, eq
	and	w0, w0, 255
	mov	w22, w0
	adrp	x0, .LC59
	add	x0, x0, :lo12:.LC59
	bl	L
	mov	x1, x0
	ldr	x0, [sp, 768]
	bl	strstr
	mov	x1, x0
	ldr	x0, [sp, 768]
	sub	x0, x1, x0
	mov	w5, w0
	mov	w4, w22
	mov	w3, w21
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC60
	add	x0, x0, :lo12:.LC60
	bl	printf
	adrp	x0, .LC61
	add	x1, x0, :lo12:.LC61
	add	x0, sp, 328
	ldr	x2, [x1]
	ldr	w1, [x1, 7]
	str	x2, [x0]
	str	w1, [x0, 7]
	add	x0, sp, 328
	add	x0, x0, 2
	add	x1, sp, 328
	mov	x2, 6
	bl	memmove
	add	x0, sp, 328
	mov	x1, x0
	adrp	x0, .LC62
	add	x0, x0, :lo12:.LC62
	bl	printf
	add	x0, sp, 328
	add	x0, x0, 3
	add	x3, sp, 328
	mov	x2, 5
	mov	x1, x0
	mov	x0, x3
	bl	memmove
	add	x0, sp, 328
	mov	x1, x0
	adrp	x0, .LC63
	add	x0, x0, :lo12:.LC63
	bl	printf
	add	x0, sp, 328
	add	x0, x0, 1
	add	x1, sp, 328
	add	x1, x1, 1
	mov	x2, 0
	bl	memmove
	add	x0, sp, 328
	add	x0, x0, 7
	mov	x2, 2
	mov	w1, 321
	bl	memset
	add	x0, sp, 328
	mov	x1, x0
	adrp	x0, .LC64
	add	x0, x0, :lo12:.LC64
	bl	printf
	adrp	x0, .LC65
	add	x1, x0, :lo12:.LC65
	add	x0, sp, 296
	ldr	q30, [x1]
	ldr	q31, [x1, 11]
	str	q30, [x0]
	str	q31, [x0, 11]
	str	wzr, [sp, 844]
	adrp	x0, .LC66
	add	x0, x0, :lo12:.LC66
	bl	printf
	adrp	x0, .LC67
	add	x0, x0, :lo12:.LC67
	bl	L
	mov	x1, x0
	add	x0, sp, 296
	bl	strtok
	str	x0, [sp, 832]
	b	.L14
.L15:
	ldr	w0, [sp, 844]
	add	w1, w0, 1
	str	w1, [sp, 844]
	add	x1, sp, 296
	ldr	x2, [sp, 832]
	sub	x1, x2, x1
	mov	w3, w1
	ldr	x2, [sp, 832]
	mov	w1, w0
	adrp	x0, .LC68
	add	x0, x0, :lo12:.LC68
	bl	printf
	adrp	x0, .LC67
	add	x0, x0, :lo12:.LC67
	bl	L
	mov	x1, x0
	mov	x0, 0
	bl	strtok
	str	x0, [sp, 832]
.L14:
	ldr	x0, [sp, 832]
	cmp	x0, 0
	bne	.L15
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	add	x0, sp, 296
	mov	w2, 26
	mov	x1, x0
	adrp	x0, .LC69
	add	x0, x0, :lo12:.LC69
	bl	show_cut
	adrp	x0, .LC70
	add	x1, x0, :lo12:.LC70
	add	x0, sp, 280
	ldr	x2, [x1]
	ldr	w1, [x1, 8]
	str	x2, [x0]
	str	w1, [x0, 8]
	adrp	x0, .LC71
	add	x0, x0, :lo12:.LC71
	bl	L
	mov	x1, x0
	add	x0, sp, 280
	bl	strtok
	str	x0, [sp, 752]
	adrp	x0, .LC72
	add	x0, x0, :lo12:.LC72
	bl	L
	mov	x1, x0
	mov	x0, 0
	bl	strtok
	str	x0, [sp, 744]
	adrp	x0, .LC71
	add	x0, x0, :lo12:.LC71
	bl	L
	mov	x1, x0
	mov	x0, 0
	bl	strtok
	str	x0, [sp, 736]
	adrp	x0, .LC72
	add	x0, x0, :lo12:.LC72
	bl	L
	mov	x1, x0
	mov	x0, 0
	bl	strtok
	str	x0, [sp, 728]
	adrp	x0, .LC73
	add	x0, x0, :lo12:.LC73
	bl	L
	mov	x1, x0
	mov	x0, 0
	bl	strtok
	str	x0, [sp, 720]
	adrp	x0, .LC72
	add	x0, x0, :lo12:.LC72
	bl	L
	mov	x1, x0
	mov	x0, 0
	bl	strtok
	str	x0, [sp, 712]
	ldr	x0, [sp, 712]
	cmp	x0, 0
	cset	w0, eq
	and	w0, w0, 255
	mov	w6, w0
	ldr	x5, [sp, 720]
	ldr	x4, [sp, 728]
	ldr	x3, [sp, 736]
	ldr	x2, [sp, 744]
	ldr	x1, [sp, 752]
	adrp	x0, .LC74
	add	x0, x0, :lo12:.LC74
	bl	printf
	adrp	x0, .LC75
	add	x1, x0, :lo12:.LC75
	add	x0, sp, 176
	ldr	q26, [x1]
	ldr	q27, [x1, 16]
	ldr	q28, [x1, 32]
	ldr	q29, [x1, 48]
	ldr	q30, [x1, 64]
	ldr	q31, [x1, 80]
	ldr	x1, [x1, 96]
	str	q26, [x0]
	str	q27, [x0, 16]
	str	q28, [x0, 32]
	str	q29, [x0, 48]
	str	q30, [x0, 64]
	str	q31, [x0, 80]
	str	x1, [x0, 96]
	adrp	x0, .LC14
	add	x1, x0, :lo12:.LC14
	add	x0, sp, 120
	ldr	q29, [x1]
	ldr	q30, [x1, 16]
	ldr	q31, [x1, 32]
	ldr	w1, [x1, 48]
	str	q29, [x0]
	str	q30, [x0, 16]
	str	q31, [x0, 32]
	str	w1, [x0, 48]
	str	wzr, [sp, 828]
	b	.L16
.L17:
	ldrsw	x0, [sp, 828]
	lsl	x0, x0, 3
	add	x1, sp, 176
	ldr	x0, [x1, x0]
	bl	L
	mov	x3, x0
	ldrsw	x0, [sp, 828]
	lsl	x0, x0, 2
	add	x1, sp, 120
	ldr	w1, [x1, x0]
	add	x0, sp, 72
	mov	w2, w1
	mov	x1, x0
	mov	x0, x3
	bl strtol
	str	x0, [sp, 696]
	ldrsw	x0, [sp, 828]
	lsl	x0, x0, 3
	add	x1, sp, 176
	ldr	x5, [x1, x0]
	ldrsw	x0, [sp, 828]
	lsl	x0, x0, 2
	add	x1, sp, 120
	ldr	w6, [x1, x0]
	ldr	x1, [sp, 72]
	ldrsw	x0, [sp, 828]
	lsl	x0, x0, 3
	add	x2, sp, 176
	ldr	x0, [x2, x0]
	sub	x0, x1, x0
	mov	w4, w0
	ldr	x3, [sp, 696]
	mov	w2, w6
	mov	x1, x5
	adrp	x0, .LC76
	add	x0, x0, :lo12:.LC76
	bl	printf
	ldr	w0, [sp, 828]
	add	w0, w0, 1
	str	w0, [sp, 828]
.L16:
	ldr	w0, [sp, 828]
	cmp	w0, 12
	ble	.L17
	adrp	x0, .LC77
	add	x0, x0, :lo12:.LC77
	bl	L
	bl	atoi
	mov	w19, w0
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	L
	bl	atoi
	mov	w20, w0
	adrp	x0, .LC78
	add	x0, x0, :lo12:.LC78
	bl	L
	bl	atoi
	mov	w3, w0
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC79
	add	x0, x0, :lo12:.LC79
	bl	printf
	add	x0, sp, 104
	mov	x2, 16
	mov	w1, 42
	bl	memset
	adrp	x0, .LC80
	add	x0, x0, :lo12:.LC80
	bl	L
	mov	x19, x0
	adrp	x0, .LC81
	add	x0, x0, :lo12:.LC81
	bl	L
	mov	x1, x0
	add	x0, sp, 104
	mov	w4, 12345
	mov	x3, x1
	mov	x2, x19
	mov	x1, 8
	bl	snprintf
	str	w0, [sp, 708]
	ldrb	w0, [sp, 112]
	mov	w1, w0
	add	x0, sp, 104
	mov	w3, w1
	mov	x2, x0
	ldr	w1, [sp, 708]
	adrp	x0, .LC82
	add	x0, x0, :lo12:.LC82
	bl	printf
	add	x0, sp, 104
	mov	x2, 16
	mov	w1, 42
	bl	memset
	adrp	x0, .LC83
	add	x0, x0, :lo12:.LC83
	bl	L
	mov	x1, x0
	add	x0, sp, 104
	mov	w3, 57920
	movk	w3, 0x1, lsl 16
	mov	x2, x1
	mov	x1, 0
	bl	snprintf
	str	w0, [sp, 708]
	ldrb	w0, [sp, 104]
	mov	w2, w0
	ldr	w1, [sp, 708]
	adrp	x0, .LC84
	add	x0, x0, :lo12:.LC84
	bl	printf
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	L
	mov	x19, x0
	adrp	x0, .LC85
	add	x0, x0, :lo12:.LC85
	bl	L
	mov	x1, x0
	add	x0, sp, 104
	mov	x3, x1
	mov	x2, x19
	mov	x1, 1
	bl	snprintf
	str	w0, [sp, 708]
	ldrb	w0, [sp, 104]
	mov	w2, w0
	ldr	w1, [sp, 708]
	adrp	x0, .LC86
	add	x0, x0, :lo12:.LC86
	bl	printf
	adrp	x0, .LC87
	add	x0, x0, :lo12:.LC87
	bl	L
	mov	x19, x0
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	L
	mov	x1, x0
	add	x0, sp, 104
	mov	w4, 7
	mov	x3, x1
	mov	w2, 48879
	mov	x1, x19
	bl	sprintf
	str	w0, [sp, 708]
	add	x0, sp, 104
	mov	x2, x0
	ldr	w1, [sp, 708]
	adrp	x0, .LC88
	add	x0, x0, :lo12:.LC88
	bl	printf
	str	wzr, [sp, 824]
	str	wzr, [sp, 820]
	str	wzr, [sp, 816]
	str	wzr, [sp, 812]
	str	wzr, [sp, 808]
	b	.L18
.L19:
	bl	__ctype_b_loc
	ldr	x1, [x0]
	ldrsw	x0, [sp, 808]
	lsl	x0, x0, 1
	add	x0, x1, x0
	ldrh	w0, [x0]
	and	w0, w0, 2048
	ubfx	x0, x0, 11, 1
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 824]
	add	w0, w0, w1
	str	w0, [sp, 824]
	bl	__ctype_b_loc
	ldr	x1, [x0]
	ldrsw	x0, [sp, 808]
	lsl	x0, x0, 1
	add	x0, x1, x0
	ldrh	w0, [x0]
	and	w0, w0, 1024
	ubfx	x0, x0, 10, 1
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 820]
	add	w0, w0, w1
	str	w0, [sp, 820]
	bl	__ctype_b_loc
	ldr	x1, [x0]
	ldrsw	x0, [sp, 808]
	lsl	x0, x0, 1
	add	x0, x1, x0
	ldrh	w0, [x0]
	and	w0, w0, 8192
	ubfx	x0, x0, 13, 1
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 816]
	add	w0, w0, w1
	str	w0, [sp, 816]
	ldr	w0, [sp, 808]
	bl	toupper
	mov	w1, w0
	ldr	w0, [sp, 808]
	cmp	w0, w1
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 812]
	add	w0, w0, w1
	str	w0, [sp, 812]
	ldr	w0, [sp, 808]
	add	w0, w0, 1
	str	w0, [sp, 808]
.L18:
	ldr	w0, [sp, 808]
	cmp	w0, 255
	ble	.L19
	bl	__ctype_b_loc
	ldr	x0, [x0]
	sub	x0, x0, #2
	ldrh	w0, [x0]
	and	w0, w0, 8192
	ubfx	x0, x0, 13, 1
	and	w0, w0, 255
	mov	w5, w0
	ldr	w4, [sp, 812]
	ldr	w3, [sp, 816]
	ldr	w2, [sp, 820]
	ldr	w1, [sp, 824]
	adrp	x0, .LC89
	add	x0, x0, :lo12:.LC89
	bl	printf
	adrp	x0, .LC90
	add	x1, x0, :lo12:.LC90
	add	x0, sp, 80
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 15]
	stp	x2, x3, [x0]
	str	x1, [x0, 15]
	add	x0, sp, 80
	str	x0, [sp, 800]
	b	.L20
.L21:
	ldr	x0, [sp, 800]
	ldrb	w0, [x0]
	bl	toupper
	and	w1, w0, 255
	ldr	x0, [sp, 800]
	strb	w1, [x0]
	ldr	x0, [sp, 800]
	add	x0, x0, 1
	str	x0, [sp, 800]
.L20:
	ldr	x0, [sp, 800]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L21
	add	x0, sp, 80
	add	x0, x0, 14
	mov	w2, 8
	mov	x1, x0
	adrp	x0, .LC91
	add	x0, x0, :lo12:.LC91
	bl	hex
	add	x0, sp, 80
	mov	x1, x0
	adrp	x0, .LC92
	add	x0, x0, :lo12:.LC92
	bl	printf
	mov	w0, -23
	strb	w0, [sp, 707]
	ldrb	w1, [sp, 707]
	ldrb	w0, [sp, 707]
	cmp	w0, 0
	cset	w0, ne
	and	w0, w0, 255
	mov	w2, w0
	adrp	x0, .LC93
	add	x0, x0, :lo12:.LC93
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	add	sp, sp, 848
	ret
	.section .rodata
	.align	3
.LC61:
	.string	"0123456789"
	.align	3
.LC65:
	.string	"  ,,alpha, beta;;gamma ,  "
	.align	3
.LC70:
	.string	"a=1&b=22&&c"
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
	.align	3
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
	.align	3
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
	.align	3
.LC90:
	.string	"Hello, World! 123 caf\351"
	.text

