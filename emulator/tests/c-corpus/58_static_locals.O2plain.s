	.text
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
	.section .rodata
	.align	3
.LC0:
	.string	"fib calls=%d deepest=%d now=%d\n"
	.text
	.align	2
	.align 5
fib_probe:
	stp	x29, x30, [sp, -48]!
	adrp	x6, .LANCHOR0
	add	x5, x6, :lo12:.LANCHOR0
	mov	x29, sp
	mov	w4, w0
	ldr	w0, [x6, :lo12:.LANCHOR0]
	ldp	w3, w2, [x5, 4]
	cbnz	w1, .L10
	add	w0, w0, 1
	str	w0, [x6, :lo12:.LANCHOR0]
	add	w0, w3, 1
	str	w0, [x5, 4]
	cmp	w0, w2
	ble	.L7
	str	w0, [x5, 8]
.L7:
	cmp	w4, 1
	bgt	.L11
.L8:
	str	w3, [x5, 4]
	mov	w0, w4
	ldp	x29, x30, [sp], 48
	ret
	.align 2
.L11:
	sub	w0, w4, #1
	mov	w1, 0
	str	x19, [sp, 16]
	str	w4, [sp, 44]
	bl	fib_probe
	ldr	w4, [sp, 44]
	mov	w19, w0
	mov	w1, 0
	sub	w0, w4, #2
	bl	fib_probe
	add	w4, w19, w0
	adrp	x0, .LANCHOR0
	add	x5, x0, :lo12:.LANCHOR0
	ldr	x19, [sp, 16]
	ldr	w3, [x5, 4]
	sub	w3, w3, #1
	b	.L8
	.align 2
.L10:
	mov	w1, w0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	adrp	x0, .LANCHOR0
	add	x5, x0, :lo12:.LANCHOR0
	str	wzr, [x0, :lo12:.LANCHOR0]
	mov	w0, 0
	str	wzr, [x5, 8]
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"four"
	.align	3
.LC2:
	.string	"i=%d a=%d b=%d c8=%u c16=%u sc=%d cur=%d ops=%d h=%d\n"
	.align	3
.LC3:
	.string	"tag=%d big=%016llx s=%d b=%u,%u,%u\n"
	.align	3
.LC4:
	.string	"c=%d "
	.align	3
.LC5:
	.string	"%s "
	.align	3
.LC6:
	.string	"fib(16)=%d\n"
	.align	3
.LC7:
	.string	"fib(9)=%d\n"
	.align	3
.LC8:
	.string	"d=%.17g big=%lld\n"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #144
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x19, x20, [sp, 32]
	adrp	x19, .LANCHOR1
	add	x19, x19, :lo12:.LANCHOR1
	stp	x21, x22, [sp, 48]
	stp	x27, x28, [sp, 96]
	ldr	w0, [x19, 32]
	cmp	w0, 0
	ble	.L36
	adrp	x0, .LANCHOR0
	mov	w22, 34467
	add	x28, x0, :lo12:.LANCHOR0
	adrp	x21, add1
	mov	w20, 0
	add	x21, x21, :lo12:add1
	mov	w9, 0
	mov	w27, 0
	movk	w22, 0x1, lsl 16
	stp	x23, x24, [sp, 64]
	adrp	x23, dbl
	mov	w24, 0
	stp	x25, x26, [sp, 80]
	str	x0, [sp, 136]
	add	x0, x23, :lo12:dbl
	str	x0, [sp, 128]
	b	.L18
	.align 2
.L38:
	ldr	w0, [x19, 32]
	sub	w0, w0, #1
	cmp	w0, w27
	beq	.L16
	ldr	w0, [x19, 32]
	add	w27, w27, 1
	add	w24, w24, 37
	cmp	w0, w27
	ble	.L37
