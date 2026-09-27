	.text
	.data
	.align	2
knob:
	.word	3
	.align	2
deep_levels:
	.word	100
	.text
	.align	2
frame_4k:
	mov	x12, 4144
	sub	sp, sp, x12
	stp	x29, x30, [sp]
	mov	x29, sp
	str	w0, [sp, 28]
	str	xzr, [sp, 4136]
	add	x0, sp, 32
	mov	x2, 4100
	ldr	w1, [sp, 28]
	bl	memset
	mov	w0, 1
	str	w0, [sp, 4132]
	b	.L2
.L3:
	ldr	w0, [sp, 28]
	and	w1, w0, 255
	ldr	w0, [sp, 4132]
	and	w0, w0, 255
	mov	w2, w0
	mov	w0, w2
	ubfiz	w0, w0, 3, 5
	sub	w0, w0, w2
	and	w0, w0, 255
	add	w0, w1, w0
	and	w2, w0, 255
	ldrsw	x0, [sp, 4132]
	add	x1, sp, 32
	strb	w2, [x1, x0]
	ldr	w0, [sp, 4132]
	add	w0, w0, 13
	str	w0, [sp, 4132]
.L2:
	ldr	w1, [sp, 4132]
	mov	w0, 4099
	cmp	w1, w0
	ble	.L3
	add	x0, sp, 4096
	add	x0, x0, 35
	ldrb	w0, [x0]
	eor	w0, w0, 60
	and	w0, w0, 255
	add	x1, sp, 4096
	add	x1, x1, 35
	strb	w0, [x1]
	ldrb	w0, [sp, 2082]
	add	w0, w0, 9
	and	w0, w0, 255
	strb	w0, [sp, 2082]
	str	wzr, [sp, 4132]
	b	.L4
.L5:
	ldr	x1, [sp, 4136]
	mov	x0, x1
	lsl	x0, x0, 5
	sub	x1, x0, x1
	ldrsw	x0, [sp, 4132]
	add	x2, sp, 32
	ldrb	w0, [x2, x0]
	and	x0, x0, 255
	add	x0, x1, x0
	str	x0, [sp, 4136]
	ldr	w0, [sp, 4132]
	add	w0, w0, 5
	str	w0, [sp, 4132]
.L4:
	ldr	w1, [sp, 4132]
	mov	w0, 4099
	cmp	w1, w0
	ble	.L5
	add	x0, sp, 4096
	add	x0, x0, 35
	ldrb	w0, [x0]
	and	x1, x0, 255
	ldr	x0, [sp, 4136]
	add	x0, x1, x0
	ldp	x29, x30, [sp]
	mov	x12, 4144
	add	sp, sp, x12
	ret
	.align	2
frame_40k:
	mov	x12, 40048
	sub	sp, sp, x12
	stp	x29, x30, [sp]
	mov	x29, sp
	str	w0, [sp, 28]
	add	x0, sp, 36864
	add	x0, x0, 3176
	str	xzr, [x0]
	add	x0, sp, 32
	mov	x2, 40000
	mov	w1, 0
	bl	memset
	add	x0, sp, 36864
	add	x0, x0, 3172
	str	wzr, [x0]
	b	.L8
.L9:
	ldrsw	x1, [sp, 28]
	add	x0, sp, 36864
	add	x0, x0, 3172
	ldrsw	x0, [x0]
	mul	x1, x1, x0
	mov	x0, -12241
	movk	x0, 0xfffe, lsl 16
	add	x2, x1, x0
	add	x0, sp, 36864
	add	x0, x0, 3172
	ldrsw	x0, [x0]
	lsl	x0, x0, 3
	add	x1, sp, 32
	str	x2, [x1, x0]
	add	x0, sp, 36864
	add	x0, x0, 3172
	ldr	w0, [x0]
	add	w0, w0, 97
	add	x1, sp, 36864
	add	x1, x1, 3172
	str	w0, [x1]
