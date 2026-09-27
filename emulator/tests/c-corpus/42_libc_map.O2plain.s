	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%s %s %d %d\n"
	.align	3
.LC1:
	.string	"cde"
	.align	3
.LC2:
	.string	"%s %s\n"
	.align	3
.LC3:
	.string	"x"
	.align	3
.LC4:
	.string	"%d-%s"
	.align	3
.LC5:
	.string	"toolong"
	.align	3
.LC6:
	.string	"%s"
	.align	3
.LC7:
	.string	"  -123xyz"
	.align	3
.LC8:
	.string	"12abc"
	.align	3
.LC9:
	.string	"%ld %d %d %d\n"
	.align	3
.LC10:
	.string	"%d\n"
	.align	3
.LC11:
	.string	"%c %c %d %d %d\n"
	.align	3
.LC12:
	.string	"c"
	.align	3
.LC13:
	.string	"%s|%s\n"
	.align	3
.LC14:
	.string	"fputs line\n"
	.align	3
.LC15:
	.string	"got %s"
	.align	3
.LC16:
	.string	"puts line"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -208]!
	mov	x0, 25185
	movk	x0, 0x63, lsl 16
	mov	x29, sp
	mov	x1, 0
	stp	x0, x1, [sp, 144]
	mov	w0, 25956
	movk	w0, 0x66, lsl 16
	add	x1, sp, 144
	mov	x2, 3
	stp	x19, x20, [sp, 16]
	str	w0, [sp, 147]
	add	x0, sp, 80
	stp	xzr, xzr, [sp, 160]
	stp	xzr, xzr, [sp, 176]
	stp	xzr, xzr, [sp, 192]
	bl	strncpy
	add	x2, sp, 80
	mov	w4, -1
	mov	w3, 0
	add	x1, sp, 144
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	strb	wzr, [sp, 83]
	bl	printf
	mov	w1, 100
	add	x0, sp, 144
	bl	strchr
	mov	x19, x0
	adrp	x1, .LC1
	add	x0, sp, 144
	add	x1, x1, :lo12:.LC1
	bl	strstr
	mov	x1, x19
	mov	x2, x0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	adrp	x3, .LC3
	adrp	x1, .LC4
	add	x3, x3, :lo12:.LC3
	add	x1, x1, :lo12:.LC4
	mov	w2, 42
	add	x0, sp, 80
	bl	sprintf
	add	x0, sp, 80
	bl	puts
	adrp	x3, .LC5
	adrp	x2, .LC6
	add	x3, x3, :lo12:.LC5
	add	x2, x2, :lo12:.LC6
	mov	x1, 4
	add	x0, sp, 80
	bl	snprintf
	add	x0, sp, 80
	bl	puts
	mov	w2, 10
	mov	x1, 0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl strtol
	mov	x19, x0
	mov	w2, 10
	mov	x1, 0
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl strtol
	mov	w2, w0
	mov	w4, 6
	mov	w3, 5
	mov	x1, x19
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	mov	x1, 4
	mov	x0, x1
	bl	calloc
	ldr	w1, [x0, 12]
	mov	x20, x0
	adrp	x19, .LC10
	add	x0, x19, :lo12:.LC10
	bl	printf
	mov	x0, x20
	mov	x1, 32
	bl	realloc
	mov	x20, x0
	mov	w1, 9
	add	x0, x19, :lo12:.LC10
	bl	printf
	mov	x0, x20
	bl	free
	bl	__ctype_toupper_loc
	ldr	x0, [x0]
	ldr	w19, [x0, 388]
	bl	__ctype_tolower_loc
	ldr	x0, [x0]
	ldr	w20, [x0, 324]
	bl	__ctype_b_loc
	ldr	x0, [x0]
	mov	w2, w20
	mov	w1, w19
	ldrh	w3, [x0, 110]
	ldrh	w5, [x0, 64]
	adrp	x0, .LC11
	and	w4, w3, 1024
	add	x0, x0, :lo12:.LC11
	and	w5, w5, 8192
	and	w3, w3, 2048
	bl	printf
	mov	x0, 25185
	movk	x0, 0x6463, lsl 16
	movk	x0, 0x6665, lsl 32
	str	x0, [sp, 40]
	str	w0, [sp, 41]
	mov	w0, 101
	strb	w0, [sp, 45]
	add	x0, sp, 40
	bl	puts
	adrp	x1, .LC12
	add	x20, x1, :lo12:.LC12
	mov	x1, x20
	add	x0, sp, 144
	bl	strtok
	mov	x19, x0
	mov	x1, x20
	mov	x0, 0
	bl	strtok
	mov	x2, x0
	mov	x1, x19
	adrp	x19, stdout
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	ldr	x3, [x19, :lo12:stdout]
	mov	x2, 11
	mov	x1, 1
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	fwrite
	ldr	x0, [x19, :lo12:stdout]
	bl	fflush
	adrp	x0, stdin
	mov	w1, 32
	ldr	x2, [x0, :lo12:stdin]
	add	x0, sp, 48
	bl	fgets
	cbz	x0, .L2
	adrp	x0, .LC15
	add	x1, sp, 48
	add	x0, x0, :lo12:.LC15
	bl	printf
.L2:
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	puts
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 208
	ret

