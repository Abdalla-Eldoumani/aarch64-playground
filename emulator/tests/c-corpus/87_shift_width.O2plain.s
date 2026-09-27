	.text
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
	stp	x19, x20, [sp, 32]
	add	x19, x0, :lo12:.LANCHOR0
	ldr	w20, [x0, :lo12:.LANCHOR0]
	stp	x21, x22, [sp, 48]
	mov	w22, 0
	stp	x23, x24, [sp, 64]
	adrp	x23, .LC0
	add	x24, x19, 16
	ldr	x21, [x19, 8]
	add	x23, x23, :lo12:.LC0
	.align 5
.L2:
	ldr	w1, [x24, w22, sxtw 2]
	add	w22, w22, 1
// 10 "programs/87_shift_width.c" 1
	lsl w2, w20, w1
// 0 "" 2
	uxtw	x0, w1
// 52 "programs/87_shift_width.c" 1
	asr x8, x21, x0
// 0 "" 2
// 38 "programs/87_shift_width.c" 1
	lsl x6, x21, x0
// 0 "" 2
// 45 "programs/87_shift_width.c" 1
	lsr x7, x21, x0
// 0 "" 2
// 59 "programs/87_shift_width.c" 1
	ror x0, x21, x0
// 0 "" 2
	stp	x8, x0, [sp]
	mov	x0, x23
// 17 "programs/87_shift_width.c" 1
	lsr w3, w20, w1
// 0 "" 2
// 24 "programs/87_shift_width.c" 1
	asr w4, w20, w1
// 0 "" 2
// 31 "programs/87_shift_width.c" 1
	ror w5, w20, w1
// 0 "" 2
	bl	printf
	cmp	w22, 11
	bne	.L2
	mov	x0, 0
	mov	w2, 0
	mov	x1, 0
	.align 5
.L6:
	lsl	x3, x1, 5
	sub	x1, x3, x1
// 10 "programs/87_shift_width.c" 1
	lsl w4, w20, w0
// 0 "" 2
	add	x1, x1, w4, uxtw
// 31 "programs/87_shift_width.c" 1
	ror w6, w20, w0
// 0 "" 2
	lsl	x3, x1, 5
	sub	x3, x3, x1
// 17 "programs/87_shift_width.c" 1
	lsr w1, w20, w0
// 0 "" 2
	add	x1, x3, w1, uxtw
// 45 "programs/87_shift_width.c" 1
	lsr x5, x21, x0
// 0 "" 2
	lsl	x3, x1, 5
	sub	x1, x3, x1
// 24 "programs/87_shift_width.c" 1
	asr w3, w20, w0
// 0 "" 2
	add	x3, x1, w3, uxtw
	lsl	x1, x3, 5
	sub	x1, x1, x3
	add	x1, x1, w6, uxtw
	lsl	x3, x1, 5
	sub	x3, x3, x1
// 38 "programs/87_shift_width.c" 1
	lsl x1, x21, x0
// 0 "" 2
	add	x3, x3, x1
	lsl	x1, x3, 5
	sub	x1, x1, x3
	add	x1, x1, x5
	lsl	x3, x1, 5
	sub	x1, x3, x1
// 52 "programs/87_shift_width.c" 1
	asr x3, x21, x0
// 0 "" 2
	add	x3, x3, x1
	lsl	x1, x3, 5
	sub	x1, x1, x3
// 59 "programs/87_shift_width.c" 1
	ror x3, x21, x0
// 0 "" 2
	add	x1, x1, x3
	and	w3, w0, 31
	lsl	w7, w20, w3
	cmp	w7, w4
	cinc	w2, w2, ne
	ror	w3, w20, w3
	cmp	w3, w6
	lsr	x3, x21, x0
	cinc	w2, w2, ne
	cmp	x3, x5
	cinc	w2, w2, ne
	cmp	x0, 31
	bls	.L18
	add	x0, x0, 1
	cmp	x0, 131
	bne	.L6
	adrp	x23, .LC2
	add	x23, x23, :lo12:.LC2
	mov	w22, 30
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
.L10:
	cmp	w22, 31
	bhi	.L7
.L19:
	lsl	w3, w20, w22
	mov	w1, w22
	mov	w2, w3
	mov	x0, x23
	add	w22, w22, 1
	bl	printf
	cmp	w22, 31
	bls	.L19
.L7:
	mov	w1, w22
	lsl	w3, w20, w22
	mov	x0, x23
	mov	w2, 0
	add	w22, w22, 1
	bl	printf
	cmp	w22, 35
	bne	.L10
	mov	x1, -9223372032559808513
	adrp	x23, .LC4
	add	x24, sp, 96
	add	x23, x23, :lo12:.LC4
	mov	x0, -4294967297
	movk	x1, 0xfffb, lsl 0
	mov	w22, 0
	stp	x0, x1, [sp, 96]
.L11:
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
	bne	.L11
	mov	w0, -127
	strb	w0, [sp, 93]
	mov	w0, -32767
	strh	w0, [sp, 94]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	ldrb	w1, [sp, 93]
	mov	w24, 64
	ldrb	w2, [sp, 93]
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
	ldr	x23, [x19, 8]
	ubfx	x1, x21, 7, 5
	ldr	x22, [x19, 8]
	adrp	x21, .LC8
	add	x21, x21, :lo12:.LC8
	mov	w19, 1
	mvn	x22, x22
	sbfx	x2, x20, 7, 5
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
.L12:
	sub	w0, w24, w19
	mov	w1, w19
	lsr	x2, x22, x19
	add	w19, w19, 13
	lsl	x0, x23, x0
	orr	x2, x0, x2
	mov	x0, x21
	bl	printf
	cmp	w19, 66
	bne	.L12
	adrp	x0, .LC9
	extr	x2, x22, x23, 4
	add	x0, x0, :lo12:.LC9
	extr	x1, x23, x22, 51
	bl	printf
	mov	w1, w20
	ror	w3, w20, 31
	adrp	x0, .LC10
	ror	w2, w20, 8
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
.L18:
	lsl	w3, w20, w0
	cmp	w3, w4
	cinc	w2, w2, ne
	add	x0, x0, 1
	b	.L6
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