.L8:
	add	x0, sp, 36864
	add	x0, x0, 3172
	ldr	w1, [x0]
	mov	w0, 4999
	cmp	w1, w0
	ble	.L9
	mov	x0, -1227
	movk	x0, 0x8e04, lsl 16
	movk	x0, 0xfee0, lsl 32
	add	x1, sp, 36864
	add	x1, x1, 3160
	str	x0, [x1]
	add	x0, sp, 36864
	add	x0, x0, 3160
	ldr	x1, [x0]
	ldrsw	x0, [sp, 28]
	sdiv	x0, x1, x0
	str	x0, [sp, 20032]
	add	x0, sp, 36864
	add	x0, x0, 3172
	str	wzr, [x0]
	b	.L10
.L11:
	add	x0, sp, 36864
	add	x0, x0, 3172
	ldrsw	x0, [x0]
	lsl	x0, x0, 3
	add	x1, sp, 32
	ldr	x0, [x1, x0]
	mov	x1, x0
	add	x0, sp, 36864
	add	x0, x0, 3176
	ldr	x0, [x0]
	lsr	x0, x0, 3
	eor	x0, x1, x0
	add	x1, sp, 36864
	add	x1, x1, 3176
	ldr	x1, [x1]
	add	x0, x1, x0
	add	x1, sp, 36864
	add	x1, x1, 3176
	str	x0, [x1]
	add	x0, sp, 36864
	add	x0, x0, 3172
	ldr	w0, [x0]
	add	w0, w0, 7
	add	x1, sp, 36864
	add	x1, x1, 3172
	str	w0, [x1]
.L10:
	add	x0, sp, 36864
	add	x0, x0, 3172
	ldr	w1, [x0]
	mov	w0, 4999
	cmp	w1, w0
	ble	.L11
	add	x0, sp, 36864
	add	x0, x0, 3160
	ldr	x1, [x0]
	ldr	x0, [sp, 20032]
	add	x0, x1, x0
	mov	x1, x0
	add	x0, sp, 36864
	add	x0, x0, 3176
	ldr	x0, [x0]
	add	x0, x1, x0
	ldp	x29, x30, [sp]
	mov	x12, 40048
	add	sp, sp, x12
	ret
	.align	2
frame_72k:
	sub	sp, sp, #2416
	sub	sp, sp, #69632
	stp	x29, x30, [sp]
	mov	x29, sp
	str	w0, [sp, 28]
	add	x0, sp, 69632
	add	x0, x0, 2408
	str	xzr, [x0]
	add	x0, sp, 32
	mov	x2, 6464
	movk	x2, 0x1, lsl 16
	mov	w1, 255
	bl	memset
	add	x0, sp, 69632
	add	x0, x0, 2404
	str	wzr, [x0]
	b	.L14
.L15:
	add	x0, sp, 69632
	add	x0, x0, 2404
	ldr	w1, [x0]
	ldr	w0, [sp, 28]
	eor	w2, w1, w0
	add	x0, sp, 69632
	add	x0, x0, 2404
	ldrsw	x0, [x0]
	lsl	x0, x0, 2
	add	x1, sp, 32
	str	w2, [x1, x0]
	add	x0, sp, 69632
	add	x0, x0, 2404
	ldr	w0, [x0]
	add	w0, w0, 1000
	add	x1, sp, 69632
	add	x1, x1, 2404
	str	w0, [x1]
.L14:
	add	x0, sp, 69632
	add	x0, x0, 2404
	ldr	w1, [x0]
	mov	w0, 17999
	cmp	w1, w0
	ble	.L15
	ldr	w0, [sp, 28]
	lsl	w0, w0, 20
	add	x1, sp, 69632
	add	x1, x1, 2396
	str	w0, [x1]
	add	x0, sp, 69632
	add	x0, x0, 2404
	str	wzr, [x0]
	b	.L16
.L17:
	add	x0, sp, 69632
	add	x0, x0, 2408
	ldr	x1, [x0]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x1, x0, x1
	add	x0, sp, 69632
	add	x0, x0, 2404
	ldrsw	x0, [x0]
	lsl	x0, x0, 2
	add	x2, sp, 32
	ldr	w0, [x2, x0]
	uxtw	x0, w0
	add	x0, x1, x0
	add	x1, sp, 69632
	add	x1, x1, 2408
	str	x0, [x1]
	add	x0, sp, 69632
	add	x0, x0, 2404
	ldr	w0, [x0]
	add	w0, w0, 250
	add	x1, sp, 69632
	add	x1, x1, 2404
	str	w0, [x1]
