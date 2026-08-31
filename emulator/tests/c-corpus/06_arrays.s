	.text
	.align	2
	.global	bubble
bubble:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	w1, [sp, 4]
	str	wzr, [sp, 28]
	b	.L2
.L6:
	str	wzr, [sp, 24]
	b	.L3
.L5:
	ldrsw	x0, [sp, 24]
	lsl	x0, x0, 2
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	ldr	w1, [x0]
	ldrsw	x0, [sp, 24]
	add	x0, x0, 1
	lsl	x0, x0, 2
	ldr	x2, [sp, 8]
	add	x0, x2, x0
	ldr	w0, [x0]
	cmp	w1, w0
	ble	.L4
	ldrsw	x0, [sp, 24]
	lsl	x0, x0, 2
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	ldr	w0, [x0]
	str	w0, [sp, 20]
	ldrsw	x0, [sp, 24]
	add	x0, x0, 1
	lsl	x0, x0, 2
	ldr	x1, [sp, 8]
	add	x1, x1, x0
	ldrsw	x0, [sp, 24]
	lsl	x0, x0, 2
	ldr	x2, [sp, 8]
	add	x0, x2, x0
	ldr	w1, [x1]
	str	w1, [x0]
	ldrsw	x0, [sp, 24]
	add	x0, x0, 1
	lsl	x0, x0, 2
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	ldr	w1, [sp, 20]
	str	w1, [x0]
.L4:
	ldr	w0, [sp, 24]
	add	w0, w0, 1
	str	w0, [sp, 24]
.L3:
	ldr	w0, [sp, 4]
	sub	w1, w0, #1
	ldr	w0, [sp, 28]
	sub	w0, w1, w0
	ldr	w1, [sp, 24]
	cmp	w1, w0
	blt	.L5
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L2:
	ldr	w0, [sp, 4]
	sub	w0, w0, #1
	ldr	w1, [sp, 28]
	cmp	w1, w0
	blt	.L6
	nop
	nop
	add	sp, sp, 32
	ret
	.section .rodata
	.align	3
.LC5:
	.string	"%d "
	.align	3
.LC6:
	.string	"\n"
	.align	3
.LC7:
	.string	"%d %d %d\n"
	.align	3
.LC9:
	.string	"%s "
	.align	3
.LC10:
	.string	"%ld\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #1040
	stp	x29, x30, [sp]
	mov	x29, sp
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 928
	ldp	x4, x5, [x1]
	ldp	x2, x3, [x1, 16]
	ldr	x1, [x1, 32]
	stp	x4, x5, [x0]
	stp	x2, x3, [x0, 16]
	str	x1, [x0, 32]
	add	x0, sp, 928
	mov	w1, 10
	bl	bubble
	str	wzr, [sp, 1036]
	b	.L8
.L9:
	ldrsw	x0, [sp, 1036]
	lsl	x0, x0, 2
	add	x1, sp, 928
	ldr	w0, [x1, x0]
	mov	w1, w0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [sp, 1036]
	add	w0, w0, 1
	str	w0, [sp, 1036]
.L8:
	ldr	w0, [sp, 1036]
	cmp	w0, 9
	ble	.L9
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	str	wzr, [sp, 1032]
	b	.L10
.L13:
	str	wzr, [sp, 1028]
	b	.L11
.L12:
	ldr	w1, [sp, 1032]
	mov	w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	lsl	w0, w0, 1
	mov	w1, w0
	ldr	w0, [sp, 1028]
	add	w2, w1, w0
	ldrsw	x0, [sp, 1028]
	ldrsw	x1, [sp, 1032]
	lsl	x1, x1, 2
	add	x0, x1, x0
	lsl	x0, x0, 2
	add	x1, sp, 880
	str	w2, [x1, x0]
	ldr	w0, [sp, 1028]
	add	w0, w0, 1
	str	w0, [sp, 1028]
.L11:
	ldr	w0, [sp, 1028]
	cmp	w0, 3
	ble	.L12
	ldr	w0, [sp, 1032]
	add	w0, w0, 1
	str	w0, [sp, 1032]
.L10:
	ldr	w0, [sp, 1032]
	cmp	w0, 2
	ble	.L13
	str	wzr, [sp, 1024]
	str	wzr, [sp, 1020]
	b	.L14
.L15:
	ldrsw	x1, [sp, 1020]
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x1, sp, 880
	ldr	w0, [x1, x0]
	ldr	w1, [sp, 1024]
	add	w0, w1, w0
	str	w0, [sp, 1024]
	ldr	w0, [sp, 1020]
	add	w0, w0, 1
	str	w0, [sp, 1020]
