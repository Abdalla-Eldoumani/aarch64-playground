	.text
	.data
	.align	2
seed:
	.word	88172645
	.section .rodata
	.align	3
text:
	.string	"Hello, World! the quick brown fox jumps over the lazy dog 0123456789 ~{}"
	.text
	.align	2
fill:
	sub	sp, sp, #16
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	w0, [x0]
	str	w0, [sp, 12]
	str	wzr, [sp, 8]
	b	.L2
.L5:
	ldr	w1, [sp, 12]
	mov	w0, 26125
	movk	w0, 0x19, lsl 16
	mul	w1, w1, w0
	mov	w0, 62303
	movk	w0, 0x3c6e, lsl 16
	add	w0, w1, w0
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	and	w0, w0, 32
	cmp	w0, 0
	beq	.L3
	ldr	w0, [sp, 12]
	lsr	w0, w0, 24
	and	w2, w0, 255
	b	.L4
.L3:
	ldrsw	x2, [sp, 8]
	mov	x0, 58255
	movk	x0, 0x8e38, lsl 16
	movk	x0, 0x38e3, lsl 32
	movk	x0, 0xe38e, lsl 48
	umulh	x0, x2, x0
	lsr	x1, x0, 6
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	lsl	x0, x0, 3
	sub	x1, x2, x0
	adrp	x0, text
	add	x0, x0, :lo12:text
	ldrb	w2, [x0, x1]
.L4:
	adrp	x0, src
	add	x1, x0, :lo12:src
	ldrsw	x0, [sp, 8]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	lsr	w0, w0, 16
	and	w2, w0, 255
	adrp	x0, src2
	add	x1, x0, :lo12:src2
	ldrsw	x0, [sp, 8]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	lsr	w0, w0, 8
	sxtb	w2, w0
	adrp	x0, sgn
	add	x1, x0, :lo12:sgn
	ldrsw	x0, [sp, 8]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L2:
	ldr	w0, [sp, 8]
	cmp	w0, 511
	ble	.L5
	adrp	x0, src
	add	x0, x0, :lo12:src
	mov	w1, -1
	strb	w1, [x0, 1]
	adrp	x0, src2
	add	x0, x0, :lo12:src2
	mov	w1, -1
	strb	w1, [x0, 1]
	adrp	x0, src
	add	x0, x0, :lo12:src
	strb	wzr, [x0, 2]
	adrp	x0, src2
	add	x0, x0, :lo12:src2
	mov	w1, -1
	strb	w1, [x0, 2]
	adrp	x0, sgn
	add	x0, x0, :lo12:sgn
	mov	w1, -128
	strb	w1, [x0, 3]
	nop
	add	sp, sp, 16
	ret
	.align	2
hash:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	w1, [sp, 4]
	mov	w0, 40389
	movk	w0, 0x811c, lsl 16
	str	w0, [sp, 28]
	str	wzr, [sp, 24]
	b	.L7
.L8:
	ldrsw	x0, [sp, 24]
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	ldrb	w0, [x0]
	mov	w1, w0
	ldr	w0, [sp, 28]
	eor	w1, w1, w0
	mov	w0, 403
	movk	w0, 0x100, lsl 16
	mul	w0, w1, w0
	str	w0, [sp, 28]
	ldr	w0, [sp, 24]
	add	w0, w0, 1
	str	w0, [sp, 24]
.L7:
	ldr	w1, [sp, 24]
	ldr	w0, [sp, 4]
	cmp	w1, w0
	blt	.L8
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"%-9s %08x %02x %02x %02x %02x %02x\n"
	.text
	.align	2
report:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x0, [sp, 24]
	mov	w1, 512
	adrp	x0, dst
	add	x0, x0, :lo12:dst
	bl	hash
	mov	w1, w0
	adrp	x0, dst
	add	x0, x0, :lo12:dst
	ldrb	w0, [x0]
	mov	w2, w0
	adrp	x0, dst
	add	x0, x0, :lo12:dst
	ldrb	w0, [x0, 1]
	mov	w3, w0
	adrp	x0, dst
	add	x0, x0, :lo12:dst
	ldrb	w0, [x0, 2]
	mov	w4, w0
	adrp	x0, dst
	add	x0, x0, :lo12:dst
	ldrb	w0, [x0, 3]
	mov	w5, w0
	adrp	x0, dst
	add	x0, x0, :lo12:dst
	ldrb	w0, [x0, 511]
	mov	w7, w0
	mov	w6, w5
	mov	w5, w4
	mov	w4, w3
	mov	w3, w2
	mov	w2, w1
	ldr	x1, [sp, 24]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	nop
	ldp	x29, x30, [sp], 32
	ret
	.align	2
