	.text
	.data
	.align	3
inputs:
	.quad	0
	.quad	1
	.quad	-1
	.quad	127
	.quad	128
	.quad	255
	.quad	256
	.quad	-128
	.quad	-129
	.quad	32767
	.quad	32768
	.quad	65535
	.quad	65536
	.quad	2147483647
	.quad	2147483648
	.quad	-2147483648
	.quad	-2147483649
	.quad	4294967295
	.quad	4294967296
	.quad	9223372036854775807
	.quad	-9223372036854775808
	.quad	1311768467463790320
	.text
	.align	2
widen_sc:
	sub	sp, sp, #16
	strb	w0, [sp, 15]
	ldrsb	x0, [sp, 15]
	add	sp, sp, 16
	ret
	.align	2
widen_uc:
	sub	sp, sp, #16
	strb	w0, [sp, 15]
	ldrb	w0, [sp, 15]
	add	sp, sp, 16
	ret
	.align	2
widen_ss:
	sub	sp, sp, #16
	strh	w0, [sp, 14]
	ldrsh	x0, [sp, 14]
	add	sp, sp, 16
	ret
	.align	2
widen_us:
	sub	sp, sp, #16
	strh	w0, [sp, 14]
	ldrh	w0, [sp, 14]
	add	sp, sp, 16
	ret
	.align	2
widen_int_to_ul:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldrsw	x0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
widen_uint_to_l:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
narrow_ret:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	sxtb	w0, w0
	add	sp, sp, 16
	ret
	.data
	.align	3
sb:
	.byte 128, 255, 0, 1, 127
	.align	3
ub:
	.byte 0, 1, 127, 128, 255
	.align	3
sh:
	.hword	-32768
	.hword	-1
	.hword	0
	.hword	1
	.hword	32767
	.align	3
uh:
	.hword	0
	.hword	1
	.hword	32767
	.hword	-32768
	.hword	-1
	.align	3
si:
	.word	-2147483648
	.word	-1
	.word	0
	.word	1
	.word	2147483647
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
	.global	main
main:
	sub	sp, sp, #192
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x19, x20, [sp, 32]
	stp	x21, x22, [sp, 48]
	stp	x23, x24, [sp, 64]
	stp	x25, x26, [sp, 80]
	mov	w0, 22
	str	w0, [sp, 160]
	mov	w3, 255
	mov	w2, 0
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	str	wzr, [sp, 188]
	b	.L16
.L17:
	adrp	x0, inputs
	add	x0, x0, :lo12:inputs
	ldrsw	x1, [sp, 188]
	ldr	x0, [x0, x1, lsl 3]
	str	x0, [sp, 144]
	ldr	x0, [sp, 144]
	sxtb	w0, w0
	ldr	x1, [sp, 144]
	and	w1, w1, 255
	ldr	x2, [sp, 144]
	and	w2, w2, 255
	ldr	x3, [sp, 144]
	sxth	w3, w3
	ldr	x4, [sp, 144]
	and	w4, w4, 65535
	ldr	x5, [sp, 144]
	ldr	x6, [sp, 144]
	str	w6, [sp]
	mov	w7, w5
	mov	w6, w4
	mov	w5, w3
	mov	w4, w2
	mov	w3, w1
	mov	w2, w0
	ldr	x1, [sp, 144]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	x0, [sp, 144]
	sxtw	x19, w0
	ldr	x0, [sp, 144]
	uxtw	x20, w0
	ldr	x0, [sp, 144]
	sxtb	w0, w0
	bl	widen_sc
	mov	x21, x0
	ldr	x0, [sp, 144]
	and	w0, w0, 255
	bl	widen_uc
	mov	x22, x0
	ldr	x0, [sp, 144]
	sxth	w0, w0
	bl	widen_ss
	mov	x23, x0
	ldr	x0, [sp, 144]
	and	w0, w0, 65535
	bl	widen_us
	mov	x24, x0
	ldr	x0, [sp, 144]
	bl	widen_int_to_ul
	mov	x25, x0
	ldr	x0, [sp, 144]
	bl	widen_uint_to_l
	mov	x26, x0
	ldr	x0, [sp, 144]
	bl	narrow_ret
	sxtb	w0, w0
	str	w0, [sp, 8]
	str	x26, [sp]
	mov	x7, x25
	mov	x6, x24
	mov	x5, x23
	mov	x4, x22
	mov	x3, x21
	mov	x2, x20
	mov	x1, x19
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w0, [sp, 188]
	add	w0, w0, 1
	str	w0, [sp, 188]
.L16:
	ldr	w1, [sp, 188]
	ldr	w0, [sp, 160]
	cmp	w1, w0
	blt	.L17
	str	xzr, [sp, 176]
	str	wzr, [sp, 172]
	b	.L18
.L19:
	ldr	x1, [sp, 176]
	mov	x0, x1
	lsl	x0, x0, 3
	sub	x1, x0, x1
	adrp	x0, sb
	add	x2, x0, :lo12:sb
	ldrsw	x0, [sp, 172]
	ldrsb	w0, [x2, x0]
	sxtb	x0, w0
	add	x1, x1, x0
	adrp	x0, ub
	add	x2, x0, :lo12:ub
	ldrsw	x0, [sp, 172]
	ldrb	w0, [x2, x0]
	and	x0, x0, 255
	add	x1, x1, x0
	adrp	x0, sh
	add	x0, x0, :lo12:sh
	ldrsw	x2, [sp, 172]
	ldrsh	w0, [x0, x2, lsl 1]
	sxth	x0, w0
	add	x1, x1, x0
	adrp	x0, uh
	add	x0, x0, :lo12:uh
	ldrsw	x2, [sp, 172]
	ldrh	w0, [x0, x2, lsl 1]
	and	x0, x0, 65535
	add	x1, x1, x0
	adrp	x0, si
	add	x0, x0, :lo12:si
	ldrsw	x2, [sp, 172]
	ldr	w0, [x0, x2, lsl 2]
	sxtw	x0, w0
	add	x0, x1, x0
	str	x0, [sp, 176]
	ldr	w0, [sp, 172]
	add	w0, w0, 1
	str	w0, [sp, 172]
