	.text
	.align	2
	.align 5
lsl_w:
// 10 "programs/87_shift_width.c" 1
	lsl w0, w0, w1
// 0 "" 2
	ret
	.align	2
	.align 5
lsr_w:
// 17 "programs/87_shift_width.c" 1
	lsr w0, w0, w1
// 0 "" 2
	ret
	.align	2
	.align 5
asr_w:
// 24 "programs/87_shift_width.c" 1
	asr w0, w0, w1
// 0 "" 2
	ret
	.align	2
	.align 5
ror_w:
// 31 "programs/87_shift_width.c" 1
	ror w0, w0, w1
// 0 "" 2
	ret
	.align	2
	.align 5
lsl_x:
// 38 "programs/87_shift_width.c" 1
	lsl x0, x0, x1
// 0 "" 2
	ret
	.align	2
	.align 5
lsr_x:
// 45 "programs/87_shift_width.c" 1
	lsr x0, x0, x1
// 0 "" 2
	ret
	.align	2
	.align 5
asr_x:
// 52 "programs/87_shift_width.c" 1
	asr x0, x0, x1
// 0 "" 2
	ret
	.align	2
	.align 5
ror_x:
// 59 "programs/87_shift_width.c" 1
	ror x0, x0, x1
// 0 "" 2
	ret
	.align	2
	.align 5
shl_masked:
	lsl	w0, w0, w1
	ret
	.align	2
	.align 5
shl_zero_past:
	cmp	w1, 32
	lsl	w0, w0, w1
	csel	w0, w0, wzr, cc
	ret
	.align	2
	.align 5
rot_c:
	ror	w0, w0, w1
	ret
	.align	2
	.align 5
funnel:
	neg	w3, w2
	lsr	x1, x1, x2
	lsl	x0, x0, x3
	orr	x0, x0, x1
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"n=%u w: %08x %08x %08x %08x x: %016lx %016lx %016lx %016lx\n"
	.align	3
.LC1:
	.string	"sweep %016lx mismatches %d\n"
	.align	3
.LC2:
	.string	"zero-past %u: %08x masked %08x\n"
	.align	3
.LC4:
	.string	"%d >>1 %d >>31 %d | %ld >>1 %ld >>63 %ld >>33 %ld\n"
	.align	3
.LC5:
	.string	"byte %d %d %d %d\n"
	.align	3
.LC6:
	.string	"half %u %d %u\n"
	.align	3
.LC7:
	.string	"ubfx %lx sbfx %d\n"
	.align	3
.LC8:
	.string	"extr %u %016lx\n"
	.align	3
.LC9:
	.string	"extr fixed %016lx %016lx\n"
	.align	3
.LC10:
	.string	"rot %08x %08x %08x\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #112
	adrp	x0, .LANCHOR0
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x21, x22, [sp, 48]
	add	x21, x0, :lo12:.LANCHOR0
	mov	w22, 0
	stp	x19, x20, [sp, 32]
	ldr	w19, [x0, :lo12:.LANCHOR0]
	stp	x23, x24, [sp, 64]
	adrp	x23, .LC0
	add	x24, x21, 16
	ldr	x20, [x21, 8]
	add	x23, x23, :lo12:.LC0
	.align 5
.L17:
	ldr	w8, [x24, w22, sxtw 2]
	mov	w0, w19
	add	w22, w22, 1
	mov	w1, w8
	bl	lsl_w
	mov	w2, w0
	mov	w0, w19
	bl	lsr_w
	mov	w3, w0
	mov	w0, w19
	bl	asr_w
	mov	w4, w0
	mov	w0, w19
	bl	ror_w
	uxtw	x1, w8
	mov	w5, w0
	mov	x0, x20
	bl	lsl_x
	mov	x6, x0
	mov	x0, x20
	bl	lsr_x
	mov	x7, x0
	mov	x0, x20
	bl	asr_x
	mov	x9, x0
	mov	x0, x20
	bl	ror_x
	stp	x9, x0, [sp]
	mov	w1, w8
	mov	x0, x23
	bl	printf
	cmp	w22, 11
	bne	.L17
	mov	x4, 0
	mov	w2, 0
	mov	x3, 0
	.align 5
