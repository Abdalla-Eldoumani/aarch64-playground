	.text
	.global	grid
	.bss
	.align	3
grid:
	.zero	420
	.text
	.align	2
	.global	score
score:
	sub	sp, sp, #16
	str	x0, [sp]
	ldr	w0, [sp, 8]
	bfi	w0, w1, 0, 32
	str	w0, [sp, 8]
	ldr	w0, [sp]
	sxtw	x1, w0
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	lsl	x1, x0, 2
	add	x0, x0, x1
	lsl	x1, x0, 2
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x2, x0
	ldrsh	w0, [sp, 4]
	mov	w1, w0
	mov	w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	lsl	w0, w0, 1
	sxtw	x0, w0
	add	x1, x2, x0
	ldrsh	w0, [sp, 6]
	sxth	x0, w0
	add	x1, x1, x0
	ldr	w0, [sp, 8]
	sxtw	x0, w0
	sub	x0, x1, x0
	add	sp, sp, 16
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"d %d %d: %ld %ld %ld bytes %ld\n"
	.text
	.align	2
	.global	distances
distances:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 40]
	str	x1, [sp, 32]
	str	x2, [sp, 24]
	str	w3, [sp, 20]
	str	w4, [sp, 16]
	ldrsw	x1, [sp, 16]
	ldrsw	x0, [sp, 20]
	sub	x1, x1, x0
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	asr	x1, x0, 2
	mov	x0, -6148914691236517206
	movk	x0, 0xaaab, lsl 0
	mul	x0, x1, x0
	mov	x3, x0
	ldrsw	x1, [sp, 16]
	ldrsw	x0, [sp, 20]
	sub	x1, x1, x0
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	asr	x1, x0, 3
	mov	x0, -6148914691236517206
	movk	x0, 0xaaab, lsl 0
	mul	x0, x1, x0
	mov	x4, x0
	ldrsw	x1, [sp, 16]
	ldrsw	x0, [sp, 20]
	sub	x1, x1, x0
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	lsl	x0, x0, 2
	asr	x1, x0, 2
	mov	x0, 36409
	movk	x0, 0x38e3, lsl 16
	movk	x0, 0xe38e, lsl 32
	movk	x0, 0x8e38, lsl 48
	mul	x0, x1, x0
	mov	x5, x0
	ldrsw	x1, [sp, 16]
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x0
	ldr	x0, [sp, 24]
	add	x2, x0, x1
	ldrsw	x1, [sp, 20]
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x0
	ldr	x0, [sp, 24]
	add	x0, x0, x1
	sub	x0, x2, x0
	mov	x6, x0
	ldr	w2, [sp, 16]
	ldr	w1, [sp, 20]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	nop
	ldp	x29, x30, [sp], 48
	ret
	.align	2
	.global	sort24
sort24:
	sub	sp, sp, #48
	str	x0, [sp, 8]
	str	w1, [sp, 4]
	mov	w0, 1
	str	w0, [sp, 44]
	b	.L5
.L9:
	ldrsw	x1, [sp, 44]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 8]
	add	x1, x0, x1
	add	x0, sp, 16
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	ldr	w0, [sp, 44]
	sub	w0, w0, #1
	str	w0, [sp, 40]
	b	.L6
.L8:
	ldrsw	x1, [sp, 40]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 8]
	add	x3, x0, x1
	ldrsw	x0, [sp, 40]
	add	x1, x0, 1
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 8]
	add	x0, x0, x1
	mov	x2, x0
	ldp	x0, x1, [x3]
	ldr	x3, [x3, 16]
	stp	x0, x1, [x2]
	str	x3, [x2, 16]
	ldr	w0, [sp, 40]
	sub	w0, w0, #1
	str	w0, [sp, 40]
.L6:
	ldr	w0, [sp, 40]
	cmp	w0, 0
	blt	.L7
	ldrsw	x1, [sp, 40]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 8]
	add	x0, x0, x1
	ldr	x1, [x0]
	ldr	x0, [sp, 16]
	cmp	x1, x0
	bgt	.L8
	ldrsw	x1, [sp, 40]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 8]
	add	x0, x0, x1
	ldr	x1, [x0]
	ldr	x0, [sp, 16]
	cmp	x1, x0
	bne	.L7
	ldrsw	x1, [sp, 40]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 8]
	add	x0, x0, x1
	ldr	w1, [x0, 8]
	ldr	w0, [sp, 24]
	cmp	w1, w0
	blt	.L8
