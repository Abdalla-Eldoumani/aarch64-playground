	.text
	.data
	.align	2
sum_depth:
	.word	6000
	.align	2
parity_depth:
	.word	3001
	.align	2
rot_depth:
	.word	1500
	.align	2
ack_top:
	.word	4
	.text
	.align	2
sum_to:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	x1, [sp, 16]
	ldr	w0, [sp, 28]
	cmp	w0, 0
	bne	.L2
	ldr	x0, [sp, 16]
	b	.L3
.L2:
	ldr	w0, [sp, 28]
	sub	w2, w0, #1
	ldr	w1, [sp, 28]
	ldr	w0, [sp, 28]
	mul	x1, x1, x0
	ldr	x0, [sp, 16]
	add	x0, x1, x0
	mov	x1, x0
	mov	w0, w2
	bl	sum_to
.L3:
	ldp	x29, x30, [sp], 32
	ret
	.align	2
is_even:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	cmp	x0, 0
	beq	.L5
	ldr	x0, [sp, 24]
	sub	x0, x0, #1
	bl	is_odd
	b	.L7
.L5:
	mov	w0, 1
.L7:
	ldp	x29, x30, [sp], 32
	ret
	.align	2
is_odd:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x0, [sp, 24]
	ldr	x0, [sp, 24]
	cmp	x0, 0
	beq	.L9
	ldr	x0, [sp, 24]
	sub	x0, x0, #1
	bl	is_even
	b	.L11
.L9:
	mov	w0, 0
.L11:
	ldp	x29, x30, [sp], 32
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"rotate n=%d a=%lld e=%lld h=%lld i=%lld\n"
	.text
	.align	2
rotate:
	sub	sp, sp, #112
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x20, x21, [sp, 32]
	str	w0, [sp, 108]
	str	x1, [sp, 96]
	str	x2, [sp, 88]
	str	x3, [sp, 80]
	str	x4, [sp, 72]
	str	x5, [sp, 64]
	str	x6, [sp, 56]
	str	x7, [sp, 48]
	ldr	w0, [sp, 108]
	mov	w1, 300
	sdiv	w2, w0, w1
	mov	w1, 300
	mul	w1, w2, w1
	sub	w0, w0, w1
	cmp	w0, 0
	bne	.L13
	ldr	x5, [sp, 120]
	ldr	x4, [sp, 112]
	ldr	x3, [sp, 64]
	ldr	x2, [sp, 96]
	ldr	w1, [sp, 108]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
.L13:
	ldr	w0, [sp, 108]
	cmp	w0, 0
	bne	.L14
	ldr	x1, [sp, 96]
	ldr	x0, [sp, 88]
	sub	x1, x1, x0
	ldr	x0, [sp, 80]
	add	x1, x1, x0
	ldr	x0, [sp, 72]
	sub	x1, x1, x0
	ldr	x0, [sp, 64]
	add	x1, x1, x0
	ldr	x0, [sp, 56]
	sub	x1, x1, x0
	ldr	x0, [sp, 48]
	add	x1, x1, x0
	ldr	x0, [sp, 112]
	sub	x1, x1, x0
	ldr	x0, [sp, 120]
	add	x0, x1, x0
	b	.L15
.L14:
	ldr	w0, [sp, 108]
	sub	w8, w0, #1
	ldr	x0, [sp, 120]
	add	x9, x0, 1
	ldr	x0, [sp, 112]
	lsl	x0, x0, 1
	mov	x1, 52789
	movk	x1, 0x4e5a, lsl 16
	movk	x1, 0xa2a2, lsl 32
	movk	x1, 0x8637, lsl 48
	mul	x2, x0, x1
	smulh	x1, x0, x1
	mov	x20, x2
	mov	x21, x1
	mov	x1, x21
	add	x1, x0, x1
	asr	x2, x1, 19
	asr	x1, x0, 63
	sub	x1, x2, x1
	mov	x2, 16963
	movk	x2, 0xf, lsl 16
	mul	x1, x1, x2
	sub	x1, x0, x1
	str	x1, [sp, 8]
	ldr	x0, [sp, 48]
	str	x0, [sp]
	ldr	x7, [sp, 56]
	ldr	x6, [sp, 64]
	ldr	x5, [sp, 72]
	ldr	x4, [sp, 80]
	ldr	x3, [sp, 88]
	ldr	x2, [sp, 96]
	mov	x1, x9
	mov	w0, w8
	bl	rotate
