	.text
	.align	2
lsl_w:
	sub	sp, sp, #32
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 12]
	ldr	w1, [sp, 8]
// 10 "programs/87_shift_width.c" 1
	lsl w0, w0, w1
// 0 "" 2
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
lsr_w:
	sub	sp, sp, #32
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 12]
	ldr	w1, [sp, 8]
// 17 "programs/87_shift_width.c" 1
	lsr w0, w0, w1
// 0 "" 2
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
asr_w:
	sub	sp, sp, #32
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 12]
	ldr	w1, [sp, 8]
// 24 "programs/87_shift_width.c" 1
	asr w0, w0, w1
// 0 "" 2
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
ror_w:
	sub	sp, sp, #32
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 12]
	ldr	w1, [sp, 8]
// 31 "programs/87_shift_width.c" 1
	ror w0, w0, w1
// 0 "" 2
	str	w0, [sp, 28]
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
lsl_x:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldr	x1, [sp]
// 38 "programs/87_shift_width.c" 1
	lsl x0, x0, x1
// 0 "" 2
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
lsr_x:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldr	x1, [sp]
// 45 "programs/87_shift_width.c" 1
	lsr x0, x0, x1
// 0 "" 2
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
asr_x:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldr	x1, [sp]
// 52 "programs/87_shift_width.c" 1
	asr x0, x0, x1
// 0 "" 2
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
ror_x:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	ldr	x1, [sp]
// 59 "programs/87_shift_width.c" 1
	ror x0, x0, x1
// 0 "" 2
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
shl_masked:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 8]
	and	w0, w0, 31
	ldr	w1, [sp, 12]
	lsl	w0, w1, w0
	add	sp, sp, 16
	ret
	.align	2
shl_zero_past:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 8]
	cmp	w0, 31
	bhi	.L20
	ldr	w0, [sp, 8]
	ldr	w1, [sp, 12]
	lsl	w0, w1, w0
	b	.L22
.L20:
	mov	w0, 0
.L22:
	add	sp, sp, 16
	ret
	.align	2
rot_c:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 8]
	and	w0, w0, 31
	ldr	w1, [sp, 12]
	lsr	w1, w1, w0
	ldr	w0, [sp, 8]
	neg	w0, w0
	and	w0, w0, 31
	ldr	w2, [sp, 12]
	lsl	w0, w2, w0
	orr	w0, w1, w0
	add	sp, sp, 16
	ret
	.align	2
funnel:
	sub	sp, sp, #32
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	str	w2, [sp, 12]
	mov	w1, 64
	ldr	w0, [sp, 12]
	sub	w0, w1, w0
	ldr	x1, [sp, 24]
	lsl	x1, x1, x0
	ldr	w0, [sp, 12]
	ldr	x2, [sp, 16]
	lsr	x0, x2, x0
	orr	x0, x1, x0
	add	sp, sp, 32
	ret
	.data
	.align	2
wv:
	.word	-559038737
	.align	3
xv:
	.quad	-9141386507638288913
	.align	3
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
.LC3:
	.string	"%d >>1 %d >>31 %d | %ld >>1 %ld >>63 %ld >>33 %ld\n"
	.align	3
.LC4:
	.string	"byte %d %d %d %d\n"
	.align	3
.LC5:
	.string	"half %u %d %u\n"
	.align	3
.LC6:
	.string	"ubfx %lx sbfx %d\n"
	.align	3
.LC7:
	.string	"extr %u %016lx\n"
	.align	3
.LC8:
	.string	"extr fixed %016lx %016lx\n"
	.align	3
.LC9:
	.string	"rot %08x %08x %08x\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #240
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x19, x20, [sp, 32]
	stp	x21, x22, [sp, 48]
	stp	x23, x24, [sp, 64]
	stp	x25, x26, [sp, 80]
	str	x27, [sp, 96]
	adrp	x0, wv
	add	x0, x0, :lo12:wv
	ldr	w0, [x0]
	str	w0, [sp, 200]
	adrp	x0, xv
	add	x0, x0, :lo12:xv
	ldr	x0, [x0]
	str	x0, [sp, 192]
	mov	w0, 11
	str	w0, [sp, 188]
	str	wzr, [sp, 236]
	b	.L28
