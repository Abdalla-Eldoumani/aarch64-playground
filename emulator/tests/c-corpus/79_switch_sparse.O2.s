	.text
	.align	2
	.align 5
sparse32:
	cmp	w0, 4095
	beq	.L6
	ble	.L21
	mov	w1, 9029
	movk	w1, 0x1, lsl 16
	cmp	w0, w1
	beq	.L12
	bgt	.L5
	mov	w1, 9
	mov	w2, 65535
	cmp	w0, w2
	beq	.L1
	mov	w1, 10
	cmp	w0, 65536
	beq	.L1
	cmp	w0, 4096
	cset	w1, eq
	lsl	w1, w1, 3
.L1:
	mov	w0, w1
	ret
	.align 2
.L21:
	cmn	w0, #4096
	beq	.L7
	cmn	w0, #4095
	bge	.L4
	mov	w1, 2
	cmn	w0, #65536
	beq	.L1
	mov	w1, 3
	mov	w2, -4097
	cmp	w0, w2
	beq	.L1
	mov	w1, -2147483648
	cmp	w0, w1
	cset	w1, eq
	b	.L1
	.align 2
.L5:
	mov	w1, 12
	mov	w2, 2147418112
	cmp	w0, w2
	beq	.L1
	mov	w1, 2147483647
	cmp	w0, w1
	mov	w1, 13
	csel	w1, wzr, w1, ne
	b	.L1
	.align 2
.L4:
	mov	w1, 5
	cmn	w0, #1
	beq	.L1
	cmp	w0, 0
	mov	w1, 6
	csel	w1, wzr, w1, ne
	b	.L1
	.align 2
.L7:
	mov	w1, 4
	b	.L1
	.align 2
.L12:
	mov	w1, 11
	b	.L1
	.align 2
.L6:
	mov	w1, 7
	b	.L1
	.align	2
	.align 5
clustered:
	cmp	w0, 1002
	beq	.L23
	bgt	.L24
	cmp	w0, 6
	beq	.L25
	bgt	.L26
	cmp	w0, 3
	beq	.L27
	bgt	.L28
	cmp	w0, 1
	beq	.L29
	add	w1, w1, w1, lsl 2
	add	w1, w1, 2
	cmp	w0, 2
	bne	.L38
.L22:
	mov	w0, w1
	ret
	.align 2
.L24:
	mov	w2, 50000
	cmp	w0, w2
	beq	.L39
	bgt	.L40
	cmp	w0, 1005
	beq	.L41
	bgt	.L42
	cmp	w0, 1003
	beq	.L57
	add	w1, w1, w1, lsl 2
	lsl	w1, w1, 1
	add	w1, w1, 104
	b	.L22
	.align 2
.L40:
	mov	w2, 50003
	cmp	w0, w2
	beq	.L47
	bgt	.L48
	mov	w2, 50001
	cmp	w0, w2
	beq	.L58
	lsl	w0, w1, 3
	sub	w0, w0, w1
	add	w1, w0, 502
	b	.L22
	.align 2
.L26:
	cmp	w0, 1000
	beq	.L34
	cmp	w0, 1001
	beq	.L35
	cmp	w0, 7
	beq	.L36
	cmp	w0, 8
	bne	.L38
	mov	w0, 23
	mul	w1, w1, w0
	add	w1, w1, 8
	b	.L22
	.align 2
.L28:
	cmp	w0, 4
	beq	.L59
	add	w0, w1, w1, lsl 1
	add	w0, w1, w0, lsl 2
	add	w1, w0, 5
	b	.L22
	.align 2
.L42:
	cmp	w0, 1006
	beq	.L45
	lsl	w1, w1, 4
	add	w1, w1, 107
	cmp	w0, 1007
	beq	.L22
.L38:
	mov	w1, -1
	b	.L22
	.align 2
.L48:
	cmp	w0, 1048576
	bne	.L38
	mov	w0, 99
	mul	w1, w1, w0
	add	w1, w1, 999
	b	.L22
	.align 2
.L27:
	lsl	w0, w1, 3
	sub	w0, w0, w1
	add	w1, w0, 3
	b	.L22
	.align 2
.L41:
	add	w1, w1, w1, lsl 1
	lsl	w1, w1, 2
	add	w1, w1, 105
	b	.L22
	.align 2
.L34:
	add	w1, w1, 50
	lsl	w1, w1, 1
	b	.L22
	.align 2
.L58:
	lsl	w1, w1, 3
	add	w1, w1, 501
	b	.L22
	.align 2
.L36:
	add	w0, w1, w1, lsl 3
	add	w0, w1, w0, lsl 1
	add	w1, w0, 7
	b	.L22
	.align 2