.L15:
	ldp	x29, x30, [sp, 16]
	ldp	x20, x21, [sp, 32]
	add	sp, sp, 112
	ret
	.align	2
gcd:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 40]
	str	x1, [sp, 32]
	str	x2, [sp, 24]
	ldr	x0, [sp, 24]
	ldr	w0, [x0]
	add	w1, w0, 1
	ldr	x0, [sp, 24]
	str	w1, [x0]
	ldr	x0, [sp, 32]
	cmp	x0, 0
	beq	.L17
	ldr	x0, [sp, 40]
	ldr	x1, [sp, 32]
	udiv	x2, x0, x1
	ldr	x1, [sp, 32]
	mul	x1, x2, x1
	sub	x0, x0, x1
	ldr	x2, [sp, 24]
	mov	x1, x0
	ldr	x0, [sp, 32]
	bl	gcd
	b	.L19
.L17:
	ldr	x0, [sp, 40]
.L19:
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
table:
	.xword	st_letter
	.xword	st_digit
	.xword	st_other
	.text
	.align	2
kind:
	sub	sp, sp, #16
	strb	w0, [sp, 15]
	ldrb	w0, [sp, 15]
	cmp	w0, 96
	bls	.L21
	ldrb	w0, [sp, 15]
	cmp	w0, 122
	bls	.L22
.L21:
	ldrb	w0, [sp, 15]
	cmp	w0, 47
	bls	.L23
	ldrb	w0, [sp, 15]
	cmp	w0, 57
	bhi	.L23
	mov	w0, 1
	b	.L25
.L23:
	mov	w0, 2
	b	.L25
.L22:
	mov	w0, 0
.L25:
	add	sp, sp, 16
	ret
	.align	2
next:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 40]
	str	w1, [sp, 36]
	str	w2, [sp, 32]
	str	w3, [sp, 28]
	ldr	x0, [sp, 40]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L28
	ldr	w1, [sp, 36]
	mov	w0, 131
	mul	w1, w1, w0
	ldr	w0, [sp, 32]
	add	w0, w1, w0
	b	.L29
.L28:
	ldr	x0, [sp, 40]
	ldrb	w0, [x0]
	bl	kind
	mov	w1, w0
	ldr	w0, [sp, 28]
	cmp	w0, w1
	bne	.L30
	adrp	x0, table
	add	x0, x0, :lo12:table
	ldrsw	x1, [sp, 28]
	ldr	x3, [x0, x1, lsl 3]
	ldr	x0, [sp, 40]
	add	x4, x0, 1
	ldr	w0, [sp, 32]
	add	w0, w0, 1
	mov	w2, w0
	ldr	w1, [sp, 36]
	mov	x0, x4
	blr	x3
	b	.L29
.L30:
	ldr	x0, [sp, 40]
	ldrb	w0, [x0]
	bl	kind
	mov	w1, w0
	adrp	x0, table
	add	x0, x0, :lo12:table
	sxtw	x1, w1
	ldr	x3, [x0, x1, lsl 3]
	ldr	x0, [sp, 40]
	add	x4, x0, 1
	ldr	w1, [sp, 36]
	mov	w0, 131
	mul	w1, w1, w0
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	mov	w2, w0
	ldr	w0, [sp, 32]
	mul	w0, w2, w0
	add	w0, w1, w0
	mov	w2, 1
	mov	w1, w0
	mov	x0, x4
	blr	x3
.L29:
	ldp	x29, x30, [sp], 48
	ret
	.align	2
st_letter:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	w1, [sp, 20]
	str	w2, [sp, 16]
	ldr	w1, [sp, 20]
	mov	w0, 4660
	eor	w0, w1, w0
	mov	w3, 0
	ldr	w2, [sp, 16]
	mov	w1, w0
	ldr	x0, [sp, 24]
	bl	next
	ldp	x29, x30, [sp], 32
	ret
	.align	2
st_digit:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	w1, [sp, 20]
	str	w2, [sp, 16]
	ldr	w0, [sp, 20]
	add	w0, w0, 7
	mov	w3, 1
	ldr	w2, [sp, 16]
	mov	w1, w0
	ldr	x0, [sp, 24]
	bl	next
	ldp	x29, x30, [sp], 32
	ret
	.align	2
