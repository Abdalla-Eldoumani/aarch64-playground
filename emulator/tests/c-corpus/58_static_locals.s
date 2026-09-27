	.text
	.data
	.align	2
rounds:
	.word	300
	.text
	.align	2
tick_a:
	adrp	x0, hits__19
	add	x0, x0, :lo12:hits__19
	ldr	w0, [x0]
	add	w1, w0, 1
	adrp	x0, hits__19
	add	x0, x0, :lo12:hits__19
	str	w1, [x0]
	adrp	x0, hits__19
	add	x0, x0, :lo12:hits__19
	ldr	w0, [x0]
	ret
	.align	2
tick_b:
	adrp	x0, hits__18
	add	x0, x0, :lo12:hits__18
	ldr	w0, [x0]
	add	w1, w0, 2
	adrp	x0, hits__18
	add	x0, x0, :lo12:hits__18
	str	w1, [x0]
	adrp	x0, hits__18
	add	x0, x0, :lo12:hits__18
	ldr	w0, [x0]
	ret
	.align	2
tick_c:
	adrp	x0, hits__17
	add	x0, x0, :lo12:hits__17
	ldr	w1, [x0]
	mov	w0, 0
	sub	w0, w0, w1
	lsl	w0, w0, 1
	mov	w1, w0
	adrp	x0, hits__17
	add	x0, x0, :lo12:hits__17
	str	w1, [x0]
	adrp	x0, hits__17
	add	x0, x0, :lo12:hits__17
	ldr	w0, [x0]
	ret
	.align	2
wrap8:
	adrp	x0, c__16
	add	x0, x0, :lo12:c__16
	ldrb	w0, [x0]
	add	w1, w0, 1
	and	w2, w1, 255
	adrp	x1, c__16
	add	x1, x1, :lo12:c__16
	strb	w2, [x1]
	ret
	.align	2
wrap16:
	adrp	x0, s__15
	add	x0, x0, :lo12:s__15
	ldrh	w0, [x0]
	add	w0, w0, 3
	and	w1, w0, 65535
	adrp	x0, s__15
	add	x0, x0, :lo12:s__15
	strh	w1, [x0]
	adrp	x0, s__15
	add	x0, x0, :lo12:s__15
	ldrh	w0, [x0]
	ret
	.align	2
swrap:
	adrp	x0, c__14
	add	x0, x0, :lo12:c__14
	ldrsb	w0, [x0]
	and	w0, w0, 255
	add	w0, w0, 5
	and	w0, w0, 255
	sxtb	w1, w0
	adrp	x0, c__14
	add	x0, x0, :lo12:c__14
	strb	w1, [x0]
	adrp	x0, c__14
	add	x0, x0, :lo12:c__14
	ldrsb	w0, [x0]
	ret
	.align	2
cursor_next:
	sub	sp, sp, #16
	adrp	x0, cur__13
	add	x0, x0, :lo12:cur__13
	ldr	x0, [x0]
	ldr	w0, [x0]
	str	w0, [sp, 12]
	adrp	x0, cur__13
	add	x0, x0, :lo12:cur__13
	ldr	x0, [x0]
	ldr	w1, [x0]
	adrp	x0, cur__13
	add	x0, x0, :lo12:cur__13
	ldr	x0, [x0]
	add	w1, w1, 100
	str	w1, [x0]
	adrp	x0, cur__13
	add	x0, x0, :lo12:cur__13
	ldr	x0, [x0]
	add	x1, x0, 4
	adrp	x0, cur__13
	add	x0, x0, :lo12:cur__13
	str	x1, [x0]
	adrp	x0, cur__13
	add	x0, x0, :lo12:cur__13
	ldr	x1, [x0]
	adrp	x0, end__12
	add	x0, x0, :lo12:end__12
	ldr	x0, [x0]
	cmp	x1, x0
	bne	.L14
	adrp	x0, cur__13
	add	x0, x0, :lo12:cur__13
	adrp	x1, pool__11
	add	x1, x1, :lo12:pool__11
	str	x1, [x0]