xor_key:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	b	.L12
.L13:
	adrp	x0, src
	add	x1, x0, :lo12:src
	ldrsw	x0, [sp, 12]
	ldrb	w1, [x1, x0]
	mov	w0, 90
	eor	w0, w1, w0
	and	w2, w0, 255
	adrp	x0, dst
	add	x1, x0, :lo12:dst
	ldrsw	x0, [sp, 12]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 12]
.L12:
	ldr	w0, [sp, 12]
	cmp	w0, 511
	ble	.L13
	nop
	nop
	add	sp, sp, 16
	ret
	.align	2
to_upper:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	b	.L15
.L18:
	adrp	x0, src
	add	x1, x0, :lo12:src
	ldrsw	x0, [sp, 12]
	ldrb	w0, [x1, x0]
	strb	w0, [sp, 11]
	ldrb	w0, [sp, 11]
	sub	w0, w0, #97
	and	w0, w0, 255
	cmp	w0, 25
	bhi	.L16
	ldrb	w0, [sp, 11]
	sub	w0, w0, #32
	and	w2, w0, 255
	b	.L17
.L16:
	ldrb	w2, [sp, 11]
.L17:
	adrp	x0, dst
	add	x1, x0, :lo12:dst
	ldrsw	x0, [sp, 12]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 12]
.L15:
	ldr	w0, [sp, 12]
	cmp	w0, 511
	ble	.L18
	nop
	nop
	add	sp, sp, 16
	ret
	.align	2
rot13:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	b	.L20
.L25:
	adrp	x0, src
	add	x1, x0, :lo12:src
	ldrsw	x0, [sp, 12]
	ldrb	w0, [x1, x0]
	strb	w0, [sp, 10]
	ldrb	w0, [sp, 10]
	cmp	w0, 109
	bls	.L21
	ldrb	w0, [sp, 10]
	sub	w0, w0, #13
	strb	w0, [sp, 11]
	b	.L22
.L21:
	ldrb	w0, [sp, 10]
	add	w0, w0, 13
	strb	w0, [sp, 11]
.L22:
	ldrb	w0, [sp, 10]
	cmp	w0, 96
	bls	.L23
	ldrb	w0, [sp, 10]
	cmp	w0, 122
	bhi	.L23
	ldrb	w2, [sp, 11]
	b	.L24
.L23:
	ldrb	w2, [sp, 10]
.L24:
	adrp	x0, dst
	add	x1, x0, :lo12:dst
	ldrsw	x0, [sp, 12]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 12]
.L20:
	ldr	w0, [sp, 12]
	cmp	w0, 511
	ble	.L25
	nop
	nop
	add	sp, sp, 16
	ret
	.align	2
sat_add:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	b	.L27
.L28:
	adrp	x0, src
	add	x1, x0, :lo12:src
	ldrsw	x0, [sp, 12]
	ldrb	w0, [x1, x0]
	mov	w2, w0
	adrp	x0, src2
	add	x1, x0, :lo12:src2
	ldrsw	x0, [sp, 12]
	ldrb	w0, [x1, x0]
	add	w0, w2, w0
	str	w0, [sp, 8]
	ldr	w2, [sp, 8]
	ldr	w1, [sp, 8]
	mov	w0, 255
	cmp	w2, 255
	csel	w0, w1, w0, le
	and	w2, w0, 255
	adrp	x0, dst
	add	x1, x0, :lo12:dst
	ldrsw	x0, [sp, 12]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 12]
.L27:
	ldr	w0, [sp, 12]
	cmp	w0, 511
	ble	.L28
	nop
	nop
	add	sp, sp, 16
	ret
	.align	2