.L18:
	ldr	x8, [x19, 48]
	add	x12, x19, 32
	ldrb	w23, [x19, 40]
	ldrb	w6, [x19, 44]
	add	w0, w23, 1
	strb	w0, [x19, 40]
	mov	x0, x8
	ldrh	w5, [x19, 42]
	ldr	w3, [x19, 36]
	add	w6, w6, 5
	ldr	w2, [x28, 12]
	add	w5, w5, 3
	ldr	w7, [x0], 4
	and	w5, w5, 65535
	sxtb	w6, w6
	add	w26, w3, 2
	add	w11, w7, 100
	cmp	x0, x12
	add	w20, w20, w7
	csel	x0, x0, x19, ne
	ldr	x7, [x19, 56]
	add	w25, w2, 1
	str	w11, [x8]
	str	w25, [x28, 12]
	str	w26, [x19, 36]
	strh	w5, [x19, 42]
	strb	w6, [x19, 44]
	str	x0, [x19, 48]
	mov	w0, w9
	stp	w6, w5, [sp, 120]
	blr	x7
	sdiv	w9, w0, w22
	mov	w8, 1000
	ldr	x7, [x19, 56]
	ldr	x1, [sp, 128]
	cmp	x7, x21
	msub	w9, w9, w22, w0
	mov	w0, 1100
	csel	x7, x1, x21, eq
	mov	w1, 43691
	ldp	w6, w5, [sp, 120]
	str	x7, [x19, 56]
	udiv	w7, w24, w0
	movk	w1, 0xaaaa, lsl 16
	ldr	w12, [x28, 4016]
	add	w12, w12, 1
	str	w12, [x28, 4016]
	msub	w7, w7, w0, w24
	mov	w0, 19923
	movk	w0, 0x1062, lsl 16
	umull	x0, w7, w0
	lsr	x0, x0, 38
	msub	w0, w0, w8, w7
	add	x7, x28, 16
	ldr	x8, [x19, 72]
	ldr	w11, [x7, w0, sxtw 2]
	ror	x8, x8, 60
	add	w11, w11, 1
	str	w11, [x7, w0, sxtw 2]
	ldrb	w7, [x19, 64]
	add	x0, x19, 64
	str	x8, [x19, 72]
	add	w7, w7, 1
	ldrh	w8, [x19, 80]
	and	w7, w7, 255
	strb	w7, [x19, 64]
	sub	w8, w8, #3
	strh	w8, [x19, 80]
	umull	x8, w7, w1
	lsr	x8, x8, 33
	add	w8, w8, w8, lsl 1
	sub	w7, w7, w8
	add	x7, x0, w7, uxtb
	ldrb	w0, [x7, 18]
	add	w0, w0, 1
	strb	w0, [x7, 18]
	mov	w0, 23593
	mov	w7, 47185
	movk	w0, 0xc28f, lsl 16
	movk	w7, 0x51e, lsl 16
	mul	w0, w27, w0
	ror	w0, w0, 1
	cmp	w0, w7
	bhi	.L38
.L16:
	mov	w0, 10000
	str	w9, [sp]
	mov	w1, w27
	mov	w7, w20
	madd	w11, w11, w0, w12
	mov	w4, w23
	str	w11, [sp, 8]
	mov	w3, w26
	mov	w2, w25
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	str	w9, [sp, 120]
	bl	printf
	add	w27, w27, 1
	ldr	w0, [x19, 32]
	add	w24, w24, 37
	ldr	w9, [sp, 120]
	cmp	w0, w27
	bgt	.L18
.L37:
	ldr	x2, [x19, 72]
	adrp	x0, .LC3
	ldrb	w6, [x19, 84]
	add	x0, x0, :lo12:.LC3
	ldrb	w5, [x19, 83]
	ldrb	w4, [x19, 82]
	ldrsh	w3, [x19, 80]
	ldrb	w1, [x19, 64]
	bl	printf
	ldp	x23, x24, [sp, 64]
	ldp	x25, x26, [sp, 80]
.L13:
	adrp	x21, .LC4
	add	x21, x21, :lo12:.LC4
	mov	w20, 10
	.align 5
.L19:
	ldr	w1, [x19, 88]
	mov	x0, x21
	neg	w1, w1, lsl 1
	str	w1, [x19, 88]
	bl	printf
	subs	w20, w20, #1
	bne	.L19
	adrp	x21, .LANCHOR2
	adrp	x22, .LC5
	add	x21, x21, :lo12:.LANCHOR2
	add	x22, x22, :lo12:.LC5
	mov	x20, 0
	mov	w0, 10
	bl	putchar
