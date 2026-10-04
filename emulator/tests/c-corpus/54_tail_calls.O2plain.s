	.text
	.align	2
	.p2align 5,,15
next:
	ldrb	w4, [x0]
	cbz	w4, .L16
	sub	w5, w4, #97
	and	w5, w5, 255
	cmp	w5, 25
	bhi	.L4
	cbz	w3, .L5
	adrp	x4, st_letter
	add	x4, x4, :lo12:st_letter
.L6:
	mov	w5, 131
	madd	w3, w3, w2, w2
	add	x0, x0, 1
	mov	x16, x4
	madd	w1, w1, w5, w3
	mov	w2, 1
	br	x16
	.p2align 2,,3
.L4:
	sub	w4, w4, #48
	and	w4, w4, 255
	cmp	w4, 9
	bhi	.L18
	adrp	x4, st_digit
	add	x4, x4, :lo12:st_digit
	cmp	w3, 1
	bne	.L6
.L5:
	adrp	x4, .LANCHOR0
	add	x4, x4, :lo12:.LANCHOR0
	add	w2, w2, 1
	add	x0, x0, 1
	ldr	x3, [x4, w3, sxtw 3]
	mov	x16, x3
	br	x16
	.p2align 2,,3
.L16:
	mov	w0, 131
	madd	w0, w1, w0, w2
	ret
	.p2align 2,,3
.L18:
	cmp	w3, 2
	beq	.L5
	adrp	x4, st_other
	add	x4, x4, :lo12:st_other
	b	.L6
	.align	2
	.p2align 5,,15
st_letter:
	mov	w4, 4660
	mov	w3, 0
	eor	w1, w1, w4
	b	next
	.align	2
	.p2align 5,,15
st_digit:
	add	w1, w1, 7
	mov	w3, 1
	b	next
	.align	2
	.p2align 5,,15
st_other:
	sub	w1, w1, #3
	mov	w3, 2
	b	next
	.align	2
	.p2align 5,,15
is_odd.part.0:
.L26:
	cmp	x0, 1
	beq	.L23
	cmp	x0, 2
	bne	.L24
	mov	w0, 0
.L22:
	ret
	.p2align 2,,3
.L23:
	mov	w0, 1
	ret
	.p2align 2,,3
.L24:
	cmp	x0, 3
	beq	.L23
	subs	x0, x0, #4
	bne	.L26
	mov	w0, 0
	b	.L22
	.align	2
	.p2align 5,,15
ack:
	stp	x29, x30, [sp, -96]!
	mov	x29, sp
	stp	x23, x24, [sp, 48]
	adrp	x23, .LANCHOR1
	ldr	x2, [x23, :lo12:.LANCHOR1]
	add	x23, x23, :lo12:.LANCHOR1
	stp	x27, x28, [sp, 80]
	mov	x27, x0
	add	x2, x2, 1
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	stp	x25, x26, [sp, 64]
.L37:
	mov	x28, x27
	sub	x27, x27, #1
	cbnz	x1, .L76
	mov	x1, 1
.L38:
	add	x2, x2, 1
	str	x2, [x23]
	cbnz	x27, .L37
	ldp	x19, x20, [sp, 16]
	add	x0, x1, 1
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 96
	ret
	.p2align 2,,3
.L76:
	add	x2, x2, 1
	sub	x1, x1, #1
.L39:
	mov	x26, x28
	sub	x28, x28, #1
	cbnz	x1, .L77
	mov	x1, 1
.L40:
	add	x2, x2, 1
	cbnz	x28, .L39
	add	x1, x1, 1
	b	.L38
	.p2align 2,,3
.L77:
	add	x2, x2, 1
	sub	x1, x1, #1
.L41:
	mov	x25, x26
	sub	x26, x26, #1
	cbnz	x1, .L78
	mov	x1, 1
.L42:
	add	x2, x2, 1
	cbnz	x26, .L41
	add	x1, x1, 1
	b	.L40
	.p2align 2,,3
.L78:
	add	x2, x2, 1
	sub	x1, x1, #1
.L43:
	mov	x24, x25
	sub	x25, x25, #1
	cbnz	x1, .L79
	mov	x1, 1
.L44:
	add	x2, x2, 1
	cbnz	x25, .L43
	add	x1, x1, 1
	b	.L42
	.p2align 2,,3
.L79:
	add	x2, x2, 1
	sub	x1, x1, #1
.L45:
	mov	x22, x24
	sub	x24, x24, #1
	cbnz	x1, .L80
	mov	x1, 1
.L46:
	add	x2, x2, 1
	cbnz	x24, .L45
	add	x1, x1, 1
	b	.L44
	.p2align 2,,3
.L80:
	add	x2, x2, 1
	sub	x1, x1, #1
.L47:
	mov	x21, x22
	sub	x22, x22, #1
	cbnz	x1, .L81
	mov	x1, 1
.L48:
	add	x2, x2, 1
	cbnz	x22, .L47
	add	x1, x1, 1
	b	.L46
	.p2align 2,,3
.L81:
	add	x2, x2, 1
	sub	x1, x1, #1
