	.text
	.section .rodata
	.align	3
.LC15:
	.string	"%s"
	.align	3
.LC16:
	.string	" %02x"
	.text
	.align	2
	.align 5
hex__constprop__0:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	mov	x19, x1
	adrp	x20, .LC16
	add	x20, x20, :lo12:.LC16
	str	x21, [sp, 32]
	add	x21, x19, 8
	mov	x1, x0
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	.align 5
.L2:
	ldrb	w1, [x19], 1
	mov	x0, x20
	bl	printf
	cmp	x19, x21
	bne	.L2
	ldr	x21, [sp, 32]
	mov	w0, 10
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 48
	b	putchar
	.section .rodata
	.align	3
.LC18:
	.string	""
	.align	3
.LC19:
	.string	"a"
	.align	3
.LC21:
	.string	"strlen: %d %d %d %d\n"
	.align	3
.LC22:
	.string	"abc"
	.align	3
.LC23:
	.string	"abd"
	.align	3
.LC24:
	.string	"ab"
	.align	3
.LC25:
	.string	"\200"
	.align	3
.LC26:
	.string	"\177"
	.align	3
.LC27:
	.string	"\377"
	.align	3
.LC28:
	.string	"\001"
	.align	3
.LC29:
	.byte 97, 233, 0
	.align	3
.LC30:
	.string	"cmp: %d %d %d %d %d %d\n"
	.align	3
.LC31:
	.string	"abcX"
	.align	3
.LC32:
	.string	"abcY"
	.align	3
.LC33:
	.string	"x"
	.align	3
.LC34:
	.string	"y"
	.align	3
.LC36:
	.string	"ncmp: %d %d %d %d\n"
	.align	3
.LC39:
	.string	"\220"
	.align	3
.LC40:
	.string	"\020"
	.align	3
.LC41:
	.string	"same"
	.align	3
.LC42:
	.string	"memcmp: %d %d %d\n"
	.align	3
.LC43:
	.string	"strncpy pad:"
	.align	3
.LC44:
	.string	"abcdefgh"
	.align	3
.LC45:
	.string	"strncpy cut:"
	.align	3
.LC46:
	.string	"one"
	.align	3
.LC47:
	.string	","
	.align	3
.LC48:
	.string	"two"
	.align	3
.LC49:
	.string	",three"
	.align	3
.LC50:
	.string	"strcat: [%s] %d %d\n"
	.align	3
.LC51:
	.string	"hello, caf\351!"
	.align	3
.LC52:
	.string	"strchr: %d %d %d %d %d %d\n"
	.align	3
.LC53:
	.string	"abcabcabd"
	.align	3
.LC54:
	.string	"aaab"
	.align	3
.LC55:
	.string	"aab"
	.align	3
.LC56:
	.string	"abcabd"
	.align	3
.LC57:
	.string	"cab"
	.align	3
.LC58:
	.string	"strstr: %d %d %d %d %d\n"
	.align	3
.LC60:
	.string	"memmove up: %s"
	.align	3
.LC61:
	.string	" down: %s"
	.align	3
.LC62:
	.string	" set: %s\n"
	.align	3
.LC64:
	.string	"strtok:"
	.align	3
.LC65:
	.string	" ,;"
	.align	3
.LC66:
	.string	" %d:%s@%d"
	.align	3
.LC67:
	.string	"cut"
	.align	3
.LC68:
	.string	"%s ["
	.align	3