.L14:
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
name_of:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	cmp	w0, 4
	ble	.L17
	adrp	x0, last__10
	add	x0, x0, :lo12:last__10
	ldr	x1, [x0]
	adrp	x0, names__9
	add	x0, x0, :lo12:names__9
	cmp	x1, x0
	beq	.L18
	adrp	x0, last__10
	add	x0, x0, :lo12:last__10
	ldr	x0, [x0]
	sub	x0, x0, #8
	b	.L19
.L18:
	adrp	x0, names__9+32
	add	x0, x0, :lo12:names__9+32
.L19:
	adrp	x1, last__10
	add	x1, x1, :lo12:last__10
	str	x0, [x1]
	adrp	x0, last__10
	add	x0, x0, :lo12:last__10
	ldr	x0, [x0]
	ldr	x0, [x0]
	b	.L20
.L17:
	adrp	x0, names__9
	add	x0, x0, :lo12:names__9
	ldrsw	x1, [sp, 12]
	ldr	x0, [x0, x1, lsl 3]
.L20:
	add	sp, sp, 16
	ret
	.align	2
state:
	adrp	x0, m__8
	add	x0, x0, :lo12:m__8
	ldrb	w0, [x0]
	add	w0, w0, 1
	and	w1, w0, 255
	adrp	x0, m__8
	add	x0, x0, :lo12:m__8
	strb	w1, [x0]
	adrp	x0, m__8
	add	x0, x0, :lo12:m__8
	ldr	x0, [x0, 8]
	ror	x1, x0, 60
	adrp	x0, m__8
	add	x0, x0, :lo12:m__8
	str	x1, [x0, 8]
	adrp	x0, m__8
	add	x0, x0, :lo12:m__8
	ldrsh	w0, [x0, 16]
	and	w0, w0, 65535
	sub	w0, w0, #3
	and	w0, w0, 65535
	sxth	w1, w0
	adrp	x0, m__8
	add	x0, x0, :lo12:m__8
	strh	w1, [x0, 16]
	adrp	x0, m__8
	add	x0, x0, :lo12:m__8
	ldrb	w1, [x0]
	mov	w0, 43691
	movk	w0, 0xaaaa, lsl 16
	umull	x0, w1, w0
	lsr	x0, x0, 32
	lsr	w2, w0, 1
	mov	w0, w2
	lsl	w0, w0, 1
	add	w0, w0, w2
	sub	w0, w1, w0
	and	w0, w0, 255
	mov	w3, w0
	adrp	x0, m__8
	add	x1, x0, :lo12:m__8
	sxtw	x0, w3
	add	x0, x1, x0
	ldrb	w0, [x0, 18]
	add	w0, w0, 1
	and	w2, w0, 255
	adrp	x0, m__8
	add	x1, x0, :lo12:m__8
	sxtw	x0, w3
	add	x0, x1, x0
	mov	w1, w2
	strb	w1, [x0, 18]
	adrp	x0, m__8
	add	x0, x0, :lo12:m__8
	ret
	.align	2
add1:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	add	w0, w0, 1
	add	sp, sp, 16
	ret
	.align	2
dbl:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	lsl	w0, w0, 1
	add	sp, sp, 16
	ret
	.align	2
apply_next:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	w0, [sp, 28]
	adrp	x0, op__7
	add	x0, x0, :lo12:op__7
	ldr	x1, [x0]
	ldr	w0, [sp, 28]
	blr	x1
	str	w0, [sp, 44]
	adrp	x0, op__7
	add	x0, x0, :lo12:op__7
	ldr	x1, [x0]
	adrp	x0, add1
	add	x0, x0, :lo12:add1
	cmp	x1, x0
	bne	.L28
	adrp	x0, dbl
	add	x0, x0, :lo12:dbl
	b	.L29
.L28:
	adrp	x0, add1
	add	x0, x0, :lo12:add1
.L29:
	adrp	x1, op__7
	add	x1, x1, :lo12:op__7
	str	x0, [x1]
	ldr	w0, [sp, 44]
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"fib calls=%d deepest=%d now=%d\n"
	.text
	.align	2