.L7:
	ldrsw	x0, [sp, 40]
	add	x1, x0, 1
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 8]
	add	x0, x0, x1
	mov	x3, x0
	add	x2, sp, 16
	ldp	x0, x1, [x2]
	ldr	x2, [x2, 16]
	stp	x0, x1, [x3]
	str	x2, [x3, 16]
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L5:
	ldr	w1, [sp, 44]
	ldr	w0, [sp, 4]
	cmp	w1, w0
	blt	.L9
	nop
	nop
	add	sp, sp, 48
	ret
	.align	2
	.global	find24
find24:
	sub	sp, sp, #48
	str	x0, [sp, 24]
	str	w1, [sp, 20]
	str	x2, [sp, 8]
	str	wzr, [sp, 44]
	ldr	w0, [sp, 20]
	str	w0, [sp, 40]
	b	.L11
.L14:
	ldr	w1, [sp, 40]
	ldr	w0, [sp, 44]
	sub	w0, w1, w0
	lsr	w1, w0, 31
	add	w0, w1, w0
	asr	w0, w0, 1
	mov	w1, w0
	ldr	w0, [sp, 44]
	add	w0, w0, w1
	str	w0, [sp, 36]
	ldrsw	x1, [sp, 36]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 24]
	add	x0, x0, x1
	ldr	x0, [x0]
	ldr	x1, [sp, 8]
	cmp	x1, x0
	ble	.L12
	ldr	w0, [sp, 36]
	add	w0, w0, 1
	str	w0, [sp, 44]
	b	.L11
.L12:
	ldr	w0, [sp, 36]
	str	w0, [sp, 40]
.L11:
	ldr	w1, [sp, 44]
	ldr	w0, [sp, 40]
	cmp	w1, w0
	blt	.L14
	ldr	w1, [sp, 44]
	ldr	w0, [sp, 20]
	cmp	w1, w0
	bge	.L15
	ldrsw	x1, [sp, 44]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	mov	x1, x0
	ldr	x0, [sp, 24]
	add	x0, x0, x1
	ldr	x0, [x0]
	ldr	x1, [sp, 8]
	cmp	x1, x0
	bne	.L15
	ldr	w0, [sp, 44]
	b	.L16
.L15:
	mov	w0, -1
.L16:
	add	sp, sp, 48
	ret
	.align	2
	.global	bump
bump:
	str	x19, [sp, -48]!
	mov	x3, x8
	mov	x19, x0
	str	w1, [sp, 28]
	ldrb	w0, [x19]
	add	w0, w0, 1
	and	w0, w0, 255
	strb	w0, [x19]
	str	wzr, [sp, 44]
	b	.L19
.L20:
	ldrsw	x0, [sp, 44]
	lsl	x0, x0, 2
	add	x0, x19, x0
	ldr	w1, [x0, 4]
	ldr	w2, [sp, 28]
	ldr	w0, [sp, 44]
	mul	w0, w2, w0
	add	w1, w1, w0
	ldrsw	x0, [sp, 44]
	lsl	x0, x0, 2
	add	x0, x19, x0
	str	w1, [x0, 4]
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L19:
	ldr	w0, [sp, 44]
	cmp	w0, 7
	ble	.L20
	mov	x0, x3
	mov	x1, x19
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	ldr	w1, [x1, 32]
	str	q30, [x0]
	str	q31, [x0, 16]
	str	w1, [x0, 32]
	ldr	x19, [sp], 48
	ret
	.align	2
	.global	reverse36
reverse36:
	sub	sp, sp, #64
	str	x0, [sp, 8]
	str	w1, [sp, 4]
	str	wzr, [sp, 60]
	ldr	w0, [sp, 4]
	sub	w0, w0, #1
	str	w0, [sp, 56]
	b	.L23