st_other:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x0, [sp, 24]
	str	w1, [sp, 20]
	str	w2, [sp, 16]
	ldr	w0, [sp, 20]
	sub	w0, w0, #3
	mov	w3, 2
	ldr	w2, [sp, 16]
	mov	w1, w0
	ldr	x0, [sp, 24]
	bl	next
	ldp	x29, x30, [sp], 32
	ret
	.align	2
ack:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x19, [sp, 16]
	str	x0, [sp, 40]
	str	x1, [sp, 32]
	adrp	x0, ack_calls
	add	x0, x0, :lo12:ack_calls
	ldr	x0, [x0]
	add	x1, x0, 1
	adrp	x0, ack_calls
	add	x0, x0, :lo12:ack_calls
	str	x1, [x0]
	ldr	x0, [sp, 40]
	cmp	x0, 0
	bne	.L38
	ldr	x0, [sp, 32]
	add	x0, x0, 1
	b	.L39
.L38:
	ldr	x0, [sp, 32]
	cmp	x0, 0
	bne	.L40
	ldr	x0, [sp, 40]
	sub	x0, x0, #1
	mov	x1, 1
	bl	ack
	b	.L39
.L40:
	ldr	x0, [sp, 40]
	sub	x19, x0, #1
	ldr	x0, [sp, 32]
	sub	x0, x0, #1
	mov	x1, x0
	ldr	x0, [sp, 40]
	bl	ack
	mov	x1, x0
	mov	x0, x19
	bl	ack
.L39:
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"sum_to=%llu\n"
	.align	3
.LC2:
	.string	"even(%d)=%d odd(%d)=%d\n"
	.align	3
.LC3:
	.string	"rotate=%lld\n"
	.align	3
.LC4:
	.string	"gcd(fib %d, fib %d)=%llu in %d steps\n"
	.align	3
.LC6:
	.string	"machine=%u\n"
	.align	3
.LC7:
	.string	"machine(empty)=%u\n"
	.align	3
.LC8:
	.string	"ack(2,%d)=%ld calls=%ld\n"
	.align	3
.LC9:
	.string	"ack(3,%d)=%ld calls=%ld\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #112
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x19, x20, [sp, 32]
	str	x21, [sp, 48]
	str	xzr, [sp, 104]
	mov	x0, 1
	str	x0, [sp, 96]
	adrp	x0, sum_depth
	add	x0, x0, :lo12:sum_depth
	ldr	w0, [x0]
	mov	x1, 0
	bl	sum_to
	mov	x1, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	adrp	x0, parity_depth
	add	x0, x0, :lo12:parity_depth
	ldr	w19, [x0]
	adrp	x0, parity_depth
	add	x0, x0, :lo12:parity_depth
	ldr	w0, [x0]
	sxtw	x0, w0
	bl	is_even
	mov	w21, w0
	adrp	x0, parity_depth
	add	x0, x0, :lo12:parity_depth
	ldr	w20, [x0]
	adrp	x0, parity_depth
	add	x0, x0, :lo12:parity_depth
	ldr	w0, [x0]
	sxtw	x0, w0
	bl	is_odd
	mov	w4, w0
	mov	w3, w20
	mov	w2, w21
	mov	w1, w19
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	adrp	x0, rot_depth
	add	x0, x0, :lo12:rot_depth
	ldr	w0, [x0]
	mov	x1, 9
	str	x1, [sp, 8]
	mov	x1, 8
	str	x1, [sp]
	mov	x7, 7
	mov	x6, 6
	mov	x5, 5
	mov	x4, 4
	mov	x3, 3
	mov	x2, 2
	mov	x1, 1
	bl	rotate
	mov	x1, x0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	str	wzr, [sp, 92]
	b	.L42
.L44:
	ldr	x1, [sp, 104]
	ldr	x0, [sp, 96]
	add	x0, x1, x0
	str	x0, [sp, 72]
	ldr	x0, [sp, 96]
	str	x0, [sp, 104]
	ldr	x0, [sp, 72]
	str	x0, [sp, 96]
	ldr	w0, [sp, 92]
	mov	w1, 23
	sdiv	w2, w0, w1
	mov	w1, 23
	mul	w1, w2, w1
	sub	w0, w0, w1
	cmp	w0, 22
	bne	.L43
	str	wzr, [sp, 68]
	add	x0, sp, 68
	mov	x2, x0
	ldr	x1, [sp, 104]
	ldr	x0, [sp, 96]
	bl	gcd
	str	x0, [sp, 72]
	ldr	w0, [sp, 92]
	add	w1, w0, 2
	ldr	w0, [sp, 92]
	add	w0, w0, 1
	ldr	w2, [sp, 68]
	mov	w4, w2
	ldr	x3, [sp, 72]
	mov	w2, w0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