.L29:
	adrp	x0, counts
	add	x0, x0, :lo12:counts
	ldrsw	x1, [sp, 236]
	ldr	w0, [x0, x1, lsl 2]
	str	w0, [sp, 148]
	ldr	w1, [sp, 148]
	ldr	w0, [sp, 200]
	bl	lsl_w
	mov	w19, w0
	ldr	w1, [sp, 148]
	ldr	w0, [sp, 200]
	bl	lsr_w
	mov	w22, w0
	ldr	w0, [sp, 200]
	ldr	w1, [sp, 148]
	bl	asr_w
	mov	w23, w0
	ldr	w1, [sp, 148]
	ldr	w0, [sp, 200]
	bl	ror_w
	mov	w24, w0
	ldr	w0, [sp, 148]
	mov	x1, x0
	ldr	x0, [sp, 192]
	bl	lsl_x
	mov	x25, x0
	ldr	w0, [sp, 148]
	mov	x1, x0
	ldr	x0, [sp, 192]
	bl	lsr_x
	mov	x26, x0
	ldr	x0, [sp, 192]
	ldr	w1, [sp, 148]
	bl	asr_x
	mov	x27, x0
	ldr	w0, [sp, 148]
	mov	x1, x0
	ldr	x0, [sp, 192]
	bl	ror_x
	str	x0, [sp, 8]
	str	x27, [sp]
	mov	x7, x26
	mov	x6, x25
	mov	w5, w24
	mov	w4, w23
	mov	w3, w22
	mov	w2, w19
	ldr	w1, [sp, 148]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w0, [sp, 236]
	add	w0, w0, 1
	str	w0, [sp, 236]
.L28:
	ldr	w1, [sp, 236]
	ldr	w0, [sp, 188]
	cmp	w1, w0
	blt	.L29
	str	xzr, [sp, 224]
	str	wzr, [sp, 220]
	str	wzr, [sp, 216]
	b	.L30
