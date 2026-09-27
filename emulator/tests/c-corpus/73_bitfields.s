	.text
	.align	2
	.global	tick
tick:
	sub	sp, sp, #16
	str	w0, [sp, 8]
	ldr	w0, [sp, 8]
	and	w0, w0, 1
	ubfx	x0, x0, 0, 1
	eor	w0, w0, 1
	and	w1, w0, 255
	ldr	w0, [sp, 8]
	bfi	w0, w1, 0, 1
	str	w0, [sp, 8]
	ldr	x0, [sp, 8]
	ubfx	x0, x0, 1, 3
	and	w0, w0, 255
	add	w0, w0, 1
	and	w0, w0, 7
	and	w1, w0, 255
	ldr	w0, [sp, 8]
	bfi	w0, w1, 1, 3
	str	w0, [sp, 8]
	ldr	x0, [sp, 8]
	sbfx	x0, x0, 4, 5
	sxtb	w0, w0
	cmn	w0, #13
	blt	.L2
	ldr	x0, [sp, 8]
	sbfx	x0, x0, 4, 5
	sxtb	w0, w0
	and	w0, w0, 255
	sub	w0, w0, #3
	and	w0, w0, 255
	ubfiz	w0, w0, 3, 5
	sxtb	w0, w0
	asr	w0, w0, 3
	sxtb	w1, w0
	b	.L3
.L2:
	mov	w1, 15
.L3:
	ldr	w0, [sp, 8]
	bfi	w0, w1, 4, 5
	str	w0, [sp, 8]
	ldr	x0, [sp, 8]
	ubfx	x0, x0, 9, 7
	and	w0, w0, 255
	add	w0, w0, 45
	and	w0, w0, 255
	and	w0, w0, 127
	and	w1, w0, 255
	ldr	w0, [sp, 8]
	bfi	w0, w1, 9, 7
	str	w0, [sp, 8]
	ldrsh	w0, [sp, 10]
	lsr	w1, w0, 31
	add	w0, w1, w0
	asr	w0, w0, 1
	sxth	w0, w0
	and	w0, w0, 65535
	sub	w0, w0, #1000
	and	w0, w0, 65535
	sxth	w0, w0
	strh	w0, [sp, 10]
	ldr	w0, [sp, 8]
	add	sp, sp, 16
	ret
	.align	2
	.global	widen
widen:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ubfx	x0, x0, 20, 40
	mov	x1, x0
	ldr	x0, [sp]
	add	x0, x1, x0
	and	x1, x0, 1099511627775
	ldr	x0, [sp, 8]
	bfi	x0, x1, 20, 40
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	ubfx	x1, x0, 0, 20
	mov	w0, 48350
	movk	w0, 0xa, lsl 16
	eor	w1, w1, w0
	ldr	w0, [sp, 8]
	bfi	w0, w1, 0, 20
	str	w0, [sp, 8]
	ldr	x0, [sp, 8]
	lsr	x0, x0, 60
	and	w0, w0, 255
	sub	w0, w0, #1
	and	w0, w0, 255
	and	w0, w0, 15
	and	w1, w0, 255
	ldr	w0, [sp, 12]
	bfi	w0, w1, 28, 4
	str	w0, [sp, 12]
	ldr	x0, [sp, 8]
	add	sp, sp, 16
	ret
	.align	2
	.global	mixpx
mixpx:
	sub	sp, sp, #32
	strh	w0, [sp, 12]
	strh	w1, [sp, 8]
	ldr	w0, [sp, 12]
	ubfx	x0, x0, 0, 5
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 8]
	ubfx	x0, x0, 0, 5
	and	w0, w0, 255
	add	w0, w1, w0
	lsr	w1, w0, 31
	add	w0, w1, w0
	asr	w0, w0, 1
	and	w0, w0, 31
	and	w1, w0, 255
	ldrh	w0, [sp, 24]
	bfi	w0, w1, 0, 5
	strh	w0, [sp, 24]
	ldr	w0, [sp, 12]
	ubfx	x0, x0, 5, 6
	and	w0, w0, 255
	mov	w1, w0
	mov	w0, w1
	lsl	w0, w0, 1
	add	w0, w0, w1
	ldr	w1, [sp, 8]
	ubfx	x1, x1, 5, 6
	and	w1, w1, 255
	add	w0, w0, w1
	add	w1, w0, 3
	cmp	w0, 0
	csel	w0, w1, w0, lt
	asr	w0, w0, 2
	and	w0, w0, 63
	and	w1, w0, 255
	ldrh	w0, [sp, 24]
	bfi	w0, w1, 5, 6
	strh	w0, [sp, 24]
	ldr	w0, [sp, 12]
	ubfx	x0, x0, 11, 5
	and	w1, w0, 255
	ldr	w0, [sp, 8]
	ubfx	x0, x0, 11, 5
	and	w0, w0, 255
	eor	w0, w1, w0
	and	w1, w0, 255
	ldrh	w0, [sp, 24]
	bfi	w0, w1, 11, 5
	strh	w0, [sp, 24]
	ldrh	w0, [sp, 24]
	add	sp, sp, 32
	ret
	.global	knob
	.data
	.align	2