.L47:
	add	w1, w1, w1, lsl 1
	lsl	w1, w1, 1
	add	w1, w1, 503
	b	.L22
	.align 2
.L57:
	lsl	w1, w1, 3
	add	w1, w1, 103
	b	.L22
	.align 2
.L29:
	add	w1, w1, w1, lsl 1
	add	w1, w1, 1
	b	.L22
	.align 2
.L39:
	add	w1, w1, w1, lsl 3
	add	w1, w1, 500
	b	.L22
	.align 2
.L23:
	add	w1, w1, w1, lsl 1
	lsl	w1, w1, 1
	add	w1, w1, 102
	b	.L22
	.align 2
.L25:
	add	w1, w1, w1, lsl 4
	add	w1, w1, 6
	b	.L22
	.align 2
.L35:
	lsl	w1, w1, 2
	add	w1, w1, 101
	b	.L22
	.align 2
.L45:
	mov	w0, 14
	mul	w1, w1, w0
	add	w1, w1, 106
	b	.L22
	.align 2
.L59:
	add	w0, w1, w1, lsl 2
	add	w0, w1, w0, lsl 1
	add	w1, w0, 4
	b	.L22
	.align	2
	.align 5
punct_kind:
	sub	w0, w0, #33
	cmp	w0, 63
	bhi	.L62
	mov	x3, 22065
	mov	x2, 1
	movk	x3, 0xb800, lsl 16
	lsl	x1, x2, x0
	movk	x3, 0x2000, lsl 48
	mov	w0, 2
	tst	x1, x3
	bne	.L60
	mov	w0, w2
	mov	x2, 384
	movk	x2, 0x1400, lsl 48
	tst	x1, x2
	bne	.L60
	mov	x0, 66
	movk	x0, 0x8000, lsl 48
	tst	x1, x0
	mov	w0, 3
	csel	w0, wzr, w0, eq
.L60:
	ret
	.align 2
.L62:
	mov	w0, 0
	ret
	.align	2
	.align 5
key64:
	mov	x2, 9223372036854775807
	cmp	x0, x2
	beq	.L70
	tbnz	x0, #63, .L68
	mov	w1, 3
	mov	x2, 4294967296
	cmp	x0, x2
	beq	.L66
	bhi	.L69
	mov	w1, 1
	cbz	x0, .L66
	mov	x1, 4294967295
	cmp	x0, x1
	cset	w1, eq
	lsl	w1, w1, 1
.L66:
	mov	w0, w1
	ret
	.align 2
.L68:
	mov	x3, 47806
	mov	w1, 7
	movk	x3, 0xcafe, lsl 16
	movk	x3, 0xbeef, lsl 32
	movk	x3, 0xdead, lsl 48
	cmp	x0, x3
	beq	.L66
	mov	w1, 8
	cmn	x0, #1
	beq	.L66
	add	x2, x2, 1
	mov	w1, 6
	cmp	x0, x2
	csel	w1, w1, wzr, eq
	mov	w0, w1
	ret
	.align 2
.L69:
	mov	x1, 1099511627776
	cmp	x0, x1
	cset	w1, eq
	lsl	w1, w1, 2
	mov	w0, w1
	ret
	.align 2
.L70:
	mov	w1, 5
	mov	w0, w1
	ret
	.align	2
	.align 5
skey64:
	cmn	x0, #1
	beq	.L81
	tbz	x0, #63, .L80
	mov	w1, 2
	mov	x2, -4294967296
	cmp	x0, x2
	beq	.L78
	mov	w1, 3
	cmn	x0, #4096
	beq	.L78
	mov	x1, -9223372036854775808
	cmp	x0, x1
	cset	w1, eq
.L78:
	mov	w0, w1
	ret
	.align 2
.L80:
	mov	w1, 5
	mov	x2, 2147483648
	cmp	x0, x2
	beq	.L78
	mov	x1, 9223372036854775807
	cmp	x0, x1
	mov	w1, 6
	csel	w1, w1, wzr, eq
	mov	w0, w1
	ret
	.align 2
.L81:
	mov	w1, 4
	mov	w0, w1
	ret
	.align	2
	.align 5
is_small_prime:
	cmp	w0, 127
	bgt	.L88
	cmp	w0, 66
	bgt	.L89
	sub	w1, w0, #2
	cmp	w1, 59
	bhi	.L94
	mov	x1, 10412
	movk	x1, 0xa08a, lsl 16
	movk	x1, 0x8a20, lsl 32
	movk	x1, 0x2820, lsl 48
	lsr	x0, x1, x0
	and	w0, w0, 1
	ret
	.align 2
