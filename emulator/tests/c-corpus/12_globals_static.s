	.text
	.global	counter
	.data
	.align	2
counter:
	.word	5
	.global	zeros
	.bss
	.align	3
zeros:
	.zero	64
	.section .rodata
	.align	3
squares:
	.word	0
	.word	1
	.word	4
	.word	9
	.word	16
	.word	25
	.word	36
	.word	49
	.word	64
	.word	81
	.global	greeting
	.align	3
greeting:
	.string	"hi from rodata"
	.global	name
	.data
	.align	3
name:
	.string	"abc"
	.zero	4
	.text
	.align	2
	.global	next_id
next_id:
	adrp	x0, id__0
	add	x0, x0, :lo12:id__0
	ldr	w0, [x0]
	add	w2, w0, 1
	adrp	x1, id__0
	add	x1, x1, :lo12:id__0
	str	w2, [x1]
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%d %ld %d %d\n"
	.align	3
.LC1:
	.string	"%s %s\n"
	.align	3
.LC2:
	.string	"%s %d %d %d %d\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	str	x21, [sp, 32]
	str	wzr, [sp, 60]
	b	.L4
.L7:
	ldr	w0, [sp, 60]
	and	w0, w0, 1
	cmp	w0, 0
	bne	.L5
	ldr	w2, [sp, 60]
	b	.L6
.L5:
	mov	w2, 0
.L6:
	adrp	x0, zeros
	add	x0, x0, :lo12:zeros
	ldrsw	x1, [sp, 60]
	str	w2, [x0, x1, lsl 2]
	ldr	w0, [sp, 60]
	add	w0, w0, 1
	str	w0, [sp, 60]
.L4:
	ldr	w0, [sp, 60]
	cmp	w0, 15
	ble	.L7
	str	wzr, [sp, 56]
	b	.L8
.L9:
	adrp	x0, zeros
	add	x0, x0, :lo12:zeros
	ldrsw	x1, [sp, 56]
	ldr	w0, [x0, x1, lsl 2]
	sxtw	x1, w0
	adrp	x0, acc
	add	x0, x0, :lo12:acc
	ldr	x0, [x0]
	add	x1, x1, x0
	adrp	x0, acc
	add	x0, x0, :lo12:acc
	str	x1, [x0]
	ldr	w0, [sp, 56]
	add	w0, w0, 1
	str	w0, [sp, 56]
.L8:
	ldr	w0, [sp, 56]
	cmp	w0, 15
	ble	.L9
	adrp	x0, counter
	add	x0, x0, :lo12:counter
	ldr	w1, [x0]
	adrp	x0, acc
	add	x0, x0, :lo12:acc
	ldr	x0, [x0]
	mov	w2, 49
	mov	w4, 10
	mov	w3, w2
	mov	x2, x0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	adrp	x0, name
	add	x2, x0, :lo12:name
	adrp	x0, greeting
	add	x1, x0, :lo12:greeting
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	adrp	x0, name
	add	x0, x0, :lo12:name
	mov	w1, 120
	strb	w1, [x0]
	adrp	x0, counter
	add	x0, x0, :lo12:counter
	ldr	w1, [x0]
	mov	w0, w1
	lsl	w0, w0, 1
	add	w1, w0, w1
	adrp	x0, counter
	add	x0, x0, :lo12:counter
	str	w1, [x0]
	adrp	x0, counter
	add	x0, x0, :lo12:counter
	ldr	w19, [x0]
	bl	next_id
	mov	w20, w0
	bl	next_id
	mov	w21, w0
	bl	next_id
	mov	w5, w0
	mov	w4, w21
	mov	w3, w20
	mov	w2, w19
	adrp	x0, name
	add	x1, x0, :lo12:name
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldr	x21, [sp, 32]
	ldp	x29, x30, [sp], 64
	ret
	.data
	.align	2
id__0:
	.word	100


	.bss
	.balign 8
acc:
	.skip 8