knob:
	.word	30000
	.section .rodata
	.align	3
.LC0:
	.string	"neg"
	.align	3
.LC1:
	.string	"pos"
	.align	3
.LC2:
	.string	"flags %d %d %d %d %d raw %08x %s\n"
	.align	3
.LC3:
	.string	"wide %05lx %010lx %lx raw %016lx\n"
	.align	3
.LC4:
	.string	"split %x %x %d %d %d raw %08x %08x %08x size %d\n"
	.align	3
.LC5:
	.string	"split %x %x %d raw %08x %08x %08x\n"
	.align	3
.LC6:
	.string	"pixels %04x %04x %04x sum %u size %d\n"
	.align	3
.LC7:
	.string	"%d%c"
	.align	3
.LC8:
	.string	"sizes %d %d %d\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #176
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x19, x20, [sp, 32]
	str	wzr, [sp, 144]
	ldr	w0, [sp, 144]
	orr	w0, w0, 1
	str	w0, [sp, 144]
	ldr	w0, [sp, 144]
	mov	w1, 5
	bfi	w0, w1, 1, 3
	str	w0, [sp, 144]
	ldr	w0, [sp, 144]
	mov	w1, -7
	bfi	w0, w1, 4, 5
	str	w0, [sp, 144]
	ldr	w0, [sp, 144]
	mov	w1, 100
	bfi	w0, w1, 9, 7
	str	w0, [sp, 144]
	adrp	x0, knob
	add	x0, x0, :lo12:knob
	ldr	w0, [x0]
	sxth	w0, w0
	strh	w0, [sp, 146]
	str	wzr, [sp, 172]
	b	.L10
.L13:
	ldr	x0, [sp, 144]
	ubfx	x0, x0, 0, 1
	and	w0, w0, 255
	mov	w8, w0
	ldr	x0, [sp, 144]
	ubfx	x0, x0, 1, 3
	and	w0, w0, 255
	mov	w2, w0
	ldr	x0, [sp, 144]
	sbfx	x0, x0, 4, 5
	sxtb	w0, w0
	mov	w3, w0
	ldr	x0, [sp, 144]
	ubfx	x0, x0, 9, 7
	and	w0, w0, 255
	mov	w4, w0
	ldrsh	w0, [sp, 146]
	mov	w5, w0
	ldr	w1, [sp, 144]
	ldr	x0, [sp, 144]
	sbfx	x0, x0, 4, 5
	sxtb	w0, w0
	cmp	w0, 0
	bge	.L11
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	b	.L12
.L11:
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
.L12:
	mov	x7, x0
	mov	w6, w1
	mov	w1, w8
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	w0, [sp, 144]
	bl	tick
	str	w0, [sp, 144]
	ldr	w0, [sp, 172]
	add	w0, w0, 1
	str	w0, [sp, 172]
.L10:
	ldr	w0, [sp, 172]
	cmp	w0, 5
	ble	.L13
	str	xzr, [sp, 136]
	ldr	w0, [sp, 136]
	mov	w1, 9029
	movk	w1, 0x1, lsl 16
	bfi	w0, w1, 0, 20
	str	w0, [sp, 136]
	ldr	x0, [sp, 136]
	mov	x1, 1099511623680
	bfi	x0, x1, 20, 40
	str	x0, [sp, 136]
	ldr	x0, [sp, 136]
	and	x0, x0, 1152921504606846975
	str	x0, [sp, 136]
	str	wzr, [sp, 168]
	b	.L14
