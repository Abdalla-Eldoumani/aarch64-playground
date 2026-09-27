	.text
	.align	2
	.p2align 5,,15
widen_sc:
	sxtb	x0, w0
	ret
	.align	2
	.p2align 5,,15
widen_uc:
	and	x0, x0, 255
	ret
	.align	2
	.p2align 5,,15
widen_ss:
	sxth	x0, w0
	ret
	.align	2
	.p2align 5,,15
widen_us:
	and	x0, x0, 65535
	ret
	.align	2
	.p2align 5,,15
widen_int_to_ul:
	sxtw	x0, w0
	ret
	.align	2
	.p2align 5,,15
widen_uint_to_l:
	uxtw	x0, w0
	ret
	.align	2
	.p2align 5,,15
narrow_ret:
	ret
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
	sub	sp, sp, #160
	mov	w3, 255
	mov	w2, 0
	adrp	x1, .LC0
	adrp	x0, .LC1
	add	x1, x1, :lo12:.LC0
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	add	x0, x0, :lo12:.LC1
	stp	x23, x24, [sp, 64]
	adrp	x24, .LC2
	adrp	x23, .LC3
	add	x24, x24, :lo12:.LC2
	add	x23, x23, :lo12:.LC3
	str	x27, [sp, 96]
	adrp	x27, .LANCHOR0
	add	x27, x27, :lo12:.LANCHOR0
	stp	x19, x20, [sp, 32]
	mov	w20, 0
	bl	printf
	.p2align 5,,15
.L10:
	ldr	x19, [x27, w20, sxtw 3]
	str	w19, [sp]
	mov	x0, x24
	add	w20, w20, 1
	mov	w7, w19
	and	w6, w19, 65535
	sxth	w5, w19
	and	w4, w19, 255
	and	w3, w19, 255
	sxtb	w2, w19
	mov	x1, x19
	bl	printf
	mov	w0, w19
	bl	widen_sc
	mov	x3, x0
	mov	w0, w19
	bl	widen_uc
	mov	x4, x0
	mov	w0, w19
	bl	widen_ss
	mov	x5, x0
	mov	w0, w19
	bl	widen_us
	mov	x6, x0
	mov	w0, w19
	bl	widen_int_to_ul
	mov	x7, x0
	mov	w0, w19
	bl	widen_uint_to_l
	mov	x1, x0
	mov	w0, w19
	bl	narrow_ret
	sxtb	w0, w0
	str	x1, [sp]
	str	w0, [sp, 8]
	uxtw	x2, w19
	sxtw	x1, w19
	mov	x0, x23
	bl	printf
	cmp	w20, 22
	bne	.L10
	add	x10, x27, 176
	add	x9, x27, 184
	add	x8, x27, 192
	add	x7, x27, 208
	add	x6, x27, 224
	mov	w0, 0
	mov	x1, 0
.L11:
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
	bne	.L11
	mov	w19, -1
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	str	w19, [sp, 128]
	mov	w0, 1
	str	w0, [sp, 132]
	str	wzr, [sp, 136]
	str	w0, [sp, 140]
	mov	x0, -1
	str	x0, [sp, 144]
	mov	x0, 1
	str	x0, [sp, 152]
	ldr	w7, [sp, 128]
	ldr	w1, [sp, 136]
	ldr	w2, [sp, 128]
	ldr	w0, [sp, 136]
	ldr	w8, [sp, 140]
	ldr	x3, [sp, 144]
	uxtw	x0, w0
	ldr	w9, [sp, 128]
	ldr	w4, [sp, 132]
	ldr	x10, [sp, 144]
	ldr	x5, [sp, 152]
	ldr	w11, [sp, 128]
	ldr	w6, [sp, 132]
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
	ldr	w1, [sp, 140]
	ldr	x9, [sp, 144]
	ldr	w2, [sp, 128]
	ldr	x0, [sp, 152]
	add	x1, x9, w1, uxtw
	ldr	w6, [sp, 136]
	sub	x1, x1, #1
	ldr	w3, [sp, 140]
	sub	x0, x0, #1
	ldr	w7, [sp, 136]
	add	x2, x0, w2, sxtw
	ldr	w4, [sp, 140]
	sub	w3, w6, w3
	ldr	w8, [sp, 136]
	adrp	x0, .LC6
	ldr	w5, [sp, 140]
	sub	w4, w7, w4
	add	x0, x0, :lo12:.LC6
	sub	w5, w8, w5
	bl	printf
	mov	w0, -56
	strb	w0, [sp, 122]
	mov	w0, 100
	strb	w0, [sp, 123]
	strh	w19, [sp, 124]
	strh	w19, [sp, 126]
	ldrb	w1, [sp, 122]
	ldrb	w0, [sp, 123]
	ldrb	w2, [sp, 122]
	ldrb	w8, [sp, 123]
	add	w1, w1, w0
	ldrb	w6, [sp, 123]
	adrp	x0, .LC7
	ldrb	w3, [sp, 122]
	add	w2, w2, w8
	ldrh	w7, [sp, 124]
	and	w2, w2, 255
	ldrh	w4, [sp, 126]
	sub	w3, w6, w3
	ldrh	w5, [sp, 124]
	add	x0, x0, :lo12:.LC7
	ldrh	w9, [sp, 126]
	mul	w4, w7, w4
	add	w5, w5, w9
	and	w5, w5, 65535
	bl	printf
	mov	w2, 0
	mov	w1, 0
	mov	x3, 4294967295
	.p2align 5,,15
.L12:
	ldr	x0, [x27, w2, sxtw 3]
	add	w2, w2, 1
	cmp	x0, w0, sxtw
	cinc	w1, w1, ne
	cmp	x0, x3
	cinc	w1, w1, hi
	cmp	x0, w0, sxth
	cinc	w1, w1, ne
	cmp	w2, 22
	bne	.L12
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldr	x27, [sp, 96]
	mov	w0, 0
	ldp	x29, x30, [sp, 16]
	ldp	x19, x20, [sp, 32]
	ldp	x23, x24, [sp, 64]
	add	sp, sp, 160
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