.L24:
	ldrsw	x1, [sp, 60]
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x0
	ldr	x0, [sp, 8]
	add	x1, x0, x1
	add	x0, sp, 16
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	ldr	w1, [x1, 32]
	str	q30, [x0]
	str	q31, [x0, 16]
	str	w1, [x0, 32]
	ldrsw	x1, [sp, 56]
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x0
	ldr	x0, [sp, 8]
	add	x2, x0, x1
	ldrsw	x1, [sp, 60]
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x0
	ldr	x0, [sp, 8]
	add	x0, x0, x1
	mov	x1, x2
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	ldr	w1, [x1, 32]
	str	q30, [x0]
	str	q31, [x0, 16]
	str	w1, [x0, 32]
	ldrsw	x1, [sp, 56]
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x0
	ldr	x0, [sp, 8]
	add	x0, x0, x1
	mov	x1, x0
	add	x0, sp, 16
	ldr	q30, [x0]
	ldr	q31, [x0, 16]
	ldr	w0, [x0, 32]
	str	q30, [x1]
	str	q31, [x1, 16]
	str	w0, [x1, 32]
	ldr	w0, [sp, 60]
	add	w0, w0, 1
	str	w0, [sp, 60]
	ldr	w0, [sp, 56]
	sub	w0, w0, #1
	str	w0, [sp, 56]
.L23:
	ldr	w1, [sp, 60]
	ldr	w0, [sp, 56]
	cmp	w1, w0
	blt	.L24
	nop
	nop
	add	sp, sp, 64
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"grow %d\n"
	.text
	.align	2
	.global	push
push:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x19, [sp, 16]
	str	x0, [sp, 40]
	mov	x19, x1
	ldr	x0, [sp, 40]
	ldr	w1, [x0, 8]
	ldr	x0, [sp, 40]
	ldr	w0, [x0, 12]
	cmp	w1, w0
	bne	.L26
	ldr	x0, [sp, 40]
	ldr	w0, [x0, 12]
	cmp	w0, 0
	beq	.L27
	ldr	x0, [sp, 40]
	ldr	w0, [x0, 12]
	lsl	w0, w0, 1
	str	w0, [sp, 60]
	b	.L28
.L27:
	mov	w0, 1
	str	w0, [sp, 60]
.L28:
	ldr	x0, [sp, 40]
	ldr	x2, [x0]
	ldrsw	x1, [sp, 60]
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	lsl	x0, x0, 2
	mov	x1, x0
	mov	x0, x2
	bl	realloc
	str	x0, [sp, 48]
	ldr	x0, [sp, 48]
	cmp	x0, 0
	bne	.L29
	mov	w0, 0
	b	.L30
.L29:
	ldr	x0, [sp, 40]
	ldr	x1, [sp, 48]
	str	x1, [x0]
	ldr	x0, [sp, 40]
	ldr	w1, [sp, 60]
	str	w1, [x0, 12]
	ldr	w1, [sp, 60]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
.L26:
	ldr	x0, [sp, 40]
	ldr	x2, [x0]
	ldr	x0, [sp, 40]
	ldr	w0, [x0, 8]
	add	w3, w0, 1
	ldr	x1, [sp, 40]
	str	w3, [x1, 8]
	sxtw	x1, w0
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x0, x2, x0
	mov	x2, x0
	mov	x3, x19
	ldp	x0, x1, [x3]
	ldr	w3, [x3, 16]
	stp	x0, x1, [x2]
	str	w3, [x2, 16]
	mov	w0, 1
.L30:
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 64
	ret
	.global	knob
	.data
	.align	2
knob:
	.word	7
	.section .rodata
	.align	3
.LC2:
	.string	"score %ld last %ld\n"
	.align	3
.LC3:
	.string	"%ld:%d:%s%c"
	.align	3
.LC4:
	.string	"%d%c"
	.align	3
.LC5:
	.string	"%c%d,%d%c"
	.align	3
.LC6:
	.string	"grid %ld %ld %d\n"
	.align	3
.LC7:
	.string	"out of memory\n"
	.align	3
.LC8:
	.string	"vec %d %d %ld\n"
	.align	3
.LC9:
	.string	"sizes %d %d %d %d\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #944
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x20, x21, [sp, 16]
	adrp	x0, knob
	add	x0, x0, :lo12:knob
	ldr	w0, [x0]
	str	w0, [sp, 836]
	str	wzr, [sp, 940]
	b	.L32