fib_probe:
	stp	x29, x30, [sp, -64]!
	mov	x29, sp
	str	x19, [sp, 16]
	str	w0, [sp, 44]
	str	w1, [sp, 40]
	ldr	w0, [sp, 40]
	cmp	w0, 0
	beq	.L32
	adrp	x0, calls__6
	add	x0, x0, :lo12:calls__6
	ldr	w1, [x0]
	adrp	x0, deepest__5
	add	x0, x0, :lo12:deepest__5
	ldr	w2, [x0]
	adrp	x0, now__4
	add	x0, x0, :lo12:now__4
	ldr	w0, [x0]
	mov	w3, w0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	adrp	x0, deepest__5
	add	x0, x0, :lo12:deepest__5
	str	wzr, [x0]
	adrp	x0, deepest__5
	add	x0, x0, :lo12:deepest__5
	ldr	w1, [x0]
	adrp	x0, calls__6
	add	x0, x0, :lo12:calls__6
	str	w1, [x0]
	mov	w0, 0
	b	.L33
.L32:
	adrp	x0, calls__6
	add	x0, x0, :lo12:calls__6
	ldr	w0, [x0]
	add	w1, w0, 1
	adrp	x0, calls__6
	add	x0, x0, :lo12:calls__6
	str	w1, [x0]
	adrp	x0, now__4
	add	x0, x0, :lo12:now__4
	ldr	w0, [x0]
	add	w1, w0, 1
	adrp	x0, now__4
	add	x0, x0, :lo12:now__4
	str	w1, [x0]
	adrp	x0, now__4
	add	x0, x0, :lo12:now__4
	ldr	w1, [x0]
	adrp	x0, deepest__5
	add	x0, x0, :lo12:deepest__5
	ldr	w0, [x0]
	cmp	w1, w0
	ble	.L34
	adrp	x0, now__4
	add	x0, x0, :lo12:now__4
	ldr	w1, [x0]
	adrp	x0, deepest__5
	add	x0, x0, :lo12:deepest__5
	str	w1, [x0]
.L34:
	ldr	w0, [sp, 44]
	cmp	w0, 1
	ble	.L35
	ldr	w0, [sp, 44]
	sub	w0, w0, #1
	mov	w1, 0
	bl	fib_probe
	mov	w19, w0
	ldr	w0, [sp, 44]
	sub	w0, w0, #2
	mov	w1, 0
	bl	fib_probe
	add	w0, w19, w0
	str	w0, [sp, 60]
	b	.L36
.L35:
	ldr	w0, [sp, 44]
	str	w0, [sp, 60]
.L36:
	adrp	x0, now__4
	add	x0, x0, :lo12:now__4
	ldr	w0, [x0]
	sub	w1, w0, #1
	adrp	x0, now__4
	add	x0, x0, :lo12:now__4
	str	w1, [x0]
	ldr	w0, [sp, 60]
.L33:
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 64
	ret
	.align	2
histogram:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	mov	w1, 1000
	sdiv	w2, w0, w1
	mov	w1, 1000
	mul	w1, w2, w1
	sub	w3, w0, w1
	adrp	x0, hist__3
	add	x0, x0, :lo12:hist__3
	sxtw	x1, w3
	ldr	w0, [x0, x1, lsl 2]
	add	w2, w0, 1
	adrp	x0, hist__3
	add	x0, x0, :lo12:hist__3
	sxtw	x1, w3
	str	w2, [x0, x1, lsl 2]
	adrp	x0, total__2
	add	x0, x0, :lo12:total__2
	ldr	w0, [x0]
	add	w1, w0, 1
	adrp	x0, total__2
	add	x0, x0, :lo12:total__2
	str	w1, [x0]
	ldr	w0, [sp, 12]
	mov	w1, 1000
	sdiv	w2, w0, w1
	mov	w1, 1000
	mul	w1, w2, w1
	sub	w1, w0, w1
	adrp	x0, hist__3
	add	x0, x0, :lo12:hist__3
	sxtw	x1, w1
	ldr	w1, [x0, x1, lsl 2]
	mov	w0, 10000
	mul	w1, w1, w0
	adrp	x0, total__2
	add	x0, x0, :lo12:total__2
	ldr	w0, [x0]
	add	w0, w1, w0
	add	sp, sp, 16
	ret
	.section .rodata
	.align	3