.L14:
	ldr	w0, [sp, 1020]
	cmp	w0, 2
	ble	.L15
	ldr	w0, [sp, 924]
	ldr	w1, [sp, 896]
	ldr	w3, [sp, 1024]
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	mov	w0, 7
	str	w0, [sp, 976]
	str	wzr, [sp, 1016]
	b	.L16
.L17:
	ldr	w0, [sp, 1016]
	mul	w2, w0, w0
	ldrsw	x0, [sp, 1016]
	lsl	x0, x0, 2
	add	x1, sp, 848
	str	w2, [x1, x0]
	ldr	w0, [sp, 1016]
	add	w0, w0, 1
	str	w0, [sp, 1016]
.L16:
	ldr	w1, [sp, 1016]
	ldr	w0, [sp, 976]
	cmp	w1, w0
	blt	.L17
	str	wzr, [sp, 1012]
	ldr	w0, [sp, 976]
	sub	w0, w0, #1
	str	w0, [sp, 1008]
	b	.L18
.L19:
	ldrsw	x0, [sp, 1012]
	lsl	x0, x0, 2
	add	x1, sp, 848
	ldr	w0, [x1, x0]
	str	w0, [sp, 972]
	ldrsw	x0, [sp, 1008]
	lsl	x0, x0, 2
	add	x1, sp, 848
	ldr	w2, [x1, x0]
	ldrsw	x0, [sp, 1012]
	lsl	x0, x0, 2
	add	x1, sp, 848
	str	w2, [x1, x0]
	ldrsw	x0, [sp, 1008]
	lsl	x0, x0, 2
	add	x1, sp, 848
	ldr	w2, [sp, 972]
	str	w2, [x1, x0]
	ldr	w0, [sp, 1012]
	add	w0, w0, 1
	str	w0, [sp, 1012]
	ldr	w0, [sp, 1008]
	sub	w0, w0, #1
	str	w0, [sp, 1008]
.L18:
	ldr	w1, [sp, 1012]
	ldr	w0, [sp, 1008]
	cmp	w1, w0
	blt	.L19
	str	wzr, [sp, 1004]
	b	.L20
.L21:
	ldrsw	x0, [sp, 1004]
	lsl	x0, x0, 2
	add	x1, sp, 848
	ldr	w0, [x1, x0]
	mov	w1, w0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [sp, 1004]
	add	w0, w0, 1
	str	w0, [sp, 1004]
.L20:
	ldr	w1, [sp, 1004]
	ldr	w0, [sp, 976]
	cmp	w1, w0
	blt	.L21
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	adrp	x0, .LC8
	add	x1, x0, :lo12:.LC8
	add	x0, sp, 824
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	mov	w0, 2
	str	w0, [sp, 1000]
	b	.L22
.L23:
	ldrsw	x0, [sp, 1000]
	lsl	x0, x0, 3
	add	x1, sp, 824
	ldr	x0, [x1, x0]
	mov	x1, x0
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	ldr	w0, [sp, 1000]
	sub	w0, w0, #1
	str	w0, [sp, 1000]
.L22:
	ldr	w0, [sp, 1000]
	cmp	w0, 0
	bge	.L23
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	str	wzr, [sp, 996]
	b	.L24
.L25:
	ldrsw	x1, [sp, 996]
	ldrsw	x0, [sp, 996]
	mul	x1, x1, x0
	ldrsw	x0, [sp, 996]
	mul	x2, x1, x0
	ldrsw	x0, [sp, 996]
	lsl	x0, x0, 3
	add	x1, sp, 24
	str	x2, [x1, x0]
	ldr	w0, [sp, 996]
	add	w0, w0, 1
	str	w0, [sp, 996]
.L24:
	ldr	w0, [sp, 996]
	cmp	w0, 99
	ble	.L25
	str	xzr, [sp, 984]
	str	wzr, [sp, 980]
	b	.L26
.L27:
	ldrsw	x0, [sp, 980]
	lsl	x0, x0, 3
	add	x1, sp, 24
	ldr	x0, [x1, x0]
	ldr	x1, [sp, 984]
	add	x0, x1, x0
	str	x0, [sp, 984]
	ldr	w0, [sp, 980]
	add	w0, w0, 7
	str	w0, [sp, 980]
.L26:
	ldr	w0, [sp, 980]
	cmp	w0, 99
	ble	.L27
	ldr	x1, [sp, 984]
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp]
	add	sp, sp, 1040
	ret
	.section .rodata
	.align	3
.LC0:
	.word	9
	.word	3
	.word	7
	.word	1
	.word	8
	.word	2
	.word	6
	.word	5
	.word	4
	.word	0
	.align	3
.LC1:
	.string	"alpha"
	.align	3
.LC2:
	.string	"beta"
	.align	3
.LC3:
	.string	"gamma"
	.align	3
.LC8:
	.quad	.LC1
	.quad	.LC2
	.quad	.LC3
	.text