sat_sub:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	b	.L30
.L31:
	adrp	x0, src
	add	x1, x0, :lo12:src
	ldrsw	x0, [sp, 12]
	ldrb	w0, [x1, x0]
	mov	w2, w0
	adrp	x0, src2
	add	x1, x0, :lo12:src2
	ldrsw	x0, [sp, 12]
	ldrb	w0, [x1, x0]
	sub	w0, w2, w0
	str	w0, [sp, 8]
	ldr	w0, [sp, 8]
	bic	w0, w0, w0, asr #31
	and	w2, w0, 255
	adrp	x0, dst
	add	x1, x0, :lo12:dst
	ldrsw	x0, [sp, 12]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 12]
.L30:
	ldr	w0, [sp, 12]
	cmp	w0, 511
	ble	.L31
	nop
	nop
	add	sp, sp, 16
	ret
	.align	2
avg_round:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	b	.L33
.L34:
	adrp	x0, src
	add	x1, x0, :lo12:src
	ldrsw	x0, [sp, 12]
	ldrb	w0, [x1, x0]
	mov	w2, w0
	adrp	x0, src2
	add	x1, x0, :lo12:src2
	ldrsw	x0, [sp, 12]
	ldrb	w0, [x1, x0]
	add	w0, w2, w0
	add	w0, w0, 1
	asr	w0, w0, 1
	and	w2, w0, 255
	adrp	x0, dst
	add	x1, x0, :lo12:dst
	ldrsw	x0, [sp, 12]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 12]
.L33:
	ldr	w0, [sp, 12]
	cmp	w0, 511
	ble	.L34
	nop
	nop
	add	sp, sp, 16
	ret
	.align	2
abs_diff:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	b	.L36
.L39:
	adrp	x0, src
	add	x1, x0, :lo12:src
	ldrsw	x0, [sp, 12]
	ldrb	w1, [x1, x0]
	adrp	x0, src2
	add	x2, x0, :lo12:src2
	ldrsw	x0, [sp, 12]
	ldrb	w0, [x2, x0]
	cmp	w1, w0
	bls	.L37
	adrp	x0, src
	add	x1, x0, :lo12:src
	ldrsw	x0, [sp, 12]
	ldrb	w1, [x1, x0]
	adrp	x0, src2
	add	x2, x0, :lo12:src2
	ldrsw	x0, [sp, 12]
	ldrb	w0, [x2, x0]
	sub	w0, w1, w0
	and	w2, w0, 255
	b	.L38
.L37:
	adrp	x0, src2
	add	x1, x0, :lo12:src2
	ldrsw	x0, [sp, 12]
	ldrb	w1, [x1, x0]
	adrp	x0, src
	add	x2, x0, :lo12:src
	ldrsw	x0, [sp, 12]
	ldrb	w0, [x2, x0]
	sub	w0, w1, w0
	and	w2, w0, 255
.L38:
	adrp	x0, dst
	add	x1, x0, :lo12:dst
	ldrsw	x0, [sp, 12]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 12]
.L36:
	ldr	w0, [sp, 12]
	cmp	w0, 511
	ble	.L39
	nop
	nop
	add	sp, sp, 16
	ret
	.align	2
max_u8:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	b	.L41
.L42:
	adrp	x0, src2
	add	x1, x0, :lo12:src2
	ldrsw	x0, [sp, 12]
	ldrb	w0, [x1, x0]
	adrp	x1, src
	add	x2, x1, :lo12:src
	ldrsw	x1, [sp, 12]
	ldrb	w1, [x2, x1]
	and	w2, w1, 255
	cmp	w2, w0
	csel	w0, w1, w0, hi
	and	w2, w0, 255
	adrp	x0, dst
	add	x1, x0, :lo12:dst
	ldrsw	x0, [sp, 12]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 12]
.L41:
	ldr	w0, [sp, 12]
	cmp	w0, 511
	ble	.L42
	nop
	nop
	add	sp, sp, 16
	ret
	.align	2
