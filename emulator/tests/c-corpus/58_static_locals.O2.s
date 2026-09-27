	.text
	.align	2
	.align 5
tick_a:
	adrp	x1, .LANCHOR0
	ldr	w0, [x1, :lo12:.LANCHOR0]
	add	w0, w0, 1
	str	w0, [x1, :lo12:.LANCHOR0]
	ret
	.align	2
	.align 5
tick_b:
	adrp	x1, .LANCHOR1
	ldr	w0, [x1, :lo12:.LANCHOR1]
	add	w0, w0, 2
	str	w0, [x1, :lo12:.LANCHOR1]
	ret
	.align	2
	.align 5
tick_c:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	ldr	w0, [x1, 4]
	neg	w0, w0, lsl 1
	str	w0, [x1, 4]
	ret
	.align	2
	.align 5
wrap8:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	ldrb	w0, [x1, 8]
	add	w2, w0, 1
	strb	w2, [x1, 8]
	ret
	.align	2
	.align 5
wrap16:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	ldrh	w0, [x1, 10]
	add	w0, w0, 3
	strh	w0, [x1, 10]
	ret
	.align	2
	.align 5
swrap:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	ldrb	w0, [x1, 12]
	add	w0, w0, 5
	strb	w0, [x1, 12]
	ret
	.align	2
	.align 5
cursor_next:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	add	x6, x1, 48
	add	x5, x1, 16
	ldr	x3, [x1, 48]
	mov	x2, x3
	ldr	w0, [x2], 4
	cmp	x2, x6
	add	w4, w0, 100
	csel	x2, x2, x5, ne
	str	w4, [x3]
	str	x2, [x1, 48]
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"four"
	.text
	.align	2
	.align 5
name_of:
	cmp	w0, 4
	bgt	.L16
	adrp	x1, .LANCHOR2
	add	x1, x1, :lo12:.LANCHOR2
	ldr	x0, [x1, w0, sxtw 3]
	ret
	.align 2
.L16:
	adrp	x1, .LANCHOR1
	add	x1, x1, :lo12:.LANCHOR1
	adrp	x0, .LANCHOR2
	add	x0, x0, :lo12:.LANCHOR2
	ldr	x2, [x1, 56]
	cmp	x2, x0
	beq	.L15
	ldr	x0, [x2, -8]
	sub	x3, x2, #8
	str	x3, [x1, 56]
.L17:
	ret
	.align 2
.L15:
	add	x3, x2, 32
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	str	x3, [x1, 56]
	b	.L17
	.align	2
	.align 5
state:
	adrp	x2, .LANCHOR1
	add	x2, x2, :lo12:.LANCHOR1
	add	x0, x2, 64
	ldrb	w1, [x2, 64]
	add	w1, w1, 1
	and	w1, w1, 255
	strb	w1, [x2, 64]
	ldr	x2, [x0, 8]
	ror	x2, x2, 60
	str	x2, [x0, 8]
	ldrh	w2, [x0, 16]
	sub	w2, w2, #3
	strh	w2, [x0, 16]
	mov	w2, 43691
	movk	w2, 0xaaaa, lsl 16
	umull	x2, w1, w2
	lsr	x2, x2, 33
	add	w2, w2, w2, lsl 1
	sub	w1, w1, w2
	add	x1, x0, w1, uxtb
	ldrb	w2, [x1, 18]
	add	w2, w2, 1
	strb	w2, [x1, 18]
	ret
	.align	2
	.align 5
add1:
	add	w0, w0, 1
	ret
	.align	2
	.align 5
dbl:
	lsl	w0, w0, 1
	ret
	.align	2
	.align 5
apply_next:
	stp	x29, x30, [sp, -32]!
	mov	x29, sp
	str	x19, [sp, 16]
	adrp	x19, .LANCHOR1
	add	x19, x19, :lo12:.LANCHOR1
	ldr	x1, [x19, 88]
	blr	x1
	ldr	x3, [x19, 88]
	adrp	x2, add1
	add	x2, x2, :lo12:add1
	adrp	x1, dbl
	cmp	x3, x2
	add	x1, x1, :lo12:dbl
	csel	x1, x1, x2, eq
	str	x1, [x19, 88]
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 32
	ret
	.align	2
	.align 5