.L16:
	add	x0, sp, 69632
	add	x0, x0, 2404
	ldr	w1, [x0]
	mov	w0, 17999
	cmp	w1, w0
	ble	.L17
	add	x0, sp, 69632
	add	x0, x0, 2396
	ldr	w0, [x0]
	uxtw	x1, w0
	add	x0, sp, 69632
	add	x0, x0, 2408
	ldr	x0, [x0]
	add	x0, x1, x0
	ldp	x29, x30, [sp]
	add	sp, sp, 2416
	add	sp, sp, 69632
	ret
	.align	2
frame_600k:
	sub	sp, sp, #2032
	sub	sp, sp, #598016
	stp	x29, x30, [sp]
	mov	x29, sp
	str	w0, [sp, 28]
	add	x0, sp, 598016
	add	x0, x0, 2024
	str	xzr, [x0]
	add	x0, sp, 32
	mov	x2, 10176
	movk	x2, 0x9, lsl 16
	ldr	w1, [sp, 28]
	bl	memset
	add	x0, sp, 598016
	add	x0, x0, 2020
	str	wzr, [x0]
	b	.L20
.L21:
	add	x0, sp, 598016
	add	x0, x0, 2020
	ldr	w0, [x0]
	asr	w0, w0, 12
	and	w2, w0, 255
	add	x0, sp, 598016
	add	x0, x0, 2020
	ldrsw	x0, [x0]
	add	x1, sp, 32
	strb	w2, [x1, x0]
	add	x0, sp, 598016
	add	x0, x0, 2020
	ldr	w0, [x0]
	add	w0, w0, 4096
	add	x1, sp, 598016
	add	x1, x1, 2020
	str	w0, [x1]
.L20:
	add	x0, sp, 598016
	add	x0, x0, 2020
	ldr	w1, [x0]
	mov	w0, 10175
	movk	w0, 0x9, lsl 16
	cmp	w1, w0
	ble	.L21
	mov	w0, 119
	add	x1, sp, 598016
	add	x1, x1, 2015
	strb	w0, [x1]
	add	x0, sp, 598016
	add	x0, x0, 2020
	str	wzr, [x0]
	b	.L22
.L23:
	add	x0, sp, 598016
	add	x0, x0, 2024
	ldr	x1, [x0]
	mov	x0, x1
	lsl	x0, x0, 3
	sub	x1, x0, x1
	add	x0, sp, 598016
	add	x0, x0, 2020
	ldrsw	x0, [x0]
	add	x2, sp, 32
	ldrb	w0, [x2, x0]
	and	x0, x0, 255
	add	x0, x1, x0
	add	x1, sp, 598016
	add	x1, x1, 2024
	str	x0, [x1]
	add	x0, sp, 598016
	add	x0, x0, 2020
	ldr	w0, [x0]
	add	w0, w0, 1777
	add	x1, sp, 598016
	add	x1, x1, 2020
	str	w0, [x1]
.L22:
	add	x0, sp, 598016
	add	x0, x0, 2020
	ldr	w1, [x0]
	mov	w0, 10175
	movk	w0, 0x9, lsl 16
	cmp	w1, w0
	ble	.L23
	add	x0, sp, 598016
	add	x0, x0, 2015
	ldrb	w0, [x0]
	and	x1, x0, 255
	add	x0, sp, 598016
	add	x0, x0, 2024
	ldr	x0, [x0]
	add	x1, x1, x0
	add	x0, sp, 299008
	add	x0, x0, 1024
	ldrb	w0, [x0]
	and	x0, x0, 255
	add	x0, x1, x0
	ldp	x29, x30, [sp]
	add	sp, sp, 2032
	add	sp, sp, 598016
	ret
	.align	2