.L33:
	ldr	w0, [sp, 940]
	and	w1, w0, 65535
	ldr	w0, [sp, 836]
	and	w0, w0, 65535
	sub	w0, w1, w0
	and	w0, w0, 65535
	sxth	w5, w0
	ldr	w0, [sp, 940]
	and	w1, w0, 65535
	ldr	w0, [sp, 836]
	and	w0, w0, 65535
	mul	w0, w1, w0
	and	w0, w0, 65535
	sxth	w4, w0
	ldr	w0, [sp, 940]
	mul	w0, w0, w0
	sub	w2, w0, #7
	ldrsw	x1, [sp, 940]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x1, sp, 712
	ldr	w3, [sp, 940]
	str	w3, [x1, x0]
	ldrsw	x1, [sp, 940]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x1, sp, 716
	mov	w3, w5
	strh	w3, [x1, x0]
	ldrsw	x1, [sp, 940]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x1, sp, 718
	mov	w3, w4
	strh	w3, [x1, x0]
	ldrsw	x1, [sp, 940]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x1, sp, 720
	str	w2, [x1, x0]
	ldr	w0, [sp, 940]
	add	w0, w0, 1
	str	w0, [sp, 940]
.L32:
	ldr	w0, [sp, 940]
	cmp	w0, 9
	ble	.L33
	str	wzr, [sp, 936]
	b	.L34
.L37:
	ldr	w1, [sp, 936]
	mov	w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	ldr	w1, [sp, 836]
	sdiv	w2, w0, w1
	ldr	w1, [sp, 836]
	mul	w1, w2, w1
	sub	w0, w0, w1
	sub	w0, w0, #3
	sxtw	x2, w0
	ldrsw	x1, [sp, 936]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x1, sp, 424
	str	x2, [x1, x0]
	ldrsw	x1, [sp, 936]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x1, sp, 432
	ldr	w2, [sp, 936]
	str	w2, [x1, x0]
	str	wzr, [sp, 932]
	b	.L35
.L36:
	ldr	w1, [sp, 936]
	mov	w0, w1
	lsl	w0, w0, 1
	add	w1, w0, w1
	ldr	w2, [sp, 932]
	ldr	w0, [sp, 836]
	mul	w0, w2, w0
	add	w0, w1, w0
	mov	w1, 26
	sdiv	w2, w0, w1
	mov	w1, 26
	mul	w1, w2, w1
	sub	w0, w0, w1
	and	w0, w0, 255
	add	w0, w0, 97
	and	w3, w0, 255
	ldrsw	x2, [sp, 932]
	ldrsw	x1, [sp, 936]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x0, 944
	add	x0, sp, x0
	add	x0, x0, x2
	sub	x0, x0, #4096
	mov	w1, w3
	strb	w1, [x0, 3588]
	ldr	w0, [sp, 932]
	add	w0, w0, 1
	str	w0, [sp, 932]
.L35:
	ldr	w0, [sp, 932]
	cmp	w0, 6
	ble	.L36
	ldrsw	x1, [sp, 936]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x1, sp, 443
	strb	wzr, [x1, x0]
	ldr	w0, [sp, 936]
	add	w0, w0, 1
	str	w0, [sp, 936]
.L34:
	ldr	w0, [sp, 936]
	cmp	w0, 11
	ble	.L37
	str	wzr, [sp, 928]
	b	.L38
.L41:
	ldr	w0, [sp, 928]
	and	w0, w0, 255
	add	w0, w0, 65
	and	w2, w0, 255
	ldrsw	x1, [sp, 928]
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x1, sp, 208
	strb	w2, [x1, x0]
	str	wzr, [sp, 924]
	b	.L39
.L40:
	ldr	w1, [sp, 928]
	mov	w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	lsl	w0, w0, 1
	mov	w1, w0
	ldr	w0, [sp, 924]
	add	w3, w1, w0
	ldrsw	x2, [sp, 924]
	ldrsw	x1, [sp, 928]
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	add	x0, x0, x2
	lsl	x0, x0, 2
	add	x1, sp, 212
	str	w3, [x1, x0]
	ldr	w0, [sp, 924]
	add	w0, w0, 1
	str	w0, [sp, 924]
.L39:
	ldr	w0, [sp, 924]
	cmp	w0, 7
	ble	.L40
	ldr	w0, [sp, 928]
	add	w0, w0, 1
	str	w0, [sp, 928]
.L38:
	ldr	w0, [sp, 928]
	cmp	w0, 5
	ble	.L41
	str	xzr, [sp, 912]
	str	wzr, [sp, 908]
	b	.L42