rotl3:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	b	.L44
.L45:
	adrp	x0, src
	add	x1, x0, :lo12:src
	ldrsw	x0, [sp, 12]
	ldrb	w0, [x1, x0]
	sxtb	w0, w0
	ubfiz	w0, w0, 3, 5
	sxtb	w1, w0
	adrp	x0, src
	add	x2, x0, :lo12:src
	ldrsw	x0, [sp, 12]
	ldrb	w0, [x2, x0]
	lsr	w0, w0, 5
	and	w0, w0, 255
	sxtb	w0, w0
	orr	w0, w1, w0
	sxtb	w0, w0
	and	w2, w0, 255
	adrp	x0, dst
	add	x1, x0, :lo12:dst
	ldrsw	x0, [sp, 12]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 12]
.L44:
	ldr	w0, [sp, 12]
	cmp	w0, 511
	ble	.L45
	nop
	nop
	add	sp, sp, 16
	ret
	.align	2
abs_s8:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	b	.L47
.L50:
	adrp	x0, sgn
	add	x1, x0, :lo12:sgn
	ldrsw	x0, [sp, 12]
	ldrsb	w0, [x1, x0]
	cmp	w0, 0
	bge	.L48
	adrp	x0, sgn
	add	x1, x0, :lo12:sgn
	ldrsw	x0, [sp, 12]
	ldrsb	w0, [x1, x0]
	and	w0, w0, 255
	neg	w0, w0
	and	w2, w0, 255
	b	.L49
.L48:
	adrp	x0, sgn
	add	x1, x0, :lo12:sgn
	ldrsw	x0, [sp, 12]
	ldrsb	w0, [x1, x0]
	and	w2, w0, 255
.L49:
	adrp	x0, dst
	add	x1, x0, :lo12:dst
	ldrsw	x0, [sp, 12]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 12]
.L47:
	ldr	w0, [sp, 12]
	cmp	w0, 511
	ble	.L50
	nop
	nop
	add	sp, sp, 16
	ret
	.align	2
widen_mul:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	b	.L52
.L53:
	adrp	x0, src
	add	x1, x0, :lo12:src
	ldrsw	x0, [sp, 12]
	ldrb	w0, [x1, x0]
	mov	w1, w0
	mov	w0, 300
	mul	w0, w1, w0
	and	w0, w0, 65535
	adrp	x1, src2
	add	x2, x1, :lo12:src2
	ldrsw	x1, [sp, 12]
	ldrb	w1, [x2, x1]
	add	w0, w0, w1
	and	w2, w0, 65535
	adrp	x0, w16
	add	x0, x0, :lo12:w16
	ldrsw	x1, [sp, 12]
	strh	w2, [x0, x1, lsl 1]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 12]
.L52:
	ldr	w0, [sp, 12]
	cmp	w0, 511
	ble	.L53
	nop
	nop
	add	sp, sp, 16
	ret
	.align	2
narrow_hi:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	b	.L55
.L56:
	adrp	x0, w16
	add	x0, x0, :lo12:w16
	ldrsw	x1, [sp, 12]
	ldrh	w0, [x0, x1, lsl 1]
	lsr	w0, w0, 8
	and	w0, w0, 65535
	and	w2, w0, 255
	adrp	x0, dst
	add	x1, x0, :lo12:dst
	ldrsw	x0, [sp, 12]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 12]
.L55:
	ldr	w0, [sp, 12]
	cmp	w0, 511
	ble	.L56
	nop
	nop
	add	sp, sp, 16
	ret
	.align	2
pair_sum:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	b	.L58
.L59:
	ldr	w0, [sp, 12]
	lsl	w2, w0, 1
	adrp	x0, src
	add	x1, x0, :lo12:src
	sxtw	x0, w2
	ldrb	w1, [x1, x0]
	ldr	w0, [sp, 12]
	lsl	w0, w0, 1
	add	w3, w0, 1
	adrp	x0, src
	add	x2, x0, :lo12:src
	sxtw	x0, w3
	ldrb	w0, [x2, x0]
	add	w0, w1, w0
	and	w2, w0, 255
	adrp	x0, dst
	add	x1, x0, :lo12:dst
	ldrsw	x0, [sp, 12]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 12]