.L43:
	ldr	w0, [sp, 92]
	add	w0, w0, 1
	str	w0, [sp, 92]
.L42:
	ldr	w0, [sp, 92]
	cmp	w0, 91
	ble	.L44
	str	wzr, [sp, 92]
	b	.L45
.L46:
	ldr	w1, [sp, 92]
	mov	w0, w1
	lsl	w0, w0, 3
	sub	w1, w0, w1
	ldr	w0, [sp, 92]
	mov	w2, 26215
	movk	w2, 0x6666, lsl 16
	smull	x2, w0, w2
	lsr	x2, x2, 32
	asr	w2, w2, 1
	asr	w0, w0, 31
	sub	w0, w2, w0
	add	w1, w1, w0
	mov	w0, 12
	sdiv	w2, w1, w0
	mov	w0, w2
	lsl	w0, w0, 1
	add	w0, w0, w2
	lsl	w0, w0, 2
	sub	w2, w1, w0
	adrp	x0, .LC5
	add	x1, x0, :lo12:.LC5
	sxtw	x0, w2
	ldrb	w2, [x1, x0]
	adrp	x0, text
	add	x1, x0, :lo12:text
	ldrsw	x0, [sp, 92]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 92]
	add	w0, w0, 1
	str	w0, [sp, 92]
.L45:
	ldr	w0, [sp, 92]
	cmp	w0, 1798
	ble	.L46
	adrp	x0, text
	add	x0, x0, :lo12:text
	ldrb	w0, [x0]
	bl	kind
	mov	w1, w0
	adrp	x0, table
	add	x0, x0, :lo12:table
	sxtw	x1, w1
	ldr	x3, [x0, x1, lsl 3]
	adrp	x0, text+1
	add	x0, x0, :lo12:text+1
	mov	w2, 1
	mov	w1, 0
	blr	x3
	mov	w1, w0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	adrp	x0, text
	add	x0, x0, :lo12:text
	strb	wzr, [x0]
	mov	w3, 2
	mov	w2, 9
	mov	w1, 5
	adrp	x0, text
	add	x0, x0, :lo12:text
	bl	next
	mov	w1, w0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	str	wzr, [sp, 92]
	b	.L47
.L48:
	adrp	x0, ack_calls
	add	x0, x0, :lo12:ack_calls
	str	xzr, [x0]
	ldrsw	x0, [sp, 92]
	mov	x1, x0
	mov	x0, 2
	bl	ack
	str	x0, [sp, 80]
	adrp	x0, ack_calls
	add	x0, x0, :lo12:ack_calls
	ldr	x0, [x0]
	mov	x3, x0
	ldr	x2, [sp, 80]
	ldr	w1, [sp, 92]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	adrp	x0, ack_calls
	add	x0, x0, :lo12:ack_calls
	str	xzr, [x0]
	ldrsw	x0, [sp, 92]
	mov	x1, x0
	mov	x0, 3
	bl	ack
	str	x0, [sp, 80]
	adrp	x0, ack_calls
	add	x0, x0, :lo12:ack_calls
	ldr	x0, [x0]
	mov	x3, x0
	ldr	x2, [sp, 80]
	ldr	w1, [sp, 92]
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	ldr	w0, [sp, 92]
	add	w0, w0, 1
	str	w0, [sp, 92]
.L47:
	adrp	x0, ack_top
	add	x0, x0, :lo12:ack_top
	ldr	w0, [x0]
	ldr	w1, [sp, 92]
	cmp	w1, w0
	ble	.L48
	mov	w0, 0
	ldp	x29, x30, [sp, 16]
	ldp	x19, x20, [sp, 32]
	ldr	x21, [sp, 48]
	add	sp, sp, 112
	ret
	.section .rodata
	.align	3
.LC5:
	.string	"aab77-zzz0.q"
	.text


	.bss
	.balign 8
ack_calls:
	.skip 8
	.balign 8
text:
	.skip 1800
