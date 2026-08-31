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
	.global	main
main:
	stp	x29, x30, [sp, -240]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	mov	x0, 25185
	movk	x0, 0x63, lsl 16
	mov	x1, 0
	stp	x0, x1, [sp, 96]
	stp	xzr, xzr, [sp, 112]
	stp	xzr, xzr, [sp, 128]
	stp	xzr, xzr, [sp, 144]
	add	x2, sp, 96
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	mov	x0, x2
	bl	strcat
	add	x1, sp, 96
	add	x0, sp, 160
	mov	x2, 3
	bl	strncpy
	strb	wzr, [sp, 163]
	mov	x2, 3
	adrp	x0, .LC1
	add	x1, x0, :lo12:.LC1
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	strncmp
	mov	w19, w0
	mov	x2, 2
	adrp	x0, .LC3
	add	x1, x0, :lo12:.LC3
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	memcmp
	mov	w2, w0
	add	x1, sp, 160
	add	x0, sp, 96
	mov	w4, w2
	mov	w3, w19
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	add	x0, sp, 96
	mov	w1, 100
	bl	strchr
	mov	x19, x0
	add	x2, sp, 96
	adrp	x0, .LC6
	add	x1, x0, :lo12:.LC6
	mov	x0, x2
	bl	strstr
	mov	x2, x0
	mov	x1, x19
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	add	x4, sp, 160
	adrp	x0, .LC8
	add	x3, x0, :lo12:.LC8
	mov	w2, 42
	adrp	x0, .LC9
	add	x1, x0, :lo12:.LC9
	mov	x0, x4
	bl	sprintf
	add	x0, sp, 160
	mov	x1, x0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	add	x4, sp, 160
	adrp	x0, .LC11
	add	x3, x0, :lo12:.LC11
	adrp	x0, .LC12
	add	x2, x0, :lo12:.LC12
	mov	x1, 4
	mov	x0, x4
	bl	snprintf
	add	x0, sp, 160
	mov	x1, x0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	mov	w2, 10
	mov	x1, 0
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl strtol
	mov	x19, x0
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	atoi
	mov	w20, w0
	mov	w0, -5
	bl	abs
	mov	w21, w0
	mov	x0, -6
	bl	labs
	mov	w4, w0
	mov	w3, w21
	mov	w2, w20
	mov	x1, x19
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	mov	x1, 4
	mov	x0, 4
	bl	calloc
	str	x0, [sp, 232]
	ldr	x0, [sp, 232]
	add	x0, x0, 12
	ldr	w0, [x0]
	mov	w1, w0
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	mov	x1, 32
	ldr	x0, [sp, 232]
	bl	realloc
	str	x0, [sp, 232]
	ldr	x0, [sp, 232]
	add	x0, x0, 28
	mov	w1, 9
	str	w1, [x0]
	ldr	x0, [sp, 232]
	add	x0, x0, 28
	ldr	w0, [x0]
	mov	w1, w0
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	ldr	x0, [sp, 232]
	bl	free
	mov	w0, 97
	bl	toupper
	mov	w21, w0
	mov	w0, 81
	bl	tolower
	mov	w22, w0
	bl	__ctype_b_loc
	ldr	x0, [x0]
	add	x0, x0, 110
	ldrh	w0, [x0]
	and	w19, w0, 2048
	bl	__ctype_b_loc
	ldr	x0, [x0]
	add	x0, x0, 110
	ldrh	w0, [x0]
	and	w20, w0, 1024
	bl	__ctype_b_loc
	ldr	x0, [x0]
	add	x0, x0, 64
	ldrh	w0, [x0]
	and	w0, w0, 8192
	mov	w5, w0
	mov	w4, w20
	mov	w3, w19
	mov	w2, w22
	mov	w1, w21
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	mov	x0, 25185
	movk	x0, 0x6463, lsl 16
	movk	x0, 0x6665, lsl 32
	str	x0, [sp, 88]
	add	x0, sp, 88
	add	x0, x0, 1
	add	x1, sp, 88
	mov	x2, 5
	bl	memmove
	add	x0, sp, 88
	mov	x1, x0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	add	x2, sp, 96
	adrp	x0, .LC18
	add	x1, x0, :lo12:.LC18
	mov	x0, x2
	bl	strtok
	str	x0, [sp, 224]
	adrp	x0, .LC18
	add	x1, x0, :lo12:.LC18
	mov	x0, 0
	bl	strtok
	mov	x2, x0
	ldr	x1, [sp, 224]
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	printf
	adrp	x0, stdout
	add	x0, x0, :lo12:stdout
	ldr	x0, [x0]
	mov	x1, x0
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	fputs
	adrp	x0, stdout
	add	x0, x0, :lo12:stdout
	ldr	x0, [x0]
	bl	fflush
	adrp	x0, stdin
	add	x0, x0, :lo12:stdin
	ldr	x1, [x0]
	add	x0, sp, 56
	mov	x2, x1
	mov	w1, 32
	bl	fgets
	cmp	x0, 0
	beq	.L2
	add	x0, sp, 56
	mov	x1, x0
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	printf
.L2:
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	puts
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x29, x30, [sp], 240
	ret

