	.text
	.align	2
	.align 5
	.global	tick
tick:
	ubfx	x1, x0, 1, 3
	mvn	w2, w0
	add	w1, w1, 1
	and	w2, w2, 1
	and	w1, w1, 7
	orr	w1, w2, w1, lsl 1
	and	w2, w0, -16
	orr	w1, w1, w2
	bfi	w0, w1, 0, 8
	sbfx	x2, x0, 4, 5
	sub	w1, w2, #3
	cmn	w2, #14
	mov	w2, 15
	sbfx	x1, x1, 0, 5
	csel	w1, w1, w2, gt
	ubfx	x2, x0, 9, 7
	and	w1, w1, 31
	add	w2, w2, 45
	ubfiz	w1, w1, 4, 12
	orr	w1, w1, w2, lsl 9
	and	w2, w0, 15
	orr	w1, w1, w2
	bfi	w0, w1, 0, 16
	sbfx	x1, x0, 16, 16
	add	w1, w1, w0, lsr 31
	asr	w1, w1, 1
	sub	w1, w1, #1000
	bfi	w0, w1, 16, 16
	ret
	.align	2
	.align 5
	.global	widen
widen:
	ubfx	x2, x0, 20, 40
	mov	w3, 48350
	add	x1, x2, x1
	lsr	x2, x0, 60
	sub	w2, w2, #1
	ubfx	x0, x0, 0, 20
	ubfiz	x1, x1, 20, 40
	movk	w3, 0xa, lsl 16
	eor	w0, w0, w3
	orr	x2, x1, x2, lsl 60
	and	x0, x0, 1048575
	orr	x0, x2, x0
	ret
	.align	2
	.align 5
	.global	mixpx
mixpx:
	ubfx	x2, x0, 5, 6
	ubfx	x4, x1, 5, 6
	eor	x3, x1, x0
	and	w1, w1, 31
	add	w2, w2, w2, lsl 1
	and	w0, w0, 31
	add	w2, w2, w4
	add	w0, w0, w1
	ubfx	w3, w3, 11, 5
	asr	w2, w2, 2
	asr	w0, w0, 1
	orr	w0, w0, w2, lsl 5
	and	w0, w0, 2047
	bfi	w0, w3, 11, 5
	ret
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
	.align 5
	.global	main
main:
	sub	sp, sp, #144
	adrp	x0, .LANCHOR0
	mov	w4, 100
	mov	w3, -7
	mov	w2, 5
	mov	w1, 1
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	ldr	w5, [x0, :lo12:.LANCHOR0]
	stp	x19, x20, [sp, 32]
	mov	w20, 51611
	mov	w19, 6
	sxth	w5, w5
	stp	x21, x22, [sp, 48]
	adrp	x22, .LC0
	adrp	x21, .LC1
	bfi	w20, w5, 16, 16
	add	x22, x22, :lo12:.LC0
	add	x21, x21, :lo12:.LC1
	str	x23, [sp, 64]
	adrp	x23, .LC2
	add	x23, x23, :lo12:.LC2
	b	.L10
	.align 2
.L24:
	and	w1, w0, 1
	ubfx	x2, x20, 1, 3
	sbfx	x3, x20, 4, 5
	ubfx	x4, x20, 9, 7
	sbfx	x5, x20, 16, 16
.L10:
	cmp	w3, 0
	mov	w6, w20
	csel	x7, x21, x22, ge
	mov	x0, x23
	bl	printf
	mov	w0, w20
	bl	tick
	subs	w19, w19, #1
	mov	w20, w0
	bne	.L24
	mov	x20, -56507
	adrp	x22, .LC3
	movk	x20, 0x1, lsl 16
	add	x22, x22, :lo12:.LC3
	movk	x20, 0xfff, lsl 48
	mov	w21, 0
	mov	x23, 9029
.L11:
	lsl	x1, x23, x21
	mov	x0, x20
	bl	widen
	add	w21, w21, 8
	mov	x4, x0
	lsr	x3, x0, 60
	ubfx	x2, x0, 20, 40
	and	x1, x0, 1048575
	mov	x20, x0
	mov	x0, x22
	bl	printf
	cmp	w21, 24
	bne	.L11
	mov	w0, 12
	mov	w7, 9029
	str	w0, [sp, 8]
	mov	w0, 29
	str	w0, [sp]
	movk	w7, 0x1, lsl 16
	mov	w6, 1048575
	mov	w2, w7
	mov	w1, w6
	mov	w5, -1
	mov	w4, 1
	mov	w3, 5
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	add	x20, sp, 80
	mov	w4, 65535
	mov	w3, 0
	mov	w1, w4
	mov	w6, 13
	mov	w5, 0
	mov	w2, 0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	add	w4, w20, 31
	mov	x7, x20
	mov	x3, x20
	and	w4, w4, 31
	mov	w1, 0
	.align 5
.L12:
	add	w0, w1, w1, lsl 2
	and	w2, w1, 31
	add	w0, w0, 7
	strh	wzr, [x3]
	and	w0, w0, 63
	add	w2, w2, w2, lsl 1
	and	w2, w2, 31
	orr	w0, w2, w0, lsl 5
	sub	w2, w4, w3
	add	x3, x3, 2
	orr	w0, w0, w2, lsl 11
	strh	w0, [x20, w1, sxtw 1]
	add	w1, w1, 1
	cmp	w1, 16
	bne	.L12
	mov	w5, 0
	.align 5
.L13:
	sbfiz	x6, x5, 1, 32
	add	w5, w5, 1
	add	w19, w19, w19, lsl 5
	ldrh	w1, [x20, w5, sxtw 1]
	ldrh	w0, [x20, x6]
	bl	mixpx
	strh	w0, [x20, x6]
	ldrh	w0, [x7], 2
	add	w19, w0, w19
	cmp	w5, 15
	bne	.L13
	ldrh	w3, [sp, 108]
	mov	w4, w19
	ldrh	w1, [sp, 80]
	mov	w5, 2
	ldrh	w2, [sp, 94]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	stp	xzr, xzr, [sp, 112]
	add	x3, sp, 112
	mov	w1, 0
	stp	xzr, xzr, [sp, 128]
	.align 5
.L14:
	ldrh	w0, [x20, w1, sxtw 1]
	add	w1, w1, 1
	ubfx	x0, x0, 8, 3
	lsl	x0, x0, 2
	ldr	w2, [x3, x0]
	add	w2, w2, 1
	str	w2, [x3, x0]
	cmp	w1, 16
	bne	.L14
	ldr	w1, [sp, 112]
	adrp	x20, .LC7
	add	x19, sp, 116
	add	x20, x20, :lo12:.LC7
	.align 5
.L15:
	mov	x0, x20
	mov	w2, 32
	bl	printf
	ldr	w1, [x19], 4
	add	x0, sp, 144
	cmp	x0, x19
	bne	.L15
	mov	x0, x20
	mov	w2, 10
	bl	printf
	mov	w3, 12
	mov	w2, 8
	mov	w1, 4
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldr	x23, [sp, 64]
	mov	w0, 0
	ldp	x29, x30, [sp, 16]
	ldp	x19, x20, [sp, 32]
	ldp	x21, x22, [sp, 48]
	add	sp, sp, 144
	ret
	.global	knob
	.data
	.align	2
	.LANCHOR0:
knob:
	.word	30000

