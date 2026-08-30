	.text
	.section .rodata
	.align	3
.LC0:
	.string	"def"
	.align	3
.LC1:
	.string	"abce"
	.align	3
.LC2:
	.string	"abcd"
	.align	3
.LC3:
	.string	"ac"
	.align	3
.LC4:
	.string	"ab"
	.align	3
.LC5:
	.string	"%s %s %d %d\n"
	.align	3
.LC6:
	.string	"cde"
	.align	3
.LC7:
	.string	"%s %s\n"
	.align	3
.LC8:
	.string	"x"
	.align	3
.LC9:
	.string	"%d-%s"
	.align	3
.LC10:
	.string	"%s\n"
	.align	3
.LC11:
	.string	"toolong"
	.align	3
.LC12:
	.string	"%s"
	.align	3
.LC13:
	.string	"  -123xyz"
	.align	3
.LC14:
	.string	"12abc"
	.align	3
.LC15:
	.string	"%ld %d %d %d\n"
	.align	3
.LC16:
	.string	"%d\n"
	.align	3
.LC17:
	.string	"%c %c %d %d %d\n"
	.align	3
.LC18:
	.string	"c"
	.align	3
.LC19:
	.string	"%s|%s\n"
	.align	3
.LC20:
	.string	"fputs line\n"
	.align	3
.LC21:
	.string	"got %s"
	.align	3
.LC22:
	.string	"puts line"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -224]!
	mov	x0, 25185
	movk	x0, 0x63, lsl 16
	mov	x29, sp
	mov	x1, 0
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	stp	x0, x1, [sp, 160]
	add	x0, sp, 160
	adrp	x1, .LC0
	add	x1, x1, :lo12:.LC0
	stp	xzr, xzr, [sp, 176]
	stp	xzr, xzr, [sp, 192]
	stp	xzr, xzr, [sp, 208]
	bl	strcat
	add	x1, sp, 160
	mov	x2, 3
	add	x0, sp, 96
	bl	strncpy
	strb	wzr, [sp, 99]
	mov	x2, 3
	adrp	x1, .LC1
	adrp	x0, .LC2
	add	x1, x1, :lo12:.LC1
	add	x0, x0, :lo12:.LC2
	bl	strncmp
	mov	x2, 2
	mov	w19, w0
	adrp	x1, .LC3
	adrp	x0, .LC4
	add	x1, x1, :lo12:.LC3
	add	x0, x0, :lo12:.LC4
	bl	memcmp
	mov	w4, w0
	mov	w3, w19
	add	x2, sp, 96
	add	x1, sp, 160
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w1, 100
	add	x0, sp, 160
	bl	strchr
	mov	x19, x0
	adrp	x1, .LC6
	add	x0, sp, 160
	add	x1, x1, :lo12:.LC6
	bl	strstr
	mov	x1, x19
	mov	x2, x0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	adrp	x19, .LC10
	adrp	x3, .LC8
	add	x3, x3, :lo12:.LC8
	mov	w2, 42
	add	x0, sp, 96
	adrp	x1, .LC9
	add	x1, x1, :lo12:.LC9
	bl	sprintf
	add	x1, sp, 96
	add	x0, x19, :lo12:.LC10
	bl	printf
	adrp	x3, .LC11
	adrp	x2, .LC12
	add	x3, x3, :lo12:.LC11
	add	x2, x2, :lo12:.LC12
	mov	x1, 4
	add	x0, sp, 96
	bl	snprintf
	add	x1, sp, 96
	add	x0, x19, :lo12:.LC10
	bl	printf
	mov	w2, 10
	mov	x1, 0
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl strtol
	mov	x20, x0
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	atoi
	mov	w21, w0
	mov	w0, -5
	bl	abs
	mov	w22, w0
	mov	x0, -6
	bl	labs
	mov	w4, w0
	mov	w2, w21
	mov	w3, w22
	mov	x1, x20
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	mov	x1, 4
	mov	x0, x1
	bl	calloc
	ldr	w1, [x0, 12]
	mov	x20, x0
	adrp	x21, .LC16
	add	x0, x21, :lo12:.LC16
	bl	printf
	mov	x0, x20
	mov	x1, 32
	bl	realloc
	mov	x20, x0
	mov	w1, 9
	str	w1, [x0, 28]
	add	x0, x21, :lo12:.LC16
	bl	printf
	mov	x0, x20
	bl	free
	bl	__ctype_toupper_loc
	ldr	x0, [x0]
	ldr	w20, [x0, 388]
	bl	__ctype_tolower_loc
	ldr	x0, [x0]
	ldr	w21, [x0, 324]
	bl	__ctype_b_loc
	ldr	x0, [x0]
	mov	w1, w20
	mov	w2, w21
	ldrh	w3, [x0, 110]
	ldrh	w5, [x0, 64]
	adrp	x0, .LC17
	and	w4, w3, 1024
	add	x0, x0, :lo12:.LC17
	and	w5, w5, 8192
	and	w3, w3, 2048
	bl	printf
	mov	x0, 25185
	mov	x2, 5
	movk	x0, 0x6463, lsl 16
	add	x1, sp, 56
	movk	x0, 0x6665, lsl 32
	str	x0, [sp, 56]
	add	x0, sp, 57
	bl	memmove
	add	x1, sp, 56
	add	x0, x19, :lo12:.LC10
	bl	printf
	adrp	x19, .LC18
	add	x0, sp, 160
	add	x1, x19, :lo12:.LC18
	bl	strtok
	mov	x20, x0
	add	x1, x19, :lo12:.LC18
	mov	x0, 0
	adrp	x19, stdout
	bl	strtok
	mov	x1, x20
	mov	x2, x0
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	printf
	ldr	x1, [x19, :lo12:stdout]
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	fputs
	ldr	x0, [x19, :lo12:stdout]
	bl	fflush
	adrp	x0, stdin
	mov	w1, 32
	ldr	x2, [x0, :lo12:stdin]
	add	x0, sp, 64
	bl	fgets
	cbz	x0, .L2
	adrp	x0, .LC21
	add	x1, sp, 64
	add	x0, x0, :lo12:.LC21
	bl	printf
.L2:
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	puts
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 224
	ret