.L33:
	ldr	x1, [sp, 224]
	mov	x0, x1
	lsl	x0, x0, 5
	sub	x19, x0, x1
	ldr	w1, [sp, 216]
	ldr	w0, [sp, 200]
	bl	lsl_w
	uxtw	x0, w0
	add	x0, x19, x0
	str	x0, [sp, 224]
	ldr	x1, [sp, 224]
	mov	x0, x1
	lsl	x0, x0, 5
	sub	x19, x0, x1
	ldr	w1, [sp, 216]
	ldr	w0, [sp, 200]
	bl	lsr_w
	uxtw	x0, w0
	add	x0, x19, x0
	str	x0, [sp, 224]
	ldr	x1, [sp, 224]
	mov	x0, x1
	lsl	x0, x0, 5
	sub	x19, x0, x1
	ldr	w0, [sp, 200]
	ldr	w1, [sp, 216]
	bl	asr_w
	uxtw	x0, w0
	add	x0, x19, x0
	str	x0, [sp, 224]
	ldr	x1, [sp, 224]
	mov	x0, x1
	lsl	x0, x0, 5
	sub	x19, x0, x1
	ldr	w1, [sp, 216]
	ldr	w0, [sp, 200]
	bl	ror_w
	uxtw	x0, w0
	add	x0, x19, x0
	str	x0, [sp, 224]
	ldr	x1, [sp, 224]
	mov	x0, x1
	lsl	x0, x0, 5
	sub	x19, x0, x1
	ldr	w0, [sp, 216]
	mov	x1, x0
	ldr	x0, [sp, 192]
	bl	lsl_x
	add	x0, x19, x0
	str	x0, [sp, 224]
	ldr	x1, [sp, 224]
	mov	x0, x1
	lsl	x0, x0, 5
	sub	x19, x0, x1
	ldr	w0, [sp, 216]
	mov	x1, x0
	ldr	x0, [sp, 192]
	bl	lsr_x
	add	x0, x19, x0
	str	x0, [sp, 224]
	ldr	x1, [sp, 224]
	mov	x0, x1
	lsl	x0, x0, 5
	sub	x19, x0, x1
	ldr	x0, [sp, 192]
	ldr	w1, [sp, 216]
	bl	asr_x
	add	x0, x19, x0
	str	x0, [sp, 224]
	ldr	x1, [sp, 224]
	mov	x0, x1
	lsl	x0, x0, 5
	sub	x19, x0, x1
	ldr	w0, [sp, 216]
	mov	x1, x0
	ldr	x0, [sp, 192]
	bl	ror_x
	add	x0, x19, x0
	str	x0, [sp, 224]
	ldr	w1, [sp, 216]
	ldr	w0, [sp, 200]
	bl	lsl_w
	mov	w19, w0
	ldr	w1, [sp, 216]
	ldr	w0, [sp, 200]
	bl	shl_masked
	cmp	w19, w0
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 220]
	add	w0, w0, w1
	str	w0, [sp, 220]
	ldr	w1, [sp, 216]
	ldr	w0, [sp, 200]
	bl	ror_w
	mov	w19, w0
	ldr	w1, [sp, 216]
	ldr	w0, [sp, 200]
	bl	rot_c
	cmp	w19, w0
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 220]
	add	w0, w0, w1
	str	w0, [sp, 220]
	ldr	w0, [sp, 216]
	mov	x1, x0
	ldr	x0, [sp, 192]
	bl	lsr_x
	mov	x2, x0
	ldr	w0, [sp, 216]
	and	w0, w0, 63
	ldr	x1, [sp, 192]
	lsr	x0, x1, x0
	cmp	x2, x0
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 220]
	add	w0, w0, w1
	str	w0, [sp, 220]
	ldr	w0, [sp, 216]
	cmp	w0, 31
	bhi	.L31
	ldr	w1, [sp, 216]
	ldr	w0, [sp, 200]
	bl	lsl_w
	mov	w19, w0
	b	.L32
.L31:
	mov	w19, 0
.L32:
	ldr	w1, [sp, 216]
	ldr	w0, [sp, 200]
	bl	shl_zero_past
	cmp	w19, w0
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 220]
	add	w0, w0, w1
	str	w0, [sp, 220]
	ldr	w0, [sp, 216]
	add	w0, w0, 1
	str	w0, [sp, 216]
.L30:
	ldr	w0, [sp, 216]
	cmp	w0, 130
	bls	.L33
	ldr	w2, [sp, 220]
	ldr	x1, [sp, 224]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	mov	w0, 30
	str	w0, [sp, 212]
	b	.L34
.L35:
	ldr	w1, [sp, 212]
	ldr	w0, [sp, 200]
	bl	shl_zero_past
	mov	w19, w0
	ldr	w1, [sp, 212]
	ldr	w0, [sp, 200]
	bl	shl_masked
	mov	w3, w0
	mov	w2, w19
	ldr	w1, [sp, 212]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	w0, [sp, 212]
	add	w0, w0, 1
	str	w0, [sp, 212]
.L34:
	ldr	w0, [sp, 212]
	cmp	w0, 34
	bls	.L35
	mov	x0, x20
	orr	x0, x0, 4294967295
	mov	x20, x0
	mov	x0, -2
	bfi	x20, x0, 32, 32
	mov	x0, -5
	bfi	x21, x0, 0, 32
	mov	x0, -2147483648
	bfi	x21, x0, 32, 32
	stp	x20, x21, [sp, 128]
	str	wzr, [sp, 208]
	b	.L36