.L58:
	ldr	w0, [sp, 12]
	cmp	w0, 255
	ble	.L59
	mov	w0, 256
	str	w0, [sp, 8]
	b	.L60
.L61:
	adrp	x0, dst
	add	x1, x0, :lo12:dst
	ldrsw	x0, [sp, 8]
	strb	wzr, [x1, x0]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L60:
	ldr	w0, [sp, 8]
	cmp	w0, 511
	ble	.L61
	nop
	nop
	add	sp, sp, 16
	ret
	.align	2
interleave:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	b	.L63
.L64:
	ldr	w0, [sp, 12]
	lsl	w3, w0, 1
	adrp	x0, src
	add	x1, x0, :lo12:src
	ldrsw	x0, [sp, 12]
	ldrb	w2, [x1, x0]
	adrp	x0, pair
	add	x1, x0, :lo12:pair
	sxtw	x0, w3
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	lsl	w0, w0, 1
	add	w3, w0, 1
	adrp	x0, src2
	add	x1, x0, :lo12:src2
	ldrsw	x0, [sp, 12]
	ldrb	w2, [x1, x0]
	adrp	x0, pair
	add	x1, x0, :lo12:pair
	sxtw	x0, w3
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	str	w0, [sp, 12]
.L63:
	ldr	w0, [sp, 12]
	cmp	w0, 511
	ble	.L64
	nop
	nop
	add	sp, sp, 16
	ret
	.align	2
count_space:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	str	wzr, [sp, 8]
	b	.L66
.L67:
	adrp	x0, src
	add	x1, x0, :lo12:src
	ldrsw	x0, [sp, 8]
	ldrb	w0, [x1, x0]
	cmp	w0, 32
	cset	w0, eq
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 12]
	add	w0, w0, w1
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L66:
	ldr	w0, [sp, 8]
	cmp	w0, 511
	ble	.L67
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"xor"
	.align	3
.LC2:
	.string	"upper"
	.align	3
.LC3:
	.string	"rot13"
	.align	3
.LC4:
	.string	"sat_add"
	.align	3
.LC5:
	.string	"sat_sub"
	.align	3
.LC6:
	.string	"avg"
	.align	3
.LC7:
	.string	"absdiff"
	.align	3
.LC8:
	.string	"max"
	.align	3
.LC9:
	.string	"rotl3"
	.align	3
.LC10:
	.string	"abs_s8"
	.align	3
.LC11:
	.string	"narrow"
	.align	3
.LC12:
	.string	"pairsum"
	.align	3
.LC13:
	.string	"interleave %08x %02x %02x %02x\n"
	.align	3
.LC14:
	.string	"wide %04x %04x %04x\n"
	.align	3
.LC15:
	.string	"spaces %d\n"
	.align	3
.LC16:
	.string	"bswap %08x %08x %08x\n"
	.align	3
.LC17:
	.string	"again"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	bl	fill
	bl	xor_key
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	report
	bl	to_upper
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	report
	bl	rot13
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	report
	bl	sat_add
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	report
	bl	sat_sub
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	report
	bl	avg_round
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	report
	bl	abs_diff
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	report
	bl	max_u8
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	report
	bl	rotl3
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	report
	bl	abs_s8
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	report
	bl	widen_mul
	bl	narrow_hi
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	report
	bl	pair_sum
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	report
	bl	interleave
	mov	w1, 1024
	adrp	x0, pair
	add	x0, x0, :lo12:pair
	bl	hash
	mov	w1, w0
	adrp	x0, pair
	add	x0, x0, :lo12:pair
	ldrb	w0, [x0]
	mov	w2, w0
	adrp	x0, pair
	add	x0, x0, :lo12:pair
	ldrb	w0, [x0, 1]
	mov	w3, w0
	adrp	x0, pair
	add	x0, x0, :lo12:pair
	ldrb	w0, [x0, 1023]
	mov	w4, w0
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	adrp	x0, w16
	add	x0, x0, :lo12:w16
	ldrh	w0, [x0]
	mov	w1, w0
	adrp	x0, w16
	add	x0, x0, :lo12:w16
	ldrh	w0, [x0, 2]
	mov	w2, w0
	adrp	x0, w16
	add	x0, x0, :lo12:w16
	ldrh	w0, [x0, 1022]
	mov	w3, w0
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	printf
	bl	count_space
	mov	w1, w0
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	str	wzr, [sp, 44]
	b	.L70