.L88:
	cmp	w0, 191
	bgt	.L92
	cmp	w0, 130
	ble	.L94
	mov	x1, 321
	sub	w0, w0, #131
	movk	x1, 0x414, lsl 16
	movk	x1, 0x411, lsl 32
	movk	x1, 0x1005, lsl 48
	lsr	x0, x1, x0
	and	w0, w0, 1
	ret
	.align 2
.L89:
	mov	x1, 4177
	sub	w0, w0, #67
	movk	x1, 0x4041, lsl 16
	movk	x1, 0x4514, lsl 32
	movk	x1, 0x1000, lsl 48
	lsr	x0, x1, x0
	and	w0, w0, 1
	ret
	.align 2
.L94:
	mov	w0, 0
	ret
	.align 2
.L92:
	sub	w0, w0, #193
	cmp	w0, 6
	bhi	.L94
	mov	x1, 81
	lsr	x0, x1, x0
	and	w0, w0, 1
	ret
	.align	2
	.align 5
sc_kind:
	sxtb	w1, w0
	cmp	w1, 0
	cbz	w1, .L100
	bgt	.L99
	mov	w0, 2
	cmn	w1, #100
	beq	.L97
	mov	w0, 3
	cmn	w1, #1
	beq	.L97
	cmn	w1, #128
	cset	w0, eq
.L97:
	ret
	.align 2
.L99:
	mov	w0, 5
	cmp	w1, 100
	beq	.L97
	cmp	w1, 127
	mov	w0, 6
	csel	w0, w0, wzr, eq
	ret
	.align 2
.L100:
	mov	w0, 4
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"sparse32:"
	.align	3
.LC1:
	.string	" %d"
	.align	3
.LC2:
	.string	" | %u\n"
	.align	3
.LC3:
	.string	"clustered:"
	.align	3
.LC4:
	.string	"\n"
	.align	3
.LC5:
	.string	"punct: "
	.align	3
.LC6:
	.string	" %d %d %d\n"
	.align	3
.LC7:
	.string	"key64:"
	.align	3
.LC8:
	.string	" %d%d%d"
	.align	3
.LC9:
	.string	"skey64:"
	.align	3
.LC10:
	.string	"primes:"
	.align	3
.LC11:
	.string	" | %d\n"
	.align	3
.LC12:
	.string	"schar:"
	.align	3
.LC13:
	.string	" %d:%d"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -96]!
	adrp	x0, .LANCHOR0
	mov	x29, sp
	stp	x23, x24, [sp, 48]
	adrp	x24, .LANCHOR1
	add	x24, x24, :lo12:.LANCHOR1
	add	x23, x24, 104
	stp	x21, x22, [sp, 32]
	adrp	x21, .LC1
	mov	x22, x24
	add	x21, x21, :lo12:.LC1
	stp	x25, x26, [sp, 64]
	mov	w25, 0
	mov	x26, 4294967295
	str	x27, [sp, 80]
	mov	x27, 2147483648
	stp	x19, x20, [sp, 16]
	ldr	w20, [x0, :lo12:.LANCHOR0]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	.align 5
.L109:
	mov	x19, -1
.L111:
	ldr	x0, [x22]
	add	x0, x19, x0
	add	x1, x0, x27
	cmp	x1, x26
	bhi	.L110
	add	w0, w20, w0
	bl	sparse32
	lsl	w2, w25, 5
	mov	w1, w0
	sub	w2, w2, w25
	add	w25, w0, w2
	mov	x0, x21
	bl	printf
.L110:
	add	x19, x19, 1
	cmp	x19, 2
	bne	.L111
	add	x22, x22, 8
	cmp	x22, x23
	bne	.L109
	mov	w1, w25
	add	x22, x24, 112
	mov	x19, 0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	.align 5
