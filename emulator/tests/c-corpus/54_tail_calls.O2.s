	.text
	.align	2
	.align 5
is_odd:
	cbnz	x0, .L4
	mov	w0, 0
	ret
	.align 2
.L4:
	sub	x0, x0, #1
	b	is_even
	.align	2
	.align 5
is_even:
	cbnz	x0, .L7
	mov	w0, 1
	ret
	.align 2
.L7:
	sub	x0, x0, #1
	b	is_odd
	.align	2
	.align 5
kind:
	sub	w1, w0, #97
	and	w1, w1, 255
	cmp	w1, 25
	bls	.L10
	sub	w0, w0, #48
	and	w0, w0, 255
	cmp	w0, 9
	cset	w0, hi
	add	w0, w0, 1
	ret
	.align 2
.L10:
	mov	w0, 0
	ret
	.align	2
	.align 5
next:
	ldrb	w6, [x0]
	cbz	w6, .L17
	stp	x29, x30, [sp, -16]!
	mov	x4, x0
	mov	w5, w1
	mov	x29, sp
	mov	w0, w6
	bl	kind
	mov	w6, w0
	add	x0, x4, 1
	cmp	w6, w3
	beq	.L21
	adrp	x1, .LANCHOR0
	add	x1, x1, :lo12:.LANCHOR0
	ldp	x29, x30, [sp], 16
	madd	w3, w3, w2, w2
	ldr	x4, [x1, w6, sxtw 3]
	mov	w1, 131
	mov	w2, 1
	madd	w1, w5, w1, w3
	mov	x16, x4
	br	x16
	.align 2
.L17:
	mov	w0, 131
	madd	w0, w1, w0, w2
	ret
	.align 2
.L21:
	adrp	x1, .LANCHOR0
	add	x1, x1, :lo12:.LANCHOR0
	ldp	x29, x30, [sp], 16
	add	w2, w2, 1
	ldr	x3, [x1, w6, sxtw 3]
	mov	w1, w5
	mov	x16, x3
	br	x16
	.align	2
	.align 5
st_letter:
	mov	w4, 4660
	mov	w3, 0
	eor	w1, w1, w4
	b	next
	.align	2
	.align 5
st_digit:
	add	w1, w1, 7
	mov	w3, 1
	b	next
	.align	2
	.align 5
st_other:
	sub	w1, w1, #3
	mov	w3, 2
	b	next
	.align	2
	.align 5
ack:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x20, .LANCHOR1
	mov	x19, x0
	ldr	x0, [x20, :lo12:.LANCHOR1]
	add	x0, x0, 1
	str	x0, [x20, :lo12:.LANCHOR1]
	add	x20, x20, :lo12:.LANCHOR1
.L26:
	mov	x0, x19
	sub	x19, x19, #1
	cbnz	x1, .L33
	mov	x1, 1
.L27:
	ldr	x0, [x20]
	add	x0, x0, 1
	str	x0, [x20]
	cbnz	x19, .L26
	ldp	x19, x20, [sp, 16]
	add	x0, x1, 1
	ldp	x29, x30, [sp], 32
	ret
	.align 2
.L33:
	sub	x1, x1, #1
	bl	ack
	mov	x1, x0
	b	.L27
	.align	2
	.align 5
next__constprop__0:
	adrp	x3, .LANCHOR1
	add	x3, x3, :lo12:.LANCHOR1
	ldrb	w0, [x3, 16]
	cbz	w0, .L35
	stp	x29, x30, [sp, -16]!
	mov	x29, sp
	bl	kind
	cmp	w0, 2
	beq	.L40
	adrp	x1, .LANCHOR0
	add	x1, x1, :lo12:.LANCHOR0
	ldp	x29, x30, [sp], 16
	mov	w2, 1
	ldr	x4, [x1, w0, sxtw 3]
	add	x0, x3, 17
	mov	w1, 682
	mov	x16, x4
	br	x16
.L35:
	mov	w0, 664
	ret
.L40:
	ldp	x29, x30, [sp], 16
	add	x0, x3, 17
	mov	w2, 10
	mov	w1, 5
	b	st_other
	.align	2
	.align 5
gcd__constprop__0:
	ldr	w3, [x2]
	mov	x4, x0
	mov	x0, x1
	add	w5, w3, 2
	cbnz	x1, .L44
	b	.L47
	.align 2
.L45:
	mov	x0, x3
.L44:
	udiv	x3, x4, x0
	mov	w1, w5
	add	w5, w5, 1
	msub	x3, x3, x0, x4
	mov	x4, x0
	cbnz	x3, .L45
	str	w1, [x2]
	ret
	.align 2
.L47:
	add	w3, w3, 1
	mov	x0, x4
	str	w3, [x2]
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"rotate n=%d a=%lld e=%lld h=%lld i=%lld\n"
	.text
	.align	2
	.align 5
rotate__constprop__0:
	stp	x29, x30, [sp, -112]!
	mov	w9, 51555
	mov	w8, 59416
	mov	x29, sp
	movk	w9, 0x962f, lsl 16
	stp	x19, x20, [sp, 16]
	mov	w19, w0
	movk	w8, 0x1b4, lsl 16
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	str	x0, [sp, 104]
	madd	w0, w19, w9, w8
	mov	w7, 29708
	stp	x21, x22, [sp, 32]
	mov	x20, 1
	stp	x23, x24, [sp, 48]
	ror	w0, w0, 2
	mov	x22, 9
	stp	x25, x26, [sp, 64]
	mov	x21, 8
	mov	x24, 6
	stp	x27, x28, [sp, 80]
	mov	x23, 5
	mov	x28, 7
	mov	x25, 4
	mov	x26, 3
	mov	x27, 2
	movk	w7, 0xda, lsl 16
	cmp	w0, w7
	bls	.L55
	.align 5