deep8k:
	mov	x12, 8240
	sub	sp, sp, x12
	stp	x29, x30, [sp]
	mov	x29, sp
	str	w0, [sp, 28]
	add	x0, sp, 40
	mov	x2, 8192
	ldr	w1, [sp, 28]
	bl	memset
	ldr	w0, [sp, 28]
	and	w0, w0, 255
	mov	w1, w0
	mov	w0, w1
	ubfiz	w0, w0, 1, 7
	add	w0, w0, w1
	and	w0, w0, 255
	add	x1, sp, 4096
	add	x1, x1, 40
	strb	w0, [x1]
	ldr	w0, [sp, 28]
	cmp	w0, 0
	bne	.L26
	add	x0, sp, 4096
	add	x0, x0, 40
	ldrb	w0, [x0]
	and	x0, x0, 255
	b	.L28
.L26:
	ldr	w0, [sp, 28]
	sub	w0, w0, #1
	bl	deep8k
	str	x0, [sp, 8232]
	ldr	x1, [sp, 8232]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x1, x0, x1
	ldrb	w0, [sp, 40]
	and	x0, x0, 255
	add	x1, x1, x0
	add	x0, sp, 4096
	add	x0, x0, 40
	ldrb	w0, [x0]
	and	x0, x0, 255
	add	x1, x1, x0
	add	x0, sp, 8192
	add	x0, x0, 39
	ldrb	w0, [x0]
	and	x0, x0, 255
	add	x0, x1, x0
.L28:
	ldp	x29, x30, [sp]
	mov	x12, 8240
	add	sp, sp, x12
	ret
	.align	2
far_args:
	mov	x12, 40096
	sub	sp, sp, x12
	stp	x29, x30, [sp]
	mov	x29, sp
	str	x0, [sp, 72]
	str	x1, [sp, 64]
	str	x2, [sp, 56]
	str	x3, [sp, 48]
	str	x4, [sp, 40]
	str	x5, [sp, 32]
	str	x6, [sp, 24]
	str	x7, [sp, 16]
	add	x0, sp, 36864
	add	x0, x0, 3224
	str	xzr, [x0]
	add	x0, sp, 80
	mov	x2, 40000
	mov	w1, 0
	bl	memset
	add	x0, sp, 36864
	add	x0, x0, 3220
	str	wzr, [x0]
	b	.L30
.L31:
	add	x0, sp, 36864
	add	x0, x0, 3220
	ldrsw	x1, [x0]
	ldr	x0, [sp, 72]
	mul	x1, x1, x0
	ldr	x0, [sp, 64]
	add	x1, x1, x0
	ldr	x0, [sp, 56]
	sub	x1, x1, x0
	ldr	x0, [sp, 48]
	add	x1, x1, x0
	ldr	x0, [sp, 40]
	sub	x1, x1, x0
	ldr	x0, [sp, 32]
	add	x1, x1, x0
	ldr	x0, [sp, 24]
	sub	x1, x1, x0
	ldr	x0, [sp, 16]
	add	x2, x1, x0
	add	x0, sp, 36864
	add	x0, x0, 3220
	ldrsw	x0, [x0]
	lsl	x0, x0, 3
	add	x1, sp, 80
	str	x2, [x1, x0]
	add	x0, sp, 36864
	add	x0, x0, 3220
	ldr	w0, [x0]
	add	w0, w0, 499
	add	x1, sp, 36864
	add	x1, x1, 3220
	str	w0, [x1]
.L30:
	add	x0, sp, 36864
	add	x0, x0, 3220
	ldr	w1, [x0]
	mov	w0, 4999
	cmp	w1, w0
	ble	.L31
	add	x0, sp, 36864
	add	x0, x0, 3232
	ldr	x1, [x0]
	add	x0, sp, 36864
	add	x0, x0, 3240
	ldr	x0, [x0]
	mul	x0, x1, x0
	add	x1, sp, 36864
	add	x1, x1, 3208
	str	x0, [x1]
	add	x0, sp, 36864
	add	x0, x0, 3220
	str	wzr, [x0]
	b	.L32
