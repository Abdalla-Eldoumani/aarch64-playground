	.text
	.section .rodata
	.align	3
.LC0:
	.string	"nonnull"
	.align	3
.LC1:
	.string	"null"
	.align	3
.LC2:
	.string	"m0 %s\n"
	.align	3
.LC3:
	.string	"big %ld\n"
	.align	3
.LC4:
	.string	"c15=%d\n"
	.align	3
.LC5:
	.string	"nine char"
	.align	3
.LC6:
	.string	"%s %d\n"
	.align	3
.LC7:
	.string	"ok=%d\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #896
	stp	x29, x30, [sp]
	mov	x29, sp
	mov	x0, 0
	bl	malloc
	str	x0, [sp, 856]
	ldr	x0, [sp, 856]
	cmp	x0, 0
	beq	.L2
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	b	.L3
.L2:
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
.L3:
	mov	x1, x0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	x0, 1048576
	bl	malloc
	str	x0, [sp, 848]
	mov	x2, 1048576
	mov	w1, 7
	ldr	x0, [sp, 848]
	bl	memset
	str	xzr, [sp, 888]
	str	wzr, [sp, 884]
	b	.L4
.L5:
	ldrsw	x0, [sp, 884]
	ldr	x1, [sp, 848]
	add	x0, x1, x0
	ldrb	w0, [x0]
	and	x0, x0, 255
	ldr	x1, [sp, 888]
	add	x0, x1, x0
	str	x0, [sp, 888]
	ldr	w0, [sp, 884]
	add	w0, w0, 4096
	str	w0, [sp, 884]
.L4:
	ldr	w1, [sp, 884]
	mov	w0, 1048575
	cmp	w1, w0
	ble	.L5
	ldr	x1, [sp, 888]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	x0, 64
	bl	malloc
	str	x0, [sp, 840]
	str	wzr, [sp, 880]
	b	.L6
.L7:
	ldrsw	x0, [sp, 880]
	lsl	x0, x0, 2
	ldr	x1, [sp, 840]
	add	x1, x1, x0
	ldr	w0, [sp, 880]
	mul	w0, w0, w0
	str	w0, [x1]
	ldr	w0, [sp, 880]
	add	w0, w0, 1
	str	w0, [sp, 880]
.L6:
	ldr	w0, [sp, 880]
	cmp	w0, 15
	ble	.L7
	ldr	x0, [sp, 848]
	bl	free
	mov	x0, 64
	bl	malloc
	str	x0, [sp, 832]
	str	wzr, [sp, 876]
	b	.L8
.L9:
	ldrsw	x0, [sp, 876]
	lsl	x0, x0, 2
	ldr	x1, [sp, 832]
	add	x0, x1, x0
	str	wzr, [x0]
	ldr	w0, [sp, 876]
	add	w0, w0, 1
	str	w0, [sp, 876]
.L8:
	ldr	w0, [sp, 876]
	cmp	w0, 15
	ble	.L9
	ldr	x0, [sp, 840]
	add	x0, x0, 60
	ldr	w0, [x0]
	mov	w1, w0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	x0, [sp, 840]
	bl	free
	ldr	x0, [sp, 832]
	bl	free
	mov	x0, 0
	bl	free
	mov	x0, 10
	bl	malloc
	str	x0, [sp, 824]
	adrp	x0, .LC5
	add	x1, x0, :lo12:.LC5
	ldr	x0, [sp, 824]
	bl	strcpy
	ldr	x0, [sp, 824]
	bl	strlen
	mov	w2, w0
	ldr	x1, [sp, 824]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	x0, [sp, 824]
	bl	free
	str	wzr, [sp, 872]
	b	.L10
.L11:
	ldr	w0, [sp, 872]
	add	w0, w0, 100
	sxtw	x0, w0
	bl	malloc
	mov	x2, x0
	ldrsw	x0, [sp, 872]
	lsl	x0, x0, 3
	add	x1, sp, 24
	str	x2, [x1, x0]
	ldrsw	x0, [sp, 872]
	lsl	x0, x0, 3
	add	x1, sp, 24
	ldr	x3, [x1, x0]
	ldr	w0, [sp, 872]
	add	w0, w0, 100
	sxtw	x0, w0
	mov	x2, x0
	ldr	w1, [sp, 872]
	mov	x0, x3
	bl	memset
	ldr	w0, [sp, 872]
	add	w0, w0, 1
	str	w0, [sp, 872]
.L10:
	ldr	w0, [sp, 872]
	cmp	w0, 99
	ble	.L11
	mov	w0, 1
	str	w0, [sp, 868]
	str	wzr, [sp, 864]
	b	.L12
.L14:
	ldrsw	x0, [sp, 864]
	lsl	x0, x0, 3
	add	x1, sp, 24
	ldr	x0, [x1, x0]
	add	x0, x0, 99
	ldrb	w0, [x0]
	mov	w1, w0
	ldr	w0, [sp, 864]
	cmp	w0, w1
	beq	.L13
	str	wzr, [sp, 868]
.L13:
	ldrsw	x0, [sp, 864]
	lsl	x0, x0, 3
	add	x1, sp, 24
	ldr	x0, [x1, x0]
	bl	free
	ldr	w0, [sp, 864]
	add	w0, w0, 1
	str	w0, [sp, 864]
.L12:
	ldr	w0, [sp, 864]
	cmp	w0, 99
	ble	.L14
	ldr	w1, [sp, 868]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp]
	add	sp, sp, 896
	ret