.LC1:
	.string	"d=%.17g big=%lld\n"
	.text
	.align	2
halves:
	stp	x29, x30, [sp, -16]!
	mov	x29, sp
	adrp	x0, d__1
	add	x0, x0, :lo12:d__1
	ldr	d31, [x0]
	fadd	d31, d31, d31
	adrp	x0, d__1
	add	x0, x0, :lo12:d__1
	str	d31, [x0]
	adrp	x0, big__0
	add	x0, x0, :lo12:big__0
	ldr	x0, [x0]
	mov	x1, 6148914691236517205
	movk	x1, 0x5556, lsl 0
	smulh	x1, x0, x1
	asr	x0, x0, 63
	sub	x0, x1, x0
	sub	x1, x0, #1
	adrp	x0, big__0
	add	x0, x0, :lo12:big__0
	str	x1, [x0]
	adrp	x0, d__1
	add	x0, x0, :lo12:d__1
	ldr	d31, [x0]
	adrp	x0, big__0
	add	x0, x0, :lo12:big__0
	ldr	x0, [x0]
	mov	x1, x0
	fmov	d0, d31
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	adrp	x0, d__1
	add	x0, x0, :lo12:d__1
	ldr	d31, [x0]
	fmov	d0, d31
	ldp	x29, x30, [sp], 16
	ret
	.section .rodata
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
	.string	"\n"
	.align	3
.LC6:
	.string	"%s "
	.align	3
.LC7:
	.string	"fib(16)=%d\n"
	.align	3
.LC8:
	.string	"fib(9)=%d\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #80
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	str	wzr, [sp, 52]
	str	wzr, [sp, 72]
	str	wzr, [sp, 68]
	str	xzr, [sp, 56]
	str	wzr, [sp, 76]
	b	.L42
.L45:
	bl	tick_a
	str	w0, [sp, 48]
	bl	tick_b
	str	w0, [sp, 44]
	bl	wrap8
	strb	w0, [sp, 43]
	bl	wrap16
	strh	w0, [sp, 40]
	bl	swrap
	strb	w0, [sp, 39]
	bl	cursor_next
	mov	w1, w0
	ldr	w0, [sp, 68]
	add	w0, w0, w1
	str	w0, [sp, 68]
	ldr	w0, [sp, 72]
	bl	apply_next
	mov	w1, 34467
	movk	w1, 0x1, lsl 16
	sdiv	w2, w0, w1
	mov	w1, 34467
	movk	w1, 0x1, lsl 16
	mul	w1, w2, w1
	sub	w0, w0, w1
	str	w0, [sp, 72]
	ldr	w1, [sp, 76]
	mov	w0, w1
	lsl	w0, w0, 3
	add	w0, w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	mov	w1, 1100
	sdiv	w2, w0, w1
	mov	w1, 1100
	mul	w1, w2, w1
	sub	w0, w0, w1
	bl	histogram
	str	w0, [sp, 52]
	bl	state
	str	x0, [sp, 56]
	ldr	w0, [sp, 76]
	mov	w1, 50
	sdiv	w2, w0, w1
	mov	w1, 50
	mul	w1, w2, w1
	sub	w0, w0, w1
	cmp	w0, 0
	beq	.L43
	adrp	x0, rounds
	add	x0, x0, :lo12:rounds
	ldr	w0, [x0]
	sub	w0, w0, #1
	ldr	w1, [sp, 76]
	cmp	w1, w0
	bne	.L44