.LC69:
	.string	"]"
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
	sub	sp, sp, #1248
	mov	x2, 299
	mov	w1, 120
	add	x0, sp, 944
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x19, .LC19
	add	x19, x19, :lo12:.LC19
	stp	x21, x22, [sp, 32]
	adrp	x22, .LANCHOR0
	add	x20, x22, :lo12:.LANCHOR0
	stp	x23, x24, [sp, 48]
	adrp	x23, .LC18
	add	x23, x23, :lo12:.LC18
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	bl	memset
	str	x23, [sp, 488]
	strb	wzr, [sp, 1243]
	ldr	x0, [sp, 488]
	bl	strlen
	str	x19, [sp, 480]
	mov	x21, x0
	ldr	x0, [sp, 480]
	bl	strlen
	mov	x24, x0
	add	x0, x20, 16
	str	x0, [sp, 472]
	ldr	x0, [sp, 472]
	bl	strlen
	mov	w4, w0
	mov	w2, w24
	mov	w3, 299
	mov	w1, w21
	adrp	x0, .LC21
	adrp	x21, .LC22
	add	x0, x0, :lo12:.LC21
	add	x21, x21, :lo12:.LC22
	bl	printf
	str	x21, [sp, 464]
	adrp	x1, .LC23
	add	x1, x1, :lo12:.LC23
	adrp	x24, .LC24
	ldr	x0, [sp, 464]
	str	x1, [sp, 456]
	add	x24, x24, :lo12:.LC24
	ldr	x1, [sp, 456]
	bl	strcmp
	str	x21, [sp, 448]
	mov	w25, w0
	ldr	x0, [sp, 448]
	str	x24, [sp, 440]
	ldr	x1, [sp, 440]
	bl	strcmp
	str	x23, [sp, 432]
	mov	w26, w0
	ldr	x0, [sp, 432]
	str	x23, [sp, 424]
	ldr	x1, [sp, 424]
	bl	strcmp
	mov	w27, w0
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	str	x0, [sp, 416]
	adrp	x1, .LC26
	add	x1, x1, :lo12:.LC26
	ldr	x0, [sp, 416]
	str	x1, [sp, 408]
	ldr	x1, [sp, 408]
	bl	strcmp
	mov	w28, w0
	adrp	x0, .LC27
	add	x0, x0, :lo12:.LC27
	str	x0, [sp, 400]
	adrp	x1, .LC28
	add	x1, x1, :lo12:.LC28
	ldr	x0, [sp, 400]
	str	x1, [sp, 392]
	ldr	x1, [sp, 392]
	bl	strcmp
	str	x19, [sp, 384]
	adrp	x1, .LC29
	add	x1, x1, :lo12:.LC29
	str	w0, [sp, 104]
	adrp	x19, .LC32
	ldr	x0, [sp, 384]
	str	x1, [sp, 376]
	add	x19, x19, :lo12:.LC32
	ldr	x1, [sp, 376]
	bl	strcmp
	cmp	w0, 0
	ldr	w5, [sp, 104]
	cset	w6, gt
	sub	w6, w6, w0, lsr 31
	adrp	x0, .LC30
	cmp	w5, 0
	add	x0, x0, :lo12:.LC30
	cset	w7, gt
	cmp	w28, 0
	cset	w4, gt
	cmp	w27, 0
	cset	w3, gt
	cmp	w26, 0
	cset	w2, gt
	cmp	w25, 0
	cset	w1, gt
	sub	w5, w7, w5, lsr 31
	sub	w4, w4, w28, lsr 31
	sub	w3, w3, w27, lsr 31
	sub	w2, w2, w26, lsr 31
	sub	w1, w1, w25, lsr 31
	adrp	x25, .LC31
	bl	printf
	add	x25, x25, :lo12:.LC31
	str	x25, [sp, 368]
	mov	x2, 3
	ldr	x0, [sp, 368]
	str	x19, [sp, 360]
	ldr	x1, [sp, 360]
	bl	strncmp
	str	x25, [sp, 352]
	mov	w26, w0
	mov	x2, 4
	ldr	x0, [sp, 352]
	str	x19, [sp, 344]
	ldr	x1, [sp, 344]
	bl	strncmp
	mov	w19, w0
	adrp	x0, .LC33
	add	x0, x0, :lo12:.LC33
	str	x0, [sp, 336]
	add	x1, x20, 24
	mov	x2, 5
	ldr	x0, [sp, 336]
	adrp	x0, .LC34
	add	x0, x0, :lo12:.LC34
	str	x0, [sp, 328]
	ldr	x0, [sp, 328]
	str	x24, [sp, 320]
	ldr	x0, [sp, 320]
	str	x1, [sp, 312]
	ldr	x1, [sp, 312]
	bl	strncmp
	cmp	w0, 0
	cset	w4, gt
	cmp	w19, 0
	cset	w2, gt
	cmp	w26, 0
	cset	w1, gt
	sub	w4, w4, w0, lsr 31
	mov	w3, 0
	sub	w2, w2, w19, lsr 31
	sub	w1, w1, w26, lsr 31
	adrp	x0, .LC36
	add	x0, x0, :lo12:.LC36
	bl	printf
	add	x0, x20, 32
	str	x0, [sp, 304]
	add	x1, x20, 40
	mov	x2, 3
	ldr	x0, [sp, 304]
	str	x1, [sp, 296]
	ldr	x1, [sp, 296]
	bl	memcmp
	mov	w25, w0
	adrp	x0, .LC39
	add	x0, x0, :lo12:.LC39
	str	x0, [sp, 288]
	adrp	x1, .LC41
	add	x1, x1, :lo12:.LC41
	mov	x2, 4
	ldr	x0, [sp, 288]
	ldrb	w19, [x0]
	adrp	x0, .LC40
	add	x0, x0, :lo12:.LC40
	str	x0, [sp, 280]
	ldr	x0, [sp, 280]
	str	x1, [sp, 272]
	ldrb	w0, [x0]
	sub	w19, w19, w0
	ldr	x0, [sp, 272]
	str	x1, [sp, 264]
	ldr	x1, [sp, 264]
	bl	memcmp
	cmp	w0, 0
	cset	w3, gt
	cmp	w19, 0
	cset	w2, gt
	cmp	w25, 0
	cset	w1, gt
	sub	w3, w3, w0, lsr 31
	sub	w2, w2, w19, lsr 31
	sub	w1, w1, w25, lsr 31
	adrp	x0, .LC42
	add	x0, x0, :lo12:.LC42
	bl	printf
	str	x24, [sp, 256]
	mov	x19, 8995
	mov	x2, 6
	ldr	x1, [sp, 256]
	movk	x19, 0x2323, lsl 16
	orr	x19, x19, x19, lsl 32
	add	x0, sp, 120
	str	x19, [sp, 120]
	bl	strncpy
	add	x1, sp, 120
	adrp	x0, .LC43
	add	x0, x0, :lo12:.LC43
	bl	hex__constprop__0
	adrp	x0, .LC44
	add	x0, x0, :lo12:.LC44
	str	x0, [sp, 248]
	mov	x2, 4
	add	x0, sp, 120
	str	x19, [sp, 120]
	ldr	x1, [sp, 248]
	add	x19, sp, 744
	bl	strncpy
	add	x1, sp, 120
	adrp	x0, .LC45
	add	x0, x0, :lo12:.LC45
	bl	hex__constprop__0
	add	x0, sp, 744
	str	xzr, [sp, 776]
	stp	xzr, xzr, [x0]
	add	x0, sp, 760
	stp	xzr, xzr, [x0]
	adrp	x0, .LC46
	add	x0, x0, :lo12:.LC46
	str	x0, [sp, 240]
	mov	x0, x19
	ldr	x1, [sp, 240]
	bl	strcat
	mov	x25, x0
	adrp	x0, .LC47
	add	x0, x0, :lo12:.LC47
	str	x0, [sp, 232]
	mov	x0, x19
	ldr	x1, [sp, 232]
	bl	strcat
	adrp	x1, .LC48
	add	x1, x1, :lo12:.LC48
	str	x1, [sp, 224]
	ldr	x1, [sp, 224]
	bl	strcat
	str	x23, [sp, 216]
	mov	x0, x19
	bl	strlen
	ldr	x26, [sp, 216]
	add	x0, x19, x0
	mov	x1, x26
	bl	strcpy
	adrp	x0, .LC49
	add	x0, x0, :lo12:.LC49
	str	x0, [sp, 208]
	mov	x0, x19
	ldr	x1, [sp, 208]
	bl	strcat
	mov	x26, x0
	mov	x0, x19
	bl	strlen
	cmp	x25, x19
	mov	w3, w0
	cset	w2, eq
	mov	x1, x26
	adrp	x0, .LC50
	add	x0, x0, :lo12:.LC50
	bl	printf
	adrp	x0, .LC51
	add	x0, x0, :lo12:.LC51
	str	x0, [sp, 200]
	mov	w1, 108
	ldr	x19, [sp, 200]
	mov	x0, x19
	bl	strchr
	mov	x25, x0
	mov	x0, x19
	bl	strlen
	str	x0, [sp, 104]
	mov	w1, 122
	mov	x0, x19
	bl	strchr
	mov	x28, x0
	mov	w1, 364
	mov	x0, x19
	bl	strchr
	mov	x26, x0
	mov	w1, 233
	mov	x0, x19
	bl	strchr
	mov	x27, x0
	mov	w1, -23
	mov	x0, x19
	bl	strchr
	sub	w6, w0, w19
	ldr	x2, [sp, 104]
	cmp	x28, 0
	sub	w5, w27, w19
	sub	w4, w26, w19
	cset	w3, eq
	sub	w1, w25, w19
	adrp	x0, .LC52
	add	x0, x0, :lo12:.LC52
	bl	printf
	adrp	x0, .LC53
	add	x0, x0, :lo12:.LC53
	str	x0, [sp, 192]
	adrp	x0, .LC54
	add	x0, x0, :lo12:.LC54
	ldr	x19, [sp, 192]
	str	x0, [sp, 184]
	adrp	x0, .LC55
	add	x0, x0, :lo12:.LC55
	ldr	x28, [sp, 184]
	str	x0, [sp, 176]
	ldr	x1, [sp, 176]
	mov	x0, x28
	bl	strstr
	mov	x25, x0
	adrp	x0, .LC56
	add	x0, x0, :lo12:.LC56
	str	x0, [sp, 168]
	mov	x0, x19
	ldr	x1, [sp, 168]
	bl	strstr
	str	x23, [sp, 160]
	mov	x26, x0
	mov	x0, x19
	ldr	x1, [sp, 160]
	bl	strstr
	str	x24, [sp, 152]
	mov	x27, x0
	ldr	x0, [sp, 152]
	str	x21, [sp, 144]
	ldr	x1, [sp, 144]
	bl	strstr
	mov	x21, x0
	adrp	x0, .LC57
	add	x0, x0, :lo12:.LC57
	str	x0, [sp, 136]
	mov	x0, x19
	ldr	x1, [sp, 136]
	bl	strstr
	sub	w5, w0, w19
	cmp	x21, 0
	sub	w2, w26, w19
	cset	w4, eq
	cmp	x27, x19
	cset	w3, eq
	sub	w1, w25, w28
	adrp	x0, .LC58
	add	x0, x0, :lo12:.LC58
	bl	printf
	add	x19, sp, 712
	adrp	x0, .LC59
	add	x0, x0, :lo12:.LC59
	add	x2, sp, 647
	adrp	x21, .LC65
	add	x21, x21, :lo12:.LC65
	ldr	x1, [x0]
	str	x1, [sp, 640]
	ldr	w0, [x0, 7]
	str	w0, [x2]
	add	x2, sp, 642
	ubfx	x0, x1, 32, 16
	str	w1, [x2]
	add	x1, sp, 640
	strh	w0, [sp, 646]
	adrp	x0, .LC60
	add	x0, x0, :lo12:.LC60
	bl	printf
	add	x0, sp, 643
	add	x1, sp, 640
	ldr	w0, [x0]
	str	w0, [sp, 640]
	ldrb	w0, [sp, 647]
	strb	w0, [sp, 644]
	adrp	x0, .LC61
	add	x0, x0, :lo12:.LC61
	bl	printf
	add	x1, sp, 647
	mov	w0, 16705
	strh	w0, [x1]
	add	x1, sp, 640
	adrp	x0, .LC62
	add	x0, x0, :lo12:.LC62
	bl	printf
	adrp	x0, .LC63
	add	x0, x0, :lo12:.LC63
	ldr	q30, [x0]
	ldr	q31, [x0, 11]
	adrp	x0, .LC64
	str	q30, [x19]
	add	x0, x0, :lo12:.LC64
	str	q31, [x19, 11]
	bl	printf
	mov	x0, x19
	str	x21, [sp, 128]
	ldr	x1, [sp, 128]
	bl	strtok
	cbz	x0, .L7
	adrp	x25, .LC66
	mov	x2, x0
	add	x25, x25, :lo12:.LC66
	mov	w26, 0
	.align 5