.L24:
	cmp	x20, 4
	bhi	.L39
.L20:
	ldr	x1, [x21, x20, lsl 3]
	mov	x0, x22
	add	x20, x20, 1
	bl	printf
	cmp	x20, 4
	bls	.L20
.L39:
	ldr	x0, [x19, 96]
	cmp	x0, x21
	beq	.L28
	ldr	x1, [x0, -8]
	sub	x2, x0, #8
.L21:
	add	x20, x20, 1
	mov	x0, x22
	str	x2, [x19, 96]
	bl	printf
	cmp	x20, 8
	bne	.L24
	mov	w0, 10
	bl	putchar
	mov	w1, 0
	mov	w0, 16
	bl	fib_probe
	mov	w1, w0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	adrp	x20, .LC0
	ldr	x21, [sp, 136]
	add	x0, x20, :lo12:.LC0
	ldp	w3, w2, [x28, 4]
	mov	x22, 6148914691236517205
	ldr	w1, [x21, :lo12:.LANCHOR0]
	movk	x22, 0x5556, lsl 0
	bl	printf
	str	wzr, [x21, :lo12:.LANCHOR0]
	mov	w1, 0
	mov	w0, 9
	str	wzr, [x28, 8]
	bl	fib_probe
	mov	w1, w0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	w1, [x21, :lo12:.LANCHOR0]
	add	x0, x20, :lo12:.LC0
	ldp	w3, w2, [x28, 4]
	mov	w20, 5
	bl	printf
	str	wzr, [x21, :lo12:.LANCHOR0]
	adrp	x21, .LC8
	add	x21, x21, :lo12:.LC8
	str	wzr, [x28, 8]
.L25:
	ldr	x1, [x19, 112]
	ldr	d0, [x19, 104]
	smulh	x0, x1, x22
	fadd	d0, d0, d0
	sub	x1, x0, x1, asr 63
	mov	x0, x21
	sub	x1, x1, #1
	str	x1, [x19, 112]
	str	d0, [x19, 104]
	bl	printf
	subs	w20, w20, #1
	bne	.L25
	ldp	x29, x30, [sp, 16]
	mov	w0, 0
	ldp	x19, x20, [sp, 32]
	ldp	x21, x22, [sp, 48]
	ldp	x27, x28, [sp, 96]
	add	sp, sp, 144
	ret
	.align 2
.L28:
	adrp	x1, .LC1
	add	x2, x21, 32
	add	x1, x1, :lo12:.LC1
	b	.L21
.L36:
	adrp	x0, .LANCHOR0
	add	x28, x0, :lo12:.LANCHOR0
	str	x0, [sp, 136]
	b	.L13
	.section .rodata
	.align	3
.LC9:
	.string	"zero"
	.align	3
.LC10:
	.string	"one"
	.align	3
.LC11:
	.string	"two"
	.align	3
.LC12:
	.string	"three"
	.section .rodata
	.align	4
	.LANCHOR2:
names__5:
	.quad	.LC9
	.quad	.LC10
	.quad	.LC11
	.quad	.LC12
	.quad	.LC1
	.data
	.align	4
	.LANCHOR1:
pool__12:
	.word	11
	.word	22
	.word	33
	.word	44
	.word	55
	.word	66
	.word	77
	.word	88
rounds:
	.word	300
hits__17:
	.word	100
c__16:
	.byte	-6
	.zero	1
s__15:
	.hword	-6
c__14:
	.byte	120
	.zero	3
cur__13:
	.quad	pool__12+20
op__11:
	.quad	add1
m__8:
	.byte	113
	.zero	7
	.quad	81985529216486895
	.hword	-2
	.byte 250, 251, 252
	.zero	3
hits__7:
	.word	-5
	.zero	4
last__6:
	.quad	names__5+32
d__1:
	.word	-1717986918
	.word	1069128089
big__0:
	.quad	-9000000000000000000
	.bss
	.align	4
	.LANCHOR0:
calls__4:
	.zero	4
now__2:
	.zero	4
deepest__3:
	.zero	4
hits__18:
	.zero	4
hist__10:
	.zero	4000
total__9:
	.zero	4