.L43:
	ldrb	w0, [sp, 43]
	ldrh	w1, [sp, 40]
	ldrsb	w2, [sp, 39]
	ldr	w3, [sp, 52]
	str	w3, [sp, 8]
	ldr	w3, [sp, 72]
	str	w3, [sp]
	ldr	w7, [sp, 68]
	mov	w6, w2
	mov	w5, w1
	mov	w4, w0
	ldr	w3, [sp, 44]
	ldr	w2, [sp, 48]
	ldr	w1, [sp, 76]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
.L44:
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L42:
	adrp	x0, rounds
	add	x0, x0, :lo12:rounds
	ldr	w0, [x0]
	ldr	w1, [sp, 76]
	cmp	w1, w0
	blt	.L45
	ldr	x0, [sp, 56]
	cmp	x0, 0
	beq	.L46
	ldr	x0, [sp, 56]
	ldrb	w0, [x0]
	mov	w7, w0
	ldr	x0, [sp, 56]
	ldr	x1, [x0, 8]
	ldr	x0, [sp, 56]
	ldrsh	w0, [x0, 16]
	mov	w2, w0
	ldr	x0, [sp, 56]
	ldrb	w0, [x0, 18]
	mov	w3, w0
	ldr	x0, [sp, 56]
	ldrb	w0, [x0, 19]
	mov	w4, w0
	ldr	x0, [sp, 56]
	ldrb	w0, [x0, 20]
	mov	w6, w0
	mov	w5, w4
	mov	w4, w3
	mov	w3, w2
	mov	x2, x1
	mov	w1, w7
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
.L46:
	str	wzr, [sp, 76]
	b	.L47
.L48:
	bl	tick_c
	mov	w1, w0
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L47:
	ldr	w0, [sp, 76]
	cmp	w0, 9
	ble	.L48
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	str	wzr, [sp, 76]
	b	.L49
.L50:
	ldr	w0, [sp, 76]
	bl	name_of
	mov	x1, x0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L49:
	ldr	w0, [sp, 76]
	cmp	w0, 7
	ble	.L50
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w1, 0
	mov	w0, 16
	bl	fib_probe
	mov	w1, w0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	mov	w1, 1
	mov	w0, 0
	bl	fib_probe
	mov	w1, 0
	mov	w0, 9
	bl	fib_probe
	mov	w1, w0
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	mov	w1, 1
	mov	w0, 0
	bl	fib_probe
	str	wzr, [sp, 76]
	b	.L51
.L52:
	bl	halves
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L51:
	ldr	w0, [sp, 76]
	cmp	w0, 4
	ble	.L52
	mov	w0, 0
	ldp	x29, x30, [sp, 16]
	add	sp, sp, 80
	ret
	.data
	.align	2
hits__18:
	.word	100
	.align	2
hits__17:
	.word	-5
c__16:
	.byte	-6
	.align	1
s__15:
	.hword	-6
c__14:
	.byte	120
	.align	3
cur__13:
	.quad	pool__11+20
	.section .rodata
	.align	3
end__12:
	.quad	pool__11+32
	.data
	.align	3
pool__11:
	.word	11
	.word	22
	.word	33
	.word	44
	.word	55
	.word	66
	.word	77
	.word	88
	.align	3
last__10:
	.quad	names__9+32
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
	.align	3
.LC13:
	.string	"four"
	.align	3
names__9:
	.quad	.LC9
	.quad	.LC10
	.quad	.LC11
	.quad	.LC12
	.quad	.LC13
	.data
	.align	3
m__8:
	.byte	113
	.zero	7
	.quad	81985529216486895
	.hword	-2
	.byte 250, 251, 252
	.zero	3
	.align	3
op__7:
	.quad	add1
	.align	3
d__1:
	.word	-1717986918
	.word	1069128089
	.align	3
big__0:
	.quad	-9000000000000000000


	.bss
	.balign 4
hits__19:
	.skip 4
	.balign 4
calls__6:
	.skip 4
	.balign 4
deepest__5:
	.skip 4
	.balign 4
now__4:
	.skip 4
	.balign 8
hist__3:
	.skip 4000
	.balign 4
total__2:
	.skip 4
