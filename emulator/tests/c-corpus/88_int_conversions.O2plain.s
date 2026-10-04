	.text
	.section .rodata
	.align	3
.LC0:
	.string	"unsigned"
	.align	3
.LC1:
	.string	"plain char is %s, CHAR_MIN %d CHAR_MAX %d\n"
	.align	3
.LC2:
	.string	"%ld: sc %d uc %d c %d ss %d us %d i %d u %u\n"
	.align	3
.LC3:
	.string	"  sext %016lx zext %016lx args %ld %ld %ld %ld %lx %ld ret %d\n"
	.align	3
.LC4:
	.string	"width sum %ld\n"
	.align	3
.LC5:
	.string	"cmp %d %d %d %d %d %d\n"
	.align	3
.LC6:
	.string	"mix %ld %lu %u %d %ld\n"
	.align	3
.LC7:
	.string	"promote %d %d %d %u %u\n"
	.align	3
.LC8:
	.string	"lossy round trips %d\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #144
	mov	w3, 255
	mov	w2, 0
	adrp	x1, .LC0
	adrp	x0, .LC1
	add	x1, x1, :lo12:.LC0
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	add	x0, x0, :lo12:.LC1
	stp	x23, x24, [sp, 64]
	adrp	x23, .LANCHOR0
	adrp	x24, .LC3
	add	x23, x23, :lo12:.LANCHOR0
	add	x24, x24, :lo12:.LC3
	str	x25, [sp, 80]
	adrp	x25, .LC2
	add	x25, x25, :lo12:.LC2
	stp	x19, x20, [sp, 32]
	mov	w20, 0
	stp	x21, x22, [sp, 48]
	bl	printf
	.p2align 5,,15
.L2:
	mov	x0, x25
	ldr	x19, [x23, w20, sxtw 3]
	str	w19, [sp]
	add	w20, w20, 1
	and	w4, w19, 255
	mov	w7, w19
	sxtb	w21, w19
	mov	w3, w4
	and	w6, w19, 65535
	sxth	w5, w19
	mov	w2, w21
	mov	x1, x19
	bl	printf
	str	w21, [sp, 8]
	and	x2, x19, 4294967295
	str	x2, [sp]
	sxtw	x7, w19
	and	x6, x19, 65535
	sxth	x5, w19
	and	x4, x19, 255
	sxtw	x3, w21
	mov	x1, x7
	mov	x0, x24
	bl	printf
	cmp	w20, 22
	bne	.L2
	add	x10, x23, 176
	add	x9, x23, 184
	add	x8, x23, 192
	add	x7, x23, 208
	add	x6, x23, 224
	mov	w0, 0
	mov	x1, 0