.L43:
	ldrsw	x1, [sp, 908]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x1, sp, 712
	ldr	x2, [x1, x0]
	add	x0, x1, x0
	ldr	w1, [x0, 8]
	mov	x0, x2
	bl	score
	mov	x1, x0
	ldr	x0, [sp, 912]
	add	x0, x0, x1
	str	x0, [sp, 912]
	ldr	w0, [sp, 908]
	add	w0, w0, 1
	str	w0, [sp, 908]
.L42:
	ldr	w0, [sp, 908]
	cmp	w0, 9
	ble	.L43
	add	x0, sp, 820
	ldr	x0, [x0]
	ldr	w1, [sp, 828]
	bl	score
	mov	x2, x0
	ldr	x1, [sp, 912]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	add	x2, sp, 208
	add	x1, sp, 424
	add	x0, sp, 712
	mov	w4, 5
	mov	w3, 1
	bl	distances
	ldr	w0, [sp, 836]
	sub	w3, w0, #2
	add	x2, sp, 208
	add	x1, sp, 424
	add	x0, sp, 712
	mov	w4, 0
	bl	distances
	add	x0, sp, 424
	mov	w1, 12
	bl	sort24
	str	wzr, [sp, 904]
	b	.L44
.L47:
	ldrsw	x1, [sp, 904]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x1, sp, 424
	ldr	x5, [x1, x0]
	ldrsw	x1, [sp, 904]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x1, sp, 432
	ldr	w6, [x1, x0]
	add	x2, sp, 424
	ldrsw	x1, [sp, 904]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	add	x2, x0, 12
	ldr	w0, [sp, 904]
	negs	w1, w0
	and	w0, w0, 3
	and	w1, w1, 3
	csneg	w0, w0, w1, mi
	cmp	w0, 3
	bne	.L45
	mov	w0, 10
	b	.L46
.L45:
	mov	w0, 32
.L46:
	mov	w4, w0
	mov	x3, x2
	mov	w2, w6
	mov	x1, x5
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w0, [sp, 904]
	add	w0, w0, 1
	str	w0, [sp, 904]
.L44:
	ldr	w0, [sp, 904]
	cmp	w0, 11
	ble	.L47
	mov	x0, -4
	str	x0, [sp, 896]
	b	.L48
.L51:
	add	x0, sp, 424
	ldr	x2, [sp, 896]
	mov	w1, 12
	bl	find24
	mov	w1, w0
	ldr	x0, [sp, 896]
	cmp	x0, 4
	bne	.L49
	mov	w0, 10
	b	.L50
.L49:
	mov	w0, 32
.L50:
	mov	w2, w0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	x0, [sp, 896]
	add	x0, x0, 1
	str	x0, [sp, 896]
.L48:
	ldr	x0, [sp, 896]
	cmp	x0, 4
	ble	.L51
	add	x0, sp, 32
	add	x1, sp, 280
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	ldr	w1, [x1, 32]
	str	q30, [x0]
	str	q31, [x0, 16]
	str	w1, [x0, 32]
	add	x0, sp, 32
	add	x1, sp, 80
	mov	x8, x1
	ldr	w1, [sp, 836]
	bl	bump
	add	x0, sp, 280
	add	x1, sp, 80
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	ldr	w1, [x1, 32]
	str	q30, [x0]
	str	q31, [x0, 16]
	str	w1, [x0, 32]
	add	x0, sp, 208
	mov	w1, 6
	bl	reverse36
	str	wzr, [sp, 892]
	b	.L52
.L55:
	ldrsw	x1, [sp, 892]
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x1, sp, 208
	ldrb	w0, [x1, x0]
	mov	w5, w0
	ldrsw	x1, [sp, 892]
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x1, sp, 216
	ldr	w2, [x1, x0]
	ldrsw	x1, [sp, 892]
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x1, sp, 240
	ldr	w1, [x1, x0]
	ldr	w0, [sp, 892]
	cmp	w0, 5
	bne	.L53
	mov	w0, 10
	b	.L54
.L53:
	mov	w0, 32
.L54:
	mov	w4, w0
	mov	w3, w1
	mov	w1, w5
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [sp, 892]
	add	w0, w0, 1
	str	w0, [sp, 892]