.L113:
	ldr	w0, [x22, x19, lsl 2]
	add	w1, w19, 10
	add	x19, x19, 1
	add	w0, w20, w0
	bl	clustered
	mov	w1, w0
	mov	x0, x21
	bl	printf
	cmp	x19, 18
	bne	.L113
	add	w19, w20, 32
	add	w23, w20, 128
	adrp	x22, .LC4
	add	x22, x22, :lo12:.LC4
	mov	x0, x22
	bl	printf
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	.align 5
.L114:
	mov	w0, w19
	add	w19, w19, 1
	bl	punct_kind
	add	w0, w0, 48
	bl	putchar
	cmp	w19, w23
	bne	.L114
	sub	w0, w20, #1
	bl	punct_kind
	mov	w4, w0
	add	w0, w20, 289
	bl	punct_kind
	mov	w5, w0
	mov	w0, w19
	bl	punct_kind
	mov	w2, w5
	mov	w3, w0
	mov	w1, w4
	adrp	x19, .LC8
	sxtw	x23, w20
	add	x25, x24, 192
	add	x26, x24, 280
	add	x19, x19, :lo12:.LC8
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	.align 5
.L115:
	ldr	x4, [x25], 8
	add	x4, x23, x4
	sub	x0, x4, #1
	bl	key64
	mov	w5, w0
	mov	x0, x4
	bl	key64
	mov	w6, w0
	add	x0, x4, 1
	bl	key64
	mov	w2, w6
	mov	w3, w0
	mov	w1, w5
	mov	x0, x19
	bl	printf
	cmp	x26, x25
	bne	.L115
	mov	x0, x22
	bl	printf
	add	x27, x24, 288
	adrp	x0, .LC9
	add	x24, x24, 352
	add	x0, x0, :lo12:.LC9
	mov	x25, -9223372036854775808
	mov	x26, 9223372036854775807
	bl	printf
	b	.L119
	.align 2
.L116:
	sub	x0, x4, #1
	bl	skey64
	mov	w6, w0
	mov	x0, x4
	bl	skey64
	mov	w3, 9
	mov	w5, w0
	cmp	x4, x26
	beq	.L118
.L117:
	add	x0, x4, 1
	bl	skey64
	mov	w3, w0
.L118:
	mov	w2, w5
	mov	w1, w6
	mov	x0, x19
	add	x27, x27, 8
	bl	printf
	cmp	x27, x24
	beq	.L141
.L119:
	ldr	x4, [x27]
	add	x4, x23, x4
	cmp	x4, x25
	bne	.L116
	mov	x0, x25
	mov	w6, 9
	bl	skey64
	mov	w5, w0
	b	.L117
.L141:
	mov	w23, 0
	mov	w19, -3
	mov	x0, x22
	bl	printf
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	.align 5
.L124:
	add	w0, w19, w20
	bl	is_small_prime
	cbz	w0, .L120
.L142:
	add	w23, w23, 1
	cmp	w19, 150
	bgt	.L121
	add	w19, w19, 1
	add	w0, w19, w20
	bl	is_small_prime
	cbnz	w0, .L142
.L120:
	add	w19, w19, 1
	cmp	w19, 211
	bne	.L124
.L144:
	mov	w1, w23
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	adrp	x0, .LC12
	adrp	x21, .LC13
	add	x0, x0, :lo12:.LC12
	add	x21, x21, :lo12:.LC13
	mov	w19, 0
	bl	printf
	b	.L126
	.align 2
.L125:
	add	w19, w19, 1
	cmp	w19, 256
	beq	.L143
.L126:
	add	w0, w20, w19
	bl	sc_kind
	cbz	w0, .L125
	mov	w2, w0
	mov	w1, w19
	mov	x0, x21
	add	w19, w19, 1
	bl	printf
	cmp	w19, 256
	bne	.L126
.L143:
	mov	x0, x22
	bl	printf
	ldr	x27, [sp, 80]
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x29, x30, [sp], 96
	ret
	.align 2
.L121:
	mov	w1, w19
	mov	x0, x21
	add	w19, w19, 1
	bl	printf
	cmp	w19, 211
	bne	.L124
	b	.L144
	.section .rodata
	.align	4
	.LANCHOR1:
k32.3:
	.quad	-2147483648
	.quad	-65536
	.quad	-4097
	.quad	-4096
	.quad	-1
	.quad	0
	.quad	4095
	.quad	4096
	.quad	65535
	.quad	65536
	.quad	74565
	.quad	2147418112
	.quad	2147483647
	.zero	8
kc.2:
	.word	0
	.word	1
	.word	4
	.word	8
	.word	9
	.word	999
	.word	1000
	.word	1003
	.word	1007
	.word	1008
	.word	49999
	.word	50000
	.word	50003
	.word	50004
	.word	1048575
	.word	1048576
	.word	1048577
	.word	-1
	.zero	8
k64.1:
	.quad	0
	.quad	4294967295
	.quad	4294967296
	.quad	1099511627776
	.quad	9223372036854775807
	.quad	-9223372036854775808
	.quad	-2401053089206453570
	.quad	-1
	.quad	8589934591
	.quad	-2401053092612145152
	.quad	3405691582
	.zero	8
s64.0:
	.quad	-9223372036854775808
	.quad	-4294967296
	.quad	-4096
	.quad	-1
	.quad	2147483648
	.quad	9223372036854775807
	.quad	2147483647
	.quad	-2147483648
	.bss
	.align	2
	.LANCHOR0:
vzero:
	.zero	4