histogram:
	mov	w1, 19923
	mov	w2, 1000
	movk	w1, 0x1062, lsl 16
	umull	x1, w0, w1
	lsr	x1, x1, 38
	msub	w1, w1, w2, w0
	adrp	x2, .LANCHOR0
	add	x2, x2, :lo12:.LANCHOR0
	add	x3, x2, 16
	ldr	w0, [x3, w1, sxtw 2]
	add	w0, w0, 1
	str	w0, [x3, w1, sxtw 2]
	ldr	w1, [x2, 4016]
	add	w1, w1, 1
	str	w1, [x2, 4016]
	mov	w2, 10000
	madd	w0, w0, w2, w1
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"fib calls=%d deepest=%d now=%d\n"
	.text
	.align	2
	.align 5
fib_probe:
	stp	x29, x30, [sp, -48]!
	adrp	x4, .LANCHOR0
	add	x4, x4, :lo12:.LANCHOR0
	mov	x29, sp
	mov	w5, w0
	ldr	w3, [x4, 4024]
	ldr	w0, [x4, 4020]
	ldr	w2, [x4, 4028]
	cbnz	w1, .L32
	add	w0, w0, 1
	str	w0, [x4, 4020]
	add	w0, w3, 1
	str	w0, [x4, 4024]
	cmp	w0, w2
	ble	.L29
	str	w0, [x4, 4028]
.L29:
	cmp	w5, 1
	bgt	.L33
.L30:
	str	w3, [x4, 4024]
	mov	w0, w5
	ldp	x29, x30, [sp], 48
	ret
	.align 2
.L33:
	sub	w0, w5, #1
	mov	w1, 0
	str	x19, [sp, 16]
	str	w5, [sp, 44]
	bl	fib_probe
	ldr	w5, [sp, 44]
	mov	w19, w0
	mov	w1, 0
	sub	w0, w5, #2
	bl	fib_probe
	add	w5, w19, w0
	adrp	x0, .LANCHOR0
	add	x4, x0, :lo12:.LANCHOR0
	ldr	x19, [sp, 16]
	ldr	w3, [x4, 4024]
	sub	w3, w3, #1
	b	.L30
	.align 2
.L32:
	mov	w1, w0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	adrp	x0, .LANCHOR0
	add	x4, x0, :lo12:.LANCHOR0
	mov	w0, 0
	str	wzr, [x4, 4020]
	str	wzr, [x4, 4028]
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"d=%.17g big=%lld\n"
	.text
	.align	2
	.align 5
halves.isra.0:
	adrp	x0, .LANCHOR1
	add	x0, x0, :lo12:.LANCHOR1
	mov	x2, 6148914691236517205
	movk	x2, 0x5556, lsl 0
	ldr	x1, [x0, 104]
	ldr	d0, [x0, 96]
	smulh	x2, x1, x2
	fadd	d0, d0, d0
	sub	x1, x2, x1, asr 63
	sub	x1, x1, #1
	str	x1, [x0, 104]
	str	d0, [x0, 96]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	b	printf
	.section .rodata
	.align	3
.LC3:
	.string	"i=%d a=%d b=%d c8=%u c16=%u sc=%d cur=%d ops=%d h=%d\n"
	.align	3
.LC4:
	.string	"tag=%d big=%016llx s=%d b=%u,%u,%u\n"
	.align	3
.LC5:
	.string	"c=%d "
	.align	3
.LC6:
	.string	"\n"
	.align	3
.LC7:
	.string	"%s "
	.align	3
.LC8:
	.string	"fib(16)=%d\n"
	.align	3
.LC9:
	.string	"fib(9)=%d\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #144
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x23, x24, [sp, 64]
	adrp	x23, .LANCHOR1
	add	x23, x23, :lo12:.LANCHOR1
	stp	x19, x20, [sp, 32]
	stp	x21, x22, [sp, 48]
	ldr	w0, [x23, 112]
	cmp	w0, 0
	ble	.L36
	mov	w24, 34467
	stp	x27, x28, [sp, 96]
	mov	w28, 23593
	mov	w27, 47185
	adrp	x0, .LC3
	mov	w20, 0
	add	x0, x0, :lo12:.LC3
	mov	w22, 0
	mov	w19, 0
	movk	w24, 0x1, lsl 16
	movk	w28, 0xc28f, lsl 16
	movk	w27, 0x51e, lsl 16
	stp	x25, x26, [sp, 80]
	mov	w26, 0
	str	x0, [sp, 136]
	b	.L39
	.align 2
.L49:
	ldr	w0, [x23, 112]
	sub	w0, w0, #1
	cmp	w0, w26
	beq	.L37
	ldr	w0, [x23, 112]
	add	w26, w26, 1
	add	w20, w20, 37
	cmp	w0, w26
	ble	.L48