.L52:
	ldr	w0, [sp, 892]
	cmp	w0, 5
	ble	.L55
	str	wzr, [sp, 888]
	b	.L56
.L59:
	str	wzr, [sp, 884]
	b	.L57
.L58:
	ldr	w1, [sp, 888]
	mov	w0, w1
	lsl	w0, w0, 3
	sub	w1, w0, w1
	ldr	w0, [sp, 884]
	add	w5, w1, w0
	ldr	w0, [sp, 888]
	and	w1, w0, 65535
	ldr	w0, [sp, 884]
	and	w0, w0, 65535
	sub	w0, w1, w0
	and	w0, w0, 65535
	sxth	w7, w0
	ldr	w0, [sp, 888]
	and	w1, w0, 65535
	ldr	w0, [sp, 884]
	and	w0, w0, 65535
	mul	w0, w1, w0
	and	w0, w0, 65535
	sxth	w6, w0
	ldr	w0, [sp, 888]
	mul	w1, w0, w0
	ldr	w0, [sp, 884]
	mul	w0, w0, w0
	sub	w4, w1, w0
	adrp	x0, grid
	add	x3, x0, :lo12:grid
	ldrsw	x0, [sp, 884]
	ldrsw	x2, [sp, 888]
	mov	x1, x0
	lsl	x1, x1, 1
	add	x1, x1, x0
	lsl	x0, x1, 2
	mov	x1, x0
	mov	x0, x2
	lsl	x0, x0, 2
	add	x0, x0, x2
	lsl	x0, x0, 2
	add	x0, x0, x2
	lsl	x0, x0, 2
	add	x0, x1, x0
	add	x0, x3, x0
	str	w5, [x0]
	adrp	x0, grid
	add	x3, x0, :lo12:grid
	ldrsw	x0, [sp, 884]
	ldrsw	x2, [sp, 888]
	mov	x1, x0
	lsl	x1, x1, 1
	add	x1, x1, x0
	lsl	x0, x1, 2
	mov	x1, x0
	mov	x0, x2
	lsl	x0, x0, 2
	add	x0, x0, x2
	lsl	x0, x0, 2
	add	x0, x0, x2
	lsl	x0, x0, 2
	add	x0, x1, x0
	add	x0, x3, x0
	mov	w1, w7
	strh	w1, [x0, 4]
	adrp	x0, grid
	add	x3, x0, :lo12:grid
	ldrsw	x0, [sp, 884]
	ldrsw	x2, [sp, 888]
	mov	x1, x0
	lsl	x1, x1, 1
	add	x1, x1, x0
	lsl	x0, x1, 2
	mov	x1, x0
	mov	x0, x2
	lsl	x0, x0, 2
	add	x0, x0, x2
	lsl	x0, x0, 2
	add	x0, x0, x2
	lsl	x0, x0, 2
	add	x0, x1, x0
	add	x0, x3, x0
	mov	w1, w6
	strh	w1, [x0, 6]
	adrp	x0, grid
	add	x3, x0, :lo12:grid
	ldrsw	x0, [sp, 884]
	ldrsw	x2, [sp, 888]
	mov	x1, x0
	lsl	x1, x1, 1
	add	x1, x1, x0
	lsl	x0, x1, 2
	mov	x1, x0
	mov	x0, x2
	lsl	x0, x0, 2
	add	x0, x0, x2
	lsl	x0, x0, 2
	add	x0, x0, x2
	lsl	x0, x0, 2
	add	x0, x1, x0
	add	x0, x3, x0
	str	w4, [x0, 8]
	ldr	w0, [sp, 884]
	add	w0, w0, 1
	str	w0, [sp, 884]
.L57:
	ldr	w0, [sp, 884]
	cmp	w0, 6
	ble	.L58
	ldr	w0, [sp, 888]
	add	w0, w0, 1
	str	w0, [sp, 888]
.L56:
	ldr	w0, [sp, 888]
	cmp	w0, 4
	ble	.L59
	str	xzr, [sp, 872]
	str	xzr, [sp, 864]
	str	wzr, [sp, 860]
	b	.L60