.L21:
	lsl	x0, x3, 5
	mov	w1, w4
	sub	x3, x0, x3
	mov	w0, w19
	bl	lsl_w
	mov	w5, w0
	add	x0, x3, w0, uxtw
	lsl	x3, x0, 5
	sub	x3, x3, x0
	mov	w0, w19
	bl	lsr_w
	add	x0, x3, w0, uxtw
	lsl	x3, x0, 5
	sub	x3, x3, x0
	mov	w0, w19
	bl	asr_w
	add	x0, x3, w0, uxtw
	lsl	x3, x0, 5
	sub	x3, x3, x0
	mov	w0, w19
	bl	ror_w
	mov	w6, w0
	add	x0, x3, w0, uxtw
	mov	x1, x4
	lsl	x3, x0, 5
	sub	x3, x3, x0
	mov	x0, x20
	bl	lsl_x
	add	x0, x0, x3
	lsl	x3, x0, 5
	sub	x3, x3, x0
	mov	x0, x20
	bl	lsr_x
	mov	x7, x0
	add	x0, x0, x3
	lsl	x3, x0, 5
	sub	x3, x3, x0
	mov	x0, x20
	bl	asr_x
	add	x0, x0, x3
	lsl	x3, x0, 5
	sub	x3, x3, x0
	mov	x0, x20
	bl	ror_x
	add	x3, x0, x3
	mov	w0, w19
	bl	shl_masked
	cmp	w0, w5
	mov	w0, w19
	cinc	w2, w2, ne
	bl	rot_c
	cmp	w0, w6
	cinc	w2, w2, ne
	lsr	x0, x20, x4
	cmp	x0, x7
	mov	w0, w19
	cinc	w2, w2, ne
	cmp	x4, 31
	bls	.L30
	bl	shl_zero_past
	add	x4, x4, 1
	cmp	w0, 0
	cinc	w2, w2, ne
	cmp	x4, 131
	bne	.L21
	adrp	x23, .LC2
	add	x23, x23, :lo12:.LC2
	mov	w22, 30
	mov	x1, x3
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
.L22:
	mov	w1, w22
	mov	w0, w19
	bl	shl_zero_past
	mov	w2, w0
	mov	w0, w19
	bl	shl_masked
	add	w22, w22, 1
	mov	w3, w0
	mov	x0, x23
	bl	printf
	cmp	w22, 35
	bne	.L22
	mov	x1, -9223372032559808513
	adrp	x23, .LC4
	add	x24, sp, 96
	add	x23, x23, :lo12:.LC4
	mov	x0, -4294967297
	movk	x1, 0xfffb, lsl 0
	mov	w22, 0
	stp	x0, x1, [sp, 96]
.L23:
	ldr	w1, [x24, w22, sxtw 2]
	mov	x0, x23
	add	w22, w22, 1
	sbfx	x7, x1, 1, 31
	sbfx	x6, x1, 31, 1
	sbfiz	x5, x1, 31, 32
	lsl	x4, x1, 32
	asr	w3, w1, 31
	asr	w2, w1, 1
	bl	printf
	cmp	w22, 4
	bne	.L23
	mov	w0, -127
	strb	w0, [sp, 93]
	mov	w0, -32767
	strh	w0, [sp, 94]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	ldrb	w1, [sp, 93]
	adrp	x23, .LC8
	ldrb	w2, [sp, 93]
	add	x23, x23, :lo12:.LC8
	ldrb	w3, [sp, 93]
	ldrsb	w4, [sp, 93]
	lsl	w1, w1, 1
	ubfiz	w2, w2, 1, 7
	lsr	w3, w3, 7
	asr	w4, w4, 1
	bl	printf
	ldrh	w1, [sp, 94]
	adrp	x0, .LC6
	ldrh	w2, [sp, 94]
	add	x0, x0, :lo12:.LC6
	ldrh	w3, [sp, 94]
	lsl	w1, w1, 16
	lsr	w2, w2, 15
	ubfiz	w3, w3, 1, 15
	bl	printf
	ldr	x22, [x21, 8]
	ubfx	x1, x20, 7, 5
	ldr	x21, [x21, 8]
	adrp	x0, .LC7
	sbfx	x2, x19, 7, 5
	add	x0, x0, :lo12:.LC7
	mvn	x21, x21
	mov	w20, 1
	bl	printf
.L24:
	mov	w2, w20
	mov	x1, x21
	mov	x0, x22
	bl	funnel
	mov	w1, w20
	mov	x2, x0
	add	w20, w20, 13
	mov	x0, x23
	bl	printf
	cmp	w20, 66
	bne	.L24
	adrp	x0, .LC9
	extr	x2, x21, x22, 4
	add	x0, x0, :lo12:.LC9
	extr	x1, x22, x21, 51
	bl	printf
	mov	w0, w19
	mov	w1, 0
	bl	rot_c
	mov	w4, w0
	mov	w1, 8
	mov	w0, w19
	bl	rot_c
	mov	w1, 31
	mov	w2, w0
	mov	w0, w19
	bl	rot_c
	mov	w1, w4
	mov	w3, w0
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldp	x29, x30, [sp, 16]
	mov	w0, 0
	ldp	x19, x20, [sp, 32]
	ldp	x21, x22, [sp, 48]
	ldp	x23, x24, [sp, 64]
	add	sp, sp, 112
	ret
	.align 2
.L30:
	bl	shl_zero_past
	cmp	w5, w0
	cinc	w2, w2, ne
	add	x4, x4, 1
	b	.L21
	.data
	.align	4
	.LANCHOR0:
wv:
	.word	-559038737
	.zero	4
xv:
	.quad	-9141386507638288913
counts:
	.word	0
	.word	1
	.word	31
	.word	32
	.word	33
	.word	63
	.word	64
	.word	65
	.word	100
	.word	255
	.word	-31