.L33:
	add	x0, sp, 36864
	add	x0, x0, 3220
	ldrsw	x0, [x0]
	lsl	x0, x0, 3
	add	x1, sp, 80
	ldr	x0, [x1, x0]
	add	x1, sp, 36864
	add	x1, x1, 3224
	ldr	x1, [x1]
	add	x0, x1, x0
	add	x1, sp, 36864
	add	x1, x1, 3224
	str	x0, [x1]
	add	x0, sp, 36864
	add	x0, x0, 3220
	ldr	w0, [x0]
	add	w0, w0, 499
	add	x1, sp, 36864
	add	x1, x1, 3220
	str	w0, [x1]
.L32:
	add	x0, sp, 36864
	add	x0, x0, 3220
	ldr	w1, [x0]
	mov	w0, 4999
	cmp	w1, w0
	ble	.L33
	add	x0, sp, 36864
	add	x0, x0, 3208
	ldr	x1, [x0]
	add	x0, sp, 36864
	add	x0, x0, 3224
	ldr	x0, [x0]
	add	x1, x1, x0
	add	x0, sp, 36864
	add	x0, x0, 3232
	ldr	x0, [x0]
	sub	x1, x1, x0
	add	x0, sp, 36864
	add	x0, x0, 3240
	ldr	x0, [x0]
	add	x0, x1, x0
	ldp	x29, x30, [sp]
	mov	x12, 40096
	add	sp, sp, x12
	ret
	.align	2
twist:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x19, [sp, 16]
	mov	x3, x8
	mov	x19, x0
	str	w1, [sp, 44]
	str	wzr, [sp, 60]
	b	.L36
.L37:
	ldrsw	x0, [sp, 60]
	ldr	x1, [x19, x0, lsl 3]
	ldrsw	x0, [sp, 44]
	mul	x1, x1, x0
	mov	w2, 599
	ldr	w0, [sp, 60]
	sub	w0, w2, w0
	sxtw	x0, w0
	ldr	x0, [x19, x0, lsl 3]
	add	x1, x1, x0
	ldrsw	x0, [sp, 60]
	str	x1, [x19, x0, lsl 3]
	ldr	w0, [sp, 60]
	add	w0, w0, 1
	str	w0, [sp, 60]
.L36:
	ldr	w0, [sp, 60]
	cmp	w0, 599
	ble	.L37
	ldr	x1, [x19, 4792]
	ldrsw	x0, [sp, 44]
	eor	x0, x1, x0
	str	x0, [x19, 4792]
	mov	x1, x19
	mov	x0, 4800
	mov	x2, x0
	mov	x0, x3
	bl	memcpy
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 64
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%s: sum=%lld first=%lld last=%lld\n"
	.text
	.align	2
show:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	str	xzr, [sp, 40]
	str	wzr, [sp, 36]
	b	.L40
.L41:
	ldr	x0, [sp, 16]
	ldrsw	x1, [sp, 36]
	ldr	x0, [x0, x1, lsl 3]
	ldr	x1, [sp, 40]
	add	x0, x1, x0
	str	x0, [sp, 40]
	ldr	w0, [sp, 36]
	add	w0, w0, 1
	str	w0, [sp, 36]
.L40:
	ldr	w0, [sp, 36]
	cmp	w0, 599
	ble	.L41
	ldr	x0, [sp, 16]
	ldr	x1, [x0]
	ldr	x0, [sp, 16]
	ldr	x0, [x0, 4792]
	mov	x4, x0
	mov	x3, x1
	ldr	x2, [sp, 40]
	ldr	x1, [sp, 24]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	nop
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"frame_4k=%llu\n"
	.align	3
.LC2:
	.string	"frame_40k=%llu\n"
	.align	3
.LC3:
	.string	"frame_72k=%llu\n"
	.align	3
.LC4:
	.string	"frame_600k=%llu\n"
	.align	3
.LC5:
	.string	"deep8k=%llu\n"
	.align	3
.LC6:
	.string	"far_args=%lld\n"
	.align	3
.LC7:
	.string	"b1"
	.align	3
.LC8:
	.string	"b2"
	.align	3
.LC9:
	.string	"b3"
	.text
	.align	2
	.global	main