.L61:
	adrp	x0, grid
	add	x2, x0, :lo12:grid
	ldrsw	x1, [sp, 860]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 5
	add	x0, x2, x0
	ldr	x2, [x0]
	ldr	w1, [x0, 8]
	mov	x0, x2
	bl	score
	mov	x1, x0
	ldr	x0, [sp, 872]
	add	x0, x0, x1
	str	x0, [sp, 872]
	adrp	x0, grid
	add	x2, x0, :lo12:grid
	ldrsw	x1, [sp, 860]
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x0, x2, x0
	add	x0, x0, 72
	ldr	x2, [x0]
	ldr	w1, [x0, 8]
	mov	x0, x2
	bl	score
	mov	x1, x0
	ldr	x0, [sp, 864]
	add	x0, x0, x1
	str	x0, [sp, 864]
	ldr	w0, [sp, 860]
	add	w0, w0, 1
	str	w0, [sp, 860]
.L60:
	ldr	w0, [sp, 860]
	cmp	w0, 4
	ble	.L61
	mov	w3, 408
	ldr	x2, [sp, 864]
	ldr	x1, [sp, 872]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	str	xzr, [sp, 192]
	str	wzr, [sp, 200]
	str	wzr, [sp, 204]
	str	wzr, [sp, 856]
	b	.L62
.L65:
	ldr	w0, [sp, 856]
	str	w0, [sp, 136]
	ldr	w0, [sp, 856]
	neg	w0, w0
	str	w0, [sp, 140]
	ldr	w0, [sp, 856]
	mul	w0, w0, w0
	str	w0, [sp, 144]
	ldr	w1, [sp, 856]
	ldr	w0, [sp, 836]
	eor	w0, w1, w0
	str	w0, [sp, 148]
	mov	w1, 40
	ldr	w0, [sp, 856]
	sub	w0, w1, w0
	str	w0, [sp, 152]
	add	x0, sp, 32
	add	x1, sp, 136
	ldp	x2, x3, [x1]
	ldr	w1, [x1, 16]
	stp	x2, x3, [x0]
	str	w1, [x0, 16]
	add	x1, sp, 32
	add	x0, sp, 192
	bl	push
	cmp	w0, 0
	bne	.L63
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	mov	w0, 1
	b	.L70
.L63:
	ldr	w0, [sp, 856]
	add	w0, w0, 1
	str	w0, [sp, 856]
.L62:
	ldr	w0, [sp, 856]
	cmp	w0, 39
	ble	.L65
	str	xzr, [sp, 848]
	str	wzr, [sp, 844]
	b	.L66
.L69:
	str	wzr, [sp, 840]
	b	.L67
.L68:
	ldr	x1, [sp, 848]
	mov	x0, x1
	lsl	x0, x0, 5
	sub	x2, x0, x1
	ldr	x3, [sp, 192]
	ldrsw	x1, [sp, 844]
	mov	x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x0, x3, x0
	ldrsw	x1, [sp, 840]
	ldr	w0, [x0, x1, lsl 2]
	sxtw	x0, w0
	add	x0, x2, x0
	mov	x1, 36837
	movk	x1, 0x12a2, lsl 16
	movk	x1, 0x5f31, lsl 32
	movk	x1, 0x8970, lsl 48
	mul	x2, x0, x1
	smulh	x1, x0, x1
	mov	x20, x2
	mov	x21, x1
	mov	x1, x21
	add	x1, x0, x1
	asr	x2, x1, 29
	asr	x1, x0, 63
	sub	x2, x2, x1
	mov	x1, 51719
	movk	x1, 0x3b9a, lsl 16
	mul	x1, x2, x1
	sub	x0, x0, x1
	str	x0, [sp, 848]
	ldr	w0, [sp, 840]
	add	w0, w0, 1
	str	w0, [sp, 840]
.L67:
	ldr	w0, [sp, 840]
	cmp	w0, 4
	ble	.L68
	ldr	w0, [sp, 844]
	add	w0, w0, 1
	str	w0, [sp, 844]
.L66:
	ldr	w0, [sp, 200]
	ldr	w1, [sp, 844]
	cmp	w1, w0
	blt	.L69
	ldr	w0, [sp, 200]
	ldr	w1, [sp, 204]
	ldr	x3, [sp, 848]
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldr	x0, [sp, 192]
	bl	free
	mov	w4, 36
	mov	w3, 24
	mov	w2, 20
	mov	w1, 12
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	mov	w0, 0
.L70:
	ldp	x29, x30, [sp]
	ldp	x20, x21, [sp, 16]
	add	sp, sp, 944
	ret