.L37:
	ldrsw	x0, [sp, 208]
	lsl	x0, x0, 2
	add	x1, sp, 128
	ldr	w0, [x1, x0]
	str	w0, [sp, 164]
	ldrsw	x0, [sp, 164]
	lsl	x0, x0, 32
	str	x0, [sp, 152]
	ldr	w0, [sp, 164]
	asr	w1, w0, 1
	ldr	w0, [sp, 164]
	asr	w2, w0, 31
	ldr	x0, [sp, 152]
	asr	x3, x0, 1
	ldr	x0, [sp, 152]
	asr	x4, x0, 63
	ldr	x0, [sp, 152]
	asr	x0, x0, 33
	mov	x7, x0
	mov	x6, x4
	mov	x5, x3
	ldr	x4, [sp, 152]
	mov	w3, w2
	mov	w2, w1
	ldr	w1, [sp, 164]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w0, [sp, 208]
	add	w0, w0, 1
	str	w0, [sp, 208]
.L36:
	ldr	w0, [sp, 208]
	cmp	w0, 3
	ble	.L37
	mov	w0, -127
	strb	w0, [sp, 127]
	mov	w0, -32767
	strh	w0, [sp, 124]
	ldrb	w0, [sp, 127]
	lsl	w1, w0, 1
	ldrb	w0, [sp, 127]
	ubfiz	w0, w0, 1, 7
	and	w0, w0, 255
	mov	w2, w0
	ldrb	w0, [sp, 127]
	lsr	w0, w0, 7
	and	w0, w0, 255
	mov	w3, w0
	ldrb	w0, [sp, 127]
	sxtb	w0, w0
	asr	w0, w0, 1
	sxtb	w0, w0
	mov	w4, w0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldrh	w0, [sp, 124]
	lsl	w1, w0, 16
	ldrh	w0, [sp, 124]
	lsr	w0, w0, 15
	and	w0, w0, 65535
	mov	w2, w0
	ldrh	w0, [sp, 124]
	ubfiz	w0, w0, 1, 15
	and	w0, w0, 65535
	mov	w3, w0
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, xv
	add	x0, x0, :lo12:xv
	ldr	x0, [x0]
	str	x0, [sp, 176]
	adrp	x0, xv
	add	x0, x0, :lo12:xv
	ldr	x0, [x0]
	mvn	x0, x0
	str	x0, [sp, 168]
	ldr	x0, [sp, 192]
	lsr	x0, x0, 7
	and	x1, x0, 31
	ldr	w0, [sp, 200]
	lsl	w0, w0, 20
	asr	w0, w0, 27
	mov	w2, w0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	mov	w0, 1
	str	w0, [sp, 204]
	b	.L38
.L39:
	ldr	w2, [sp, 204]
	ldr	x1, [sp, 168]
	ldr	x0, [sp, 176]
	bl	funnel
	mov	x2, x0
	ldr	w1, [sp, 204]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	w0, [sp, 204]
	add	w0, w0, 13
	str	w0, [sp, 204]
.L38:
	ldr	w0, [sp, 204]
	cmp	w0, 63
	bls	.L39
	ldr	x0, [sp, 176]
	lsl	x1, x0, 13
	ldr	x0, [sp, 168]
	lsr	x0, x0, 51
	orr	x3, x1, x0
	ldr	x0, [sp, 168]
	lsl	x1, x0, 60
	ldr	x0, [sp, 176]
	lsr	x0, x0, 4
	orr	x0, x1, x0
	mov	x2, x0
	mov	x1, x3
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	mov	w1, 0
	ldr	w0, [sp, 200]
	bl	rot_c
	mov	w19, w0
	mov	w1, 8
	ldr	w0, [sp, 200]
	bl	rot_c
	mov	w20, w0
	mov	w1, 31
	ldr	w0, [sp, 200]
	bl	rot_c
	mov	w3, w0
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 16]
	ldp	x19, x20, [sp, 32]
	ldp	x21, x22, [sp, 48]
	ldp	x23, x24, [sp, 64]
	ldp	x25, x26, [sp, 80]
	ldr	x27, [sp, 96]
	add	sp, sp, 240
	ret