.L15:
	ldr	w0, [sp, 168]
	lsl	w0, w0, 3
	mov	x1, 9029
	lsl	x0, x1, x0
	mov	x1, x0
	ldr	x0, [sp, 136]
	bl	widen
	str	x0, [sp, 136]
	ldr	x0, [sp, 136]
	ubfx	x0, x0, 0, 20
	uxtw	x1, w0
	ldr	x0, [sp, 136]
	ubfx	x0, x0, 20, 40
	mov	x5, x0
	ldr	x0, [sp, 136]
	lsr	x0, x0, 60
	and	w0, w0, 255
	and	x0, x0, 255
	ldr	x2, [sp, 136]
	mov	x4, x2
	mov	x3, x0
	mov	x2, x5
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w0, [sp, 168]
	add	w0, w0, 1
	str	w0, [sp, 168]
.L14:
	ldr	w0, [sp, 168]
	cmp	w0, 2
	ble	.L15
	str	wzr, [sp, 128]
	ldr	w0, [sp, 128]
	str	w0, [sp, 124]
	ldr	w0, [sp, 124]
	str	w0, [sp, 120]
	ldr	x0, [sp, 120]
	orr	x0, x0, 1048575
	str	x0, [sp, 120]
	ldr	w0, [sp, 124]
	mov	w1, 9029
	movk	w1, 0x1, lsl 16
	bfi	w0, w1, 0, 20
	str	w0, [sp, 124]
	ldrb	w0, [sp, 128]
	mov	w1, 5
	bfi	w0, w1, 0, 3
	strb	w0, [sp, 128]
	ldrb	w0, [sp, 128]
	orr	w0, w0, 8
	strb	w0, [sp, 128]
	ldrb	w0, [sp, 128]
	orr	w0, w0, 16
	strb	w0, [sp, 128]
	ldr	x0, [sp, 120]
	ubfx	x0, x0, 0, 20
	mov	w8, w0
	ldr	x0, [sp, 120]
	ubfx	x0, x0, 32, 20
	mov	w9, w0
	ldr	x0, [sp, 128]
	ubfx	x0, x0, 0, 3
	and	w0, w0, 255
	mov	w10, w0
	ldr	x0, [sp, 128]
	ubfx	x0, x0, 3, 1
	and	w0, w0, 255
	mov	w4, w0
	ldr	x0, [sp, 128]
	sbfx	x0, x0, 4, 1
	sxtb	w0, w0
	mov	w5, w0
	ldr	w0, [sp, 120]
	ldr	w1, [sp, 124]
	ldr	w2, [sp, 128]
	mov	w3, 12
	str	w3, [sp, 8]
	str	w2, [sp]
	mov	w7, w1
	mov	w6, w0
	mov	w3, w10
	mov	w2, w9
	mov	w1, w8
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	x0, [sp, 120]
	ubfx	x0, x0, 32, 20
	mov	w1, w0
	mov	w0, 56507
	movk	w0, 0xe, lsl 16
	add	w0, w1, w0
	and	w1, w0, 1048575
	ldr	w0, [sp, 124]
	bfi	w0, w1, 0, 20
	str	w0, [sp, 124]
	ldr	x0, [sp, 120]
	ubfx	x0, x0, 0, 20
	asr	w0, w0, 4
	and	w1, w0, 1048575
	ldr	w0, [sp, 120]
	bfi	w0, w1, 0, 20
	str	w0, [sp, 120]
	ldrb	w0, [sp, 128]
	and	w0, w0, -17
	strb	w0, [sp, 128]
	ldr	x0, [sp, 120]
	ubfx	x0, x0, 0, 20
	mov	w7, w0
	ldr	x0, [sp, 120]
	ubfx	x0, x0, 32, 20
	mov	w8, w0
	ldr	x0, [sp, 128]
	sbfx	x0, x0, 4, 1
	sxtb	w0, w0
	mov	w3, w0
	ldr	w0, [sp, 120]
	ldr	w1, [sp, 124]
	ldr	w2, [sp, 128]
	mov	w6, w2
	mov	w5, w1
	mov	w4, w0
	mov	w2, w8
	mov	w1, w7
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	str	wzr, [sp, 164]
	b	.L16