.L49:
	mov	x20, x21
	sub	x21, x21, #1
	cbnz	x1, .L82
	mov	x1, 1
.L50:
	add	x2, x2, 1
	cbnz	x21, .L49
	add	x1, x1, 1
	b	.L48
	.p2align 2,,3
.L82:
	add	x2, x2, 1
	sub	x1, x1, #1
.L51:
	mov	x19, x20
	sub	x20, x20, #1
	cbnz	x1, .L83
	mov	x1, 1
.L52:
	add	x2, x2, 1
	cbnz	x20, .L51
	add	x1, x1, 1
	b	.L50
	.p2align 2,,3
.L83:
	sub	x1, x1, #1
	add	x2, x2, 1
	str	x2, [x23]
.L53:
	mov	x0, x19
	sub	x19, x19, #1
	cbnz	x1, .L84
	mov	x1, 1
.L54:
	ldr	x2, [x23]
	add	x2, x2, 1
	str	x2, [x23]
	cbnz	x19, .L53
	add	x1, x1, 1
	b	.L52
	.p2align 2,,3
.L84:
	sub	x1, x1, #1
	bl	ack
	mov	x1, x0
	b	.L54
	.section .rodata
	.align	3
.LC0:
	.string	"sum_to=%llu\n"
	.align	3
.LC1:
	.string	"even(%d)=%d odd(%d)=%d\n"
	.align	3
.LC2:
	.string	"rotate n=%d a=%lld e=%lld h=%lld i=%lld\n"
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
	.p2align 5,,15
	.global	main
main:
	stp	x29, x30, [sp, -112]!
	mov	x1, 0
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LANCHOR2
	ldr	w2, [x20, :lo12:.LANCHOR2]
	stp	x21, x22, [sp, 32]
	uxtw	x0, w2
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	stp	x27, x28, [sp, 80]
	cbz	w2, .L89
	.p2align 5,,15
.L90:
	umaddl	x1, w0, w0, x1
	subs	x0, x0, #1
	bne	.L90
.L89:
	add	x20, x20, :lo12:.LANCHOR2
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	w1, [x20, 4]
	ldrsw	x0, [x20, 4]
	cbz	x0, .L88
	cmp	x0, 1
	bne	.L132
.L91:
	mov	w2, 0
	b	.L93
.L88:
	mov	w2, 1
.L93:
	ldr	w3, [x20, 4]
	mov	w4, 0
	ldrsw	x0, [x20, 4]
	cbnz	x0, .L133
.L95:
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w24, [x20, 8]
	mov	w10, 51555
	mov	w9, 59416
	movk	w10, 0x962f, lsl 16
	movk	w9, 0x1b4, lsl 16
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	str	x0, [sp, 104]
	madd	w0, w24, w10, w9
	mov	w8, 29708
	mov	x22, 9
	mov	x21, 8
	mov	x26, 7
	mov	x27, 6
	ror	w0, w0, 2
	mov	x25, 5
	mov	x28, 4
	mov	x23, 3
	mov	x7, 2
	mov	x19, 1
	movk	w8, 0xda, lsl 16
	cmp	w0, w8
	bls	.L134
	.p2align 5,,15
.L96:
	cbz	w24, .L135
.L97:
	sbfiz	x1, x21, 1, 32
	mov	x0, 16963
	movk	x0, 0xf, lsl 16
	add	x2, x22, 1
	sub	w24, w24, #1
	mov	x21, x26
	udiv	x22, x1, x0
	mov	x26, x27
	mov	x27, x25
	mov	x25, x28
	mov	x28, x23
	mov	x23, x7
	mov	x7, x19
	mov	x19, x2
	msub	x22, x22, x0, x1
	madd	w0, w24, w10, w9
	ror	w0, w0, 2
	cmp	w0, w8
	bhi	.L96
.L134:
	ldr	x0, [sp, 104]
	mov	x5, x22
	mov	x4, x21
	mov	x3, x25
	mov	x2, x19
	mov	w1, w24
	str	x7, [sp, 96]
	bl	printf
	mov	w8, 29708
	mov	w9, 59416
	mov	w10, 51555
	movk	w8, 0xda, lsl 16
	ldr	x7, [sp, 96]
	movk	w9, 0x1b4, lsl 16
	movk	w10, 0x962f, lsl 16
	cbnz	w24, .L97
.L135:
	sub	x0, x19, x7
	mov	w19, 0
	add	x0, x0, x23
	sub	x0, x0, x28
	add	x0, x0, x25
	mov	w25, 23
	sub	x0, x0, x27
	add	x0, x0, x26
	mov	w26, 17097
	sub	x0, x0, x21
	movk	w26, 0xb216, lsl 16
	add	x1, x0, x22
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	adrp	x22, .LC4
	mov	x21, 1
	add	x22, x22, :lo12:.LC4
	mov	x0, 0
	b	.L98
	.p2align 2,,3
.L100:
	mov	x0, x23
	cmp	w19, 92
	beq	.L136