.L3:
	ldrsb	w4, [x10, w0, sxtw]
	lsl	x5, x1, 3
	ldrb	w3, [x9, w0, sxtw]
	sub	x5, x5, x1
	ldrsh	w2, [x8, w0, sxtw 1]
	add	x4, x5, w4, sxtw
	ldrh	w1, [x7, w0, sxtw 1]
	add	x3, x4, w3, uxtw
	add	x2, x3, w2, sxtw
	add	x2, x2, x1
	ldrsw	x1, [x6, w0, sxtw 2]
	add	w0, w0, 1
	add	x1, x1, x2
	cmp	w0, 5
	bne	.L3
	mov	w19, -1
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	str	w19, [sp, 112]
	mov	w0, 1
	str	w0, [sp, 116]
	str	wzr, [sp, 120]
	str	w0, [sp, 124]
	mov	x0, -1
	str	x0, [sp, 128]
	mov	x0, 1
	str	x0, [sp, 136]
	ldr	w7, [sp, 112]
	ldr	w1, [sp, 120]
	ldr	w2, [sp, 112]
	ldr	w0, [sp, 120]
	ldr	w8, [sp, 124]
	ldr	x3, [sp, 128]
	uxtw	x0, w0
	ldr	w9, [sp, 112]
	ldr	w4, [sp, 116]
	ldr	x10, [sp, 128]
	ldr	x5, [sp, 136]
	ldr	w11, [sp, 112]
	ldr	w6, [sp, 116]
	cmp	w6, w11, uxtb
	cset	w6, lt
	cmp	x10, x5
	cset	w5, cc
	cmp	w9, w4
	cset	w4, lt
	cmp	x3, w8, uxtw
	cset	w3, lt
	cmp	x0, w2, sxtw
	cset	w2, gt
	cmp	w7, w1
	cset	w1, cc
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w1, [sp, 124]
	ldr	x9, [sp, 128]
	ldr	w2, [sp, 112]
	ldr	x0, [sp, 136]
	add	x1, x9, w1, uxtw
	ldr	w6, [sp, 120]
	sub	x1, x1, #1
	ldr	w3, [sp, 124]
	sub	x0, x0, #1
	ldr	w7, [sp, 120]
	add	x2, x0, w2, sxtw
	ldr	w4, [sp, 124]
	sub	w3, w6, w3
	ldr	w8, [sp, 120]
	adrp	x0, .LC6
	ldr	w5, [sp, 124]
	sub	w4, w7, w4
	add	x0, x0, :lo12:.LC6
	sub	w5, w8, w5
	bl	printf
	mov	w0, -56
	strb	w0, [sp, 106]
	mov	w0, 100
	strb	w0, [sp, 107]
	strh	w19, [sp, 108]
	strh	w19, [sp, 110]
	ldrb	w1, [sp, 106]
	ldrb	w0, [sp, 107]
	ldrb	w2, [sp, 106]
	ldrb	w8, [sp, 107]
	add	w1, w1, w0
	ldrb	w6, [sp, 107]
	adrp	x0, .LC7
	ldrb	w3, [sp, 106]
	add	w2, w2, w8
	ldrh	w7, [sp, 108]
	and	w2, w2, 255
	ldrh	w4, [sp, 110]
	sub	w3, w6, w3
	ldrh	w5, [sp, 108]
	add	x0, x0, :lo12:.LC7
	ldrh	w9, [sp, 110]
	mul	w4, w7, w4
	add	w5, w5, w9
	and	w5, w5, 65535
	bl	printf
	mov	w2, 0
	mov	w1, 0
	mov	x3, 4294967295
	.p2align 5,,15
.L4:
	ldr	x0, [x23, w2, sxtw 3]
	add	w2, w2, 1
	cmp	x0, w0, sxtw
	cinc	w1, w1, ne
	cmp	x0, x3
	cinc	w1, w1, hi
	cmp	x0, w0, sxth
	cinc	w1, w1, ne
	cmp	w2, 22
	bne	.L4
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldr	x25, [sp, 80]
	mov	w0, 0
	ldp	x29, x30, [sp, 16]
	ldp	x19, x20, [sp, 32]
	ldp	x21, x22, [sp, 48]
	ldp	x23, x24, [sp, 64]
	add	sp, sp, 144
	ret
	.data
	.align	4
	.LANCHOR0:
inputs:
	.xword	0
	.xword	1
	.xword	-1
	.xword	127
	.xword	128
	.xword	255
	.xword	256
	.xword	-128
	.xword	-129
	.xword	32767
	.xword	32768
	.xword	65535
	.xword	65536
	.xword	2147483647
	.xword	2147483648
	.xword	-2147483648
	.xword	-2147483649
	.xword	4294967295
	.xword	4294967296
	.xword	9223372036854775807
	.xword	-9223372036854775808
	.xword	1311768467463790320
sb:
	.byte 128, 255, 0, 1, 127
	.zero	3
ub:
	.byte 0, 1, 127, 128, 255
	.zero	3
sh:
	.hword	-32768
	.hword	-1
	.hword	0
	.hword	1
	.hword	32767
	.zero	6
uh:
	.hword	0
	.hword	1
	.hword	32767
	.hword	-32768
	.hword	-1
	.zero	6
si:
	.word	-2147483648
	.word	-1
	.word	0
	.word	1
	.word	2147483647