.L17:
	ldrsw	x0, [sp, 164]
	lsl	x0, x0, 1
	add	x1, sp, 88
	strh	wzr, [x1, x0]
	ldr	w0, [sp, 164]
	and	w0, w0, 31
	and	w0, w0, 255
	mov	w1, w0
	mov	w0, w1
	ubfiz	w0, w0, 1, 7
	add	w0, w0, w1
	and	w0, w0, 31
	and	w3, w0, 255
	ldrsw	x0, [sp, 164]
	lsl	x1, x0, 1
	add	x2, sp, 88
	ldrh	w0, [x2, x1]
	bfi	w0, w3, 0, 5
	strh	w0, [x2, x1]
	ldr	w0, [sp, 164]
	and	w0, w0, 255
	mov	w1, w0
	mov	w0, w1
	ubfiz	w0, w0, 2, 6
	add	w0, w0, w1
	and	w0, w0, 255
	add	w0, w0, 7
	and	w0, w0, 255
	and	w0, w0, 63
	and	w3, w0, 255
	ldrsw	x0, [sp, 164]
	lsl	x1, x0, 1
	add	x2, sp, 88
	ldrh	w0, [x2, x1]
	bfi	w0, w3, 5, 6
	strh	w0, [x2, x1]
	ldr	w0, [sp, 164]
	and	w0, w0, 255
	ubfiz	w0, w0, 1, 7
	and	w0, w0, 255
	mov	w1, 31
	sub	w0, w1, w0
	and	w0, w0, 255
	and	w0, w0, 31
	and	w3, w0, 255
	ldrsw	x0, [sp, 164]
	lsl	x1, x0, 1
	add	x2, sp, 88
	ldrh	w0, [x2, x1]
	bfi	w0, w3, 11, 5
	strh	w0, [x2, x1]
	ldr	w0, [sp, 164]
	add	w0, w0, 1
	str	w0, [sp, 164]
.L16:
	ldr	w0, [sp, 164]
	cmp	w0, 15
	ble	.L17
	str	wzr, [sp, 160]
	str	wzr, [sp, 156]
	b	.L18
.L19:
	ldr	w0, [sp, 156]
	add	w1, w0, 1
	ldrsw	x0, [sp, 156]
	lsl	x19, x0, 1
	add	x20, sp, 88
	sxtw	x0, w1
	lsl	x1, x0, 1
	add	x3, sp, 88
	ldrsw	x0, [sp, 156]
	lsl	x0, x0, 1
	add	x2, sp, 88
	ldrh	w1, [x3, x1]
	ldrh	w0, [x2, x0]
	bl	mixpx
	strh	w0, [x20, x19]
	ldr	w1, [sp, 160]
	mov	w0, w1
	lsl	w0, w0, 5
	add	w0, w0, w1
	ldrsw	x1, [sp, 156]
	lsl	x1, x1, 1
	add	x2, sp, 88
	ldrh	w1, [x2, x1]
	add	w0, w0, w1
	str	w0, [sp, 160]
	ldr	w0, [sp, 156]
	add	w0, w0, 1
	str	w0, [sp, 156]
.L18:
	ldr	w0, [sp, 156]
	cmp	w0, 14
	ble	.L19
	ldrh	w0, [sp, 88]
	ldrh	w1, [sp, 102]
	ldrh	w2, [sp, 116]
	mov	w5, 2
	ldr	w4, [sp, 160]
	mov	w3, w2
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	stp	xzr, xzr, [sp, 56]
	stp	xzr, xzr, [sp, 72]
	str	wzr, [sp, 152]
	b	.L20
.L21:
	ldrsw	x0, [sp, 152]
	lsl	x0, x0, 1
	add	x1, sp, 88
	ldrh	w0, [x1, x0]
	ubfx	x0, x0, 5, 6
	and	w0, w0, 255
	asr	w3, w0, 3
	sxtw	x0, w3
	lsl	x0, x0, 2
	add	x1, sp, 56
	ldr	w0, [x1, x0]
	add	w2, w0, 1
	sxtw	x0, w3
	lsl	x0, x0, 2
	add	x1, sp, 56
	str	w2, [x1, x0]
	ldr	w0, [sp, 152]
	add	w0, w0, 1
	str	w0, [sp, 152]
.L20:
	ldr	w0, [sp, 152]
	cmp	w0, 15
	ble	.L21
	str	wzr, [sp, 148]
	b	.L22
.L25:
	ldrsw	x0, [sp, 148]
	lsl	x0, x0, 2
	add	x1, sp, 56
	ldr	w1, [x1, x0]
	ldr	w0, [sp, 148]
	cmp	w0, 7
	bne	.L23
	mov	w0, 10
	b	.L24
.L23:
	mov	w0, 32
.L24:
	mov	w2, w0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	w0, [sp, 148]
	add	w0, w0, 1
	str	w0, [sp, 148]
.L22:
	ldr	w0, [sp, 148]
	cmp	w0, 7
	ble	.L25
	mov	w3, 12
	mov	w2, 8
	mov	w1, 4
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 16]
	ldp	x19, x20, [sp, 32]
	add	sp, sp, 176
	ret