.L39:
	bl	tick_a
	str	w0, [sp, 120]
	bl	tick_b
	str	w0, [sp, 124]
	bl	wrap8
	and	w25, w0, 255
	bl	wrap16
	and	w0, w0, 65535
	str	w0, [sp, 116]
	bl	swrap
	sxtb	w21, w0
	bl	cursor_next
	add	w22, w22, w0
	mov	w0, w19
	bl	apply_next
	sdiv	w19, w0, w24
	msub	w19, w19, w24, w0
	mov	w0, 1100
	udiv	w2, w20, w0
	msub	w0, w2, w0, w20
	bl	histogram
	mov	w3, w0
	bl	state
	mov	x8, x0
	mul	w2, w26, w28
	ror	w2, w2, 1
	cmp	w2, w27
	bhi	.L49
.L37:
	ldr	x0, [sp, 136]
	str	w3, [sp, 8]
	ldp	w5, w2, [sp, 116]
	str	w19, [sp]
	ldr	w3, [sp, 124]
	mov	w1, w26
	mov	w7, w22
	mov	w6, w21
	mov	w4, w25
	str	x8, [sp, 128]
	add	w26, w26, 1
	add	w20, w20, 37
	bl	printf
	ldr	w0, [x23, 112]
	ldr	x8, [sp, 128]
	cmp	w0, w26
	bgt	.L39
.L48:
	ldr	x2, [x8, 8]
	adrp	x0, .LC4
	ldrb	w6, [x8, 20]
	add	x0, x0, :lo12:.LC4
	ldrb	w5, [x8, 19]
	ldrb	w4, [x8, 18]
	ldrsh	w3, [x8, 16]
	ldrb	w1, [x8]
	bl	printf
	ldp	x25, x26, [sp, 80]
	ldp	x27, x28, [sp, 96]
.L36:
	adrp	x20, .LC5
	add	x20, x20, :lo12:.LC5
	mov	w19, 10
	.align 5
.L40:
	bl	tick_c
	mov	w1, w0
	mov	x0, x20
	bl	printf
	subs	w19, w19, #1
	bne	.L40
	adrp	x20, .LC7
	add	x20, x20, :lo12:.LC7
	mov	w19, 0
	adrp	x21, .LC6
	add	x21, x21, :lo12:.LC6
	mov	x0, x21
	bl	printf
	.align 5
.L41:
	mov	w0, w19
	bl	name_of
	add	w19, w19, 1
	mov	x1, x0
	mov	x0, x20
	bl	printf
	cmp	w19, 8
	bne	.L41
	mov	x0, x21
	bl	printf
	mov	w1, 0
	mov	w0, 16
	bl	fib_probe
	mov	w1, w0
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	mov	w19, 5
	mov	w1, 1
	mov	w0, 0
	bl	fib_probe
	mov	w1, 0
	mov	w0, 9
	bl	fib_probe
	mov	w1, w0
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	mov	w1, 1
	mov	w0, 0
	bl	fib_probe
.L42:
	bl	halves.isra.0
	subs	w19, w19, #1
	bne	.L42
	ldp	x29, x30, [sp, 16]
	mov	w0, 0
	ldp	x19, x20, [sp, 32]
	ldp	x21, x22, [sp, 48]
	ldp	x23, x24, [sp, 64]
	add	sp, sp, 144
	ret
	.section .rodata
	.align	3
.LC10:
	.string	"zero"
	.align	3
.LC11:
	.string	"one"
	.align	3
.LC12:
	.string	"two"
	.align	3
.LC13:
	.string	"three"
	.section .rodata
	.align	4
	.LANCHOR2:
names.5:
	.quad	.LC10
	.quad	.LC11
	.quad	.LC12
	.quad	.LC13
	.quad	.LC0
	.data
	.align	4
	.LANCHOR1:
hits.17:
	.word	100
hits.7:
	.word	-5
c.16:
	.byte	-6
	.zero	1
s.15:
	.hword	-6
c.14:
	.byte	120
	.zero	3
pool.12:
	.word	11
	.word	22
	.word	33
	.word	44
	.word	55
	.word	66
	.word	77
	.word	88
cur.13:
	.quad	pool.12+20
last.6:
	.quad	names.5+32
m.8:
	.byte	113
	.zero	7
	.quad	81985529216486895
	.hword	-2
	.byte 250, 251, 252
	.zero	3
op.11:
	.quad	add1
d.1:
	.word	-1717986918
	.word	1069128089
big.0:
	.quad	-9000000000000000000
rounds:
	.word	300
	.bss
	.align	4
	.LANCHOR0:
hits.18:
	.zero	4
	.zero	12
hist.10:
	.zero	4000
total.9:
	.zero	4
calls.4:
	.zero	4
now.2:
	.zero	4
deepest.3:
	.zero	4