.L98:
	mov	x23, x21
	add	x21, x21, x0
	umull	x0, w19, w26
	mov	w1, w19
	lsr	x0, x0, 36
	msub	w0, w0, w25, w19
	add	w19, w19, 1
	cmp	w0, 22
	bne	.L100
	cbz	x23, .L112
	mov	x2, x21
	mov	x3, x23
	mov	w4, 1
	b	.L102
	.p2align 2,,3
.L113:
	mov	x3, x0
.L102:
	udiv	x0, x2, x3
	add	w4, w4, 1
	msub	x0, x0, x3, x2
	mov	x2, x3
	cbnz	x0, .L113
	mov	w2, w19
	add	w1, w1, 2
	mov	x0, x22
	bl	printf
.L140:
	mov	x0, x23
	cmp	w19, 92
	bne	.L98
.L136:
	adrp	x19, .LANCHOR1
	add	x19, x19, :lo12:.LANCHOR1
	mov	x5, x19
	adrp	x4, .LC5
	mov	w7, 52429
	add	x4, x4, :lo12:.LC5
	mov	w0, 97
	mov	w3, 7
	mov	x2, 1
	movk	w7, 0xcccc, lsl 16
	mov	w6, 12
	strb	w0, [x5, 16]!
	.p2align 5,,15
.L103:
	umull	x1, w2, w7
	lsr	x1, x1, 34
	add	w1, w1, w3
	add	w3, w3, 7
	sdiv	w0, w1, w6
	add	w0, w0, w0, lsl 1
	sub	w0, w1, w0, lsl 2
	ldrb	w0, [x4, w0, sxtw]
	strb	w0, [x2, x5]
	add	x2, x2, 1
	cmp	x2, 1799
	bne	.L103
	ldrb	w0, [x19, 16]
	sub	w1, w0, #97
	and	w1, w1, 255
	cmp	w1, 25
	bls	.L104
	sub	w0, w0, #48
	and	w0, w0, 255
	cmp	w0, 9
	cset	w24, hi
	add	w24, w24, 1
.L104:
	adrp	x0, .LANCHOR0
	add	x0, x0, :lo12:.LANCHOR0
	mov	w2, 1
	mov	w1, 0
	ldr	x3, [x0, w24, sxtw 3]
	add	x0, x19, 17
	blr	x3
	mov	w1, w0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	strb	wzr, [x19, 16]
	mov	w1, 664
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	w0, [x20, 12]
	tbnz	w0, #31, .L105
	adrp	x25, .LC8
	adrp	x24, .LC9
	add	x25, x25, :lo12:.LC8
	add	x24, x24, :lo12:.LC9
	mov	x21, 0
	mov	x23, 1
	.p2align 5,,15
.L109:
	str	x23, [x19]
	mov	w22, w21
	mov	x26, x21
	mov	x1, x21
	mov	w4, 2
	mov	x0, 2
	cbnz	x1, .L137
.L116:
	ldr	x3, [x19]
	mov	x1, 1
	mov	x0, 1
	add	x3, x3, 1
	str	x3, [x19]
	cmp	w4, 1
	beq	.L138
.L115:
	mov	w4, w0
	cbz	x1, .L116
.L137:
	sub	x1, x1, #1
	bl	ack
	ldr	x3, [x19]
	mov	x1, x0
	mov	x0, 1
	add	x3, x3, 1
	str	x3, [x19]
	cmp	w4, 1
	bne	.L115
.L138:
	add	x2, x1, x0
	mov	w1, w22
	mov	x0, x25
	bl	printf
	mov	x4, 3
	str	x23, [x19]
.L107:
	cbnz	x26, .L139
	mov	x26, 1
.L110:
	ldr	x3, [x19]
	subs	x4, x4, #1
	add	x3, x3, 1
	str	x3, [x19]
	bne	.L107
	add	x2, x26, 1
	mov	w1, w22
	mov	x0, x24
	bl	printf
	ldr	w0, [x20, 12]
	add	x21, x21, 1
	cmp	w0, w21
	bge	.L109
.L105:
	ldp	x19, x20, [sp, 16]
	mov	w0, 0
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 112
	ret
	.p2align 2,,3
.L112:
	mov	x3, x21
	mov	w2, w19
	add	w1, w1, 2
	mov	x0, x22
	mov	w4, 1
	bl	printf
	b	.L140
	.p2align 2,,3
.L139:
	sub	x1, x26, #1
	mov	x0, x4
	bl	ack
	mov	x26, x0
	b	.L110
.L133:
	bl	is_odd.part.0
	mov	w4, w0
	b	.L95
.L132:
	cmp	x0, 2
	beq	.L88
	subs	x0, x0, #3
	beq	.L91
	bl	is_odd.part.0
	mov	w2, w0
	b	.L93
	.section .rodata
	.align	3
.LC5:
	.string	"aab77-zzz0.q"
	.text
	.section .rodata
	.align	4
	.LANCHOR0:
table:
	.xword	st_letter
	.xword	st_digit
	.xword	st_other
	.data
	.align	2
	.LANCHOR2:
sum_depth:
	.word	6000
parity_depth:
	.word	3001
rot_depth:
	.word	1500
ack_top:
	.word	4
	.bss
	.align	4
	.LANCHOR1:
ack_calls:
	.zero	8
	.zero	8
text:
	.zero	1800