.L8:
	mov	w1, w26
	sub	w3, w2, w19
	mov	x0, x25
	bl	printf
	str	x21, [sp, 496]
	mov	x0, 0
	add	w26, w26, 1
	ldr	x1, [sp, 496]
	bl	strtok
	mov	x2, x0
	cbnz	x0, .L8
.L7:
	adrp	x21, stdout
	add	x26, sp, 738
	add	x21, x21, :lo12:stdout
	mov	w25, 124
	mov	w0, 10
	bl	putchar
	adrp	x1, .LC67
	adrp	x0, .LC68
	add	x1, x1, :lo12:.LC67
	add	x0, x0, :lo12:.LC68
	bl	printf
	.align 5
.L10:
	ldrb	w0, [x19], 1
	ldr	x1, [x21]
	cmp	w0, 0
	csel	w0, w0, w25, ne
	bl	putc
	cmp	x19, x26
	bne	.L10
	adrp	x0, .LC69
	add	x0, x0, :lo12:.LC69
	bl	puts
	adrp	x21, .LC71
	adrp	x0, .LC70
	add	x0, x0, :lo12:.LC70
	add	x21, x21, :lo12:.LC71
	str	x21, [sp, 544]
	adrp	x19, .LC72
	add	x19, x19, :lo12:.LC72
	ldr	x1, [x0]
	str	x1, [sp, 656]
	ldr	x1, [sp, 544]
	ldr	w0, [x0, 8]
	str	w0, [sp, 664]
	add	x0, sp, 656
	bl	strtok
	str	x19, [sp, 536]
	mov	x25, x0
	mov	x0, 0
	ldr	x1, [sp, 536]
	bl	strtok
	str	x21, [sp, 528]
	mov	x26, x0
	mov	x0, 0
	ldr	x1, [sp, 528]
	bl	strtok
	str	x19, [sp, 520]
	mov	x21, x0
	mov	x0, 0
	ldr	x1, [sp, 520]
	bl	strtok
	mov	x27, x0
	adrp	x0, .LC73
	add	x0, x0, :lo12:.LC73
	str	x0, [sp, 512]
	mov	x0, 0
	ldr	x1, [sp, 512]
	bl	strtok
	str	x19, [sp, 504]
	mov	x28, x0
	mov	x0, 0
	ldr	x1, [sp, 504]
	mov	x19, 1
	bl	strtok
	cmp	x0, 0
	mov	x2, x26
	mov	x1, x25
	mov	x4, x27
	cset	w6, eq
	mov	x5, x28
	mov	x3, x21
	adrp	x0, .LC74
	add	x0, x0, :lo12:.LC74
	bl	printf
	add	x25, sp, 840
	ldp	q31, q30, [x20, 112]
	add	x26, sp, 784
	ldp	q29, q28, [x20, 80]
	adrp	x27, .LC76
	ldp	q27, q26, [x20, 48]
	stp	q31, q30, [x25, 64]
	add	x27, x27, :lo12:.LC76
	ldr	x0, [x20, 144]
	stp	q29, q28, [x25, 32]
	ldr	q30, [x20, 152]
	stp	q27, q26, [x25]
	ldr	q29, [x20, 168]
	str	x0, [x25, 96]
	ldr	q31, [x20, 184]
	ldr	w0, [x20, 200]
	str	w0, [x26, 48]
	stp	q30, q29, [x26]
	str	q31, [x26, 32]
	.align 5