.L71:
	ldr	w0, [sp, 44]
	lsl	w2, w0, 2
	adrp	x0, src
	add	x1, x0, :lo12:src
	sxtw	x0, w2
	ldrb	w0, [x1, x0]
	mov	w2, w0
	ldr	w0, [sp, 44]
	lsl	w0, w0, 2
	add	w3, w0, 1
	adrp	x0, src
	add	x1, x0, :lo12:src
	sxtw	x0, w3
	ldrb	w0, [x1, x0]
	lsl	w0, w0, 8
	orr	w1, w2, w0
	ldr	w0, [sp, 44]
	lsl	w0, w0, 2
	add	w3, w0, 2
	adrp	x0, src
	add	x2, x0, :lo12:src
	sxtw	x0, w3
	ldrb	w0, [x2, x0]
	lsl	w0, w0, 16
	orr	w1, w1, w0
	ldr	w0, [sp, 44]
	lsl	w0, w0, 2
	add	w3, w0, 3
	adrp	x0, src
	add	x2, x0, :lo12:src
	sxtw	x0, w3
	ldrb	w0, [x2, x0]
	lsl	w0, w0, 24
	orr	w2, w1, w0
	adrp	x0, w32
	add	x0, x0, :lo12:w32
	ldrsw	x1, [sp, 44]
	str	w2, [x0, x1, lsl 2]
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L70:
	ldr	w0, [sp, 44]
	cmp	w0, 127
	ble	.L71
	str	wzr, [sp, 40]
	b	.L72
.L73:
	adrp	x0, w32
	add	x0, x0, :lo12:w32
	ldrsw	x1, [sp, 40]
	ldr	w0, [x0, x1, lsl 2]
	rev	w2, w0
	adrp	x0, w32
	add	x0, x0, :lo12:w32
	ldrsw	x1, [sp, 40]
	str	w2, [x0, x1, lsl 2]
	ldr	w0, [sp, 40]
	add	w0, w0, 1
	str	w0, [sp, 40]
.L72:
	ldr	w0, [sp, 40]
	cmp	w0, 127
	ble	.L73
	str	wzr, [sp, 36]
	str	wzr, [sp, 32]
	b	.L74
.L75:
	ldr	w1, [sp, 36]
	mov	w0, w1
	lsl	w0, w0, 5
	sub	w1, w0, w1
	adrp	x0, w32
	add	x0, x0, :lo12:w32
	ldrsw	x2, [sp, 32]
	ldr	w0, [x0, x2, lsl 2]
	add	w0, w1, w0
	str	w0, [sp, 36]
	ldr	w0, [sp, 32]
	add	w0, w0, 1
	str	w0, [sp, 32]
.L74:
	ldr	w0, [sp, 32]
	cmp	w0, 127
	ble	.L75
	adrp	x0, w32
	add	x0, x0, :lo12:w32
	ldr	w1, [x0]
	adrp	x0, w32
	add	x0, x0, :lo12:w32
	ldr	w0, [x0, 508]
	mov	w3, w0
	mov	w2, w1
	ldr	w1, [sp, 36]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	str	wzr, [sp, 28]
	b	.L76
.L77:
	adrp	x0, dst
	add	x1, x0, :lo12:dst
	ldrsw	x0, [sp, 28]
	ldrb	w2, [x1, x0]
	adrp	x0, src
	add	x1, x0, :lo12:src
	ldrsw	x0, [sp, 28]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L76:
	ldr	w0, [sp, 28]
	cmp	w0, 511
	ble	.L77
	bl	to_upper
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	report
	mov	w0, 0
	ldp	x29, x30, [sp], 48
	ret


	.bss
	.balign 8
src:
	.skip 512
	.balign 8
src2:
	.skip 512
	.balign 8
dst:
	.skip 512
	.balign 8
pair:
	.skip 1024
	.balign 8
sgn:
	.skip 512
	.balign 8
w16:
	.skip 1024
	.balign 8
w32:
	.skip 512