.L18:
	ldr	w0, [sp, 172]
	cmp	w0, 4
	ble	.L19
	ldr	x1, [sp, 176]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, -1
	str	w0, [sp, 140]
	mov	w0, 1
	str	w0, [sp, 136]
	str	wzr, [sp, 132]
	mov	w0, 1
	str	w0, [sp, 128]
	mov	x0, -1
	str	x0, [sp, 120]
	mov	x0, 1
	str	x0, [sp, 112]
	ldr	w0, [sp, 140]
	mov	w1, w0
	ldr	w0, [sp, 132]
	cmp	w1, w0
	cset	w0, cc
	and	w0, w0, 255
	mov	w7, w0
	ldr	w0, [sp, 140]
	sxtw	x1, w0
	ldr	w0, [sp, 132]
	uxtw	x0, w0
	cmp	x1, x0
	cset	w0, lt
	and	w0, w0, 255
	mov	w2, w0
	ldr	w0, [sp, 128]
	uxtw	x1, w0
	ldr	x0, [sp, 120]
	cmp	x1, x0
	cset	w0, gt
	and	w0, w0, 255
	mov	w3, w0
	ldr	w1, [sp, 140]
	ldr	w0, [sp, 136]
	cmp	w1, w0
	cset	w0, lt
	and	w0, w0, 255
	mov	w4, w0
	ldr	x0, [sp, 120]
	mov	x1, x0
	ldr	x0, [sp, 112]
	cmp	x1, x0
	cset	w0, cc
	and	w0, w0, 255
	mov	w5, w0
	ldr	w0, [sp, 140]
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 136]
	cmp	w1, w0
	cset	w0, gt
	and	w0, w0, 255
	mov	w6, w0
	mov	w1, w7
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [sp, 128]
	uxtw	x1, w0
	ldr	x0, [sp, 120]
	add	x0, x1, x0
	sub	x6, x0, #1
	ldr	w0, [sp, 140]
	sxtw	x1, w0
	ldr	x0, [sp, 112]
	add	x0, x1, x0
	sub	x2, x0, #1
	ldr	w1, [sp, 132]
	ldr	w0, [sp, 128]
	sub	w3, w1, w0
	ldr	w1, [sp, 132]
	ldr	w0, [sp, 128]
	sub	w0, w1, w0
	mov	w4, w0
	ldr	w1, [sp, 132]
	ldr	w0, [sp, 128]
	sub	w0, w1, w0
	uxtw	x0, w0
	mov	x5, x0
	mov	x1, x6
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	w0, -56
	strb	w0, [sp, 111]
	mov	w0, 100
	strb	w0, [sp, 110]
	mov	w0, -1
	strh	w0, [sp, 108]
	mov	w0, -1
	strh	w0, [sp, 106]
	ldrb	w0, [sp, 111]
	mov	w1, w0
	ldrb	w0, [sp, 110]
	add	w6, w1, w0
	ldrb	w1, [sp, 111]
	ldrb	w0, [sp, 110]
	add	w0, w1, w0
	and	w0, w0, 255
	mov	w7, w0
	ldrb	w0, [sp, 110]
	mov	w1, w0
	ldrb	w0, [sp, 111]
	sub	w2, w1, w0
	ldrh	w0, [sp, 108]
	mov	w1, w0
	ldrh	w0, [sp, 106]
	mul	w3, w1, w0
	ldrh	w1, [sp, 108]
	ldrh	w0, [sp, 106]
	add	w0, w1, w0
	and	w0, w0, 65535
	mov	w5, w0
	mov	w4, w3
	mov	w3, w2
	mov	w2, w7
	mov	w1, w6
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	str	wzr, [sp, 168]
	str	wzr, [sp, 164]
	b	.L20
.L21:
	adrp	x0, inputs
	add	x0, x0, :lo12:inputs
	ldrsw	x1, [sp, 164]
	ldr	x0, [x0, x1, lsl 3]
	str	x0, [sp, 152]
	ldr	x0, [sp, 152]
	sxtw	x0, w0
	ldr	x1, [sp, 152]
	cmp	x1, x0
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 168]
	add	w0, w0, w1
	str	w0, [sp, 168]
	ldr	x0, [sp, 152]
	uxtw	x0, w0
	ldr	x1, [sp, 152]
	cmp	x1, x0
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 168]
	add	w0, w0, w1
	str	w0, [sp, 168]
	ldr	x0, [sp, 152]
	sxth	w0, w0
	sxth	x0, w0
	ldr	x1, [sp, 152]
	cmp	x1, x0
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 168]
	add	w0, w0, w1
	str	w0, [sp, 168]
	ldr	w0, [sp, 164]
	add	w0, w0, 1
	str	w0, [sp, 164]
.L20:
	ldr	w1, [sp, 164]
	ldr	w0, [sp, 160]
	cmp	w1, w0
	blt	.L21
	ldr	w1, [sp, 168]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 16]
	ldp	x19, x20, [sp, 32]
	ldp	x21, x22, [sp, 48]
	ldp	x23, x24, [sp, 64]
	ldp	x25, x26, [sp, 80]
	add	sp, sp, 192
	ret