.L11:
	add	x0, x25, x19, lsl 3
	add	x1, sp, 688
	ldr	x20, [x0, -8]
	add	x0, x26, x19, lsl 2
	str	x20, [sp, 552]
	add	x19, x19, 1
	ldr	w21, [x0, -4]
	ldr	x0, [sp, 552]
	mov	w2, w21
	bl strtol
	mov	x3, x0
	ldr	x4, [sp, 688]
	mov	w2, w21
	mov	x1, x20
	mov	x0, x27
	sub	w4, w4, w20
	bl	printf
	cmp	x19, 14
	bne	.L11
	adrp	x0, .LC77
	add	x0, x0, :lo12:.LC77
	str	x0, [sp, 560]
	mov	w2, 10
	mov	x1, 0
	ldr	x0, [sp, 560]
	bl strtol
	str	x23, [sp, 568]
	mov	x19, x0
	mov	w2, 10
	ldr	x0, [sp, 568]
	mov	x1, 0
	bl strtol
	mov	x20, x0
	adrp	x0, .LC78
	add	x0, x0, :lo12:.LC78
	str	x0, [sp, 576]
	mov	w2, 10
	mov	x1, 0
	ldr	x0, [sp, 576]
	bl strtol
	mov	w3, w0
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC79
	add	x0, x0, :lo12:.LC79
	bl	printf
	adrp	x0, .LC80
	add	x0, x0, :lo12:.LC80
	str	x0, [sp, 632]
	adrp	x0, .LC81
	add	x0, x0, :lo12:.LC81
	mov	w4, 12345
	ldr	x2, [sp, 632]
	str	x0, [sp, 624]
	movi	v31.16b, 0x2a
	mov	x1, 8
	ldr	x3, [sp, 624]
	add	x0, sp, 672
	str	q31, [sp, 672]
	bl	snprintf
	ldrb	w3, [sp, 680]
	mov	w1, w0
	add	x2, sp, 672
	adrp	x0, .LC82
	add	x0, x0, :lo12:.LC82
	bl	printf
	adrp	x0, .LC83
	add	x0, x0, :lo12:.LC83
	str	x0, [sp, 616]
	mov	w3, 57920
	movi	v31.16b, 0x2a
	movk	w3, 0x1, lsl 16
	ldr	x2, [sp, 616]
	mov	x1, 0
	add	x0, sp, 672
	str	q31, [sp, 672]
	bl	snprintf
	ldrb	w2, [sp, 672]
	mov	w1, w0
	adrp	x0, .LC84
	add	x0, x0, :lo12:.LC84
	bl	printf
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	str	x0, [sp, 608]
	adrp	x0, .LC85
	add	x0, x0, :lo12:.LC85
	mov	x1, 1
	ldr	x2, [sp, 608]
	str	x0, [sp, 600]
	add	x0, sp, 672
	ldr	x3, [sp, 600]
	bl	snprintf
	mov	w1, w0
	ldrb	w2, [sp, 672]
	adrp	x0, .LC86
	add	x0, x0, :lo12:.LC86
	bl	printf
	adrp	x0, .LC87
	add	x0, x0, :lo12:.LC87
	str	x0, [sp, 592]
	mov	w4, 7
	mov	w2, 48879
	add	x0, sp, 672
	ldr	x1, [sp, 592]
	str	x24, [sp, 584]
	ldr	x3, [sp, 584]
	bl	sprintf
	mov	w1, w0
	add	x2, sp, 672
	adrp	x0, .LC88
	add	x0, x0, :lo12:.LC88
	bl	printf
	bl	__ctype_b_loc
	ldr	x20, [x0]
	bl	__ctype_toupper_loc
	movi	v31.4s, 0
	mov	x19, x0
	ldr	x0, [x0]
	mov	x1, x20
	ldr	q30, [x22, :lo12:.LANCHOR0]
	add	x2, x20, 512
	mov	v29.16b, v31.16b
	mov	v28.16b, v31.16b
	mov	v27.16b, v31.16b
	movi	v26.8h, 0x8, lsl 8
	movi	v25.8h, 0x1
	movi	v24.8h, 0x4, lsl 8
	movi	v23.8h, 0x20, lsl 8
	movi	v22.4s, 0x4
	movi	v21.4s, 0x8
	.align 5