main:
	mov	x12, 28864
	sub	sp, sp, x12
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	str	x19, [sp, 32]
	adrp	x0, knob
	add	x0, x0, :lo12:knob
	ldr	w0, [x0]
	bl	frame_4k
	mov	x1, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	adrp	x0, knob
	add	x0, x0, :lo12:knob
	ldr	w0, [x0]
	bl	frame_40k
	mov	x1, x0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	adrp	x0, knob
	add	x0, x0, :lo12:knob
	ldr	w0, [x0]
	bl	frame_72k
	mov	x1, x0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	adrp	x0, knob
	add	x0, x0, :lo12:knob
	ldr	w0, [x0]
	bl	frame_600k
	mov	x1, x0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	adrp	x0, deep_levels
	add	x0, x0, :lo12:deep_levels
	ldr	w0, [x0]
	bl	deep8k
	mov	x1, x0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, knob
	add	x0, x0, :lo12:knob
	ldr	w1, [x0]
	mov	w0, 1000
	mul	w0, w1, w0
	sxtw	x0, w0
	str	x0, [sp, 8]
	mov	x0, -9
	str	x0, [sp]
	mov	x7, 8
	mov	x6, 7
	mov	x5, 6
	mov	x4, 5
	mov	x3, 4
	mov	x2, 3
	mov	x1, 2
	mov	x0, 1
	bl	far_args
	mov	x1, x0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	add	x0, sp, 28672
	add	x0, x0, 188
	str	wzr, [x0]
	b	.L43
.L44:
	add	x0, sp, 28672
	add	x0, x0, 188
	ldr	w0, [x0]
	sub	w1, w0, #300
	mov	w0, w1
	lsl	w0, w0, 1
	add	w0, w0, w1
	sxtw	x2, w0
	add	x0, sp, 28672
	add	x0, x0, 188
	ldrsw	x0, [x0]
	lsl	x0, x0, 3
	add	x1, sp, 16384
	add	x1, x1, 2872
	str	x2, [x1, x0]
	add	x0, sp, 28672
	add	x0, x0, 188
	ldr	w0, [x0]
	add	w0, w0, 1
	add	x1, sp, 28672
	add	x1, x1, 188
	str	w0, [x1]
.L43:
	add	x0, sp, 28672
	add	x0, x0, 188
	ldr	w0, [x0]
	cmp	w0, 599
	ble	.L44
	adrp	x0, knob
	add	x0, x0, :lo12:knob
	ldr	w19, [x0]
	add	x0, sp, 48
	add	x1, sp, 16384
	add	x1, x1, 2872
	mov	x2, 4800
	bl	memcpy
	add	x0, sp, 48
	add	x1, sp, 4096
	add	x1, x1, 752
	mov	x8, x1
	mov	w1, w19
	bl	twist
	add	x0, sp, 12288
	add	x0, x0, 2168
	add	x1, sp, 4096
	add	x1, x1, 752
	mov	x2, 4800
	bl	memcpy
	add	x0, sp, 48
	add	x1, sp, 12288
	add	x1, x1, 2168
	mov	x2, 4800
	bl	memcpy
	add	x0, sp, 48
	add	x1, sp, 20480
	add	x1, x1, 3576
	mov	x8, x1
	mov	w1, 5
	bl	twist
	add	x0, sp, 4096
	add	x0, x0, 752
	add	x1, sp, 20480
	add	x1, x1, 3576
	mov	x2, 4800
	bl	memcpy
	add	x0, sp, 4096
	add	x0, x0, 752
	add	x1, sp, 48
	mov	x8, x1
	mov	w1, 7
	bl	twist
	add	x0, sp, 8192
	add	x0, x0, 1464
	add	x1, sp, 48
	mov	x2, 4800
	bl	memcpy
	add	x0, sp, 16384
	add	x0, x0, 2872
	mov	x1, x0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	show
	add	x0, sp, 12288
	add	x0, x0, 2168
	mov	x1, x0
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	show
	add	x0, sp, 8192
	add	x0, x0, 1464
	mov	x1, x0
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	show
	mov	w0, 0
	ldp	x29, x30, [sp, 16]
	ldr	x19, [sp, 32]
	mov	x12, 28864
	add	sp, sp, x12
	ret