.L49:
	cbz	w19, .L53
.L56:
	sbfiz	x4, x21, 1, 32
	mov	x0, 16963
	movk	x0, 0xf, lsl 16
	add	x1, x22, 1
	sub	w19, w19, #1
	mov	x21, x28
	udiv	x22, x4, x0
	mov	x28, x24
	mov	x24, x23
	mov	x23, x25
	mov	x25, x26
	mov	x26, x27
	mov	x27, x20
	mov	x20, x1
	msub	x22, x22, x0, x4
	madd	w0, w19, w9, w8
	ror	w0, w0, 2
	cmp	w0, w7
	bhi	.L49
.L55:
	ldr	x0, [sp, 104]
	mov	x5, x22
	mov	x4, x21
	mov	x3, x23
	mov	x2, x20
	mov	w1, w19
	bl	printf
	mov	w7, 29708
	mov	w8, 59416
	mov	w9, 51555
	movk	w7, 0xda, lsl 16
	movk	w8, 0x1b4, lsl 16
	movk	w9, 0x962f, lsl 16
	cbnz	w19, .L56
.L53:
	sub	x1, x20, x27
	add	x1, x1, x26
	sub	x1, x1, x25
	add	x1, x1, x23
	sub	x1, x1, x24
	add	x1, x1, x28
	sub	x1, x1, x21
	ldp	x19, x20, [sp, 16]
	add	x0, x1, x22
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 112
	ret
	.align	2
	.align 5
sum_to__constprop__0:
	uxtw	x1, w0
	mov	x0, 0
	cbz	w1, .L57
	.align 5
.L60:
	umaddl	x0, w1, w1, x0
	subs	x1, x1, #1
	bne	.L60
.L57:
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
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -96]!
	adrp	x0, .LANCHOR2
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	add	x20, x0, :lo12:.LANCHOR2
	ldr	w0, [x0, :lo12:.LANCHOR2]
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	adrp	x24, .LC4
	mov	w23, 23
	str	x25, [sp, 64]
	bl	sum_to__constprop__0
	mov	x1, x0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w19, [x20, 4]
	mov	w25, 17097
	ldrsw	x0, [x20, 4]
	add	x24, x24, :lo12:.LC4
	movk	w25, 0xb216, lsl 16
	bl	is_even
	ldr	w22, [x20, 4]
	mov	w21, w0
	ldrsw	x0, [x20, 4]
	bl	is_odd
	mov	w4, w0
	mov	w2, w21
	mov	w1, w19
	mov	w3, w22
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	w0, [x20, 8]
	mov	w19, 0
	mov	x21, 1
	bl	rotate__constprop__0
	mov	x1, x0
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	mov	x0, 0
	b	.L67
	.align 2
.L66:
	mov	x0, x22
	cmp	w19, 92
	beq	.L75
.L67:
	mov	x22, x21
	add	x21, x21, x0
	umull	x0, w19, w25
	mov	w6, w19
	lsr	x0, x0, 36
	msub	w0, w0, w23, w19
	add	w19, w19, 1
	cmp	w0, 22
	bne	.L66
	add	x2, sp, 92
	mov	x1, x22
	mov	x0, x21
	str	wzr, [sp, 92]
	bl	gcd__constprop__0
	mov	w2, w19
	ldr	w4, [sp, 92]
	mov	x3, x0
	add	w1, w6, 2
	mov	x0, x24
	bl	printf
	mov	x0, x22
	cmp	w19, 92
	bne	.L67
.L75:
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
	.align 5
.L68:
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
	bne	.L68
	ldrb	w0, [x19, 16]
	mov	w2, 1
	bl	kind
	adrp	x1, .LANCHOR0
	add	x1, x1, :lo12:.LANCHOR0
	ldr	x3, [x1, w0, sxtw 3]
	mov	w1, 0
	add	x0, x19, 17
	blr	x3
	mov	w1, w0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	strb	wzr, [x19, 16]
	bl	next__constprop__0
	mov	w1, w0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	w0, [x20, 12]
	tbnz	w0, #31, .L69
	adrp	x23, .LC8
	adrp	x22, .LC9
	add	x23, x23, :lo12:.LC8
	add	x22, x22, :lo12:.LC9
	mov	x21, 0
	.align 5
.L70:
	mov	x1, x21
	mov	x0, 2
	str	xzr, [x19]
	bl	ack
	ldr	x3, [x19]
	mov	x2, x0
	mov	w1, w21
	mov	x0, x23
	bl	printf
	str	xzr, [x19]
	mov	x1, x21
	mov	x0, 3
	bl	ack
	mov	x2, x0
	ldr	x3, [x19]
	mov	w1, w21
	mov	x0, x22
	add	x21, x21, 1
	bl	printf
	ldr	w0, [x20, 12]
	cmp	w0, w21
	bge	.L70
.L69:
	ldr	x25, [sp, 64]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 96
	ret
	.section .rodata
	.align	3
.LC5:
	.string	"aab77-zzz0.q"
	.text
	.section .rodata
	.align	4
	.LANCHOR0:
table:
	.quad	st_letter
	.quad	st_digit
	.quad	st_other
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