.L12:
	ldr	q1, [x1], 16
	ldp	q0, q20, [x0], 32
	cmtst	v3.8h, v1.8h, v26.8h
	cmtst	v2.8h, v1.8h, v24.8h
	cmeq	v0.4s, v0.4s, v30.4s
	add	v19.4s, v30.4s, v22.4s
	cmtst	v1.8h, v1.8h, v23.8h
	and	v3.16b, v3.16b, v25.16b
	and	v2.16b, v2.16b, v25.16b
	not	v0.16b, v0.16b
	and	v1.16b, v1.16b, v25.16b
	cmeq	v19.4s, v20.4s, v19.4s
	uaddw	v29.4s, v29.4s, v3.4h
	uaddw	v28.4s, v28.4s, v2.4h
	uaddw	v27.4s, v27.4s, v1.4h
	sub	v31.4s, v31.4s, v0.4s
	not	v19.16b, v19.16b
	uaddw2	v29.4s, v29.4s, v3.8h
	uaddw2	v28.4s, v28.4s, v2.8h
	uaddw2	v27.4s, v27.4s, v1.8h
	sub	v31.4s, v31.4s, v19.4s
	add	v30.4s, v30.4s, v21.4s
	cmp	x2, x1
	bne	.L12
	addv	s31, v31.4s
	ldrh	w5, [x20, -2]
	adrp	x0, .LC89
	add	x0, x0, :lo12:.LC89
	ubfx	x5, x5, 13, 1
	fmov	w4, s31
	addv	s31, v27.4s
	fmov	w3, s31
	addv	s31, v28.4s
	fmov	w2, s31
	addv	s31, v29.4s
	fmov	w1, s31
	bl	printf
	adrp	x0, .LC90
	add	x0, x0, :lo12:.LC90
	add	x1, sp, 688
	ldp	x2, x3, [x0]
	stp	x2, x3, [x1]
	add	x1, sp, 703
	ldr	x0, [x0, 15]
	str	x0, [x1]
	add	x1, sp, 688
	mov	w0, 72
	.align 5
.L13:
	ldr	x2, [x19]
	ubfiz	x0, x0, 2, 8
	ldr	w0, [x2, x0]
	strb	w0, [x1]
	ldrb	w0, [x1, 1]!
	cbnz	w0, .L13
	add	x1, sp, 702
	adrp	x0, .LC91
	add	x0, x0, :lo12:.LC91
	bl	hex__constprop__0
	add	x1, sp, 688
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
	add	sp, sp, 1248
	ret
	.section .rodata
	.align	3
.LC59:
	.string	"0123456789"
	.align	3
.LC63:
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
	.align	4
	.LANCHOR0:
.LC17:
	.word	0
	.word	1
	.word	2
	.word	3
.LC20:
	.string	"ab"
	.string	"cd"
	.zero	2
.LC35:
	.string	"ab"
	.string	"zz"
	.zero	2
.LC37:
	.string	"a"
	.string	"b"
	.zero	4
.LC38:
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

